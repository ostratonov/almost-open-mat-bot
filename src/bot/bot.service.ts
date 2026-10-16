import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot, Context, InputFile } from 'grammy';
import { config } from '../config.ts';
import { addCaption } from '../image/caption.ts';
import { Command, MENU, TEXTS } from '../texts.ts';
import { RateLimiter } from './rate-limiter.ts';
import { botPhotoId, downloadFile, isImage, largestPhoto, mentionCaption } from './telegram.utils.ts';

const SUGGESTIONS_PER_MINUTE = 3;

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  private readonly bot = new Bot(config.botToken);
  private readonly lastPicture = new Map<number, string>();
  private readonly suggestions = new RateLimiter(SUGGESTIONS_PER_MINUTE, 60_000);

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
    const file = await ctx.getFile();
    const original = await downloadFile(config.botToken, file.file_path!);

    const image = await addCaption(original).catch((err) => {
      this.logger.warn(`caption failed: ${err}`);
      return null;
    });
    
    if (!image) return ctx.reply(TEXTS.cannotOpen);

    const sent = await ctx.replyWithPhoto(new InputFile(image));
    this.lastPicture.set(ctx.chat!.id, largestPhoto(sent.photo).file_id);
  }

  private async onSuggest(ctx: Context) {
    const chatId = ctx.chat!.id;
    const replied = ctx.message?.reply_to_message;
    const fileId = replied ? botPhotoId(replied, ctx.me.id) : this.lastPicture.get(chatId);
    if (!fileId) return ctx.reply(replied ? TEXTS.replyToCaptioned : TEXTS.sendPictureFirst);
    if (!this.suggestions.tryTake(ctx.from!.id)) return ctx.reply(TEXTS.tooManySuggestions);

    await ctx.api.sendPhoto(config.trainerChatId, fileId, mentionCaption(TEXTS.suggestedBy, ctx.from!));
    if (this.lastPicture.get(chatId) === fileId) this.lastPicture.delete(chatId);
    await ctx.reply(TEXTS.sentToTrainer);
  }
}
