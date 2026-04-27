const express = require('express');
const { client } = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });

    const { rows: expenses } = await client.execute({
      sql: "SELECT * FROM expenses WHERE strftime('%Y-%m', date) = ?",
      args: [month],
    });

    const regular = expenses.filter(e => !e.is_sws);
    const heavy = regular.filter(e => e.is_heavy);
    const daily = regular.filter(e => !e.is_heavy);

    const byCategory = {};
    daily.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });

    const dailyTotal = daily.reduce((s, e) => s + Number(e.amount), 0);
    const heavyTotal = heavy.reduce((s, e) => s + Number(e.amount), 0);

    const { rows: fixed } = await client.execute('SELECT * FROM fixed_expenses WHERE is_active = 1');
    const fixedTotal = fixed.reduce((s, f) => s + Number(f.amount), 0);

    const byDate = {};
    daily.forEach(e => { byDate[e.date] = (byDate[e.date] || 0) + Number(e.amount); });

    res.json({
      month,
      dailyTotal: +dailyTotal.toFixed(2),
      heavyTotal: +heavyTotal.toFixed(2),
      fixedTotal: +fixedTotal.toFixed(2),
      grandTotal: +(dailyTotal + heavyTotal + fixedTotal).toFixed(2),
      byCategory,
      byDate,
      heavyExpenses: heavy,
      fixed,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/yearly', async (_req, res) => {
  try {
    const { rows } = await client.execute(`
      SELECT
        strftime('%Y-%m', date) as month,
        SUM(CASE WHEN is_sws = 0 THEN amount ELSE 0 END) as total,
        SUM(CASE WHEN is_sws = 0 AND is_heavy = 0 THEN amount ELSE 0 END) as daily_total,
        SUM(CASE WHEN is_sws = 0 AND is_heavy = 1 THEN amount ELSE 0 END) as heavy_total,
        COUNT(CASE WHEN is_sws = 0 THEN 1 END) as count
      FROM expenses
      GROUP BY month
      ORDER BY month ASC
    `);

    const { rows: fixed } = await client.execute('SELECT * FROM fixed_expenses WHERE is_active = 1');
    const fixedTotal = fixed.reduce((s, f) => s + Number(f.amount), 0);

    res.json(rows.map(r => ({
      month: r.month,
      total: Number(r.total),
      daily_total: Number(r.daily_total),
      heavy_total: Number(r.heavy_total),
      count: Number(r.count),
      fixedTotal,
      grandTotal: +(Number(r.total) + fixedTotal).toFixed(2),
    })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
