import pino from 'pino';

// Structured logs in production; pretty-ish single-line logs elsewhere.
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: undefined, // drop pid/hostname noise
  timestamp: pino.stdTimeFunctions.isoTime,
});
