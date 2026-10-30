// Live cashback rate feed.
// After deploying the Google Apps Script (Code.gs), paste your web app URL below.
// Leave it empty to use only the hardcoded rates in data.js.

const LIVE_RATES_URL = 'https://script.google.com/macros/s/AKfycbxZxe8GL_kPpLKnEa8B8F_kYSEAk3AeXVMXT7oN-UcgRid6Xh1UxnD_H7kI1Ifc9XtK/exec';

// Maps sheet portal keys (lowercase, no spaces) → PORTAL_DB keys
const PORTAL_KEY_MAP = {
  befrugal:    'befrugal',
  extrabux:    'extrabux',
  mrrebates:   'mrrebates',
  pricecom:    null,          // not tracked in PORTAL_DB
  rakuten:     'rakuten',
  rebatesme:   'rebatesme',
  topcashback: 'topcashback',
};

async function loadLiveRates() {
  if (!LIVE_RATES_URL) return;

  try {
    const res = await fetch(LIVE_RATES_URL);
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok || !data.rates) return;

    let updated = 0;
    for (const [sheetKey, storeRates] of Object.entries(data.rates)) {
      const portalId = PORTAL_KEY_MAP[sheetKey];
      if (!portalId || !PORTAL_DB[portalId]) continue;

      for (const [storeKey, rate] of Object.entries(storeRates)) {
        if (PORTAL_DB[portalId].rates[storeKey] !== undefined) {
          PORTAL_DB[portalId].rates[storeKey].rate = rate;
          PORTAL_DB[portalId].rates[storeKey].lastChecked = data.date;
          updated++;
        }
      }
    }

    if (updated > 0) {
      console.log('[rates] Live rates loaded from sheet dated ' + data.date + ' (' + updated + ' rates updated)');
    }
  } catch (_) {
    // Network error or CORS — silently fall back to hardcoded rates
  }
}
