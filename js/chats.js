/**
 * Sharada Messenger - Chats & Real-time Messaging Module
 */
import { API_BASE, WS_BASE, getAuthToken, getCurrentUser, authFetch, escapeHtml } from './api.js';
import { showAppDialog } from './modals.js';
import { setConnectionState } from './connection.js';

const chatList = document.getElementById('chatList');
const emptyChatState = document.getElementById('emptyChatState');
const activeChatWindow = document.getElementById('activeChatWindow');
const activeChatTitle = document.getElementById('activeChatTitle');
const activeChatAvatar = document.getElementById('activeChatAvatar');
const activeChatSubtitle = document.getElementById('activeChatSubtitle');
const activeChatOnlineDot = document.getElementById('activeChatOnlineDot');
const activeChatStatusText = document.getElementById('activeChatStatusText');
const activeChatE2EE = document.getElementById('activeChatE2EE');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const btnSendMessage = document.getElementById('btnSendMessage');
const chatMainContent = document.getElementById('chatMainContent');

// Typing Indicator Cloud Elements
const chatTypingIndicator = document.getElementById('chatTypingIndicator');
const typingAvatarsStack = document.getElementById('typingAvatarsStack');
const typingDots = document.getElementById('typingDots');
const typingVoiceWaves = document.getElementById('typingVoiceWaves');
const typingVideoDot = document.getElementById('typingVideoDot');
const typingFileArrows = document.getElementById('typingFileArrows');
const typingStatusText = document.getElementById('typingStatusText');

// New Group Modal
const newGroupModal = document.getElementById('newGroupModal');
const btnCloseNewGroupModal = document.getElementById('btnCloseNewGroupModal');
const newGroupNameInput = document.getElementById('newGroupNameInput');
const newGroupDescInput = document.getElementById('newGroupDescInput');
const btnCancelNewGroup = document.getElementById('btnCancelNewGroup');
const btnSubmitNewGroup = document.getElementById('btnSubmitNewGroup');

export let cachedChannels = [];
let currentChannelId = null;
let wsConn = null;
const onlineUsers = new Set();
const typingUsers = new Map(); // channelId -> Map(userId -> { username, action, timer })

let onSwitchToChatsCallback = null;

export function setSwitchToChatsCallback(fn) {
  onSwitchToChatsCallback = fn;
}

let activeContextMenu = null;

function closeChatContextMenu() {
  if (activeContextMenu) {
    activeContextMenu.remove();
    activeContextMenu = null;
  }
}

document.addEventListener('click', closeChatContextMenu);
document.addEventListener('contextmenu', (e) => {
  if (!e.target.closest('.chat-item')) {
    closeChatContextMenu();
  }
});

