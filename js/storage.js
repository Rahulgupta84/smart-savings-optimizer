// localStorage persistence.
// Cards: { id, templateId, addedAt }
// Portals: { id, portalId, addedAt }
// Settings: { theme, recentSearches }

const KEYS = {
  CARDS:      'soa_cards_v2',
  PORTALS:    'soa_portals_v2',
  SETTINGS:   'soa_settings_v2',
  FAVOURITES: 'soa_favourites_v1',
};

function generateId(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function getCards() {
  return readJSON(KEYS.CARDS, []);
}

function addCard(templateId) {
  const cards = getCards();
  if (cards.some(c => c.templateId === templateId)) return null;
  const card = { id: generateId('card'), templateId, addedAt: Date.now() };
  writeJSON(KEYS.CARDS, [...cards, card]);
  return card;
}

function removeCard(id) {
  writeJSON(KEYS.CARDS, getCards().filter(c => c.id !== id));
}

function updateCardCategory(cardId, categoryKey) {
  writeJSON(KEYS.CARDS, getCards().map(c => c.id === cardId ? { ...c, chosenCategory: categoryKey } : c));
}

function hasCard(templateId) {
  return getCards().some(c => c.templateId === templateId);
}

// ── Portals ───────────────────────────────────────────────────────────────────

function getPortals() {
  return readJSON(KEYS.PORTALS, []);
}

function addPortal(portalId) {
  const portals = getPortals();
  if (portals.some(p => p.portalId === portalId)) return null;
  const portal = { id: generateId('portal'), portalId, addedAt: Date.now() };
  writeJSON(KEYS.PORTALS, [...portals, portal]);
  return portal;
}

function removePortal(id) {
  writeJSON(KEYS.PORTALS, getPortals().filter(p => p.id !== id));
}

function hasPortal(portalId) {
  return getPortals().some(p => p.portalId === portalId);
}

// ── Settings ──────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS = {
  theme:         'light',
  recentSearches: [],
  onboardingDone: false,
};

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...readJSON(KEYS.SETTINGS, {}) };
}

function updateSettings(patch) {
  writeJSON(KEYS.SETTINGS, { ...getSettings(), ...patch });
}

function addRecentSearch(name) {
  if (!name || name.length < 2) return;
  const s = getSettings();
  const list = [name, ...(s.recentSearches || []).filter(x => x !== name)].slice(0, 8);
  updateSettings({ recentSearches: list });
}

function getRecentSearches() {
  return getSettings().recentSearches || [];
}

// ── Favourites ────────────────────────────────────────────────────────────────

function getFavourites() {
  return readJSON(KEYS.FAVOURITES, []);
}

function toggleFavourite(name) {
  if (!name) return false;
  const favs = getFavourites();
  const idx  = favs.indexOf(name);
  if (idx >= 0) {
    writeJSON(KEYS.FAVOURITES, favs.filter((_, i) => i !== idx));
    return false;
  }
  writeJSON(KEYS.FAVOURITES, [name, ...favs]);
  return true;
}

function isFavourite(name) {
  return getFavourites().includes(name);
}

// ── Export / Import ───────────────────────────────────────────────────────────

function exportData() {
  return JSON.stringify({ cards: getCards(), portals: getPortals(), settings: getSettings() }, null, 2);
}

function importData(jsonString) {
  const d = JSON.parse(jsonString);
  if (d.cards)   writeJSON(KEYS.CARDS,    d.cards);
  if (d.portals) writeJSON(KEYS.PORTALS,  d.portals);
  if (d.settings)writeJSON(KEYS.SETTINGS, d.settings);
}

function clearAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
