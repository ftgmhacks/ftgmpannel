import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const STORAGE_KEY = 'pak_digital_admin_sec_key_v1';

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isKeyConfigured() {
  const db = getFirestore();
  const snap = await getDoc(doc(db, 'settings', 'security'));
  return snap.exists() && !!snap.data()?.keyHash;
}

export async function setAdminKey(newKey, oldKey = '') {
  const cleanNew = String(newKey || '').trim();
  if (cleanNew.length < 8) {
    throw new Error('New secret key must be at least 8 characters.');
  }

  const db = getFirestore();
  const ref = doc(db, 'settings', 'security');
  const snap = await getDoc(ref);

  if (snap.exists() && snap.data()?.keyHash) {
    const existingSalt = snap.data().salt || 'pak-digital-salt';
    const candidateOld = String(oldKey || localStorage.getItem(STORAGE_KEY) || '').trim();
    if (!candidateOld) {
      throw new Error('Enter your current secret key to change it.');
    }
    const oldHash = await sha256Hex(`${existingSalt}:${candidateOld}`);
    if (oldHash !== snap.data().keyHash) {
      throw new Error('Current secret key is incorrect.');
    }
  }

  const newSalt = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const newHash = await sha256Hex(`${newSalt}:${cleanNew}`);

  await setDoc(ref, {
    salt: newSalt,
    keyHash: newHash,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // Cache in localStorage so admin never has to re-enter on this device
  localStorage.setItem(STORAGE_KEY, cleanNew);
  return true;
}

export async function requireAdminKey() {
  const db = getFirestore();
  const ref = doc(db, 'settings', 'security');
  const snap = await getDoc(ref);

  if (!snap.exists() || !snap.data()?.keyHash) {
    throw new Error('Balance Secret Key is not set yet! Go to Settings -> Balance Secret Key to set it first.');
  }

  const { salt, keyHash } = snap.data();

  // 1. Check localStorage first so admin doesn't have to re-enter it every time
  const cachedKey = localStorage.getItem(STORAGE_KEY);
  if (cachedKey) {
    const cachedHash = await sha256Hex(`${salt}:${cachedKey}`);
    if (cachedHash === keyHash) {
      return true;
    }
    localStorage.removeItem(STORAGE_KEY);
  }

  // 2. Prompt once if not cached in localStorage yet
  const entered = window.prompt('🔒 Enter your Admin Balance Secret Key (Will be remembered on this device):');
  if (!entered) {
    throw new Error('Action cancelled: Secret key is required.');
  }

  const enteredClean = entered.trim();
  const enteredHash = await sha256Hex(`${salt}:${enteredClean}`);
  if (enteredHash !== keyHash) {
    throw new Error('Invalid Admin Balance Secret Key!');
  }

  localStorage.setItem(STORAGE_KEY, enteredClean);
  return true;
}

export function clearCachedAdminKey() {
  localStorage.removeItem(STORAGE_KEY);
}
