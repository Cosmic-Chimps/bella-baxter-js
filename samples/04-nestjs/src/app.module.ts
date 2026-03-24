import { Module } from '@nestjs/common';
import { BellaModule } from '@bella-baxter/config/nestjs';
import { AppController } from './app.controller.js';
import { BELLA_COERCIONS } from './bella-coercions.js';

@Module({
  imports: [
    BellaModule.register({
      baxterUrl: process.env.BELLA_BAXTER_URL ?? 'https://api.bella-baxter.io',
      apiKey: process.env.BELLA_BAXTER_API_KEY!,
      // Optional: poll for changes every 60 seconds
      pollingInterval: 60_000,
      // Coerce typed secrets: PORT → number, booleans → boolean (from bella-secrets.ts)
      coercions: BELLA_COERCIONS,
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
