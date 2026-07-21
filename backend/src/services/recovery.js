const crypto = require('crypto');

// A recovery code is a 128-bit random secret — high entropy, so a fast hash is
// the right primitive here (unlike a human-chosen password, it isn't guessable).
function generateRecoveryCode() {
  const hex = crypto.randomBytes(16).toString('hex').toUpperCase();
  return hex.match(/.{4}/g).join('-'); // ABCD-EF01-...
}

function normalizeRecoveryCode(code) {
  return String(code || '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
}

function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}

module.exports = { generateRecoveryCode, normalizeRecoveryCode, hashRecoveryCode };
