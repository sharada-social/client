import { API_BASE, getAuthToken, setAuthToken, getCurrentUser, setCurrentUser, authFetch, getDeviceId } from './api.js';

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

let pendingUsername = '';
let pendingPassword = '';
let tempSessionToken = '';
let onAuthSuccessCallback = null;

// Модальное окно "У меня нет данных"
window.showNoAuthDataModal = function(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('modalNoAuthData');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
};

window.hideNoAuthDataModal = function(e) {
  if (e) e.preventDefault();
  const modal = document.getElementById('modalNoAuthData');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }
};

// Инициализация 6-значных ячеек TOTP
function setupDigitBoxes(rowId, hiddenInputId, onComplete) {
  const row = document.getElementById(rowId);
  const hiddenInput = document.getElementById(hiddenInputId);
  if (!row) return;

  const boxes = Array.from(row.querySelectorAll('.totp-digit-box'));
  boxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = box.value.replace(/\D/g, '');
      box.value = val ? val[0] : '';
      updateHidden();
      if (box.value && idx < boxes.length - 1) {
        boxes[idx + 1].focus();
        boxes[idx + 1].select();
      }
      if (getCombinedValue().length === boxes.length) {
        if (onComplete) onComplete();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        boxes[idx - 1].focus();
        boxes[idx - 1].value = '';
        updateHidden();
      } else if (e.key === 'ArrowLeft' && idx > 0) {
        boxes[idx - 1].focus();
      } else if (e.key === 'ArrowRight' && idx < boxes.length - 1) {
        boxes[idx + 1].focus();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text');
      const digits = pasted.replace(/\D/g, '').substring(0, boxes.length);
      if (digits) {
        digits.split('').forEach((d, i) => {
          if (boxes[i]) boxes[i].value = d;
        });
        updateHidden();
        const nextIdx = Math.min(digits.length, boxes.length - 1);
        boxes[nextIdx].focus();
        if (digits.length === boxes.length && onComplete) {
          onComplete();
        }
      }
    });
  });

  function getCombinedValue() {
    return boxes.map(b => b.value).join('');
  }

  function updateHidden() {
    if (hiddenInput) hiddenInput.value = getCombinedValue();
  }
}

export function initAuth(onSuccess) {
  onAuthSuccessCallback = onSuccess;
  bindEvents();
  setupDigitBoxes('totpDigitRow', 'loginTotpCode', () => {
    handleStep2TOTP();
  });
  setupDigitBoxes('setupTotpDigitRow', 'setupTotpInput', () => {
    handleSetup2FAConfirm();
  });
}

export async function checkSession() {
  const token = getAuthToken();
  if (token) {
    // Сразу подтягиваем закэшированного пользователя для мгновенного входа без мигания
    const cachedUser = getCurrentUser();
    if (cachedUser && onAuthSuccessCallback) {
      onAuthSuccessCallback(cachedUser);
    }

    try {
      const res = await authFetch('/api/user/me');
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        if (authBackdrop) authBackdrop.classList.add('hidden');
        document.body.classList.remove('auth-mode');
        if (onAuthSuccessCallback) onAuthSuccessCallback(user);
        return true;
      } else if (res.status === 401) {
        setAuthToken(null);
        setCurrentUser(null);
        document.body.classList.add('auth-mode');
        showLoginStage(1);
        return false;
      } else {
        // Сервер перезагружается или 502/503 - остаемся в аккаунте в режиме офлайн
        if (authBackdrop) authBackdrop.classList.add('hidden');
        document.body.classList.remove('auth-mode');
        return true;
      }
    } catch (e) {
      // Офлайн или сервер недоступен - сохраняем сессию и данные пользователя
      console.warn('Network offline or server unavailable, keeping user logged in', e);
      if (authBackdrop) authBackdrop.classList.add('hidden');
      document.body.classList.remove('auth-mode');
      return true;
    }
  }

  // Если токена нет изначально в хранилище
  document.body.classList.add('auth-mode');
  showLoginStage(1);
  return false;
}

