import nodemailer from 'nodemailer';
import type Database from 'better-sqlite3';
import { familySummary, childProgress, buildDigestHtml, type ChildProgress } from './reporting';
import { logger } from './logger';
import type { ChildRow, FamilyRow } from './types';

export const smtpConfigured = (): boolean => Boolean(process.env.SMTP_HOST);

function createTransport() {
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });
}

export function digestForFamily(db: Database.Database, family: FamilyRow): string {
  const summary = familySummary(db, family);
  const progressByChildId: Record<string, ChildProgress> = {};
  const children = db
    .prepare('SELECT * FROM children WHERE family_id = ?')
    .all(family.id) as ChildRow[];
  for (const child of children) {
    progressByChildId[child.id] = childProgress(db, child);
  }
  return buildDigestHtml(family, summary, progressByChildId);
}

export async function sendWeeklyDigests(db: Database.Database): Promise<{ sent: number }> {
  if (!smtpConfigured()) return { sent: 0 };

  const transport = createTransport();
  const families = db
    .prepare("SELECT * FROM families WHERE digest_email != ''")
    .all() as FamilyRow[];

  let sent = 0;
  for (const family of families) {
    try {
      await transport.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: family.digest_email,
        subject: `📚 ${family.name} - your Homework Coach week`,
        html: digestForFamily(db, family),
      });
      sent++;
    } catch (error) {
      logger.warn({ family: family.name, err: (error as Error).message }, 'digest send failed');
    }
  }
  return { sent };
}

// The key for "have we sent this week's digest": the date of the most recent Sunday.
export function currentDigestKey(date = new Date()): string {
  const sunday = new Date(date.getTime() - date.getUTCDay() * 24 * 60 * 60 * 1000);
  return sunday.toISOString().slice(0, 10);
}

// Checks hourly; sends once per week on Sunday from 17:00 UTC.
export function startWeeklyDigests(db: Database.Database): NodeJS.Timeout | null {
  if (!smtpConfigured()) {
    logger.info('weekly digests: SMTP not configured, emails disabled (preview still works)');
    return null;
  }
  const getKv = db.prepare('SELECT value FROM kv WHERE key = ?');
  const setKv = db.prepare(
    'INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  const check = async () => {
    const nowDate = new Date();
    if (nowDate.getUTCDay() !== 0 || nowDate.getUTCHours() < 17) return;
    const key = currentDigestKey(nowDate);
    const last = getKv.get('digest_last_sent') as { value: string } | undefined;
    if (last?.value === key) return;
    const { sent } = await sendWeeklyDigests(db);
    setKv.run('digest_last_sent', key);
    logger.info({ sent }, 'weekly digests sent');
  };

  check().catch(error => logger.warn({ err: (error as Error).message }, 'digest check failed'));
  const timer = setInterval(
    () =>
      check().catch(error => logger.warn({ err: (error as Error).message }, 'digest check failed')),
    60 * 60 * 1000
  );
  timer.unref?.();
  return timer;
}
