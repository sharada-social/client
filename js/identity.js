/**
 * identity.js — Единый модуль управления аватарками и именами пользователей/чатов в Sharada
 * 
 * Отвечает за:
 * 1. Централизованную генерацию и парсинг аватарок (рандомные/детерминированные фоны + белые значки)
 * 2. Отрисовку аватарок во всех контекстах (список чатов, заголовок, профиль, участники, звонки)
 * 3. Формирование Data URI для десктопных и мобильных (Android) системных уведомлений
 * 4. Единый формат и стилизацию отображения имён пользователей
 */

export const AVATAR_ICONS = [
  'asteroid.svg',
  'basketball.svg',
  'black_hole.svg',
  'bomb.svg',
  'cat.svg',
  'ghost.svg',
  'incognito.svg'
];

export const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366F1, #8B5CF6)', // Indigo - Violet
  'linear-gradient(135deg, #3B82F6, #1D4ED8)', // Blue
  'linear-gradient(135deg, #10B981, #047857)', // Emerald
  'linear-gradient(135deg, #F59E0B, #D97706)', // Amber
  'linear-gradient(135deg, #EC4899, #BE185D)', // Pink
  'linear-gradient(135deg, #8B5CF6, #6D28D9)', // Purple
  'linear-gradient(135deg, #06B6D4, #0E7490)', // Cyan
  'linear-gradient(135deg, #F43F5E, #BE123C)', // Rose
  'linear-gradient(135deg, #14B8A6, #0F766E)', // Teal
  'linear-gradient(135deg, #F97316, #C2410C)'  // Orange
];

/**
 * Детерминированный хэш строки для выбора стабильного аватара
 */
function hashString(str) {
  let hash = 0;
  const s = String(str || 'sharada');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Извлекает конфигурацию аватара (icon + bg) или вычисляет детерминированный fallback
 */
export function parseAvatarConfig(avatarData, fallbackSeed = '') {
  if (avatarData && typeof avatarData === 'object') {
    return {
      icon: avatarData.icon || AVATAR_ICONS[0],
      bg: avatarData.bg || AVATAR_GRADIENTS[0]
    };
  }

  if (typeof avatarData === 'string' && avatarData.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(avatarData);
      if (parsed && (parsed.icon || parsed.bg)) {
        return {
          icon: parsed.icon || AVATAR_ICONS[0],
          bg: parsed.bg || AVATAR_GRADIENTS[0]
        };
      }
    } catch (e) {}
  }

  if (typeof avatarData === 'string' && (avatarData.startsWith('http') || avatarData.startsWith('data:') || avatarData.startsWith('/'))) {
    return {
      imgUrl: avatarData,
      bg: 'transparent'
    };
  }

  const h = hashString(fallbackSeed || avatarData || 'user');
  const icon = AVATAR_ICONS[h % AVATAR_ICONS.length];
  const bg = AVATAR_GRADIENTS[Math.floor(h / AVATAR_ICONS.length) % AVATAR_GRADIENTS.length];
  return { icon, bg };
}

/**
 * Возвращает полный объект с метаданными аватара для любой сущности (канал, пользователь, объект чата)
 */
