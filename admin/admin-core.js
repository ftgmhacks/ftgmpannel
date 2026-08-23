import { 
  auth, 
  db, 
  updateEmail, 
  onAuthStateChanged, 
  signOut, 
  updatePassword, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  fsTS 
} from "./firebase-init.js";

import { 
  showToast, 
  smmApi, 
  money, 
  esc, 
  copyClipboard, 
  stamp, 
  openModal, 
  closeModal, 
  setButtonBusy, 
  setupIconPicker, 
  parseYouTubeUrl 
} from "./utils.js";

const SUPER_ADMIN_UID = "Q0NoYuEprlW6SvvOrv7lnx5kSeg1";

let currentUser = null;
let usersCache = {};
let categoriesCache = [];
let servicesCache = [];
let pmsCache = [];
let isCategorySubmitting = false;

/* ---------- Safety Loader Removal & Timer ---------- */
const loaderTimeout = setTimeout(() => {
  hideLoader();
}, 5000);

function hideLoader() {
  clearTimeout(loaderTimeout);
  const loader = document.getElementById('admin-auth-loading');
  if (loader) loader.style.display = 'none';
}

/* ---------- Layout Responsiveness Toggler ---------- */
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
initLayout();

/* ---------- Navigation Switching ---------- */
document.querySelectorAll('#admin-nav .nav-link').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('#admin-nav .nav-link').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('[data-panel]').forEach(p =>
    p.classList.toggle('d-none', p.dataset.panel !== btn.dataset.section));
  if (window.innerWidth <= 860) {
    document.getElementById('sidebar').classList.remove('active');
    document.querySelector('.sidebar-backdrop')?.classList.remove('active');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}));

/* ---------- Auth Guard Validation ---------- */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    hideLoader();
    window.location.href = 'index.html';
    return;
  }
  if (user.uid !== SUPER_ADMIN_UID) {
    hideLoader();
    await signOut(auth);
    window.location.href = 'index.html';
    return;
  }
  currentUser = user;
  hideLoader();

  try { await loadUsers(); } catch (e) { console.error('Error loading users:', e); }
  try { await loadOrders(); } catch (e) { console.error('Error loading orders:', e); }
  try { await loadPayments(); } catch (e) { console.error('Error loading payments:', e); }
  try { await loadCategories(); } catch (e) { console.error('Error loading categories:', e); }
  try { await loadServices(); } catch (e) { console.error('Error loading services:', e); }
  try { await loadPaymentMethods(); } catch (e) { console.error('Error loading payment methods:', e); }
  try { await loadSettings(); } catch (e) { console.error('Error loading settings:', e); }
  try { await initAdminCreds(); } catch (e) { console.error('Error init creds:', e); }
});

async function initAdminCreds() {
    const emailField = document.getElementById('admin-edit-email');
    if (emailField && currentUser) {
        emailField.value = currentUser.email || '';
    }
}

document.getElementById('admin-credentials-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newEmail = document.getElementById('admin-edit-email').value.trim();
  const newPass = document.getElementById('admin-new-pass').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true);
  
  try {
    if (newEmail && newEmail !== currentUser.email) {
      await updateEmail(currentUser, newEmail);
    }
    if (newPass) {
      if (newPass.length < 6) throw new Error('Password must be at least 6 characters');
      await updatePassword(currentUser, newPass);
    }
    showToast('Credentials updated successfully!');
    document.getElementById('admin-new-pass').value = '';
  } catch (err) {
    let msg = err.message;
    if (msg.includes('requires-recent-login')) msg = 'Please log out and log back in to change sensitive credentials.';
    showToast(msg, 'error');
  } finally {
    setButtonBusy(submitBtn, false);
  }
});

document.getElementById('admin-logout-btn').addEventListener('click', async (e) => {
  e.preventDefault(); await signOut(auth); window.location.href = 'index.html';
});

const badge = (s) => `<span class="badge badge-${String(s || '').toLowerCase().replace(/\s+/g, '')}">${esc(s)}</span>`;

