const express = require('express');
const { db } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT id, name, amount, active FROM fixed_expenses WHERE user_id = ? ORDER BY amount DESC')
    .all(req.user.id));
});

router.post('/', (req, res) => {
  const { name, amount } = req.body || {};
  const amt = Number(amount);
  if (!name || !amt || amt <= 0) return res.status(400).json({ error: 'name and positive amount required' });
  const info = db.prepare('INSERT INTO fixed_expenses (user_id, name, amount) VALUES (?, ?, ?)')
    .run(req.user.id, String(name).trim(), amt);
  res.json({ id: info.lastInsertRowid, name, amount: amt, active: 1 });
});

router.put('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM fixed_expenses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const name = req.body.name != null ? String(req.body.name).trim() : row.name;
  const amount = req.body.amount != null ? Number(req.body.amount) : row.amount;
  const active = req.body.active != null ? (req.body.active ? 1 : 0) : row.active;
  if (!name || !amount || amount <= 0) return res.status(400).json({ error: 'name and positive amount required' });
  db.prepare('UPDATE fixed_expenses SET name = ?, amount = ?, active = ? WHERE id = ?').run(name, amount, active, row.id);
  res.json({ id: row.id, name, amount, active });
});

router.delete('/:id', (req, res) => {
  const info = db.prepare('DELETE FROM fixed_expenses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = router;
