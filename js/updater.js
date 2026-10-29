/**
 * Sharada Messenger - GitHub Release Updater & Changelog Module
 */

export function getCurrentVersion() {
  if (typeof window !== 'undefined' && window.SHARADA_VERSION) {
    return window.SHARADA_VERSION;
  }
  return '1.3.1';
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
  // Запуск фоновой проверки без блокировки сети
  setTimeout(() => {
    checkGithubUpdatesSilently();
  }, 3000);
}

async function checkGithubUpdatesSilently() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 секунд максимум в фоне

  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    clearTimeout(timeoutId);

    if (!res.ok) return; // Если ошибка или нет релиза — молча выходим

    const data = await res.json();
    const latestVersion = (data.tag_name || data.name || '').replace(/^v/, '').trim();
    if (!latestVersion) return;

    // Проверяем, не нажал ли пользователь ранее "Пропустить версию"
    const skipped = localStorage.getItem('sharada_skip_version');
    if (skipped === latestVersion) return;

    // Сравниваем версии
    const curVer = getCurrentVersion();
    if (isNewerVersion(latestVersion, curVer)) {
      showUpdateModal(latestVersion, data);
    }
  } catch (err) {
    // Сеть недоступна, таймаут или гитхаб не отвечает — тихо игнорируем
  } finally {
    clearTimeout(timeoutId);
  }
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
    let body = releaseData.body || 'Улучшения стабильности и новые функции мессенджера sharada.';
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
    window.location.reload();
  } else {
    if (releaseData.html_url) {
      window.open(releaseData.html_url, '_blank');
    } else {
      window.location.reload();
    }
  }
}
