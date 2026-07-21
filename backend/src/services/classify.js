const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-5-nano';

const CATEGORIES = ['Food', 'Drinks', 'Groceries', 'Laundry', 'Miscellaneous', 'Entertainment', 'Transport'];

const CURRENCY_RE = /(^|\s)(sgd|myr|thb|idr|vnd|php|inr|cny|rmb|hkd|twd|jpy|krw|usd|cad|gbp|aud|nzd|chf|aed|eur|rm)(\s|$)/i;
const CURRENCY_ALIAS = { RM: 'MYR', RMB: 'CNY' };

const SYSTEM_PROMPT = `You parse short personal expense messages into JSON. The user texts things like "Guzman 11.8" meaning they spent 11.8 at Guzman (a food place).

Categories (pick exactly one):
- Food: meals, restaurants, hawker food, snacks, desserts
- Drinks: bubble tea, coffee, juice, alcohol
- Groceries: supermarket runs, household supplies
- Laundry: washing/dry cleaning
- Transport: bus, MRT, Grab, taxi, fuel, flights
- Entertainment: movies, games, events, outings
- Miscellaneous: anything that fits nothing above

Rules:
- amount is the monetary number in the message. If several numbers appear, the one that looks like a price.
- description: short, cleaned-up (e.g. "Guzman y Gomez" from "guzman"). Keep merchant names.
- is_heavy: true only for large one-off purchases (electronics, medical, travel bookings, roughly > 80 in local currency).
- If the message is clearly NOT an expense (a reminder, a link, a random note), set amount to 0.`;

const SCHEMA = {
  name: 'expense',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      amount: { type: 'number' },
      category: { type: 'string', enum: CATEGORIES },
      description: { type: 'string' },
      is_heavy: { type: 'boolean' },
    },
    required: ['amount', 'category', 'description', 'is_heavy'],
  },
};

// Deterministic pre-parse: SWS/refund keywords and explicit currency codes are
// handled in code, never left to the LLM.
function preParse(text) {
  let rest = text;
  let sws = null;
  if (/(^|\s)nsws(\s|$)/i.test(rest)) {
    sws = 'refund';
    rest = rest.replace(/(^|\s)nsws(\s|$)/gi, ' ');
  } else if (/(^|\s)sws(\s|$)/i.test(rest)) {
    sws = 'spend';
    rest = rest.replace(/(^|\s)sws(\s|$)/gi, ' ');
  }

  let currency = null;
  const m = rest.match(CURRENCY_RE);
  if (m) {
    const code = m[2].toUpperCase();
    currency = CURRENCY_ALIAS[code] || code;
    rest = rest.replace(CURRENCY_RE, ' ');
  }

  return { rest: rest.replace(/\s+/g, ' ').trim(), sws, currency };
}

async function classifyWithLLM(text) {
  const response = await openai.chat.completions.create({
    model: MODEL,
    reasoning_effort: 'minimal',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text },
    ],
    response_format: { type: 'json_schema', json_schema: SCHEMA },
  });
  return JSON.parse(response.choices[0].message.content);
}

function fallbackParse(text) {
  const m = text.match(/\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const amount = parseFloat(m[0].replace(',', '.'));
  const description = text.replace(m[0], '').replace(/\s+/g, ' ').trim() || text;
  return { amount, category: 'Miscellaneous', description, is_heavy: amount > 80 };
}

// Returns null if the message is not an expense.
// Otherwise: { amount, category, description, is_heavy, sws, currency }
async function parseExpenseMessage(text) {
  const { rest, sws, currency } = preParse(text);
  if (!/\d/.test(rest)) return null; // no number -> not an expense, skip LLM entirely

  let parsed;
  try {
    parsed = await classifyWithLLM(rest);
  } catch (err) {
    console.error('OpenAI classification failed, using fallback:', err.message);
    parsed = fallbackParse(rest);
  }
  if (!parsed) return null;

  const amount = Math.abs(Number(parsed.amount) || 0);
  if (amount <= 0) return null;

  return {
    amount,
    category: CATEGORIES.includes(parsed.category) ? parsed.category : 'Miscellaneous',
    description: (parsed.description || rest).slice(0, 200),
    is_heavy: !!parsed.is_heavy,
    sws,
    currency,
  };
}

module.exports = { parseExpenseMessage, CATEGORIES };
