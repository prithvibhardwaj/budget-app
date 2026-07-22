require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required. Set it in .env (see .env.example).');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
require('./src/db'); // creates tables

const { requireAuth } = require('./src/middleware/auth');

const app = express();
app.set('trust proxy', 1); // Railway terminates TLS upstream; needed for real client IPs
app.use(cors());
app.use(express.json());

const startedAt = new Date().toISOString();

// commit is populated by Railway (RAILWAY_GIT_COMMIT_SHA) so you can always
// tell which code is actually deployed.
app.get('/health', (req, res) => res.json({
  ok: true,
  commit: (process.env.RAILWAY_GIT_COMMIT_SHA || 'unknown').slice(0, 7),
  started_at: startedAt,
}));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/me', requireAuth, require('./src/routes/me'));
app.use('/api/expenses', requireAuth, require('./src/routes/expenses'));
app.use('/api/stats', requireAuth, require('./src/routes/stats'));
app.use('/api/sws', requireAuth, require('./src/routes/sws'));
app.use('/api/fixed', requireAuth, require('./src/routes/fixed'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Budget API listening on :${port}`);
  if (process.env.WHATSAPP_ENABLED !== 'false') {
    require('./src/services/whatsapp').resumeAll();
  } else {
    console.log('WhatsApp bot disabled (WHATSAPP_ENABLED=false)');
  }

  const rateLimit = require('./src/services/ratelimit');
  console.log(`LLM rate limit: ${rateLimit.HOURLY_LIMIT}/hour per user`);
  rateLimit.prune();
  setInterval(() => rateLimit.prune(), 60 * 60 * 1000).unref();
});
