const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const ALGO = 'aes-256-gcm';

let masterKey = null;
function getMasterKey() {
  if (masterKey) return masterKey;
  if (process.env.ENCRYPTION_KEY && /^[0-9a-f]{64}$/i.test(process.env.ENCRYPTION_KEY)) {
    masterKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    return masterKey;
  }
  const { dataDir } = require('./db');
  const keyFile = path.join(dataDir, 'master.key');
  if (fs.existsSync(keyFile)) {
    masterKey = Buffer.from(fs.readFileSync(keyFile, 'utf8').trim(), 'hex');
  } else {
    masterKey = crypto.randomBytes(32);
    fs.writeFileSync(keyFile, masterKey.toString('hex'), { mode: 0o600 });
    console.log('Generated new master encryption key at', keyFile);
  }
  return masterKey;
}

// Returns base64(iv | authTag | ciphertext)
function encrypt(plaintext, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

function decrypt(b64, key) {
  const buf = Buffer.from(b64, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

// Each user gets a random data key; it is stored wrapped (encrypted) by the master key.
function newWrappedDataKey() {
  return encrypt(crypto.randomBytes(32).toString('hex'), getMasterKey());
}

function unwrapDataKey(wrapped) {
  return Buffer.from(decrypt(wrapped, getMasterKey()), 'hex');
}

module.exports = { encrypt, decrypt, newWrappedDataKey, unwrapDataKey };