function getPinnedChatIds() {
  const user = getCurrentUser();
  const key = 'sharada_pinned_' + (user ? user.id : 'default');
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function setPinnedChatIds(ids) {
  const user = getCurrentUser();
  const key = 'sharada_pinned_' + (user ? user.id : 'default');
  localStorage.setItem(key, JSON.stringify(ids));
}

function togglePinChat(channelId) {
  let pinned = getPinnedChatIds();
  if (pinned.includes(channelId)) {
    pinned = pinned.filter(id => id !== channelId);
  } else {
    if (pinned.length >= 5) {
      showAppDialog({
        title: 'Закрепление чатов',
        message: 'Вы можете закрепить не более 5 чатов вверху списка.'
      });
      return;
    }
    pinned.push(channelId);
  }
  setPinnedChatIds(pinned);
  renderChannelList(cachedChannels);
}

function showChatContextMenu(x, y, channel) {
  closeChatContextMenu();
  const pinnedIds = getPinnedChatIds();
  const isPinned = pinnedIds.includes(channel.id);
  const canDelete = channel.type !== 'system' && channel.type !== 'saved';

  const menu = document.createElement('div');
  menu.className = 'custom-context-menu';
  menu.style.left = `${Math.min(x, window.innerWidth - 210)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 120)}px`;

  menu.innerHTML = `
    <div class="context-menu-item" id="ctxPinToggle">
      <svg viewBox="0 0 24 24"><path d="M19.1835 7.80516L16.2188 4.83755C14.1921 2.8089 13.1788 1.79457 12.0904 2.03468C11.0021 2.2748 10.5086 3.62155 9.5217 6.31506L8.85373 8.1381C8.59063 8.85617 8.45908 9.2152 8.22239 9.49292C8.11619 9.61754 7.99536 9.72887 7.86251 9.82451C7.56644 10.0377 7.19811 10.1392 6.46145 10.3423C4.80107 10.8 3.97088 11.0289 3.65804 11.5721C3.5228 11.8069 3.45242 12.0735 3.45413 12.3446C3.45809 12.9715 4.06698 13.581 5.28476 14.8L6.69935 16.2163L2.22345 20.6964C1.92552 20.9946 1.92552 21.4782 2.22345 21.7764C2.52138 22.0746 3.00443 22.0746 3.30236 21.7764L7.77841 17.2961L9.24441 18.7635C10.4699 19.9902 11.0827 20.6036 11.7134 20.6045C11.9792 20.6049 12.2404 20.5358 12.4713 20.4041C13.0192 20.0914 13.2493 19.2551 13.7095 17.5825C13.9119 16.8472 14.013 16.4795 14.2254 16.1835C14.3184 16.054 14.4262 15.9358 14.5468 15.8314C14.8221 15.593 15.1788 15.459 15.8922 15.191L17.7362 14.4981C20.4 13.4973 21.7319 12.9969 21.9667 11.9115C22.2014 10.826 21.1954 9.81905 19.1835 7.80516Z" fill="currentColor"/></svg>
      <span>${isPinned ? 'Открепить чат' : 'Закрепить сверху (макс. 5)'}</span>
    </div>
    ${canDelete ? `
    <div class="context-menu-item" id="ctxDeleteChannel" style="color:#ef4444;">
      <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" fill="currentColor"/></svg>
      <span>Удалить чат</span>
    </div>` : ''}
  `;

  menu.querySelector('#ctxPinToggle').addEventListener('click', (ev) => {
    ev.stopPropagation();
    closeChatContextMenu();
    togglePinChat(channel.id);
  });

  const btnDelete = menu.querySelector('#ctxDeleteChannel');
  if (btnDelete) {
    btnDelete.addEventListener('click', (ev) => {
      ev.stopPropagation();
      closeChatContextMenu();
      confirmDeleteChannel(channel);
    });
  }

  document.body.appendChild(menu);
  activeContextMenu = menu;
}

export function confirmDeleteChannel(channel) {
  showAppDialog({
    title: 'Удалить чат',
    message: `Вы уверены, что хотите удалить чат "${channel.name}"? Все сообщения диалога будут стёрты.`,
    isConfirm: true,
    confirmText: 'Удалить',
    isDanger: true,
    onConfirm: async () => {
      try {
        const res = await authFetch(`/api/channels/${channel.id}`, { method: 'DELETE' });
        if (res.ok) {
          cachedChannels = cachedChannels.filter(c => c.id !== channel.id);
          renderChannelList(cachedChannels);
          if (currentChannelId === channel.id) {
            currentChannelId = null;
            if (activeChatWindow) activeChatWindow.style.display = 'none';
            if (emptyChatState) emptyChatState.style.display = 'flex';
          }
        } else {
          const err = await res.json().catch(() => ({}));
          showAppDialog({ title: 'Ошибка', message: err.message || 'Не удалось удалить чат' });
        }
      } catch (e) {
        showAppDialog({ title: 'Ошибка сети', message: e.message });
      }
    }
  });
}

export function isUserOnline(usernameOrId) {
  return onlineUsers.has(usernameOrId);
}

export function formatChatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Вчера';
  } else if (diffDays < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

export function formatLastSeen(dateStr) {
  if (!dateStr) return 'не в сети';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMinutes = Math.floor((now - d) / 60000);

  if (diffMinutes < 1) return 'только что';
  if (diffMinutes < 60) return `${diffMinutes} мин. назад`;
  if (diffMinutes < 1440) return `сегодня в ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return `был(а) ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
}

export async function loadChannels() {
  if (!getAuthToken()) return;

  // 1. Мгновенно рендерим чаты из локального кэша
  try {
    const cached = localStorage.getItem('sharada_cached_channels');
    if (cached) {
      cachedChannels = JSON.parse(cached) || [];
      renderChannelList(cachedChannels);
    }
  } catch (e) {}

  // 2. Запрашиваем свежий список с сервера
  try {
    const res = await authFetch('/api/channels');
    if (res.ok) {
      cachedChannels = await res.json() || [];
      localStorage.setItem('sharada_cached_channels', JSON.stringify(cachedChannels));
      renderChannelList(cachedChannels);
    }
  } catch (e) {
    console.warn('Network offline or server down, using cached channels', e);
  }
}

export function renderChannelList(channels) {
  if (!chatList) return;
  chatList.innerHTML = '';
  if (!channels || channels.length === 0) {
    chatList.innerHTML = '<div style="color:var(--text-sub); text-align:center; padding:20px;">Нет каналов</div>';
    return;
  }

  const currentUser = getCurrentUser();
  const pinnedIds = getPinnedChatIds();

  // Сортировка: закрепленные чаты (до 5) строго сверху, затем остальные по свежести сообщений
  const sorted = [...channels].sort((a, b) => {
    const aPinned = pinnedIds.includes(a.id);
    const bPinned = pinnedIds.includes(b.id);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (aPinned && bPinned) {
      return pinnedIds.indexOf(a.id) - pinnedIds.indexOf(b.id);
    }
    const tA = new Date(a.last_message?.created_at || a.created_at).getTime();
    const tB = new Date(b.last_message?.created_at || b.created_at).getTime();
    return tB - tA;
  });

  sorted.forEach(ch => {
    const isPinned = pinnedIds.includes(ch.id);
    const item = document.createElement('div');
    item.className = `chat-item ${ch.id === currentChannelId ? 'active' : ''} ${isPinned ? 'pinned' : ''}`;
    item.dataset.id = ch.id;

    // Онлайн статус: ТОЛЬКО в direct (приватных) диалогах, никогда в группах, общем, Избранном и sharada
    const isDirect = ch.type === 'direct';
    const isDirectOnline = isDirect && (onlineUsers.has(ch.name) || onlineUsers.has(ch.id));

    // Аватар
    let avatarBg = (ch.is_e2ee && ch.type !== 'saved') ? 'background:linear-gradient(135deg, #10b981, #059669);' : '';
    let avatarContent = escapeHtml((ch.name || '#').charAt(0).toUpperCase());

    if (ch.type === 'saved') {
      avatarBg = 'background:var(--grad-purple); font-size:22px;';
      avatarContent = '★';
    } else if (ch.type === 'system') {
      avatarBg = 'background:var(--primary-red-accent);';
      avatarContent = `<svg viewBox="0 0 24 24" style="width:24px; height:24px; fill:currentColor;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`;
    }

    // Время и статус прочтения последнего сообщения
    const lastMsg = ch.last_message;
    const timeText = lastMsg ? formatChatTime(lastMsg.created_at) : '';
    const isMyLastMsg = lastMsg && (lastMsg.sender_id === currentUser?.id || lastMsg.sender === currentUser?.username);

    // Микротекст последнего сообщения (твоё сообщение подсвечивается акцентным цветом "Вы:")
    let lastMsgHtml = '';
    if (lastMsg) {
      if (isMyLastMsg) {
        lastMsgHtml = `<span class="chat-my-msg-tag">Вы:</span> <span class="chat-last-text">${escapeHtml(lastMsg.content)}</span>`;
      } else {
        lastMsgHtml = `<span class="chat-last-text">${escapeHtml(lastMsg.content)}</span>`;
      }
    } else {
      lastMsgHtml = `<span class="chat-last-text text-muted">${escapeHtml(ch.description || 'Нет сообщений')}</span>`;
    }

    item.innerHTML = `
      <div class="avatar" style="${avatarBg}">
        ${avatarContent}
        ${isDirect ? `<span class="avatar-online-dot ${isDirectOnline ? 'visible' : ''}"></span>` : ''}
      </div>
      <div class="chat-info">
        <div class="chat-header-row">
          <span class="chat-name">
            ${escapeHtml(ch.name)}
            ${(ch.is_e2ee && ch.type !== 'saved') ? '<span class="badge badge-e2ee">E2EE</span>' : ''}
            ${isDirect && isDirectOnline ? '<span class="chat-online-badge">В сети</span>' : ''}
          </span>
          <div class="chat-meta-right">
            ${isPinned ? `<svg class="chat-pin-icon" viewBox="0 0 24 24"><path d="M19.1835 7.80516L16.2188 4.83755C14.1921 2.8089 13.1788 1.79457 12.0904 2.03468C11.0021 2.2748 10.5086 3.62155 9.5217 6.31506L8.85373 8.1381C8.59063 8.85617 8.45908 9.2152 8.22239 9.49292C8.11619 9.61754 7.99536 9.72887 7.86251 9.82451C7.56644 10.0377 7.19811 10.1392 6.46145 10.3423C4.80107 10.8 3.97088 11.0289 3.65804 11.5721C3.5228 11.8069 3.45242 12.0735 3.45413 12.3446C3.45809 12.9715 4.06698 13.581 5.28476 14.8L6.69935 16.2163L2.22345 20.6964C1.92552 20.9946 1.92552 21.4782 2.22345 21.7764C2.52138 22.0746 3.00443 22.0746 3.30236 21.7764L7.77841 17.2961L9.24441 18.7635C10.4699 19.9902 11.0827 20.6036 11.7134 20.6045C11.9792 20.6049 12.2404 20.5358 12.4713 20.4041C13.0192 20.0914 13.2493 19.2551 13.7095 17.5825C13.9119 16.8472 14.013 16.4795 14.2254 16.1835C14.3184 16.054 14.4262 15.9358 14.5468 15.8314C14.8221 15.593 15.1788 15.459 15.8922 15.191L17.7362 14.4981C20.4 13.4973 21.7319 12.9969 21.9667 11.9115C22.2014 10.826 21.1954 9.81905 19.1835 7.80516Z" fill="currentColor"/></svg>` : ''}
            <span class="chat-time">${timeText}</span>
            ${isMyLastMsg ? `<span class="chat-read-ticks ${lastMsg?.is_read ? 'read' : 'unread'}">${lastMsg?.is_read ? STATUS_ICONS.read : STATUS_ICONS.sent}</span>` : ''}
          </div>
        </div>
        <div class="chat-last-msg-row">
          <div class="chat-preview-wrap" id="chatPreview-${ch.id}">
            ${lastMsgHtml}
          </div>
          <div class="chat-typing-anim-wrap" id="chatTypingRow-${ch.id}"></div>
        </div>
      </div>
    `;

    item.addEventListener('click', () => openChat(ch));
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showChatContextMenu(e.clientX, e.clientY, ch);
    });

    chatList.appendChild(item);
  });
}

