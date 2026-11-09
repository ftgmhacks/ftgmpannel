import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SUPER_ADMIN_UID = "Q0NoYuEprlW6SvvOrv7lnx5kSeg1";

let currentUser = null;
let currentUserData = { wallet: 0 };
let manualServices = [];
let selectedManual = null;

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

// Broadcast Popup check
async function checkBroadcast() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'broadcast'));
    if (!snap.exists() || !snap.data().active) return;
    const b = snap.data();
    const stampKey = b.updatedAt?.seconds ? `bc_seen_${b.updatedAt.seconds}` : `bc_seen_${b.title}`;
    if (sessionStorage.getItem(stampKey)) return;

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(6,31,16,0.65);backdrop-filter:blur(5px);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
      <div style="background:#fff;border-radius:20px;max-width:440px;width:100%;padding:2rem;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25);border:2px solid #0bc15c;">
        <div style="width:52px;height:52px;border-radius:50%;background:rgba(11,193,92,0.12);color:#0bc15c;display:grid;place-items:center;font-size:1.4rem;margin:0 auto 0.8rem;">
          <i class="fa-solid fa-bullhorn"></i>
        </div>
        <h3 style="font-size:1.25rem;font-weight:800;color:#061f10;margin-bottom:0.75rem;">${esc(b.title)}</h3>
        <div style="font-family:'Noto Nastaliq Urdu',serif;direction:rtl;font-size:1.05rem;line-height:2.3;color:#0d2115;background:#f3f8f5;padding:1rem;border-radius:12px;margin-bottom:1.25rem;">
          ${esc(b.message)}
        </div>
        <div style="display:flex;gap:0.6rem;justify-content:center;flex-wrap:wrap;">
          ${b.actionUrl ? `<a href="${esc(b.actionUrl)}" target="_blank" style="background:linear-gradient(135deg,#0bc15c,#0dbfa1);color:#fff;padding:0.75rem 1.4rem;border-radius:10px;font-weight:700;text-decoration:none;">${esc(b.actionLabel || 'Open Link')}</a>` : ''}
          <button id="bc-close-btn" style="background:#eaf3ee;color:#061f10;border:1px solid #d7e5dd;padding:0.75rem 1.4rem;border-radius:10px;font-weight:700;cursor:pointer;">Close</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#bc-close-btn')?.addEventListener('click', () => {
      sessionStorage.setItem(stampKey, '1');
      modal.remove();
    });
  } catch (e) {
    console.warn('Broadcast load skipped:', e);
  }
}

checkBroadcast();

// Run Other Services Page Logic if on other-services.html
if (document.body.dataset.serviceType === 'other_services') {
  initOtherServicesPage();
}

function initOtherServicesPage() {
  const btn = document.getElementById('mobile-menu-btn');
  const sidebar = document.getElementById('sidebar');
  if (sidebar) {
    let backdrop = document.querySelector('.sidebar-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'sidebar-backdrop';
      document.body.appendChild(backdrop);
    }
    btn?.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('active');
      backdrop.classList.toggle('active', sidebar.classList.contains('active'));
    });
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('active');
      backdrop.classList.remove('active');
    });
  }

  document.querySelectorAll('[data-requires-auth="true"]').forEach(link => {
    link.addEventListener('click', (e) => {
      if (!currentUser) {
        e.preventDefault();
        const target = link.getAttribute('href') || 'other-services.html';
        window.location.href = `login.html?redirect=${encodeURIComponent(target)}`;
      }
    });
  });

  loadOtherServicesCatalog().finally(() => {
    setTimeout(() => document.getElementById('page-loader')?.remove(), 400);
  });

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const loginHeaderBtn = document.getElementById('header-login-btn');
    const sidebarLoginBtn = document.getElementById('sidebar-login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const nameEl = document.getElementById('user-name-display');
    const avatarEl = document.getElementById('user-avatar');
    const walletEl = document.getElementById('header-wallet-balance');
    const heroWallet = document.getElementById('hero-wallet');

    if (!user) {
      loginHeaderBtn?.classList.remove('d-none');
      sidebarLoginBtn?.classList.remove('d-none');
      logoutBtn?.classList.add('d-none');
      if (nameEl) nameEl.textContent = 'Guest';
      if (avatarEl) avatarEl.textContent = 'G';
      return;
    }

    loginHeaderBtn?.classList.add('d-none');
    sidebarLoginBtn?.classList.add('d-none');
    logoutBtn?.classList.remove('d-none');

    const uSnap = await getDoc(doc(db, 'users', user.uid));
    if (uSnap.exists()) {
      currentUserData = uSnap.data();
      const shown = currentUserData.username || currentUserData.name || user.email.split('@')[0];
      if (nameEl) nameEl.textContent = shown;
      if (avatarEl) avatarEl.textContent = initials(shown);
      if (walletEl) walletEl.textContent = money(currentUserData.wallet);
      if (heroWallet) heroWallet.textContent = money(currentUserData.wallet);
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut(auth);
    window.location.href = 'dashboard.html';
  });

  document.getElementById('ms-qty')?.addEventListener('input', updateOtherTotal);
  document.getElementById('ms-form')?.addEventListener('submit', submitOtherServiceOrder);
}

