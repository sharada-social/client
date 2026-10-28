/**
 * Sharada Messenger - Settings & Administration Module
 */
import { getCurrentUser, setCurrentUser, setAuthToken, authFetch, escapeHtml } from './api.js';
import { showAppDialog, setupDropdown } from './modals.js';
import { formatLastSeen } from './chats.js';
import { initDeveloperPanel, handleDevTriggerClick, isDevModeEnabled } from './developer.js';

// Settings UI Elements
const settingsUserAvatar = document.getElementById('settingsUserAvatar');
const settingsUserDisplayName = document.getElementById('settingsUserDisplayName');
const settingsUserHandle = document.getElementById('settingsUserHandle');
const settingsUserRoleBadge = document.getElementById('settingsUserRoleBadge');

const settingsUsernameDisplay = document.getElementById('settingsUsernameDisplay');
const settingsTrustDisplay = document.getElementById('settingsTrustDisplay');
const settingsBadgesList = document.getElementById('settingsBadgesList');
const dropdownTimeout = document.getElementById('dropdownTimeout');
const selectedTimeoutLabel = document.getElementById('selectedTimeoutLabel');
const dropdownPolicy = document.getElementById('dropdownPolicy');
const selectedPolicyLabel = document.getElementById('selectedPolicyLabel');

// Settings Navigation & Section Panes
const settingsNavAccount = document.getElementById('settingsNavAccount');
const settingsNavPrivacy = document.getElementById('settingsNavPrivacy');
const settingsNavStorage = document.getElementById('settingsNavStorage');
const settingsNavDevices = document.getElementById('settingsNavDevices');
const settingsNavAdmin = document.getElementById('settingsNavAdmin');
const settingsNavDeveloper = document.getElementById('settingsNavDeveloper');
const settingsDevTrigger = document.getElementById('settingsDevTrigger');
const settingsNavSubbadge = document.getElementById('settingsNavSubbadge');
const settingsSectionAccount = document.getElementById('settingsSectionAccount');
const settingsSectionPrivacy = document.getElementById('settingsSectionPrivacy');
const settingsSectionStorage = document.getElementById('settingsSectionStorage');
const settingsSectionDevices = document.getElementById('settingsSectionDevices');
const settingsSectionAdmin = document.getElementById('settingsSectionAdmin');
const settingsSectionDeveloper = document.getElementById('settingsSectionDeveloper');
const settingsSubpageLifecycle = document.getElementById('settingsSubpageLifecycle');
const rowAccountLifecycle = document.getElementById('rowAccountLifecycle');
const previewLifecycle = document.getElementById('previewLifecycle');
const btnBackLifecycleSubpage = document.getElementById('btnBackLifecycleSubpage');
const tgTimeOptionsList = document.getElementById('tgTimeOptionsList');
const tgPolicyOptionsList = document.getElementById('tgPolicyOptionsList');
const btnAdminRefresh = document.getElementById('btnAdminRefresh');

// Account Profile Inputs & Badges
const settingsDisplayNameInput = document.getElementById('settingsDisplayNameInput');
const settingsUsernameInput = document.getElementById('settingsUsernameInput');
const settingsBioInput = document.getElementById('settingsBioInput');
const settingsBirthDateInput = document.getElementById('settingsBirthDateInput');
const btnSaveAccountProfile = document.getElementById('btnSaveAccountProfile');
const settingsProfileSaveStatus = document.getElementById('settingsProfileSaveStatus');
const settingsBadgesContainer = document.getElementById('settingsBadgesContainer');
const settingsProfileAvatar = document.getElementById('settingsProfileAvatar');

// Privacy & Password Modal Elements
const rowChangePassword = document.getElementById('rowChangePassword');
const rowPrivacyGoToDevices = document.getElementById('rowPrivacyGoToDevices');
const rowPrivacyAccountLifecycle = document.getElementById('rowPrivacyAccountLifecycle');
const previewPrivacyLifecycle = document.getElementById('previewPrivacyLifecycle');
const changePasswordModal = document.getElementById('changePasswordModal');
const btnCloseChangePasswordModal = document.getElementById('btnCloseChangePasswordModal');
const btnCancelChangePassword = document.getElementById('btnCancelChangePassword');
const btnSubmitChangePassword = document.getElementById('btnSubmitChangePassword');
const changeOldPasswordInput = document.getElementById('changeOldPasswordInput');
const changeNewPasswordInput = document.getElementById('changeNewPasswordInput');
const changeConfirmPasswordInput = document.getElementById('changeConfirmPasswordInput');
const changeTotpCodeInput = document.getElementById('changeTotpCodeInput');
const changePasswordErrorMsg = document.getElementById('changePasswordErrorMsg');

// Storage & Cache Elements
const storageMsgCacheSizeDisplay = document.getElementById('storageMsgCacheSizeDisplay');
const storageTotalCacheSizeDisplay = document.getElementById('storageTotalCacheSizeDisplay');
const btnClearMessageCache = document.getElementById('btnClearMessageCache');
const btnClearAllAppCache = document.getElementById('btnClearAllAppCache');

const adminSettingsSection = document.getElementById('adminSettingsSection');
const btnLogoutSettings = document.getElementById('btnLogoutSettings');
const btnTriggerManualDelete = document.getElementById('btnTriggerManualDelete');

// Admin Elements (now directly inside settingsSectionAdmin)
const newUsernameInput = document.getElementById('newUsernameInput');
const newUserTrustSelect = document.getElementById('newUserTrustSelect');
const btnAdminCreateUser = document.getElementById('btnAdminCreateUser');
const createdKeyBox = document.getElementById('createdKeyBox');
const rawKeyOutput = document.getElementById('rawKeyOutput');
const adminUsersList = document.getElementById('adminUsersList');
const adminLogsContainer = document.getElementById('adminLogsContainer');

