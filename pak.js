import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, setDoc, runTransaction, serverTimestamp as fsTS } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
const SMM_PROXY = 'https://project--0158a941-e1aa-495e-8f88-9b83a66f9bbe.lovable.app/api/public/smm';

let currentUser = null;
let currentUserData = { wallet: 0 };
let categories = [];
let services = [];
let selectedService = null;
let siteSettings = {};

const money = (n) => 'Rs. ' + (parseFloat(n || 0)).toFixed(2);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initials = (name) => (name || 'G').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();

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

  // Intercept auth-protected links for guests
  document.querySelectorAll('[data-requires-auth="true"]').forEach(link => {
    link.addEventListener('click', (e) => {
      if (!currentUser) {
        e.preventDefault();
        const targetHref = link.getAttribute('href') || 'dashboard.html';
        showToast('Please login first to continue.', 'error');
        setTimeout(() => {
          window.location.href = `login.html?redirect=${encodeURIComponent(targetHref)}`;
        }, 500);
      }
    });
  });
}

async function loadCatalogAndSettings() {
  try {
    const [cSnap, sSnap, setSnap] = await Promise.all([
      getDocs(query(collection(db, 'categories'), where('status', '==', 'active'))),
      getDocs(query(collection(db, 'services'), where('status', '==', 'active'))),
      getDoc(doc(db, 'settings', 'general'))
    ]);

    categories = [];
    cSnap.forEach(d => categories.push({ id: d.id, ...d.data() }));
    categories.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    services = [];
    sSnap.forEach(d => services.push({ id: d.id, ...d.data() }));
    services.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    if (setSnap.exists()) {
      siteSettings = setSnap.data();
      if (siteSettings.logoUrl) {
        const logoEl = document.getElementById('site-logo-header');
        if (logoEl) logoEl.src = siteSettings.logoUrl;
      }
      if (siteSettings.dashboardVideo) {
        const vc = document.getElementById('dashboard-video-container');
        const vf = document.getElementById('dashboard-video-frame');
        if (vc && vf) {
          vf.src = siteSettings.dashboardVideo;
          vc.style.display = 'flex';
        }
      }
    }

    renderCategoriesDropdown();
  } catch (err) {
    console.error('Catalog load error:', err);
  }
}

function renderCategoriesDropdown() {
  const catOptions = document.getElementById('cat-options');
  const catTrigger = document.getElementById('cat-trigger');
  const catSelect = document.getElementById('order-category');
  if (!catOptions || !catTrigger) return;

  catOptions.innerHTML = '';
  catSelect.innerHTML = '<option value="" disabled selected>Select a category...</option>';

  categories.forEach(c => {
    const icon = c.icon || 'fa-solid fa-layer-group';
    const div = document.createElement('div');
    div.className = 'custom-option';
    div.innerHTML = `<i class="${esc(icon)}" style="color:var(--primary)"></i> <span>${esc(c.name)}</span>`;
    div.addEventListener('click', () => {
      catTrigger.innerHTML = `<span style="display:flex;align-items:center;gap:0.6rem;"><i class="${esc(icon)}" style="color:var(--primary)"></i> ${esc(c.name)}</span> <i class="fa-solid fa-chevron-down"></i>`;
      catSelect.value = c.id;
      catOptions.classList.remove('show');
      renderServicesForCategory(c.id);
    });
    catOptions.appendChild(div);

    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    catSelect.appendChild(opt);
  });

  catTrigger.onclick = (e) => {
    e.stopPropagation();
    catOptions.classList.toggle('show');
    document.getElementById('srv-options')?.classList.remove('show');
  };
}

