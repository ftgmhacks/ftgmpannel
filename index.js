import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, updateProfile, signOut
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6VSIGbUJqIMQb53k1mXAcGjNu9PFC1w0",
  authDomain: "new-smm02.firebaseapp.com",
  databaseURL: "https://new-smm02-default-rtdb.firebaseio.com",
  projectId: "new-smm02",
  storageBucket: "new-smm02.firebasestorage.app",
  messagingSenderId: "2203224901",
  appId: "1:2203224901:web:7b328bb0ea4c381afe0c2c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const SUPER_ADMIN_UID = "Q0NoYuEprlW6SvvOrv7lnx5kSeg1";

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '<i class="fa-solid fa-check"></i> ' : '<i class="fa-solid fa-xmark"></i> ';
  toast.innerHTML = icon + message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
window.showToast = showToast;

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

document.getElementById('show-register')?.addEventListener('click', () => {
  loginForm.classList.add('d-none');
  registerForm.classList.remove('d-none');
});
document.getElementById('show-login')?.addEventListener('click', () => {
  registerForm.classList.add('d-none');
  loginForm.classList.remove('d-none');
});

function busy(btn, spinner, state) {
  if (!btn) return;
  btn.disabled = state;
  btn.querySelector('.btn-text')?.classList.toggle('d-none', state);
  spinner?.classList.toggle('d-none', !state);
}

function resetAllButtons() {
  busy(document.getElementById('login-btn'), document.getElementById('login-spinner'), false);
  busy(document.getElementById('register-btn'), document.getElementById('register-spinner'), false);
}

async function loadSiteSettings() {
  try {
    const s = await getDoc(doc(db, 'settings', 'general'));
    if (!s.exists()) return;
    const data = s.data();
    const logo = document.getElementById('site-logo-header');
    if (logo && data.logoUrl) logo.src = data.logoUrl;
    const ch = document.getElementById('whatsapp-channel-btn');
    if (ch && data.channelUrl) ch.href = data.channelUrl;
  } catch (err) {
    console.warn('Settings load failed:', err);
  }
}

/**
 * Redirect target is decided ONLY from the auth UID (admin) or the
 * server-stored profile. A user can never promote themselves.
 */
async function routeUser(user) {
  if (user.uid === SUPER_ADMIN_UID) {
    window.location.replace('admin.html');
    return;
  }
  let data = null;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    data = snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('Profile read failed:', err);
  }
  if (data && data.status === 'banned') {
    await signOut(auth);
    resetAllButtons();
    showToast('This account has been suspended. Contact support.', 'error');
    return;
  }
  window.location.replace('dashboard.html');
}

let routing = false;
async function routeAuthenticatedOnce(user) {
  if (routing) return;
  routing = true;
  try {
    await routeUser(user);
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Login failed, please try again.', 'error');
    resetAllButtons();
    routing = false;
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) { resetAllButtons(); loadSiteSettings(); return; }
  await routeAuthenticatedOnce(user);
});

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn'), sp = document.getElementById('login-spinner');
  busy(btn, sp, true);
  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      document.getElementById('login-email').value.trim(),
      document.getElementById('login-password').value
    );
    showToast('Welcome back!');
    // Redirect directly as a fallback; the auth observer may have fired earlier.
    await routeAuthenticatedOnce(credential.user);
  } catch (err) {
    let msg = String(err.message || '').replace('Firebase:', '').trim();
    if (msg.includes('auth/invalid-credential')) msg = 'Invalid email or password';
    if (msg.includes('auth/user-not-found')) msg = 'User not found';
    if (msg.includes('auth/too-many-requests')) msg = 'Too many attempts. Try again later.';
    showToast(msg, 'error');
    busy(btn, sp, false);
  }
});

document.getElementById('admin-contact-trigger')?.addEventListener('click', () => {
  document.getElementById('contact-modal')?.classList.add('active');
});

registerForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = document.getElementById('register-password').value;
  if (pass.length < 8) return showToast('Password must be at least 8 characters.', 'error');
  if (pass !== document.getElementById('register-confirm').value) return showToast('Passwords do not match!', 'error');
  const btn = document.getElementById('register-btn'), sp = document.getElementById('register-spinner');
  busy(btn, sp, true);
  try {
    const email = document.getElementById('register-email').value.trim();
    const name = document.getElementById('register-name').value.trim();
    const username = document.getElementById('register-username').value.trim();
    if (!name) throw new Error('Please enter your full name');
    if (!/^[a-zA-Z0-9_.]{3,20}$/.test(username)) throw new Error('Username must be 3-20 letters, numbers, _ or .');
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: username });
    // wallet/role/status are fixed values — Firestore rules reject anything else.
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name,
      username,
      usernameLower: username.toLowerCase(),
      email,
      wallet: 0,
      role: 'user',
      status: 'active',
      createdAt: serverTimestamp()
    });
    showToast('Account created successfully!');
  } catch (err) {
    let msg = String(err.message || '').replace('Firebase:', '').trim();
    if (msg.includes('email-already-in-use')) msg = 'This email is already in use';
    showToast(msg, 'error');
    busy(btn, sp, false);
  }
});
