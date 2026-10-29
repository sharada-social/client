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
const btnAttachFile = document.getElementById('btnAttachFile');
const chatMainContent = document.getElementById('chatMainContent');

export function resetInputHeight() {
  if (!messageInput) return;
  messageInput.style.height = '36px';
  messageInput.classList.remove('scrollable');
}

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

export function isLastSeenAllowedForPartner(partnerId) {
  try {
    const raw = localStorage.getItem('sharada_privacy_last_seen');
    if (!raw) return true; // по умолчанию: все видят
    const conf = JSON.parse(raw);
    const inExceptions = (conf.exceptions || []).includes(String(partnerId));
    if (conf.mode === 'nobody') {
      return inExceptions; // если 'nobody', видят только исключения
    }
    // mode === 'all'
    return !inExceptions; // если 'all', видят все, кроме исключений
  } catch (e) {
    return true;
  }
}

export function formatExactLastSeen(dateStr) {
  if (!dateStr) return 'был(а) недавно';
  const d = new Date(dateStr);
  const now = new Date();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) {
    return `был(а) сегодня в ${timeStr}`;
  }
  if (isYesterday) {
    return `был(а) вчера в ${timeStr}`;
  }
  return `был(а) ${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} в ${timeStr}`;
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

export async function syncOnlineUsers() {
  if (!getAuthToken()) return;
  try {
    const res = await authFetch('/api/users/online');
    if (res.ok) {
      const data = await res.json();
      onlineUsers.clear();
      (data.online_user_ids || []).forEach(id => onlineUsers.add(id));
      (data.online_usernames || []).forEach(name => onlineUsers.add(name));
      updateOnlineStatusUI();
    }
  } catch (e) {
    console.warn('Failed to sync online users', e);
  }
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
      syncOnlineUsers();
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
    const displayName = ch.display_name || ch.name;
    let avatarBg = (ch.is_e2ee && ch.type !== 'saved') ? 'background:linear-gradient(135deg, #10b981, #059669);' : '';
    let avatarContent = escapeHtml((displayName || '#').charAt(0).toUpperCase());

    if (ch.type === 'saved') {
      avatarBg = 'background:var(--grad-purple); font-size:22px;';
      avatarContent = '★';
    } else if (ch.type === 'system') {
      avatarBg = 'background:var(--primary-red-accent); display:flex; align-items:center; justify-content:center;';
      avatarContent = `<img src="assets/icons/app-icon.png" style="width:62%; height:62%; object-fit:contain;" alt="sharada">`;
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
            ${escapeHtml(displayName)}
            ${(ch.is_e2ee && ch.type !== 'saved') ? '<span class="badge badge-e2ee">E2EE</span>' : ''}
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
  // Плавная анимация скрытия/отображения удаления и звонков (класс hidden)
  const btnDeleteCurrentChat = document.getElementById('btnDeleteCurrentChat');
  if (btnDeleteCurrentChat) {
    if (channel.type !== 'system' && channel.type !== 'saved') {
      btnDeleteCurrentChat.classList.remove('hidden');
      btnDeleteCurrentChat.onclick = () => confirmDeleteChannel(channel);
    } else {
      btnDeleteCurrentChat.classList.add('hidden');
      btnDeleteCurrentChat.onclick = null;
    }
  }

  const btnStartCall = document.getElementById('btnStartCall');
  if (btnStartCall) {
    if (channel.type === 'direct' || channel.type === 'group') {
      btnStartCall.classList.remove('hidden');
    } else {
      btnStartCall.classList.add('hidden');
    }
  }

  if (activeChatE2EE) {
    activeChatE2EE.style.display = (channel.is_e2ee && channel.type !== 'saved' && channel.type !== 'system') ? 'inline-flex' : 'none';
  }

  const inputCapsule = messageInput?.closest('.input-capsule');

  if (channel.type === 'saved') {
    if (activeChatTitle) activeChatTitle.textContent = 'Избранное';
    if (activeChatAvatar) {
      activeChatAvatar.textContent = '★';
      activeChatAvatar.style.background = 'var(--grad-purple)';
    }
    if (activeChatOnlineDot) activeChatOnlineDot.style.display = 'none';
    if (activeChatStatusText) activeChatStatusText.textContent = 'ваше личное хранилище';
    if (btnAttachFile) btnAttachFile.style.display = 'inline-flex';
    if (btnSendMessage) {
      btnSendMessage.style.display = 'flex';
      btnSendMessage.disabled = false;
      btnSendMessage.style.opacity = '1';
    }
    if (inputCapsule) inputCapsule.classList.remove('system-mode');
    if (messageInput) {
      messageInput.placeholder = 'Написать в Избранное...';
      messageInput.disabled = false;
      resetInputHeight();
    }
    return;
  }

  if (channel.type === 'system') {
    if (activeChatTitle) activeChatTitle.textContent = 'sharada';
    if (activeChatAvatar) {
      activeChatAvatar.style.background = 'var(--primary-red-accent)';
      activeChatAvatar.style.display = 'flex';
      activeChatAvatar.style.alignItems = 'center';
      activeChatAvatar.style.justifyContent = 'center';
      activeChatAvatar.innerHTML = `<img src="assets/icons/app-icon.png" style="width:62%; height:62%; object-fit:contain;" alt="sharada">`;
    }
    if (activeChatOnlineDot) activeChatOnlineDot.style.display = 'none';
    if (activeChatStatusText) activeChatStatusText.textContent = 'официальные системные уведомления';
    
    // В системном чате полностью скрываем кнопки прикрепления и отправки
    if (btnAttachFile) btnAttachFile.style.display = 'none';
    if (btnSendMessage) btnSendMessage.style.display = 'none';
    if (inputCapsule) inputCapsule.classList.add('system-mode');
    if (messageInput) {
      messageInput.value = '';
      messageInput.placeholder = 'Служебный канал только для чтения';
      messageInput.disabled = true;
      messageInput.style.height = '24px';
    }
    return;
  }

  const titleName = channel.display_name || channel.name;
  if (activeChatTitle) activeChatTitle.textContent = titleName;
  if (activeChatAvatar) {
    activeChatAvatar.textContent = titleName.charAt(0).toUpperCase();
    activeChatAvatar.style.background = (channel.is_e2ee && channel.type !== 'saved') ? 'linear-gradient(135deg, #10b981, #059669)' : 'var(--primary-red-accent)';
  }

  if (btnAttachFile) btnAttachFile.style.display = 'inline-flex';
  if (btnSendMessage) {
    btnSendMessage.style.display = 'flex';
    btnSendMessage.disabled = false;
    btnSendMessage.style.opacity = '1';
  }
  if (inputCapsule) inputCapsule.classList.remove('system-mode');
  if (messageInput) {
    messageInput.placeholder = 'Написать сообщение...';
    messageInput.disabled = false;
    resetInputHeight();
  }

  const isDirect = channel.type === 'direct';
  const partnerOnline = isDirect && (onlineUsers.has(channel.name) || onlineUsers.has(channel.id));

  if (activeChatOnlineDot) {
    activeChatOnlineDot.style.display = isDirect && partnerOnline ? 'inline-block' : 'none';
  }

  if (activeChatStatusText) {
    if (isDirect) {
      if (partnerOnline) {
        activeChatStatusText.textContent = 'в сети';
      } else {
        const canSee = isLastSeenAllowedForPartner(channel.id) && isLastSeenAllowedForPartner(channel.name);
        if (canSee && (channel.last_seen_at || channel.last_message?.created_at)) {
          activeChatStatusText.textContent = formatExactLastSeen(channel.last_seen_at || channel.last_message.created_at);
        } else {
          activeChatStatusText.textContent = 'был(а) недавно';
        }
      }
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

      cancelReply();
      loadMessages(channel.id);
      setTimeout(() => {
        if (activeChatWindow) activeChatWindow.classList.remove('page-fade-in');
        scrollChatToBottom();
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

      cancelReply();
      loadMessages(channel.id).then(() => {
        if (messagesContainer) {
          messagesContainer.classList.remove('chat-switching-out');
          messagesContainer.classList.add('chat-switching-in');
          setTimeout(() => {
            if (messagesContainer) messagesContainer.classList.remove('chat-switching-in');
            scrollChatToBottom();
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
  if (!isLastSeenAllowedForPartner(currentChannelId)) {
    return STATUS_ICONS.sent; // Реципрокная конфиденциальность
  }
  if (msg.is_read || msg.status === 'read') return STATUS_ICONS.read;
  return STATUS_ICONS.sent;
}

export function scrollChatToBottom(smooth = false) {
  if (!messagesContainer) return;
  const exec = () => {
    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  };
  exec();
  requestAnimationFrame(() => {
    exec();
    setTimeout(exec, 40);
    setTimeout(exec, 120);
    setTimeout(exec, 260);
  });
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
      let msgs = JSON.parse(cached);
      if (msgs && msgs.length > 0) {
        const seenIds = new Set();
        msgs = msgs.filter(m => {
          if (!m || !m.id) return false;
          if (seenIds.has(m.id)) return false;
          seenIds.add(m.id);
          return true;
        });
        messagesContainer.innerHTML = '';
        currentOldestMessageId = msgs[0]?.id;
        msgs.forEach((m, idx) => appendMessageToUI(m, idx));
        scrollChatToBottom();
        hasCache = true;
      }
    }
  } catch (e) {}

  const spinnerWrap = document.getElementById('chatLoadingSpinnerMD3');
  let spinnerTimer = null;
  if (!hasCache) {
    messagesContainer.innerHTML = '<div style="text-align:center; color:var(--text-sub); margin:auto 0;">Загрузка сообщений...</div>';
    spinnerTimer = setTimeout(() => {
      if (spinnerWrap) spinnerWrap.classList.add('visible');
    }, 5000);
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
        scrollChatToBottom();
      } else {
        hasMoreMessages = false;
        messagesContainer.innerHTML = '<div style="text-align:center; color:var(--text-sub); margin:auto 0;">История сообщений пуста. Начните диалог!</div>';
      }
      flushOutboxQueue();
    }
  } catch (e) {
    console.warn('Network offline or server down, showing cached messages', e);
  } finally {
    if (spinnerTimer) clearTimeout(spinnerTimer);
    if (spinnerWrap) spinnerWrap.classList.remove('visible');
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

let currentReplyingMessage = null;
let activeActionMessage = null;

export function setReplyingTo(msg) {
  if (!msg) return;
  currentReplyingMessage = msg;
  const replyBar = document.getElementById('replyPreviewBar');
  const replySender = document.getElementById('replyBarSender');
  const replyText = document.getElementById('replyBarText');
  const msgInput = document.getElementById('messageInput');

  if (replyBar && replySender && replyText) {
    replySender.textContent = msg.sender || msg.sender_name || 'Собеседник';
    replyText.textContent = msg.content || '';
    replyBar.style.display = 'flex';
  }

  if (msgInput) {
    msgInput.focus();
  }
}

export function cancelReply() {
  currentReplyingMessage = null;
  const replyBar = document.getElementById('replyPreviewBar');
  if (replyBar) {
    replyBar.style.display = 'none';
  }
}

export function getMsgDomId(id) {
  if (!id) return '';
  const str = String(id);
  if (str.startsWith('temp_')) return `msg-${str}`;
  const clean = str.replace(/^(msg-)+/, '');
  return `msg-${clean}`;
}

export function scrollToOriginalMessage(msgId) {
  if (!msgId) return;
  const domId = getMsgDomId(msgId);
  const target = document.getElementById(domId);
  const container = document.getElementById('messagesContainer');
  if (target && container) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const relativeTop = (targetRect.top - containerRect.top) + container.scrollTop;
    const targetScrollTop = relativeTop - (container.clientHeight / 2) + (target.clientHeight / 2);

    container.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });

    target.style.animation = 'none';
    target.classList.remove('highlight-quote');
    void target.offsetWidth;
    target.classList.add('highlight-quote');
    setTimeout(() => {
      target.classList.remove('highlight-quote');
      target.style.animation = 'none';
    }, 1200);
  }
}

export function openMessageActionMenu(msg, bubbleElement) {
  const backdrop = document.getElementById('messageActionBackdrop');
  const menu = document.getElementById('messageActionMenu');
  if (!backdrop || !menu || !bubbleElement) return;

  activeActionMessage = msg;
  backdrop.classList.add('active');

  const rect = bubbleElement.getBoundingClientRect();
  const menuWidth = 260;
  const menuHeight = 110;

  let left = rect.left + rect.width / 2 - menuWidth / 2;
  left = Math.max(16, Math.min(window.innerWidth - menuWidth - 16, left));

  let top = rect.top - menuHeight - 12;
  if (top < 60) {
    top = rect.bottom + 12;
  }
  top = Math.max(16, Math.min(window.innerHeight - menuHeight - 16, top));

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

export function closeMessageActionMenu() {
  const backdrop = document.getElementById('messageActionBackdrop');
  if (backdrop) backdrop.classList.remove('active');
  activeActionMessage = null;
}

export function toggleReaction(msg, emoji) {
  if (!msg || !msg.id) return;
  if (!msg.reactions) msg.reactions = {};

  const currentCount = msg.reactions[emoji] || 0;
  if (currentCount > 0) {
    msg.reactions[emoji] = currentCount - 1;
    if (msg.reactions[emoji] <= 0) delete msg.reactions[emoji];
  } else {
    msg.reactions[emoji] = 1;
  }

  if (currentChannelId) {
    try {
      const cacheKey = `sharada_cached_messages_${currentChannelId}`;
      const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
      const target = cached.find(m => String(m.id) === String(msg.id));
      if (target) {
        target.reactions = msg.reactions;
        localStorage.setItem(cacheKey, JSON.stringify(cached));
      }
    } catch (e) {}
  }

  const domId = getMsgDomId(msg.id);
  const bubble = document.getElementById(domId);
  if (bubble) {
    let reactionsRow = bubble.querySelector('.message-reactions-row');
    const chips = Object.entries(msg.reactions).map(([em, cnt]) => {
      if (!cnt || cnt <= 0) return '';
      return `<button type="button" class="message-reaction-chip active" data-emoji="${escapeHtml(em)}">${escapeHtml(em)} <span>${cnt}</span></button>`;
    }).filter(Boolean).join('');

    if (chips) {
      if (!reactionsRow) {
        reactionsRow = document.createElement('div');
        reactionsRow.className = 'message-reactions-row';
        const meta = bubble.querySelector('.message-meta');
        bubble.insertBefore(reactionsRow, meta);
      }
      reactionsRow.innerHTML = chips;
      reactionsRow.querySelectorAll('.message-reaction-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleReaction(msg, chip.dataset.emoji);
        });
      });
    } else if (reactionsRow) {
      reactionsRow.remove();
    }
  }
}

function setupSwipeToReply(bubble, msg) {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let isSwiping = false;

  bubble.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
    isSwiping = false;
  }, { passive: true });

  bubble.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - touchStartX;
    const diffY = currentY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY) && diffX < -15) {
      isSwiping = true;
      const pull = Math.max(diffX, -65);
      bubble.style.transform = `translateX(${pull}px)`;
      bubble.style.transition = 'none';
    }
  }, { passive: true });

  bubble.addEventListener('touchend', (e) => {
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;
    const duration = Date.now() - touchStartTime;

    bubble.style.transition = 'transform 0.22s ease-out';
    bubble.style.transform = '';

    if (diffX < -45 && Math.abs(diffX) > Math.abs(diffY)) {
      if (navigator.vibrate) navigator.vibrate(20);
      setReplyingTo(msg);
    } else if (!isSwiping && Math.abs(diffX) < 10 && Math.abs(diffY) < 10 && duration < 350) {
      openMessageActionMenu(msg, bubble);
    }
  });
}

