import { getCurrentUser, authFetch } from './api.js';
import { applyAvatarToElement } from './identity.js';

// ==========================================================
// ЗВУКОВОЙ СИНТЕЗАТОР ЗВОНКОВ (Web Audio API)
// Работает безотказно без внешних mp3-файлов
// ==========================================================
class VoiceAudioSynthesizer {
  constructor() {
    this.ctx = null;
    this.ringInterval = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Исходящие гудки (440Hz + 480Hz с плавным нарастанием)
  startOutgoingRingtone() {
    this.stop();
    const ctx = this.ensureContext();
    const playBeep = () => {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.08);
        gain.gain.setValueAtTime(0.08, now + 1.1);
        gain.gain.linearRampToValueAtTime(0, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.25);
        osc2.stop(now + 1.25);
      } catch (e) {}
    };

    playBeep();
    this.ringInterval = setInterval(playBeep, 3500);
  }

  // Входящая приятная мелодия вызова (мелодичный трезвук marimba)
  startIncomingRingtone() {
    this.stop();
    const ctx = this.ensureContext();
    const playMelody = () => {
      try {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
          const now = ctx.currentTime + (idx * 0.14);
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 0.4);
        });
      } catch (e) {}
    };

    playMelody();
    this.ringInterval = setInterval(playMelody, 2200);
  }

  // Звук успешного подключения (Discord connect chime)
  playConnectedSound() {
    this.stop();
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      [587.33, 880].forEach((freq, i) => {
        const t = now + (i * 0.1);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (e) {}
  }

  // Звук завершения вызова (Discord leave chime)
  playHangupSound() {
    this.stop();
    try {
      const ctx = this.ensureContext();
      const now = ctx.currentTime;
      [659.25, 440].forEach((freq, i) => {
        const t = now + (i * 0.1);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.25);
      });
    } catch (e) {}
  }

  stop() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }
}

const soundFX = new VoiceAudioSynthesizer();

// ==========================================================
// КОНФИГУРАЦИЯ WEBRTC И СОСТОЯНИЕ ЗВОНКА
// ==========================================================
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

let currentCall = null;
// currentCall: {
//   state: 'calling' | 'incoming' | 'connecting' | 'connected',
//   channelId: string,
//   channelName: string,
//   partnerId: string,
//   partnerName: string,
//   isInitiator: boolean,
//   isMicMuted: boolean,
//   isDeafened: boolean,
//   startTime: number,
//   timerId: any,
//   noAnswerTimeoutId: any,
//   peerConnection: RTCPeerConnection,
//   localStream: MediaStream,
//   remoteStream: MediaStream,
//   iceQueue: Array,
//   isRemoteDescSet: boolean,
//   localMeterCleanup: Function,
//   remoteMeterCleanup: Function
// }

let wsSendFn = null;

export function setCallWsSender(fn) {
  wsSendFn = fn;
}

function sendCallEvent(type, targetId, channelId, payload = {}) {
  if (typeof wsSendFn === 'function') {
    wsSendFn(type, targetId, channelId, payload);
  }
}

// ==========================================================
// VOICE ACTIVITY DETECTION (VAD) / ИНДИКАТОР РЕЧИ (DISCORD)
// ==========================================================
function setupVoiceMeter(stream, onLevel) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);

    const buffer = new Uint8Array(analyser.frequencyBinCount);
    let rafId = null;

    const check = () => {
      analyser.getByteFrequencyData(buffer);
      let sum = 0;
      for (let i = 0; i < buffer.length; i++) {
        sum += buffer[i];
      }
      const avg = sum / buffer.length;
      onLevel(avg > 14); // True если говорит
      rafId = requestAnimationFrame(check);
    };
    rafId = requestAnimationFrame(check);

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      analyser.disconnect();
      if (ctx.state !== 'closed') ctx.close().catch(() => {});
    };
  } catch (e) {
    return () => {};
  }
}

