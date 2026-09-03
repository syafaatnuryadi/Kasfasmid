(function () {
  const config = window.FIREBASE_CONFIG || {};
  const firebaseLib = typeof window !== 'undefined' ? window.firebase : null;
  const hasFirebaseSdk = !!firebaseLib && typeof firebaseLib.initializeApp === 'function';
  const hasValidConfig = !!config.apiKey && !!config.projectId && !!config.appId && !!config.authDomain;

  if (!hasValidConfig) {
    console.warn('[Firebase] Config tidak valid atau belum diisi. Pastikan firebase-config.js berisi config asli dari Firebase Console.');
  }

  if (hasFirebaseSdk && hasValidConfig && !firebaseLib.apps.length) {
    firebaseLib.initializeApp(config);
  }

  const auth = hasFirebaseSdk && hasValidConfig && firebaseLib.auth ? firebaseLib.auth() : null;
  const db = hasFirebaseSdk && hasValidConfig && firebaseLib.firestore ? firebaseLib.firestore() : null;

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

  const getCurrentCompanyId = (fallback = 'default') => {
    try {
      const params = new URLSearchParams(window.location.search);
      const companyId = params.get('company');
      if (companyId && companyId.trim()) {
        return companyId.trim();
      }
    } catch (error) {
      console.warn('[Firebase] Gagal membaca company dari URL:', error);
    }
    return fallback;
  };

  const getServerTimestamp = () => {
    if (firebaseLib && firebaseLib.firestore && firebaseLib.firestore.FieldValue && firebaseLib.firestore.FieldValue.serverTimestamp) {
      return firebaseLib.firestore.FieldValue.serverTimestamp();
    }
    return new Date();
  };

  const normalizeCompanyId = (value, fallback = 'default') => {
    const normalized = (value === undefined || value === null ? '' : String(value)).trim();
    return normalized || fallback;
  };

  const getTimestampValue = (value) => {
    if (!value) return 0;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
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
      if (!this.isReady || !auth || !auth.createUserWithEmailAndPassword) {
        throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');
      }
      return auth.createUserWithEmailAndPassword(email, password);
    },

    async login(email, password) {
      if (!this.hasValidConfig) {
        throw new Error('Firebase config tidak valid. Salin konfigurasi asli dari Firebase Console ke firebase-config.js.');
      }
      if (!this.isReady || !auth || !auth.signInWithEmailAndPassword) {
        throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');
      }
      return auth.signInWithEmailAndPassword(email, password);
    },

    async logout() {
      if (!this.isReady || !auth || !auth.signOut) return;
      return auth.signOut();
    },

    async saveReport(payload, companyId = getCurrentCompanyId()) {
      if (!this.isReady || !db || !db.collection) {
        throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');
      }

      const resolvedCompanyId = normalizeCompanyId((payload && payload.companyId) || companyId, 'default');

      const report = {
        ...payload,
        companyId: resolvedCompanyId,
        debit: normalizeNumber(payload.debit),
        credit: normalizeNumber(payload.credit),
        createdAt: getServerTimestamp(),
        updatedAt: getServerTimestamp(),
        createdBy: auth && auth.currentUser ? auth.currentUser.uid : 'anonymous'
      };

      return db.collection('reports').add(report);
    },

    async updateReport(reportId, payload, companyId = getCurrentCompanyId()) {
      if (!reportId) {
        throw new Error('ID laporan wajib ada untuk proses update.');
      }
      if (!this.isReady || !db || !db.collection) {
        throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');
      }

      const resolvedCompanyId = normalizeCompanyId((payload && payload.companyId) || companyId, 'default');
      const report = {
        ...payload,
        companyId: resolvedCompanyId,
        debit: normalizeNumber(payload.debit),
        credit: normalizeNumber(payload.credit),
        updatedAt: getServerTimestamp(),
        updatedBy: auth && auth.currentUser ? auth.currentUser.uid : 'anonymous'
      };

      delete report.id;
      return db.collection('reports').doc(reportId).update(report);
    },

    async deleteReport(reportId) {
      if (!reportId) {
        throw new Error('ID laporan wajib ada untuk proses hapus.');
      }
      if (!this.isReady || !db || !db.collection) {
        throw new Error('Firebase belum siap. Pastikan konfigurasi Firebase dimuat dengan benar.');
      }

      return db.collection('reports').doc(reportId).delete();
    },

    async loadReports(companyId = getCurrentCompanyId()) {
      if (!this.isReady || !db || !db.collection) return [];
      try {
        const snapshot = await db.collection('reports').get();
        const rows = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const targetCompany = normalizeCompanyId(companyId, 'default');

        const filtered = targetCompany === 'all'
          ? rows
          : rows.filter((item) => {
              const itemCompany = normalizeCompanyId(item.companyId, 'default');
              return itemCompany === targetCompany || (!item.companyId && targetCompany === 'default');
            });

        return filtered.sort((a, b) => getTimestampValue(b.createdAt) - getTimestampValue(a.createdAt));
      } catch (error) {
        console.error('[Firebase] Gagal membaca laporan:', error);
        return [];
      }
    },

    async loadPublicSummary(companyId = getCurrentCompanyId()) {
      if (!this.isReady) return { totalDebit: 0, totalCredit: 0, netProfit: 0, entries: [] };
      const reports = await this.loadReports(companyId);
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