// Delete Modal Elements
const deleteConfirmModal = document.getElementById('deleteConfirmModal');
const deletePassInput = document.getElementById('deletePassInput');
const deleteTotpInput = document.getElementById('deleteTotpInput');
const deleteModalError = document.getElementById('deleteModalError');
const btnCancelDeleteModal = document.getElementById('btnCancelDeleteModal');
const btnConfirmDeleteModal = document.getElementById('btnConfirmDeleteModal');

let currentTimeoutMonths = 1;
let currentInactivityPolicy = 'delete';
let currentActiveSection = 'account';
let isSubpageOpen = false;
let isSwitchingSection = false;

function formatTimeoutText(months) {
  if (months === 3) return '3 месяца';
  return '1 месяц';
}

function formatPolicyText(policy) {
  return policy === 'delete' ? 'Полное удаление' : 'Архивация';
}

function updateLifecycleUI() {
  if (previewLifecycle) {
    previewLifecycle.textContent = `${formatTimeoutText(currentTimeoutMonths)} · ${formatPolicyText(currentInactivityPolicy)}`;
  }

  if (tgTimeOptionsList) {
    tgTimeOptionsList.querySelectorAll('.tg-select-item').forEach(item => {
      const months = parseInt(item.dataset.months);
      item.classList.toggle('selected', months === currentTimeoutMonths);
    });
  }

  if (tgPolicyOptionsList) {
    tgPolicyOptionsList.querySelectorAll('.tg-select-card').forEach(card => {
      card.classList.toggle('selected', card.dataset.policy === currentInactivityPolicy);
    });
  }
}

export function openLifecycleSubpage() {
  if (isSubpageOpen || !settingsSubpageLifecycle || !settingsSectionAccount) return;
  isSubpageOpen = true;

  // Плавное выплывание подбейджа в навигации
  if (settingsNavSubbadge) {
    settingsNavSubbadge.classList.add('visible');
  }

  settingsSectionAccount.classList.add('tab-fade-out');
  setTimeout(() => {
    settingsSectionAccount.style.display = 'none';
    settingsSectionAccount.classList.remove('tab-fade-out');

    updateLifecycleUI();
    settingsSubpageLifecycle.style.display = 'flex';
    settingsSubpageLifecycle.classList.add('tab-fade-in');

    setTimeout(() => {
      settingsSubpageLifecycle.classList.remove('tab-fade-in');
    }, 220);
  }, 150);
}

export function closeLifecycleSubpage() {
  if (!isSubpageOpen || !settingsSubpageLifecycle || !settingsSectionAccount) return;
  isSubpageOpen = false;

  // Плавное заплывание подбейджа обратно
  if (settingsNavSubbadge) {
    settingsNavSubbadge.classList.remove('visible');
  }

  settingsSubpageLifecycle.classList.add('tab-fade-out');
  setTimeout(() => {
    settingsSubpageLifecycle.style.display = 'none';
    settingsSubpageLifecycle.classList.remove('tab-fade-out');

    updateLifecycleUI();
    settingsSectionAccount.style.display = 'flex';
    settingsSectionAccount.classList.add('tab-fade-in');

    setTimeout(() => {
      settingsSectionAccount.classList.remove('tab-fade-in');
    }, 220);
  }, 150);
}

export function switchSettingsSection(section) {
  if (currentActiveSection === section || isSwitchingSection) return;
  isSwitchingSection = true;

  if (isSubpageOpen) {
    isSubpageOpen = false;
    if (settingsNavSubbadge) settingsNavSubbadge.classList.remove('visible');
    if (settingsSubpageLifecycle) settingsSubpageLifecycle.style.display = 'none';
  }

  const getSectionPane = (s) => {
    if (s === 'admin') return settingsSectionAdmin;
    if (s === 'devices') return settingsSectionDevices;
    if (s === 'privacy') return settingsSectionPrivacy;
    if (s === 'storage') return settingsSectionStorage;
    if (s === 'developer') return settingsSectionDeveloper;
    return settingsSectionAccount;
  };

  const outgoing = getSectionPane(currentActiveSection);
  const incoming = getSectionPane(section);

  // Переключаем активный таб в левой колонке
  [settingsNavAccount, settingsNavPrivacy, settingsNavStorage, settingsNavDevices, settingsNavAdmin, settingsNavDeveloper].forEach(el => {
    if (el) el.classList.remove('active');
  });

  if (section === 'devices' && settingsNavDevices) {
    settingsNavDevices.classList.add('active');
  } else if (section === 'privacy' && settingsNavPrivacy) {
    settingsNavPrivacy.classList.add('active');
  } else if (section === 'storage' && settingsNavStorage) {
    settingsNavStorage.classList.add('active');
    updateStorageDisplay();
  } else if (section === 'admin' && settingsNavAdmin) {
    settingsNavAdmin.classList.add('active');
  } else if (section === 'developer' && settingsNavDeveloper) {
    settingsNavDeveloper.classList.add('active');
  } else if (settingsNavAccount) {
    settingsNavAccount.classList.add('active');
  }

  // Плавное затухание старого контента
  if (outgoing) {
    outgoing.classList.add('tab-fade-out');
  }

  setTimeout(() => {
    if (outgoing) {
      outgoing.style.display = 'none';
      outgoing.classList.remove('tab-fade-out');
    }
    if (incoming) {
      incoming.style.display = 'flex';
      incoming.classList.add('tab-fade-in');
    }

    if (currentActiveSection === 'devices') {
      stopDeviceIconCycling();
    }

    currentActiveSection = section;

    if (section === 'admin') {
      loadAdminData();
    } else if (section === 'devices') {
      startDeviceIconCycling();
      loadDevicesAndSessions();
    }

    setTimeout(() => {
      if (incoming) incoming.classList.remove('tab-fade-in');
      isSwitchingSection = false;
    }, 220);
  }, 160);
}

