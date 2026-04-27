const express = require('express');
const { client } = require('../db');
const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await client.execute('SELECT * FROM fixed_expenses ORDER BY id');
    res.json(rows.map(r => ({ ...r, amount: Number(r.amount) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, amount } = req.body;
    if (!name || !amount) return res.status(400).json({ error: 'name and amount required' });
    const result = await client.execute({ sql: 'INSERT INTO fixed_expenses (name, amount) VALUES (?, ?)', args: [name, amount] });
    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { rows } = await client.execute({ sql: 'SELECT * FROM fixed_expenses WHERE id = ?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const { name, amount, is_active } = req.body;
    await client.execute({
      sql: 'UPDATE fixed_expenses SET name = ?, amount = ?, is_active = ? WHERE id = ?',
      args: [name ?? rows[0].name, amount ?? rows[0].amount, is_active ?? rows[0].is_active, req.params.id],
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await client.execute({ sql: 'DELETE FROM fixed_expenses WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
