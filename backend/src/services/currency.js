// Country code -> currency, plus daily exchange rates with caching.

const COUNTRY_TO_CURRENCY = {
  SG: 'SGD', MY: 'MYR', TH: 'THB', ID: 'IDR', VN: 'VND', PH: 'PHP',
  IN: 'INR', CN: 'CNY', HK: 'HKD', TW: 'TWD', JP: 'JPY', KR: 'KRW',
  US: 'USD', CA: 'CAD', GB: 'GBP', AU: 'AUD', NZ: 'NZD', CH: 'CHF',
  AE: 'AED', SA: 'SAR', QA: 'QAR', BN: 'BND', KH: 'KHR', LA: 'LAK',
  MM: 'MMK', LK: 'LKR', NP: 'NPR', BD: 'BDT', PK: 'PKR', TR: 'TRY',
  MX: 'MXN', BR: 'BRL', ZA: 'ZAR', EG: 'EGP', IL: 'ILS', SE: 'SEK',
  NO: 'NOK', DK: 'DKK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON',
  AT: 'EUR', BE: 'EUR', HR: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR',
  FR: 'EUR', DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR',
  LT: 'EUR', LU: 'EUR', MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR',
  SI: 'EUR', ES: 'EUR',
};

const KNOWN_CURRENCIES = new Set([...new Set(Object.values(COUNTRY_TO_CURRENCY))]);

function currencyForCountry(countryCode) {
  return COUNTRY_TO_CURRENCY[String(countryCode || '').toUpperCase()] || null;
}

// Rates cache: base currency -> { at: ms, rates: {CUR: rate} }
const rateCache = new Map();
const CACHE_TTL = 12 * 60 * 60 * 1000;

async function getRates(base) {
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.rates;
  try {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    const json = await res.json();
    if (json.result === 'success' && json.rates) {
      rateCache.set(base, { at: Date.now(), rates: json.rates });
      return json.rates;
    }
  } catch (err) {
    console.error('Exchange rate fetch failed:', err.message);
  }
  if (cached) return cached.rates; // stale is better than nothing
  return null;
}

// Convert amount from `from` currency into `to` currency. Falls back to 1:1
// if rates are unavailable (never blocks logging an expense).
async function convert(amount, from, to) {
  if (!from || !to || from === to) return amount;
  const rates = await getRates(from);
  const rate = rates && rates[to];
  if (!rate) {
    console.warn(`No exchange rate ${from}->${to}, storing 1:1`);
    return amount;
  }
  return Math.round(amount * rate * 100) / 100;
}

module.exports = { currencyForCountry, convert, KNOWN_CURRENCIES };
