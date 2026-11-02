/**
 * Sharada Messenger - GitHub & Server-Side Release Updater Module
 */
import { API_BASE } from './api.js';

export function getCurrentVersion() {
  if (typeof window !== 'undefined' && window.SHARADA_VERSION) {
    return window.SHARADA_VERSION;
  }
  return '1.4.2';
}

const GITHUB_REPO = 'sharada-social/client';

export function isNewerVersion(latest, current) {
  const cleanL = String(latest).replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  const cleanC = String(current).replace(/^v/, '').split('.').map(n => parseInt(n) || 0);
  for (let i = 0; i < Math.max(cleanL.length, cleanC.length); i++) {
    const l = cleanL[i] || 0;
    const c = cleanC[i] || 0;
    if (l > c) return true;
    if (l < c) return false;
  }
  return false;
}

export function initUpdateChecker() {
  // Запуск фоновой проверки без блокировки старта
  setTimeout(() => {
    checkUpdates();
  }, 2500);
}

/**
 * Получение информации о последнем релизе.
 * Приоритет 1: собственный бэкенд Sharada (/api/updates/check) - нет лимитов rate limit, нет блокировок.
 * Приоритет 2: прямой запрос к GitHub API (как fallback).
 */
async function fetchLatestReleaseInfo() {
  // 1. Пробуем бэкенд Sharada
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_BASE}/api/updates/check`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && (data.version || data.tag_name)) {
        console.log('[Updater] Received release info from Sharada backend:', data.version || data.tag_name);
        return data;
      }
    }
  } catch (err) {
    console.warn('[Updater] Sharada backend check unavailable, trying GitHub directly...', err.message);
  }

  // 2. Fallback: прямой запрос к GitHub Releases API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      console.log('[Updater] Received release info from GitHub API directly:', data.tag_name);
      return data;
    } else {
      console.warn(`[Updater] GitHub API returned status ${res.status}`);
    }
  } catch (err) {
    console.warn('[Updater] GitHub direct check failed:', err.message);
  }

  return null;
}

export async function checkUpdates(isManual = false) {
  const curVer = getCurrentVersion();
  console.log(`[Updater] Checking updates... Current client version: v${curVer}`);

  const releaseData = await fetchLatestReleaseInfo();
  if (!releaseData) {
    if (isManual) {
      alert(`Не удалось связаться с сервером обновлений. Текущая версия: v${curVer}`);
    }
    return;
  }

  const latestVersion = (releaseData.version || releaseData.tag_name || releaseData.name || '').replace(/^v/, '').trim();
  if (!latestVersion) return;

  console.log(`[Updater] Latest available version: v${latestVersion}`);

  // Проверяем, не нажал ли пользователь "Пропустить версию" (только для авто-проверки)
  if (!isManual) {
    const skipped = localStorage.getItem('sharada_skip_version');
    if (skipped === latestVersion) {
      console.log(`[Updater] Version v${latestVersion} was marked as skipped by user.`);
      return;
    }
  }

  if (isNewerVersion(latestVersion, curVer)) {
    console.log(`[Updater] New version detected: v${curVer} -> v${latestVersion}. Showing modal.`);
    showUpdateModal(latestVersion, releaseData);
  } else {
    console.log(`[Updater] Client is up to date (v${curVer} >= v${latestVersion}).`);
    if (isManual) {
      alert(`У вас установлена актуальная версия Sharada (v${curVer}).`);
    }
  }
}

// Экспорт в глобальную область видимости для удобной проверки из консоли / настроек
if (typeof window !== 'undefined') {
  window.checkAppUpdates = () => checkUpdates(true);
}

function showUpdateModal(latestVersion, releaseData) {
  const modal = document.getElementById('modalAppUpdate');
  const subTitle = document.getElementById('updateVersionSubtitle');
  const changelog = document.getElementById('updateChangelogContent');
  const btnDownload = document.getElementById('btnDownloadUpdate');
  const btnSkip = document.getElementById('btnSkipUpdateVersion');

  if (!modal) return;

  if (subTitle) {
    subTitle.textContent = `v${getCurrentVersion()} → v${latestVersion}`;
  }

  if (changelog) {
    let body = releaseData.body || 'Новые функции, улучшение стабильности и дизайна Sharada.';
    if (body.length > 900) {
      body = body.substring(0, 900) + '\n... (полный список на GitHub)';
    }
    changelog.textContent = body;
  }

  if (btnSkip) {
    btnSkip.onclick = (e) => {
      e.preventDefault();
      localStorage.setItem('sharada_skip_version', latestVersion);
      modal.classList.add('hidden');
    };
  }

  if (btnDownload) {
    btnDownload.onclick = () => {
      modal.classList.add('hidden');
      startUpdateDownloadAnimation(latestVersion, releaseData);
    };
  }

  modal.classList.remove('hidden');
}

function startUpdateDownloadAnimation(latestVersion, releaseData) {
  const widget = document.getElementById('appUpdateWidget');
  const ring = document.getElementById('updateWidgetRingProgress');
  const text = document.getElementById('updateWidgetText');
  if (!widget) return;

  widget.style.display = 'flex';
  widget.className = 'app-update-widget stage-connecting';

  // Этап 1: Подключение (вращающееся кольцо)
  setTimeout(() => {
    // Этап 2: Скачивание (прогрессбар 0 -> 100%)
    widget.className = 'app-update-widget stage-downloading';
    let progress = 0;
    const interval = setInterval(() => {
      progress += 4;
      const offset = 113.1 - (113.1 * (progress / 100));
      if (ring) ring.style.strokeDashoffset = offset;

      if (progress >= 100) {
        clearInterval(interval);
        // Этап 3: Скачано -> трансформация в парящую капсулу
        widget.className = 'app-update-widget stage-ready';
        if (text) text.textContent = 'Нажмите для обновления';

        widget.onclick = () => {
          handleApplyUpdate(releaseData);
        };
      }
    }, 70);
  }, 1400);
}

function handleApplyUpdate(releaseData) {
  const isTauri = typeof window.__TAURI__ !== 'undefined';
  const isAndroid = /Android/i.test(navigator.userAgent);

  if (isAndroid) {
    const apkAsset = (releaseData.assets || []).find(a => a.name && a.name.endsWith('.apk'));
    if (apkAsset && apkAsset.browser_download_url) {
      window.open(apkAsset.browser_download_url, '_blank');
      return;
    }
    if (releaseData.html_url) {
      window.open(releaseData.html_url, '_blank');
      return;
    }
  }

  if (isTauri) {
    // В десктопном Tauri открываем страницу релиза или перезагружаем
    if (releaseData.html_url) {
      window.open(releaseData.html_url, '_blank');
    } else {
      window.location.reload();
    }
  } else {
    if (releaseData.html_url) {
      window.open(releaseData.html_url, '_blank');
    } else {
      window.location.reload();
    }
  }
}
