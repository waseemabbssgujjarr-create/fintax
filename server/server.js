#!/usr/bin/env node
/*! FinTax server. Zero dependencies: Node 18+ (SQLite storage on Node 22.5+, JSON file otherwise).
 *
 *   node server/server.js
 *
 * Environment variables (all optional):
 *   PORT=8080  HOST=0.0.0.0  FINTAX_DATA=./data
 *   ADMIN_EMAIL=you@yourdomain.pk  ADMIN_PASSWORD=...     first-run master admin
 *   FINTAX_SECRET=<long random string>                    encrypts the credentials vault
 *   SEED_DEMO=1                                           load demo practices on an empty database
 *   MAX_UPLOAD_MB=25  SESSION_DAYS=30  TRUST_PROXY=1  FORCE_HTTPS=1
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const originalEmitWarning = process.emitWarning;
process.emitWarning = function (warning, ...rest) {
  if (String(warning && warning.message ? warning.message : warning).includes('SQLite')) return;
  return originalEmitWarning.call(process, warning, ...rest);
};

const Core = require('../public/core/core.js');
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.resolve(process.env.FINTAX_DATA || path.join(ROOT, 'data'));
const UPLOADS = path.join(DATA, 'uploads');
const PORT = +process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_UPLOAD = (+process.env.MAX_UPLOAD_MB || 25) * 1048576;
const SESSION_MS = (+process.env.SESSION_DAYS || 30) * 86400000;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const FORCE_HTTPS = process.env.FORCE_HTTPS === '1';

fs.mkdirSync(UPLOADS, { recursive: true });

/* ----------------------------------------------------------------- storage */
class SqliteStore extends Core.MemoryStore {
  constructor(file) {
    super();
    const { DatabaseSync } = require('node:sqlite');
    this.kind = 'sqlite';
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; CREATE TABLE IF NOT EXISTS docs (coll TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (coll, id));');
    this.reload();
    this.upsert = this.db.prepare('INSERT INTO docs (coll, id, data) VALUES (?, ?, ?) ON CONFLICT(coll, id) DO UPDATE SET data = excluded.data');
    this.remove = this.db.prepare('DELETE FROM docs WHERE coll = ? AND id = ?');
    this.dirty = false;
    this.on((c, id, doc) => { this.dirty = true; if (doc) this.upsert.run(c, id, JSON.stringify(doc)); else this.remove.run(c, id); });
  }
  reload() {
    this.data = {}; this.cache = {};
    for (const r of this.db.prepare('SELECT coll, id, data FROM docs').all()) this.coll(r.coll)[r.id] = JSON.parse(r.data);
  }
  tx(fn) {
    this.dirty = false;
    this.db.exec('BEGIN');
    try { const out = fn(); this.db.exec('COMMIT'); return out; }
    catch (e) { this.db.exec('ROLLBACK'); if (this.dirty) this.reload(); throw e; }
  }
}
class JsonStore extends Core.MemoryStore {
  constructor(file) {
    super();
    this.kind = 'json';
    this.file = file;
    if (fs.existsSync(file)) this.load(JSON.parse(fs.readFileSync(file, 'utf8') || '{}'));
    this.timer = null;
    this.on(() => this.schedule());
  }
  schedule() { if (!this.timer) this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 150); }
  flush() { const tmp = this.file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(this.dump())); fs.renameSync(tmp, this.file); }
  tx(fn) { return fn(); }
}
let store;
try { store = new SqliteStore(path.join(DATA, 'fintax.sqlite')); }
catch (e) { console.warn('SQLite unavailable (' + e.message + '), using JSON file storage.'); store = new JsonStore(path.join(DATA, 'fintax.json')); }

