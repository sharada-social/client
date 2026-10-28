/**
 * SHARADA PRIVATE MESSENGER & COMMUNITY
 * Invite-only, High-security client
 */

const API_BASE = window.location.origin;
let authToken = localStorage.getItem('sharada_token');
let currentUser = null;
let currentChannelId = null;
let wsConn = null;

// Сохраненные данные для 2-шаговой авторизации
let pendingLoginUsername = '';
let pendingLoginPassword = '';

// Кастомные настройки неактивности
let currentTimeoutMonths = 1;
let currentInactivityPolicy = 'delete';

// Auth UI
const authBackdrop = document.getElementById('authBackdrop');
const authCard = document.getElementById('authCard');
const authErrorMsg = document.getElementById('authErrorMsg');

const authStep1 = document.getElementById('authStep1');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const btnStep1Next = document.getElementById('btnStep1Next');

const authStepTOTP = document.getElementById('authStepTOTP');
const totpAccountLabel = document.getElementById('totpAccountLabel');
const loginTotpCode = document.getElementById('loginTotpCode');
const btnStep2Login = document.getElementById('btnStep2Login');
const btnBackToStep1 = document.getElementById('btnBackToStep1');

const authStepSetup2FA = document.getElementById('authStepSetup2FA');
const totpQrImg = document.getElementById('totpQrImg');
const totpSecretText = document.getElementById('totpSecretText');
const setupTotpInput = document.getElementById('setupTotpInput');
const btnConfirm2FASetup = document.getElementById('btnConfirm2FASetup');

// Views
const viewChats = document.getElementById('viewChats');
const viewSettings = document.getElementById('viewSettings');
const emptyChatState = document.getElementById('emptyChatState');
const activeChatWindow = document.getElementById('activeChatWindow');
const chatMainContent = document.getElementById('chatMainContent');
const mainContent = chatMainContent;

// Settings Left Sidebar Card
const settingsUserAvatar = document.getElementById('settingsUserAvatar');
const settingsUserDisplayName = document.getElementById('settingsUserDisplayName');
const settingsUserHandle = document.getElementById('settingsUserHandle');
const settingsUserRoleBadge = document.getElementById('settingsUserRoleBadge');
const settingsNavAccount = document.getElementById('settingsNavAccount');

// Chat UI
const chatList = document.getElementById('chatList');
const activeChatTitle = document.getElementById('activeChatTitle');
const activeChatAvatar = document.getElementById('activeChatAvatar');
const activeChatSubtitle = document.getElementById('activeChatSubtitle');
const activeChatE2EE = document.getElementById('activeChatE2EE');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const btnSendMessage = document.getElementById('btnSendMessage');
const btnBackToSidebarMobile = document.getElementById('btnBackToSidebarMobile');

// Tabs (Капсула-навбар)
const tabFeed = document.getElementById('tabFeed');
const tabChats = document.getElementById('tabChats');
const tabSettings = document.getElementById('tabSettings');

// Settings UI
const settingsUsernameDisplay = document.getElementById('settingsUsernameDisplay');
const settingsTrustDisplay = document.getElementById('settingsTrustDisplay');
const settingsBadgesList = document.getElementById('settingsBadgesList');
const dropdownTimeout = document.getElementById('dropdownTimeout');
const selectedTimeoutLabel = document.getElementById('selectedTimeoutLabel');
const dropdownPolicy = document.getElementById('dropdownPolicy');
const selectedPolicyLabel = document.getElementById('selectedPolicyLabel');
const adminSettingsSection = document.getElementById('adminSettingsSection');
const btnOpenAdminModal = document.getElementById('btnOpenAdminModal');
const btnLogoutSettings = document.getElementById('btnLogoutSettings');
const btnTriggerManualDelete = document.getElementById('btnTriggerManualDelete');

// Admin Modal
const adminModal = document.getElementById('adminModal');
const btnCloseAdminModal = document.getElementById('btnCloseAdminModal');
const newUsernameInput = document.getElementById('newUsernameInput');
const newUserTrustSelect = document.getElementById('newUserTrustSelect');
const btnAdminCreateUser = document.getElementById('btnAdminCreateUser');
const createdKeyBox = document.getElementById('createdKeyBox');
const rawKeyOutput = document.getElementById('rawKeyOutput');
const adminUsersList = document.getElementById('adminUsersList');
const adminLogsContainer = document.getElementById('adminLogsContainer');

// Delete Modal
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deletePassInput = document.getElementById('deletePassInput');
const deleteTotpInput = document.getElementById('deleteTotpInput');
const deleteModalError = document.getElementById('deleteModalError');
const btnCancelDeleteModal = document.getElementById('btnCancelDeleteModal');
const btnConfirmDeleteModal = document.getElementById('btnConfirmDeleteModal');

