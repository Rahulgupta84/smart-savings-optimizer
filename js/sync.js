// Firestore sync — mirrors localStorage to cloud when user is signed in.
// Depends on: auth.js (getCurrentUser, getDb), storage.js (getCards, getPortals, etc.)

let _syncTimer = null;

async function pushToCloud() {
  const user = getCurrentUser();
  const db   = getDb();
  if (!user || !db) return;
  try {
    await db.collection('users').doc(user.uid).set({
      cards:      getCards(),
      portals:    getPortals(),
      settings:   getSettings(),
      favourites: getFavourites(),
      syncedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    });
  } catch (e) {
    console.warn('[sync] push failed:', e.message);
  }
}

function debouncedSync() {
  clearTimeout(_syncTimer);
  _syncTimer = setTimeout(pushToCloud, 1500);
}

async function fetchFromCloud() {
  const user = getCurrentUser();
  const db   = getDb();
  if (!user || !db) return null;
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    console.warn('[sync] fetch failed:', e.message);
    return null;
  }
}

async function handleSignIn() {
  const remote = await fetchFromCloud();
  if (!remote) {
    // First login — push existing local data to the cloud
    await pushToCloud();
    return;
  }

  // Merge: union cards/portals (local wins on duplicates), remote settings win
  const cardMap   = new Map(getCards().map(c  => [c.templateId, c]));
  const portalMap = new Map(getPortals().map(p => [p.portalId,   p]));
  (remote.cards   || []).forEach(c => { if (!cardMap.has(c.templateId))   cardMap.set(c.templateId, c); });
  (remote.portals || []).forEach(p => { if (!portalMap.has(p.portalId))   portalMap.set(p.portalId,  p); });

  const favSet = new Set([...getFavourites(), ...(remote.favourites || [])]);
  const merged = {
    cards:      [...cardMap.values()],
    portals:    [...portalMap.values()],
    settings:   remote.settings || getSettings(),
    favourites: [...favSet],
  };

  importData(JSON.stringify({ cards: merged.cards, portals: merged.portals, settings: merged.settings }));
  try { localStorage.setItem('soa_favourites_v1', JSON.stringify(merged.favourites)); } catch {}

  // Write merged result back so both devices converge
  await pushToCloud();
}
