window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAnyaMJ4ukJm_nMmEaaLG98Fb9-kc9esMA",
  authDomain: "kasfaimid.firebaseapp.com",
  projectId: "kasfaimid",
  storageBucket: "kasfaimid.firebasestorage.app",
  messagingSenderId: "230441869228",
  appId: "1:230441869228:web:50260966ad83f0d9512409"
};

window.FIREBASE_CONFIG_INFO = {
  source: "Firebase Console",
  note: "Jika login/register masih gagal, pastikan projectId, apiKey, dan authDomain sesuai dengan project Firebase yang aktif."
};

if (!window.FIREBASE_CONFIG.apiKey || !window.FIREBASE_CONFIG.projectId || !window.FIREBASE_CONFIG.appId) {
  console.warn('[Firebase] Config belum valid. Salin konfigurasi asli dari Firebase Console ke firebase-config.js.');
}