function renderServicesForCategory(catId) {
  const srvOptions = document.getElementById('srv-options');
  const srvTrigger = document.getElementById('srv-trigger');
  const srvSelect = document.getElementById('order-service');
  if (!srvOptions || !srvTrigger) return;

  const list = services.filter(s => s.category === catId);
  srvOptions.innerHTML = '';
  srvSelect.innerHTML = '<option value="" disabled selected>Select a service...</option>';
  selectedService = null;
  document.getElementById('service-details-card')?.classList.add('d-none');
  document.getElementById('submit-order-btn').disabled = true;

  if (!list.length) {
    srvTrigger.innerHTML = `<span>No services in this category</span> <i class="fa-solid fa-chevron-down"></i>`;
    return;
  }

  srvTrigger.innerHTML = `<span>Select a service...</span> <i class="fa-solid fa-chevron-down"></i>`;

  list.forEach(s => {
    const icon = s.icon || 'fa-solid fa-circle-check';
    const div = document.createElement('div');
    div.className = 'custom-option';
    div.innerHTML = `<i class="${esc(icon)}" style="color:var(--primary)"></i> <div style="flex:1"><div style="font-weight:700">${esc(s.name)}</div><div style="font-size:0.78rem;color:var(--primary-dark);font-weight:700">${money(s.price)} per 1000</div></div>`;
    div.addEventListener('click', () => {
      srvTrigger.innerHTML = `<span style="display:flex;align-items:center;gap:0.6rem;"><i class="${esc(icon)}" style="color:var(--primary)"></i> ${esc(s.name)} — ${money(s.price)}</span> <i class="fa-solid fa-chevron-down"></i>`;
      srvSelect.value = s.id;
      srvOptions.classList.remove('show');
      selectService(s);
    });
    srvOptions.appendChild(div);

    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    srvSelect.appendChild(opt);
  });

  srvTrigger.onclick = (e) => {
    e.stopPropagation();
    srvOptions.classList.toggle('show');
    document.getElementById('cat-options')?.classList.remove('show');
  };
}

document.addEventListener('click', () => {
  document.getElementById('cat-options')?.classList.remove('show');
  document.getElementById('srv-options')?.classList.remove('show');
});

function selectService(s) {
  selectedService = s;
  document.getElementById('service-price-display').textContent = money(s.price);
  document.getElementById('service-min-max').textContent = `${s.minQty || 1} / ${s.maxQty || 100000}`;
  document.getElementById('service-time-display').textContent = s.estimatedTime || 'Instant';
  const descEl = document.getElementById('service-description');
  if (descEl) {
    descEl.textContent = s.description || 'High quality automated service.';
    descEl.classList.toggle('d-none', !s.description);
  }
  document.getElementById('service-details-card')?.classList.remove('d-none');

  const qtyInput = document.getElementById('order-quantity');
  if (qtyInput) {
    qtyInput.min = s.minQty || 1;
    qtyInput.max = s.maxQty || 1000000;
    if (!qtyInput.value) qtyInput.value = s.minQty || 100;
  }
  recalculateTotal();
}

function recalculateTotal() {
  const qty = parseInt(document.getElementById('order-quantity')?.value || 0);
  const btn = document.getElementById('submit-order-btn');
  if (!selectedService || !qty || qty <= 0) {
    document.getElementById('order-total-charge').textContent = money(0);
    if (btn) btn.disabled = true;
    return;
  }
  const total = (qty / 1000) * parseFloat(selectedService.price || 0);
  document.getElementById('order-total-charge').textContent = money(total);
  if (btn) btn.disabled = false;
}

document.getElementById('order-quantity')?.addEventListener('input', recalculateTotal);

