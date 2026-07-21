const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { db, dataDir } = require('../db');
const { encrypt, unwrapDataKey } = require('../crypto');
const { parseExpenseMessage } = require('./classify');
const { convert } = require('./currency');

const logger = pino({ level: 'silent' });

// userId -> { sock, status, qr, pairingCode, phone, stopping, pairingRequested }
// status: 'connecting' | 'waiting_scan' | 'open' | 'unlinked'
const sessions = new Map();

const MAX_MESSAGE_AGE_SEC = 10 * 60; // ignore anything older (history replay protection)

function authDirFor(userId) {
  return path.join(dataDir, 'wa', String(userId));
}

function getStatus(userId) {
  const s = sessions.get(userId);
  if (!s) {
    const linked = fs.existsSync(path.join(authDirFor(userId), 'creds.json'));
    return { status: linked ? 'connecting' : 'unlinked', qr: null, pairingCode: null };
  }
  return { status: s.status, qr: s.qr, pairingCode: s.pairingCode };
}

async function startSession(userId, phone = null) {
  const existing = sessions.get(userId);
  if (existing && existing.status === 'open') return;
  if (existing) {
    existing.stopping = true;
    try { existing.sock?.end(); } catch {}
  }

  const state = { sock: null, status: 'connecting', qr: null, pairingCode: null, phone, stopping: false, pairingRequested: false };
  sessions.set(userId, state);

  const authDir = authDirFor(userId);
  fs.mkdirSync(authDir, { recursive: true });
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({ version, auth: authState, logger, printQRInTerminal: false });
  state.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      state.qr = qr;
      state.status = 'waiting_scan';
      // Pairing code flow: request once, after the socket is ready (first QR event).
      if (state.phone && !state.pairingRequested && !authState.creds.registered) {
        state.pairingRequested = true;
        try {
          const code = await sock.requestPairingCode(state.phone.replace(/\D/g, ''));
          state.pairingCode = code;
        } catch (err) {
          console.error(`Pairing code request failed for user ${userId}:`, err.message);
        }
      }
    }

    if (connection === 'open') {
      state.status = 'open';
      state.qr = null;
      state.pairingCode = null;
      db.prepare('UPDATE users SET wa_linked = 1 WHERE id = ?').run(userId);
      console.log(`WhatsApp connected for user ${userId}`);
    }

    if (connection === 'close') {
      if (state.stopping) return;
      const statusCode = lastDisconnect?.error instanceof Boom
        ? lastDisconnect.error.output?.statusCode : null;
      if (statusCode === DisconnectReason.loggedOut) {
        console.log(`WhatsApp logged out for user ${userId} — clearing credentials`);
        fs.rmSync(authDir, { recursive: true, force: true });
        db.prepare('UPDATE users SET wa_linked = 0 WHERE id = ?').run(userId);
        state.status = 'unlinked';
        sessions.delete(userId);
      } else {
        state.status = 'connecting';
        setTimeout(() => {
          if (!state.stopping) startSession(userId, state.phone).catch(console.error);
        }, 3000);
      }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      try {
        await handleMessage(userId, sock, msg);
      } catch (err) {
        console.error(`Message handler error (user ${userId}):`, err);
      }
    }
  });
}

function stopSession(userId) {
  const s = sessions.get(userId);
  if (s) {
    s.stopping = true;
    try { s.sock?.logout(); } catch {}
    try { s.sock?.end(); } catch {}
    sessions.delete(userId);
  }
  fs.rmSync(authDirFor(userId), { recursive: true, force: true });
  db.prepare('UPDATE users SET wa_linked = 0 WHERE id = ?').run(userId);
}

function localDate(timezone) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone || 'Asia/Singapore' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function react(sock, msg, emoji) {
  // Reactions are the ONLY thing the bot ever sends. They arrive back as
  // reactionMessage events with no text, so they can never be re-processed —
  // this is what makes an infinite logging loop structurally impossible.
  try {
    await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
  } catch (err) {
    console.error('Reaction failed:', err.message);
  }
}

