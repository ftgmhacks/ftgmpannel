setTimeout(() => {
  const tooltip = document.getElementById('wa-tooltip');
  if (tooltip) {
    tooltip.classList.add('show');
    setTimeout(() => {
      tooltip.classList.remove('show');
    }, 3000);
  }
}, 3000);

const loginFormUI = document.getElementById('login-form');
const registerFormUI = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const tabLogin2 = document.getElementById('tab-login2');
const tabRegister2 = document.getElementById('tab-register2');
const btnNewUser = document.getElementById('btn-new-user');

function showLogin() {
  if(loginFormUI) loginFormUI.classList.remove('d-none');
  if(registerFormUI) registerFormUI.classList.add('d-none');
  if (tabLogin) tabLogin.classList.add('active');
  if (tabRegister) tabRegister.classList.remove('active');
  if (tabLogin2) tabLogin2.classList.add('active');
  if (tabRegister2) tabRegister2.classList.remove('active');
}

function showRegister() {
  if(loginFormUI) loginFormUI.classList.add('d-none');
  if(registerFormUI) registerFormUI.classList.remove('d-none');
  if (tabLogin) tabLogin.classList.remove('active');
  if (tabRegister) tabRegister.classList.add('active');
  if (tabLogin2) tabLogin2.classList.remove('active');
  if (tabRegister2) tabRegister2.classList.add('active');
}

if (tabLogin) tabLogin.addEventListener('click', showLogin);
if (tabRegister) tabRegister.addEventListener('click', showRegister);
if (tabLogin2) tabLogin2.addEventListener('click', showLogin);
if (tabRegister2) tabRegister2.addEventListener('click', showRegister);
if (btnNewUser) btnNewUser.addEventListener('click', showRegister);

const waFabBtn = document.getElementById('wa-fab-btn');
const waChatPopup = document.getElementById('wa-chat-popup');
const waChatClose = document.getElementById('wa-chat-close');
const waChatInput = document.getElementById('wa-chat-input');
const waChatSend = document.getElementById('wa-chat-send');
const waChatBody = document.getElementById('wa-chat-body');
const btnOrderStore = document.getElementById('btn-order-store');

let typingTimeout = null;
let hasTypedGreeting = false;

function playBotTyping() {
  const textEl = document.getElementById('wa-typewriter-text');
  const cursor = document.getElementById('wa-cursor');
  if (!textEl) return;

  const fullText = "Assalamualaikum! How can we help you today?";
  textEl.textContent = '';
  if (cursor) cursor.style.display = 'inline-block';

  let i = 0;
  clearInterval(typingTimeout);
  typingTimeout = setInterval(() => {
    if (i < fullText.length) {
      textEl.textContent += fullText.charAt(i);
      i++;
    } else {
      clearInterval(typingTimeout);
      if (cursor) cursor.style.display = 'none';
      hasTypedGreeting = true;
    }
  }, 35);
}

function openWaChat() {
  if(waChatPopup) waChatPopup.classList.add('active');
  if (!hasTypedGreeting) {
    playBotTyping();
  }
  setTimeout(() => {
    if (waChatInput) waChatInput.focus();
  }, 200);
}

if (waFabBtn) {
  waFabBtn.addEventListener('click', () => {
    if (waChatPopup.classList.contains('active')) {
      waChatPopup.classList.remove('active');
    } else {
      openWaChat();
    }
  });
}

if (btnOrderStore) {
  btnOrderStore.addEventListener('click', () => {
    openWaChat();
    if (waChatInput) {
      waChatInput.value = "Hello! I want to order the same store for myself.";
    }
  });
}

if (waChatClose) {
  waChatClose.addEventListener('click', () => {
    waChatPopup.classList.remove('active');
  });
}

function sendWaMessage() {
  const message = waChatInput.value.trim();
  if (!message) return;

  const sentBubble = document.createElement('div');
  sentBubble.className = 'wa-chat-bubble sent';
  sentBubble.textContent = message;
  waChatBody.appendChild(sentBubble);
  waChatBody.scrollTop = waChatBody.scrollHeight;

  waChatInput.value = '';

  const phoneNumber = '923104882921';
  const encodedMessage = encodeURIComponent(message);
  const waUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

  setTimeout(() => {
    window.open(waUrl, '_blank');
    waChatPopup.classList.remove('active');
  }, 500);
}

if (waChatSend) {
  waChatSend.addEventListener('click', sendWaMessage);
}

if (waChatInput) {
  waChatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendWaMessage();
    }
  });
}

window.copyClipboard = (text) => {
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    if(window.showToast) window.showToast('Link copied! 📋');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    if(window.showToast) window.showToast('Link copied! 📋');
  });
}