export function initSettings() {
  // Переключение вкладок слева в настройках
  if (settingsNavAccount) {
    settingsNavAccount.addEventListener('click', () => {
      if (isSubpageOpen) {
        closeLifecycleSubpage();
      } else {
        switchSettingsSection('account');
      }
    });
  }
  if (settingsNavPrivacy) {
    settingsNavPrivacy.addEventListener('click', () => switchSettingsSection('privacy'));
  }
  if (settingsNavStorage) {
    settingsNavStorage.addEventListener('click', () => switchSettingsSection('storage'));
  }
  if (settingsNavDevices) {
    settingsNavDevices.addEventListener('click', () => switchSettingsSection('devices'));
  }
  if (settingsNavAdmin) {
    settingsNavAdmin.addEventListener('click', () => switchSettingsSection('admin'));
  }
  if (settingsNavDeveloper) {
    settingsNavDeveloper.addEventListener('click', () => switchSettingsSection('developer'));
  }

  // Привязка действий Privacy и смены пароля
  if (rowChangePassword) {
    rowChangePassword.addEventListener('click', openChangePasswordModal);
  }
  if (btnCloseChangePasswordModal) {
    btnCloseChangePasswordModal.addEventListener('click', closeChangePasswordModal);
  }
  if (btnCancelChangePassword) {
    btnCancelChangePassword.addEventListener('click', closeChangePasswordModal);
  }
  if (btnSubmitChangePassword) {
    btnSubmitChangePassword.addEventListener('click', handleChangePasswordSubmit);
  }
  if (rowPrivacyGoToDevices) {
    rowPrivacyGoToDevices.addEventListener('click', () => switchSettingsSection('devices'));
  }

  // Привязка сохранения профиля
  if (btnSaveAccountProfile) {
    btnSaveAccountProfile.addEventListener('click', handleSaveAccountProfile);
  }

  // Привязка очистки кэша и хранилища
  if (btnClearMessageCache) {
    btnClearMessageCache.addEventListener('click', handleClearMessageCache);
  }
  if (btnClearAllAppCache) {
    btnClearAllAppCache.addEventListener('click', handleClearAllAppCache);
  }
  if (settingsDevTrigger) {
    settingsDevTrigger.addEventListener('click', () => {
      handleDevTriggerClick(() => {
        if (settingsNavDeveloper) settingsNavDeveloper.style.display = 'flex';
        switchSettingsSection('developer');
      });
    });
  }
  initDeveloperPanel();
  if (btnAdminRefresh) {
    btnAdminRefresh.addEventListener('click', () => loadAdminData());
  }

  // Клик на пункт "Жизненный цикл аккаунта" -> переход на подстраницу в стиле Telegram
  if (rowAccountLifecycle) {
    rowAccountLifecycle.addEventListener('click', openLifecycleSubpage);
  }

  // Кнопка назад в подстранице
  if (btnBackLifecycleSubpage) {
    btnBackLifecycleSubpage.addEventListener('click', closeLifecycleSubpage);
  }

  // Выбор времени в подстранице
  if (tgTimeOptionsList) {
    tgTimeOptionsList.querySelectorAll('.tg-select-item').forEach(item => {
      item.addEventListener('click', () => {
        const months = parseInt(item.dataset.months);
        if (months && months !== currentTimeoutMonths) {
          currentTimeoutMonths = months;
          updateLifecycleUI();
          saveUserSettings();
        }
      });
    });
  }

  // Выбор действия в подстранице
  if (tgPolicyOptionsList) {
    tgPolicyOptionsList.querySelectorAll('.tg-select-card').forEach(card => {
      card.addEventListener('click', () => {
        const policy = card.dataset.policy;
        if (policy && policy !== currentInactivityPolicy) {
          currentInactivityPolicy = policy;
          updateLifecycleUI();
          saveUserSettings();
        }
      });
    });
  }

  // Выход из учетной записи
  if (btnLogoutSettings) {
    btnLogoutSettings.addEventListener('click', () => {
      showAppDialog({
        title: 'Выход из учетной записи',
        message: 'Вы уверены, что хотите завершить сессию Sharada на этом устройстве?',
        confirmText: 'Выйти',
        isDanger: true,
        onConfirm: () => {
          setAuthToken(null);
          window.location.reload();
        }
      });
    });
  }

  // Удаление аккаунта
  if (btnTriggerManualDelete) {
    btnTriggerManualDelete.addEventListener('click', () => {
      deleteConfirmModal.classList.add('active');
    });
  }

  if (btnCancelDeleteModal) {
    btnCancelDeleteModal.addEventListener('click', () => {
      deleteConfirmModal.classList.remove('active');
      deleteModalError.style.display = 'none';
    });
  }

  if (btnConfirmDeleteModal) {
    btnConfirmDeleteModal.addEventListener('click', handleManualDelete);
  }

  if (btnAdminCreateUser) {
    btnAdminCreateUser.addEventListener('click', handleAdminCreateUser);
  }

  window.adminUnarchive = adminUnarchive;
  window.adminPurge = adminPurge;
}