// Universal Custom Confirm Modal
const appConfirmModal = document.getElementById('appConfirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalDesc = document.getElementById('confirmModalDesc');
const btnConfirmModalCancel = document.getElementById('btnConfirmModalCancel');
const btnConfirmModalAction = document.getElementById('btnConfirmModalAction');
let onConfirmModalCallback = null;

// Search & New Chat Modal UI
const searchInput = document.getElementById('searchInput');
const btnOpenNewChatModal = document.getElementById('btnOpenNewChatModal');
const newChatModal = document.getElementById('newChatModal');
const btnCloseNewChatModal = document.getElementById('btnCloseNewChatModal');
const newChatSearchInput = document.getElementById('newChatSearchInput');
const btnActionNewGroup = document.getElementById('btnActionNewGroup');
const btnActionNFC = document.getElementById('btnActionNFC');
const btnActionE2EE = document.getElementById('btnActionE2EE');
const newChatSearchResults = document.getElementById('newChatSearchResults');

// New Group Modal
const newGroupModal = document.getElementById('newGroupModal');
const btnCloseNewGroupModal = document.getElementById('btnCloseNewGroupModal');
const newGroupNameInput = document.getElementById('newGroupNameInput');
const newGroupDescInput = document.getElementById('newGroupDescInput');
const btnCancelNewGroup = document.getElementById('btnCancelNewGroup');
const btnSubmitNewGroup = document.getElementById('btnSubmitNewGroup');

// Fullscreen NFC
const nfcFullscreenScreen = document.getElementById('nfcFullscreenScreen');
const btnCloseNFCFullscreen = document.getElementById('btnCloseNFCFullscreen');

// Caches & States
let cachedChannels = [];
let cachedContacts = JSON.parse(localStorage.getItem('sharada_contacts') || '[]');
let isNextChatE2EE = false;
let nfcAbortCtrl = null;

// ============================================================
// КАСТОМНЫЕ МОДАЛЬНЫЕ ОКНА (ВМЕСТО alert И confirm)
// ============================================================
function showAppDialog({ title, message, confirmText = 'ОК', cancelText = 'Отмена', isDanger = false, onConfirm = null }) {
  confirmModalTitle.textContent = title;
  confirmModalDesc.innerHTML = message;
  btnConfirmModalAction.textContent = confirmText;

  if (isDanger) {
    btnConfirmModalAction.className = 'btn-danger';
  } else {
    btnConfirmModalAction.className = 'btn-primary';
  }

  if (onConfirm) {
    btnConfirmModalCancel.style.display = 'block';
    btnConfirmModalCancel.textContent = cancelText;
    onConfirmModalCallback = onConfirm;
  } else {
    btnConfirmModalCancel.style.display = 'none';
    onConfirmModalCallback = null;
  }

  appConfirmModal.classList.add('active');
}

btnConfirmModalCancel.addEventListener('click', () => {
  appConfirmModal.classList.remove('active');
  onConfirmModalCallback = null;
});

btnConfirmModalAction.addEventListener('click', () => {
  appConfirmModal.classList.remove('active');
  if (onConfirmModalCallback) {
    onConfirmModalCallback();
    onConfirmModalCallback = null;
  }
});

// ============================================================
// ИНИЦИАЛИЗАЦИЯ И СЕРВЕРНЫЙ КОНТРОЛЬ СЕССИИ
// ============================================================
async function initApp() {
  initCustomDropdowns();

  if (authToken) {
    try {
      const res = await fetch(`${API_BASE}/api/user/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        currentUser = await res.json();
        onAuthSuccess();
        return;
      }
    } catch (e) {
      console.warn('Session verification error', e);
    }
  }

  authToken = null;
  localStorage.removeItem('sharada_token');
  showLoginStage(1);
}

function onAuthSuccess() {
  authBackdrop.classList.add('hidden');
  document.getElementById('userBadgeRole').textContent = currentUser.is_admin ? 'ADMIN' : `T${currentUser.trust_level}`;

  if (currentUser.is_admin) {
    adminSettingsSection.style.display = 'block';
  } else {
    adminSettingsSection.style.display = 'none';
  }

  initWebSocket();
  loadChannels();
  setupSettingsUI();
}

// ============================================================
// MICROSOFT-STYLE ПЛАВНАЯ АВТОРИЗАЦИЯ
// ============================================================
function showAuthError(text) {
  authErrorMsg.textContent = text;
  authErrorMsg.style.display = 'block';
}
function clearAuthError() {
  authErrorMsg.textContent = '';
  authErrorMsg.style.display = 'none';
}

function transitionAuthStep(fromEl, toEl) {
  clearAuthError();
  fromEl.classList.add('fade-out');
  setTimeout(() => {
    fromEl.classList.add('hidden-step');
    fromEl.classList.remove('fade-out');

    toEl.classList.remove('hidden-step');
    toEl.classList.add('fade-in');
  }, 220);
}

function showLoginStage(stage) {
  authBackdrop.classList.remove('hidden');
  clearAuthError();

  if (stage === 1) {
    authStep1.classList.remove('hidden-step', 'fade-out');
    authStepTOTP.classList.add('hidden-step');
    authStepSetup2FA.classList.add('hidden-step');
    loginUsername.focus();
  }
}

// ШАГ 1: Ввод логина и ключа
btnStep1Next.addEventListener('click', handleStep1);
loginPassword.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleStep1();
});

async function handleStep1() {
  clearAuthError();
  const username = loginUsername.value.trim();
  const password = loginPassword.value.trim();

  if (!username || !password) {
    showAuthError('Введите имя пользователя и ключ доступа');
    return;
  }

  btnStep1Next.disabled = true;
  btnStep1Next.innerHTML = '<span>Проверка...</span>';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    btnStep1Next.disabled = false;
    btnStep1Next.innerHTML = `<span>Далее</span><svg style="width:18px; height:18px; fill:currentColor;" viewBox="0 0 24 24"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z"/></svg>`;

    if (!res.ok) {
      showAuthError(data.message || 'Неверное имя пользователя или ключ');
      return;
    }

    pendingLoginUsername = username;
    pendingLoginPassword = password;

    // Аккаунт активен -> плавный переход к TOTP
    if (data.status === 'REQUIRE_2FA' || data.requires_totp) {
      totpAccountLabel.textContent = username;
      loginTotpCode.value = '';
      transitionAuthStep(authStep1, authStepTOTP);
      setTimeout(() => loginTotpCode.focus(), 250);
      return;
    }

    // Первый вход -> плавный переход к QR коду 2FA
    if (data.status === 'PENDING_2FA') {
      authToken = data.temp_session_token;
      totpQrImg.src = data.totp_qr_data_uri;
      totpSecretText.textContent = data.totp_secret;
      setupTotpInput.value = '';
      transitionAuthStep(authStep1, authStepSetup2FA);
      setTimeout(() => setupTotpInput.focus(), 250);
      return;
    }

    if (data.token) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('sharada_token', authToken);
      onAuthSuccess();
    }
  } catch (err) {
    btnStep1Next.disabled = false;
    btnStep1Next.innerHTML = `<span>Далее</span>`;
    showAuthError('Ошибка подключения к серверу Sharada');
  }
}

btnBackToStep1.addEventListener('click', () => {
  transitionAuthStep(authStepTOTP, authStep1);
});

// ШАГ 2: Подтверждение TOTP
btnStep2Login.addEventListener('click', handleStep2);
loginTotpCode.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleStep2();
});

