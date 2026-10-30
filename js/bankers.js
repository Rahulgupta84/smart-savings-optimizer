// Bank offer hints via offer.love API
// Docs: https://offer.love/api-docs/
// Fetches active bank offers (Chase Offers, Amex Offers, etc.) for the
// searched merchant and filters to only banks whose cards the user holds.
// Results appear below the main recommendation as "Save more" hints.

const BANK_OFFERS_API = 'https://data.offer.love/v1';

function _bankKey() {
  try { return localStorage.getItem('soa_bank_key') || ''; } catch { return ''; }
}

// Maps offer.love bank names → CARD_DB issuer strings
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

async function getBankOffers(merchantName, userCards) {
  try {
    const slug = merchantName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Collect issuers from the user's saved card templates
    const userIssuers = new Set(
      userCards.map(c => CARD_DB[c.templateId]?.issuer).filter(Boolean)
    );
    if (!userIssuers.size) return [];

    const key = _bankKey();
    const qs  = key ? `?key=${encodeURIComponent(key)}` : '';
    const res = await fetch(
      `${BANK_OFFERS_API}/merchants/${encodeURIComponent(slug)}${qs}`
    );
    if (!res.ok) return [];

    const data = await res.json();
    const offers = data.results || [];

    // Only return offers for banks the user actually has a card with
    return offers.filter(o => {
      const issuer = BANK_TO_ISSUER[o.bank];
      return issuer && userIssuers.has(issuer);
    });
  } catch (_) {
    return [];
  }
}
