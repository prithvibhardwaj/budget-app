const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a personal finance assistant. Parse expense messages and return structured JSON only — no explanation, no markdown, just raw JSON.

Valid categories: Food, Drinks, Groceries, Laundry, Miscellaneous, Entertainment, Transport

Rules:
- If the message contains "sws" (case-insensitive), set is_sws to true
- If the message contains "nsws" (case-insensitive), set is_nsws to true (this is a reversal/refund back to SWS)
- Set is_heavy to true if the expense is a large one-time item (medical, vacation, electronics, >$80 single item)
- whatsapp_note should be a friendly, natural English sentence describing the expense

Return this exact JSON shape:
{
  "amount": number,
  "category": "Food|Drinks|Groceries|Laundry|Miscellaneous|Entertainment|Transport",
  "description": "short description",
  "is_sws": false,
  "is_nsws": false,
  "is_heavy": false,
  "whatsapp_note": "Friendly English sentence"
}`;

async function parseExpense(message) {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return {
    amount: Math.abs(Number(parsed.amount) || 0),
    category: parsed.category || 'Miscellaneous',
    description: parsed.description || message,
    is_sws: !!parsed.is_sws,
    is_nsws: !!parsed.is_nsws,
    is_heavy: !!parsed.is_heavy,
    whatsapp_note: parsed.whatsapp_note || message,
  };
}

module.exports = { parseExpense };
