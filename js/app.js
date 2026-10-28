/**
 * Sharada Messenger - Main Entry Point & Smooth Navigation
 */
import { API_BASE } from './api.js';
import { initAuth, checkSession } from './auth.js';
import { loadChannels, initWebSocket, initChatEvents, setSwitchToChatsCallback } from './chats.js';
import { initSearch } from './search.js';
import { initNFC } from './nfc.js';
import { initSettings, setupSettingsUI } from './settings.js';
import { showAppDialog } from './modals.js';
import { initConnectionManager, updateHeaderConnectionText, getConnectionState } from './connection.js';

const viewChats = document.getElementById('viewChats');
const viewSettings = document.getElementById('viewSettings');
const tabChats = document.getElementById('tabChats');
const tabSettings = document.getElementById('tabSettings');
const tabFeed = document.getElementById('tabFeed');
const chatMainContent = document.getElementById('chatMainContent');
const btnBackToSidebarMobile = document.getElementById('btnBackToSidebarMobile');

// New Chat Modal
const btnOpenNewChatModal = document.getElementById('btnOpenNewChatModal');
const newChatModal = document.getElementById('newChatModal');
const btnCloseNewChatModal = document.getElementById('btnCloseNewChatModal');
const btnActionNewGroup = document.getElementById('btnActionNewGroup');
const btnActionE2EE = document.getElementById('btnActionE2EE');
const newGroupModal = document.getElementById('newGroupModal');

window.isNextChatE2EESelected = false;
let currentActiveView = 'chats';
let isSwitching = false;

// Плавный переход между страницами:
// 1. Плавное растворение старого контента (fade-out + blur)
// 2. Плавное изменение размера окна с контентом
// 3. Плавное проявление нового контента (fade-in)
export function switchAppView(viewName) {
  if (currentActiveView === viewName || isSwitching) return;
  isSwitching = true;

  const screenContainer = document.querySelector('.screen-container');
  const currentViewEl = currentActiveView === 'chats' ? viewChats : viewSettings;
  const targetViewEl = viewName === 'chats' ? viewChats : viewSettings;

  // Фаза 1: Плавное растворение текущей страницы
  if (currentViewEl) {
    currentViewEl.classList.remove('page-fade-in');
    currentViewEl.classList.add('page-fade-out');
  }

  // Обновляем состояние табов в навбаре
  if (viewName === 'chats') {
    tabChats.classList.add('active');
    tabSettings.classList.remove('active');
  } else {
    tabSettings.classList.add('active');
    tabChats.classList.remove('active');
  }

  // Фаза 2: Изменение ширины окна экрана и проявление нового контента
  setTimeout(() => {
    if (screenContainer) {
      if (viewName === 'settings') {
        screenContainer.classList.add('mode-settings');
      } else {
        screenContainer.classList.remove('mode-settings');
      }
    }

    if (currentViewEl) {
      currentViewEl.classList.remove('active');
      currentViewEl.classList.remove('page-fade-out');
      currentViewEl.style.display = 'none';
    }

    if (targetViewEl) {
      targetViewEl.style.display = 'flex';
      targetViewEl.classList.add('active');
      targetViewEl.classList.add('page-fade-in');
    }

    currentActiveView = viewName;
    if (viewName === 'settings') {
      document.body.classList.remove('in-chat-mobile');
      setupSettingsUI();
    } else if (viewName === 'chats') {
      updateHeaderConnectionText();
    }

    setTimeout(() => {
      if (targetViewEl) targetViewEl.classList.remove('page-fade-in');
      isSwitching = false;
    }, 320);
  }, 220);
}

setSwitchToChatsCallback(() => switchAppView('chats'));

function onAuthSuccess(user) {
  try {
    const backdrop = document.getElementById('authBackdrop');
    if (backdrop) backdrop.classList.add('hidden');
    document.body.classList.remove('auth-mode');

    const sidebarUsername = document.getElementById('sidebarUsername');
    if (sidebarUsername && user) {
      if (getConnectionState() === 'connected') {
        sidebarUsername.textContent = user.username;
      } else {
        updateHeaderConnectionText();
      }
    }

    const userBadgeRole = document.getElementById('userBadgeRole');
    if (userBadgeRole && user) {
      userBadgeRole.textContent = user.is_admin ? 'ADMIN' : `T${user.trust_level}`;
    }
  } catch (e) {
    console.warn('Error updating user info UI', e);
  }

  try { initWebSocket(); } catch (e) { console.warn('WS init error', e); }
  try { loadChannels(); } catch (e) { console.warn('Load channels error', e); }
  try { setupSettingsUI(); } catch (e) { console.warn('Settings UI error', e); }
}
window.sharadaOnAuthSuccess = onAuthSuccess;