export function setupSettingsUI() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;

  const displayName = currentUser.display_name || currentUser.username;
  if (settingsUserDisplayName) settingsUserDisplayName.textContent = displayName;
  if (settingsUserHandle) settingsUserHandle.textContent = `@${currentUser.username}`;
  if (settingsUserAvatar) settingsUserAvatar.textContent = (displayName || 'A').charAt(0).toUpperCase();
  if (settingsProfileAvatar) settingsProfileAvatar.textContent = (displayName || 'A').charAt(0).toUpperCase();

  // Заполнение инпутов профиля
  if (settingsDisplayNameInput) settingsDisplayNameInput.value = currentUser.display_name || '';
  if (settingsUsernameInput) settingsUsernameInput.value = currentUser.username || '';
  if (settingsBioInput) settingsBioInput.value = currentUser.bio || '';
  if (settingsBirthDateInput && currentUser.birth_date) {
    // Форматирование YYYY-MM-DD
    settingsBirthDateInput.value = currentUser.birth_date.split('T')[0];
  }

  const isAdmin = !!currentUser.is_admin;
  if (settingsUserRoleBadge) {
    settingsUserRoleBadge.style.display = isAdmin ? 'inline-flex' : 'none';
    settingsUserRoleBadge.textContent = isAdmin ? 'ADMIN' : 'USER';
  }

  // Админка как отдельный раздел в левом меню настроек - видна ТОЛЬКО админу!
  if (settingsNavAdmin) {
    settingsNavAdmin.style.display = isAdmin ? 'flex' : 'none';
  }

  if (!isAdmin && currentActiveSection === 'admin') {
    switchSettingsSection('account');
  }

  if (settingsUsernameDisplay) settingsUsernameDisplay.textContent = currentUser.username;
  const trustNames = ['untrusted (0)', 'trusted (1)', 'force_trusted (2)'];
  if (settingsTrustDisplay) settingsTrustDisplay.textContent = `Уровень доверия: ${trustNames[currentUser.trust_level] || '0'}`;

  // Отрисовка бейджей ролей в виде красивых пилюль
  if (settingsBadgesContainer) {
    settingsBadgesContainer.innerHTML = '';
    const rolesList = [];
    if (isAdmin) rolesList.push({ name: 'ADMIN', color: 'admin' });
    if (currentUser.trust_level === 2) rolesList.push({ name: 'TRUSTED', color: 'vip' });
    if (currentUser.roles && currentUser.roles.length > 0) {
      currentUser.roles.forEach(r => {
        rolesList.push({ name: r.name, color: 'mod' });
      });
    }
    if (rolesList.length === 0) {
      rolesList.push({ name: 'MEMBER', color: 'user' });
    }
    rolesList.forEach(r => {
      const pill = document.createElement('span');
      pill.className = `role-badge-pill role-${r.color}`;
      pill.textContent = r.name;
      settingsBadgesContainer.appendChild(pill);
    });
  }

  if (currentUser.roles && settingsBadgesList) {
    settingsBadgesList.textContent = currentUser.roles.map(r => r.name).join(', ') || (isAdmin ? 'ADMIN' : 'Стандартные');
  }

  currentTimeoutMonths = currentUser.inactivity_timeout_months || 1;
  currentInactivityPolicy = currentUser.inactivity_policy || 'delete';

  updateLifecycleUI();
  if (previewPrivacyLifecycle) {
    previewPrivacyLifecycle.textContent = `${formatTimeoutText(currentTimeoutMonths)}`;
  }
  updateStorageDisplay();
}

function updateStorageDisplay() {
  try {
    let msgCacheBytes = 0;
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key) || '';
      const itemSize = (key.length + val.length) * 2;
      totalBytes += itemSize;
      if (key && (key.startsWith('sharada_cached_') || key.startsWith('sharada_outbox_'))) {
        msgCacheBytes += itemSize;
      }
    }
    if (storageMsgCacheSizeDisplay) {
      storageMsgCacheSizeDisplay.textContent = formatBytes(msgCacheBytes);
    }
    if (storageTotalCacheSizeDisplay) {
      storageTotalCacheSizeDisplay.textContent = formatBytes(totalBytes);
    }
  } catch (e) {
    console.error('Storage calculate error', e);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function handleClearMessageCache() {
  showAppDialog({
    title: 'Очистка кэша сообщений',
    message: 'Кэш сообщений и списков чатов будет очищен на этом устройстве. При открытии чатов история подгрузится с сервера заново.',
    confirmText: 'Очистить',
    isDanger: false,
    onConfirm: () => {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sharada_cached_') || key.startsWith('sharada_outbox_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      updateStorageDisplay();
      showAppDialog({
        title: 'Успешно',
        message: 'Кэш сообщений успешно очищен.',
        confirmText: 'ОК'
      });
    }
  });
}

function handleClearAllAppCache() {
  showAppDialog({
    title: 'Сброс всех локальных данных',
    message: 'Это приведет к очистке всех данных, включая активную сессию и токен. Приложение вернется к экрану входа.',
    confirmText: 'Сбросить и выйти',
    isDanger: true,
    onConfirm: () => {
      localStorage.clear();
      window.location.reload();
    }
  });
}

async function handleSaveAccountProfile() {
  if (!btnSaveAccountProfile) return;
  btnSaveAccountProfile.disabled = true;
  btnSaveAccountProfile.textContent = 'Сохранение...';
  if (settingsProfileSaveStatus) settingsProfileSaveStatus.textContent = '';

  const displayName = settingsDisplayNameInput ? settingsDisplayNameInput.value.trim() : '';
  const username = settingsUsernameInput ? settingsUsernameInput.value.trim() : '';
  const bio = settingsBioInput ? settingsBioInput.value.trim() : '';
  const birthDate = settingsBirthDateInput ? settingsBirthDateInput.value.trim() : '';

  try {
    const res = await authFetch('/api/user/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        display_name: displayName,
        username: username,
        bio: bio,
        birth_date: birthDate
      })
    });
    const data = await res.json();
    btnSaveAccountProfile.disabled = false;
    btnSaveAccountProfile.textContent = 'Сохранить изменения';

    if (!res.ok) {
      showAppDialog({
        title: 'Ошибка сохранения',
        message: data.message || 'Не удалось обновить профиль',
        confirmText: 'Понятно',
        isDanger: true
      });
      return;
    }

    setCurrentUser(data);
    setupSettingsUI();
    if (settingsProfileSaveStatus) {
      settingsProfileSaveStatus.textContent = '✓ Изменения успешно сохранены';
      setTimeout(() => {
        if (settingsProfileSaveStatus) settingsProfileSaveStatus.textContent = '';
      }, 3000);
    }
  } catch (err) {
    btnSaveAccountProfile.disabled = false;
    btnSaveAccountProfile.textContent = 'Сохранить изменения';
    showAppDialog({
      title: 'Ошибка сети',
      message: err.message || 'Не удалось связаться с сервером',
      confirmText: 'ОК',
      isDanger: true
    });
  }
}