export function getAvatarInfo(entity) {
  if (!entity) {
    return {
      type: 'user_icon',
      iconPath: `assets/icons/avatar/user/${AVATAR_ICONS[0]}`,
      bg: AVATAR_GRADIENTS[0]
    };
  }

  // 1. Системные и специальные каналы
  const idStr = String(entity.id || '');
  const typeStr = String(entity.type || '');
  const nameStr = String(entity.name || entity.username || '');

  // Избранное
  if (typeStr === 'saved' || idStr === 'chan-saved' || idStr.startsWith('saved-')) {
    return {
      type: 'special_svg',
      iconPath: 'assets/icons/avatar/star.svg',
      bg: 'var(--grad-purple)',
      isSpecial: true
    };
  }

  // Системный канал sharada
  if (typeStr === 'system' || idStr.startsWith('system-') || nameStr.toLowerCase() === 'sharada') {
    return {
      type: 'special_img',
      imgUrl: 'assets/icons/avatar/system.png',
      bg: 'transparent',
      isSpecial: true
    };
  }

  // Удаленный аккаунт
  if (entity.recipient_status === 'deleted' || entity.is_deleted || nameStr === 'Удаленный аккаунт') {
    return {
      type: 'special_svg',
      iconPath: 'assets/icons/avatar/deleted.svg',
      bg: '#333338',
      isSpecial: true
    };
  }

  // Архивный аккаунт
  if (entity.recipient_is_archived || entity.recipient_status === 'archived' || entity.is_archived) {
    return {
      type: 'special_svg',
      iconPath: 'assets/icons/avatar/archived.svg',
      bg: '#44444a',
      isSpecial: true
    };
  }

  // Групповой чат
  if (typeStr === 'group') {
    const letter = (nameStr || '#').charAt(0).toUpperCase();
    const h = hashString(idStr || nameStr);
    const bg = (entity.is_e2ee)
      ? 'linear-gradient(135deg, #10b981, #059669)'
      : AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
    return {
      type: 'group',
      letter,
      bg,
      isGroup: true
    };
  }

  // 2. Обычный пользователь (включая личные диалоги)
  const rawAvatar = entity.avatar_url || entity.recipient_avatar || entity.avatar;
  // Для консистентности: если это direct-канал, entity.id - это ID канала (chan-...),
  // поэтому в первую очередь берем username, recipient_id, recipient_username или user_id
  const seed = entity.username || entity.recipient_username || entity.recipient_id || entity.user_id || (typeStr !== 'direct' ? entity.id : '') || nameStr || 'user';
  const cfg = parseAvatarConfig(rawAvatar, seed);

  if (cfg.imgUrl) {
    return {
      type: 'img',
      imgUrl: cfg.imgUrl,
      bg: cfg.bg || 'transparent'
    };
  }

  const iconName = cfg.icon && cfg.icon.endsWith('.svg') ? cfg.icon : `${cfg.icon || 'cat'}.svg`;
  return {
    type: 'user_icon',
    iconPath: `assets/icons/avatar/user/${iconName}`,
    bg: cfg.bg || AVATAR_GRADIENTS[0]
  };
}

function sanitizeAvatarUrl(url) {
  const raw = String(url || '').trim();
  if (raw.startsWith('https://') || raw.startsWith('data:image/') || raw.startsWith('assets/')) {
    return escapeHtml(raw);
  }
  return 'assets/icons/avatar/user/cat.svg';
}

/**
 * Генерирует HTML-разметку для аватара
 */
export function renderAvatarHTML(entity, options = {}) {
  const info = getAvatarInfo(entity);
  const sizeStyle = options.size ? `width:${options.size}px; height:${options.size}px; min-width:${options.size}px;` : '';
  const fontStyle = options.fontSize ? `font-size:${options.fontSize}px;` : '';
  const extraStyle = options.style ? `${options.style};` : '';
  const customClass = options.customClass ? ` ${options.customClass}` : '';
  const idAttr = options.id ? ` id="${options.id}"` : '';

  let contentHtml = '';
  if (info.type === 'special_img' || info.type === 'img') {
    contentHtml = `<img src="${sanitizeAvatarUrl(info.imgUrl)}" class="chat-avatar-full-img" alt="" draggable="false">`;
  } else if (info.type === 'special_svg') {
    contentHtml = `<img src="${escapeHtml(info.iconPath)}" class="chat-avatar-svg-icon" alt="" draggable="false">`;
  } else if (info.type === 'group') {
    contentHtml = `<span class="avatar-letter">${escapeHtml(info.letter || '#')}</span>`;
  } else {
    // Пользовательский значок в белом цвете
    contentHtml = `<img src="${escapeHtml(info.iconPath)}" class="avatar-user-icon" alt="" draggable="false">`;
  }

  let dotHtml = '';
  if (options.showOnlineDot) {
    dotHtml = `<span class="avatar-online-dot ${options.isOnline ? 'visible' : ''}"></span>`;
  }

  return `
    <div class="avatar${customClass}"${idAttr} style="background:${info.bg}; ${sizeStyle} ${fontStyle} ${extraStyle}">
      ${contentHtml}
      ${dotHtml}
    </div>
  `.trim();
}

/**
 * Применяет аватар к уже существующему DOM-элементу (например, шапка чата, профиль)
 */