async function handleStep2() {
  clearAuthError();
  const code = loginTotpCode.value.trim();

  if (code.length !== 6) {
    showAuthError('Введите 6 цифр из приложения аутентификации');
    return;
  }

  btnStep2Login.disabled = true;
  btnStep2Login.textContent = 'Вход...';

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: pendingLoginUsername,
        password: pendingLoginPassword,
        totp_code: code
      })
    });

    const data = await res.json();
    btnStep2Login.disabled = false;
    btnStep2Login.textContent = 'Войти в сеть';

    if (!res.ok) {
      showAuthError(data.message || 'Неверный код TOTP');
      return;
    }

    if (data.token) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('sharada_token', authToken);
      onAuthSuccess();
    }
  } catch (e) {
    btnStep2Login.disabled = false;
    btnStep2Login.textContent = 'Войти в сеть';
    showAuthError('Сетевая ошибка сервера');
  }
}

// ШАГ 3: Первичная привязка 2FA (для PENDING_2FA)
btnConfirm2FASetup.addEventListener('click', async () => {
  clearAuthError();
  const code = setupTotpInput.value.trim();

  if (code.length !== 6) {
    showAuthError('Введите 6-значный код для привязки');
    return;
  }

  btnConfirm2FASetup.disabled = true;
  btnConfirm2FASetup.textContent = 'Активация...';

  try {
    const res = await fetch(`${API_BASE}/api/auth/setup-2fa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ code })
    });

    const data = await res.json();
    btnConfirm2FASetup.disabled = false;
    btnConfirm2FASetup.textContent = 'Подтвердить и активировать';

    if (!res.ok) {
      showAuthError(data.message || 'Неверный код');
      return;
    }

    if (data.token) {
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('sharada_token', authToken);
      onAuthSuccess();
    } else {
      window.location.reload();
    }
  } catch (e) {
    btnConfirm2FASetup.disabled = false;
    btnConfirm2FASetup.textContent = 'Подтвердить и активировать';
    showAuthError('Ошибка подтверждения');
  }
});

// ============================================================
// ПЛАВНЫЙ ПЕРЕХОД МЕЖДУ СТРАНИЦАМИ (РАСТВОРЕНИЕ И ПОЯВЛЕНИЕ)
// ============================================================
let activeTabName = 'chats';

function switchView(targetName) {
  if (activeTabName === targetName) return;

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const fromView = activeTabName === 'chats' ? chatsView : settingsPanel;
  const toView = targetName === 'chats' ? chatsView : settingsPanel;
  const targetTab = targetName === 'chats' ? tabChats : tabSettings;

  targetTab.classList.add('active');

  // Плавное растворение текущего экрана
  fromView.classList.remove('view-fade-in');
  fromView.classList.add('view-fade-out');

  setTimeout(() => {
    fromView.style.display = 'none';
    fromView.classList.remove('view-fade-out');

    // Плавное появление нового экрана
    toView.style.display = targetName === 'chats' ? 'flex' : 'flex';
    toView.classList.add('view-fade-in');
    activeTabName = targetName;

    if (targetName === 'settings') {
      setupSettingsUI();
    }
  }, 180);
}

// Заблокированная кнопка ленты
tabFeed.addEventListener('click', () => {
  showAppDialog({
    title: 'Раздел в разработке',
    message: 'Лента сообщества находится на этапе закрытого тестирования и станет доступна в следующем обновлении Sharada.'
  });
});

tabChats.addEventListener('click', () => switchView('chats'));
tabSettings.addEventListener('click', () => switchView('settings'));

// Мобильная кнопка «← Назад к чатам»
btnBackToSidebarMobile.addEventListener('click', () => {
  mainContent.classList.remove('mobile-active');
});

// ============================================================
// КАСТОМНЫЕ ВЫПАДАЮЩИЕ МЕНЮ (CUSTOM SELECTS)
// ============================================================
function initCustomDropdowns() {
  // Дропдаун таймаута
  setupDropdown(dropdownTimeout, (val, text) => {
    selectedTimeoutLabel.textContent = text;
    currentTimeoutMonths = parseInt(val);
    saveUserSettings();
  });

  // Дропдаун действия
  setupDropdown(dropdownPolicy, (val, text) => {
    selectedPolicyLabel.textContent = text;
    currentInactivityPolicy = val;
    saveUserSettings();
  });

  // Закрытие при клике вне
  document.addEventListener('click', (e) => {
    if (!dropdownTimeout.contains(e.target)) dropdownTimeout.classList.remove('open');
    if (!dropdownPolicy.contains(e.target)) dropdownPolicy.classList.remove('open');
  });
}

function setupDropdown(container, onChange) {
  const trigger = container.querySelector('.dropdown-trigger');
  const items = container.querySelectorAll('.dropdown-item');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    // Закрываем другие дропдауны
    document.querySelectorAll('.custom-dropdown').forEach(d => {
      if (d !== container) d.classList.remove('open');
    });
    container.classList.toggle('open');
  });

  items.forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      items.forEach(it => it.classList.remove('active'));
      item.classList.add('active');
      container.classList.remove('open');
      onChange(item.dataset.value, item.textContent);
    });
  });
}

// ============================================================
// ЧАТЫ И СООБЩЕНИЯ
// ============================================================
async function loadChannels() {
  if (!authToken) return;
  try {
    const res = await fetch(`${API_BASE}/api/channels`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('sharada_token');
        showLoginStage(1);
      }
      return;
    }
    const channels = await res.json();
    cachedChannels = channels || [];
    renderChannelList(cachedChannels);
  } catch (e) {
    console.error('Failed to load channels', e);
  }
}

function renderChannelList(channels) {
  chatList.innerHTML = '';
  if (!channels || channels.length === 0) {
    chatList.innerHTML = '<div style="color:var(--text-sub); text-align:center; padding:20px;">Нет каналов</div>';
    return;
  }

  channels.forEach(ch => {
    const item = document.createElement('div');
    item.className = `chat-item ${ch.id === currentChannelId ? 'active' : ''}`;
    const initial = ch.name ? ch.name.charAt(0).toUpperCase() : '#';

    item.innerHTML = `
      <div class="avatar" style="${ch.is_e2ee ? 'background:linear-gradient(135deg, #10b981, #059669);' : ''}">
        ${initial}
      </div>
      <div class="chat-info">
        <div class="chat-header-row">
          <span class="chat-name">
            ${escapeHtml(ch.name)}
            ${ch.is_e2ee ? '<span class="badge badge-e2ee">E2EE</span>' : ''}
          </span>
        </div>
        <span class="chat-last-msg">${escapeHtml(ch.description || 'Приватный диалог')}</span>
      </div>
    `;

    item.addEventListener('click', () => openChat(ch));
    chatList.appendChild(item);
  });
}

function openChat(channel) {
  currentChannelId = channel.id;
  switchAppView('chats');

  emptyChatState.style.display = 'none';
  activeChatWindow.style.display = 'flex';

  // Для мобильных разворачиваем чат на весь экран
  if (mainContent) mainContent.classList.add('mobile-active');

  activeChatTitle.textContent = channel.name;
  activeChatAvatar.textContent = channel.name.charAt(0).toUpperCase();
  activeChatE2EE.style.display = channel.is_e2ee ? 'inline-flex' : 'none';
  activeChatSubtitle.textContent = channel.type === 'direct' ? 'прямой приватный диалог' : 'групповой канал';

  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));

  loadMessages(channel.id);
}

async function loadMessages(channelId) {
  messagesContainer.innerHTML = '';
  try {
    const res = await fetch(`${API_BASE}/api/channels/${channelId}/messages`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const msgs = await res.json();
    if (msgs && msgs.length > 0) {
      msgs.forEach(m => appendMessageToUI(m));
    } else {
      messagesContainer.innerHTML = '<div style="text-align:center; color:var(--text-sub); margin:auto 0;">История сообщений пуста. Начните диалог!</div>';
    }
  } catch (e) {
    console.error('Load messages error', e);
  }
}

function appendMessageToUI(msg) {
  const isMine = msg.sender_id === currentUser?.id;
  const bubble = document.createElement('div');
  bubble.className = `message-bubble ${isMine ? 'outgoing' : 'incoming'}`;
  const timeStr = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.innerHTML = `
    ${!isMine ? `<div class="message-author">${escapeHtml(msg.sender_name || 'Собеседник')}</div>` : ''}
    <div class="message-text">${escapeHtml(msg.content)}</div>
    <div class="message-meta">
      <span>${timeStr}</span>
      ${isMine ? '<span>✓✓</span>' : ''}
    </div>
  `;

  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !currentChannelId) return;

  messageInput.value = '';

  try {
    await fetch(`${API_BASE}/api/channels/${currentChannelId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ content: text, is_e2ee: false })
    });
  } catch (e) {
    console.error('Send error', e);
  }
}