function openChangePasswordModal() {
  if (!changePasswordModal) return;
  changePasswordModal.classList.add('active');
  if (changePasswordErrorMsg) changePasswordErrorMsg.style.display = 'none';
  if (changeOldPasswordInput) changeOldPasswordInput.value = '';
  if (changeNewPasswordInput) changeNewPasswordInput.value = '';
  if (changeConfirmPasswordInput) changeConfirmPasswordInput.value = '';
  if (changeTotpCodeInput) changeTotpCodeInput.value = '';
}

function closeChangePasswordModal() {
  if (!changePasswordModal) return;
  changePasswordModal.classList.remove('active');
}

async function handleChangePasswordSubmit() {
  const oldPassword = changeOldPasswordInput ? changeOldPasswordInput.value.trim() : '';
  const newPassword = changeNewPasswordInput ? changeNewPasswordInput.value.trim() : '';
  const confirmPassword = changeConfirmPasswordInput ? changeConfirmPasswordInput.value.trim() : '';
  const totpCode = changeTotpCodeInput ? changeTotpCodeInput.value.trim() : '';

  if (!oldPassword || !newPassword) {
    if (changePasswordErrorMsg) {
      changePasswordErrorMsg.textContent = 'Заполните текущий и новый ключ доступа';
      changePasswordErrorMsg.style.display = 'block';
    }
    return;
  }
  if (newPassword !== confirmPassword) {
    if (changePasswordErrorMsg) {
      changePasswordErrorMsg.textContent = 'Новые ключи доступа не совпадают';
      changePasswordErrorMsg.style.display = 'block';
    }
    return;
  }

  if (btnSubmitChangePassword) {
    btnSubmitChangePassword.disabled = true;
    btnSubmitChangePassword.textContent = 'Проверка...';
  }

  try {
    const res = await authFetch('/api/user/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
        totp_code: totpCode
      })
    });
    const data = await res.json();
    if (btnSubmitChangePassword) {
      btnSubmitChangePassword.disabled = false;
      btnSubmitChangePassword.textContent = 'Обновить ключ';
    }

    if (!res.ok) {
      if (changePasswordErrorMsg) {
        changePasswordErrorMsg.textContent = data.message || 'Ошибка смены пароля';
        changePasswordErrorMsg.style.display = 'block';
      }
      return;
    }

    closeChangePasswordModal();
    showAppDialog({
      title: 'Ключ обновлен',
      message: 'Ваш ключ доступа успешно изменен. Сохраните новый ключ в надежном месте!',
      confirmText: 'Отлично'
    });
  } catch (err) {
    if (btnSubmitChangePassword) {
      btnSubmitChangePassword.disabled = false;
      btnSubmitChangePassword.textContent = 'Обновить ключ';
    }
    if (changePasswordErrorMsg) {
      changePasswordErrorMsg.textContent = 'Ошибка сети: ' + err.message;
      changePasswordErrorMsg.style.display = 'block';
    }
  }
}

async function saveUserSettings() {
  try {
    const res = await authFetch('/api/user/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inactivity_timeout_months: currentTimeoutMonths,
        inactivity_policy: currentInactivityPolicy
      })
    });
    if (res.ok) {
      const user = await res.json();
      setCurrentUser(user);
    }
  } catch (e) {
    console.error('Save settings error', e);
  }
}

async function handleManualDelete() {
  deleteModalError.style.display = 'none';
  const password = deletePassInput.value.trim();
  const totpCode = deleteTotpInput.value.trim();

  if (!password || !totpCode) {
    deleteModalError.textContent = 'Введите ключ доступа и TOTP код';
    deleteModalError.style.display = 'block';
    return;
  }

  try {
    const res = await authFetch('/api/user/me/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
        setAuthToken(null);
        window.location.reload();
      }
    });
  } catch (e) {
    deleteModalError.textContent = 'Ошибка выполнения';
    deleteModalError.style.display = 'block';
  }
}

async function loadAdminData() {
  const currentUser = getCurrentUser();
  if (!currentUser?.is_admin) return;

  try {
    const res = await authFetch('/api/admin/users');
    const users = await res.json();
    renderAdminUsers(users);

    const logsRes = await authFetch('/api/admin/logs');
    const logs = await logsRes.json();
    renderAdminLogs(logs);
  } catch (e) {
    console.error('Admin data error', e);
  }
}

function renderAdminUsers(users) {
  if (!adminUsersList) return;
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
  if (!adminLogsContainer) return;
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

async function handleAdminCreateUser() {
  const username = newUsernameInput.value.trim();
  const trustLevel = parseInt(newUserTrustSelect.value);

  if (!username) {
    showAppDialog({ title: 'Предупреждение', message: 'Введите имя пользователя' });
    return;
  }

  try {
    const res = await authFetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
}

export async function adminUnarchive(targetUserId) {
  await authFetch('/api/admin/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: targetUserId, target_user_id: targetUserId, action: 'unarchive' })
  });
  loadAdminData();
}

export function adminPurge(targetUserId) {
  showAppDialog({
    title: 'Уничтожение аккаунта',
    message: 'Полностью стереть эту учетную запись и все её сообщения/посты из базы данных навсегда? (Глубокие системные логи сохранятся).',
    confirmText: 'Уничтожить навсегда',
    isDanger: true,
    onConfirm: async () => {
      await authFetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: targetUserId, target_user_id: targetUserId, action: 'purge' })
      });
      loadAdminData();
    }
  });
}

