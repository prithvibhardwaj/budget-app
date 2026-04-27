const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const client = createClient({ url: `file:${path.join(dataDir, 'budget.db')}` });

async function init() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      amount REAL NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      date TEXT NOT NULL,
      is_sws INTEGER DEFAULT 0,
      is_heavy INTEGER DEFAULT 0,
      whatsapp_note TEXT,
      raw_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS fixed_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS sws_account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      balance REAL NOT NULL DEFAULT 2451.03,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  const { rows: fixedRows } = await client.execute('SELECT COUNT(*) as cnt FROM fixed_expenses');
  if (Number(fixedRows[0].cnt) === 0) {
    for (const [name, amount] of [['Phone Plan', 19.90], ['Spotify', 6.00], ['Claude', 25.00], ['NUHS', 106.25]]) {
      await client.execute({ sql: 'INSERT INTO fixed_expenses (name, amount) VALUES (?, ?)', args: [name, amount] });
    }
  }

  const { rows: swsRows } = await client.execute('SELECT COUNT(*) as cnt FROM sws_account');
  if (Number(swsRows[0].cnt) === 0) {
    await client.execute({ sql: 'INSERT INTO sws_account (id, balance) VALUES (1, 2451.03)', args: [] });
  }
}

module.exports = { client, init };