// ==========================================================
// ИНИЦИАЛИЗАЦИЯ И СТАРТ ЗВОНКА
// ==========================================================
export async function startVoiceCall(channel) {
  if (!channel) return;
  if (currentCall) {
    // Если звонок уже активен, открываем окно звонка
    showActiveCallOverlay();
    return;
  }

  const currentUser = getCurrentUser();
  if (!currentUser) return;

  // Определяем ID собеседника
  let targetPartnerId = channel.recipient_id;
  if (!targetPartnerId && channel.type === 'direct') {
    try {
      const res = await authFetch(`/api/channels/${channel.id}/members`);
      if (res.ok) {
        const members = await res.json();
        const other = members.find(m => String(m.user_id) !== String(currentUser.id));
        if (other) targetPartnerId = other.user_id;
      }
    } catch (e) {}
  }

  const partnerName = channel.display_name || channel.name || 'Собеседник';

  // Запрашиваем микрофон
  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  } catch (err) {
    alert('Не удалось получить доступ к микрофону. Пожалуйста, разрешите доступ к микрофону в настройках браузера/системы.');
    return;
  }

  // Создаем объект звонка
  currentCall = {
    state: 'calling',
    channelId: channel.id,
    channelName: partnerName,
    partnerId: targetPartnerId,
    partnerName: partnerName,
    partnerUsername: channel.name || channel.recipient_username || partnerName,
    partnerAvatar: channel.recipient_avatar || channel.avatar_url || channel.avatar || '',
    isInitiator: true,
    isMicMuted: false,
    isDeafened: false,
    startTime: null,
    timerId: null,
    noAnswerTimeoutId: null,
    peerConnection: null,
    localStream: micStream,
    remoteStream: null,
    iceQueue: [],
    isRemoteDescSet: false,
    localMeterCleanup: null,
    remoteMeterCleanup: null
  };

  soundFX.startOutgoingRingtone();
  createPeerConnection();

  // Создаем WebRTC Offer
  try {
    const offer = await currentCall.peerConnection.createOffer({
      offerToReceiveAudio: true
    });
    await currentCall.peerConnection.setLocalDescription(offer);

    sendCallEvent('call_offer', targetPartnerId, channel.id, {
      offer: offer,
      channel_id: channel.id,
      channel_name: partnerName,
      caller_id: currentUser.id,
      caller_username: currentUser.username || '',
      caller_name: currentUser.display_name || currentUser.username,
      caller_avatar: currentUser.avatar_url || ''
    });
  } catch (e) {
    console.error('Failed to create call offer', e);
    endVoiceCall();
    return;
  }

  // Обновляем UI
  updateCallUI();
  showActiveCallOverlay();

  // Тайм-аут ожидания ответа: 32 секунды
  currentCall.noAnswerTimeoutId = setTimeout(() => {
    if (currentCall && currentCall.state === 'calling') {
      sendCallEvent('call_leave', currentCall.partnerId, currentCall.channelId, { reason: 'timeout' });
      showCallNotification('Собеседник не отвечает');
      endVoiceCall();
    }
  }, 32000);
}

// ==========================================================
// ОБРАБОТКА ВХОДЯЩИХ СИГНАЛОВ ЗВОНКА (WEBSOCKET)
// ==========================================================
export async function handleIncomingCallWsEvent(msg) {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const senderId = msg.sender_id || (msg.payload && msg.payload.caller_id);
  if (senderId && String(senderId) === String(currentUser.id)) {
    return; // Игнорируем эхо своих же сигналов
  }

  switch (msg.type) {
    case 'call_offer':
      handleIncomingOffer(msg);
      break;

    case 'call_answer':
      handleCallAnswer(msg);
      break;

    case 'call_candidate':
      handleCallCandidate(msg);
      break;

    case 'call_reject':
    case 'call_busy':
      handleCallRejected(msg);
      break;

    case 'call_leave':
      handleCallRemoteHangup(msg);
      break;

    case 'call_state_update':
      handleCallStateUpdate(msg);
      break;
  }
}

function handleCallStateUpdate(msg) {
  if (!currentCall) return;
  const payload = msg.payload || {};
  currentCall.remoteIsMuted = !!payload.is_muted;
  currentCall.remoteIsDeafened = !!payload.is_deafened;
  updateControlButtonsUI();
}

