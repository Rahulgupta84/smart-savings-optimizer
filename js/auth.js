// Firebase Auth — sign in/out + auth state.
// Requires: Firebase compat SDK loaded via CDN, then js/firebase-config.js (gitignored).
// Falls back gracefully when Firebase is not configured.

let _auth = null;
let _db   = null;
let _currentUser = undefined; // undefined = not yet determined; null = signed out
const _listeners = [];

function initFirebase() {
  if (typeof firebase === 'undefined' || typeof FIREBASE_CONFIG === 'undefined') return false;
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _auth = firebase.auth();
    _db   = firebase.firestore();
    _auth.onAuthStateChanged(u => {
      _currentUser = u;
      _listeners.forEach(cb => cb(u));
    });
    return true;
  } catch (e) {
    console.warn('[auth] init failed:', e.message);
    return false;
  }
}

function onAuthStateChange(cb) {
  _listeners.push(cb);
  if (_currentUser !== undefined) cb(_currentUser);
}

function getCurrentUser() { return _currentUser || null; }
function getDb()          { return _db; }

async function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  const result   = await _auth.signInWithPopup(provider);
  return result.user;
}

async function signInWithEmail(email, password) {
  const result = await _auth.signInWithEmailAndPassword(email, password);
  return result.user;
}

async function signUpWithEmail(email, password) {
  const result = await _auth.createUserWithEmailAndPassword(email, password);
  return result.user;
}

async function signOut() {
  if (_auth) await _auth.signOut();
}
