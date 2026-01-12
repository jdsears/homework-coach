const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Initialize database schema
async function initializeDatabase() {
  const client = await pool.connect();

  try {
    // Create tables
    await client.query(`
      -- Families table (represents a parent account)
      CREATE TABLE IF NOT EXISTS families (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        family_name VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Children profiles within a family
      CREATE TABLE IF NOT EXISTS children (
        id SERIAL PRIMARY KEY,
        family_id INTEGER REFERENCES families(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        year_group INTEGER NOT NULL CHECK (year_group >= 7 AND year_group <= 11),
        avatar VARCHAR(50) DEFAULT 'default',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Chat sessions
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        year_group INTEGER NOT NULL,
        start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        messages JSONB DEFAULT '[]'::jsonb,
        struggles JSONB DEFAULT '[]'::jsonb
      );

      -- Quiz results
      CREATE TABLE IF NOT EXISTS quiz_results (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        subject VARCHAR(50) NOT NULL,
        topic VARCHAR(100) NOT NULL,
        year_group INTEGER NOT NULL,
        score INTEGER NOT NULL,
        total INTEGER NOT NULL,
        percentage INTEGER NOT NULL,
        questions JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Flashcard progress
      CREATE TABLE IF NOT EXISTS flashcard_progress (
        id SERIAL PRIMARY KEY,
        child_id INTEGER REFERENCES children(id) ON DELETE CASCADE,
        language VARCHAR(20) NOT NULL,
        category VARCHAR(50) NOT NULL,
        known_cards JSONB DEFAULT '[]'::jsonb,
        learning_cards JSONB DEFAULT '[]'::jsonb,
        last_practiced TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Create indexes for better query performance
      CREATE INDEX IF NOT EXISTS idx_children_family ON children(family_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_child ON sessions(child_id);
      CREATE INDEX IF NOT EXISTS idx_quiz_results_child ON quiz_results(child_id);
      CREATE INDEX IF NOT EXISTS idx_flashcard_progress_child ON flashcard_progress(child_id);
    `);

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Database query helper
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log('Executed query', { text: text.substring(0, 50), duration, rows: result.rowCount });
  }
  return result;
}

// Get a client for transactions
async function getClient() {
  return pool.connect();
}

module.exports = {
  query,
  getClient,
  initializeDatabase,
  pool,
};
