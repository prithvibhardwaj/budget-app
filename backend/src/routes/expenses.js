const express = require('express');
const { db } = require('../db');
const { encrypt, decrypt } = require('../crypto');
const { convert } = require('../services/currency');
const { CATEGORIES } = require('../services/classify');

const router = express.Router();

function toJson(row, dataKey) {
  let description = '';
  try { description = decrypt(row.description_enc, dataKey); } catch {}
  return {
    id: row.id,
    amount: row.amount,
    currency: row.currency,
    amount_home: row.amount_home,
    category: row.category,
    description,
    date: row.date,
    is_heavy: !!row.is_heavy,
    source: row.source,
  };
}

// GET /api/expenses?month=YYYY-MM  (or ?from=&to=)
router.get('/', (req, res) => {
  const { month, from, to } = req.query;
  let rows;
  if (month) {
    rows = db.prepare('SELECT * FROM expenses WHERE user_id = ? AND date LIKE ? ORDER BY date DESC, id DESC')
      .all(req.user.id, `${month}%`);
  } else if (from && to) {
    rows = db.prepare('SELECT * FROM expenses WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, id DESC')
      .all(req.user.id, from, to);
  } else {
    rows = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200')
      .all(req.user.id);
  }
  res.json(rows.map((r) => toJson(r, req.dataKey)));
});

router.post('/', async (req, res) => {
  const { amount, category, description, date, currency, is_heavy } = req.body || {};
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });

  const cur = currency || req.user.home_currency;
  const amountHome = await convert(amt, cur, req.user.home_currency);
  const info = db.prepare(`INSERT INTO expenses (user_id, amount, currency, amount_home, category, description_enc, date, is_heavy, source)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual')`)
    .run(req.user.id, amt, cur, amountHome, category, encrypt(description || category, req.dataKey), date, is_heavy ? 1 : 0);
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(info.lastInsertRowid);
  res.json(toJson(row, req.dataKey));
});

router.put('/:id', async (req, res) => {
  const row = db.prepare('SELECT * FROM expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Expense not found' });

  const amount = req.body.amount != null ? Number(req.body.amount) : row.amount;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  const category = req.body.category || row.category;
  if (!CATEGORIES.includes(category)) return res.status(400).json({ error: 'Invalid category' });
  const currency = req.body.currency || row.currency;
  const date = req.body.date || row.date;
  const descriptionEnc = req.body.description != null ? encrypt(req.body.description, req.dataKey) : row.description_enc;
  const isHeavy = req.body.is_heavy != null ? (req.body.is_heavy ? 1 : 0) : row.is_heavy;
  const amountHome = await convert(amount, currency, req.user.home_currency);

  db.prepare(`UPDATE expenses SET amount=?, currency=?, amount_home=?, category=?, description_enc=?, date=?, is_heavy=? WHERE id=?`)
    .run(amount, currency, amountHome, category, descriptionEnc, date, isHeavy, row.id);
  res.json(toJson(db.prepare('SELECT * FROM expenses WHERE id = ?').get(row.id), req.dataKey));
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Expense not found' });
  res.json({ ok: true });
});

// POST /api/expenses/bulk-delete { ids: [...] }
router.post('/bulk-delete', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];
  if (!ids.length) return res.status(400).json({ error: 'ids array required' });
  const stmt = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?');
  const run = db.transaction(() => {
    let n = 0;
    for (const id of ids) n += stmt.run(id, req.user.id).changes;
    return n;
  });
  res.json({ deleted: run() });
});

module.exports = router;
