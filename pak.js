import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, setDoc, serverTimestamp as fsTS } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
let currentUser = null;
let currentUserData = {};
let siteSettings = {};

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

const SMM_PROXY = 'https://project--0158a941-e1aa-495e-8f88-9b83a66f9bbe.lovable.app/api/public/smm';
async function smmApi(params) {
  const res = await fetch(SMM_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('Invalid provider response'); }
  if (data && data.error) throw new Error(data.error);
  return data;
}
window.smmApi = smmApi;

async function syncOrderStatus(orderDocId, apiOrderId, API_URL, API_KEY) {
  if (!apiOrderId || !API_URL || !API_KEY) return;
  try {
    const apiData = await smmApi({ url: API_URL, key: API_KEY, action: 'status', order: apiOrderId });
    if (apiData && apiData.status) {
      let localStatus = apiData.status;
      if (localStatus === 'In progress') localStatus = 'In Progress';
      const orderRef = doc(db, 'orders', orderDocId);
      await updateDoc(orderRef, { 
        status: localStatus,
        start_count: apiData.start_count || 0,
        remains: apiData.remains || 0,
        updatedAt: fsTS()
      });
      return localStatus;
    }
  } catch (err) {
    console.error('Status sync failed for', apiOrderId, err);
  }
}
window.syncOrderStatus = syncOrderStatus;

const money = (n) => 'Rs. ' + (parseFloat(n || 0)).toFixed(2);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
window.copyClipboard = (text) => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Link copied! 📋');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Link copied! 📋');
  });
};
const initials = (name) => (name || 'U').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

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
    const w = document.getElementById('header-wallet-balance');
    const n = document.getElementById('user-name-display');
    const a = document.getElementById('user-avatar');
    if (w) w.textContent = money(currentUserData.wallet);
    if (n) n.textContent = currentUserData.name || 'User';
    if (a) a.textContent = initials(currentUserData.name || currentUser.email);
  }
  if (s.exists()) {
    siteSettings = s.data();
    if (siteSettings.logoUrl) document.getElementById('site-logo-header').src = siteSettings.logoUrl;
    if (siteSettings.dashboardVideo) {
      document.getElementById('dashboard-video-frame').src = siteSettings.dashboardVideo;
      document.getElementById('dashboard-video-container').style.display = 'block';
    }
  }

  document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault(); await signOut(auth); window.location.href = 'index.html';
  });
}

function guardUserPage(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = 'index.html'; return; }
    currentUser = user;
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid, name: user.displayName || 'User', email: user.email,
        wallet: 0, role: user.uid === SUPER_ADMIN_UID ? 'admin' : 'user',
        status: 'active', createdAt: fsTS()
      });
    }
    await loadCommonData();
    initLayout();
    document.getElementById('page-loader')?.remove();
    try { await onReady(); } catch (err) { console.error(err); showToast(err.message, 'error'); }
  });
}

let availableServices = [];

guardUserPage(async () => {
  document.getElementById('hero-wallet').textContent = money(currentUserData.wallet);

  const catSelect = document.getElementById('order-category');
  const catOptions = document.getElementById('cat-options');
  const catTrigger = document.getElementById('cat-trigger');
  const srvSelect = document.getElementById('order-service');
  const srvOptions = document.getElementById('srv-options');
  const srvTrigger = document.getElementById('srv-trigger');

  function toggleDropdown(options) {
    document.querySelectorAll('.custom-select-options').forEach(el => {
      if (el !== options) el.classList.remove('show');
    });
    options.classList.toggle('show');
  }

  window.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrap')) {
      document.querySelectorAll('.custom-select-options').forEach(el => el.classList.remove('show'));
    }
  });

  catTrigger.addEventListener('click', () => toggleDropdown(catOptions));
  srvTrigger.addEventListener('click', () => {
    if (catSelect.value) toggleDropdown(srvOptions);
  });

  const getIconColor = (iconClass) => {
    if (iconClass.includes('instagram')) return '#e1306c';
    if (iconClass.includes('facebook')) return '#1877f2';
    if (iconClass.includes('youtube')) return '#ff0000';
    if (iconClass.includes('tiktok')) return '#000000';
    if (iconClass.includes('telegram')) return '#0088cc';
    if (iconClass.includes('twitter')) return '#1da1f2';
    return 'var(--primary)';
  };

  const [catSnap, srvSnap] = await Promise.all([
    getDocs(query(collection(db, 'categories'), where('status', '==', 'active'))),
    getDocs(query(collection(db, 'services'), where('status', '==', 'active')))
  ]);
  const categoriesList = [];
  catSnap.forEach(d => categoriesList.push({ id: d.id, ...d.data() }));
  categoriesList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  categoriesList.forEach(c => {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.name;
    catSelect.appendChild(o);

    const div = document.createElement('div');
    div.className = 'custom-option';
    const iconColor = getIconColor(c.icon || '');
    div.innerHTML = `<i class="${c.icon || 'fa-solid fa-layer-group'}" style="color:${iconColor}"></i> <span>${c.name}</span>`;
    div.addEventListener('click', () => {
      catSelect.value = c.id;
      catTrigger.querySelector('span').innerHTML = div.innerHTML;
      catOptions.classList.remove('show');
      catSelect.dispatchEvent(new Event('change'));
    });
    catOptions.appendChild(div);
  });
  
  if (!categoriesList.length) showToast('No categories available yet.', 'error');

  srvSnap.forEach(d => availableServices.push({ id: d.id, ...d.data() }));
  availableServices.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  catSelect.addEventListener('change', () => {
    srvSelect.innerHTML = '<option value="" disabled selected>Select a service...</option>';
    srvOptions.innerHTML = '';
    srvTrigger.querySelector('span').textContent = 'Select a service...';
    
    availableServices.filter(s => s.category === catSelect.value).forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      srvSelect.appendChild(o);

      const div = document.createElement('div');
      div.className = 'custom-option';
      const iconColor = getIconColor(s.icon || '');
      div.innerHTML = `<i class="${s.icon || 'fa-solid fa-circle-check'}" style="color:${iconColor}"></i> <span>${s.name}</span>`;
      div.addEventListener('click', () => {
        srvSelect.value = s.id;
        srvTrigger.querySelector('span').innerHTML = div.innerHTML;
        srvOptions.classList.remove('show');
        srvSelect.dispatchEvent(new Event('change'));
      });
      srvOptions.appendChild(div);
    });
    document.getElementById('service-details-card').classList.add('d-none');
    document.getElementById('submit-order-btn').disabled = true;
    calcTotal();
  });

  srvSelect.addEventListener('change', () => {
    const s = availableServices.find(x => x.id === srvSelect.value);
    if (!s) return;
    document.getElementById('service-details-card').classList.remove('d-none');
    document.getElementById('service-description').textContent = s.description || '';
    document.getElementById('service-min-max').textContent = `${s.minQty} / ${s.maxQty}`;
    document.getElementById('service-price-display').textContent = money(s.price);
    document.getElementById('service-time-display').textContent = s.estimatedTime || '—';
    document.getElementById('submit-order-btn').disabled = false;
    calcTotal();
  });

  document.getElementById('order-quantity').addEventListener('input', calcTotal);
  document.getElementById('new-order-form').addEventListener('submit', placeOrder);
});

