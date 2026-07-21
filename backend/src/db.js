const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'budget.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  home_currency TEXT NOT NULL DEFAULT 'SGD',
  current_country TEXT,
  current_currency TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Singapore',
  data_key_wrapped TEXT NOT NULL,
  wa_linked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  amount_home REAL NOT NULL,
  category TEXT NOT NULL,
  description_enc TEXT NOT NULL,
  date TEXT NOT NULL,
  is_heavy INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'manual',
  wa_msg_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_wa ON expenses(user_id, wa_msg_id);

CREATE TABLE IF NOT EXISTS sws_accounts (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sws_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('spend','refund')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL,
  amount_home REAL NOT NULL,
  description_enc TEXT,
  date TEXT NOT NULL,
  wa_msg_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sws_user_date ON sws_transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sws_wa ON sws_transactions(user_id, wa_msg_id);

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS processed_messages (
  user_id INTEGER NOT NULL,
  msg_id TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, msg_id)
);
`);

module.exports = { db, dataDir };
