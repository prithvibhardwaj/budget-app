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

app.get('/api/whatsapp-qr', async (_req, res) => {
  const waState = require('./services/whatsapp-state');
  const qr = waState.getQR();
  if (!qr) {
    return res.send('<html><body style="font-family:sans-serif;text-align:center;padding:2rem"><h2>No QR code available</h2><p>Bot may already be connected, or not started yet. Refresh in a few seconds.</p></body></html>');
  }
  const QRCode = require('qrcode');
  const dataUrl = await QRCode.toDataURL(qr, { width: 300 });
  res.send(`<html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#111;color:#fff;font-family:sans-serif"><h2>Scan with WhatsApp</h2><img src="${dataUrl}" style="border-radius:12px"><p style="color:#aaa;margin-top:1rem">WhatsApp → Settings → Linked Devices → Link a Device</p><p style="color:#555;font-size:12px">QR expires in ~20s — refresh if it stops working</p></body></html>`);
});

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