/* ------------------------------------------------------------------ crypto */
const hasher = {
  hash(pw) {
    const salt = crypto.randomBytes(16);
    const key = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return 'scrypt$16384$8$1$' + salt.toString('base64') + '$' + key.toString('base64');
  },
  verify(pw, stored) {
    const parts = String(stored || '').split('$');
    if (parts[0] === 'ps256') return Core.previewHasher.verify(pw, stored); // demo data seeded with the preview hasher
    if (parts[0] !== 'scrypt' || parts.length !== 6) return false;
    const [, N, r, p, salt, hash] = parts;
    const expected = Buffer.from(hash, 'base64');
    const key = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), expected.length, { N: +N, r: +r, p: +p, maxmem: 64 * 1024 * 1024 });
    return crypto.timingSafeEqual(key, expected);
  },
};
function loadSecret() {
  if (process.env.FINTAX_SECRET) return crypto.createHash('sha256').update(process.env.FINTAX_SECRET).digest();
  const file = path.join(DATA, 'secret.key');
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('base64'), { mode: 0o600 });
  return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'base64');
}
const SECRET = loadSecret();
const cipher = {
  encrypt(text) {
    if (!text) return '';
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', SECRET, iv);
    const enc = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
    return 'g1:' + iv.toString('base64') + ':' + c.getAuthTag().toString('base64') + ':' + enc.toString('base64');
  },
  decrypt(blob) {
    if (!blob) return '';
    const s = String(blob);
    if (s.startsWith('p1:')) return Core.previewCipher.decrypt(s);
    const [v, iv, tag, data] = s.split(':');
    if (v !== 'g1') return '';
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', SECRET, Buffer.from(iv, 'base64'));
      d.setAuthTag(Buffer.from(tag, 'base64'));
      return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
    } catch (e) { return ''; }
  },
};

const core = Core.create({ store, hasher, cipher, randomId: (n) => { const chars = 'abcdefghijkmnpqrstuvwxyz23456789'; const b = crypto.randomBytes(n); let o = ''; for (let i = 0; i < n; i++) o += chars[b[i] % chars.length]; return o; } });

/* --------------------------------------------------------------- bootstrap */
(function bootstrap() {
  const empty = !store.all('users').length;
  store.tx(() => {
    if (empty && process.env.SEED_DEMO === '1') {
      const Seed = require('../public/core/seed.js');
      const creds = Seed.seedDemo(core, { password: process.env.DEMO_PASSWORD || 'demo123' });
      console.log('Loaded demo data. Sign in as ' + creds.adminEmail + ' / ' + creds.password);
    }
    let adminPassword = process.env.ADMIN_PASSWORD;
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@fintax.local').toLowerCase();
    const hasAdmin = store.all('users').some((u) => u.role === 'admin');
    if (!hasAdmin) {
      if (!adminPassword) adminPassword = crypto.randomBytes(9).toString('base64url');
      core.ensureBase({ name: 'FinTax Admin', email: adminEmail, password: adminPassword });
      const note = 'FinTax master admin\nEmail: ' + adminEmail + '\nPassword: ' + adminPassword + '\nChange this password after your first sign-in, then delete this file.\n';
      if (!process.env.ADMIN_PASSWORD) fs.writeFileSync(path.join(DATA, 'ADMIN_CREDENTIALS.txt'), note, { mode: 0o600 });
      console.log('\n' + note);
    } else {
      core.ensureBase();
      if (process.env.ADMIN_EMAIL && !store.all('users').some((u) => u.email === adminEmail)) {
        if (!adminPassword) adminPassword = crypto.randomBytes(9).toString('base64url');
        core.exec({ id: store.all('users').find((u) => u.role === 'admin').id }, 'admin.admin.save', { name: 'FinTax Admin', email: adminEmail, password: adminPassword });
        console.log('Added admin ' + adminEmail + (process.env.ADMIN_PASSWORD ? '' : ' with password ' + adminPassword));
      }
    }
  });
})();

