/**
 * Sharada Messenger - API & Global State Module
 */

export function resolveServerHost() {
  if (typeof window !== 'undefined' && window.getSharadaServerHost) {
    return window.getSharadaServerHost();
  }
  return 'out.shamper.ru';
}

export function resolveProto(host) {
  if (typeof window !== 'undefined' && window.getSharadaProto) {
    return window.getSharadaProto(host);
  }
  return (host && host.includes('shamper.ru')) ? 'https://' : 'http://';
}

export const SERVER_HOST = resolveServerHost();
export const API_BASE = resolveProto(SERVER_HOST) + SERVER_HOST;
export const WS_BASE = (API_BASE.startsWith('https:') ? 'wss://' : 'ws://') + SERVER_HOST;

// Постоянный уникальный идентификатор устройства (предотвращает размножение сессий)
export function getDeviceId() {
  let devId = localStorage.getItem('sharada_device_id');
  if (!devId) {
    devId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('sharada_device_id', devId);
  }
  return devId;
}

let authToken = localStorage.getItem('sharada_token');
let currentUser = null;

export function getAuthToken() {
  if (!authToken) {
    authToken = localStorage.getItem('sharada_token');
  }
  return authToken;
}

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('sharada_token', token);
  } else {
    localStorage.removeItem('sharada_token');
  }
}

export function getCurrentUser() {
  if (!currentUser) {
    try {
      const cached = localStorage.getItem('sharada_cached_user');
      if (cached) currentUser = JSON.parse(cached);
    } catch (e) {}
  }
  return currentUser;
}

export function setCurrentUser(user) {
  currentUser = user;
  if (user) {
    localStorage.setItem('sharada_cached_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('sharada_cached_user');
  }
}

export const API_VERSION = 2;

export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/windows/i.test(ua)) return 'windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macos';
  if (/linux/i.test(ua)) return 'linux';
  return 'other';
}

export function getFriendlyDeviceName() {
  if (typeof navigator === 'undefined') return 'Web Browser';
  const ua = navigator.userAgent || '';
  if (/windows/i.test(ua)) return 'Windows PC';
  if (/macintosh/i.test(ua)) return 'MacBook / Mac';
  if (/iphone/i.test(ua)) return 'iPhone';
  if (/ipad/i.test(ua)) return 'iPad';
  if (/android/i.test(ua)) return 'Android Device';
  if (/linux/i.test(ua)) return 'Linux Device';
  return 'Web Browser';
}

export function getClientMetadata() {
  const ver = (typeof window !== 'undefined' && window.SHARADA_VERSION) ? window.SHARADA_VERSION : '2.0.0';
  return {
    name: 'Sharada Web',
    version: ver,
    device_name: getFriendlyDeviceName(),
    platform: detectPlatform()
  };
}

export async function authFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Передаем версию протокола API (целое число) во всех запросах кроме публичных метаданных
  if (!endpoint.includes('/api/meta') && !endpoint.includes('/api/updates/check')) {
    headers['X-Api-Version'] = String(API_VERSION);
  }
  options.headers = headers;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const res = await fetch(url, options);

  // Если сервер вернул 426 (требуется обновление API протокола) или 400 (слишком новая версия)
  if (res.status === 426 || (res.status === 400 && endpoint.startsWith('/api/'))) {
    try {
      const data = await res.clone().json();
      if (data && (data.code === 'api_version_unsupported' || data.code === 'api_version_too_new')) {
        console.warn(`[Version] API protocol version error (${data.code}):`, data.message);
        if (typeof window !== 'undefined' && typeof window.checkAppUpdates === 'function') {
          window.checkAppUpdates(true);
        }
      }
    } catch (e) {}
  }

  // Если сервер вернул 401 (сессия отозвана)
  if (res.status === 401 && token) {
    console.warn('[Auth] Session invalidated by server');
    setAuthToken(null);
    setCurrentUser(null);
    if (typeof window !== 'undefined' && window.onSharadaSessionRevoked) {
      window.onSharadaSessionRevoked();
    }
  }

  return res;
}

export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
