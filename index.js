import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile
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

function busy(btn, spinner, state) {
  if(btn) btn.disabled = state;
  if(btn && btn.querySelector('.btn-text')) btn.querySelector('.btn-text').classList.toggle('d-none', state);
  if(spinner) spinner.classList.toggle('d-none', !state);
}

async function loadSiteSettings() {
  try {
    const s = await getDoc(doc(db, 'settings', 'general'));
    if (s.exists()) {
      const data = s.data();
      // HTML میں موجود صحیح کلاس کو ٹارگٹ کیا گیا ہے
      const logoImg = document.querySelector('.hero-logo-img');
      if (data.logoUrl && logoImg) logoImg.src = data.logoUrl;
      
      const waBtn = document.getElementById('whatsapp-channel-btn');
      if (data.channelUrl && waBtn) waBtn.href = data.channelUrl;
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = (user.uid === SUPER_ADMIN_UID) ? 'admin.html' : 'dashboard.html';
  } else {
    loadSiteSettings();
  }
});

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn'), sp = document.getElementById('login-spinner');
    busy(btn, sp, true);
    try {
      await signInWithEmailAndPassword(auth, document.getElementById('login-email').value.trim(), document.getElementById('login-password').value);
      showToast('Welcome back!');
    } catch (err) {
      let msg = err.message.replace('Firebase:', '').trim();
      if (msg.includes('auth/invalid-credential')) msg = 'Invalid email or password';
      if (msg.includes('auth/user-not-found')) msg = 'User not found';
      showToast(msg, 'error');
      busy(btn, sp, false);
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = document.getElementById('register-password').value;
    if (pass !== document.getElementById('register-confirm').value) return showToast('Passwords do not match!', 'error');
    const btn = document.getElementById('register-btn'), sp = document.getElementById('register-spinner');
    busy(btn, sp, true);
    try {
      const email = document.getElementById('register-email').value.trim();
      const name = document.getElementById('register-name').value.trim();
      const username = document.getElementById('register-username').value.trim();
      if (!name) throw new Error('Please enter your full name');
      if (!username) throw new Error('Please choose a username');
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: username });
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid, name, username, usernameLower: username.toLowerCase(), email,
        wallet: 0, role: 'user', status: 'active', createdAt: serverTimestamp()
      });
      showToast('Account created successfully!');
    } catch (err) {
      let msg = err.message.replace('Firebase:', '').trim();
      if (msg.includes('email-already-in-use')) msg = 'This email is already in use';
      showToast(msg, 'error');
      busy(btn, sp, false);
    }
  });
}