/* ---------------------------------------------------------------- sessions */
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function createSession(user, req) {
  const token = crypto.randomBytes(32).toString('base64url');
  const t = Date.now();
  store.put('sessions', { id: sha(token), userId: user.id, impersonatedBy: user.impersonatedBy || null, createdAt: new Date(t).toISOString(), lastSeenAt: t, expiresAt: t + (user.impersonatedBy ? 4 * 3600000 : SESSION_MS), ip: clientIp(req), ua: String(req.headers['user-agent'] || '').slice(0, 160) });
  return token;
}
function sessionFrom(req) {
  const h = String(req.headers.authorization || '');
  const token = h.startsWith('Bearer ') ? h.slice(7).trim() : '';
  if (!token) return null;
  const s = store.get('sessions', sha(token));
  if (!s) return null;
  const t = Date.now();
  if (s.expiresAt < t) { store.del('sessions', s.id); return null; }
  const user = store.get('users', s.userId);
  if (!user || user.status !== 'active') { store.del('sessions', s.id); return null; }
  if (t - s.lastSeenAt > 600000) store.put('sessions', Object.assign({}, s, { lastSeenAt: t, expiresAt: s.impersonatedBy ? s.expiresAt : t + SESSION_MS }));
  return { session: s, user: { id: user.id, impersonatedBy: s.impersonatedBy || null } };
}
function dropUserSessions(userId, exceptId) { for (const s of store.all('sessions').slice()) if (s.userId === userId && s.id !== exceptId) store.del('sessions', s.id); }
setInterval(() => { const t = Date.now(); for (const s of store.all('sessions').slice()) if (s.expiresAt < t) store.del('sessions', s.id); }, 3600000).unref();

/* -------------------------------------------------------------- rate limit */
const buckets = new Map();
function limited(key, max, windowMs) {
  const t = Date.now();
  const b = buckets.get(key) || { n: 0, reset: t + windowMs };
  if (t > b.reset) { b.n = 0; b.reset = t + windowMs; }
  b.n++;
  buckets.set(key, b);
  return b.n > max;
}
setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (t > b.reset) buckets.delete(k); }, 600000).unref();
const LIMITS = { 'auth.login': [12, 900000], 'auth.signup': [6, 3600000], 'auth.forgot': [6, 3600000], 'public.lead': [8, 3600000] };