window.onSharadaSessionRevoked = function() {
  setAuthToken(null);
  setCurrentUser(null);
  document.body.classList.add('auth-mode');
  showLoginStage(1);
};

function showAuthError(text) {
  if (authErrorMsg) {
    authErrorMsg.textContent = text;
    authErrorMsg.style.display = 'block';
  }
}

function clearAuthError() {
  if (authErrorMsg) {
    authErrorMsg.textContent = '';
    authErrorMsg.style.display = 'none';
  }
}

export function showLoginStage(stepNum) {
  document.body.classList.add('auth-mode');
  if (authBackdrop) authBackdrop.classList.remove('hidden');
  clearAuthError();

  const verEl = document.querySelector('.auth-version-sub');
  if (verEl && window.SHARADA_VERSION) {
    verEl.textContent = `v${window.SHARADA_VERSION}`;
  }

  const prevHeight = authCard ? authCard.offsetHeight : 0;

  const steps = [authStep1, authStepTOTP, authStepSetup2FA];
  steps.forEach(st => {
    if (!st) return;
    st.classList.remove('fade-in');
    st.classList.add('hidden-step');
  });

  let targetStep = authStep1;
  if (stepNum === 2) targetStep = authStepTOTP;
  if (stepNum === 3) targetStep = authStepSetup2FA;

  if (targetStep) {
    targetStep.classList.remove('hidden-step');
    targetStep.classList.add('fade-in');

    if (authCard && prevHeight > 0) {
      const newHeight = authCard.scrollHeight;
      authCard.style.height = prevHeight + 'px';
      void authCard.offsetHeight; // force reflow
      authCard.style.transition = 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
      authCard.style.height = newHeight + 'px';
      setTimeout(() => {
        if (authCard) authCard.style.height = 'auto';
      }, 360);
    }

    const firstInput = targetStep.querySelector('input:not([type="hidden"])');
    if (firstInput) setTimeout(() => firstInput.focus(), 150);
  }
}

export function handleBackToStep1(e) {
  if (e && e.preventDefault) {
    e.preventDefault();
    e.stopPropagation();
  }
  clearAuthError();
  if (loginTotpCode) loginTotpCode.value = '';
  if (setupTotpInput) setupTotpInput.value = '';
  document.querySelectorAll('.totp-digit-box').forEach(b => b.value = '');
  showLoginStage(1);
  return false;
}

export async function handleStep1(e) {
  if (e && e.preventDefault) {
    e.preventDefault();
    e.stopPropagation();
  }
  clearAuthError();
  const usernameEl = document.getElementById('loginUsername');
  const passwordEl = document.getElementById('loginPassword');
  const username = usernameEl ? usernameEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value.trim() : '';

  if (!username || !password) {
    showAuthError('Введите имя пользователя и ключ доступа');
    return false;
  }

  const btn = document.getElementById('btnStep1Next');
  if (btn) {
    btn.innerHTML = `<span class="md3-circular-progress" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;"><svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle></svg></span><span>Проверка...</span>`;
    btn.disabled = true;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': getDeviceId()
      },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (btn) {
      btn.innerHTML = `<span>Войти</span>`;
      btn.disabled = false;
    }

    if (!res.ok) {
      showAuthError(data.message || 'Ошибка авторизации');
      return false;
    }

    pendingUsername = username;
    pendingPassword = password;
    window._pendingUser = username;
    window._pendingPass = password;
    tempSessionToken = data.temp_session_token || data.token || '';

    // Очищаем ячейки TOTP перед показом
    document.querySelectorAll('.totp-digit-box').forEach(b => b.value = '');

    if (data.status === 'PENDING_2FA' || data.requires_2fa_setup) {
      if (totpQrImg && data.totp_qr_data_uri) totpQrImg.src = data.totp_qr_data_uri;
      if (totpSecretText && data.totp_secret) totpSecretText.textContent = data.totp_secret;
      showLoginStage(3);
    } else if (data.status === 'REQUIRE_2FA' || data.requires_totp) {
      if (totpAccountLabel) totpAccountLabel.textContent = username;
      showLoginStage(2);
    } else if (data.token) {
      setAuthToken(data.token);
      setCurrentUser(data.user);
      document.body.classList.remove('auth-mode');
      if (authBackdrop) authBackdrop.classList.add('hidden');
      if (onAuthSuccessCallback) onAuthSuccessCallback(data.user);
    }
  } catch (err) {
    console.error('Login error:', err);
    if (btn) {
      btn.innerHTML = `<span>Войти</span>`;
      btn.disabled = false;
    }
    showAuthError('Не удалось связаться с сервером (' + (err.message || err) + ')');
  }
  return false;
}