// ==========================================================
// УПРАВЛЕНИЕ УСТРОЙСТВАМИ И СЕССИЯМИ (РАЗДЕЛ НАСТРОЕК)
// ==========================================================
const DEVICE_ICONS = {
  android: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.4472,4.10555 C18.9412,4.35254 19.1414,4.95321 18.8944,5.44719 L17.7199,7.79631 C20.3074,9.6038 22,12.6042 22,16 L22,17 C22,18.1046 21.1046,19 20,19 L4,19 C2.89543,19 2,18.1046 2,17 L2,16 C2,12.6042 3.69259,9.60379 6.28014,7.79631 L5.10558,5.44719 C4.85859,4.95321 5.05881,4.35254 5.55279,4.10555 C6.04677,3.85856 6.64744,4.05878 6.89443,4.55276 L8.028,6.8199 C9.24553,6.29239 10.5886,6 12,6 C13.4114,6 14.7545,6.29239 15.972,6.81991 L17.1056,4.55276 C17.3526,4.05878 17.9532,3.85856 18.4472,4.10555 Z M7.5,12 C6.67157,12 6,12.6716 6,13.5 C6,14.3284 6.67157,15 7.5,15 C8.32843,15 9,14.3284 9,13.5 C9,12.6716 8.32843,12 7.5,12 Z M16.5,12 C15.6716,12 15,12.6716 15,13.5 C15,14.3284 15.6716,15 16.5,15 C17.3284,15 18,14.3284 18,13.5 C18,12.6716 17.3284,12 16.5,12 Z"/></svg>`,
  linux: `<svg viewBox="-5 0 32 32" fill="currentColor"><path d="M16.469 9.375c-1.063-0.594-1.406-1.938-0.813-3 0.406-0.719 1.156-1.094 1.906-1.094 0.375 0 0.75 0.094 1.094 0.281 1.063 0.625 1.406 1.969 0.813 3-0.406 0.719-1.156 1.094-1.906 1.094-0.375 0-0.75-0.094-1.094-0.281zM21.938 15.594h-3.625c-0.125-1.688-0.969-3.188-2.25-4.156-0.219-0.156-0.438-0.313-0.688-0.469-0.813-0.438-1.75-0.688-2.75-0.688-1.031 0-1.969 0.25-2.813 0.719l-2-3.031c1.406-0.844 3.031-1.313 4.813-1.313 0.688 0 1.375 0.063 2.063 0.219-0.25 1.219 0.281 2.5 1.406 3.156 0.438 0.25 0.938 0.375 1.469 0.375 0.719 0 1.406-0.25 1.938-0.719 1.438 1.563 2.344 3.625 2.438 5.906zM7.125 8.438l2 3.031c-1.25 0.969-2.094 2.438-2.188 4.125-0.031 0.125-0.031 0.25-0.031 0.406 0 0.125 0 0.281 0.031 0.406 0.125 1.781 1.063 3.313 2.438 4.281l-1.906 3.094c-1.813-1.188-3.188-3-3.813-5.125 0.875-0.5 1.5-1.469 1.5-2.563s-0.625-2.094-1.563-2.594c0.594-2.063 1.844-3.844 3.531-5.063zM2.188 13.906c1.219 0 2.219 0.969 2.219 2.188s-1 2.219-2.219 2.219-2.188-1-2.188-2.219 0.969-2.188 2.188-2.188zM8.188 24.219l1.906-3.125c0.75 0.375 1.625 0.594 2.531 0.594 1 0 1.938-0.25 2.781-0.719 0.25-0.125 0.469-0.281 0.688-0.469 1.25-0.938 2.094-2.406 2.219-4.094h3.625c-0.094 2.375-1.094 4.531-2.656 6.125-0.469-0.344-1.063-0.531-1.656-0.531-0.531 0-1.031 0.125-1.469 0.375-1 0.594-1.531 1.656-1.469 2.719-0.688 0.156-1.375 0.25-2.063 0.25-1.625 0-3.125-0.406-4.438-1.125zM17.625 22.75c0.75 0 1.5 0.375 1.906 1.094 0.594 1.063 0.219 2.438-0.813 3.031-0.344 0.188-0.719 0.281-1.094 0.281-0.781 0-1.5-0.375-1.906-1.094-0.625-1.063-0.25-2.406 0.813-3.031 0.344-0.188 0.719-0.281 1.094-0.281z"/></svg>`,
  windows: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21,13 L21,20.4336 C21,21.29069 20.286303,21.9635798 19.4473255,21.9327857 L19.3139,21.922 L12,21.0078 L12,13 L21,13 Z M10,13 L10,20.7578 L4.75193,20.1018 C3.75107,19.9767 3,19.1259 3,18.1172 L3,13 L10,13 Z M19.3139,2.07797 C20.164435,1.9716555 20.9206588,2.59635698 20.9941548,3.43265093 L21,3.56638 L21,11 L12,11 L12,2.99221 L19.3139,2.07797 Z M10,3.24221 L10,11 L3,11 L3,5.88277 C3,4.87413 3.75107,4.02333 4.75193,3.89822 L10,3.24221 Z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.0642063,6.68503859 L13.8086928,6.3792228 C14.4141414,6.1381387 15.1955385,5.89389769 16.1192,6.04915 C18.01,6.36695 19.3145,7.38793 20.0914,8.74213 C20.3908,9.26401 20.1489,9.95146 19.5887,10.1709 C18.6569,10.5358 17.9999,11.4424 17.9999,12.4999 C17.9999,13.6076 18.7211,14.5496 19.7222,14.8768 C20.2405,15.0463 20.5317,15.6216 20.3615,16.1396 C19.9201,17.4823 19.2836,18.7212 18.5305,19.7212 C17.7871,20.7085 16.879,21.5295 15.868,21.9297 C15.2087692,22.1906231 14.5002485,22.093203 13.8227292,21.9251046 L13.4205801,21.8180656 L13.4205801,21.8180656 L12.823737,21.6446444 C12.5527889,21.5663333 12.2747,21.4982 11.9999,21.4982 C11.7251,21.4982 11.4470111,21.5663333 11.1760926,21.6446444 L10.5793129,21.8180656 L10.5793129,21.8180656 L10.1771497,21.9251046 C9.49960781,22.093203 8.79107231,22.1906231 8.13188,21.9297 C6.85861,21.4257 5.73553,20.2497 4.88738,18.8633 C4.02419,17.4522 3.37005,15.7027 3.10335,13.8774 C2.87624,12.3229 2.99884,10.5784 3.71813,9.10178 C4.45891,7.58105 5.81382,6.39659 7.8806,6.04915 C8.72039231,5.90798077 9.44255148,6.09701272 10.0217748,6.31368782 L10.3519541,6.4445896 L10.3519541,6.4445896 L10.9356922,6.68504281 C11.3354,6.8416625 11.65145,6.93389 11.9999,6.93389 C12.348425,6.93389 12.6644938,6.84165688 13.0642063,6.68503859 Z M11.7677,2.76766 C12.744,1.79135 14.2426,1.707 14.5961,2.06056 C14.9497,2.41411 14.8653,3.91267 13.889,4.88898 C12.9127,5.86529 11.4141,5.94964 11.0606,5.59609 C10.707,5.24254 10.7914,3.74397 11.7677,2.76766 Z"/></svg>`
};

