import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { run, sequentialize, type RunnerHandle } from '@grammyjs/runner';
import { Bot, Context, InlineKeyboard, InputFile, InputMediaBuilder } from 'grammy';
import type { User } from 'grammy/types';
import { config } from '../config.ts';
import { addCaption } from '../image/caption.ts';
import { CallbackData, Command, GROUP_MENU, MENU, TEXTS } from '../texts.ts';
import { BotEvent, Limit, type PendingPicture, type RenderedPicture } from './bot.types.ts';
import { MediaGroupCollector } from './media-group.ts';
import { RateLimiter } from './rate-limiter.ts';
import { album, botPhotoId, downloadFile, isImage, largestPhoto, mentionCaption, pictureFileId } from './telegram.utils.ts';

const SUGGESTIONS_PER_MINUTE = 3;
const PICTURES_PER_MINUTE = 20;
const ALBUM_QUIET_MS = 1000;
const HEARTBEAT_MS = 5 * 60_000;

const elapsed = (from: number) => Math.round(performance.now() - from);

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  private readonly bot = new Bot(config.botToken);
  private readonly suggestions = new RateLimiter(SUGGESTIONS_PER_MINUTE, 60_000);
  private readonly pictures = new RateLimiter(PICTURES_PER_MINUTE, 60_000);
  private readonly albums = new MediaGroupCollector<PendingPicture>(ALBUM_QUIET_MS, (items) => this.onAlbum(items));
  private readonly albumAnswers = new Set<Promise<unknown>>();
  private runner?: RunnerHandle;
  private heartbeat?: NodeJS.Timeout;

  async onApplicationBootstrap() {
    this.setUpProfile();
    this.registerHandlers();
    this.bot.catch((err) => this.logger.error({ event: BotEvent.Error, error: String(err.error) }, (err.error as Error)?.stack));

    await this.bot.init();
    this.runner = run(this.bot);
    this.logger.log({ event: BotEvent.Started, username: this.bot.botInfo.username });
    this.heartbeat = setInterval(() => this.logger.log({ event: BotEvent.Alive }), HEARTBEAT_MS);
  }

  async onApplicationShutdown() {
    clearInterval(this.heartbeat);
    if (this.runner?.isRunning()) await this.runner.stop();
    this.albums.flush();
    await Promise.all(this.albumAnswers);
  }

  private setUpProfile() {
    void this.bot.api.setMyDescription(TEXTS.about);
    void this.bot.api.setMyCommands(MENU);
    void this.bot.api.setMyCommands(GROUP_MENU, { scope: { type: 'all_group_chats' } });
  }

  private registerHandlers() {
    // Chats run in parallel, but one chat's updates stay in order: an album's first photo sends the placeholder the rest rely on.
    this.bot.use(sequentialize((ctx) => ctx.chat?.id.toString()));

    this.bot.command(Command.Start, (ctx) => ctx.reply(TEXTS.about));
    this.bot.command(Command.Support, (ctx) => ctx.reply(TEXTS.support));

    this.bot.chatType(['group', 'supergroup']).command(Command.AlmostOpenMat, (ctx) => this.onGroupCommand(ctx));

    const dm = this.bot.chatType('private');
    dm.command(Command.Suggest, (ctx) => this.onSuggest(ctx));
    dm.callbackQuery(CallbackData.Suggest, (ctx) => this.onSuggestButton(ctx));
    dm.on('message:photo', (ctx) => this.onPicture(ctx));
    dm.on('message:document', (ctx) =>
      isImage(ctx.message.document) ? this.onPicture(ctx) : ctx.reply(TEXTS.notAnImage),
    );
  }

  private async onPicture(ctx: Context) {
    const message = ctx.message!;
    const fileId = pictureFileId(message)!;
    const groupId = message.media_group_id;
    if (!groupId) {
      const placeholder = await ctx.reply(TEXTS.drawing);
      return this.answer(message.chat.id, message.from!.id, [fileId], placeholder.message_id, true);
    }

    const placeholderId = this.albums.has(groupId) ? undefined : (await ctx.reply(TEXTS.drawing)).message_id;
    this.albums.add(groupId, { message, fileId, placeholderId });
  }

  private async onGroupCommand(ctx: Context) {
    const command = ctx.message!;
    const target = command.reply_to_message;
    const fileId = target && pictureFileId(target);
    if (!target || !fileId) return ctx.reply(TEXTS.replyToPicture, { reply_parameters: { message_id: command.message_id, allow_sending_without_reply: true } });

    const placeholder = await ctx.reply(TEXTS.drawing, { reply_parameters: { message_id: target.message_id, allow_sending_without_reply: true } });
    return this.answer(command.chat.id, command.from!.id, [fileId], placeholder.message_id, false);
  }

  // Runs from a timer, outside grammY's middleware, so bot.catch never sees its errors.
  private onAlbum(items: PendingPicture[]) {
    const placeholderId = items.find((item) => item.placeholderId)!.placeholderId!;
    const sorted = items.sort((a, b) => a.message.message_id - b.message.message_id);
    const { chat, from } = sorted[0].message;
    const answering = this.answer(chat.id, from!.id, sorted.map((item) => item.fileId), placeholderId, true)
      .catch((err) => this.logger.error({ event: BotEvent.Error, error: String(err) }, err?.stack))
      .finally(() => this.albumAnswers.delete(answering));
    this.albumAnswers.add(answering);
  }

  private async answer(chatId: number, userId: number, fileIds: string[], placeholderId: number, suggestable: boolean) {
    if (!this.pictures.tryTake(userId, fileIds.length)) {
      this.logger.log({ event: BotEvent.RateLimited, limit: Limit.Pictures, userId, pictures: fileIds.length });
      return this.bot.api.editMessageText(chatId, placeholderId, TEXTS.tooManyPictures);
    }

    const results = await Promise.all(
      fileIds.map((fileId) =>
        this.render(fileId).catch((err) => {
          this.logger.warn({ event: BotEvent.PictureFailed, userId, error: String(err) });
          return null;
        }),
      ),
    );
    const rendered = results.filter((r) => r !== null);
    for (const { timings } of rendered) this.logger.log({ event: BotEvent.Picture, userId, ...timings });
    if (!rendered.length) return this.bot.api.editMessageText(chatId, placeholderId, TEXTS.cannotOpen);

    const sending = performance.now();
    if (rendered.length === 1) await this.replacePlaceholder(chatId, placeholderId, rendered[0].image, suggestable);
    else await this.sendAlbum(chatId, placeholderId, rendered.map((r) => r.image));

    this.logger.log({ event: BotEvent.Answer, userId, pictures: rendered.length, sendMs: elapsed(sending) });
  }

  private replacePlaceholder(chatId: number, placeholderId: number, image: Buffer, suggestable: boolean) {
    return this.bot.api.editMessageMedia(chatId, placeholderId, InputMediaBuilder.photo(new InputFile(image)), {
      reply_markup: suggestable ? new InlineKeyboard().text(TEXTS.suggestButton, CallbackData.Suggest) : undefined,
    });
  }

  private async sendAlbum(chatId: number, placeholderId: number, images: Buffer[]) {
    await this.bot.api.sendMediaGroup(chatId, album(images.map((image) => new InputFile(image))));
    await this.bot.api.deleteMessage(chatId, placeholderId);
  }

  private async render(fileId: string): Promise<RenderedPicture> {
    const started = performance.now();
    const file = await this.bot.api.getFile(fileId);
    const located = performance.now();
    const original = await downloadFile(config.botToken, file.file_path!);
    const downloaded = performance.now();
    const image = await addCaption(original);
    return {
      image,
      timings: {
        kb: original.length >> 10,
        getFileMs: Math.round(located - started),
        downloadMs: Math.round(downloaded - located),
        captionMs: elapsed(downloaded),
      },
    };
  }

  private async onSuggest(ctx: Context) {
    const replied = ctx.message?.reply_to_message;
    const fileId = replied && botPhotoId(replied, ctx.me.id);
    if (!fileId) return ctx.reply(TEXTS.replyToCaptioned);

    const sent = await this.suggest(ctx.from!, fileId);
    await ctx.reply(sent ? TEXTS.sentToTrainer : TEXTS.tooManySuggestions);
  }

  private async onSuggestButton(ctx: Context) {
    const photo = ctx.msg?.photo;
    if (!photo) return ctx.answerCallbackQuery();

    const sent = await this.suggest(ctx.from!, largestPhoto(photo).file_id);
    if (sent) await ctx.editMessageReplyMarkup();
    await ctx.answerCallbackQuery({ text: sent ? TEXTS.sentToTrainer : TEXTS.tooManySuggestions, show_alert: !sent });
  }

  private async suggest(from: User, fileId: string): Promise<boolean> {
    if (!this.suggestions.tryTake(from.id)) {
      this.logger.log({ event: BotEvent.RateLimited, limit: Limit.Suggestions, userId: from.id });
      return false;
    }

    await this.bot.api.sendPhoto(config.trainerChatId, fileId, mentionCaption(TEXTS.suggestedBy, from));
    this.logger.log({ event: BotEvent.Suggestion, userId: from.id });
    return true;
  }
}
