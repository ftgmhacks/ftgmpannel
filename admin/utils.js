export function showToast(message, type = 'success') {
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

/* ---- S ---- */
const SMM_PROXY = 'https://project--0158a941-e1aa-495e-8f88-9b83a66f9bbe.lovable.app/api/public/smm';
export async function smmApi(params) {
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

export const money = (n) => 'Rs. ' + (parseFloat(n || 0)).toFixed(2);
export const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function copyClipboard(text) {
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
}
window.copyClipboard = copyClipboard;

export const stamp = (t) => t && t.toDate ? t.toDate().toLocaleString() : 'N/A';

// Modal dynamic triggers
export function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}
window.openModal = openModal;

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}
window.closeModal = closeModal;

export function setButtonBusy(btn, isBusy) {
  if (!btn) return;
  if (isBusy) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner" style="width: 14px; height: 14px; display: inline-block; border-width: 2px; vertical-align: middle; margin-right: 6px;"></span> Loading...`;
  } else {
    btn.disabled = false;
    if (btn.dataset.originalHtml !== undefined) {
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}

export const ICONS_POOL = [
  'fa-brands fa-instagram', 'fa-brands fa-facebook', 'fa-brands fa-tiktok', 'fa-brands fa-youtube',
  'fa-brands fa-telegram', 'fa-brands fa-twitter', 'fa-brands fa-whatsapp', 'fa-brands fa-snapchat',
  'fa-brands fa-linkedin', 'fa-brands fa-discord', 'fa-brands fa-twitch', 'fa-brands fa-threads',
  'fa-solid fa-heart', 'fa-solid fa-user-plus', 'fa-solid fa-eye', 'fa-solid fa-share',
  'fa-solid fa-fire', 'fa-solid fa-star', 'fa-solid fa-bolt', 'fa-solid fa-circle-check',
  'fa-solid fa-layer-group', 'fa-solid fa-building-columns', 'fa-solid fa-wallet', 'fa-solid fa-cart-shopping'
];

export function setupIconPicker(containerId, inputId) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;
  
  container.innerHTML = '';
  ICONS_POOL.forEach(iconClass => {
    const div = document.createElement('div');
    div.className = 'icon-option' + (input.value === iconClass ? ' selected' : '');
    div.innerHTML = `<i class="${iconClass}"></i>`;
    div.addEventListener('click', () => {
      container.querySelectorAll('.icon-option').forEach(el => el.classList.remove('selected'));
      div.classList.add('selected');
      input.value = iconClass;
    });
    container.appendChild(div);
  });
}

export function parseYouTubeUrl(url) {
  if (!url) return '';
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return 'https://www.youtube.com/embed/' + match[2];
  }
  return url;
}