/* ---------- Users Handling ---------- */
async function loadUsers() {
  const tbody = document.getElementById('admin-users-body');
  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc')));
    } catch (e) {
      snap = await getDocs(collection(db, 'users'));
    }
    tbody.innerHTML = ''; usersCache = {}; let total = 0;
    snap.forEach(d => {
      const u = d.data();
      usersCache[u.uid || d.id] = u;
      total += parseFloat(u.wallet || 0);
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="font-bold" style="color:var(--brand-900)">${esc(u.name)}</td>
          <td>${esc(u.email)}</td>
          <td class="text-muted" style="font-size:0.8rem">${stamp(u.createdAt)}</td>
          <td class="text-primary font-bold">${money(u.wallet)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" data-wallet="${esc(u.uid || d.id)}">Adjust Balance</button>
            <button class="btn btn-sm btn-danger" style="background:#d93838; margin-left:0.25rem" data-delete-user="${esc(u.uid || d.id)}"><i class="fa-solid fa-trash-can"></i> Delete</button>
          </td>
        </tr>`);
    });
    if (snap.empty) tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No users found.</td></tr>';
    document.getElementById('stat-users').textContent = snap.size;
    document.getElementById('stat-total-wallet').textContent = money(total);
    
    tbody.querySelectorAll('[data-wallet]').forEach(b => b.addEventListener('click', () => {
      document.getElementById('wallet-user-id').value = b.dataset.wallet;
      document.getElementById('wallet-form').reset();
      openModal('wallet-modal');
    }));

    tbody.querySelectorAll('[data-delete-user]').forEach(b => b.addEventListener('click', async (e) => {
      const uid = b.dataset.deleteUser;
      if (!confirm('Are you absolutely sure you want to permanently delete this user account? This will wipe their profile from the database.')) return;
      setButtonBusy(e.currentTarget, true);
      try {
        await deleteDoc(doc(db, 'users', uid));
        showToast('User account deleted successfully.');
        await loadUsers();
      } catch (err) { showToast(err.message, 'error'); }
      finally { setButtonBusy(e.currentTarget, false); }
    }));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Failed to load users: ${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('wallet-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const uid = document.getElementById('wallet-user-id').value;
  const action = document.getElementById('wallet-action').value;
  const amount = parseFloat(document.getElementById('wallet-amount').value);
  if (!uid || !amount || amount <= 0) return;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true);
  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) throw new Error('User not found.');
    const cur = parseFloat(snap.data().wallet || 0);
    const next = Math.max(0, action === 'add' ? cur + amount : cur - amount);
    await updateDoc(userRef, { wallet: next });
    await addDoc(collection(db, 'walletTransactions'), {
      transactionId: 'TRX-' + Math.floor(Math.random() * 100000000),
      userId: uid, type: 'adjustment', amount: action === 'add' ? amount : -amount,
      description: 'Admin adjustment (' + action + ')', createdAt: fsTS()
    });
    showToast('Balance adjusted successfully!');
    closeModal('wallet-modal');
    await loadUsers();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});

/* ---------- Orders Processing ---------- */
async function loadOrders() {
  const tbody = document.getElementById('admin-orders-body');
  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
    } catch (e) {
      snap = await getDocs(collection(db, 'orders'));
    }
    tbody.innerHTML = ''; let pending = 0, completed = 0;
    snap.forEach(d => {
      const o = d.data();
      if (o.status === 'Pending' || o.status === 'Processing' || o.status === 'In Progress') {
          pending++;
      }
      if (o.status === 'Completed') completed++;
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><div class="font-bold" style="color:var(--brand-900)">${esc(o.orderId)}</div>
            <div class="text-muted" style="font-size:0.72rem">${stamp(o.createdAt)}</div></td>
          <td style="font-size:0.82rem">${esc(o.userEmail)}</td>
          <td><div class="font-medium" style="font-size:0.85rem">${esc(o.serviceName)}</div>
            <button onclick="window.copyClipboard('${esc(o.targetLink)}')" class="btn btn-sm btn-secondary font-bold" style="padding: 0.2rem 0.5rem; font-size: 0.65rem;">Copy Link</button></td>
          <td><div>Qty: ${esc(o.quantity)}</div><div class="text-primary font-bold">${money(o.price)}</div></td>
          <td>${badge(o.status)}</td>
          <td style="font-size:0.8rem; color:var(--text-muted)">${o.apiOrderId || 'Manual'}</td>
          <td><button class="btn btn-sm btn-secondary" data-order="${d.id}" data-status="${esc(o.status)}"
                data-user="${esc(o.userId)}" data-amount="${o.price}">Edit Status</button></td>
        </tr>`);
    });
    if (snap.empty) tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No orders placed yet.</td></tr>';
    document.getElementById('stat-orders').textContent = snap.size;
    document.getElementById('stat-pending-orders').textContent = pending;
    document.getElementById('stat-completed-orders').textContent = completed;
    tbody.querySelectorAll('[data-order]').forEach(b => b.addEventListener('click', () => {
      document.getElementById('edit-order-id').value = b.dataset.order;
      document.getElementById('edit-order-status').value = b.dataset.status;
      document.getElementById('edit-order-user').value = b.dataset.user;
      document.getElementById('edit-order-amount').value = b.dataset.amount;
      openModal('order-status-modal');
    }));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Failed to load orders: ${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('order-status-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-order-id').value;
  const status = document.getElementById('edit-order-status').value;
  const userId = document.getElementById('edit-order-user').value;
  const amount = parseFloat(document.getElementById('edit-order-amount').value);
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true);
  try {
    const orderRef = doc(db, 'orders', id);
    const snap = await getDoc(orderRef);
    if (!snap.exists()) throw new Error('Order snapshot missing.');
    if (status === 'Refunded' && snap.data().status !== 'Refunded') {
      const userRef = doc(db, 'users', userId);
      const uSnap = await getDoc(userRef);
      if (uSnap.exists()) {
        await updateDoc(userRef, { wallet: parseFloat(uSnap.data().wallet || 0) + amount });
        await addDoc(collection(db, 'walletTransactions'), {
          transactionId: 'TRX-' + Math.floor(Math.random() * 100000000),
          userId, type: 'refund', amount,
          description: 'Order refund: ' + snap.data().orderId, createdAt: fsTS()
        });
      }
    }
    await updateDoc(orderRef, { status, updatedAt: fsTS() });
    showToast('Order parameters saved!');
    closeModal('order-status-modal');
    await loadOrders(); await loadUsers();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});

