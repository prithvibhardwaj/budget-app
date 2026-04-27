const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { parseExpense } = require('./openai');
const { client: db } = require('../db');

const dataPath = process.env.DATA_DIR || require('path').join(__dirname, '..', 'data');

const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    headless: true,
  },
});

waClient.on('qr', (qr) => {
  console.log('\n=== Scan this QR code with WhatsApp ===\n');
  qrcode.generate(qr, { small: true });
});

waClient.on('ready', () => {
  console.log('WhatsApp bot ready');
});

waClient.on('message', async (msg) => {
  if (msg.fromMe) return;
  const text = msg.body.trim();
  if (!text) return;

  try {
    const parsed = await parseExpense(text);

    if (parsed.amount <= 0) {
      await msg.reply('Could not parse an expense amount. Try: "5.50 chicken rice food"');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    if (parsed.is_nsws) {
      await db.execute({ sql: "UPDATE sws_account SET balance = balance + ?, updated_at = datetime('now') WHERE id = 1", args: [parsed.amount] });
      const { rows: [sws] } = await db.execute('SELECT balance FROM sws_account WHERE id = 1');
      await msg.reply(`SWS refund: +$${parsed.amount.toFixed(2)} added back. Balance: $${Number(sws.balance).toFixed(2)}`);
      return;
    }

    await db.execute({
      sql: `INSERT INTO expenses (amount, category, description, date, is_sws, is_heavy, whatsapp_note, raw_message)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [parsed.amount, parsed.category, parsed.description, today, parsed.is_sws ? 1 : 0, parsed.is_heavy ? 1 : 0, parsed.whatsapp_note, text],
    });

    if (parsed.is_sws) {
      await db.execute({ sql: "UPDATE sws_account SET balance = balance - ?, updated_at = datetime('now') WHERE id = 1", args: [parsed.amount] });
      const { rows: [sws] } = await db.execute('SELECT balance FROM sws_account WHERE id = 1');
      await msg.reply(`SWS: $${parsed.amount.toFixed(2)} for ${parsed.description} logged from SWS fund. Balance: $${Number(sws.balance).toFixed(2)}`);
    } else {
      await msg.reply(`Logged: $${parsed.amount.toFixed(2)} for ${parsed.description} [${parsed.category}]${parsed.is_heavy ? ' ⚠ heavy expense' : ''}`);
    }
  } catch (err) {
    console.error('WhatsApp handler error:', err);
    await msg.reply('Error logging expense. Please try again.');
  }
});

waClient.initialize();

module.exports = waClient;
