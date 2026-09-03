import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, getDocs, query, where, doc, getDoc, setDoc, runTransaction, serverTimestamp as fsTS } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD6VSIGbUJqIMQb53k1mXAcGjNu9PFC1w0",
  authDomain: "new-smm02.firebaseapp.com",
  databaseURL: "https://new-smm02-default-rtdb.firebaseio.com",
  projectId: "new-smm02",
  storageBucket: "new-smm02.firebasestorage.app",
  messagingSenderId: "2203224901",
  appId: "1:2203224901:web:7b328bb0ea4c381afe0c2c"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SUPER_ADMIN_UID = "Q0NoYuEprlW6SvvOrv7lnx5kSeg1";
const DEFAULT_WHATSAPP = 'https://wa.me/923104882921';

export const MANUAL_TYPES = {
  nadra: { label: 'NADRA Services', unit: 'Piece', collection: 'manualServices' },
  fake_numbers: { label: 'WhatsApp Fake Numbers', unit: 'Number', collection: 'manualServices' },
  ai_subscription: { label: 'AI Subscriptions', unit: 'Subscription', collection: 'manualServices' }
};

let currentUser = null;
let currentUserData = {};
let siteSettings = {};
let manualServices = [];
let isSubmitting = false;

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
window.showToast = window.showToast || showToast;

const money = (n) => 'Rs. ' + (parseFloat(n || 0)).toFixed(2);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => (name || 'U').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

export function displayNameOf(data, email) {
  const d = data || {};
  const value = (d.username || d.name || '').toString().trim();
  if (value && value.toLowerCase() !== 'user') return value;
  const mail = (d.email || email || '').toString().trim();
  if (mail.includes('@')) return mail.split('@')[0];
  return mail || 'User';
}
window.displayNameOf = displayNameOf;

function whatsappLink() {
  const url = (siteSettings.footerContact || '').trim();
  return /^https?:\/\//i.test(url) ? url : DEFAULT_WHATSAPP;
}

function initLayout() {
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  let backdrop = document.querySelector('.sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    document.body.appendChild(backdrop);
  }
  const close = () => { sidebar.classList.remove('active'); backdrop.classList.remove('active'); };
  btn?.addEventListener('click', (e) => {
    e.stopPropagation();
    sidebar.classList.toggle('active');
    backdrop.classList.toggle('active', sidebar.classList.contains('active'));
  });
  backdrop.addEventListener('click', close);
}

async function loadCommonData() {
  const [snap, s] = await Promise.all([
    currentUser ? getDoc(doc(db, 'users', currentUser.uid)) : Promise.resolve(null),
    getDoc(doc(db, 'settings', 'general'))
  ]);
  if (snap && snap.exists()) {
    currentUserData = snap.data();
    const shown = displayNameOf(currentUserData, currentUser.email);
    const w = document.getElementById('header-wallet-balance');
    const n = document.getElementById('user-name-display');
    const a = document.getElementById('user-avatar');
    if (w) w.textContent = money(currentUserData.wallet);
    if (n) n.textContent = shown;
    if (a) a.textContent = initials(shown);
  }
  if (s.exists()) {
    siteSettings = s.data();
    const logo = document.getElementById('site-logo-header');
    if (logo && siteSettings.logoUrl) logo.src = siteSettings.logoUrl;
  }
  document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = 'index.html';
  });
}

function guardUserPage(onReady) {
  let handled = false;
  onAuthStateChanged(auth, async (user) => {
    if (handled) return;
    handled = true;
    if (!user) { window.location.replace('index.html'); return; }
    currentUser = user;
    try {
      const userRef = doc(db, 'users', user.uid);
      let snap = await getDoc(userRef);
      if (!snap.exists()) {
        // Never trust the client for money/role fields: always created at zero.
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName || displayNameOf({}, user.email),
          username: user.displayName || displayNameOf({}, user.email),
          email: user.email,
          wallet: 0,
          role: 'user',
          status: 'active',
          createdAt: fsTS()
        });
        snap = await getDoc(userRef);
      }
      if (snap.exists() && snap.data().status === 'banned') {
        await signOut(auth);
        window.location.replace('index.html');
        return;
      }
      await loadCommonData();
      initLayout();
    } catch (err) {
      console.error('Startup error:', err);
      showToast(err.message || 'Failed to load your account.', 'error');
    } finally {
      // ALWAYS clear the loader, otherwise the page hangs on "Logging in..."
      const l = document.getElementById('page-loader');
      if (l) l.remove();
      document.body.classList.remove('loading');
    }
    try { await onReady(); } catch (err) { console.error(err); showToast(err.message, 'error'); }
    initBroadcast();
  });
}