/* ---------- Payments Queue ---------- */
async function loadPayments() {
  const tbody = document.getElementById('admin-payments-body');
  try {
    let snap;
    try {
      snap = await getDocs(query(collection(db, 'payments'), orderBy('createdAt', 'desc')));
    } catch (e) {
      snap = await getDocs(collection(db, 'payments'));
    }
    tbody.innerHTML = ''; let pending = 0, approved = 0;
    snap.forEach(d => {
      const p = d.data();
      if (p.status === 'Pending') {
          pending++;
      }
      if (p.status === 'Approved') approved++;
      const actions = p.status === 'Pending'
        ? `<button class="btn btn-sm btn-success mb-2" data-approve="${d.id}" data-user="${esc(p.userId)}" data-amount="${p.amount}">Approve</button>
           <button class="btn btn-sm btn-danger" style="background:#d93838;" data-reject="${d.id}">Reject</button>`
        : '<span class="text-muted" style="font-size:0.75rem">Handled</span>';
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td><div class="font-bold" style="color:var(--brand-900)">${esc(p.paymentId)}</div>
            <div class="text-muted" style="font-size:0.72rem">${stamp(p.createdAt)}</div></td>
          <td style="font-size:0.82rem">${esc(p.userEmail)}</td>
          <td><div class="font-medium">${esc(p.paymentMethod)}</div>
            <div class="text-muted" style="font-size:0.72rem">TID: ${esc(p.transactionId)}</div></td>
          <td class="text-primary font-bold">${money(p.amount)}</td>
          <td><button class="btn btn-sm btn-secondary" data-shot="${esc(p.screenshotUrl)}">View Screen</button></td>
          <td>${badge(p.status)}</td>
          <td>${actions}</td>
        </tr>`);
    });
    if (snap.empty) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No deposits detected.</td></tr>';
    document.getElementById('stat-pending-payments').textContent = pending;
    document.getElementById('stat-approved-payments').textContent = approved;

    tbody.querySelectorAll('[data-shot]').forEach(b => b.addEventListener('click', () => {
      document.getElementById('screenshot-view-img').src = b.dataset.shot;
      openModal('screenshot-modal');
    }));
    tbody.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click',
      (e) => approvePayment(e.currentTarget, b.dataset.approve, b.dataset.user, parseFloat(b.dataset.amount))));
    tbody.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click',
      (e) => rejectPayment(e.currentTarget, b.dataset.reject)));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load payments: ${esc(err.message)}</td></tr>`;
  }
}

async function approvePayment(btn, id, userId, amount) {
  if (!confirm('Add funds to this user account?')) return;
  setButtonBusy(btn, true);
  try {
    const payRef = doc(db, 'payments', id);
    const pSnap = await getDoc(payRef);
    if (!pSnap.exists() || pSnap.data().status !== 'Pending') {
      setButtonBusy(btn, false);
      return showToast('Operation lock exception.', 'error');
    }
    const userRef = doc(db, 'users', userId);
    const uSnap = await getDoc(userRef);
    if (uSnap.exists()) {
      await updateDoc(userRef, { wallet: parseFloat(uSnap.data().wallet || 0) + amount });
      await addDoc(collection(db, 'walletTransactions'), {
        transactionId: 'TRX-' + Math.floor(Math.random() * 100000000),
        userId, type: 'deposit', amount,
        description: 'Approved Topup: ' + pSnap.data().paymentId, createdAt: fsTS()
      });
    }
    await updateDoc(payRef, { status: 'Approved', updatedAt: fsTS() });
    showToast('Topup approved successfully!');
    await loadPayments(); await loadUsers();
  } catch (err) { showToast(err.message, 'error'); setButtonBusy(btn, false); }
}

async function rejectPayment(btn, id) {
  if (!confirm('Reject this deposit screenshot?')) return;
  setButtonBusy(btn, true);
  try {
    await updateDoc(doc(db, 'payments', id), { status: 'Rejected', updatedAt: fsTS() });
    showToast('Payment slip rejected.');
    await loadPayments();
  } catch (err) { showToast(err.message, 'error'); setButtonBusy(btn, false); }
}

/* ---------- Categories ---------- */
async function loadCategories() {
  const tbody = document.getElementById('admin-categories-body');
  try {
    const snap = await getDocs(collection(db, 'categories'));
    tbody.innerHTML = ''; categoriesCache = [];
    
    snap.forEach(d => {
      const c = { id: d.id, ...d.data() };
      categoriesCache.push(c);
    });

    categoriesCache.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    categoriesCache.forEach((c, idx) => {
      tbody.insertAdjacentHTML('beforeend', `
        <tr class="draggable-row" draggable="true" data-cat-id="${c.id}" data-index="${idx}">
          <td>
            <div class="order-controls">
              <span class="drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
              <button class="btn-icon-sm cat-move-up" data-idx="${idx}" title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
              <button class="btn-icon-sm cat-move-down" data-idx="${idx}" title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
            </div>
          </td>
          <td class="font-bold" style="color:var(--brand-900)">${esc(c.name)}</td>
          <td>${c.status === 'active' ? '<span class="badge badge-completed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
          <td><button class="btn btn-sm btn-secondary" data-cat="${c.id}">Edit</button></td>
        </tr>`);
    });
    
    if (snap.empty) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No categories loaded. Click Add Category.</td></tr>';
    
    tbody.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => editCategory(b.dataset.cat)));
    tbody.querySelectorAll('.cat-move-up').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); moveCategory(parseInt(b.dataset.idx), -1); }));
    tbody.querySelectorAll('.cat-move-down').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); moveCategory(parseInt(b.dataset.idx), 1); }));

    initDragAndDrop(tbody, 'category');

    const sel = document.getElementById('srv-category');
    if (sel) {
      sel.innerHTML = categoriesCache.length ? '' : '<option value="">Create a category label first</option>';
      categoriesCache.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = c.name;
        sel.appendChild(o);
      });
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to load categories: ${esc(err.message)}</td></tr>`;
  }
}

async function moveCategory(fromIndex, offset) {
  const toIndex = fromIndex + offset;
  if (toIndex < 0 || toIndex >= categoriesCache.length) return;
  const temp = categoriesCache[fromIndex];
  categoriesCache[fromIndex] = categoriesCache[toIndex];
  categoriesCache[toIndex] = temp;
  await saveCategoryOrders();
}

async function saveCategoryOrders() {
  try {
    for (let i = 0; i < categoriesCache.length; i++) {
      categoriesCache[i].sortOrder = i;
      await updateDoc(doc(db, 'categories', categoriesCache[i].id), { sortOrder: i });
    }
    showToast('Category sequence updated successfully!');
    await loadCategories(); await loadServices();
  } catch (err) { showToast(err.message, 'error'); }
}

document.getElementById('add-category-btn').addEventListener('click', () => {
  document.getElementById('category-form').reset();
  document.getElementById('cat-id').value = '';
  document.getElementById('cat-modal-title').textContent = 'Add Category';
  document.getElementById('cat-delete-btn').classList.add('d-none');
  openModal('category-modal');
});

function editCategory(id) {
  const c = categoriesCache.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cat-id').value = id;
  document.getElementById('cat-name').value = c.name || '';
  document.getElementById('cat-icon').value = c.icon || 'fa-solid fa-layer-group';
  document.getElementById('cat-status').value = c.status || 'active';
  document.getElementById('cat-modal-title').textContent = 'Edit Category';
  document.getElementById('cat-delete-btn').classList.remove('d-none');
  openModal('category-modal');
}

document.getElementById('category-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isCategorySubmitting) return;
  isCategorySubmitting = true;

  const submitBtn = document.getElementById('cat-submit-btn');
  setButtonBusy(submitBtn, true);

  const id = document.getElementById('cat-id').value;
  const nameVal = document.getElementById('cat-name').value.trim();
  const statusVal = document.getElementById('cat-status').value;

  try {
    if (id) {
      await updateDoc(doc(db, 'categories', id), {
        name: nameVal,
        icon: document.getElementById('cat-icon').value.trim(),
        status: statusVal
      });
      showToast('Category configurations saved.');
    } else {
      const maxSort = categoriesCache.reduce((m, c) => Math.max(m, c.sortOrder || 0), -1);
      await addDoc(collection(db, 'categories'), {
        name: nameVal,
        icon: document.getElementById('cat-icon').value.trim(),
        status: statusVal,
        sortOrder: maxSort + 1,
        createdAt: fsTS()
      });
      showToast('Category generated.');
    }
    closeModal('category-modal');
    await loadCategories(); await loadServices();
  } catch (err) { showToast(err.message, 'error'); }
  finally {
    setButtonBusy(submitBtn, false);
    isCategorySubmitting = false;
  }
});

document.getElementById('cat-delete-btn').addEventListener('click', async (e) => {
  const id = document.getElementById('cat-id').value;
  if (!id || !confirm('Permanently delete category?')) return;
  const btn = e.currentTarget;
  setButtonBusy(btn, true);
  try {
    await deleteDoc(doc(db, 'categories', id));
    showToast('Category deleted.');
    closeModal('category-modal');
    await loadCategories(); await loadServices();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(btn, false); }
});

/* ---------- Services Config ---------- */
async function loadServices() {
  const tbody = document.getElementById('admin-services-body');
  try {
    const snap = await getDocs(collection(db, 'services'));
    tbody.innerHTML = ''; servicesCache = [];
    
    snap.forEach(d => {
      const s = { id: d.id, ...d.data() };
      servicesCache.push(s);
    });
    
    servicesCache.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

    servicesCache.forEach((s, idx) => {
      const cat = categoriesCache.find(c => c.id === s.category)?.name || 'Unmapped';
      tbody.insertAdjacentHTML('beforeend', `
        <tr class="draggable-row" draggable="true" data-srv-id="${s.id}" data-index="${idx}">
          <td>
            <div class="order-controls">
              <span class="drag-handle" title="Drag to reorder"><i class="fa-solid fa-grip-vertical"></i></span>
              <button class="btn-icon-sm srv-move-up" data-idx="${idx}" title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
              <button class="btn-icon-sm srv-move-down" data-idx="${idx}" title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
            </div>
          </td>
          <td class="font-bold" style="color:var(--brand-900)">${esc(s.name)}</td>
          <td>${esc(cat)}</td>
          <td class="text-primary font-bold">${money(s.price)}</td>
          <td>${esc(s.minQty)} / ${esc(s.maxQty)}</td>
          <td>${s.status === 'active' ? '<span class="badge badge-completed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
          <td><button class="btn btn-sm btn-secondary" data-srv="${s.id}">Edit</button></td>
        </tr>`);
    });
    
    if (snap.empty) tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No services loaded. Click Add Service.</td></tr>';
    
    tbody.querySelectorAll('[data-srv]').forEach(b => b.addEventListener('click', () => editService(b.dataset.srv)));
    tbody.querySelectorAll('.srv-move-up').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); moveService(parseInt(b.dataset.idx), -1); }));
    tbody.querySelectorAll('.srv-move-down').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); moveService(parseInt(b.dataset.idx), 1); }));

    initDragAndDrop(tbody, 'service');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">Failed to load services: ${esc(err.message)}</td></tr>`;
  }
}