async function loadOtherServicesCatalog() {
  const trigger = document.getElementById('ms-trigger');
  const optionsBox = document.getElementById('ms-options');
  if (!trigger || !optionsBox) return;

  const snap = await getDocs(query(collection(db, 'manualServices'), where('status', '==', 'active')));
  manualServices = [];
  snap.forEach(d => manualServices.push({ id: d.id, ...d.data() }));
  manualServices.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  optionsBox.innerHTML = '';
  if (!manualServices.length) {
    trigger.innerHTML = `<span>No services available right now</span> <i class="fa-solid fa-chevron-down"></i>`;
    return;
  }

  manualServices.forEach(m => {
    const icon = m.icon || 'fa-solid fa-toolbox';
    const deliveryBadge = m.deliveryType === 'direct' ? '⚡ Instant Download / API' : '💬 WhatsApp Delivery';
    const div = document.createElement('div');
    div.className = 'custom-option';
    div.innerHTML = `
      <div class="opt-icon"><i class="${esc(icon)}"></i></div>
      <div style="flex:1">
        <div style="font-weight:700;color:var(--brand-900)">${esc(m.name)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">${deliveryBadge} • <strong style="color:var(--primary-dark)">${money(m.price)}</strong></div>
      </div>`;
    div.addEventListener('click', () => {
      selectedManual = m;
      document.getElementById('ms-service').value = m.id;
      trigger.innerHTML = `<span style="display:flex;align-items:center;gap:0.6rem;"><i class="${esc(icon)}" style="color:var(--primary)"></i> ${esc(m.name)} — ${money(m.price)}</span> <i class="fa-solid fa-chevron-down"></i>`;
      optionsBox.classList.remove('show');
      displaySelectedManual(m);
    });
    optionsBox.appendChild(div);
  });

  trigger.onclick = (e) => {
    e.stopPropagation();
    optionsBox.classList.toggle('show');
  };
  document.addEventListener('click', () => optionsBox.classList.remove('show'));
}

function displaySelectedManual(m) {
  document.getElementById('ms-price-per').textContent = money(m.price);
  document.getElementById('ms-delivery-mode').textContent = m.deliveryType === 'direct' ? 'Instant File / Link' : 'WhatsApp Support';
  const desc = document.getElementById('ms-desc');
  if (desc) {
    desc.textContent = m.description || 'Fixed price service.';
    desc.classList.toggle('d-none', !m.description);
  }
  document.getElementById('ms-details-card')?.classList.remove('d-none');
  updateOtherTotal();
}

function updateOtherTotal() {
  const qty = Math.max(1, parseInt(document.getElementById('ms-qty')?.value || 1));
  const submitBtn = document.getElementById('ms-submit');
  if (!selectedManual) {
    document.getElementById('ms-total').textContent = money(0);
    if (submitBtn) submitBtn.disabled = true;
    return;
  }
  const total = qty * parseFloat(selectedManual.price || 0);
  document.getElementById('ms-total').textContent = money(total);
  if (submitBtn) submitBtn.disabled = false;
}

