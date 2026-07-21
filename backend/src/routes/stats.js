const express = require('express');
const { db } = require('../db');

const router = express.Router();

// All stats are computed in the user's home currency (amount_home) and only
// from the expenses table — SWS spends never appear here.

// GET /api/stats/overview?month=YYYY-MM
router.get('/overview', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
  const like = `${month}%`;

  const variable = db.prepare('SELECT COALESCE(SUM(amount_home),0) t FROM expenses WHERE user_id = ? AND date LIKE ?')
    .get(req.user.id, like).t;
  const fixed = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM fixed_expenses WHERE user_id = ? AND active = 1')
    .get(req.user.id).t;
  const byCategory = db.prepare(`SELECT category, SUM(amount_home) amount, COUNT(*) count FROM expenses
                                 WHERE user_id = ? AND date LIKE ? GROUP BY category ORDER BY amount DESC`)
    .all(req.user.id, like);
  const daily = db.prepare(`SELECT date, SUM(amount_home) amount FROM expenses
                            WHERE user_id = ? AND date LIKE ? GROUP BY date ORDER BY date`)
    .all(req.user.id, like);
  const heavyCount = db.prepare('SELECT COUNT(*) c FROM expenses WHERE user_id = ? AND date LIKE ? AND is_heavy = 1')
    .get(req.user.id, like).c;

  res.json({
    month,
    currency: req.user.home_currency,
    variable_total: Math.round(variable * 100) / 100,
    fixed_total: Math.round(fixed * 100) / 100,
    total: Math.round((variable + fixed) * 100) / 100,
    by_category: byCategory,
    daily,
    heavy_count: heavyCount,
  });
});

// GET /api/stats/series?granularity=day|week|month&count=N
// day: last N days, week: last N ISO-ish weeks, month: last N months.
router.get('/series', (req, res) => {
  const granularity = ['day', 'week', 'month'].includes(req.query.granularity) ? req.query.granularity : 'day';
  const count = Math.min(Math.max(parseInt(req.query.count, 10) || (granularity === 'day' ? 30 : 12), 1), 60);

  let rows;
  if (granularity === 'day') {
    rows = db.prepare(`SELECT date AS bucket, SUM(amount_home) amount FROM expenses
                       WHERE user_id = ? AND date >= date('now', ?)
                       GROUP BY date ORDER BY date`)
      .all(req.user.id, `-${count} days`);
  } else if (granularity === 'week') {
    rows = db.prepare(`SELECT strftime('%Y-W%W', date) AS bucket, MIN(date) AS start, SUM(amount_home) amount FROM expenses
                       WHERE user_id = ? AND date >= date('now', ?)
                       GROUP BY bucket ORDER BY bucket`)
      .all(req.user.id, `-${count * 7} days`);
  } else {
    rows = db.prepare(`SELECT substr(date, 1, 7) AS bucket, SUM(amount_home) amount FROM expenses
                       WHERE user_id = ? AND date >= date('now', 'start of month', ?)
                       GROUP BY bucket ORDER BY bucket`)
      .all(req.user.id, `-${count - 1} months`);
  }
  res.json({ granularity, currency: req.user.home_currency, series: rows });
});

module.exports = router;