async function moveService(fromIndex, offset) {
  const toIndex = fromIndex + offset;
  if (toIndex < 0 || toIndex >= servicesCache.length) return;
  const temp = servicesCache[fromIndex];
  servicesCache[fromIndex] = servicesCache[toIndex];
  servicesCache[toIndex] = temp;
  await saveServiceOrders();
}

async function saveServiceOrders() {
  try {
    for (let i = 0; i < servicesCache.length; i++) {
      servicesCache[i].sortOrder = i;
      await updateDoc(doc(db, 'services', servicesCache[i].id), { sortOrder: i });
    }
    showToast('Services sequence updated successfully!');
    await loadServices();
  } catch (err) { showToast(err.message, 'error'); }
}

document.getElementById('add-service-btn').addEventListener('click', () => {
  if (!categoriesCache.length) return showToast('Add structural categories first.', 'error');
  document.getElementById('service-form').reset();
  document.getElementById('srv-id').value = '';
  document.getElementById('srv-modal-title').textContent = 'Add Service';
  document.getElementById('srv-delete-btn').classList.add('d-none');
  openModal('service-modal');
});

function editService(id) {
  const s = servicesCache.find(x => x.id === id);
  if (!s) return;
  document.getElementById('srv-id').value = id;
  document.getElementById('srv-category').value = s.category || '';
  document.getElementById('srv-name').value = s.name || '';
  document.getElementById('srv-external-id').value = s.externalId || '';
  document.getElementById('srv-icon').value = s.icon || 'fa-solid fa-circle-check';
  document.getElementById('srv-price').value = s.price ?? '';
  document.getElementById('srv-min').value = s.minQty ?? '';
  document.getElementById('srv-max').value = s.maxQty ?? '';
  document.getElementById('srv-time').value = s.estimatedTime || '';
  document.getElementById('srv-desc').value = s.description || '';
  document.getElementById('srv-status').value = s.status || 'active';
  document.getElementById('srv-modal-title').textContent = 'Edit Service';
  document.getElementById('srv-delete-btn').classList.remove('d-none');
  openModal('service-modal');
}