function calcTotal() {
  const s = availableServices.find(x => x.id === document.getElementById('order-service').value);
  const qty = parseInt(document.getElementById('order-quantity').value) || 0;
  document.getElementById('order-total-charge').textContent =
    (s && qty > 0) ? money((s.price / 1000) * qty) : 'Rs. 0.00';
}

async function placeOrder(e) {
  e.preventDefault();
  const srv = availableServices.find(x => x.id === document.getElementById('order-service').value);
  const link = document.getElementById('order-link').value.trim();
  const qty = parseInt(document.getElementById('order-quantity').value);
  if (!srv) return showToast('Please select a service.', 'error');
  if (qty < srv.minQty || qty > srv.maxQty)
    return showToast(`Quantity must be between ${srv.minQty} and ${srv.maxQty}.`, 'error');

  const total = (srv.price / 1000) * qty;
  const btn = document.getElementById('submit-order-btn'), sp = document.getElementById('order-spinner');
  btn.disabled = true; btn.querySelector('.btn-text').classList.add('d-none'); sp.classList.remove('d-none');

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    const wallet = parseFloat((await getDoc(userRef)).data().wallet || 0);
    if (wallet < total) throw new Error('Insufficient balance. Please add funds to your wallet.');

    const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    const API_URL = settings.apiUrl || '';
    const API_KEY = settings.apiKey || '';

    let apiOrderId = null;
    let apiError = null;

    if (srv.externalId) {
      if (!API_URL || !API_KEY) {
        throw new Error('System API configuration is not set. Please contact admin.');
      }
      try {
        const apiData = await smmApi({
          url: API_URL, key: API_KEY, action: 'add',
          service: srv.externalId, link: link, quantity: qty
        });
        
        if (apiData.order) {
          apiOrderId = apiData.order;
        } else if (apiData.error) {
          throw new Error('API Error: ' + apiData.error);
        }
      } catch (err) {
        console.error('API Automation Failure:', err);
        apiError = err.message;
        throw new Error('Automated ordering failed: ' + err.message);
      }
    }

    await updateDoc(userRef, { wallet: wallet - total });
    const orderId = 'ORD-' + Math.floor(Math.random() * 100000000);
    await addDoc(collection(db, 'orders'), {
      orderId, 
      apiOrderId: apiOrderId || null,
      userId: currentUser.uid, 
      userEmail: currentUser.email,
      serviceId: srv.id, 
      serviceName: srv.name, 
      category: srv.category,
      targetLink: link, 
      quantity: qty, 
      price: total, 
      status: apiOrderId ? 'Pending' : 'Pending (Manual)',
      apiError: apiError || null,
      createdAt: fsTS(), 
      updatedAt: fsTS()
    });
    await addDoc(collection(db, 'walletTransactions'), {
      transactionId: 'TRX-' + Math.floor(Math.random() * 100000000),
      userId: currentUser.uid, type: 'order', amount: -total,
      description: 'Order placed: ' + orderId, createdAt: fsTS()
    });

    showToast('Order placed successfully!');
    e.target.reset();
    document.getElementById('service-details-card').classList.add('d-none');
    document.getElementById('order-total-charge').textContent = 'Rs. 0.00';
    
    const successAlert = document.getElementById('order-success-alert');
    successAlert.classList.remove('d-none');
    setTimeout(() => {
      successAlert.classList.add('d-none');
    }, 10000);

    await loadCommonData();
    document.getElementById('hero-wallet').textContent = money(currentUserData.wallet);
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.querySelector('.btn-text').classList.remove('d-none'); sp.classList.add('d-none');
  }
}