export async function handleStep2TOTP(e) {
  if (e && e.preventDefault) {
    e.preventDefault();
    e.stopPropagation();
  }
  clearAuthError();

  const codeEl = document.getElementById('loginTotpCode');
  const code = codeEl ? codeEl.value.trim() : '';
  if (!code || code.length < 6) {
    showAuthError('Введите 6-значный код из Google Authenticator');
    return false;
  }

  const u = pendingUsername || window._pendingUser || (loginUsername ? loginUsername.value.trim() : '');
  const p = pendingPassword || window._pendingPass || (loginPassword ? loginPassword.value.trim() : '');

  const btn = document.getElementById('btnStep2Login');
  if (btn) {
    btn.innerHTML = `<span class="md3-circular-progress" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;"><svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle></svg></span><span>Вход...</span>`;
    btn.disabled = true;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-ID': getDeviceId()
      },
      body: JSON.stringify({
        username: u,
        password: p,
        totp_code: code
      })
    });

    const data = await res.json();
    if (btn) {
      btn.innerHTML = `<span>Войти</span>`;
      btn.disabled = false;
    }

    if (!res.ok) {
      showAuthError(data.message || 'Неверный код 2FA');
      return false;
    }

    // Успешный вход в систему!
    setAuthToken(data.token);
    setCurrentUser(data.user);
    document.body.classList.remove('auth-mode');
    if (authBackdrop) authBackdrop.classList.add('hidden');

    if (data.user) {
      const sUser = document.getElementById('sidebarUsername');
      if (sUser) sUser.textContent = data.user.display_name || data.user.username;
      const sRole = document.getElementById('userBadgeRole');
      if (sRole) sRole.textContent = data.user.is_admin ? 'ADMIN' : (`T${data.user.trust_level}`);
    }

    if (onAuthSuccessCallback) {
      onAuthSuccessCallback(data.user);
    }
  } catch (err) {
    if (btn) {
      btn.innerHTML = `<span>Войти</span>`;
      btn.disabled = false;
    }
    showAuthError('Ошибка подключения к серверу: ' + (err.message || err));
  }
  return false;
}