document.getElementById('service-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('srv-id').value;
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true);

  try {
    if (id) {
      await updateDoc(doc(db, 'services', id), {
        category: document.getElementById('srv-category').value,
        name: document.getElementById('srv-name').value.trim(),
        externalId: document.getElementById('srv-external-id').value.trim(),
        icon: document.getElementById('srv-icon').value.trim(),
        price: parseFloat(document.getElementById('srv-price').value),
        minQty: parseInt(document.getElementById('srv-min').value),
        maxQty: parseInt(document.getElementById('srv-max').value),
        estimatedTime: document.getElementById('srv-time').value.trim(),
        description: document.getElementById('srv-desc').value.trim(),
        status: document.getElementById('srv-status').value
      });
      showToast('Service specifications updated.');
    } else {
      const maxSort = servicesCache.reduce((m, s) => Math.max(m, s.sortOrder || 0), -1);
      await addDoc(collection(db, 'services'), {
        category: document.getElementById('srv-category').value,
        name: document.getElementById('srv-name').value.trim(),
        externalId: document.getElementById('srv-external-id').value.trim(),
        icon: document.getElementById('srv-icon').value.trim(),
        price: parseFloat(document.getElementById('srv-price').value),
        minQty: parseInt(document.getElementById('srv-min').value),
        maxQty: parseInt(document.getElementById('srv-max').value),
        estimatedTime: document.getElementById('srv-time').value.trim(),
        description: document.getElementById('srv-desc').value.trim(),
        status: document.getElementById('srv-status').value,
        sortOrder: maxSort + 1,
        createdAt: fsTS()
      });
      showToast('Service rate added.');
    }
    closeModal('service-modal');
    await loadServices();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});