function detectDeviceType(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('macintosh') || ua.includes('darwin')) return 'apple';
  if (ua.includes('linux')) return 'linux';
  return 'windows';
}

const CYCLING_DEVICES = ['android', 'linux', 'windows', 'apple'];
let cyclingIndex = 0;
let cyclingTimer = null;

function startDeviceIconCycling() {
  stopDeviceIconCycling();
  const el = document.getElementById('deviceCyclingIcon');
  if (!el) return;
  el.innerHTML = DEVICE_ICONS[CYCLING_DEVICES[cyclingIndex]];
  el.classList.add('icon-fade-in');

  cyclingTimer = setInterval(() => {
    el.classList.remove('icon-fade-in');
    el.classList.add('icon-fade-out');
    setTimeout(() => {
      cyclingIndex = (cyclingIndex + 1) % CYCLING_DEVICES.length;
      el.innerHTML = DEVICE_ICONS[CYCLING_DEVICES[cyclingIndex]];
      el.classList.remove('icon-fade-out');
      el.classList.add('icon-fade-in');
    }, 350);
  }, 2500);
}

function stopDeviceIconCycling() {
  if (cyclingTimer) {
    clearInterval(cyclingTimer);
    cyclingTimer = null;
  }
}

let currentSelectedSession = null;

