const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, Browsers } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { db, dataDir } = require('../db');
const { encrypt, decrypt, unwrapDataKey } = require('../crypto');
const { parseExpenseMessage, wouldUseLLM } = require('./classify');
const { convert } = require('./currency');
const rateLimit = require('./ratelimit');

const logger = pino({ level: 'silent' });

// userId -> { sock, status, qr, pairingCode, phone, stopping, pairingRequested }
// status: 'connecting' | 'waiting_scan' | 'open' | 'unlinked'
const sessions = new Map();

const MAX_MESSAGE_AGE_SEC = 10 * 60; // ignore anything older (history replay protection)

// Every message the bot sends starts with this marker, and every incoming
// message that starts with it is dropped before ANY parsing. This is the
// deterministic echo guard that makes command replies loop-safe: unlike the
// v1 in-memory sent-id set, the rule lives in code and survives restarts.
const BOT_PREFIX = '🤖';

// Rate-limit explanations are sent at most once an hour per user, so someone
// who keeps texting while throttled gets reactions rather than a wall of replies.
const lastLimitNotice = new Map();

function shouldNotifyLimit(userId) {
  const last = lastLimitNotice.get(userId) || 0;
  if (Date.now() - last < 60 * 60 * 1000) return false;
  lastLimitNotice.set(userId, Date.now());
  return true;
}

// Charges one unit of LLM quota if this message would actually call the model.
// Returns false when the user is over their limit.
async function checkLLMQuota(userId, text, sock, msg) {
  if (!wouldUseLLM(text)) return true; // no API call, no quota

  const result = rateLimit.tryConsume(userId);
  if (result.allowed) return true;

  await react(sock, msg, '⏳');
  if (shouldNotifyLimit(userId)) {
    await sendBotMessage(sock, msg.key.remoteJid,
      `Rate limit reached — ${result.limit} auto-logged expenses per hour. `
      + 'This one was not logged. Try again later, or add it in the app (no limit there).');
  }
  return false;
}

async function sendBotMessage(sock, jid, text) {
  try {
    await sock.sendMessage(jid, { text: `${BOT_PREFIX} ${text}` });
  } catch (err) {
    console.error('Bot message send failed:', err.message);
  }
}

function authDirFor(userId) {
  return path.join(dataDir, 'wa', String(userId));
}

function getStatus(userId) {
  const s = sessions.get(userId);
  if (!s) {
    const linked = fs.existsSync(path.join(authDirFor(userId), 'creds.json'));
    return { status: linked ? 'connecting' : 'unlinked', qr: null, pairingCode: null, error: null };
  }
  return { status: s.status, qr: s.qr, pairingCode: s.pairingCode, error: s.error };
}