function updateOnlineStatusUI() {
  if (currentChannelId) {
    const currentChannel = cachedChannels.find(c => c.id === currentChannelId);
    if (currentChannel) setChatHeaderData(currentChannel);
  }
  renderChannelList(cachedChannels);
}

let isOpeningChat = false;

function setChatHeaderData(channel) {
  // Гарантированно скрываем удаление и звонки для Избранного и системного чата sharada
  const btnDeleteCurrentChat = document.getElementById('btnDeleteCurrentChat');
  if (btnDeleteCurrentChat) {
    if (channel.type !== 'system' && channel.type !== 'saved') {
      btnDeleteCurrentChat.style.display = 'inline-flex';
      btnDeleteCurrentChat.onclick = () => confirmDeleteChannel(channel);
    } else {
      btnDeleteCurrentChat.style.display = 'none';
      btnDeleteCurrentChat.onclick = null;
    }
  }

  const btnStartCall = document.getElementById('btnStartCall');
  if (btnStartCall) {
    btnStartCall.style.display = (channel.type === 'direct' || channel.type === 'group') ? 'inline-flex' : 'none';
  }

  if (activeChatE2EE) {
    activeChatE2EE.style.display = (channel.is_e2ee && channel.type !== 'saved' && channel.type !== 'system') ? 'inline-flex' : 'none';
  }

  if (channel.type === 'saved') {
    if (activeChatTitle) activeChatTitle.textContent = 'Избранное';
    if (activeChatAvatar) {
      activeChatAvatar.textContent = '★';
      activeChatAvatar.style.background = 'var(--grad-purple)';
    }
    if (activeChatOnlineDot) activeChatOnlineDot.style.display = 'none';
    if (activeChatStatusText) activeChatStatusText.textContent = 'ваше личное хранилище';
    if (messageInput) {
      messageInput.placeholder = 'Написать в Избранное...';
      messageInput.disabled = false;
    }
    if (btnSendMessage) {
      btnSendMessage.disabled = false;
      btnSendMessage.style.opacity = '1';
    }
    return;
  }

  if (channel.type === 'system') {
    if (activeChatTitle) activeChatTitle.textContent = 'sharada';
    if (activeChatAvatar) {
      activeChatAvatar.innerHTML = `<svg viewBox="0 0 24 24" style="width:22px; height:22px; fill:currentColor;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`;
      activeChatAvatar.style.background = 'var(--primary-red-accent)';
    }
    if (activeChatOnlineDot) activeChatOnlineDot.style.display = 'none';
    if (activeChatStatusText) activeChatStatusText.textContent = 'официальные системные уведомления';
    if (messageInput) {
      messageInput.placeholder = 'Служебный канал только для чтения';
      messageInput.disabled = true;
    }
    if (btnSendMessage) {
      btnSendMessage.disabled = true;
      btnSendMessage.style.opacity = '0.3';
    }
    return;
  }

  if (activeChatTitle) activeChatTitle.textContent = channel.name;
  if (activeChatAvatar) {
    activeChatAvatar.textContent = channel.name.charAt(0).toUpperCase();
    activeChatAvatar.style.background = (channel.is_e2ee && channel.type !== 'saved') ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--primary-red-accent)';
  }

  if (messageInput) {
    messageInput.placeholder = 'Написать сообщение...';
    messageInput.disabled = false;
  }
  if (btnSendMessage) {
    btnSendMessage.disabled = false;
    btnSendMessage.style.opacity = '1';
  }

  const isDirect = channel.type === 'direct';
  const partnerOnline = isDirect && (onlineUsers.has(channel.name) || onlineUsers.has(channel.id));

  if (activeChatOnlineDot) {
    activeChatOnlineDot.style.display = isDirect && partnerOnline ? 'inline-block' : 'none';
  }

  if (activeChatStatusText) {
    if (isDirect) {
      activeChatStatusText.textContent = partnerOnline ? 'в сети' : 'был(а) в сети недавно';
    } else {
      activeChatStatusText.textContent = 'групповой канал';
    }
  }
}

