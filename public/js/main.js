/*! FinTax shells, navigation, notifications, command palette and boot. */
(function () {
  'use strict';
  const FT = window.FT;
  const { html, raw, U } = FT;

  /* ------------------------------------------------------------ nav maps */
  const NAV = {
    admin: [
      { items: [{ href: '/admin', icon: 'layout-dashboard', label: 'Dashboard' }] },
      { group: 'Business', items: [
        { href: '/admin/firms', icon: 'building-2', label: 'Practices' },
        { href: '/admin/payments', icon: 'banknote', label: 'Payments', count: 'payments' },
        { href: '/admin/plans', icon: 'layers', label: 'Plans and pricing' },
        { href: '/admin/leads', icon: 'target', label: 'Leads', count: 'leads' },
      ] },
      { group: 'Website', items: [
        { href: '/admin/website', icon: 'globe', label: 'Website content' },
        { href: '/admin/announcements', icon: 'megaphone', label: 'Announcements' },
      ] },
      { group: 'Support', items: [
        { href: '/admin/support', icon: 'life-buoy', label: 'Support tickets', count: 'tickets' },
        { href: '/admin/activity', icon: 'history', label: 'Activity log' },
        { href: '/admin/settings', icon: 'settings', label: 'Settings' },
      ] },
    ],
    app: [
      { items: [{ href: '/app', icon: 'layout-dashboard', label: 'Dashboard' }] },
      { group: 'Practice', items: [
        { href: '/app/clients', icon: 'users', label: 'Clients' },
        { href: '/app/documents', icon: 'folder-open', label: 'Documents', count: 'uploads', soft: true },
        { href: '/app/filings', icon: 'square-kanban', label: 'Returns and filings', count: 'overdue' },
        { href: '/app/notices', icon: 'gavel', label: 'Notices' },
        { href: '/app/tasks', icon: 'list-checks', label: 'Tasks' },
        { href: '/app/calendar', icon: 'calendar-days', label: 'Calendar' },
      ] },
      { group: 'Money', items: [
        { href: '/app/invoices', icon: 'receipt', label: 'Invoices' },
        { href: '/app/payments', icon: 'wallet', label: 'Payments', count: 'proofs' },
        { href: '/app/expenses', icon: 'coins', label: 'Expenses', owner: true },
      ] },
      { group: 'People', items: [
        { href: '/app/messages', icon: 'message-square', label: 'Messages', count: 'messages' },
        { href: '/app/reports', icon: 'chart-column', label: 'Reports', owner: true },
        { href: '/app/team', icon: 'users-round', label: 'Team', owner: true },
      ] },
      { group: 'Account', items: [
        { href: '/app/subscription', icon: 'crown', label: 'Subscription', owner: true },
        { href: '/app/settings', icon: 'settings', label: 'Practice settings', owner: true },
        { href: '/app/support', icon: 'life-buoy', label: 'Help and support' },
      ] },
    ],
    portal: [
      { items: [
        { href: '/portal', icon: 'house', label: 'Home', tab: 'Home' },
        { href: '/portal/documents', icon: 'folder-open', label: 'Documents', tab: 'Files', count: 'docsAction' },
        { href: '/portal/filings', icon: 'file-check', label: 'Returns', tab: 'Returns', count: 'filingApprovals' },
        { href: '/portal/invoices', icon: 'receipt', label: 'Invoices', tab: 'Fees', count: 'invoices' },
        { href: '/portal/messages', icon: 'message-square', label: 'Messages', tab: 'Chat', count: 'messages' },
        { href: '/portal/notices', icon: 'gavel', label: 'Notices' },
        { href: '/portal/profile', icon: 'circle-user', label: 'My profile' },
      ] },
    ],
  };
  const homeOf = { admin: '/admin', app: '/app', portal: '/portal' };
  const isActive = (href, path, home) => (href === home ? path === home : path === href || path.startsWith(href + '/'));

  function navHtml(kind, path) {
    const me = FT.state.me;
    const owner = me && me.user.role === 'consultant';
    const unread = (me && me.unread) || {};
    const home = homeOf[kind];
    return html`${NAV[kind].map((g) => html`${g.group ? html`<div class="nav-group">${g.group}</div>` : ''}${g.items.filter((it) => !it.owner || owner).map((it) => html`<a class="nav-item ${isActive(it.href, path, home) ? 'active' : ''}" href="${'#' + it.href}">${FT.icon(it.icon)}<span>${it.label}</span>${it.count && unread[it.count] ? html`<span class="count ${it.soft ? 'green' : ''}">${unread[it.count]}</span>` : ''}</a>`)}`)}`;
  }
  function tabbarHtml(path) {
    const unread = (FT.state.me && FT.state.me.unread) || {};
    return html`${NAV.portal[0].items.filter((it) => it.tab).map((it) => html`<a href="${'#' + it.href}" class="${isActive(it.href, path, '/portal') ? 'active' : ''}">${FT.icon(it.icon)}<span>${it.tab}</span>${it.count && unread[it.count] ? html`<span class="count">${unread[it.count]}</span>` : ''}</a>`)}`;
  }
  function sideFoot(kind) {
    const me = FT.state.me;
    if (kind === 'app' && me && me.sub) {
      const s = me.sub;
      const tone = s.status === 'expired' || s.status === 'suspended' ? 'danger' : s.status === 'trial' && s.daysLeft <= 5 ? 'warn' : '';
      const line = s.status === 'trial' ? FT.plural(Math.max(0, s.daysLeft), 'day') + ' left in your trial' : s.status === 'active' ? 'Renews ' + FT.date(FT.isoDay(s.endsAt)) : s.status === 'expired' ? 'Subscription ended' : 'Account suspended';
      return html`<a class="plan-chip ${tone}" href="${me.user.role === 'consultant' ? '#/app/subscription' : '#/app'}">${FT.icon('crown')}<span class="grow"><b>${me.plan ? me.plan.name : ''}</b>${line}</span></a>${FT.installBtn('btn-sm btn-quiet')}`;
    }
    if (kind === 'portal' && me && me.firmContact) {
      const f = me.firmContact;
      return html`<div class="plan-chip">${FT.icon('briefcase')}<span class="grow"><b>${f.name}</b>Your tax consultant</span></div>${FT.installBtn('btn-sm btn-quiet')}`;
    }
    return FT.installBtn('btn-sm btn-quiet');
  }
  function banners(kind) {
    const me = FT.state.me;
    if (!me) return '';
    const out = [];
    if (me.user.impersonatedBy) out.push(html`<div class="banner ink">${FT.icon('shield-check')}<span>You are viewing <b>${me.firm ? me.firm.name : me.user.name}</b> as FinTax support. Actions are logged.</span><button class="btn btn-sm" data-act="return-admin">Return to admin</button></div>`);
    if (kind === 'app' && me.sub) {
      const s = me.sub; const owner = me.user.role === 'consultant';
      if (s.status === 'expired') out.push(html`<div class="banner danger">${FT.icon('lock')}<span>Your subscription has ended, so the account is read-only. Your data is safe.</span>${owner ? html`<a class="btn btn-sm btn-primary" href="#/app/subscription">Renew now</a>` : ''}</div>`);
      else if (s.status === 'suspended') out.push(html`<div class="banner danger">${FT.icon('ban')}<span>This account is suspended. ${me.firm.suspendReason ? me.firm.suspendReason + '. ' : ''}Contact FinTax support to restore access.</span><a class="btn btn-sm" href="#/app/support">Contact support</a></div>`);
      else if (s.pendingPaymentId) out.push(html`<div class="banner violet">${FT.icon('hourglass')}<span>We are verifying your payment. Your plan switches on as soon as it is confirmed.</span></div>`);
      else if (s.status === 'trial' && s.daysLeft <= 5) out.push(html`<div class="banner">${FT.icon('timer')}<span>Your free trial ends in <b>${FT.plural(Math.max(0, s.daysLeft), 'day')}</b>. Choose a plan to keep your client portal and data active.</span>${owner ? html`<a class="btn btn-sm btn-primary" href="#/app/subscription">Choose a plan</a>` : ''}</div>`);
    }
    return html`${out}`;
  }

  /* -------------------------------------------------------- app shells */
  function makeShell(kind) {
    return {
      shell() {
        const me = FT.state.me;
        return html`<div class="shell ${kind === 'portal' ? 'portal' : ''}" id="shell">
          <aside class="side" id="side" aria-label="Main navigation">
            <a class="side-brand" href="${'#' + homeOf[kind]}">${FT.brandLockup({ sub: kind === 'admin' ? 'Master admin' : kind === 'portal' ? 'Client portal' : (me && me.firm ? me.firm.name : '') })}</a>
            <nav class="side-nav" id="side-nav"></nav>
            <div class="side-foot" id="side-foot"></div>
          </aside>
          <div class="scrim" data-act="nav-close"></div>
          <div class="main">
            <div id="banners"></div>
            <header class="topbar">
              <button class="icon-btn menu-btn" data-act="nav-open" aria-label="Open menu">${FT.icon('menu')}</button>
              ${kind === 'portal' ? html`<div class="row show-sm-flex" style="min-width:0"><b class="ellipsis">${me && me.firmContact ? me.firmContact.name : ''}</b></div>` : html`<button class="cmd-btn" data-act="cmdk" aria-label="Search">${FT.icon('search')}<span>${kind === 'admin' ? 'Search practices or jump to a page' : 'Search clients, files, returns'}</span><kbd>Ctrl K</kbd></button>`}
              <div class="top-actions">
                ${kind === 'app' ? html`<button class="btn btn-primary btn-sm hide-sm" data-act="quick-new">${FT.icon('plus')}New</button>` : ''}
                <button class="icon-btn" data-act="notifications" aria-label="Notifications" id="bell">${FT.icon('bell')}</button>
                <button class="me-btn" data-act="me-menu" aria-label="Account menu">${FT.avatar(me ? me.user.name : '?', 'sm')}<span class="me-name ellipsis">${me ? me.user.name : ''}</span>${FT.icon('chevron-down')}</button>
              </div>
            </header>
            <main id="view" tabindex="-1"></main>
          </div>
          ${kind === 'portal' ? html`<nav class="tabbar" id="tabbar" aria-label="Portal"></nav>` : ''}
        </div>`;
      },
      update(root, path) {
        const me = FT.state.me;
        const nav = root.querySelector('#side-nav'); if (nav) nav.innerHTML = String(navHtml(kind, path));
        const foot = root.querySelector('#side-foot'); if (foot) foot.innerHTML = String(sideFoot(kind));
        const b = root.querySelector('#banners'); if (b) b.innerHTML = String(banners(kind));
        const tb = root.querySelector('#tabbar'); if (tb) tb.innerHTML = String(tabbarHtml(path));
        const bell = root.querySelector('#bell');
        if (bell && me) { const n = (me.unread || {}).notifications || 0; bell.innerHTML = String(html`${FT.icon('bell')}${n ? html`<span class="count">${n > 99 ? '99+' : n}</span>` : ''}`); }
        root.querySelector('#shell').classList.remove('nav-open');
      },
    };
  }
  FT.layouts.admin = makeShell('admin');
  FT.layouts.app = makeShell('app');
  FT.layouts.portal = makeShell('portal');
  FT.refreshChrome = () => {
    const root = document.getElementById('root');
    const kind = root && root.dataset.layout;
    if (kind && FT.layouts[kind] && FT.layouts[kind].update && document.getElementById('shell')) FT.layouts[kind].update(root, FT.path().split('?')[0]);
  };
  FT.act('nav-open', () => { const s = document.getElementById('shell'); if (s) s.classList.add('nav-open'); });
  FT.act('nav-close', () => { const s = document.getElementById('shell'); if (s) s.classList.remove('nav-open'); });
  FT.act('return-admin', async () => { await FT.api('session.return'); await FT.loadMe(); FT.toast('Back in the master admin'); FT.go('/admin/firms'); });

  /* ping keeps badges fresh after every navigation and on a timer */
  const ping = async () => {
    if (!FT.state.me) return;
    try {
      const r = await FT.api('me.ping');
      const before = JSON.stringify(FT.state.me.unread) + JSON.stringify(FT.state.me.sub);
      FT.state.me.unread = r.unread; if (r.sub) FT.state.me.sub = r.sub;
      if (before !== JSON.stringify(r.unread) + JSON.stringify(r.sub)) FT.refreshChrome();
    } catch (e) { if (e && e.code === 'auth') FT.handleError(e); }
  };
  FT.ping = ping;
  FT.listen('routed', (r) => { if (r.layout !== 'site' && r.layout !== 'auth') ping(); });
  setInterval(() => { if (FT.backend === 'server' && document.visibilityState === 'visible') ping(); }, 30000);

  /* ----------------------------------------------------- notifications */
  const NOTIF_ICON = { upload: 'file-up', payment: 'wallet', warning: 'triangle-alert', success: 'circle-check', approval: 'stamp', request: 'clipboard-list', message: 'message-square', comment: 'message-square-text', task: 'list-checks', invoice: 'receipt', notice: 'gavel', signup: 'user-plus', lead: 'target', support: 'life-buoy', reset: 'key-round', document: 'file-text', info: 'info' };
  const NOTIF_TONE = { warning: 'amber', success: 'green', approval: 'violet', payment: 'green', notice: 'red', reset: 'amber' };
  FT.act('notifications', async (el) => {
    const list = await FT.api('notifications.list');
    FT.menu(el, [], {
      width: 380,
      html: html`<div class="row between" style="padding:8px 10px 6px"><b>Notifications</b>${list.some((n) => !n.read) ? html`<button class="btn btn-sm btn-quiet" data-read-all>Mark all read</button>` : ''}</div>
        ${list.length ? list.slice(0, 30).map((n) => html`<div class="notif ${n.read ? '' : 'unread'}" data-n="${n.id}" data-link="${n.link || ''}" role="menuitem" tabindex="0"><span class="li-icon ${NOTIF_TONE[n.kind] || ''}" style="width:32px;height:32px">${FT.icon(NOTIF_ICON[n.kind] || 'bell')}</span><div class="grow" style="min-width:0"><div class="n-title">${n.title}</div>${n.body ? html`<div class="n-body">${n.body}</div>` : ''}<div class="n-time">${FT.ago(n.createdAt)}</div></div></div>`) : html`<div class="empty" style="padding:26px 10px">${FT.icon('bell')}<p>You are all caught up.</p></div>`}`,
      mount: (m) => {
        m.addEventListener('click', async (e) => {
          const all = e.target.closest('[data-read-all]');
          if (all) { await FT.api('notifications.read', {}); FT.closeMenus(); ping(); return; }
          const n = e.target.closest('[data-n]');
          if (n) { FT.closeMenus(); await FT.api('notifications.read', { id: n.dataset.n }); ping(); if (n.dataset.link) FT.go(n.dataset.link); }
        });
      },
    });
  });

  /* ------------------------------------------------------------ me menu */
  FT.act('me-menu', (el) => {
    const me = FT.state.me;
    const items = [{ head: me.user.email }];
    items.push({ label: 'My profile and password', icon: 'circle-user', fn: () => FT.profileModal() });
    if (me.user.role === 'client') items.push({ label: 'Contact details', icon: 'contact', fn: () => FT.go('/portal/profile') });
    if (!FT.pwa.standalone()) items.push({ label: 'Install the app', icon: 'smartphone', fn: () => FT.pwa.install() });
    items.push({ label: 'Visit the website', icon: 'globe', fn: () => FT.go('/') });
    items.push({ sep: true });
    items.push({ label: 'Sign out', icon: 'log-out', danger: true, fn: () => FT.signOut() });
    FT.menu(el, items);
  });
  FT.profileModal = () => {
    const me = FT.state.me;
    const isClient = me.user.role === 'client';
    FT.modal({
      title: 'My profile', sub: me.user.email,
      body: html`<div class="stack loose">
        <form class="form" data-submit="me-save" id="me-form">
          ${FT.fields([{ name: 'name', label: 'Full name', required: true, col: 6, readonly: isClient }, { name: 'phone', label: 'Mobile', type: 'tel', col: 6 }].concat(isClient ? [] : [{ name: 'email', label: 'Email (used to sign in)', type: 'email', required: true, col: 6 }, { name: 'title', label: 'Title', col: 6, placeholder: 'e.g. Tax Associate' }]), me.user)}
          <div class="field"><button class="btn btn-primary" type="submit" style="align-self:flex-start">Save profile</button></div>
        </form>
        <form class="form" data-submit="me-password" id="pw-form">
          <div class="form-section">Change password</div>
          ${FT.fields([{ name: 'current', label: 'Current password', type: 'password', required: true, col: 6, autocomplete: 'current-password' }, { name: 'next', label: 'New password', type: 'password', required: true, col: 6, autocomplete: 'new-password', hint: 'At least 6 characters' }])}
          <div class="field"><button class="btn" type="submit" style="align-self:flex-start">Update password</button></div>
        </form>
      </div>`,
    });
  };
  FT.onSubmit('me-save', async (v) => { const u = await FT.api('me.update', v); FT.state.me.user = Object.assign(FT.state.me.user, u); FT.toast('Profile saved'); FT.refreshChrome(); });
  FT.onSubmit('me-password', async (v, form) => { await FT.api('me.password', v); form.reset(); FT.toast('Password updated'); });

  /* ---------------------------------------------------- quick create */
  FT.act('quick-new', (el) => {
    FT.menu(el, [
      { label: 'Client', icon: 'user-plus', fn: () => FT.go('/app/clients?new=1') },
      { label: 'Upload documents', icon: 'upload', fn: async () => { if (await FT.uploadDocs()) FT.reload(); } },
      { label: 'Request documents', icon: 'clipboard-list', fn: async () => { if (await FT.requestDocs()) FT.reload(); } },
      { label: 'Return or filing', icon: 'file-check', fn: () => FT.go('/app/filings?new=1') },
      { label: 'Notice', icon: 'gavel', fn: () => FT.go('/app/notices?new=1') },
      { label: 'Task', icon: 'list-checks', fn: () => FT.go('/app/tasks?new=1') },
      { label: 'Invoice', icon: 'receipt', fn: () => FT.go('/app/invoices?new=1') },
    ]);
  });

  /* ------------------------------------------------- command palette */
  function cmdk() {
    const me = FT.state.me;
    if (!me || me.user.role === 'client') return;
    const kind = me.user.role === 'admin' ? 'admin' : 'app';
    const pages = NAV[kind].reduce((a, g) => a.concat(g.items.filter((it) => !it.owner || me.user.role === 'consultant')), []);
    let firms = null;
    let sel = 0;
    const m = FT.modal({
      size: 'lg', cls: 'cmdk', bare: true,
      body: html`<div class="cmdk-input">${FT.icon('search')}<input type="text" placeholder="${kind === 'admin' ? 'Search practices or pages' : 'Search clients, CNIC, NTN, documents, returns, invoices'}" aria-label="Search" autocomplete="off"><kbd class="xs muted">Esc</kbd></div><div class="cmdk-results"></div>`,
      mount: (el) => {
        const input = el.querySelector('input'); const box = el.querySelector('.cmdk-results');
        setTimeout(() => input.focus(), 40);
        const draw = (groups) => {
          let i = 0;
          box.innerHTML = String(groups.filter((g) => g.items.length).map((g) => html`<div class="cmdk-group">${g.label}</div>${g.items.map((it) => html`<a class="cmdk-item ${i === sel ? 'on' : ''}" data-i="${i++}" href="${'#' + it.href}">${FT.icon(it.icon)}<span class="ellipsis">${it.label}</span>${it.sub ? html`<span class="ci-sub">${it.sub}</span>` : ''}</a>`)}`)) || String(html`<div class="empty" style="padding:24px"><p>No matches. Try a name, CNIC or NTN.</p></div>`);
        };
        const run = FT.debounce(async () => {
          const q = input.value.trim().toLowerCase();
          const pg = pages.filter((p) => !q || p.label.toLowerCase().includes(q)).map((p) => ({ href: p.href, icon: p.icon, label: p.label }));
          if (kind === 'admin') {
            if (!firms) firms = await FT.api('admin.firms');
            const fs = q ? firms.filter((f) => (f.name + ' ' + f.ownerName + ' ' + f.city + ' ' + f.ownerEmail).toLowerCase().includes(q)).slice(0, 8) : [];
            sel = 0; draw([{ label: 'Practices', items: fs.map((f) => ({ href: '/admin/firms/' + f.id, icon: 'building-2', label: f.name, sub: f.ownerName + ', ' + f.city })) }, { label: 'Pages', items: pg }]);
            return;
          }
          let r = { clients: [], docs: [], filings: [], invoices: [], notices: [] };
          if (q.length >= 2) r = await FT.api('search', { q });
          sel = 0;
          draw([
            { label: 'Clients', items: r.clients.map((c) => ({ href: '/app/clients/' + c.id, icon: 'user', label: c.name, sub: c.sub })) },
            { label: 'Documents', items: r.docs.map((d) => ({ href: '/app/clients/' + d.clientId + '/documents?open=' + d.id, icon: 'file-text', label: d.name, sub: d.sub })) },
            { label: 'Returns and filings', items: r.filings.map((f) => ({ href: '/app/filings?open=' + f.id, icon: 'file-check', label: f.name, sub: f.sub })) },
            { label: 'Invoices', items: r.invoices.map((i) => ({ href: '/app/invoices/' + i.id, icon: 'receipt', label: i.name, sub: i.sub })) },
            { label: 'Notices', items: r.notices.map((n) => ({ href: '/app/notices?open=' + n.id, icon: 'gavel', label: n.name, sub: n.sub })) },
            { label: 'Pages', items: pg },
          ]);
        }, 160);
        input.addEventListener('input', run);
        input.addEventListener('keydown', (e) => {
          const items = box.querySelectorAll('.cmdk-item');
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); items.forEach((x, i) => x.classList.toggle('on', i === sel)); if (items[sel]) items[sel].scrollIntoView({ block: 'nearest' }); }
          if (e.key === 'Enter' && items[sel]) { e.preventDefault(); m.close(); FT.go(items[sel].getAttribute('href').slice(1)); }
        });
        box.addEventListener('click', (e) => { if (e.target.closest('a')) m.close(); });
        run();
      },
    });
  }
  FT.act('cmdk', cmdk);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (!document.querySelector('.cmdk')) cmdk(); } });

  /* ---------------------------------------------- preview role switch */
  const DEMO = [
    { label: 'Website', icon: 'globe', path: '/' },
    { label: 'Master admin', icon: 'shield-check', email: 'admin@fintax.demo', path: '/admin' },
    { label: 'Tax consultant (owner)', icon: 'briefcase', email: 'consultant@fintax.demo', path: '/app' },
    { label: 'Staff member', icon: 'user-cog', email: 'staff@fintax.demo', path: '/app' },
    { label: 'Client portal', icon: 'circle-user', email: 'client@fintax.demo', path: '/portal' },
  ];
  FT.switchRole = async (d) => {
    if (!d.email) { FT.go(d.path); return; }
    await FT.api('session.switch', { email: d.email });
    await FT.loadMe();
    const root = document.getElementById('root'); if (root) root.dataset.layout = '';
    FT.go(d.path);
    FT.toast('Now viewing as ' + d.label.toLowerCase());
  };
  function roleSwitch() {
    if (FT.backend !== 'local') return;
    const wrap = document.createElement('div');
    wrap.className = 'role-switch';
    wrap.innerHTML = String(html`<button class="btn btn-stamp" data-act="role-menu" aria-label="Switch demo view">${FT.icon('users')}<span>Demo views</span>${FT.icon('chevron-up')}</button>`);
    document.body.appendChild(wrap);
  }
  FT.act('role-menu', (el) => {
    const me = FT.state.me;
    FT.menu(el, [{ head: 'Explore each part of ' + FT.brandName() + (me ? '. Signed in as ' + me.user.name : '') }]
      .concat(DEMO.map((d) => ({ label: d.label, icon: d.icon, fn: () => FT.switchRole(d) })))
      .concat([{ sep: true }, { label: 'Reset demo data', icon: 'rotate-ccw', danger: true, fn: async () => { if (await FT.confirm({ title: 'Reset the demo?', message: 'Every change you made in this preview is removed and the sample practices come back.', confirmLabel: 'Reset demo', danger: true })) { FT.local.reset(); FT.state.me = null; FT.state.site = null; const root = document.getElementById('root'); if (root) root.dataset.layout = ''; FT.go('/'); FT.toast('Demo data restored'); } } }]), { align: 'right' });
  });

  /* -------------------------------------------------------------- boot */
  FT.route('/home', async () => { if (FT.state.me) FT.go(FT.homeFor(FT.state.me.user), { replace: true }); else FT.go('/login', { replace: true }); return ''; }, { role: null, guestOnly: false });
  async function boot() {
    FT.pwa.init();
    if (FT.preview || window.FINTAX_FORCE_LOCAL) FT.backend = 'local';
    else {
      try {
        const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const t = setTimeout(() => ctrl && ctrl.abort(), 2500);
        const r = await fetch('api/health', { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined });
        clearTimeout(t);
        const j = await r.json();
        FT.backend = j && j.fintax ? 'server' : 'local';
      } catch (e) { FT.backend = 'local'; }
    }
    if (FT.backend === 'local') FT.local.init();
    try { const site = await FT.api('public.site'); FT.state.site = site; FT.applyBrand(site.brand); } catch (e) { FT.applyBrand({ name: 'FinTax' }); }
    if (FT.session.has()) { try { await FT.loadMe(); } catch (e) { FT.session.clear(); } }
    roleSwitch();
    if (FT.mode === 'memory') {
      const token = (location.hash || '').replace('#', '');
      const start = { pricing: '/?to=pricing', login: '/login', signup: '/signup', admin: '/admin', app: '/app', portal: '/portal' }[token];
      FT.go(start || '/', { replace: true });
    } else {
      const fromPwa = /source=pwa/.test(location.search);
      if (fromPwa && (!location.hash || location.hash === '#' || location.hash === '#/')) { history.replaceState(null, '', location.pathname + location.search + '#/home'); }
      FT.render();
    }
    if (FT.backend === 'local' && FT.local.fresh && !FT.preview) setTimeout(() => FT.toast('Running in demo mode: data stays in this browser. Start the server for multi-user use.', 'info', { ms: 7000 }), 800);
  }
  FT.boot = boot;
})();
