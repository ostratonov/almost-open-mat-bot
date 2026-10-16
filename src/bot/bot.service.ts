import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { run, sequentialize, type RunnerHandle } from '@grammyjs/runner';
import { Bot, Context, InlineKeyboard, InputFile, InputMediaBuilder } from 'grammy';
import type { User } from 'grammy/types';
import { config } from '../config.ts';
import { addCaption } from '../image/caption.ts';
import { StatsStore } from '../stats/stats.store.ts';
import { StatEvent } from '../stats/stats.types.ts';
import { CallbackData, Command, formatStats, GROUP_MENU, MENU, OWNER_MENU, TEXTS } from '../texts.ts';
import {
  BotEvent,
  Limit,
  type PendingPicture,
  RefusedReason,
  type RenderedPicture,
  SuggestVia,
} from './bot.types.ts';
import { MediaGroupCollector } from './media-group.ts';
import { RateLimiter } from './rate-limiter.ts';
import {
  album,
  botPhotoId,
  commandName,
  displayName,
  downloadFile,
  isImage,
  largestPhoto,
  mentionCaption,
  messageKind,
  pictureFileId,
} from './telegram.utils.ts';

const SUGGESTIONS_PER_MINUTE = 3;
const PICTURES_PER_MINUTE = 20;
const ALBUM_QUIET_MS = 1000;
const HEARTBEAT_MS = 5 * 60_000;
const STATS_PERIOD_MS = 7 * 24 * 60 * 60_000;