async function startSession(userId, phone = null) {
  const existing = sessions.get(userId);
  if (existing && existing.status === 'open') return;
  if (existing) {
    existing.stopping = true;
    try { existing.sock?.end(); } catch {}
  }

  const state = { sock: null, status: 'connecting', qr: null, pairingCode: null, phone, stopping: false, pairingRequested: false, error: null };
  sessions.set(userId, state);

  const authDir = authDirFor(userId);
  fs.mkdirSync(authDir, { recursive: true });

  // A half-finished pairing attempt leaves unregistered credentials behind that
  // make the next attempt fail. Start pairing runs from a clean slate.
  if (phone && !fs.existsSync(path.join(authDir, 'creds.json'))) {
    fs.rmSync(authDir, { recursive: true, force: true });
    fs.mkdirSync(authDir, { recursive: true });
  }

  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: authState,
    logger,
    printQRInTerminal: false,
    // Required for pairing-code login — Baileys rejects the pair without a
    // valid browser identity here.
    browser: Browsers.macOS('Google Chrome'),
  });
  state.sock = sock;

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      state.qr = qr;
      state.status = 'waiting_scan';
      // Pairing code flow: request once, after the socket is ready (first QR event).
      if (state.phone && !state.pairingRequested && !authState.creds.registered) {
        state.pairingRequested = true;
        const digits = state.phone.replace(/\D/g, '');
        try {
          if (digits.length < 8 || digits.length > 15) {
            throw new Error('Number must be in international format including country code, e.g. 6591234567');
          }
          const code = await sock.requestPairingCode(digits);
          state.pairingCode = code;
          state.error = null;
          console.log(`Pairing code issued for user ${userId} (number ends ...${digits.slice(-4)})`);
        } catch (err) {
          state.error = err.message;
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
  if (text.startsWith(BOT_PREFIX)) return; // our own echoed reply — never parse

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

  // Command messages start with // and are never expense-parsed. Dispatched
  // after the dedupe insert so a redelivered //undo can't fire twice.
  if (text.startsWith('//')) {
    await handleCommand(userId, user, dataKey, sock, msg, text);
    return;
  }

  // Reply to a previously logged message -> edit or delete that entry.
  const quotedId = msg.message.extendedTextMessage?.contextInfo?.stanzaId;
  if (quotedId) {
    const handled = await handleReply(userId, user, dataKey, sock, msg, quotedId, text);
    if (handled) return;
  }

  if (!(await checkLLMQuota(userId, text, sock, msg))) return;

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

const HELP_TEXT = `Budget bot — just text an expense, e.g. "Guzman 11.8"

Logging:
• "grab 14.5" → Transport, "bubble tea 3" → Drinks
• "75 myr nasi lemak" → explicit currency (else your location's currency)
• "sws 20 groceries" → from Misc Fund (not in monthly spending)
• "nsws 50" → top Misc Fund back up
• Reply to a logged message to correct it, reply "delete" to remove it

Commands:
//today — today's spending
//week — last 7 days
//month — this month incl. fixed
//sws — Misc Fund balance
//last — recent entries
//undo — remove the latest expense
//help — this message

The bot reacts ✅ when logged, ⚠️ heavy, 🏦 Misc Fund, ✏️ edited, 🗑️ deleted.`;

function tzDate(timezone, daysAgo = 0) {
  try {
    return new Date(Date.now() - daysAgo * 86400000)
      .toLocaleDateString('en-CA', { timeZone: timezone || 'Asia/Singapore' });
  } catch {
    return new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  }
}

function money(n, cur) {
  return `${cur} ${(Number(n) || 0).toFixed(2)}`;
}

async function handleCommand(userId, user, dataKey, sock, msg, text) {
  const jid = msg.key.remoteJid;
  const cmd = text.slice(2).trim().toLowerCase().split(/\s+/)[0];
  const cur = user.home_currency;

  if (cmd === 'help' || cmd === '') {
    await sendBotMessage(sock, jid, HELP_TEXT);
    return;
  }

  if (cmd === 'today' || cmd === 'week') {
    const since = tzDate(user.timezone, cmd === 'today' ? 0 : 6);
    const rows = db.prepare(`SELECT category, SUM(amount_home) amount FROM expenses
                             WHERE user_id = ? AND date >= ? GROUP BY category ORDER BY amount DESC`)
      .all(userId, since);
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const label = cmd === 'today' ? 'Today' : 'Last 7 days';
    if (!rows.length) {
      await sendBotMessage(sock, jid, `${label}: nothing logged yet.`);
      return;
    }
    const lines = rows.map((r) => `• ${r.category}: ${money(r.amount, cur)}`).join('\n');
    await sendBotMessage(sock, jid, `${label}: ${money(total, cur)}\n${lines}`);
    return;
  }

  if (cmd === 'month') {
    const month = tzDate(user.timezone).slice(0, 7);
    const variable = db.prepare('SELECT COALESCE(SUM(amount_home),0) t FROM expenses WHERE user_id = ? AND date LIKE ?')
      .get(userId, `${month}%`).t;
    const fixed = db.prepare('SELECT COALESCE(SUM(amount),0) t FROM fixed_expenses WHERE user_id = ? AND active = 1')
      .get(userId).t;
    await sendBotMessage(sock, jid,
      `${month}: ${money(variable + fixed, cur)}\n• Spent: ${money(variable, cur)}\n• Fixed: ${money(fixed, cur)}`);
    return;
  }

  if (cmd === 'sws') {
    const acct = db.prepare('SELECT balance FROM sws_accounts WHERE user_id = ?').get(userId) || { balance: 0 };
    await sendBotMessage(sock, jid, `Misc Fund: ${money(acct.balance, cur)}`);
    return;
  }

  if (cmd === 'last') {
    const rows = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY id DESC LIMIT 5').all(userId);
    if (!rows.length) {
      await sendBotMessage(sock, jid, 'No expenses logged yet.');
      return;
    }
    const lines = rows.map((r) => {
      let desc = '';
      try { desc = decrypt(r.description_enc, dataKey); } catch {}
      return `• ${r.date} ${desc} — ${money(r.amount_home, cur)} [${r.category}]`;
    }).join('\n');
    await sendBotMessage(sock, jid, `Recent:\n${lines}`);
    return;
  }

  if (cmd === 'undo') {
    const last = db.prepare('SELECT * FROM expenses WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId);
    if (!last) {
      await sendBotMessage(sock, jid, 'Nothing to undo.');
      return;
    }
    db.prepare('DELETE FROM expenses WHERE id = ?').run(last.id);
    let desc = '';
    try { desc = decrypt(last.description_enc, dataKey); } catch {}
    await sendBotMessage(sock, jid, `Removed: ${desc} — ${money(last.amount_home, cur)} (${last.date})`);
    return;
  }

  await sendBotMessage(sock, jid, `Unknown command "//${cmd}". Try //help`);
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

  if (!(await checkLLMQuota(userId, text, sock, msg))) return true;

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

module.exports = { startSession, stopSession, getStatus, resumeAll, _handleCommand: handleCommand };
