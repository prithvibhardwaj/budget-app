require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { init } = require('./db');

const expensesRouter = require('./routes/expenses');
const statsRouter = require('./routes/stats');
const swsRouter = require('./routes/sws');
const fixedRouter = require('./routes/fixed');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/expenses', expensesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/sws', swsRouter);
app.use('/api/fixed-expenses', fixedRouter);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3001;

init().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
    if (process.env.WHATSAPP_ENABLED !== 'false') {
      require('./services/whatsapp');
    }
  });
}).catch(err => {
  console.error('DB init failed:', err);
  process.exit(1);
});