/* ------------------------------------------------------------------- utils */
function clientIp(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',')[0].trim();
  return req.socket.remoteAddress || '';
}
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; manifest-src 'self'; worker-src 'self'",
};
if (FORCE_HTTPS) SECURITY_HEADERS['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
function send(res, status, body, headers) {
  const h = Object.assign({}, SECURITY_HEADERS, headers || {});
  if (typeof body === 'object' && !Buffer.isBuffer(body)) { body = JSON.stringify(body); h['Content-Type'] = 'application/json; charset=utf-8'; h['Cache-Control'] = 'no-store'; }
  res.writeHead(status, h);
  res.end(body);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(Object.assign(new Error('That upload is too large.'), { status: 413 })); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function readJson(req, limit) {
  const buf = await readBody(req, limit || 2 * 1048576);
  if (!buf.length) return {};
  try { return JSON.parse(buf.toString('utf8')); } catch (e) { throw Object.assign(new Error('The request was not valid JSON.'), { status: 400 }); }
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
const UPLOAD_EXT = /\.(pdf|jpe?g|png|webp|heic|heif|gif|docx?|xlsx?|csv|txt|zip|rar|pptx?|odt|ods)$/i;

/* ---------------------------------------------------------------- handlers */
async function handleRpc(req, res) {
  const body = await readJson(req);
  const action = String(body.action || '');
  const payload = body.payload || {};
  const ip = clientIp(req);
  if (LIMITS[action]) {
    const [max, win] = LIMITS[action];
    const key = action + ':' + ip + (action === 'auth.login' ? ':' + String(payload.email || '').toLowerCase() : '');
    if (limited(key, max, win)) return send(res, 429, { ok: false, error: 'Too many attempts. Wait a few minutes and try again.', code: 'rate_limited' });
  }
  const auth = sessionFrom(req);
  try {
    if (action === 'auth.login' || action === 'auth.signup') {
      const user = store.tx(() => core.exec(null, action, payload));
      return send(res, 200, { ok: true, data: { user, token: createSession(user, req) } });
    }
    if (action === 'auth.logout') {
      if (auth) store.del('sessions', auth.session.id);
      return send(res, 200, { ok: true, data: { ok: true } });
    }
    if (action === 'admin.impersonate') {
      const out = store.tx(() => core.exec(auth && auth.user, action, payload));
      return send(res, 200, { ok: true, data: { user: out.user, token: createSession(out.user, req) } });
    }
    if (action === 'admin.backup') {
      const me = auth && store.get('users', auth.user.id);
      if (!me || me.role !== 'admin') return send(res, 403, { ok: false, error: 'You do not have access to this area.', code: 'forbidden' });
      const dump = store.dump(); delete dump.sessions;
      return send(res, 200, { ok: true, data: { exportedAt: new Date().toISOString(), version: Core.VERSION, data: dump } });
    }
    const data = store.tx(() => core.exec(auth && auth.user, action, payload));
    if (action === 'me.password' && auth) dropUserSessions(auth.user.id, auth.session.id);
    if (action === 'doc.delete' && data && data.blobId) removeBlobIfOrphan(data.blobId);
    return send(res, 200, { ok: true, data });
  } catch (e) {
    if (e instanceof Core.FtError) return send(res, e.status, { ok: false, error: e.message, code: e.code });
    console.error('[rpc]', action, e);
    return send(res, 500, { ok: false, error: 'Something went wrong on the server. Try again, and contact support if it keeps happening.', code: 'server' });
  }
}

async function handleUpload(req, res) {
  const auth = sessionFrom(req);
  if (!auth) return send(res, 401, { ok: false, error: 'Please sign in to continue.', code: 'auth' });
  const body = await readJson(req, Math.ceil(MAX_UPLOAD * 1.4) + 4096);
  const name = String(body.name || 'file').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 200);
  if (!UPLOAD_EXT.test(name)) return send(res, 400, { ok: false, error: 'This file type is not supported. Upload a PDF, image, Word, Excel, CSV or ZIP file.', code: 'file_type' });
  const raw = String(body.data || '');
  const b64 = raw.includes(',') ? raw.slice(raw.indexOf(',') + 1) : raw;
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length) return send(res, 400, { ok: false, error: 'The file is empty.', code: 'empty' });
  if (buf.length > MAX_UPLOAD) return send(res, 413, { ok: false, error: 'Files can be up to ' + Math.round(MAX_UPLOAD / 1048576) + ' MB.', code: 'too_large' });
  const user = store.get('users', auth.user.id);
  const blobId = 'blb_' + crypto.randomBytes(12).toString('hex');
  fs.writeFileSync(path.join(UPLOADS, blobId), buf);
  store.put('blobs', { id: blobId, name, mime: String(body.mime || '').slice(0, 120), size: buf.length, userId: user.id, firmId: user.firmId || null, createdAt: new Date().toISOString() });
  return send(res, 200, { ok: true, data: { blobId, size: buf.length, name } });
}

function handleFile(req, res, blobId) {
  const auth = sessionFrom(req);
  if (!auth) return send(res, 401, { ok: false, error: 'Please sign in to continue.', code: 'auth' });
  if (!/^blb_[a-f0-9]{24}$/.test(blobId)) return send(res, 404, { ok: false, error: 'That file was not found.', code: 'not_found' });
  let meta;
  try { meta = core.exec(auth.user, 'files.authorize', { blobId }); }
  catch (e) { return send(res, e.status || 404, { ok: false, error: e.message, code: e.code || 'not_found' }); }
  const file = path.join(UPLOADS, blobId);
  if (!fs.existsSync(file)) return send(res, 404, { ok: false, error: 'That file is missing from storage.', code: 'not_found' });
  const blob = store.get('blobs', blobId) || {};
  const mime = meta.mime || blob.mime || 'application/octet-stream';
  const inline = /^(image\/(png|jpe?g|webp|gif)|application\/pdf)$/.test(mime);
  const stat = fs.statSync(file);
  res.writeHead(200, Object.assign({}, SECURITY_HEADERS, { 'Content-Type': mime, 'Content-Length': stat.size, 'Cache-Control': 'private, no-store', 'Content-Disposition': (inline ? 'inline' : 'attachment') + '; filename*=UTF-8\'\'' + encodeURIComponent(meta.name || blob.name || 'file') }));
  fs.createReadStream(file).pipe(res);
}

function removeBlobIfOrphan(blobId) {
  const used = store.all('docs').some((d) => d.blobId === blobId) || store.all('payments').some((p) => p.proofBlobId === blobId) || store.all('subPayments').some((p) => p.proofBlobId === blobId);
  if (used) return;
  store.del('blobs', blobId);
  fs.rm(path.join(UPLOADS, blobId), { force: true }, () => {});
}
function sweepBlobs() {
  const cutoff = Date.now() - 86400000;
  for (const b of store.all('blobs').slice()) if (Date.parse(b.createdAt) < cutoff) removeBlobIfOrphan(b.id);
}
setInterval(sweepBlobs, 6 * 3600000).unref();
setTimeout(sweepBlobs, 60000).unref();

function dataUrlToBuffer(u) { const m = /^data:([^;]+);base64,(.*)$/.exec(String(u || '')); return m ? { mime: m[1], buf: Buffer.from(m[2], 'base64') } : null; }
function handleManifest(res) {
  const site = core.settings('site');
  const name = site.brandName || 'FinTax';
  const manifest = {
    name: name + ' — Tax Practice ERP', short_name: name, description: site.tagline || 'Practice ERP for tax consultants',
    start_url: '/?source=pwa', scope: '/', display: 'standalone', orientation: 'any',
    background_color: '#F4F7F3', theme_color: site.primary || '#0E7A4F',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Dashboard', url: '/?source=pwa#/app' },
      { name: 'Clients', url: '/?source=pwa#/app/clients' },
      { name: 'Client portal', url: '/?source=pwa#/portal' },
    ],
  };
  send(res, 200, JSON.stringify(manifest), { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-cache' });
}
function handleBrandIcon(res, size) {
  const site = core.settings('site');
  const custom = dataUrlToBuffer(size === 512 ? site.icon512 : site.icon192);
  if (custom) return send(res, 200, custom.buf, { 'Content-Type': custom.mime, 'Cache-Control': 'no-cache' });
  return serveStatic(res, '/icons/icon-' + size + '.png');
}
function serveStatic(res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const file = path.normalize(path.join(PUBLIC, rel));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      if (path.extname(rel)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
      return serveStatic(res, '/index.html');
    }
    const ext = path.extname(file).toLowerCase();
    const cache = ext === '.html' || rel === '/sw.js' ? 'no-cache' : 'public, max-age=3600';
    res.writeHead(200, Object.assign({}, SECURITY_HEADERS, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache }, rel === '/sw.js' ? { 'Service-Worker-Allowed': '/' } : {}));
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = req.url || '/';
  try {
    if (url.startsWith('/api/')) {
      if (url === '/api/health') return send(res, 200, { ok: true, fintax: true, version: Core.VERSION, storage: store.kind });
      if (req.method !== 'POST' && !url.startsWith('/api/file/')) return send(res, 405, { ok: false, error: 'Method not allowed.' });
      if (url === '/api/rpc') return await handleRpc(req, res);
      if (url === '/api/upload') return await handleUpload(req, res);
      if (url.startsWith('/api/file/')) return handleFile(req, res, url.slice(10).split('?')[0]);
      return send(res, 404, { ok: false, error: 'Unknown endpoint.' });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain' });
    if (url.startsWith('/manifest.webmanifest')) return handleManifest(res);
    if (url.startsWith('/brand/icon-192.png')) return handleBrandIcon(res, 192);
    if (url.startsWith('/brand/icon-512.png')) return handleBrandIcon(res, 512);
    return serveStatic(res, url);
  } catch (e) {
    if (e && e.status) return send(res, e.status, { ok: false, error: e.message });
    console.error('[server]', e);
    return send(res, 500, { ok: false, error: 'Something went wrong on the server.' });
  }
});
server.requestTimeout = 120000;
server.listen(PORT, HOST, () => console.log('FinTax ' + Core.VERSION + ' running on http://' + (HOST === '0.0.0.0' ? 'localhost' : HOST) + ':' + PORT + ' (' + store.kind + ' storage in ' + DATA + ')'));

function shutdown() { try { if (store.kind === 'json') store.flush(); if (store.db) store.db.close(); } catch (e) { /* closing anyway */ } process.exit(0); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
module.exports = server;