// Пришел входящий звонок от собеседника
function handleIncomingOffer(msg) {
  const payload = msg.payload || {};
  const callerName = payload.caller_name || msg.sender_name || 'Пользователь';
  const callerId = payload.caller_id || msg.sender_id;
  const channelId = msg.channel_id || payload.channel_id;

  // Если уже в звонке -> отвечаем занято
  if (currentCall) {
    sendCallEvent('call_busy', callerId, channelId, { reason: 'busy' });
    return;
  }

  // Проверяем настройку сессии allow_calls
  try {
    const raw = localStorage.getItem('sharada_session_settings');
    if (raw) {
      const sess = JSON.parse(raw);
      if (sess.allow_calls === false) {
        sendCallEvent('call_reject', callerId, channelId, { reason: 'calls_disabled' });
        return;
      }
    }
  } catch (e) {}

  currentCall = {
    state: 'incoming',
    channelId: channelId,
    channelName: callerName,
    partnerId: callerId,
    partnerName: callerName,
    partnerUsername: payload.caller_username || callerName,
    partnerAvatar: payload.caller_avatar || '',
    isInitiator: false,
    isMicMuted: false,
    isDeafened: false,
    startTime: null,
    timerId: null,
    noAnswerTimeoutId: null,
    peerConnection: null,
    localStream: null,
    remoteStream: null,
    iceQueue: [],
    isRemoteDescSet: false,
    pendingOffer: payload.offer,
    localMeterCleanup: null,
    remoteMeterCleanup: null
  };

  soundFX.startIncomingRingtone();
  showIncomingCallModal(callerName, payload.caller_avatar, callerId, payload.caller_username);

  // Автоотклонение через 30 секунд если не взял трубку
  currentCall.noAnswerTimeoutId = setTimeout(() => {
    if (currentCall && currentCall.state === 'incoming') {
      sendCallEvent('call_reject', currentCall.partnerId, currentCall.channelId, { reason: 'missed' });
      endVoiceCall();
    }
  }, 30000);
}

// Принятие входящего звонка
export async function acceptIncomingCall() {
  if (!currentCall || currentCall.state !== 'incoming') return;
  clearTimeout(currentCall.noAnswerTimeoutId);
  hideIncomingCallModal();

  // Запрашиваем микрофон
  let micStream = null;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: false
    });
  } catch (err) {
    alert('Не удалось получить доступ к микрофону. Пожалуйста, разрешите доступ в настройках браузера.');
    sendCallEvent('call_reject', currentCall.partnerId, currentCall.channelId, { reason: 'mic_denied' });
    endVoiceCall();
    return;
  }

  currentCall.localStream = micStream;
  currentCall.state = 'connecting';
  soundFX.stop();

  createPeerConnection();

  try {
    await currentCall.peerConnection.setRemoteDescription(new RTCSessionDescription(currentCall.pendingOffer));
    currentCall.isRemoteDescSet = true;
    await drainIceCandidates();

    const answer = await currentCall.peerConnection.createAnswer();
    await currentCall.peerConnection.setLocalDescription(answer);

    sendCallEvent('call_answer', currentCall.partnerId, currentCall.channelId, {
      answer: answer
    });
  } catch (e) {
    console.error('Error handling incoming call offer', e);
    endVoiceCall();
    return;
  }

  updateCallUI();
  showActiveCallOverlay();
}

// Отклонение входящего звонка
export function declineIncomingCall() {
  if (!currentCall) return;
  clearTimeout(currentCall.noAnswerTimeoutId);
  sendCallEvent('call_reject', currentCall.partnerId, currentCall.channelId, { reason: 'declined' });
  endVoiceCall();
}

// Собеседник ответил на звонок (для инициатора)
async function handleCallAnswer(msg) {
  if (!currentCall || currentCall.state !== 'calling') return;
  clearTimeout(currentCall.noAnswerTimeoutId);
  soundFX.stop();

  const payload = msg.payload || {};
  if (!payload.answer) return;

  try {
    await currentCall.peerConnection.setRemoteDescription(new RTCSessionDescription(payload.answer));
    currentCall.isRemoteDescSet = true;
    await drainIceCandidates();
    setCallConnected();
  } catch (e) {
    console.error('Error setting remote description from answer', e);
  }
}