export function createMessageElement(msg, index = 0) {
  const currentUser = getCurrentUser();
  const isMine = (currentUser && String(msg.sender_id) === String(currentUser.id)) || msg.sender_id === 'me' || msg.status === 'pending';
  const bubble = document.createElement('div');
  const domId = getMsgDomId(msg.id);
  if (domId) bubble.id = domId;
  bubble.className = `message-bubble ${isMine ? 'outgoing' : 'incoming'}`;
  if (typeof index === 'number' && index > 0) {
    bubble.style.animationDelay = `${Math.min(index * 25, 300)}ms`;
  }
  const timeStr = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const cleanId = String(msg.id || '').replace(/^(msg-)+/, '');

  // 1. Quoted message block (if this message is a reply)
  let quoteHtml = '';
  if (msg.reply_to) {
    const q = typeof msg.reply_to === 'string' ? JSON.parse(msg.reply_to) : msg.reply_to;
    if (q && q.content) {
      quoteHtml = `
        <div class="message-quote-box" data-quote-id="${escapeHtml(String(q.id || ''))}">
          <div class="quote-content">
            <div class="quote-author">${escapeHtml(q.sender_display_name || q.sender_name || 'Собеседник')}</div>
            <div class="quote-text">${escapeHtml(q.content)}</div>
          </div>
        </div>
      `;
    }
  }

  // 2. Reactions row
  let reactionsHtml = '';
  if (msg.reactions && Object.keys(msg.reactions).length > 0) {
    const chips = Object.entries(msg.reactions).map(([emoji, count]) => {
      if (!count || count <= 0) return '';
      return `<button type="button" class="message-reaction-chip active" data-emoji="${escapeHtml(emoji)}">${escapeHtml(emoji)} <span>${count}</span></button>`;
    }).filter(Boolean).join('');
    if (chips) {
      reactionsHtml = `<div class="message-reactions-row">${chips}</div>`;
    }
  }

  const currentChan = cachedChannels.find(c => c.id === (msg.channel_id || currentChannelId));
  const isGroup = currentChan?.type === 'group';
  const showAuthor = !isMine && isGroup;
  const senderName = msg.sender_display_name || msg.sender_name || msg.sender || 'Собеседник';
  bubble.innerHTML = `
    ${showAuthor ? `<div class="message-author">${escapeHtml(senderName)}</div>` : ''}
    ${quoteHtml}
    <div class="message-text">${escapeHtml(msg.content)}</div>
    ${reactionsHtml}
    <div class="message-meta">
      <span>${timeStr}</span>
      ${isMine ? `<span class="msg-status-wrapper" id="msg-status-${cleanId}">${getMessageStatusHtml(msg)}</span>` : ''}
    </div>
  `;

  // Предотвращение повторной анимации появления после снятия подсветки цитаты
  bubble.addEventListener('animationend', (e) => {
    if (e.animationName === 'messageSlideIn' || e.animationName === 'incomingSlideIn') {
      bubble.style.animation = 'none';
    }
  });

  // Quote click -> scroll to original message
  const quoteEl = bubble.querySelector('.message-quote-box');
  if (quoteEl) {
    quoteEl.addEventListener('click', (e) => {
      e.stopPropagation();
      const quoteId = quoteEl.dataset.quoteId;
      if (quoteId) {
        scrollToOriginalMessage(quoteId);
      }
    });
  }

  // Reaction chip click
  bubble.querySelectorAll('.message-reaction-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const emoji = chip.dataset.emoji;
      if (emoji && msg.id) {
        toggleReaction(msg, emoji);
      }
    });
  });

  // Tap / click handler for opening reaction menu
  bubble.addEventListener('click', (e) => {
    if (e.target.closest('.message-quote-box') || e.target.closest('.message-reaction-chip')) return;
    openMessageActionMenu(msg, bubble);
  });

  // ПКМ по сообщению также открывает реакции и кнопку ответа
  bubble.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openMessageActionMenu(msg, bubble);
  });

  // Mobile swipe-to-reply touch events
  setupSwipeToReply(bubble, msg);

  return bubble;
}

