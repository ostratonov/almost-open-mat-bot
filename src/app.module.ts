import { Module } from '@nestjs/common';
import { BotService } from './bot/bot.service.ts';
import { config } from './config.ts';
import { StatsStore } from './stats/stats.store.ts';

@Module({
  providers: [BotService, { provide: StatsStore, useFactory: () => new StatsStore(config.statsPath) }],
})
export class AppModule {}