export function applyAvatarToElement(element, entity, options = {}) {
  if (!element) return;
  const info = getAvatarInfo(entity);

  element.style.background = info.bg;
  element.style.display = 'flex';
  element.style.alignItems = 'center';
  element.style.justifyContent = 'center';

  if (options.size) {
    element.style.width = `${options.size}px`;
    element.style.height = `${options.size}px`;
    element.style.minWidth = `${options.size}px`;
  }
  if (options.fontSize) {
    element.style.fontSize = `${options.fontSize}px`;
  }

  let contentHtml = '';
  if (info.type === 'special_img' || info.type === 'img') {
    contentHtml = `<img src="${sanitizeAvatarUrl(info.imgUrl)}" class="chat-avatar-full-img" alt="" draggable="false">`;
  } else if (info.type === 'special_svg') {
    contentHtml = `<img src="${escapeHtml(info.iconPath)}" class="header-avatar-svg-icon" alt="" draggable="false">`;
  } else if (info.type === 'group') {
    contentHtml = `<span class="avatar-letter">${escapeHtml(info.letter || '#')}</span>`;
  } else {
    contentHtml = `<img src="${escapeHtml(info.iconPath)}" class="avatar-user-icon" alt="" draggable="false">`;
  }

  if (options.showOnlineDot) {
    contentHtml += `<span class="avatar-online-dot ${options.isOnline ? 'visible' : ''}"></span>`;
  }

  element.innerHTML = contentHtml;
}

/**
 * Генерирует Data URI аватарки для десктопных и мобильных (Android) уведомлений
 */
export function getAvatarDataUri(entity, size = 128) {
  try {
    const info = getAvatarInfo(entity);
    if (info.imgUrl) {
      return info.imgUrl;
    }

    // Для уведомлений генерируем чистый SVG Data URI с фоном и иконкой/буквой
    let innerSvg = '';
    if (info.type === 'group') {
      innerSvg = `
        <text x="50%" y="54%" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
              font-size="${Math.round(size * 0.45)}" font-weight="bold" fill="#ffffff" 
              text-anchor="middle" dominant-baseline="middle">${escapeHtml(info.letter || '#')}</text>
      `;
    } else {
      // Иконка
      const iconPath = info.iconPath || `assets/icons/avatar/user/${AVATAR_ICONS[0]}`;
      innerSvg = `
        <image href="${iconPath}" x="${size * 0.23}" y="${size * 0.23}" width="${size * 0.54}" height="${size * 0.54}" />
      `;
    }

    // Извлекаем цвета для градиента
    let bgFill = info.bg;
    if (bgFill.includes('linear-gradient')) {
      const colors = bgFill.match(/#(?:[0-9a-fA-F]{3,8})/g) || ['#6366F1', '#8B5CF6'];
      const c1 = colors[0] || '#6366F1';
      const c2 = colors[1] || colors[0];
      return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="${encodeURIComponent(c1)}"/><stop offset="100%" stop-color="${encodeURIComponent(c2)}"/></linearGradient></defs><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="url(%23g)"/>${innerSvg}</svg>`;
    }

    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${encodeURIComponent(bgFill)}"/>${innerSvg}</svg>`;
  } catch (e) {
    return 'assets/icons/app-icon.png';
  }
}

/**
 * =========================================================================
 * ЕДИНОЕ УПРАВЛЕНИЕ ИМЕНАМИ ПОЛЬЗОВАТЕЛЕЙ (Display Names)
 * =========================================================================
 */

/**
 * Возвращает чистый текст отображаемого имени (для document.title, уведомлений, альтов)
 */
export function getUserDisplayNameText(entity) {
  if (!entity) return 'Собеседник';

  const typeStr = String(entity.type || '');
  const idStr = String(entity.id || '');
  const nameStr = String(entity.name || entity.username || '');

  if (typeStr === 'saved' || idStr === 'chan-saved' || idStr.startsWith('saved-')) {
    return 'Избранное';
  }
  if (typeStr === 'system' || idStr.startsWith('system-') || nameStr.toLowerCase() === 'sharada') {
    return 'sharada';
  }
  if (entity.recipient_status === 'deleted' || entity.is_deleted || nameStr === 'Удаленный аккаунт') {
    return 'Удаленный аккаунт';
  }

  return entity.display_name || entity.recipient_display_name || entity.name || entity.username || 'Собеседник';
}

/**
 * Рендерит форматированное имя пользователя с единым стилем
 * В этом месте в будущем подключаются любые стили имён (цвета, анимации, значки верификации, бейджи)
 */
export function renderUserDisplayNameHTML(entity, options = {}) {
  const plainText = getUserDisplayNameText(entity);
  const customClass = options.customClass ? ` ${options.customClass}` : '';
  const userId = entity?.id || entity?.recipient_id || entity?.user_id || '';

  return `
    <span class="user-display-name${customClass}" ${userId ? `data-user-id="${escapeHtml(String(userId))}"` : ''}>
      <span class="user-name-text">${escapeHtml(plainText)}</span>
    </span>
  `.trim();
}

/**
 * Экранирование HTML-символов
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