// Входящий ICE кандидат
async function handleCallCandidate(msg) {
  if (!currentCall || !currentCall.peerConnection) return;
  const payload = msg.payload || {};
  const candidate = payload.candidate;
  if (!candidate) return;

  if (!currentCall.isRemoteDescSet) {
    currentCall.iceQueue.push(candidate);
    return;
  }

  try {
    await currentCall.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  } catch (e) {
    console.warn('addIceCandidate error', e);
  }
}

async function drainIceCandidates() {
  if (!currentCall || !currentCall.peerConnection) return;
  while (currentCall.iceQueue.length > 0) {
    const cand = currentCall.iceQueue.shift();
    try {
      await currentCall.peerConnection.addIceCandidate(new RTCIceCandidate(cand));
    } catch (e) {
      console.warn('drain candidate error', e);
    }
  }
}

// Собеседник сбросил или занят
function handleCallRejected(msg) {
  if (!currentCall) return;
  const reason = (msg.payload && msg.payload.reason) || '';
  let msgText = 'Вызов отклонён';
  if (reason === 'busy') msgText = 'Линия занята';
  if (reason === 'calls_disabled') msgText = 'Собеседник отключил звонки в настройках';
  showCallNotification(msgText);
  endVoiceCall();
}

// Собеседник завершил разговор
function handleCallRemoteHangup() {
  if (!currentCall) return;
  showCallNotification('Собеседник завершил вызов');
  endVoiceCall();
}

// ==========================================================
// СОЗДАНИЕ RTCPeerConnection И ПОТОКОВ
// ==========================================================
function createPeerConnection() {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  currentCall.peerConnection = pc;

  // Добавляем дорожки своего микрофона
  if (currentCall.localStream) {
    currentCall.localStream.getTracks().forEach(track => {
      pc.addTrack(track, currentCall.localStream);
    });

    // Настраиваем локальный измеритель речи
    currentCall.localMeterCleanup = setupVoiceMeter(currentCall.localStream, (isSpeaking) => {
      const localCard = document.getElementById('voiceLocalCard');
      if (localCard) {
        if (isSpeaking && !currentCall.isMicMuted) {
          localCard.classList.add('voice-speaking');
        } else {
          localCard.classList.remove('voice-speaking');
        }
      }
    });
  }

  // Отправка ICE кандидатов собеседнику
  pc.onicecandidate = (event) => {
    if (event.candidate && currentCall) {
      sendCallEvent('call_candidate', currentCall.partnerId, currentCall.channelId, {
        candidate: event.candidate
      });
    }
  };

  // Получение входящего аудиопотока собеседника
  pc.ontrack = (event) => {
    const [stream] = event.streams;
    currentCall.remoteStream = stream;

    const audioEl = document.getElementById('remoteVoiceAudio');
    if (audioEl) {
      audioEl.srcObject = stream;
      audioEl.muted = currentCall.isDeafened;
      audioEl.play().catch(e => console.warn('Audio play error', e));
    }

    // Настраиваем удаленный измеритель речи (Discord индикатор собеседника)
    currentCall.remoteMeterCleanup = setupVoiceMeter(stream, (isSpeaking) => {
      const remoteCard = document.getElementById('voiceRemoteCard');
      if (remoteCard) {
        if (isSpeaking) {
          remoteCard.classList.add('voice-speaking');
        } else {
          remoteCard.classList.remove('voice-speaking');
        }
      }
    });

    setCallConnected();
  };

  pc.onconnectionstatechange = () => {
    if (!currentCall) return;
    const state = pc.connectionState;
    if (state === 'connected') {
      setCallConnected();
    } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      if (currentCall.state === 'connected') {
        endVoiceCall();
      }
    }
  };
}

function setCallConnected() {
  if (!currentCall || currentCall.state === 'connected') return;
  currentCall.state = 'connected';
  currentCall.startTime = Date.now();
  soundFX.playConnectedSound();

  // Запуск таймера звонка
  clearInterval(currentCall.timerId);
  currentCall.timerId = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
  updateCallUI();
}

