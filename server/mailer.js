const nodemailer = require('nodemailer');
const { familySummary, childProgress, buildDigestHtml } = require('./reporting');

const smtpConfigured = () => Boolean(process.env.SMTP_HOST);

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

function digestForFamily(db, family) {
  const summary = familySummary(db, family);
  const progressByChildId = {};
  for (const child of db.prepare('SELECT * FROM children WHERE family_id = ?').all(family.id)) {
    progressByChildId[child.id] = childProgress(db, child);
  }
  return buildDigestHtml(family, summary, progressByChildId);
}

async function sendWeeklyDigests(db) {
  if (!smtpConfigured()) return { sent: 0, reason: 'smtp-not-configured' };

  const transport = createTransport();
  const families = db.prepare("SELECT * FROM families WHERE digest_email != ''").all();

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
      console.warn(`Digest to ${family.name} failed:`, error.message);
    }
  }
  return { sent };
}

// The key for "have we sent this week's digest": the date of the most recent Sunday.
function currentDigestKey(date = new Date()) {
  const sunday = new Date(date.getTime() - date.getUTCDay() * 24 * 60 * 60 * 1000);
  return sunday.toISOString().slice(0, 10);
}

// Checks hourly; sends once per week on Sunday from 17:00 UTC.
function startWeeklyDigests(db) {
  if (!smtpConfigured()) {
    console.log('Weekly digests: SMTP not configured, emails disabled (preview still works).');
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
    if (getKv.get('digest_last_sent')?.value === key) return;
    const { sent } = await sendWeeklyDigests(db);
    setKv.run('digest_last_sent', key);
    console.log(`Weekly digests sent: ${sent}`);
  };

  check().catch(error => console.warn('Digest check failed:', error.message));
  const timer = setInterval(
    () => check().catch(error => console.warn('Digest check failed:', error.message)),
    60 * 60 * 1000
  );
  timer.unref?.();
  return timer;
}

module.exports = { smtpConfigured, digestForFamily, sendWeeklyDigests, startWeeklyDigests };
