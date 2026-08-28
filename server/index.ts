import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import * as Sentry from '@sentry/node';
import type Database from 'better-sqlite3';
import { createDb } from './db';
import { createAnthropic, CHAT_MODEL } from './claude';
import { createApp } from './app';
import { startWeeklyDigests } from './mailer';
import { logger } from './logger';

if (!process.env.ANTHROPIC_API_KEY) {
  logger.fatal(
    'Missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key from https://console.anthropic.com'
  );
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.COOKIE_SECRET) {
  logger.fatal(
    'Missing COOKIE_SECRET. Set a long random string in production - it signs family sign-in cookies.'
  );
  process.exit(1);
}
if (!isProd && !process.env.COOKIE_SECRET) {
  logger.warn('COOKIE_SECRET not set - using an insecure development default');
}

// Optional error tracking: set SENTRY_DSN to enable
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
  logger.info('sentry error tracking enabled');
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// On platforms where the data volume moves between deployments (e.g. Railway),
// the new container can start a beat before the volume is attached. Retrying
// the open rides out that hand-off instead of crash-looping.
async function openDbWithRetry(dbPath: string, attempts = 10, delayMs = 3000) {
  for (let attempt = 1; ; attempt++) {
    try {
      return createDb(dbPath);
    } catch (error) {
      if (attempt >= attempts) throw error;
      logger.warn(
        { attempt, attempts, err: (error as Error).message },
        'database not ready yet - retrying'
      );
      await sleep(delayMs);
    }
  }
}

async function main() {
  const dbPath =
    process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'homework-coach.db');
  const db: Database.Database = await openDbWithRetry(dbPath);
  const app = createApp({ db, anthropic: createAnthropic() });

  if (process.env.SENTRY_DSN) {
    Sentry.setupExpressErrorHandler(app);
  }

  startWeeklyDigests(db);

  const PORT = process.env.PORT || 3001;
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, model: CHAT_MODEL, db: dbPath }, '🎓 Homework Coach server running');
  });

  // Exit cleanly on platform stop signals so redeploys don't read as crashes
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      logger.info({ signal }, 'shutting down');
      server.close(() => {
        db.close();
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 5000).unref();
    });
  }
}

main().catch(error => {
  logger.fatal({ err: (error as Error).message }, 'failed to start');
  process.exit(1);
});
