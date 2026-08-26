const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS families (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  pin_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS children (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES families(id),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  child_id TEXT NOT NULL REFERENCES children(id),
  subject TEXT NOT NULL,
  started_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS struggles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  subject TEXT NOT NULL,
  type TEXT NOT NULL,
  context TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT NOT NULL REFERENCES children(id),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  correct INTEGER,
  problem TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  family_id TEXT NOT NULL REFERENCES families(id),
  kind TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practice_problems (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id TEXT NOT NULL REFERENCES children(id),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty INTEGER NOT NULL DEFAULT 1,
  problem TEXT NOT NULL,
  hint TEXT NOT NULL DEFAULT '',
  answer TEXT NOT NULL DEFAULT '',
  explanation TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mastery (
  child_id TEXT NOT NULL REFERENCES children(id),
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 0.5,
  attempts INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (child_id, subject, topic)
);

CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions(child_id);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_struggles_session ON struggles(session_id);
CREATE INDEX IF NOT EXISTS idx_usage_family_time ON usage_log(family_id, created_at);
CREATE INDEX IF NOT EXISTS idx_practice_problems_child ON practice_problems(child_id);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_child ON practice_attempts(child_id);
`;

// Additive migrations for columns that arrived after a table already shipped.
function ensureColumn(db, table, column, ddl) {
  const columns = db.pragma(`table_info(${table})`).map(col => col.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  }
}

function createDb(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);

  ensureColumn(db, 'children', 'memory', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'messages', 'has_image', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'practice_attempts', 'problem_id', 'INTEGER');

  return db;
}

module.exports = { createDb };