export function appendMessageToUI(msg, index = 0) {
  if (!messagesContainer || !msg) return;

  const domId = getMsgDomId(msg.id);
  const cleanId = String(msg.id || '').replace(/^(msg-)+/, '');

  // 1. Дедупликация: если элемент с таким нормализованным ID уже есть в DOM — обновляем статус и выходим
  if (domId) {
    const existing = document.getElementById(domId);
    if (existing) {
      const statusWrap = existing.querySelector('.msg-status-wrapper');
      if (statusWrap && (msg.is_read || msg.status === 'read')) {
        statusWrap.innerHTML = STATUS_ICONS.read;
      }
      return;
    }
  }

  // 2. Если это подтвержденное сервером сообщение (постоянный ID)
  const currentUser = getCurrentUser();
  const isOutgoing = (currentUser && String(msg.sender_id) === String(currentUser.id)) || msg.sender_id === 'me';
  const isServerMsg = msg.id && !String(msg.id).startsWith('temp_');

  if (isOutgoing && isServerMsg) {
    // 2a. Ищем временный оптимистичный пузырь (с id содержащим temp_)
    const pendingBubbles = messagesContainer.querySelectorAll('.message-bubble[id*="temp_"]');
    for (const pb of pendingBubbles) {
      const textEl = pb.querySelector('.message-text');
      if (textEl && textEl.textContent.trim() === String(msg.content || '').trim()) {
        pb.id = domId;
        const statusWrap = pb.querySelector('.msg-status-wrapper');
        if (statusWrap) {
          statusWrap.id = `msg-status-${cleanId}`;
          statusWrap.innerHTML = (msg.is_read || msg.status === 'read') ? STATUS_ICONS.read : STATUS_ICONS.sent;
        }
        return;
      }
    }

    // 2b. Дополнительная защита: проверяем последнее исходящее сообщение с идентичным текстом
    const allOutgoing = messagesContainer.querySelectorAll('.message-bubble.outgoing');
    if (allOutgoing.length > 0) {
      const lastBubble = allOutgoing[allOutgoing.length - 1];
      const textEl = lastBubble.querySelector('.message-text');
      if (textEl && textEl.textContent.trim() === String(msg.content || '').trim()) {
        lastBubble.id = domId;
        const statusWrap = lastBubble.querySelector('.msg-status-wrapper');
        if (statusWrap) {
          statusWrap.id = `msg-status-${cleanId}`;
          statusWrap.innerHTML = (msg.is_read || msg.status === 'read') ? STATUS_ICONS.read : STATUS_ICONS.sent;
        }
        return;
      }
    }
  }

  const bubble = createMessageElement(msg, index);
  messagesContainer.appendChild(bubble);
  scrollChatToBottom();
  return bubble;
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
  const ch = cachedChannels.find(c => c.id === channelId);
  const isGroup = ch?.type === 'group';

  let authorPrefix = '';
  if (isGroup && first.username) {
    authorPrefix = `<span class="chat-typing-user-name">${escapeHtml(first.username)}</span>`;
  }

  typingEl.innerHTML = `
    ${authorPrefix}
    <div class="typing-dots chat-list-typing-dots">
      <span></span><span></span><span></span>
    </div>
  `;
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

    cloud.innerHTML = `
      ${avatarsHtml}
      <div class="typing-animation-box">${animHtml}</div>
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
          body: JSON.stringify({
            content: item.content,
            is_e2ee: !!item.is_e2ee,
            reply_to: item.reply_to ? JSON.stringify(item.reply_to) : undefined
          })
        });

        if (res.ok) {
          const serverMsg = await res.json();
          outboxQueue.shift();
          saveOutbox();

          const cleanId = String(serverMsg.id).replace(/^(msg-)+/, '');
          const newDomId = `msg-${cleanId}`;

          // Обновляем статус сообщения в DOM
          const statusWrap = document.getElementById(`msg-status-${item.temp_id}`);
          if (statusWrap) {
            statusWrap.innerHTML = STATUS_ICONS.sent;
            statusWrap.id = `msg-status-${cleanId}`;
          }
          const tempBubble = document.getElementById(`msg-${item.temp_id}`) || document.getElementById(item.temp_id);
          if (tempBubble) {
            tempBubble.id = newDomId;
          }

          // Обновляем в локальном кэше
          try {
            const cacheKey = `sharada_cached_messages_${item.channel_id}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            const idx = cached.findIndex(m => m.id === item.temp_id);
            if (idx !== -1) {
              cached[idx] = serverMsg;
            } else if (!cached.some(m => getMsgDomId(m.id) === newDomId)) {
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

function animateMessageFlyFromInput(bubble, sourceEl) {
  if (!bubble || !sourceEl) return;
  try {
    const srcRect = sourceEl.getBoundingClientRect();
    const destRect = bubble.getBoundingClientRect();

    const deltaX = srcRect.left - destRect.left;
    const deltaY = srcRect.top - destRect.top;

    bubble.style.animation = 'none';
    bubble.style.transformOrigin = 'bottom right';
    bubble.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.85)`;
    bubble.style.opacity = '0.4';
    bubble.style.transition = 'none';

    // Force reflow
    void bubble.offsetHeight;

    requestAnimationFrame(() => {
      bubble.style.transition = 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.35s ease-out';
      bubble.style.transform = 'translate(0, 0) scale(1)';
      bubble.style.opacity = '1';

      const cleanup = () => {
        bubble.style.transition = '';
        bubble.style.transform = '';
        bubble.style.transformOrigin = '';
        bubble.removeEventListener('transitionend', cleanup);
      };
      bubble.addEventListener('transitionend', cleanup);
    });
  } catch (e) {
    console.warn('Message fly animation failed:', e);
  }
}

export async function sendMessage() {
  if (!messageInput) return;
  const text = messageInput.value.trim();
  if (!text || !currentChannelId) return;

  const inputCapsule = messageInput.closest('.input-capsule') || messageInput;

  // Очищаем поле ввода моментально и плавно сбрасываем высоту капсулы
  messageInput.value = '';
  resetInputHeight();

  const replyingTo = currentReplyingMessage ? {
    id: currentReplyingMessage.id,
    sender_name: currentReplyingMessage.sender_display_name || currentReplyingMessage.sender || currentReplyingMessage.sender_name || 'Собеседник',
    content: currentReplyingMessage.content
  } : null;
  cancelReply();

  const currentUser = getCurrentUser();
  const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

  const optimisticMsg = {
    id: tempId,
    channel_id: currentChannelId,
    sender_id: currentUser?.id || 'me',
    sender_name: currentUser?.display_name || currentUser?.username || 'Я',
    content: text,
    created_at: new Date().toISOString(),
    is_read: false,
    status: 'pending',
    reply_to: replyingTo
  };

  // Мгновенное появление сообщения у себя в чате с плавной анимацией полёта из строки ввода
  const bubble = appendMessageToUI(optimisticMsg);
  if (bubble && inputCapsule) {
    animateMessageFlyFromInput(bubble, inputCapsule);
  }

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
    is_e2ee: false,
    reply_to: replyingTo
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

// ============================================================
// СИСТЕМА УВЕДОМЛЕНИЙ (АУДИО WEBAUDIO И СИСТЕМНЫЕ БАННЕРЫ)
// ============================================================
let audioCtx = null;

export function playNotificationSound() {
  try {
    const audio = new Audio('assets/sounds/notify.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {
      playSynthesizedChime();
    });
  } catch (e) {
    playSynthesizedChime();
  }
}

function playSynthesizedChime() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(880, now + 0.08);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.22); // D6

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now + 0.06);
    osc1.stop(now + 0.35);
    osc2.stop(now + 0.35);
  } catch (e) {
    // Audio may be blocked by browser policy before user interaction
  }
}

export function requestNotificationPermission() {
  try {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } catch (e) {}
}

export function showDesktopNotification(title, body, channelId) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const notif = new Notification(title || 'Sharada Messenger', {
      body: body || 'Новое сообщение',
      icon: 'assets/icons/app-icon.png',
      tag: `sharada-channel-${channelId || 'chat'}`,
      renotify: true
    });

    notif.onclick = () => {
      window.focus();
      if (channelId && channelId !== currentChannelId) {
        const target = cachedChannels.find(c => c.id === channelId);
        if (target) openChat(target);
      }
      notif.close();
    };
  } catch (e) {
    console.warn('[Notification] Failed to show system notification', e);
  }
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
    onlineUsers.clear();
    syncOnlineUsers();
    flushOutboxQueue();
    loadChannels();
  };

  wsConn.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'message') {
        const messageData = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
        const currentUser = getCurrentUser();
        const isFromMe = currentUser && String(messageData.sender_id) === String(currentUser.id);

        // Звуковое и системное уведомление: ТОЛЬКО если сообщение не от нас и пользователь не в активном открытом чате!
        if (!isFromMe) {
          const isChatActiveAndFocused = (msg.channel_id === currentChannelId && document.hasFocus());
          if (!isChatActiveAndFocused) {
            playNotificationSound();
            const senderTitle = messageData.sender_name || 'Новое сообщение';
            showDesktopNotification(senderTitle, messageData.content, msg.channel_id);
          }
        }

        if (msg.channel_id === currentChannelId) {
          appendMessageToUI(messageData);
          if (!isFromMe && document.hasFocus()) {
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
        const currentUser = getCurrentUser();
        const readerId = msg.sender_id || (msg.payload && msg.payload.sender_id);
        const isFromPartner = currentUser && readerId && String(readerId) !== String(currentUser.id);

        if (msg.channel_id === currentChannelId && isFromPartner) {
          document.querySelectorAll('.message-bubble.outgoing .msg-status-wrapper').forEach(tick => {
            tick.innerHTML = STATUS_ICONS.read;
          });
          try {
            const cacheKey = `sharada_cached_messages_${currentChannelId}`;
            const cached = JSON.parse(localStorage.getItem(cacheKey) || '[]');
            cached.forEach(m => {
              if (currentUser && String(m.sender_id) === String(currentUser.id)) {
                m.is_read = true;
              }
            });
            localStorage.setItem(cacheKey, JSON.stringify(cached));
          } catch (e) {}
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
    onlineUsers.clear();
    updateOnlineStatusUI();
    wsReconnectTimer = setTimeout(initWebSocket, 2500);
  };

  wsConn.onerror = () => {
    setConnectionState('reconnecting');
    onlineUsers.clear();
    updateOnlineStatusUI();
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
    const adjustInputHeight = () => {
      if (!messageInput) return;
      if (!messageInput.value || messageInput.value.trim() === '') {
        resetInputHeight();
        return;
      }
      messageInput.style.height = '36px';
      const scrollH = messageInput.scrollHeight;
      const targetH = Math.min(Math.max(scrollH, 36), 220); // максимум 220px
      messageInput.style.height = `${targetH}px`;
      if (scrollH > 220) {
        messageInput.classList.add('scrollable');
      } else {
        messageInput.classList.remove('scrollable');
      }
    };

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        adjustInputHeight();
      }
    });

    // Отправка события печатания + автоперенос и плавная регулировка высоты
    messageInput.addEventListener('input', () => {
      adjustInputHeight();
      const now = Date.now();
      if (now - lastTypingTime > 1800 && currentChannelId && wsConn && wsConn.readyState === WebSocket.OPEN) {
        lastTypingTime = now;
        const curUser = getCurrentUser();
        try {
          wsConn.send(JSON.stringify({
            type: 'typing',
            channel_id: currentChannelId,
            sender_id: curUser?.id,
            sender_name: curUser?.display_name || curUser?.username,
            payload: { action: 'text', username: curUser?.display_name || curUser?.username, user_id: curUser?.id }
          }));
        } catch (e) {}
      }
    });
  }

  // Кнопка отмены ответа в баре предпросмотра
  const btnCancelReply = document.getElementById('btnCancelReply');
  if (btnCancelReply) {
    btnCancelReply.addEventListener('click', cancelReply);
  }

  // Всплывающее меню сообщения: затемненный фон закрывает меню при клике
  const messageActionBackdrop = document.getElementById('messageActionBackdrop');
  if (messageActionBackdrop) {
    messageActionBackdrop.addEventListener('click', (e) => {
      if (e.target === messageActionBackdrop) {
        closeMessageActionMenu();
      }
    });
  }

  // Кнопка "Копировать" в меню сообщения
  const btnActionCopy = document.getElementById('btnActionCopy');
  if (btnActionCopy) {
    btnActionCopy.addEventListener('click', async () => {
      if (activeActionMessage && activeActionMessage.content) {
        try {
          await navigator.clipboard.writeText(activeActionMessage.content);
        } catch (e) {
          const ta = document.createElement('textarea');
          ta.value = activeActionMessage.content;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      }
      closeMessageActionMenu();
    });
  }

  // Кнопка "Ответить" в меню сообщения
  const btnActionReply = document.getElementById('btnActionReply');
  if (btnActionReply) {
    btnActionReply.addEventListener('click', () => {
      if (activeActionMessage) {
        setReplyingTo(activeActionMessage);
      }
      closeMessageActionMenu();
    });
  }

  // 5 кнопок реакций в меню сообщения
  document.querySelectorAll('.reaction-emoji-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const reaction = btn.dataset.reaction;
      if (activeActionMessage && reaction) {
        toggleReaction(activeActionMessage, reaction);
      }
      closeMessageActionMenu();
    });
  });

  // Закрытие меню и отмена ответа по Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMessageActionMenu();
      cancelReply();
    }
  });

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

  // Запрос разрешения на отправку уведомлений при первом клике пользователя
  document.addEventListener('click', requestNotificationPermission, { once: true });
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