document.getElementById('srv-delete-btn').addEventListener('click', async (e) => {
  const id = document.getElementById('srv-id').value;
  if (!id || !confirm('Permanently delete SMM service configuration?')) return;
  const btn = e.currentTarget;
  setButtonBusy(btn, true);
  try {
    await deleteDoc(doc(db, 'services', id));
    showToast('Service layout deleted.');
    closeModal('service-modal');
    await loadServices();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(btn, false); }
});

/* ---------- Universal HTML5 Drag and Drop Handler ---------- */
function initDragAndDrop(tbody, type) {
  let draggedRow = null;

  tbody.querySelectorAll('.draggable-row').forEach(row => {
    row.addEventListener('dragstart', (e) => {
      draggedRow = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (row !== draggedRow) {
        row.classList.add('drag-over');
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over');
    });

    row.addEventListener('drop', async (e) => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (draggedRow && draggedRow !== row) {
        const fromIdx = parseInt(draggedRow.dataset.index);
        const toIdx = parseInt(row.dataset.index);

        if (type === 'category') {
          const item = categoriesCache.splice(fromIdx, 1)[0];
          categoriesCache.splice(toIdx, 0, item);
          await saveCategoryOrders();
        } else if (type === 'service') {
          const item = servicesCache.splice(fromIdx, 1)[0];
          servicesCache.splice(toIdx, 0, item);
          await saveServiceOrders();
        }
      }
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      tbody.querySelectorAll('.draggable-row').forEach(r => r.classList.remove('drag-over'));
    });
  });
}

/* ---------- Payment Options ---------- */
async function loadPaymentMethods() {
  const tbody = document.getElementById('admin-pm-body');
  try {
    const snap = await getDocs(collection(db, 'paymentMethods'));
    tbody.innerHTML = ''; pmsCache = [];
    snap.forEach(d => {
      const p = { id: d.id, ...d.data() };
      pmsCache.push(p);
      tbody.insertAdjacentHTML('beforeend', `
        <tr>
          <td class="font-bold" style="color:var(--brand-900)">${esc(p.title)}</td>
          <td><div>Account: <strong>${esc(p.accountNumber)}</strong></div><div class="text-muted" style="font-size:0.75rem">Name: ${esc(p.accountName)}</div></td>
          <td>${p.status === 'active' ? '<span class="badge badge-completed">Active</span>' : '<span class="badge badge-cancelled">Inactive</span>'}</td>
          <td><button class="btn btn-sm btn-secondary" data-pm="${p.id}">Edit</button></td>
        </tr>`);
    });
    if (snap.empty) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No deposit gateways found.</td></tr>';
    tbody.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', () => editPM(b.dataset.pm)));
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-danger">Failed to load payment methods: ${esc(err.message)}</td></tr>`;
  }
}

document.getElementById('add-pm-btn').addEventListener('click', () => {
  document.getElementById('pm-form').reset();
  document.getElementById('pm-id').value = '';
  document.getElementById('pm-modal-title').textContent = 'Add Payment Method';
  document.getElementById('pm-delete-btn').classList.add('d-none');
  openModal('pm-modal');
});

