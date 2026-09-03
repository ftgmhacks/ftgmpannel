// PAK DIGITAL — Admin Secret Key gate.
// The key itself is NEVER stored in this app and NEVER shown in the panel.
// Firestore keeps only a salted SHA-256 hash at settings/security.
import { getFirestore, doc, getDoc, setDoc, serverTimestamp as fsTS } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";

// FIX: Lazily get Firestore instance so it doesn't execute before initializeApp in admin.html
const getDb = () => getFirestore(getApp());
const SEC_REF = () => doc(getDb(), 'settings', 'security');

const UNLOCK_MS = 10 * 60 * 1000; // re-ask every 10 minutes
let unlockedUntil = 0;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const randomSalt = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

export async function isKeyConfigured() {
  const s = await getDoc(SEC_REF());
  return s.exists() && !!s.data().adminKeyHash;
}

/** Save / change the secret key. Requires the old key once one exists. */
export async function setAdminKey(newKey, oldKey) {
  if (!newKey || newKey.length < 8) throw new Error('Secret key must be at least 8 characters.');
  const s = await getDoc(SEC_REF());
  if (s.exists() && s.data().adminKeyHash) {
    const ok = await sha256((s.data().adminKeySalt || '') + (oldKey || ''));
    if (ok !== s.data().adminKeyHash) throw new Error('Current secret key is wrong.');
  }
  const salt = randomSalt();
  await setDoc(SEC_REF(), {
    adminKeySalt: salt,
    adminKeyHash: await sha256(salt + newKey),
    updatedAt: fsTS()
  }, { merge: true });
  unlockedUntil = 0;
}

function askKey() {
  return new Promise((resolve) => {
    let ov = document.getElementById('admin-key-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'admin-key-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);backdrop-filter:blur(4px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:1rem';
      ov.innerHTML = `<form id="admin-key-form" style="background:#fff;border-radius:16px;max-width:380px;width:100%;padding:1.4rem;box-shadow:0 20px 50px rgba(0,0,0,.25)">
        <h3 style="margin:0 0 .4rem;font:800 1.05rem Inter,sans-serif">Secret Key Required</h3>
        <p style="margin:0 0 1rem;color:#64748b;font-size:.85rem">Enter the admin secret key to change a wallet balance.</p>
        <input id="admin-key-input" type="password" autocomplete="off" class="form-control" placeholder="Secret key" style="width:100%;padding:.7rem;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:.9rem">
        <div style="display:flex;gap:.6rem">
          <button type="submit" class="btn btn-primary" style="flex:1">Unlock</button>
          <button type="button" id="admin-key-cancel" class="btn btn-secondary" style="flex:1">Cancel</button>
        </div></form>`;
      document.body.appendChild(ov);
    }
    ov.style.display = 'flex';
    const input = ov.querySelector('#admin-key-input');
    input.value = '';
    setTimeout(() => input.focus(), 50);
    const done = (val) => { ov.style.display = 'none'; resolve(val); };
    ov.querySelector('#admin-key-form').onsubmit = (e) => { e.preventDefault(); done(input.value); };
    ov.querySelector('#admin-key-cancel').onclick = () => done(null);
  });
}

/** Throws unless the correct secret key is supplied. Call before ANY balance change. */
export async function requireAdminKey() {
  if (Date.now() < unlockedUntil) return true;
  const s = await getDoc(SEC_REF());
  if (!s.exists() || !s.data().adminKeyHash) {
    throw new Error('No secret key set. Open Settings → Security and set one first.');
  }
  const entered = await askKey();
  if (entered === null) throw new Error('Cancelled.');
  const hash = await sha256((s.data().adminKeySalt || '') + entered);
  if (hash !== s.data().adminKeyHash) throw new Error('Wrong secret key. Balance was NOT changed.');
  unlockedUntil = Date.now() + UNLOCK_MS;
  return true;
}
