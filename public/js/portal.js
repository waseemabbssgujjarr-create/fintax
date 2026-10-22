/*! FinTax client portal: phone-first. */
(function () {
  'use strict';
  const FT = window.FT;
  const { html, raw, U, C } = FT;
  const R = (path, view, o) => FT.route(path, view, Object.assign({ layout: 'portal', role: 'client' }, o || {}));
  const head = (title, lede, actions) => html`<div class="page-head"><div class="grow"><h1>${title}</h1>${lede ? html`<p class="lede">${lede}</p>` : ''}</div>${actions ? html`<div class="actions">${actions}</div>` : ''}</div>`;
  const firm = () => (FT.state.me && FT.state.me.firmContact) || {};

  // Stages described the way a client thinks about them.
  const STEPS = [['Documents', ['not_started', 'awaiting_docs']], ['Preparation', ['in_progress', 'review']], ['Your approval', ['client_approval', 'ready']], ['Filed', ['filed']]];
  const clientStage = (s) => ({ not_started: 'Getting started', awaiting_docs: 'We need some documents', in_progress: 'Being prepared', review: 'Final checks by your consultant', client_approval: 'Waiting for your approval', ready: 'Approved, ready to file', filed: 'Filed' })[s] || C.stageLabel(s);
  const stepIndex = (s) => STEPS.findIndex((x) => x[1].indexOf(s) >= 0);
  const stepper = (f) => { const i = stepIndex(f.stage); return html`<div><div class="stepper" aria-label="Progress: ${clientStage(f.stage)}">${STEPS.map((s, k) => html`<span class="st ${k < i || f.stage === 'filed' ? 'done' : k === i ? 'now' : ''}"></span>`)}</div><div class="row between xs muted" style="margin-top:6px">${STEPS.map((s, k) => html`<span style="${k === i ? 'color:var(--ink);font-weight:600' : ''}">${s[0]}</span>`)}</div></div>`; };
  const filingCard = (f) => html`<div class="sheet"><div class="sheet-body stack">
      <div class="row top"><span class="li-icon ${f.stage === 'filed' ? 'green' : f.stage === 'client_approval' ? 'violet' : ''}">${FT.icon(f.stage === 'filed' ? 'badge-check' : 'file-text')}</span><div class="grow"><b>${f.typeLabel}</b><div class="small muted">${f.periodLabel}${f.authority !== 'FBR' ? ', ' + f.authority : ''}</div></div>${f.stage === 'filed' ? html`<span class="stamp green">Filed</span>` : FT.duePill(f.dueDate)}</div>
      ${stepper(f)}
      <div class="small ink2"><b>${clientStage(f.stage)}.</b> ${f.stage === 'filed' ? (f.ackNumber ? 'Acknowledgement number ' + f.ackNumber + '.' : '') + (f.filedAt ? ' Filed on ' + FT.date(FT.isoDay(f.filedAt)) + '.' : '') : f.stage === 'awaiting_docs' ? 'Check your document requests and upload what is missing.' : ''}${f.refund ? ' Refund claimed: ' + FT.money(f.refund) + '.' : f.taxPayable ? ' Tax payable: ' + FT.money(f.taxPayable) + '.' : ''}</div>
      ${f.clientDecision && f.clientDecision.status === 'changes' && f.stage !== 'filed' ? html`<div class="callout warn">${FT.icon('message-square-text')}<span>You asked for changes: ${f.clientDecision.note}</span></div>` : ''}
      ${f.stage === 'client_approval' ? html`<div class="row wrap"><button class="btn btn-stamp" data-act="pf-review" data-id="${f.id}" data-doc="${f.approvalDocId || ''}">${FT.icon('stamp')}Review and approve</button>${f.approvalNote ? html`<span class="small muted">${f.approvalNote}</span>` : ''}</div>` : ''}
    </div></div>`;
  FT.act('pf-review', async (el) => {
    if (el.dataset.doc) return FT.openDoc(el.dataset.doc, { onChange: () => FT.reload() });
    const r = await FT.formModal({ title: 'Approve your return', sub: 'Approve if the figures your consultant shared are correct, or ask for changes.', submitLabel: 'Send my decision', fields: [{ name: 'decision', label: 'Your decision', type: 'radio', options: [{ value: 'approved', label: 'Approve' }, { value: 'changes', label: 'Request changes' }], value: 'approved' }, { name: 'note', label: 'Comments for your consultant', type: 'textarea', rows: 3, hint: 'Needed if you request changes.' }], onSubmit: (v) => FT.api('filing.decide', { id: el.dataset.id, decision: v.decision, note: v.note }) });
    if (r) { FT.toast(r.stage === 'ready' ? 'Approved. Your consultant can file now.' : 'Sent to your consultant.'); FT.reload(); }
  });

  /* --------------------------------------------------------------- home */
  R('/portal', async (ctx) => {
    const h = await FT.api('portal.home');
    const me = FT.state.me;
    const f = firm();
    ctx.title = 'Home';
    const a = h.actions;
    const nActions = a.requests.length + a.approvals.length + a.filingApprovals.filter((x) => !a.approvals.some((d) => d.id === x.approvalDocId)).length + a.unpaid.length;
    return html`<div class="page">
      <div class="page-head"><div class="grow"><p class="small muted">${FT.greeting()}</p><h1>Assalam o Alaikum, ${me.user.name}</h1><p class="lede">${nActions ? FT.plural(nActions, 'thing needs', 'things need') + ' your attention. ' + f.name + ' takes it from there.' : 'You are all caught up. ' + f.name + ' will let you know when anything is needed.'}</p></div></div>
      ${h.announcements.map((x) => html`<div class="callout violet">${FT.icon('megaphone')}<span><b>${x.title}.</b> ${x.body}</span></div>`)}
      ${nActions ? html`<div class="stack">
        ${a.approvals.map((d) => html`<div class="sheet" style="border-color:color-mix(in srgb, var(--stamp) 30%, var(--rule))"><div class="sheet-body row wrap"><span class="li-icon violet">${FT.icon('stamp')}</span><div class="grow" style="min-width:180px"><b>Approve: ${d.name}</b><div class="small muted">${d.approval && d.approval.note ? d.approval.note : 'Review it and approve, or tell us what to change.'}</div></div><button class="btn btn-stamp" data-act="open-doc" data-id="${d.id}">Review</button></div></div>`)}
        ${a.filingApprovals.filter((x) => !a.approvals.some((d) => d.id === x.approvalDocId)).map((x) => html`<div class="sheet"><div class="sheet-body row wrap"><span class="li-icon violet">${FT.icon('file-check')}</span><div class="grow" style="min-width:180px"><b>Approve your ${x.typeLabel.toLowerCase()}</b><div class="small muted">${x.periodLabel}</div></div><button class="btn btn-stamp" data-act="pf-review" data-id="${x.id}" data-doc="">Review</button></div></div>`)}
        ${a.requests.length ? html`<div class="sheet"><div class="sheet-head"><h2>Documents we need from you</h2><span class="count">${a.requests.length}</span></div><div class="list">${a.requests.map((r) => html`<div class="li"><span class="li-icon amber">${FT.icon('clipboard-list')}</span><div class="li-main"><div class="li-title" style="white-space:normal">${r.title}</div><div class="li-sub">${r.dueDate ? FT.dueInfo(r.dueDate).text : 'Whenever you can'}${r.note ? '. ' + r.note : ''}</div></div><button class="btn btn-sm btn-primary" data-act="p-upload" data-id="${r.id}" data-title="${r.title}">${FT.icon('upload')}Upload</button></div>`)}</div></div>` : ''}
        ${a.unpaid.map((i) => html`<div class="sheet"><div class="sheet-body row wrap"><span class="li-icon ${i.status === 'overdue' ? 'red' : 'green'}">${FT.icon('receipt')}</span><div class="grow" style="min-width:180px"><b>Invoice ${i.number}: ${FT.money(i.balance)}</b><div class="small muted">${i.status === 'overdue' ? 'Overdue since ' + FT.date(i.dueDate) : 'Due ' + FT.date(i.dueDate)}${i.pending ? '. Your payment is being confirmed.' : ''}</div></div><button class="btn btn-sm" data-act="p-inv" data-id="${i.id}">View and pay</button></div></div>`)}
      </div>` : html`<div class="sheet">${FT.empty({ icon: 'circle-check', title: 'Nothing needs you right now', text: 'We will notify you here when your consultant needs a document or your approval.' })}</div>`}
      <div class="grid cols-main" style="align-items:start">
        <div class="stack">
          <h2 style="font-size:var(--fs-lg);font-weight:750">Your returns</h2>
          ${h.filings.length ? h.filings.map(filingCard) : html`<div class="sheet">${FT.empty({ icon: 'file-check', title: 'No returns in progress', text: 'Your consultant adds returns here as they start work on them.' })}</div>`}
        </div>
        <div class="stack">
          <div class="sheet"><div class="sheet-head"><h2>Your consultant</h2></div><div class="sheet-body stack">
            <div class="row">${f.logo ? html`<img src="${f.logo}" alt="" style="height:36px;width:auto;max-width:120px;object-fit:contain">` : FT.avatar(f.name)}<div><b>${f.name}</b><div class="small muted">${f.ownerName}${f.city ? ', ' + f.city : ''}</div></div></div>
            <div class="stack tight small">${f.phone ? html`<span class="row">${FT.icon('phone')}${FT.copyable(f.phone)}</span>` : ''}${f.email ? html`<span class="row">${FT.icon('mail')}${FT.copyable(f.email)}</span>` : ''}</div>
            <div class="row wrap"><a class="btn btn-primary btn-sm" href="#/portal/messages">${FT.icon('message-square')}Message</a>${FT.waBtn(f.phone, 'Assalam o Alaikum, this is ' + me.user.name + '.', 'WhatsApp')}<button class="btn btn-sm" data-act="p-upload">${FT.icon('upload')}Upload</button></div>
          </div></div>
          <div class="sheet"><div class="sheet-head"><h2>Recent documents</h2><a class="btn btn-sm btn-quiet right" href="#/portal/documents">All</a></div><div class="list">${h.recentDocs.length ? h.recentDocs.map((d) => html`<div class="li clickable" data-act="open-doc" data-id="${d.id}">${FT.fileIcon(d.name, d.mime, true)}<div class="li-main"><div class="li-title">${d.name}</div><div class="li-sub">${d.uploaderRole === 'client' ? 'Uploaded by you' : 'From ' + f.name}, ${FT.ago(d.createdAt)}</div></div>${d.approval ? FT.approvalPill(d.approval) : ''}</div>`) : html`<div class="sheet-body small muted">No documents yet.</div>`}</div></div>
          ${h.notices.length ? html`<div class="sheet"><div class="sheet-head"><h2>Notices we are handling</h2></div><div class="list">${h.notices.map((n) => html`<a class="li" href="#/portal/notices">${FT.dateTile(n.dueDate, n.daysLeft != null && n.daysLeft <= 7 ? 'red' : '')}<div class="li-main"><div class="li-title">${n.sectionLabel}</div><div class="li-sub">${n.statusLabel}</div></div></a>`)}</div></div>` : ''}
          ${FT.pwa.standalone() ? '' : html`<div class="sheet tinted"><div class="sheet-body row">${FT.icon('smartphone')}<span class="small grow">Add ${FT.brandName()} to your home screen to upload documents in seconds.</span>${FT.installBtn('btn-sm', 'Install')}</div></div>`}
        </div>
      </div>
    </div>`;
  });
  FT.act('p-upload', async (el) => { const r = await FT.portalUpload({ requestId: el.dataset.id, title: el.dataset.title }); if (r) FT.reload(); });

  /* --------------------------------------------------------- documents */
  R('/portal/documents', async (ctx) => {
    const d = await FT.api('portal.docs');
    ctx.title = 'Documents';
    const open = d.requests.filter((r) => r.status === 'open');
    const tab = ctx.query.tab || (open.length ? 'requests' : 'shared');
    const shared = d.docs.filter((x) => x.uploaderRole === 'firm');
    const mine = d.docs.filter((x) => x.uploaderRole === 'client');
    ctx.mount(() => { if (ctx.query.open) setTimeout(() => FT.openDoc(ctx.query.open, { onChange: () => FT.reload() }), 30); });
    const docRow = (x) => html`<div class="li clickable" data-act="open-doc" data-id="${x.id}">${FT.fileIcon(x.name, x.mime, true)}<div class="li-main"><div class="li-title">${x.name}</div><div class="li-sub">${x.category}${x.taxYear ? ', TY' + x.taxYear : ''}, ${FT.ago(x.createdAt)}${x.commentCount ? ', ' + FT.plural(x.commentCount, 'comment') : ''}</div></div>${x.approval ? FT.approvalPill(x.approval) : x.uploaderRole === 'firm' && !x.seenByClient ? FT.pill('New', 'green') : ''}</div>`;
    let body;
    if (tab === 'requests') body = html`<div class="list">${d.requests.length ? d.requests.map((r) => html`<div class="li">${r.status === 'open' ? html`<span class="li-icon amber">${FT.icon('clipboard-list')}</span>` : html`<span class="li-icon green">${FT.icon('check')}</span>`}<div class="li-main"><div class="li-title" style="white-space:normal;${r.status !== 'open' ? 'color:var(--muted)' : ''}">${r.title}</div><div class="li-sub">${r.status === 'open' ? (r.dueDate ? FT.dueInfo(r.dueDate).text : 'Requested ' + FT.ago(r.createdAt)) : 'Uploaded ' + FT.ago(r.fulfilledAt)}${r.note ? '. ' + r.note : ''}</div></div>${r.status === 'open' ? html`<button class="btn btn-sm btn-primary" data-act="p-upload" data-id="${r.id}" data-title="${r.title}">${FT.icon('upload')}Upload</button>` : ''}</div>`) : FT.empty({ icon: 'clipboard-list', title: 'No requests', text: 'When your consultant needs a document, it appears here.' })}</div>`;
    else if (tab === 'shared') body = html`<div class="list">${shared.length ? shared.map(docRow) : FT.empty({ icon: 'folder-open', title: 'Nothing shared yet', text: 'Returns, statements and acknowledgements from your consultant appear here.' })}</div>`;
    else body = html`<div class="list">${mine.length ? mine.map(docRow) : FT.empty({ icon: 'upload', title: 'You have not uploaded anything', text: 'Take a photo of a document or choose a PDF to send it to your consultant.', action: html`<button class="btn btn-primary" data-act="p-upload">${FT.icon('upload')}Upload</button>` })}</div>`;
    return html`<div class="page">
      ${head('Documents', 'Everything you and ' + firm().name + ' have shared, in one safe place.', html`<button class="btn btn-primary" data-act="p-upload">${FT.icon('upload')}Upload documents</button>`)}
      <div class="sheet"><div class="toolbar"><div class="seg">${[['requests', 'Requested', open.length], ['shared', 'From your consultant', shared.length], ['mine', 'Your uploads', mine.length]].map((t) => html`<a class="${tab === t[0] ? 'active' : ''}" href="${'#/portal/documents?tab=' + t[0]}">${t[1]} ${t[2] ? html`<span class="count ${t[0] === 'requests' ? '' : 'soft'}">${t[2]}</span>` : ''}</a>`)}</div></div>${body}</div>
    </div>`;
  });

  /* ------------------------------------------------------------ filings */
  R('/portal/filings', async (ctx) => {
    const list = await FT.api('portal.filings');
    ctx.title = 'Returns';
    const open = list.filter((f) => f.stage !== 'filed');
    const done = list.filter((f) => f.stage === 'filed');
    return html`<div class="page">
      ${head('Your returns', 'Track each return and statement from documents to filed.')}
      ${open.length ? html`<div class="grid cols-2" style="align-items:start">${open.map(filingCard)}</div>` : html`<div class="sheet">${FT.empty({ icon: 'file-check', title: 'Nothing in progress', text: 'Your consultant adds returns here when they start working on them.' })}</div>`}
      ${done.length ? html`<h2 style="font-size:var(--fs-lg);font-weight:750">Filed</h2><div class="sheet"><div class="list">${done.map((f) => html`<div class="li"><span class="li-icon green">${FT.icon('badge-check')}</span><div class="li-main"><div class="li-title">${f.typeLabel}, ${f.periodLabel}</div><div class="li-sub">${f.ackNumber ? 'Acknowledgement ' + f.ackNumber + ', ' : ''}${f.filedAt ? 'filed ' + FT.date(FT.isoDay(f.filedAt)) : ''}</div></div><span class="stamp green">Filed</span></div>`)}</div></div>` : ''}
    </div>`;
  });

  /* ----------------------------------------------------------- invoices */
  async function invoiceModal(id) {
    const d = await FT.api('portal.invoices');
    const inv = d.invoices.find((x) => x.id === id);
    if (!inv) return;
    const f = Object.assign({}, d.firm, { bank: d.bank });
    const open = ['sent', 'partial', 'overdue'].indexOf(inv.status) >= 0;
    FT.modal({
      size: 'lg', title: 'Invoice ' + inv.number, sub: f.name,
      body: html`<div class="stack">${FT.invoiceDoc(inv, null, f, { logo: f.logo })}${inv.payments.length ? html`<div class="sheet"><div class="sheet-head"><h3>Your payments</h3></div><div class="list">${inv.payments.map((p) => html`<div class="li"><span class="li-icon ${p.status === 'confirmed' ? 'green' : p.status === 'pending' ? 'amber' : 'red'}">${FT.icon('wallet')}</span><div class="li-main"><div class="li-title">${FT.money(p.amount)}</div><div class="li-sub">${FT.date(p.date)}, ${p.method}${p.reference ? ', ' + p.reference : ''}${p.status === 'rejected' && p.note ? '. ' + p.note : ''}</div></div>${FT.statusPill('payment', p.status === 'pending' ? 'pending' : p.status)}</div>`)}</div></div>` : ''}</div>`,
      foot: html`<div class="right">${FT.preview ? '' : html`<button class="btn" data-print-inv>${FT.icon('printer')}Print</button>`}<button class="btn" data-dl-inv>${FT.icon('download')}Download</button>${open ? html`<button class="btn btn-primary" data-paid>${FT.icon('wallet')}I have paid</button>` : ''}</div>`,
      mount: (el, close) => {
        const p = el.querySelector('[data-paid]');
        if (p) p.addEventListener('click', async () => { close(); await payModal(inv); });
        const dl = el.querySelector('[data-dl-inv]'); if (dl) dl.addEventListener('click', () => FT.files.save(inv.number + '.html', FT.invoiceHtmlFile(inv, null, f), 'text/html'));
        const pr = el.querySelector('[data-print-inv]'); if (pr) pr.addEventListener('click', () => window.print());
      },
    });
  }
  async function payModal(inv) {
    const r = await FT.formModal({
      title: 'Tell us about your payment', sub: 'Invoice ' + inv.number + ', ' + FT.money(inv.balance) + ' due. Your consultant confirms it once received.', submitLabel: 'Submit payment', submitIcon: 'send',
      fields: [{ name: 'amount', label: 'Amount paid', type: 'money', required: true, col: 6, value: inv.balance }, { name: 'date', label: 'Paid on', type: 'date', col: 6, value: FT.today() }, { name: 'method', label: 'How did you pay?', type: 'select', options: C.PAY_METHODS.filter((m) => m !== 'Cheque'), col: 6 }, { name: 'reference', label: 'Transaction ID', required: true, col: 6, placeholder: 'From your bank or wallet receipt' }, { name: 'proof', type: 'file', label: 'Receipt screenshot (optional)', accept: 'image/*,application/pdf', cta: 'Attach a receipt' }, { name: 'note', label: 'Note', type: 'textarea', rows: 2 }],
      onSubmit: async (v) => {
        const f = (v._files.proof || [])[0];
        let up = null;
        if (f) up = await FT.files.upload(f);
        return FT.api('portal.pay', { invoiceId: inv.id, amount: v.amount, date: v.date, method: v.method, reference: v.reference, note: v.note, proofBlobId: up && up.blobId, proofName: f && f.name, proofMime: f && f.type });
      },
    });
    if (r) { FT.toast('Thank you. Your consultant will confirm the payment.'); FT.reload(); }
  }
  FT.act('p-inv', (el) => invoiceModal(el.dataset.id));
  R('/portal/invoices', async (ctx) => {
    const d = await FT.api('portal.invoices');
    ctx.title = 'Invoices';
    ctx.mount(() => { if (ctx.query.open) setTimeout(() => invoiceModal(ctx.query.open), 30); });
    const due = d.invoices.filter((i) => ['sent', 'partial', 'overdue'].indexOf(i.status) >= 0);
    return html`<div class="page">
      ${head('Invoices', due.length ? FT.money(U.sum(due, (i) => i.balance)) + ' due on ' + FT.plural(due.length, 'invoice') + '.' : 'You have no fees due.')}
      <div class="sheet"><div class="list">${d.invoices.length ? d.invoices.map((i) => html`<div class="li clickable" data-act="p-inv" data-id="${i.id}"><span class="li-icon ${i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : ''}">${FT.icon('receipt')}</span><div class="li-main"><div class="li-title">${i.number}</div><div class="li-sub">${(i.items[0] || {}).desc || ''}, issued ${FT.date(i.issueDate)}</div></div><div class="li-side"><b class="num" style="color:var(--ink)">${FT.money(i.status === 'paid' ? i.total : i.balance)}</b><div class="mt-1">${FT.statusPill('invoice', i.status)}</div></div></div>`) : FT.empty({ icon: 'receipt', title: 'No invoices yet' })}</div></div>
    </div>`;
  });

  /* ----------------------------------------------------------- messages */
  R('/portal/messages', async (ctx) => {
    const msgs = await FT.api('portal.messages');
    const f = firm();
    ctx.title = 'Messages';
    ctx.mount((root) => { FT.mountChat(root, 'portal'); FT.ping(); });
    return html`<div class="page">
      ${head('Messages', 'Questions, updates and reminders between you and ' + f.name + '.')}
      <div class="sheet" style="display:flex;flex-direction:column;min-height:60vh" data-chat="portal">
        <div class="chat-head">${FT.avatar(f.name, 'sm')}<div class="grow"><b class="small">${f.name}</b><div class="xs muted">Usually replies within a working day</div></div>${FT.waBtn(f.phone, 'Assalam o Alaikum, this is ' + FT.state.me.user.name + '.', 'WhatsApp')}</div>
        <div class="chat-msgs" style="flex:1">${msgs.length ? FT.msgList(msgs, 'client') : html`<div class="empty">${FT.icon('message-square')}<p>Send your first message. Your consultant is notified straight away.</p></div>`}</div>
        <form class="chat-compose"><textarea class="textarea" name="text" rows="1" placeholder="Write a message" aria-label="Message"></textarea><button class="btn btn-primary btn-icon" type="submit" aria-label="Send">${FT.icon('send')}</button></form>
      </div>
    </div>`;
  });

  /* ------------------------------------------------------------ notices */
  R('/portal/notices', async (ctx) => {
    const list = await FT.api('portal.notices');
    ctx.title = 'Notices';
    return html`<div class="page">
      ${head('Notices', 'Letters from tax authorities that ' + firm().name + ' is handling for you.')}
      <div class="callout">${FT.icon('info')}<span>If you receive a new notice by post, email or on IRIS, upload a photo of it so your consultant can respond in time.</span><button class="btn btn-sm right" data-act="p-upload">${FT.icon('upload')}Upload</button></div>
      <div class="sheet"><div class="list">${list.length ? list.map((n) => html`<div class="li">${FT.dateTile(n.dueDate, n.status !== 'closed' && n.daysLeft != null && n.daysLeft <= 7 ? 'red' : '')}<div class="li-main"><div class="li-title" style="white-space:normal">${n.sectionLabel}</div><div class="li-sub">${n.title || ''}${n.taxYear ? ', TY' + n.taxYear : ''}${n.hearingDate ? '. Hearing on ' + FT.date(n.hearingDate) : ''}</div></div>${FT.statusPill('notice', n.status)}</div>`) : FT.empty({ icon: 'gavel', title: 'No notices', text: 'Good news: there is nothing from the tax authorities on file for you.' })}</div></div>
    </div>`;
  });

  /* ------------------------------------------------------------ profile */
  R('/portal/profile', async (ctx) => {
    const h = await FT.api('portal.home');
    const c = h.client;
    ctx.title = 'My profile';
    return html`<div class="page">
      ${head('My profile', 'Keep your contact details up to date so your consultant can reach you.')}
      <div class="grid cols-main" style="align-items:start">
        <form class="sheet" data-submit="p-profile" id="p-profile"><div class="sheet-body"><div class="form">
          ${FT.fields([{ name: 'phone', label: 'Mobile (WhatsApp)', type: 'tel', col: 6 }, { name: 'city', label: 'City', col: 6 }, { name: 'address', label: 'Address', type: 'textarea', rows: 2 }], c)}
          <div class="form-error" hidden></div>
        </div></div><div class="sheet-foot"><button class="btn btn-primary" type="submit">Save details</button></div></form>
        <div class="stack">
          <div class="sheet"><div class="sheet-head"><h2>Your tax identity</h2></div><div class="sheet-body"><div class="dl"><div>Name</div><div>${c.name}</div>${c.cnic ? html`<div>CNIC</div><div>${c.cnic}</div>` : ''}${c.ntn ? html`<div>NTN</div><div>${c.ntn}</div>` : ''}<div>Active Taxpayers List</div><div>${c.atl === 'active' ? FT.pill('Active', 'green') : c.atl === 'inactive' ? FT.pill('Not on the list', 'red') : FT.pill('Being checked', '')}</div></div><p class="xs muted mt-2">Ask your consultant to correct anything here.</p></div></div>
          <div class="sheet"><div class="sheet-body stack"><b class="small">Sign-in</b><span class="small muted">${FT.state.me.user.email}</span><button class="btn btn-sm" data-act="p-password" style="align-self:flex-start">${FT.icon('key-round')}Change password</button></div></div>
        </div>
      </div>
    </div>`;
  });
  FT.onSubmit('p-profile', async (v) => { await FT.api('portal.profile.save', v); FT.toast('Details saved. Your consultant has been told.'); });
  FT.act('p-password', () => FT.profileModal());
})();