export async function loadDevicesAndSessions() {
  try {
    const res = await authFetch('/api/user/sessions');
    if (!res.ok) return;
    const data = await res.json();
    const current = data.current_session;
    const activeSessions = data.active_sessions || [];

    // 6.2.1: Это устройство
    const currentIconEl = document.getElementById('currentDeviceIcon');
    const currentTitleEl = document.getElementById('currentDeviceTitle');
    const currentSubtitleEl = document.getElementById('currentDeviceSubtitle');
    const currentLocationEl = document.getElementById('currentDeviceLocation');

    if (current) {
      const devType = detectDeviceType(current.device_info);
      if (currentIconEl) currentIconEl.innerHTML = DEVICE_ICONS[devType] || DEVICE_ICONS.windows;
      if (currentTitleEl) {
        currentTitleEl.textContent = devType.charAt(0).toUpperCase() + devType.slice(1) + ' Device';
      }
      if (currentSubtitleEl) {
        currentSubtitleEl.textContent = 'sharada 1.0.0 desktop • онлайн';
      }
      if (currentLocationEl) {
        const ipStr = current.ip_address ? `${current.ip_address} • ` : '';
        currentLocationEl.textContent = `${ipStr}${current.location || 'Локальная сеть'}`;
      }
    }

    // 6.2.2: Активные сессии
    const activeListEl = document.getElementById('activeSessionsList');
    if (activeListEl) {
      if (activeSessions.length === 0) {
        activeListEl.innerHTML = '<div class="settings-empty-placeholder">Нет других активных сессий</div>';
      } else {
        activeListEl.innerHTML = '';
        activeSessions.forEach(sess => {
          const devType = detectDeviceType(sess.device_info);
          const row = document.createElement('div');
          row.className = 'session-item-row';
          const lastActiveStr = sess.last_active_at ? formatLastSeen(sess.last_active_at) : 'недавно';
          const sessIpStr = sess.ip_address ? `${sess.ip_address} • ` : '';

          row.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px;">
              <div class="device-badge-icon">
                ${DEVICE_ICONS[devType] || DEVICE_ICONS.windows}
              </div>
              <div>
                <div style="font-weight:700; font-size:15px; color:#fff;">
                  ${devType.charAt(0).toUpperCase() + devType.slice(1)} Device
                </div>
                <div style="font-size:13px; color:var(--text-muted); margin-top:2px;">
                  ${sessIpStr}${sess.location || 'Локальная сеть'} • ${lastActiveStr}
                </div>
              </div>
            </div>
            <svg style="width:18px; height:18px; fill:var(--text-muted);" viewBox="0 0 24 24"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/></svg>
          `;
          row.addEventListener('click', () => openSessionDetailModal(sess));
          activeListEl.appendChild(row);
        });
      }
    }
  } catch (e) {
    console.error('Failed to load sessions', e);
  }
}

export function openSessionDetailModal(sess) {
  currentSelectedSession = sess;
  const modal = document.getElementById('sessionDetailModal');
  if (!modal) return;

  const devType = detectDeviceType(sess.device_info);
  const iconEl = document.getElementById('sessionModalIcon');
  const nameEl = document.getElementById('sessionModalDeviceName');
  const activeEl = document.getElementById('sessionModalLastActive');
  const clientEl = document.getElementById('sessionModalClientName');
  const locEl = document.getElementById('sessionModalLocation');
  const ipEl = document.getElementById('sessionModalIP');
  const toggleE2EE = document.getElementById('toggleSessionE2EE');
  const toggleCalls = document.getElementById('toggleSessionCalls');

  if (iconEl) iconEl.innerHTML = DEVICE_ICONS[devType] || DEVICE_ICONS.windows;
  if (nameEl) nameEl.textContent = `${devType.charAt(0).toUpperCase() + devType.slice(1)} Device`;
  if (activeEl) activeEl.textContent = sess.last_active_at ? `Был(а) в сети ${formatLastSeen(sess.last_active_at)}` : 'Онлайн';
  if (clientEl) clientEl.textContent = `sharada 1.0.0 ${devType}`;
  if (locEl) locEl.textContent = sess.location || 'Россия, Локальная сеть';
  if (ipEl) ipEl.textContent = sess.ip_address || '127.0.0.1';

  if (toggleE2EE) toggleE2EE.checked = (sess.allow_e2ee !== false);
  if (toggleCalls) toggleCalls.checked = (sess.allow_calls !== false);

  modal.classList.add('active');
}

async function saveSessionSettings() {
  if (!currentSelectedSession) return;
  const toggleE2EE = document.getElementById('toggleSessionE2EE');
  const toggleCalls = document.getElementById('toggleSessionCalls');
  try {
    await authFetch('/api/user/sessions/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: currentSelectedSession.id,
        allow_e2ee: toggleE2EE ? toggleE2EE.checked : true,
        allow_calls: toggleCalls ? toggleCalls.checked : true
      })
    });
  } catch (e) {
    console.error('Failed to update session settings', e);
  }
}

async function terminateSelectedSession() {
  if (!currentSelectedSession) return;
  showAppDialog({
    title: 'Завершить сессию',
    message: 'Вы действительно хотите завершить эту сессию? Устройство будет принудительно отключено от аккаунта.',
    isConfirm: true,
    confirmText: 'Завершить',
    isDanger: true,
    onConfirm: async () => {
      try {
        const res = await authFetch('/api/user/sessions/terminate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: currentSelectedSession.id })
        });
        if (res.ok) {
          const modal = document.getElementById('sessionDetailModal');
          if (modal) modal.classList.remove('active');
          loadDevicesAndSessions();
        } else {
          showAppDialog({ title: 'Ошибка', message: 'Не удалось завершить сессию' });
        }
      } catch (e) {
        showAppDialog({ title: 'Ошибка', message: e.message });
      }
    }
  });
}

async function terminateOtherSessions() {
  showAppDialog({
    title: 'Завершить другие сессии',
    message: 'Вы уверены, что хотите завершить все другие сессии? Вы выйдете из аккаунта на всех устройствах, кроме этого.',
    isConfirm: true,
    confirmText: 'Завершить другие',
    isDanger: true,
    onConfirm: async () => {
      try {
        const res = await authFetch('/api/user/sessions/terminate-others', {
          method: 'POST'
        });
        if (res.ok) {
          loadDevicesAndSessions();
          showAppDialog({ title: 'Успешно', message: 'Все остальные сессии были завершены.' });
        } else {
          showAppDialog({ title: 'Ошибка', message: 'Не удалось завершить сессии' });
        }
      } catch (e) {
        showAppDialog({ title: 'Ошибка сети', message: e.message });
      }
    }
  });
}

async function openAddDeviceQRModal() {
  const modal = document.getElementById('addDeviceQRModal');
  const imgEl = document.getElementById('addDeviceQRImage');
  if (!modal) return;

  try {
    const res = await authFetch('/api/user/sessions/qr-link');
    if (res.ok) {
      const data = await res.json();
      if (imgEl && data.qr_payload) {
        imgEl.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_payload)}`;
      }
      modal.classList.add('active');
    }
  } catch (e) {
    showAppDialog({ title: 'Ошибка', message: 'Не удалось сгенерировать QR-код сопряжения' });
  }
}

// Привязка слушателей для устройств и сессий
document.addEventListener('DOMContentLoaded', () => {
  const btnTermOthers = document.getElementById('btnTerminateOtherSessions');
  if (btnTermOthers) btnTermOthers.addEventListener('click', terminateOtherSessions);

  const btnTermSelected = document.getElementById('btnTerminateSelectedSession');
  if (btnTermSelected) btnTermSelected.addEventListener('click', terminateSelectedSession);

  const toggleE2EE = document.getElementById('toggleSessionE2EE');
  if (toggleE2EE) toggleE2EE.addEventListener('change', saveSessionSettings);

  const toggleCalls = document.getElementById('toggleSessionCalls');
  if (toggleCalls) toggleCalls.addEventListener('change', saveSessionSettings);

  const btnCloseSessionModal = document.getElementById('btnCloseSessionDetailModal');
  if (btnCloseSessionModal) {
    btnCloseSessionModal.addEventListener('click', () => {
      const modal = document.getElementById('sessionDetailModal');
      if (modal) modal.classList.remove('active');
    });
  }

  const btnAddQR = document.getElementById('btnAddDeviceQR');
  if (btnAddQR) btnAddQR.addEventListener('click', openAddDeviceQRModal);

  const btnCloseQRModal = document.getElementById('btnCloseAddDeviceQRModal');
  if (btnCloseQRModal) {
    btnCloseQRModal.addEventListener('click', () => {
      const modal = document.getElementById('addDeviceQRModal');
      if (modal) modal.classList.remove('active');
    });
  }
});

