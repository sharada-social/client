/**
 * Sharada Messenger - Connection & Proxy Manager
 */
import { resolveServerHost, API_BASE, getCurrentUser } from './api.js';

const PROXY_STORAGE_KEY = 'sharada_proxy_config';

export function getProxyConfig() {
  try {
    const raw = localStorage.getItem(PROXY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {
    enabled: false,
    protocol: 'socks5',
    host: '',
    port: '',
    username: '',
    password: '',
    disableOn: 'never' // 'never', 'vpn', 'mobile', 'wifi'
  };
}

export function saveProxyConfig(cfg) {
  localStorage.setItem(PROXY_STORAGE_KEY, JSON.stringify(cfg));
}

let currentState = 'connecting';
let hideTimer = null;
let animTimer = null;

export function getConnectionState() {
  return currentState;
}

export function updateHeaderConnectionText(state = currentState) {
  const titleEl = document.getElementById('sidebarUsername');
  if (!titleEl) return;

  clearTimeout(animTimer);

  titleEl.classList.add('fade-out');

  animTimer = setTimeout(() => {
    if (state === 'reconnecting' || state === 'connecting' || state === 'offline') {
      titleEl.textContent = state === 'offline' ? 'Ожидание сети...' : 'Соединение...';
      titleEl.classList.add('reconnecting');
    } else {
      const u = getCurrentUser();
      titleEl.textContent = (u && u.username) ? u.username : 'Чаты';
      titleEl.classList.remove('reconnecting');
    }
    titleEl.classList.remove('fade-out');
  }, 160);
}

export function setConnectionState(state, force = false) {
  if (currentState === state && !force) return;
  currentState = state;

  const indicator = document.getElementById('connStatusCircle');
  const modalStatus = document.getElementById('proxyModalStatusBadge');

  if (modalStatus) {
    if (state === 'connected') {
      modalStatus.textContent = 'В СЕТИ';
      modalStatus.className = 'badge badge-connected';
    } else if (state === 'reconnecting') {
      modalStatus.textContent = 'ПЕРЕПОДКЛЮЧЕНИЕ...';
      modalStatus.className = 'badge badge-reconnecting';
    } else {
      modalStatus.textContent = 'ПОДКЛЮЧЕНИЕ...';
      modalStatus.className = 'badge badge-connecting';
    }
  }

  // Обновляем текст в шапке чатов с плавной анимацией
  updateHeaderConnectionText(state);

  if (!indicator) return;

  clearTimeout(hideTimer);

  if (state === 'connecting' || state === 'reconnecting' || state === 'offline') {
    indicator.classList.remove('hiding');
    indicator.classList.add('visible');
    indicator.setAttribute('title', state === 'reconnecting' ? 'Переподключение к серверу...' : 'Подключение к серверу...');
  } else if (state === 'connected') {
    // Плавное растворение индикатора
    hideTimer = setTimeout(() => {
      indicator.classList.add('hiding');
      setTimeout(() => {
        indicator.classList.remove('visible', 'hiding');
      }, 400);
    }, 600);
  }
}

export function openConnectionModal() {
  const modal = document.getElementById('connSettingsModal');
  if (!modal) return;

  const cfg = getProxyConfig();

  const toggle = document.getElementById('toggleProxyEnabled');
  const proto = document.getElementById('proxyProtocolSelect');
  const host = document.getElementById('proxyHostInput');
  const port = document.getElementById('proxyPortInput');
  const user = document.getElementById('proxyUserInput');
  const pass = document.getElementById('proxyPassInput');
  const detailsBox = document.getElementById('proxyDetailsSection');

  if (toggle) {
    toggle.checked = !!cfg.enabled;
    if (detailsBox) detailsBox.style.display = cfg.enabled ? 'block' : 'none';
  }
  if (proto) proto.value = cfg.protocol || 'socks5';
  if (host) host.value = cfg.host || '';
  if (port) port.value = cfg.port || '';
  if (user) user.value = cfg.username || '';
  if (pass) pass.value = cfg.password || '';

  const radios = document.querySelectorAll('input[name="proxyDisableOn"]');
  radios.forEach(r => {
    r.checked = r.value === (cfg.disableOn || 'never');
  });

  setConnectionState(currentState);
  modal.classList.add('active');
}

export function closeConnectionModal() {
  const modal = document.getElementById('connSettingsModal');
  if (modal) modal.classList.remove('active');
}

export function initConnectionManager() {
  const indicator = document.getElementById('connStatusCircle');
  if (indicator) {
    indicator.addEventListener('click', openConnectionModal);
  }

  const btnClose = document.getElementById('btnCloseConnModal');
  if (btnClose) btnClose.addEventListener('click', closeConnectionModal);

  const btnCloseX = document.getElementById('btnCloseConnModalX');
  if (btnCloseX) btnCloseX.addEventListener('click', closeConnectionModal);

  const toggle = document.getElementById('toggleProxyEnabled');
  const detailsBox = document.getElementById('proxyDetailsSection');
  if (toggle && detailsBox) {
    toggle.addEventListener('change', () => {
      detailsBox.style.display = toggle.checked ? 'block' : 'none';
    });
  }

  const btnSave = document.getElementById('btnSaveProxyConfig');
  if (btnSave) {
    btnSave.addEventListener('click', () => {
      const selectedDisableOn = document.querySelector('input[name="proxyDisableOn"]:checked');
      const proto = document.getElementById('proxyProtocolSelect');
      const host = document.getElementById('proxyHostInput');
      const port = document.getElementById('proxyPortInput');
      const user = document.getElementById('proxyUserInput');
      const pass = document.getElementById('proxyPassInput');

      const newCfg = {
        enabled: toggle ? toggle.checked : false,
        protocol: proto ? proto.value : 'socks5',
        host: host ? host.value.trim() : '',
        port: port ? port.value.trim() : '',
        username: user ? user.value.trim() : '',
        password: pass ? pass.value.trim() : '',
        disableOn: selectedDisableOn ? selectedDisableOn.value : 'never'
      };

      saveProxyConfig(newCfg);
      alert('Настройки соединения сохранены!');
      closeConnectionModal();
    });
  }

  const btnTest = document.getElementById('btnTestProxyConn');
  const testResult = document.getElementById('proxyTestResult');
  if (btnTest) {
    btnTest.addEventListener('click', async () => {
      if (testResult) {
        testResult.textContent = 'Проверка доступности...';
        testResult.style.color = '#f59e0b';
      }
      const start = performance.now();
      try {
        const res = await fetch(`${API_BASE}/api/health`, { method: 'GET', signal: AbortSignal.timeout(4000) });
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          if (testResult) {
            testResult.textContent = `✓ Сервер доступен (${latency}ms)`;
            testResult.style.color = '#10b981';
          }
        } else {
          if (testResult) {
            testResult.textContent = `Ошибка HTTP ${res.status}`;
            testResult.style.color = '#ef4444';
          }
        }
      } catch (e) {
        if (testResult) {
          testResult.textContent = `Недоступен: ${e.message || 'Connection Refused'}`;
          testResult.style.color = '#ef4444';
        }
      }
    });
  }

  // Автоматический мониторинг сети (online / offline)
  window.addEventListener('online', () => {
    console.log('[Network] Browser is online');
    setConnectionState('connecting');
    if (typeof window.triggerSharadaReconnect === 'function') {
      window.triggerSharadaReconnect();
    }
  });

  window.addEventListener('offline', () => {
    console.warn('[Network] Browser went offline');
    setConnectionState('offline');
  });

  // Исходное состояние
  setConnectionState('connecting');
}
