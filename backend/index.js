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
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

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
});
