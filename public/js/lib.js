/*! FinTax UI framework: templating, formatting, events, modals, forms, router, API client, files, PWA. */
(function () {
  'use strict';
  const FT = (window.FT = window.FT || {});
  const Core = window.FinTaxCore;
  const { U, C } = Core;
  FT.Core = Core; FT.U = U; FT.C = C;
  FT.preview = !!window.FINTAX_PREVIEW;            // running inside the claude.ai artifact viewer
  FT.backend = 'local';                            // 'local' (in-browser) or 'server'
  FT.mode = FT.preview ? 'memory' : 'hash';        // routing mode
  FT.state = { me: null, site: null };

  /* ------------------------------------------------------------ templating */
  class Raw { constructor(s) { this.s = String(s); } toString() { return this.s; } }
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);
  function render(v) {
    if (v == null || v === false || v === true) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) { let o = ''; for (const x of v) o += render(x); return o; }
    return esc(v);
  }
  const html = (strings, ...vals) => { let out = strings[0]; for (let i = 0; i < vals.length; i++) out += render(vals[i]) + strings[i + 1]; return new Raw(out); };
  FT.html = html; FT.raw = (s) => new Raw(s); FT.esc = esc; FT.render = render; FT.Raw = Raw;
  const raw = FT.raw;
  FT.cx = (...a) => a.filter(Boolean).join(' ');

  /* ------------------------------------------------------------ formatting */
  const nf = new Intl.NumberFormat('en-US');
  const trim = (x, d) => x.toFixed(d).replace(/\.?0+$/, '');
  FT.n = (v) => nf.format(Math.round(+v || 0));
  FT.money = (v) => 'Rs ' + nf.format(Math.round(+v || 0));
  FT.moneyShort = (v) => {
    const n = Math.abs(+v || 0), s = (+v || 0) < 0 ? '-' : '';
    if (n >= 1e7) return s + 'Rs ' + trim(n / 1e7, 2) + ' Cr';
    if (n >= 1e5) return s + 'Rs ' + trim(n / 1e5, 1) + ' lac';
    return s + 'Rs ' + nf.format(Math.round(n));
  };
  FT.compact = (v) => { const n = +v || 0; return n >= 1e3 ? trim(n / 1e3, 1) + 'K' : String(Math.round(n)); };
  FT.bytes = (b) => { b = +b || 0; if (b < 1024) return b + ' B'; if (b < 1048576) return Math.round(b / 1024) + ' KB'; if (b < 1073741824) return trim(b / 1048576, 1) + ' MB'; return trim(b / 1073741824, 2) + ' GB'; };
  const MON = U.MONTHS;
  FT.today = () => U.pktDate();
  FT.date = (ds) => { if (!ds) return ''; const s = String(ds).slice(0, 10).split('-'); return (+s[2]) + ' ' + MON[+s[1] - 1] + ' ' + s[0]; };
  FT.dateShort = (ds) => ds ? (+String(ds).slice(8, 10)) + ' ' + MON[+String(ds).slice(5, 7) - 1] : '';
  FT.pkt = (iso) => new Date(Date.parse(iso) + 5 * 3600000);
  FT.timeOf = (iso) => { const d = FT.pkt(iso); let h = d.getUTCHours(); const m = d.getUTCMinutes(); const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; };
  FT.datetime = (iso) => { if (!iso) return ''; const d = FT.pkt(iso); return d.getUTCDate() + ' ' + MON[d.getUTCMonth()] + ', ' + FT.timeOf(iso); };
  FT.isoDay = (iso) => iso ? U.pktDate(Date.parse(iso)) : '';
  FT.ago = (iso) => {
    if (!iso) return '';
    const s = (Date.now() - Date.parse(iso)) / 1000;
    if (s < 0) return FT.datetime(iso);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    const d = Math.floor(s / 86400);
    if (d === 1) return 'yesterday';
    if (d < 7) return d + ' days ago';
    return FT.date(FT.isoDay(iso));
  };
  FT.daysTo = (ds) => ds ? U.diffDays(ds, FT.today()) : null;
  FT.dueInfo = (ds, done) => {
    if (!ds) return { text: 'No due date', tone: '' };
    if (done) return { text: FT.date(ds), tone: '' };
    const d = FT.daysTo(ds);
    if (d < 0) return { text: (-d) + (d === -1 ? ' day' : ' days') + ' overdue', tone: 'red' };
    if (d === 0) return { text: 'Due today', tone: 'red' };
    if (d === 1) return { text: 'Due tomorrow', tone: 'amber' };
    if (d <= 7) return { text: 'Due in ' + d + ' days', tone: 'amber' };
    return { text: 'Due ' + FT.date(ds), tone: '' };
  };
  FT.plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  FT.greeting = () => { const h = FT.pkt(new Date().toISOString()).getUTCHours(); return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'; };

  /* ----------------------------------------------------------------- icons */
  FT.icon = (name, cls) => {
    const set = window.FTIcons || {};
    return raw('<svg class="i' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (set[name] || set['circle-dot'] || '') + '</svg>');
  };
  FT.mark = () => raw('<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.5 5.5h9M7.5 11.2h6M7.5 5.5v13" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="m13.6 16.4 2.1 2.1 4-4.6" stroke="#B7F0CE" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>');

  /* ---------------------------------------------------------- safe storage */
  const mkStore = (getter) => ({
    get(k, def) { try { const s = getter(); const v = s ? s.getItem(k) : null; return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { const s = getter(); if (!s) return false; s.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { const s = getter(); if (s) s.removeItem(k); } catch (e) { /* storage unavailable */ } },
  });
  FT.ls = mkStore(() => window.localStorage);
  FT.ss = mkStore(() => window.sessionStorage);

  /* ---------------------------------------------------------------- events */
  FT.acts = {}; FT.submits = {};
  FT.act = (name, fn) => { FT.acts[name] = fn; };
  FT.onSubmit = (name, fn) => { FT.submits[name] = fn; };
  const bus = {};
  FT.listen = (ev, fn) => { (bus[ev] = bus[ev] || []).push(fn); };
  FT.emit = (ev, data) => { for (const fn of (bus[ev] || [])) { try { fn(data); } catch (e) { console.error(e); } } };
  FT.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 250); }; };
  FT.$ = (sel, root) => (root || document).querySelector(sel);
  FT.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  document.addEventListener('click', async (e) => {
    const a = e.target.closest('a[href^="#/"]');
    if (a && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && a.target !== '_blank') {
      e.preventDefault();
      FT.closeMenus();
      FT.go(a.getAttribute('href').slice(1));
      return;
    }
    const el = e.target.closest('[data-act]');
    if (el && !el.disabled && !el.classList.contains('is-loading')) {
      const fn = FT.acts[el.dataset.act];
      if (fn) {
        e.preventDefault();
        try { await fn(el, e); } catch (err) { FT.handleError(err); }
      }
    }
  });
  // No form in FinTax ever navigates the page; each one is handled in script.
  document.addEventListener('submit', (e) => { if (!e.target.closest('form[data-native]')) e.preventDefault(); }, true);
  document.addEventListener('submit', async (e) => {
    const form = e.target.closest('form[data-submit]');
    if (!form) return;
    e.preventDefault();
    const fn = FT.submits[form.dataset.submit];
    if (!fn) return;
    const btn = form.querySelector('[type=submit]') || document.querySelector('[form="' + form.id + '"]');
    const errBox = form.querySelector('.form-error');
    if (errBox) errBox.hidden = true;
    const missing = FT.firstMissing(form);
    if (missing) { FT.formError(form, 'Fill in ' + missing.label + '.'); missing.el.focus(); return; }
    FT.busy(btn, true);
    try { await fn(FT.formData(form), form, e); }
    catch (err) { if (err && (err.code === 'auth')) FT.handleError(err); else if (errBox) FT.formError(form, err.message || 'Could not save.'); else FT.handleError(err); }
    finally { FT.busy(btn, false); }
  });

  /* ---------------------------------------------------------- busy & error */
  FT.busy = (btn, on) => {
    if (!btn) return;
    if (on) { btn.classList.add('is-loading'); btn.setAttribute('aria-busy', 'true'); if (!btn.querySelector('.spinner')) btn.insertAdjacentHTML('afterbegin', '<span class="spinner" aria-hidden="true"></span>'); }
    else { btn.classList.remove('is-loading'); btn.removeAttribute('aria-busy'); const s = btn.querySelector('.spinner'); if (s) s.remove(); }
  };
  FT.handleError = (err) => {
    if (!err) return;
    if (err.code === 'auth' || (err.status === 401 && err.code !== 'bad_login' && err.code !== 'bad_password')) {
      FT.session.clear(); FT.state.me = null;
      FT.toast('Please sign in again to continue.', 'warn');
      FT.go('/login');
      return;
    }
    if (err.code === 'read_only') return FT.toast(err.message, 'warn', { ms: 8000, action: FT.state.me && FT.state.me.user.role === 'consultant' ? { label: 'Renew', fn: () => FT.go('/app/subscription') } : null });
    if (err.code === 'upgrade' || err.code === 'limit') return FT.toast(err.message, 'warn', { ms: 8000, action: FT.state.me && FT.state.me.user.role === 'consultant' ? { label: 'See plans', fn: () => FT.go('/app/subscription') } : null });
    FT.toast(err.message || 'Something went wrong. Try again.', 'error', { ms: 6500 });
    if (!(err instanceof Core.FtError) && !err.code) console.error(err);
  };

  /* ---------------------------------------------------------------- toasts */
  FT.toast = (msg, type, opts) => {
    type = type || 'success'; opts = opts || {};
    let root = document.querySelector('.toasts');
    if (!root) { root = document.createElement('div'); root.className = 'toasts'; root.setAttribute('role', 'status'); root.setAttribute('aria-live', 'polite'); document.body.appendChild(root); }
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    const ic = { success: 'circle-check', error: 'circle-alert', warn: 'triangle-alert', info: 'info' }[type] || 'info';
    el.innerHTML = String(html`${FT.icon(ic)}<span>${msg}</span>${opts.action ? html`<button type="button">${opts.action.label}</button>` : ''}`);
    if (opts.action) el.querySelector('button').addEventListener('click', () => { el.remove(); opts.action.fn(); });
    root.appendChild(el);
    setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, opts.ms || 3600);
  };

  /* ---------------------------------------------------------------- modals */
  const stack = [];
  let lastFocus = null;
  FT.modal = (o) => {
    const root = document.createElement('div');
    root.className = 'modal-root';
    const titleId = 'mt-' + Math.random().toString(36).slice(2, 8);
    root.innerHTML = String(html`<div class="modal ${o.size || ''} ${o.cls || ''}" role="dialog" aria-modal="true" ${o.title ? raw('aria-labelledby="' + titleId + '"') : raw('aria-label="Dialog"')}>
      ${o.title ? html`<div class="modal-head"><div class="grow"><h2 id="${titleId}">${o.title}</h2>${o.sub ? html`<div class="sub">${o.sub}</div>` : ''}</div><button type="button" class="icon-btn close" data-close aria-label="Close">${FT.icon('x')}</button></div>` : ''}
      ${o.bare ? o.body : html`<div class="modal-body">${o.body}</div>`}
      ${o.foot ? html`<div class="modal-foot">${o.foot}</div>` : ''}
    </div>`);
    if (!stack.length) { lastFocus = document.activeElement; document.documentElement.style.overflow = 'hidden'; }
    document.body.appendChild(root);
    let closed = false;
    const api = {
      root, el: root.querySelector('.modal'),
      close(val) {
        if (closed) return; closed = true;
        root.remove();
        const i = stack.indexOf(api); if (i >= 0) stack.splice(i, 1);
        if (!stack.length) { document.documentElement.style.overflow = ''; if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* element gone */ } }
        if (o.onClose) o.onClose(val);
      },
    };
    stack.push(api);
    root.addEventListener('mousedown', (e) => { api.downOnRoot = e.target === root; });
    root.addEventListener('click', (e) => {
      if (e.target === root && api.downOnRoot && o.dismissable !== false) api.close();
      else if (e.target.closest('[data-close]')) { e.preventDefault(); api.close(); }
    });
    if (o.mount) o.mount(api.el, api.close, api);
    setTimeout(() => { const f = api.el.querySelector('[autofocus]') || api.el.querySelector('input:not([type=hidden]):not([type=checkbox]):not([type=file]), select, textarea') || api.el.querySelector('button:not(.close)'); if (f && window.innerWidth > 640) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    return api;
  };
  FT.closeModals = () => { while (stack.length) stack[stack.length - 1].close(); };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (document.querySelector('.menu')) { FT.closeMenus(); return; }
      if (stack.length) { stack[stack.length - 1].close(); }
    }
  });

  FT.confirm = (o) => new Promise((resolve) => {
    let result = false;
    const typed = o.typeToConfirm;
    FT.modal({
      size: 'sm', title: o.title,
      body: html`<div class="stack"><p class="ink2">${o.message}</p>${typed ? html`<div class="field"><label class="label" for="cf-typed">Type <b>${typed}</b> to confirm</label><input class="input" id="cf-typed" autocomplete="off"><span class="hint error-hint" hidden>The text does not match.</span></div>` : ''}</div>`,
      foot: html`<div class="right"><button type="button" class="btn" data-close>Cancel</button><button type="button" class="btn ${o.danger ? 'btn-danger-solid' : 'btn-primary'}" data-ok>${o.confirmLabel || 'Confirm'}</button></div>`,
      onClose: () => resolve(result),
      mount: (el, close) => {
        el.querySelector('[data-ok]').addEventListener('click', () => {
          if (typed) { const v = el.querySelector('#cf-typed').value.trim(); if (v !== typed) { el.querySelector('.error-hint').hidden = false; return; } result = v; }
          else result = true;
          close();
        });
      },
    });
  });

  FT.alertBox = (o) => FT.modal({ size: o.size || 'sm', title: o.title, sub: o.sub, body: o.body, foot: html`<div class="right">${o.extraFoot || ''}<button type="button" class="btn btn-primary" data-close>${o.okLabel || 'Done'}</button></div>` });

  /* ----------------------------------------------------------------- menus */
  FT.closeMenus = () => { FT.$$('.menu').forEach((m) => m.remove()); };
  FT.menu = (anchor, items, o) => {
    o = o || {};
    const wasOpen = anchor.dataset.menuOpen === '1';
    FT.closeMenus();
    FT.$$('[data-menu-open]').forEach((x) => { x.dataset.menuOpen = ''; });
    if (wasOpen && !o.force) return null;
    const m = document.createElement('div');
    m.className = 'menu';
    m.setAttribute('role', 'menu');
    if (o.width) m.style.width = o.width + 'px';
    m.innerHTML = String(o.html || items.map((it, i) => {
      if (it.sep) return html`<div class="menu-sep"></div>`;
      if (it.head) return html`<div class="menu-head">${it.head}</div>`;
      if (it.href) return html`<a class="menu-item ${it.danger ? 'danger' : ''}" role="menuitem" href="${it.href}" ${it.external ? raw('target="_blank" rel="noopener"') : ''}>${it.icon ? FT.icon(it.icon) : ''}<span>${it.label}</span></a>`;
      return html`<button type="button" class="menu-item ${it.danger ? 'danger' : ''}" role="menuitem" data-i="${i}">${it.icon ? FT.icon(it.icon) : ''}<span>${it.label}</span></button>`;
    }));
    document.body.appendChild(m);
    anchor.dataset.menuOpen = '1';
    const r = anchor.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    let left = o.align === 'left' ? r.left : r.right - mw;
    left = Math.max(12, Math.min(left, window.innerWidth - mw - 12));
    let top = r.bottom + 6;
    if (top + mh > window.innerHeight - 12 && r.top - mh - 6 > 12) top = r.top - mh - 6;
    m.style.left = left + 'px'; m.style.top = Math.max(12, top) + 'px';
    m.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-i]');
      if (b) { const it = items[+b.dataset.i]; FT.closeMenus(); anchor.dataset.menuOpen = ''; try { if (it.fn) await it.fn(); } catch (err) { FT.handleError(err); } }
      else if (e.target.closest('a')) { FT.closeMenus(); anchor.dataset.menuOpen = ''; }
    });
    setTimeout(() => {
      const off = (e) => { if (!m.contains(e.target) && !anchor.contains(e.target)) { m.remove(); anchor.dataset.menuOpen = ''; document.removeEventListener('mousedown', off, true); document.removeEventListener('touchstart', off, true); } };
      document.addEventListener('mousedown', off, true);
      document.addEventListener('touchstart', off, true);
    }, 0);
    if (o.mount) o.mount(m);
    return m;
  };
  window.addEventListener('resize', FT.debounce(() => FT.closeMenus(), 100));

  /* ----------------------------------------------------------------- forms */
  const optList = (opts) => (opts || []).map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  FT.options = optList;
  let formSeq = 0;
  FT.field = (f, values) => {
    values = values || {};
    const getPath = (obj, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), obj);
    let v = f.name ? getPath(values, f.name) : undefined;
    if (v === undefined) v = f.value;
    const id = 'f-' + (f.id || (f.name || 'x').replace(/[^a-z0-9]/gi, '-')) + '-' + (formSeq++);
    const span = f.col ? 'span-' + f.col : '';
    const reqAttr = f.required ? raw('required') : '';
    const lab = (target) => html`<label class="label" ${target ? raw('for="' + target + '"') : ''}>${f.label}${f.required ? html`<span class="req" aria-hidden="true">*</span>` : ''}</label>`;
    const hint = f.hint ? html`<span class="hint">${f.hint}</span>` : '';
    switch (f.type) {
      case 'section': return html`<div class="form-section">${f.label}</div>`;
      case 'html': return html`<div class="field ${span}">${f.html}</div>`;
      case 'hidden': return html`<input type="hidden" name="${f.name}" value="${v == null ? '' : v}">`;
      case 'switch': return html`<div class="field ${span}"><label class="switch"><input type="checkbox" name="${f.name}" id="${id}" ${v ? raw('checked') : ''}><span class="track"></span><span>${f.label}</span></label>${hint}</div>`;
      case 'check': return html`<div class="field ${span}"><label class="check"><input type="checkbox" name="${f.name}" id="${id}" ${v ? raw('checked') : ''}><span>${f.label}</span></label>${hint}</div>`;
      case 'chips': {
        const vals = (Array.isArray(v) ? v : (v ? [v] : [])).map(String);
        return html`<div class="field ${span}">${lab()}<div class="chipset" role="group" aria-label="${f.label}">${optList(f.options).map((o) => html`<label><input type="checkbox" name="${f.name}" value="${o.value}" data-multi ${vals.indexOf(String(o.value)) >= 0 ? raw('checked') : ''}><span>${o.label}</span></label>`)}</div>${hint}</div>`;
      }
      case 'radio': return html`<div class="field ${span}">${lab()}<div class="chipset" role="radiogroup" aria-label="${f.label}">${optList(f.options).map((o) => html`<label><input type="radio" name="${f.name}" value="${o.value}" ${String(o.value) === String(v == null ? '' : v) ? raw('checked') : ''}><span>${o.label}</span></label>`)}</div>${hint}</div>`;
      case 'select': return html`<div class="field ${span}">${lab(id)}<select class="select" id="${id}" name="${f.name}" ${reqAttr} data-label="${f.label}">${f.placeholder !== undefined ? html`<option value="">${f.placeholder}</option>` : ''}${optList(f.options).map((o) => html`<option value="${o.value}" ${String(o.value) === String(v == null ? '' : v) ? raw('selected') : ''}>${o.label}</option>`)}</select>${hint}</div>`;
      case 'textarea': return html`<div class="field ${span}">${lab(id)}<textarea class="textarea" id="${id}" name="${f.name}" rows="${f.rows || 4}" placeholder="${f.placeholder || ''}" ${reqAttr} data-label="${f.label}" ${f.maxlength ? raw('maxlength="' + f.maxlength + '"') : ''}>${v == null ? '' : v}</textarea>${hint}</div>`;
      case 'money': return html`<div class="field ${span}">${lab(id)}<div class="affix"><span>${f.prefix || 'Rs'}</span><input class="input" type="text" inputmode="decimal" id="${id}" name="${f.name}" value="${v == null || v === '' ? '' : v}" placeholder="${f.placeholder || '0'}" data-num ${reqAttr} data-label="${f.label}" autocomplete="off"></div>${hint}</div>`;
      case 'file': return html`<div class="field ${span}">${f.label ? lab(id) : ''}<label class="dropzone" for="${id}">${FT.icon('upload')}<b class="small">${f.cta || 'Choose files or drop them here'}</b><span class="hint">${f.accept ? 'PDF, images, Word, Excel or CSV' : 'PDF, images, Word, Excel or ZIP'}, up to ${FT.uploadLimitMB()} MB each</span><input type="file" id="${id}" name="${f.name}" ${f.multiple ? raw('multiple') : ''} ${f.accept ? raw('accept="' + esc(f.accept) + '"') : ''}></label><div class="file-list" data-file-list></div>${hint}</div>`;
      default: {
        const t = f.type || 'text';
        return html`<div class="field ${span}">${lab(id)}${f.prefix ? raw('<div class="affix"><span>' + esc(f.prefix) + '</span>') : ''}<input class="input" type="${t === 'number' ? 'text' : t}" ${t === 'number' ? raw('inputmode="numeric" data-num') : ''} id="${id}" name="${f.name}" value="${v == null ? '' : v}" placeholder="${f.placeholder || ''}" ${reqAttr} data-label="${f.label}" ${f.autocomplete ? raw('autocomplete="' + esc(f.autocomplete) + '"') : ''} ${f.min != null ? raw('min="' + esc(f.min) + '"') : ''} ${f.max != null ? raw('max="' + esc(f.max) + '"') : ''} ${f.readonly ? raw('readonly') : ''} ${f.maxlength ? raw('maxlength="' + f.maxlength + '"') : ''}>${f.prefix ? raw('</div>') : ''}${hint}</div>`;
      }
    }
  };
  FT.fields = (fields, values) => fields.map((f) => FT.field(f, values));
  FT.firstMissing = (form) => {
    for (const el of form.querySelectorAll('[required]')) {
      if (el.disabled) continue;
      if (!String(el.value || '').trim()) return { el, label: el.dataset.label || el.name };
    }
    return null;
  };
  FT.formError = (form, msg) => {
    let box = form.querySelector('.form-error');
    if (!box) { box = document.createElement('div'); box.className = 'form-error'; form.appendChild(box); }
    box.hidden = false;
    box.innerHTML = String(html`${FT.icon('circle-alert')}<span>${msg}</span>`);
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const setPath = (obj, path, val) => { const ks = path.split('.'); let o = obj; ks.slice(0, -1).forEach((k) => { o = o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {}; }); o[ks[ks.length - 1]] = val; };
  FT.formData = (form) => {
    const out = {};
    const multi = {};
    for (const el of form.elements) {
      if (!el.name || el.disabled || el.type === 'file' || el.type === 'submit' || el.type === 'button') continue;
      if (el.dataset.multi !== undefined) { multi[el.name] = multi[el.name] || []; if (el.checked) multi[el.name].push(el.value); continue; }
      if (el.type === 'checkbox') { setPath(out, el.name, el.checked); continue; }
      if (el.type === 'radio') { if (el.checked) setPath(out, el.name, el.value); continue; }
      let v = el.value;
      if (el.dataset.num !== undefined) v = String(v).trim() === '' ? '' : Number(String(v).replace(/[, ]/g, ''));
      setPath(out, el.name, v);
    }
    for (const k of Object.keys(multi)) setPath(out, k, multi[k]);
    return out;
  };
  FT.wireFiles = (root) => {
    for (const input of root.querySelectorAll('input[type=file]')) {
      const zone = input.closest('.dropzone');
      const list = zone && zone.parentElement.querySelector('[data-file-list]');
      const show = () => { if (!list) return; list.innerHTML = String(Array.from(input.files || []).map((f) => html`<div class="file-chip">${FT.fileIcon(f.name, f.type, true)}<span class="grow ellipsis">${f.name}</span><span class="muted xs">${FT.bytes(f.size)}</span></div>`)); };
      input.addEventListener('change', show);
      if (zone) {
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('over'));
        zone.addEventListener('drop', (e) => { e.preventDefault(); zone.classList.remove('over'); if (e.dataTransfer && e.dataTransfer.files.length) { try { input.files = e.dataTransfer.files; } catch (err) { /* older browsers */ } show(); input.dispatchEvent(new Event('change')); } });
      }
    }
  };
  FT.formFiles = (form) => { const out = {}; for (const el of form.querySelectorAll('input[type=file]')) out[el.name] = Array.from(el.files || []); return out; };

  FT.formModal = (o) => new Promise((resolve) => {
    let done = false;
    const fid = 'fm' + (formSeq++);
    FT.modal({
      title: o.title, sub: o.sub, size: o.size, dismissable: false,
      body: html`<form class="form" id="${fid}" novalidate autocomplete="off">${o.intro ? html`<div class="field">${o.intro}</div>` : ''}${FT.fields(o.fields || [], o.values || {})}${o.extra || ''}<div class="form-error" hidden></div></form>`,
      foot: html`${o.footLeft || ''}<div class="right"><button type="button" class="btn" data-close>${o.cancelLabel || 'Cancel'}</button><button type="submit" form="${fid}" class="btn ${o.danger ? 'btn-danger-solid' : 'btn-primary'}">${o.submitIcon ? FT.icon(o.submitIcon) : ''}${o.submitLabel || 'Save'}</button></div>`,
      onClose: (val) => { if (!done) resolve(null); else resolve(val); },
      mount: (el, close) => {
        const form = el.querySelector('form');
        FT.wireFiles(form);
        if (o.mount) o.mount(form, el, close);
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const btn = el.querySelector('button[type=submit]');
          const box = form.querySelector('.form-error');
          box.hidden = true;
          const missing = FT.firstMissing(form);
          if (missing) { FT.formError(form, 'Fill in ' + missing.label + '.'); missing.el.focus(); return; }
          const data = FT.formData(form);
          data._files = FT.formFiles(form);
          FT.busy(btn, true);
          try {
            const res = await o.onSubmit(data, form);
            if (res === false) return;
            done = true;
            close(res === undefined ? data : res);
          } catch (err) {
            if (err && err.code === 'auth') { close(); FT.handleError(err); return; }
            FT.formError(form, (err && err.message) || 'Could not save. Try again.');
          } finally { FT.busy(btn, false); }
        });
      },
    });
  });

  /* ------------------------------------------------------------ components */
  FT.empty = (o) => html`<div class="empty"><div class="e-icon">${FT.icon(o.icon || 'inbox')}</div><h3>${o.title}</h3>${o.text ? html`<p>${o.text}</p>` : ''}${o.action || ''}</div>`;
  FT.pill = (text, tone, noDot) => html`<span class="pill ${tone || ''} ${noDot ? 'no-dot' : ''}">${text}</span>`;
  const TONES = {
    stage: { not_started: '', awaiting_docs: 'amber', in_progress: 'line', review: 'line', client_approval: 'violet', ready: 'green', filed: 'green' },
    invoice: { draft: '', sent: 'line', partial: 'amber', overdue: 'red', paid: 'green', cancelled: '' },
    notice: { received: 'amber', in_progress: 'violet', responded: 'line', hearing: 'red', closed: 'green' },
    sub: { trial: 'violet', active: 'green', expired: 'red', suspended: 'red', cancelled: '' },
    lead: { new: 'violet', contacted: 'line', demo: 'amber', won: 'green', lost: '' },
    ticket: { open: 'amber', waiting: 'line', closed: 'green' },
    priority: { low: '', normal: 'line', high: 'amber', urgent: 'red' },
    payment: { pending: 'amber', confirmed: 'green', rejected: 'red', approved: 'green' },
  };
  const LABELS = {
    invoice: { draft: 'Draft', sent: 'Sent', partial: 'Part paid', overdue: 'Overdue', paid: 'Paid', cancelled: 'Cancelled' },
    sub: { trial: 'Free trial', active: 'Active', expired: 'Expired', suspended: 'Suspended', cancelled: 'Cancelled' },
    ticket: { open: 'Open', waiting: 'Waiting on customer', closed: 'Closed' },
    payment: { pending: 'To verify', confirmed: 'Confirmed', rejected: 'Rejected', approved: 'Approved' },
  };
  FT.tone = (kind, id) => (TONES[kind] || {})[id] || '';
  FT.statusPill = (kind, id) => {
    let label = (LABELS[kind] || {})[id];
    if (!label) {
      if (kind === 'stage') label = C.stageLabel(id);
      else if (kind === 'notice') label = C.noticeStatusLabel(id);
      else if (kind === 'lead') label = (C.LEAD_STATUS.find((x) => x.id === id) || {}).label;
      else if (kind === 'priority') label = (C.PRIORITIES.find((x) => x.id === id) || {}).label;
    }
    return FT.pill(label || id || '', FT.tone(kind, id));
  };
  FT.approvalPill = (a) => {
    if (!a) return '';
    if (a.status === 'pending') return FT.pill('Awaiting approval', 'violet');
    if (a.status === 'approved') return raw('<span class="stamp green" title="Approved by client">Approved</span>');
    if (a.status === 'changes') return FT.pill('Changes requested', 'amber');
    return '';
  };
  FT.duePill = (ds, done) => { const d = FT.dueInfo(ds, done); return d.tone ? FT.pill(d.text, d.tone) : html`<span class="muted small nowrap">${d.text}</span>`; };
  const AV = ['#0E7A4F', '#4B3BC4', '#A86400', '#C8463C', '#2F5DA8', '#6B5E2F', '#0B6B6B', '#7A3E9D'];
  const hash = (s) => { let h = 0; for (const ch of String(s || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
  FT.avatar = (name, size, opts) => html`<span class="avatar ${size || ''} ${opts && opts.round ? 'round' : ''}" style="--a:${AV[hash(name) % AV.length]}" aria-hidden="true">${U.initials(name)}</span>`;
  FT.fileIcon = (name, mime, small) => {
    const ext = (String(name || '').split('.').pop() || '').toLowerCase();
    const cls = ext === 'pdf' ? 'pdf' : /^(jpe?g|png|webp|gif|heic|heif)$/.test(ext) || /^image\//.test(mime || '') ? 'img' : /^(xlsx?|csv|ods)$/.test(ext) ? 'xls' : /^(docx?|odt|txt)$/.test(ext) ? 'doc' : /^(zip|rar)$/.test(ext) ? 'zip' : '';
    return html`<span class="file-icon ${cls} ${small ? 'sm' : ''}" aria-hidden="true">${(ext || 'file').slice(0, 4).toUpperCase()}</span>`;
  };
  FT.dateTile = (ds, tone) => { if (!ds) return ''; return html`<div class="date-tile ${tone || ''}"><div class="m">${MON[+ds.slice(5, 7) - 1]}</div><div class="d">${+ds.slice(8, 10)}</div></div>`; };
  FT.copyable = (text, display) => text ? html`<span class="copyable"><span>${display || text}</span><button type="button" data-act="copy" data-text="${text}" aria-label="Copy ${display || text}" title="Copy">${FT.icon('copy')}</button></span>` : html`<span class="faint">Not added</span>`;
  FT.copy = async (text) => {
    try { await navigator.clipboard.writeText(text); FT.toast('Copied'); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      ta.remove();
      FT.toast(ok ? 'Copied' : 'Select the text and copy it manually.', ok ? 'success' : 'warn');
    }
  };
  FT.act('copy', (el) => FT.copy(el.dataset.text || ''));
  FT.wa = (phone, text) => { const n = U.waNumber(phone); return n ? 'https://wa.me/' + n + (text ? '?text=' + encodeURIComponent(text) : '') : ''; };
  FT.waBtn = (phone, text, label, cls) => { const href = FT.wa(phone, text); return href ? html`<a class="btn btn-wa ${cls || 'btn-sm'}" href="${href}" target="_blank" rel="noopener">${FT.icon('message-circle')}<span>${label || 'WhatsApp'}</span></a>` : ''; };
  FT.table = (o) => {
    if (!o.rows.length) return o.empty || FT.empty({ title: 'Nothing here yet' });
    return html`<div class="table-wrap"><table class="tbl"><thead><tr>${o.cols.map((c) => html`<th class="${c.num ? 'num' : ''} ${c.cls || ''}" scope="col">${c.label}</th>`)}</tr></thead><tbody>${o.rows.map((r) => html`<tr class="${o.rowAct ? 'clickable' : ''} ${o.rowClass ? o.rowClass(r) : ''}" ${o.rowAct ? raw('data-act="' + esc(o.rowAct) + '" data-id="' + esc(r.id) + '"') : ''}>${o.cols.map((c) => html`<td class="${c.num ? 'num' : ''} ${c.tdCls || ''}">${c.render ? c.render(r) : r[c.key]}</td>`)}</tr>`)}</tbody></table></div>${o.foot || ''}`;
  };
  FT.skeleton = () => html`<div class="page"><div class="page-loading"><div class="skel" style="height:34px;width:240px"></div><div class="skel" style="height:96px"></div><div class="grid cols-main"><div class="skel" style="height:300px"></div><div class="skel" style="height:300px"></div></div></div></div>`;
  FT.errorPage = (err) => html`<div class="page">${FT.empty({ icon: 'triangle-alert', title: 'This page could not load', text: (err && err.message) || 'Something went wrong.', action: html`<button class="btn btn-primary" data-act="reload">${FT.icon('refresh-cw')}Try again</button>` })}</div>`;
  FT.act('reload', () => FT.reload());

  /* --------------------------------------------------------------- brand */
  const hex = (h) => { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); const n = parseInt(h, 16); return isNaN(n) || h.length !== 6 ? null : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (rgb) => '#' + rgb.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t);
  FT.applyBrand = (brand) => {
    FT.state.brand = brand || FT.state.brand || { name: 'FinTax' };
    const p = hex(FT.state.brand.primary) || hex('#0E7A4F');
    const s = document.documentElement.style;
    s.setProperty('--ledger', toHex(p));
    s.setProperty('--ledger-deep', toHex(mix(p, [0, 0, 0], 0.25)));
    s.setProperty('--ledger-ink', toHex(mix(p, [4, 20, 12], 0.55)));
    s.setProperty('--ledger-wash', toHex(mix(p, [255, 255, 255], 0.88)));
    s.setProperty('--ledger-tint', toHex(mix(p, [255, 255, 255], 0.945)));
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) meta.setAttribute('content', toHex(p));
  };
  FT.brandName = () => (FT.state.brand && FT.state.brand.name) || 'FinTax';
  FT.brandLockup = (o) => {
    o = o || {};
    const b = FT.state.brand || {};
    if (b.logo) return html`<img class="brand-logo" src="${b.logo}" alt="${FT.brandName()}">`;
    return html`<span class="brand-mark">${FT.mark()}</span><span><span class="brand-name">${FT.brandName()}</span>${o.sub ? html`<span class="brand-sub" style="display:block">${o.sub}</span>` : ''}</span>`;
  };

  /* -------------------------------------------------------------- router */
  FT.routes = [];
  FT.route = (pattern, view, opts) => {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\/:([a-zA-Z]+)(\?)?/g, (_, k, opt) => { keys.push(k); return opt ? '(?:/([^/]+))?' : '/([^/]+)'; }) + '/?$');
    FT.routes.push({ pattern, re, keys, view, opts: opts || {} });
  };
  let memPath = '/';
  const memHistory = [];
  FT.path = () => (FT.mode === 'memory' ? memPath : (decodeURI(location.hash.replace(/^#/, '')) || '/'));
  FT.go = (path, opts) => {
    opts = opts || {};
    if (!path) path = '/';
    if (FT.mode === 'memory') {
      if (!opts.replace && memPath !== path) memHistory.push(memPath);
      memPath = path;
      return renderRoute();
    }
    const target = '#' + path;
    if (location.hash === target) return renderRoute();
    if (opts.replace) { history.replaceState(null, '', target); return renderRoute(); }
    location.hash = path;
    return null;
  };
  FT.back = (fallback) => {
    if (FT.mode === 'memory') { const p = memHistory.pop(); memPath = p || fallback || '/'; return renderRoute(); }
    if (history.length > 1) history.back(); else FT.go(fallback || '/');
    return null;
  };
  window.addEventListener('hashchange', () => { if (FT.mode !== 'memory') renderRoute(); });
  FT.query = () => { const q = FT.path().split('?')[1] || ''; return Object.fromEntries(new URLSearchParams(q)); };
  FT.layouts = {};
  let renderSeq = 0;
  FT.keepScroll = false;
  async function renderRoute() {
    const my = ++renderSeq;
    const full = FT.path();
    const [p, qs] = full.split('?');
    const query = Object.fromEntries(new URLSearchParams(qs || ''));
    let match = null; const params = {};
    for (const r of FT.routes) { const m = r.re.exec(p); if (m) { match = r; r.keys.forEach((k, i) => { params[k] = m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined; }); break; } }
    if (!match) match = FT.routes.find((r) => r.pattern === '/');
    FT.closeMenus();
    const need = match.opts.role;
    if (need || match.opts.guestOnly) {
      if (!FT.state.me && FT.session.has()) { try { await FT.loadMe(); } catch (e) { FT.session.clear(); } }
      if (my !== renderSeq) return;
    }
    const me = FT.state.me;
    if (match.opts.guestOnly && me) return FT.go(FT.homeFor(me.user), { replace: true });
    if (need) {
      if (!me) { FT.state.after = full; return FT.go('/login', { replace: true }); }
      const role = me.user.role;
      const ok = need === 'admin' ? role === 'admin' : need === 'firm' ? (role === 'consultant' || role === 'staff') : role === 'client';
      if (!ok) return FT.go(FT.homeFor(me.user), { replace: true });
      if (match.opts.owner && role !== 'consultant') { FT.toast('Only the practice owner can open that page.', 'warn'); return FT.go('/app', { replace: true }); }
    }
    const layout = match.opts.layout || 'site';
    const container = FT.mountLayout(layout, p);
    const ctx = { params, query, path: p, full, mounts: [], title: '', mount(fn) { this.mounts.push(fn); } };
    const keep = FT.keepScroll; FT.keepScroll = false;
    const prevY = window.scrollY;
    if (!keep && match.opts.skeleton !== false && layout !== 'site') container.innerHTML = String(FT.skeleton());
    try {
      const out = await match.view(ctx);
      if (my !== renderSeq) return;
      container.innerHTML = String(out == null ? '' : out);
      document.title = (ctx.title ? ctx.title + ' | ' : '') + FT.brandName();
      for (const fn of ctx.mounts) { try { fn(container, ctx); } catch (e) { console.error(e); } }
      if (keep) window.scrollTo(0, prevY); else if (!query.keep) window.scrollTo(0, 0);
      FT.emit('routed', { layout, path: p, query });
    } catch (err) {
      if (my !== renderSeq) return;
      if (err && err.code === 'auth') { FT.handleError(err); return; }
      container.innerHTML = String(FT.errorPage(err));
      console.error(err);
    }
  }
  FT.reload = () => { FT.keepScroll = true; return renderRoute(); };
  FT.render = renderRoute;
  FT.mountLayout = (layout, path) => {
    const root = document.getElementById('root');
    const fn = FT.layouts[layout];
    if (!fn) { root.innerHTML = '<div id="view"></div>'; return document.getElementById('view'); }
    if (root.dataset.layout !== layout || !document.getElementById('view')) {
      root.innerHTML = String(fn.shell());
      root.dataset.layout = layout;
      if (fn.mount) fn.mount(root);
    }
    if (fn.update) fn.update(root, path);
    document.body.classList.toggle('on-site', layout === 'site');
    document.body.classList.toggle('has-tabbar', layout === 'portal');
    return document.getElementById('view');
  };
  FT.homeFor = (u) => (!u ? '/' : u.role === 'admin' ? '/admin' : u.role === 'client' ? '/portal' : '/app');

  /* ---------------------------------------------------------- API client */
  class ApiError extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code; } }
  FT.ApiError = ApiError;
  FT.session = {
    has() { return FT.backend === 'server' ? !!FT.ls.get('fintax.token') : !!FT.ls.get('fintax.preview.session', FT._memSession || null); },
    clear() { FT.ls.del('fintax.token'); FT.ss.del('fintax.adminToken'); FT.ls.del('fintax.preview.session'); FT._memSession = null; },
  };
  FT.local = {
    ready: false,
    init() {
      if (this.ready) return;
      const KEY = 'fintax.preview.db.v1';
      const store = new Core.MemoryStore();
      let saved = null;
      try { saved = window.localStorage ? JSON.parse(window.localStorage.getItem(KEY) || 'null') : null; } catch (e) { saved = null; }
      if (saved && saved.v === 1 && saved.data) store.load(saved.data);
      this.core = Core.create({ store, preview: true });
      if (!store.all('users').length) { window.FinTaxSeed.seedDemo(this.core); this.fresh = true; }
      let timer = null; let warned = false;
      store.on(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          try { window.localStorage.setItem(KEY, JSON.stringify({ v: 1, savedAt: Date.now(), data: store.dump() })); }
          catch (e) { if (!warned) { warned = true; FT.toast('This browser is not keeping preview changes, so they reset when you reload.', 'warn', { ms: 7000 }); } }
        }, 350);
      });
      this.store = store;
      this.ready = true;
    },
    session() { return FT.ls.get('fintax.preview.session', FT._memSession || null); },
    setSession(s) { FT._memSession = s; if (s) FT.ls.set('fintax.preview.session', s); else FT.ls.del('fintax.preview.session'); },
    reset() { try { window.localStorage.removeItem('fintax.preview.db.v1'); } catch (e) { /* storage unavailable */ } this.setSession(null); this.ready = false; this.init(); },
    exec(action, payload) {
      this.init();
      const core = this.core;
      const s = this.session();
      const user = s ? { id: s.userId, impersonatedBy: s.impersonatedBy || null } : null;
      if (action === 'auth.login' || action === 'auth.signup') { const u = core.exec(null, action, payload); this.setSession({ userId: u.id }); return { user: u }; }
      if (action === 'auth.logout') { this.setSession(null); return { ok: true }; }
      if (action === 'admin.impersonate') { const r = core.exec(user, action, payload); this.setSession({ userId: r.user.id, impersonatedBy: user.id, returnTo: user.id }); return r; }
      if (action === 'session.return') { if (s && s.returnTo) { this.setSession({ userId: s.returnTo }); return { ok: true }; } return { ok: false }; }
      if (action === 'session.switch') { // preview-only: jump between demo roles
        const u = core.store.all('users').find((x) => x.email === payload.email);
        if (!u) throw new ApiError('That demo login no longer exists. Reset the demo to restore it.', 404, 'not_found');
        this.setSession({ userId: u.id });
        return { ok: true };
      }
      if (action === 'admin.backup') { const out = core.store.dump(); return { exportedAt: new Date().toISOString(), version: Core.VERSION, data: out }; }
      return core.exec(user, action, payload);
    },
  };
  FT.api = async (action, payload) => {
    if (FT.backend === 'local') {
      await Promise.resolve();
      try { return FT.local.exec(action, payload || {}); }
      catch (e) { if (e instanceof Core.FtError) throw new ApiError(e.message, e.status, e.code); throw e; }
    }
    const token = FT.ls.get('fintax.token');
    if (action === 'session.return') {
      const admin = FT.ss.get('fintax.adminToken');
      if (admin) {
        try { await fetch('api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'auth.logout' }) }); } catch (e) { /* the support session expires on its own */ }
        FT.ls.set('fintax.token', admin); FT.ss.del('fintax.adminToken');
        return { ok: true };
      }
      return { ok: false };
    }
    if (action === 'session.switch') throw new ApiError('Demo switching is only available in preview mode.', 400, 'bad_request');
    let res;
    try {
      res = await fetch('api/rpc', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: JSON.stringify({ action, payload: payload || {} }) });
    } catch (e) { throw new ApiError('Cannot reach the server. Check your internet connection and try again.', 0, 'offline'); }
    let j = null;
    try { j = await res.json(); } catch (e) { throw new ApiError('The server sent an unexpected response.', res.status, 'server'); }
    if (!j.ok) throw new ApiError(j.error || 'Request failed.', res.status, j.code);
    if (j.data && j.data.token) {
      if (action === 'admin.impersonate' && token) FT.ss.set('fintax.adminToken', token);
      FT.ls.set('fintax.token', j.data.token);
    }
    if (action === 'auth.logout') FT.ls.del('fintax.token');
    return j.data;
  };
  FT.loadMe = async () => { const me = await FT.api('me.get'); FT.state.me = me; FT.applyBrand(me.brand); return me; };
  FT.signOut = async () => {
    try { await FT.api('auth.logout'); } catch (e) { /* already signed out */ }
    FT.session.clear(); FT.state.me = null;
    FT.go('/login');
  };

  /* ------------------------------------------------------------- files */
  FT.uploadLimitMB = () => (FT.backend === 'local' ? 10 : 25);
  const IDB = {
    mem: new Map(),
    open() {
      if (this.p) return this.p;
      this.p = new Promise((res) => {
        try { const r = indexedDB.open('fintax-preview-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('blobs'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null); }
        catch (e) { res(null); }
      });
      return this.p;
    },
    async put(k, v) {
      this.mem.set(k, v);
      const db = await this.open(); if (!db) return;
      await new Promise((res) => { try { const tx = db.transaction('blobs', 'readwrite'); tx.objectStore('blobs').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => res(); tx.onabort = () => res(); } catch (e) { res(); } });
    },
    async get(k) {
      if (this.mem.has(k)) return this.mem.get(k);
      const db = await this.open(); if (!db) return null;
      return new Promise((res) => { try { const rq = db.transaction('blobs').objectStore('blobs').get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); } catch (e) { res(null); } });
    },
  };
  const readDataUrl = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new ApiError('Could not read that file.', 400, 'file')); r.readAsDataURL(file); });
  FT.readDataUrl = readDataUrl;
  FT.files = {
    async upload(file) {
      const lim = FT.uploadLimitMB() * 1048576;
      if (file.size > lim) throw new ApiError(file.name + ' is larger than ' + FT.uploadLimitMB() + ' MB.', 413, 'too_large');
      if (FT.backend === 'local') {
        const blobId = 'lb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        await IDB.put(blobId, { name: file.name, mime: file.type, blob: file });
        return { blobId, size: file.size, name: file.name, mime: file.type || '' };
      }
      const data = await readDataUrl(file);
      const token = FT.ls.get('fintax.token');
      let res;
      try { res = await fetch('api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name: file.name, mime: file.type, data }) }); }
      catch (e) { throw new ApiError('Upload failed. Check your connection and try again.', 0, 'offline'); }
      const j = await res.json().catch(() => ({ ok: false, error: 'Upload failed.' }));
      if (!j.ok) throw new ApiError(j.error || 'Upload failed.', res.status, j.code);
      return { blobId: j.data.blobId, size: j.data.size, name: file.name, mime: file.type || '' };
    },
    async get(blobId) {
      if (!blobId) return null;
      if (FT.backend === 'local') { const r = await IDB.get(blobId); return r ? r.blob : null; }
      const res = await fetch('api/file/' + encodeURIComponent(blobId), { headers: { Authorization: 'Bearer ' + FT.ls.get('fintax.token') } });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new ApiError(j.error || 'That file could not be opened.', res.status, j.code); }
      return res.blob();
    },
    async save(filename, data, mime) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'text/plain;charset=utf-8' });
      if (FT.preview) {
        let dl = null;
        try { dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; } catch (e) { dl = null; }
        if (!dl) { FT.toast('Downloads are not available in this preview. They work once FinTax runs on your own domain.', 'warn', { ms: 7000 }); return; }
        try { await dl.save({ filename, data: blob }); FT.toast('Saved ' + filename); }
        catch (e) { if (e && e.code === 'declined') return; if (e && e.code === 'rejected_extension') FT.toast('This file type cannot be saved from the preview.', 'warn'); else FT.toast('The file could not be saved here.', 'warn'); }
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    },
    async download(blobId, name) { const b = await FT.files.get(blobId); if (!b) return FT.toast('This file has no stored content.', 'warn'); return FT.files.save(name || 'file', b); },
  };
  FT.uploadAll = async (files, onEach) => {
    const out = [];
    for (const f of files) { const r = await FT.files.upload(f); out.push(r); if (onEach) await onEach(r, f); }
    return out;
  };
  FT.csv = (rows, cols) => {
    const cell = (v) => { const s = String(v == null ? '' : v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    return '﻿' + [cols.map((c) => cell(c.label)).join(',')].concat(rows.map((r) => cols.map((c) => cell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(','))).join('\r\n');
  };
  FT.parseCsv = (text) => {
    const rows = []; let row = []; let cell = ''; let q = false;
    text = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  };

  /* ---------------------------------------------------------- install */
  FT.pwa = {
    deferred: null,
    init() {
      window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); FT.pwa.deferred = e; FT.emit('pwa'); });
      window.addEventListener('appinstalled', () => { FT.pwa.deferred = null; FT.toast(FT.brandName() + ' is installed on this device.'); FT.emit('pwa'); });
      if (!FT.preview && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
        window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ }); });
      }
    },
    standalone() { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } },
    async install() {
      if (FT.pwa.deferred) {
        const d = FT.pwa.deferred; FT.pwa.deferred = null;
        d.prompt();
        try { const r = await d.userChoice; if (r && r.outcome === 'accepted') FT.toast('Adding ' + FT.brandName() + ' to your home screen.'); } catch (e) { /* user closed the prompt */ }
        return;
      }
      FT.pwa.instructions();
    },
    instructions() {
      const ua = navigator.userAgent || '';
      const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
      const android = /Android/.test(ua);
      const steps = ios
        ? [['Open this page in Safari', 'Home-screen apps on iPhone and iPad are added from Safari.'], ['Tap the Share button', 'It is the square with an arrow, in the toolbar.'], ['Choose Add to Home Screen', 'Then tap Add. The ' + FT.brandName() + ' icon appears on your home screen.']]
        : android
          ? [['Open the browser menu', 'Tap the three dots in the top corner of Chrome.'], ['Choose Install app or Add to Home screen', 'Confirm with Install.'], ['Open it from your home screen', FT.brandName() + ' opens full screen like any other app.']]
          : [['Look for the install icon', 'In Chrome or Edge it sits at the right end of the address bar.'], ['Or open the browser menu', 'Choose Install ' + FT.brandName() + ' (Chrome) or Apps, then Install this site as an app (Edge).'], ['Pin it', 'Pin the app to your taskbar or dock for one-click access.']];
      FT.modal({
        size: 'sm', title: 'Install ' + FT.brandName() + ' on this device', sub: 'Use it full screen, straight from your home screen.',
        body: html`<div class="track-steps">${steps.map((s, i) => html`<div class="track-step ${i === 0 ? 'now' : ''}"><div class="dot">${i + 1}</div><div><div class="t">${s[0]}</div><div class="s">${s[1]}</div></div></div>`)}</div>${FT.preview ? html`<div class="callout violet mt-2">${FT.icon('info')}<span>You are viewing a preview. One-tap install works once FinTax runs on your own domain over HTTPS. The steps above still add a shortcut to this page.</span></div>` : ''}`,
        foot: html`<div class="right"><button type="button" class="btn btn-primary" data-close>Got it</button></div>`,
      });
    },
  };
  FT.act('install', () => FT.pwa.install());
  FT.installBtn = (cls, label) => (FT.pwa.standalone() ? '' : html`<button type="button" class="btn ${cls || ''}" data-act="install" title="Install the app on this device">${FT.icon('smartphone')}<span>${label || 'Install app'}</span></button>`);

  /* -------------------------------------------------------- chart tips */
  let tipEl = null;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'chart-tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = t.getAttribute('data-tip');
    tipEl.hidden = false;
  });
  document.addEventListener('mousemove', (e) => { if (tipEl && !tipEl.hidden) { const w = tipEl.offsetWidth; tipEl.style.left = Math.min(e.clientX + 14, window.innerWidth - w - 10) + 'px'; tipEl.style.top = (e.clientY - 36) + 'px'; } });
})();