async function submitOtherServiceOrder(e) {
  e.preventDefault();
  if (!currentUser) {
    showToast('Please login first to purchase this service.', 'error');
    setTimeout(() => {
      window.location.href = 'login.html?redirect=other-services.html';
    }, 600);
    return;
  }

  if (!selectedManual) return showToast('Please select a service first.', 'error');

  const qty = Math.max(1, parseInt(document.getElementById('ms-qty').value || 1));
  const details = document.getElementById('ms-details').value.trim() || 'Direct Order';
  const totalCharge = parseFloat((qty * parseFloat(selectedManual.price || 0)).toFixed(2));
  const costPerUnit = parseFloat(selectedManual.costPrice || 0);
  const totalCost = parseFloat((qty * costPerUnit).toFixed(2));
  const netProfit = parseFloat((totalCharge - totalCost).toFixed(2));

  const btn = document.getElementById('ms-submit');
  const sp = document.getElementById('ms-spinner');
  btn.disabled = true;
  btn.querySelector('.btn-text')?.classList.add('d-none');
  sp?.classList.remove('d-none');

  try {
    const userRef = doc(db, 'users', currentUser.uid);
    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(userRef);
      if (!uSnap.exists()) throw new Error('Account not found.');
      const bal = parseFloat(uSnap.data().wallet || 0);
      if (bal < totalCharge) throw new Error(`Insufficient balance (${money(bal)}). Please add funds first.`);
      tx.update(userRef, { wallet: parseFloat((bal - totalCharge).toFixed(2)) });
    });

    const isDirect = selectedManual.deliveryType === 'direct' && !!selectedManual.deliveryUrl;
    const orderId = 'OTH-' + Math.floor(100000 + Math.random() * 900000);

    await addDoc(collection(db, 'orders'), {
      orderId,
      orderType: 'other_services',
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: currentUserData.username || currentUserData.name || 'User',
      serviceId: selectedManual.id,
      serviceName: selectedManual.name,
      targetLink: details,
      quantity: qty,
      price: totalCharge,
      providerCost: totalCost,
      netProfit: netProfit,
      deliveryType: isDirect ? 'direct' : 'whatsapp',
      status: isDirect ? 'Completed' : 'Pending (Manual)',
      createdAt: fsTS(),
      updatedAt: fsTS()
    });

    await addDoc(collection(db, 'walletTransactions'), {
      transactionId: 'TRX-' + Math.floor(Math.random() * 100000000),
      userId: currentUser.uid,
      type: 'order_debit',
      amount: -totalCharge,
      description: `Other Service ${orderId}: ${selectedManual.name}`,
      createdAt: fsTS()
    });

    currentUserData.wallet = Math.max(0, parseFloat((currentUserData.wallet - totalCharge).toFixed(2)));
    document.getElementById('header-wallet-balance').textContent = money(currentUserData.wallet);
    document.getElementById('hero-wallet').textContent = money(currentUserData.wallet);

    // Show delivery card
    const successBox = document.getElementById('ms-success');
    const directBtn = document.getElementById('ms-direct-btn');
    const waBtn = document.getElementById('ms-wa-btn');
    const msgEl = document.getElementById('ms-success-msg');

    document.getElementById('ms-success-id').textContent = orderId;

    if (isDirect) {
      msgEl.textContent = 'Your instant download / API access link is ready below:';
      directBtn.href = selectedManual.deliveryUrl;
      document.getElementById('ms-direct-btn-label').textContent = selectedManual.deliveryLabel || 'Download File / Access API Now';
      directBtn.classList.remove('d-none');
      waBtn.classList.add('d-none');
    } else {
      msgEl.textContent = 'Your order has been registered! Click the button below to receive your service immediately on WhatsApp:';
      const waNumber = (selectedManual.whatsappNumber || '923104882921').replace(/\D/g, '');
      const waText = `Assalam-o-Alaikum! I have purchased *${selectedManual.name}*.\nOrder ID: *${orderId}*\nQuantity: ${qty}\nAmount Paid: ${money(totalCharge)}\nDetails: ${details}\n\nPlease deliver my service.`;
      waBtn.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;
      waBtn.classList.remove('d-none');
      directBtn.classList.add('d-none');
    }

    successBox.classList.remove('d-none');
    successBox.scrollIntoView({ behavior: 'smooth' });
    showToast('Service purchased successfully!');
  } catch (err) {
    showToast(err.message || 'Purchase failed.', 'error');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text')?.classList.remove('d-none');
    sp?.classList.add('d-none');
  }
}