function updateTimerDisplay() {
  if (!currentCall || !currentCall.startTime) return;
  const elapsed = Math.floor((Date.now() - currentCall.startTime) / 1000);
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');
  const timeStr = `${mins}:${secs}`;

  const timerEl = document.getElementById('voiceCallTimer');
  if (timerEl) timerEl.textContent = timeStr;

  const floatSub = document.getElementById('voiceFloatingSub');
  if (floatSub) floatSub.textContent = `${timeStr} • ${currentCall.partnerName}`;
}

// ==========================================================
// УПРАВЛЕНИЕ МИКРОФОНОМ И ДЕФЕНОМ
// ==========================================================
export function toggleMic() {
  if (!currentCall || !currentCall.localStream) return;
  // Если звук был выключен и включаем микрофон - автоматически включаем звук
  if (currentCall.isDeafened && currentCall.isMicMuted) {
    currentCall.isDeafened = false;
    const audioEl = document.getElementById('remoteVoiceAudio');
    if (audioEl) {
      audioEl.muted = false;
    }
  }

  currentCall.isMicMuted = !currentCall.isMicMuted;
  currentCall.localStream.getAudioTracks().forEach(track => {
    track.enabled = !currentCall.isMicMuted;
  });

  sendCallStateUpdate();
  updateControlButtonsUI();
}

export function toggleDeafen() {
  if (!currentCall) return;
  currentCall.isDeafened = !currentCall.isDeafened;
  const audioEl = document.getElementById('remoteVoiceAudio');
  if (audioEl) {
    audioEl.muted = currentCall.isDeafened;
  }

  // Заглушение звука автоматически выключает микрофон
  if (currentCall.isDeafened && !currentCall.isMicMuted) {
    currentCall.isMicMuted = true;
    if (currentCall.localStream) {
      currentCall.localStream.getAudioTracks().forEach(track => {
        track.enabled = false;
      });
    }
  }

  sendCallStateUpdate();
  updateControlButtonsUI();
}

function sendCallStateUpdate() {
  if (!currentCall || !currentCall.partnerId) return;
  sendCallEvent('call_state_update', currentCall.partnerId, currentCall.channelId, {
    is_muted: !!currentCall.isMicMuted,
    is_deafened: !!currentCall.isDeafened
  });
}

