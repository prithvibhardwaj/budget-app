const express = require('express');
const QRCode = require('qrcode');
const { db } = require('../db');
const { currencyForCountry, KNOWN_CURRENCIES } = require('../services/currency');
const whatsapp = require('../services/whatsapp');

const router = express.Router();
const waEnabled = process.env.WHATSAPP_ENABLED !== 'false';

router.get('/', (req, res) => {
  const u = req.user;
  res.json({
    id: u.id,
    email: u.email,
    name: u.name,
    home_currency: u.home_currency,
    current_country: u.current_country,
    current_currency: u.current_currency,
    timezone: u.timezone,
    wa_linked: !!u.wa_linked,
  });
});

// The app calls this on launch/foreground with the device's coordinates (or a
// country code directly) + timezone. This is how "75" typed in Malaysia
// becomes 75 MYR automatically.
router.put('/location', async (req, res) => {
  const { lat, lon, timezone } = req.body || {};
  let country = req.body?.country || null;

  if (!country && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
    try {
      const r = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${Number(lat)}&longitude=${Number(lon)}&localityLanguage=en`
      );
      const j = await r.json();
      if (j.countryCode) country = j.countryCode;
    } catch (err) {
      console.error('Reverse geocode failed:', err.message);
    }
  }

  const currency = currencyForCountry(country);
  if (country && currency) {
    db.prepare('UPDATE users SET current_country = ?, current_currency = ? WHERE id = ?')
      .run(String(country).toUpperCase(), currency, req.user.id);
  }
  if (timezone && typeof timezone === 'string' && timezone.length < 64) {
    try {
      new Date().toLocaleDateString('en-CA', { timeZone: timezone });
      db.prepare('UPDATE users SET timezone = ? WHERE id = ?').run(timezone, req.user.id);
    } catch { /* invalid timezone — keep existing */ }
  }
  res.json({ current_country: country || req.user.current_country, current_currency: currency || req.user.current_currency });
});

router.put('/settings', (req, res) => {
  const { home_currency, name } = req.body || {};
  if (home_currency) {
    const cur = String(home_currency).toUpperCase();
    if (!KNOWN_CURRENCIES.has(cur)) return res.status(400).json({ error: 'Unknown currency code' });
    db.prepare('UPDATE users SET home_currency = ? WHERE id = ?').run(cur, req.user.id);
  }
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(String(name).trim(), req.user.id);
  res.json({ ok: true });
});

// Delete the account and everything attached to it. Expenses, SWS history and
// fixed expenses cascade via foreign keys; the WhatsApp session and dedupe
// records are cleaned up explicitly.
router.delete('/', (req, res) => {
  const userId = req.user.id;
  try { whatsapp.stopSession(userId); } catch { /* no session to stop */ }
  db.prepare('DELETE FROM processed_messages WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  res.json({ ok: true });
});

// --- WhatsApp linking ---

router.post('/whatsapp/link', async (req, res) => {
  if (!waEnabled) return res.status(503).json({ error: 'WhatsApp is disabled on this server' });
  const phone = req.body?.phone ? String(req.body.phone) : null;
  try {
    await whatsapp.startSession(req.user.id, phone);
    res.json({ ok: true });
  } catch (err) {
    console.error('WA link error:', err);
    res.status(500).json({ error: 'Failed to start WhatsApp session' });
  }
});

router.get('/whatsapp/status', async (req, res) => {
  const s = whatsapp.getStatus(req.user.id);
  let qrDataUrl = null;
  if (s.qr) {
    try { qrDataUrl = await QRCode.toDataURL(s.qr, { width: 300 }); } catch {}
  }
  res.json({ status: s.status, qr: qrDataUrl, pairing_code: s.pairingCode, error: s.error || null });
});

router.post('/whatsapp/unlink', (req, res) => {
  whatsapp.stopSession(req.user.id);
  res.json({ ok: true });
});

module.exports = router;
