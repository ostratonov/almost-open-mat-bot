import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot, Context, InputFile, InputMediaBuilder } from 'grammy';
import type { User } from 'grammy/types';
import { config } from '../config.ts';
import { addCaption } from '../image/caption.ts';
import { Command, MENU, TEXTS } from '../texts.ts';
import type { PendingPicture, RenderedPicture } from './bot.types.ts';
import { MediaGroupCollector } from './media-group.ts';
import { RateLimiter } from './rate-limiter.ts';
import { album, botPhotoId, downloadFile, isImage, largestPhoto, mentionCaption } from './telegram.utils.ts';

const SUGGESTIONS_PER_MINUTE = 3;
const ALBUM_QUIET_MS = 1000;

const elapsed = (from: number) => Math.round(performance.now() - from);

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  private readonly bot = new Bot(config.botToken);
  private readonly lastPictures = new Map<number, string[]>();
  private readonly suggestions = new RateLimiter(SUGGESTIONS_PER_MINUTE, 60_000);
  private readonly albums = new MediaGroupCollector<PendingPicture>(ALBUM_QUIET_MS, (items) => this.onAlbum(items));

  onApplicationBootstrap() {
    this.setUpProfile();
    this.registerHandlers();
    this.bot.catch((err) => this.logger.error(err.error));
    void this.bot.start({ onStart: (me) => this.logger.log(`@${me.username} is polling`) });
  }

  onApplicationShutdown() {
    return this.bot.stop();
  }

  private setUpProfile() {
    void this.bot.api.setMyDescription(TEXTS.about);
    void this.bot.api.setMyCommands(MENU);
  }

  private registerHandlers() {
    this.bot.command(Command.Start, (ctx) => ctx.reply(TEXTS.about));
    this.bot.command(Command.Support, (ctx) => ctx.reply(TEXTS.support));
    this.bot.command(Command.ChatId, (ctx) => ctx.reply(String(ctx.chat.id)));

    const dm = this.bot.chatType('private');
    dm.command(Command.Suggest, (ctx) => this.onSuggest(ctx));
    dm.on('message:photo', (ctx) => this.onPicture(ctx));
    dm.on('message:document', (ctx) =>
      isImage(ctx.message.document) ? this.onPicture(ctx) : ctx.reply(TEXTS.notAnImage),
    );
  }

  private async onPicture(ctx: Context) {
    const groupId = ctx.message?.media_group_id;
    if (!groupId) {
      const placeholder = await ctx.reply(TEXTS.drawing);
      return this.answer([ctx], placeholder.message_id);
    }

    const placeholderId = this.albums.has(groupId) ? undefined : (await ctx.reply(TEXTS.drawing)).message_id;
    this.albums.add(groupId, { ctx, placeholderId });
  }

  // Runs from a timer, outside grammY's middleware, so bot.catch never sees its errors.
  private onAlbum(items: PendingPicture[]) {
    const placeholderId = items.find((item) => item.placeholderId)!.placeholderId!;
    const pictures = items.map((item) => item.ctx).sort((a, b) => a.message!.message_id - b.message!.message_id);
    this.answer(pictures, placeholderId).catch((err) => this.logger.error(err));
  }

  private async answer(pictures: Context[], placeholderId: number) {
    const chatId = pictures[0].chat!.id;
    const results = await Promise.all(
      pictures.map((ctx) =>
        this.render(ctx).catch((err) => {
          this.logger.warn(`picture failed: ${err}`);
          return null;
        }),
      ),
    );
    const rendered = results.filter((r) => r !== null);
    if (!rendered.length) return this.bot.api.editMessageText(chatId, placeholderId, TEXTS.cannotOpen);

    const sending = performance.now();
    const fileIds =
      rendered.length === 1
        ? await this.replacePlaceholder(chatId, placeholderId, rendered[0].image)
        : await this.sendAlbum(chatId, placeholderId, rendered.map((r) => r.image));
    this.lastPictures.set(chatId, fileIds);

    this.logger.log(`${rendered.map((r) => r.timings).join('; ')}; send ${elapsed(sending)}ms`);
  }

  private async replacePlaceholder(chatId: number, placeholderId: number, image: Buffer): Promise<string[]> {
    const edited = await this.bot.api.editMessageMedia(chatId, placeholderId, InputMediaBuilder.photo(new InputFile(image)));
    return edited !== true && edited.photo ? [largestPhoto(edited.photo).file_id] : [];
  }

  private async sendAlbum(chatId: number, placeholderId: number, images: Buffer[]): Promise<string[]> {
    const sent = await this.bot.api.sendMediaGroup(chatId, album(images.map((image) => new InputFile(image))));
    await this.bot.api.deleteMessage(chatId, placeholderId);
    return sent.flatMap((message) => ('photo' in message ? [largestPhoto(message.photo).file_id] : []));
  }

  private async render(ctx: Context): Promise<RenderedPicture> {
    const started = performance.now();
    const file = await ctx.getFile();
    const located = performance.now();
    const original = await downloadFile(config.botToken, file.file_path!);
    const downloaded = performance.now();
    const image = await addCaption(original);
    return {
      image,
      timings: `${original.length >> 10}KB: getFile ${Math.round(located - started)}ms, download ${Math.round(downloaded - located)}ms, caption ${elapsed(downloaded)}ms`,
    };
  }

  private async onSuggest(ctx: Context) {
    const chatId = ctx.chat!.id;
    const replied = ctx.message?.reply_to_message;
    const repliedId = replied && botPhotoId(replied, ctx.me.id);
    const fileIds = replied ? (repliedId ? [repliedId] : []) : (this.lastPictures.get(chatId) ?? []);
    if (!fileIds.length) return ctx.reply(replied ? TEXTS.replyToCaptioned : TEXTS.sendPictureFirst);
    if (!this.suggestions.tryTake(ctx.from!.id)) return ctx.reply(TEXTS.tooManySuggestions);

    await this.sendToTrainer(fileIds, ctx.from!);
    if (this.lastPictures.get(chatId) === fileIds) this.lastPictures.delete(chatId);
    await ctx.reply(TEXTS.sentToTrainer);
  }

  private async sendToTrainer(fileIds: string[], from: User) {
    const caption = mentionCaption(TEXTS.suggestedBy, from);
    if (fileIds.length === 1) await this.bot.api.sendPhoto(config.trainerChatId, fileIds[0], caption);
    else await this.bot.api.sendMediaGroup(config.trainerChatId, album(fileIds, caption));
  }
}