export function openChat(channel) {
  if (!channel || isOpeningChat) return;
  const isAlreadyOpenAndActive = currentChannelId === channel.id && 
    activeChatWindow && activeChatWindow.style.display === 'flex' && 
    (!chatMainContent || chatMainContent.classList.contains('mobile-active'));
  if (isAlreadyOpenAndActive) return;

  isOpeningChat = true;
  currentChannelId = channel.id;

  if (onSwitchToChatsCallback) onSwitchToChatsCallback();

  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.querySelector(`.chat-item[data-id="${channel.id}"]`);
  if (activeItem) activeItem.classList.add('active');

  const isFirstChatOpen = emptyChatState && emptyChatState.style.display !== 'none';

  if (isFirstChatOpen) {
    // Плавный переход от пустого экрана к окну переписки
    emptyChatState.classList.add('page-fade-out');
    setTimeout(() => {
      emptyChatState.style.display = 'none';
      emptyChatState.classList.remove('page-fade-out');

      setChatHeaderData(channel);
      if (activeChatWindow) {
        activeChatWindow.style.display = 'flex';
        activeChatWindow.classList.add('page-fade-in');
      }
      if (chatMainContent) chatMainContent.classList.add('mobile-active');
      if (window.innerWidth <= 900) {
        document.body.classList.add('in-chat-mobile');
      }

      loadMessages(channel.id);
      setTimeout(() => {
        if (activeChatWindow) activeChatWindow.classList.remove('page-fade-in');
        isOpeningChat = false;
      }, 220);
    }, 150);
  } else {
    // Плавная смена между чатом A и чатом B: затухание сообщений и шапки
    const chatHeaderUser = document.querySelector('.chat-header-user');
    if (messagesContainer) messagesContainer.classList.add('chat-switching-out');
    if (chatHeaderUser) chatHeaderUser.classList.add('header-fade-out');

    if (chatMainContent) chatMainContent.classList.add('mobile-active');
    if (window.innerWidth <= 900) {
      document.body.classList.add('in-chat-mobile');
    }

    setTimeout(() => {
      setChatHeaderData(channel);
      if (chatHeaderUser) chatHeaderUser.classList.remove('header-fade-out');

      loadMessages(channel.id).then(() => {
        if (messagesContainer) {
          messagesContainer.classList.remove('chat-switching-out');
          messagesContainer.classList.add('chat-switching-in');
          setTimeout(() => {
            if (messagesContainer) messagesContainer.classList.remove('chat-switching-in');
            isOpeningChat = false;
          }, 220);
        } else {
          isOpeningChat = false;
        }
      });
    }, 150);
  }
}

export const STATUS_ICONS = {
  pending: `<span class="msg-status-icon msg-status-pending" title="В очереди отправки..."><svg viewBox="0 0 24 24" fill="none"><path d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M12 7.25C12.4142 7.25 12.75 7.58579 12.75 8V11.6893L15.0303 13.9697C15.3232 14.2626 15.3232 14.7374 15.0303 15.0303C14.7374 15.3232 14.2626 15.3232 13.9697 15.0303L11.4697 12.5303C11.329 12.3897 11.25 12.1989 11.25 12V8C11.25 7.58579 11.5858 7.25 12 7.25Z" fill="#141414"/></svg></span>`,
  sent: `<span class="msg-status-icon msg-status-sent" title="Отправлено"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12.6111L8.92308 17.5L20 6.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`,
  read: `<span class="msg-status-icon msg-status-read" title="Прочитано"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12.9L7.14286 16.5L15 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 7.5625L11.4283 16.5625L11 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>`
};

export function getMessageStatusHtml(msg) {
  if (msg.status === 'pending') return STATUS_ICONS.pending;
  if (msg.is_read || msg.status === 'read') return STATUS_ICONS.read;
  return STATUS_ICONS.sent;
}

let currentOldestMessageId = null;
let hasMoreMessages = true;
let isLoadingMore = false;