export async function handleSetup2FAConfirm(e) {
  if (e && e.preventDefault) {
    e.preventDefault();
    e.stopPropagation();
  }
  clearAuthError();

  const codeEl = document.getElementById('setupTotpInput');
  const code = codeEl ? codeEl.value.trim() : '';
  if (!code || code.length < 6) {
    showAuthError('Введите 6 цифр подтверждения');
    return false;
  }

  const u = pendingUsername || window._pendingUser || (loginUsername ? loginUsername.value.trim() : '');
  const p = pendingPassword || window._pendingPass || (loginPassword ? loginPassword.value.trim() : '');

  const btn = document.getElementById('btnConfirm2FASetup');
  if (btn) {
    btn.innerHTML = `<span class="md3-circular-progress" style="width:20px; height:20px; vertical-align:middle; margin-right:8px;"><svg viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="none" stroke-width="4"></circle></svg></span><span>Активация...</span>`;
    btn.disabled = true;
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-ID': getDeviceId()
    };
    if (tempSessionToken) {
      headers['Authorization'] = `Bearer ${tempSessionToken}`;
    }

    let res = await fetch(`${API_BASE}/api/auth/setup-2fa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username: u,
        password: p,
        code: code,
        totp_code: code
      })
    });

    let data = await res.json().catch(() => ({}));

    // Fallback: если setup-2fa вернул ошибку, пробуем напрямую /api/auth/login с totp_code
    if (!res.ok) {
      const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-ID': getDeviceId()
        },
        body: JSON.stringify({
          username: u,
          password: p,
          totp_code: code
        })
      });
      if (loginRes.ok) {
        res = loginRes;
        data = await loginRes.json().catch(() => ({}));
      }
    }

    if (btn) {
      btn.innerHTML = `<span>Подтвердить и активировать</span>`;
      btn.disabled = false;
    }

    if (!res.ok) {
      showAuthError(data.message || 'Неверный код 2FA. Проверьте время на устройстве.');
      return false;
    }

    setAuthToken(data.token);
    setCurrentUser(data.user);
    document.body.classList.remove('auth-mode');
    if (authBackdrop) authBackdrop.classList.add('hidden');

    if (data.user) {
      const sUser = document.getElementById('sidebarUsername');
      if (sUser) sUser.textContent = data.user.display_name || data.user.username;
      const sRole = document.getElementById('userBadgeRole');
      if (sRole) sRole.textContent = data.user.is_admin ? 'ADMIN' : (`T${data.user.trust_level}`);
    }

    if (onAuthSuccessCallback) {
      onAuthSuccessCallback(data.user);
    }
  } catch (err) {
    if (btn) {
      btn.innerHTML = `<span>Подтвердить и активировать</span>`;
      btn.disabled = false;
    }
    showAuthError('Ошибка подключения к серверу: ' + (err.message || err));
  }
  return false;
}

function bindEvents() {
  if (authStep1) {
    authStep1.addEventListener('submit', (e) => {
      e.preventDefault();
      handleStep1(e);
    });
  }

  if (btnStep1Next) {
    btnStep1Next.addEventListener('click', (e) => {
      e.preventDefault();
      handleStep1(e);
    });
  }

  if (authStepTOTP) {
    authStepTOTP.addEventListener('submit', (e) => {
      e.preventDefault();
      handleStep2TOTP(e);
    });
  }

  if (btnStep2Login) {
    btnStep2Login.addEventListener('click', (e) => {
      e.preventDefault();
      handleStep2TOTP(e);
    });
  }

  if (btnBackToStep1) {
    btnBackToStep1.addEventListener('click', (e) => {
      e.preventDefault();
      handleBackToStep1(e);
    });
  }

  if (authStepSetup2FA) {
    authStepSetup2FA.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSetup2FAConfirm(e);
    });
  }

  if (btnConfirm2FASetup) {
    btnConfirm2FASetup.addEventListener('click', (e) => {
      e.preventDefault();
      handleSetup2FAConfirm(e);
    });
  }

  if (loginPassword) {
    loginPassword.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleStep1(e);
      }
    });
  }

  if (loginUsername) {
    loginUsername.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (loginPassword) loginPassword.focus();
      }
    });
  }

  if (loginTotpCode) {
    loginTotpCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleStep2TOTP(e);
      }
    });
  }

  if (setupTotpInput) {
    setupTotpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSetup2FAConfirm(e);
      }
    });
  }
}

// Экспортируем в глобальную область видимости window для 100% совместимости
window.sharadaSubmitStep1 = handleStep1;
window.sharadaSubmitStep2 = handleStep2TOTP;
window.sharadaSubmitStep3 = handleSetup2FAConfirm;
window.sharadaBackToStep1 = handleBackToStep1;
