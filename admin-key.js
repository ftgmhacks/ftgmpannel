// PAK DIGITAL — Admin secret-key gate.
// Firestore stores only a salted hash. The latest successfully verified key is
// saved locally on this device at the administrator's request, never in source.
// localStorage is NOT a secure vault: use only on a private, trusted device.
import { getFirestore, doc, getDoc, setDoc, serverTimestamp as fsTS } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const getDb = () => getFirestore(getApp());
const SEC_REF = () => doc(getDb(), 'settings', 'security');
const UNLOCK_MS = 10 * 60 * 1000;
let unlockedUntil = 0;
let unlockedHash = '';
let activePrompt = null;

function storageName() {
  const app = getApp();
  const uid = getAuth(app).currentUser?.uid;
  return uid ? `pakdigital:recent-admin-key:v1:${app.options.projectId}:${uid}` : null;
}
function readRecent() {
  try {
    const name = storageName();
    if (!name) return null;
    const recent = JSON.parse(localStorage.getItem(name) || 'null');
    return recent && typeof recent.key === 'string' && typeof recent.hash === 'string' ? recent : null;
  } catch { return null; }
}
function saveRecent(key, hash) {
  try {
    const name = storageName();
    if (!name) return false;
    localStorage.setItem(name, JSON.stringify({ key, hash, savedAt: Date.now() }));
    return true;
  } catch { return false; }
}
export function lockAdminKeySession() { unlockedUntil = 0; unlockedHash = ''; }
export function forgetAdminKey() {
  try { const name = storageName(); if (name) localStorage.removeItem(name); } catch { /* Storage may be blocked. */ }
  lockAdminKeySession();
}
export function fillPreviousKey(input) {
  const recent = readRecent();
  if (!recent || !input) return false;
  input.value = recent.key;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
  return true;
}
async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const randomSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
export async function isKeyConfigured() {
  const s = await getDoc(SEC_REF());
  return s.exists() && !!s.data().adminKeyHash;
}
export async function setAdminKey(newKey, oldKey) {
  if (!newKey || newKey.length < 8) throw new Error('Secret key must be at least 8 characters.');
  const s = await getDoc(SEC_REF());
  if (s.exists() && s.data().adminKeyHash) {
    const oldHash = await sha256((s.data().adminKeySalt || '') + (oldKey || ''));
    if (oldHash !== s.data().adminKeyHash) throw new Error('Current secret key is wrong.');
  }
  const salt = randomSalt();
  await setDoc(SEC_REF(), { adminKeySalt: salt, adminKeyHash: await sha256(salt + newKey), updatedAt: fsTS() }, { merge: true });
  forgetAdminKey();
}
function askKey() {
  if (activePrompt) return activePrompt;
  activePrompt = new Promise(resolve => {
    const previousFocus = document.activeElement;
    const overlay = document.createElement('div');
    overlay.id = 'admin-key-overlay';
    overlay.className = 'key-overlay';
    overlay.innerHTML = `<form id="admin-key-form" class="key-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-key-title" aria-describedby="admin-key-help">
      <h3 id="admin-key-title"><i class="fa-solid fa-shield-halved"></i> Secret Key Required</h3>
      <p id="admin-key-help">Verify your key before changing a wallet or approving a payment.</p>
      <label for="admin-key-input">Admin secret key</label>
      <input id="admin-key-input" type="password" autocomplete="off" class="form-control" placeholder="Enter secret key" required>
      <div class="key-recent-actions"><button type="button" id="admin-key-previous" class="btn btn-sm btn-secondary"><i class="fa-solid fa-clock-rotate-left"></i> Use Previous Key</button><button type="button" id="admin-key-forget" class="btn btn-sm btn-secondary"><i class="fa-solid fa-trash-can"></i> Forget Key</button></div>
      <div class="key-privacy">The verified key is saved on this device. Anyone using this browser can reuse it. Choose Forget Key on shared devices.</div>
      <label class="balance-filter"><input type="checkbox" id="admin-key-remember" checked> Save recent key on this device</label>
      <div id="admin-key-feedback" class="key-feedback" role="status" aria-live="polite"></div>
      <div class="key-dialog-footer"><button type="submit" class="btn btn-primary"><i class="fa-solid fa-lock-open"></i> Unlock</button><button type="button" id="admin-key-cancel" class="btn btn-secondary">Cancel</button></div>
    </form>`;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('#admin-key-input');
    const previous = overlay.querySelector('#admin-key-previous');
    const forget = overlay.querySelector('#admin-key-forget');
    const feedback = overlay.querySelector('#admin-key-feedback');
    const updateButtons = () => { const available = !!readRecent(); previous.disabled = !available; forget.disabled = !available; };
    updateButtons();
    previous.onclick = () => { if (fillPreviousKey(input)) feedback.textContent = 'Previous key filled. Select Unlock to verify it.'; else { feedback.textContent = 'No recent key saved on this device.'; updateButtons(); } };
    forget.onclick = () => { forgetAdminKey(); input.value = ''; updateButtons(); feedback.textContent = 'Recent key removed from this device.'; input.focus(); };
    const done = value => { input.value = ''; overlay.remove(); activePrompt = null; if (previousFocus instanceof HTMLElement && previousFocus.isConnected && !previousFocus.disabled) previousFocus.focus(); resolve(value); };
    overlay.querySelector('#admin-key-form').onsubmit = e => { e.preventDefault(); done({ key: input.value, remember: overlay.querySelector('#admin-key-remember').checked }); };
    overlay.querySelector('#admin-key-cancel').onclick = () => done(null);
    overlay.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); done(null); }
      if (e.key === 'Tab') {
        const focusables = [...overlay.querySelectorAll('input,button')].filter(el => !el.disabled);
        const first = focusables[0], last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
    input.focus();
  });
  return activePrompt;
}
/** Local convenience only: Firebase rules must enforce actual admin authorization. */
export async function requireAdminKey() {
  const s = await getDoc(SEC_REF());
  if (!s.exists() || !s.data().adminKeyHash) {
    lockAdminKeySession();
    throw new Error('No secret key set. Open Settings → Security and set one first.');
  }
  const security = s.data();
  const recent = readRecent();
  if (recent && recent.hash !== security.adminKeyHash) forgetAdminKey();
  if (Date.now() < unlockedUntil && unlockedHash === security.adminKeyHash) return true;
  lockAdminKeySession();
  const entered = await askKey();
  if (entered === null) throw new Error('Cancelled. No balance was changed.');
  const hash = await sha256((security.adminKeySalt || '') + entered.key);
  if (hash !== security.adminKeyHash) throw new Error('Wrong secret key. Balance was NOT changed.');
  // Recheck after the dialog, in case the key was rotated on another device.
  const latest = await getDoc(SEC_REF());
  if (!latest.exists() || latest.data().adminKeyHash !== hash) throw new Error('Secret key changed. Please enter the current key.');
  if (entered.remember) {
    if (!saveRecent(entered.key, hash)) window.showToast?.('Unlocked, but browser storage is blocked. Recent key was not saved.', 'error');
  } else forgetAdminKey();
  unlockedHash = hash;
  unlockedUntil = Date.now() + UNLOCK_MS;
  return true;
}