export async function loadMessages(channelId) {
  if (!messagesContainer) return;
  currentOldestMessageId = null;
  hasMoreMessages = true;
  isLoadingMore = false;

  // 1. Сначала мгновенно рендерим сохраненные сообщения из локального кэша
  let hasCache = false;
  try {
    const cached = localStorage.getItem(`sharada_cached_messages_${channelId}`);
    if (cached) {
      const msgs = JSON.parse(cached);
      if (msgs && msgs.length > 0) {
        messagesContainer.innerHTML = '';
        currentOldestMessageId = msgs[0]?.id;
        msgs.forEach((m, idx) => appendMessageToUI(m, idx));
        hasCache = true;
      }
    }
  } catch (e) {}

  if (!hasCache) {
    messagesContainer.innerHTML = '<div style="text-align:center; color:var(--text-sub); margin:auto 0;">Загрузка сообщений...</div>';
  }

  // 2. Запрашиваем актуальную историю сообщений с сервера (последние 50 сообщений)
  try {
    const res = await authFetch(`/api/channels/${channelId}/messages?limit=50`);
    if (res.ok) {
      const msgs = await res.json();
      messagesContainer.innerHTML = '';
      if (msgs && msgs.length > 0) {
        currentOldestMessageId = msgs[0]?.id;
        hasMoreMessages = msgs.length >= 50;
        localStorage.setItem(`sharada_cached_messages_${channelId}`, JSON.stringify(msgs));
        msgs.forEach((m, idx) => appendMessageToUI(m, idx));
      } else {
        hasMoreMessages = false;
        messagesContainer.innerHTML = '<div style="text-align:center; color:var(--text-sub); margin:auto 0;">История сообщений пуста. Начните диалог!</div>';
      }
      flushOutboxQueue();
    }
  } catch (e) {
    console.warn('Network offline or server down, showing cached messages', e);
  }
}

export async function loadOlderMessages(channelId) {
  if (isLoadingMore || !hasMoreMessages || !currentOldestMessageId || !messagesContainer) return;
  isLoadingMore = true;

  const prevScrollHeight = messagesContainer.scrollHeight;
  const prevScrollTop = messagesContainer.scrollTop;

  try {
    const res = await authFetch(`/api/channels/${channelId}/messages?before=${currentOldestMessageId}&limit=50`);
    if (res.ok) {
      const olderMsgs = await res.json();
      if (!olderMsgs || olderMsgs.length === 0) {
        hasMoreMessages = false;
      } else {
        currentOldestMessageId = olderMsgs[0]?.id;
        if (olderMsgs.length < 50) {
          hasMoreMessages = false;
        }

        const firstChild = messagesContainer.firstChild;
        olderMsgs.forEach((m) => {
          const el = createMessageElement(m);
          messagesContainer.insertBefore(el, firstChild);
        });

        // Сохраняем позицию скролла чтобы экран не прыгал
        messagesContainer.scrollTop = messagesContainer.scrollHeight - prevScrollHeight + prevScrollTop;
      }
    }
  } catch (e) {
    console.warn('Error loading older messages', e);
  } finally {
    isLoadingMore = false;
  }
}

export function createMessageElement(msg, index = 0) {
  const currentUser = getCurrentUser();
  const isMine = msg.sender_id === currentUser?.id;
  const bubble = document.createElement('div');
  if (msg.id) bubble.id = `msg-${msg.id}`;
  bubble.className = `message-bubble ${isMine ? 'outgoing' : 'incoming'}`;
  if (typeof index === 'number' && index > 0) {
    bubble.style.animationDelay = `${Math.min(index * 25, 300)}ms`;
  }
  const timeStr = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  bubble.innerHTML = `
    ${!isMine ? `<div class="message-author">${escapeHtml(msg.sender || msg.sender_name || 'Собеседник')}</div>` : ''}
    <div class="message-text">${escapeHtml(msg.content)}</div>
    <div class="message-meta">
      <span>${timeStr}</span>
      ${isMine ? `<span class="msg-status-wrapper" id="msg-status-${msg.id}">${getMessageStatusHtml(msg)}</span>` : ''}
    </div>
  `;
  return bubble;
}

export function appendMessageToUI(msg, index = 0) {
  if (!messagesContainer || !msg) return;
  // Дедупликация: предотвращаем удвоение
  if (msg.id && document.getElementById(`msg-${msg.id}`)) {
    return;
  }

  const bubble = createMessageElement(msg, index);
  messagesContainer.appendChild(bubble);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

export function handleTypingEvent(data) {
  const channelId = data.channel_id;
  if (!channelId) return;

  const payload = typeof data.payload === 'string' ? JSON.parse(data.payload) : (data.payload || {});
  const userId = data.sender_id || payload.user_id || 'remote_user';
  const username = data.sender_name || payload.username || 'Собеседник';
  const action = payload.action || 'text'; // 'text' | 'voice' | 'video' | 'file'

  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) return; // игнорируем свои же события

  if (!typingUsers.has(channelId)) {
    typingUsers.set(channelId, new Map());
  }

  const channelTypers = typingUsers.get(channelId);
  if (channelTypers.has(userId)) {
    clearTimeout(channelTypers.get(userId).timer);
  }

  const timer = setTimeout(() => {
    channelTypers.delete(userId);
    if (channelTypers.size === 0) {
      typingUsers.delete(channelId);
    }
    renderTypingCloud();
    updateChatListTypingIndicator(channelId);
  }, 3500);

  channelTypers.set(userId, { username, action, timer });
  renderTypingCloud();
  updateChatListTypingIndicator(channelId);
}