function editPM(id) {
  const p = pmsCache.find(x => x.id === id);
  if (!p) return;
  document.getElementById('pm-id').value = id;
  document.getElementById('pm-title').value = p.title || '';
  document.getElementById('pm-icon').value = p.icon || 'fa-solid fa-building-columns';
  document.getElementById('pm-acc-num').value = p.accountNumber || '';
  document.getElementById('pm-acc-name').value = p.accountName || '';
  document.getElementById('pm-inst').value = p.instructions || '';
  document.getElementById('pm-status').value = p.status || 'active';
  document.getElementById('pm-modal-title').textContent = 'Edit Gateway';
  document.getElementById('pm-delete-btn').classList.remove('d-none');
  openModal('pm-modal');
}

document.getElementById('pm-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('pm-id').value;
  const data = {
    title: document.getElementById('pm-title').value.trim(),
    icon: document.getElementById('pm-icon').value.trim(),
    accountNumber: document.getElementById('pm-acc-num').value.trim(),
    accountName: document.getElementById('pm-acc-name').value.trim(),
    instructions: document.getElementById('pm-inst').value.trim(),
    status: document.getElementById('pm-status').value
  };
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true);
  try {
    if (id) { await updateDoc(doc(db, 'paymentMethods', id), data); showToast('Gateway specs updated.'); }
    else { await addDoc(collection(db, 'paymentMethods'), { ...data, createdAt: fsTS() }); showToast('Gateway specs added.'); }
    closeModal('pm-modal');
    await loadPaymentMethods();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});

document.getElementById('pm-delete-btn').addEventListener('click', async (e) => {
  const id = document.getElementById('pm-id').value;
  if (!id || !confirm('Permanently remove this deposit gateway?')) return;
  const btn = e.currentTarget;
  setButtonBusy(btn, true);
  try {
    await deleteDoc(doc(db, 'paymentMethods', id));
    showToast('Deposit gateway deleted.');
    closeModal('pm-modal');
    await loadPaymentMethods();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(btn, false); }
});

/* ---------- Settings Configurations & Auto YouTube Link Parser ---------- */
async function loadSettings() {
  const snap = await getDoc(doc(db, 'settings', 'general'));
  if (!snap.exists()) return;
  const s = snap.data();
  document.getElementById('set-site-name').value = s.siteName || '';
  document.getElementById('set-logo-url').value = s.logoUrl || '';
  document.getElementById('set-telegram').value = s.channelUrl || '';
  document.getElementById('set-youtube').value = s.dashboardVideo || '';
  document.getElementById('set-footer-contact').value = s.footerContact || '';
  document.getElementById('set-api-url').value = s.apiUrl || 'https://www.pakfollowers.com/api/v2';
  document.getElementById('set-api-key').value = s.apiKey || '9d121ff73bb012eb41b18c01065e51daeba9602c';
  
  API_URL = document.getElementById('set-api-url').value;
  API_KEY = document.getElementById('set-api-key').value;
}

function refreshIconPickers() {
  setupIconPicker('cat-icon-picker', 'cat-icon');
  setupIconPicker('srv-icon-picker', 'srv-icon');
  setupIconPicker('pm-icon-picker', 'pm-icon');
}

// Intercept Modal Open to refresh icons
const originalOpenModal = window.openModal;
window.openModal = function(id) {
  originalOpenModal(id);
  if (id === 'category-modal' || id === 'service-modal' || id === 'pm-modal') {
    refreshIconPickers();
  }
};

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = e.target.querySelector('button[type="submit"]');
  setButtonBusy(submitBtn, true);
  try {
    const rawYtUrl = document.getElementById('set-youtube').value.trim();
    const cleanYtUrl = parseYouTubeUrl(rawYtUrl);

    await setDoc(doc(db, 'settings', 'general'), {
      siteName: document.getElementById('set-site-name').value.trim(),
      logoUrl: document.getElementById('set-logo-url').value.trim(),
      channelUrl: document.getElementById('set-telegram').value.trim(),
      dashboardVideo: cleanYtUrl,
      footerContact: document.getElementById('set-footer-contact').value.trim(),
      apiUrl: document.getElementById('set-api-url').value.trim(),
      apiKey: document.getElementById('set-api-key').value.trim(),
      updatedAt: fsTS()
    }, { merge: true });
    
    API_URL = document.getElementById('set-api-url').value.trim();
    API_KEY = document.getElementById('set-api-key').value.trim();
    
    showToast('Site configs written successfully.');
    await loadSettings();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(submitBtn, false); }
});

/* ---------- Clean Log Actions (Orders / Payments clearance) ---------- */
async function clearLogCollection(colName, btn) {
  if (!confirm(`⚠️ DANGER OPERATIONAL ALERT: Are you completely certain you want to wipe ALL documentation inside the '${colName}' history? This action is immediate and absolute.`)) return;
  setButtonBusy(btn, true);
  try {
    const snap = await getDocs(collection(db, colName));
    if (snap.empty) {
      setButtonBusy(btn, false);
      return showToast(`Target '${colName}' logging queue is already empty.`, 'error');
    }
    let cnt = 0;
    for (const d of snap.docs) {
      await deleteDoc(doc(db, colName, d.id));
      cnt++;
    }
    showToast(`Deleted ${cnt} documents inside collection '${colName}'.`);
    if (colName === 'orders') await loadOrders();
    if (colName === 'payments') await loadPayments();
  } catch (err) {
    showToast(err.message, 'error');
    setButtonBusy(btn, false);
  }
}

