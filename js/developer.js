/**
 * Sharada Messenger - Developer Settings & Client Log Console Module
 */
import { resolveServerHost, API_BASE, WS_BASE, getAuthToken } from './api.js';
import { showAppDialog } from './modals.js';

const DEV_STORAGE_KEY = 'sharada_dev_mode_enabled';
const MAX_LOGS = 300;
const clientLogs = [];
let currentLogFilter = 'all';

// Intercept console and network events
(function setupLoggerHook() {
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  function pushLog(level, args) {
    const time = new Date().toLocaleTimeString('ru-RU', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + String(Date.now() % 1000).padStart(3, '0');
    const text = Array.from(args).map(a => {
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch (e) { return String(a); }
      }
      return String(a);
    }).join(' ');

    clientLogs.push({ time, level, text });
    if (clientLogs.length > MAX_LOGS) {
      clientLogs.shift();
    }

    renderLastLogLine({ time, level, text });
  }

  console.log = function(...args) {
    origLog.apply(console, args);
    pushLog('log', args);
  };

  console.warn = function(...args) {
    origWarn.apply(console, args);
    pushLog('warn', args);
  };

  console.error = function(...args) {
    origError.apply(console, args);
    pushLog('error', args);
  };

  // Intercept fetch network logs
  const origFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = String(args[0] || '');
    const method = (args[1] && args[1].method) || 'GET';
    const isApi = url.includes('/api/');
    if (isApi) {
      pushLog('net', [`-> ${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`]);
    }
    try {
      const res = await origFetch.apply(this, args);
      if (isApi) {
        pushLog('net', [`<- [${res.status}] ${method} ${url.replace(/^https?:\/\/[^/]+/, '')}`]);
      }
      return res;
    } catch (err) {
      if (isApi) {
        pushLog('error', [`Network Failed: ${method} ${url}: ${err.message || err}`]);
      }
      throw err;
    }
  };
})();

function renderLastLogLine(item) {
  const screen = document.getElementById('devTerminalScreen');
  const badge = document.getElementById('devLogCountBadge');
  if (badge) badge.textContent = `${clientLogs.length} событий`;
  if (!screen) return;

  if (currentLogFilter !== 'all' && item.level !== currentLogFilter) return;

  const div = document.createElement('div');
  div.className = 'dev-log-line';
  div.innerHTML = `<span class="dev-log-time">${item.time}</span><span class="dev-log-level ${item.level}">${item.level}</span><span class="dev-log-text">${escapeHtml(item.text)}</span>`;
  screen.appendChild(div);

  // Auto-scroll to bottom
  screen.scrollTop = screen.scrollHeight;
}

function renderAllLogs() {
  const screen = document.getElementById('devTerminalScreen');
  const badge = document.getElementById('devLogCountBadge');
  if (badge) badge.textContent = `${clientLogs.length} событий`;
  if (!screen) return;

  screen.innerHTML = '';
  const filtered = currentLogFilter === 'all'
    ? clientLogs
    : clientLogs.filter(l => l.level === currentLogFilter);

  if (filtered.length === 0) {
    screen.innerHTML = '<div style="color:#666; font-style:italic;">Логи по данному фильтру отсутствуют</div>';
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement('div');
    div.className = 'dev-log-line';
    div.innerHTML = `<span class="dev-log-time">${item.time}</span><span class="dev-log-level ${item.level}">${item.level}</span><span class="dev-log-text">${escapeHtml(item.text)}</span>`;
    screen.appendChild(div);
  });
  screen.scrollTop = screen.scrollHeight;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isDevModeEnabled() {
  return localStorage.getItem(DEV_STORAGE_KEY) === 'true';
}

export function setDevModeEnabled(val) {
  if (val) {
    localStorage.setItem(DEV_STORAGE_KEY, 'true');
  } else {
    localStorage.removeItem(DEV_STORAGE_KEY);
  }
}

// 5-click easter egg counter
let clickCounter = 0;
let clickTimer = null;

export function handleDevTriggerClick(onUnlocked) {
  if (isDevModeEnabled()) {
    showAppDialog({
      title: 'Режим разработчика',
      message: 'Режим разработчика уже активирован. Раздел доступен в меню настроек.',
      confirmText: 'ОК'
    });
    return;
  }

  clickCounter++;
  clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    clickCounter = 0;
    const pill = document.getElementById('devStepsRemaining');
    if (pill) pill.style.display = 'none';
  }, 3500);

  const remaining = 5 - clickCounter;
  const pill = document.getElementById('devStepsRemaining');

  if (remaining <= 0) {
    clickCounter = 0;
    if (pill) pill.style.display = 'none';
    setDevModeEnabled(true);
    showAppDialog({
      title: '🎉 Поздравляем!',
      message: 'Вы активировали режим разработчика! В меню настроек появился новый раздел «Для разработчиков».',
      confirmText: 'ОТЛИЧНО'
    });
    if (typeof onUnlocked === 'function') onUnlocked();
  } else if (remaining <= 4) {
    if (pill) {
      pill.style.display = 'inline-block';
      pill.textContent = `Осталось шагов: ${remaining}`;
    }
  }
}