function updateChatListTypingIndicator(channelId) {
  const previewEl = document.getElementById(`chatPreview-${channelId}`);
  const typingEl = document.getElementById(`chatTypingRow-${channelId}`);
  if (!previewEl || !typingEl) return;

  const channelTypers = typingUsers.get(channelId);
  if (!channelTypers || channelTypers.size === 0) {
    typingEl.classList.remove('active');
    previewEl.classList.remove('hidden');
    setTimeout(() => {
      if (!typingUsers.has(channelId)) typingEl.innerHTML = '';
    }, 350);
    return;
  }

  const typersList = Array.from(channelTypers.values());
  const first = typersList[0];
  let text = 'печатает...';
  if (first.action === 'voice') text = 'записывает голос...';
  else if (first.action === 'video') text = 'записывает видео...';
  else if (first.action === 'file') text = 'отправляет файл...';

  const ch = cachedChannels.find(c => c.id === channelId);
  const isGroup = ch?.type === 'group';
  if (isGroup) {
    if (typersList.length > 1) {
      text = `${typersList.length} чел. печатают...`;
    } else {
      text = `${first.username}: ${text}`;
    }
  }

  typingEl.innerHTML = `<span class="chat-typing-red-text">${escapeHtml(text)}</span>`;
  previewEl.classList.add('hidden');
  typingEl.classList.add('active');
}

function renderTypingCloud() {
  const container = document.getElementById('chatTypingContainer');
  if (!container) return;

  if (!currentChannelId || !typingUsers.has(currentChannelId)) {
    container.innerHTML = '';
    return;
  }

  const channelTypers = typingUsers.get(currentChannelId);
  const typersList = Array.from(channelTypers.values());
  if (typersList.length === 0) {
    container.innerHTML = '';
    return;
  }

  const currentChannel = cachedChannels.find(c => c.id === currentChannelId);
  const isGroup = currentChannel?.type === 'group';

  // Группируем участников по типу действия (text, voice, video, file)
  const groupsByAction = {
    text: [],
    voice: [],
    video: [],
    file: []
  };

  typersList.forEach(u => {
    const act = u.action || 'text';
    if (!groupsByAction[act]) groupsByAction[act] = [];
    groupsByAction[act].push(u);
  });

  container.innerHTML = '';

  // Для каждого действия участников показываем ОТДЕЛЬНОЕ облако!
  Object.keys(groupsByAction).forEach(actionKey => {
    const users = groupsByAction[actionKey];
    if (!users || users.length === 0) return;

    const cloud = document.createElement('div');
    cloud.className = 'chat-typing-cloud';

    // 1. Аватарки участников для групп
    let avatarsHtml = '';
    if (isGroup) {
      const visibleUsers = users.slice(0, 3);
      const avatarsNodes = visibleUsers.map(u =>
        `<div class="typing-avatar-mini">${escapeHtml((u.username || 'U').charAt(0).toUpperCase())}</div>`
      ).join('');
      const moreCount = users.length > 3 ? `<div class="typing-avatar-mini more-count">+${users.length - 3}</div>` : '';
      avatarsHtml = `<div class="typing-avatars-stack">${avatarsNodes}${moreCount}</div>`;
    }

    // 2. Анимация в зависимости от действия:
    // - text: три переливающиеся точки
    // - voice: волны плавно появляющиеся и исчезающие переливающиеся как в NFC
    // - video: точка переливающаяся
    // - file: угловые скобки ">" плавно появляющиеся и исчезающие переливающиеся как в NFC
    let animHtml = '';
    if (actionKey === 'text') {
      animHtml = `
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      `;
    } else if (actionKey === 'voice') {
      animHtml = `
        <div class="typing-voice-waves">
          <span></span><span></span><span></span><span></span>
        </div>
      `;
    } else if (actionKey === 'video') {
      animHtml = `<div class="typing-video-dot"></div>`;
    } else if (actionKey === 'file') {
      animHtml = `
        <div class="typing-file-chevrons">
          <span>&gt;</span><span>&gt;</span><span>&gt;</span>
        </div>
      `;
    }

    // 3. Текст описания действия
    let statusText = '';
    if (actionKey === 'text') {
      statusText = users.length > 1 ? 'печатают...' : 'печатает...';
    } else if (actionKey === 'voice') {
      statusText = users.length > 1 ? 'записывают голосовое...' : 'записывает голосовое...';
    } else if (actionKey === 'video') {
      statusText = users.length > 1 ? 'записывают видеосообщение...' : 'записывает видеосообщение...';
    } else if (actionKey === 'file') {
      statusText = users.length > 1 ? 'отправляют файл...' : 'отправляет файл...';
    }

    if (isGroup) {
      if (users.length === 1) {
        statusText = `${escapeHtml(users[0].username)} ${statusText}`;
      } else if (users.length === 2) {
        statusText = `${escapeHtml(users[0].username)} и ${escapeHtml(users[1].username)} ${statusText}`;
      } else {
        statusText = `${users.length} человек ${statusText}`;
      }
    }

    cloud.innerHTML = `
      ${avatarsHtml}
      <div class="typing-animation-box">${animHtml}</div>
      <span class="typing-status-text">${statusText}</span>
    `;

    container.appendChild(cloud);
  });
}

let outboxQueue = [];
try {
  outboxQueue = JSON.parse(localStorage.getItem('sharada_outbox') || '[]');
} catch (e) {
  outboxQueue = [];
}

function saveOutbox() {
  localStorage.setItem('sharada_outbox', JSON.stringify(outboxQueue));
}

let isFlushingOutbox = false;