function broadcastStyles() {
  if (document.getElementById('broadcast-styles')) return;
  const style = document.createElement('style');
  style.id = 'broadcast-styles';
  style.textContent = `
.bc-overlay { position: fixed; inset: 0; background: rgba(6, 31, 16, 0.55); backdrop-filter: blur(5px); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.bc-box { background: #fff; border-radius: 18px; width: 100%; max-width: 430px; overflow: hidden; box-shadow: 0 24px 60px -20px rgba(6, 31, 16, 0.45); animation: bcPop 0.25s ease; }
@keyframes bcPop { from { opacity: 0; transform: translateY(14px) scale(0.98); } to { opacity: 1; transform: none; } }
.bc-head { background: linear-gradient(135deg, #0bc15c 0%, #0dbfa1 100%); color: #fff; padding: 1.15rem 1.3rem; display: flex; align-items: center; gap: 0.7rem; }
.bc-head i { font-size: 1.15rem; }
.bc-head h3 { font-family: 'Inter', system-ui, sans-serif; font-size: 1.05rem; font-weight: 800; margin: 0; line-height: 1.4; word-break: break-word; }
.bc-body { padding: 1.4rem 1.3rem; }
.bc-msg { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif; direction: rtl; text-align: right; font-size: 1.05rem; line-height: 2.5; color: #0d2115; white-space: pre-line; word-break: break-word; max-height: 46vh; overflow-y: auto; }
.bc-actions { display: flex; flex-wrap: wrap; gap: 0.6rem; padding: 0 1.3rem 1.3rem; }
.bc-btn { flex: 1 1 130px; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.8rem 1.1rem; border-radius: 10px; font-family: 'Inter', system-ui, sans-serif; font-weight: 700; font-size: 0.9rem; border: none; cursor: pointer; text-decoration: none; }
.bc-btn-action { background: linear-gradient(135deg, #0bc15c 0%, #0dbfa1 100%); color: #fff; }
.bc-btn-close { background: #eaf3ee; color: #0d2115; border: 1px solid #d7e5dd; }
@media (max-width: 480px) { .bc-msg { font-size: 0.98rem; line-height: 2.3; } }`;
  document.head.appendChild(style);
}

