/*! FinTax master admin. */
(function () {
  'use strict';
  const FT = window.FT;
  const { html, raw, U, C } = FT;
  const R = (path, view, o) => FT.route(path, view, Object.assign({ layout: 'admin', role: 'admin' }, o || {}));
  const head = (title, lede, actions, crumbs) => html`<div class="page-head"><div class="grow">${crumbs ? html`<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${lede ? html`<p class="lede">${lede}</p>` : ''}</div>${actions ? html`<div class="actions">${actions}</div>` : ''}</div>`;
  const subLine = (f) => {
    const s = f.sub;
    if (s.status === 'trial') return FT.plural(Math.max(0, s.daysLeft), 'day') + ' of trial left';
    if (s.status === 'active') return 'Renews ' + FT.date(FT.isoDay(s.endsAt)) + (s.daysLeft <= 14 ? ' (' + s.daysLeft + ' days)' : '');
    if (s.status === 'expired') return 'Ended ' + (s.endsAt ? FT.date(FT.isoDay(s.endsAt)) : '');
    return f.suspendReason || 'Suspended';
  };
  const planLabel = (f) => f.planName + ', ' + (f.cycle === 'annual' ? 'yearly' : 'monthly');

  /* ---------------------------------------------------------- dashboard */
  R('/admin', async (ctx) => {
    const o = await FT.api('admin.overview');
    const me = FT.state.me;
    ctx.title = 'Dashboard';
    const k = o.kpis;
    return html`<div class="page">
      ${head(FT.greeting() + ', ' + me.user.name.split(' ')[0], 'How ' + FT.brandName() + ' is doing today.', html`<a class="btn" href="#/">${FT.icon('globe')}View website</a><a class="btn btn-primary" href="#/admin/plans">${FT.icon('layers')}Edit plans</a>`)}
      <div class="kpis" style="--n:5">
        <a class="kpi" href="#/admin/firms"><span class="k-label">${FT.icon('trending-up')}Monthly recurring revenue</span><span class="k-value">${FT.moneyShort(k.mrr)}</span><span class="k-foot">${FT.money(k.arr)} a year</span></a>
        <a class="kpi" href="#/admin/firms?status=active"><span class="k-label">${FT.icon('badge-check')}Paying practices</span><span class="k-value">${k.active}</span><span class="k-foot">${k.conversion}% of all sign-ups</span></a>
        <a class="kpi" href="#/admin/firms?status=trial"><span class="k-label">${FT.icon('hourglass')}On free trial</span><span class="k-value">${k.trial}</span><span class="k-foot">${k.expired} expired, ${k.suspended} suspended</span></a>
        <a class="kpi ${k.pendingCount ? 'warn' : ''}" href="#/admin/payments"><span class="k-label">${FT.icon('banknote')}Payments to verify</span><span class="k-value">${k.pendingCount}</span><span class="k-foot">${FT.money(k.pendingAmount)} waiting</span></a>
        <a class="kpi" href="#/admin/leads"><span class="k-label">${FT.icon('target')}New leads</span><span class="k-value">${k.leadsNew}</span><span class="k-foot">${k.ticketsOpen} open support tickets</span></a>
      </div>
      <div class="grid cols-main">
        <div class="sheet"><div class="sheet-head"><h2>Subscription revenue</h2><span class="sub">Verified payments, last 6 months</span><span class="right strong num">${FT.money(k.revenueThisMonth)} this month</span></div><div class="sheet-body">${FT.chart.bars({ labels: o.revenue.map((r) => r.label.slice(0, 3)), series: [{ name: 'Revenue', values: o.revenue.map((r) => r.amount) }], label: 'Verified subscription payments per month', height: 210 })}</div></div>
        <div class="sheet"><div class="sheet-head"><h2>Payments to verify</h2>${o.pending.length ? html`<span class="count">${o.pending.length}</span>` : ''}<a class="btn btn-sm btn-quiet right" href="#/admin/payments">All payments</a></div>
          <div class="list">${o.pending.length ? o.pending.map((p) => html`<div class="li"><span class="li-icon amber">${FT.icon('banknote')}</span><div class="li-main"><div class="li-title">${p.firmName}</div><div class="li-sub">${p.planName}, ${p.cycle === 'annual' ? 'yearly' : 'monthly'}. ${p.method}, ref ${p.reference}</div></div><div class="stack tight" style="align-items:flex-end"><b class="num small">${FT.money(p.amount)}</b><div class="row" style="gap:6px"><button class="btn btn-sm btn-soft" data-act="pay-approve" data-id="${p.id}">Approve</button><button class="btn btn-sm btn-quiet" data-act="pay-reject" data-id="${p.id}">Reject</button></div></div></div>`) : html`${FT.empty({ icon: 'circle-check', title: 'Nothing to verify', text: 'New payment submissions from practices appear here.' })}`}</div>
        </div>
      </div>
      <div class="grid cols-main">
        <div class="sheet"><div class="sheet-head"><h2>New practices per week</h2><span class="sub">Last 12 weeks</span></div><div class="sheet-body">${FT.chart.line({ labels: o.weeks.map((w) => w.label), values: o.weeks.map((w) => w.count), every: 2, label: 'New practices per week', height: 170, fmt: FT.compact, fmtFull: (v) => FT.plural(v, 'practice') })}</div></div>
        <div class="sheet"><div class="sheet-head"><h2>Plans in use</h2><span class="sub">Active and trial</span></div><div class="sheet-body">${FT.chart.donut({ segments: o.byPlan.map((p, i) => ({ label: p.name, value: p.count, color: FT.SERIES[i] })), centerLabel: 'practices', label: 'Practices per plan' })}</div></div>
      </div>
      <div class="grid cols-main">
        <div class="sheet"><div class="sheet-head"><h2>Latest sign-ups</h2><a class="btn btn-sm btn-quiet right" href="#/admin/firms">All practices</a></div>
          ${FT.table({ rowAct: 'open-firm', rows: o.recentFirms, cols: [
            { label: 'Practice', render: (f) => html`<div class="t-name">${f.name}</div><div class="t-sub">${f.ownerName}, ${f.city}</div>` },
            { label: 'Plan', render: (f) => planLabel(f) },
            { label: 'Status', render: (f) => FT.statusPill('sub', f.sub.status) },
            { label: 'Joined', render: (f) => html`<span class="muted nowrap">${FT.ago(f.createdAt)}</span>` },
          ] })}
        </div>
        <div class="sheet"><div class="sheet-head"><h2>Ending within 7 days</h2></div>
          <div class="list">${o.expiring.length ? o.expiring.map((f) => html`<a class="li" href="${'#/admin/firms/' + f.id}">${FT.avatar(f.name, 'sm')}<div class="li-main"><div class="li-title">${f.name}</div><div class="li-sub">${planLabel(f)}</div></div><div class="li-side">${FT.pill(f.sub.status === 'trial' ? 'Trial ends in ' + f.sub.daysLeft + 'd' : 'Renews in ' + f.sub.daysLeft + 'd', f.sub.daysLeft <= 3 ? 'red' : 'amber')}</div></a>`) : FT.empty({ icon: 'calendar-clock', title: 'No renewals due this week' })}</div>
        </div>
      </div>
    </div>`;
  });
  FT.act('open-firm', (el) => FT.go('/admin/firms/' + el.dataset.id));

  /* --------------------------------------------------- payments review */
  async function approvePayment(id) {
    const pays = await FT.api('admin.payments');
    const p = pays.find((x) => x.id === id);
    if (!p) return;
    const ok = await FT.confirm({ title: 'Approve this payment?', message: FT.money(p.amount) + ' from ' + p.firmName + ' (' + p.method + ', ref ' + p.reference + '). This activates ' + p.planName + ' ' + (p.cycle === 'annual' ? 'for 12 months' : 'for 1 month') + ' and notifies the practice.', confirmLabel: 'Approve and activate' });
    if (!ok) return;
    await FT.api('admin.payment.review', { id, decision: 'approve' });
    FT.toast('Payment approved. ' + p.firmName + ' is active.');
    FT.reload();
  }
  async function rejectPayment(id) {
    const r = await FT.formModal({ title: 'Reject payment', sub: 'The practice sees your reason and can submit again.', submitLabel: 'Reject payment', danger: true, fields: [{ name: 'note', label: 'Reason', type: 'textarea', rows: 3, required: true, placeholder: 'e.g. We could not find this transaction ID in our account.' }], onSubmit: (v) => FT.api('admin.payment.review', { id, decision: 'reject', note: v.note }) });
    if (r) { FT.toast('Payment rejected'); FT.reload(); }
  }
  FT.act('pay-approve', (el) => approvePayment(el.dataset.id));
  FT.act('pay-reject', (el) => rejectPayment(el.dataset.id));
  FT.act('pay-proof', async (el) => {
    const b = await FT.files.get(el.dataset.blob).catch((e) => { FT.handleError(e); return null; });
    if (!b) return FT.toast('No proof file is attached to this payment.', 'warn');
    const url = URL.createObjectURL(b);
    FT.modal({ size: 'lg', title: 'Payment proof', body: /^image\//.test(b.type) ? html`<img class="preview-img" src="${url}" alt="Payment proof">` : html`<div class="empty">${FT.fileIcon(el.dataset.name || 'proof', b.type)}<p>${el.dataset.name || 'Proof file'}</p><button class="btn btn-primary" data-act="dl-blob" data-blob="${el.dataset.blob}" data-name="${el.dataset.name || 'payment-proof'}">${FT.icon('download')}Download</button></div>` });
  });
  FT.act('dl-blob', (el) => FT.files.download(el.dataset.blob, el.dataset.name));

  R('/admin/payments', async (ctx) => {
    const all = await FT.api('admin.payments');
    ctx.title = 'Payments';
    const tab = ctx.query.tab || 'pending';
    const rows = all.filter((p) => (tab === 'pending' ? p.status === 'pending' : tab === 'approved' ? p.status === 'approved' : p.status === 'rejected'));
    const cnt = (s) => all.filter((p) => p.status === s).length;
    return html`<div class="page">
      ${head('Payments', 'Practices pay by bank transfer, Raast, JazzCash or Easypaisa and submit the reference. Approving a payment activates their plan.')}
      <div class="sheet">
        <div class="toolbar"><div class="seg">${[['pending', 'To verify'], ['approved', 'Approved'], ['rejected', 'Rejected']].map((t) => html`<a class="${tab === t[0] ? 'active' : ''}" href="${'#/admin/payments?tab=' + t[0]}">${t[1]} <span class="count soft">${cnt(t[0])}</span></a>`)}</div><span class="right muted small">Total approved: <b class="num">${FT.money(U.sum(all.filter((p) => p.status === 'approved'), (p) => p.amount))}</b></span></div>
        ${FT.table({ rows, empty: FT.empty({ icon: 'banknote', title: tab === 'pending' ? 'No payments waiting' : 'No payments here yet' }), cols: [
          { label: 'Practice', render: (p) => html`<a class="t-name" href="${'#/admin/firms/' + p.firmId}">${p.firmName}</a><div class="t-sub">${p.firmCity}${p.submittedByName ? ', by ' + p.submittedByName : ''}</div>` },
          { label: 'Plan', render: (p) => html`${p.planName}<div class="t-sub">${p.cycle === 'annual' ? 'Yearly' : 'Monthly'}</div>` },
          { label: 'Amount', num: true, render: (p) => html`<b>${FT.money(p.amount)}</b>` },
          { label: 'Method and reference', render: (p) => html`${p.method}<div class="t-sub">${FT.copyable(p.reference)}</div>` },
          { label: 'Paid on', render: (p) => html`<span class="nowrap">${FT.date(p.paidOn)}</span><div class="t-sub">${FT.ago(p.createdAt)}</div>` },
          { label: 'Status', render: (p) => html`${FT.statusPill('payment', p.status)}${p.note ? html`<div class="t-sub">${p.note}</div>` : ''}` },
          { label: '', tdCls: 'actions', render: (p) => html`${p.proofBlobId ? html`<button class="btn btn-sm btn-quiet" data-act="pay-proof" data-blob="${p.proofBlobId}" data-name="${p.proofName}">${FT.icon('paperclip')}Proof</button>` : ''}${p.status === 'pending' ? html`<button class="btn btn-sm btn-soft" data-act="pay-approve" data-id="${p.id}">Approve</button><button class="btn btn-sm btn-quiet" data-act="pay-reject" data-id="${p.id}">Reject</button>` : ''}` },
        ] })}
      </div>
    </div>`;
  });

  /* ------------------------------------------------------- practices */
  R('/admin/firms', async (ctx) => {
    const firms = await FT.api('admin.firms');
    const plans = await FT.api('admin.plans');
    ctx.title = 'Practices';
    const st = ctx.query.status || 'all';
    ctx.mount((root) => {
      const q = root.querySelector('#f-q'), pl = root.querySelector('#f-plan'), box = root.querySelector('#firm-rows');
      const draw = () => {
        const term = q.value.trim().toLowerCase();
        const rows = firms.filter((f) => (st === 'all' || f.sub.status === st) && (!pl.value || f.planId === pl.value) && (!term || (f.name + ' ' + f.ownerName + ' ' + f.ownerEmail + ' ' + f.city).toLowerCase().includes(term)));
        box.innerHTML = String(FT.table({ rows, rowAct: 'open-firm', empty: FT.empty({ icon: 'building-2', title: 'No practices match', text: 'Try another search or filter.' }), cols: [
          { label: 'Practice', render: (f) => html`<div class="row">${FT.avatar(f.name, 'sm')}<div><div class="t-name">${f.name}</div><div class="t-sub">${f.ownerName}, ${f.ownerEmail}</div></div></div>` },
          { label: 'City', key: 'city' },
          { label: 'Plan', render: (f) => planLabel(f) },
          { label: 'Status', render: (f) => html`${FT.statusPill('sub', f.sub.status)}${f.sub.pendingPaymentId ? html` ${FT.pill('Payment to verify', 'amber')}` : ''}<div class="t-sub">${subLine(f)}</div>` },
          { label: 'Usage', render: (f) => html`<span class="nowrap">${f.usage.clients} clients</span><div class="t-sub">${f.usage.team} logins, ${FT.bytes(f.usage.storageBytes)}</div>` },
          { label: 'Joined', render: (f) => html`<span class="nowrap muted">${FT.date(FT.isoDay(f.createdAt))}</span>` },
          { label: '', tdCls: 'actions', render: (f) => html`<button class="btn btn-sm btn-quiet btn-icon" data-act="firm-menu" data-id="${f.id}" aria-label="Actions for ${f.name}">${FT.icon('ellipsis')}</button>` },
        ] }));
        root.querySelector('#f-count').textContent = FT.plural(rows.length, 'practice');
      };
      q.addEventListener('input', FT.debounce(draw, 120)); pl.addEventListener('change', draw); draw();
      root.querySelector('[data-export]').addEventListener('click', () => FT.files.save('fintax-practices-' + FT.today() + '.csv', FT.csv(firms, [{ label: 'Practice', key: 'name' }, { label: 'Owner', key: 'ownerName' }, { label: 'Email', key: 'ownerEmail' }, { label: 'Phone', key: 'ownerPhone' }, { label: 'City', key: 'city' }, { label: 'Plan', key: 'planName' }, { label: 'Cycle', key: 'cycle' }, { label: 'Status', value: (f) => f.sub.status }, { label: 'Ends', value: (f) => FT.isoDay(f.sub.endsAt) }, { label: 'Clients', value: (f) => f.usage.clients }, { label: 'Joined', value: (f) => FT.isoDay(f.createdAt) }]), 'text/csv'));
    });
    const counts = (s) => firms.filter((f) => s === 'all' || f.sub.status === s).length;
    return html`<div class="page">
      ${head('Practices', 'Every tax practice on ' + FT.brandName() + ', with its plan, usage and subscription status.', html`<button class="btn" data-export>${FT.icon('download')}Export CSV</button>`)}
      <div class="sheet">
        <div class="toolbar">
          <div class="seg">${[['all', 'All'], ['active', 'Active'], ['trial', 'Trial'], ['expired', 'Expired'], ['suspended', 'Suspended']].map((t) => html`<a class="${st === t[0] ? 'active' : ''}" href="${'#/admin/firms' + (t[0] === 'all' ? '' : '?status=' + t[0])}">${t[1]} <span class="count soft">${counts(t[0])}</span></a>`)}</div>
          <label class="search-field">${FT.icon('search')}<input class="input" id="f-q" placeholder="Search practice, owner, email or city" aria-label="Search practices"></label>
          <select class="select input-sm" id="f-plan" style="width:auto" aria-label="Filter by plan"><option value="">All plans</option>${plans.map((p) => html`<option value="${p.id}">${p.name}</option>`)}</select>
          <span class="right muted small" id="f-count"></span>
        </div>
        <div id="firm-rows"></div>
      </div>
    </div>`;
  });
  FT.act('firm-menu', async (el) => {
    const id = el.dataset.id;
    const d = await FT.api('admin.firm', { id });
    const f = d.firm;
    FT.menu(el, [
      { label: 'Open details', icon: 'external-link', fn: () => FT.go('/admin/firms/' + id) },
      { label: 'Activate a plan', icon: 'badge-check', fn: () => activateModal(f, d.plans) },
      { label: 'Extend trial', icon: 'hourglass', fn: () => extendTrial(f) },
      f.sub.status === 'suspended' ? { label: 'Restore account', icon: 'rotate-ccw', fn: () => subChange(f, 'resume') } : { label: 'Suspend account', icon: 'ban', danger: true, fn: () => suspendModal(f) },
      { sep: true },
      { label: 'Open as support', icon: 'shield-check', fn: () => impersonate(f) },
    ]);
  });
  async function subChange(f, mode, extra) {
    await FT.api('admin.firm.subscription', Object.assign({ id: f.id, mode }, extra || {}));
    FT.toast(mode === 'resume' ? 'Account restored' : 'Subscription updated');
    FT.reload();
  }
  async function activateModal(f, plans) {
    const r = await FT.formModal({
      title: 'Activate a plan', sub: f.name, submitLabel: 'Activate', submitIcon: 'badge-check',
      intro: html`<div class="callout">${FT.icon('info')}<span>Use this when a practice paid outside ${FT.brandName()}, or to give a complimentary period. The practice is notified.</span></div>`,
      fields: [{ name: 'planId', label: 'Plan', type: 'select', options: plans.map((p) => ({ value: p.id, label: p.name + ' (Rs ' + FT.n(p.monthly) + '/mo, Rs ' + FT.n(p.annual) + '/yr)' })), col: 6 }, { name: 'cycle', label: 'Billing', type: 'select', options: [{ value: 'annual', label: 'Yearly' }, { value: 'monthly', label: 'Monthly' }], col: 6 }, { name: 'months', label: 'Months to add', type: 'number', col: 6, hint: 'Leave blank for 12 (yearly) or 1 (monthly)' }],
      values: { planId: f.planId, cycle: f.cycle },
      onSubmit: (v) => FT.api('admin.firm.subscription', { id: f.id, mode: 'activate', planId: v.planId, cycle: v.cycle, months: v.months }),
    });
    if (r) { FT.toast('Plan activated for ' + f.name); FT.reload(); }
  }
  async function extendTrial(f) {
    const r = await FT.formModal({ title: 'Extend free trial', sub: f.name, submitLabel: 'Extend trial', fields: [{ name: 'days', label: 'Days to add', type: 'radio', options: [{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }], value: 7 }], onSubmit: (v) => FT.api('admin.firm.subscription', { id: f.id, mode: 'extend_trial', days: v.days }) });
    if (r) { FT.toast('Trial extended'); FT.reload(); }
  }
  async function suspendModal(f) {
    const r = await FT.formModal({ title: 'Suspend ' + f.name + '?', sub: 'Their team and clients keep read-only access to existing data until you restore the account.', submitLabel: 'Suspend account', danger: true, fields: [{ name: 'reason', label: 'Reason shown to the practice', type: 'textarea', rows: 2, required: true }], onSubmit: (v) => FT.api('admin.firm.subscription', { id: f.id, mode: 'suspend', reason: v.reason }) });
    if (r) { FT.toast('Account suspended'); FT.reload(); }
  }
  async function impersonate(f) {
    const ok = await FT.confirm({ title: 'Open ' + f.name + ' as support?', message: 'You will see the practice exactly as its owner does. Everything you do is recorded in their activity log.', confirmLabel: 'Open as support' });
    if (!ok) return;
    await FT.api('admin.impersonate', { firmId: f.id });
    await FT.loadMe();
    const root = document.getElementById('root'); if (root) root.dataset.layout = '';
    FT.go('/app');
  }

  R('/admin/firms/:id', async (ctx) => {
    const d = await FT.api('admin.firm', { id: ctx.params.id });
    const f = d.firm;
    const plan = d.plans.find((p) => p.id === f.planId) || {};
    const lim = plan.limits || {};
    ctx.title = f.name;
    const meter = (label, used, max, fmt) => { const pct = max ? Math.min(100, (used / max) * 100) : 8; return html`<div class="meter"><div class="row"><span>${label}</span><span class="num">${fmt ? fmt(used) : used} of ${max ? (fmt ? fmt(max) : max) : 'unlimited'}</span></div><div class="bar ${pct > 90 ? 'red' : pct > 75 ? 'amber' : ''}"><i style="width:${pct}%"></i></div></div>`; };
    ctx.mount((root) => {
      const on = (sel, fn) => { const b = root.querySelector(sel); if (b) b.addEventListener('click', fn); };
      on('[data-activate]', () => activateModal(f, d.plans));
      on('[data-extend]', () => extendTrial(f));
      on('[data-suspend]', () => suspendModal(f));
      on('[data-resume]', () => subChange(f, 'resume'));
      on('[data-imp]', () => impersonate(f));
      on('[data-setend]', async () => { const r = await FT.formModal({ title: 'Set end date', sub: f.sub.status === 'trial' ? 'Changes when the trial ends.' : 'Changes when the paid period ends.', submitLabel: 'Save date', fields: [{ name: 'date', label: 'End date', type: 'date', required: true, value: FT.isoDay(f.sub.endsAt) || FT.today() }], onSubmit: (v) => FT.api('admin.firm.subscription', { id: f.id, mode: 'set_end', date: v.date }) }); if (r) { FT.toast('End date updated'); FT.reload(); } });
      on('[data-changeplan]', async () => { const r = await FT.formModal({ title: 'Change plan', sub: 'Switches the plan without changing the end date.', submitLabel: 'Change plan', fields: [{ name: 'planId', label: 'Plan', type: 'select', options: d.plans.map((p) => ({ value: p.id, label: p.name })), col: 6 }, { name: 'cycle', label: 'Billing', type: 'select', options: [{ value: 'annual', label: 'Yearly' }, { value: 'monthly', label: 'Monthly' }], col: 6 }], values: { planId: f.planId, cycle: f.cycle }, onSubmit: (v) => FT.api('admin.firm.subscription', { id: f.id, mode: 'change_plan', planId: v.planId, cycle: v.cycle }) }); if (r) { FT.toast('Plan changed'); FT.reload(); } });
      on('[data-reset]', async () => { if (!(await FT.confirm({ title: 'Reset the owner password?', message: 'A new password is created for ' + f.ownerName + '. Share it with them securely.', confirmLabel: 'Reset password' }))) return; const r = await FT.api('admin.firm.resetPassword', { id: f.id }); FT.showCredentials({ title: 'New password for ' + r.name, sub: 'Share it with the practice owner. It is shown only once.', email: r.email, password: r.password, phone: f.ownerPhone, name: r.name }); });
      on('[data-delete]', async () => { const typed = await FT.confirm({ title: 'Delete this practice permanently?', message: 'All clients, documents, filings, invoices and logins for ' + f.name + ' will be erased. This cannot be undone.', typeToConfirm: f.name, confirmLabel: 'Delete everything', danger: true }); if (!typed) return; await FT.api('admin.firm.delete', { id: f.id, confirm: typed }); FT.toast('Practice deleted'); FT.go('/admin/firms'); });
      const form = root.querySelector('#firm-profile');
      form.addEventListener('submit', async (e) => { e.preventDefault(); const b = form.querySelector('[type=submit]'); FT.busy(b, true); try { await FT.api('admin.firm.update', Object.assign({ id: f.id }, FT.formData(form))); FT.toast('Practice details saved'); } catch (err) { FT.formError(form, err.message); } finally { FT.busy(b, false); } });
    });
    return html`<div class="page">
      ${head(f.name, html`${FT.statusPill('sub', f.sub.status)} <span class="muted">${planLabel(f)}. ${subLine(f)}</span>`, html`<button class="btn" data-imp>${FT.icon('shield-check')}Open as support</button><button class="btn" data-reset>${FT.icon('key-round')}Reset owner password</button>`, html`<a href="#/admin/firms">Practices</a>${FT.icon('chevron-right')}<span>${f.name}</span>`)}
      <div class="grid cols-main">
        <div class="stack loose">
          <div class="sheet"><div class="sheet-head"><h2>Subscription</h2>${f.sub.pendingPaymentId ? html`<a class="btn btn-sm btn-soft right" href="#/admin/payments">Payment to verify</a>` : ''}</div>
            <div class="sheet-body stack">
              <div class="dl">
                <div>Plan</div><div><b>${f.planName}</b>, ${f.cycle === 'annual' ? 'yearly' : 'monthly'} (${FT.money(f.cycle === 'annual' ? plan.annual : plan.monthly)})</div>
                <div>Status</div><div>${FT.statusPill('sub', f.sub.status)} ${f.suspendReason ? html`<span class="muted small">${f.suspendReason}</span>` : ''}</div>
                <div>${f.sub.status === 'trial' ? 'Trial ends' : 'Paid until'}</div><div>${f.sub.endsAt ? FT.date(FT.isoDay(f.sub.endsAt)) + (f.sub.daysLeft != null ? ' (' + (f.sub.daysLeft >= 0 ? f.sub.daysLeft + ' days left' : (-f.sub.daysLeft) + ' days ago') + ')' : '') : 'Not set'}</div>
                <div>First activated</div><div>${f.activatedAt ? FT.date(FT.isoDay(f.activatedAt)) : 'Not yet'}</div>
              </div>
              <div class="row wrap">
                <button class="btn btn-primary btn-sm" data-activate>${FT.icon('badge-check')}Activate or renew</button>
                <button class="btn btn-sm" data-extend>${FT.icon('hourglass')}Extend trial</button>
                <button class="btn btn-sm" data-changeplan>${FT.icon('layers')}Change plan</button>
                <button class="btn btn-sm" data-setend>${FT.icon('calendar')}Set end date</button>
                ${f.sub.status === 'suspended' ? html`<button class="btn btn-sm btn-soft" data-resume>${FT.icon('rotate-ccw')}Restore</button>` : html`<button class="btn btn-sm btn-danger" data-suspend>${FT.icon('ban')}Suspend</button>`}
              </div>
            </div>
          </div>
          <div class="sheet"><div class="sheet-head"><h2>Usage</h2></div><div class="sheet-body stack">
            ${meter('Active clients', f.usage.clients, lim.clients)}
            ${meter('Team logins', f.usage.team, lim.team)}
            ${meter('Document storage', f.usage.storageBytes, lim.storageGB ? lim.storageGB * 1073741824 : null, FT.bytes)}
            <div class="row wrap small muted"><span>${d.counts.filings} filings</span><span>${d.counts.docs} documents</span><span>${d.counts.invoices} invoices</span><span>${d.portalUsers} client portal logins</span></div>
          </div></div>
          <div class="sheet"><div class="sheet-head"><h2>Payment history</h2></div>
            ${FT.table({ rows: d.payments, empty: FT.empty({ icon: 'banknote', title: 'No payments yet' }), cols: [
              { label: 'Date', render: (p) => html`<span class="nowrap">${FT.date(p.paidOn)}</span>` },
              { label: 'Plan', render: (p) => p.planName + ', ' + (p.cycle === 'annual' ? 'yearly' : 'monthly') },
              { label: 'Amount', num: true, render: (p) => FT.money(p.amount) },
              { label: 'Method', render: (p) => html`${p.method}<div class="t-sub">${p.reference}</div>` },
              { label: 'Status', render: (p) => FT.statusPill('payment', p.status) },
            ] })}
          </div>
          <div class="sheet"><div class="sheet-head"><h2>Recent activity</h2></div><div class="timeline">${d.activity.length ? d.activity.map((a) => html`<div class="tl"><span class="tl-dot ${a.role === 'client' ? 'client' : a.role === 'admin' ? 'sys' : ''}"></span><div class="tl-body">${a.summary}<div class="tl-meta">${a.userName}, ${FT.ago(a.createdAt)}</div></div></div>`) : html`<div class="sheet-body muted small">No activity yet.</div>`}</div></div>
        </div>
        <div class="stack loose">
          <div class="sheet"><div class="sheet-head"><h2>Practice details</h2></div><div class="sheet-body">
            <form class="form" id="firm-profile">${FT.fields([{ name: 'name', label: 'Practice name', required: true }, { name: 'city', label: 'City', col: 6 }, { name: 'phone', label: 'Phone', col: 6 }, { name: 'email', label: 'Email', type: 'email' }, { name: 'adminNotes', label: 'Internal notes', type: 'textarea', rows: 3, hint: 'Only FinTax admins see this.' }], f)}<div class="field"><button class="btn btn-primary" type="submit" style="align-self:flex-start">Save details</button></div><div class="form-error" hidden></div></form>
          </div></div>
          <div class="sheet"><div class="sheet-head"><h2>Team</h2><span class="count soft">${d.team.length}</span></div><div class="list">${d.team.map((u) => html`<div class="li">${FT.avatar(u.name, 'sm')}<div class="li-main"><div class="li-title">${u.name}</div><div class="li-sub">${u.email}</div></div><div class="li-side">${u.role === 'consultant' ? FT.pill('Owner', 'green') : FT.pill(u.title || 'Staff', '')}<div class="xs muted mt-1">${u.lastLoginAt ? 'Seen ' + FT.ago(u.lastLoginAt) : 'Never signed in'}</div></div></div>`)}</div></div>
          ${d.tickets.length ? html`<div class="sheet"><div class="sheet-head"><h2>Support tickets</h2></div><div class="list">${d.tickets.map((t) => html`<div class="li clickable" data-act="ticket-open" data-id="${t.id}"><span class="li-icon">${FT.icon('life-buoy')}</span><div class="li-main"><div class="li-title">${t.subject}</div><div class="li-sub">${FT.ago(t.updatedAt)}</div></div>${FT.statusPill('ticket', t.status)}</div>`)}</div></div>` : ''}
          <div class="sheet"><div class="sheet-head"><h2>Danger zone</h2></div><div class="sheet-body stack"><p class="small muted">Deleting a practice removes all of its clients, files and logins for good.</p><button class="btn btn-danger" data-delete style="align-self:flex-start">${FT.icon('trash-2')}Delete practice</button></div></div>
        </div>
      </div>
    </div>`;
  });

  /* ------------------------------------------------------------ plans */
  R('/admin/plans', async (ctx) => {
    const plans = await FT.api('admin.plans');
    ctx.title = 'Plans and pricing';
    const editor = (p) => html`<form class="sheet" data-plan-form="${p.id}">
      <div class="sheet-head"><h2>${p.name}</h2>${p.highlight ? FT.pill('Highlighted', 'violet') : ''}${p.visible === false ? FT.pill('Hidden', '') : ''}<span class="right xs muted">Plan ID: ${p.id}</span></div>
      <div class="sheet-body"><div class="form">
        ${FT.fields([
          { name: 'name', label: 'Plan name', required: true, col: 6 }, { name: 'badge', label: 'Badge text', col: 6, placeholder: 'e.g. Most popular' },
          { name: 'tagline', label: 'One-line description' },
          { name: 'monthly', label: 'Monthly price', type: 'money', required: true, col: 6 }, { name: 'annual', label: 'Yearly price', type: 'money', required: true, col: 6, hint: 'The website shows the saving against 12 monthly payments.' },
          { name: 'cta', label: 'Button label', col: 6 },
          { type: 'html', col: 6, html: html`<span class="label">Saving shown</span><span class="small" data-saving></span>` },
          { type: 'section', label: 'Limits (leave blank for unlimited)' },
          { name: 'limits.clients', label: 'Active clients', type: 'number', col: 4 }, { name: 'limits.team', label: 'Team logins', type: 'number', col: 4 }, { name: 'limits.storageGB', label: 'Storage (GB)', type: 'number', col: 4 },
          { type: 'section', label: 'Features' },
          { name: 'features.portal', label: 'Client portal', type: 'switch', col: 6 }, { name: 'features.vault', label: 'Credentials vault', type: 'switch', col: 6 },
          { name: 'features.bulk', label: 'Bulk-create returns', type: 'switch', col: 6 }, { name: 'features.advancedReports', label: 'Advanced reports', type: 'switch', col: 6 },
          { name: 'features.branding', label: 'Practice logo on invoices and portal', type: 'switch', col: 6 },
          { type: 'section', label: 'Shown on the website' },
          { name: 'bullets', label: 'Feature list, one per line', type: 'textarea', rows: 7, value: (p.bullets || []).join('\n') },
          { name: 'highlight', label: 'Highlight this plan on the pricing table', type: 'switch', col: 6 }, { name: 'visible', label: 'Show this plan on the website', type: 'switch', col: 6 },
        ], Object.assign({}, p, { bullets: (p.bullets || []).join('\n') }))}
        <div class="form-error" hidden></div>
      </div></div>
      <div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Save ${p.name}</button><span class="xs muted">Changes go live on the website straight away.</span></div>
    </form>`;
    ctx.mount((root) => {
      root.querySelectorAll('[data-plan-form]').forEach((form) => {
        const id = form.dataset.planForm;
        const sav = form.querySelector('[data-saving]');
        const calc = () => { const v = FT.formData(form); const save = (+v.monthly || 0) * 12 - (+v.annual || 0); sav.textContent = save > 0 ? 'Save Rs ' + FT.n(save) + ' a year (' + (v.monthly ? Math.round(save / v.monthly * 10) / 10 : 0) + ' months free)' : 'No yearly saving'; };
        form.addEventListener('input', calc); calc();
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const b = form.querySelector('[type=submit]');
          const box = form.querySelector('.form-error'); box.hidden = true;
          const v = FT.formData(form);
          FT.busy(b, true);
          try { await FT.api('admin.plan.save', Object.assign(v, { id })); FT.state.site = null; FT.toast(v.name + ' saved. The website now shows the new pricing.'); FT.reload(); }
          catch (err) { FT.formError(form, err.message); } finally { FT.busy(b, false); }
        });
      });
    });
    return html`<div class="page">
      ${head('Plans and pricing', FT.brandName() + ' sells exactly two plans, priced in rupees. Edit them here and the website pricing table, sign-up page and in-app upgrade screen update immediately.', html`<a class="btn" href="#/?to=pricing">${FT.icon('external-link')}View pricing on the website</a>`)}
      <div class="grid cols-2" style="align-items:start">${plans.map(editor)}</div>
    </div>`;
  });

  /* ------------------------------------------------------------- leads */
  R('/admin/leads', async (ctx) => {
    const leads = await FT.api('admin.leads');
    ctx.title = 'Leads';
    const st = ctx.query.status || 'all';
    ctx.mount((root) => {
      const q = root.querySelector('#l-q'), box = root.querySelector('#lead-rows');
      const draw = () => {
        const t = q.value.trim().toLowerCase();
        const rows = leads.filter((l) => (st === 'all' || l.status === st) && (!t || (l.name + ' ' + l.email + ' ' + l.phone + ' ' + l.city + ' ' + l.practice + ' ' + l.source).toLowerCase().includes(t)));
        box.innerHTML = String(FT.table({ rows, rowAct: 'lead-edit', empty: FT.empty({ icon: 'target', title: 'No leads yet', text: 'Contact forms, the exit offer, the tax calculator and walkthrough requests on the website all land here.' }), cols: [
          { label: 'Name', render: (l) => html`<div class="t-name">${l.name}</div><div class="t-sub">${l.practice || l.city || ''}</div>` },
          { label: 'Contact', render: (l) => html`${l.phone ? html`<div class="nowrap">${FT.copyable(l.phone)}</div>` : ''}${l.email ? html`<div class="t-sub">${l.email}</div>` : ''}` },
          { label: 'Source', render: (l) => FT.pill(l.source, 'line', true) },
          { label: 'Status', render: (l) => FT.statusPill('lead', l.status) },
          { label: 'Received', render: (l) => html`<span class="nowrap muted">${FT.ago(l.createdAt)}</span>` },
          { label: '', tdCls: 'actions', render: (l) => html`${FT.waBtn(l.phone, 'Assalam o Alaikum ' + l.name + ', this is the ' + FT.brandName() + ' team. Thank you for your interest.', 'WhatsApp')}` },
        ] }));
      };
      q.addEventListener('input', FT.debounce(draw, 120)); draw();
      root.querySelector('[data-export]').addEventListener('click', () => FT.files.save('fintax-leads-' + FT.today() + '.csv', FT.csv(leads, [{ label: 'Name', key: 'name' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }, { label: 'City', key: 'city' }, { label: 'Practice', key: 'practice' }, { label: 'Source', key: 'source' }, { label: 'Status', key: 'status' }, { label: 'Message', key: 'message' }, { label: 'Notes', key: 'notes' }, { label: 'Received', value: (l) => FT.isoDay(l.createdAt) }]), 'text/csv'));
      root.querySelector('[data-add]').addEventListener('click', () => leadModal(null));
    });
    const cnt = (s) => leads.filter((l) => s === 'all' || l.status === s).length;
    return html`<div class="page">
      ${head('Leads', 'People who asked about ' + FT.brandName() + ' from the website. Follow up while they are warm.', html`<button class="btn" data-export>${FT.icon('download')}Export CSV</button><button class="btn btn-primary" data-add>${FT.icon('plus')}Add lead</button>`)}
      <div class="sheet"><div class="toolbar"><div class="seg">${[['all', 'All']].concat(C.LEAD_STATUS.map((s) => [s.id, s.label])).map((t) => html`<a class="${st === t[0] ? 'active' : ''}" href="${'#/admin/leads' + (t[0] === 'all' ? '' : '?status=' + t[0])}">${t[1]} <span class="count soft">${cnt(t[0])}</span></a>`)}</div><label class="search-field">${FT.icon('search')}<input class="input" id="l-q" placeholder="Search leads" aria-label="Search leads"></label></div><div id="lead-rows"></div></div>
    </div>`;
  });
  async function leadModal(l) {
    const r = await FT.formModal({
      title: l ? l.name : 'Add a lead', sub: l ? (l.source + ', received ' + FT.ago(l.createdAt)) : '', submitLabel: 'Save lead',
      intro: l && l.message ? html`<div class="callout">${FT.icon('message-square-text')}<span>${l.message}</span></div>` : '',
      fields: [{ name: 'name', label: 'Name', required: true, col: 6 }, { name: 'phone', label: 'Phone', col: 6 }, { name: 'email', label: 'Email', type: 'email', col: 6 }, { name: 'city', label: 'City', col: 6 }, { name: 'status', label: 'Status', type: 'select', options: C.LEAD_STATUS.map((s) => ({ value: s.id, label: s.label })), col: 6 }, { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 }],
      values: l || { status: 'new' },
      footLeft: l ? html`<button type="button" class="btn btn-quiet" data-del-lead style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (form, el, close) => { const d = el.querySelector('[data-del-lead]'); if (d) d.addEventListener('click', async () => { if (await FT.confirm({ title: 'Delete this lead?', message: l.name + ' will be removed.', confirmLabel: 'Delete', danger: true })) { await FT.api('admin.lead.delete', { id: l.id }); close(); FT.toast('Lead deleted'); FT.reload(); } }); },
      onSubmit: (v) => FT.api('admin.lead.save', Object.assign(v, l ? { id: l.id } : {})),
    });
    if (r) { FT.toast('Lead saved'); FT.reload(); }
  }
  FT.act('lead-edit', async (el) => { const leads = await FT.api('admin.leads'); leadModal(leads.find((x) => x.id === el.dataset.id)); });

  /* --------------------------------------------------- website content */
  const PRESETS = [['Ledger green', '#0E7A4F'], ['Emerald', '#059669'], ['Teal', '#0F766E'], ['Royal blue', '#1D4ED8'], ['Indigo', '#4338CA'], ['Maroon', '#9F1239'], ['Charcoal', '#334155']];
  R('/admin/website', async (ctx) => {
    const s = await FT.api('admin.settings');
    const tab = ctx.query.tab || 'home';
    const site = s.site;
    ctx.title = 'Website content';
    const tabs = [['home', 'Homepage', 'house'], ['urgency', 'Offer and urgency', 'timer'], ['proof', 'Testimonials and proof', 'star'], ['faq', 'FAQs', 'circle-help'], ['contact', 'Contact and social', 'phone'], ['brand', 'Logo and colours', 'palette']];
    let body;
    if (tab === 'home') body = html`<form class="sheet" data-site-form><div class="sheet-body"><div class="form">${FT.fields([
      { type: 'section', label: 'Hero' },
      { name: 'hero.headline', label: 'Headline', required: true, hint: 'Each sentence goes on its own line.' },
      { name: 'hero.sub', label: 'Supporting text', type: 'textarea', rows: 3 },
      { name: 'hero.urdu', label: 'Urdu line (optional)', hint: 'Shown under the headline in Nastaliq.' },
      { name: 'hero.ctaPrimary', label: 'Main button', col: 6 }, { name: 'hero.ctaSecondary', label: 'Second button', col: 6 },
      { type: 'section', label: 'Announcement bar' },
      { name: 'announcement.enabled', label: 'Show the announcement bar', type: 'switch' },
      { name: 'announcement.text', label: 'Announcement text' },
      { type: 'section', label: 'Elsewhere on the site' },
      { name: 'tagline', label: 'Tagline', hint: 'Used in the footer and the installed app.' },
      { name: 'guarantee', label: 'Risk-free line under pricing', hint: '{trialDays} is replaced with the trial length.' },
      { name: 'footerNote', label: 'Footer disclaimer', type: 'textarea', rows: 2 },
    ], site)}<div class="form-error" hidden></div></div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Publish changes</button><a class="btn btn-quiet" href="#/">Preview website</a></div></form>`;
    if (tab === 'urgency') body = html`<form class="sheet" data-site-form><div class="sheet-body"><div class="form">
      <div class="callout" style="grid-column:span 12">${FT.icon('info')}<span>These counters use real numbers only. Seats left is your seat limit minus practices that actually signed up since the start date, and the countdown hides itself when the date passes.</span></div>
      ${FT.fields([
        { type: 'section', label: 'Founding member offer' },
        { name: 'offer.enabled', label: 'Show the offer, seat counter and countdown', type: 'switch' },
        { name: 'offer.title', label: 'Offer name', col: 6 }, { name: 'offer.seats', label: 'Seats available', type: 'number', col: 6 },
        { name: 'offer.startAtDay', label: 'Count sign-ups from', type: 'date', col: 6, value: FT.isoDay(site.offer.startAt) }, { name: 'offer.deadlineLocal', label: 'Offer closes', type: 'datetime-local', col: 6, value: site.offer.deadline ? FT.pkt(site.offer.deadline).toISOString().slice(0, 16) : '', hint: 'Pakistan time' },
        { name: 'offer.note', label: 'What members get', hint: 'Shown next to the seat counter.' },
        { type: 'section', label: 'Featured tax deadline' },
        { name: 'featuredDeadline.enabled', label: 'Highlight a deadline at the top of the homepage', type: 'switch' },
        { name: 'featuredDeadline.title', label: 'Deadline', col: 8 }, { name: 'featuredDeadline.date', label: 'Date', type: 'date', col: 4 },
        { name: 'featuredDeadline.note', label: 'Note', hint: 'For example: Extended by FBR circular' },
      ], site)}<div class="form-error" hidden></div></div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Publish changes</button></div></form>`;
    if (tab === 'proof') {
      const ts = await FT.api('admin.testimonials');
      body = html`<div class="stack loose">
        <form class="sheet" data-site-form><div class="sheet-head"><h2>Live proof</h2></div><div class="sheet-body"><div class="form">${FT.fields([
          { name: 'proof.liveSignups', label: 'Show real sign-up notifications to visitors', type: 'switch', hint: 'For example: A practice in Lahore started a trial, 2 h ago. Only real sign-ups from the last 14 days.' },
          { name: 'proof.stats', label: 'Show usage numbers', type: 'switch', col: 6, hint: 'Practices, clients, documents and returns, counted from the database.' }, { name: 'proof.statsMin', label: 'Only once there are at least this many practices', type: 'number', col: 6 },
        ], site)}<div class="form-error" hidden></div></div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Save</button></div></form>
        <div class="sheet"><div class="sheet-head"><h2>Testimonials</h2><span class="sub">Publish only real quotes from customers who agreed to be quoted.</span><button class="btn btn-sm btn-primary right" data-act="tst-edit">${FT.icon('plus')}Add testimonial</button></div>
          ${FT.table({ rows: ts, rowAct: 'tst-edit', empty: FT.empty({ icon: 'quote', title: 'No testimonials yet', text: 'When customers tell you how much time they save, ask if you can quote them. Published quotes appear on the homepage.' }), cols: [{ label: 'Customer', render: (t) => html`<div class="t-name">${t.name}</div><div class="t-sub">${[t.role, t.city].filter(Boolean).join(', ')}</div>` }, { label: 'Quote', render: (t) => html`<span class="small">${t.quote}</span>` }, { label: 'Rating', render: (t) => t.rating + ' / 5' }, { label: 'Status', render: (t) => (t.published ? FT.pill('Published', 'green') : FT.pill('Draft', '')) }] })}
        </div></div>`;
    }
    if (tab === 'faq') {
      const fs = await FT.api('admin.faqs');
      body = html`<div class="sheet"><div class="sheet-head"><h2>Frequently asked questions</h2><button class="btn btn-sm btn-primary right" data-act="faq-edit">${FT.icon('plus')}Add question</button></div>${FT.table({ rows: fs, rowAct: 'faq-edit', empty: FT.empty({ icon: 'circle-help', title: 'No questions yet' }), cols: [{ label: '#', render: (f) => f.order }, { label: 'Question', render: (f) => html`<div class="t-name">${f.q}</div><div class="t-sub">${f.a.slice(0, 120)}${f.a.length > 120 ? '…' : ''}</div>` }, { label: 'Status', render: (f) => (f.published ? FT.pill('Published', 'green') : FT.pill('Hidden', '')) }] })}</div>`;
    }
    if (tab === 'contact') body = html`<form class="sheet" data-site-form><div class="sheet-body"><div class="form">${FT.fields([
      { type: 'section', label: 'Contact details shown in the footer' },
      { name: 'contact.email', label: 'Email', type: 'email', col: 6 }, { name: 'contact.phone', label: 'Phone', col: 6 },
      { name: 'contact.whatsapp', label: 'WhatsApp number', col: 6, hint: 'Adds a WhatsApp us link.' }, { name: 'contact.hours', label: 'Opening hours', col: 6 },
      { name: 'contact.address', label: 'Address' },
      { type: 'section', label: 'Social links' },
      { name: 'social.facebook', label: 'Facebook URL', col: 6 }, { name: 'social.instagram', label: 'Instagram URL', col: 6 }, { name: 'social.linkedin', label: 'LinkedIn URL', col: 6 }, { name: 'social.youtube', label: 'YouTube URL', col: 6 },
    ], site)}<div class="form-error" hidden></div></div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Publish changes</button></div></form>`;
    if (tab === 'brand') body = html`<div class="grid cols-2" style="align-items:start">
      <div class="sheet"><div class="sheet-head"><h2>Logo</h2></div><div class="sheet-body stack">
        <div class="row" style="min-height:64px;padding:12px;border:1px dashed var(--rule);border-radius:12px;background:var(--paper)" id="logo-prev">${FT.brandLockup()}</div>
        <label class="dropzone">${FT.icon('image-up')}<b class="small">Upload your logo</b><span class="hint">PNG with a transparent background works best. SVG and JPG also work.</span><input type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" id="logo-file"></label>
        <label class="check"><input type="checkbox" id="logo-icon" checked><span>Also use it for the app icon on phones</span></label>
        ${site.logo ? html`<button class="btn btn-danger btn-sm" id="logo-remove" style="align-self:flex-start">${FT.icon('trash-2')}Remove logo</button>` : ''}
      </div></div>
      <form class="sheet" data-site-form><div class="sheet-head"><h2>Name and colour</h2></div><div class="sheet-body"><div class="form">
        ${FT.field({ name: 'brandName', label: 'Brand name', required: true }, site)}
        <div class="field"><span class="label">Main colour</span><div class="chipset">${PRESETS.map((p) => html`<label><input type="radio" name="primaryPreset" value="${p[1]}" ${String(site.primary).toLowerCase() === p[1].toLowerCase() ? raw('checked') : ''}><span><i style="display:inline-block;width:14px;height:14px;border-radius:4px;background:${p[1]}"></i>${p[0]}</span></label>`)}</div></div>
        <div class="field span-6"><label class="label" for="primary">Or a custom colour</label><div class="row"><input type="color" id="primary-pick" value="${site.primary || '#0E7A4F'}" style="width:46px;height:40px;border:1px solid var(--rule);border-radius:8px;padding:2px;background:var(--sheet)"><input class="input" id="primary" name="primary" value="${site.primary || '#0E7A4F'}"></div><span class="hint">Match it to your logo.</span></div>
        <div class="field span-6"><span class="label">Preview</span><div class="row wrap"><span class="btn btn-primary btn-sm">Start free trial</span>${FT.pill('Active', 'green')}</div></div>
      </div><div class="form-error" hidden></div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Save branding</button></div></form>
    </div>`;
    ctx.mount((root) => {
      const form = root.querySelector('form[data-site-form]');
      root.querySelectorAll('form[data-site-form]').forEach((f) => f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = f.querySelector('[type=submit]'); const v = FT.formData(f);
        delete v.primaryPreset;
        if (v.offer) {
          if (v.offer.startAtDay) { v.offer.startAt = U.iso(Date.parse(v.offer.startAtDay + 'T00:00:00+05:00')); }
          if (v.offer.deadlineLocal) { v.offer.deadline = U.iso(Date.parse(v.offer.deadlineLocal + ':00+05:00')); }
          delete v.offer.startAtDay; delete v.offer.deadlineLocal;
        }
        if (v.primary && !/^#[0-9a-f]{6}$/i.test(v.primary)) { FT.formError(f, 'Enter the colour as a hex code like #0E7A4F.'); return; }
        FT.busy(b, true);
        try { const out = await FT.api('admin.settings.save', { section: 'site', data: v }); FT.state.site = null; FT.applyBrand({ name: out.site.brandName, logo: out.site.logo, primary: out.site.primary }); FT.state.me.brand = Object.assign({}, FT.state.me.brand, { name: out.site.brandName, primary: out.site.primary, logo: out.site.logo }); FT.toast('Published. The website shows your changes now.'); FT.refreshChrome(); }
        catch (err) { FT.formError(f, err.message); } finally { FT.busy(b, false); }
      }));
      if (tab === 'brand') {
        const pick = root.querySelector('#primary-pick'), txt = root.querySelector('#primary');
        const setC = (c) => { txt.value = c; pick.value = c; FT.applyBrand(Object.assign({}, FT.state.brand, { primary: c })); };
        pick.addEventListener('input', () => setC(pick.value));
        txt.addEventListener('change', () => { if (/^#[0-9a-f]{6}$/i.test(txt.value)) setC(txt.value); });
        root.querySelectorAll('[name=primaryPreset]').forEach((r) => r.addEventListener('change', () => setC(r.value)));
        root.querySelector('#logo-file').addEventListener('change', async (e) => {
          const file = e.target.files[0]; if (!file) return;
          try {
            const { logo, icon192, icon512 } = await processLogo(file);
            const data = { logo };
            if (root.querySelector('#logo-icon').checked) { data.icon192 = icon192; data.icon512 = icon512; }
            const out = await FT.api('admin.settings.save', { section: 'site', data });
            FT.state.site = null; FT.applyBrand({ name: out.site.brandName, logo: out.site.logo, primary: out.site.primary }); FT.state.me.brand = FT.state.brand;
            FT.toast('Logo updated across the website, app and portal');
            const root2 = document.getElementById('root'); if (root2) root2.dataset.layout = '';
            FT.reload();
          } catch (err) { FT.handleError(err); }
        });
        const rm = root.querySelector('#logo-remove');
        if (rm) rm.addEventListener('click', async () => { await FT.api('admin.settings.save', { section: 'site', data: { logo: '', icon192: '', icon512: '' } }); FT.state.site = null; FT.applyBrand(Object.assign({}, FT.state.brand, { logo: '' })); FT.state.me.brand = FT.state.brand; const r2 = document.getElementById('root'); if (r2) r2.dataset.layout = ''; FT.toast('Logo removed'); FT.reload(); });
      }
      return form;
    });
    return html`<div class="page">
      ${head('Website content', 'Edit what visitors see on the ' + FT.brandName() + ' website. Changes publish straight away.', html`<a class="btn" href="#/">${FT.icon('external-link')}Open website</a>`)}
      <div class="tabs">${tabs.map((t) => html`<a class="tab ${tab === t[0] ? 'active' : ''}" href="${'#/admin/website?tab=' + t[0]}">${FT.icon(t[2])}${t[1]}</a>`)}</div>
      ${body}
    </div>`;
  });
  async function processLogo(file) {
    if (file.size > 2 * 1048576) throw new Error('Use a logo file under 2 MB.');
    const dataUrl = await FT.readDataUrl(file);
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That image could not be read.')); i.src = dataUrl; });
    const w = img.naturalWidth || 512, h = img.naturalHeight || 512;
    let logo = dataUrl;
    if (file.type !== 'image/svg+xml' && (w > 640 || file.size > 300000)) {
      const scale = Math.min(1, 640 / w);
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      logo = c.toDataURL('image/png');
    }
    const icon = (size) => { const c = document.createElement('canvas'); c.width = size; c.height = size; const g = c.getContext('2d'); g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, size, size); const pad = size * 0.14, box = size - pad * 2; const s = Math.min(box / w, box / h); g.drawImage(img, (size - w * s) / 2, (size - h * s) / 2, w * s, h * s); return c.toDataURL('image/png'); };
    return { logo, icon192: icon(192), icon512: icon(512) };
  }
  FT.act('tst-edit', async (el) => {
    const ts = el.dataset.id ? await FT.api('admin.testimonials') : [];
    const t = ts.find((x) => x.id === el.dataset.id);
    const r = await FT.formModal({ title: t ? 'Edit testimonial' : 'Add a testimonial', sub: 'Use the customer\'s real words, with their permission.', submitLabel: 'Save', fields: [{ name: 'name', label: 'Customer name', required: true, col: 6 }, { name: 'role', label: 'Role or practice', col: 6 }, { name: 'city', label: 'City', col: 6 }, { name: 'rating', label: 'Rating', type: 'select', options: [5, 4, 3], col: 6 }, { name: 'quote', label: 'Quote', type: 'textarea', rows: 4, required: true }, { name: 'order', label: 'Order', type: 'number', col: 6 }, { name: 'published', label: 'Published on the website', type: 'switch', col: 6 }], values: t || { rating: 5, published: true, order: ts.length + 1 },
      footLeft: t ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (f, m, close) => { const d = m.querySelector('[data-del]'); if (d) d.addEventListener('click', async () => { await FT.api('admin.testimonial.delete', { id: t.id }); close(); FT.toast('Testimonial deleted'); FT.reload(); }); },
      onSubmit: (v) => FT.api('admin.testimonial.save', Object.assign(v, t ? { id: t.id } : {})) });
    if (r) { FT.state.site = null; FT.toast('Testimonial saved'); FT.reload(); }
  });
  FT.act('faq-edit', async (el) => {
    const fs = await FT.api('admin.faqs');
    const f = fs.find((x) => x.id === el.dataset.id);
    const r = await FT.formModal({ title: f ? 'Edit question' : 'Add a question', submitLabel: 'Save', fields: [{ name: 'q', label: 'Question', required: true }, { name: 'a', label: 'Answer', type: 'textarea', rows: 5, required: true }, { name: 'order', label: 'Order', type: 'number', col: 6 }, { name: 'published', label: 'Show on the website', type: 'switch', col: 6 }], values: f || { order: fs.length + 1, published: true },
      footLeft: f ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (form, m, close) => { const d = m.querySelector('[data-del]'); if (d) d.addEventListener('click', async () => { await FT.api('admin.faq.delete', { id: f.id }); close(); FT.toast('Question deleted'); FT.reload(); }); },
      onSubmit: (v) => FT.api('admin.faq.save', Object.assign(v, f ? { id: f.id } : {})) });
    if (r) { FT.state.site = null; FT.toast('Question saved'); FT.reload(); }
  });

  /* ------------------------------------------------------ announcements */
  R('/admin/announcements', async (ctx) => {
    const list = await FT.api('admin.announcements');
    ctx.title = 'Announcements';
    return html`<div class="page">
      ${head('Announcements', 'Post news to every practice dashboard or client portal. Use it for new features, maintenance windows or FBR deadline changes.', html`<button class="btn btn-primary" data-act="ann-edit">${FT.icon('plus')}New announcement</button>`)}
      <div class="sheet">${FT.table({ rows: list, rowAct: 'ann-edit', empty: FT.empty({ icon: 'megaphone', title: 'No announcements yet' }), cols: [{ label: 'Title', render: (a) => html`<div class="t-name">${a.title}</div><div class="t-sub">${a.body.slice(0, 120)}</div>` }, { label: 'Shown to', render: (a) => ({ consultants: 'Practices', clients: 'Clients', all: 'Everyone' })[a.audience] }, { label: 'Status', render: (a) => (a.active ? FT.pill('Live', 'green') : FT.pill('Off', '')) }, { label: 'Posted', render: (a) => html`<span class="muted nowrap">${FT.ago(a.createdAt)}</span>` }] })}</div>
    </div>`;
  });
  FT.act('ann-edit', async (el) => {
    const list = await FT.api('admin.announcements');
    const a = list.find((x) => x.id === el.dataset.id);
    const r = await FT.formModal({ title: a ? 'Edit announcement' : 'New announcement', submitLabel: a ? 'Save' : 'Post announcement', fields: [{ name: 'title', label: 'Title', required: true }, { name: 'body', label: 'Message', type: 'textarea', rows: 4 }, { name: 'audience', label: 'Show to', type: 'select', options: [{ value: 'consultants', label: 'Practices (consultants and staff)' }, { value: 'clients', label: 'Clients in their portal' }, { value: 'all', label: 'Everyone' }], col: 6 }, { name: 'link', label: 'Link inside the app (optional)', col: 6, placeholder: '/app/filings' }, { name: 'active', label: 'Live now', type: 'switch' }], values: a || { audience: 'consultants', active: true },
      footLeft: a ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (f, m, close) => { const d = m.querySelector('[data-del]'); if (d) d.addEventListener('click', async () => { await FT.api('admin.announcement.delete', { id: a.id }); close(); FT.toast('Announcement deleted'); FT.reload(); }); },
      onSubmit: (v) => FT.api('admin.announcement.save', Object.assign(v, a ? { id: a.id } : {})) });
    if (r) { FT.toast('Announcement saved'); FT.reload(); }
  });

  /* ------------------------------------------------------------ support */
  FT.ticketModal = async (id) => {
    const isAdmin = FT.state.me.user.role === 'admin';
    let m;
    const render0 = (t) => html`<div class="stack">
      <div class="row wrap">${FT.statusPill('ticket', t.status)}${FT.statusPill('priority', t.priority)}${isAdmin ? html`<span class="muted small">${t.firmName}</span>` : ''}</div>
      <div class="stack tight">${(t.thread || []).map((x) => html`<div class="row top" style="gap:10px">${FT.avatar(x.name, 'sm')}<div class="grow"><div class="row"><b class="small">${x.name}</b>${x.role === 'support' ? FT.pill(FT.brandName() + ' support', 'green') : ''}<span class="xs faint right">${FT.datetime(x.at)}</span></div><div class="small ink2" style="white-space:pre-wrap;margin-top:2px">${x.text}</div></div></div>`)}</div>
      <form class="stack tight" data-reply><textarea class="textarea" name="text" rows="3" placeholder="Write a reply"></textarea>
        <div class="row">${isAdmin ? html`<select class="select input-sm" name="status" style="width:auto" aria-label="Status"><option value="">Keep status</option><option value="waiting">Waiting on customer</option><option value="open">Open</option><option value="closed">Closed</option></select>` : (t.status === 'closed' ? '' : html`<button type="button" class="btn btn-sm btn-quiet" data-close-ticket>Mark as solved</button>`)}<button class="btn btn-primary btn-sm right" type="submit">${FT.icon('send')}Send reply</button></div></form>
    </div>`;
    const bind = (el, t) => {
      el.querySelector('[data-reply]').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = FT.formData(e.target);
        if (!String(v.text || '').trim() && !v.status) return;
        const b = e.target.querySelector('[type=submit]'); FT.busy(b, true);
        try { const nt = await FT.api('ticket.reply', { id: t.id, text: v.text, status: v.status || undefined }); const full = await FT.api('ticket.get', { id: nt.id }); m.el.querySelector('.modal-body').innerHTML = String(render0(full)); bind(m.el, full); FT.toast('Reply sent'); }
        catch (err) { FT.handleError(err); } finally { FT.busy(b, false); }
      });
      const c = el.querySelector('[data-close-ticket]');
      if (c) c.addEventListener('click', async () => { await FT.api('ticket.reply', { id: t.id, status: 'closed' }); m.close(); FT.toast('Ticket closed'); FT.reload(); });
    };
    const t = await FT.api('ticket.get', { id });
    m = FT.modal({ size: 'lg', title: t.subject, sub: 'Opened ' + FT.ago(t.createdAt) + ' by ' + (t.userName || ''), body: render0(t), mount: (el) => bind(el, t), onClose: () => FT.reload() });
  };
  FT.act('ticket-open', (el) => FT.ticketModal(el.dataset.id));
  R('/admin/support', async (ctx) => {
    const list = await FT.api('admin.tickets');
    ctx.title = 'Support tickets';
    const st = ctx.query.status || 'open';
    const rows = list.filter((t) => st === 'all' || t.status === st);
    return html`<div class="page">
      ${head('Support tickets', 'Questions and problems sent by practices from Help and support.')}
      <div class="sheet"><div class="toolbar"><div class="seg">${[['open', 'Open'], ['waiting', 'Waiting on customer'], ['closed', 'Closed'], ['all', 'All']].map((t) => html`<a class="${st === t[0] ? 'active' : ''}" href="${'#/admin/support?status=' + t[0]}">${t[1]} <span class="count soft">${list.filter((x) => t[0] === 'all' || x.status === t[0]).length}</span></a>`)}</div></div>
        ${FT.table({ rows, rowAct: 'ticket-open', empty: FT.empty({ icon: 'life-buoy', title: 'No tickets here' }), cols: [{ label: 'Subject', render: (t) => html`<div class="t-name">${t.subject}</div><div class="t-sub">${(t.thread[t.thread.length - 1] || {}).text ? String(t.thread[t.thread.length - 1].text).slice(0, 90) : ''}</div>` }, { label: 'Practice', render: (t) => html`${t.firmName}<div class="t-sub">${t.userName}</div>` }, { label: 'Priority', render: (t) => FT.statusPill('priority', t.priority) }, { label: 'Status', render: (t) => FT.statusPill('ticket', t.status) }, { label: 'Updated', render: (t) => html`<span class="muted nowrap">${FT.ago(t.updatedAt)}</span>` }] })}
      </div>
    </div>`;
  });

  /* ----------------------------------------------------------- activity */
  R('/admin/activity', async (ctx) => {
    const list = await FT.api('admin.activity', { limit: 400 });
    ctx.title = 'Activity log';
    ctx.mount((root) => {
      const q = root.querySelector('#a-q'), box = root.querySelector('#act-rows');
      const draw = () => { const t = q.value.trim().toLowerCase(); const rows = list.filter((a) => !t || (a.summary + ' ' + a.userName + ' ' + a.firmName).toLowerCase().includes(t)).slice(0, 250); box.innerHTML = String(FT.table({ rows, empty: FT.empty({ icon: 'history', title: 'No activity found' }), cols: [{ label: 'When', render: (a) => html`<span class="nowrap">${FT.datetime(a.createdAt)}</span>` }, { label: 'Practice', render: (a) => a.firmName || html`<span class="muted">Platform</span>` }, { label: 'Who', render: (a) => html`${a.userName}<div class="t-sub">${a.role}</div>` }, { label: 'What happened', render: (a) => a.summary }] })); };
      q.addEventListener('input', FT.debounce(draw, 150)); draw();
    });
    return html`<div class="page">${head('Activity log', 'Everything that happened across ' + FT.brandName() + ', newest first.')}<div class="sheet"><div class="toolbar"><label class="search-field">${FT.icon('search')}<input class="input" id="a-q" placeholder="Filter by practice, person or action" aria-label="Filter activity"></label></div><div id="act-rows"></div></div></div>`;
  });

  /* ----------------------------------------------------------- settings */
  R('/admin/settings', async (ctx) => {
    const s = await FT.api('admin.settings');
    const tab = ctx.query.tab || 'payment';
    ctx.title = 'Settings';
    const tabs = [['payment', 'How practices pay you', 'banknote'], ['signup', 'Sign-ups and trials', 'user-plus'], ['calendar', 'Compliance calendar', 'calendar-clock'], ['tax', 'Tax calculator', 'calculator'], ['admins', 'Admin users', 'shield-check'], ['backup', 'Data and backup', 'archive']];
    let body = '';
    if (tab === 'payment') body = html`<form class="sheet" data-set-form="payment"><div class="sheet-body"><div class="form">
      <div class="callout" style="grid-column:span 12">${FT.icon('info')}<span>Practices see these details when they renew or upgrade. They submit the transaction ID, and you approve it under Payments.</span></div>
      ${FT.fields([{ name: 'bankName', label: 'Bank', col: 6 }, { name: 'accountTitle', label: 'Account title', col: 6 }, { name: 'accountNumber', label: 'Account number', col: 6 }, { name: 'iban', label: 'IBAN', col: 6 }, { name: 'raast', label: 'Raast ID', col: 4 }, { name: 'jazzcash', label: 'JazzCash number', col: 4 }, { name: 'easypaisa', label: 'Easypaisa number', col: 4 }, { name: 'instructions', label: 'Instructions', type: 'textarea', rows: 3 }], s.payment)}
      <div class="form-error" hidden></div></div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Save payment details</button></div></form>`;
    if (tab === 'signup') body = html`<form class="sheet" data-set-form="system"><div class="sheet-body"><div class="form">${FT.fields([{ name: 'allowSignups', label: 'Allow new practices to sign up from the website', type: 'switch' }, { name: 'trialDays', label: 'Free trial length (days)', type: 'number', col: 6 }, { name: 'defaultPlan', label: 'Default plan for new trials', type: 'select', options: (await FT.api('admin.plans')).map((p) => ({ value: p.id, label: p.name })), col: 6 }, { name: 'supportEmail', label: 'Support email', type: 'email', col: 6 }], s.system)}<div class="form-error" hidden></div></div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Save</button></div></form>`;
    if (tab === 'calendar') body = html`<div class="sheet"><div class="sheet-head"><h2>Deadlines every practice sees</h2><span class="sub">Pre-loaded into each practice calendar and shown on the website.</span></div>
      <div class="table-wrap"><table class="tbl" id="rules"><thead><tr><th>On</th><th>Deadline</th><th>Authority</th><th>Repeats</th><th>Day or dates</th><th>Note</th><th></th></tr></thead><tbody>${(s.system.rules || []).map((r, i) => ruleRow(r, i))}</tbody></table></div>
      <div class="sheet-foot"><button class="btn" data-add-rule>${FT.icon('plus')}Add deadline</button><button class="btn btn-primary right" data-save-rules>${FT.icon('save')}Save calendar</button></div></div>
      <div class="callout warn">${FT.icon('triangle-alert')}<span>FBR and provincial authorities extend dates often. Update a date here, or use the featured deadline under Website content, and every practice sees it.</span></div>`;
    if (tab === 'tax') body = html`<div class="stack loose" id="tax-years">${(s.tax.years || []).map((y, i) => taxYearEditor(y, i))}<div class="row"><button class="btn" data-add-year>${FT.icon('plus')}Add tax year</button><button class="btn btn-primary right" data-save-tax>${FT.icon('save')}Save tax tables</button></div><p class="xs muted">${s.tax.note}</p></div>`;
    if (tab === 'admins') {
      const admins = await FT.api('admin.admins');
      const resets = await FT.api('admin.resets');
      body = html`<div class="stack loose"><div class="sheet"><div class="sheet-head"><h2>Admin users</h2><button class="btn btn-sm btn-primary right" data-act="admin-edit">${FT.icon('plus')}Add admin</button></div>${FT.table({ rows: admins, rowAct: 'admin-edit', cols: [{ label: 'Name', render: (u) => html`<div class="row">${FT.avatar(u.name, 'sm')}<div><div class="t-name">${u.name}</div><div class="t-sub">${u.email}</div></div></div>` }, { label: 'Status', render: (u) => (u.status === 'active' ? FT.pill('Active', 'green') : FT.pill('Off', '')) }, { label: 'Last sign-in', render: (u) => html`<span class="muted">${u.lastLoginAt ? FT.ago(u.lastLoginAt) : 'Never'}</span>` }] })}</div>
        <div class="sheet"><div class="sheet-head"><h2>Password reset requests</h2><span class="sub">From practice owners and admins</span></div>${FT.table({ rows: resets, empty: FT.empty({ icon: 'key-round', title: 'No requests' }), cols: [{ label: 'Person', render: (r) => html`<div class="t-name">${r.name}</div><div class="t-sub">${r.email}</div>` }, { label: 'Requested', render: (r) => FT.ago(r.createdAt) }, { label: 'Status', render: (r) => (r.status === 'open' ? FT.pill('Open', 'amber') : FT.pill('Done', 'green')) }, { label: '', tdCls: 'actions', render: (r) => (r.status === 'open' ? html`${r.firmId ? html`<a class="btn btn-sm btn-soft" href="${'#/admin/firms/' + r.firmId}">Open practice</a>` : ''}<button class="btn btn-sm btn-quiet" data-act="reset-done" data-id="${r.id}">Mark done</button>` : '') }] })}</div></div>`;
    }
    if (tab === 'backup') body = html`<div class="sheet"><div class="sheet-body stack"><h2 style="font-size:var(--fs-md)">Export everything</h2><p class="small ink2">Download a complete JSON copy of all practices, clients and records. Keep regular backups, and also back up the server's data folder, which holds uploaded files.</p><button class="btn btn-primary" data-backup style="align-self:flex-start">${FT.icon('download')}Download backup</button></div></div>`;
    ctx.mount((root) => {
      root.querySelectorAll('form[data-set-form]').forEach((f) => f.addEventListener('submit', async (e) => {
        e.preventDefault();
        const b = f.querySelector('[type=submit]'); FT.busy(b, true);
        try { await FT.api('admin.settings.save', { section: f.dataset.setForm, data: FT.formData(f) }); FT.state.site = null; FT.toast('Settings saved'); }
        catch (err) { FT.formError(f, err.message); } finally { FT.busy(b, false); }
      }));
      if (tab === 'calendar') {
        const tb = root.querySelector('#rules tbody');
        root.querySelector('[data-add-rule]').addEventListener('click', () => { tb.insertAdjacentHTML('beforeend', String(ruleRow({ id: 'r' + Date.now().toString(36), title: '', authority: 'FBR', kind: 'monthly', day: 15, enabled: true, note: '' }, tb.children.length))); });
        tb.addEventListener('click', (e) => { const x = e.target.closest('[data-rm]'); if (x) x.closest('tr').remove(); });
        root.querySelector('[data-save-rules]').addEventListener('click', async (e) => {
          const b = e.currentTarget;
          const rules = Array.from(tb.querySelectorAll('tr')).map((tr) => {
            const g = (n) => tr.querySelector('[data-f="' + n + '"]');
            const kind = g('kind').value; const when = g('when').value.trim();
            const r = { id: tr.dataset.id, enabled: g('enabled').checked, title: g('title').value, authority: g('authority').value, kind, note: g('note').value };
            if (kind === 'monthly') r.day = +when || 15;
            if (kind === 'quarterly') { const p = when.split(/[ ,;]+/); r.day = +p[0] || 20; r.months = [1, 4, 7, 10]; }
            if (kind === 'dates') r.dates = when.split(/[ ,;]+/).filter(Boolean);
            if (kind === 'yearly') r.date = when;
            return r;
          });
          FT.busy(b, true);
          try { await FT.api('admin.settings.save', { section: 'system', data: { rules } }); FT.state.site = null; FT.toast('Calendar saved for every practice'); FT.reload(); }
          catch (err) { FT.handleError(err); } finally { FT.busy(b, false); }
        });
      }
      if (tab === 'tax') {
        const wrap = root.querySelector('#tax-years');
        wrap.addEventListener('click', (e) => {
          const add = e.target.closest('[data-add-slab]'); if (add) { add.closest('.sheet').querySelector('[data-slabs="' + add.dataset.addSlab + '"] tbody').insertAdjacentHTML('beforeend', String(slabRow([null, 0]))); }
          const rm = e.target.closest('[data-rm-slab]'); if (rm) rm.closest('tr').remove();
        });
        root.querySelector('[data-add-year]').addEventListener('click', () => { const ys = wrap.querySelectorAll('[data-year]'); const last = s.tax.years[0] || {}; wrap.insertAdjacentHTML('afterbegin', String(taxYearEditor(Object.assign({}, last, { year: (+last.year || 2027) + 1, label: 'Tax Year ' + ((+last.year || 2027) + 1) }), ys.length))); });
        root.querySelector('[data-save-tax]').addEventListener('click', async (e) => {
          const b = e.currentTarget;
          const years = Array.from(wrap.querySelectorAll('[data-year]')).map((sh) => {
            const slabs = (kind) => Array.from(sh.querySelectorAll('[data-slabs="' + kind + '"] tbody tr')).map((tr) => { const up = tr.querySelector('[data-up]').value.replace(/[^\d]/g, ''); return [up === '' ? null : +up, +tr.querySelector('[data-rate]').value || 0]; });
            const g = (n) => sh.querySelector('[data-f="' + n + '"]').value;
            return { year: +g('year'), label: g('label'), salaried: slabs('salaried'), business: slabs('business'), salariedSurcharge: { above: +String(g('ssAbove')).replace(/[^\d]/g, '') || 0, rate: +g('ssRate') || 0 }, businessSurcharge: { above: +String(g('bsAbove')).replace(/[^\d]/g, '') || 0, rate: +g('bsRate') || 0 } };
          });
          FT.busy(b, true);
          try { await FT.api('admin.settings.save', { section: 'tax', data: { years } }); FT.state.site = null; FT.toast('Tax tables saved. The website calculator uses them now.'); FT.reload(); }
          catch (err) { FT.handleError(err); } finally { FT.busy(b, false); }
        });
      }
      const bk = root.querySelector('[data-backup]');
      if (bk) bk.addEventListener('click', async () => { FT.busy(bk, true); try { const d = await FT.api('admin.backup'); await FT.files.save('fintax-backup-' + FT.today() + '.json', JSON.stringify(d, null, 1), 'application/json'); } catch (err) { FT.handleError(err); } finally { FT.busy(bk, false); } });
    });
    return html`<div class="page">${head('Settings', 'Platform-wide settings for ' + FT.brandName() + '.')}<div class="tabs">${tabs.map((t) => html`<a class="tab ${tab === t[0] ? 'active' : ''}" href="${'#/admin/settings?tab=' + t[0]}">${FT.icon(t[2])}${t[1]}</a>`)}</div>${body}</div>`;
  });
  function ruleRow(r) {
    const when = r.kind === 'monthly' ? r.day : r.kind === 'quarterly' ? r.day : r.kind === 'dates' ? (r.dates || []).join(', ') : (r.date || '');
    return html`<tr data-id="${r.id}"><td><input type="checkbox" data-f="enabled" ${r.enabled ? raw('checked') : ''} aria-label="Enabled" style="width:18px;height:18px;accent-color:var(--ledger)"></td>
      <td><input class="input input-sm" data-f="title" value="${r.title}" aria-label="Deadline name" style="min-width:220px"></td>
      <td><select class="select input-sm" data-f="authority" aria-label="Authority">${FT.C.AUTHORITIES.map((a) => html`<option ${a === r.authority ? raw('selected') : ''}>${a}</option>`)}</select></td>
      <td><select class="select input-sm" data-f="kind" aria-label="Repeats">${[['monthly', 'Monthly, on day'], ['quarterly', 'Quarterly (Jan, Apr, Jul, Oct), on day'], ['dates', 'Every year on dates (MM-DD)'], ['yearly', 'Every year on (MM-DD)']].map((k) => html`<option value="${k[0]}" ${k[0] === r.kind ? raw('selected') : ''}>${k[1]}</option>`)}</select></td>
      <td><input class="input input-sm" data-f="when" value="${when}" aria-label="Day or dates" style="width:150px" placeholder="18 or 09-30"></td>
      <td><input class="input input-sm" data-f="note" value="${r.note || ''}" aria-label="Note" style="min-width:180px"></td>
      <td class="actions"><button class="btn btn-sm btn-quiet btn-icon" data-rm aria-label="Remove">${FT.icon('x')}</button></td></tr>`;
  }
  const slabRow = (s) => html`<tr><td><div class="affix"><span>Up to Rs</span><input class="input input-sm" data-up value="${s[0] == null ? '' : FT.n(s[0])}" placeholder="No upper limit" inputmode="numeric"></div></td><td><div class="affix"><input class="input input-sm" data-rate value="${s[1]}" inputmode="decimal" style="width:80px"><span style="border-right:0;border-left:1px solid var(--rule)">%</span></div></td><td class="actions"><button class="btn btn-sm btn-quiet btn-icon" data-rm-slab aria-label="Remove slab">${FT.icon('x')}</button></td></tr>`;
  function taxYearEditor(y) {
    const tbl = (kind, title) => html`<div class="stack tight"><b class="small">${title}</b><div class="table-wrap"><table class="tbl" data-slabs="${kind}"><thead><tr><th>Slab</th><th>Rate on income in this slab</th><th></th></tr></thead><tbody>${(y[kind] || []).map(slabRow)}</tbody></table></div><button class="btn btn-sm btn-quiet" data-add-slab="${kind}" style="align-self:flex-start">${FT.icon('plus')}Add slab</button></div>`;
    return html`<div class="sheet" data-year="${y.year}"><div class="sheet-head"><div class="row wrap"><label class="field" style="width:110px"><span class="label">Tax year</span><input class="input input-sm" data-f="year" value="${y.year}"></label><label class="field grow" style="min-width:220px"><span class="label">Label</span><input class="input input-sm" data-f="label" value="${y.label}"></label></div></div>
      <div class="sheet-body grid cols-2">
        <div class="stack">${tbl('salaried', 'Salaried individuals')}<div class="row wrap small"><span>Surcharge</span><input class="input input-sm" data-f="ssRate" value="${(y.salariedSurcharge || {}).rate || 0}" style="width:70px" aria-label="Salaried surcharge rate"><span>% of tax when income is above Rs</span><input class="input input-sm" data-f="ssAbove" value="${FT.n((y.salariedSurcharge || {}).above || 0)}" style="width:130px" aria-label="Salaried surcharge threshold"></div></div>
        <div class="stack">${tbl('business', 'Business, AOPs and other individuals')}<div class="row wrap small"><span>Surcharge</span><input class="input input-sm" data-f="bsRate" value="${(y.businessSurcharge || {}).rate || 0}" style="width:70px" aria-label="Business surcharge rate"><span>% of tax when income is above Rs</span><input class="input input-sm" data-f="bsAbove" value="${FT.n((y.businessSurcharge || {}).above || 0)}" style="width:130px" aria-label="Business surcharge threshold"></div></div>
      </div></div>`;
  }
  FT.act('admin-edit', async (el) => {
    const admins = await FT.api('admin.admins');
    const u = admins.find((x) => x.id === el.dataset.id);
    const r = await FT.formModal({ title: u ? 'Edit admin' : 'Add an admin', sub: u ? u.email : 'Admins can see and change everything in ' + FT.brandName() + '.', submitLabel: 'Save', fields: [{ name: 'name', label: 'Name', required: true, col: 6 }, { name: 'email', label: 'Email', type: 'email', required: true, col: 6 }, { name: 'password', label: u ? 'New password (leave blank to keep)' : 'Password (leave blank to generate one)', type: 'password', col: 6, autocomplete: 'new-password' }].concat(u ? [{ name: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'disabled', label: 'Turned off' }], col: 6 }] : []), values: u || {}, onSubmit: (v) => FT.api('admin.admin.save', Object.assign(v, u ? { id: u.id } : {})) });
    if (r) { if (r.password) FT.showCredentials({ title: 'Admin added', sub: 'Share these details securely. The password is shown only once.', email: r.user.email, password: r.password }); else FT.toast('Admin saved'); FT.reload(); }
  });
  FT.act('reset-done', async (el) => { await FT.api('admin.reset.done', { id: el.dataset.id }); FT.reload(); });
})();