export async function flushOutboxQueue() {
  if (isFlushingOutbox || outboxQueue.length === 0) return;
  isFlushingOutbox = true;

  try {
    while (outboxQueue.length > 0) {
      const item = outboxQueue[0];
      try {
        const res = await authFetch(`/api/channels/${item.channel_id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: item.content, is_e2ee: !!item.is_e2ee })
        });

        if (res.ok) {
          const serverMsg = await res.json();
          outboxQueue.shift();
          saveOutbox();

          // Обновляем статус сообщения в DOM
          const statusWrap = document.getElementById(`msg-status-${item.temp_id}`);
          if (statusWrap) {
            statusWrap.innerHTML = STATUS_ICONS.sent;
            statusWrap.id = `msg-status-${serverMsg.id}`;
          }
          const tempBubble = document.getElementById(`msg-${item.temp_id}`);
          if (tempBubble) {
            tempBubble.id = `msg-${serverMsg.id}`;
          }

          // Обновляем в локальном кэше
          try {
            const cacheKey = `sharada_cached_messages_${item.channel_id}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            const idx = cached.findIndex(m => m.id === item.temp_id);
            if (idx !== -1) {
              cached[idx] = serverMsg;
            } else {
              cached.push(serverMsg);
            }
            localStorage.setItem(cacheKey, JSON.stringify(cached));
          } catch (e) {}
        } else {
          break;
        }
      } catch (err) {
        console.warn('[Outbox] Network error sending queued message, waiting for network', err);
        setConnectionState('reconnecting');
        break;
      }
    }
  } finally {
    isFlushingOutbox = false;
  }
}