btnSendMessage.addEventListener('click', sendMessage);
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendMessage();
  }
});

// Создание обычного или E2EE прямого диалога
async function createDirectChat(targetUsername, isE2EE = false) {
  if (!targetUsername) return;
  try {
    // 1. Попытка создания через прямой API каналов
    const res = await fetch(`${API_BASE}/api/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: targetUsername,
        description: isE2EE ? 'Защищенный E2EE чат' : 'Приватный диалог',
        type: 'direct',
        is_e2ee: isE2EE,
        member_ids: []
      })
    });

    if (res.ok) {
      const newChan = await res.json();
      await loadChannels();
      openChat(newChan);
      closeAllNewModals();
      return;
    }

    // 2. Fallback через быстрый коннект
    const res2 = await fetch(`${API_BASE}/api/nfc/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ target_username: targetUsername })
    });

    if (res2.ok) {
      const data = await res2.json();
      await loadChannels();
      const existing = cachedChannels.find(c => c.id === data.channel_id) || {
        id: data.channel_id,
        name: targetUsername,
        type: 'direct',
        is_e2ee: isE2EE
      };
      openChat(existing);
      closeAllNewModals();
    } else {
      const err = await res2.json().catch(() => ({}));
      showAppDialog({ title: 'Ошибка', message: err.message || 'Пользователь не найден или недоступен.' });
    }
  } catch (e) {
    console.error('Create direct chat error', e);
    showAppDialog({ title: 'Ошибка', message: 'Ошибка создания диалога' });
  }
}

