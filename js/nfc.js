/**
 * Sharada Messenger - NFC Discovery & Fast Pairing Module
 */
import { getCurrentUser } from './api.js';
import { createDirectChat } from './chats.js';

const nfcFullscreenScreen = document.getElementById('nfcFullscreenScreen');
const btnCloseNFCFullscreen = document.getElementById('btnCloseNFCFullscreen');
const btnActionNFC = document.getElementById('btnActionNFC');

let nfcAbortCtrl = null;

export function initNFC() {
  const isNfcSupported = 'NDEFReader' in window;
  if (btnActionNFC) {
    btnActionNFC.style.display = isNfcSupported ? 'flex' : 'none';
    btnActionNFC.addEventListener('click', () => {
      const newChatModal = document.getElementById('newChatModal');
      if (newChatModal) newChatModal.classList.remove('active');
      if (nfcFullscreenScreen) nfcFullscreenScreen.classList.add('active');
      startNfcSession();
    });
  }

  if (btnCloseNFCFullscreen) {
    btnCloseNFCFullscreen.addEventListener('click', () => {
      if (nfcFullscreenScreen) nfcFullscreenScreen.classList.remove('active');
      stopNfcSession();
    });
  }
}

export async function startNfcSession() {
  if (!('NDEFReader' in window)) return;
  try {
    nfcAbortCtrl = new AbortController();
    const ndef = new NDEFReader();
    await ndef.scan({ signal: nfcAbortCtrl.signal });

    ndef.onreading = async (event) => {
      const decoder = new TextDecoder();
      let peerUsername = '';
      for (const record of event.message.records) {
        peerUsername = decoder.decode(record.data);
      }
      const currentUser = getCurrentUser();
      if (peerUsername && peerUsername !== currentUser?.username) {
        if (nfcFullscreenScreen) nfcFullscreenScreen.classList.remove('active');
        createDirectChat(peerUsername, false);
      }
    };

    const currentUser = getCurrentUser();
    if (currentUser?.username) {
      await ndef.write(currentUser.username, { signal: nfcAbortCtrl.signal });
    }
  } catch (e) {
    console.log('NFC error or aborted', e);
  }
}

export function stopNfcSession() {
  if (nfcAbortCtrl) {
    nfcAbortCtrl.abort();
    nfcAbortCtrl = null;
  }
}
