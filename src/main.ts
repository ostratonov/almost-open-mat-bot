import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { BotService } from './bot.service.js';

@Module({ providers: [BotService] })
class AppModule {}

const app = await NestFactory.createApplicationContext(AppModule);
app.enableShutdownHooks();
