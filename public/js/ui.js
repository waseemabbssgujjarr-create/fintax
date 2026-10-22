/*! FinTax shared components: charts, document viewer, uploads, pickers. */
(function () {
  'use strict';
  const FT = window.FT;
  const { html, raw, esc, U, C } = FT;

  /* ------------------------------------------------------------- charts
   * HTML bars and an SVG line, sized to their container so the text stays
   * readable on a phone. Series colours were validated for CVD separation.
   */
  const SERIES = ['var(--ledger)', '#6250D6', '#C98A1B'];
  FT.SERIES = SERIES;
  function nice(max, ticks) {
    if (!max || max <= 0) return { top: ticks, step: 1 };
    const raw0 = max / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw0)));
    const norm = raw0 / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return { top: Math.ceil(max / step) * step, step };
  }
  FT.chart = {
    bars(o) {
      const series = o.series, labels = o.labels, k = series.length;
      const fmt = o.fmt || FT.moneyShort, full = o.fmtFull || FT.money;
      const max = Math.max(0, ...series.reduce((a, s) => a.concat(s.values.map((v) => +v || 0)), []));
      const { top, step } = nice(max, 4);
      const ticks = []; for (let v = 0; v <= top + step / 1000; v += step) ticks.push(v);
      const bw = 'clamp(5px, calc((100% - ' + (2 * (k - 1)) + 'px) * 0.62 / ' + k + '), 24px)';
      return html`<figure class="stack tight" style="margin:0">
        ${k > 1 ? html`<div class="legend">${series.map((s, i) => html`<span><i style="background:${s.color || SERIES[i]}"></i>${s.name}</span>`)}</div>` : ''}
        <div class="hchart" style="--h:${o.height || 200}px" role="img" aria-label="${o.label || ''}">
          <div class="hc-y">${ticks.map((v) => html`<span style="bottom:${(v / top) * 100}%">${fmt(v)}</span>`)}</div>
          <div class="hc-plot">${ticks.slice(1).map((v) => html`<div class="gl" style="bottom:${(v / top) * 100}%"></div>`)}
            ${labels.map((lab, j) => html`<div class="hc-col" data-tip="${lab + ': ' + series.map((s) => (s.name ? s.name + ' ' : '') + full(+s.values[j] || 0)).join(', ')}">${series.map((s, i) => { const v = +s.values[j] || 0; const h = top ? (v / top) * 100 : 0; return h > 0 ? html`<div class="hc-bar" style="height:${h}%;width:${bw};background:${s.color || SERIES[i]}"></div>` : html`<div class="hc-bar" style="height:0;width:${bw}"></div>`; })}</div>`)}
          </div>
          <div class="hc-x">${labels.map((l) => html`<span>${l}</span>`)}</div>
        </div>
      </figure>`;
    },
    line(o) {
      const vals = o.values.map((v) => +v || 0);
      const n = vals.length;
      const { top, step } = nice(Math.max(0, ...vals), 4);
      const ticks = []; for (let v = 0; v <= top + step / 1000; v += step) ticks.push(v);
      const x = (i) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
      const y = (v) => 100 - (top ? (v / top) * 100 : 0);
      const pts = vals.map((v, i) => x(i).toFixed(2) + ',' + y(v).toFixed(2));
      const color = o.color || SERIES[0];
      const fmt = o.fmt || FT.compact, full = o.fmtFull || FT.n;
      return html`<div class="hchart" style="--h:${o.height || 180}px" role="img" aria-label="${o.label || ''}">
        <div class="hc-y">${ticks.map((v) => html`<span style="bottom:${(v / top) * 100}%">${fmt(v)}</span>`)}</div>
        <div class="hc-plot">${ticks.slice(1).map((v) => html`<div class="gl" style="bottom:${(v / top) * 100}%"></div>`)}
          <div class="lchart" style="position:absolute;inset:0">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <polygon points="${'0,100 ' + pts.join(' ') + ' 100,100'}" fill="${color}" fill-opacity="0.1"></polygon>
              <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"></polyline>
            </svg>
            ${n ? html`<span class="end-dot" style="left:${x(n - 1)}%;bottom:${100 - y(vals[n - 1])}%;background:${color}"></span>` : ''}
          </div>
          ${o.labels.map((l, i) => html`<div class="hc-col" style="background:none" data-tip="${l + ': ' + full(vals[i])}"></div>`)}
        </div>
        <div class="hc-x">${o.labels.map((l, i) => html`<span>${o.every && i % o.every ? '' : l}</span>`)}</div>
      </div>`;
    },
    donut(o) {
      const segs = o.segments.filter((s) => s.value > 0);
      const total = segs.reduce((a, s) => a + s.value, 0);
      const r = 56, L = 2 * Math.PI * r;
      let off = 0;
      const arcs = segs.map((s, i) => {
        const len = total ? (s.value / total) * L : 0;
        const gap = segs.length > 1 ? Math.min(2.5, len / 3) : 0;
        const out = html`<circle cx="70" cy="70" r="${r}" fill="none" stroke="${s.color || SERIES[i]}" stroke-width="18" stroke-dasharray="${(len - gap).toFixed(2) + ' ' + (L - len + gap).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"><title>${s.label + ': ' + s.value}</title></circle>`;
        off += len;
        return out;
      });
      return html`<div class="donut-wrap"><div class="donut" role="img" aria-label="${o.label || ''}"><svg viewBox="0 0 140 140"><circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--paper-2)" stroke-width="18"></circle>${arcs}</svg><div class="d-center"><b>${o.center != null ? o.center : total}</b><span>${o.centerLabel || 'total'}</span></div></div>
        <div class="d-legend">${o.segments.map((s, i) => html`<div><i style="background:${s.color || SERIES[i]}"></i><span>${s.label}</span><b>${o.fmt ? o.fmt(s.value) : s.value}</b></div>`)}</div></div>`;
    },
    hbars(rows, o) {
      o = o || {};
      const max = Math.max(1, ...rows.map((r) => r.value));
      return html`<div class="stack tight">${rows.map((r) => html`<div class="hbar" data-tip="${r.label + ': ' + (o.fmtFull || o.fmt || FT.n)(r.value)}"><span class="ellipsis">${r.label}</span><div class="bar ${r.tone || ''}"><i style="width:${Math.max(r.value ? 2 : 0, (r.value / max) * 100)}%;${r.color ? 'background:' + r.color : ''}"></i></div><b class="num">${(o.fmt || FT.n)(r.value)}</b></div>`)}</div>`;
    },
  };

  /* ---------------------------------------------------------- pickers */
  FT.taxYears = (back) => {
    const cur = U.taxYearOf(FT.today());
    const out = [];
    for (let y = cur; y >= cur - (back || 5); y--) out.push({ value: y, label: 'TY' + y + ' (Jul ' + (y - 1) + ' to Jun ' + y + ')' });
    return out;
  };
  FT.filingYearDefault = () => U.taxYearOf(FT.today()) - 1;
  FT.clientOptions = (clients) => clients.filter((c) => !c.archived).map((c) => ({ value: c.id, label: c.name + (c.ntn || c.cnic ? ' (' + (c.ntn || c.cnic) + ')' : '') }));
  FT.teamOptions = (team, emptyLabel) => [{ value: '', label: emptyLabel || 'Unassigned' }].concat(team.map((u) => ({ value: u.id, label: u.name })));
  FT.monthOptions = () => {
    const out = []; const base = FT.today().slice(0, 7) + '-01';
    for (let i = -2; i <= 10; i++) { const k = U.addMonths(base, -i).slice(0, 7); out.push({ value: k, label: U.monthLabel(k) }); }
    return out;
  };
  FT.quarterOptions = () => {
    const out = []; const y = +FT.today().slice(0, 4);
    for (let yy = y; yy >= y - 1; yy--) for (let q = 4; q >= 1; q--) out.push({ value: yy + '-Q' + q, label: U.periodLabel(yy + '-Q' + q) });
    return out;
  };
  let clientCache = null;
  FT.getClients = async (fresh) => { if (!clientCache || fresh) clientCache = await FT.api('clients.list'); return clientCache; };
  FT.listen('routed', () => { clientCache = null; });

  /* --------------------------------------------------------- doc viewer */
  FT.paperDoc = (d, firmName) => {
    const demo = d.demo || {};
    return html`<div class="paper-doc">
      ${d.approval && d.approval.status === 'approved' ? html`<span class="pd-stamp stamp lg green stamp-in">Approved</span>` : ''}
      <div class="pd-firm">${firmName || ''}</div>
      <h3>${demo.title || d.name}</h3>
      <div class="pd-meta">${d.clientName || ''}${d.taxYear ? ', Tax Year ' + d.taxYear : ''}</div>
      <table>${(demo.rows || []).map((r) => html`<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`)}</table>
      <div class="pd-note">Sample document from the FinTax demo data.</div>
    </div>`;
  };
  async function previewBlock(d, firmName) {
    if (d.demo) return FT.paperDoc(d, firmName);
    if (!d.blobId) return html`<div class="empty">${FT.fileIcon(d.name, d.mime)}<h3>${d.name}</h3><p>This sample file has no content to preview.</p></div>`;
    let blob = null;
    try { blob = await FT.files.get(d.blobId); } catch (e) { return html`<div class="callout danger">${FT.icon('circle-alert')}<span>${e.message}</span></div>`; }
    if (!blob) return html`<div class="empty">${FT.fileIcon(d.name, d.mime)}<h3>${d.name}</h3><p>The file content is not stored in this browser.</p></div>`;
    const url = URL.createObjectURL(blob);
    const mime = d.mime || blob.type || '';
    if (/^image\//.test(mime)) return html`<img class="preview-img" src="${url}" alt="${d.name}">`;
    if (mime === 'application/pdf' && !FT.preview) return html`<iframe class="preview-frame" src="${url}" title="${d.name}"></iframe>`;
    return html`<div class="empty">${FT.fileIcon(d.name, mime)}<h3>${d.name}</h3><p>${FT.bytes(d.size)}. Download the file to open it.</p><button type="button" class="btn btn-primary" data-dl>${FT.icon('download')}Download</button></div>`;
  }
  function commentList(comments, viewerRole) {
    if (!comments.length) return html`<p class="muted small">No comments yet.</p>`;
    return html`<div class="stack tight">${comments.map((c) => {
      const mine = (viewerRole === 'client') === (c.role === 'client');
      const kindPill = c.kind === 'changes' ? FT.pill('Changes requested', 'amber') : c.kind === 'approved' ? FT.pill('Approved', 'green') : c.kind === 'request' ? FT.pill('Approval request', 'violet') : c.internal ? FT.pill('Internal note', '') : '';
      return html`<div class="row top" style="gap:10px">${FT.avatar(c.name, 'sm')}<div class="grow"><div class="row wrap" style="gap:6px"><b class="small">${c.name}</b>${c.role === 'client' ? html`<span class="xs muted">client</span>` : ''}${kindPill}<span class="xs faint right">${FT.ago(c.createdAt)}</span></div><div class="small ink2" style="white-space:pre-wrap;margin-top:2px">${c.text}</div></div></div>${mine ? '' : ''}`;
    })}</div>`;
  }
  FT.openDoc = async (id, opts) => {
    opts = opts || {};
    const role = (FT.state.me && FT.state.me.user.role === 'client') ? 'client' : 'firm';
    const firmName = role === 'client' ? (FT.state.me.firmContact || {}).name : (FT.state.me.firm || {}).name;
    let m = null;
    const load = async () => {
      const r = await FT.api('doc.get', { id });
      const d = r.doc;
      const pending = d.approval && d.approval.status === 'pending';
      const meta = [d.category, d.taxYear ? 'TY' + d.taxYear : '', FT.bytes(d.size), (d.uploaderRole === 'client' ? 'Uploaded by client' : 'Uploaded by ' + (d.uploaderName || 'your consultant')) + ', ' + FT.ago(d.createdAt)].filter(Boolean).join(', ');
      const body = html`<div class="grid cols-main" style="align-items:start">
        <div class="stack">
          <div data-preview><div class="skel" style="height:320px"></div></div>
        </div>
        <div class="stack">
          <div class="stack tight">
            <div class="row wrap">${FT.approvalPill(d.approval)}${role === 'firm' ? (d.shared || d.uploaderRole === 'client' ? FT.pill('Visible to client', 'green') : FT.pill('Internal only', '')) : ''}</div>
            <div class="small muted">${meta}</div>
            ${d.note ? html`<div class="callout">${FT.icon('info')}<span>${d.note}</span></div>` : ''}
            ${d.approval && d.approval.status === 'changes' && d.approval.decisionNote ? html`<div class="callout warn">${FT.icon('message-square-text')}<span><b>Changes requested:</b> ${d.approval.decisionNote}</span></div>` : ''}
          </div>
          ${role === 'client' && pending ? html`<div class="sheet tinted"><div class="sheet-body stack">
              <b>Your approval is needed</b>
              <p class="small ink2">Check the figures. Approve if everything is correct, or tell us what to change.</p>
              <textarea class="textarea" id="dec-note" rows="3" placeholder="Feedback for your consultant (needed if you request changes)"></textarea>
              <div class="row wrap"><button type="button" class="btn btn-stamp" data-dec="approved">${FT.icon('stamp')}Approve</button><button type="button" class="btn" data-dec="changes">${FT.icon('pencil')}Request changes</button></div>
            </div></div>` : ''}
          <div class="row wrap">
            <button type="button" class="btn btn-sm" data-dl ${d.blobId ? '' : raw('disabled title="Sample files have no download"')}>${FT.icon('download')}Download</button>
            ${role === 'firm' ? html`
              ${!pending ? html`<button type="button" class="btn btn-sm btn-soft" data-req-approval>${FT.icon('stamp')}Ask client to approve</button>` : ''}
              ${d.uploaderRole === 'firm' ? html`<button type="button" class="btn btn-sm" data-share="${d.shared ? '0' : '1'}">${FT.icon(d.shared ? 'eye-off' : 'share-2')}${d.shared ? 'Stop sharing' : 'Share with client'}</button>` : ''}
              <button type="button" class="btn btn-sm btn-quiet" data-edit>${FT.icon('pencil')}Edit</button>
              <button type="button" class="btn btn-sm btn-quiet" data-del style="color:var(--margin)">${FT.icon('trash-2')}Delete</button>` : ''}
          </div>
          <div class="sheet plain"><div class="sheet-head"><h3>Comments</h3><span class="count soft">${r.comments.length}</span></div><div class="sheet-body stack">
            ${commentList(r.comments, role)}
            <form class="stack tight" data-comment>
              <textarea class="textarea" rows="2" name="text" placeholder="${role === 'client' ? 'Ask a question or leave feedback' : 'Write a comment'}" required data-label="Comment"></textarea>
              <div class="row">${role === 'firm' ? html`<label class="check"><input type="checkbox" name="internal"><span>Internal note, hidden from the client</span></label>` : ''}<button type="submit" class="btn btn-sm btn-primary right">${FT.icon('send')}Send</button></div>
            </form>
          </div></div>
        </div>
      </div>`;
      return { r, d, body };
    };
    const bind = (el, data) => {
      const d = data.d;
      previewBlock(d, firmName).then((p) => { const box = el.querySelector('[data-preview]'); if (box) { box.innerHTML = String(p); const b = box.querySelector('[data-dl]'); if (b) b.addEventListener('click', () => FT.files.download(d.blobId, d.name)); } });
      const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.addEventListener('click', async (e) => { e.preventDefault(); FT.busy(b, true); try { await fn(b); } catch (err) { FT.handleError(err); } finally { FT.busy(b, false); } }); };
      on('[data-dl]', () => FT.files.download(d.blobId, d.name));
      el.querySelectorAll('[data-dec]').forEach((b) => b.addEventListener('click', async () => {
        const note = el.querySelector('#dec-note').value.trim();
        if (b.dataset.dec === 'changes' && !note) { FT.toast('Tell your consultant what needs to change.', 'warn'); el.querySelector('#dec-note').focus(); return; }
        FT.busy(b, true);
        try { await FT.api('doc.decide', { id: d.id, decision: b.dataset.dec, note }); FT.toast(b.dataset.dec === 'approved' ? 'Approved. Your consultant has been notified.' : 'Sent to your consultant.'); await refresh(); if (opts.onChange) opts.onChange(); }
        catch (err) { FT.handleError(err); } finally { FT.busy(b, false); }
      }));
      on('[data-req-approval]', async () => {
        const res = await FT.formModal({ title: 'Ask the client to approve', sub: d.name, submitLabel: 'Send for approval', submitIcon: 'send', fields: [{ name: 'note', label: 'Message to the client', type: 'textarea', rows: 3, placeholder: 'Please review the figures and approve so we can file.' }], onSubmit: (v) => FT.api('doc.requestApproval', { id: d.id, note: v.note }) });
        if (res) { FT.toast('Sent to the client for approval'); await refresh(); if (opts.onChange) opts.onChange(); }
      });
      on('[data-share]', async (b) => { await FT.api('doc.update', { id: d.id, shared: b.dataset.share === '1' }); FT.toast(b.dataset.share === '1' ? 'Shared with the client' : 'No longer shared'); await refresh(); if (opts.onChange) opts.onChange(); });
      on('[data-edit]', async () => {
        const res = await FT.formModal({ title: 'Edit document', fields: [{ name: 'name', label: 'File name', required: true }, { name: 'category', label: 'Category', type: 'select', options: C.DOC_CATEGORIES, col: 6 }, { name: 'taxYear', label: 'Tax year', type: 'select', options: FT.taxYears(), col: 6 }, { name: 'note', label: 'Note', type: 'textarea', rows: 2 }], values: d, onSubmit: (v) => FT.api('doc.update', { id: d.id, name: v.name, category: v.category, taxYear: v.taxYear, note: v.note }) });
        if (res) { FT.toast('Document updated'); await refresh(); if (opts.onChange) opts.onChange(); }
      });
      on('[data-del]', async () => {
        if (!(await FT.confirm({ title: 'Delete this document?', message: d.name + ' and its comments will be removed for you and the client.', confirmLabel: 'Delete', danger: true }))) return;
        await FT.api('doc.delete', { id: d.id });
        FT.toast('Document deleted');
        m.close();
        if (opts.onChange) opts.onChange();
      });
      const form = el.querySelector('form[data-comment]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = FT.formData(form);
        if (!String(v.text || '').trim()) return;
        const b = form.querySelector('[type=submit]');
        FT.busy(b, true);
        try { await FT.api('doc.comment', { id: d.id, text: v.text, internal: !!v.internal }); await refresh(); if (opts.onChange) opts.onChange(); }
        catch (err) { FT.handleError(err); } finally { FT.busy(b, false); }
      });
    };
    const refresh = async () => { const data = await load(); m.el.querySelector('.modal-body').innerHTML = String(data.body); m.el.querySelector('h2').textContent = data.d.name; bind(m.el, data); };
    const first = await load();
    m = FT.modal({ size: 'xl', title: first.d.name, sub: first.d.clientName, body: first.body, mount: (el) => bind(el, first) });
    return m;
  };

  /* ------------------------------------------------------------ uploads */
  FT.uploadDocs = async (o) => {
    o = o || {};
    const clients = o.clientId ? null : await FT.getClients();
    const fields = [];
    if (!o.clientId) fields.push({ name: 'clientId', label: 'Client', type: 'select', required: true, placeholder: 'Choose a client', options: FT.clientOptions(clients) });
    fields.push(
      { name: 'files', type: 'file', multiple: true, label: 'Files' },
      { name: 'category', label: 'Category', type: 'select', options: C.DOC_CATEGORIES, col: 6, value: o.category || 'Other' },
      { name: 'taxYear', label: 'Tax year', type: 'select', options: FT.taxYears(), col: 6, value: o.taxYear || FT.filingYearDefault() },
      { name: 'shared', label: 'Share with the client in their portal', type: 'switch', value: o.shared !== undefined ? o.shared : true },
      { name: 'approval', label: 'Ask the client to approve these files', type: 'switch', value: !!o.approval, hint: 'Use this for draft returns, wealth statements and financial statements.' },
      { name: 'note', label: 'Note', type: 'textarea', rows: 2, placeholder: 'Optional message shown with the file' },
    );
    return FT.formModal({
      title: o.title || 'Upload documents', sub: o.sub, size: 'lg', submitLabel: 'Upload', submitIcon: 'upload', fields,
      onSubmit: async (v) => {
        const files = v._files.files || [];
        if (!files.length) throw new Error('Choose at least one file to upload.');
        const clientId = o.clientId || v.clientId;
        const out = [];
        for (const f of files) {
          const up = await FT.files.upload(f);
          out.push(await FT.api('doc.create', { clientId, name: f.name, mime: up.mime, size: up.size, blobId: up.blobId, category: v.category, taxYear: v.taxYear, shared: v.shared, approval: v.approval, note: v.note, requestId: o.requestId, filingId: o.filingId }));
        }
        FT.toast(FT.plural(out.length, 'file') + ' uploaded' + (v.approval ? ' and sent for approval' : ''));
        return out;
      },
    });
  };
  const COMMON_DOCS = ['CNIC copy (front and back)', 'Salary certificate', 'Bank statement for the tax year', 'Bank profit and withholding certificate', 'Utility bills', 'Property documents', 'Vehicle registration book', 'Rent agreement', 'Sales and purchase registers', 'Annual accounts'];
  FT.requestDocs = async (o) => {
    o = o || {};
    const clients = o.clientId ? null : await FT.getClients();
    const fields = [];
    if (!o.clientId) fields.push({ name: 'clientId', label: 'Client', type: 'select', required: true, placeholder: 'Choose a client', options: FT.clientOptions(clients) });
    fields.push(
      { name: 'picks', label: 'Common documents', type: 'chips', options: COMMON_DOCS },
      { name: 'titles', label: 'Other documents, one per line', type: 'textarea', rows: 3, placeholder: 'e.g. Fee receipts of children\'s school' },
      { name: 'dueDate', label: 'Needed by', type: 'date', col: 6, value: U.addDays(FT.today(), 7) },
      { name: 'note', label: 'Message', type: 'textarea', rows: 2, placeholder: 'Shown to the client with the request' },
    );
    return FT.formModal({
      title: 'Request documents', sub: o.clientName ? 'From ' + o.clientName : 'The client sees the list in their portal and can upload each item from their phone.', size: 'lg', submitLabel: 'Send request', submitIcon: 'send', fields,
      onSubmit: async (v) => {
        const titles = (v.picks || []).concat(String(v.titles || '').split('\n').map((s) => s.trim()).filter(Boolean));
        if (!titles.length) throw new Error('Pick or type at least one document.');
        const r = await FT.api('request.save', { clientId: o.clientId || v.clientId, titles, dueDate: v.dueDate, note: v.note });
        FT.toast(FT.plural(r.length, 'request') + ' sent');
        return r;
      },
    });
  };
  FT.portalUpload = async (o) => {
    o = o || {};
    return FT.formModal({
      title: o.title ? 'Upload: ' + o.title : 'Upload documents', sub: 'Take a photo or choose a file. Your consultant is notified straight away.', size: 'lg', submitLabel: 'Upload', submitIcon: 'upload',
      fields: [
        { name: 'files', type: 'file', multiple: true, label: 'Files', cta: 'Tap to take a photo or choose files', accept: 'image/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv' },
        { name: 'category', label: 'What is it?', type: 'select', options: C.DOC_CATEGORIES, col: 6, value: o.category || 'Other' },
        { name: 'taxYear', label: 'Tax year', type: 'select', options: FT.taxYears(), col: 6, value: FT.filingYearDefault() },
        { name: 'note', label: 'Note for your consultant', type: 'textarea', rows: 2 },
      ],
      onSubmit: async (v) => {
        const files = v._files.files || [];
        if (!files.length) throw new Error('Choose at least one file to upload.');
        let n = 0;
        for (const f of files) {
          const up = await FT.files.upload(f);
          await FT.api('portal.upload', { name: f.name, mime: up.mime, size: up.size, blobId: up.blobId, category: v.category, taxYear: v.taxYear, note: v.note, requestId: n === 0 ? o.requestId : null });
          n++;
        }
        FT.toast(FT.plural(n, 'file') + ' uploaded. Your consultant has been notified.');
        return n;
      },
    });
  };

  /* -------------------------------------------------- credential notice */
  FT.showCredentials = (o) => FT.alertBox({
    title: o.title || 'Login created', sub: o.sub || 'Share these details with the client. The password is shown only once.',
    body: html`<div class="stack">
      <div class="sheet tinted"><div class="sheet-body"><div class="dl">
        <div>Sign-in page</div><div>${FT.copyable(o.url || FT.loginUrl())}</div>
        <div>Email</div><div>${FT.copyable(o.email)}</div>
        <div>Password</div><div>${FT.copyable(o.password)}</div>
      </div></div></div>
      ${o.phone ? html`<div class="row wrap">${FT.waBtn(o.phone, 'Assalam o Alaikum ' + (o.name || '') + '. Your ' + FT.brandName() + ' portal is ready. Sign in at ' + (o.url || FT.loginUrl()) + ' with ' + o.email + ' and password ' + o.password + '. Please change the password after signing in.', 'Send on WhatsApp', 'btn-sm')}</div>` : ''}
      <p class="xs muted">Ask them to change the password after the first sign-in from their profile.</p>
    </div>`,
  });
  FT.loginUrl = () => { try { if (FT.preview) return 'the FinTax sign-in page'; return location.origin + location.pathname.replace(/index\.html$/, '') + '#/login'; } catch (e) { return '#/login'; } };
})();