function closeAllNewModals() {
  newChatModal.classList.remove('active');
  newGroupModal.classList.remove('active');
  nfcFullscreenScreen.classList.remove('active');
  if (searchInput) searchInput.value = '';
}

// ============================================================
// СЕГМЕНТИРОВАННЫЙ ПОИСК В СПИСКЕ ЧАТОВ (САЙДБАР)
// ============================================================
let searchDebounce = null;
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      renderChannelList(cachedChannels);
      return;
    }
    searchDebounce = setTimeout(() => {
      performSegmentedSearch(query);
    }, 250);
  });
}

async function performSegmentedSearch(q) {
  chatList.innerHTML = '';

  // 1. Секция: Мои чаты
  const myChats = cachedChannels.filter(c => c.name.toLowerCase().includes(q));
  if (myChats.length > 0) {
    const secHeader = document.createElement('div');
    secHeader.className = 'search-section-header';
    secHeader.textContent = 'Мои чаты';
    chatList.appendChild(secHeader);

    myChats.forEach(ch => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <div class="avatar">${ch.name.charAt(0).toUpperCase()}</div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(ch.name)} ${ch.is_e2ee ? '<span class="badge badge-e2ee">E2EE</span>' : ''}</div>
          <div class="search-result-sub">${escapeHtml(ch.description || 'Чат')}</div>
        </div>
      `;
      item.addEventListener('click', () => openChat(ch));
      chatList.appendChild(item);
    });
  }

  // 2. Секция: Контакты
  const matchedContacts = cachedContacts.filter(c =>
    c.name.toLowerCase().includes(q) || (c.tel && c.tel.includes(q))
  );

  const secContactsHeader = document.createElement('div');
  secContactsHeader.className = 'search-section-header';
  secContactsHeader.textContent = 'Контакты устройства';
  chatList.appendChild(secContactsHeader);

  if (matchedContacts.length > 0) {
    matchedContacts.forEach(ct => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <div class="avatar" style="background:var(--grad-blue);">${ct.name.charAt(0).toUpperCase()}</div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(ct.name)}</div>
          <div class="search-result-sub">${escapeHtml(ct.tel || ct.email || 'Контакт')}</div>
        </div>
      `;
      item.addEventListener('click', () => createDirectChat(ct.name, false));
      chatList.appendChild(item);
    });
  } else {
    // Предложение разрешить контакты
    const askItem = document.createElement('div');
    askItem.className = 'search-result-item';
    askItem.style.border = '1px dashed rgba(255, 255, 255, 0.2)';
    askItem.innerHTML = `
      <div class="avatar" style="background:#222;">+</div>
      <div class="search-result-info">
        <div class="search-result-name" style="font-size:13px; color:#ff7878;">Разрешить доступ к контактам</div>
        <div class="search-result-sub">Синхронизировать адресную книгу устройства</div>
      </div>
    `;
    askItem.addEventListener('click', async () => {
      await requestDeviceContacts();
      performSegmentedSearch(q);
    });
    chatList.appendChild(askItem);
  }

  // 3. Секция: Глобальный поиск
  try {
    const res = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(q)}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      const globalUsers = await res.json();
      if (globalUsers && globalUsers.length > 0) {
        const secGlobalHeader = document.createElement('div');
        secGlobalHeader.className = 'search-section-header';
        secGlobalHeader.textContent = 'Глобальный поиск';
        chatList.appendChild(secGlobalHeader);

        globalUsers.forEach(u => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.innerHTML = `
            <div class="avatar" style="background:var(--grad-purple);">${u.username.charAt(0).toUpperCase()}</div>
            <div class="search-result-info">
              <div class="search-result-name">${escapeHtml(u.username)}</div>
              <div class="search-result-sub">Пользователь Sharada</div>
            </div>
          `;
          item.addEventListener('click', () => createDirectChat(u.username, false));
          chatList.appendChild(item);
        });
      }
    }
  } catch (e) {
    console.error('Global search error', e);
  }
}

// Запрос доступа к контактам устройства
async function requestDeviceContacts() {
  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const props = ['name', 'tel', 'email'];
      const contacts = await navigator.contacts.select(props, { multiple: true });
      if (contacts && contacts.length > 0) {
        cachedContacts = contacts.map(c => ({
          name: (c.name && c.name[0]) ? c.name[0] : 'Контакт',
          tel: (c.tel && c.tel[0]) ? c.tel[0] : '',
          email: (c.email && c.email[0]) ? c.email[0] : ''
        }));
        localStorage.setItem('sharada_contacts', JSON.stringify(cachedContacts));
        showAppDialog({ title: 'Контакты', message: `Успешно загружено контактов: ${cachedContacts.length}` });
      }
    } catch (e) {
      console.warn('Contacts select error', e);
    }
  } else {
    showAppDialog({
      title: 'Контакты устройства',
      message: 'Прямой доступ к телефонной книге поддерживается на мобильных устройствах Android/iOS в поддерживаемых браузерах.'
    });
  }
}

