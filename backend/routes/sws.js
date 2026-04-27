const express = require('express');
const { client } = require('../db');
const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const { rows: [account] } = await client.execute('SELECT * FROM sws_account WHERE id = 1');
    const { rows: transactions } = await client.execute(
      'SELECT * FROM expenses WHERE is_sws = 1 ORDER BY date DESC, created_at DESC LIMIT 50'
    );
    res.json({ ...account, balance: Number(account.balance), transactions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/adjust', async (req, res) => {
  try {
    const { delta } = req.body;
    if (delta === undefined) return res.status(400).json({ error: 'delta required' });
    await client.execute({ sql: "UPDATE sws_account SET balance = balance + ?, updated_at = datetime('now') WHERE id = 1", args: [delta] });
    const { rows: [account] } = await client.execute('SELECT * FROM sws_account WHERE id = 1');
    res.json({ ...account, balance: Number(account.balance) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
