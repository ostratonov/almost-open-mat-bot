import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Bot, Context, InputFile } from 'grammy';
import { addCaption } from './caption.js';

const { BOT_TOKEN, GROUP_CHAT_ID } = process.env;
if (!BOT_TOKEN || !GROUP_CHAT_ID) throw new Error('BOT_TOKEN and GROUP_CHAT_ID must be set');

@Injectable()
export class BotService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BotService.name);
  private readonly bot = new Bot(BOT_TOKEN!);

  onApplicationBootstrap() {
    this.bot.command('start', (ctx) => ctx.reply('Кидай картинку — додам «almost open mat» і відправлю в групу.'));
    this.bot.command('chatid', (ctx) => ctx.reply(String(ctx.chat.id)));

    // Private chats only: if the bot is an admin in the group it sees every photo there and would repost them forever.
    const dm = this.bot.chatType('private');
    dm.on('message:photo', (ctx) => this.suggest(ctx));
    dm.on('message:document', (ctx) =>
      ctx.message.document.mime_type?.startsWith('image/') ? this.suggest(ctx) : ctx.reply('Це не картинка.'),
    );

    this.bot.catch((err) => this.logger.error(err.error));
    void this.bot.start({ onStart: (me) => this.logger.log(`@${me.username} is polling`) });
  }

  onApplicationShutdown() {
    return this.bot.stop();
  }

  private async suggest(ctx: Context) {
    const file = await ctx.getFile();
    const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
    if (!res.ok) throw new Error(`file download failed: ${res.status}`);

    const image = await addCaption(Buffer.from(await res.arrayBuffer())).catch((err) => {
      this.logger.warn(`caption failed: ${err}`);
      return null;
    });
    if (!image) return ctx.reply('Не зміг відкрити цю картинку.');

    await ctx.api.sendPhoto(GROUP_CHAT_ID!, new InputFile(image));
    await ctx.reply('Відправлено ✅');
  }
}