// ============================================================
// МОДАЛКА: НОВОЕ СООБЩЕНИЕ И NFC
// ============================================================
// 1. Проверка чипа NFC на устройстве
const isNfcSupported = 'NDEFReader' in window;
if (btnActionNFC) {
  btnActionNFC.style.display = isNfcSupported ? 'flex' : 'none';
}

// Открытие модалки по плюсику
btnOpenNewChatModal.addEventListener('click', () => {
  isNextChatE2EE = false;
  btnActionE2EE.style.borderColor = 'rgba(255, 255, 255, 0.08)';
  newChatSearchInput.value = '';
  newChatSearchResults.innerHTML = '';
  newChatModal.classList.add('active');
});

btnCloseNewChatModal.addEventListener('click', () => {
  newChatModal.classList.remove('active');
});

// Кнопка: Новая Группа
btnActionNewGroup.addEventListener('click', () => {
  newChatModal.classList.remove('active');
  newGroupNameInput.value = '';
  newGroupDescInput.value = '';
  newGroupModal.classList.add('active');
});

btnCloseNewGroupModal.addEventListener('click', () => {
  newGroupModal.classList.remove('active');
});
btnCancelNewGroup.addEventListener('click', () => {
  newGroupModal.classList.remove('active');
});

btnSubmitNewGroup.addEventListener('click', async () => {
  const gName = newGroupNameInput.value.trim();
  const gDesc = newGroupDescInput.value.trim();
  if (!gName) {
    showAppDialog({ title: 'Ошибка', message: 'Введите название новой группы' });
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/api/channels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: gName,
        description: gDesc || 'Приватный групповой чат',
        type: 'group',
        is_e2ee: false,
        member_ids: []
      })
    });
    if (res.ok) {
      const ch = await res.json();
      newGroupModal.classList.remove('active');
      await loadChannels();
      openChat(ch);
    } else {
      showAppDialog({ title: 'Ошибка', message: 'Не удалось создать группу' });
    }
  } catch (e) {
    showAppDialog({ title: 'Ошибка сети', message: 'Ошибка при создании группы' });
  }
});

// Кнопка: E2EE Чат (переключатель)
btnActionE2EE.addEventListener('click', () => {
  isNextChatE2EE = !isNextChatE2EE;
  btnActionE2EE.style.borderColor = isNextChatE2EE ? '#10b981' : 'rgba(255, 255, 255, 0.08)';
  showAppDialog({
    title: 'Режим E2EE',
    message: isNextChatE2EE
      ? 'Включен режим сквозного шифрования (E2EE). Выберите контакт или найдите пользователя ниже для создания защищенного чата.'
      : 'Режим E2EE отключен. Будет создан обычный диалог.'
  });
});

// Кнопка: Создать Через NFC
btnActionNFC.addEventListener('click', () => {
  newChatModal.classList.remove('active');
  nfcFullscreenScreen.classList.add('active');
  startNfcSession();
});

btnCloseNFCFullscreen.addEventListener('click', () => {
  nfcFullscreenScreen.classList.remove('active');
  stopNfcSession();
});

// Логика работы NFC сессии
async function startNfcSession() {
  if (!('NDEFReader' in window)) return;
  try {
    nfcAbortCtrl = new AbortController();
    const ndef = new NDEFReader();
    await ndef.scan({ signal: nfcAbortCtrl.signal });

    ndef.onreading = async (event) => {
      const decoder = new TextDecoder();
      let peerUsername = '';
      for (const record of event.message.records) {
        peerUsername = decoder.decode(record.data);
      }
      if (peerUsername && peerUsername !== currentUser?.username) {
        nfcFullscreenScreen.classList.remove('active');
        createDirectChat(peerUsername, false);
      }
    };

    if (currentUser?.username) {
      await ndef.write(currentUser.username, { signal: nfcAbortCtrl.signal });
    }
  } catch (e) {
    console.log('NFC error or aborted', e);
  }
}

function stopNfcSession() {
  if (nfcAbortCtrl) {
    nfcAbortCtrl.abort();
    nfcAbortCtrl = null;
  }
}

