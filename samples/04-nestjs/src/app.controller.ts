import { Controller, Get } from '@nestjs/common';
import { BellaConfigService } from '@bella-baxter/config/nestjs';

const mask = (v: string | undefined, n = 4) => (v && v.length > n ? `${v.slice(0, n)}***` : v ?? '(not set)');

@Controller()
export class AppController {
  constructor(private readonly bella: BellaConfigService) {}

  @Get()
  getSecrets() {
    return {
      PORT:                        String(this.bella.PORT                        ?? '(not set)'),
      DATABASE_URL:                mask(this.bella.DATABASE_URL,                15),
      EXTERNAL_API_KEY:            mask(this.bella.EXTERNAL_API_KEY),
      GLEAP_API_KEY:               mask(this.bella.GLEAP_API_KEY),
      ENABLE_FEATURES:             String(this.bella.ENABLE_FEATURES             ?? '(not set)'),
      APP_ID:                      this.bella.APP_ID                             ?? '(not set)',
      ConnectionStrings__Postgres: mask(this.bella.get('ConnectionStrings__Postgres'), 6),
      APP_CONFIG:                  this.bella.APP_CONFIG                         ?? '(not set)',
    };
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}

