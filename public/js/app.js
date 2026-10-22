/*! FinTax consultant workspace, part 1: dashboard, clients, documents, filings, notices, tasks, calendar. */
(function () {
  'use strict';
  const FT = window.FT;
  const { html, raw, U, C } = FT;
  const R = (path, view, o) => FT.route(path, view, Object.assign({ layout: 'app', role: 'firm' }, o || {}));
  const head = (title, lede, actions, crumbs) => html`<div class="page-head"><div class="grow">${crumbs ? html`<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${lede ? html`<p class="lede">${lede}</p>` : ''}</div>${actions ? html`<div class="actions">${actions}</div>` : ''}</div>`;
  const isOwner = () => FT.state.me && FT.state.me.user.role === 'consultant';
  const canWrite = () => !FT.state.me || !FT.state.me.sub || FT.state.me.sub.canWrite;
  const feat = (k) => !!(FT.state.me && FT.state.me.features && FT.state.me.features[k]);
  const firmName = () => (FT.state.me && FT.state.me.firm ? FT.state.me.firm.name : '');
  const waText = (c, msg) => { const tpl = (FT.state.me.firm && FT.state.me.firm.waTemplate) || 'Assalam o Alaikum {name}, this is {firm}. {message}'; return tpl.replace('{name}', c.name).replace('{firm}', firmName()).replace('{message}', msg || ''); };
  FT.waText = waText;
  let teamCache = null;
  const getTeam = async () => { if (!teamCache) teamCache = await FT.api('team.options'); return teamCache; };
  FT.listen('routed', () => { teamCache = null; });

  /* =================================================== shared modals */
  FT.clientModal = async (c) => {
    const team = await getTeam();
    const r = await FT.formModal({
      title: c ? 'Edit client' : 'Add a client', sub: c ? c.name : 'Profiles keep identity numbers, registrations and fee terms in one place.', size: 'lg', submitLabel: c ? 'Save client' : 'Add client',
      fields: [
        { name: 'type', label: 'Client type', type: 'radio', options: C.CLIENT_TYPES.map((t) => ({ value: t.id, label: t.label })), value: 'individual' },
        { name: 'name', label: 'Full name or registered name', required: true, col: 8 },
        { name: 'profile', label: 'Income profile', type: 'select', options: C.PROFILES.map((p) => ({ value: p.id, label: p.label })), col: 4, hint: 'Individuals only' },
        { name: 'businessName', label: 'Business or trade name', col: 6 }, { name: 'city', label: 'City', col: 6 },
        { type: 'section', label: 'Tax identity' },
        { name: 'cnic', label: 'CNIC', col: 4, placeholder: '35202-1234567-1' }, { name: 'ntn', label: 'NTN', col: 4, placeholder: 'For AOPs and companies' }, { name: 'strn', label: 'STRN or provincial number', col: 4 },
        { name: 'atl', label: 'Active Taxpayers List', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'unknown', label: 'Not checked' }], col: 4 },
        { name: 'rto', label: 'Tax office (RTO or LTO)', col: 8, placeholder: 'e.g. RTO Lahore' },
        { name: 'registrations', label: 'Registered with', type: 'chips', options: C.AUTHORITIES, value: ['FBR'] },
        { type: 'section', label: 'Contact' },
        { name: 'phone', label: 'Mobile (WhatsApp)', type: 'tel', col: 6 }, { name: 'email', label: 'Email', type: 'email', col: 6 },
        { name: 'address', label: 'Address', type: 'textarea', rows: 2 },
        { type: 'section', label: 'Practice' },
        { name: 'assignedTo', label: 'Handled by', type: 'select', options: FT.teamOptions(team), col: 4 },
        { name: 'feeBasis', label: 'Fee arrangement', type: 'select', options: C.FEE_BASIS.map((f) => ({ value: f.id, label: f.label })), col: 4 },
        { name: 'feeAmount', label: 'Agreed fee', type: 'money', col: 4 },
        { name: 'tags', label: 'Tags', placeholder: 'Comma separated, e.g. Refund case, Exporter', value: c ? (c.tags || []).join(', ') : '' },
        { name: 'notes', label: 'Private notes', type: 'textarea', rows: 3, hint: 'Never shown to the client.' },
      ],
      values: c ? Object.assign({}, c, { tags: (c.tags || []).join(', ') }) : { type: 'individual', atl: 'unknown', registrations: ['FBR'], feeBasis: 'annual', assignedTo: FT.state.me.user.id },
      onSubmit: (v) => FT.api('client.save', Object.assign(v, c ? { id: c.id } : {})),
    });
    if (r) FT.toast(c ? 'Client saved' : r.name + ' added');
    return r;
  };
  FT.filingModal = async (f, defaults) => {
    const [clients, team] = await Promise.all([FT.getClients(), getTeam()]);
    const months = FT.monthOptions(), quarters = FT.quarterOptions();
    const isNew = !f;
    const v0 = f || Object.assign({ type: 'itr', authority: 'FBR', taxYear: FT.filingYearDefault(), stage: 'not_started', assignedTo: FT.state.me.user.id }, defaults || {});
    const r = await FT.formModal({
      title: isNew ? 'Track a return or filing' : C.filingLabel(f.type), sub: isNew ? 'Each filing moves across your board from documents to filed.' : f.clientName + ', ' + f.periodLabel, size: 'lg', submitLabel: isNew ? 'Add filing' : 'Save changes',
      fields: [
        { name: 'clientId', label: 'Client', type: 'select', required: true, placeholder: 'Choose a client', options: FT.clientOptions(clients), col: 12 },
        { name: 'type', label: 'What is being filed', type: 'select', options: C.FILING_TYPES.map((t) => ({ value: t.id, label: t.label })), col: 6 },
        { name: 'authority', label: 'Authority', type: 'select', options: C.AUTHORITIES, col: 6 },
        { name: 'taxYear', label: 'Tax year', type: 'select', options: FT.taxYears(), col: 4 },
        { name: 'periodMonth', label: 'Month', type: 'select', options: months, col: 4, value: v0.period && /^\d{4}-\d{2}$/.test(v0.period) ? v0.period : months[2].value },
        { name: 'periodQuarter', label: 'Quarter', type: 'select', options: quarters, col: 4, value: v0.period && /Q/.test(v0.period) ? v0.period : quarters[1].value },
        { name: 'dueDate', label: 'Due date', type: 'date', col: 4 },
        { name: 'stage', label: 'Stage', type: 'select', options: C.STAGES.map((s) => ({ value: s.id, label: s.label })), col: 6 },
        { name: 'assignedTo', label: 'Assigned to', type: 'select', options: FT.teamOptions(team), col: 6 },
        { name: 'taxPayable', label: 'Tax payable', type: 'money', col: 4 }, { name: 'refund', label: 'Refund claimed', type: 'money', col: 4 }, { name: 'fee', label: 'Your fee for this', type: 'money', col: 4 },
        { name: 'ackNumber', label: 'Acknowledgement or CPR number', col: 6, hint: 'Shown to the client once filed.' },
        { name: 'notes', label: 'Working notes', type: 'textarea', rows: 3 },
      ],
      values: v0,
      footLeft: !isNew ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button><button type="button" class="btn btn-soft" data-approval>${FT.icon('stamp')}Ask client to approve</button>` : '',
      mount: (form, el, close) => {
        const sync = () => {
          const t = C.FILING_TYPES.find((x) => x.id === form.querySelector('[name=type]').value) || {};
          form.querySelector('[name=periodMonth]').closest('.field').hidden = t.cadence !== 'monthly';
          form.querySelector('[name=periodQuarter]').closest('.field').hidden = t.cadence !== 'quarterly';
          if (isNew) { const auth = form.querySelector('[name=authority]'); if (t.id === 'pst' && auth.value === 'FBR') auth.value = 'PRA'; if (t.id !== 'pst' && auth.value !== 'FBR' && t.authority === 'FBR') auth.value = 'FBR'; }
          if (isNew && !form.querySelector('[name=dueDate]').value) suggestDue();
        };
        const suggestDue = () => {
          const t = form.querySelector('[name=type]').value;
          const site = FT.state.site || {};
          const fd = (site.deadlines || []).find((d) => d.featured);
          const ty = +form.querySelector('[name=taxYear]').value;
          let due = '';
          if (t === 'itr' || t === 'wealth') { const c = clients.find((x) => x.id === form.querySelector('[name=clientId]').value); due = c && c.type === 'company' ? ty + '-12-31' : (fd && fd.date >= FT.today() ? fd.date : ty + '-09-30'); }
          if (t === 'stx' || t === 'pst') { const m = form.querySelector('[name=periodMonth]').value; due = U.addMonths(m + '-01', 1).slice(0, 7) + '-18'; }
          if (t === 'wht') { const q = form.querySelector('[name=periodQuarter]').value; const y = +q.slice(0, 4), qq = +q.slice(-1); due = (qq === 4 ? (y + 1) + '-01' : y + '-' + U.pad(qq * 3 + 1)) + '-20'; }
          if (due) form.querySelector('[name=dueDate]').value = due;
        };
        form.querySelector('[name=type]').addEventListener('change', () => { if (isNew) form.querySelector('[name=dueDate]').value = ''; sync(); });
        ['periodMonth', 'periodQuarter', 'taxYear', 'clientId'].forEach((n) => form.querySelector('[name=' + n + ']').addEventListener('change', () => { if (isNew) suggestDue(); }));
        sync();
        const del = el.querySelector('[data-del]');
        if (del) del.addEventListener('click', async () => { if (!(await FT.confirm({ title: 'Delete this filing?', message: 'It is removed from your board and the client portal.', confirmLabel: 'Delete', danger: true }))) return; await FT.api('filing.delete', { id: f.id }); close(); FT.toast('Filing deleted'); FT.reload(); });
        const ap = el.querySelector('[data-approval]');
        if (ap) ap.addEventListener('click', async () => { close(); await FT.sendFilingApproval(f); });
      },
      onSubmit: (v) => {
        const t = C.FILING_TYPES.find((x) => x.id === v.type) || {};
        v.period = t.cadence === 'monthly' ? v.periodMonth : t.cadence === 'quarterly' ? v.periodQuarter : '';
        delete v.periodMonth; delete v.periodQuarter;
        return FT.api('filing.save', Object.assign(v, f ? { id: f.id } : {}));
      },
    });
    if (r) FT.toast(isNew ? 'Filing added to your board' : 'Filing saved');
    return r;
  };
  FT.sendFilingApproval = async (f) => {
    const docs = (await FT.api('docs.list', { clientId: f.clientId })).filter((d) => d.uploaderRole === 'firm');
    const r = await FT.formModal({
      title: 'Ask ' + f.clientName + ' to approve', sub: C.filingLabel(f.type) + ', ' + U.periodLabel(f.period, f.taxYear), submitLabel: 'Send for approval', submitIcon: 'send',
      intro: html`<div class="callout violet">${FT.icon('stamp')}<span>The client gets a notification in their portal, reviews the draft and taps Approve or Request changes. Their decision is recorded with the time.</span></div>`,
      fields: [{ name: 'docId', label: 'Draft to review', type: 'select', placeholder: 'No document, approve the figures only', options: docs.map((d) => ({ value: d.id, label: d.name })) }, { name: 'note', label: 'Message to the client', type: 'textarea', rows: 3, value: 'Please review the draft and approve it so we can file before the deadline.' }],
      onSubmit: (v) => FT.api('filing.requestApproval', { id: f.id, docId: v.docId || null, note: v.note }),
    });
    if (r) { FT.toast('Sent to the client for approval'); FT.reload(); }
  };
  FT.noticeModal = async (n, defaults) => {
    const [clients, team] = await Promise.all([FT.getClients(), getTeam()]);
    const r = await FT.formModal({
      title: n ? C.sectionLabel(n.section) : 'Log a notice', sub: n ? n.clientName : 'Record the reply date and any hearing so neither is missed.', size: 'lg', submitLabel: n ? 'Save notice' : 'Log notice',
      fields: [
        { name: 'clientId', label: 'Client', type: 'select', required: true, placeholder: 'Choose a client', options: FT.clientOptions(clients), col: 8 },
        { name: 'authority', label: 'Authority', type: 'select', options: C.AUTHORITIES, col: 4 },
        { name: 'section', label: 'Section', type: 'select', options: C.NOTICE_SECTIONS.map((x) => ({ value: x.id, label: x.label })), col: 8 },
        { name: 'taxYear', label: 'Tax year', type: 'select', options: [{ value: '', label: 'Not specific' }].concat(FT.taxYears(6)), col: 4 },
        { name: 'title', label: 'Subject', col: 8, placeholder: 'e.g. Show cause on inadmissible input tax' }, { name: 'noticeNo', label: 'Notice number', col: 4 },
        { name: 'issueDate', label: 'Issued on', type: 'date', col: 4 }, { name: 'receivedDate', label: 'Received on', type: 'date', col: 4 }, { name: 'dueDate', label: 'Reply due', type: 'date', col: 4 },
        { name: 'hearingDate', label: 'Hearing date', type: 'date', col: 4 }, { name: 'amount', label: 'Amount involved', type: 'money', col: 4 }, { name: 'priority', label: 'Priority', type: 'select', options: C.PRIORITIES.map((p) => ({ value: p.id, label: p.label })), col: 4 },
        { name: 'status', label: 'Status', type: 'select', options: C.NOTICE_STATUS.map((s) => ({ value: s.id, label: s.label })), col: 6 }, { name: 'assignedTo', label: 'Handled by', type: 'select', options: FT.teamOptions(team), col: 6 },
        { name: 'visibleToClient', label: 'Show this notice and its status in the client portal', type: 'switch' },
        { name: 'notes', label: 'Working notes', type: 'textarea', rows: 3, hint: 'Internal. Clients never see these notes.' },
      ],
      values: n || Object.assign({ authority: 'FBR', section: '114(4)', status: 'received', priority: 'high', visibleToClient: true, receivedDate: FT.today(), assignedTo: FT.state.me.user.id }, defaults || {}),
      footLeft: n ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button><button type="button" class="btn btn-quiet" data-up>${FT.icon('upload')}Attach notice copy</button>` : '',
      mount: (form, el, close) => {
        const d = el.querySelector('[data-del]');
        if (d) d.addEventListener('click', async () => { if (!(await FT.confirm({ title: 'Delete this notice?', message: 'Its dates are removed from your calendar.', confirmLabel: 'Delete', danger: true }))) return; await FT.api('notice.delete', { id: n.id }); close(); FT.toast('Notice deleted'); FT.reload(); });
        const u = el.querySelector('[data-up]');
        if (u) u.addEventListener('click', async () => { const ok = await FT.uploadDocs({ clientId: n.clientId, category: 'FBR notice', taxYear: n.taxYear || FT.filingYearDefault(), shared: n.visibleToClient, title: 'Attach to notice' }); if (ok) FT.toast('Copy attached to the client file'); });
      },
      onSubmit: (v) => FT.api('notice.save', Object.assign(v, n ? { id: n.id } : {})),
    });
    if (r) FT.toast(n ? 'Notice saved' : 'Notice logged. Its dates are on your calendar.');
    return r;
  };
  FT.taskModal = async (t, defaults) => {
    const [clients, team] = await Promise.all([FT.getClients(), getTeam()]);
    const r = await FT.formModal({
      title: t ? 'Edit task' : 'Add a task', submitLabel: t ? 'Save task' : 'Add task',
      fields: [
        { name: 'title', label: 'What needs doing', required: true },
        { name: 'clientId', label: 'Client', type: 'select', options: [{ value: '', label: 'No client' }].concat(FT.clientOptions(clients)), col: 6 },
        { name: 'assignedTo', label: 'Assign to', type: 'select', options: team.map((u) => ({ value: u.id, label: u.name })), col: 6 },
        { name: 'dueDate', label: 'Due', type: 'date', col: 4 }, { name: 'priority', label: 'Priority', type: 'select', options: C.PRIORITIES.map((p) => ({ value: p.id, label: p.label })), col: 4 },
        { name: 'status', label: 'Status', type: 'select', options: [{ value: 'todo', label: 'To do' }, { value: 'doing', label: 'In progress' }, { value: 'done', label: 'Done' }], col: 4 },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 },
      ],
      values: t || Object.assign({ assignedTo: FT.state.me.user.id, priority: 'normal', status: 'todo', dueDate: FT.today() }, defaults || {}),
      footLeft: t ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (form, el, close) => { const d = el.querySelector('[data-del]'); if (d) d.addEventListener('click', async () => { await FT.api('task.delete', { id: t.id }); close(); FT.toast('Task deleted'); FT.reload(); }); },
      onSubmit: (v) => FT.api('task.save', Object.assign(v, t ? { id: t.id } : {})),
    });
    if (r) FT.toast(t ? 'Task saved' : 'Task added');
    return r;
  };
  FT.portalAccess = async (c) => {
    if (!feat('portal')) return FT.toast('The client portal is not part of your plan.', 'warn');
    const has = !!c.portal;
    if (has) {
      return FT.alertBox({
        title: 'Portal access', sub: c.name,
        body: html`<div class="stack"><div class="dl"><div>Login email</div><div>${FT.copyable(c.portal.email)}</div><div>Status</div><div>${c.portal.enabled ? FT.pill('On', 'green') : FT.pill('Turned off', '')}</div><div>Last signed in</div><div>${c.portal.lastLoginAt ? FT.ago(c.portal.lastLoginAt) : 'Not yet'}</div></div>
          <div class="row wrap"><button class="btn btn-sm" data-act="portal-reset" data-id="${c.id}">${FT.icon('key-round')}Reset password</button><button class="btn btn-sm" data-act="portal-toggle" data-id="${c.id}" data-on="${c.portal.enabled ? '0' : '1'}">${FT.icon(c.portal.enabled ? 'lock' : 'lock-open')}${c.portal.enabled ? 'Turn off access' : 'Turn on access'}</button></div></div>`,
      });
    }
    const r = await FT.formModal({
      title: 'Invite to the client portal', sub: c.name + ' can then upload documents, approve drafts, see invoices and message you.', submitLabel: 'Create login', submitIcon: 'user-plus',
      fields: [{ name: 'email', label: 'Client email for signing in', type: 'email', required: true, value: c.email }, { name: 'password', label: 'Password', type: 'text', hint: 'Leave blank and we will create a strong one.', autocomplete: 'off' }],
      onSubmit: (v) => FT.api('portal.invite', { clientId: c.id, email: v.email, password: v.password }),
    });
    if (r) { FT.showCredentials({ title: 'Portal login created', email: r.email, password: r.password, phone: r.phone || c.phone, name: r.name }); FT.reload(); }
    return r;
  };
  FT.act('portal-reset', async (el) => { FT.closeModals(); const r = await FT.api('portal.invite', { clientId: el.dataset.id }); FT.showCredentials({ title: 'New portal password', email: r.email, password: r.password, phone: r.phone, name: r.name }); FT.reload(); });
  FT.act('portal-toggle', async (el) => { FT.closeModals(); await FT.api('portal.toggle', { clientId: el.dataset.id, enabled: el.dataset.on === '1' }); FT.toast(el.dataset.on === '1' ? 'Portal access turned on' : 'Portal access turned off'); FT.reload(); });
  FT.act('open-doc', (el) => FT.openDoc(el.dataset.id, { onChange: () => FT.reload() }));

  /* ======================================================= dashboard */
  const KIND = { filing: ['file-check', ''], notice: ['gavel', 'red'], hearing: ['scale', 'red'], task: ['list-checks', 'amber'], deadline: ['calendar-clock', 'green'], event: ['calendar', 'violet'], invoice: ['receipt', ''] };
  const upcomingRow = (u) => {
    const d = FT.daysTo(u.date);
    const tone = d < 0 ? 'red' : d <= 7 ? 'amber' : '';
    const link = u.kind === 'filing' ? '/app/filings?open=' + u.id : u.kind === 'notice' || u.kind === 'hearing' ? '/app/notices?open=' + u.id : u.kind === 'task' ? '/app/tasks' : '/app/calendar?m=' + u.date.slice(0, 7);
    return html`<a class="li" href="${'#' + link}">${FT.dateTile(u.date, u.featured ? 'violet' : tone)}<div class="li-main"><div class="li-title">${u.title}</div><div class="li-sub">${u.sub || ''}</div></div><div class="li-side">${d < 0 ? FT.pill(-d + 'd overdue', 'red') : d === 0 ? FT.pill('Today', 'red') : html`<span class="nowrap">${d === 1 ? 'Tomorrow' : 'In ' + d + ' days'}</span>`}<div class="mt-1">${FT.pill({ filing: 'Return', notice: 'Notice', hearing: 'Hearing', task: 'Task', deadline: 'Deadline' }[u.kind] || u.kind, KIND[u.kind] ? KIND[u.kind][1] : '', true)}</div></div></a>`;
  };
  R('/app', async (ctx) => {
    const o = await FT.api('firm.overview');
    const me = FT.state.me;
    const k = o.kpis;
    ctx.title = 'Dashboard';
    const site = FT.state.site || {};
    const fd = (site.deadlines || []).find((d) => d.featured);
    const onb = o.onboarding;
    const showOnb = !onb.dismissed && onb.steps.some((s) => !s.done);
    const today = FT.pkt(new Date().toISOString());
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getUTCDay()];
    ctx.mount((root) => {
      root.querySelectorAll('[data-task-toggle]').forEach((b) => b.addEventListener('click', async (e) => { e.preventDefault(); e.stopPropagation(); await FT.api('task.toggle', { id: b.dataset.taskToggle }); FT.reload(); }));
      const dis = root.querySelector('[data-dismiss-onb]'); if (dis) dis.addEventListener('click', async () => { await FT.api('firm.onboarding.dismiss'); FT.reload(); });
    });
    return html`<div class="page">
      ${head(FT.greeting() + ', ' + me.user.name.split(' ')[0], dayName + ', ' + FT.date(FT.today()) + (fd ? '. ' + fd.title + ' due in ' + FT.plural(FT.daysTo(fd.date), 'day') + '.' : '.'), html`<button class="btn" data-act="dash-request">${FT.icon('clipboard-list')}Request documents</button><button class="btn" data-act="dash-upload">${FT.icon('upload')}Upload</button><a class="btn btn-primary" href="#/app/clients?new=1">${FT.icon('user-plus')}Add client</a>`)}
      ${o.announcements.map((a) => html`<div class="callout violet">${FT.icon('megaphone')}<span><b>${a.title}.</b> ${a.body} ${a.link ? html`<a href="${'#' + a.link}">Open</a>` : ''}</span></div>`)}
      ${showOnb ? html`<div class="sheet tinted"><div class="sheet-head"><h2>Set up your practice</h2><span class="sub">${onb.steps.filter((s) => s.done).length} of ${onb.steps.length} done</span><button class="btn btn-sm btn-quiet right" data-dismiss-onb>Hide</button></div><div class="sheet-body"><div class="bar" style="margin-bottom:14px"><i style="width:${(onb.steps.filter((s) => s.done).length / onb.steps.length) * 100}%"></i></div><div class="grid cols-3">${onb.steps.map((s) => html`<a class="row" href="${'#' + s.link}" style="text-decoration:none;color:inherit">${s.done ? html`<span class="li-icon green">${FT.icon('check')}</span>` : html`<span class="li-icon">${FT.icon('circle-dot')}</span>`}<span class="small ${s.done ? 'muted' : 'strong'}" style="${s.done ? 'text-decoration:line-through' : ''}">${s.label}</span></a>`)}</div></div></div>` : ''}
      <div class="kpis" style="--n:5">
        <a class="kpi" href="#/app/clients"><span class="k-label">${FT.icon('users')}Active clients</span><span class="k-value">${k.activeClients}</span><span class="k-foot">${k.portalClients} using the portal</span></a>
        <a class="kpi ${k.overdue ? 'alert' : ''}" href="#/app/filings"><span class="k-label">${FT.icon('file-check')}Returns due in 30 days</span><span class="k-value">${k.dueSoon}</span><span class="k-foot">${k.overdue ? k.overdue + ' overdue now' : 'Nothing overdue'}</span></a>
        <a class="kpi" href="#/app/documents?tab=approval"><span class="k-label">${FT.icon('stamp')}Waiting on clients</span><span class="k-value">${k.awaitingClient}</span><span class="k-foot">Approvals pending</span></a>
        <a class="kpi ${k.overdueInvoices ? 'warn' : ''}" href="#/app/invoices"><span class="k-label">${FT.icon('wallet')}Fees outstanding</span><span class="k-value">${FT.moneyShort(k.outstanding)}</span><span class="k-foot">${k.overdueInvoices ? k.overdueInvoices + ' invoices overdue' : 'No overdue invoices'}</span></a>
        <a class="kpi ${k.urgentNotices ? 'alert' : ''}" href="#/app/notices"><span class="k-label">${FT.icon('gavel')}Open notices</span><span class="k-value">${k.openNotices}</span><span class="k-foot">${k.urgentNotices ? k.urgentNotices + ' due within a week' : 'None urgent'}</span></a>
      </div>
      <div class="grid cols-main">
        <div class="sheet"><div class="sheet-head"><h2>Due and overdue</h2><span class="sub">Next 30 days</span><a class="btn btn-sm btn-quiet right" href="#/app/calendar">Calendar</a></div>
          <div class="list">${o.upcoming.length ? o.upcoming.map(upcomingRow) : FT.empty({ icon: 'calendar-clock', title: 'Nothing due in the next 30 days', text: 'Returns, notices and tasks with due dates appear here.' })}</div>
        </div>
        <div class="stack loose">
          <div class="sheet"><div class="sheet-head"><h2>New from clients</h2>${k.newUploads ? html`<span class="count green">${k.newUploads} new</span>` : ''}</div>
            <div class="list">
              ${k.pendingPaymentProofs ? html`<a class="li" href="#/app/payments"><span class="li-icon green">${FT.icon('wallet')}</span><div class="li-main"><div class="li-title">${FT.plural(k.pendingPaymentProofs, 'payment')} to confirm</div><div class="li-sub">Clients submitted transaction IDs</div></div>${FT.icon('chevron-right')}</a>` : ''}
              ${o.recentUploads.length ? o.recentUploads.map((d) => html`<div class="li clickable" data-act="open-doc" data-id="${d.id}">${FT.fileIcon(d.name, d.mime, true)}<div class="li-main"><div class="li-title">${d.name}</div><div class="li-sub">${d.clientName}, ${FT.ago(d.createdAt)}</div></div>${d.seenByFirm ? '' : FT.pill('New', 'green')}</div>`) : html`<div class="sheet-body muted small">Client uploads appear here as soon as they arrive.</div>`}
            </div>
          </div>
          <div class="sheet"><div class="sheet-head"><h2>My tasks</h2><a class="btn btn-sm btn-quiet right" href="#/app/tasks">All tasks</a></div>
            <div class="list">${o.myTasks.length ? o.myTasks.map((t) => html`<a class="li" href="#/app/tasks"><button class="icon-btn" data-task-toggle="${t.id}" aria-label="Mark done" style="width:30px;height:30px">${FT.icon('square')}</button><div class="li-main"><div class="li-title" style="white-space:normal">${t.title}</div><div class="li-sub">${t.clientName || 'General'}</div></div><div class="li-side">${FT.duePill(t.dueDate, false)}</div></a>`) : html`<div class="sheet-body muted small">You have no open tasks.</div>`}</div>
          </div>
        </div>
      </div>
      <div class="grid cols-main">
        <div class="sheet"><div class="sheet-head"><h2>Fees invoiced and collected</h2><span class="sub">Last 6 months</span></div><div class="sheet-body">${FT.chart.bars({ labels: o.revenue.map((r) => r.label), series: [{ name: 'Invoiced', values: o.revenue.map((r) => r.invoiced), color: FT.SERIES[1] }, { name: 'Collected', values: o.revenue.map((r) => r.collected), color: FT.SERIES[0] }], label: 'Fees invoiced and collected per month', height: 200 })}</div></div>
        <div class="sheet"><div class="sheet-head"><h2>Returns pipeline</h2><a class="btn btn-sm btn-quiet right" href="#/app/filings">Open board</a></div><div class="sheet-body">${FT.chart.hbars(o.pipeline.map((p) => ({ label: p.label, value: p.count, color: p.id === 'client_approval' ? 'var(--stamp)' : p.id === 'awaiting_docs' ? 'var(--amber)' : p.id === 'filed' || p.id === 'ready' ? 'var(--ledger)' : 'var(--ink-2)' })))}<p class="xs muted mt-2">${k.filedThisMonth} filed this month. Filed counts the last 45 days.</p></div></div>
      </div>
      <div class="sheet"><div class="sheet-head"><h2>Recent activity</h2></div><div class="timeline">${o.recentActivity.map((a) => html`<div class="tl"><span class="tl-dot ${a.role === 'client' ? 'client' : ''}"></span><div class="tl-body">${a.summary}<div class="tl-meta">${a.userName}, ${FT.ago(a.createdAt)}</div></div></div>`)}</div></div>
    </div>`;
  });
  FT.act('dash-upload', async () => { if (await FT.uploadDocs()) FT.reload(); });
  FT.act('dash-request', async () => { if (await FT.requestDocs()) FT.reload(); });

  /* ========================================================== clients */
  R('/app/clients', async (ctx) => {
    const [clients, team] = await Promise.all([FT.api('clients.list'), getTeam()]);
    ctx.title = 'Clients';
    const st = FT.ss.get('ft.clients.filter', { type: 'all', atl: '', reg: '', who: '', q: '', archived: false });
    ctx.mount((root) => {
      const box = root.querySelector('#client-rows');
      const els = { q: root.querySelector('#c-q'), atl: root.querySelector('#c-atl'), reg: root.querySelector('#c-reg'), who: root.querySelector('#c-who'), arch: root.querySelector('#c-arch') };
      els.q.value = st.q || ''; els.atl.value = st.atl; els.reg.value = st.reg; els.who.value = st.who; els.arch.checked = !!st.archived;
      const draw = () => {
        Object.assign(st, { q: els.q.value, atl: els.atl.value, reg: els.reg.value, who: els.who.value, archived: els.arch.checked });
        FT.ss.set('ft.clients.filter', st);
        root.querySelectorAll('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === st.type));
        const t = st.q.trim().toLowerCase();
        const rows = clients.filter((c) => (st.archived ? c.archived : !c.archived) && (st.type === 'all' || c.type === st.type) && (!st.atl || c.atl === st.atl) && (!st.reg || (c.registrations || []).indexOf(st.reg) >= 0) && (!st.who || c.assignedTo === st.who) && (!t || [c.name, c.businessName, c.cnic, c.ntn, c.strn, c.phone, c.email, c.city].concat(c.tags || []).join(' ').toLowerCase().includes(t)));
        root.querySelector('#c-count').textContent = FT.plural(rows.length, 'client');
        box.innerHTML = String(FT.table({ rows, rowAct: 'client-open', rowClass: (c) => (c.overdueFilings ? 'overdue' : ''), empty: clients.length ? FT.empty({ icon: 'search', title: 'No clients match', text: 'Clear a filter or try a CNIC, NTN or phone number.' }) : FT.empty({ icon: 'users', title: 'Add your first client', text: 'Type them in, or import your client list from Excel as a CSV.', action: html`<div class="row"><button class="btn btn-primary" data-act="client-new">${FT.icon('user-plus')}Add client</button><button class="btn" data-act="client-import">${FT.icon('file-spreadsheet')}Import CSV</button></div>` }), cols: [
          { label: 'Client', render: (c) => html`<div class="row">${FT.avatar(c.name, 'sm')}<div style="min-width:0"><div class="t-name">${c.name}</div><div class="t-sub">${c.ntn || c.cnic || 'No CNIC or NTN yet'}${c.city ? ', ' + c.city : ''}</div></div></div>` },
          { label: 'Type', render: (c) => html`${C.clientTypeLabel(c.type)}<div class="t-sub">${c.type === 'individual' ? C.profileLabel(c.profile) : (c.businessName || '')}</div>` },
          { label: 'Registered', render: (c) => html`<div class="row wrap" style="gap:4px">${(c.registrations || []).map((r) => html`<span class="tag">${r}</span>`)}${c.atl === 'inactive' ? FT.pill('Not on ATL', 'red') : ''}</div>` },
          { label: 'Portal', render: (c) => (c.portal ? (c.portal.enabled ? html`${FT.pill('On', 'green')}<div class="t-sub">${c.portal.lastLoginAt ? 'Seen ' + FT.ago(c.portal.lastLoginAt) : 'Not signed in yet'}</div>` : FT.pill('Off', '')) : html`<span class="muted small">Not invited</span>`) },
          { label: 'Open work', render: (c) => html`${c.openFilings ? FT.plural(c.openFilings, 'return') : html`<span class="muted">None</span>`}${c.overdueFilings ? html`<div class="t-sub" style="color:var(--margin)">${c.overdueFilings} overdue</div>` : c.nextDue ? html`<div class="t-sub">Next ${FT.dateShort(c.nextDue)}</div>` : ''}` },
          { label: 'Fees due', num: true, render: (c) => (c.outstanding ? html`<b>${FT.money(c.outstanding)}</b>` : html`<span class="muted">Clear</span>`) },
          { label: 'Handled by', render: (c) => (c.assigneeName ? html`<span class="row" style="gap:6px">${FT.avatar(c.assigneeName, 'sm')}<span class="small">${c.assigneeName.split(' ')[0]}</span></span>` : '') },
          { label: '', tdCls: 'actions', render: (c) => html`<button class="btn btn-sm btn-quiet btn-icon" data-act="client-menu" data-id="${c.id}" aria-label="Actions for ${c.name}">${FT.icon('ellipsis')}</button>` },
        ] }));
      };
      root.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => { st.type = b.dataset.type; draw(); }));
      els.q.addEventListener('input', FT.debounce(draw, 120));
      [els.atl, els.reg, els.who, els.arch].forEach((e) => e.addEventListener('change', draw));
      draw();
      root.querySelector('[data-export]').addEventListener('click', () => FT.files.save('clients-' + FT.today() + '.csv', FT.csv(clients, [{ label: 'Name', key: 'name' }, { label: 'Type', value: (c) => C.clientTypeLabel(c.type) }, { label: 'Profile', value: (c) => C.profileLabel(c.profile) }, { label: 'CNIC', key: 'cnic' }, { label: 'NTN', key: 'ntn' }, { label: 'STRN', key: 'strn' }, { label: 'Phone', key: 'phone' }, { label: 'Email', key: 'email' }, { label: 'City', key: 'city' }, { label: 'ATL', key: 'atl' }, { label: 'Registrations', value: (c) => (c.registrations || []).join(' ') }, { label: 'Fees due', key: 'outstanding' }]), 'text/csv'));
      if (ctx.query.new) setTimeout(async () => { const r = await FT.clientModal(); FT.go(r ? '/app/clients/' + r.id : '/app/clients', { replace: true }); }, 30);
    });
    const counts = (t) => clients.filter((c) => !c.archived && (t === 'all' || c.type === t)).length;
    return html`<div class="page">
      ${head('Clients', 'Profiles, identity numbers, registrations and open work for everyone you file for.', html`<button class="btn" data-act="client-import">${FT.icon('file-spreadsheet')}Import CSV</button><button class="btn" data-export>${FT.icon('download')}Export</button><button class="btn btn-primary" data-act="client-new">${FT.icon('user-plus')}Add client</button>`)}
      <div class="sheet">
        <div class="toolbar">
          <div class="seg">${[['all', 'All'], ['individual', 'Individuals'], ['aop', 'AOPs'], ['company', 'Companies']].map((t) => html`<button data-type="${t[0]}">${t[1]} <span class="count soft">${counts(t[0])}</span></button>`)}</div>
          <label class="search-field">${FT.icon('search')}<input class="input" id="c-q" placeholder="Name, CNIC, NTN, phone or tag" aria-label="Search clients"></label>
          <select class="select input-sm" id="c-atl" style="width:auto" aria-label="ATL status"><option value="">Any ATL status</option><option value="active">ATL active</option><option value="inactive">Not on ATL</option><option value="unknown">ATL not checked</option></select>
          <select class="select input-sm" id="c-reg" style="width:auto" aria-label="Registration"><option value="">Any registration</option>${C.AUTHORITIES.map((a) => html`<option>${a}</option>`)}</select>
          <select class="select input-sm" id="c-who" style="width:auto" aria-label="Handled by"><option value="">Anyone</option>${team.map((u) => html`<option value="${u.id}">${u.name}</option>`)}</select>
          <label class="check small"><input type="checkbox" id="c-arch"><span>Archived</span></label>
          <span class="right muted small" id="c-count"></span>
        </div>
        <div id="client-rows"></div>
      </div>
    </div>`;
  });
  FT.act('client-new', async () => { const r = await FT.clientModal(); if (r) FT.go('/app/clients/' + r.id); });
  FT.act('client-open', (el) => FT.go('/app/clients/' + el.dataset.id));
  FT.act('client-import', async () => {
    const r = await FT.formModal({
      title: 'Import clients from a CSV', sub: 'Save your Excel sheet as CSV first. Duplicates are skipped by CNIC, NTN or name.', size: 'lg', submitLabel: 'Import clients', submitIcon: 'file-spreadsheet',
      intro: html`<div class="callout">${FT.icon('info')}<span>Columns we read: <b>name</b>, type (individual, AOP or company), cnic, ntn, strn, phone, email, city, atl (active or inactive), registrations (for example FBR PRA). Only name is required.</span></div>`,
      fields: [{ name: 'file', type: 'file', label: 'CSV file', accept: '.csv,text/csv', cta: 'Choose a CSV file' }],
      onSubmit: async (v) => {
        const f = (v._files.file || [])[0];
        if (!f) throw new Error('Choose a CSV file.');
        const rows = FT.parseCsv(await f.text());
        if (rows.length < 2) throw new Error('The file has no data rows.');
        const headers = rows[0].map((h) => String(h).trim().toLowerCase().replace(/[^a-z]/g, ''));
        const map = { name: ['name', 'clientname', 'fullname', 'client'], type: ['type', 'clienttype'], cnic: ['cnic', 'cnicno', 'nic'], ntn: ['ntn', 'ntnno'], strn: ['strn', 'salestaxno'], phone: ['phone', 'mobile', 'cell', 'contact', 'whatsapp'], email: ['email', 'emailaddress'], city: ['city'], atl: ['atl', 'atlstatus', 'filer'], registrations: ['registrations', 'registeredwith', 'authorities'], address: ['address'], businessName: ['business', 'businessname', 'tradename'] };
        const idx = {};
        for (const k of Object.keys(map)) idx[k] = headers.findIndex((h) => map[k].indexOf(h) >= 0);
        if (idx.name < 0) throw new Error('Add a column called name.');
        const data = rows.slice(1).map((r) => { const o = {}; for (const k of Object.keys(idx)) if (idx[k] >= 0) o[k] = r[idx[k]]; return o; });
        const res = await FT.api('client.import', { rows: data });
        FT.toast(FT.plural(res.created, 'client') + ' imported' + (res.skipped ? ', ' + res.skipped + ' skipped' : ''), res.created ? 'success' : 'warn');
        return res;
      },
    });
    if (r) FT.reload();
  });
  FT.act('client-menu', async (el) => {
    const c = (await FT.api('clients.list')).find((x) => x.id === el.dataset.id);
    if (!c) return;
    FT.menu(el, [
      { label: 'Open client file', icon: 'folder-open', fn: () => FT.go('/app/clients/' + c.id) },
      { label: 'Upload documents', icon: 'upload', fn: async () => { if (await FT.uploadDocs({ clientId: c.id, sub: c.name })) FT.reload(); } },
      { label: 'Request documents', icon: 'clipboard-list', fn: async () => { if (await FT.requestDocs({ clientId: c.id, clientName: c.name })) FT.reload(); } },
      { label: 'Track a return', icon: 'file-check', fn: async () => { if (await FT.filingModal(null, { clientId: c.id })) FT.reload(); } },
      { label: 'New invoice', icon: 'receipt', fn: () => FT.go('/app/invoices?new=1&client=' + c.id) },
      { label: c.portal ? 'Portal access' : 'Invite to portal', icon: 'smartphone', fn: () => FT.portalAccess(c) },
      c.phone ? { label: 'WhatsApp', icon: 'message-circle', href: FT.wa(c.phone, waText(c, '')), external: true } : null,
      { sep: true },
      { label: c.archived ? 'Restore client' : 'Archive client', icon: c.archived ? 'archive-restore' : 'archive', fn: async () => { await FT.api('client.archive', { id: c.id, archived: !c.archived }); FT.toast(c.archived ? 'Client restored' : 'Client archived'); FT.reload(); } },
    ].filter(Boolean));
  });

  /* ---------------------------------------------------- client detail */
  const CTABS = [['overview', 'Overview', 'user'], ['documents', 'Documents', 'folder-open'], ['filings', 'Returns', 'file-check'], ['notices', 'Notices', 'gavel'], ['tasks', 'Tasks', 'list-checks'], ['billing', 'Billing', 'receipt'], ['messages', 'Messages', 'message-square'], ['vault', 'Portal logins', 'key-round'], ['activity', 'Activity', 'history']];
  R('/app/clients/:id/:tab?', async (ctx) => {
    const tab = ctx.params.tab || 'overview';
    const d = await FT.api('client.get', { id: ctx.params.id });
    const c = d.client;
    ctx.title = c.name;
    let body = '';
    if (tab === 'overview') body = clientOverview(d);
    if (tab === 'documents') body = await clientDocs(c, ctx);
    if (tab === 'filings') { const fl = await FT.api('filings.list', { clientId: c.id }); body = filingsTable(fl, { client: true, empty: FT.empty({ icon: 'file-check', title: 'No returns tracked yet', action: html`<button class="btn btn-primary" data-act="filing-new" data-client="${c.id}">${FT.icon('plus')}Track a return</button>` }) }); body = html`<div class="sheet"><div class="sheet-head"><h2>Returns and filings</h2><button class="btn btn-sm btn-primary right" data-act="filing-new" data-client="${c.id}">${FT.icon('plus')}Track a return</button></div>${body}</div>`; }
    if (tab === 'notices') { const ns = await FT.api('notices.list', { clientId: c.id }); body = html`<div class="sheet"><div class="sheet-head"><h2>Notices</h2><button class="btn btn-sm btn-primary right" data-act="notice-new" data-client="${c.id}">${FT.icon('plus')}Log notice</button></div>${noticesTable(ns, true)}</div>`; }
    if (tab === 'tasks') { const ts = await FT.api('tasks.list', { clientId: c.id }); body = html`<div class="sheet"><div class="sheet-head"><h2>Tasks</h2><button class="btn btn-sm btn-primary right" data-act="task-new" data-client="${c.id}">${FT.icon('plus')}Add task</button></div><div class="list">${ts.length ? ts.map(taskRow) : FT.empty({ icon: 'list-checks', title: 'No tasks for this client' })}</div></div>`; }
    if (tab === 'billing') body = await clientBilling(c, d);
    if (tab === 'messages') body = await FT.chatPane(c.id, true);
    if (tab === 'vault') body = await clientVault(c);
    if (tab === 'activity') body = html`<div class="sheet"><div class="sheet-head"><h2>Activity</h2></div><div class="timeline">${d.activity.length ? d.activity.map((a) => html`<div class="tl"><span class="tl-dot ${a.role === 'client' ? 'client' : ''}"></span><div class="tl-body">${a.summary}<div class="tl-meta">${a.userName}, ${FT.datetime(a.createdAt)}</div></div></div>`) : html`<div class="sheet-body muted small">No activity yet.</div>`}</div></div>`;
    ctx.mount((root) => {
      if (tab === 'messages') FT.mountChat(root, c.id);
      if (tab === 'documents') mountClientDocs(root, c, ctx);
      root.querySelectorAll('[data-vault-reveal]').forEach((b) => b.addEventListener('click', async () => { const r = await FT.api('vault.reveal', { id: b.dataset.vaultReveal }); const row = b.closest('[data-vault-row]'); row.querySelector('[data-secret]').innerHTML = String(FT.copyable(r.secret || '(empty)')); if (r.pin) row.querySelector('[data-pin]').innerHTML = String(FT.copyable(r.pin)); b.remove(); }));
    });
    const s = d.stats;
    const counts = { documents: s.docs, messages: s.unreadMessages, filings: c.openFilings, notices: c.openNotices };
    return html`<div class="page">
      <div class="crumbs"><a href="#/app/clients">Clients</a>${FT.icon('chevron-right')}<span>${c.name}</span></div>
      <div class="sheet"><div class="sheet-body"><div class="row top wrap" style="gap:16px">
        ${FT.avatar(c.name, 'lg')}
        <div class="grow stack tight" style="min-width:220px">
          <div class="row wrap"><h1 style="font-size:1.5rem;font-weight:780;font-stretch:112%;letter-spacing:-0.02em">${c.name}</h1>${c.archived ? FT.pill('Archived', '') : ''}</div>
          <div class="row wrap" style="gap:6px">${FT.pill(C.clientTypeLabel(c.type) + (c.type === 'individual' ? ', ' + C.profileLabel(c.profile) : ''), 'line', true)}${c.atl === 'active' ? FT.pill('ATL active', 'green') : c.atl === 'inactive' ? FT.pill('Not on ATL', 'red') : FT.pill('ATL not checked', '')}${(c.registrations || []).map((r) => html`<span class="tag">${r}</span>`)}${(c.tags || []).map((t) => html`<span class="tag">${t}</span>`)}</div>
          <div class="row wrap small" style="gap:6px 18px">${c.cnic ? html`<span class="muted">CNIC ${FT.copyable(c.cnic)}</span>` : ''}${c.ntn ? html`<span class="muted">NTN ${FT.copyable(c.ntn)}</span>` : ''}${c.strn ? html`<span class="muted">STRN ${FT.copyable(c.strn)}</span>` : ''}${c.phone ? html`<span class="muted">${FT.copyable(c.phone)}</span>` : ''}</div>
        </div>
        <div class="row wrap">${FT.waBtn(c.phone, waText(c, ''), 'WhatsApp', 'btn-sm')}<button class="btn btn-sm" data-act="cd-request" data-id="${c.id}" data-name="${c.name}">${FT.icon('clipboard-list')}Request documents</button><button class="btn btn-sm btn-primary" data-act="cd-upload" data-id="${c.id}" data-name="${c.name}">${FT.icon('upload')}Upload</button><button class="btn btn-sm btn-icon" data-act="cd-more" data-id="${c.id}" aria-label="More actions">${FT.icon('ellipsis')}</button></div>
      </div></div></div>
      <div class="tabs">${CTABS.filter((t) => t[0] !== 'vault' || true).map((t) => html`<a class="tab ${tab === t[0] ? 'active' : ''}" href="${'#/app/clients/' + c.id + (t[0] === 'overview' ? '' : '/' + t[0])}">${FT.icon(t[2])}${t[1]}${counts[t[0]] ? html`<span class="count ${t[0] === 'messages' ? '' : 'soft'}">${counts[t[0]]}</span>` : ''}</a>`)}</div>
      ${body}
    </div>`;
  });
  function clientOverview(d) {
    const c = d.client, s = d.stats;
    return html`<div class="grid cols-main">
      <div class="stack loose">
        <div class="kpis" style="--n:4"><div class="kpi"><span class="k-label">Open returns</span><span class="k-value">${c.openFilings}</span><span class="k-foot">${c.overdueFilings ? c.overdueFilings + ' overdue' : 'On track'}</span></div><div class="kpi"><span class="k-label">Waiting on client</span><span class="k-value">${s.pendingApprovals + s.openRequests}</span><span class="k-foot">${s.openRequests} document requests</span></div><div class="kpi"><span class="k-label">Fees due</span><span class="k-value">${FT.moneyShort(c.outstanding)}</span><span class="k-foot">${FT.money(s.collected)} collected</span></div><div class="kpi"><span class="k-label">Documents</span><span class="k-value">${s.docs}</span><span class="k-foot">in the client file</span></div></div>
        <div class="sheet"><div class="sheet-head"><h2>Open work</h2><a class="btn btn-sm btn-quiet right" href="${'#/app/clients/' + c.id + '/filings'}">All returns</a></div>
          ${filingsTable(d.upcoming, { client: true, compact: true, empty: html`<div class="sheet-body muted small">No open returns. <a href="#/" data-act="filing-new" data-client="${c.id}">Track one</a>.</div>` })}
        </div>
        <div class="sheet"><div class="sheet-head"><h2>Recent activity</h2></div><div class="timeline">${d.activity.slice(0, 8).map((a) => html`<div class="tl"><span class="tl-dot ${a.role === 'client' ? 'client' : ''}"></span><div class="tl-body">${a.summary}<div class="tl-meta">${a.userName}, ${FT.ago(a.createdAt)}</div></div></div>`)}${d.activity.length ? '' : html`<div class="sheet-body muted small">Nothing yet.</div>`}</div></div>
      </div>
      <div class="stack loose">
        <div class="sheet"><div class="sheet-head"><h2>Client portal</h2>${c.portal ? (c.portal.enabled ? FT.pill('On', 'green') : FT.pill('Off', '')) : ''}</div><div class="sheet-body stack">
          ${c.portal ? html`<div class="dl"><div>Login</div><div>${c.portal.email}</div><div>Last signed in</div><div>${c.portal.lastLoginAt ? FT.ago(c.portal.lastLoginAt) : 'Not yet'}</div></div><button class="btn btn-sm" data-act="cd-portal" data-id="${c.id}" style="align-self:flex-start">${FT.icon('settings')}Manage access</button>` : html`<p class="small ink2">Give ${c.name.split(' ')[0]} a login to upload documents from their phone, approve drafts and see invoices.</p><button class="btn btn-primary btn-sm" data-act="cd-portal" data-id="${c.id}" style="align-self:flex-start">${FT.icon('user-plus')}Invite to portal</button>`}
        </div></div>
        <div class="sheet"><div class="sheet-head"><h2>Profile</h2><button class="btn btn-sm btn-quiet right" data-act="cd-edit" data-id="${c.id}">${FT.icon('pencil')}Edit</button></div><div class="sheet-body"><div class="dl">
          ${c.businessName ? html`<div>Business</div><div>${c.businessName}</div>` : ''}
          <div>Email</div><div>${c.email ? FT.copyable(c.email) : html`<span class="faint">Not added</span>`}</div>
          <div>Mobile</div><div>${c.phone ? FT.copyable(c.phone) : html`<span class="faint">Not added</span>`}</div>
          <div>City</div><div>${c.city || html`<span class="faint">Not added</span>`}</div>
          ${c.address ? html`<div>Address</div><div>${c.address}</div>` : ''}
          <div>Tax office</div><div>${c.rto || html`<span class="faint">Not added</span>`}</div>
          <div>Fee terms</div><div>${(C.FEE_BASIS.find((f) => f.id === c.feeBasis) || {}).label || ''}${c.feeAmount ? ', ' + FT.money(c.feeAmount) : ''}</div>
          <div>Handled by</div><div>${c.assigneeName || 'Unassigned'}</div>
          <div>Client since</div><div>${FT.date(FT.isoDay(c.createdAt))}</div>
        </div></div></div>
        ${c.notes ? html`<div class="sheet tinted"><div class="sheet-body stack tight"><b class="small">Private notes</b><p class="small ink2" style="white-space:pre-wrap">${c.notes}</p></div></div>` : ''}
      </div>
    </div>`;
  }
  async function clientDocs(c, ctx) {
    const [docs, reqs] = await Promise.all([FT.api('docs.list', { clientId: c.id }), FT.api('requests.list', { clientId: c.id })]);
    const open = reqs.filter((r) => r.status === 'open');
    return html`<div class="stack loose">
      ${open.length ? html`<div class="sheet"><div class="sheet-head"><h2>Waiting for the client</h2><span class="count">${open.length}</span></div><div class="list">${open.map((r) => { const due = FT.dueInfo(r.dueDate); return html`<div class="li"><span class="li-icon amber">${FT.icon('clipboard-list')}</span><div class="li-main"><div class="li-title">${r.title}</div><div class="li-sub">Requested ${FT.ago(r.createdAt)}${r.note ? '. ' + r.note : ''}</div></div><div class="row" style="gap:6px">${due.tone ? FT.pill(due.text, due.tone) : html`<span class="xs muted">${due.text}</span>`}<button class="btn btn-sm btn-quiet" data-act="req-upload" data-id="${r.id}" data-client="${c.id}" data-title="${r.title}" title="Upload it yourself">${FT.icon('upload')}</button>${FT.waBtn(c.phone, waText(c, 'A quick reminder: we still need your ' + r.title + '. You can upload it in your portal or send it here.'), 'Remind')}<button class="btn btn-sm btn-quiet btn-icon" data-act="req-cancel" data-id="${r.id}" aria-label="Cancel request">${FT.icon('x')}</button></div></div>`; })}</div></div>` : ''}
      <div class="sheet"><div class="toolbar"><b>Client file</b><label class="search-field">${FT.icon('search')}<input class="input" id="d-q" placeholder="Search files" aria-label="Search files"></label><select class="select input-sm" id="d-ty" style="width:auto" aria-label="Tax year"><option value="">All tax years</option>${FT.taxYears(6).map((y) => html`<option value="${y.value}">TY${y.value}</option>`)}</select><div class="right row"><button class="btn btn-sm" data-act="cd-request" data-id="${c.id}" data-name="${c.name}">${FT.icon('clipboard-list')}Request</button><button class="btn btn-sm btn-primary" data-act="cd-upload" data-id="${c.id}" data-name="${c.name}">${FT.icon('upload')}Upload</button></div></div>
        <div id="doc-rows">${docsTable(docs, false)}</div>
      </div>
    </div>`;
  }
  function mountClientDocs(root, c, ctx) {
    const box = root.querySelector('#doc-rows');
    if (!box) return;
    let all = null;
    const draw = async () => {
      if (!all) all = await FT.api('docs.list', { clientId: c.id });
      const q = root.querySelector('#d-q').value.trim().toLowerCase(), ty = root.querySelector('#d-ty').value;
      box.innerHTML = String(docsTable(all.filter((d) => (!q || (d.name + ' ' + d.category).toLowerCase().includes(q)) && (!ty || String(d.taxYear) === ty)), false));
    };
    root.querySelector('#d-q').addEventListener('input', FT.debounce(draw, 120));
    root.querySelector('#d-ty').addEventListener('change', draw);
    if (ctx.query.open) setTimeout(() => FT.openDoc(ctx.query.open, { onChange: () => FT.reload() }), 40);
  }
  function docsTable(docs, withClient) {
    return FT.table({ rows: docs, rowAct: 'open-doc', empty: FT.empty({ icon: 'folder-open', title: 'No documents yet', text: 'Upload files yourself, or request them and let the client upload from their phone.' }), cols: [
      { label: 'File', render: (d) => html`<div class="row">${FT.fileIcon(d.name, d.mime, true)}<div style="min-width:0"><div class="t-name ellipsis" style="max-width:340px">${d.name}</div><div class="t-sub">${d.category}${d.commentCount ? ', ' + FT.plural(d.commentCount, 'comment') : ''}</div></div></div>` },
    ].concat(withClient ? [{ label: 'Client', render: (d) => html`<a href="${'#/app/clients/' + d.clientId + '/documents'}">${d.clientName}</a>` }] : []).concat([
      { label: 'Year', render: (d) => (d.taxYear ? 'TY' + d.taxYear : '') },
      { label: 'From', render: (d) => (d.uploaderRole === 'client' ? html`${FT.pill('Client', 'violet', true)}${d.seenByFirm ? '' : html` ${FT.pill('New', 'green')}`}` : html`<span class="small">${d.uploaderName}</span>`) },
      { label: 'Status', render: (d) => (d.approval ? FT.approvalPill(d.approval) : d.uploaderRole === 'firm' ? (d.shared ? FT.pill('Shared', 'green') : FT.pill('Internal', '')) : html`<span class="muted small">In client file</span>`) },
      { label: 'Added', render: (d) => html`<span class="muted nowrap">${FT.ago(d.createdAt)}</span><div class="t-sub">${FT.bytes(d.size)}</div>` },
    ]) });
  }
  FT.docsTable = docsTable;
  async function clientBilling(c, d) {
    const [invs, pays] = await Promise.all([FT.api('invoices.list', { clientId: c.id }), FT.api('payments.list')]);
    const mine = pays.filter((p) => p.clientId === c.id);
    return html`<div class="stack loose">
      <div class="kpis" style="--n:3"><div class="kpi"><span class="k-label">Invoiced</span><span class="k-value">${FT.moneyShort(d.stats.invoiced)}</span></div><div class="kpi"><span class="k-label">Collected</span><span class="k-value">${FT.moneyShort(d.stats.collected)}</span></div><div class="kpi ${c.outstanding ? 'warn' : ''}"><span class="k-label">Outstanding</span><span class="k-value">${FT.moneyShort(c.outstanding)}</span></div></div>
      <div class="sheet"><div class="sheet-head"><h2>Invoices</h2><a class="btn btn-sm btn-primary right" href="${'#/app/invoices?new=1&client=' + c.id}">${FT.icon('plus')}New invoice</a></div>${FT.invoicesTable(invs, false)}</div>
      <div class="sheet"><div class="sheet-head"><h2>Payments</h2></div>${FT.table({ rows: mine, empty: html`<div class="sheet-body muted small">No payments recorded yet.</div>`, cols: [{ label: 'Date', render: (p) => FT.date(p.date) }, { label: 'Invoice', key: 'invoiceNumber' }, { label: 'Amount', num: true, render: (p) => FT.money(p.amount) }, { label: 'Method', render: (p) => html`${p.method}<div class="t-sub">${p.reference}</div>` }, { label: 'Status', render: (p) => FT.statusPill('payment', p.status) }] })}</div>
    </div>`;
  }
  async function clientVault(c) {
    if (!feat('vault')) return html`<div class="sheet">${FT.empty({ icon: 'lock', title: 'Keep IRIS and provincial portal logins safe', text: 'The encrypted credentials vault is part of the Firm Pro plan. Every time someone views a password, it is recorded.', action: isOwner() ? html`<a class="btn btn-primary" href="#/app/subscription">See plans</a>` : '' })}</div>`;
    const list = await FT.api('vault.list', { clientId: c.id });
    return html`<div class="sheet"><div class="sheet-head"><h2>Portal logins</h2><span class="sub">Encrypted. Each view is logged in the activity.</span><button class="btn btn-sm btn-primary right" data-act="vault-edit" data-client="${c.id}">${FT.icon('plus')}Add login</button></div>
      <div class="list">${list.length ? list.map((v) => html`<div class="li" data-vault-row><span class="li-icon violet">${FT.icon('key-round')}</span><div class="li-main"><div class="li-title">${v.portal}</div><div class="li-sub">Username ${FT.copyable(v.username)}</div><div class="li-sub">Password <span data-secret>••••••••</span>${v.hasPin ? html`, PIN <span data-pin>••••</span>` : ''}</div>${v.lastRevealedAt ? html`<div class="xs faint">Last viewed by ${v.lastRevealedBy}, ${FT.ago(v.lastRevealedAt)}</div>` : ''}</div><div class="row" style="gap:6px"><button class="btn btn-sm" data-vault-reveal="${v.id}">${FT.icon('eye')}Show</button><button class="btn btn-sm btn-quiet btn-icon" data-act="vault-edit" data-id="${v.id}" data-client="${c.id}" aria-label="Edit">${FT.icon('pencil')}</button></div></div>`) : FT.empty({ icon: 'key-round', title: 'No saved logins', text: 'Save the client\'s IRIS, PRA or SRB login so your team can file without asking each time.' })}</div></div>`;
  }
  FT.act('vault-edit', async (el) => {
    const list = el.dataset.id ? await FT.api('vault.list', { clientId: el.dataset.client }) : [];
    const v = list.find((x) => x.id === el.dataset.id);
    const r = await FT.formModal({ title: v ? 'Edit ' + v.portal + ' login' : 'Save a portal login', sub: 'Stored encrypted. Leave password blank to keep the current one.', submitLabel: 'Save login', fields: [{ name: 'portal', label: 'Portal', type: 'select', options: C.VAULT_PORTALS, col: 6 }, { name: 'username', label: 'Username or CNIC', required: true, col: 6 }, { name: 'secret', label: 'Password', type: 'password', col: 6, autocomplete: 'new-password' }, { name: 'pin', label: 'PIN (if any)', type: 'password', col: 6, autocomplete: 'off' }, { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 }], values: v || { portal: 'FBR IRIS' },
      footLeft: v ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (f, m, close) => { const d = m.querySelector('[data-del]'); if (d) d.addEventListener('click', async () => { await FT.api('vault.delete', { id: v.id }); close(); FT.toast('Login deleted'); FT.reload(); }); },
      onSubmit: (x) => FT.api('vault.save', Object.assign(x, { clientId: el.dataset.client }, v ? { id: v.id } : {})) });
    if (r) { FT.toast('Login saved'); FT.reload(); }
  });
  FT.act('cd-upload', async (el) => { if (await FT.uploadDocs({ clientId: el.dataset.id, sub: el.dataset.name })) FT.reload(); });
  FT.act('cd-request', async (el) => { if (await FT.requestDocs({ clientId: el.dataset.id, clientName: el.dataset.name })) FT.reload(); });
  FT.act('req-upload', async (el) => { if (await FT.uploadDocs({ clientId: el.dataset.client, requestId: el.dataset.id, title: 'Upload: ' + el.dataset.title })) FT.reload(); });
  FT.act('req-cancel', async (el) => { if (!(await FT.confirm({ title: 'Cancel this request?', message: 'It disappears from the client portal.', confirmLabel: 'Cancel request' }))) return; await FT.api('request.update', { id: el.dataset.id, status: 'cancelled' }); FT.reload(); });
  FT.act('cd-edit', async (el) => { const d = await FT.api('client.get', { id: el.dataset.id }); if (await FT.clientModal(d.client)) FT.reload(); });
  FT.act('cd-portal', async (el) => { const d = await FT.api('client.get', { id: el.dataset.id }); FT.portalAccess(d.client); });
  FT.act('cd-more', async (el) => {
    const d = await FT.api('client.get', { id: el.dataset.id });
    const c = d.client;
    FT.menu(el, [
      { label: 'Edit profile', icon: 'pencil', fn: async () => { if (await FT.clientModal(c)) FT.reload(); } },
      { label: c.portal ? 'Portal access' : 'Invite to portal', icon: 'smartphone', fn: () => FT.portalAccess(c) },
      { label: 'Track a return', icon: 'file-check', fn: async () => { if (await FT.filingModal(null, { clientId: c.id })) FT.reload(); } },
      { label: 'Log a notice', icon: 'gavel', fn: async () => { if (await FT.noticeModal(null, { clientId: c.id })) FT.reload(); } },
      { label: 'Add a task', icon: 'list-checks', fn: async () => { if (await FT.taskModal(null, { clientId: c.id })) FT.reload(); } },
      { label: 'New invoice', icon: 'receipt', fn: () => FT.go('/app/invoices?new=1&client=' + c.id) },
      { sep: true },
      { label: c.archived ? 'Restore client' : 'Archive client', icon: c.archived ? 'archive-restore' : 'archive', fn: async () => { await FT.api('client.archive', { id: c.id, archived: !c.archived }); FT.toast(c.archived ? 'Client restored' : 'Client archived. Their portal login is turned off.'); FT.reload(); } },
    ].concat(isOwner() ? [{ label: 'Delete client', icon: 'trash-2', danger: true, fn: async () => { const typed = await FT.confirm({ title: 'Delete ' + c.name + ' for good?', message: 'Every document, return, notice, invoice, message and the portal login for this client will be erased.', typeToConfirm: c.name, confirmLabel: 'Delete client', danger: true }); if (!typed) return; await FT.api('client.delete', { id: c.id, confirm: typed }); FT.toast('Client deleted'); FT.go('/app/clients'); } }] : []));
  });

  /* ======================================================== documents */
  R('/app/documents', async (ctx) => {
    const tab = ctx.query.tab || 'all';
    ctx.title = 'Documents';
    const [docs, reqs] = await Promise.all([FT.api('docs.list'), FT.api('requests.list')]);
    let body;
    if (tab === 'requests') {
      const open = reqs.filter((r) => r.status === 'open');
      body = FT.table({ rows: open, empty: FT.empty({ icon: 'clipboard-list', title: 'No open requests', text: 'Ask clients for documents and track what is still missing here.' }), rowClass: (r) => (r.dueDate && r.dueDate < FT.today() ? 'overdue' : ''), cols: [{ label: 'Document', render: (r) => html`<div class="t-name">${r.title}</div>${r.note ? html`<div class="t-sub">${r.note}</div>` : ''}` }, { label: 'Client', render: (r) => html`<a href="${'#/app/clients/' + r.clientId + '/documents'}">${r.clientName}</a>` }, { label: 'Needed by', render: (r) => FT.duePill(r.dueDate) }, { label: 'Requested', render: (r) => html`<span class="muted">${FT.ago(r.createdAt)}</span>` }, { label: '', tdCls: 'actions', render: (r) => html`<button class="btn btn-sm btn-quiet" data-act="req-upload" data-id="${r.id}" data-client="${r.clientId}" data-title="${r.title}">${FT.icon('upload')}Upload</button><button class="btn btn-sm btn-quiet btn-icon" data-act="req-cancel" data-id="${r.id}" aria-label="Cancel">${FT.icon('x')}</button>` }] });
    } else {
      const rows = docs.filter((d) => tab === 'all' || (tab === 'client' && d.uploaderRole === 'client') || (tab === 'approval' && d.approval && d.approval.status !== 'approved'));
      body = html`<div id="all-docs">${docsTable(rows, true)}</div>`;
      ctx.mount((root) => {
        const q = root.querySelector('#ad-q');
        q.addEventListener('input', FT.debounce(() => { const t = q.value.trim().toLowerCase(); root.querySelector('#all-docs').innerHTML = String(docsTable(rows.filter((d) => !t || (d.name + ' ' + d.clientName + ' ' + d.category).toLowerCase().includes(t)), true)); }, 120));
      });
    }
    ctx.mount(() => { if (ctx.query.open) FT.openDoc(ctx.query.open, { onChange: () => FT.reload() }); });
    const n = { all: docs.length, client: docs.filter((d) => d.uploaderRole === 'client' && !d.seenByFirm).length, approval: docs.filter((d) => d.approval && d.approval.status !== 'approved').length, requests: reqs.filter((r) => r.status === 'open').length };
    return html`<div class="page">
      ${head('Documents', 'Every client file in one place: uploads from clients, drafts waiting for approval, and requests still outstanding.', html`<button class="btn" data-act="dash-request">${FT.icon('clipboard-list')}Request documents</button><button class="btn btn-primary" data-act="dash-upload">${FT.icon('upload')}Upload</button>`)}
      <div class="sheet"><div class="toolbar"><div class="seg">${[['all', 'All files'], ['client', 'New from clients'], ['approval', 'Approvals'], ['requests', 'Requests']].map((t) => html`<a class="${tab === t[0] ? 'active' : ''}" href="${'#/app/documents' + (t[0] === 'all' ? '' : '?tab=' + t[0])}">${t[1]} ${n[t[0]] ? html`<span class="count ${t[0] === 'client' ? 'green' : 'soft'}">${n[t[0]]}</span>` : ''}</a>`)}</div>${tab !== 'requests' ? html`<label class="search-field">${FT.icon('search')}<input class="input" id="ad-q" placeholder="Search by file or client" aria-label="Search documents"></label>` : ''}<span class="right xs muted">Storage used: ${FT.bytes(FT.state.me.usage.storageBytes)}</span></div>${body}</div>
    </div>`;
  });

  /* ========================================================== filings */
  function filingsTable(rows, o) {
    o = o || {};
    return FT.table({ rows, rowAct: 'filing-open', empty: o.empty || FT.empty({ icon: 'file-check', title: 'No filings match' }), rowClass: (f) => (f.overdue ? 'overdue' : f.stage !== 'filed' && f.daysLeft != null && f.daysLeft <= 7 ? 'soon' : ''), cols: [
      { label: 'Filing', render: (f) => html`<div class="t-name">${f.typeLabel}</div><div class="t-sub">${f.periodLabel}, ${f.authority}</div>` },
    ].concat(o.client ? [] : [{ label: 'Client', render: (f) => html`<a href="${'#/app/clients/' + f.clientId + '/filings'}">${f.clientName}</a>` }]).concat([
      { label: 'Stage', render: (f) => html`${FT.statusPill('stage', f.stage)}${f.clientDecision && f.clientDecision.status === 'changes' && f.stage !== 'filed' ? html`<div class="t-sub" style="color:var(--amber)">Client asked for changes</div>` : ''}` },
      { label: 'Due', render: (f) => (f.stage === 'filed' ? html`<span class="small">${f.ackNumber ? 'Ack ' + f.ackNumber : 'Filed'}</span><div class="t-sub">${f.filedAt ? FT.date(FT.isoDay(f.filedAt)) : ''}</div>` : FT.duePill(f.dueDate)) },
    ]).concat(o.compact ? [] : [
      { label: 'Amount', num: true, render: (f) => (f.refund ? html`<span style="color:var(--ledger)">Refund ${FT.money(f.refund)}</span>` : f.taxPayable ? FT.money(f.taxPayable) : html`<span class="muted">-</span>`) },
      { label: 'Assigned', render: (f) => (f.assigneeName ? html`<span class="row" style="gap:6px">${FT.avatar(f.assigneeName, 'sm')}<span class="small">${f.assigneeName.split(' ')[0]}</span></span>` : '') },
    ]) });
  }
  FT.filingsTable = filingsTable;
  FT.act('filing-open', async (el) => { const fl = await FT.api('filings.list'); const f = fl.find((x) => x.id === el.dataset.id); if (f && (await FT.filingModal(f))) FT.reload(); });
  FT.act('filing-new', async (el) => { if (await FT.filingModal(null, el.dataset.client ? { clientId: el.dataset.client } : null)) FT.reload(); });
  R('/app/filings', async (ctx) => {
    const [all, team] = await Promise.all([FT.api('filings.list'), getTeam()]);
    ctx.title = 'Returns and filings';
    const st = FT.ss.get('ft.filings', { view: 'board', type: '', who: '', ty: '', q: '', hideOld: true });
    ctx.mount((root) => {
      const box = root.querySelector('#fl-body');
      const els = { type: root.querySelector('#fl-type'), who: root.querySelector('#fl-who'), ty: root.querySelector('#fl-ty'), q: root.querySelector('#fl-q') };
      Object.keys(els).forEach((k) => { els[k].value = st[k] || ''; });
      const filtered = () => { const t = (st.q || '').trim().toLowerCase(); return all.filter((f) => (!st.type || f.type === st.type) && (!st.who || f.assignedTo === st.who) && (!st.ty || String(f.taxYear) === st.ty) && (!t || (f.clientName + ' ' + f.typeLabel + ' ' + f.periodLabel + ' ' + f.ackNumber).toLowerCase().includes(t))); };
      const draw = () => {
        Object.keys(els).forEach((k) => { st[k] = els[k].value; });
        FT.ss.set('ft.filings', st);
        root.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === st.view));
        const rows = filtered();
        if (st.view === 'list') { box.innerHTML = String(html`<div class="sheet">${filingsTable(rows)}</div>`); return; }
        box.innerHTML = String(html`<div class="kanban">${C.STAGES.map((s) => { const items = rows.filter((f) => f.stage === s.id && (s.id !== 'filed' || !f.filedAt || Date.parse(f.filedAt) > Date.now() - 45 * 86400000)); return html`<section class="kcol" data-stage="${s.id}"><div class="kcol-head">${FT.statusPill('stage', s.id)}<span class="count soft">${items.length}</span></div><div class="kcol-body">${items.map((f) => html`<article class="kcard ${f.overdue ? 'overdue' : f.stage !== 'filed' && f.daysLeft != null && f.daysLeft <= 7 ? 'soon' : ''}" draggable="true" data-id="${f.id}" tabindex="0"><div class="kc-title">${f.clientName}</div><div class="kc-sub">${f.typeLabel}, ${f.periodLabel}${f.authority !== 'FBR' ? ', ' + f.authority : ''}</div><div class="kc-foot">${f.stage === 'filed' ? html`<span>${f.ackNumber ? 'Ack ' + f.ackNumber : 'Filed'}</span>` : FT.duePill(f.dueDate)}${f.clientDecision && f.clientDecision.status === 'changes' && f.stage !== 'filed' ? FT.pill('Changes', 'amber') : ''}<span class="right">${f.assigneeName ? FT.avatar(f.assigneeName, 'sm', { round: true }) : ''}</span></div><select class="select input-sm show-sm" data-move="${f.id}" aria-label="Move to stage" style="margin-top:2px">${C.STAGES.map((x) => html`<option value="${x.id}" ${x.id === f.stage ? raw('selected') : ''}>${x.label}</option>`)}</select></article>`)}${items.length ? '' : html`<div class="xs muted" style="padding:8px 6px">Drop a card here</div>`}</div></section>`; })}</div>`);
        bindBoard();
      };
      const move = async (id, stage) => {
        const f = all.find((x) => x.id === id); if (!f || f.stage === stage) return;
        let ack;
        if (stage === 'filed') {
          const r = await FT.formModal({ title: 'Mark as filed', sub: f.clientName + ', ' + f.typeLabel, submitLabel: 'Mark filed', submitIcon: 'stamp', fields: [{ name: 'ackNumber', label: 'Acknowledgement or CPR number', value: f.ackNumber, hint: 'The client sees it in their portal.' }], onSubmit: (v) => v });
          if (!r) return draw();
          ack = r.ackNumber;
        }
        try {
          const out = await FT.api('filing.move', { id, stage, ackNumber: ack });
          Object.assign(f, out);
          FT.toast(f.clientName + ': ' + C.stageLabel(stage));
          draw();
          FT.ping();
        } catch (err) { FT.handleError(err); draw(); }
      };
      const bindBoard = () => {
        box.querySelectorAll('.kcard').forEach((card) => {
          card.addEventListener('dragstart', (e) => { card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.dataset.id); e.dataTransfer.effectAllowed = 'move'; });
          card.addEventListener('dragend', () => card.classList.remove('dragging'));
          card.addEventListener('click', async (e) => { if (e.target.closest('select')) return; const f = all.find((x) => x.id === card.dataset.id); if (await FT.filingModal(f)) FT.reload(); });
          card.addEventListener('keydown', (e) => { if (e.key === 'Enter') card.click(); });
        });
        box.querySelectorAll('[data-move]').forEach((s) => s.addEventListener('change', () => move(s.dataset.move, s.value)));
        box.querySelectorAll('.kcol').forEach((col) => {
          col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('drop'); });
          col.addEventListener('dragleave', (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
          col.addEventListener('drop', (e) => { e.preventDefault(); col.classList.remove('drop'); move(e.dataTransfer.getData('text/plain'), col.dataset.stage); });
        });
      };
      root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { st.view = b.dataset.view; draw(); }));
      Object.values(els).forEach((e) => e.addEventListener(e.tagName === 'INPUT' ? 'input' : 'change', FT.debounce(draw, 100)));
      draw();
      if (ctx.query.new) setTimeout(async () => { const r = await FT.filingModal(); FT.go('/app/filings', { replace: true }); if (r) FT.reload(); }, 30);
      if (ctx.query.open) setTimeout(async () => { const f = all.find((x) => x.id === ctx.query.open); if (f && (await FT.filingModal(f))) FT.reload(); }, 30);
    });
    const overdue = all.filter((f) => f.overdue).length;
    return html`<div class="page">
      ${head('Returns and filings', overdue ? FT.plural(overdue, 'filing') + ' past the due date. Drag cards across the board as work moves forward.' : 'Drag cards across the board as work moves from documents to filed.', html`${feat('bulk') ? html`<button class="btn" data-act="filing-bulk">${FT.icon('layers')}Bulk create</button>` : html`<button class="btn" data-act="upgrade-bulk" title="Part of Firm Pro">${FT.icon('lock')}Bulk create</button>`}<button class="btn btn-primary" data-act="filing-new">${FT.icon('plus')}Track a filing</button>`)}
      <div class="toolbar sheet" style="border-radius:var(--r-lg)">
        <div class="seg"><button data-view="board">${FT.icon('square-kanban')}Board</button><button data-view="list">${FT.icon('list')}List</button></div>
        <label class="search-field">${FT.icon('search')}<input class="input" id="fl-q" placeholder="Client, period or acknowledgement" aria-label="Search filings"></label>
        <select class="select input-sm" id="fl-type" style="width:auto" aria-label="Type"><option value="">All types</option>${C.FILING_TYPES.map((t) => html`<option value="${t.id}">${t.label}</option>`)}</select>
        <select class="select input-sm" id="fl-ty" style="width:auto" aria-label="Tax year"><option value="">All tax years</option>${FT.taxYears(4).map((y) => html`<option value="${y.value}">TY${y.value}</option>`)}</select>
        <select class="select input-sm" id="fl-who" style="width:auto" aria-label="Assigned to"><option value="">Everyone</option>${team.map((u) => html`<option value="${u.id}">${u.name}</option>`)}</select>
      </div>
      <div id="fl-body"></div>
    </div>`;
  });
  FT.act('upgrade-bulk', () => FT.toast('Bulk create is part of Firm Pro. It adds a return for every registered client in one step.', 'warn', { ms: 7000, action: isOwner() ? { label: 'See plans', fn: () => FT.go('/app/subscription') } : null }));
  FT.act('filing-bulk', async () => {
    const clients = (await FT.getClients(true)).filter((c) => !c.archived);
    const months = FT.monthOptions();
    const r = await FT.formModal({
      title: 'Bulk create monthly returns', sub: 'Adds one filing for each selected client. Clients who already have it are skipped.', size: 'lg', submitLabel: 'Create filings',
      fields: [
        { name: 'type', label: 'Return', type: 'select', options: [{ value: 'stx', label: 'Sales tax return (FBR)' }, { value: 'pst', label: 'Sales tax on services (provincial)' }, { value: 'wht', label: 'Withholding statement (s.165)' }], col: 6 },
        { name: 'authority', label: 'Authority', type: 'select', options: C.AUTHORITIES, col: 6, value: 'FBR' },
        { name: 'period', label: 'Month', type: 'select', options: months, col: 6, value: months[2].value },
        { name: 'dueDate', label: 'Due date', type: 'date', col: 6 },
        { type: 'html', html: html`<span class="label">Clients</span><div class="row wrap" style="gap:8px"><button type="button" class="btn btn-sm" data-pick="auto">Registered with this authority</button><button type="button" class="btn btn-sm btn-quiet" data-pick="all">All</button><button type="button" class="btn btn-sm btn-quiet" data-pick="none">None</button></div><div class="chipset" data-clients style="max-height:220px;overflow:auto;padding:2px">${clients.map((c) => html`<label><input type="checkbox" name="clientIds" value="${c.id}" data-multi data-regs="${(c.registrations || []).join(' ')}"><span>${c.name}</span></label>`)}</div>` },
      ],
      mount: (form) => {
        const auto = () => { const a = form.querySelector('[name=authority]').value; form.querySelectorAll('[name=clientIds]').forEach((x) => { x.checked = x.dataset.regs.split(' ').indexOf(a) >= 0 && (a !== 'FBR' || clients.find((c) => c.id === x.value).type !== 'individual'); }); };
        const due = () => { const m = form.querySelector('[name=period]').value; form.querySelector('[name=dueDate]').value = U.addMonths(m + '-01', 1).slice(0, 7) + (form.querySelector('[name=type]').value === 'wht' ? '-20' : '-18'); };
        form.querySelector('[name=type]').addEventListener('change', () => { const t = form.querySelector('[name=type]').value; const a = form.querySelector('[name=authority]'); a.value = t === 'pst' ? 'PRA' : 'FBR'; auto(); due(); });
        form.querySelector('[name=authority]').addEventListener('change', auto);
        form.querySelector('[name=period]').addEventListener('change', due);
        form.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.pick === 'auto') auto(); else form.querySelectorAll('[name=clientIds]').forEach((x) => { x.checked = b.dataset.pick === 'all'; }); }));
        auto(); due();
      },
      onSubmit: (v) => FT.api('filing.bulk', { type: v.type, authority: v.authority, period: v.period, taxYear: U.taxYearOf(v.period + '-01'), dueDate: v.dueDate, clientIds: v.clientIds }),
    });
    if (r) { FT.toast(FT.plural(r.created, 'filing') + ' created' + (r.skipped ? ', ' + r.skipped + ' skipped' : '')); FT.reload(); }
  });

  /* ========================================================== notices */
  function noticesTable(rows, noClient) {
    return FT.table({ rows, rowAct: 'notice-open', empty: FT.empty({ icon: 'gavel', title: 'No notices', text: 'Log every notice with its reply date and hearing so neither is missed.' }), rowClass: (n) => (n.overdue ? 'overdue' : n.status !== 'closed' && n.daysLeft != null && n.daysLeft <= 7 ? 'soon' : ''), cols: [
      { label: 'Notice', render: (n) => html`<div class="t-name">${n.sectionLabel}</div><div class="t-sub">${n.title || n.noticeNo || ''}${n.taxYear ? ', TY' + n.taxYear : ''}</div>` },
    ].concat(noClient ? [] : [{ label: 'Client', render: (n) => html`<a href="${'#/app/clients/' + n.clientId + '/notices'}">${n.clientName}</a>` }]).concat([
      { label: 'Reply due', render: (n) => (n.status === 'closed' || n.status === 'responded' ? html`<span class="muted small">${n.dueDate ? FT.date(n.dueDate) : ''}</span>` : FT.duePill(n.dueDate)) },
      { label: 'Hearing', render: (n) => (n.hearingDate ? html`<span class="nowrap small">${FT.date(n.hearingDate)}</span>` : html`<span class="muted">-</span>`) },
      { label: 'Amount', num: true, render: (n) => (n.amount ? FT.money(n.amount) : html`<span class="muted">-</span>`) },
      { label: 'Status', render: (n) => FT.statusPill('notice', n.status) },
      { label: 'Handled by', render: (n) => (n.assigneeName ? html`<span class="small">${n.assigneeName}</span>` : '') },
    ]) });
  }
  FT.act('notice-open', async (el) => { const ns = await FT.api('notices.list'); const n = ns.find((x) => x.id === el.dataset.id); if (n && (await FT.noticeModal(n))) FT.reload(); });
  FT.act('notice-new', async (el) => { if (await FT.noticeModal(null, el.dataset.client ? { clientId: el.dataset.client } : null)) FT.reload(); });
  R('/app/notices', async (ctx) => {
    const all = await FT.api('notices.list');
    ctx.title = 'Notices';
    const st = ctx.query.status || 'open';
    const rows = all.filter((n) => (st === 'open' ? n.status !== 'closed' : st === 'closed' ? n.status === 'closed' : true));
    ctx.mount(() => {
      if (ctx.query.new) setTimeout(async () => { const r = await FT.noticeModal(); FT.go('/app/notices', { replace: true }); if (r) FT.reload(); }, 30);
      if (ctx.query.open) setTimeout(async () => { const n = all.find((x) => x.id === ctx.query.open); if (n && (await FT.noticeModal(n))) FT.reload(); }, 30);
    });
    const urgent = all.filter((n) => (n.status === 'received' || n.status === 'in_progress') && n.daysLeft != null && n.daysLeft <= 7).length;
    return html`<div class="page">
      ${head('Notices', urgent ? FT.plural(urgent, 'reply', 'replies') + ' due within a week.' : 'Income Tax Ordinance, Sales Tax Act and provincial notices with their reply dates and hearings.', html`<button class="btn btn-primary" data-act="notice-new">${FT.icon('plus')}Log notice</button>`)}
      <div class="sheet"><div class="toolbar"><div class="seg">${[['open', 'Open'], ['closed', 'Closed'], ['all', 'All']].map((t) => html`<a class="${st === t[0] ? 'active' : ''}" href="${'#/app/notices?status=' + t[0]}">${t[1]} <span class="count soft">${all.filter((n) => (t[0] === 'open' ? n.status !== 'closed' : t[0] === 'closed' ? n.status === 'closed' : true)).length}</span></a>`)}</div><span class="right small muted">Amount involved in open notices: <b class="num">${FT.money(U.sum(all.filter((n) => n.status !== 'closed'), (n) => n.amount))}</b></span></div>${noticesTable(rows)}</div>
    </div>`;
  });

  /* ============================================================ tasks */
  function taskRow(t) {
    return html`<div class="li ${t.overdue ? 'overdue' : ''}"><button class="icon-btn" data-act="task-toggle" data-id="${t.id}" aria-label="${t.status === 'done' ? 'Mark not done' : 'Mark done'}" style="width:32px;height:32px;color:${t.status === 'done' ? 'var(--ledger)' : 'inherit'}">${FT.icon(t.status === 'done' ? 'square-check' : 'square')}</button>
      <div class="li-main clickable" data-act="task-open" data-id="${t.id}"><div class="li-title" style="white-space:normal;${t.status === 'done' ? 'text-decoration:line-through;color:var(--muted)' : ''}">${t.title}</div><div class="li-sub">${t.clientName ? t.clientName + '. ' : ''}${t.status === 'doing' ? 'In progress. ' : ''}${t.notes ? t.notes.slice(0, 80) : ''}</div></div>
      <div class="row" style="gap:8px">${t.priority === 'urgent' || t.priority === 'high' ? FT.statusPill('priority', t.priority) : ''}${t.status === 'done' ? html`<span class="xs muted">${t.doneAt ? FT.ago(t.doneAt) : ''}</span>` : FT.duePill(t.dueDate)}${t.assigneeName ? FT.avatar(t.assigneeName, 'sm', { round: true }) : ''}</div></div>`;
  }
  FT.act('task-toggle', async (el) => { await FT.api('task.toggle', { id: el.dataset.id }); FT.reload(); });
  FT.act('task-open', async (el) => { const ts = await FT.api('tasks.list'); const t = ts.find((x) => x.id === el.dataset.id); if (t && (await FT.taskModal(t))) FT.reload(); });
  FT.act('task-new', async (el) => { if (await FT.taskModal(null, el.dataset.client ? { clientId: el.dataset.client } : null)) FT.reload(); });
  R('/app/tasks', async (ctx) => {
    const all = await FT.api('tasks.list');
    ctx.title = 'Tasks';
    const who = ctx.query.who || 'me';
    const me = FT.state.me.user.id;
    const mine = all.filter((t) => who === 'all' || t.assignedTo === me);
    const td = FT.today();
    const groups = [
      ['Overdue', mine.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate < td)],
      ['Today', mine.filter((t) => t.status !== 'done' && t.dueDate === td)],
      ['Coming up', mine.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate > td)],
      ['No due date', mine.filter((t) => t.status !== 'done' && !t.dueDate)],
      ['Done', mine.filter((t) => t.status === 'done').slice(0, 15)],
    ];
    ctx.mount(() => { if (ctx.query.new) setTimeout(async () => { const r = await FT.taskModal(); FT.go('/app/tasks', { replace: true }); if (r) FT.reload(); }, 30); });
    return html`<div class="page">
      ${head('Tasks', 'Follow-ups, reconciliations and anything else your team needs to remember.', html`<button class="btn btn-primary" data-act="task-new">${FT.icon('plus')}Add task</button>`)}
      <div class="row"><div class="seg"><a class="${who === 'me' ? 'active' : ''}" href="#/app/tasks?who=me">Mine</a><a class="${who === 'all' ? 'active' : ''}" href="#/app/tasks?who=all">Everyone</a></div></div>
      ${groups.filter((g) => g[1].length).map((g) => html`<div class="sheet"><div class="sheet-head"><h2>${g[0]}</h2><span class="count ${g[0] === 'Overdue' ? '' : 'soft'}">${g[1].length}</span></div><div class="list">${g[1].map(taskRow)}</div></div>`)}
      ${mine.length ? '' : html`<div class="sheet">${FT.empty({ icon: 'list-checks', title: 'No tasks yet', text: 'Add a task, or assign one to a teammate.', action: html`<button class="btn btn-primary" data-act="task-new">${FT.icon('plus')}Add task</button>` })}</div>`}
    </div>`;
  });

  /* ========================================================= calendar */
  R('/app/calendar', async (ctx) => {
    const m = /^\d{4}-\d{2}$/.test(ctx.query.m || '') ? ctx.query.m : FT.today().slice(0, 7);
    const first = m + '-01';
    const y = +m.slice(0, 4), mo = +m.slice(5, 7);
    const startDow = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7; // Monday first
    const gridStart = U.addDays(first, -startDow);
    const days = []; for (let i = 0; i < 42; i++) days.push(U.addDays(gridStart, i));
    const events = await FT.api('calendar', { from: days[0], to: days[41] });
    ctx.title = 'Calendar';
    const by = {}; for (const e of events) (by[e.date] = by[e.date] || []).push(e);
    const sel = ctx.query.d || (FT.today().slice(0, 7) === m ? FT.today() : first);
    const linkFor = (e) => (e.kind === 'filing' ? '/app/filings?open=' + e.id : e.kind === 'notice' || e.kind === 'hearing' ? '/app/notices?open=' + e.id : e.kind === 'task' ? '/app/tasks?who=all' : e.kind === 'invoice' ? '/app/invoices/' + e.id : '');
    const dayList = (ds) => { const list = by[ds] || []; return list.length ? html`<div class="list">${list.map((e) => { const l = linkFor(e); return html`<${raw(l ? 'a' : 'div')} class="li ${e.kind === 'event' ? 'clickable' : ''}" ${l ? raw('href="#' + l + '"') : e.kind === 'event' ? raw('data-act="event-edit" data-id="' + e.id + '"') : ''}><span class="li-icon ${({ deadline: 'green', notice: 'red', hearing: 'red', task: 'amber', event: 'violet' })[e.kind] || ''}">${FT.icon(KIND[e.kind] ? KIND[e.kind][0] : 'calendar')}</span><div class="li-main"><div class="li-title" style="white-space:normal;${e.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${e.title}</div><div class="li-sub">${e.sub || ''}</div></div>${e.featured ? FT.pill('Featured', 'violet') : ''}</${raw(l ? 'a' : 'div')}>`; })}</div>` : html`<div class="sheet-body muted small">Nothing on this day.</div>`; };
    const prev = U.addMonths(first, -1).slice(0, 7), next = U.addMonths(first, 1).slice(0, 7);
    return html`<div class="page">
      ${head(U.monthLabel(m).replace(/^(\w+)/, (x) => ({ Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' })[x]), 'FBR and provincial deadlines, your clients\' returns, notices, hearings, tasks and invoices.', html`<div class="seg"><a href="${'#/app/calendar?m=' + prev}" aria-label="Previous month">${FT.icon('chevron-left')}</a><a href="#/app/calendar">Today</a><a href="${'#/app/calendar?m=' + next}" aria-label="Next month">${FT.icon('chevron-right')}</a></div><button class="btn btn-primary" data-act="event-edit" data-date="${sel}">${FT.icon('plus')}Add event</button>`)}
      <div class="legend">${[['deadline', 'Tax deadline', 'var(--ledger)'], ['filing', 'Client return', 'var(--ink-2)'], ['notice', 'Notice or hearing', 'var(--margin)'], ['task', 'Task', 'var(--amber)'], ['event', 'Your events', 'var(--stamp)']].map((l) => html`<span><i style="background:${l[2]}"></i>${l[1]}</span>`)}</div>
      <div class="grid cols-main" style="align-items:start">
        <div class="sheet" style="overflow:hidden"><div class="cal">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => html`<div class="cal-dow">${d}</div>`)}${days.map((ds) => { const list = by[ds] || []; return html`<a class="cal-day ${ds.slice(0, 7) !== m ? 'other' : ''} ${ds === FT.today() ? 'today' : ''} ${ds === sel ? 'sel' : ''}" href="${'#/app/calendar?m=' + m + '&d=' + ds + '&keep=1'}" style="text-decoration:none;color:inherit" aria-label="${FT.date(ds) + ', ' + FT.plural(list.length, 'item')}"><span class="dn">${+ds.slice(8, 10)}</span>${list.slice(0, 3).map((e) => html`<span class="cal-ev ${'k-' + e.kind} ${e.featured ? 'featured' : ''} ${e.done ? 'done' : ''}" title="${e.title}">${e.title}</span>`)}${list.length > 3 ? html`<span class="cal-more">+${list.length - 3} more</span>` : ''}</a>`; })}</div></div>
        <div class="sheet"><div class="sheet-head"><h2>${FT.date(sel)}</h2><span class="count soft">${(by[sel] || []).length}</span></div>${dayList(sel)}</div>
      </div>
    </div>`;
  });
  FT.act('event-edit', async (el) => {
    const events = el.dataset.id ? (await FT.api('calendar', {})).filter((e) => e.kind === 'event') : [];
    const ev = events.find((x) => x.id === el.dataset.id);
    const clients = await FT.getClients();
    const r = await FT.formModal({ title: ev ? 'Edit event' : 'Add an event', submitLabel: 'Save event', fields: [{ name: 'title', label: 'Title', required: true }, { name: 'date', label: 'Date', type: 'date', required: true, col: 6, value: el.dataset.date || FT.today() }, { name: 'time', label: 'Time', type: 'time', col: 6 }, { name: 'clientId', label: 'Client', type: 'select', options: [{ value: '', label: 'No client' }].concat(FT.clientOptions(clients)) }, { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 }], values: ev || {},
      footLeft: ev ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (f, m, close) => { const d = m.querySelector('[data-del]'); if (d) d.addEventListener('click', async () => { await FT.api('event.delete', { id: ev.id }); close(); FT.toast('Event deleted'); FT.reload(); }); },
      onSubmit: (v) => FT.api('event.save', Object.assign(v, ev ? { id: ev.id } : {})) });
    if (r) { FT.toast('Event saved'); FT.reload(); }
  });
})();
