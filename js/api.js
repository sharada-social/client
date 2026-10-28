/**
 * Sharada Messenger - API & Global State Module
 */

export const SERVER_HOST = 'out.shamper.ru';
export const API_BASE = 'https://' + SERVER_HOST;
export const WS_BASE = 'wss://' + SERVER_HOST;

export function resolveServerHost() {
  return SERVER_HOST;
}

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

export async function authFetch(endpoint, options = {}) {
  const headers = options.headers || {};
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  headers['X-Device-ID'] = getDeviceId();
  options.headers = headers;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const res = await fetch(url, options);

  // Если сервер вернул 401 (сессия отозвана с другого устройства)
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
