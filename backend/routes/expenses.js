const express = require('express');
const { client } = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    let result;
    if (month) {
      result = await client.execute({
        sql: "SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ? ORDER BY date ASC, created_at ASC",
        args: [month],
      });
    } else {
      result = await client.execute('SELECT * FROM expenses ORDER BY date DESC LIMIT 100');
    }
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk import — must come before /:id
router.post('/import', async (req, res) => {
  try {
    const { expenses, clearFirst = true } = req.body;
    if (!Array.isArray(expenses)) return res.status(400).json({ error: 'expenses must be an array' });

    if (clearFirst) await client.execute('DELETE FROM expenses');

    let inserted = 0;
    for (const e of expenses) {
      if (!e.amount || !e.category || !e.date) continue;
      await client.execute({
        sql: `INSERT INTO expenses (amount, category, description, date, is_sws, is_heavy, whatsapp_note, raw_message)
              VALUES (?, ?, ?, ?, 0, ?, ?, '')`,
        args: [e.amount, e.category, e.description || e.category, e.date, e.is_heavy ? 1 : 0, e.note || ''],
      });
      inserted++;
    }
    res.json({ inserted });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await client.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { amount, category, description, date, is_sws, is_heavy, whatsapp_note, raw_message } = req.body;
    if (!amount || !category || !description || !date) {
      return res.status(400).json({ error: 'amount, category, description, date required' });
    }

    const result = await client.execute({
      sql: `INSERT INTO expenses (amount, category, description, date, is_sws, is_heavy, whatsapp_note, raw_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [amount, category, description, date, is_sws ? 1 : 0, is_heavy ? 1 : 0, whatsapp_note || null, raw_message || null],
    });

    if (is_sws) {
      await client.execute({ sql: "UPDATE sws_account SET balance = balance - ?, updated_at = datetime('now') WHERE id = 1", args: [amount] });
    }

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', async (req, res) => {
  try {
    const { rows } = await client.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const orig = rows[0];

    const { amount, category, description, whatsapp_note, raw_message } = req.body;

    // Adjust SWS balance if amount changed on an SWS expense
    if (orig.is_sws && amount != null && Number(amount) !== Number(orig.amount)) {
      const delta = Number(orig.amount) - Number(amount);
      await client.execute({ sql: "UPDATE sws_account SET balance = balance + ?, updated_at = datetime('now') WHERE id = 1", args: [delta] });
    }

    await client.execute({
      sql: `UPDATE expenses SET
              amount = COALESCE(?, amount),
              category = COALESCE(?, category),
              description = COALESCE(?, description),
              whatsapp_note = COALESCE(?, whatsapp_note),
              raw_message = COALESCE(?, raw_message)
            WHERE id = ?`,
      args: [amount ?? null, category ?? null, description ?? null, whatsapp_note ?? null, raw_message ?? null, req.params.id],
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await client.execute({ sql: 'SELECT * FROM expenses WHERE id = ?', args: [req.params.id] });
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });

    if (rows[0].is_sws) {
      await client.execute({ sql: "UPDATE sws_account SET balance = balance + ?, updated_at = datetime('now') WHERE id = 1", args: [rows[0].amount] });
    }

    await client.execute({ sql: 'DELETE FROM expenses WHERE id = ?', args: [req.params.id] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
