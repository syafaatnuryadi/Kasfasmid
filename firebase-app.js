(function () {
  const config = window.FIREBASE_CONFIG || {};
  const hasFirebaseSdk = typeof window.firebase !== 'undefined';
  const hasValidConfig = !!config.apiKey && !!config.projectId && !!config.appId && !!config.authDomain;

  if (!hasValidConfig) {
    console.warn('[Firebase] Config tidak valid atau belum diisi. Pastikan firebase-config.js berisi config asli dari Firebase Console.');
  }

  if (hasFirebaseSdk && hasValidConfig && !firebase.apps.length) {
    firebase.initializeApp(config);
  }

  const auth = hasFirebaseSdk && hasValidConfig ? firebase.auth() : null;
  const db = hasFirebaseSdk && hasValidConfig ? firebase.firestore() : null;

  const normalizeNumber = (value) => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };

  const getCurrentBase = () => {
    const path = window.location.pathname;
    if (path.includes('/admin/')) return '../';
    if (path.includes('/login/')) return '../';
    if (path.includes('/register/')) return '../';
    return './';
  };

  window.LaporanKeuFirebase = {
    auth,
    db,
    isReady: !!auth && !!db,
    hasValidConfig,
    config,

    getBaseUrl() {
      return getCurrentBase();
    },

    async register(email, password) {
      if (!this.hasValidConfig) {
        throw new Error('Firebase config tidak valid. Salin konfigurasi asli dari Firebase Console ke firebase-config.js.');
      }
      if (!this.isReady) throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');
      return auth.createUserWithEmailAndPassword(email, password);
    },

    async login(email, password) {
      if (!this.hasValidConfig) {
        throw new Error('Firebase config tidak valid. Salin konfigurasi asli dari Firebase Console ke firebase-config.js.');
      }
      if (!this.isReady) throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');
      return auth.signInWithEmailAndPassword(email, password);
    },

    async logout() {
      if (!this.isReady) return;
      return auth.signOut();
    },

    async saveReport(payload) {
      if (!this.isReady) throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');

      const report = {
        ...payload,
        debit: normalizeNumber(payload.debit),
        credit: normalizeNumber(payload.credit),
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        createdBy: auth.currentUser ? auth.currentUser.uid : 'anonymous'
      };

      return db.collection('reports').add(report);
    },

    async loadReports() {
      if (!this.isReady) return [];
      const snapshot = await db.collection('reports').orderBy('createdAt', 'desc').get();
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    },

    async loadPublicSummary() {
      if (!this.isReady) return { totalDebit: 0, totalCredit: 0, netProfit: 0, entries: [] };
      const reports = await this.loadReports();
      const totalDebit = reports.reduce((sum, item) => sum + normalizeNumber(item.debit), 0);
      const totalCredit = reports.reduce((sum, item) => sum + normalizeNumber(item.credit), 0);
      const netProfit = totalCredit - totalDebit;
      return {
        totalDebit,
        totalCredit,
        netProfit,
        entries: reports.slice(0, 8)
      };
    }
  };
})();