export async function sendMessage() {
  if (!messageInput) return;
  const text = messageInput.value.trim();
  if (!text || !currentChannelId) return;

  // Очищаем поле ввода моментально, позволяя сразу писать следующее
  messageInput.value = '';

  const currentUser = getCurrentUser();
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  const optimisticMsg = {
    id: tempId,
    channel_id: currentChannelId,
    sender_id: currentUser?.id || 'me',
    sender_name: currentUser?.username || 'Я',
    content: text,
    created_at: new Date().toISOString(),
    is_read: false,
    status: 'pending'
  };

  // Мгновенное появление сообщения у себя в чате со значком часов
  appendMessageToUI(optimisticMsg);

  // Сохраняем в кэш
  try {
    const cacheKey = `sharada_cached_messages_${currentChannelId}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
    cached.push(optimisticMsg);
    localStorage.setItem(cacheKey, JSON.stringify(cached));
  } catch (e) {}

  // Добавляем в очередь отправки
  outboxQueue.push({
    temp_id: tempId,
    channel_id: currentChannelId,
    content: text,
    is_e2ee: false
  });
  saveOutbox();

  // Запускаем отправку
  flushOutboxQueue();
}

export async function createDirectChat(targetUsername, isE2EE = false) {
  if (!targetUsername) return;
  try {
    const res = await authFetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: targetUsername,
        target_username: targetUsername,
        description: isE2EE ? 'Защищенный E2EE чат' : 'Приватный диалог',
        type: 'direct',
        is_e2ee: isE2EE
      })
    });

    if (res.ok) {
      const newChan = await res.json();
      await loadChannels();
      const targetChan = cachedChannels.find(c => c.id === newChan.id) || newChan;
      openChat(targetChan);
      closeNewChatModals();
      return;
    }

    // Fallback: попытка через NFC exchange
    const res2 = await authFetch('/api/nfc/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_username: targetUsername })
    });

    if (res2.ok) {
      const data = await res2.json();
      await loadChannels();
      const existing = cachedChannels.find(c => c.id === data.channel_id) || {
        id: data.channel_id,
        name: targetUsername,
        type: 'direct',
        is_e2ee: isE2EE
      };
      openChat(existing);
      closeNewChatModals();
    } else {
      const err = await res2.json().catch(() => ({}));
      showAppDialog({ title: 'Ошибка', message: err.message || 'Пользователь не найден или недоступен.' });
    }
  } catch (e) {
    console.error('Create direct chat error', e);
    showAppDialog({ title: 'Ошибка', message: 'Ошибка сети при создании диалога' });
  }
}

function closeNewChatModals() {
  const newChatModal = document.getElementById('newChatModal');
  const nfcFullscreenScreen = document.getElementById('nfcFullscreenScreen');
  const searchInput = document.getElementById('searchInput');

  if (newChatModal) newChatModal.classList.remove('active');
  if (newGroupModal) newGroupModal.classList.remove('active');
  if (nfcFullscreenScreen) nfcFullscreenScreen.classList.remove('active');
  if (searchInput) searchInput.value = '';
}

let wsReconnectTimer = null;
let wsHeartbeatTimer = null;

export function initWebSocket() {
  const token = getAuthToken();
  if (!token) return;

  if (wsConn && (wsConn.readyState === WebSocket.OPEN || wsConn.readyState === WebSocket.CONNECTING)) {
    return;
  }

  if (wsConn) {
    try {
      wsConn.onclose = null;
      wsConn.close();
    } catch (e) {}
  }

  clearTimeout(wsReconnectTimer);

  const wsUrl = `${WS_BASE}/ws?token=${token}`;

  setConnectionState('connecting');
  wsConn = new WebSocket(wsUrl);

  wsConn.onopen = () => {
    setConnectionState('connected');
    flushOutboxQueue();
    loadChannels();
  };

  wsConn.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'message') {
        const messageData = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        if (msg.channel_id === currentChannelId) {
          appendMessageToUI(messageData);
          if (document.hasFocus()) {
            authFetch(`/api/channels/${currentChannelId}/read`, { method: 'POST' }).catch(() => {});
          }
          if (typingUsers.has(currentChannelId)) {
            typingUsers.get(currentChannelId).delete(messageData.sender_id);
            renderTypingCloud();
          }
        }
        loadChannels();
      } else if (msg.type === 'channel_created') {
        loadChannels();
      } else if (msg.type === 'channel_deleted') {
        if (msg.channel_id === currentChannelId) {
          currentChannelId = null;
          if (activeChatWindow) activeChatWindow.style.display = 'none';
          if (emptyChatState) emptyChatState.style.display = 'flex';
        }
        loadChannels();
      } else if (msg.type === 'message_read') {
        if (msg.channel_id === currentChannelId) {
          document.querySelectorAll('.message-bubble.outgoing .msg-status-wrapper').forEach(tick => {
            tick.innerHTML = STATUS_ICONS.read;
          });
        }
        loadChannels();
      } else if (msg.type === 'session_revoked') {
        console.warn('[WS] Session revoked from another device');
        setAuthToken(null);
        showAppDialog({
          title: 'Сессия завершена',
          message: 'Ваша сессия была завершена на другом устройстве. Пожалуйста, выполните вход заново.'
        });
        if (typeof window.onSharadaSessionRevoked === 'function') {
          window.onSharadaSessionRevoked();
        }
      } else if (msg.type === 'typing') {
        handleTypingEvent(msg);
      } else if (msg.type === 'user_online') {
        if (msg.sender_id) onlineUsers.add(msg.sender_id);
        if (msg.sender_name) onlineUsers.add(msg.sender_name);
        updateOnlineStatusUI();
      } else if (msg.type === 'user_offline') {
        if (msg.sender_id) onlineUsers.delete(msg.sender_id);
        if (msg.sender_name) onlineUsers.delete(msg.sender_name);
        updateOnlineStatusUI();
      }
    } catch (e) {
      console.warn('WS message parse error', e);
    }
  };

  wsConn.onclose = () => {
    setConnectionState('reconnecting');
    wsReconnectTimer = setTimeout(initWebSocket, 2500);
  };

  wsConn.onerror = () => {
    setConnectionState('reconnecting');
  };

  // Heartbeat пинг каждые 12 секунд для своевременного обнаружения обрыва сети
  clearInterval(wsHeartbeatTimer);
  wsHeartbeatTimer = setInterval(() => {
    if (wsConn && wsConn.readyState === WebSocket.OPEN) {
      try {
        wsConn.send(JSON.stringify({ type: 'ping' }));
      } catch (e) {}
    } else if (!wsConn || wsConn.readyState === WebSocket.CLOSED) {
      setConnectionState('reconnecting');
      initWebSocket();
    }
  }, 12000);
}

window.triggerSharadaReconnect = function() {
  initWebSocket();
  flushOutboxQueue();
};

let lastTypingTime = 0;

export function initChatEvents() {
  if (btnSendMessage) btnSendMessage.addEventListener('click', sendMessage);
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendMessage();
      }
    });

    // Отправка события печатания
    messageInput.addEventListener('input', () => {
      const now = Date.now();
      if (now - lastTypingTime > 1800 && currentChannelId && wsConn && wsConn.readyState === WebSocket.OPEN) {
        lastTypingTime = now;
        const curUser = getCurrentUser();
        try {
          wsConn.send(JSON.stringify({
            type: 'typing',
            channel_id: currentChannelId,
            sender_id: curUser?.id,
            sender_name: curUser?.username,
            payload: { action: 'text', username: curUser?.username, user_id: curUser?.id }
          }));
        } catch (e) {}
      }
    });
  }

  // Создание группы
  if (btnCloseNewGroupModal) {
    btnCloseNewGroupModal.addEventListener('click', () => newGroupModal.classList.remove('active'));
  }
  if (btnCancelNewGroup) {
    btnCancelNewGroup.addEventListener('click', () => newGroupModal.classList.remove('active'));
  }
  if (btnSubmitNewGroup) {
    btnSubmitNewGroup.addEventListener('click', async () => {
      const gName = newGroupNameInput.value.trim();
      const gDesc = newGroupDescInput.value.trim();
      if (!gName) {
        showAppDialog({ title: 'Ошибка', message: 'Введите название новой группы' });
        return;
      }
      try {
        const res = await authFetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: gName,
            description: gDesc || 'Приватный групповой чат',
            type: 'group',
            is_e2ee: false,
            member_ids: []
          })
        });
        if (res.ok) {
          const ch = await res.json();
          newGroupModal.classList.remove('active');
          await loadChannels();
          openChat(ch);
        } else {
          showAppDialog({ title: 'Ошибка', message: 'Не удалось создать группу' });
        }
      } catch (e) {
        showAppDialog({ title: 'Ошибка сети', message: 'Ошибка при создании группы' });
      }
    });
  }

  // Пагинация сообщений: при скролле к самому верху подгружаем старые сообщения
  if (messagesContainer) {
    messagesContainer.addEventListener('scroll', () => {
      if (messagesContainer.scrollTop < 60 && hasMoreMessages && !isLoadingMore && currentChannelId && currentOldestMessageId) {
        loadOlderMessages(currentChannelId);
      }
    });
  }

  // Кнопка аудиозвонка в шапке чата
  const btnStartCall = document.getElementById('btnStartCall');
  if (btnStartCall) {
    btnStartCall.addEventListener('click', () => {
      showAppDialog({
        title: 'Защищенные звонки',
        message: 'Голосовые P2P-звонки со сквозным шифрованием (E2EE WebRTC) находятся в финальной стадии интеграции и будут активированы в следующем релизе.',
        confirmText: 'Понятно'
      });
    });
  }

  // Кнопка прикрепления файлов
  const btnAttachFile = document.getElementById('btnAttachFile');
  if (btnAttachFile) {
    btnAttachFile.addEventListener('click', () => {
      showAppDialog({
        title: 'Отправка вложений',
        message: 'Защищенная отправка файлов и изображений подготовлена и войдет в следующее обновление.',
        confirmText: 'Понятно'
      });
    });
  }
}

// Тестовая утилита в глобальной области видимости для проверки облачка
window.testTypingCloud = function(action = 'text', count = 1) {
  if (!currentChannelId) return;
  const names = ['Алексей', 'Мария', 'Дмитрий', 'Елена', 'Иван'];
  for (let i = 0; i < count; i++) {
    handleTypingEvent({
      channel_id: currentChannelId,
      sender_id: `test_user_${i}`,
      sender_name: names[i] || `User_${i}`,
      payload: { action, username: names[i] || `User_${i}` }
    });
  }
};