export function initDeveloperPanel() {
  const navItem = document.getElementById('settingsNavDeveloper');
  if (navItem) {
    navItem.style.display = isDevModeEnabled() ? 'flex' : 'none';
  }

  // Платформа больше не пишется в футере
  const platformLabel = document.getElementById('settingsPlatformLabel');
  if (platformLabel) {
    platformLabel.style.display = 'none';
  }

  // Ping test
  const btnPing = document.getElementById('btnDevPingTest');
  const pingText = document.getElementById('devPingResultText');
  const pingDot = document.getElementById('devPingStatusDot');
  if (btnPing) {
    btnPing.onclick = async () => {
      if (pingText) pingText.textContent = 'Измерение...';
      if (pingDot) { pingDot.style.background = '#f59e0b'; pingDot.style.boxShadow = '0 0 8px #f59e0b'; }
      const start = performance.now();
      try {
        const res = await fetch(`${API_BASE}/api/health`, { method: 'GET', signal: AbortSignal.timeout(4000) });
        const latency = Math.round(performance.now() - start);
        if (res.ok) {
          if (pingText) pingText.textContent = `В сети • RTT: ${latency}ms • [HTTP 200]`;
          if (pingDot) { pingDot.style.background = '#10b981'; pingDot.style.boxShadow = '0 0 8px #10b981'; }
        } else {
          if (pingText) pingText.textContent = `Ошибка сервера: HTTP ${res.status}`;
          if (pingDot) { pingDot.style.background = '#ef4444'; pingDot.style.boxShadow = '0 0 8px #ef4444'; }
        }
      } catch (err) {
        if (pingText) pingText.textContent = `Недоступен: ${err.message || 'Connection Refused'}`;
        if (pingDot) { pingDot.style.background = '#ef4444'; pingDot.style.boxShadow = '0 0 8px #ef4444'; }
      }
    };
  }

  // Terminal log filter buttons
  document.querySelectorAll('.dev-filter-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.dev-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentLogFilter = btn.getAttribute('data-filter') || 'all';
      renderAllLogs();
    };
  });

  // Copy logs button
  const btnCopyLogs = document.getElementById('btnDevCopyLogs');
  if (btnCopyLogs) {
    btnCopyLogs.onclick = () => {
      if (clientLogs.length === 0) {
        alert('Логи пусты');
        return;
      }
      const text = clientLogs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.text}`).join('\n');
      navigator.clipboard.writeText(text).then(() => {
        alert(`Скопировано ${clientLogs.length} строк логов в буфер обмена!`);
      }).catch(err => {
        prompt('Скопируйте вручную:', text);
      });
    };
  }

  // Clear logs button
  const btnClearLogs = document.getElementById('btnDevClearLogs');
  if (btnClearLogs) {
    btnClearLogs.onclick = () => {
      clientLogs.length = 0;
      renderAllLogs();
    };
  }

  // Diagnostic info
  const infoPlatform = document.getElementById('devInfoPlatform');
  if (infoPlatform) {
    const isTauri = window.__TAURI__ || window.location.hostname === 'tauri.localhost' || window.location.protocol === 'tauri:';
    infoPlatform.textContent = `${isTauri ? 'Tauri Native' : 'Web Browser'} (${navigator.platform || 'Unknown'})`;
  }

  const infoScreen = document.getElementById('devInfoScreen');
  if (infoScreen) {
    infoScreen.textContent = `${window.innerWidth}x${window.innerHeight} (dpr: ${window.devicePixelRatio || 1})`;
  }

  const infoToken = document.getElementById('devInfoToken');
  if (infoToken) {
    const t = getAuthToken();
    infoToken.textContent = t ? `${t.slice(0, 16)}...` : 'Не авторизован';
  }

  const infoWs = document.getElementById('devInfoWs');
  if (infoWs) {
    infoWs.textContent = `URL: ${WS_BASE}`;
  }

  // Export diagnostic dump
  const btnExport = document.getElementById('btnDevExportDiagnostic');
  if (btnExport) {
    btnExport.onclick = () => {
      const dump = {
        timestamp: new Date().toISOString(),
        serverHost: resolveServerHost(),
        apiBase: API_BASE,
        wsBase: WS_BASE,
        userAgent: navigator.userAgent,
        screen: {
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio
        },
        hasAuthToken: !!getAuthToken(),
        devMode: isDevModeEnabled(),
        recentLogs: clientLogs.slice(-100)
      };

      const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sharada-diagnostic-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };
  }

  // Clear storage
  const btnClearStorage = document.getElementById('btnDevClearStorage');
  if (btnClearStorage) {
    btnClearStorage.onclick = () => {
      if (confirm('ВНИМАНИЕ! Это очистит токен авторизации, кэш и все локальные настройки приложения. Продолжить?')) {
        localStorage.clear();
        alert('Локальное хранилище очищено.');
        window.location.reload();
      }
    };
  }

  // Disable dev mode
  const btnDisable = document.getElementById('btnDevDisable');
  if (btnDisable) {
    btnDisable.onclick = () => {
      setDevModeEnabled(false);
      alert('Режим разработчика деактивирован.');
      window.location.reload();
    };
  }

  renderAllLogs();
}