async function initBroadcast() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'broadcast'));
    if (!snap.exists()) return;
    const b = snap.data();
    if (!b.active) return;
    if (!String(b.title || '').trim() && !String(b.message || '').trim()) return;

    const stampValue = b.updatedAt && b.updatedAt.toMillis ? b.updatedAt.toMillis() : (b.version || 0);
    const key = 'pd-broadcast-' + stampValue;
    if (localStorage.getItem(key) === 'seen') return;

    broadcastStyles();
    const overlay = document.createElement('div');
    overlay.className = 'bc-overlay';

    const actionUrl = String(b.actionUrl || '').trim();
    const actionLabel = String(b.actionLabel || '').trim() || 'Open Link';
    const actionHtml = actionUrl
      ? `<a class="bc-btn bc-btn-action" href="${esc(actionUrl)}" target="_blank" rel="noopener"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${esc(actionLabel)}</a>`
      : '';

    overlay.innerHTML = `
      <div class="bc-box" role="dialog" aria-modal="true">
        <div class="bc-head"><i class="fa-solid fa-bullhorn"></i><h3>${esc(b.title || 'Announcement')}</h3></div>
        <div class="bc-body"><div class="bc-msg">${esc(b.message || '')}</div></div>
        <div class="bc-actions">
          ${actionHtml}
          <button type="button" class="bc-btn bc-btn-close" id="bc-close-btn"><i class="fa-solid fa-xmark"></i> Close</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#bc-close-btn').addEventListener('click', () => {
      localStorage.setItem(key, 'seen');
      overlay.remove();
    });
  } catch (err) {
    console.error('Broadcast load failed', err);
  }
}

function calcTotal() {
  const sel = document.getElementById('ms-service');
  const qtyInput = document.getElementById('ms-qty');
  const totalOutput = document.getElementById('ms-total');
  if (!sel || !qtyInput || !totalOutput) return 0;
  const svc = manualServices.find(x => x.id === sel.value);
  const qty = parseInt(qtyInput.value) || 0;
  const total = svc && qty > 0 ? parseFloat(svc.price || 0) * qty : 0;
  totalOutput.textContent = money(total);
  return total;
}

function renderServiceDetails() {
  const sel = document.getElementById('ms-service');
  const svc = manualServices.find(x => x.id === sel.value);
  const card = document.getElementById('ms-details-card');
  if (!svc) { card.classList.add('d-none'); document.getElementById('ms-submit').disabled = true; calcTotal(); return; }
  document.getElementById('ms-price-per').textContent = money(svc.price);
  document.getElementById('ms-desc').textContent = svc.description || 'No extra details provided for this service.';
  card.classList.remove('d-none');
  document.getElementById('ms-submit').disabled = false;
  calcTotal();
}

async function submitManualOrder(e, type) {
  e.preventDefault();
  if (isSubmitting) return;

  const svc = manualServices.find(x => x.id === document.getElementById('ms-service').value);
  const qty = parseInt(document.getElementById('ms-qty').value);
  const details = document.getElementById('ms-details').value.trim();

  if (!svc) return showToast('Please select a service.', 'error');
  if (!qty || qty < 1) return showToast('Quantity must be at least 1.', 'error');
  if (!details) return showToast('Please provide the required details.', 'error');

  const unitPrice = parseFloat(svc.price || 0);
  const total = unitPrice * qty;
  if (total <= 0) return showToast('This service is not priced correctly. Please contact admin.', 'error');

  const btn = document.getElementById('ms-submit');
  const sp = document.getElementById('ms-spinner');
  isSubmitting = true;
  btn.disabled = true;
  btn.querySelector('.btn-text').classList.add('d-none');
  sp.classList.remove('d-none');

  const orderId = 'ORD-' + Math.floor(Math.random() * 100000000);

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const orderRef = doc(collection(db, 'orders'));
    const trxRef = doc(collection(db, 'walletTransactions'));

    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error('User profile not found. Please re-login.');
      const balance = parseFloat(uSnap.data().wallet || 0);
      if (balance < total) throw new Error('Insufficient balance. Please add funds to your wallet.');

      tx.update(userRef, { wallet: balance - total });
      tx.set(orderRef, {
        orderId,
        orderType: type,
        apiOrderId: null,
        userId: currentUser.uid,
        userEmail: currentUser.email,
        userName: displayNameOf(uSnap.data(), currentUser.email),
        serviceId: svc.id,
        serviceName: svc.name,
        unitPrice,
        quantity: qty,
        price: total,
        targetLink: details,
        status: 'Pending',
        createdAt: fsTS(),
        updatedAt: fsTS()
      });
      tx.set(trxRef, {
        transactionId: 'TRX-' + Math.floor(Math.random() * 100000000),
        userId: currentUser.uid,
        type: 'order',
        amount: -total,
        description: 'Order placed: ' + orderId,
        createdAt: fsTS()
      });
    });

    showToast('Order placed successfully!');
    e.target.reset();
    document.getElementById('ms-details-card').classList.add('d-none');
    document.getElementById('ms-total').textContent = 'Rs. 0.00';
    document.getElementById('ms-submit').disabled = true;

    const success = document.getElementById('ms-success');
    document.getElementById('ms-success-id').textContent = orderId;
    document.getElementById('ms-wa-btn').href = whatsappLink();
    success.classList.remove('d-none');
    success.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await loadCommonData();
    document.getElementById('hero-wallet').textContent = money(currentUserData.wallet);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    isSubmitting = false;
    btn.disabled = false;
    btn.querySelector('.btn-text').classList.remove('d-none');
    sp.classList.add('d-none');
  }
}

function startManualServicePage(type) {
  guardUserPage(async () => {
    const sel = document.getElementById('ms-service');
    const form = document.getElementById('ms-form');
    const qtyInput = document.getElementById('ms-qty');
    if (!sel || !form || !qtyInput) throw new Error('This service page is missing required form fields.');
    const heroWallet = document.getElementById('hero-wallet');
    const whatsappButton = document.getElementById('ms-wa-btn');
    if (heroWallet) heroWallet.textContent = money(currentUserData.wallet);
    if (whatsappButton) whatsappButton.href = whatsappLink();
    const snap = await getDocs(query(
      collection(db, 'manualServices'),
      where('type', '==', type),
      where('status', '==', 'active')
    ));

    manualServices = [];
    snap.forEach(d => manualServices.push({ id: d.id, ...d.data() }));
    manualServices.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    sel.innerHTML = '<option value="" disabled selected>Select a service...</option>';
    manualServices.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = `${s.name} — ${money(s.price)} / ${MANUAL_TYPES[type].unit}`;
      sel.appendChild(o);
    });

    if (!manualServices.length) {
      sel.innerHTML = '<option value="" disabled selected>No services available yet</option>';
      showToast('No services published yet. Please check back soon.', 'error');
    }

    sel.addEventListener('change', renderServiceDetails);
    qtyInput.addEventListener('input', calcTotal);
    form.addEventListener('submit', (e) => submitManualOrder(e, type));
  });
}

const pageType = document.body.dataset.serviceType || '';
if (pageType && MANUAL_TYPES[pageType]) {
  startManualServicePage(pageType);
} else {
  onAuthStateChanged(auth, (user) => {
    if (user) initBroadcast();
  });
}
