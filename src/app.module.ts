import { Module } from '@nestjs/common';
import { BotService } from './bot/bot.service.ts';

@Module({ providers: [BotService] })
export class AppModule {}
