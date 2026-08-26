require('dotenv').config();
const path = require('path');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    'Missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key from https://console.anthropic.com'
  );
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';
if (isProd && !process.env.COOKIE_SECRET) {
  console.error(
    'Missing COOKIE_SECRET. Set a long random string in production - it signs family sign-in cookies.'
  );
  process.exit(1);
}
if (!isProd && !process.env.COOKIE_SECRET) {
  console.warn('COOKIE_SECRET not set - using an insecure development default.');
}

const { createDb } = require('./db');
const { createAnthropic, CHAT_MODEL } = require('./claude');
const { createApp } = require('./app');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'homework-coach.db');
const db = createDb(dbPath);
const app = createApp({ db, anthropic: createAnthropic() });

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(
    `🎓 Homework Coach server running on port ${PORT} (model: ${CHAT_MODEL}, db: ${dbPath})`
  );
});
