const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { newWrappedDataKey } = require('../crypto');
const { generateRecoveryCode, hashRecoveryCode, normalizeRecoveryCode } = require('../services/recovery');

const router = express.Router();

function issueToken(userId) {
  return jwt.sign({ uid: userId }, process.env.JWT_SECRET, { expiresIn: '365d' });
}

// Device identity: the app calls this once on first launch and stores the token
// in the device keychain. No email, no password, no signup screen. The returned
// recovery code is the ONLY way to reach this account from another device, so
// the app shows it and tells the user to save it.
router.post('/device', (req, res) => {
  const code = generateRecoveryCode();
  // Email/password columns are NOT NULL from the original schema; device
  // accounts get internal placeholders the user never sees or uses.
  const placeholderEmail = `device-${crypto.randomUUID()}@device.local`;
  const placeholderPassword = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);

  const info = db.prepare(
    'INSERT INTO users (email, password_hash, name, data_key_wrapped, device_key_hash) VALUES (?, ?, ?, ?, ?)'
  ).run(placeholderEmail, placeholderPassword, String(req.body?.name || 'Me').trim().slice(0, 60),
    newWrappedDataKey(), hashRecoveryCode(code));

  db.prepare('INSERT INTO sws_accounts (user_id, balance) VALUES (?, 0)').run(info.lastInsertRowid);

  res.json({ token: issueToken(info.lastInsertRowid), recovery_code: code });
});

// Restore an account on a new device using its recovery code.
router.post('/restore', (req, res) => {
  const normalized = normalizeRecoveryCode(req.body?.recovery_code);
  if (normalized.length !== 32) return res.status(400).json({ error: 'That does not look like a recovery code' });

  const user = db.prepare('SELECT id FROM users WHERE device_key_hash = ?').get(hashRecoveryCode(normalized));
  if (!user) return res.status(404).json({ error: 'No account found for that recovery code' });

  res.json({ token: issueToken(user.id) });
});

router.post('/register', (req, res) => {
  const { email, password, name } = req.body || {};
  if (!email || !password || !name) return res.status(400).json({ error: 'email, password and name are required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const hash = bcrypt.hashSync(password, 12);
  const info = db.prepare(
    'INSERT INTO users (email, password_hash, name, data_key_wrapped) VALUES (?, ?, ?, ?)'
  ).run(email.toLowerCase().trim(), hash, name.trim(), newWrappedDataKey());

  db.prepare('INSERT INTO sws_accounts (user_id, balance) VALUES (?, 0)').run(info.lastInsertRowid);

  res.json({ token: issueToken(info.lastInsertRowid) });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email and password are required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  res.json({ token: issueToken(user.id) });
});

module.exports = router;