// Поиск внутри модалки нового сообщения
let modalSearchDebounce = null;
if (newChatSearchInput) {
  newChatSearchInput.addEventListener('input', () => {
    clearTimeout(modalSearchDebounce);
    const q = newChatSearchInput.value.trim().toLowerCase();
    if (!q) {
      newChatSearchResults.innerHTML = '';
      return;
    }
    modalSearchDebounce = setTimeout(async () => {
      newChatSearchResults.innerHTML = '';

      // Поиск по контактам
      const matched = cachedContacts.filter(c => c.name.toLowerCase().includes(q));
      matched.forEach(ct => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div class="avatar" style="background:var(--grad-blue);">${ct.name.charAt(0).toUpperCase()}</div>
          <div class="search-result-info">
            <div class="search-result-name">${escapeHtml(ct.name)}</div>
            <div class="search-result-sub">${escapeHtml(ct.tel || 'Контакт')}</div>
          </div>
        `;
        item.addEventListener('click', () => createDirectChat(ct.name, isNextChatE2EE));
        newChatSearchResults.appendChild(item);
      });

      // Глобальный поиск
      try {
        const res = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(q)}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (res.ok) {
          const users = await res.json();
          users.forEach(u => {
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.innerHTML = `
              <div class="avatar" style="background:var(--grad-purple);">${u.username.charAt(0).toUpperCase()}</div>
              <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(u.username)}</div>
                <div class="search-result-sub">Пользователь Sharada</div>
              </div>
            `;
            item.addEventListener('click', () => createDirectChat(u.username, isNextChatE2EE));
            newChatSearchResults.appendChild(item);
          });
        }
      } catch (e) {
        console.error('Modal global search error', e);
      }
    }, 250);
  });
}

// ============================================================
// WEBSOCKET РЕАЛЬНОГО ВРЕМЕНИ
// ============================================================
function initWebSocket() {
  if (!authToken) return;
  const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProto}//${window.location.host}/ws?token=${authToken}`;

  wsConn = new WebSocket(wsUrl);

  wsConn.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'message' && msg.channel_id === currentChannelId) {
        const messageData = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        appendMessageToUI(messageData);
      }
    } catch (e) {
      console.warn('WS message parse error', e);
    }
  };

  wsConn.onclose = () => {
    setTimeout(initWebSocket, 3000);
  };
}

// ============================================================
// НАСТРОЙКИ И ВЫХОД
// ============================================================
function setupSettingsUI() {
  if (!currentUser) return;

  const displayName = currentUser.display_name || currentUser.username;
  if (settingsUserDisplayName) settingsUserDisplayName.textContent = displayName;
  if (settingsUserHandle) settingsUserHandle.textContent = `@${currentUser.username}`;
  if (settingsUserAvatar) settingsUserAvatar.textContent = (displayName || 'A').charAt(0).toUpperCase();

  const isAdmin = !!currentUser.is_admin;
  if (settingsUserRoleBadge) {
    settingsUserRoleBadge.style.display = isAdmin ? 'inline-flex' : 'none';
    settingsUserRoleBadge.textContent = isAdmin ? 'ADMIN' : 'USER';
  }

  if (settingsUsernameDisplay) settingsUsernameDisplay.textContent = currentUser.username;
  const trustNames = ['untrusted (0)', 'trusted (1)', 'force_trusted (2)'];
  if (settingsTrustDisplay) settingsTrustDisplay.textContent = `Уровень доверия: ${trustNames[currentUser.trust_level] || '0'}`;

  if (currentUser.roles && settingsBadgesList) {
    settingsBadgesList.textContent = currentUser.roles.map(r => r.name).join(', ') || (isAdmin ? 'ADMIN' : 'Стандартные');
  }

  currentTimeoutMonths = currentUser.inactivity_timeout_months || 1;
  currentInactivityPolicy = currentUser.inactivity_policy || 'delete';

  if (selectedTimeoutLabel) selectedTimeoutLabel.textContent = `${currentTimeoutMonths} ${currentTimeoutMonths === 1 ? 'месяц' : 'месяца'}`;
  if (selectedPolicyLabel) selectedPolicyLabel.textContent = currentInactivityPolicy === 'delete' ? 'Полное удаление' : 'Архивация';

  // Обновляем активные элементы в меню
  if (dropdownTimeout) {
    dropdownTimeout.querySelectorAll('.dropdown-item').forEach(it => {
      it.classList.toggle('active', parseInt(it.dataset.value) === currentTimeoutMonths);
    });
  }
  if (dropdownPolicy) {
    dropdownPolicy.querySelectorAll('.dropdown-item').forEach(it => {
      it.classList.toggle('active', it.dataset.value === currentInactivityPolicy);
    });
  }

  if (adminSettingsSection) {
    adminSettingsSection.style.display = isAdmin ? 'block' : 'none';
  }
}

function switchAppView(viewName) {
  if (viewName === 'chats') {
    if (viewChats) viewChats.style.display = 'flex';
    if (viewSettings) viewSettings.style.display = 'none';
    if (tabChats) tabChats.classList.add('active');
    if (tabSettings) tabSettings.classList.remove('active');
  } else if (viewName === 'settings') {
    if (viewChats) viewChats.style.display = 'none';
    if (viewSettings) viewSettings.style.display = 'flex';
    if (tabSettings) tabSettings.classList.add('active');
    if (tabChats) tabChats.classList.remove('active');
    setupSettingsUI();
  }
}

if (tabChats) tabChats.addEventListener('click', () => switchAppView('chats'));
if (tabSettings) tabSettings.addEventListener('click', () => switchAppView('settings'));

if (btnBackToSidebarMobile) {
  btnBackToSidebarMobile.addEventListener('click', () => {
    if (chatMainContent) chatMainContent.classList.remove('mobile-active');
  });
}

async function saveUserSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/user/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        inactivity_timeout_months: currentTimeoutMonths,
        inactivity_policy: currentInactivityPolicy
      })
    });
    if (res.ok) {
      currentUser = await res.json();
    }
  } catch (e) {
    console.error('Save settings error', e);
  }
}

// Выход из учетной записи через кастомную модалку
btnLogoutSettings.addEventListener('click', () => {
  showAppDialog({
    title: 'Выход из учетной записи',
    message: 'Вы уверены, что хотите завершить сессию Sharada на этом устройстве?',
    confirmText: 'Выйти',
    isDanger: true,
    onConfirm: () => {
      localStorage.removeItem('sharada_token');
      window.location.reload();
    }
  });
});

// Ручное удаление аккаунта
btnTriggerManualDelete.addEventListener('click', () => {
  deleteConfirmModal.classList.add('active');
});
btnCancelDeleteModal.addEventListener('click', () => {
  deleteConfirmModal.classList.remove('active');
  deleteModalError.style.display = 'none';
});