// Инициализация приложения
async function initApp() {
  initAuth(onAuthSuccess);
  initChatEvents();
  initSearch();
  initNFC();
  initSettings();
  initConnectionManager();

  // Навигация по табам капсулы
  if (tabChats) tabChats.addEventListener('click', () => switchAppView('chats'));
  if (tabSettings) tabSettings.addEventListener('click', () => switchAppView('settings'));
  if (tabFeed) {
    tabFeed.addEventListener('click', () => {
      showAppDialog({
        title: 'Раздел в разработке',
        message: 'Лента постов закрытого сообщества находится на этапе закрытого тестирования.'
      });
    });
  }

  // Кнопка назад на мобилках
  if (btnBackToSidebarMobile) {
    btnBackToSidebarMobile.addEventListener('click', () => {
      if (chatMainContent) chatMainContent.classList.remove('mobile-active');
      document.body.classList.remove('in-chat-mobile');
    });
  }

  // Модалка создания чата
  if (btnOpenNewChatModal) {
    btnOpenNewChatModal.addEventListener('click', () => {
      window.isNextChatE2EESelected = false;
      if (btnActionE2EE) btnActionE2EE.style.borderColor = 'rgba(255, 255, 255, 0.08)';
      const newChatSearchInput = document.getElementById('newChatSearchInput');
      const newChatSearchResults = document.getElementById('newChatSearchResults');
      if (newChatSearchInput) newChatSearchInput.value = '';
      if (newChatSearchResults) newChatSearchResults.innerHTML = '';
      if (newChatModal) newChatModal.classList.add('active');
    });
  }

  if (btnCloseNewChatModal) {
    btnCloseNewChatModal.addEventListener('click', () => {
      if (newChatModal) newChatModal.classList.remove('active');
    });
  }

  if (btnActionNewGroup) {
    btnActionNewGroup.addEventListener('click', () => {
      if (newChatModal) newChatModal.classList.remove('active');
      const newGroupNameInput = document.getElementById('newGroupNameInput');
      const newGroupDescInput = document.getElementById('newGroupDescInput');
      if (newGroupNameInput) newGroupNameInput.value = '';
      if (newGroupDescInput) newGroupDescInput.value = '';
      if (newGroupModal) newGroupModal.classList.add('active');
    });
  }

  if (btnActionE2EE) {
    btnActionE2EE.addEventListener('click', () => {
      window.isNextChatE2EESelected = !window.isNextChatE2EESelected;
      btnActionE2EE.style.borderColor = window.isNextChatE2EESelected ? '#10b981' : 'rgba(255, 255, 255, 0.08)';
      showAppDialog({
        title: 'Режим E2EE',
        message: window.isNextChatE2EESelected
          ? 'Включен режим сквозного шифрования (E2EE). Выберите контакт или найдите пользователя ниже для создания защищенного чата.'
          : 'Режим E2EE отключен. Будет создан обычный диалог.'
      });
    });
  }

  // Экран загрузки: подключение к серверу -> проверка сессии -> показ страницы
  await runStartupSequence();
}

async function runStartupSequence() {
  const appSplashScreen = document.getElementById('appSplashScreen');
  const splashStatusText = document.getElementById('splashStatusText');

  const hideSplash = () => {
    if (appSplashScreen && !appSplashScreen.classList.contains('hidden')) {
      appSplashScreen.classList.add('hidden');
    }
  };

  // Жесткий таймер безопасности: максимум 2 секунды, чтобы интерфейс ни при каких условиях не зависал
  const emergencyTimer = setTimeout(hideSplash, 2000);

  // Проверка протокола file:// (браузеры блокируют CORS и модули при открытии файла напрямую)
  if (window.location.protocol === 'file:') {
    clearTimeout(emergencyTimer);
    hideSplash();
    alert('Внимание: Sharada не может работать через протокол file://. Пожалуйста, откройте мессенджер через локальный сервер: http://localhost:8080');
    return;
  }

  try {
    // Шаг 1: Подключение к серверу
    if (splashStatusText) splashStatusText.textContent = 'Подключение к защищенному серверу...';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1200);
      await fetch(`${API_BASE}/api/user/me`, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e) {
      console.warn('Initial server ping skipped/failed:', e);
    }

    await new Promise(r => setTimeout(r, 250));

    // Шаг 2: Определение состояния авторизации пользователя
    if (splashStatusText) splashStatusText.textContent = 'Определение статуса авторизации...';
    try {
      await checkSession();
    } catch (e) {
      console.warn('CheckSession failed:', e);
    }

    await new Promise(r => setTimeout(r, 200));
  } catch (err) {
    console.error('Startup sequence exception:', err);
  } finally {
    clearTimeout(emergencyTimer);
    hideSplash();
  }
}

// Запуск приложения с перехватом ошибок
try {
  initApp().catch(err => {
    console.error('initApp failed:', err);
    const splash = document.getElementById('appSplashScreen');
    if (splash) splash.classList.add('hidden');
  });
} catch (e) {
  console.error('Fatal init error:', e);
  const splash = document.getElementById('appSplashScreen');
  if (splash) splash.classList.add('hidden');
}

// Защита десктопного приложения от случайных перезагрузок по F5 и Ctrl+R
window.addEventListener('keydown', (e) => {
  if (e.key === 'F5' || (e.ctrlKey && (e.key === 'r' || e.key === 'R'))) {
    e.preventDefault();
  }
});

// Блокировка стандартного контекстного меню (ПКМ) везде, кроме полей ввода и кастомных меню
window.addEventListener('contextmenu', (e) => {
  const isInput = e.target.closest('input, textarea, [contenteditable="true"]');
  const isCustomMenu = e.target.closest('.chat-item, .custom-context-menu');
  if (!isInput && !isCustomMenu) {
    e.preventDefault();
  }
});
