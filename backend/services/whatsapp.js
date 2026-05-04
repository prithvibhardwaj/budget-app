const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const path = require('path');
const { parseExpense } = require('./openai');
const { client: db } = require('../db');

const authDir = path.join(process.env.DATA_DIR || path.join(__dirname, '..', 'data'), 'baileys_auth');

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

  if (!state.creds.registered) {
    const phone = (process.env.WHATSAPP_PHONE_NUMBER || '').replace(/\D/g, '');
    if (!phone) {
      console.error('Set WHATSAPP_PHONE_NUMBER env var (e.g. 6591234567) to get a pairing code');
    } else {
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phone);
          console.log(`\n=== WhatsApp Pairing Code: ${code} ===`);
          console.log('WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number\n');
        } catch (e) {
          console.error('Failed to get pairing code:', e.message);
          console.log('Restart the service to try again.');
        }
      }, 5000);
    }
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode !== DisconnectReason.loggedOut
        : true;
      console.log('WhatsApp disconnected. Reconnecting:', shouldReconnect);
      if (shouldReconnect) setTimeout(startBot, 3000);
    } else if (connection === 'open') {
      console.log('WhatsApp bot ready');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;

      const text = (
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        ''
      ).trim();

      if (!text) continue;

      try {
        const parsed = await parseExpense(text);

        if (parsed.amount <= 0) {
          await sock.sendMessage(msg.key.remoteJid, {
            text: 'Could not parse an expense amount. Try: "5.50 chicken rice"',
          });
          continue;
        }

        const today = new Date().toISOString().split('T')[0];

        if (parsed.is_nsws) {
          await db.execute({ sql: "UPDATE sws_account SET balance = balance + ?, updated_at = datetime('now') WHERE id = 1", args: [parsed.amount] });
          const { rows: [sws] } = await db.execute('SELECT balance FROM sws_account WHERE id = 1');
          await sock.sendMessage(msg.key.remoteJid, {
            text: `SWS refund: +$${parsed.amount.toFixed(2)} added back. Balance: $${Number(sws.balance).toFixed(2)}`,
          });
          continue;
        }

        await db.execute({
          sql: `INSERT INTO expenses (amount, category, description, date, is_sws, is_heavy, whatsapp_note, raw_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [parsed.amount, parsed.category, parsed.description, today,
            parsed.is_sws ? 1 : 0, parsed.is_heavy ? 1 : 0, parsed.whatsapp_note, text],
        });

        if (parsed.is_sws) {
          await db.execute({ sql: "UPDATE sws_account SET balance = balance - ?, updated_at = datetime('now') WHERE id = 1", args: [parsed.amount] });
          const { rows: [sws] } = await db.execute('SELECT balance FROM sws_account WHERE id = 1');
          await sock.sendMessage(msg.key.remoteJid, {
            text: `SWS: $${parsed.amount.toFixed(2)} for ${parsed.description} logged from SWS fund. Balance: $${Number(sws.balance).toFixed(2)}`,
          });
        } else {
          await sock.sendMessage(msg.key.remoteJid, {
            text: `Logged: $${parsed.amount.toFixed(2)} for ${parsed.description} [${parsed.category}]${parsed.is_heavy ? ' ⚠ heavy expense' : ''}`,
          });
        }
      } catch (err) {
        console.error('WhatsApp handler error:', err);
        await sock.sendMessage(msg.key.remoteJid, { text: 'Error logging expense. Please try again.' });
      }
    }
  });
}

startBot().catch(console.error);
