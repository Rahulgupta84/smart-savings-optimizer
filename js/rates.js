// Live cashback rate feed — fetches directly from your Google Sheet.
// The sheet must be shared: Share → "Anyone with the link" → Viewer.
// On every page load the app fetches the latest rates and overlays them
// on top of the hardcoded rates in data.js. If the fetch fails for any
// reason the app silently keeps the hardcoded rates — no visible error.

const SHEET_ID  = '1sVeesoEh_xdCCxuScWPWAyc48C_UgcNs';
const SHEET_GID = '535241189';

// Maps sheet portal column names → PORTAL_DB keys  (null = skip)
const PORTAL_KEY_MAP = {
  befrugal:    'befrugal',
  extrabux:    'extrabux',
  mrrebates:   'mrrebates',
  pricecom:    null,
  rakuten:     'rakuten',
  rebatesme:   'rebatesme',
  topcashback: 'topcashback',
};

const STORE_KEY_OVERRIDES = { hotelscom: 'hotelsdotcom' };

function _toKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function _toStoreKey(s) {
  const k = _toKey(s);
  return STORE_KEY_OVERRIDES[k] || k;
}

// Returns the best numeric cashback % from a raw cell string.
// "5%" → 5,  "2% (8%*)" → 8,  "Up to 7.5%" → 7.5,  "—" → 0
function _parseRate(raw) {
  if (!raw || raw === '—' || raw === '-' || raw === '$0') return 0;
  const hi = raw.match(/\(([0-9.]+)%/);
  if (hi) return parseFloat(hi[1]);
  const upto = raw.match(/up\s*to\s*([0-9.]+)%/i);
  if (upto) return parseFloat(upto[1]);
  const pct = raw.match(/([0-9.]+)%/);
  if (pct) return parseFloat(pct[1]);
  return 0;
}

async function loadLiveRates() {
  try {
    // Google's gviz endpoint works for any publicly shared sheet.
    // It returns JSONP; we strip the wrapper and parse the JSON inside.
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&gid=${SHEET_GID}`;
    const res  = await fetch(url);
    if (!res.ok) return;

    const text = await res.text();
    // Strip:  /*O_o*/\ngoogle.visualization.Query.setResponse({...});
    const json = JSON.parse(text.substring(text.indexOf('(') + 1, text.lastIndexOf(')')));
    if (json.status !== 'ok') return;

    const table = json.table;
    // Sheet layout — all rows appear in table.rows:
    //   rows[0]  = "Last updated: October 29, 2026, …"  (skip, extract date)
    //   rows[1]  = column headers: Store | BeFrugal | ExtraBux | …
    //   rows[2+] = store data rows
    if (!table.rows || table.rows.length < 3) return;

    // Extract date from the "Last updated" cell
    const tsText   = String((table.rows[0].c[0] && table.rows[0].c[0].v) || '');
    const datePart = tsText.replace('Last updated:', '').trim(); // "October 29, 2026, 10:41 PM PDT"
    const parsed   = new Date(datePart);
    const fileDate = isNaN(parsed) ? new Date().toISOString().split('T')[0]
                                   : parsed.toISOString().split('T')[0];

    // Header row: ["Store", "BeFrugal", "ExtraBux", "Mr. Rebates", …]
    const headerCells = table.rows[1].c || [];
    const headers = headerCells.map(cell => cell ? String(cell.v || '') : '');

    let updated = 0;
    for (let i = 2; i < table.rows.length; i++) {
      const cells = table.rows[i].c;
      if (!cells || !cells[0]) continue;
      const storeName = String(cells[0].v || '').trim();
      if (!storeName) continue;
      const storeKey = _toStoreKey(storeName);

      for (let j = 1; j < headers.length; j++) {
        const portalName = (headers[j] || '').trim();
        if (!portalName) continue;
        const portalId = PORTAL_KEY_MAP[_toKey(portalName)];
        if (!portalId || !PORTAL_DB[portalId]) continue;

        // Prefer the formatted display value (f) so "5%" parses correctly
        // even when the cell has a percentage number format.
        const cell    = cells[j];
        const cellStr = cell ? String(cell.f || cell.v || '') : '';
        const rate    = _parseRate(cellStr);

        if (PORTAL_DB[portalId].rates[storeKey] !== undefined) {
          PORTAL_DB[portalId].rates[storeKey].rate        = rate;
          PORTAL_DB[portalId].rates[storeKey].lastChecked = fileDate;
          updated++;
        }
      }
    }

    if (updated > 0) {
      console.log(`[rates] Live rates loaded from sheet dated ${fileDate} (${updated} rates updated)`);
    }
  } catch (_) {
    // Network error or sheet not public — silently keep hardcoded rates
  }
}
