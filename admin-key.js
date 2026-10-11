// PAK DIGITAL — Admin Secret Key gate.
// The key itself is NEVER stored in this app and NEVER shown in the panel.
// Firestore keeps only a salted SHA-256 hash at settings/security.
import { getFirestore, doc, getDoc, setDoc, serverTimestamp as fsTS } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";

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

export async function setAdminKey(newKey, oldKey) {
  if (!newKey || newKey.length < 8) throw new Error('Secret key must be at least 8 characters.');
  const s = await getDoc(SEC_REF());
  if (s.exists() && s.data().adminKeyHash) {
    const ok = await sha256((s.data().adminKeySalt || '') + (oldKey || ''));
    if (ok !== s.data().adminKeyHash) throw new Error('Current secret key is wrong.');
  }
  const salt = randomSalt();
  await setDoc(SEC_REF(), {
    adminKeySalt: salt, adminKeyHash: await sha256(salt + newKey), updatedAt: fsTS()
  }, { merge: true });
  unlockedUntil = 0;
  localStorage.setItem('pakDigitalAdminKey', newKey); // Auto-save new key
}

function askKey() {
  return new Promise((resolve) => {
    let ov = document.getElementById('admin-key-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'admin-key-overlay';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.7);backdrop-filter:blur(6px);z-index:5000;display:flex;align-items:center;justify-content:center;padding:1rem';
      document.body.appendChild(ov);
    }
    
    // Check if device remembers a previous valid key
    const savedKey = localStorage.getItem('pakDigitalAdminKey');
    const recentBtnHtml = savedKey ? `<button type="button" id="admin-key-recent" class="btn btn-success" style="width:100%; margin-top:0.6rem;"><i class="fa-solid fa-clock-rotate-left"></i> Use Recent Key</button>` : '';

    ov.innerHTML = `<form id="admin-key-form" style="background:#fff;border-radius:20px;max-width:380px;width:100%;padding:1.75rem;box-shadow:0 20px 50px rgba(0,0,0,.25)">
      <h3 style="margin:0 0 .4rem;font:800 1.2rem Inter,sans-serif;color:#061f10">Security Check</h3>
      <p style="margin:0 0 1.25rem;color:#64748b;font-size:.85rem">Enter the admin secret key to proceed securely.</p>
      <input id="admin-key-input" type="password" autocomplete="off" class="form-control" placeholder="Secret key" style="width:100%;padding:.8rem;border:1.5px solid #e2e8f0;border-radius:12px;margin-bottom:1rem;font-size:0.95rem;">
      <div style="display:flex;gap:.6rem">
        <button type="submit" class="btn btn-primary" style="flex:1">Unlock</button>
        <button type="button" id="admin-key-cancel" class="btn btn-secondary" style="flex:1">Cancel</button>
      </div>
      ${recentBtnHtml}
      </form>`;
      
    ov.style.display = 'flex';
    const input = ov.querySelector('#admin-key-input');
    input.value = '';
    setTimeout(() => input.focus(), 50);
    
    const done = (val) => { ov.style.display = 'none'; resolve(val); };
    ov.querySelector('#admin-key-form').onsubmit = (e) => { e.preventDefault(); done(input.value); };
    ov.querySelector('#admin-key-cancel').onclick = () => done(null);
    if (savedKey) ov.querySelector('#admin-key-recent').onclick = () => done(savedKey);
  });
}

export async function requireAdminKey() {
  if (Date.now() < unlockedUntil) return true;
  const s = await getDoc(SEC_REF());
  if (!s.exists() || !s.data().adminKeyHash) throw new Error('No secret key set. Open Settings → Security and set one first.');
  
  const entered = await askKey();
  if (entered === null) throw new Error('Cancelled.');
  
  const hash = await sha256((s.data().adminKeySalt || '') + entered);
  if (hash !== s.data().adminKeyHash) {
    localStorage.removeItem('pakDigitalAdminKey'); // clear bad memory
    throw new Error('Wrong secret key. Action was cancelled.');
  }
  
  localStorage.setItem('pakDigitalAdminKey', entered); // Save for quick access
  unlockedUntil = Date.now() + UNLOCK_MS;
  return true;
}