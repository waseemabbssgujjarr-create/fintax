/*! FinTax consultant workspace, part 2: invoices, payments, expenses, messages, reports, team, subscription, settings, support. */
(function () {
  'use strict';
  const FT = window.FT;
  const { html, raw, U, C } = FT;
  const R = (path, view, o) => FT.route(path, view, Object.assign({ layout: 'app', role: 'firm' }, o || {}));
  const head = (title, lede, actions, crumbs) => html`<div class="page-head"><div class="grow">${crumbs ? html`<div class="crumbs">${crumbs}</div>` : ''}<h1>${title}</h1>${lede ? html`<p class="lede">${lede}</p>` : ''}</div>${actions ? html`<div class="actions">${actions}</div>` : ''}</div>`;
  const isOwner = () => FT.state.me && FT.state.me.user.role === 'consultant';
  const feat = (k) => !!(FT.state.me && FT.state.me.features && FT.state.me.features[k]);

  /* ========================================================= invoices */
  FT.invoicesTable = (rows, withClient) => FT.table({ rows, rowAct: 'inv-open', empty: FT.empty({ icon: 'receipt', title: 'No invoices yet', text: 'Bill your fees in PKR and let clients pay by bank transfer, Raast or JazzCash.' }), rowClass: (i) => (i.status === 'overdue' ? 'overdue' : ''), cols: [
    { label: 'Invoice', render: (i) => html`<div class="t-name">${i.number}</div><div class="t-sub">${(i.items[0] || {}).desc || ''}${i.items.length > 1 ? ' and ' + (i.items.length - 1) + ' more' : ''}</div>` },
  ].concat(withClient === false ? [] : [{ label: 'Client', render: (i) => html`<a href="${'#/app/clients/' + i.clientId + '/billing'}">${i.clientName}</a>` }]).concat([
    { label: 'Issued', render: (i) => html`<span class="nowrap">${FT.date(i.issueDate)}</span>` },
    { label: 'Due', render: (i) => (['sent', 'partial', 'overdue'].indexOf(i.status) >= 0 ? FT.duePill(i.dueDate) : html`<span class="muted small nowrap">${FT.date(i.dueDate)}</span>`) },
    { label: 'Total', num: true, render: (i) => html`<b>${FT.money(i.total)}</b>` },
    { label: 'Balance', num: true, render: (i) => (i.balance && i.status !== 'cancelled' && i.status !== 'draft' ? FT.money(i.balance) : html`<span class="muted">-</span>`) },
    { label: 'Status', render: (i) => html`${FT.statusPill('invoice', i.status)}${i.pending ? html`<div class="t-sub" style="color:var(--amber)">Payment to confirm</div>` : ''}` },
  ]) });
  FT.act('inv-open', (el) => FT.go('/app/invoices/' + el.dataset.id));
  const SERVICES = ['Income tax return filing', 'Wealth statement', 'Monthly tax retainer', 'Sales tax return filing', 'Withholding statement', 'Reply to tax notice', 'NTN registration', 'Sales tax registration', 'Bookkeeping', 'Tax advisory'];
  const itemRow = (it) => html`<tr><td><input class="input input-sm" data-desc value="${it.desc || ''}" placeholder="Service" aria-label="Description" style="min-width:200px"></td><td><input class="input input-sm" data-qty value="${it.qty == null ? 1 : it.qty}" inputmode="decimal" aria-label="Quantity" style="width:64px"></td><td><input class="input input-sm" data-rate value="${it.rate === '' || it.rate == null ? '' : it.rate}" inputmode="decimal" placeholder="0" aria-label="Rate in rupees" style="width:120px"></td><td class="num nowrap" data-amt>Rs 0</td><td class="actions"><button type="button" class="btn btn-sm btn-quiet btn-icon" data-rm-item aria-label="Remove line">${FT.icon('x')}</button></td></tr>`;
  FT.invoiceModal = async (inv, defaults) => {
    const clients = await FT.getClients();
    const firm = FT.state.me.firm;
    const v0 = inv || Object.assign({ issueDate: FT.today(), dueDate: U.addDays(FT.today(), firm.paymentTerms || 7), taxRate: firm.taxRate || 0, taxLabel: firm.taxLabel || '', discount: 0, items: [{ desc: '', qty: 1, rate: '' }], send: true }, defaults || {});
    if (defaults && defaults.clientId && !inv) { const c = clients.find((x) => x.id === defaults.clientId); if (c && c.feeAmount && !v0.items[0].desc) v0.items = [{ desc: c.feeBasis === 'monthly' ? 'Monthly tax retainer, ' + U.monthLabel(FT.today().slice(0, 7)) : 'Professional fee', qty: 1, rate: c.feeAmount }]; }
    const r = await FT.formModal({
      title: inv ? 'Edit ' + inv.number : 'New invoice', sub: inv ? inv.clientName : 'Numbered automatically. Clients see sent invoices in their portal.', size: 'lg', submitLabel: inv ? 'Save invoice' : 'Create invoice', submitIcon: 'receipt',
      fields: [
        { name: 'clientId', label: 'Client', type: 'select', required: true, placeholder: 'Choose a client', options: FT.clientOptions(clients) },
        { name: 'issueDate', label: 'Issue date', type: 'date', col: 6 }, { name: 'dueDate', label: 'Due date', type: 'date', col: 6 },
        { type: 'html', html: html`<span class="label">Lines</span><div class="table-wrap"><table class="tbl" data-items><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th class="num">Amount</th><th></th></tr></thead><tbody>${v0.items.map(itemRow)}</tbody></table></div><div class="row wrap" style="gap:6px"><button type="button" class="btn btn-sm btn-soft" data-add-item>${FT.icon('plus')}Add line</button>${SERVICES.slice(0, 6).map((s) => html`<button type="button" class="btn btn-sm btn-quiet" data-svc="${s}">${s}</button>`)}</div>` },
        { name: 'discount', label: 'Discount', type: 'money', col: 4 }, { name: 'taxRate', label: 'Sales tax on services (%)', type: 'number', col: 4 }, { name: 'taxLabel', label: 'Tax label', col: 4, placeholder: 'e.g. PST (PRA)' },
        { type: 'html', html: html`<div class="inv-total" data-totals style="align-items:flex-end"></div>` },
        { name: 'notes', label: 'Note on the invoice', type: 'textarea', rows: 2, placeholder: firm.invoiceNote || 'Thank you for your business.' },
      ].concat(inv ? [] : [{ name: 'send', label: 'Send to the client now', type: 'switch', hint: 'They are notified in the portal. Leave off to save a draft.' }]),
      values: v0,
      mount: (form) => {
        const tb = form.querySelector('[data-items] tbody');
        const calc = () => {
          let sub = 0;
          tb.querySelectorAll('tr').forEach((tr) => { const q = +String(tr.querySelector('[data-qty]').value).replace(/[^\d.]/g, '') || 0, rt = +String(tr.querySelector('[data-rate]').value).replace(/[^\d.]/g, '') || 0; tr.querySelector('[data-amt]').textContent = FT.money(q * rt); sub += q * rt; });
          const disc = Math.min(sub, +String(form.querySelector('[name=discount]').value).replace(/[^\d.]/g, '') || 0);
          const rate = +form.querySelector('[name=taxRate]').value || 0;
          const tax = (sub - disc) * rate / 100;
          form.querySelector('[data-totals]').innerHTML = String(html`<div><span>Subtotal</span><span>${FT.money(sub)}</span></div>${disc ? html`<div><span>Discount</span><span>-${FT.money(disc)}</span></div>` : ''}${rate ? html`<div><span>${form.querySelector('[name=taxLabel]').value || 'Tax'} at ${rate}%</span><span>${FT.money(tax)}</span></div>` : ''}<div class="grand"><span>Total</span><span>${FT.money(sub - disc + tax)}</span></div>`);
        };
        form.addEventListener('input', calc);
        form.querySelector('[data-add-item]').addEventListener('click', () => { tb.insertAdjacentHTML('beforeend', String(itemRow({ qty: 1 }))); tb.lastElementChild.querySelector('[data-desc]').focus(); });
        form.querySelectorAll('[data-svc]').forEach((b) => b.addEventListener('click', () => { const empty = Array.from(tb.querySelectorAll('[data-desc]')).find((i) => !i.value.trim()); if (empty) empty.value = b.dataset.svc; else tb.insertAdjacentHTML('beforeend', String(itemRow({ desc: b.dataset.svc, qty: 1 }))); calc(); }));
        tb.addEventListener('click', (e) => { const x = e.target.closest('[data-rm-item]'); if (x && tb.children.length > 1) { x.closest('tr').remove(); calc(); } });
        calc();
      },
      onSubmit: (v, form) => {
        v.items = Array.from(form.querySelectorAll('[data-items] tbody tr')).map((tr) => ({ desc: tr.querySelector('[data-desc]').value.trim(), qty: +String(tr.querySelector('[data-qty]').value).replace(/[^\d.]/g, '') || 0, rate: +String(tr.querySelector('[data-rate]').value).replace(/[^\d.]/g, '') || 0 })).filter((x) => x.desc);
        return FT.api('invoice.save', Object.assign(v, inv ? { id: inv.id } : {}));
      },
    });
    if (r) FT.toast(inv ? 'Invoice saved' : r.number + (r.status === 'draft' ? ' saved as draft' : ' created and sent'));
    return r;
  };
  FT.invoiceDoc = (inv, client, firm, o) => {
    o = o || {};
    const bank = firm.bank || {};
    const hasBank = bank.bankName || bank.iban || bank.accountNumber || bank.raast || bank.jazzcash || bank.easypaisa;
    return html`<div class="invoice" id="invoice-doc">
      <div class="inv-head">
        <div class="stack tight">${o.logo ? html`<img src="${o.logo}" alt="${firm.name}" style="height:44px;width:auto;max-width:200px;object-fit:contain;align-self:flex-start">` : html`<b class="wide" style="font-size:1.25rem;font-weight:800">${firm.name}</b>`}<span class="small muted">${firm.address || ''}</span><span class="small muted">${[firm.phone, firm.email].filter(Boolean).join(', ')}</span>${firm.ntn ? html`<span class="small muted">NTN ${firm.ntn}</span>` : ''}</div>
        <div class="stack tight" style="align-items:flex-end;text-align:right"><h2>Invoice</h2><div class="inv-meta"><span>Number</span><b>${inv.number}</b><span>Issued</span><span>${FT.date(inv.issueDate)}</span><span>Due</span><span>${FT.date(inv.dueDate)}</span></div>${inv.status === 'paid' ? html`<span class="stamp lg green" style="margin-top:6px">Paid</span>` : inv.status === 'cancelled' ? html`<span class="stamp lg red" style="margin-top:6px">Cancelled</span>` : ''}</div>
      </div>
      <div class="stack tight"><span class="xs muted">Billed to</span><b>${client ? client.name : inv.clientName}</b>${client && client.address ? html`<span class="small">${client.address}</span>` : ''}${client && (client.ntn || client.cnic) ? html`<span class="small muted">${client.ntn ? 'NTN ' + client.ntn : 'CNIC ' + client.cnic}</span>` : ''}</div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th></tr></thead><tbody>${inv.items.map((it) => html`<tr><td>${it.desc}</td><td class="num">${it.qty}</td><td class="num">${FT.money(it.rate)}</td><td class="num">${FT.money(it.qty * it.rate)}</td></tr>`)}</tbody></table></div>
      <div class="inv-total">
        <div><span>Subtotal</span><span>${FT.money(inv.subtotal)}</span></div>
        ${inv.discount ? html`<div><span>Discount</span><span>-${FT.money(inv.discount)}</span></div>` : ''}
        ${inv.taxRate ? html`<div><span>${inv.taxLabel || 'Sales tax'} at ${inv.taxRate}%</span><span>${FT.money(inv.tax)}</span></div>` : ''}
        <div class="grand"><span>Total</span><span>${FT.money(inv.total)}</span></div>
        ${inv.paid ? html`<div><span>Paid</span><span>-${FT.money(inv.paid)}</span></div><div class="strong"><span>Balance due</span><span>${FT.money(inv.balance)}</span></div>` : ''}
      </div>
      ${hasBank && inv.status !== 'paid' && inv.status !== 'cancelled' ? html`<div class="sheet tinted"><div class="sheet-body"><b class="small">How to pay</b><div class="dl mt-1">${bank.bankName ? html`<div>Bank</div><div>${bank.bankName}</div>` : ''}${bank.accountTitle ? html`<div>Account title</div><div>${bank.accountTitle}</div>` : ''}${bank.accountNumber ? html`<div>Account number</div><div>${FT.copyable(bank.accountNumber)}</div>` : ''}${bank.iban ? html`<div>IBAN</div><div>${FT.copyable(bank.iban)}</div>` : ''}${bank.raast ? html`<div>Raast ID</div><div>${FT.copyable(bank.raast)}</div>` : ''}${bank.jazzcash ? html`<div>JazzCash</div><div>${FT.copyable(bank.jazzcash)}</div>` : ''}${bank.easypaisa ? html`<div>Easypaisa</div><div>${FT.copyable(bank.easypaisa)}</div>` : ''}</div><p class="xs muted mt-1">Please mention ${inv.number} with your payment.</p></div></div>` : ''}
      ${inv.notes || firm.invoiceNote ? html`<p class="small ink2">${inv.notes || firm.invoiceNote}</p>` : ''}
    </div>`;
  };
  FT.invoiceHtmlFile = (inv, client, firm) => {
    const css = 'body{font-family:Arial,Helvetica,sans-serif;color:#10241B;max-width:760px;margin:30px auto;padding:0 20px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{padding:8px;border-bottom:1px solid #DCE5DE;text-align:left}td.n,th.n{text-align:right}h1{margin:0}.muted{color:#677A6F}.tot{margin-left:auto;width:300px}.tot div{display:flex;justify-content:space-between;padding:4px 0}.g{font-weight:bold;border-top:2px solid #10241B;padding-top:8px}';
    const e = FT.esc;
    const rows = inv.items.map((it) => '<tr><td>' + e(it.desc) + '</td><td class="n">' + e(it.qty) + '</td><td class="n">' + e(FT.money(it.rate)) + '</td><td class="n">' + e(FT.money(it.qty * it.rate)) + '</td></tr>').join('');
    return '<!doctype html><html><head><meta charset="utf-8"><title>' + e(inv.number) + '</title><style>' + css + '</style></head><body><div style="display:flex;justify-content:space-between;gap:20px"><div><h2 style="margin:0">' + e(firm.name) + '</h2><div class="muted">' + e(firm.address || '') + '</div><div class="muted">' + e([firm.phone, firm.email].filter(Boolean).join(', ')) + '</div>' + (firm.ntn ? '<div class="muted">NTN ' + e(firm.ntn) + '</div>' : '') + '</div><div style="text-align:right"><h1>Invoice</h1><div>' + e(inv.number) + '</div><div class="muted">Issued ' + e(FT.date(inv.issueDate)) + '</div><div class="muted">Due ' + e(FT.date(inv.dueDate)) + '</div></div></div><p><span class="muted">Billed to</span><br><b>' + e(client ? client.name : inv.clientName) + '</b></p><table><thead><tr><th>Description</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Amount</th></tr></thead><tbody>' + rows + '</tbody></table><div class="tot"><div><span>Subtotal</span><span>' + e(FT.money(inv.subtotal)) + '</span></div>' + (inv.discount ? '<div><span>Discount</span><span>-' + e(FT.money(inv.discount)) + '</span></div>' : '') + (inv.taxRate ? '<div><span>' + e(inv.taxLabel || 'Sales tax') + ' at ' + e(inv.taxRate) + '%</span><span>' + e(FT.money(inv.tax)) + '</span></div>' : '') + '<div class="g"><span>Total</span><span>' + e(FT.money(inv.total)) + '</span></div>' + (inv.paid ? '<div><span>Paid</span><span>-' + e(FT.money(inv.paid)) + '</span></div><div class="g"><span>Balance due</span><span>' + e(FT.money(inv.balance)) + '</span></div>' : '') + '</div>' + (inv.notes || firm.invoiceNote ? '<p>' + e(inv.notes || firm.invoiceNote) + '</p>' : '') + '</body></html>';
  };
  FT.recordPayment = async (inv) => {
    const r = await FT.formModal({ title: 'Record a payment', sub: inv.number + ', balance ' + FT.money(inv.balance), submitLabel: 'Record payment', submitIcon: 'wallet', fields: [{ name: 'amount', label: 'Amount received', type: 'money', required: true, col: 6, value: inv.balance }, { name: 'date', label: 'Received on', type: 'date', col: 6, value: FT.today() }, { name: 'method', label: 'Method', type: 'select', options: C.PAY_METHODS, col: 6 }, { name: 'reference', label: 'Reference or cheque number', col: 6 }, { name: 'note', label: 'Note', type: 'textarea', rows: 2 }], onSubmit: (v) => FT.api('payment.record', Object.assign(v, { invoiceId: inv.id })) });
    if (r) { FT.toast('Payment recorded'); FT.reload(); }
  };
  R('/app/invoices', async (ctx) => {
    const all = await FT.api('invoices.list');
    ctx.title = 'Invoices';
    const st = ctx.query.status || 'all';
    const groups = { all: () => true, draft: (i) => i.status === 'draft', unpaid: (i) => ['sent', 'partial', 'overdue'].indexOf(i.status) >= 0, overdue: (i) => i.status === 'overdue', paid: (i) => i.status === 'paid' };
    const rows = all.filter(groups[st] || groups.all);
    const unpaid = all.filter(groups.unpaid);
    ctx.mount((root) => {
      if (ctx.query.new) setTimeout(async () => { const r = await FT.invoiceModal(null, ctx.query.client ? { clientId: ctx.query.client } : null); if (r) FT.go('/app/invoices/' + r.id, { replace: true }); else FT.go('/app/invoices', { replace: true }); }, 30);
      const q = root.querySelector('#i-q');
      q.addEventListener('input', FT.debounce(() => { const t = q.value.trim().toLowerCase(); root.querySelector('#inv-rows').innerHTML = String(FT.invoicesTable(rows.filter((i) => !t || (i.number + ' ' + i.clientName).toLowerCase().includes(t)))); }, 120));
      root.querySelector('[data-export]').addEventListener('click', () => FT.files.save('invoices-' + FT.today() + '.csv', FT.csv(all, [{ label: 'Number', key: 'number' }, { label: 'Client', key: 'clientName' }, { label: 'Issued', key: 'issueDate' }, { label: 'Due', key: 'dueDate' }, { label: 'Subtotal', key: 'subtotal' }, { label: 'Tax', key: 'tax' }, { label: 'Total', key: 'total' }, { label: 'Paid', key: 'paid' }, { label: 'Balance', key: 'balance' }, { label: 'Status', key: 'status' }]), 'text/csv'));
    });
    return html`<div class="page">
      ${head('Invoices', 'Fees billed to clients. Sent invoices appear in the client portal with your payment details.', html`<button class="btn" data-export>${FT.icon('download')}Export</button><button class="btn btn-primary" data-act="inv-new">${FT.icon('plus')}New invoice</button>`)}
      <div class="kpis" style="--n:3"><div class="kpi"><span class="k-label">Unpaid</span><span class="k-value">${FT.moneyShort(U.sum(unpaid, (i) => i.balance))}</span><span class="k-foot">${FT.plural(unpaid.length, 'invoice')}</span></div><div class="kpi ${all.some(groups.overdue) ? 'alert' : ''}"><span class="k-label">Overdue</span><span class="k-value">${FT.moneyShort(U.sum(all.filter(groups.overdue), (i) => i.balance))}</span><span class="k-foot">${FT.plural(all.filter(groups.overdue).length, 'invoice')}</span></div><div class="kpi"><span class="k-label">Collected this month</span><span class="k-value">${FT.moneyShort(U.sum(all, (i) => (U.monthKey(i.issueDate) === FT.today().slice(0, 7) ? i.paid : 0)))}</span><span class="k-foot">on invoices issued this month</span></div></div>
      <div class="sheet"><div class="toolbar"><div class="seg">${[['all', 'All'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['draft', 'Drafts'], ['paid', 'Paid']].map((t) => html`<a class="${st === t[0] ? 'active' : ''}" href="${'#/app/invoices' + (t[0] === 'all' ? '' : '?status=' + t[0])}">${t[1]} <span class="count soft">${all.filter(groups[t[0]]).length}</span></a>`)}</div><label class="search-field">${FT.icon('search')}<input class="input" id="i-q" placeholder="Invoice number or client" aria-label="Search invoices"></label></div><div id="inv-rows">${FT.invoicesTable(rows)}</div></div>
    </div>`;
  });
  FT.act('inv-new', async () => { const r = await FT.invoiceModal(); if (r) FT.go('/app/invoices/' + r.id); });
  R('/app/invoices/:id', async (ctx) => {
    const d = await FT.api('invoice.get', { id: ctx.params.id });
    const inv = d.invoice, c = d.client, firm = d.firm;
    ctx.title = inv.number;
    const open = ['sent', 'partial', 'overdue'].indexOf(inv.status) >= 0;
    const logo = d.features && d.features.branding ? firm.logo : '';
    ctx.mount((root) => {
      const on = (sel, fn) => { const b = root.querySelector(sel); if (b) b.addEventListener('click', async () => { FT.busy(b, true); try { await fn(); } catch (e) { FT.handleError(e); } finally { FT.busy(b, false); } }); };
      on('[data-send]', async () => { await FT.api('invoice.send', { id: inv.id }); FT.toast(inv.status === 'draft' ? 'Invoice sent to the client portal' : 'Reminder sent to the client portal'); FT.reload(); });
      on('[data-pay]', () => FT.recordPayment(inv));
      on('[data-edit]', async () => { if (await FT.invoiceModal(inv)) FT.reload(); });
      on('[data-dl]', () => FT.files.save(inv.number + '.html', FT.invoiceHtmlFile(inv, c, firm), 'text/html'));
      on('[data-print]', () => window.print());
      on('[data-more]', async () => {
        const b = root.querySelector('[data-more]');
        FT.menu(b, [
          inv.status !== 'cancelled' ? { label: 'Cancel invoice', icon: 'ban', fn: async () => { if (await FT.confirm({ title: 'Cancel ' + inv.number + '?', message: 'It stays on record, marked cancelled, and no longer counts as owed.', confirmLabel: 'Cancel invoice', danger: true })) { await FT.api('invoice.cancel', { id: inv.id }); FT.toast('Invoice cancelled'); FT.reload(); } } } : null,
          isOwner() ? { label: 'Delete invoice', icon: 'trash-2', danger: true, fn: async () => { if (await FT.confirm({ title: 'Delete ' + inv.number + '?', message: 'Deleting is only possible when no payment is recorded. Cancel the invoice instead to keep a record.', confirmLabel: 'Delete', danger: true })) { await FT.api('invoice.delete', { id: inv.id }); FT.toast('Invoice deleted'); FT.go('/app/invoices'); } } } : null,
        ].filter(Boolean));
      });
      root.querySelectorAll('[data-confirm-pay]').forEach((b) => b.addEventListener('click', async () => { await FT.api('payment.confirm', { id: b.dataset.confirmPay }); FT.toast('Payment confirmed'); FT.reload(); }));
    });
    const pct = inv.total ? Math.min(100, (inv.paid / inv.total) * 100) : 0;
    return html`<div class="page">
      ${head(inv.number, html`${FT.statusPill('invoice', inv.status)} <span class="muted">${inv.clientName}, ${FT.money(inv.total)}</span>`, html`
        ${inv.status !== 'cancelled' && inv.status !== 'paid' ? html`<button class="btn" data-send>${FT.icon('send')}${inv.status === 'draft' ? 'Send to client' : 'Send reminder'}</button>` : ''}
        ${open && c ? FT.waBtn(c.phone, FT.waText(c, 'Your invoice ' + inv.number + ' for ' + FT.money(inv.balance) + ' is due on ' + FT.date(inv.dueDate) + '. You can view and pay it in your portal.'), 'WhatsApp reminder', '') : ''}
        ${inv.status !== 'cancelled' && inv.status !== 'paid' ? html`<button class="btn btn-primary" data-pay>${FT.icon('wallet')}Record payment</button>` : ''}
        <button class="btn" data-dl>${FT.icon('download')}Download</button>
        ${FT.preview ? '' : html`<button class="btn" data-print>${FT.icon('printer')}Print</button>`}
        ${inv.status !== 'cancelled' ? html`<button class="btn" data-edit>${FT.icon('pencil')}Edit</button>` : ''}
        <button class="btn btn-icon" data-more aria-label="More">${FT.icon('ellipsis')}</button>`, html`<a href="#/app/invoices">Invoices</a>${FT.icon('chevron-right')}<span>${inv.number}</span>`)}
      <div class="grid cols-main" style="align-items:start">
        ${FT.invoiceDoc(inv, c, firm, { logo })}
        <div class="stack loose">
          <div class="sheet"><div class="sheet-head"><h2>Payment</h2></div><div class="sheet-body stack">
            <div class="meter"><div class="row"><span>${FT.money(inv.paid)} paid</span><span>${FT.money(inv.balance)} due</span></div><div class="bar"><i style="width:${pct}%"></i></div></div>
            ${d.payments.length ? html`<div class="list" style="margin:0 -20px">${d.payments.map((p) => html`<div class="li"><span class="li-icon ${p.status === 'confirmed' ? 'green' : p.status === 'pending' ? 'amber' : 'red'}">${FT.icon('wallet')}</span><div class="li-main"><div class="li-title">${FT.money(p.amount)}</div><div class="li-sub">${FT.date(p.date)}, ${p.method}${p.reference ? ', ' + p.reference : ''}</div></div>${p.status === 'pending' ? html`<button class="btn btn-sm btn-soft" data-confirm-pay="${p.id}">Confirm</button>` : FT.statusPill('payment', p.status)}</div>`)}</div>` : html`<p class="small muted">No payments yet.</p>`}
          </div></div>
          ${c ? html`<div class="sheet"><div class="sheet-head"><h2>Client</h2><a class="btn btn-sm btn-quiet right" href="${'#/app/clients/' + c.id + '/billing'}">Open</a></div><div class="sheet-body"><div class="dl"><div>Name</div><div>${c.name}</div><div>Mobile</div><div>${c.phone ? FT.copyable(c.phone) : '-'}</div><div>Email</div><div>${c.email || '-'}</div><div>Portal</div><div>${c.portalUserId ? 'Can see this invoice' : 'Not invited'}</div></div></div></div>` : ''}
        </div>
      </div>
    </div>`;
  });

  /* ========================================================= payments */
  R('/app/payments', async (ctx) => {
    const all = await FT.api('payments.list');
    ctx.title = 'Payments';
    const tab = ctx.query.tab || (all.some((p) => p.status === 'pending') ? 'pending' : 'all');
    const rows = all.filter((p) => (tab === 'pending' ? p.status === 'pending' : tab === 'rejected' ? p.status === 'rejected' : p.status === 'confirmed'));
    ctx.mount((root) => {
      root.querySelectorAll('[data-pconfirm]').forEach((b) => b.addEventListener('click', async () => { FT.busy(b, true); try { await FT.api('payment.confirm', { id: b.dataset.pconfirm }); FT.toast('Payment confirmed. The client has been notified.'); FT.reload(); } catch (e) { FT.handleError(e); } finally { FT.busy(b, false); } }));
      root.querySelectorAll('[data-preject]').forEach((b) => b.addEventListener('click', async () => { const r = await FT.formModal({ title: 'Reject this payment', sub: 'The client sees your reason in their portal.', submitLabel: 'Reject', danger: true, fields: [{ name: 'note', label: 'Reason', type: 'textarea', rows: 2, required: true, placeholder: 'e.g. We could not find this transaction in our account.' }], onSubmit: (v) => FT.api('payment.reject', { id: b.dataset.preject, note: v.note }) }); if (r) { FT.toast('Payment rejected'); FT.reload(); } }));
    });
    return html`<div class="page">
      ${head('Payments', 'Fees received from clients. Payments clients submit from their portal wait here until you confirm them.', html`<button class="btn btn-primary" data-act="pay-new">${FT.icon('plus')}Record payment</button>`)}
      <div class="sheet"><div class="toolbar"><div class="seg">${[['pending', 'To confirm'], ['all', 'Received'], ['rejected', 'Rejected']].map((t) => html`<a class="${tab === t[0] ? 'active' : ''}" href="${'#/app/payments?tab=' + t[0]}">${t[1]} <span class="count ${t[0] === 'pending' && all.some((p) => p.status === 'pending') ? '' : 'soft'}">${all.filter((p) => (t[0] === 'pending' ? p.status === 'pending' : t[0] === 'rejected' ? p.status === 'rejected' : p.status === 'confirmed')).length}</span></a>`)}</div><span class="right small muted">Received in total: <b class="num">${FT.money(U.sum(all.filter((p) => p.status === 'confirmed'), (p) => p.amount))}</b></span></div>
        ${FT.table({ rows, empty: FT.empty({ icon: 'wallet', title: tab === 'pending' ? 'Nothing to confirm' : 'No payments here', text: tab === 'pending' ? 'When a client submits a transaction ID from their portal, it appears here.' : '' }), cols: [
          { label: 'Date', render: (p) => html`<span class="nowrap">${FT.date(p.date)}</span>` },
          { label: 'Client', render: (p) => html`<a href="${'#/app/clients/' + p.clientId + '/billing'}">${p.clientName}</a>` },
          { label: 'Invoice', render: (p) => html`<a href="${'#/app/invoices/' + p.invoiceId}">${p.invoiceNumber}</a>` },
          { label: 'Amount', num: true, render: (p) => html`<b>${FT.money(p.amount)}</b>` },
          { label: 'Method', render: (p) => html`${p.method}${p.reference ? html`<div class="t-sub">${FT.copyable(p.reference)}</div>` : ''}${p.note ? html`<div class="t-sub">${p.note}</div>` : ''}` },
          { label: 'Status', render: (p) => FT.statusPill('payment', p.status) },
          { label: '', tdCls: 'actions', render: (p) => html`${p.proofBlobId ? html`<button class="btn btn-sm btn-quiet" data-act="dl-blob" data-blob="${p.proofBlobId}" data-name="${p.proofName}">${FT.icon('paperclip')}Proof</button>` : ''}${p.status === 'pending' ? html`<button class="btn btn-sm btn-soft" data-pconfirm="${p.id}">Confirm</button><button class="btn btn-sm btn-quiet" data-preject="${p.id}">Reject</button>` : ''}` },
        ] })}
      </div>
    </div>`;
  });
  FT.act('dl-blob', (el) => FT.files.download(el.dataset.blob, el.dataset.name));
  FT.act('pay-new', async () => {
    const invs = (await FT.api('invoices.list')).filter((i) => ['sent', 'partial', 'overdue', 'draft'].indexOf(i.status) >= 0 && i.balance > 0);
    if (!invs.length) return FT.toast('There are no unpaid invoices to record a payment against.', 'info');
    const r = await FT.formModal({ title: 'Which invoice was paid?', submitLabel: 'Continue', fields: [{ name: 'id', label: 'Invoice', type: 'select', options: invs.map((i) => ({ value: i.id, label: i.number + ', ' + i.clientName + ', ' + FT.money(i.balance) + ' due' })) }], onSubmit: (v) => v });
    if (r) FT.recordPayment(invs.find((i) => i.id === r.id));
  });

  /* ========================================================= expenses */
  R('/app/expenses', async (ctx) => {
    const all = await FT.api('expenses.list');
    ctx.title = 'Expenses';
    const m = ctx.query.m || 'all';
    const months = Array.from(new Set(all.map((e) => e.date.slice(0, 7)))).sort().reverse();
    const rows = all.filter((e) => m === 'all' || e.date.slice(0, 7) === m);
    const byCat = C.EXPENSE_CATEGORIES.map((cat) => ({ label: cat, value: U.sum(rows.filter((e) => e.category === cat), (e) => e.amount) })).filter((x) => x.value).sort((a, b) => b.value - a.value);
    return html`<div class="page">
      ${head('Expenses', 'Running costs of the practice. Reports compare them with the fees you collect.', html`<button class="btn" data-act="exp-export">${FT.icon('download')}Export</button><button class="btn btn-primary" data-act="exp-edit">${FT.icon('plus')}Add expense</button>`)}
      <div class="grid cols-main" style="align-items:start">
        <div class="sheet"><div class="toolbar"><select class="select input-sm" style="width:auto" aria-label="Month" data-month>${[['all', 'All months']].concat(months.map((x) => [x, U.monthLabel(x)])).map((o) => html`<option value="${o[0]}" ${o[0] === m ? raw('selected') : ''}>${o[1]}</option>`)}</select><span class="right small muted">Total: <b class="num">${FT.money(U.sum(rows, (e) => e.amount))}</b></span></div>
          ${FT.table({ rows, rowAct: 'exp-edit', empty: FT.empty({ icon: 'coins', title: 'No expenses recorded' }), cols: [{ label: 'Date', render: (e) => html`<span class="nowrap">${FT.date(e.date)}</span>` }, { label: 'Description', render: (e) => html`<div class="t-name">${e.description}</div><div class="t-sub">${e.category}</div>` }, { label: 'Paid by', key: 'method' }, { label: 'Amount', num: true, render: (e) => FT.money(e.amount) }] })}
        </div>
        <div class="sheet"><div class="sheet-head"><h2>By category</h2></div><div class="sheet-body">${byCat.length ? FT.chart.hbars(byCat, { fmt: FT.moneyShort, fmtFull: FT.money }) : html`<p class="muted small">Nothing yet.</p>`}</div></div>
      </div>
    </div>`;
  }, { owner: true });
  document.addEventListener('change', (e) => { const s = e.target.closest('[data-month]'); if (s) FT.go('/app/expenses' + (s.value === 'all' ? '' : '?m=' + s.value)); });
  FT.act('exp-export', async () => { const all = await FT.api('expenses.list'); FT.files.save('expenses-' + FT.today() + '.csv', FT.csv(all, [{ label: 'Date', key: 'date' }, { label: 'Category', key: 'category' }, { label: 'Description', key: 'description' }, { label: 'Method', key: 'method' }, { label: 'Amount', key: 'amount' }]), 'text/csv'); });
  FT.act('exp-edit', async (el) => {
    const all = el.dataset.id ? await FT.api('expenses.list') : [];
    const e = all.find((x) => x.id === el.dataset.id);
    const r = await FT.formModal({ title: e ? 'Edit expense' : 'Add an expense', submitLabel: 'Save', fields: [{ name: 'description', label: 'Description', required: true }, { name: 'category', label: 'Category', type: 'select', options: C.EXPENSE_CATEGORIES, col: 6 }, { name: 'amount', label: 'Amount', type: 'money', required: true, col: 6 }, { name: 'date', label: 'Date', type: 'date', col: 6, value: FT.today() }, { name: 'method', label: 'Paid by', type: 'select', options: C.PAY_METHODS, col: 6 }], values: e || {},
      footLeft: e ? html`<button type="button" class="btn btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : '',
      mount: (f, m, close) => { const d = m.querySelector('[data-del]'); if (d) d.addEventListener('click', async () => { await FT.api('expense.delete', { id: e.id }); close(); FT.toast('Expense deleted'); FT.reload(); }); },
      onSubmit: (v) => FT.api('expense.save', Object.assign(v, e ? { id: e.id } : {})) });
    if (r) { FT.toast('Expense saved'); FT.reload(); }
  });

  /* ========================================================= messages */
  const msgList = (msgs, mineRole) => {
    let last = '';
    return html`${msgs.map((m) => { const day = FT.isoDay(m.createdAt); const sep = day !== last ? html`<span class="chat-day">${day === FT.today() ? 'Today' : FT.date(day)}</span>` : ''; last = day; return html`${sep}<div class="bubble ${m.role === mineRole ? 'me' : ''}">${m.text}<span class="b-meta">${m.role === mineRole ? (m.name || '') + ', ' : ''}${FT.timeOf(m.createdAt)}</span></div>`; })}`;
  };
  FT.msgList = msgList;
  FT.chatPane = async (clientId) => {
    const r = await FT.api('messages.list', { clientId });
    const c = r.client;
    return html`<div class="sheet chat-pane" style="min-height:460px;display:flex;flex-direction:column" data-chat="${clientId}">
      <div class="chat-head">${FT.avatar(c.name, 'sm')}<div class="grow"><b class="small">${c.name}</b><div class="xs muted">${c.hasPortal ? 'Replies arrive here and in their portal' : 'Not invited to the portal yet'}</div></div>${FT.waBtn(c.phone, FT.waText({ name: c.name }, ''), 'WhatsApp')}</div>
      ${c.hasPortal ? '' : html`<div class="callout warn" style="margin:12px">${FT.icon('info')}<span>${c.name} cannot see these messages until you invite them to the portal.</span></div>`}
      <div class="chat-msgs" style="flex:1">${r.messages.length ? msgList(r.messages, 'firm') : html`<div class="empty">${FT.icon('message-square')}<p>No messages yet. Messages stay with the client file, so nothing gets lost in personal chats.</p></div>`}</div>
      <form class="chat-compose"><textarea class="textarea" name="text" rows="1" placeholder="Write a message" aria-label="Message"></textarea><button class="btn btn-primary btn-icon" type="submit" aria-label="Send">${FT.icon('send')}</button></form>
    </div>`;
  };
  FT.mountChat = (root, clientId, sendAction) => {
    const pane = root.querySelector('[data-chat="' + clientId + '"]') || root.querySelector('[data-chat]');
    if (!pane) return;
    const box = pane.querySelector('.chat-msgs');
    box.scrollTop = box.scrollHeight;
    const form = pane.querySelector('form');
    const ta = form.querySelector('textarea');
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 640) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); } });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
    const refresh = async () => {
      if (!document.body.contains(pane)) return false;
      const isClient = FT.state.me.user.role === 'client';
      const msgs = isClient ? await FT.api('portal.messages') : (await FT.api('messages.list', { clientId })).messages;
      box.innerHTML = String(msgs.length ? msgList(msgs, isClient ? 'client' : 'firm') : '');
      box.scrollTop = box.scrollHeight;
      return true;
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      const b = form.querySelector('button'); FT.busy(b, true);
      try { if (FT.state.me.user.role === 'client') await FT.api('portal.send', { text }); else await FT.api('message.send', { clientId, text }); ta.value = ''; ta.style.height = ''; await refresh(); }
      catch (err) { FT.handleError(err); } finally { FT.busy(b, false); }
    });
    if (FT.backend === 'server') { const t = setInterval(async () => { if (document.visibilityState !== 'visible') return; const ok = await refresh().catch(() => true); if (!ok) clearInterval(t); }, 8000); }
  };
  R('/app/messages', async (ctx) => {
    const threads = await FT.api('threads.list');
    ctx.title = 'Messages';
    const sel = ctx.query.c || (threads.find((t) => t.last) || {}).clientId;
    const pane = sel ? await FT.chatPane(sel) : FT.empty({ icon: 'message-square', title: 'Choose a conversation' });
    ctx.mount((root) => {
      if (sel) FT.mountChat(root, sel);
      const q = root.querySelector('#t-q');
      q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); root.querySelectorAll('[data-thread]').forEach((el) => { el.hidden = t && !el.dataset.name.toLowerCase().includes(t); }); });
      FT.ping();
    });
    return html`<div class="page" style="max-width:none">
      ${head('Messages', 'Conversations with clients, kept with each client file instead of personal chats.')}
      <div class="sheet chat ${ctx.query.c ? 'has-open' : ''}" style="overflow:hidden">
        <div class="chat-list"><div class="toolbar"><label class="search-field" style="max-width:none">${FT.icon('search')}<input class="input" id="t-q" placeholder="Search clients" aria-label="Search conversations"></label></div>
          ${threads.map((t) => html`<a class="li thread ${t.clientId === sel ? 'active' : ''}" data-thread data-name="${t.name}" href="${'#/app/messages?c=' + t.clientId}">${FT.avatar(t.name, 'sm')}<div class="li-main"><div class="li-title">${t.name}</div><div class="li-sub">${t.last ? (t.last.role === 'firm' ? 'You: ' : '') + t.last.text : t.hasPortal ? 'No messages yet' : 'Not on the portal'}</div></div><div class="li-side">${t.last ? html`<div>${FT.ago(t.last.createdAt)}</div>` : ''}${t.unread ? html`<span class="count">${t.unread}</span>` : ''}</div></a>`)}
        </div>
        <div class="chat-pane">${ctx.query.c ? html`<a class="btn btn-sm btn-quiet show-sm" href="#/app/messages" style="margin:8px">${FT.icon('arrow-left')}All conversations</a>` : ''}${pane}</div>
      </div>
    </div>`;
  });

  /* ========================================================== reports */
  R('/app/reports', async (ctx) => {
    const td = FT.today();
    const curTY = U.taxYearOf(td);
    const ranges = { '6m': [U.addMonths(td.slice(0, 7) + '-01', -5), td, 'Last 6 months'], ty: [(curTY - 1) + '-07-01', td, 'This tax year (TY' + curTY + ')'], lty: [(curTY - 2) + '-07-01', (curTY - 1) + '-06-30', 'Last tax year (TY' + (curTY - 1) + ')'], '12m': [U.addMonths(td.slice(0, 7) + '-01', -11), td, 'Last 12 months'] };
    const key = ranges[ctx.query.r] ? ctx.query.r : '6m';
    const rg = ranges[key];
    const r = await FT.api('reports', { from: rg[0], to: rg[1] });
    ctx.title = 'Reports';
    const locked = (title) => html`<div class="sheet">${FT.empty({ icon: 'lock', title, text: 'Advanced reports are part of Firm Pro.', action: html`<a class="btn btn-primary btn-sm" href="#/app/subscription">See plans</a>` })}</div>`;
    ctx.mount((root) => { root.querySelector('[data-export]').addEventListener('click', () => FT.files.save('fees-report-' + key + '.csv', FT.csv(r.series, [{ label: 'Month', key: 'label' }, { label: 'Invoiced', key: 'invoiced' }, { label: 'Collected', key: 'collected' }, { label: 'Expenses', key: 'expenses' }, { label: 'Net', value: (s) => s.collected - s.expenses }]), 'text/csv')); });
    return html`<div class="page">
      ${head('Reports', rg[2] + ', ' + FT.date(r.from) + ' to ' + FT.date(r.to) + '.', html`<div class="seg">${Object.keys(ranges).map((k) => html`<a class="${k === key ? 'active' : ''}" href="${'#/app/reports?r=' + k}">${ranges[k][2].replace(/ \(.*\)/, '')}</a>`)}</div><button class="btn" data-export>${FT.icon('download')}Export CSV</button>`)}
      <div class="kpis" style="--n:5"><div class="kpi"><span class="k-label">Invoiced</span><span class="k-value">${FT.moneyShort(r.totals.invoiced)}</span></div><div class="kpi"><span class="k-label">Collected</span><span class="k-value">${FT.moneyShort(r.totals.collected)}</span></div><div class="kpi"><span class="k-label">Expenses</span><span class="k-value">${FT.moneyShort(r.totals.expenses)}</span></div><div class="kpi ${r.totals.profit < 0 ? 'alert' : ''}"><span class="k-label">Net cash</span><span class="k-value">${FT.moneyShort(r.totals.profit)}</span><span class="k-foot">Collected minus expenses</span></div><div class="kpi ${r.outstanding ? 'warn' : ''}"><span class="k-label">Still owed to you</span><span class="k-value">${FT.moneyShort(r.outstanding)}</span></div></div>
      <div class="sheet"><div class="sheet-head"><h2>Fees and costs by month</h2></div><div class="sheet-body stack">${FT.chart.bars({ labels: r.series.map((s) => s.label.slice(0, 3)), series: [{ name: 'Invoiced', values: r.series.map((s) => s.invoiced), color: FT.SERIES[1] }, { name: 'Collected', values: r.series.map((s) => s.collected), color: FT.SERIES[0] }, { name: 'Expenses', values: r.series.map((s) => s.expenses), color: FT.SERIES[2] }], label: 'Invoiced, collected and expenses per month', height: 230 })}
        <details><summary class="small muted" style="cursor:pointer">Show as a table</summary>${FT.table({ rows: r.series, cols: [{ label: 'Month', key: 'label' }, { label: 'Invoiced', num: true, render: (s) => FT.money(s.invoiced) }, { label: 'Collected', num: true, render: (s) => FT.money(s.collected) }, { label: 'Expenses', num: true, render: (s) => FT.money(s.expenses) }, { label: 'Net', num: true, render: (s) => FT.money(s.collected - s.expenses) }] })}</details>
      </div></div>
      <div class="grid cols-2">
        ${r.aging ? html`<div class="sheet"><div class="sheet-head"><h2>Receivables aging</h2><span class="sub">${FT.money(r.outstanding)} unpaid</span></div><div class="sheet-body">${FT.chart.hbars([{ label: 'Not yet due', value: r.aging.current }, { label: '1 to 30 days late', value: r.aging.d30 }, { label: '31 to 60 days', value: r.aging.d60, tone: 'amber' }, { label: '61 to 90 days', value: r.aging.d90, tone: 'amber' }, { label: 'Over 90 days', value: r.aging.d90p, tone: 'red' }], { fmt: FT.moneyShort, fmtFull: FT.money })}</div></div>` : locked('Receivables aging')}
        <div class="sheet"><div class="sheet-head"><h2>Returns and filings</h2><span class="sub">${r.filedInRange} filed in this period, ${r.overdueFilings} overdue now</span></div>${FT.table({ rows: r.filingsByType, empty: html`<div class="sheet-body muted small">No filings yet.</div>`, cols: [{ label: 'Type', key: 'label' }, { label: 'Open', num: true, key: 'open' }, { label: 'Filed', num: true, key: 'filed' }] })}</div>
      </div>
      <div class="grid cols-2">
        ${r.staff ? html`<div class="sheet"><div class="sheet-head"><h2>Team workload</h2></div>${FT.table({ rows: r.staff, cols: [{ label: 'Person', render: (s) => html`<div class="row">${FT.avatar(s.name, 'sm')}<span>${s.name}</span></div>` }, { label: 'Open returns', num: true, key: 'openFilings' }, { label: 'Filed', num: true, key: 'filed' }, { label: 'Open tasks', num: true, key: 'openTasks' }, { label: 'Tasks done', num: true, key: 'doneTasks' }] })}</div>` : locked('Team workload')}
        <div class="sheet"><div class="sheet-head"><h2>Top clients by fees collected</h2></div><div class="sheet-body">${r.topClients.length ? FT.chart.hbars(r.topClients.map((c) => ({ label: c.name, value: c.amount })), { fmt: FT.moneyShort, fmtFull: FT.money }) : html`<p class="muted small">No payments in this period.</p>`}</div></div>
      </div>
      <div class="grid cols-2">
        <div class="sheet"><div class="sheet-head"><h2>Clients who need attention</h2></div><div class="list">${r.atRisk.length ? r.atRisk.map((c) => html`<a class="li" href="${'#/app/clients/' + c.id}">${FT.avatar(c.name, 'sm')}<div class="li-main"><div class="li-title">${c.name}</div><div class="li-sub">${[c.overdue ? FT.plural(c.overdue, 'overdue return') : '', c.notices ? FT.plural(c.notices, 'open notice') : '', c.atl === 'inactive' ? 'Not on ATL' : ''].filter(Boolean).join(', ')}</div></div>${FT.icon('chevron-right')}</a>`) : html`<div class="sheet-body muted small">Every client is on track.</div>`}</div></div>
        ${r.expensesByCategory ? html`<div class="sheet"><div class="sheet-head"><h2>Expenses by category</h2></div><div class="sheet-body">${r.expensesByCategory.length ? FT.chart.hbars(r.expensesByCategory.map((x) => ({ label: x.category, value: x.amount })), { fmt: FT.moneyShort, fmtFull: FT.money }) : html`<p class="muted small">No expenses in this period.</p>`}</div></div>` : locked('Expenses by category')}
      </div>
    </div>`;
  }, { owner: true });

  /* ============================================================= team */
  R('/app/team', async (ctx) => {
    const t = await FT.api('team.list');
    ctx.title = 'Team';
    const active = t.users.filter((u) => u.status === 'active').length;
    return html`<div class="page">
      ${head('Team', 'Give associates and trainees their own logins. They see clients, files and filings, but not billing, subscription or practice settings.', html`<button class="btn btn-primary" data-act="team-edit">${FT.icon('user-plus')}Add team member</button>`)}
      <div class="sheet"><div class="sheet-head"><h2>People</h2><span class="sub">${t.limit ? active + ' of ' + t.limit + ' logins used' : active + ' logins'}</span>${t.limit ? html`<div class="bar right" style="width:160px"><i style="width:${Math.min(100, (active / t.limit) * 100)}%"></i></div>` : ''}</div>
        ${FT.table({ rows: t.users, cols: [
          { label: 'Name', render: (u) => html`<div class="row">${FT.avatar(u.name, 'sm')}<div><div class="t-name">${u.name}</div><div class="t-sub">${u.email}</div></div></div>` },
          { label: 'Role', render: (u) => (u.id === t.ownerId ? FT.pill('Owner', 'green') : html`${u.title || 'Staff'}`) },
          { label: 'Status', render: (u) => (u.status === 'active' ? FT.pill('Active', 'green') : FT.pill('Turned off', '')) },
          { label: 'Last signed in', render: (u) => html`<span class="muted">${u.lastLoginAt ? FT.ago(u.lastLoginAt) : 'Never'}</span>` },
          { label: '', tdCls: 'actions', render: (u) => (u.id === t.ownerId ? '' : html`<button class="btn btn-sm btn-quiet btn-icon" data-act="team-menu" data-id="${u.id}" aria-label="Actions for ${u.name}">${FT.icon('ellipsis')}</button>`) },
        ] })}
      </div>
    </div>`;
  }, { owner: true });
  FT.act('team-edit', async (el) => {
    const t = await FT.api('team.list');
    const u = t.users.find((x) => x.id === el.dataset.id);
    const r = await FT.formModal({ title: u ? 'Edit ' + u.name : 'Add a team member', sub: u ? u.email : 'They sign in with this email. You will see the password once.', submitLabel: u ? 'Save' : 'Create login', fields: [{ name: 'name', label: 'Full name', required: true, col: 6 }, { name: 'title', label: 'Title', col: 6, placeholder: 'e.g. Tax Associate' }, { name: 'email', label: 'Email', type: 'email', required: true, col: 6 }, { name: 'phone', label: 'Mobile', type: 'tel', col: 6 }, { name: 'password', label: u ? 'New password (leave blank to keep)' : 'Password (leave blank to create one)', type: 'text', autocomplete: 'off' }], values: u || {}, onSubmit: (v) => FT.api('team.save', Object.assign(v, u ? { id: u.id } : {})) });
    if (r) { if (r.password) FT.showCredentials({ title: 'Login created for ' + r.user.name, sub: 'Share these details with your team member. The password is shown only once.', email: r.user.email, password: r.password, phone: r.user.phone, name: r.user.name }); else FT.toast('Team member saved'); FT.reload(); }
  });
  FT.act('team-menu', async (el) => {
    const t = await FT.api('team.list');
    const u = t.users.find((x) => x.id === el.dataset.id);
    FT.menu(el, [
      { label: 'Edit details', icon: 'pencil', fn: () => FT.acts['team-edit']({ dataset: { id: u.id } }) },
      { label: 'Reset password', icon: 'key-round', fn: async () => { const r = await FT.api('team.reset', { id: u.id }); FT.showCredentials({ title: 'New password for ' + r.name, sub: 'Share it with them securely.', email: r.email, password: r.password, phone: u.phone, name: r.name }); } },
      { label: u.status === 'active' ? 'Turn off login' : 'Turn on login', icon: u.status === 'active' ? 'lock' : 'lock-open', fn: async () => { await FT.api('team.toggle', { id: u.id }); FT.toast(u.status === 'active' ? 'Login turned off' : 'Login turned on'); FT.reload(); } },
      { sep: true },
      { label: 'Remove from team', icon: 'trash-2', danger: true, fn: async () => { if (!(await FT.confirm({ title: 'Remove ' + u.name + '?', message: 'Their login is deleted. Work assigned to them becomes unassigned, and their tasks move to you.', confirmLabel: 'Remove', danger: true }))) return; await FT.api('team.delete', { id: u.id }); FT.toast(u.name + ' removed'); FT.reload(); } },
    ]);
  });

  /* ===================================================== subscription */
  R('/app/subscription', async (ctx) => {
    const s = await FT.api('firm.subscription');
    ctx.title = 'Subscription';
    const sub = s.sub, plan = s.plan, lim = plan.limits || {};
    const cyc = ctx.query.cycle === 'monthly' ? 'monthly' : 'annual';
    const meter = (label, used, max, fmt) => { const pct = max ? Math.min(100, (used / max) * 100) : 6; return html`<div class="meter"><div class="row"><span>${label}</span><span class="num">${fmt ? fmt(used) : used} of ${max ? (fmt ? fmt(max) : max) : 'unlimited'}</span></div><div class="bar ${pct > 90 ? 'red' : pct > 75 ? 'amber' : ''}"><i style="width:${pct}%"></i></div></div>`; };
    const pending = s.payments.find((p) => p.status === 'pending');
    const card = (p) => {
      const price = cyc === 'annual' ? p.annual : p.monthly;
      const current = p.id === plan.id;
      return html`<div class="plan ${p.highlight ? 'hi' : ''}">${p.badge ? html`<span class="p-badge stamp ${p.highlight ? '' : 'green'}" style="background:var(--sheet)">${p.badge}</span>` : ''}<div><h3>${p.name}</h3><p class="p-tag">${p.tagline}</p></div><div class="p-price"><span class="amt">Rs ${FT.n(price)}</span><span class="per">${cyc === 'annual' ? 'a year' : 'a month'}</span></div>${cyc === 'annual' && p.monthly * 12 > p.annual ? html`<span class="p-save">Save Rs ${FT.n(p.monthly * 12 - p.annual)} against monthly</span>` : ''}<ul>${(p.bullets || []).slice(0, 6).map((b) => html`<li>${FT.icon('check')}<span>${b}</span></li>`)}</ul><button class="btn btn-primary btn-lg btn-block" data-act="sub-pay" data-plan="${p.id}" data-cycle="${cyc}" ${pending ? raw('disabled') : ''}>${current ? (sub.status === 'active' ? 'Renew ' + p.name : 'Activate ' + p.name) : 'Switch to ' + p.name}</button></div>`;
    };
    return html`<div class="page">
      ${head('Subscription', 'Your ' + FT.brandName() + ' plan, usage and payments.')}
      ${pending ? html`<div class="callout violet">${FT.icon('hourglass')}<span><b>Payment under review.</b> You submitted ${FT.money(pending.amount)} for ${pending.planName} (${pending.method}, ref ${pending.reference}). Your plan switches on as soon as it is verified.</span></div>` : ''}
      <div class="grid cols-main" style="align-items:start">
        <div class="sheet"><div class="sheet-head"><h2>${plan.name}</h2>${FT.statusPill('sub', sub.status)}</div><div class="sheet-body stack">
          <p class="ink2">${sub.status === 'trial' ? 'Your free trial ends on ' + FT.date(FT.isoDay(sub.endsAt)) + ' (' + FT.plural(Math.max(0, sub.daysLeft), 'day') + ' left). Pay now to keep everything running without a break.' : sub.status === 'active' ? 'Paid ' + (sub.cycle === 'annual' ? 'yearly' : 'monthly') + '. Active until ' + FT.date(FT.isoDay(sub.endsAt)) + '.' : sub.status === 'expired' ? 'Your subscription ended on ' + FT.date(FT.isoDay(sub.endsAt)) + '. The account is read-only until you renew. Nothing has been deleted.' : 'This account is suspended. Contact support.'}</p>
          ${meter('Active clients', s.usage.clients, lim.clients)}
          ${meter('Team logins', s.usage.team, lim.team)}
          ${meter('Document storage', s.usage.storageBytes, lim.storageGB ? lim.storageGB * 1073741824 : null, FT.bytes)}
        </div></div>
        <div class="sheet tinted"><div class="sheet-body stack"><b>Paying is simple</b><p class="small ink2">Choose a plan below, transfer the amount by bank, Raast, JazzCash or Easypaisa, and submit the transaction ID. We verify it and switch your plan on, usually within a few working hours.</p>${s.offer && s.offer.enabled && Date.parse(s.offer.deadline) > Date.now() ? html`<div class="callout warn">${FT.icon('timer')}<span><b>${s.offer.title}</b> ends ${FT.date(FT.isoDay(s.offer.deadline))}. ${s.offer.note}</span></div>` : ''}</div></div>
      </div>
      <div class="row between wrap"><h2 style="font-size:var(--fs-lg);font-weight:750">Choose your plan</h2><div class="seg"><a class="${cyc === 'annual' ? 'active' : ''}" href="#/app/subscription">Yearly</a><a class="${cyc === 'monthly' ? 'active' : ''}" href="#/app/subscription?cycle=monthly">Monthly</a></div></div>
      <div class="plans">${s.plans.map(card)}</div>
      <div class="sheet"><div class="sheet-head"><h2>Payment history</h2></div>${FT.table({ rows: s.payments, empty: html`<div class="sheet-body muted small">No payments yet.</div>`, cols: [{ label: 'Submitted', render: (p) => html`<span class="nowrap">${FT.date(FT.isoDay(p.createdAt))}</span>` }, { label: 'Plan', render: (p) => p.planName + ', ' + (p.cycle === 'annual' ? 'yearly' : 'monthly') }, { label: 'Amount', num: true, render: (p) => FT.money(p.amount) }, { label: 'Method', render: (p) => html`${p.method}<div class="t-sub">${p.reference}</div>` }, { label: 'Status', render: (p) => html`${FT.statusPill('payment', p.status)}${p.note ? html`<div class="t-sub">${p.note}</div>` : ''}` }] })}</div>
    </div>`;
  }, { owner: true });
  FT.act('sub-pay', async (el) => {
    const s = await FT.api('firm.subscription');
    const p = s.plans.find((x) => x.id === el.dataset.plan);
    const cyc = el.dataset.cycle;
    const amount = cyc === 'annual' ? p.annual : p.monthly;
    const pay = s.payment;
    const rows = [['Bank', pay.bankName], ['Account title', pay.accountTitle], ['Account number', pay.accountNumber, true], ['IBAN', pay.iban, true], ['Raast ID', pay.raast, true], ['JazzCash', pay.jazzcash, true], ['Easypaisa', pay.easypaisa, true]].filter((r) => r[1]);
    const r = await FT.formModal({
      title: 'Pay for ' + p.name, sub: (cyc === 'annual' ? 'Yearly' : 'Monthly') + ' plan, ' + FT.money(amount), size: 'lg', submitLabel: 'Submit payment for verification', submitIcon: 'send',
      intro: html`<div class="stack"><div class="sheet tinted"><div class="sheet-body stack tight"><b class="small">Send ${FT.money(amount)} to ${FT.brandName()}</b>${rows.length ? html`<div class="dl">${rows.map((x) => html`<div>${x[0]}</div><div>${x[2] ? FT.copyable(x[1]) : x[1]}</div>`)}</div>` : html`<p class="small">Payment details have not been added yet. Contact ${FT.brandName()} support.</p>`}<p class="xs muted">${pay.instructions}</p></div></div></div>`,
      fields: [{ name: 'method', label: 'How did you pay?', type: 'select', options: C.PAY_METHODS.filter((m) => m !== 'Cash' && m !== 'Cheque'), col: 6 }, { name: 'amount', label: 'Amount paid', type: 'money', col: 6, value: amount }, { name: 'reference', label: 'Transaction ID or reference', required: true, col: 6 }, { name: 'paidOn', label: 'Paid on', type: 'date', col: 6, value: FT.today() }, { name: 'proof', type: 'file', label: 'Receipt or screenshot (optional)', accept: 'image/*,application/pdf', cta: 'Attach a receipt' }, { name: 'note', label: 'Note', type: 'textarea', rows: 2 }],
      onSubmit: async (v) => {
        let proof = null;
        const f = (v._files.proof || [])[0];
        if (f) proof = await FT.files.upload(f);
        return FT.api('firm.pay', { planId: p.id, cycle: cyc, method: v.method, amount: v.amount, reference: v.reference, paidOn: v.paidOn, note: v.note, proofBlobId: proof && proof.blobId, proofName: f && f.name, proofMime: f && f.type });
      },
    });
    if (r) { FT.toast('Payment submitted. We will verify it and switch your plan on.'); FT.reload(); }
  });

  /* ========================================================= settings */
  R('/app/settings', async (ctx) => {
    const me = await FT.loadMe();
    const firm = me.firm;
    const tab = ctx.query.tab || 'profile';
    ctx.title = 'Practice settings';
    const tabs = [['profile', 'Practice profile', 'building-2'], ['billing', 'Invoices and bank details', 'receipt'], ['whatsapp', 'WhatsApp messages', 'message-circle'], ['data', 'Export data', 'archive']];
    let body = '';
    const save = html`<div class="sheet-foot"><button class="btn btn-primary" type="submit">${FT.icon('save')}Save settings</button></div>`;
    if (tab === 'profile') body = html`<form class="sheet" data-fs><div class="sheet-body"><div class="form">${FT.fields([{ name: 'name', label: 'Practice name', required: true, col: 8 }, { name: 'ntn', label: 'Practice NTN', col: 4 }, { name: 'phone', label: 'Phone', col: 6 }, { name: 'email', label: 'Email', type: 'email', col: 6 }, { name: 'city', label: 'City', col: 6 }, { name: 'address', label: 'Office address', type: 'textarea', rows: 2 }], firm)}
      <div class="field"><span class="label">Practice logo</span>${me.features.branding ? html`<div class="row wrap">${firm.logo ? html`<img src="${firm.logo}" alt="Practice logo" style="height:48px;width:auto;border:1px solid var(--rule);border-radius:8px;padding:4px;background:#fff">` : html`<span class="muted small">No logo yet</span>`}<label class="btn btn-sm">${FT.icon('image-up')}Upload logo<input type="file" accept="image/*" data-logo hidden></label>${firm.logo ? html`<button type="button" class="btn btn-sm btn-quiet" data-logo-rm>Remove</button>` : ''}</div><span class="hint">Shown on invoices and in your clients' portal.</span>` : html`<span class="hint">Your logo on invoices and the client portal is part of Firm Pro.</span>`}</div>
      <div class="form-error" hidden></div></div></div>${save}</form>`;
    if (tab === 'billing') body = html`<form class="sheet" data-fs><div class="sheet-body"><div class="form">${FT.fields([{ type: 'section', label: 'Invoice defaults' }, { name: 'invoicePrefix', label: 'Invoice number prefix', col: 4, hint: 'e.g. RTA gives RTA-2026-0001' }, { name: 'paymentTerms', label: 'Payment due after (days)', type: 'number', col: 4 }, { name: 'taxRate', label: 'Default sales tax on services (%)', type: 'number', col: 4 }, { name: 'taxLabel', label: 'Tax label on invoices', col: 6, placeholder: 'e.g. PST (PRA)' }, { name: 'invoiceNote', label: 'Note printed on every invoice', type: 'textarea', rows: 2 }, { type: 'section', label: 'Where clients pay you' }, { name: 'bank.bankName', label: 'Bank', col: 6 }, { name: 'bank.accountTitle', label: 'Account title', col: 6 }, { name: 'bank.accountNumber', label: 'Account number', col: 6 }, { name: 'bank.iban', label: 'IBAN', col: 6 }, { name: 'bank.raast', label: 'Raast ID', col: 4 }, { name: 'bank.jazzcash', label: 'JazzCash', col: 4 }, { name: 'bank.easypaisa', label: 'Easypaisa', col: 4 }], firm)}<div class="form-error" hidden></div></div></div>${save}</form>`;
    if (tab === 'whatsapp') body = html`<form class="sheet" data-fs><div class="sheet-body"><div class="form">${FT.field({ name: 'waTemplate', label: 'Message wrapper', type: 'textarea', rows: 3, hint: '{name} is the client, {firm} is your practice and {message} is the reminder text.', value: firm.waTemplate || 'Assalam o Alaikum {name}, this is {firm}. {message}' })}<div class="field"><span class="label">Preview</span><div class="bubble" style="max-width:none" data-wa-prev></div></div><div class="form-error" hidden></div></div></div>${save}</form>`;
    if (tab === 'data') body = html`<div class="sheet"><div class="sheet-body stack"><p class="ink2 small">Download everything your practice holds in ${FT.brandName()}: clients, documents list, filings, notices, tasks, invoices, payments, expenses, messages and events. Uploaded files stay in your client files.</p><div class="row wrap"><button class="btn btn-primary" data-export-all>${FT.icon('download')}Download all data (JSON)</button><a class="btn" href="#/app/clients">Clients as CSV from the Clients page</a></div></div></div>`;
    ctx.mount((root) => {
      const form = root.querySelector('form[data-fs]');
      if (form) {
        const prev = form.querySelector('[data-wa-prev]');
        const upd = () => { if (prev) prev.textContent = form.querySelector('[name=waTemplate]').value.replace('{name}', 'Muhammad Asif').replace('{firm}', firm.name).replace('{message}', 'Your draft return is ready in the portal.'); };
        form.addEventListener('input', upd); upd();
        form.addEventListener('submit', async (e) => {
          e.preventDefault(); const b = form.querySelector('[type=submit]'); FT.busy(b, true);
          try { const v = FT.formData(form); const payload = Object.assign({}, firm, v); payload.bank = Object.assign({}, firm.bank || {}, v.bank || {}); await FT.api('firm.settings.save', payload); await FT.loadMe(); FT.toast('Settings saved'); FT.refreshChrome(); }
          catch (err) { FT.formError(form, err.message); } finally { FT.busy(b, false); }
        });
        const lg = form.querySelector('[data-logo]');
        if (lg) lg.addEventListener('change', async () => { const f = lg.files[0]; if (!f) return; if (f.size > 500000) return FT.toast('Use an image under 500 KB.', 'warn'); const data = await FT.readDataUrl(f); await FT.api('firm.settings.save', Object.assign({}, firm, { logo: data })); FT.toast('Logo saved'); FT.reload(); });
        const rm = form.querySelector('[data-logo-rm]');
        if (rm) rm.addEventListener('click', async () => { await FT.api('firm.settings.save', Object.assign({}, firm, { logo: '' })); FT.toast('Logo removed'); FT.reload(); });
      }
      const ex = root.querySelector('[data-export-all]');
      if (ex) ex.addEventListener('click', async () => { FT.busy(ex, true); try { const d = await FT.api('firm.export'); await FT.files.save('practice-data-' + FT.today() + '.json', JSON.stringify(d, null, 1), 'application/json'); } catch (e) { FT.handleError(e); } finally { FT.busy(ex, false); } });
    });
    return html`<div class="page">${head('Practice settings', 'Details that appear on invoices and in your clients\' portal.')}<div class="tabs">${tabs.map((t) => html`<a class="tab ${tab === t[0] ? 'active' : ''}" href="${'#/app/settings?tab=' + t[0]}">${FT.icon(t[2])}${t[1]}</a>`)}</div>${body}</div>`;
  }, { owner: true });

  /* ========================================================== support */
  R('/app/support', async (ctx) => {
    const list = await FT.api('support.list');
    ctx.title = 'Help and support';
    const site = FT.state.site || {};
    const c = (site.site && site.site.contact) || {};
    return html`<div class="page">
      ${head('Help and support', 'Ask the ' + FT.brandName() + ' team anything. We reply here and notify you.', html`<button class="btn btn-primary" data-act="ticket-new">${FT.icon('plus')}New request</button>`)}
      <div class="grid cols-main" style="align-items:start">
        <div class="sheet"><div class="sheet-head"><h2>Your requests</h2></div>${FT.table({ rows: list, rowAct: 'ticket-open', empty: FT.empty({ icon: 'life-buoy', title: 'No requests yet', text: 'Stuck, or have an idea? Send us a request.' }), cols: [{ label: 'Subject', render: (t) => html`<div class="t-name">${t.subject}</div><div class="t-sub">${FT.plural((t.thread || []).length, 'message')}</div>` }, { label: 'Status', render: (t) => FT.statusPill('ticket', t.status) }, { label: 'Updated', render: (t) => html`<span class="muted">${FT.ago(t.updatedAt)}</span>` }] })}</div>
        <div class="sheet tinted"><div class="sheet-body stack"><b>Quick answers</b>
          <details><summary class="small strong" style="cursor:pointer">How do clients get a login?</summary><p class="small ink2 mt-1">Open the client, choose Invite to portal and share the details on WhatsApp.</p></details>
          <details><summary class="small strong" style="cursor:pointer">Can I bring clients from Excel?</summary><p class="small ink2 mt-1">Yes. Save the sheet as CSV, then Clients, Import CSV.</p></details>
          <details><summary class="small strong" style="cursor:pointer">How do I renew?</summary><p class="small ink2 mt-1">Subscription, pick a plan, pay and submit the transaction ID.</p></details>
          ${c.email || c.phone || c.whatsapp ? html`<div class="stack tight small">${c.email ? html`<span class="row">${FT.icon('mail')}${FT.copyable(c.email)}</span>` : ''}${c.phone ? html`<span class="row">${FT.icon('phone')}${FT.copyable(c.phone)}</span>` : ''}${c.whatsapp ? FT.waBtn(c.whatsapp, 'Assalam o Alaikum, I need help with ' + FT.brandName() + '.', 'WhatsApp support') : ''}</div>` : ''}
        </div></div>
      </div>
    </div>`;
  });
  FT.act('ticket-new', async () => {
    const r = await FT.formModal({ title: 'New support request', submitLabel: 'Send request', submitIcon: 'send', fields: [{ name: 'subject', label: 'Subject', required: true }, { name: 'priority', label: 'How urgent is it?', type: 'select', options: C.PRIORITIES.map((p) => ({ value: p.id, label: p.label })), value: 'normal', col: 6 }, { name: 'text', label: 'Details', type: 'textarea', rows: 5, required: true }], onSubmit: (v) => FT.api('support.create', v) });
    if (r) { FT.toast('Request sent. We will reply here.'); FT.reload(); }
  });
})();
