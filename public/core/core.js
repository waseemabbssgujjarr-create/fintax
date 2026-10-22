/*! FinTax core 1.0
 * Business logic shared by the in-browser preview and the Node server.
 * One module, two runtimes: every permission and tenancy check lives here,
 * so the server and the preview always behave the same way.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FinTaxCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VERSION = '1.0.0';
  const DAY = 86400000;
  const PKT_OFFSET = 5 * 3600000; // Pakistan Standard Time, UTC+5, no DST
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  class FtError extends Error {
    constructor(message, status, code) {
      super(message);
      this.name = 'FtError';
      this.status = status || 400;
      this.code = code || ({ 401: 'auth', 402: 'payment_required', 403: 'forbidden', 404: 'not_found', 409: 'conflict' })[this.status] || 'bad_request';
    }
  }
  function fail(message, status, code) { throw new FtError(message, status, code); }

  /* ------------------------------------------------------------------ utils */
  const pad = (n, w) => String(n).padStart(w || 2, '0');
  const U = {
    DAY, MONTHS, pad,
    pktDate(ms) { return new Date((ms == null ? Date.now() : ms) + PKT_OFFSET).toISOString().slice(0, 10); },
    iso(ms) { return new Date(ms == null ? Date.now() : ms).toISOString(); },
    parseDay(ds) { return Date.parse(ds + 'T00:00:00Z'); },
    addDays(ds, n) { const d = new Date(ds + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); },
    addMonths(ds, n) {
      const y = +ds.slice(0, 4), m = +ds.slice(5, 7) - 1 + n, d = +ds.slice(8, 10);
      const ny = y + Math.floor(m / 12), nm = ((m % 12) + 12) % 12;
      const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
      return ny + '-' + pad(nm + 1) + '-' + pad(Math.min(d, last));
    },
    addMonthsIso(isoStr, n) { const d = new Date(isoStr); const day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + n); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d.toISOString(); },
    diffDays(a, b) { return Math.round((U.parseDay(a) - U.parseDay(b)) / DAY); },
    ymd(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); },
    lastDay(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); },
    taxYearOf(ds) { const y = +ds.slice(0, 4), m = +ds.slice(5, 7); return m >= 7 ? y + 1 : y; },
    monthKey(ds) { return String(ds || '').slice(0, 7); },
    monthLabel(key) { const y = key.slice(0, 4), m = +key.slice(5, 7); return MONTHS[m - 1] + ' ' + y; },
    periodLabel(period, taxYear) {
      if (!period) return taxYear ? 'Tax Year ' + taxYear : '';
      let m = /^(\d{4})-(\d{2})$/.exec(period);
      if (m) return MONTHS[+m[2] - 1] + ' ' + m[1];
      m = /^(\d{4})-Q([1-4])$/.exec(period);
      if (m) { const q = +m[2]; return MONTHS[(q - 1) * 3] + '–' + MONTHS[(q - 1) * 3 + 2] + ' ' + m[1]; }
      return period;
    },
    clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); },
    round2(n) { return Math.round((+n || 0) * 100) / 100; },
    sum(arr, fn) { let t = 0; for (const x of arr) t += +(fn ? fn(x) : x) || 0; return Math.round(t * 100) / 100; },
    by(key, dir) { dir = dir || 1; return (a, b) => { const x = typeof key === 'function' ? key(a) : a[key]; const y = typeof key === 'function' ? key(b) : b[key]; return (x > y ? 1 : x < y ? -1 : 0) * dir; }; },
    deepMerge(base, extra) {
      if (extra === undefined) return U.clone(base);
      if (Array.isArray(extra) || extra === null || typeof extra !== 'object') return U.clone(extra);
      const out = (base && typeof base === 'object' && !Array.isArray(base)) ? U.clone(base) : {};
      for (const k of Object.keys(extra)) out[k] = (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) && extra[k] && typeof extra[k] === 'object' && !Array.isArray(extra[k])) ? U.deepMerge(out[k], extra[k]) : U.clone(extra[k]);
      return out;
    },
    initials(name) { const p = String(name || '?').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); },
    digits(s) { return String(s || '').replace(/\D/g, ''); },
    waNumber(phone) {
      let d = U.digits(phone);
      if (!d) return '';
      if (d.startsWith('0092')) d = d.slice(2);
      else if (d.startsWith('0')) d = '92' + d.slice(1);
      else if (d.length === 10 && d.startsWith('3')) d = '92' + d;
      return d;
    },
  };

  /* ------------------------------------------------------------- validation */
  const V = {
    str(v, max) { return v == null ? '' : String(v).trim().slice(0, max || 300); },
    text(v, max) { return v == null ? '' : String(v).replace(/\r\n/g, '\n').trim().slice(0, max || 5000); },
    req(v, label, max) { const s = V.str(v, max); if (!s) fail(label + ' is required.'); return s; },
    email(v, required) {
      const s = V.str(v, 160).toLowerCase();
      if (!s) { if (required) fail('Email is required.'); return ''; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) fail('Enter a valid email address.');
      return s;
    },
    phone(v) { return V.str(v, 30).replace(/[^\d+\s-]/g, ''); },
    num(v, def) { const n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/[, ]/g, '')); return isFinite(n) ? n : (def === undefined ? 0 : def); },
    money(v) { return Math.max(0, U.round2(V.num(v))); },
    int(v, def) { return Math.round(V.num(v, def)); },
    date(v) { const s = V.str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''; },
    bool(v) { return v === true || v === 'true' || v === 'on' || v === 1 || v === '1' || v === 'yes'; },
    oneOf(v, list, def) { return list.indexOf(v) >= 0 ? v : def; },
    arr(v) { return Array.isArray(v) ? v : (v == null || v === '' ? [] : [v]); },
    password(v) { const s = v == null ? '' : String(v); if (s.length < 6) fail('Use at least 6 characters for the password.'); if (s.length > 200) fail('That password is too long.'); return s; },
    limit(v) { if (v === null || v === '' || v === undefined) return null; const n = V.int(v, 0); return n <= 0 ? null : n; },
  };

  /* -------------------------------------------------------------- constants */
  const C = {
    FILING_TYPES: [
      { id: 'itr', label: 'Income tax return', short: 'Income tax', authority: 'FBR', cadence: 'annual' },
      { id: 'wealth', label: 'Wealth statement', short: 'Wealth', authority: 'FBR', cadence: 'annual' },
      { id: 'stx', label: 'Sales tax return', short: 'Sales tax', authority: 'FBR', cadence: 'monthly' },
      { id: 'pst', label: 'Sales tax on services return', short: 'Services tax', authority: 'PRA', cadence: 'monthly' },
      { id: 'wht', label: 'Withholding statement (s.165)', short: 'Withholding', authority: 'FBR', cadence: 'quarterly' },
      { id: 'advance', label: 'Advance tax (s.147)', short: 'Advance tax', authority: 'FBR', cadence: 'quarterly' },
      { id: 'registration', label: 'Registration or NTN', short: 'Registration', authority: 'FBR', cadence: 'once' },
      { id: 'other', label: 'Other engagement', short: 'Other', authority: 'FBR', cadence: 'once' },
    ],
    STAGES: [
      { id: 'not_started', label: 'Not started' },
      { id: 'awaiting_docs', label: 'Awaiting documents' },
      { id: 'in_progress', label: 'In preparation' },
      { id: 'review', label: 'Internal review' },
      { id: 'client_approval', label: 'Client approval' },
      { id: 'ready', label: 'Ready to file' },
      { id: 'filed', label: 'Filed' },
    ],
    NOTICE_STATUS: [
      { id: 'received', label: 'Received' },
      { id: 'in_progress', label: 'Preparing reply' },
      { id: 'responded', label: 'Reply submitted' },
      { id: 'hearing', label: 'Hearing scheduled' },
      { id: 'closed', label: 'Closed' },
    ],
    NOTICE_SECTIONS: [
      { id: '114(4)', label: 's.114(4) Notice to file return' },
      { id: '116', label: 's.116 Wealth statement' },
      { id: '122(5A)', label: 's.122(5A) Amendment of assessment' },
      { id: '122(9)', label: 's.122(9) Show cause before amendment' },
      { id: '176', label: 's.176 Information or records' },
      { id: '177', label: 's.177 Audit selection' },
      { id: '137', label: 's.137 Demand notice' },
      { id: '138', label: 's.138 Recovery proceedings' },
      { id: '182', label: 's.182 Penalty' },
      { id: 'ST-11', label: 'Sales Tax Act s.11 Assessment' },
      { id: 'ST-25', label: 'Sales Tax Act s.25 Audit' },
      { id: 'PST', label: 'Provincial authority notice' },
      { id: 'other', label: 'Other notice' },
    ],
    DOC_CATEGORIES: ['CNIC or identity', 'Salary certificate', 'Bank statement', 'Bank profit or WHT certificate', 'Utility bills', 'Property documents', 'Vehicle documents', 'Sales invoices', 'Purchase records', 'Financial statements', 'Tax return', 'Wealth statement', 'Challan or CPR', 'FBR notice', 'Notice reply', 'Agreement or contract', 'Other'],
    AUTHORITIES: ['FBR', 'PRA', 'SRB', 'KPRA', 'BRA'],
    CLIENT_TYPES: [{ id: 'individual', label: 'Individual' }, { id: 'aop', label: 'AOP or firm' }, { id: 'company', label: 'Company' }],
    PROFILES: [
      { id: 'salaried', label: 'Salaried' }, { id: 'business', label: 'Business' }, { id: 'professional', label: 'Professional' },
      { id: 'rental', label: 'Rental income' }, { id: 'freelancer', label: 'Freelancer or IT exports' }, { id: 'pensioner', label: 'Pensioner' },
      { id: 'overseas', label: 'Overseas Pakistani' }, { id: 'other', label: 'Other' },
    ],
    PAY_METHODS: ['Bank transfer', 'Raast', 'JazzCash', 'Easypaisa', 'Cash', 'Cheque', 'Other'],
    EXPENSE_CATEGORIES: ['Office rent', 'Salaries', 'Utilities', 'Software and subscriptions', 'Travel', 'Marketing', 'Printing and stationery', 'Fees and challans', 'Other'],
    VAULT_PORTALS: ['FBR IRIS', 'PRA e-portal', 'SRB e-services', 'KPRA e-portal', 'BRA e-portal', 'SECP eServices', 'Other portal'],
    PRIORITIES: [{ id: 'low', label: 'Low' }, { id: 'normal', label: 'Normal' }, { id: 'high', label: 'High' }, { id: 'urgent', label: 'Urgent' }],
    LEAD_STATUS: [{ id: 'new', label: 'New' }, { id: 'contacted', label: 'Contacted' }, { id: 'demo', label: 'Demo booked' }, { id: 'won', label: 'Converted' }, { id: 'lost', label: 'Not interested' }],
    FEE_BASIS: [{ id: 'annual', label: 'Annual retainer' }, { id: 'monthly', label: 'Monthly retainer' }, { id: 'per_filing', label: 'Per filing' }, { id: 'hourly', label: 'Hourly' }],
    CITIES: ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad', 'Abbottabad', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Other'],
  };
  const label = (list, id) => { const f = list.find((x) => x.id === id); return f ? f.label : (id || ''); };
  C.stageLabel = (id) => label(C.STAGES, id);
  C.filingLabel = (id) => label(C.FILING_TYPES, id);
  C.noticeStatusLabel = (id) => label(C.NOTICE_STATUS, id);
  C.sectionLabel = (id) => label(C.NOTICE_SECTIONS, id);
  C.clientTypeLabel = (id) => label(C.CLIENT_TYPES, id);
  C.profileLabel = (id) => label(C.PROFILES, id);

  const COLLECTIONS = ['users', 'firms', 'plans', 'settings', 'clients', 'docs', 'requests', 'comments', 'filings', 'notices', 'tasks', 'invoices', 'payments', 'expenses', 'messages', 'vault', 'events', 'notifications', 'activity', 'leads', 'tickets', 'announcements', 'testimonials', 'faqs', 'subPayments', 'resets'];
  const PREFIX = { users: 'usr', firms: 'frm', plans: 'pln', settings: 'set', clients: 'cli', docs: 'doc', requests: 'req', comments: 'cmt', filings: 'fil', notices: 'ntc', tasks: 'tsk', invoices: 'inv', payments: 'pay', expenses: 'exp', messages: 'msg', vault: 'vlt', events: 'evt', notifications: 'ntf', activity: 'act', leads: 'led', tickets: 'tkt', announcements: 'ann', testimonials: 'tst', faqs: 'faq', subPayments: 'spy', resets: 'rst' };

  /* ------------------------------------------------------------ memory store */
  class MemoryStore {
    constructor(data) { this.data = {}; this.cache = {}; this.listeners = []; if (data) this.load(data); }
    load(data) {
      this.data = {}; this.cache = {};
      for (const c of Object.keys(data || {})) {
        this.data[c] = {};
        const rows = Array.isArray(data[c]) ? data[c] : Object.values(data[c]);
        for (const d of rows) if (d && d.id) this.data[c][d.id] = d;
      }
    }
    coll(c) { return this.data[c] || (this.data[c] = {}); }
    all(c) { return this.cache[c] || (this.cache[c] = Object.values(this.coll(c))); }
    get(c, id) { return id == null ? null : (this.coll(c)[id] || null); }
    put(c, doc) { this.coll(c)[doc.id] = doc; delete this.cache[c]; this.emit(c, doc.id, doc); return doc; }
    del(c, id) { const had = !!this.coll(c)[id]; delete this.coll(c)[id]; delete this.cache[c]; if (had) this.emit(c, id, null); return had; }
    on(fn) { this.listeners.push(fn); }
    emit(c, id, doc) { for (const fn of this.listeners) { try { fn(c, id, doc); } catch (e) { /* listener errors never break writes */ } } }
    dump() { const out = {}; for (const c of Object.keys(this.data)) out[c] = Object.values(this.data[c]); return out; }
  }

  /* --------------------------------------------------- preview-grade crypto */
  const K256 = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256Hex(message) {
    const bytes = new TextEncoder().encode(String(message));
    const l = bytes.length;
    const total = ((l + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes); buf[l] = 0x80;
    const dv = new DataView(buf.buffer);
    const bits = l * 8;
    dv.setUint32(total - 4, bits >>> 0);
    dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const w = new Uint32Array(64);
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = ror(w[i - 15], 7) ^ ror(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = ror(w[i - 2], 17) ^ ror(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }
    return H.map((x) => x.toString(16).padStart(8, '0')).join('');
  }
  function b64encode(str) {
    const bytes = new TextEncoder().encode(String(str));
    let bin = ''; for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64decode(b64) {
    const bin = atob(b64); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function defaultRandom(n) {
    const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
    let out = '';
    const g = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(n)) : null;
    for (let i = 0; i < n; i++) out += chars[(g ? g[i] : Math.floor(Math.random() * 256)) % chars.length];
    return out;
  }
  const previewHasher = {
    hash(pw) { const salt = defaultRandom(12); let h = salt + ':' + pw; for (let i = 0; i < 300; i++) h = sha256Hex(h); return 'ps256$' + salt + '$' + h; },
    verify(pw, stored) {
      const parts = String(stored || '').split('$');
      if (parts[0] !== 'ps256' || parts.length !== 3) return false;
      let h = parts[1] + ':' + pw; for (let i = 0; i < 300; i++) h = sha256Hex(h);
      return h === parts[2];
    },
  };
  const previewCipher = {
    encrypt(s) { return s ? 'p1:' + b64encode(s) : ''; },
    decrypt(s) { if (!s) return ''; if (String(s).startsWith('p1:')) return b64decode(String(s).slice(3)); return String(s); },
  };

  /* --------------------------------------------------------------- defaults */
  function defaultPlans() {
    return [
      {
        id: 'practice', order: 1, name: 'Practice', tagline: 'For independent consultants getting their practice in order.',
        monthly: 3499, annual: 34990, badge: '', highlight: false, visible: true, cta: 'Start free trial',
        limits: { clients: 150, team: 2, storageGB: 10 },
        features: { portal: true, vault: false, advancedReports: false, bulk: false, branding: false },
        bullets: ['Up to 150 active clients', '2 team logins', 'Client portal for uploads, approvals and messages', 'Filing tracker and compliance calendar', 'Notice tracker with hearing reminders', 'Invoices and receivables in PKR', '10 GB document storage'],
      },
      {
        id: 'firm', order: 2, name: 'Firm Pro', tagline: 'For growing practices that run a team through tax season.',
        monthly: 7999, annual: 79990, badge: 'Most popular', highlight: true, visible: true, cta: 'Start free trial',
        limits: { clients: null, team: 10, storageGB: 100 },
        features: { portal: true, vault: true, advancedReports: true, bulk: true, branding: true },
        bullets: ['Unlimited clients', '10 team logins', 'Everything in Practice', 'Encrypted vault for IRIS, PRA and SRB logins', 'Bulk-create monthly returns for all registered clients', 'Receivables aging, staff workload and profit reports', 'Your logo on invoices and the client portal', '100 GB document storage', 'Priority support'],
      },
    ];
  }
  function defaultSettings(nowMs) {
    const t = nowMs || Date.now();
    return {
      site: {
        brandName: 'FinTax', tagline: 'Practice ERP for tax consultants', logo: '', icon192: '', icon512: '', primary: '#0E7A4F',
        announcement: { enabled: true, text: 'Founding member pricing is open. Your price stays locked for as long as you stay subscribed.' },
        hero: {
          headline: 'Clients upload. You file. Nothing slips.',
          sub: 'FinTax is the practice ERP for tax consultants in Pakistan. Collect documents through a client portal, track every return and notice against FBR and provincial deadlines, and bill your fees in PKR.',
          urdu: 'آپ کی ٹیکس پریکٹس، ایک ہی جگہ',
          ctaPrimary: 'Start free trial', ctaSecondary: 'See pricing',
        },
        offer: { enabled: true, title: 'Founding member pricing', seats: 100, startAt: U.iso(t - 20 * DAY), deadline: U.iso(t + 30 * DAY), note: 'Your price stays the same for as long as your subscription stays active.' },
        featuredDeadline: { enabled: true, title: 'Income tax returns, Tax Year 2026 (extended)', date: '2026-10-31', note: 'Extended by FBR circular' },
        proof: { liveSignups: true, stats: true, statsMin: 25 },
        contact: { email: '', phone: '', whatsapp: '', address: '', hours: '' },
        social: { facebook: '', instagram: '', linkedin: '', youtube: '' },
        guarantee: 'Use every feature free for {trialDays} days. No card needed. Export your data whenever you like.',
        footerNote: 'FinTax is independent practice software. It is not affiliated with FBR or any provincial revenue authority.',
      },
      payment: {
        bankName: '', accountTitle: '', accountNumber: '', iban: '', raast: '', jazzcash: '', easypaisa: '',
        instructions: 'Send the amount by any method below, then submit the transaction ID. We verify payments and activate your plan, usually within a few working hours.',
      },
      system: {
        trialDays: 14, allowSignups: true, defaultPlan: 'practice', supportEmail: '', maintenance: '',
        rules: [
          { id: 'fbr-stx', title: 'FBR sales tax return', authority: 'FBR', kind: 'monthly', day: 18, enabled: true, note: 'Tax payment is due by the 15th.' },
          { id: 'fbr-stx-pay', title: 'FBR sales tax payment', authority: 'FBR', kind: 'monthly', day: 15, enabled: true, note: '' },
          { id: 'pra', title: 'PRA services return', authority: 'PRA', kind: 'monthly', day: 18, enabled: true, note: 'Payment is due by the 15th.' },
          { id: 'srb', title: 'SRB services return', authority: 'SRB', kind: 'monthly', day: 18, enabled: false, note: 'Confirm the current SRB due date before turning this on.' },
          { id: 'kpra', title: 'KPRA services return', authority: 'KPRA', kind: 'monthly', day: 15, enabled: false, note: 'Confirm the current KPRA due date before turning this on.' },
          { id: 'bra', title: 'BRA services return', authority: 'BRA', kind: 'monthly', day: 15, enabled: false, note: 'Confirm the current BRA due date before turning this on.' },
          { id: 'wht', title: 'Withholding statement (s.165)', authority: 'FBR', kind: 'quarterly', months: [1, 4, 7, 10], day: 20, enabled: true, note: 'Quarterly statement for tax deducted.' },
          { id: 'adv-ind', title: 'Advance tax instalment, individuals (s.147)', authority: 'FBR', kind: 'dates', dates: ['09-15', '12-15', '03-15', '06-15'], enabled: true, note: '' },
          { id: 'adv-co', title: 'Advance tax instalment, companies and AOPs (s.147)', authority: 'FBR', kind: 'dates', dates: ['09-25', '12-25', '03-25', '06-15'], enabled: true, note: '' },
          { id: 'itr-ind', title: 'Income tax returns, individuals and AOPs', authority: 'FBR', kind: 'yearly', date: '09-30', enabled: true, note: 'Check for FBR extensions each season.' },
          { id: 'itr-co', title: 'Income tax returns, companies', authority: 'FBR', kind: 'yearly', date: '12-31', enabled: true, note: 'For companies with a tax year ending 30 June.' },
        ],
      },
      tax: {
        note: 'Estimates only. Excludes tax credits, reductions and final or fixed tax regimes. Confirm against the current Finance Act.',
        years: [
          { year: 2027, label: 'Tax Year 2027 (Jul 2026 to Jun 2027)', salaried: [[600000, 0], [1200000, 1], [2200000, 11], [3200000, 20], [4100000, 25], [5600000, 29], [7000000, 32], [null, 35]], salariedSurcharge: { above: 0, rate: 0 }, business: [[600000, 0], [1200000, 15], [1600000, 20], [3200000, 30], [5600000, 40], [null, 45]], businessSurcharge: { above: 10000000, rate: 10 } },
          { year: 2026, label: 'Tax Year 2026 (Jul 2025 to Jun 2026)', salaried: [[600000, 0], [1200000, 1], [2200000, 11], [3200000, 23], [4100000, 30], [null, 35]], salariedSurcharge: { above: 10000000, rate: 9 }, business: [[600000, 0], [1200000, 15], [1600000, 20], [3200000, 30], [5600000, 40], [null, 45]], businessSurcharge: { above: 10000000, rate: 10 } },
        ],
      },
    };
  }
  function defaultFaqs() {
    return [
      { q: 'Does FinTax file returns on IRIS for me?', a: 'No. FinTax organizes everything around filing: documents, approvals, deadlines, notices and fees. You file on IRIS or the provincial portal as usual, then record the acknowledgement number in FinTax so the client sees it.' },
      { q: 'Can my clients use it on their phone?', a: 'Yes. Each client gets a login you create. They can upload photos or PDFs, approve drafts, leave feedback, check invoices and message you. FinTax installs on the home screen like an app.' },
      { q: 'Is my clients\' data safe?', a: 'Each practice\'s data is kept separate from every other practice. Passwords are stored as hashes, saved portal logins are encrypted, and only you can create client logins. You can export your data at any time.' },
      { q: 'How do I pay for my subscription?', a: 'Pay by bank transfer, Raast, JazzCash or Easypaisa and submit the transaction ID from your account. We verify it and activate your plan.' },
      { q: 'What happens when the free trial ends?', a: 'Pick a plan and submit payment. If you need more time, your data stays safe in read-only mode until you renew.' },
      { q: 'Can I bring my existing clients?', a: 'Yes. Upload a CSV with names, CNIC or NTN, phone and email, and FinTax creates the client profiles for you.' },
      { q: 'Can my team work in it too?', a: 'Yes. Add staff logins, assign clients, filings and tasks, and see who is working on what. Team size depends on your plan.' },
    ];
  }

  /* ------------------------------------------------------------------- core */
  function create(opts) {
    opts = opts || {};
    const store = opts.store || new MemoryStore();
    const hasher = opts.hasher || previewHasher;
    const cipher = opts.cipher || previewCipher;
    const now = opts.now || (() => Date.now());
    const preview = !!opts.preview;
    const randomId = opts.randomId || defaultRandom;

    const actions = {};
    const ANY = ['admin', 'consultant', 'staff', 'client'];
    const FIRM = ['consultant', 'staff'];
    const ADMIN = ['admin'];
    const CLIENT = ['client'];
    function def(name, roles, flags, fn) { actions[name] = { name, roles, flags: flags || {}, fn }; }

    const nowISO = () => U.iso(now());
    const today = () => U.pktDate(now());
    const nid = (c) => (PREFIX[c] || 'id') + '_' + now().toString(36).slice(-5) + randomId(7);
    function insert(c, doc) {
      const t = nowISO();
      const d = Object.assign({ id: doc.id || nid(c), createdAt: t, updatedAt: doc.createdAt || t }, doc);
      store.put(c, d);
      return d;
    }
    function patch(c, id, changes) {
      const cur = store.get(c, id);
      if (!cur) fail('That record no longer exists.', 404, 'not_found');
      const d = Object.assign({}, cur, changes, { updatedAt: nowISO() });
      store.put(c, d);
      return d;
    }
    const remove = (c, id) => store.del(c, id);
    const all = (c) => store.all(c);
    const genPassword = () => { const a = randomId(4), b = randomId(4); return a.charAt(0).toUpperCase() + a.slice(1) + '-' + b + '-' + (10 + Math.floor(Math.random() * 89)); };

    /* -------- settings & plans */
    function settings(section) {
      const defs = defaultSettings(now());
      const stored = store.get('settings', section);
      const base = defs[section] || {};
      const merged = stored ? U.deepMerge(base, stored.data || {}) : U.clone(base);
      return merged;
    }
    function saveSettings(section, data) {
      const cur = store.get('settings', section);
      const next = U.deepMerge(cur ? cur.data : {}, data || {});
      if (cur) patch('settings', section, { data: next }); else insert('settings', { id: section, data: next });
      return settings(section);
    }
    const plansSorted = () => all('plans').slice().sort(U.by('order'));
    const planOf = (firm) => store.get('plans', firm && firm.planId) || plansSorted()[0] || defaultPlans()[0];
    function planPublic(p) { if (!p) return null; const o = U.clone(p); return o; }

    function subscription(firm) {
      const t = now();
      let status = firm.subStatus || 'trial';
      const endsAt = status === 'trial' ? firm.trialEndsAt : firm.periodEnd;
      if ((status === 'trial' || status === 'active') && endsAt && Date.parse(endsAt) < t) status = 'expired';
      const daysLeft = endsAt ? Math.ceil((Date.parse(endsAt) - t) / DAY) : null;
      const pending = all('subPayments').find((p) => p.firmId === firm.id && p.status === 'pending');
      return { status, rawStatus: firm.subStatus, endsAt: endsAt || null, daysLeft, canWrite: status === 'trial' || status === 'active', planId: firm.planId, cycle: firm.cycle || 'monthly', pendingPaymentId: pending ? pending.id : null };
    }
    function usage(firmId) {
      const clients = all('clients').filter((c) => c.firmId === firmId && !c.archived).length;
      const team = all('users').filter((u) => u.firmId === firmId && (u.role === 'consultant' || u.role === 'staff') && u.status === 'active').length;
      const storageBytes = U.sum(all('docs').filter((d) => d.firmId === firmId), (d) => d.size || 0);
      return { clients, team, storageBytes };
    }

    /* -------- users */
    function publicUser(u) {
      if (!u) return null;
      return { id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone || '', title: u.title || '', firmId: u.firmId || null, clientId: u.clientId || null, status: u.status, lastLoginAt: u.lastLoginAt || null, createdAt: u.createdAt, impersonatedBy: u.impersonatedBy || null };
    }
    function findLogin(login) {
      const l = String(login || '').trim().toLowerCase();
      if (!l) return null;
      const d = U.digits(l);
      return all('users').find((u) => (u.email && u.email === l) || (!l.includes('@') && d.length >= 10 && U.digits(u.phone).slice(-10) === d.slice(-10))) || null;
    }
    function emailTaken(email, exceptId) { return !!email && all('users').some((u) => u.email === email && u.id !== exceptId); }
    const userName = (id) => { const u = store.get('users', id); return u ? u.name : ''; };

    /* -------- notifications & activity */
    function notify(userIds, n) {
      const ids = Array.from(new Set((userIds || []).filter(Boolean)));
      for (const uid of ids) insert('notifications', { userId: uid, title: V.str(n.title, 200), body: V.str(n.body, 400), link: n.link || '', kind: n.kind || 'info', read: false });
    }
    const firmTeamIds = (firmId, exceptId) => all('users').filter((u) => u.firmId === firmId && (u.role === 'consultant' || u.role === 'staff') && u.status === 'active' && u.id !== exceptId).map((u) => u.id);
    const adminIds = () => all('users').filter((u) => u.role === 'admin' && u.status === 'active').map((u) => u.id);
    const ownerOf = (firmId) => { const f = store.get('firms', firmId); return f ? f.ownerId : null; };
    function portalUser(client) {
      if (!client || !client.portalUserId) return null;
      const u = store.get('users', client.portalUserId);
      return u && u.status === 'active' ? u : null;
    }
    function log(ctx, action, summary, extra) {
      insert('activity', Object.assign({
        firmId: ctx.firm ? ctx.firm.id : null,
        userId: ctx.user ? ctx.user.id : null,
        userName: ctx.user ? ctx.user.name : 'System',
        role: ctx.user ? ctx.user.role : 'system',
        action, summary: V.str(summary, 300),
      }, extra || {}));
    }
    function brand() {
      const s = settings('site');
      return { name: s.brandName || 'FinTax', tagline: s.tagline, logo: s.logo || '', icon192: s.icon192 || '', primary: s.primary || '#0E7A4F' };
    }

    /* -------- context */
    function context(user) {
      const ctx = { user, t: now(), today: today() };
      if (user && user.firmId) {
        ctx.firm = store.get('firms', user.firmId);
        if (!ctx.firm) fail('This practice account no longer exists.', 401, 'no_firm');
        ctx.plan = planOf(ctx.firm);
        ctx.sub = subscription(ctx.firm);
        ctx.features = Object.assign({ portal: true }, ctx.plan.features || {});
      }
      if (user && user.role === 'client') {
        ctx.client = store.get('clients', user.clientId);
        if (!ctx.client) fail('Your client profile is no longer available.', 401, 'no_client');
      }
      ctx.isOwner = !!user && user.role === 'consultant';
      ctx.mine = (c, f) => all(c).filter((d) => d.firmId === ctx.firm.id && (!f || f(d)));
      ctx.own = (c, id) => { const d = store.get(c, id); if (!d || d.firmId !== ctx.firm.id) fail('That record was not found.', 404, 'not_found'); return d; };
      ctx.clientOwn = (c, id) => { const d = ctx.own(c, id); if (d.clientId !== ctx.client.id) fail('That record was not found.', 404, 'not_found'); return d; };
      return ctx;
    }
    function writableMsg(sub) {
      if (sub.status === 'suspended') return 'This practice account is suspended. Contact FinTax support to restore access.';
      return 'The subscription for this practice has ended, so the account is read-only. Renew from Subscription to continue.';
    }

    function exec(sessionUser, name, payload) {
      const a = actions[name];
      if (!a) fail('Unknown action: ' + name, 404, 'unknown_action');
      let user = null;
      if (a.roles !== 'public') {
        if (!sessionUser || !sessionUser.id) fail('Please sign in to continue.', 401, 'auth');
        user = store.get('users', sessionUser.id);
        if (!user || user.status !== 'active') fail('Your login is no longer active.', 401, 'auth');
        if (a.roles.indexOf(user.role) < 0) fail('You do not have access to this area.', 403, 'forbidden');
        if (sessionUser.impersonatedBy) user = Object.assign({}, user, { impersonatedBy: sessionUser.impersonatedBy });
      }
      const ctx = context(user);
      if (a.flags.owner && !ctx.isOwner) fail('Only the practice owner can do this.', 403, 'owner_only');
      if (a.flags.write && ctx.sub && !ctx.sub.canWrite) fail(writableMsg(ctx.sub), 402, 'read_only');
      if (a.flags.feature && ctx.features && !ctx.features[a.flags.feature]) fail('This feature is part of a higher plan. Upgrade from Subscription to use it.', 402, 'upgrade');
      const out = a.fn(ctx, payload || {});
      return U.clone(out === undefined ? { ok: true } : out);
    }

    /* =================================================================== *
     *  Compliance calendar
     * =================================================================== */
    function ruleOccurrences(rule, from, to) {
      const out = [];
      if (!rule || !rule.enabled) return out;
      const fy = +from.slice(0, 4), ty = +to.slice(0, 4);
      const push = (ds, forPeriod) => { if (ds >= from && ds <= to) out.push({ date: ds, title: rule.title, authority: rule.authority || 'FBR', ruleId: rule.id, note: rule.note || '', forPeriod: forPeriod || '' }); };
      for (let y = fy - 1; y <= ty + 1; y++) {
        if (rule.kind === 'monthly') {
          for (let m = 1; m <= 12; m++) {
            const ds = U.ymd(y, m, Math.min(V.int(rule.day, 15) || 15, U.lastDay(y, m)));
            const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
            push(ds, MONTHS[pm - 1] + ' ' + py);
          }
        } else if (rule.kind === 'quarterly') {
          for (const m of (rule.months || [1, 4, 7, 10])) {
            const ds = U.ymd(y, m, Math.min(V.int(rule.day, 20) || 20, U.lastDay(y, m)));
            const endM = m === 1 ? 12 : m - 1, qy = m === 1 ? y - 1 : y;
            const startM = endM - 2;
            push(ds, MONTHS[startM - 1] + '–' + MONTHS[endM - 1] + ' ' + qy);
          }
        } else if (rule.kind === 'dates') {
          for (const md of (rule.dates || [])) { const ds = y + '-' + md; push(ds, 'Tax Year ' + U.taxYearOf(ds)); }
        } else if (rule.kind === 'yearly' && rule.date) {
          push(y + '-' + rule.date, 'Tax Year ' + y);
        }
      }
      return out;
    }
    function complianceDeadlines(from, to) {
      const sys = settings('system');
      let out = [];
      for (const r of (sys.rules || [])) out = out.concat(ruleOccurrences(r, from, to));
      const fd = settings('site').featuredDeadline;
      if (fd && fd.enabled && fd.date && fd.date >= from && fd.date <= to) out.push({ date: fd.date, title: fd.title, authority: 'FBR', ruleId: 'featured', note: fd.note || '', forPeriod: '', featured: true });
      return out.sort(U.by('date'));
    }

    function taxCalc(p) {
      const tax = settings('tax');
      const yr = (tax.years || []).find((y) => String(y.year) === String(p.year)) || (tax.years || [])[0];
      if (!yr) return null;
      const type = p.type === 'business' ? 'business' : 'salaried';
      const slabs = yr[type] || [];
      const income = Math.max(0, V.num(p.income));
      let lower = 0, base = 0;
      const breakdown = [];
      for (const s of slabs) {
        const upper = s[0] == null ? Infinity : +s[0];
        const rate = +s[1] || 0;
        if (income > lower) {
          const portion = Math.min(income, upper) - lower;
          const amount = portion * rate / 100;
          breakdown.push({ from: lower, to: upper === Infinity ? null : upper, rate, portion, amount: U.round2(amount) });
          base += amount;
        }
        lower = upper;
        if (upper === Infinity) break;
      }
      const sc = yr[type + 'Surcharge'] || { above: 0, rate: 0 };
      const surcharge = (sc.rate && income > (+sc.above || 0)) ? base * sc.rate / 100 : 0;
      const total = base + surcharge;
      return { year: yr.year, label: yr.label, type, income, tax: Math.round(base), surcharge: Math.round(surcharge), total: Math.round(total), monthly: Math.round(total / 12), effective: income ? Math.round(total / income * 10000) / 100 : 0, breakdown };
    }

    /* =================================================================== *
     *  Computed views
     * =================================================================== */
    function invoiceCalc(inv, pays) {
      const items = inv.items || [];
      const subtotal = U.sum(items, (i) => V.num(i.qty, 1) * V.num(i.rate));
      const discount = Math.min(V.money(inv.discount), subtotal);
      const taxable = U.round2(subtotal - discount);
      const tax = U.round2(taxable * V.num(inv.taxRate) / 100);
      const total = U.round2(taxable + tax);
      const mine = pays.filter((p) => p.invoiceId === inv.id);
      const paid = U.sum(mine.filter((p) => p.status === 'confirmed'), (p) => p.amount);
      const pending = U.sum(mine.filter((p) => p.status === 'pending'), (p) => p.amount);
      const balance = U.round2(Math.max(0, total - paid));
      let status = inv.status || 'draft';
      if (status !== 'draft' && status !== 'cancelled') {
        if (balance <= 0 && total > 0) status = 'paid';
        else if (inv.dueDate && inv.dueDate < today()) status = 'overdue';
        else if (paid > 0) status = 'partial';
        else status = 'sent';
      }
      return { subtotal, discount, taxable, tax, total, paid, pending, balance, status };
    }
    function invoiceView(inv, pays, clientsById) {
      const c = clientsById ? clientsById[inv.clientId] : store.get('clients', inv.clientId);
      return Object.assign({}, inv, invoiceCalc(inv, pays), { clientName: c ? c.name : 'Deleted client', rawStatus: inv.status });
    }
    function filingView(f, clientsById) {
      const c = clientsById ? clientsById[f.clientId] : store.get('clients', f.clientId);
      const t = today();
      const daysLeft = f.dueDate ? U.diffDays(f.dueDate, t) : null;
      return Object.assign({}, f, {
        clientName: c ? c.name : 'Deleted client', clientType: c ? c.type : '',
        typeLabel: C.filingLabel(f.type), stageLabel: C.stageLabel(f.stage), periodLabel: U.periodLabel(f.period, f.taxYear),
        assigneeName: f.assignedTo ? userName(f.assignedTo) : '', daysLeft, overdue: f.stage !== 'filed' && daysLeft != null && daysLeft < 0,
      });
    }
    function noticeView(n, clientsById) {
      const c = clientsById ? clientsById[n.clientId] : store.get('clients', n.clientId);
      const daysLeft = n.dueDate ? U.diffDays(n.dueDate, today()) : null;
      return Object.assign({}, n, { clientName: c ? c.name : 'Deleted client', sectionLabel: C.sectionLabel(n.section), statusLabel: C.noticeStatusLabel(n.status), daysLeft, overdue: n.status !== 'closed' && n.status !== 'responded' && daysLeft != null && daysLeft < 0, assigneeName: n.assignedTo ? userName(n.assignedTo) : '' });
    }
    function docView(d, clientsById) {
      const c = clientsById ? clientsById[d.clientId] : store.get('clients', d.clientId);
      const comments = all('comments').filter((x) => x.docId === d.id).length;
      return Object.assign({}, d, { clientName: c ? c.name : 'Deleted client', commentCount: comments });
    }
    function taskView(t, clientsById) {
      const c = t.clientId ? (clientsById ? clientsById[t.clientId] : store.get('clients', t.clientId)) : null;
      const daysLeft = t.dueDate ? U.diffDays(t.dueDate, today()) : null;
      return Object.assign({}, t, { clientName: c ? c.name : '', assigneeName: t.assignedTo ? userName(t.assignedTo) : '', daysLeft, overdue: t.status !== 'done' && daysLeft != null && daysLeft < 0 });
    }
    const mapById = (rows) => { const m = {}; for (const r of rows) m[r.id] = r; return m; };
    function firmCaches(ctx) {
      const clients = ctx.mine('clients');
      return { clients, byId: mapById(clients), pays: ctx.mine('payments') };
    }
    function clientRow(ctx, c, k) {
      const filings = k.filings.filter((f) => f.clientId === c.id);
      const open = filings.filter((f) => f.stage !== 'filed');
      const invs = k.invoices.filter((i) => i.clientId === c.id).map((i) => invoiceCalc(i, k.pays));
      const outstanding = U.sum(invs.filter((i) => i.status !== 'draft' && i.status !== 'cancelled'), (i) => i.balance);
      const pu = c.portalUserId ? store.get('users', c.portalUserId) : null;
      const t = today();
      return Object.assign({}, c, {
        openFilings: open.length,
        overdueFilings: open.filter((f) => f.dueDate && f.dueDate < t).length,
        nextDue: open.filter((f) => f.dueDate).map((f) => f.dueDate).sort()[0] || null,
        openNotices: k.notices.filter((n) => n.clientId === c.id && n.status !== 'closed').length,
        outstanding,
        portal: pu ? { enabled: pu.status === 'active', email: pu.email, lastLoginAt: pu.lastLoginAt || null } : null,
        assigneeName: c.assignedTo ? userName(c.assignedTo) : '',
      });
    }

    function unreadCounts(ctx) {
      const u = ctx.user;
      const out = { notifications: all('notifications').filter((n) => n.userId === u.id && !n.read).length, messages: 0 };
      if (ctx.firm && (u.role === 'consultant' || u.role === 'staff')) {
        out.messages = all('messages').filter((m) => m.firmId === ctx.firm.id && m.role === 'client' && !m.readByFirm).length;
        out.uploads = all('docs').filter((d) => d.firmId === ctx.firm.id && d.uploaderRole === 'client' && !d.seenByFirm).length;
        out.proofs = all('payments').filter((p) => p.firmId === ctx.firm.id && p.status === 'pending').length;
        out.overdue = all('filings').filter((f) => f.firmId === ctx.firm.id && f.stage !== 'filed' && f.dueDate && f.dueDate < today()).length;
      }
      if (u.role === 'client') {
        out.messages = all('messages').filter((m) => m.clientId === ctx.client.id && m.role === 'firm' && !m.readByClient).length;
        const docApprovals = all('docs').filter((d) => d.clientId === ctx.client.id && d.approval && d.approval.status === 'pending').length;
        out.filingApprovals = all('filings').filter((f) => f.clientId === ctx.client.id && f.stage === 'client_approval').length;
        out.approvals = docApprovals + out.filingApprovals;
        out.requests = all('requests').filter((r) => r.clientId === ctx.client.id && r.status === 'open').length;
        out.docsAction = out.requests + docApprovals;
        const pays = all('payments').filter((p) => p.clientId === ctx.client.id);
        out.invoices = all('invoices').filter((i) => i.clientId === ctx.client.id && i.status !== 'draft' && ['sent', 'partial', 'overdue'].indexOf(invoiceCalc(i, pays).status) >= 0).length;
      }
      if (u.role === 'admin') { out.payments = all('subPayments').filter((p) => p.status === 'pending').length; out.tickets = all('tickets').filter((t) => t.status === 'open').length; out.leads = all('leads').filter((l) => l.status === 'new').length; }
      return out;
    }

    /* =================================================================== *
     *  PUBLIC
     * =================================================================== */
    const isCounted = (f) => preview || !f.demo;
    def('public.site', 'public', {}, () => {
      const site = settings('site'), sys = settings('system');
      const t = now(), td = today();
      const firms = all('firms').filter(isCounted);
      const offer = site.offer || {};
      const taken = firms.filter((f) => !offer.startAt || f.createdAt >= offer.startAt).length;
      const offerOut = offer.enabled ? { title: offer.title, seats: V.int(offer.seats), taken, left: Math.max(0, V.int(offer.seats) - taken), deadline: offer.deadline, note: offer.note, active: !!offer.deadline && Date.parse(offer.deadline) > t && V.int(offer.seats) - taken > 0 } : null;
      let stats = null;
      if (site.proof && site.proof.stats) {
        const ids = new Set(firms.map((f) => f.id));
        const s = {
          practices: firms.length,
          clients: all('clients').filter((c) => ids.has(c.firmId)).length,
          documents: all('docs').filter((d) => ids.has(d.firmId)).length,
          filed: all('filings').filter((f) => ids.has(f.firmId) && f.stage === 'filed').length,
        };
        if (s.practices >= (V.int(site.proof.statsMin) || 0)) stats = s;
      }
      let signups = [];
      if (site.proof && site.proof.liveSignups) {
        signups = firms.filter((f) => Date.parse(f.createdAt) > t - 14 * DAY).sort(U.by('createdAt', -1)).slice(0, 8)
          .map((f) => ({ city: f.city || 'Pakistan', plan: planOf(f).name, at: f.createdAt, kind: f.subStatus === 'active' ? 'activated' : 'trial' }));
      }
      const deadlines = complianceDeadlines(td, U.addDays(td, 120)).slice(0, 6);
      return {
        brand: brand(), site: Object.assign({}, site, { guarantee: String(site.guarantee || '').replace('{trialDays}', sys.trialDays) }),
        trialDays: sys.trialDays, allowSignups: sys.allowSignups,
        plans: plansSorted().filter((p) => p.visible !== false),
        faqs: all('faqs').filter((f) => f.published !== false).sort(U.by('order')).map((f) => ({ id: f.id, q: f.q, a: f.a })),
        testimonials: all('testimonials').filter((x) => x.published).sort(U.by('order')).map((x) => ({ id: x.id, name: x.name, role: x.role, city: x.city, quote: x.quote, rating: x.rating })),
        offer: offerOut, stats, signups, deadlines, tax: settings('tax'), today: td, now: nowISO(), preview,
      };
    });
    def('public.taxCalc', 'public', {}, (ctx, p) => taxCalc(p));
    def('public.lead', 'public', {}, (ctx, p) => {
      const name = V.req(p.name, 'Your name', 120);
      const email = V.email(p.email);
      const phone = V.phone(p.phone);
      if (!email && !phone) fail('Add an email or a phone number so we can reach you.');
      const lead = insert('leads', { name, email, phone, city: V.str(p.city, 60), practice: V.str(p.practice, 120), size: V.str(p.size, 40), source: V.str(p.source, 40) || 'website', message: V.text(p.message, 2000), status: 'new', notes: '' });
      notify(adminIds(), { title: 'New lead: ' + name, body: lead.source + (lead.city ? ', ' + lead.city : ''), link: '/admin/leads', kind: 'lead' });
      return { ok: true };
    });

    /* =================================================================== *
     *  AUTH & ME
     * =================================================================== */
    def('auth.login', 'public', {}, (ctx, p) => {
      const login = V.str(p.email, 160).toLowerCase();
      const pw = p.password == null ? '' : String(p.password);
      if (!login || !pw) fail('Enter your email and password.');
      const u = findLogin(login);
      if (!u || !hasher.verify(pw, u.passwordHash)) fail('That email and password do not match. Check both and try again.', 401, 'bad_login');
      if (u.status !== 'active') fail(u.role === 'client' ? 'Your portal login is turned off. Ask your tax consultant to turn it back on.' : 'This login is turned off. Contact your administrator.', 403, 'disabled');
      const updated = patch('users', u.id, { lastLoginAt: nowISO() });
      if (u.firmId) log({ user: updated, firm: store.get('firms', u.firmId) }, 'login', updated.name + ' signed in', { clientId: u.clientId || null });
      return publicUser(updated);
    });
    def('auth.signup', 'public', {}, (ctx, p) => {
      const sys = settings('system');
      if (!sys.allowSignups) fail('New sign-ups are paused right now. Contact us to get access.', 403, 'signups_closed');
      const name = V.req(p.name, 'Your name', 120);
      const email = V.email(p.email, true);
      if (emailTaken(email)) fail('An account with this email already exists. Sign in instead.', 409, 'exists');
      const password = V.password(p.password);
      const firmName = V.req(p.firmName, 'Practice name', 140);
      const plan = store.get('plans', p.planId) || store.get('plans', sys.defaultPlan) || plansSorted()[0];
      const cycle = V.oneOf(p.cycle, ['monthly', 'annual'], 'annual');
      const t = now();
      const firm = insert('firms', { name: firmName, city: V.str(p.city, 60), phone: V.phone(p.phone), email, ntn: '', address: '', planId: plan.id, cycle, subStatus: 'trial', trialEndsAt: U.iso(t + (V.int(sys.trialDays) || 14) * DAY), periodEnd: null, clientsEstimate: V.str(p.clientsEstimate, 20), invoicePrefix: 'INV', invoiceSeq: 0, taxRate: 0, paymentTerms: 7, bank: {}, ownerId: null, demo: false, logo: '' });
      const user = insert('users', { role: 'consultant', firmId: firm.id, name, email, phone: V.phone(p.phone), passwordHash: hasher.hash(password), status: 'active', title: 'Principal', lastLoginAt: nowISO() });
      patch('firms', firm.id, { ownerId: user.id });
      const f2 = store.get('firms', firm.id);
      notify(adminIds(), { title: 'New sign-up: ' + firmName, body: name + (firm.city ? ', ' + firm.city : '') + ' started a ' + plan.name + ' trial', link: '/admin/firms/' + firm.id, kind: 'signup' });
      notify([user.id], { title: 'Your free trial has started', body: 'Add your first client, then invite them to the portal.', link: '/app', kind: 'info' });
      log({ user, firm: f2 }, 'signup', name + ' created the practice account');
      return publicUser(user);
    });
    def('auth.forgot', 'public', {}, (ctx, p) => {
      const login = V.str(p.email, 160).toLowerCase();
      const u = login ? findLogin(login) : null;
      if (u && u.status === 'active') {
        insert('resets', { userId: u.id, role: u.role, firmId: u.firmId || null, name: u.name, email: u.email, status: 'open' });
        const title = u.name + ' asked for a password reset';
        if (u.role === 'client') notify(firmTeamIds(u.firmId), { title, body: 'Reset it from the client profile under Portal access.', link: '/app/clients/' + u.clientId, kind: 'reset' });
        else if (u.role === 'staff') notify([ownerOf(u.firmId)], { title, body: 'Reset it from Team.', link: '/app/team', kind: 'reset' });
        else notify(adminIds(), { title, body: u.email, link: u.role === 'admin' ? '/admin/settings?tab=admins' : '/admin/firms/' + u.firmId, kind: 'reset' });
      }
      return { ok: true };
    });
    def('me.get', ANY, {}, (ctx) => {
      const out = { user: publicUser(ctx.user), unread: unreadCounts(ctx), brand: brand(), preview };
      if (ctx.firm) { out.firm = Object.assign({}, ctx.firm); out.plan = planPublic(ctx.plan); out.sub = ctx.sub; out.features = ctx.features; out.usage = usage(ctx.firm.id); out.plans = plansSorted().filter((p) => p.visible !== false); }
      if (ctx.client) {
        const owner = store.get('users', ctx.firm.ownerId);
        out.client = { id: ctx.client.id, name: ctx.client.name, type: ctx.client.type };
        out.firmContact = { name: ctx.firm.name, phone: ctx.firm.phone || (owner && owner.phone) || '', email: ctx.firm.email || (owner && owner.email) || '', city: ctx.firm.city || '', ownerName: owner ? owner.name : '', logo: ctx.features.branding ? (ctx.firm.logo || '') : '' };
      }
      return out;
    });
    def('me.ping', ANY, {}, (ctx) => ({ unread: unreadCounts(ctx), sub: ctx.sub || null }));
    def('me.update', ANY, {}, (ctx, p) => {
      const changes = { name: V.req(p.name, 'Name', 120), phone: V.phone(p.phone) };
      if (p.title !== undefined) changes.title = V.str(p.title, 80);
      if (p.email !== undefined && ctx.user.role !== 'client') {
        const email = V.email(p.email, true);
        if (emailTaken(email, ctx.user.id)) fail('Another login already uses this email.', 409);
        changes.email = email;
      }
      return publicUser(patch('users', ctx.user.id, changes));
    });
    def('me.password', ANY, {}, (ctx, p) => {
      const u = store.get('users', ctx.user.id);
      if (!hasher.verify(String(p.current || ''), u.passwordHash)) fail('Your current password is not correct.', 400, 'bad_password');
      patch('users', u.id, { passwordHash: hasher.hash(V.password(p.next)) });
      return { ok: true };
    });
    def('notifications.list', ANY, {}, (ctx) => all('notifications').filter((n) => n.userId === ctx.user.id).sort(U.by('createdAt', -1)).slice(0, 60));
    def('notifications.read', ANY, {}, (ctx, p) => {
      for (const n of all('notifications').filter((x) => x.userId === ctx.user.id && !x.read && (!p.id || x.id === p.id))) patch('notifications', n.id, { read: true });
      return { ok: true };
    });
    def('announcements.active', ANY, {}, (ctx) => all('announcements').filter((a) => a.active && (a.audience === 'all' || (a.audience || 'consultants') === (ctx.user.role === 'client' ? 'clients' : 'consultants'))).sort(U.by('createdAt', -1)).slice(0, 3));

    /* =================================================================== *
     *  ADMIN
     * =================================================================== */
    function firmSummary(f) {
      const owner = store.get('users', f.ownerId);
      const plan = planOf(f);
      return Object.assign({}, f, { ownerName: owner ? owner.name : '', ownerEmail: owner ? owner.email : '', ownerPhone: owner ? owner.phone : '', planName: plan.name, sub: subscription(f), usage: usage(f.id), lastLoginAt: owner ? owner.lastLoginAt : null });
    }
    function monthlyValue(f) {
      const s = subscription(f);
      if (s.status !== 'active') return 0;
      const p = planOf(f);
      return f.cycle === 'annual' ? (V.num(p.annual) / 12) : V.num(p.monthly);
    }
    def('admin.overview', ADMIN, {}, () => {
      const firms = all('firms');
      const subs = firms.map((f) => subscription(f).status);
      const count = (s) => subs.filter((x) => x === s).length;
      const t = now(), td = today();
      const mrr = Math.round(firms.reduce((a, f) => a + monthlyValue(f), 0));
      const approved = all('subPayments').filter((p) => p.status === 'approved');
      const thisMonth = U.monthKey(td);
      const months = [];
      for (let i = 5; i >= 0; i--) months.push(U.monthKey(U.addMonths(td.slice(0, 7) + '-01', -i)));
      const revenue = months.map((m) => ({ month: m, label: U.monthLabel(m), amount: U.sum(approved.filter((p) => U.monthKey(U.pktDate(Date.parse(p.reviewedAt || p.createdAt))) === m), (p) => p.amount) }));
      const weeks = [];
      for (let i = 11; i >= 0; i--) {
        const end = t - i * 7 * DAY, start = end - 7 * DAY;
        weeks.push({ label: U.pktDate(start).slice(5).replace('-', '/'), count: firms.filter((f) => { const c = Date.parse(f.createdAt); return c > start && c <= end; }).length });
      }
      const byPlan = plansSorted().map((p) => ({ id: p.id, name: p.name, count: firms.filter((f) => f.planId === p.id && ['active', 'trial'].indexOf(subscription(f).status) >= 0).length }));
      const pending = all('subPayments').filter((p) => p.status === 'pending').sort(U.by('createdAt', -1)).map((p) => { const f = store.get('firms', p.firmId); return Object.assign({}, p, { firmName: f ? f.name : 'Deleted practice', planName: (store.get('plans', p.planId) || {}).name || p.planId }); });
      const expiring = firms.map(firmSummary).filter((f) => (f.sub.status === 'active' || f.sub.status === 'trial') && f.sub.daysLeft != null && f.sub.daysLeft <= 7).sort(U.by((f) => f.sub.daysLeft)).slice(0, 8);
      return {
        kpis: {
          firms: firms.length, active: count('active'), trial: count('trial'), expired: count('expired'), suspended: count('suspended'),
          mrr, arr: mrr * 12, revenueThisMonth: U.sum(approved.filter((p) => U.monthKey(U.pktDate(Date.parse(p.reviewedAt || p.createdAt))) === thisMonth), (p) => p.amount),
          pendingCount: pending.length, pendingAmount: U.sum(pending, (p) => p.amount),
          leadsNew: all('leads').filter((l) => l.status === 'new').length, ticketsOpen: all('tickets').filter((x) => x.status === 'open').length,
          clients: all('clients').length, users: all('users').filter((u) => u.role !== 'admin').length,
          conversion: firms.length ? Math.round(count('active') / firms.length * 100) : 0,
        },
        revenue, weeks, byPlan, pending,
        recentFirms: firms.slice().sort(U.by('createdAt', -1)).slice(0, 6).map(firmSummary),
        expiring,
      };
    });
    def('admin.firms', ADMIN, {}, () => all('firms').map(firmSummary).sort(U.by('createdAt', -1)));
    def('admin.firm', ADMIN, {}, (ctx, p) => {
      const f = store.get('firms', p.id);
      if (!f) fail('That practice was not found.', 404);
      return {
        firm: firmSummary(f),
        team: all('users').filter((u) => u.firmId === f.id && u.role !== 'client').map(publicUser),
        portalUsers: all('users').filter((u) => u.firmId === f.id && u.role === 'client').length,
        payments: all('subPayments').filter((x) => x.firmId === f.id).sort(U.by('createdAt', -1)).map((x) => Object.assign({}, x, { planName: (store.get('plans', x.planId) || {}).name || x.planId })),
        activity: all('activity').filter((a) => a.firmId === f.id).sort(U.by('createdAt', -1)).slice(0, 25),
        tickets: all('tickets').filter((x) => x.firmId === f.id).sort(U.by('updatedAt', -1)),
        counts: { filings: all('filings').filter((x) => x.firmId === f.id).length, docs: all('docs').filter((x) => x.firmId === f.id).length, invoices: all('invoices').filter((x) => x.firmId === f.id).length },
        plans: plansSorted(),
      };
    });
    def('admin.firm.update', ADMIN, {}, (ctx, p) => {
      const f = store.get('firms', p.id);
      if (!f) fail('That practice was not found.', 404);
      const out = patch('firms', f.id, { name: V.req(p.name, 'Practice name', 140), city: V.str(p.city, 60), phone: V.phone(p.phone), email: V.email(p.email), adminNotes: V.text(p.adminNotes, 2000) });
      log(Object.assign({}, ctx, { firm: null }), 'admin.firm.update', 'Updated practice ' + out.name, { targetFirmId: f.id });
      return firmSummary(out);
    });
    function activateFirm(f, planId, cycle, months) {
      const plan = store.get('plans', planId) || planOf(f);
      const cyc = V.oneOf(cycle, ['monthly', 'annual'], f.cycle || 'monthly');
      const m = V.int(months) || (cyc === 'annual' ? 12 : 1);
      const s = subscription(f);
      const startIso = (s.status === 'active' && f.periodEnd && Date.parse(f.periodEnd) > now() && f.planId === plan.id) ? f.periodEnd : nowISO();
      return patch('firms', f.id, { planId: plan.id, cycle: cyc, subStatus: 'active', periodEnd: U.addMonthsIso(startIso, m), activatedAt: f.activatedAt || nowISO(), prevStatus: null });
    }
    def('admin.firm.subscription', ADMIN, {}, (ctx, p) => {
      const f = store.get('firms', p.id);
      if (!f) fail('That practice was not found.', 404);
      let out, msg;
      switch (p.mode) {
        case 'activate':
          out = activateFirm(f, p.planId, p.cycle, p.months);
          msg = 'Activated ' + planOf(out).name + ' (' + out.cycle + ') until ' + U.pktDate(Date.parse(out.periodEnd));
          notify([f.ownerId], { title: 'Your ' + planOf(out).name + ' plan is active', body: 'Active until ' + U.pktDate(Date.parse(out.periodEnd)) + '.', link: '/app/subscription', kind: 'success' });
          break;
        case 'extend_trial': {
          const days = Math.max(1, V.int(p.days) || 7);
          const base = (f.subStatus === 'trial' && f.trialEndsAt && Date.parse(f.trialEndsAt) > now()) ? Date.parse(f.trialEndsAt) : now();
          out = patch('firms', f.id, { subStatus: 'trial', trialEndsAt: U.iso(base + days * DAY) });
          msg = 'Extended trial by ' + days + ' days';
          notify([f.ownerId], { title: 'Your trial was extended by ' + days + ' days', body: 'Trial now ends ' + U.pktDate(Date.parse(out.trialEndsAt)) + '.', link: '/app/subscription', kind: 'success' });
          break;
        }
        case 'change_plan': {
          const plan = store.get('plans', p.planId);
          if (!plan) fail('Choose a plan.');
          out = patch('firms', f.id, { planId: plan.id, cycle: V.oneOf(p.cycle, ['monthly', 'annual'], f.cycle) });
          msg = 'Changed plan to ' + plan.name;
          break;
        }
        case 'set_end': {
          const d = V.date(p.date);
          if (!d) fail('Choose an end date.');
          const isoEnd = U.iso(U.parseDay(d) + DAY - 1 - PKT_OFFSET);
          out = patch('firms', f.id, f.subStatus === 'trial' ? { trialEndsAt: isoEnd } : { periodEnd: isoEnd, subStatus: f.subStatus === 'expired' ? 'active' : f.subStatus });
          msg = 'Set end date to ' + d;
          break;
        }
        case 'suspend':
          out = patch('firms', f.id, { subStatus: 'suspended', prevStatus: f.subStatus === 'suspended' ? f.prevStatus : f.subStatus, suspendReason: V.str(p.reason, 300) });
          msg = 'Suspended the account' + (p.reason ? ': ' + p.reason : '');
          notify([f.ownerId], { title: 'Your FinTax account is suspended', body: p.reason ? V.str(p.reason, 300) : 'Contact support to restore access.', link: '/app/subscription', kind: 'warning' });
          break;
        case 'resume':
          out = patch('firms', f.id, { subStatus: f.prevStatus && f.prevStatus !== 'suspended' ? f.prevStatus : 'active', prevStatus: null, suspendReason: '' });
          if (out.subStatus === 'active' && (!out.periodEnd || Date.parse(out.periodEnd) < now())) out = patch('firms', f.id, { periodEnd: U.addMonthsIso(nowISO(), out.cycle === 'annual' ? 12 : 1) });
          msg = 'Restored the account';
          notify([f.ownerId], { title: 'Your FinTax account is active again', link: '/app', kind: 'success' });
          break;
        default: fail('Unknown subscription change.');
      }
      log({ user: ctx.user, firm: null }, 'admin.subscription', f.name + ': ' + msg, { targetFirmId: f.id });
      log({ user: ctx.user, firm: f }, 'subscription', 'FinTax admin: ' + msg);
      return firmSummary(out);
    });
    def('admin.firm.resetPassword', ADMIN, {}, (ctx, p) => {
      const f = store.get('firms', p.id);
      if (!f) fail('That practice was not found.', 404);
      const u = store.get('users', f.ownerId);
      if (!u) fail('This practice has no owner login.', 404);
      const password = genPassword();
      patch('users', u.id, { passwordHash: hasher.hash(password), status: 'active' });
      for (const r of all('resets').filter((x) => x.userId === u.id && x.status === 'open')) patch('resets', r.id, { status: 'done' });
      log({ user: ctx.user, firm: null }, 'admin.reset', 'Reset owner password for ' + f.name, { targetFirmId: f.id });
      return { email: u.email, password, name: u.name };
    });
    function purgeFirm(firmId) {
      for (const c of COLLECTIONS) {
        if (c === 'firms' || c === 'plans' || c === 'settings') continue;
        for (const d of all(c).slice()) if (d.firmId === firmId) remove(c, d.id);
      }
      for (const n of all('notifications').slice()) if (!store.get('users', n.userId)) remove('notifications', n.id);
      remove('firms', firmId);
    }
    def('admin.firm.delete', ADMIN, {}, (ctx, p) => {
      const f = store.get('firms', p.id);
      if (!f) fail('That practice was not found.', 404);
      if (V.str(p.confirm, 200) !== f.name) fail('Type the practice name exactly to confirm.');
      purgeFirm(f.id);
      log({ user: ctx.user, firm: null }, 'admin.firm.delete', 'Deleted practice ' + f.name);
      return { ok: true };
    });
    def('admin.impersonate', ADMIN, {}, (ctx, p) => {
      const f = store.get('firms', p.firmId);
      if (!f) fail('That practice was not found.', 404);
      const u = store.get('users', f.ownerId);
      if (!u || u.status !== 'active') fail('The owner login for this practice is not active.');
      log({ user: ctx.user, firm: null }, 'admin.impersonate', 'Opened ' + f.name + ' as support', { targetFirmId: f.id });
      log({ user: ctx.user, firm: f }, 'support', 'FinTax support opened the account');
      return { user: Object.assign(publicUser(u), { impersonatedBy: ctx.user.id }) };
    });
    def('admin.plans', ADMIN, {}, () => plansSorted());
    def('admin.plan.save', ADMIN, {}, (ctx, p) => {
      const cur = store.get('plans', p.id);
      if (!cur) fail('FinTax has exactly two plans. Edit one of them.', 404);
      const lim = p.limits || {};
      const feat = p.features || {};
      const bullets = (Array.isArray(p.bullets) ? p.bullets : String(p.bullets || '').split('\n')).map((b) => V.str(b, 160)).filter(Boolean).slice(0, 14);
      const out = patch('plans', cur.id, {
        name: V.req(p.name, 'Plan name', 40), tagline: V.str(p.tagline, 160), monthly: V.money(p.monthly), annual: V.money(p.annual),
        badge: V.str(p.badge, 30), highlight: V.bool(p.highlight), visible: p.visible === undefined ? true : V.bool(p.visible), cta: V.str(p.cta, 40) || 'Start free trial',
        limits: { clients: V.limit(lim.clients), team: V.limit(lim.team), storageGB: V.limit(lim.storageGB) },
        features: { portal: V.bool(feat.portal), vault: V.bool(feat.vault), advancedReports: V.bool(feat.advancedReports), bulk: V.bool(feat.bulk), branding: V.bool(feat.branding) },
        bullets,
      });
      if (out.highlight) for (const other of all('plans')) if (other.id !== out.id && other.highlight) patch('plans', other.id, { highlight: false });
      log({ user: ctx.user, firm: null }, 'admin.plan', 'Updated plan ' + out.name + ' (Rs ' + out.monthly + '/mo, Rs ' + out.annual + '/yr)');
      return plansSorted();
    });
    def('admin.payments', ADMIN, {}, () => all('subPayments').slice().sort(U.by('createdAt', -1)).map((x) => { const f = store.get('firms', x.firmId); return Object.assign({}, x, { firmName: f ? f.name : 'Deleted practice', firmCity: f ? f.city : '', planName: (store.get('plans', x.planId) || {}).name || x.planId, submittedByName: userName(x.userId) }); }));
    def('admin.payment.review', ADMIN, {}, (ctx, p) => {
      const pay = store.get('subPayments', p.id);
      if (!pay) fail('That payment was not found.', 404);
      if (pay.status !== 'pending') fail('This payment has already been reviewed.');
      const f = store.get('firms', pay.firmId);
      if (!f) fail('The practice for this payment no longer exists.', 404);
      if (p.decision === 'approve') {
        const out = activateFirm(f, pay.planId, pay.cycle);
        patch('subPayments', pay.id, { status: 'approved', reviewedAt: nowISO(), reviewedBy: ctx.user.id, note: V.str(p.note, 300), periodEnd: out.periodEnd });
        notify([f.ownerId, pay.userId], { title: 'Payment verified. ' + planOf(out).name + ' is active', body: 'Rs ' + pay.amount.toLocaleString('en-US') + ' received. Active until ' + U.pktDate(Date.parse(out.periodEnd)) + '.', link: '/app/subscription', kind: 'success' });
        log({ user: ctx.user, firm: null }, 'admin.payment', 'Approved Rs ' + pay.amount + ' from ' + f.name, { targetFirmId: f.id });
        log({ user: ctx.user, firm: out }, 'subscription', 'Payment verified, plan active until ' + U.pktDate(Date.parse(out.periodEnd)));
      } else if (p.decision === 'reject') {
        const note = V.req(p.note, 'A reason for the customer', 300);
        patch('subPayments', pay.id, { status: 'rejected', reviewedAt: nowISO(), reviewedBy: ctx.user.id, note });
        notify([f.ownerId, pay.userId], { title: 'We could not verify your payment', body: note, link: '/app/subscription', kind: 'warning' });
        log({ user: ctx.user, firm: null }, 'admin.payment', 'Rejected payment from ' + f.name + ': ' + note, { targetFirmId: f.id });
      } else fail('Choose approve or reject.');
      return { ok: true };
    });
    def('admin.leads', ADMIN, {}, () => all('leads').slice().sort(U.by('createdAt', -1)));
    def('admin.lead.save', ADMIN, {}, (ctx, p) => {
      if (p.id) { const l = store.get('leads', p.id); if (!l) fail('That lead was not found.', 404); return patch('leads', l.id, { status: V.oneOf(p.status, C.LEAD_STATUS.map((x) => x.id), l.status), notes: V.text(p.notes, 3000), name: p.name !== undefined ? V.req(p.name, 'Name') : l.name, email: p.email !== undefined ? V.email(p.email) : l.email, phone: p.phone !== undefined ? V.phone(p.phone) : l.phone, city: p.city !== undefined ? V.str(p.city, 60) : l.city }); }
      return insert('leads', { name: V.req(p.name, 'Name', 120), email: V.email(p.email), phone: V.phone(p.phone), city: V.str(p.city, 60), practice: V.str(p.practice, 120), source: 'manual', message: '', status: V.oneOf(p.status, C.LEAD_STATUS.map((x) => x.id), 'new'), notes: V.text(p.notes, 3000) });
    });
    def('admin.lead.delete', ADMIN, {}, (ctx, p) => { remove('leads', p.id); return { ok: true }; });
    def('admin.settings', ADMIN, {}, () => ({ site: settings('site'), payment: settings('payment'), system: settings('system'), tax: settings('tax') }));
    def('admin.settings.save', ADMIN, {}, (ctx, p) => {
      const section = V.oneOf(p.section, ['site', 'payment', 'system', 'tax'], null);
      if (!section) fail('Unknown settings section.');
      const data = p.data || {};
      if (section === 'site' && data.logo && String(data.logo).length > 900000) fail('That logo file is too large. Use a PNG under 600 KB.');
      if (section === 'system' && data.trialDays !== undefined) data.trialDays = Math.max(1, Math.min(90, V.int(data.trialDays) || 14));
      if (section === 'system' && Array.isArray(data.rules)) data.rules = data.rules.map((r) => ({ id: V.str(r.id, 40) || nid('settings'), title: V.req(r.title, 'Deadline name', 120), authority: V.oneOf(r.authority, C.AUTHORITIES, 'FBR'), kind: V.oneOf(r.kind, ['monthly', 'quarterly', 'dates', 'yearly'], 'monthly'), day: V.int(r.day, 15), months: Array.isArray(r.months) ? r.months.map((m) => V.int(m)).filter((m) => m >= 1 && m <= 12) : [1, 4, 7, 10], dates: Array.isArray(r.dates) ? r.dates.map((d) => V.str(d, 5)).filter((d) => /^\d{2}-\d{2}$/.test(d)) : [], date: /^\d{2}-\d{2}$/.test(r.date || '') ? r.date : '', enabled: V.bool(r.enabled), note: V.str(r.note, 200) }));
      if (section === 'tax' && Array.isArray(data.years)) {
        data.years = data.years.map((y) => {
          const slabs = (arr) => (Array.isArray(arr) ? arr : []).map((s) => [s[0] === null || s[0] === '' || s[0] === undefined ? null : V.money(s[0]), V.num(s[1])]);
          return { year: V.int(y.year), label: V.str(y.label, 80), salaried: slabs(y.salaried), business: slabs(y.business), salariedSurcharge: { above: V.money((y.salariedSurcharge || {}).above), rate: V.num((y.salariedSurcharge || {}).rate) }, businessSurcharge: { above: V.money((y.businessSurcharge || {}).above), rate: V.num((y.businessSurcharge || {}).rate) } };
        });
      }
      if (section === 'system' || section === 'tax') {
        // arrays replace wholesale; store them directly
        const cur = store.get('settings', section);
        const merged = U.deepMerge(cur ? cur.data : {}, data);
        if (cur) patch('settings', section, { data: merged }); else insert('settings', { id: section, data: merged });
      } else saveSettings(section, data);
      log({ user: ctx.user, firm: null }, 'admin.settings', 'Updated ' + section + ' settings');
      return { site: settings('site'), payment: settings('payment'), system: settings('system'), tax: settings('tax') };
    });
    def('admin.testimonials', ADMIN, {}, () => all('testimonials').slice().sort(U.by('order')));
    def('admin.testimonial.save', ADMIN, {}, (ctx, p) => {
      const doc = { name: V.req(p.name, 'Customer name', 80), role: V.str(p.role, 80), city: V.str(p.city, 60), quote: V.req(p.quote, 'Quote', 600), rating: Math.max(1, Math.min(5, V.int(p.rating, 5) || 5)), published: V.bool(p.published), order: V.int(p.order, 0) };
      return p.id ? patch('testimonials', p.id, doc) : insert('testimonials', doc);
    });
    def('admin.testimonial.delete', ADMIN, {}, (ctx, p) => { remove('testimonials', p.id); return { ok: true }; });
    def('admin.faqs', ADMIN, {}, () => all('faqs').slice().sort(U.by('order')));
    def('admin.faq.save', ADMIN, {}, (ctx, p) => {
      const doc = { q: V.req(p.q, 'Question', 200), a: V.req(p.a, 'Answer', 1500), order: V.int(p.order, 0), published: p.published === undefined ? true : V.bool(p.published) };
      return p.id ? patch('faqs', p.id, doc) : insert('faqs', doc);
    });
    def('admin.faq.delete', ADMIN, {}, (ctx, p) => { remove('faqs', p.id); return { ok: true }; });
    def('admin.announcements', ADMIN, {}, () => all('announcements').slice().sort(U.by('createdAt', -1)));
    def('admin.announcement.save', ADMIN, {}, (ctx, p) => {
      const doc = { title: V.req(p.title, 'Title', 120), body: V.text(p.body, 1200), audience: V.oneOf(p.audience, ['consultants', 'clients', 'all'], 'consultants'), active: V.bool(p.active), link: V.str(p.link, 200) };
      const out = p.id ? patch('announcements', p.id, doc) : insert('announcements', doc);
      log({ user: ctx.user, firm: null }, 'admin.announcement', (p.id ? 'Updated' : 'Posted') + ' announcement: ' + out.title);
      return out;
    });
    def('admin.announcement.delete', ADMIN, {}, (ctx, p) => { remove('announcements', p.id); return { ok: true }; });
    def('admin.tickets', ADMIN, {}, () => all('tickets').slice().sort(U.by('updatedAt', -1)).map((t) => { const f = store.get('firms', t.firmId); return Object.assign({}, t, { firmName: f ? f.name : 'Deleted practice' }); }));
    def('admin.activity', ADMIN, {}, (ctx, p) => {
      const firms = mapById(all('firms'));
      return all('activity').slice().sort(U.by('createdAt', -1)).slice(0, V.int(p.limit, 200) || 200).map((a) => Object.assign({}, a, { firmName: a.firmId && firms[a.firmId] ? firms[a.firmId].name : (a.targetFirmId && firms[a.targetFirmId] ? firms[a.targetFirmId].name : '') }));
    });
    def('admin.admins', ADMIN, {}, () => all('users').filter((u) => u.role === 'admin').map(publicUser));
    def('admin.admin.save', ADMIN, {}, (ctx, p) => {
      if (p.id) {
        const u = store.get('users', p.id);
        if (!u || u.role !== 'admin') fail('That admin was not found.', 404);
        const email = V.email(p.email, true);
        if (emailTaken(email, u.id)) fail('Another login already uses this email.', 409);
        const changes = { name: V.req(p.name, 'Name'), email };
        if (p.status !== undefined) { if (u.id === ctx.user.id && p.status !== 'active') fail('You cannot turn off your own login.'); changes.status = V.oneOf(p.status, ['active', 'disabled'], u.status); }
        if (p.password) changes.passwordHash = hasher.hash(V.password(p.password));
        return publicUser(patch('users', u.id, changes));
      }
      const email = V.email(p.email, true);
      if (emailTaken(email)) fail('Another login already uses this email.', 409);
      const password = p.password ? V.password(p.password) : genPassword();
      const u = insert('users', { role: 'admin', name: V.req(p.name, 'Name'), email, phone: V.phone(p.phone), passwordHash: hasher.hash(password), status: 'active' });
      log({ user: ctx.user, firm: null }, 'admin.admins', 'Added admin ' + u.name);
      return { user: publicUser(u), password };
    });
    def('admin.resets', ADMIN, {}, () => all('resets').filter((r) => r.role === 'consultant' || r.role === 'admin').sort(U.by('createdAt', -1)));
    def('admin.reset.done', ADMIN, {}, (ctx, p) => { const r = store.get('resets', p.id); if (r) patch('resets', r.id, { status: 'done' }); return { ok: true }; });

    /* ---- tickets (shared by admin and consultants) */
    def('ticket.get', ['admin', 'consultant', 'staff'], {}, (ctx, p) => {
      const t = store.get('tickets', p.id);
      if (!t || (ctx.user.role !== 'admin' && t.firmId !== ctx.firm.id)) fail('That ticket was not found.', 404);
      const f = store.get('firms', t.firmId);
      return Object.assign({}, t, { firmName: f ? f.name : '' });
    });
    def('ticket.reply', ['admin', 'consultant', 'staff'], {}, (ctx, p) => {
      const t = store.get('tickets', p.id);
      if (!t || (ctx.user.role !== 'admin' && t.firmId !== ctx.firm.id)) fail('That ticket was not found.', 404);
      const text = V.text(p.text, 4000);
      const thread = (t.thread || []).slice();
      if (text) thread.push({ userId: ctx.user.id, name: ctx.user.name, role: ctx.user.role === 'admin' ? 'support' : 'customer', text, at: nowISO() });
      let status = t.status;
      if (p.status) status = V.oneOf(p.status, ['open', 'waiting', 'closed'], t.status);
      else if (text) status = ctx.user.role === 'admin' ? 'waiting' : 'open';
      const out = patch('tickets', t.id, { thread, status });
      if (text) {
        if (ctx.user.role === 'admin') notify([t.userId], { title: 'FinTax support replied: ' + t.subject, body: text.slice(0, 140), link: '/app/support', kind: 'support' });
        else notify(adminIds(), { title: 'Ticket reply from ' + (ctx.firm ? ctx.firm.name : ctx.user.name), body: t.subject, link: '/admin/support', kind: 'support' });
      }
      return out;
    });

    /* =================================================================== *
     *  CONSULTANT: dashboard
     * =================================================================== */
    def('firm.overview', FIRM, {}, (ctx) => {
      const k = { filings: ctx.mine('filings'), invoices: ctx.mine('invoices'), pays: ctx.mine('payments'), notices: ctx.mine('notices') };
      const clients = ctx.mine('clients');
      const byId = mapById(clients);
      const td = today(), in30 = U.addDays(td, 30);
      const active = clients.filter((c) => !c.archived);
      const openFilings = k.filings.filter((f) => f.stage !== 'filed');
      const docs = ctx.mine('docs');
      const pendingDocApprovals = docs.filter((d) => d.approval && d.approval.status === 'pending');
      const invCalc = k.invoices.map((i) => Object.assign({}, i, invoiceCalc(i, k.pays)));
      const outstandingInv = invCalc.filter((i) => ['sent', 'partial', 'overdue'].indexOf(i.status) >= 0);
      const openNotices = k.notices.filter((n) => n.status !== 'closed');
      const tasks = ctx.mine('tasks').filter((t) => t.status !== 'done');
      const upcoming = [];
      for (const f of openFilings) if (f.dueDate && f.dueDate <= in30) upcoming.push({ date: f.dueDate, kind: 'filing', title: C.filingLabel(f.type) + ', ' + U.periodLabel(f.period, f.taxYear), sub: byId[f.clientId] ? byId[f.clientId].name : '', id: f.id, clientId: f.clientId, stage: f.stage });
      for (const n of openNotices) {
        if (n.dueDate && n.dueDate <= in30 && (n.status === 'received' || n.status === 'in_progress')) upcoming.push({ date: n.dueDate, kind: 'notice', title: 'Reply due: ' + C.sectionLabel(n.section), sub: byId[n.clientId] ? byId[n.clientId].name : '', id: n.id, clientId: n.clientId });
        if (n.hearingDate && n.hearingDate >= td && n.hearingDate <= in30) upcoming.push({ date: n.hearingDate, kind: 'hearing', title: 'Hearing: ' + C.sectionLabel(n.section), sub: byId[n.clientId] ? byId[n.clientId].name : '', id: n.id, clientId: n.clientId });
      }
      for (const t of tasks) if (t.dueDate && t.dueDate <= in30) upcoming.push({ date: t.dueDate, kind: 'task', title: t.title, sub: t.clientId && byId[t.clientId] ? byId[t.clientId].name : '', id: t.id, clientId: t.clientId || null });
      for (const d of complianceDeadlines(td, in30)) upcoming.push({ date: d.date, kind: 'deadline', title: d.title, sub: d.forPeriod || d.note, featured: !!d.featured });
      upcoming.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
      const months = [];
      for (let i = 5; i >= 0; i--) months.push(U.monthKey(U.addMonths(td.slice(0, 7) + '-01', -i)));
      const confirmedPays = k.pays.filter((p) => p.status === 'confirmed');
      const revenue = months.map((m) => ({ month: m, label: MONTHS[+m.slice(5, 7) - 1], invoiced: U.sum(invCalc.filter((i) => i.status !== 'draft' && i.status !== 'cancelled' && U.monthKey(i.issueDate) === m), (i) => i.total), collected: U.sum(confirmedPays.filter((p) => U.monthKey(p.date) === m), (p) => p.amount) }));
      const pipeline = C.STAGES.map((s) => ({ id: s.id, label: s.label, count: k.filings.filter((f) => f.stage === s.id && (s.id !== 'filed' || (f.filedAt && Date.parse(f.filedAt) > now() - 45 * DAY))).length }));
      const recentUploads = docs.filter((d) => d.uploaderRole === 'client').sort(U.by('createdAt', -1)).slice(0, 5).map((d) => docView(d, byId));
      const myTasks = tasks.filter((t) => !t.assignedTo || t.assignedTo === ctx.user.id).sort(U.by((t) => t.dueDate || '9999')).slice(0, 6).map((t) => taskView(t, byId));
      const filingClientApprovals = openFilings.filter((f) => f.stage === 'client_approval').length;
      return {
        kpis: {
          activeClients: active.length, portalClients: active.filter((c) => portalUser(c)).length,
          dueSoon: openFilings.filter((f) => f.dueDate && f.dueDate <= in30).length, overdue: openFilings.filter((f) => f.dueDate && f.dueDate < td).length,
          awaitingClient: pendingDocApprovals.length + filingClientApprovals,
          outstanding: U.sum(outstandingInv, (i) => i.balance), overdueInvoices: outstandingInv.filter((i) => i.status === 'overdue').length,
          openNotices: openNotices.length, urgentNotices: openNotices.filter((n) => (n.status === 'received' || n.status === 'in_progress') && n.dueDate && U.diffDays(n.dueDate, td) <= 7).length,
          newUploads: docs.filter((d) => d.uploaderRole === 'client' && !d.seenByFirm).length,
          pendingPaymentProofs: k.pays.filter((p) => p.status === 'pending').length,
          filedThisMonth: k.filings.filter((f) => f.stage === 'filed' && f.filedAt && U.monthKey(U.pktDate(Date.parse(f.filedAt))) === U.monthKey(td)).length,
        },
        upcoming: upcoming.slice(0, 14), revenue, pipeline, recentUploads, myTasks,
        recentActivity: ctx.mine('activity').sort(U.by('createdAt', -1)).slice(0, 10),
        onboarding: {
          dismissed: !!ctx.firm.onboardingDismissed,
          steps: [
            { id: 'client', label: 'Add your first client', done: clients.length > 0, link: '/app/clients?new=1' },
            { id: 'portal', label: 'Invite a client to the portal', done: clients.some((c) => c.portalUserId), link: '/app/clients' },
            { id: 'docs', label: 'Upload or request a document', done: docs.length > 0 || ctx.mine('requests').length > 0, link: '/app/documents' },
            { id: 'filing', label: 'Track a return or statement', done: k.filings.length > 0, link: '/app/filings' },
            { id: 'invoice', label: 'Send your first fee invoice', done: k.invoices.length > 0, link: '/app/invoices' },
          ],
        },
        announcements: all('announcements').filter((a) => a.active && (a.audience || 'consultants') !== 'clients').sort(U.by('createdAt', -1)).slice(0, 2),
      };
    });
    def('firm.onboarding.dismiss', FIRM, {}, (ctx) => { patch('firms', ctx.firm.id, { onboardingDismissed: true }); return { ok: true }; });

    /* =================================================================== *
     *  CONSULTANT: clients
     * =================================================================== */
    const team = (ctx) => all('users').filter((u) => u.firmId === ctx.firm.id && (u.role === 'consultant' || u.role === 'staff')).map(publicUser);
    def('team.options', FIRM, {}, (ctx) => team(ctx).filter((u) => u.status === 'active').map((u) => ({ id: u.id, name: u.name })));
    def('clients.list', FIRM, {}, (ctx) => {
      const k = { filings: ctx.mine('filings'), invoices: ctx.mine('invoices'), pays: ctx.mine('payments'), notices: ctx.mine('notices') };
      return ctx.mine('clients').map((c) => clientRow(ctx, c, k)).sort(U.by((c) => c.name.toLowerCase()));
    });
    def('client.get', FIRM, {}, (ctx, p) => {
      const c = ctx.own('clients', p.id);
      const k = { filings: ctx.mine('filings'), invoices: ctx.mine('invoices'), pays: ctx.mine('payments'), notices: ctx.mine('notices') };
      const row = clientRow(ctx, c, k);
      const byId = { [c.id]: c };
      return {
        client: row,
        team: team(ctx).filter((u) => u.status === 'active').map((u) => ({ id: u.id, name: u.name })),
        stats: {
          docs: ctx.mine('docs', (d) => d.clientId === c.id).length,
          openRequests: ctx.mine('requests', (r) => r.clientId === c.id && r.status === 'open').length,
          pendingApprovals: ctx.mine('docs', (d) => d.clientId === c.id && d.approval && d.approval.status === 'pending').length,
          invoiced: U.sum(k.invoices.filter((i) => i.clientId === c.id && i.status !== 'draft' && i.status !== 'cancelled').map((i) => invoiceCalc(i, k.pays)), (i) => i.total),
          collected: U.sum(k.pays.filter((x) => x.clientId === c.id && x.status === 'confirmed'), (x) => x.amount),
          unreadMessages: ctx.mine('messages', (m) => m.clientId === c.id && m.role === 'client' && !m.readByFirm).length,
        },
        activity: ctx.mine('activity', (a) => a.clientId === c.id).sort(U.by('createdAt', -1)).slice(0, 30),
        upcoming: k.filings.filter((f) => f.clientId === c.id && f.stage !== 'filed').sort(U.by((f) => f.dueDate || '9999')).slice(0, 5).map((f) => filingView(f, byId)),
      };
    });
    function clientFields(p, cur) {
      cur = cur || {};
      const type = V.oneOf(p.type, C.CLIENT_TYPES.map((x) => x.id), cur.type || 'individual');
      return {
        type, name: V.req(p.name, 'Client name', 140), profile: type === 'individual' ? V.oneOf(p.profile, C.PROFILES.map((x) => x.id), cur.profile || 'salaried') : '',
        businessName: V.str(p.businessName, 140), cnic: V.str(p.cnic, 20), ntn: V.str(p.ntn, 20), strn: V.str(p.strn, 20),
        email: V.email(p.email), phone: V.phone(p.phone), city: V.str(p.city, 60), address: V.text(p.address, 300), rto: V.str(p.rto, 80),
        atl: V.oneOf(p.atl, ['active', 'inactive', 'unknown'], cur.atl || 'unknown'),
        registrations: V.arr(p.registrations).filter((r) => C.AUTHORITIES.indexOf(r) >= 0),
        assignedTo: p.assignedTo ? V.str(p.assignedTo, 40) : '', tags: V.arr(p.tags).concat(typeof p.tags === 'string' ? [] : []).map((t) => V.str(t, 30)).filter(Boolean).slice(0, 8),
        feeBasis: V.oneOf(p.feeBasis, C.FEE_BASIS.map((x) => x.id), cur.feeBasis || 'annual'), feeAmount: V.money(p.feeAmount),
        notes: V.text(p.notes, 4000),
      };
    }
    def('client.save', FIRM, { write: true }, (ctx, p) => {
      if (typeof p.tags === 'string') p.tags = p.tags.split(',');
      if (p.assignedTo) { const a = store.get('users', p.assignedTo); if (!a || a.firmId !== ctx.firm.id) p.assignedTo = ''; }
      if (p.id) {
        const cur = ctx.own('clients', p.id);
        const out = patch('clients', cur.id, clientFields(p, cur));
        if (cur.portalUserId) { const pu = store.get('users', cur.portalUserId); if (pu && pu.name !== out.name) patch('users', pu.id, { name: out.name }); }
        log(ctx, 'client.update', 'Updated client profile: ' + out.name, { clientId: out.id });
        return out;
      }
      const lim = ctx.plan.limits || {};
      if (lim.clients && usage(ctx.firm.id).clients >= lim.clients) fail('Your plan allows ' + lim.clients + ' active clients. Archive a client or upgrade to add more.', 402, 'limit');
      const out = insert('clients', Object.assign({ firmId: ctx.firm.id, archived: false, portalUserId: null, createdBy: ctx.user.id }, clientFields(p)));
      log(ctx, 'client.create', 'Added client ' + out.name, { clientId: out.id });
      return out;
    });
    def('client.archive', FIRM, { write: true }, (ctx, p) => {
      const c = ctx.own('clients', p.id);
      const archived = V.bool(p.archived);
      if (!archived) { const lim = ctx.plan.limits || {}; if (lim.clients && usage(ctx.firm.id).clients >= lim.clients) fail('Your plan allows ' + lim.clients + ' active clients. Upgrade to restore this client.', 402, 'limit'); }
      const out = patch('clients', c.id, { archived });
      if (c.portalUserId && archived) { const pu = store.get('users', c.portalUserId); if (pu) patch('users', pu.id, { status: 'disabled' }); }
      log(ctx, archived ? 'client.archive' : 'client.restore', (archived ? 'Archived ' : 'Restored ') + c.name, { clientId: c.id });
      return out;
    });
    function purgeClient(c) {
      for (const col of ['docs', 'requests', 'filings', 'notices', 'tasks', 'invoices', 'payments', 'messages', 'vault', 'events']) for (const d of all(col).slice()) if (d.clientId === c.id && d.firmId === c.firmId) remove(col, d.id);
      for (const cm of all('comments').slice()) if (cm.clientId === c.id) remove('comments', cm.id);
      if (c.portalUserId) { remove('users', c.portalUserId); for (const n of all('notifications').slice()) if (n.userId === c.portalUserId) remove('notifications', n.id); }
      remove('clients', c.id);
    }
    def('client.delete', FIRM, { owner: true, write: true }, (ctx, p) => {
      const c = ctx.own('clients', p.id);
      if (V.str(p.confirm, 200) !== c.name) fail('Type the client name exactly to confirm.');
      purgeClient(c);
      log(ctx, 'client.delete', 'Deleted client ' + c.name + ' and all related records');
      return { ok: true };
    });
    def('client.import', FIRM, { write: true }, (ctx, p) => {
      const rows = Array.isArray(p.rows) ? p.rows.slice(0, 2000) : [];
      const lim = ctx.plan.limits || {};
      let room = lim.clients ? Math.max(0, lim.clients - usage(ctx.firm.id).clients) : Infinity;
      const existing = new Set(ctx.mine('clients').map((c) => (c.cnic || c.ntn || c.name).toLowerCase()));
      let created = 0, skipped = 0;
      const errors = [];
      rows.forEach((r, i) => {
        try {
          if (!r || !V.str(r.name)) { skipped++; return; }
          const key = (V.str(r.cnic) || V.str(r.ntn) || V.str(r.name)).toLowerCase();
          if (existing.has(key)) { skipped++; return; }
          if (room <= 0) { skipped++; errors.push('Row ' + (i + 2) + ': plan client limit reached'); return; }
          const type = /comp|ltd|pvt/i.test(r.type || '') ? 'company' : /aop|firm|partner/i.test(r.type || '') ? 'aop' : 'individual';
          const regs = String(r.registrations || '').toUpperCase().split(/[^A-Z]+/).filter((x) => C.AUTHORITIES.indexOf(x) >= 0);
          insert('clients', Object.assign({ firmId: ctx.firm.id, archived: false, portalUserId: null, createdBy: ctx.user.id }, clientFields(Object.assign({}, r, { type, registrations: regs, atl: /act|yes/i.test(r.atl || '') ? 'active' : /in|no/i.test(r.atl || '') ? 'inactive' : 'unknown' }))));
          existing.add(key); created++; room--;
        } catch (e) { skipped++; errors.push('Row ' + (i + 2) + ': ' + e.message); }
      });
      if (created) log(ctx, 'client.import', 'Imported ' + created + ' clients from CSV');
      return { created, skipped, errors: errors.slice(0, 20) };
    });
    def('portal.invite', FIRM, { write: true, feature: 'portal' }, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      if (c.archived) fail('Restore this client before giving portal access.');
      const email = V.email(p.email || c.email, true);
      const password = p.password ? V.password(p.password) : genPassword();
      let u = c.portalUserId ? store.get('users', c.portalUserId) : null;
      if (emailTaken(email, u ? u.id : null)) fail('Another FinTax login already uses this email. Use a different email for this client.', 409);
      let isNew = false;
      if (u) u = patch('users', u.id, { email, name: c.name, phone: c.phone, passwordHash: hasher.hash(password), status: 'active' });
      else {
        u = insert('users', { role: 'client', firmId: ctx.firm.id, clientId: c.id, name: c.name, email, phone: c.phone, passwordHash: hasher.hash(password), status: 'active' });
        patch('clients', c.id, { portalUserId: u.id, email: c.email || email });
        isNew = true;
      }
      for (const r of all('resets').filter((x) => x.userId === u.id && x.status === 'open')) patch('resets', r.id, { status: 'done' });
      log(ctx, 'portal.invite', (isNew ? 'Created portal login for ' : 'Reset portal password for ') + c.name, { clientId: c.id });
      return { email, password, isNew, name: c.name, phone: c.phone };
    });
    def('portal.toggle', FIRM, { write: true }, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      if (!c.portalUserId) fail('This client does not have a portal login yet.');
      const enabled = V.bool(p.enabled);
      patch('users', c.portalUserId, { status: enabled ? 'active' : 'disabled' });
      log(ctx, 'portal.toggle', (enabled ? 'Turned on' : 'Turned off') + ' portal access for ' + c.name, { clientId: c.id });
      return { ok: true };
    });

    /* =================================================================== *
     *  Documents, requests & comments
     * =================================================================== */
    const visibleToClient = (d) => d.shared || d.uploaderRole === 'client';
    function checkStorage(ctx, size) {
      const lim = ctx.plan.limits || {};
      if (lim.storageGB && usage(ctx.firm.id).storageBytes + (size || 0) > lim.storageGB * 1073741824) fail('Your plan storage of ' + lim.storageGB + ' GB is full. Remove old files or upgrade.', 402, 'limit');
    }
    def('docs.list', FIRM, {}, (ctx, p) => {
      const k = firmCaches(ctx);
      return ctx.mine('docs', (d) => !p.clientId || d.clientId === p.clientId).sort(U.by('createdAt', -1)).map((d) => docView(d, k.byId));
    });
    function docDetail(d, viewerRole) {
      const comments = all('comments').filter((c) => c.docId === d.id && (viewerRole !== 'client' || !c.internal)).sort(U.by('createdAt'));
      return { doc: docView(d), comments };
    }
    def('doc.get', ANY, {}, (ctx, p) => {
      if (ctx.user.role === 'admin') fail('Not available.', 403);
      if (ctx.user.role === 'client') {
        const d = ctx.clientOwn('docs', p.id);
        if (!visibleToClient(d)) fail('That document was not found.', 404);
        if (d.uploaderRole === 'firm' && !d.seenByClient) patch('docs', d.id, { seenByClient: true });
        return docDetail(store.get('docs', d.id), 'client');
      }
      const d = ctx.own('docs', p.id);
      if (d.uploaderRole === 'client' && !d.seenByFirm) patch('docs', d.id, { seenByFirm: true });
      return docDetail(store.get('docs', d.id), 'firm');
    });
    function fileFields(p) {
      return { name: V.req(p.name, 'File name', 200), mime: V.str(p.mime, 120) || 'application/octet-stream', size: Math.max(0, V.int(p.size)), blobId: V.str(p.blobId, 80) || null, demo: p.demo || null };
    }
    def('doc.create', FIRM, { write: true }, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      const f = fileFields(p);
      checkStorage(ctx, f.size);
      const wantApproval = V.bool(p.approval);
      const shared = V.bool(p.shared) || wantApproval;
      const d = insert('docs', Object.assign(f, {
        firmId: ctx.firm.id, clientId: c.id, category: V.oneOf(p.category, C.DOC_CATEGORIES, 'Other'), taxYear: V.int(p.taxYear) || U.taxYearOf(today()) - 1,
        note: V.text(p.note, 1000), uploadedBy: ctx.user.id, uploaderName: ctx.user.name, uploaderRole: 'firm', shared, seenByFirm: true, seenByClient: false,
        approval: wantApproval ? { status: 'pending', requestedAt: nowISO(), requestedBy: ctx.user.id, note: V.text(p.note, 1000) } : null, filingId: p.filingId || null,
      }));
      if (p.requestId) { const r = store.get('requests', p.requestId); if (r && r.firmId === ctx.firm.id) patch('requests', r.id, { status: 'fulfilled', docId: d.id, fulfilledAt: nowISO() }); }
      const pu = portalUser(c);
      if (pu && shared) notify([pu.id], { title: wantApproval ? 'Please review and approve: ' + d.name : 'New document shared: ' + d.name, body: ctx.firm.name, link: '/portal/documents?open=' + d.id, kind: wantApproval ? 'approval' : 'document' });
      log(ctx, 'doc.create', 'Uploaded ' + d.name + (wantApproval ? ' for client approval' : shared ? ' and shared it' : ''), { clientId: c.id, docId: d.id });
      return docView(d);
    });
    def('doc.update', FIRM, { write: true }, (ctx, p) => {
      const d = ctx.own('docs', p.id);
      const changes = {};
      if (p.name !== undefined) changes.name = V.req(p.name, 'File name', 200);
      if (p.category !== undefined) changes.category = V.oneOf(p.category, C.DOC_CATEGORIES, d.category);
      if (p.taxYear !== undefined) changes.taxYear = V.int(p.taxYear) || d.taxYear;
      if (p.note !== undefined) changes.note = V.text(p.note, 1000);
      if (p.shared !== undefined) changes.shared = V.bool(p.shared) || !!(d.approval && d.approval.status === 'pending');
      const out = patch('docs', d.id, changes);
      if (changes.shared && !d.shared) { const pu = portalUser(store.get('clients', d.clientId)); if (pu) notify([pu.id], { title: 'New document shared: ' + out.name, body: ctx.firm.name, link: '/portal/documents?open=' + d.id, kind: 'document' }); }
      log(ctx, 'doc.update', 'Updated document ' + out.name, { clientId: d.clientId, docId: d.id });
      return docView(out);
    });
    def('doc.requestApproval', FIRM, { write: true }, (ctx, p) => {
      const d = ctx.own('docs', p.id);
      const out = patch('docs', d.id, { shared: true, approval: { status: 'pending', requestedAt: nowISO(), requestedBy: ctx.user.id, note: V.text(p.note, 1000) } });
      const pu = portalUser(store.get('clients', d.clientId));
      if (pu) notify([pu.id], { title: 'Please review and approve: ' + d.name, body: V.str(p.note, 140) || ctx.firm.name, link: '/portal/documents?open=' + d.id, kind: 'approval' });
      if (p.note) insert('comments', { firmId: ctx.firm.id, clientId: d.clientId, docId: d.id, userId: ctx.user.id, name: ctx.user.name, role: 'firm', text: V.text(p.note, 2000), kind: 'request' });
      log(ctx, 'doc.approval', 'Sent ' + d.name + ' to the client for approval', { clientId: d.clientId, docId: d.id });
      return docView(out);
    });
    def('doc.delete', FIRM, { write: true }, (ctx, p) => {
      const d = ctx.own('docs', p.id);
      remove('docs', d.id);
      for (const cm of all('comments').slice()) if (cm.docId === d.id) remove('comments', cm.id);
      log(ctx, 'doc.delete', 'Deleted document ' + d.name, { clientId: d.clientId });
      return { ok: true, blobId: d.blobId };
    });
    def('doc.comment', ['consultant', 'staff', 'client'], { write: true }, (ctx, p) => {
      const isClient = ctx.user.role === 'client';
      const d = isClient ? ctx.clientOwn('docs', p.id) : ctx.own('docs', p.id);
      if (isClient && !visibleToClient(d)) fail('That document was not found.', 404);
      const text = V.req(p.text, 'Comment', 3000);
      const internal = !isClient && V.bool(p.internal);
      const cm = insert('comments', { firmId: d.firmId, clientId: d.clientId, docId: d.id, userId: ctx.user.id, name: ctx.user.name, role: isClient ? 'client' : 'firm', text, internal, kind: 'comment' });
      const c = store.get('clients', d.clientId);
      if (isClient) notify(firmTeamIds(d.firmId), { title: c.name + ' commented on ' + d.name, body: text.slice(0, 140), link: '/app/clients/' + c.id + '/documents?open=' + d.id, kind: 'comment' });
      else if (!internal) { const pu = portalUser(c); if (pu && visibleToClient(d)) notify([pu.id], { title: ctx.firm.name + ' commented on ' + d.name, body: text.slice(0, 140), link: '/portal/documents?open=' + d.id, kind: 'comment' }); }
      log(ctx, 'doc.comment', (isClient ? c.name : ctx.user.name) + ' commented on ' + d.name, { clientId: d.clientId, docId: d.id });
      return cm;
    });
    def('doc.decide', CLIENT, { write: true }, (ctx, p) => {
      const d = ctx.clientOwn('docs', p.id);
      if (!d.approval || d.approval.status !== 'pending') fail('This document is not waiting for your approval.');
      const decision = V.oneOf(p.decision, ['approved', 'changes'], null);
      if (!decision) fail('Choose approve or request changes.');
      const note = V.text(p.note, 2000);
      if (decision === 'changes' && !note) fail('Tell your consultant what needs to change.');
      const out = patch('docs', d.id, { approval: Object.assign({}, d.approval, { status: decision, decidedAt: nowISO(), decidedBy: ctx.user.id, decisionNote: note }) });
      if (note) insert('comments', { firmId: d.firmId, clientId: d.clientId, docId: d.id, userId: ctx.user.id, name: ctx.user.name, role: 'client', text: note, kind: decision === 'approved' ? 'approved' : 'changes' });
      if (d.filingId) {
        const f = store.get('filings', d.filingId);
        if (f && f.firmId === d.firmId && f.stage === 'client_approval') patch('filings', f.id, { stage: decision === 'approved' ? 'ready' : 'in_progress', clientDecision: { status: decision, note, at: nowISO() } });
      }
      notify(firmTeamIds(d.firmId), { title: ctx.client.name + (decision === 'approved' ? ' approved ' : ' requested changes on ') + d.name, body: note.slice(0, 140), link: '/app/clients/' + d.clientId + '/documents?open=' + d.id, kind: decision === 'approved' ? 'success' : 'warning' });
      log(ctx, 'doc.decide', ctx.client.name + (decision === 'approved' ? ' approved ' : ' requested changes on ') + d.name, { clientId: d.clientId, docId: d.id });
      return docView(out);
    });
    def('requests.list', FIRM, {}, (ctx, p) => {
      const k = firmCaches(ctx);
      return ctx.mine('requests', (r) => !p.clientId || r.clientId === p.clientId).sort(U.by('createdAt', -1)).map((r) => Object.assign({}, r, { clientName: k.byId[r.clientId] ? k.byId[r.clientId].name : '' }));
    });
    def('request.save', FIRM, { write: true }, (ctx, p) => {
      const items = (Array.isArray(p.titles) ? p.titles : [p.title]).map((t) => V.str(t, 160)).filter(Boolean);
      if (!items.length) fail('Add at least one document to request.');
      const c = ctx.own('clients', p.clientId);
      if (p.id) { const r = ctx.own('requests', p.id); return patch('requests', r.id, { title: items[0], note: V.text(p.note, 1000), dueDate: V.date(p.dueDate) }); }
      const created = items.map((title) => insert('requests', { firmId: ctx.firm.id, clientId: c.id, title, note: V.text(p.note, 1000), dueDate: V.date(p.dueDate), status: 'open', requestedBy: ctx.user.id }));
      const pu = portalUser(c);
      if (pu) notify([pu.id], { title: created.length === 1 ? 'Document requested: ' + created[0].title : created.length + ' documents requested', body: ctx.firm.name + (p.dueDate ? ', needed by ' + V.date(p.dueDate) : ''), link: '/portal/documents?tab=requests', kind: 'request' });
      log(ctx, 'request.create', 'Requested ' + items.join(', ') + ' from ' + c.name, { clientId: c.id });
      return created;
    });
    def('request.update', FIRM, { write: true }, (ctx, p) => {
      const r = ctx.own('requests', p.id);
      return patch('requests', r.id, { status: V.oneOf(p.status, ['open', 'fulfilled', 'cancelled'], r.status) });
    });
    def('request.delete', FIRM, { write: true }, (ctx, p) => { const r = ctx.own('requests', p.id); remove('requests', r.id); return { ok: true }; });

    /* =================================================================== *
     *  Filings
     * =================================================================== */
    def('filings.list', FIRM, {}, (ctx, p) => {
      const k = firmCaches(ctx);
      return ctx.mine('filings', (f) => !p.clientId || f.clientId === p.clientId).map((f) => filingView(f, k.byId)).sort(U.by((f) => f.dueDate || '9999'));
    });
    function filingFields(ctx, p, cur) {
      cur = cur || {};
      const type = V.oneOf(p.type, C.FILING_TYPES.map((x) => x.id), cur.type || 'itr');
      const def0 = C.FILING_TYPES.find((x) => x.id === type);
      let assignedTo = p.assignedTo !== undefined ? V.str(p.assignedTo, 40) : (cur.assignedTo || '');
      if (assignedTo) { const a = store.get('users', assignedTo); if (!a || a.firmId !== ctx.firm.id) assignedTo = ''; }
      return {
        type, authority: V.oneOf(p.authority, C.AUTHORITIES, cur.authority || def0.authority), taxYear: V.int(p.taxYear) || cur.taxYear || U.taxYearOf(today()) - 1,
        period: V.str(p.period, 20), dueDate: V.date(p.dueDate), stage: V.oneOf(p.stage, C.STAGES.map((s) => s.id), cur.stage || 'not_started'),
        assignedTo, taxPayable: V.money(p.taxPayable), refund: V.money(p.refund), ackNumber: V.str(p.ackNumber, 60), fee: V.money(p.fee), notes: V.text(p.notes, 3000),
      };
    }
    function onStageChange(ctx, before, after) {
      if (before.stage === after.stage) return after;
      const changes = {};
      if (after.stage === 'filed' && !after.filedAt) changes.filedAt = nowISO();
      if (after.stage !== 'filed' && before.stage === 'filed') changes.filedAt = null;
      const out = Object.keys(changes).length ? patch('filings', after.id, changes) : after;
      const c = store.get('clients', out.clientId);
      const pu = portalUser(c);
      const what = C.filingLabel(out.type) + ' (' + U.periodLabel(out.period, out.taxYear) + ')';
      if (pu && out.stage === 'filed') notify([pu.id], { title: 'Filed: ' + what, body: out.ackNumber ? 'Acknowledgement ' + out.ackNumber : ctx.firm.name, link: '/portal/filings', kind: 'success' });
      if (pu && out.stage === 'awaiting_docs' && before.stage !== 'awaiting_docs') notify([pu.id], { title: 'Documents needed for your ' + what, body: 'Open your requests to see what to upload.', link: '/portal/documents?tab=requests', kind: 'request' });
      log(ctx, 'filing.stage', what + ' for ' + (c ? c.name : '') + ' moved to ' + C.stageLabel(out.stage), { clientId: out.clientId, filingId: out.id });
      return out;
    }
    def('filing.save', FIRM, { write: true }, (ctx, p) => {
      if (p.id) {
        const cur = ctx.own('filings', p.id);
        const next = patch('filings', cur.id, filingFields(ctx, p, cur));
        return filingView(onStageChange(ctx, cur, next));
      }
      const c = ctx.own('clients', p.clientId);
      const f = insert('filings', Object.assign({ firmId: ctx.firm.id, clientId: c.id, createdBy: ctx.user.id, filedAt: null }, filingFields(ctx, p)));
      if (f.stage === 'filed') patch('filings', f.id, { filedAt: nowISO() });
      log(ctx, 'filing.create', 'Opened ' + C.filingLabel(f.type) + ' (' + U.periodLabel(f.period, f.taxYear) + ') for ' + c.name, { clientId: c.id, filingId: f.id });
      return filingView(store.get('filings', f.id));
    });
    def('filing.move', FIRM, { write: true }, (ctx, p) => {
      const cur = ctx.own('filings', p.id);
      const stage = V.oneOf(p.stage, C.STAGES.map((s) => s.id), null);
      if (!stage) fail('Unknown stage.');
      const changes = { stage };
      if (p.ackNumber !== undefined) changes.ackNumber = V.str(p.ackNumber, 60);
      const next = patch('filings', cur.id, changes);
      return filingView(onStageChange(ctx, cur, next));
    });
    def('filing.delete', FIRM, { write: true }, (ctx, p) => {
      const f = ctx.own('filings', p.id);
      remove('filings', f.id);
      log(ctx, 'filing.delete', 'Removed ' + C.filingLabel(f.type) + ' (' + U.periodLabel(f.period, f.taxYear) + ')', { clientId: f.clientId });
      return { ok: true };
    });
    def('filing.requestApproval', FIRM, { write: true }, (ctx, p) => {
      const f = ctx.own('filings', p.id);
      const c = store.get('clients', f.clientId);
      if (p.docId) { const d = ctx.own('docs', p.docId); patch('docs', d.id, { shared: true, filingId: f.id, approval: { status: 'pending', requestedAt: nowISO(), requestedBy: ctx.user.id, note: V.text(p.note, 1000) } }); }
      const out = patch('filings', f.id, { stage: 'client_approval', approvalNote: V.text(p.note, 1000), approvalDocId: p.docId || null, clientDecision: null });
      const pu = portalUser(c);
      if (pu) notify([pu.id], { title: 'Please approve your ' + C.filingLabel(f.type) + ' (' + U.periodLabel(f.period, f.taxYear) + ')', body: V.str(p.note, 140) || 'Review the draft and approve it, or tell us what to change.', link: '/portal/filings', kind: 'approval' });
      log(ctx, 'filing.approval', 'Sent ' + C.filingLabel(f.type) + ' to ' + c.name + ' for approval', { clientId: c.id, filingId: f.id });
      return filingView(out);
    });
    def('filing.decide', CLIENT, { write: true }, (ctx, p) => {
      const f = ctx.clientOwn('filings', p.id);
      if (f.stage !== 'client_approval') fail('This return is not waiting for your approval.');
      const decision = V.oneOf(p.decision, ['approved', 'changes'], null);
      if (!decision) fail('Choose approve or request changes.');
      const note = V.text(p.note, 2000);
      if (decision === 'changes' && !note) fail('Tell your consultant what needs to change.');
      const out = patch('filings', f.id, { stage: decision === 'approved' ? 'ready' : 'in_progress', clientDecision: { status: decision, note, at: nowISO() } });
      if (f.approvalDocId) { const d = store.get('docs', f.approvalDocId); if (d && d.approval && d.approval.status === 'pending') patch('docs', d.id, { approval: Object.assign({}, d.approval, { status: decision, decidedAt: nowISO(), decidedBy: ctx.user.id, decisionNote: note }) }); }
      const what = C.filingLabel(f.type) + ' (' + U.periodLabel(f.period, f.taxYear) + ')';
      notify(firmTeamIds(f.firmId), { title: ctx.client.name + (decision === 'approved' ? ' approved the ' : ' requested changes to the ') + what, body: note.slice(0, 140), link: '/app/filings?open=' + f.id, kind: decision === 'approved' ? 'success' : 'warning' });
      log(ctx, 'filing.decide', ctx.client.name + (decision === 'approved' ? ' approved ' : ' requested changes to ') + what, { clientId: f.clientId, filingId: f.id });
      return filingView(out);
    });
    def('filing.bulk', FIRM, { write: true, feature: 'bulk' }, (ctx, p) => {
      const type = V.oneOf(p.type, C.FILING_TYPES.map((x) => x.id), 'stx');
      const authority = V.oneOf(p.authority, C.AUTHORITIES, 'FBR');
      const period = V.str(p.period, 20);
      const dueDate = V.date(p.dueDate);
      const ids = V.arr(p.clientIds);
      if (!ids.length) fail('Choose at least one client.');
      let created = 0, skipped = 0;
      for (const id of ids) {
        const c = store.get('clients', id);
        if (!c || c.firmId !== ctx.firm.id) { skipped++; continue; }
        if (ctx.mine('filings', (f) => f.clientId === c.id && f.type === type && f.authority === authority && f.period === period && f.taxYear === (V.int(p.taxYear) || f.taxYear)).length) { skipped++; continue; }
        insert('filings', { firmId: ctx.firm.id, clientId: c.id, createdBy: ctx.user.id, type, authority, taxYear: V.int(p.taxYear) || U.taxYearOf(today()), period, dueDate, stage: 'not_started', assignedTo: c.assignedTo || '', taxPayable: 0, refund: 0, ackNumber: '', fee: 0, notes: '', filedAt: null });
        created++;
      }
      log(ctx, 'filing.bulk', 'Created ' + created + ' ' + C.filingLabel(type) + ' records for ' + U.periodLabel(period, p.taxYear));
      return { created, skipped };
    });

    /* =================================================================== *
     *  Notices & tasks & events
     * =================================================================== */
    def('notices.list', FIRM, {}, (ctx, p) => { const k = firmCaches(ctx); return ctx.mine('notices', (n) => !p.clientId || n.clientId === p.clientId).map((n) => noticeView(n, k.byId)).sort(U.by((n) => (n.status === 'closed' ? '2' : '1') + (n.dueDate || '9999'))); });
    def('notice.save', FIRM, { write: true }, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      let assignedTo = V.str(p.assignedTo, 40);
      if (assignedTo) { const a = store.get('users', assignedTo); if (!a || a.firmId !== ctx.firm.id) assignedTo = ''; }
      const doc = { clientId: c.id, authority: V.oneOf(p.authority, C.AUTHORITIES, 'FBR'), section: V.oneOf(p.section, C.NOTICE_SECTIONS.map((x) => x.id), 'other'), title: V.str(p.title, 160), noticeNo: V.str(p.noticeNo, 60), taxYear: V.int(p.taxYear) || '', issueDate: V.date(p.issueDate), receivedDate: V.date(p.receivedDate), dueDate: V.date(p.dueDate), hearingDate: V.date(p.hearingDate), status: V.oneOf(p.status, C.NOTICE_STATUS.map((x) => x.id), 'received'), amount: V.money(p.amount), priority: V.oneOf(p.priority, C.PRIORITIES.map((x) => x.id), 'high'), assignedTo, notes: V.text(p.notes, 4000), visibleToClient: p.visibleToClient === undefined ? true : V.bool(p.visibleToClient) };
      if (p.id) { const cur = ctx.own('notices', p.id); const out = patch('notices', cur.id, doc); log(ctx, 'notice.update', 'Updated notice ' + C.sectionLabel(out.section) + ' for ' + c.name + ' (' + C.noticeStatusLabel(out.status) + ')', { clientId: c.id }); return noticeView(out); }
      const out = insert('notices', Object.assign({ firmId: ctx.firm.id, createdBy: ctx.user.id }, doc));
      const pu = portalUser(c);
      if (pu && out.visibleToClient) notify([pu.id], { title: 'We are handling a notice for you: ' + C.sectionLabel(out.section), body: out.dueDate ? 'Reply due ' + out.dueDate : ctx.firm.name, link: '/portal/notices', kind: 'notice' });
      log(ctx, 'notice.create', 'Logged notice ' + C.sectionLabel(out.section) + ' for ' + c.name, { clientId: c.id });
      return noticeView(out);
    });
    def('notice.delete', FIRM, { write: true }, (ctx, p) => { const n = ctx.own('notices', p.id); remove('notices', n.id); log(ctx, 'notice.delete', 'Removed notice ' + C.sectionLabel(n.section), { clientId: n.clientId }); return { ok: true }; });
    def('tasks.list', FIRM, {}, (ctx, p) => { const k = firmCaches(ctx); return ctx.mine('tasks', (t) => !p.clientId || t.clientId === p.clientId).map((t) => taskView(t, k.byId)).sort(U.by((t) => (t.status === 'done' ? '2' : '1') + (t.dueDate || '9999'))); });
    def('task.save', FIRM, { write: true }, (ctx, p) => {
      let clientId = V.str(p.clientId, 40);
      if (clientId) ctx.own('clients', clientId);
      let assignedTo = V.str(p.assignedTo, 40);
      if (assignedTo) { const a = store.get('users', assignedTo); if (!a || a.firmId !== ctx.firm.id) assignedTo = ''; }
      const doc = { title: V.req(p.title, 'Task', 200), notes: V.text(p.notes, 2000), clientId: clientId || null, dueDate: V.date(p.dueDate), priority: V.oneOf(p.priority, C.PRIORITIES.map((x) => x.id), 'normal'), assignedTo: assignedTo || ctx.user.id, status: V.oneOf(p.status, ['todo', 'doing', 'done'], 'todo') };
      if (p.id) { const cur = ctx.own('tasks', p.id); const out = patch('tasks', cur.id, Object.assign(doc, { doneAt: doc.status === 'done' ? (cur.doneAt || nowISO()) : null })); if (out.assignedTo !== cur.assignedTo && out.assignedTo !== ctx.user.id) notify([out.assignedTo], { title: ctx.user.name + ' assigned you a task', body: out.title, link: '/app/tasks', kind: 'task' }); return taskView(out); }
      const out = insert('tasks', Object.assign({ firmId: ctx.firm.id, createdBy: ctx.user.id, doneAt: null }, doc));
      if (out.assignedTo !== ctx.user.id) notify([out.assignedTo], { title: ctx.user.name + ' assigned you a task', body: out.title, link: '/app/tasks', kind: 'task' });
      return taskView(out);
    });
    def('task.toggle', FIRM, { write: true }, (ctx, p) => { const t = ctx.own('tasks', p.id); const done = t.status !== 'done'; const out = patch('tasks', t.id, { status: done ? 'done' : 'todo', doneAt: done ? nowISO() : null }); if (done) log(ctx, 'task.done', ctx.user.name + ' completed: ' + t.title, { clientId: t.clientId || null }); return taskView(out); });
    def('task.delete', FIRM, { write: true }, (ctx, p) => { const t = ctx.own('tasks', p.id); remove('tasks', t.id); return { ok: true }; });
    def('event.save', FIRM, { write: true }, (ctx, p) => {
      const doc = { title: V.req(p.title, 'Title', 160), date: V.date(p.date) || fail('Pick a date.'), time: V.str(p.time, 5), clientId: p.clientId ? ctx.own('clients', p.clientId).id : null, notes: V.text(p.notes, 1000) };
      if (p.id) { const cur = ctx.own('events', p.id); return patch('events', cur.id, doc); }
      return insert('events', Object.assign({ firmId: ctx.firm.id, createdBy: ctx.user.id }, doc));
    });
    def('event.delete', FIRM, { write: true }, (ctx, p) => { const e = ctx.own('events', p.id); remove('events', e.id); return { ok: true }; });
    def('calendar', FIRM, {}, (ctx, p) => {
      const from = V.date(p.from) || U.addDays(today(), -31), to = V.date(p.to) || U.addDays(today(), 62);
      const k = firmCaches(ctx);
      const out = [];
      for (const d of complianceDeadlines(from, to)) out.push({ date: d.date, kind: 'deadline', title: d.title, sub: d.forPeriod || d.note, authority: d.authority, featured: !!d.featured });
      for (const f of ctx.mine('filings')) if (f.dueDate && f.dueDate >= from && f.dueDate <= to) out.push({ date: f.dueDate, kind: 'filing', title: C.filingLabel(f.type) + ', ' + U.periodLabel(f.period, f.taxYear), sub: k.byId[f.clientId] ? k.byId[f.clientId].name : '', id: f.id, clientId: f.clientId, done: f.stage === 'filed' });
      for (const n of ctx.mine('notices')) {
        if (n.dueDate && n.dueDate >= from && n.dueDate <= to) out.push({ date: n.dueDate, kind: 'notice', title: 'Reply due: ' + C.sectionLabel(n.section), sub: k.byId[n.clientId] ? k.byId[n.clientId].name : '', id: n.id, clientId: n.clientId, done: n.status === 'closed' || n.status === 'responded' });
        if (n.hearingDate && n.hearingDate >= from && n.hearingDate <= to) out.push({ date: n.hearingDate, kind: 'hearing', title: 'Hearing: ' + C.sectionLabel(n.section), sub: k.byId[n.clientId] ? k.byId[n.clientId].name : '', id: n.id, clientId: n.clientId, done: n.status === 'closed' });
      }
      for (const t of ctx.mine('tasks')) if (t.dueDate && t.dueDate >= from && t.dueDate <= to) out.push({ date: t.dueDate, kind: 'task', title: t.title, sub: t.clientId && k.byId[t.clientId] ? k.byId[t.clientId].name : '', id: t.id, done: t.status === 'done' });
      for (const e of ctx.mine('events')) if (e.date >= from && e.date <= to) out.push({ date: e.date, kind: 'event', title: e.title, sub: (e.time ? e.time + ' ' : '') + (e.clientId && k.byId[e.clientId] ? k.byId[e.clientId].name : ''), id: e.id, time: e.time, notes: e.notes, clientId: e.clientId });
      for (const i of ctx.mine('invoices')) { if (!i.dueDate || i.dueDate < from || i.dueDate > to) continue; const calc = invoiceCalc(i, k.pays); if (['sent', 'partial', 'overdue'].indexOf(calc.status) >= 0) out.push({ date: i.dueDate, kind: 'invoice', title: 'Invoice ' + i.number + ' due', sub: (k.byId[i.clientId] ? k.byId[i.clientId].name : '') + ', Rs ' + Math.round(calc.balance).toLocaleString('en-US'), id: i.id }); }
      return out.sort(U.by('date'));
    });

    /* =================================================================== *
     *  Invoices, payments, expenses
     * =================================================================== */
    def('invoices.list', FIRM, {}, (ctx, p) => { const k = firmCaches(ctx); return ctx.mine('invoices', (i) => !p.clientId || i.clientId === p.clientId).map((i) => invoiceView(i, k.pays, k.byId)).sort(U.by('issueDate', -1)); });
    def('invoice.get', FIRM, {}, (ctx, p) => {
      const i = ctx.own('invoices', p.id);
      const pays = ctx.mine('payments');
      return { invoice: invoiceView(i, pays), payments: pays.filter((x) => x.invoiceId === i.id).sort(U.by('date')), client: store.get('clients', i.clientId), firm: ctx.firm, features: ctx.features };
    });
    def('invoice.save', FIRM, { write: true }, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      const items = (Array.isArray(p.items) ? p.items : []).map((x) => ({ desc: V.str(x.desc, 200), qty: Math.max(0, V.num(x.qty, 1)), rate: V.money(x.rate) })).filter((x) => x.desc && x.qty > 0);
      if (!items.length) fail('Add at least one line with a description and amount.');
      const doc = { clientId: c.id, issueDate: V.date(p.issueDate) || today(), dueDate: V.date(p.dueDate) || U.addDays(today(), V.int(ctx.firm.paymentTerms, 7) || 7), items, taxRate: Math.max(0, Math.min(100, V.num(p.taxRate))), taxLabel: V.str(p.taxLabel, 60), discount: V.money(p.discount), notes: V.text(p.notes, 2000) };
      if (p.id) {
        const cur = ctx.own('invoices', p.id);
        if (cur.status === 'cancelled') fail('Cancelled invoices cannot be edited.');
        const out = patch('invoices', cur.id, doc);
        log(ctx, 'invoice.update', 'Updated invoice ' + out.number, { clientId: c.id });
        return invoiceView(out, ctx.mine('payments'));
      }
      const seq = (V.int(ctx.firm.invoiceSeq) || 0) + 1;
      patch('firms', ctx.firm.id, { invoiceSeq: seq });
      const number = (ctx.firm.invoicePrefix || 'INV') + '-' + today().slice(0, 4) + '-' + pad(seq, 4);
      const send = V.bool(p.send);
      const out = insert('invoices', Object.assign({ firmId: ctx.firm.id, number, status: send ? 'sent' : 'draft', sentAt: send ? nowISO() : null, createdBy: ctx.user.id }, doc));
      if (send) { const pu = portalUser(c); if (pu) notify([pu.id], { title: 'New invoice ' + number + ' from ' + ctx.firm.name, body: 'Due ' + out.dueDate, link: '/portal/invoices?open=' + out.id, kind: 'invoice' }); }
      log(ctx, 'invoice.create', (send ? 'Sent' : 'Drafted') + ' invoice ' + number + ' to ' + c.name, { clientId: c.id });
      return invoiceView(out, ctx.mine('payments'));
    });
    def('invoice.send', FIRM, { write: true }, (ctx, p) => {
      const i = ctx.own('invoices', p.id);
      if (i.status === 'cancelled') fail('This invoice is cancelled.');
      const out = patch('invoices', i.id, { status: 'sent', sentAt: i.sentAt || nowISO() });
      const pu = portalUser(store.get('clients', i.clientId));
      if (pu) notify([pu.id], { title: (i.status === 'draft' ? 'New invoice ' : 'Reminder: invoice ') + i.number + ' from ' + ctx.firm.name, body: 'Due ' + i.dueDate, link: '/portal/invoices?open=' + i.id, kind: 'invoice' });
      log(ctx, 'invoice.send', (i.status === 'draft' ? 'Sent' : 'Sent a reminder for') + ' invoice ' + i.number, { clientId: i.clientId });
      return invoiceView(out, ctx.mine('payments'));
    });
    def('invoice.cancel', FIRM, { write: true }, (ctx, p) => { const i = ctx.own('invoices', p.id); const out = patch('invoices', i.id, { status: 'cancelled' }); log(ctx, 'invoice.cancel', 'Cancelled invoice ' + i.number, { clientId: i.clientId }); return invoiceView(out, ctx.mine('payments')); });
    def('invoice.delete', FIRM, { owner: true, write: true }, (ctx, p) => {
      const i = ctx.own('invoices', p.id);
      if (ctx.mine('payments', (x) => x.invoiceId === i.id && x.status === 'confirmed').length) fail('This invoice has payments recorded. Cancel it instead of deleting it.');
      remove('invoices', i.id);
      for (const x of ctx.mine('payments', (y) => y.invoiceId === i.id)) remove('payments', x.id);
      log(ctx, 'invoice.delete', 'Deleted invoice ' + i.number, { clientId: i.clientId });
      return { ok: true };
    });
    def('payments.list', FIRM, {}, (ctx) => { const k = firmCaches(ctx); const invs = mapById(ctx.mine('invoices')); return ctx.mine('payments').map((x) => Object.assign({}, x, { clientName: k.byId[x.clientId] ? k.byId[x.clientId].name : '', invoiceNumber: invs[x.invoiceId] ? invs[x.invoiceId].number : '' })).sort(U.by((x) => (x.status === 'pending' ? '0' : '1') + (9e12 - Date.parse(x.date + 'T00:00:00Z')))); });
    def('payment.record', FIRM, { write: true }, (ctx, p) => {
      const i = ctx.own('invoices', p.invoiceId);
      if (i.status === 'cancelled') fail('This invoice is cancelled.');
      const amount = V.money(p.amount);
      if (!amount) fail('Enter the amount received.');
      const pay = insert('payments', { firmId: ctx.firm.id, clientId: i.clientId, invoiceId: i.id, amount, method: V.oneOf(p.method, C.PAY_METHODS, 'Bank transfer'), reference: V.str(p.reference, 80), date: V.date(p.date) || today(), status: 'confirmed', recordedBy: ctx.user.id, note: V.text(p.note, 500) });
      if (i.status === 'draft') patch('invoices', i.id, { status: 'sent', sentAt: nowISO() });
      const pu = portalUser(store.get('clients', i.clientId));
      if (pu) notify([pu.id], { title: 'Payment received: Rs ' + amount.toLocaleString('en-US'), body: 'Invoice ' + i.number + '. Thank you.', link: '/portal/invoices?open=' + i.id, kind: 'success' });
      log(ctx, 'payment.record', 'Recorded Rs ' + amount.toLocaleString('en-US') + ' against ' + i.number, { clientId: i.clientId });
      return pay;
    });
    def('payment.confirm', FIRM, { write: true }, (ctx, p) => {
      const x = ctx.own('payments', p.id);
      if (x.status !== 'pending') fail('This payment is already confirmed.');
      const out = patch('payments', x.id, { status: 'confirmed', confirmedBy: ctx.user.id, confirmedAt: nowISO() });
      const i = store.get('invoices', x.invoiceId);
      const pu = portalUser(store.get('clients', x.clientId));
      if (pu) notify([pu.id], { title: 'Payment confirmed: Rs ' + x.amount.toLocaleString('en-US'), body: i ? 'Invoice ' + i.number : '', link: '/portal/invoices', kind: 'success' });
      log(ctx, 'payment.confirm', 'Confirmed client payment of Rs ' + x.amount.toLocaleString('en-US') + (i ? ' for ' + i.number : ''), { clientId: x.clientId });
      return out;
    });
    def('payment.reject', FIRM, { write: true }, (ctx, p) => {
      const x = ctx.own('payments', p.id);
      if (x.status !== 'pending') fail('Only unconfirmed payments can be rejected.');
      const note = V.req(p.note, 'A reason for the client', 300);
      const out = patch('payments', x.id, { status: 'rejected', note });
      const pu = portalUser(store.get('clients', x.clientId));
      if (pu) notify([pu.id], { title: 'We could not match your payment', body: note, link: '/portal/invoices', kind: 'warning' });
      return out;
    });
    def('payment.delete', FIRM, { owner: true, write: true }, (ctx, p) => { const x = ctx.own('payments', p.id); remove('payments', x.id); log(ctx, 'payment.delete', 'Deleted a payment of Rs ' + x.amount.toLocaleString('en-US'), { clientId: x.clientId }); return { ok: true }; });
    def('expenses.list', FIRM, { owner: true }, (ctx) => ctx.mine('expenses').sort(U.by('date', -1)));
    def('expense.save', FIRM, { owner: true, write: true }, (ctx, p) => {
      const doc = { date: V.date(p.date) || today(), category: V.oneOf(p.category, C.EXPENSE_CATEGORIES, 'Other'), description: V.req(p.description, 'Description', 200), amount: V.money(p.amount), method: V.oneOf(p.method, C.PAY_METHODS, 'Bank transfer') };
      if (!doc.amount) fail('Enter the amount.');
      if (p.id) { const cur = ctx.own('expenses', p.id); return patch('expenses', cur.id, doc); }
      return insert('expenses', Object.assign({ firmId: ctx.firm.id, createdBy: ctx.user.id }, doc));
    });
    def('expense.delete', FIRM, { owner: true, write: true }, (ctx, p) => { const e = ctx.own('expenses', p.id); remove('expenses', e.id); return { ok: true }; });

    /* =================================================================== *
     *  Messages
     * =================================================================== */
    def('threads.list', FIRM, {}, (ctx) => {
      const msgs = ctx.mine('messages');
      return ctx.mine('clients', (c) => !c.archived).map((c) => {
        const mine = msgs.filter((m) => m.clientId === c.id).sort(U.by('createdAt'));
        const last = mine[mine.length - 1] || null;
        return { clientId: c.id, name: c.name, type: c.type, phone: c.phone, hasPortal: !!portalUser(c), last, unread: mine.filter((m) => m.role === 'client' && !m.readByFirm).length };
      }).sort((a, b) => (b.last ? b.last.createdAt : '').localeCompare(a.last ? a.last.createdAt : '') || a.name.localeCompare(b.name));
    });
    def('messages.list', FIRM, {}, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      const msgs = ctx.mine('messages', (m) => m.clientId === c.id).sort(U.by('createdAt'));
      for (const m of msgs) if (m.role === 'client' && !m.readByFirm) patch('messages', m.id, { readByFirm: true });
      return { client: { id: c.id, name: c.name, phone: c.phone, hasPortal: !!portalUser(c) }, messages: msgs.map((m) => Object.assign({}, m, { readByFirm: true })) };
    });
    def('message.send', FIRM, { write: true }, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      const text = V.req(p.text, 'Message', 4000);
      const m = insert('messages', { firmId: ctx.firm.id, clientId: c.id, userId: ctx.user.id, name: ctx.user.name, role: 'firm', text, readByFirm: true, readByClient: false });
      const pu = portalUser(c);
      if (pu) notify([pu.id], { title: 'New message from ' + ctx.firm.name, body: text.slice(0, 140), link: '/portal/messages', kind: 'message' });
      return m;
    });

    /* =================================================================== *
     *  Credentials vault
     * =================================================================== */
    def('vault.list', FIRM, { feature: 'vault' }, (ctx, p) => ctx.mine('vault', (v) => v.clientId === p.clientId).map((v) => ({ id: v.id, clientId: v.clientId, portal: v.portal, username: v.username, hasSecret: !!v.secret, hasPin: !!v.pin, notes: v.notes, updatedAt: v.updatedAt, lastRevealedAt: v.lastRevealedAt || null, lastRevealedBy: v.lastRevealedBy ? userName(v.lastRevealedBy) : '' })));
    def('vault.save', FIRM, { write: true, feature: 'vault' }, (ctx, p) => {
      const c = ctx.own('clients', p.clientId);
      const doc = { clientId: c.id, portal: V.oneOf(p.portal, C.VAULT_PORTALS, 'Other portal'), username: V.req(p.username, 'Username', 120), notes: V.text(p.notes, 500) };
      if (p.secret) doc.secret = cipher.encrypt(String(p.secret).slice(0, 200));
      if (p.pin) doc.pin = cipher.encrypt(String(p.pin).slice(0, 40));
      const out = p.id ? patch('vault', ctx.own('vault', p.id).id, doc) : insert('vault', Object.assign({ firmId: ctx.firm.id, createdBy: ctx.user.id }, doc));
      log(ctx, 'vault.save', 'Saved ' + doc.portal + ' login for ' + c.name, { clientId: c.id });
      return { id: out.id };
    });
    def('vault.reveal', FIRM, { feature: 'vault' }, (ctx, p) => {
      const v = ctx.own('vault', p.id);
      patch('vault', v.id, { lastRevealedAt: nowISO(), lastRevealedBy: ctx.user.id });
      const c = store.get('clients', v.clientId);
      log(ctx, 'vault.reveal', ctx.user.name + ' viewed the ' + v.portal + ' password for ' + (c ? c.name : ''), { clientId: v.clientId });
      return { secret: cipher.decrypt(v.secret), pin: cipher.decrypt(v.pin) };
    });
    def('vault.delete', FIRM, { write: true, feature: 'vault' }, (ctx, p) => { const v = ctx.own('vault', p.id); remove('vault', v.id); log(ctx, 'vault.delete', 'Removed a saved ' + v.portal + ' login', { clientId: v.clientId }); return { ok: true }; });

    /* =================================================================== *
     *  Reports
     * =================================================================== */
    def('reports', FIRM, { owner: true }, (ctx, p) => {
      const td = today();
      const from = V.date(p.from) || U.addMonths(td.slice(0, 7) + '-01', -5);
      const to = V.date(p.to) || td;
      const k = firmCaches(ctx);
      const filings = ctx.mine('filings');
      const invs = ctx.mine('invoices').map((i) => Object.assign({}, i, invoiceCalc(i, k.pays)));
      const pays = k.pays.filter((x) => x.status === 'confirmed');
      const exps = ctx.mine('expenses');
      const months = [];
      let m = from.slice(0, 7);
      while (m <= to.slice(0, 7) && months.length < 36) { months.push(m); m = U.addMonths(m + '-01', 1).slice(0, 7); }
      const series = months.map((mm) => ({
        month: mm, label: U.monthLabel(mm),
        invoiced: U.sum(invs.filter((i) => i.status !== 'draft' && i.status !== 'cancelled' && U.monthKey(i.issueDate) === mm), (i) => i.total),
        collected: U.sum(pays.filter((x) => U.monthKey(x.date) === mm), (x) => x.amount),
        expenses: U.sum(exps.filter((e) => U.monthKey(e.date) === mm), (e) => e.amount),
      }));
      const totals = { invoiced: U.sum(series, (s) => s.invoiced), collected: U.sum(series, (s) => s.collected), expenses: U.sum(series, (s) => s.expenses) };
      totals.profit = U.round2(totals.collected - totals.expenses);
      const open = invs.filter((i) => ['sent', 'partial', 'overdue'].indexOf(i.status) >= 0);
      const aging = { current: 0, d30: 0, d60: 0, d90: 0, d90p: 0 };
      for (const i of open) {
        const late = i.dueDate ? U.diffDays(td, i.dueDate) : 0;
        const key = late <= 0 ? 'current' : late <= 30 ? 'd30' : late <= 60 ? 'd60' : late <= 90 ? 'd90' : 'd90p';
        aging[key] = U.round2(aging[key] + i.balance);
      }
      const inRange = (iso) => iso && U.pktDate(Date.parse(iso)) >= from && U.pktDate(Date.parse(iso)) <= to;
      const staff = team(ctx).map((u) => ({ id: u.id, name: u.name, role: u.role, openFilings: filings.filter((f) => f.assignedTo === u.id && f.stage !== 'filed').length, filed: filings.filter((f) => f.assignedTo === u.id && f.stage === 'filed' && inRange(f.filedAt)).length, openTasks: ctx.mine('tasks', (t) => t.assignedTo === u.id && t.status !== 'done').length, doneTasks: ctx.mine('tasks', (t) => t.assignedTo === u.id && t.status === 'done' && inRange(t.doneAt)).length }));
      const byClient = {};
      for (const x of pays.filter((y) => y.date >= from && y.date <= to)) byClient[x.clientId] = U.round2((byClient[x.clientId] || 0) + x.amount);
      const topClients = Object.keys(byClient).map((id) => ({ id, name: k.byId[id] ? k.byId[id].name : 'Deleted client', amount: byClient[id] })).sort(U.by('amount', -1)).slice(0, 8);
      const filingsByType = C.FILING_TYPES.map((t) => ({ id: t.id, label: t.label, open: filings.filter((f) => f.type === t.id && f.stage !== 'filed').length, filed: filings.filter((f) => f.type === t.id && f.stage === 'filed' && inRange(f.filedAt)).length })).filter((x) => x.open || x.filed);
      const atRisk = k.clients.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, overdue: filings.filter((f) => f.clientId === c.id && f.stage !== 'filed' && f.dueDate && f.dueDate < td).length, notices: ctx.mine('notices', (n) => n.clientId === c.id && n.status !== 'closed').length, atl: c.atl })).filter((x) => x.overdue || x.notices || x.atl === 'inactive').sort(U.by((x) => -(x.overdue * 10 + x.notices))).slice(0, 12);
      const advanced = !!ctx.features.advancedReports;
      return {
        from, to, series, totals,
        stages: C.STAGES.map((s) => ({ id: s.id, label: s.label, count: filings.filter((f) => f.stage === s.id).length })),
        filingsByType, filedInRange: filings.filter((f) => f.stage === 'filed' && inRange(f.filedAt)).length,
        overdueFilings: filings.filter((f) => f.stage !== 'filed' && f.dueDate && f.dueDate < td).length,
        outstanding: U.sum(open, (i) => i.balance), atRisk, topClients,
        advanced, aging: advanced ? aging : null, staff: advanced ? staff : null,
        expensesByCategory: advanced ? C.EXPENSE_CATEGORIES.map((cat) => ({ category: cat, amount: U.sum(exps.filter((e) => e.category === cat && e.date >= from && e.date <= to), (e) => e.amount) })).filter((x) => x.amount) : null,
      };
    });

    /* =================================================================== *
     *  Team, firm settings, subscription, support, search, activity
     * =================================================================== */
    def('team.list', FIRM, {}, (ctx) => ({ users: team(ctx), limit: (ctx.plan.limits || {}).team || null, ownerId: ctx.firm.ownerId }));
    def('team.save', FIRM, { owner: true, write: true }, (ctx, p) => {
      const email = V.email(p.email, true);
      if (p.id) {
        const u = store.get('users', p.id);
        if (!u || u.firmId !== ctx.firm.id || u.role === 'client') fail('That team member was not found.', 404);
        if (emailTaken(email, u.id)) fail('Another login already uses this email.', 409);
        const changes = { name: V.req(p.name, 'Name', 120), email, phone: V.phone(p.phone), title: V.str(p.title, 80) };
        if (p.password) changes.passwordHash = hasher.hash(V.password(p.password));
        const out = patch('users', u.id, changes);
        log(ctx, 'team.update', 'Updated team member ' + out.name);
        return { user: publicUser(out) };
      }
      const lim = (ctx.plan.limits || {}).team;
      if (lim && usage(ctx.firm.id).team >= lim) fail('Your plan includes ' + lim + ' team logins. Upgrade to add more people.', 402, 'limit');
      if (emailTaken(email)) fail('Another login already uses this email.', 409);
      const password = p.password ? V.password(p.password) : genPassword();
      const u = insert('users', { role: 'staff', firmId: ctx.firm.id, name: V.req(p.name, 'Name', 120), email, phone: V.phone(p.phone), title: V.str(p.title, 80) || 'Associate', passwordHash: hasher.hash(password), status: 'active' });
      notify([u.id], { title: 'Welcome to ' + ctx.firm.name + ' on FinTax', body: 'Your tasks and assigned filings appear on your dashboard.', link: '/app', kind: 'info' });
      log(ctx, 'team.create', 'Added team member ' + u.name);
      return { user: publicUser(u), password };
    });
    def('team.toggle', FIRM, { owner: true, write: true }, (ctx, p) => {
      const u = store.get('users', p.id);
      if (!u || u.firmId !== ctx.firm.id || u.role !== 'staff') fail('That team member was not found.', 404);
      const enable = u.status !== 'active';
      if (enable) { const lim = (ctx.plan.limits || {}).team; if (lim && usage(ctx.firm.id).team >= lim) fail('Your plan includes ' + lim + ' team logins. Upgrade to add more people.', 402, 'limit'); }
      const out = patch('users', u.id, { status: enable ? 'active' : 'disabled' });
      log(ctx, 'team.toggle', (enable ? 'Turned on ' : 'Turned off ') + 'login for ' + u.name);
      return publicUser(out);
    });
    def('team.reset', FIRM, { owner: true, write: true }, (ctx, p) => {
      const u = store.get('users', p.id);
      if (!u || u.firmId !== ctx.firm.id || u.role !== 'staff') fail('That team member was not found.', 404);
      const password = genPassword();
      patch('users', u.id, { passwordHash: hasher.hash(password) });
      for (const r of all('resets').filter((x) => x.userId === u.id && x.status === 'open')) patch('resets', r.id, { status: 'done' });
      return { email: u.email, password, name: u.name };
    });
    def('team.delete', FIRM, { owner: true, write: true }, (ctx, p) => {
      const u = store.get('users', p.id);
      if (!u || u.firmId !== ctx.firm.id || u.role !== 'staff') fail('That team member was not found.', 404);
      for (const c of ['filings', 'tasks', 'clients', 'notices']) for (const d of ctx.mine(c, (x) => x.assignedTo === u.id)) patch(c, d.id, { assignedTo: c === 'tasks' ? ctx.firm.ownerId : '' });
      remove('users', u.id);
      log(ctx, 'team.delete', 'Removed team member ' + u.name);
      return { ok: true };
    });
    def('firm.settings.save', FIRM, { owner: true, write: true }, (ctx, p) => {
      const b = p.bank || {};
      const changes = { name: V.req(p.name, 'Practice name', 140), city: V.str(p.city, 60), phone: V.phone(p.phone), email: V.email(p.email), ntn: V.str(p.ntn, 30), address: V.text(p.address, 300), invoicePrefix: (V.str(p.invoicePrefix, 8) || 'INV').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'INV', taxRate: Math.max(0, Math.min(100, V.num(p.taxRate))), taxLabel: V.str(p.taxLabel, 60), paymentTerms: Math.max(0, Math.min(120, V.int(p.paymentTerms, 7))), invoiceNote: V.text(p.invoiceNote, 600), bank: { bankName: V.str(b.bankName, 80), accountTitle: V.str(b.accountTitle, 100), accountNumber: V.str(b.accountNumber, 40), iban: V.str(b.iban, 40), raast: V.str(b.raast, 40), jazzcash: V.str(b.jazzcash, 20), easypaisa: V.str(b.easypaisa, 20) }, waTemplate: V.text(p.waTemplate, 600) };
      if (p.logo !== undefined) { if (p.logo && String(p.logo).length > 700000) fail('That logo is too large. Use an image under 500 KB.'); changes.logo = p.logo ? String(p.logo) : ''; }
      const out = patch('firms', ctx.firm.id, changes);
      log(ctx, 'firm.settings', 'Updated practice settings');
      return out;
    });
    def('firm.subscription', FIRM, {}, (ctx) => ({
      plan: planPublic(ctx.plan), plans: plansSorted().filter((p) => p.visible !== false || p.id === ctx.plan.id), sub: ctx.sub, usage: usage(ctx.firm.id),
      payments: all('subPayments').filter((x) => x.firmId === ctx.firm.id).sort(U.by('createdAt', -1)).map((x) => Object.assign({}, x, { planName: (store.get('plans', x.planId) || {}).name || x.planId })),
      payment: settings('payment'), offer: settings('site').offer, isOwner: ctx.isOwner,
    }));
    def('firm.pay', FIRM, { owner: true }, (ctx, p) => {
      const plan = store.get('plans', p.planId);
      if (!plan) fail('Choose a plan.');
      const cycle = V.oneOf(p.cycle, ['monthly', 'annual'], 'monthly');
      const reference = V.req(p.reference, 'Transaction ID or reference', 80);
      const amount = V.money(p.amount) || (cycle === 'annual' ? plan.annual : plan.monthly);
      const existing = all('subPayments').find((x) => x.firmId === ctx.firm.id && x.status === 'pending');
      const doc = { firmId: ctx.firm.id, userId: ctx.user.id, planId: plan.id, cycle, amount, method: V.oneOf(p.method, C.PAY_METHODS, 'Bank transfer'), reference, paidOn: V.date(p.paidOn) || today(), proofBlobId: V.str(p.proofBlobId, 80) || null, proofName: V.str(p.proofName, 200), proofMime: V.str(p.proofMime, 100), note: V.text(p.note, 500), status: 'pending' };
      const out = existing ? patch('subPayments', existing.id, doc) : insert('subPayments', doc);
      notify(adminIds(), { title: 'Payment to verify: ' + ctx.firm.name, body: 'Rs ' + amount.toLocaleString('en-US') + ' via ' + doc.method + ', ref ' + reference, link: '/admin/payments', kind: 'payment' });
      log(ctx, 'subscription.pay', 'Submitted Rs ' + amount.toLocaleString('en-US') + ' for ' + plan.name + ' (' + cycle + ') for verification');
      return out;
    });
    def('support.list', FIRM, {}, (ctx) => all('tickets').filter((t) => t.firmId === ctx.firm.id).sort(U.by('updatedAt', -1)));
    def('support.create', FIRM, {}, (ctx, p) => {
      const t = insert('tickets', { firmId: ctx.firm.id, userId: ctx.user.id, userName: ctx.user.name, subject: V.req(p.subject, 'Subject', 160), priority: V.oneOf(p.priority, C.PRIORITIES.map((x) => x.id), 'normal'), status: 'open', thread: [{ userId: ctx.user.id, name: ctx.user.name, role: 'customer', text: V.req(p.text, 'Message', 4000), at: nowISO() }] });
      notify(adminIds(), { title: 'New support ticket: ' + t.subject, body: ctx.firm.name, link: '/admin/support', kind: 'support' });
      return t;
    });
    def('firm.activity', FIRM, {}, (ctx, p) => ctx.mine('activity', (a) => !p.clientId || a.clientId === p.clientId).sort(U.by('createdAt', -1)).slice(0, V.int(p.limit, 150) || 150));
    def('search', FIRM, {}, (ctx, p) => {
      const q = V.str(p.q, 80).toLowerCase();
      if (q.length < 2) return { clients: [], docs: [], filings: [], invoices: [], notices: [] };
      const has = (...vals) => vals.some((v) => String(v || '').toLowerCase().includes(q));
      const k = firmCaches(ctx);
      return {
        clients: k.clients.filter((c) => has(c.name, c.businessName, c.cnic, c.ntn, c.strn, c.phone, c.email, c.city)).slice(0, 6).map((c) => ({ id: c.id, name: c.name, sub: [C.clientTypeLabel(c.type), c.ntn || c.cnic, c.city].filter(Boolean).join(', ') })),
        docs: ctx.mine('docs', (d) => has(d.name, d.category)).slice(0, 5).map((d) => ({ id: d.id, clientId: d.clientId, name: d.name, sub: k.byId[d.clientId] ? k.byId[d.clientId].name : '' })),
        filings: ctx.mine('filings').filter((f) => has(C.filingLabel(f.type), k.byId[f.clientId] && k.byId[f.clientId].name, f.ackNumber, U.periodLabel(f.period, f.taxYear))).slice(0, 5).map((f) => ({ id: f.id, name: C.filingLabel(f.type) + ', ' + U.periodLabel(f.period, f.taxYear), sub: (k.byId[f.clientId] ? k.byId[f.clientId].name : '') + ', ' + C.stageLabel(f.stage) })),
        invoices: ctx.mine('invoices', (i) => has(i.number, k.byId[i.clientId] && k.byId[i.clientId].name)).slice(0, 5).map((i) => ({ id: i.id, name: i.number, sub: k.byId[i.clientId] ? k.byId[i.clientId].name : '' })),
        notices: ctx.mine('notices', (n) => has(n.section, n.title, n.noticeNo, C.sectionLabel(n.section))).slice(0, 5).map((n) => ({ id: n.id, name: C.sectionLabel(n.section), sub: k.byId[n.clientId] ? k.byId[n.clientId].name : '' })),
      };
    });
    def('firm.export', FIRM, { owner: true }, (ctx) => {
      const out = {};
      for (const c of ['clients', 'docs', 'requests', 'filings', 'notices', 'tasks', 'invoices', 'payments', 'expenses', 'messages', 'events']) out[c] = ctx.mine(c);
      out.firm = ctx.firm;
      return out;
    });

    /* =================================================================== *
     *  CLIENT PORTAL
     * =================================================================== */
    def('portal.home', CLIENT, {}, (ctx) => {
      const c = ctx.client;
      const docs = ctx.mine('docs', (d) => d.clientId === c.id && visibleToClient(d));
      const reqs = ctx.mine('requests', (r) => r.clientId === c.id && r.status === 'open').sort(U.by((r) => r.dueDate || '9999'));
      const filings = ctx.mine('filings', (f) => f.clientId === c.id).map((f) => filingView(f, { [c.id]: c }));
      const pays = ctx.mine('payments', (x) => x.clientId === c.id);
      const invs = ctx.mine('invoices', (i) => i.clientId === c.id && i.status !== 'draft').map((i) => invoiceView(i, pays, { [c.id]: c }));
      const unpaid = invs.filter((i) => ['sent', 'partial', 'overdue'].indexOf(i.status) >= 0);
      const approvals = docs.filter((d) => d.approval && d.approval.status === 'pending').map((d) => docView(d));
      const filingApprovals = filings.filter((f) => f.stage === 'client_approval');
      const currentTY = U.taxYearOf(today()) - 1;
      return {
        client: c,
        actions: { requests: reqs, approvals, filingApprovals, unpaid },
        filings: filings.filter((f) => f.stage !== 'filed' || (f.filedAt && Date.parse(f.filedAt) > now() - 60 * DAY)).sort(U.by((f) => f.dueDate || '9999')).slice(0, 6),
        recentDocs: docs.sort(U.by('createdAt', -1)).slice(0, 5).map((d) => docView(d)),
        notices: ctx.mine('notices', (n) => n.clientId === c.id && n.visibleToClient !== false && n.status !== 'closed').map((n) => noticeView(n)),
        totals: { outstanding: U.sum(unpaid, (i) => i.balance), filed: filings.filter((f) => f.stage === 'filed').length, docs: docs.length },
        currentTY,
        announcements: all('announcements').filter((a) => a.active && (a.audience === 'clients' || a.audience === 'all')).slice(0, 2),
      };
    });
    def('portal.docs', CLIENT, {}, (ctx) => ({
      docs: ctx.mine('docs', (d) => d.clientId === ctx.client.id && visibleToClient(d)).sort(U.by('createdAt', -1)).map((d) => docView(d)),
      requests: ctx.mine('requests', (r) => r.clientId === ctx.client.id && r.status !== 'cancelled').sort(U.by((r) => (r.status === 'open' ? '0' : '1') + (r.dueDate || '9999'))),
    }));
    def('portal.upload', CLIENT, { write: true }, (ctx, p) => {
      const f = fileFields(p);
      checkStorage(ctx, f.size);
      let req = null;
      if (p.requestId) { req = ctx.clientOwn('requests', p.requestId); }
      const d = insert('docs', Object.assign(f, { firmId: ctx.firm.id, clientId: ctx.client.id, category: V.oneOf(p.category, C.DOC_CATEGORIES, 'Other'), taxYear: V.int(p.taxYear) || U.taxYearOf(today()) - 1, note: V.text(p.note, 1000), uploadedBy: ctx.user.id, uploaderName: ctx.user.name, uploaderRole: 'client', shared: false, seenByFirm: false, seenByClient: true, approval: null, requestId: req ? req.id : null }));
      if (req) patch('requests', req.id, { status: 'fulfilled', docId: d.id, fulfilledAt: nowISO() });
      notify(firmTeamIds(ctx.firm.id), { title: ctx.client.name + ' uploaded ' + d.name, body: req ? 'For request: ' + req.title : d.category, link: '/app/clients/' + ctx.client.id + '/documents?open=' + d.id, kind: 'upload' });
      log(ctx, 'portal.upload', ctx.client.name + ' uploaded ' + d.name + (req ? ' (requested: ' + req.title + ')' : ''), { clientId: ctx.client.id, docId: d.id });
      return docView(d);
    });
    def('portal.filings', CLIENT, {}, (ctx) => ctx.mine('filings', (f) => f.clientId === ctx.client.id).map((f) => filingView(f, { [ctx.client.id]: ctx.client })).sort(U.by((f) => (f.stage === 'filed' ? '1' : '0') + (f.dueDate || '9999'))));
    def('portal.notices', CLIENT, {}, (ctx) => ctx.mine('notices', (n) => n.clientId === ctx.client.id && n.visibleToClient !== false).map((n) => { const v = noticeView(n); delete v.notes; return v; }).sort(U.by((n) => (n.status === 'closed' ? '1' : '0') + (n.dueDate || '9999'))));
    def('portal.invoices', CLIENT, {}, (ctx) => {
      const pays = ctx.mine('payments', (x) => x.clientId === ctx.client.id);
      return { invoices: ctx.mine('invoices', (i) => i.clientId === ctx.client.id && i.status !== 'draft').map((i) => Object.assign(invoiceView(i, pays, { [ctx.client.id]: ctx.client }), { payments: pays.filter((x) => x.invoiceId === i.id) })).sort(U.by('issueDate', -1)), bank: ctx.firm.bank || {}, firm: { name: ctx.firm.name, ntn: ctx.firm.ntn, address: ctx.firm.address, phone: ctx.firm.phone, email: ctx.firm.email, invoiceNote: ctx.firm.invoiceNote || '', logo: ctx.features.branding ? ctx.firm.logo : '' } };
    });
    def('portal.pay', CLIENT, { write: true }, (ctx, p) => {
      const i = ctx.clientOwn('invoices', p.invoiceId);
      if (i.status === 'draft' || i.status === 'cancelled') fail('This invoice cannot be paid.');
      const amount = V.money(p.amount);
      if (!amount) fail('Enter the amount you paid.');
      const pay = insert('payments', { firmId: ctx.firm.id, clientId: ctx.client.id, invoiceId: i.id, amount, method: V.oneOf(p.method, C.PAY_METHODS, 'Bank transfer'), reference: V.req(p.reference, 'Transaction ID or reference', 80), date: V.date(p.date) || today(), status: 'pending', submittedBy: ctx.user.id, proofBlobId: V.str(p.proofBlobId, 80) || null, proofName: V.str(p.proofName, 200), proofMime: V.str(p.proofMime, 100), note: V.text(p.note, 500) });
      notify(firmTeamIds(ctx.firm.id), { title: ctx.client.name + ' submitted a payment of Rs ' + amount.toLocaleString('en-US'), body: 'Invoice ' + i.number + ', ref ' + pay.reference + '. Confirm it under Payments.', link: '/app/payments', kind: 'payment' });
      log(ctx, 'portal.pay', ctx.client.name + ' submitted Rs ' + amount.toLocaleString('en-US') + ' for ' + i.number, { clientId: ctx.client.id });
      return pay;
    });
    def('portal.messages', CLIENT, {}, (ctx) => {
      const msgs = ctx.mine('messages', (m) => m.clientId === ctx.client.id).sort(U.by('createdAt'));
      for (const m of msgs) if (m.role === 'firm' && !m.readByClient) patch('messages', m.id, { readByClient: true });
      return msgs.map((m) => Object.assign({}, m, { readByClient: true }));
    });
    def('portal.send', CLIENT, { write: true }, (ctx, p) => {
      const text = V.req(p.text, 'Message', 4000);
      const m = insert('messages', { firmId: ctx.firm.id, clientId: ctx.client.id, userId: ctx.user.id, name: ctx.user.name, role: 'client', text, readByFirm: false, readByClient: true });
      notify(firmTeamIds(ctx.firm.id), { title: 'Message from ' + ctx.client.name, body: text.slice(0, 140), link: '/app/messages?c=' + ctx.client.id, kind: 'message' });
      return m;
    });
    def('portal.profile.save', CLIENT, { write: true }, (ctx, p) => {
      const out = patch('clients', ctx.client.id, { phone: V.phone(p.phone), address: V.text(p.address, 300), city: V.str(p.city, 60) });
      patch('users', ctx.user.id, { phone: out.phone });
      notify(firmTeamIds(ctx.firm.id), { title: out.name + ' updated their contact details', link: '/app/clients/' + out.id, kind: 'info' });
      log(ctx, 'portal.profile', out.name + ' updated contact details', { clientId: out.id });
      return out;
    });

    /* =================================================================== *
     *  FILE ACCESS (server uses this before streaming any upload)
     * =================================================================== */
    def('files.authorize', ANY, {}, (ctx, p) => {
      const blobId = V.str(p.blobId, 80);
      if (!blobId) fail('Missing file.', 400);
      const role = ctx.user.role;
      if (role === 'admin') {
        const sp = all('subPayments').find((x) => x.proofBlobId === blobId);
        if (sp) return { name: sp.proofName || 'payment-proof', mime: sp.proofMime || '' };
        fail('That file was not found.', 404);
      }
      const d = all('docs').find((x) => x.blobId === blobId && x.firmId === ctx.firm.id);
      if (d) {
        if (role === 'client' && (d.clientId !== ctx.client.id || !visibleToClient(d))) fail('That file was not found.', 404);
        return { name: d.name, mime: d.mime };
      }
      const pay = all('payments').find((x) => x.proofBlobId === blobId && x.firmId === ctx.firm.id);
      if (pay && (role !== 'client' || pay.clientId === ctx.client.id)) return { name: pay.proofName || 'payment-proof', mime: pay.proofMime || '' };
      const sp = all('subPayments').find((x) => x.proofBlobId === blobId && x.firmId === ctx.firm.id);
      if (sp && role !== 'client') return { name: sp.proofName || 'payment-proof', mime: sp.proofMime || '' };
      fail('That file was not found.', 404);
    });

    /* ------------------------------------------------------------ bootstrap */
    function ensureBase(adminInfo) {
      if (!all('plans').length) for (const p of defaultPlans()) insert('plans', p);
      if (!all('faqs').length && !store.get('settings', 'faqsSeeded')) {
        defaultFaqs().forEach((f, i) => insert('faqs', Object.assign({ order: i + 1, published: true }, f)));
        insert('settings', { id: 'faqsSeeded', data: { at: nowISO() } });
      }
      if (adminInfo && !all('users').some((u) => u.role === 'admin')) {
        insert('users', { role: 'admin', name: adminInfo.name || 'FinTax Admin', email: V.email(adminInfo.email, true), phone: '', passwordHash: hasher.hash(adminInfo.password), status: 'active' });
      }
    }

    return {
      version: VERSION, store, exec, actions, settings, saveSettings, ensureBase, taxCalc, complianceDeadlines, subscription,
      internals: { insert, patch, remove, all, nid, hasher, cipher, now, today, nowISO, genPassword, plansSorted, invoiceCalc, purgeFirm },
    };
  }

  return { VERSION, create, MemoryStore, FtError, U, V, C, COLLECTIONS, defaultPlans, defaultSettings, defaultFaqs, sha256Hex, previewHasher, previewCipher };
});
