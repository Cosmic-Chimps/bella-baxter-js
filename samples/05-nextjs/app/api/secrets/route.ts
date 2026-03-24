import { NextResponse } from 'next/server';
import { getBella } from '@bella-baxter/config/next';

const mask = (v: string | undefined, n = 4) =>
  v && v.length > n ? `${v.slice(0, n)}***` : v ?? '(not set)';

export async function GET() {
  const bella = getBella();
  if (!bella) {
    return NextResponse.json({ error: 'Bella not initialized' }, { status: 503 });
  }

  return NextResponse.json({
    PORT:                        bella.get('PORT')                        ?? '(not set)',
    DATABASE_URL:                mask(bella.get('DATABASE_URL'),                15),
    EXTERNAL_API_KEY:            mask(bella.get('EXTERNAL_API_KEY')),
    GLEAP_API_KEY:               mask(bella.get('GLEAP_API_KEY')),
    ENABLE_FEATURES:             bella.get('ENABLE_FEATURES')             ?? '(not set)',
    APP_ID:                      bella.get('APP_ID')                      ?? '(not set)',
    ConnectionStrings__Postgres: mask(bella.get('ConnectionStrings__Postgres'), 6),
    APP_CONFIG:                  bella.get('APP_CONFIG')                  ?? '(not set)',
  });
}
