/// <reference path="./bella-secrets.d.ts" />
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3005);
  console.log(`NestJS app listening on :${process.env.PORT ?? 3005}`);
}

bootstrap();
