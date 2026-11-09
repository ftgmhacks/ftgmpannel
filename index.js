import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp as fsTS } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
  toast.innerHTML = (type === 'success' ? '<i class="fa-solid fa-check"></i> ' : '<i class="fa-solid fa-xmark"></i> ') + message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function getRedirectTarget(user) {
  if (user && user.uid === SUPER_ADMIN_UID) return 'admin.html';
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get('redirect');
  if (redirect && !redirect.startsWith('http') && !redirect.includes('login.html')) {
    return redirect;
  }
  return 'dashboard.html';
}

function showLoginTab() {
  document.getElementById('login-form')?.classList.remove('d-none');
  document.getElementById('register-form')?.classList.add('d-none');
}
function showRegisterTab() {
  document.getElementById('login-form')?.classList.add('d-none');
  document.getElementById('register-form')?.classList.remove('d-none');
}

document.getElementById('tab-login')?.addEventListener('click', showLoginTab);
document.getElementById('tab-login2')?.addEventListener('click', showLoginTab);
document.getElementById('tab-register')?.addEventListener('click', showRegisterTab);
document.getElementById('tab-register2')?.addEventListener('click', showRegisterTab);
document.getElementById('btn-new-user')?.addEventListener('click', showRegisterTab);

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.replace(getRedirectTarget(user));
  }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  const sp = document.getElementById('login-spinner');

  btn.disabled = true;
  btn.querySelector('.btn-text')?.classList.add('d-none');
  sp?.classList.remove('d-none');

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    showToast('Logged in successfully!');
    window.location.replace(getRedirectTarget(cred.user));
  } catch (err) {
    let msg = 'Invalid email or password.';
    if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
    showToast(msg, 'error');
    btn.disabled = false;
    btn.querySelector('.btn-text')?.classList.remove('d-none');
    sp?.classList.add('d-none');
  }
});

document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('register-name').value.trim();
  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const pass = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-confirm').value;

  if (pass !== confirm) {
    return showToast('Passwords do not match!', 'error');
  }

  const btn = document.getElementById('register-btn');
  const sp = document.getElementById('register-spinner');
  btn.disabled = true;
  btn.querySelector('.btn-text')?.classList.add('d-none');
  sp?.classList.remove('d-none');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: username || name });
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name: name,
      username: username || name,
      usernameLower: (username || name).toLowerCase(),
      email: email,
      wallet: 0,
      role: 'user',
      status: 'active',
      createdAt: fsTS()
    });
    showToast('Account created! Redirecting...');
    window.location.replace(getRedirectTarget(cred.user));
  } catch (err) {
    let msg = err.message || 'Registration failed.';
    if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered. Please login.';
    showToast(msg, 'error');
    btn.disabled = false;
    btn.querySelector('.btn-text')?.classList.remove('d-none');
    sp?.classList.add('d-none');
  }
});
