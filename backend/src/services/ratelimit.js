const { db } = require('../db');

const HOURLY_LIMIT = Number(process.env.LLM_HOURLY_LIMIT || 5);

// Users listed here bypass the limit entirely. Set on the host, e.g.
// RATE_LIMIT_EXEMPT_USER_IDS=1  (your account id is shown in app Settings).
const EXEMPT = new Set(
  String(process.env.RATE_LIMIT_EXEMPT_USER_IDS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function isExempt(userId) {
  return EXEMPT.has(String(userId));
}

function usageInLastHour(userId) {
  return db.prepare(
    "SELECT COUNT(*) c FROM llm_usage WHERE user_id = ? AND created_at > datetime('now', '-1 hour')"
  ).get(userId).c;
}

// Reserves a slot. Records usage up front so bursts can't slip through while
// an LLM call is still in flight.
function tryConsume(userId) {
  if (isExempt(userId)) return { allowed: true, exempt: true };

  const used = usageInLastHour(userId);
  if (used >= HOURLY_LIMIT) {
    return { allowed: false, used, limit: HOURLY_LIMIT };
  }
  db.prepare('INSERT INTO llm_usage (user_id) VALUES (?)').run(userId);
  return { allowed: true, used: used + 1, limit: HOURLY_LIMIT };
}

// Old rows are only needed for the trailing hour.
function prune() {
  db.prepare("DELETE FROM llm_usage WHERE created_at < datetime('now', '-2 hours')").run();
}

module.exports = { tryConsume, isExempt, usageInLastHour, prune, HOURLY_LIMIT };