// Submit Order Handler (Prompts Login if Guest)
document.getElementById('new-order-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!currentUser) {
    showToast('Please login or create an account to place your order.', 'error');
    setTimeout(() => {
      window.location.href = 'login.html?redirect=dashboard.html';
    }, 600);
    return;
  }

  if (!selectedService) return showToast('Please select a service.', 'error');
  const link = document.getElementById('order-link').value.trim();
  const qty = parseInt(document.getElementById('order-quantity').value);

  if (qty < (selectedService.minQty || 1) || qty > (selectedService.maxQty || 10000000)) {
    return showToast(`Quantity must be between ${selectedService.minQty} and ${selectedService.maxQty}.`, 'error');
  }

  const totalCharge = parseFloat(((qty / 1000) * parseFloat(selectedService.price || 0)).toFixed(2));
  const btn = document.getElementById('submit-order-btn');
  const sp = document.getElementById('order-spinner');

  btn.disabled = true;
  btn.querySelector('.btn-text')?.classList.add('d-none');
  sp?.classList.remove('d-none');

  try {
    const userRef = doc(db, 'users', currentUser.uid);

    // Atomic wallet deduction
    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error('User profile not found.');
      const curBal = parseFloat(uSnap.data().wallet || 0);
      if (curBal < totalCharge) {
        throw new Error(`Insufficient balance (${money(curBal)}). Please add funds first.`);
      }
      tx.update(userRef, { wallet: parseFloat((curBal - totalCharge).toFixed(2)) });
    });

    // Place provider API order if externalId is configured
    let apiOrderId = '';
    if (selectedService.externalId && siteSettings.apiUrl && siteSettings.apiKey) {
      try {
        const res = await fetch(SMM_PROXY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: siteSettings.apiUrl,
            key: siteSettings.apiKey,
            action: 'add',
            service: selectedService.externalId,
            link: link,
            quantity: qty
          })
        });
        const data = await res.json();
        if (data && data.order) apiOrderId = String(data.order);
      } catch (apiErr) {
        console.warn('Provider API call fallback to manual queue:', apiErr);
      }
    }

    // Calculate provider cost & net profit (hidden from user, used in Admin Profit Analytics)
    const providerRatePer1k = parseFloat(selectedService.providerRate ?? selectedService.costPrice ?? (selectedService.price * 0.7));
    const providerCost = parseFloat(((qty / 1000) * providerRatePer1k).toFixed(2));
    const netProfit = parseFloat((totalCharge - providerCost).toFixed(2));

    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);
    await addDoc(collection(db, 'orders'), {
      orderId,
      orderType: 'smm',
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUserData.username || currentUserData.name || 'User',
      serviceId: selectedService.id,
      serviceName: selectedService.name,
      targetLink: link,
      quantity: qty,
      price: totalCharge,
      providerCost: providerCost,
      netProfit: netProfit,
      apiOrderId: apiOrderId,
      status: 'Pending',
      createdAt: fsTS(),
      updatedAt: fsTS()
    });

    await addDoc(collection(db, 'walletTransactions'), {
      transactionId: 'TRX-' + Math.floor(Math.random() * 100000000),
      userId: currentUser.uid,
      type: 'order_debit',
      amount: -totalCharge,
      description: `Order ${orderId}: ${selectedService.name}`,
      createdAt: fsTS()
    });

    currentUserData.wallet = Math.max(0, parseFloat((currentUserData.wallet - totalCharge).toFixed(2)));
    const hw = document.getElementById('hero-wallet');
    if (hw) hw.textContent = money(currentUserData.wallet);

    document.getElementById('order-success-alert')?.classList.remove('d-none');
    showToast('Order placed successfully!');
  } catch (err) {
    showToast(err.message || 'Order failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text')?.classList.remove('d-none');
    sp?.classList.add('d-none');
  }
});

// Initialize Page for both Guest & Logged-In Users
initLayout();
loadCatalogAndSettings().finally(() => {
  setTimeout(() => document.getElementById('page-loader')?.remove(), 400);
});

onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  const loginHeaderBtn = document.getElementById('header-login-btn');
  const sidebarLoginBtn = document.getElementById('sidebar-login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const nameEl = document.getElementById('user-name-display');
  const avatarEl = document.getElementById('user-avatar');
  const heroWallet = document.getElementById('hero-wallet');

  if (!user) {
    // Guest Mode
    loginHeaderBtn?.classList.remove('d-none');
    sidebarLoginBtn?.classList.remove('d-none');
    logoutBtn?.classList.add('d-none');
    if (nameEl) nameEl.textContent = 'Guest Mode';
    if (avatarEl) avatarEl.textContent = 'G';
    if (heroWallet) heroWallet.textContent = 'Rs. 0.00';
    return;
  }

  loginHeaderBtn?.classList.add('d-none');
  sidebarLoginBtn?.classList.add('d-none');
  logoutBtn?.classList.remove('d-none');

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      currentUserData = snap.data();
    } else {
      currentUserData = {
        uid: user.uid,
        name: user.displayName || 'User',
        username: user.displayName || 'User',
        email: user.email,
        wallet: 0,
        role: user.uid === SUPER_ADMIN_UID ? 'admin' : 'user',
        status: 'active'
      };
      await setDoc(userRef, { ...currentUserData, createdAt: fsTS() });
    }
    const displayName = currentUserData.username || currentUserData.name || user.email.split('@')[0];
    if (nameEl) nameEl.textContent = displayName;
    if (avatarEl) avatarEl.textContent = initials(displayName);
    if (heroWallet) heroWallet.textContent = money(currentUserData.wallet);
  } catch (e) {
    console.error('User load error:', e);
  }
});

document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = 'dashboard.html';
});