// ==========================================================
// ЗАВЕРШЕНИЕ ЗВОНКА
// ==========================================================
export function endVoiceCall(notifyRemote = true) {
  if (!currentCall) return;

  const channelId = currentCall.channelId;
  const isInitiator = currentCall.isInitiator;
  const callDuration = currentCall.startTime ? Math.max(1, Math.floor((Date.now() - currentCall.startTime) / 1000)) : 0;

  if (notifyRemote && currentCall.partnerId) {
    sendCallEvent('call_leave', currentCall.partnerId, currentCall.channelId, { reason: 'hangup' });
  }

  // Запись лога звонка в канал чата (только инициатор пишет один раз)
  if (channelId && isInitiator) {
    const callLogContent = callDuration > 0 ? `[CALL:ended:${callDuration}]` : `[CALL:missed]`;
    authFetch(`/api/channels/${channelId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: callLogContent })
    }).catch(e => console.warn('Failed to record call log in channel', e));
  }

  soundFX.playHangupSound();

  // Очистка таймеров
  clearInterval(currentCall.timerId);
  clearTimeout(currentCall.noAnswerTimeoutId);

  // Очистка аудиоизмерителей
  if (currentCall.localMeterCleanup) currentCall.localMeterCleanup();
  if (currentCall.remoteMeterCleanup) currentCall.remoteMeterCleanup();

  // Остановка дорожек микрофона
  if (currentCall.localStream) {
    currentCall.localStream.getTracks().forEach(t => t.stop());
  }

  // Закрытие WebRTC подключения
  if (currentCall.peerConnection) {
    try {
      currentCall.peerConnection.close();
    } catch (e) {}
  }

  const audioEl = document.getElementById('remoteVoiceAudio');
  if (audioEl) {
    audioEl.srcObject = null;
  }

  currentCall = null;

  hideIncomingCallModal();
  hideActiveCallOverlay();
  hideFloatingBar();
}

// ==========================================================
// UI ПЕРЕКЛЮЧЕНИЯ И ОТОБРАЖЕНИЕ (DISCORD-STYLE)
// ==========================================================
function updateCallUI() {
  if (!currentCall) return;

  const statusText = document.getElementById('voiceCallStatusText');
  const channelTitle = document.getElementById('voiceCallChannelTitle');
  const remoteName = document.getElementById('voiceRemoteName');
  const remoteAvatar = document.getElementById('voiceRemoteAvatar');
  const remoteStatus = document.getElementById('voiceRemoteStatus');

  const localName = document.getElementById('voiceLocalName');
  const localAvatar = document.getElementById('voiceLocalAvatar');
  const currentUser = getCurrentUser();

  if (channelTitle) channelTitle.textContent = currentCall.channelName;
  if (remoteName) remoteName.textContent = currentCall.partnerName;
  if (remoteAvatar) {
    applyAvatarToElement(remoteAvatar, {
      id: currentCall.partnerId,
      username: currentCall.partnerUsername || currentCall.partnerName,
      name: currentCall.partnerName,
      avatar_url: currentCall.partnerAvatar,
      recipient_avatar: currentCall.partnerAvatar
    });
  }

  if (localName && currentUser) localName.textContent = currentUser.display_name || currentUser.username;
  if (localAvatar && currentUser) applyAvatarToElement(localAvatar, currentUser);

  const timerEl = document.getElementById('voiceCallTimer');
  if (currentCall.state === 'calling') {
    if (statusText) statusText.textContent = 'Идёт вызов...';
    if (remoteStatus) remoteStatus.textContent = 'Гудки...';
    if (timerEl) timerEl.style.display = 'none';
  } else if (currentCall.state === 'connecting') {
    if (statusText) statusText.textContent = 'Подключение...';
    if (remoteStatus) remoteStatus.textContent = 'Соединение...';
    if (timerEl) timerEl.style.display = 'none';
  } else if (currentCall.state === 'connected') {
    if (statusText) statusText.textContent = 'Подключено';
    if (remoteStatus) remoteStatus.textContent = 'В сети';
    if (timerEl) timerEl.style.display = 'inline-block';
  }

  updateControlButtonsUI();
}

function updateControlButtonsUI() {
  if (!currentCall) return;

  // Кнопка микрофона
  const btnMic = document.getElementById('btnVoiceToggleMic');
  const btnFloatMic = document.getElementById('btnFloatingToggleMic');
  const localStatus = document.getElementById('voiceLocalStatus');

  if (btnMic) btnMic.classList.toggle('muted', !!currentCall.isMicMuted);
  if (btnFloatMic) btnFloatMic.classList.toggle('muted', !!currentCall.isMicMuted);
  if (localStatus) {
    localStatus.textContent = currentCall.isMicMuted ? 'Микрофон выключен' : 'Микрофон включен';
  }

  // Кнопка дефена
  const btnDeafen = document.getElementById('btnVoiceToggleDeafen');
  if (btnDeafen) btnDeafen.classList.toggle('muted', !!currentCall.isDeafened);

  // Бейджи на аватарах участников
  const localBadgeMuted = document.getElementById('voiceLocalBadgeMuted');
  const localBadgeDeaf = document.getElementById('voiceLocalBadgeDeafened');
  if (localBadgeMuted) localBadgeMuted.style.display = currentCall.isMicMuted ? 'flex' : 'none';
  if (localBadgeDeaf) localBadgeDeaf.style.display = currentCall.isDeafened ? 'flex' : 'none';

  const remoteBadgeMuted = document.getElementById('voiceRemoteBadgeMuted');
  const remoteBadgeDeaf = document.getElementById('voiceRemoteBadgeDeafened');
  if (remoteBadgeMuted) remoteBadgeMuted.style.display = currentCall.remoteIsMuted ? 'flex' : 'none';
  if (remoteBadgeDeaf) remoteBadgeDeaf.style.display = currentCall.remoteIsDeafened ? 'flex' : 'none';
}

export function showActiveCallOverlay() {
  const overlay = document.getElementById('activeCallOverlay');
  if (overlay) overlay.classList.remove('hidden');
  hideFloatingBar();
}

export function hideActiveCallOverlay() {
  const overlay = document.getElementById('activeCallOverlay');
  if (overlay) overlay.classList.add('hidden');
}

export function minimizeVoiceCall() {
  hideActiveCallOverlay();
  showFloatingBar();
}

function showFloatingBar() {
  if (!currentCall) return;
  const bar = document.getElementById('voiceFloatingBar');
  if (bar) {
    bar.classList.remove('hidden');
    const floatTitle = document.getElementById('voiceFloatingTitle');
    if (floatTitle) floatTitle.textContent = currentCall.partnerName;
  }
}

function hideFloatingBar() {
  const bar = document.getElementById('voiceFloatingBar');
  if (bar) bar.classList.add('hidden');
}

function showIncomingCallModal(callerName, avatarUrl, callerId = '', callerUsername = '') {
  const modal = document.getElementById('incomingCallModal');
  const uEl = document.getElementById('incomingCallUsername');
  const aEl = document.getElementById('incomingCallAvatar');
  if (uEl) uEl.textContent = callerName;
  if (aEl) {
    applyAvatarToElement(aEl, {
      id: callerId,
      username: callerUsername || callerName,
      name: callerName,
      avatar_url: avatarUrl,
      recipient_avatar: avatarUrl
    });
  }
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('active');
  }
}

function hideIncomingCallModal() {
  const modal = document.getElementById('incomingCallModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('active');
  }
}

function showCallNotification(msg) {
  try {
    const notifyBox = document.createElement('div');
    notifyBox.className = 'voice-call-toast';
    notifyBox.textContent = msg;
    document.body.appendChild(notifyBox);
    setTimeout(() => {
      notifyBox.classList.add('fade-out');
      setTimeout(() => notifyBox.remove(), 400);
    }, 2800);
  } catch (e) {}
}

// ==========================================================
// ИНИЦИАЛИЗАЦИЯ СЛУШАТЕЛЕЙ СОБЫТИЙ UI
// ==========================================================
export function initVoiceCallEvents() {
  // Кнопки входящего вызова
  const btnAccept = document.getElementById('btnAcceptIncomingCall');
  if (btnAccept) btnAccept.addEventListener('click', acceptIncomingCall);

  const btnDecline = document.getElementById('btnDeclineIncomingCall');
  if (btnDecline) btnDecline.addEventListener('click', declineIncomingCall);

  // Кнопки активного оверлея
  const btnEnd = document.getElementById('btnVoiceEndCall');
  if (btnEnd) btnEnd.addEventListener('click', () => endVoiceCall(true));

  const btnMic = document.getElementById('btnVoiceToggleMic');
  if (btnMic) btnMic.addEventListener('click', toggleMic);

  const btnDeafen = document.getElementById('btnVoiceToggleDeafen');
  if (btnDeafen) btnDeafen.addEventListener('click', toggleDeafen);

  const btnMinimize = document.getElementById('btnMinimizeVoiceCall');
  if (btnMinimize) btnMinimize.addEventListener('click', minimizeVoiceCall);

  // Кнопки плавающего бара
  const floatBar = document.getElementById('voiceFloatingBar');
  if (floatBar) {
    floatBar.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      showActiveCallOverlay();
    });
  }

  const btnFloatEnd = document.getElementById('btnFloatingEndCall');
  if (btnFloatEnd) btnFloatEnd.addEventListener('click', (e) => {
    e.stopPropagation();
    endVoiceCall(true);
  });

  const btnFloatMic = document.getElementById('btnFloatingToggleMic');
  if (btnFloatMic) btnFloatMic.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMic();
  });

  const btnRestore = document.getElementById('btnRestoreVoiceCall');
  if (btnRestore) {
    btnRestore.addEventListener('click', (e) => {
      e.stopPropagation();
      showActiveCallOverlay();
    });
  }
}
