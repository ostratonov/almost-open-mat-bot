import 'reflect-metadata';
import { ConsoleLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.ts';

const app = await NestFactory.createApplicationContext(AppModule, { logger: new ConsoleLogger({ json: true }) });

app.enableShutdownHooks();