document.getElementById('clear-orders-btn').addEventListener('click', (e) => clearLogCollection('orders', e.currentTarget));
document.getElementById('clear-payments-btn').addEventListener('click', (e) => clearLogCollection('payments', e.currentTarget));

/* ---------- PakFollowers API Automation ---------- */
let API_URL = 'https://www.pakfollowers.com/api/v2';
let API_KEY = '9d121ff73bb012eb41b18c01065e51daeba9602c';

document.getElementById('import-api-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (!confirm('Fetch and import all services from PakFollowers? Existing services will not be affected.')) return;
  setButtonBusy(btn, true);
  try {
    const apiServices = await smmApi({ url: API_URL, key: API_KEY, action: 'services' });

    if (!Array.isArray(apiServices)) throw new Error('Invalid API response format.');

    let imported = 0;
    for (const s of apiServices) {
      const exists = servicesCache.find(x => x.externalId == s.service);
      if (exists) continue;

      let catId = '';
      const existingCat = categoriesCache.find(x => x.name.toLowerCase() === s.category.toLowerCase());
      if (existingCat) {
        catId = existingCat.id;
      } else {
        const catRes = await addDoc(collection(db, 'categories'), {
          name: s.category,
          icon: 'fa-solid fa-layer-group',
          status: 'active',
          sortOrder: categoriesCache.length,
          createdAt: fsTS()
        });
        catId = catRes.id;
        categoriesCache.push({ id: catId, name: s.category, status: 'active' });
      }

      const ratePKR = parseFloat(s.rate); 

      await addDoc(collection(db, 'services'), {
        category: catId,
        name: s.name,
        externalId: String(s.service),
        icon: 'fa-solid fa-circle-check',
        price: ratePKR,
        minQty: parseInt(s.min),
        maxQty: parseInt(s.max),
        estimatedTime: 'Automated',
        description: `Type: ${s.type}`,
        status: 'active',
        sortOrder: servicesCache.length + imported,
        createdAt: fsTS()
      });
      imported++;
    }
    showToast(`Successfully imported ${imported} new services.`);
    await loadCategories(); await loadServices();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
});

document.getElementById('delete-all-services-btn')?.addEventListener('click', async (e) => {
  if (!confirm('Are you absolutely sure you want to delete ALL services inside the panel? This cannot be undone.')) return;
  const btn = e.currentTarget;
  setButtonBusy(btn, true);
  try {
    const snap = await getDocs(collection(db, 'services'));
    if (snap.empty) {
      showToast('No services currently exist in the database.', 'error');
      return;
    }
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    showToast('All SMM services removed successfully!');
    await loadServices();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(btn, false); }
});

document.getElementById('delete-all-categories-btn')?.addEventListener('click', async (e) => {
  if (!confirm('Are you absolutely sure you want to delete ALL categories inside the panel? This will not delete services, but unmapped services will lose their category labels.')) return;
  const btn = e.currentTarget;
  setButtonBusy(btn, true);
  try {
    const snap = await getDocs(collection(db, 'categories'));
    if (snap.empty) {
      showToast('No categories currently exist in the database.', 'error');
      return;
    }
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    showToast('All categories removed successfully!');
    await loadCategories();
  } catch (err) { showToast(err.message, 'error'); }
  finally { setButtonBusy(btn, false); }
});

document.getElementById('sync-status-btn')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  setButtonBusy(btn, true);
  try {
    const snap = await getDocs(query(collection(db, 'orders'), where('status', 'in', ['Pending', 'Processing', 'In Progress'])));
    let synced = 0;
    
    for (const docSnap of snap.docs) {
      const o = docSnap.data();
      if (!o.apiOrderId) continue;

      const apiData = await smmApi({ url: API_URL, key: API_KEY, action: 'status', order: o.apiOrderId });

      if (apiData.status) {
        let localStatus = apiData.status;
        if (localStatus === 'In progress') localStatus = 'In Progress';
        
        if (localStatus !== o.status) {
          await updateDoc(doc(db, 'orders', docSnap.id), { 
            status: localStatus,
            start_count: apiData.start_count || o.start_count || 0,
            remains: apiData.remains || o.remains || 0,
            updatedAt: fsTS() 
          });
          synced++;
        }
      }
    }
    showToast(`Synced ${synced} orders with provider.`);
    await loadOrders();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    setButtonBusy(btn, false);
  }
});
