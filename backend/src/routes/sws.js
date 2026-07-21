const express = require('express');
const { db } = require('../db');
const { encrypt, decrypt } = require('../crypto');

const router = express.Router();

router.get('/', (req, res) => {
  const account = db.prepare('SELECT balance FROM sws_accounts WHERE user_id = ?').get(req.user.id) || { balance: 0 };
  const txns = db.prepare('SELECT * FROM sws_transactions WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 100')
    .all(req.user.id)
    .map((t) => {
      let description = '';
      try { description = t.description_enc ? decrypt(t.description_enc, req.dataKey) : ''; } catch {}
      return { id: t.id, type: t.type, amount: t.amount, currency: t.currency, amount_home: t.amount_home, description, date: t.date };
    });
  res.json({ balance: Math.round(account.balance * 100) / 100, currency: req.user.home_currency, transactions: txns });
});

// Set the balance directly (e.g. initial setup or correction).
router.put('/balance', (req, res) => {
  const balance = Number(req.body?.balance);
  if (!Number.isFinite(balance)) return res.status(400).json({ error: 'balance must be a number' });
  db.prepare('INSERT INTO sws_accounts (user_id, balance) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET balance = ?')
    .run(req.user.id, balance, balance);
  res.json({ balance });
});

// Manual SWS transaction from the app.
router.post('/txn', (req, res) => {
  const { type, amount, description, date } = req.body || {};
  const amt = Number(amount);
  if (!['spend', 'refund'].includes(type)) return res.status(400).json({ error: 'type must be spend or refund' });
  if (!amt || amt <= 0) return res.status(400).json({ error: 'amount must be a positive number' });
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : new Date().toISOString().slice(0, 10);
  const cur = req.user.home_currency;

  db.prepare(`INSERT INTO sws_transactions (user_id, type, amount, currency, amount_home, description_enc, date)
              VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(req.user.id, type, amt, cur, amt, encrypt(description || type, req.dataKey), d);
  const sign = type === 'spend' ? -1 : 1;
  db.prepare('UPDATE sws_accounts SET balance = balance + ? WHERE user_id = ?').run(sign * amt, req.user.id);
  res.json({ ok: true });
});

router.delete('/txn/:id', (req, res) => {
  const txn = db.prepare('SELECT * FROM sws_transactions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  const sign = txn.type === 'spend' ? 1 : -1;
  db.prepare('UPDATE sws_accounts SET balance = balance + ? WHERE user_id = ?').run(sign * txn.amount_home, req.user.id);
  db.prepare('DELETE FROM sws_transactions WHERE id = ?').run(txn.id);
  res.json({ ok: true });
});

module.exports = router;
