const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { parseExpense } = require('./openai');
const { client: db } = require('../db');
const waState = require('./whatsapp-state');

const authDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'baileys_auth');

// Maps sent message ID → expense ID for reply-to-edit
const msgToExpense = new Map();

function trackMsg(msgId, expenseId) {
  msgToExpense.set(msgId, expenseId);
  if (msgToExpense.size > 300) {
    msgToExpense.delete(msgToExpense.keys().next().value);
  }
}

function clearAuthDir() {
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
    fs.mkdirSync(authDir, { recursive: true });
    console.log('Cleared stale WhatsApp credentials.');
  } catch (e) {
    console.error('Failed to clear auth dir:', e.message);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      waState.setQR(qr);
      console.log('QR code ready — open /api/whatsapp-qr in your browser to scan');
    }
    if (connection === 'close') {
      waState.clearQR();
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      if (isLoggedOut && !state.creds.registered) {
        console.log('Stale credentials detected — clearing and restarting...');
        clearAuthDir();
        setTimeout(startBot, 2000);
      } else if (!isLoggedOut) {
        console.log('WhatsApp disconnected. Reconnecting...');
        setTimeout(startBot, 3000);
      } else {
        console.log('WhatsApp session expired — clearing credentials and restarting...');
        clearAuthDir();
        setTimeout(startBot, 2000);
      }
    } else if (connection === 'open') {
      waState.clearQR();
      console.log('WhatsApp bot ready');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const selfJid = sock.user?.id?.replace(/:\d+@/, '@');
    console.log(`[msg] type=${type} count=${messages.length} selfJid=${selfJid}`);

    for (const msg of messages) {
      const isNoteToSelf = msg.key.remoteJid === selfJid;
      console.log(`[msg] remoteJid=${msg.key.remoteJid} fromMe=${msg.key.fromMe} isNoteToSelf=${isNoteToSelf}`);
      // 'notify' = incoming from others; 'append' = sent from primary device (Note to Self)
      if (type !== 'notify' && !isNoteToSelf) continue;
      if (msg.key.fromMe && !isNoteToSelf) continue;
      if (!msg.message) continue;

      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''
      ).trim();

      if (!text) continue;

      // Check if this is a reply to a previously logged expense
      const quotedId = msg.message?.extendedTextMessage?.contextInfo?.stanzaId;
      if (quotedId && msgToExpense.has(quotedId)) {
        const expenseId = msgToExpense.get(quotedId);
        try {
          const parsed = await parseExpense(text);
          if (parsed.amount > 0) {
            await db.execute({
              sql: `UPDATE expenses SET amount=?, category=?, description=?, whatsapp_note=?, raw_message=? WHERE id=?`,
              args: [parsed.amount, parsed.category, parsed.description, parsed.whatsapp_note, text, expenseId],
            });
            const sent = await sock.sendMessage(msg.key.remoteJid, {
              text: `Updated: $${parsed.amount.toFixed(2)} for ${parsed.description} [${parsed.category}]`,
            });
            if (sent?.key?.id) trackMsg(sent.key.id, expenseId);
            msgToExpense.delete(quotedId);
          }
        } catch (err) {
          console.error('Reply-edit error:', err);
        }
        continue;
      }

      try {
        const parsed = await parseExpense(text);

        if (parsed.amount <= 0) continue;

        const today = new Date().toISOString().split('T')[0];

        if (parsed.is_nsws) {
          await db.execute({ sql: "UPDATE sws_account SET balance = balance + ?, updated_at = datetime('now') WHERE id = 1", args: [parsed.amount] });
          const { rows: [sws] } = await db.execute('SELECT balance FROM sws_account WHERE id = 1');
          await sock.sendMessage(msg.key.remoteJid, {
            text: `SWS refund: +$${parsed.amount.toFixed(2)} added back. Balance: $${Number(sws.balance).toFixed(2)}`,
          });
          continue;
        }

        const result = await db.execute({
          sql: `INSERT INTO expenses (amount, category, description, date, is_sws, is_heavy, whatsapp_note, raw_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [parsed.amount, parsed.category, parsed.description, today,
            parsed.is_sws ? 1 : 0, parsed.is_heavy ? 1 : 0, parsed.whatsapp_note, text],
        });

        const expenseId = Number(result.lastInsertRowid);

        if (parsed.is_sws) {
          await db.execute({ sql: "UPDATE sws_account SET balance = balance - ?, updated_at = datetime('now') WHERE id = 1", args: [parsed.amount] });
          const { rows: [sws] } = await db.execute('SELECT balance FROM sws_account WHERE id = 1');
          const sent = await sock.sendMessage(msg.key.remoteJid, {
            text: `SWS: $${parsed.amount.toFixed(2)} for ${parsed.description} logged from SWS fund. Balance: $${Number(sws.balance).toFixed(2)}`,
          });
          if (sent?.key?.id) trackMsg(sent.key.id, expenseId);
        } else {
          const sent = await sock.sendMessage(msg.key.remoteJid, {
            text: `Logged: $${parsed.amount.toFixed(2)} for ${parsed.description} [${parsed.category}]${parsed.is_heavy ? ' ⚠ heavy expense' : ''}\n_Reply to correct this entry_`,
          });
          if (sent?.key?.id) trackMsg(sent.key.id, expenseId);
        }
      } catch (err) {
        console.error('WhatsApp handler error:', err);
        await sock.sendMessage(msg.key.remoteJid, { text: 'Error logging expense. Please try again.' });
      }
    }
  });
}

startBot().catch(console.error);