const elapsed = (from: number) => Math.round(performance.now() - from);

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  private readonly bot = new Bot(config.botToken);
  private readonly suggestions = new RateLimiter(SUGGESTIONS_PER_MINUTE, 60_000);
  private readonly pictures = new RateLimiter(PICTURES_PER_MINUTE, 60_000);
  private readonly albums = new MediaGroupCollector<PendingPicture>(ALBUM_QUIET_MS, (items) => this.onAlbum(items));
  private readonly albumAnswers = new Set<Promise<unknown>>();
  private readonly stats: StatsStore;
  private runner?: RunnerHandle;
  private heartbeat?: NodeJS.Timeout;

  constructor(stats: StatsStore) {
    this.stats = stats;
  }

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
    this.logger.log({ event: BotEvent.Stopping, albumsInFlight: this.albumAnswers.size });
    clearInterval(this.heartbeat);
    if (this.runner?.isRunning()) await this.runner.stop();
    this.albums.flush();
    await Promise.all(this.albumAnswers);
    this.stats.close();
  }

  private setUpProfile() {
    const warn = (what: string) => (err: unknown) => this.logger.warn({ event: BotEvent.Error, what, error: String(err) });
    this.bot.api.setMyDescription(TEXTS.about).catch(warn('description'));
    this.bot.api.setMyCommands(MENU).catch(warn('menu'));
    this.bot.api.setMyCommands(GROUP_MENU, { scope: { type: 'all_group_chats' } }).catch(warn('group menu'));
    if (config.ownerId) {
      this.bot.api
        .setMyCommands(OWNER_MENU, { scope: { type: 'chat', chat_id: config.ownerId } })
        .catch(warn('owner menu'));
    }
  }

  private registerHandlers() {
    this.bot.use(sequentialize((ctx) => ctx.chat?.id.toString()));

    this.bot.on('::bot_command', (ctx, next) => {
      this.logger.log({
        event: BotEvent.Command,
        command: commandName(ctx.msg.text ?? ''),
        userId: ctx.from?.id,
        chatId: ctx.chat.id,
        chatType: ctx.chat.type,
      });
      return next();
    });

    this.bot.on('my_chat_member', (ctx) =>
      this.logger.log({
        event: BotEvent.ChatMember,
        status: ctx.myChatMember.new_chat_member.status,
        chatId: ctx.chat.id,
        chatType: ctx.chat.type,
        title: 'title' in ctx.chat ? ctx.chat.title : undefined,
        by: ctx.from.id,
      }),
    );

    this.bot.command(Command.Start, (ctx) => ctx.reply(TEXTS.about));
    this.bot.command(Command.Support, (ctx) => ctx.reply(TEXTS.support));

    this.bot.chatType(['group', 'supergroup']).command(Command.AlmostOpenMat, (ctx) => this.onGroupCommand(ctx));

    const dm = this.bot.chatType('private');
    dm.command(Command.Suggest, (ctx) => this.onSuggest(ctx));
    dm.command(Command.Stats, (ctx) => this.onStats(ctx));
    dm.callbackQuery(CallbackData.Suggest, (ctx) => this.onSuggestButton(ctx));
    dm.on('message:photo', (ctx) => this.onPicture(ctx));
    dm.on('message:document', (ctx) => {
      if (isImage(ctx.message.document)) return this.onPicture(ctx);
      this.refuse(ctx.from.id, RefusedReason.NotAnImage, ctx.message.document.mime_type);
      return ctx.reply(TEXTS.notAnImage);
    });
    dm.on('message', (ctx) =>
      this.logger.log({ event: BotEvent.Ignored, userId: ctx.from.id, kind: messageKind(ctx.message) }),
    );
  }

  private async onPicture(ctx: Context) {
    const message = ctx.message!;
    const fileId = pictureFileId(message)!;
    const groupId = message.media_group_id;
    if (!groupId) {
      const placeholder = await ctx.reply(TEXTS.drawing);
      return this.answer(message.chat.id, message.from!, [fileId], placeholder.message_id, true);
    }

    const placeholderId = this.albums.has(groupId) ? undefined : (await ctx.reply(TEXTS.drawing)).message_id;
    this.albums.add(groupId, { message, fileId, placeholderId });
  }

  private async onGroupCommand(ctx: Context) {
    const command = ctx.message!;
    const target = command.reply_to_message;
    const fileId = target && pictureFileId(target);
    if (!target || !fileId) {
      this.refuse(command.from!.id, RefusedReason.NoPictureReply);
      return ctx.reply(TEXTS.replyToPicture, {
        reply_parameters: { message_id: command.message_id, allow_sending_without_reply: true },
      });
    }

    const placeholder = await ctx.reply(TEXTS.drawing, {
      reply_parameters: { message_id: target.message_id, allow_sending_without_reply: true },
    });
    return this.answer(command.chat.id, command.from!, [fileId], placeholder.message_id, false);
  }

  private onAlbum(items: PendingPicture[]) {
    const placeholderId = items.find((item) => item.placeholderId)!.placeholderId!;
    const sorted = items.sort((a, b) => a.message.message_id - b.message.message_id);
    const { chat, from } = sorted[0].message;
    const answering = this.answer(chat.id, from!, sorted.map((item) => item.fileId), placeholderId, true)
      .catch((err) => this.logger.error({ event: BotEvent.Error, error: String(err) }, err?.stack))
      .finally(() => this.albumAnswers.delete(answering));
    this.albumAnswers.add(answering);
  }

  private async answer(chatId: number, user: User, fileIds: string[], placeholderId: number, suggestable: boolean) {
    const userId = user.id;
    if (!this.pictures.tryTake(userId, fileIds.length)) {
      this.logger.log({ event: BotEvent.RateLimited, limit: Limit.Pictures, userId, chatId, pictures: fileIds.length });
      return this.bot.api.editMessageText(chatId, placeholderId, TEXTS.tooManyPictures);
    }

    const results = await Promise.all(
      fileIds.map((fileId) =>
        this.render(fileId).catch((err) => {
          this.logger.warn({ event: BotEvent.PictureFailed, userId, chatId, error: String(err) });
          return null;
        }),
      ),
    );
    const rendered = results.filter((r) => r !== null);
    for (const { timings } of rendered) this.logger.log({ event: BotEvent.Picture, userId, chatId, ...timings });
    if (!rendered.length) return this.bot.api.editMessageText(chatId, placeholderId, TEXTS.cannotOpen);

    const sending = performance.now();
    if (rendered.length === 1) await this.replacePlaceholder(chatId, placeholderId, rendered[0].image, suggestable);
    else await this.sendAlbum(chatId, placeholderId, rendered.map((r) => r.image));

    this.stats.record(StatEvent.Picture, userId, displayName(user), chatId, rendered.length);
    this.logger.log({
      event: BotEvent.Answer,
      userId,
      chatId,
      pictures: rendered.length,
      failed: fileIds.length - rendered.length,
      sendMs: elapsed(sending),
    });
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
    if (!fileId) {
      this.refuse(ctx.from!.id, RefusedReason.NoCaptionedReply);
      return ctx.reply(TEXTS.replyToCaptioned);
    }

    const sent = await this.suggest(ctx.from!, fileId, SuggestVia.Reply);
    await ctx.reply(sent ? TEXTS.sentToTrainer : TEXTS.tooManySuggestions);
  }

  private async onSuggestButton(ctx: Context) {
    const photo = ctx.msg?.photo;
    if (!photo) return ctx.answerCallbackQuery();

    const sent = await this.suggest(ctx.from!, largestPhoto(photo).file_id, SuggestVia.Button);
    if (sent) await ctx.editMessageReplyMarkup();
    await ctx.answerCallbackQuery({ text: sent ? TEXTS.sentToTrainer : TEXTS.tooManySuggestions, show_alert: !sent });
  }

  private async suggest(from: User, fileId: string, via: SuggestVia): Promise<boolean> {
    if (!this.suggestions.tryTake(from.id)) {
      this.logger.log({ event: BotEvent.RateLimited, limit: Limit.Suggestions, userId: from.id, via });
      return false;
    }

    await this.bot.api.sendPhoto(config.trainerChatId, fileId, mentionCaption(TEXTS.suggestedBy, from));
    this.stats.record(StatEvent.Suggestion, from.id, displayName(from), from.id);
    this.logger.log({ event: BotEvent.Suggestion, userId: from.id, via });
    return true;
  }

  private onStats(ctx: Context) {
    if (ctx.from?.id !== config.ownerId) return;
    return ctx.reply(formatStats(this.stats.since(Date.now() - STATS_PERIOD_MS)));
  }

  private refuse(userId: number, reason: RefusedReason, detail?: string) {
    this.logger.log({ event: BotEvent.Refused, reason, userId, detail });
  }
}
