/**
 * Sharada Messenger - Modals & Dropdowns Module
 */

const appConfirmModal = document.getElementById('appConfirmModal');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalDesc = document.getElementById('confirmModalDesc');
const btnConfirmModalCancel = document.getElementById('btnConfirmModalCancel');
const btnConfirmModalAction = document.getElementById('btnConfirmModalAction');
let onConfirmModalCallback = null;

export function showAppDialog(titleOrOptions, messageText, confirmText = 'ОК', cancelText = 'Отмена', onConfirm = null) {
  if (!appConfirmModal) {
    console.warn('appConfirmModal element not found');
    return;
  }

  let title = 'Sharada';
  let message = '';
  let isDanger = false;

  if (typeof titleOrOptions === 'object' && titleOrOptions !== null) {
    title = titleOrOptions.title || 'Sharada';
    message = titleOrOptions.message || '';
    confirmText = titleOrOptions.confirmText || 'ОК';
    cancelText = titleOrOptions.cancelText || 'Отмена';
    isDanger = !!titleOrOptions.isDanger;
    onConfirm = titleOrOptions.onConfirm || null;
  } else {
    title = titleOrOptions || 'Sharada';
    message = messageText || '';
  }

  if (confirmModalTitle) confirmModalTitle.textContent = title;
  if (confirmModalDesc) confirmModalDesc.innerHTML = message;
  if (btnConfirmModalAction) {
    btnConfirmModalAction.textContent = confirmText;
    btnConfirmModalAction.className = isDanger ? 'btn-danger' : 'btn-primary';
  }

  if (onConfirm && btnConfirmModalCancel) {
    btnConfirmModalCancel.style.display = 'block';
    btnConfirmModalCancel.textContent = cancelText;
    onConfirmModalCallback = onConfirm;
  } else if (btnConfirmModalCancel) {
    btnConfirmModalCancel.style.display = 'none';
    onConfirmModalCallback = null;
  }

  appConfirmModal.classList.add('active');
}

// Заменяем стандартные браузерные alert на красивые кастомные модалки Sharada
if (typeof window !== 'undefined') {
  window.alert = function(msg) {
    showAppDialog({
      title: 'Sharada',
      message: String(msg)
    });
  };
}

if (btnConfirmModalCancel) {
  btnConfirmModalCancel.addEventListener('click', () => {
    appConfirmModal.classList.remove('active');
    onConfirmModalCallback = null;
  });
}

if (btnConfirmModalAction) {
  btnConfirmModalAction.addEventListener('click', () => {
    appConfirmModal.classList.remove('active');
    if (onConfirmModalCallback) {
      const cb = onConfirmModalCallback;
      onConfirmModalCallback = null;
      cb();
    }
  });
}

export function setupDropdown(container, onChange) {
  if (!container) return;
  const trigger = container.querySelector('.dropdown-trigger');
  const items = container.querySelectorAll('.dropdown-item');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
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

// Закрытие дропдаунов при клике вне
document.addEventListener('click', () => {
  document.querySelectorAll('.custom-dropdown').forEach(d => d.classList.remove('open'));
});
