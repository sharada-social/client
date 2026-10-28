/**
 * Sharada Messenger - Search & Device Contacts Module
 */
import { authFetch, escapeHtml } from './api.js';
import { cachedChannels, openChat, createDirectChat } from './chats.js';
import { showAppDialog } from './modals.js';

const searchInput = document.getElementById('searchInput');
const chatList = document.getElementById('chatList');
const newChatSearchInput = document.getElementById('newChatSearchInput');
const newChatSearchResults = document.getElementById('newChatSearchResults');

export let cachedContacts = JSON.parse(localStorage.getItem('sharada_contacts') || '[]');

let searchDebounce = null;
let modalSearchDebounce = null;

export function initSearch() {
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounce);
      const query = searchInput.value.trim().toLowerCase();
      if (!query) {
        import('./chats.js').then(m => m.renderChannelList(m.cachedChannels));
        return;
      }
      searchDebounce = setTimeout(() => {
        performSegmentedSearch(query);
      }, 250);
    });
  }

  if (newChatSearchInput) {
    newChatSearchInput.addEventListener('input', () => {
      clearTimeout(modalSearchDebounce);
      const q = newChatSearchInput.value.trim().toLowerCase();
      if (!q) {
        if (newChatSearchResults) newChatSearchResults.innerHTML = '';
        return;
      }
      modalSearchDebounce = setTimeout(async () => {
        performModalSearch(q);
      }, 250);
    });
  }
}

export async function performSegmentedSearch(q) {
  if (!chatList) return;
  chatList.innerHTML = '';

  // 1. Мои чаты
  const myChats = cachedChannels.filter(c => c.name.toLowerCase().includes(q));
  if (myChats.length > 0) {
    const secHeader = document.createElement('div');
    secHeader.className = 'search-section-header';
    secHeader.textContent = 'Мои чаты';
    chatList.appendChild(secHeader);

    myChats.forEach(ch => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <div class="avatar">${ch.name.charAt(0).toUpperCase()}</div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(ch.name)} ${ch.is_e2ee ? '<span class="badge badge-e2ee">E2EE</span>' : ''}</div>
          <div class="search-result-sub">${escapeHtml(ch.description || 'Чат')}</div>
        </div>
      `;
      item.addEventListener('click', () => openChat(ch));
      chatList.appendChild(item);
    });
  }

  // 2. Контакты устройства
  const matchedContacts = cachedContacts.filter(c =>
    c.name.toLowerCase().includes(q) || (c.tel && c.tel.includes(q))
  );

  const secContactsHeader = document.createElement('div');
  secContactsHeader.className = 'search-section-header';
  secContactsHeader.textContent = 'Контакты устройства';
  chatList.appendChild(secContactsHeader);

  if (matchedContacts.length > 0) {
    matchedContacts.forEach(ct => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <div class="avatar" style="background:var(--grad-blue);">${ct.name.charAt(0).toUpperCase()}</div>
        <div class="search-result-info">
          <div class="search-result-name">${escapeHtml(ct.name)}</div>
          <div class="search-result-sub">${escapeHtml(ct.tel || ct.email || 'Контакт')}</div>
        </div>
      `;
      item.addEventListener('click', () => createDirectChat(ct.name, false));
      chatList.appendChild(item);
    });
  } else {
    const askItem = document.createElement('div');
    askItem.className = 'search-result-item';
    askItem.style.border = '1px dashed rgba(255, 255, 255, 0.2)';
    askItem.innerHTML = `
      <div class="avatar" style="background:#222;">+</div>
      <div class="search-result-info">
        <div class="search-result-name" style="font-size:13px; color:#ff7878;">Разрешить доступ к контактам</div>
        <div class="search-result-sub">Синхронизировать адресную книгу устройства</div>
      </div>
    `;
    askItem.addEventListener('click', async () => {
      await requestDeviceContacts();
      performSegmentedSearch(q);
    });
    chatList.appendChild(askItem);
  }

  // 3. Глобальный поиск
  try {
    const res = await authFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const globalUsers = await res.json();
      if (globalUsers && globalUsers.length > 0) {
        const secGlobalHeader = document.createElement('div');
        secGlobalHeader.className = 'search-section-header';
        secGlobalHeader.textContent = 'Глобальный поиск';
        chatList.appendChild(secGlobalHeader);

        globalUsers.forEach(u => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.innerHTML = `
            <div class="avatar" style="background:var(--grad-purple);">${u.username.charAt(0).toUpperCase()}</div>
            <div class="search-result-info">
              <div class="search-result-name">${escapeHtml(u.username)}</div>
              <div class="search-result-sub">Пользователь Sharada</div>
            </div>
          `;
          item.addEventListener('click', () => createDirectChat(u.username, false));
          chatList.appendChild(item);
        });
      }
    }
  } catch (e) {
    console.error('Global search error', e);
  }
}

export async function performModalSearch(q) {
  if (!newChatSearchResults) return;
  newChatSearchResults.innerHTML = '';

  // Контакты
  const matched = cachedContacts.filter(c => c.name.toLowerCase().includes(q));
  matched.forEach(ct => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <div class="avatar" style="background:var(--grad-blue);">${ct.name.charAt(0).toUpperCase()}</div>
      <div class="search-result-info">
        <div class="search-result-name">${escapeHtml(ct.name)}</div>
        <div class="search-result-sub">${escapeHtml(ct.tel || 'Контакт')}</div>
      </div>
    `;
    item.addEventListener('click', () => {
      const isE2EE = window.isNextChatE2EESelected || false;
      createDirectChat(ct.name, isE2EE);
    });
    newChatSearchResults.appendChild(item);
  });

  // Глобальный поиск
  try {
    const res = await authFetch(`/api/users/search?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const users = await res.json();
      users.forEach(u => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <div class="avatar" style="background:var(--grad-purple);">${u.username.charAt(0).toUpperCase()}</div>
          <div class="search-result-info">
            <div class="search-result-name">${escapeHtml(u.username)}</div>
            <div class="search-result-sub">Пользователь Sharada</div>
          </div>
        `;
        item.addEventListener('click', () => {
          const isE2EE = window.isNextChatE2EESelected || false;
          createDirectChat(u.username, isE2EE);
        });
        newChatSearchResults.appendChild(item);
      });
    }
  } catch (e) {
    console.error('Modal global search error', e);
  }
}

export async function requestDeviceContacts() {
  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const props = ['name', 'tel', 'email'];
      const contacts = await navigator.contacts.select(props, { multiple: true });
      if (contacts && contacts.length > 0) {
        cachedContacts = contacts.map(c => ({
          name: (c.name && c.name[0]) ? c.name[0] : 'Контакт',
          tel: (c.tel && c.tel[0]) ? c.tel[0] : '',
          email: (c.email && c.email[0]) ? c.email[0] : ''
        }));
        localStorage.setItem('sharada_contacts', JSON.stringify(cachedContacts));
        showAppDialog({ title: 'Контакты', message: `Успешно загружено контактов: ${cachedContacts.length}` });
      }
    } catch (e) {
      console.warn('Contacts select error', e);
    }
  } else {
    showAppDialog({
      title: 'Контакты устройства',
      message: 'Прямой доступ к телефонной книге поддерживается на мобильных устройствах Android/iOS в поддерживаемых браузерах.'
    });
  }
}