btnConfirmDeleteModal.addEventListener('click', async () => {
  deleteModalError.style.display = 'none';
  const password = deletePassInput.value.trim();
  const totpCode = deleteTotpInput.value.trim();

  if (!password || !totpCode) {
    deleteModalError.textContent = 'Введите ключ доступа и TOTP код';
    deleteModalError.style.display = 'block';
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/user/me/delete-account`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ password, totp_code: totpCode })
    });

    const data = await res.json();
    if (!res.ok) {
      deleteModalError.textContent = data.message || 'Ошибка удаления';
      deleteModalError.style.display = 'block';
      return;
    }

    deleteConfirmModal.classList.remove('active');
    showAppDialog({
      title: 'Учетная запись деактивирована',
      message: 'Все сессии завершены. Аккаунт отправлен в архив на 7 дней. В течение этого срока удаление можно отменить через администратора.',
      confirmText: 'Понятно',
      onConfirm: () => {
        localStorage.removeItem('sharada_token');
        window.location.reload();
      }
    });
  } catch (e) {
    deleteModalError.textContent = 'Ошибка выполнения';
    deleteModalError.style.display = 'block';
  }
});

// ============================================================
// ПАНЕЛЬ АДМИНИСТРАТОРА (В НАСТРОЙКАХ)
// ============================================================
btnOpenAdminModal.addEventListener('click', () => {
  adminModal.classList.add('active');
  loadAdminData();
});
btnCloseAdminModal.addEventListener('click', () => {
  adminModal.classList.remove('active');
});

async function loadAdminData() {
  if (!currentUser?.is_admin) return;

  try {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const users = await res.json();
    renderAdminUsers(users);

    const logsRes = await fetch(`${API_BASE}/api/admin/logs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const logs = await logsRes.json();
    renderAdminLogs(logs);
  } catch (e) {
    console.error('Admin data error', e);
  }
}

function renderAdminUsers(users) {
  adminUsersList.innerHTML = '';
  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'settings-row';

    let statusBadge = `<span class="badge" style="background:#22c55e22; color:#22c55e;">${u.status}</span>`;
    if (u.status === 'INVITED') statusBadge = `<span class="badge" style="background:#f59e0b22; color:#f59e0b;">INVITED (48h)</span>`;
    if (u.status === 'PENDING_2FA') statusBadge = `<span class="badge" style="background:#a855f722; color:#a855f7;">PENDING_2FA (24h)</span>`;
    if (u.status === 'ARCHIVED') statusBadge = `<span class="badge" style="background:#ef444422; color:#ef4444;">ARCHIVED</span>`;

    row.innerHTML = `
      <div class="settings-row-left">
        <div class="avatar" style="width:36px; height:36px; font-size:14px;">${u.username.charAt(0).toUpperCase()}</div>
        <div class="settings-row-info">
          <div class="settings-row-title">${escapeHtml(u.username)} ${u.is_admin ? '<span class="badge badge-admin">ADMIN</span>' : ''}</div>
          <div class="settings-row-desc">Траст: ${u.trust_level} | ${statusBadge}</div>
        </div>
      </div>
      <div class="settings-row-right">
        ${u.is_archived ? `<button class="action-pill-btn" onclick="adminUnarchive('${u.id}')">Разархивировать</button>` : ''}
        ${!u.is_admin ? `<button class="action-pill-btn" style="color:#ef4444;" onclick="adminPurge('${u.id}')">Уничтожить</button>` : ''}
      </div>
    `;
    adminUsersList.appendChild(row);
  });
}

function renderAdminLogs(logs) {
  adminLogsContainer.innerHTML = '';
  logs.forEach(l => {
    const item = document.createElement('div');
    item.style.fontSize = '12px';
    item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    item.style.padding = '6px 0';
    item.style.fontFamily = 'monospace';
    item.innerHTML = `
      <span style="color:#a771da;">[${new Date(l.created_at).toLocaleTimeString()}]</span>
      <b style="color:#fff;">${escapeHtml(l.event_type)}</b>: ${escapeHtml(l.username_snapshot || l.user_id)}
    `;
    adminLogsContainer.appendChild(item);
  });
}

btnAdminCreateUser.addEventListener('click', async () => {
  const username = newUsernameInput.value.trim();
  const trustLevel = parseInt(newUserTrustSelect.value);

  if (!username) {
    showAppDialog({ title: 'Предупреждение', message: 'Введите имя пользователя' });
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ username, trust_level: trustLevel })
    });

    const data = await res.json();
    if (!res.ok) {
      showAppDialog({ title: 'Ошибка создания', message: data.message || 'Ошибка сервера' });
      return;
    }

    createdKeyBox.style.display = 'block';
    rawKeyOutput.textContent = data.raw_key;
    newUsernameInput.value = '';

    loadAdminData();
  } catch (e) {
    showAppDialog({ title: 'Ошибка', message: 'Ошибка сети при создании' });
  }
});

window.adminUnarchive = async (targetUserId) => {
  await fetch(`${API_BASE}/api/admin/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
    body: JSON.stringify({ user_id: targetUserId, target_user_id: targetUserId, action: 'unarchive' })
  });
  loadAdminData();
};

window.adminPurge = (targetUserId) => {
  showAppDialog({
    title: 'Уничтожение аккаунта',
    message: 'Полностью стереть эту учетную запись и все её сообщения/посты из базы данных навсегда? (Глубокие системные логи сохранятся).',
    confirmText: 'Уничтожить навсегда',
    isDanger: true,
    onConfirm: async () => {
      await fetch(`${API_BASE}/api/admin/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ user_id: targetUserId, target_user_id: targetUserId, action: 'purge' })
      });
      loadAdminData();
    }
  });
};

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// Запуск приложения
initApp();
