import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import * as Sentry from '@sentry/node';
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

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'homework-coach.db');
const db = createDb(dbPath);
const app = createApp({ db, anthropic: createAnthropic() });

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

startWeeklyDigests(db);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info({ port: PORT, model: CHAT_MODEL, db: dbPath }, '🎓 Homework Coach server running');
});