async function handleMessage(userId, sock, msg) {
  if (!msg.message) return;

  const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
  if (!text) return; // reactions, media, protocol messages — all ignored

  // Only the user's own "Note to Self" chat is ever read.
  const selfJid = sock.user?.id?.replace(/:\d+@/, '@');
  const selfLid = sock.user?.lid?.replace(/:\d+@/, '@');
  const isNoteToSelf = msg.key.remoteJid === selfJid || msg.key.remoteJid === selfLid;
  if (!isNoteToSelf) return;

  // History replay protection: never process old messages after a reconnect.
  const ts = Number(msg.messageTimestamp) || 0;
  if (ts > 0 && Date.now() / 1000 - ts > MAX_MESSAGE_AGE_SEC) return;

  // Persistent dedupe: each WhatsApp message ID is processed exactly once,
  // across restarts and redeliveries.
  const dedupe = db.prepare('INSERT OR IGNORE INTO processed_messages (user_id, msg_id) VALUES (?, ?)')
    .run(userId, msg.key.id);
  if (dedupe.changes === 0) return;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return;
  const dataKey = unwrapDataKey(user.data_key_wrapped);

  // Reply to a previously logged message -> edit or delete that entry.
  const quotedId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
  if (quotedId) {
    const handled = await handleReply(userId, user, dataKey, sock, msg, quotedId, text);
    if (handled) return;
  }

  const parsed = await parseExpenseMessage(text);
  if (!parsed) return; // not an expense — stay silent, it's the user's notes chat

  const currency = parsed.currency || user.current_currency || user.home_currency;
  const amountHome = await convert(parsed.amount, currency, user.home_currency);
  const date = localDate(user.timezone);

  if (parsed.sws === 'refund') {
    db.prepare(`INSERT INTO sws_transactions (user_id, type, amount, currency, amount_home, description_enc, date, wa_msg_id)
                VALUES (?, 'refund', ?, ?, ?, ?, ?, ?)`)
      .run(userId, parsed.amount, currency, amountHome, encrypt(parsed.description, dataKey), date, msg.key.id);
    db.prepare('UPDATE sws_accounts SET balance = balance + ? WHERE user_id = ?').run(amountHome, userId);
    await react(sock, msg, '💰');
    return;
  }

  if (parsed.sws === 'spend') {
    // SWS spends are fully independent of monthly expenses — separate table,
    // never included in any expense stats.
    db.prepare(`INSERT INTO sws_transactions (user_id, type, amount, currency, amount_home, description_enc, date, wa_msg_id)
                VALUES (?, 'spend', ?, ?, ?, ?, ?, ?)`)
      .run(userId, parsed.amount, currency, amountHome, encrypt(parsed.description, dataKey), date, msg.key.id);
    db.prepare('UPDATE sws_accounts SET balance = balance - ? WHERE user_id = ?').run(amountHome, userId);
    await react(sock, msg, '🏦');
    return;
  }

  db.prepare(`INSERT INTO expenses (user_id, amount, currency, amount_home, category, description_enc, date, is_heavy, source, wa_msg_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'whatsapp', ?)`)
    .run(userId, parsed.amount, currency, amountHome, parsed.category,
      encrypt(parsed.description, dataKey), date, parsed.is_heavy ? 1 : 0, msg.key.id);
  await react(sock, msg, parsed.is_heavy ? '⚠️' : '✅');
}

async function handleReply(userId, user, dataKey, sock, msg, quotedId, text) {
  const expense = db.prepare('SELECT * FROM expenses WHERE user_id = ? AND wa_msg_id = ?').get(userId, quotedId);
  const swsTxn = expense ? null
    : db.prepare('SELECT * FROM sws_transactions WHERE user_id = ? AND wa_msg_id = ?').get(userId, quotedId);
  if (!expense && !swsTxn) return false;

  const isDelete = /^(delete|del|remove|undo|cancel)$/i.test(text);

  if (isDelete) {
    if (expense) {
      db.prepare('DELETE FROM expenses WHERE id = ?').run(expense.id);
    } else {
      const sign = swsTxn.type === 'spend' ? 1 : -1;
      db.prepare('UPDATE sws_accounts SET balance = balance + ? WHERE user_id = ?').run(sign * swsTxn.amount_home, userId);
      db.prepare('DELETE FROM sws_transactions WHERE id = ?').run(swsTxn.id);
    }
    await react(sock, msg, '🗑️');
    return true;
  }

  const parsed = await parseExpenseMessage(text);
  if (!parsed) return false;

  const currency = parsed.currency || (expense ? expense.currency : swsTxn.currency);
  const amountHome = await convert(parsed.amount, currency, user.home_currency);

  if (expense) {
    db.prepare(`UPDATE expenses SET amount = ?, currency = ?, amount_home = ?, category = ?, description_enc = ?, is_heavy = ?, wa_msg_id = ? WHERE id = ?`)
      .run(parsed.amount, currency, amountHome, parsed.category,
        encrypt(parsed.description, dataKey), parsed.is_heavy ? 1 : 0, msg.key.id, expense.id);
  } else {
    const sign = swsTxn.type === 'spend' ? 1 : -1;
    // reverse the old txn's balance effect, apply the new one
    db.prepare('UPDATE sws_accounts SET balance = balance + ? WHERE user_id = ?')
      .run(sign * swsTxn.amount_home - sign * amountHome, userId);
    db.prepare(`UPDATE sws_transactions SET amount = ?, currency = ?, amount_home = ?, description_enc = ?, wa_msg_id = ? WHERE id = ?`)
      .run(parsed.amount, currency, amountHome, encrypt(parsed.description, dataKey), msg.key.id, swsTxn.id);
  }
  await react(sock, msg, '✏️');
  return true;
}

// On boot, resume sessions for every user who previously linked WhatsApp.
function resumeAll() {
  const linked = db.prepare('SELECT id FROM users WHERE wa_linked = 1').all();
  for (const { id } of linked) {
    if (fs.existsSync(path.join(authDirFor(id), 'creds.json'))) {
      startSession(id).catch((err) => console.error(`Failed to resume WA for user ${id}:`, err));
    }
  }
}

module.exports = { startSession, stopSession, getStatus, resumeAll };
