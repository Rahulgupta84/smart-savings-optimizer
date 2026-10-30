// Bank offer hints via offer.love API
// Docs: https://offer.love/api-docs/
// Fetches active bank offers (Chase Offers, Amex Offers, etc.) for the
// searched merchant and filters to only banks whose cards the user holds.
// Results appear below the main recommendation as "Save more" hints.

const BANK_OFFERS_API = 'https://data.offer.love/v1';

function _bankKey() {
  // config.js (gitignored) wins; falls back to key saved in the app sidebar
  if (typeof BANK_OFFERS_KEY !== 'undefined' && BANK_OFFERS_KEY) return BANK_OFFERS_KEY;
  try { return localStorage.getItem('soa_bank_key') || ''; } catch { return ''; }
}

// Maps offer.love bank names → CARD_TEMPLATES issuer strings
const BANK_TO_ISSUER = {
  'Chase':       'Chase',
  'Amex':        'American Express',
  'BoA':         'Bank of America',
  'Citi':        'Citi',
  'Wells Fargo': 'Wells Fargo',
  'US Bank':     'US Bank',
};

// Direct link to each bank's offers page so the user can verify
const BANK_OFFER_LINKS = {
  'Chase':       'https://www.chase.com/offers',
  'Amex':        'https://www.americanexpress.com/en-us/benefits/offers/',
  'BoA':         'https://www.bankofamerica.com/credit-cards/bank-offers/',
  'Citi':        'https://citicards.citi.com/ucs/ccmp/myoffers/',
  'Wells Fargo': 'https://www.wellsfargo.com/checking/deals/',
  'US Bank':     'https://www.usbank.com/bank-accounts/checking-accounts/bank-smartly-checking/deals-and-offers.html',
};

const BANK_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

function _cacheKey(slug) { return `soa_bank_cache_${slug}`; }

function _readCache(slug) {
  try {
    const raw = localStorage.getItem(_cacheKey(slug));
    if (!raw) return null;
    const { offers, fetchedAt } = JSON.parse(raw);
    if (Date.now() - fetchedAt > BANK_CACHE_TTL) { localStorage.removeItem(_cacheKey(slug)); return null; }
    return offers;
  } catch { return null; }
}

function _writeCache(slug, offers) {
  try { localStorage.setItem(_cacheKey(slug), JSON.stringify({ offers, fetchedAt: Date.now() })); } catch {}
}

async function getBankOffers(merchantName, userCards, merchantIsKnown) {
  try {
    // Skip API call entirely for unrecognised merchants — offer.love won't have them
    if (!merchantIsKnown) return [];

    const slug = merchantName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Collect issuers from the user's saved card templates
    const userIssuers = new Set(
      userCards.map(c => CARD_TEMPLATES.find(t => t.id === c.templateId)?.issuer).filter(Boolean)
    );
    if (!userIssuers.size) return [];

    // Serve from cache if still fresh (avoids burning daily quota on repeat searches)
    const cached = _readCache(slug);
    if (cached) {
      return cached.filter(o => { const issuer = BANK_TO_ISSUER[o.bank]; return issuer && userIssuers.has(issuer); });
    }

    const key = _bankKey();
    const qs  = key ? `?key=${encodeURIComponent(key)}` : '';
    const res = await fetch(`${BANK_OFFERS_API}/merchants/${encodeURIComponent(slug)}${qs}`);
    if (!res.ok) return [];

    const data   = await res.json();
    const offers = data.results || [];
    _writeCache(slug, offers); // cache raw results; filter per user on every read

    // Only return offers for banks the user actually has a card with
    return offers.filter(o => {
      const issuer = BANK_TO_ISSUER[o.bank];
      return issuer && userIssuers.has(issuer);
    });
  } catch (_) {
    return [];
  }
}
