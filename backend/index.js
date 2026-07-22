require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is required. Set it in .env (see .env.example).');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// Unknown API paths return JSON, not Express's default HTML error page.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

// The exported web app, served from the same origin as the API (so the browser
// build needs no CORS handling and no separate host). Mounted AFTER the API
// routes so it can never shadow them.
const webDir = path.join(__dirname, 'public');
if (fs.existsSync(path.join(webDir, 'index.html'))) {
  app.use(express.static(webDir, { maxAge: '1h', index: false }));
  // Client-side routing: any non-API GET falls back to the app shell.
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(webDir, 'index.html'));
  });
  console.log('Serving web app from', webDir);
}

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
