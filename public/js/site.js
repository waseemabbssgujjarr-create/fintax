/*! FinTax website and sign-in pages. Everything persuasive here is driven by real data:
 * seat counts come from actual sign-ups, countdowns from dates the admin sets, deadlines from
 * the compliance calendar, and activity toasts only from real new practices.
 */
(function () {
  'use strict';
  const FT = window.FT;
  const { html, raw, U } = FT;

  const getSite = async (fresh) => {
    if (!FT.state.site || fresh || Date.now() - (FT.state.siteAt || 0) > 60000) { FT.state.site = await FT.api('public.site'); FT.state.siteAt = Date.now(); }
    FT.applyBrand(FT.state.site.brand);
    return FT.state.site;
  };
  FT.getSite = getSite;

  const cd = (iso) => {
    const ms = Math.max(0, Date.parse(iso) - Date.now());
    const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60;
    return { d, h, m, s, done: ms <= 0, text: (d ? d + 'd ' : '') + String(h).padStart(2, '0') + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's' };
  };
  const daysLeft = (ds) => U.diffDays(ds, FT.today());

  /* ------------------------------------------------------------ pieces */
  function annBar(site) {
    const o = site.offer;
    const a = site.site.announcement || {};
    if (!(o && o.active) && !a.enabled) return '';
    return html`<div class="ann"><div class="wrap">
      ${a.enabled ? html`<span>${a.text}</span>` : ''}
      ${o && o.active ? html`<span class="ann-seats"><span class="bar" aria-hidden="true"><i style="width:${Math.min(100, (o.taken / Math.max(1, o.seats)) * 100)}%"></i></span><span><b>${o.left}</b> of ${o.seats} founding seats left</span></span>
        <span>Closes in <span class="cd" data-countdown="${o.deadline}">${cd(o.deadline).text}</span></span>
        <a href="#/signup?plan=firm&amp;cycle=annual">Claim a seat</a>` : ''}
    </div></div>`;
  }
  function nav() {
    return html`<header class="nav" id="site-nav"><div class="wrap">
      <a class="nav-brand" href="#/" aria-label="${FT.brandName()} home">${FT.brandLockup()}</a>
      <nav class="nav-links" aria-label="Website">
        <a href="#/" data-scroll="why">Why ${FT.brandName()}</a>
        <a href="#/" data-scroll="features">Features</a>
        <a href="#/" data-scroll="pricing">Pricing</a>
        <a href="#/" data-scroll="calculator">Tax calculator</a>
        <a href="#/" data-scroll="faq">FAQ</a>
      </nav>
      <div class="nav-cta">
        ${FT.pwa.standalone() ? '' : html`<button class="btn btn-quiet btn-sm hide-nav" data-act="install">${FT.icon('smartphone')}Install app</button>`}
        ${FT.state.me ? html`<a class="btn btn-sm" href="${'#' + FT.homeFor(FT.state.me.user)}">Open dashboard</a>` : html`<a class="btn btn-quiet btn-sm hide-sm" href="#/login">Sign in</a>`}
        <a class="btn btn-primary btn-sm" href="#/signup">Start free trial</a>
        <button class="icon-btn menu-btn" data-act="site-menu" aria-label="Open menu">${FT.icon('menu')}</button>
      </div>
    </div></header>`;
  }
  FT.act('site-menu', () => {
    const el = document.createElement('div');
    el.className = 'mobile-menu';
    el.innerHTML = String(html`<div class="row between" style="margin-bottom:8px"><span class="row">${FT.brandLockup()}</span><button class="icon-btn" data-close-menu aria-label="Close menu">${FT.icon('x')}</button></div>
      ${['why', 'features', 'pricing', 'calculator', 'faq'].map((k) => html`<a class="mm" href="#/" data-scroll="${k}">${{ why: 'Why ' + FT.brandName(), features: 'Features', pricing: 'Pricing', calculator: 'Tax calculator', faq: 'FAQ' }[k]}</a>`)}
      <a class="mm" href="#/login">Sign in</a>
      <div class="stack mt-3"><a class="btn btn-primary btn-lg" href="#/signup">Start free trial</a>${FT.installBtn('btn-lg')}</div>`);
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-close-menu], a, [data-act]')) el.remove(); });
  });

  function caseFile(site) {
    const fd = (site.deadlines || []).find((d) => d.featured) || (site.deadlines || [])[0];
    const next = (site.deadlines || []).find((d) => !d.featured && d.date > (fd ? fd.date : '')) || (site.deadlines || [])[1];
    return html`<div class="casefile" aria-label="Example client file in ${FT.brandName()}">
      <div class="cf-back" aria-hidden="true"></div>
      <div class="cf-tab" aria-hidden="true">Client file, TY${U.taxYearOf(FT.today()) - 1}</div>
      <div class="cf-sheet">
        <div class="cf-head">${FT.avatar('Muhammad Asif', '', {})}<div class="who"><b>Muhammad Asif</b><span>Salaried, Lahore. ATL active</span></div></div>
        <div class="cf-lines">
          <div class="cf-line">${FT.icon('circle-check', '')}<span class="lbl">Salary certificate</span><span class="xs muted">uploaded by client</span></div>
          <div class="cf-line">${FT.icon('circle-check', '')}<span class="lbl">Bank statement, full year</span><span class="xs muted">uploaded by client</span></div>
          <div class="cf-line">${FT.icon('file-text', '')}<span class="lbl">Draft return</span><span class="val green">Refund Rs 8,750</span></div>
          <div class="cf-line">${FT.icon('file-text', '')}<span class="lbl">Wealth statement</span><span class="val">Rs 16,236,940</span></div>
        </div>
        <span class="cf-stamp stamp lg stamp-in" style="animation-delay:.9s">Approved</span>
        <div class="cf-foot">${FT.pill('Ready to file', 'green')}${fd ? FT.pill('Due ' + FT.dateShort(fd.date), daysLeft(fd.date) <= 10 ? 'red' : 'amber') : ''}<span class="xs muted right">Approved on his phone, ${FT.timeOf(new Date(Date.now() - 600000).toISOString())}</span></div>
      </div>
      <div class="cf-float one">${FT.icon('file-up')}<div><b>Meher Textiles uploaded</b>Sales register, 3 min ago</div></div>
      ${next ? html`<div class="cf-float two">${FT.dateTile(next.date)}<div><b>${next.title}</b>${daysLeft(next.date)} days left</div></div>` : ''}
    </div>`;
  }
  function rail(site) {
    const ds = (site.deadlines || []).slice(0, 4);
    if (!ds.length) return '';
    return html`<section class="rail" aria-label="Upcoming tax deadlines"><div class="wrap"><div class="rail-sheet" style="--n:${ds.length}">
      <div class="rail-title"><b>Coming deadlines</b><span>Pre-loaded in every ${FT.brandName()} calendar</span></div>
      ${ds.map((d) => { const n = daysLeft(d.date); return html`<div class="rail-item ${n <= 10 ? 'hot' : ''}"><div class="ri-days">${n}<small>${n === 1 ? 'day' : 'days'}</small></div><div class="ri-title">${d.title}${d.forPeriod ? html`<span class="muted" style="font-weight:500">, ${d.forPeriod}</span>` : ''}</div><div class="ri-date">${FT.date(d.date)}${d.note ? '. ' + d.note : ''}</div></div>`; })}
    </div></div></section>`;
  }
  function why(site) {
    const brand = FT.brandName();
    const values = [
      ['clipboard-list', 'Collect documents without chasing anyone', 'Send a checklist once. Clients upload CNIC copies, salary certificates and bank statements from their phone, and each upload ticks off the request.', 'Fewer follow-up calls'],
      ['calendar-clock', 'Stop deadlines slipping through', 'FBR and PRA monthly returns, quarterly withholding statements, advance tax and annual returns come pre-loaded. Anything overdue turns red on your dashboard.', 'Every due date in one place'],
      ['stamp', 'Get approvals in writing', 'Clients approve a draft return or wealth statement with one tap, or tell you what to change. Each decision is time-stamped, so you have proof of consent if a figure is ever questioned.', 'An audit trail for every approval'],
      ['wallet', 'Get paid faster', 'Send fee invoices in PKR with your bank, Raast and JazzCash details. Clients submit their transaction ID, you confirm it, and receivables aging shows who still owes you.', 'See who owes what, today'],
      ['gavel', 'Handle notices calmly', 'Log every s.114(4), 122(9), 176 or 177 notice with its reply date and hearing. Assign it, attach the reply, and let the calendar remind you.', 'No missed compliance dates'],
      ['users-round', 'Take on more clients with the same team', 'Assign clients, returns and tasks to staff, see workload at a glance, and create next month\'s sales tax returns for every registered client in one step.', 'More clients per person'],
    ];
    return html`<section class="section" id="why"><div class="wrap">
      <div class="sec-head"><h2>Why ${brand} pays for itself in your first season</h2><p>Most practices do not lose money on tax work. They lose it in the hours around it: chasing papers, searching chats, re-checking dates and following up on fees. ${brand} takes that work off your desk.</p></div>
      <div class="cost-strip">
        <div class="cost"><div class="c-num">17<small>hours a week</small></div><h3>Spent chasing paperwork</h3><p>At 100 clients and ten minutes of follow-up per client each week, that is how much time goes into reminders alone. Do the maths for your own practice in the calculator below.</p></div>
        <div class="cost"><div class="c-num">1<small>missed date</small></div><h3>Is all it takes</h3><p>A late return brings penalties for your client, can keep them off the Active Taxpayers List, and puts your reputation on the line. Spreadsheets and memory do not warn you in time.</p></div>
        <div class="cost"><div class="c-num">0<small>rupees</small></div><h3>For fees you forget to bill</h3><p>In peak season, small jobs go uninvoiced and reminders go unsent. Work you never bill is work you never get paid for.</p></div>
      </div>
      <div class="value-grid">${values.map((v) => html`<div class="value"><div class="v-ic">${FT.icon(v[0])}</div><div><h3>${v[1]}</h3><p>${v[2]}</p><span class="v-gain">${v[3]}</span></div></div>`)}</div>
      <div class="mt-4"><div class="dayvs">
        <div class="day old"><h3>${FT.icon('triangle-alert')}A return-season day today</h3>
          <div class="slot bad"><time>9:30</time><span>Scroll back through WhatsApp to find one client's salary certificate.</span></div>
          <div class="slot bad"><time>11:00</time><span>Call three clients to ask, again, for their bank statements.</span></div>
          <div class="slot bad"><time>1:00</time><span>Search email for last year's return to copy the wealth figures.</span></div>
          <div class="slot bad"><time>3:30</time><span>Notice a client's sales tax return was due yesterday.</span></div>
          <div class="slot bad"><time>5:30</time><span>Type fee reminders one by one, if there is time left.</span></div>
          <div class="total"><span>Most of the day goes on follow-up</span><span class="muted">Unbillable</span></div>
        </div>
        <div class="day new"><h3>${FT.icon('sparkles')}The same day with ${brand}</h3>
          <div class="slot"><time>9:30</time><span>The dashboard shows three uploads that arrived overnight, matched to your requests.</span></div>
          <div class="slot"><time>10:15</time><span>Send the draft return. The client approves it on their phone before lunch.</span></div>
          <div class="slot"><time>11:00</time><span>File on IRIS and record the acknowledgement. The client sees it straight away.</span></div>
          <div class="slot"><time>2:00</time><span>Create next month's sales tax returns for all registered clients in one step.</span></div>
          <div class="slot"><time>4:30</time><span>Send invoices. A client pays by Raast and submits the transaction ID.</span></div>
          <div class="total"><span>Time back for billable work</span><span>${FT.icon('trending-up')}</span></div>
        </div>
      </div></div>
    </div></section>`;
  }
  function roi(site) {
    const plan = (site.plans || [])[0] || { monthly: 3499, name: 'Practice' };
    return html`<section class="section tight" id="roi"><div class="wrap">
      <div class="calc" data-roi data-price="${plan.monthly}">
        <div class="calc-in">
          <div><h2 class="wide" style="font-size:1.6rem;font-weight:800;letter-spacing:-0.03em">What is the admin work costing you?</h2><p class="muted small mt-1">Move the sliders to match your practice. The estimate uses only your numbers.</p></div>
          <div class="slider"><div class="row"><label class="label" for="roi-c">Active clients</label><output id="roi-c-o">120</output></div><input type="range" id="roi-c" min="10" max="600" step="10" value="120"></div>
          <div class="slider"><div class="row"><label class="label" for="roi-m">Minutes per client each week on reminders, searching and re-checking</label><output id="roi-m-o">15</output></div><input type="range" id="roi-m" min="2" max="60" step="1" value="15"></div>
          <div class="slider"><div class="row"><label class="label" for="roi-r">What an hour of your time is worth</label><output id="roi-r-o">Rs 2,000</output></div><input type="range" id="roi-r" min="500" max="10000" step="250" value="2000"></div>
          <div class="slider"><div class="row"><label class="label" for="roi-s">Share of that work ${FT.brandName()} takes over</label><output id="roi-s-o">50%</output></div><input type="range" id="roi-s" min="10" max="90" step="5" value="50"></div>
        </div>
        <div class="calc-out" aria-live="polite">
          <span class="lbl">Time you get back every month</span>
          <div class="big" id="roi-hours">65 hours</div>
          <div class="rows">
            <div><span>Value of that time</span><b id="roi-value">Rs 130,000</b></div>
            <div><span>${plan.name} plan</span><b id="roi-cost">Rs ${FT.n(plan.monthly)} a month</b></div>
            <div><span>Return on the subscription</span><b id="roi-x">37x</b></div>
          </div>
          <a class="btn btn-lg" style="--b-bg:#fff;--b-fg:var(--ledger-ink);--b-bd:#fff" href="#/signup">Get those hours back</a>
          <span class="note">An estimate from the values you entered, not a guarantee.</span>
        </div>
      </div>
    </div></section>`;
  }
  function how() {
    return html`<section class="section band" id="how"><div class="wrap">
      <div class="sec-head"><h2>Up and running before your next client calls</h2><p>No installation and no training course. If you can use WhatsApp, you can run your practice on ${FT.brandName()}.</p></div>
      <div class="how">
        <div class="how-step"><h3>Add your clients</h3><p>Type them in or import a CSV from Excel with names, CNIC or NTN, phone and email. Registrations with FBR, PRA, SRB, KPRA or BRA are tagged on each profile.</p></div>
        <div class="how-step"><h3>Invite them to their portal</h3><p>Create a login for each client and share it on WhatsApp in one tap. They upload, approve and pay from their own phone.</p></div>
        <div class="how-step"><h3>Work the season from one screen</h3><p>Track every return from documents to filed, reply to notices on time, and send invoices. Your team sees exactly what to do next.</p></div>
      </div>
    </div></section>`;
  }
  const MODULES = [
    { id: 'portal', icon: 'smartphone', title: 'Client portal', text: 'Uploads, approvals, invoices and chat on the client\'s phone' },
    { id: 'filings', icon: 'square-kanban', title: 'Returns and filings', text: 'A board for every return, from documents to filed' },
    { id: 'notices', icon: 'gavel', title: 'Notice tracker', text: 'Reply dates and hearings that cannot be forgotten' },
    { id: 'billing', icon: 'receipt', title: 'Fees and receivables', text: 'PKR invoices, payment proofs and aging' },
    { id: 'team', icon: 'users-round', title: 'Team and reports', text: 'Assign work and see who is carrying what' },
  ];
  function moduleView(id) {
    const row = (a, b, c) => html`<div class="li" style="padding:10px 0">${a}<div class="li-main"><div class="li-title">${b}</div><div class="li-sub">${c[0]}</div></div><div class="li-side">${c[1]}</div></div>`;
    if (id === 'portal') return html`<div class="row between"><b>Asif's portal</b>${FT.pill('2 actions needed', 'violet')}</div>
      <div class="callout violet">${FT.icon('stamp')}<span><b>Approve your draft return.</b> Review the figures, then approve or ask for changes.</span></div>
      ${row(html`<span class="li-icon amber">${FT.icon('clipboard-list')}</span>`, 'Bank profit certificate', ['Requested by your consultant', FT.pill('Upload', 'amber')])}
      ${row(html`<span class="li-icon green">${FT.icon('receipt')}</span>`, 'Invoice RTA-2026-0031', ['Rs 15,500, due in 5 days', FT.pill('Pay', 'line')])}
      ${row(html`<span class="li-icon">${FT.icon('message-square')}</span>`, 'Message from Hina', ['We file the same day you approve.', html`<span class="xs muted">2 h</span>`])}`;
    if (id === 'filings') return html`<div class="row between"><b>Returns board</b><span class="xs muted">Tax Year ${U.taxYearOf(FT.today()) - 1}</span></div>
      <div class="grid cols-3" style="gap:8px">${[['Awaiting documents', 'amber', ['Bilal Ahmed', 'Swift Cargo']], ['Client approval', 'violet', ['Muhammad Asif', 'Meher Textiles']], ['Filed', 'green', ['Dr. Sana Malik', 'Khan & Sons']]].map((c) => html`<div class="kcol" style="min-height:0"><div class="kcol-head" style="font-size:.74rem">${c[0]}</div><div class="kcol-body">${c[2].map((n) => html`<div class="kcard" style="padding:8px"><div class="kc-title" style="font-size:.78rem">${n}</div>${FT.pill(c[0] === 'Filed' ? 'Filed' : 'Due 31 Oct', c[1])}</div>`)}</div></div>`)}</div>`;
    if (id === 'notices') return html`<div class="row between"><b>Open notices</b>${FT.pill('1 due this week', 'red')}</div>
      ${row(FT.dateTile(U.addDays(FT.today(), 4), 'red'), 's.114(4) Notice to file return', ['Bilal Ahmed, assigned to Omer', FT.pill('Preparing reply', 'violet')])}
      ${row(FT.dateTile(U.addDays(FT.today(), 14), 'amber'), 'Sales Tax Act s.11 show cause', ['Meher Textiles, hearing in 16 days', FT.pill('Received', 'amber')])}
      ${row(FT.dateTile(U.addDays(FT.today(), 22)), 's.122(9) Show cause', ['Swift Cargo, Rs 640,000 involved', FT.pill('Preparing reply', 'violet')])}`;
    if (id === 'billing') return html`<div class="row between"><b>Receivables</b><b class="num">Rs 243,100 due</b></div>
      ${FT.chart.hbars([{ label: 'Not yet due', value: 96600 }, { label: '1 to 30 days late', value: 88000 }, { label: '31 to 60 days', value: 46900, tone: 'amber' }, { label: 'Over 60 days', value: 11600, tone: 'red' }], { fmt: FT.moneyShort, fmtFull: FT.money })}
      ${row(html`<span class="li-icon green">${FT.icon('wallet')}</span>`, 'Noor Fatima paid Rs 22,000', ['JazzCash, transaction JC-77129034', html`<span class="btn btn-sm btn-soft">Confirm</span>`])}`;
    return html`<div class="row between"><b>Team workload</b><span class="xs muted">Open returns</span></div>
      ${FT.chart.hbars([{ label: 'Hina Javed', value: 9 }, { label: 'Omer Farooq', value: 6 }, { label: 'Abdul Rehman', value: 5 }])}
      <div class="callout">${FT.icon('list-checks')}<span>Hina finished 14 tasks this week. Omer has 2 overdue items to pick up.</span></div>`;
  }
  function modules() {
    return html`<section class="section" id="features"><div class="wrap">
      <div class="sec-head"><h2>Everything a Pakistani tax practice runs on</h2><p>Built around the work you already do: CNICs and NTNs, IRIS acknowledgements, Annexure-C, notices under the Income Tax Ordinance and the Sales Tax Act, and fees in rupees.</p></div>
      <div class="modules">
        <div class="mod-tabs" role="tablist">${MODULES.map((m, i) => html`<button class="mod-tab ${i === 0 ? 'active' : ''}" role="tab" aria-selected="${i === 0 ? 'true' : 'false'}" data-mod="${m.id}"><span class="mt-ic">${FT.icon(m.icon)}</span><span><b>${m.title}</b><span>${m.text}</span></span>${FT.icon('chevron-right')}</button>`)}</div>
        <div class="mod-view"><div class="mv-bar"><i></i><i></i><i></i><span style="margin-left:6px">${FT.brandName()}</span></div><div class="mv-body" id="mod-body">${moduleView('portal')}</div></div>
      </div>
    </div></section>`;
  }
  function pricing(site) {
    const o = site.offer;
    const plans = site.plans || [];
    const card = (p) => {
      const save = Math.max(0, p.monthly * 12 - p.annual);
      const months = p.monthly ? Math.round(save / p.monthly) : 0;
      return html`<article class="plan ${p.highlight ? 'hi' : ''}" data-plan="${p.id}">
        ${p.badge ? html`<span class="p-badge stamp ${p.highlight ? '' : 'green'}" style="background:var(--sheet)">${p.badge}</span>` : ''}
        <div><h3>${p.name}</h3><p class="p-tag">${p.tagline}</p></div>
        <div>
          <div class="p-price"><span class="amt" data-annual="${FT.n(p.annual)}" data-monthly="${FT.n(p.monthly)}">Rs ${FT.n(p.annual)}</span><span class="per" data-per-annual="a year" data-per-monthly="a month">a year</span></div>
          <div class="p-anchor mt-1" data-anchor><s>Rs ${FT.n(p.monthly * 12)}</s> if paid monthly</div>
        </div>
        ${save > 0 ? html`<span class="p-save" data-save>${months >= 1 ? months + ' months free, save Rs ' + FT.n(save) : 'Save Rs ' + FT.n(save)}</span>` : ''}
        <ul>${(p.bullets || []).map((b) => html`<li>${FT.icon('check')}<span>${b}</span></li>`)}</ul>
        <a class="btn btn-primary btn-lg btn-block" data-plan-cta href="${'#/signup?plan=' + p.id + '&cycle=annual'}">${p.cta || 'Start free trial'}</a>
        <div class="p-day" data-day-annual="${'Works out to Rs ' + FT.n(p.annual / 365) + ' a day'}" data-day-monthly="${'About Rs ' + FT.n(p.monthly / 30) + ' a day'}">Works out to Rs ${FT.n(p.annual / 365)} a day</div>
      </article>`;
    };
    return html`<section class="section band" id="pricing"><div class="wrap">
      <div class="sec-head"><h2>Two plans. Prices in rupees. No surprises.</h2><p>Start with a ${site.trialDays}-day free trial of everything. Pick a plan when you are ready, pay by bank transfer, Raast, JazzCash or Easypaisa.</p></div>
      <div class="price-top">
        <div class="seg" role="tablist" aria-label="Billing period"><button class="active" data-cycle="annual">Yearly</button><button data-cycle="monthly">Monthly</button></div>
        ${o && o.active ? html`<div class="offer-box">
          <div class="ob-seats"><b class="small">${o.title}</b><span class="bar" aria-hidden="true"><i style="width:${Math.min(100, (o.taken / Math.max(1, o.seats)) * 100)}%"></i></span><span class="xs muted">${o.left} of ${o.seats} seats left. ${o.note}</span></div>
          <div class="cd-cells" data-countdown-cells="${o.deadline}" aria-label="Time left on the offer">${['d', 'h', 'm', 's'].map((k) => html`<div><b data-k="${k}">${String(cd(o.deadline)[k]).padStart(2, '0')}</b><small>${{ d: 'days', h: 'hours', m: 'min', s: 'sec' }[k]}</small></div>`)}</div>
        </div>` : ''}
      </div>
      <div class="plans">${plans.map(card)}</div>
      <div class="assurances"><span>${FT.icon('shield-check')}${site.site.guarantee}</span><span>${FT.icon('lock')}Each practice's data kept separate</span><span>${FT.icon('smartphone')}Installs on Android, iPhone and desktop</span></div>
    </div></section>`;
  }
  function calculator(site) {
    const years = (site.tax && site.tax.years) || [];
    return html`<section class="section" id="calculator"><div class="wrap">
      <div class="sec-head"><h2>Free income tax calculator</h2><p>Check a salaried or business income estimate for the current or last tax year. Use it with clients, or share it on your own page.</p></div>
      <div class="calc" data-tax>
        <div class="calc-in">
          <div class="form">
            <div class="field"><label class="label" for="tx-year">Tax year</label><select class="select" id="tx-year">${years.map((y) => html`<option value="${y.year}">${y.label}</option>`)}</select></div>
            <div class="field span-6"><span class="label">Income type</span><div class="seg" role="radiogroup"><button type="button" class="active" data-tt="salaried">Salaried</button><button type="button" data-tt="business">Business and other</button></div></div>
            <div class="field span-6"><label class="label" for="tx-inc">Taxable income</label><div class="affix"><span>Rs</span><input class="input" id="tx-inc" inputmode="numeric" value="250,000" autocomplete="off"></div></div>
            <div class="field span-6"><span class="label">Entered as</span><div class="seg" role="radiogroup"><button type="button" class="active" data-per="month">Per month</button><button type="button" data-per="year">Per year</button></div></div>
          </div>
          <p class="xs muted">${(site.tax && site.tax.note) || ''}</p>
        </div>
        <div class="calc-out" aria-live="polite">
          <span class="lbl">Estimated tax for the year</span>
          <div class="big" id="tx-total">Rs 0</div>
          <div class="rows">
            <div><span>Per month</span><b id="tx-month">Rs 0</b></div>
            <div><span>Effective rate</span><b id="tx-eff">0%</b></div>
            <div><span>Surcharge</span><b id="tx-sur">Rs 0</b></div>
          </div>
          <div class="stack tight xs" id="tx-break" style="color:rgba(244,247,243,.75)"></div>
          <a class="btn" style="--b-bg:#fff;--b-fg:var(--ledger-ink);--b-bd:#fff" href="#/signup">Manage your clients' returns in ${FT.brandName()}</a>
        </div>
      </div>
    </div></section>`;
  }
  function proof(site) {
    const t = site.testimonials || [];
    const s = site.stats;
    if (!t.length && !s) return '';
    return html`<section class="section tight"><div class="wrap">
      ${s ? html`<div class="stats-row"><div><b>${FT.n(s.practices)}</b><span>practices on ${FT.brandName()}</span></div><div><b>${FT.n(s.clients)}</b><span>clients managed</span></div><div><b>${FT.n(s.documents)}</b><span>documents organized</span></div><div><b>${FT.n(s.filed)}</b><span>returns marked filed</span></div></div>` : ''}
      ${t.length ? html`<div class="quotes">${t.map((q) => html`<figure class="quote" style="margin:0"><div class="stars" aria-label="${q.rating} out of 5">${Array.from({ length: q.rating }, () => FT.icon('star'))}</div><blockquote>${q.quote}</blockquote><figcaption class="row">${FT.avatar(q.name)}<div><b class="small">${q.name}</b><div class="xs muted">${[q.role, q.city].filter(Boolean).join(', ')}</div></div></figcaption></figure>`)}</div>` : ''}
    </div></section>`;
  }
  function faq(site) {
    if (!(site.faqs || []).length) return '';
    return html`<section class="section band" id="faq"><div class="wrap faq">
      <div><h2 class="wide" style="font-size:clamp(1.8rem,3.4vw,2.6rem);font-weight:820;letter-spacing:-0.035em;line-height:1.05">Questions consultants ask us</h2><p class="muted mt-2">Something else on your mind? <a href="#/" data-act="contact">Send us a message</a>.</p></div>
      <div class="faq-list">${site.faqs.map((f, i) => html`<details class="faq-item" ${i === 0 ? raw('open') : ''}><summary>${f.q}${FT.icon('plus')}</summary><p>${f.a}</p></details>`)}</div>
    </div></section>`;
  }
  function finalCta(site) {
    const d = (site.deadlines || [])[0];
    return html`<section class="section final" id="start"><div class="wrap"><div class="final-card">
      <div>
        <h2>${d ? 'The next deadline is ' + daysLeft(d.date) + ' days away.' : 'Tax season waits for no one.'}</h2>
        <p>${d ? 'Next up: ' + d.title + ', ' + FT.date(d.date) + '. Get every client file in order before then, and start your ' + site.trialDays + '-day free trial today.' : 'Start your free trial today and walk into the next deadline with every client file in order.'}</p>
        <div class="row wrap mt-3"><a class="btn btn-primary btn-lg" href="#/signup">Start free trial</a>${FT.installBtn('btn-lg')}</div>
      </div>
      <form class="lead-form" data-lead="Walkthrough request">
        <b>Prefer a walkthrough first?</b>
        <span class="small" style="color:rgba(244,247,243,.75)">Leave your number and we will call you for a 15-minute demo.</span>
        <input class="input" name="name" placeholder="Your name" required data-label="Your name" autocomplete="name">
        <input class="input" name="phone" placeholder="Mobile or WhatsApp number" inputmode="tel" autocomplete="tel">
        <input class="input" name="practice" placeholder="Practice name and city">
        <button class="btn btn-lg" type="submit" style="--b-bg:var(--amber);--b-fg:#fff;--b-bd:var(--amber)">Request a call back</button>
      </form>
    </div></div></section>`;
  }
  function footer(site) {
    const c = site.site.contact || {};
    const so = site.site.social || {};
    return html`<footer class="footer"><div class="wrap">
      <div class="stack">
        <span class="row">${FT.brandLockup()}</span>
        <p class="small" style="max-width:38ch">${site.site.tagline || 'Practice ERP for tax consultants'}. Clients, documents, returns, notices and fees in one place.</p>
        <div class="stack tight small">
          ${c.email ? html`<span class="row">${FT.icon('mail')}${FT.copyable(c.email)}</span>` : ''}
          ${c.phone ? html`<span class="row">${FT.icon('phone')}${FT.copyable(c.phone)}</span>` : ''}
          ${c.whatsapp ? html`<a class="row" href="${FT.wa(c.whatsapp, 'Assalam o Alaikum, I would like to know more about ' + FT.brandName() + '.')}" target="_blank" rel="noopener">${FT.icon('message-circle')}WhatsApp us</a>` : ''}
          ${c.address ? html`<span class="row">${FT.icon('map-pin')}${c.address}</span>` : ''}
          ${c.hours ? html`<span class="row">${FT.icon('clock')}${c.hours}</span>` : ''}
        </div>
      </div>
      <div><h4>Product</h4><a href="#/" data-scroll="why">Why ${FT.brandName()}</a><a href="#/" data-scroll="features">Features</a><a href="#/" data-scroll="pricing">Pricing</a><a href="#/" data-scroll="calculator">Tax calculator</a></div>
      <div><h4>Get started</h4><a href="#/signup">Start free trial</a><a href="#/login">Sign in</a><a href="#/login">Client portal sign-in</a><a href="#/" data-act="install">Install the app</a></div>
      <div><h4>Talk to us</h4><a href="#/" data-act="contact">Contact form</a>${so.facebook ? html`<a href="${so.facebook}" target="_blank" rel="noopener">Facebook</a>` : ''}${so.instagram ? html`<a href="${so.instagram}" target="_blank" rel="noopener">Instagram</a>` : ''}${so.linkedin ? html`<a href="${so.linkedin}" target="_blank" rel="noopener">LinkedIn</a>` : ''}${so.youtube ? html`<a href="${so.youtube}" target="_blank" rel="noopener">YouTube</a>` : ''}</div>
      <div class="fine"><span>© ${new Date().getFullYear()} ${FT.brandName()}. All rights reserved.</span><span>${site.site.footerNote}</span></div>
    </div></footer>`;
  }

  /* -------------------------------------------------------------- home */
  FT.route('/', async (ctx) => {
    const site = await getSite(true);
    const h = site.site.hero || {};
    const fd = (site.deadlines || []).find((d) => d.featured);
    const lines = String(h.headline || '').split(/(?<=\.)\s+/).filter(Boolean);
    ctx.title = h.headline ? FT.brandName() + ', ' + (site.site.tagline || '') : '';
    ctx.mount((root) => mountSite(root, site, ctx));
    return html`<div class="site">
      ${annBar(site)}
      ${nav()}
      <section class="hero"><div class="wrap">
        <div>
          <span class="eyebrow">${fd ? html`<span class="dotlive" aria-hidden="true"></span><span>${fd.title}: due ${FT.date(fd.date)}, ${FT.plural(daysLeft(fd.date), 'day')} left</span>` : html`${FT.icon('badge-check')}<span>Built for tax consultants in Pakistan</span>`}</span>
          <h1>${lines.map((l) => html`<span class="ln">${l}</span>`)}</h1>
          ${h.urdu ? html`<p class="urdu" lang="ur">${h.urdu}</p>` : ''}
          <p class="lede">${h.sub}</p>
          <div class="ctas"><a class="btn btn-primary btn-lg" href="#/signup">${h.ctaPrimary || 'Start free trial'}</a><a class="btn btn-lg" href="#/" data-scroll="pricing">${h.ctaSecondary || 'See pricing'}</a></div>
          <div class="assure"><span>${FT.icon('check')}No card needed</span><span>${FT.icon('check')}${site.trialDays} days free</span><span>${FT.icon('check')}Installs on your phone</span><span>${FT.icon('check')}Cancel any time</span></div>
        </div>
        ${caseFile(site)}
      </div></section>
      ${rail(site)}
      ${why(site)}
      ${roi(site)}
      ${how()}
      ${modules()}
      ${proof(site)}
      ${pricing(site)}
      ${calculator(site)}
      ${faq(site)}
      ${finalCta(site)}
      ${footer(site)}
      <div class="sticky-cta" id="sticky-cta"><div class="sc-text"><b>${site.offer && site.offer.active ? site.offer.left + ' founding seats left' : site.trialDays + '-day free trial'}</b>${site.offer && site.offer.active ? html`Closes in <span data-countdown="${site.offer.deadline}">${cd(site.offer.deadline).text}</span>` : 'No card needed'}</div><a class="btn btn-primary" href="#/signup">Start free</a></div>
    </div>`;
  }, { layout: 'site', skeleton: false });

  function mountSite(root, site, ctx) {
    const navEl = root.querySelector('#site-nav');
    const onScroll = () => {
      if (!document.body.contains(navEl)) { window.removeEventListener('scroll', onScroll); return; }
      navEl.classList.toggle('scrolled', window.scrollY > 10);
      const sc = root.querySelector('#sticky-cta'); if (sc) sc.classList.toggle('show', window.scrollY > 700);
    };
    window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
    const scrollTo = (id) => { const t = document.getElementById(id); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 76, behavior: 'smooth' }); };
    root.addEventListener('click', (e) => { const a = e.target.closest('[data-scroll]'); if (a) { e.preventDefault(); e.stopPropagation(); scrollTo(a.dataset.scroll); } }, true);
    document.addEventListener('click', function scrollFromMenu(e) { const a = e.target.closest('.mobile-menu [data-scroll]'); if (a) { e.preventDefault(); scrollTo(a.dataset.scroll); } if (!document.body.contains(root.querySelector('.site'))) document.removeEventListener('click', scrollFromMenu); }, true);
    if (ctx.query.to) setTimeout(() => scrollTo(ctx.query.to), 60);

    // countdowns
    const tick = () => {
      if (!document.body.contains(root.querySelector('.site'))) { clearInterval(timer); return; }
      root.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = cd(el.dataset.countdown).text; });
      root.querySelectorAll('[data-countdown-cells]').forEach((el) => { const c = cd(el.dataset.countdownCells); el.querySelectorAll('[data-k]').forEach((b) => { b.textContent = String(c[b.dataset.k]).padStart(2, '0'); }); });
    };
    const timer = setInterval(tick, 1000);

    // billing toggle (yearly is the default)
    root.querySelectorAll('[data-cycle]').forEach((b) => b.addEventListener('click', () => {
      const cyc = b.dataset.cycle;
      root.querySelectorAll('[data-cycle]').forEach((x) => x.classList.toggle('active', x === b));
      root.querySelectorAll('.plan').forEach((p) => {
        const amt = p.querySelector('.amt'); amt.textContent = 'Rs ' + amt.dataset[cyc];
        const per = p.querySelector('.per'); per.textContent = per.dataset[cyc === 'annual' ? 'perAnnual' : 'perMonthly'];
        const an = p.querySelector('[data-anchor]'); if (an) an.hidden = cyc !== 'annual';
        const sv = p.querySelector('[data-save]'); if (sv) sv.hidden = cyc !== 'annual';
        const day = p.querySelector('.p-day'); day.textContent = day.dataset[cyc === 'annual' ? 'dayAnnual' : 'dayMonthly'];
        p.querySelector('[data-plan-cta]').setAttribute('href', '#/signup?plan=' + p.dataset.plan + '&cycle=' + cyc);
      });
    }));

    // ROI calculator
    const roiBox = root.querySelector('[data-roi]');
    if (roiBox) {
      const price = +roiBox.dataset.price || 0;
      const g = (id) => roiBox.querySelector('#' + id);
      const calc = () => {
        const c = +g('roi-c').value, m = +g('roi-m').value, r = +g('roi-r').value, s = +g('roi-s').value / 100;
        g('roi-c-o').textContent = c; g('roi-m-o').textContent = m + ' min'; g('roi-r-o').textContent = FT.money(r); g('roi-s-o').textContent = Math.round(s * 100) + '%';
        const hours = (c * m * 4.33 / 60) * s;
        const value = hours * r;
        g('roi-hours').textContent = FT.n(hours) + (Math.round(hours) === 1 ? ' hour' : ' hours');
        g('roi-value').textContent = FT.money(value);
        g('roi-x').textContent = price ? (value / price >= 1 ? FT.n(value / price) + 'x' : 'Less than 1x') : '';
      };
      roiBox.querySelectorAll('input[type=range]').forEach((i) => i.addEventListener('input', calc));
      calc();
    }

    // tax calculator
    const tx = root.querySelector('[data-tax]');
    if (tx) {
      let type = 'salaried', per = 'month';
      const inc = tx.querySelector('#tx-inc');
      const run = async () => {
        const raw0 = +String(inc.value).replace(/[^\d.]/g, '') || 0;
        const income = per === 'month' ? raw0 * 12 : raw0;
        const r = await FT.api('public.taxCalc', { year: tx.querySelector('#tx-year').value, type, income });
        if (!r) return;
        tx.querySelector('#tx-total').textContent = FT.money(r.total);
        tx.querySelector('#tx-month').textContent = FT.money(r.monthly);
        tx.querySelector('#tx-eff').textContent = r.effective + '%';
        tx.querySelector('#tx-sur').textContent = FT.money(r.surcharge);
        tx.querySelector('#tx-break').innerHTML = String(html`${r.breakdown.filter((b) => b.rate > 0).map((b) => html`<div class="row between"><span>${FT.moneyShort(b.from)} to ${b.to ? FT.moneyShort(b.to) : 'above'} at ${b.rate}%</span><b class="num">${FT.money(b.amount)}</b></div>`)}`);
      };
      const fmtInput = () => { const v = String(inc.value).replace(/[^\d]/g, ''); inc.value = v ? FT.n(+v) : ''; };
      inc.addEventListener('input', () => { fmtInput(); run(); });
      tx.querySelector('#tx-year').addEventListener('change', run);
      tx.querySelectorAll('[data-tt]').forEach((b) => b.addEventListener('click', () => { type = b.dataset.tt; tx.querySelectorAll('[data-tt]').forEach((x) => x.classList.toggle('active', x === b)); run(); }));
      tx.querySelectorAll('[data-per]').forEach((b) => b.addEventListener('click', () => {
        const prev = per; per = b.dataset.per;
        if (prev !== per) { const v = +String(inc.value).replace(/[^\d]/g, '') || 0; inc.value = FT.n(per === 'year' ? v * 12 : Math.round(v / 12)); }
        tx.querySelectorAll('[data-per]').forEach((x) => x.classList.toggle('active', x === b)); run();
      }));
      run();
    }

    // product tour tabs
    root.querySelectorAll('[data-mod]').forEach((b) => b.addEventListener('click', () => {
      root.querySelectorAll('[data-mod]').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      root.querySelector('#mod-body').innerHTML = String(moduleView(b.dataset.mod));
    }));

    // lead forms
    root.querySelectorAll('form[data-lead]').forEach((f) => f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = FT.formData(f);
      const btn = f.querySelector('[type=submit]');
      if (!String(v.name || '').trim()) { FT.toast('Add your name so we know who to call.', 'warn'); return; }
      FT.busy(btn, true);
      try { await FT.api('public.lead', Object.assign(v, { source: f.dataset.lead })); f.innerHTML = String(html`<b>Thank you, ${v.name}.</b><span class="small" style="color:rgba(244,247,243,.8)">We will be in touch within one working day.</span>`); }
      catch (err) { FT.handleError(err); } finally { FT.busy(btn, false); }
    }));

    // real sign-up activity, never invented
    const signups = (site.signups || []).slice(0, 4);
    if (signups.length && !FT.ss.get('fintax.liveSeen')) {
      let i = 0;
      const show = () => {
        if (!document.body.contains(root.querySelector('.site')) || i >= signups.length) return;
        const s = signups[i++];
        const old = document.querySelector('.live-toast'); if (old) old.remove();
        const el = document.createElement('div');
        el.className = 'live-toast'; el.setAttribute('role', 'status');
        el.innerHTML = String(html`<span class="li-icon green">${FT.icon(s.kind === 'activated' ? 'badge-check' : 'user-plus')}</span><div class="grow"><b>A practice in ${s.city} ${s.kind === 'activated' ? 'activated ' + s.plan : 'started a ' + s.plan + ' trial'}</b><span>${FT.ago(s.at)}</span></div><button aria-label="Dismiss">${FT.icon('x')}</button>`);
        el.querySelector('button').addEventListener('click', () => { el.remove(); i = signups.length; FT.ss.set('fintax.liveSeen', 1); });
        document.body.appendChild(el);
        setTimeout(() => { el.remove(); setTimeout(show, 9000); }, 6000);
      };
      setTimeout(show, 7000);
    }

    // exit intent: once per session, a reminder offer
    if (!FT.ss.get('fintax.exitShown') && !FT.state.me) {
      let armed = false;
      setTimeout(() => { armed = true; }, 12000);
      const trigger = () => {
        if (!armed || FT.ss.get('fintax.exitShown') || !document.body.contains(root.querySelector('.site')) || document.querySelector('.modal-root')) return;
        FT.ss.set('fintax.exitShown', 1);
        exitOffer(site);
      };
      document.addEventListener('mouseout', function exitOut(e) { if (!e.relatedTarget && e.clientY <= 4) { trigger(); document.removeEventListener('mouseout', exitOut); } });
      let lastY = window.scrollY;
      const onUp = () => { const y = window.scrollY; if (window.innerWidth < 760 && lastY - y > 160 && y > 1400) { trigger(); window.removeEventListener('scroll', onUp); } lastY = y; };
      window.addEventListener('scroll', onUp, { passive: true });
    }
  }
  function exitOffer(site) {
    const o = site.offer;
    FT.modal({
      size: 'sm',
      body: html`<div class="stack" style="padding-top:18px">
        <span class="stamp lg" style="align-self:flex-start">${o && o.active ? o.left + ' seats left' : 'Free for ' + site.trialDays + ' days'}</span>
        <h2 class="wide" style="font-size:1.45rem;font-weight:820;letter-spacing:-0.03em">Before you go, keep founding pricing within reach</h2>
        <p class="ink2 small">${o && o.active ? 'Founding pricing closes in ' + cd(o.deadline).text.replace(/ \d+s$/, '') + '. Leave your number and we will remind you before it ends, with no obligation.' : 'Leave your number and we will send you a short walkthrough of how other consultants set up.'}</p>
        <form class="stack tight" data-exit>
          <input class="input" name="name" placeholder="Your name" required autocomplete="name">
          <input class="input" name="phone" placeholder="Mobile or WhatsApp number" inputmode="tel" autocomplete="tel">
          <button class="btn btn-primary btn-lg" type="submit">Remind me</button>
        </form>
        <button class="btn btn-quiet btn-sm" data-close style="align-self:center">No thanks</button>
      </div>`,
      mount: (el, close) => {
        el.querySelector('form').addEventListener('submit', async (e) => {
          e.preventDefault();
          const v = FT.formData(e.target);
          if (!String(v.name || '').trim() || !String(v.phone || '').trim()) { FT.toast('Add your name and number.', 'warn'); return; }
          const btn = e.target.querySelector('button'); FT.busy(btn, true);
          try { await FT.api('public.lead', Object.assign(v, { source: 'Exit offer' })); close(); FT.toast('Thank you. We will remind you before the offer closes.'); }
          catch (err) { FT.handleError(err); } finally { FT.busy(btn, false); }
        });
      },
    });
  }
  FT.act('contact', () => FT.formModal({
    title: 'Send us a message', sub: 'We reply within one working day.', submitLabel: 'Send message', submitIcon: 'send',
    fields: [{ name: 'name', label: 'Your name', required: true, col: 6 }, { name: 'phone', label: 'Mobile or WhatsApp', type: 'tel', col: 6 }, { name: 'email', label: 'Email', type: 'email', col: 6 }, { name: 'practice', label: 'Practice name and city', col: 6 }, { name: 'message', label: 'Message', type: 'textarea', rows: 4, required: true }],
    onSubmit: async (v) => { await FT.api('public.lead', Object.assign(v, { source: 'Contact form' })); FT.toast('Message sent. We will be in touch soon.'); },
  }));

  /* ------------------------------------------------------- auth pages */
  function authShell(title, sub, form, art) {
    const site = FT.state.site || {};
    return html`<div class="auth">
      <aside class="auth-art">
        <a href="#/" class="row" style="text-decoration:none;color:inherit;gap:10px">${FT.brandLockup()}</a>
        <h2>${art || 'Your practice, in order before the deadline.'}</h2>
        <div class="points">
          <div>${FT.icon('circle-check')}<span>Client portal for uploads, approvals and fee payments</span></div>
          <div>${FT.icon('circle-check')}<span>Every FBR and provincial deadline on one calendar</span></div>
          <div>${FT.icon('circle-check')}<span>Notices, invoices and your team in the same place</span></div>
        </div>
        <span class="art-stamp stamp lg">${site.offer && site.offer.active ? site.offer.left + ' founding seats left' : 'Free for ' + (site.trialDays || 14) + ' days'}</span>
      </aside>
      <main class="auth-form"><div class="auth-card">
        <div><h1>${title}</h1>${sub ? html`<p class="sub">${sub}</p>` : ''}</div>
        ${form}
      </div></main>
    </div>`;
  }
  async function afterLogin(user) {
    await FT.loadMe();
    const root = document.getElementById('root'); if (root) root.dataset.layout = '';
    const to = FT.state.after && FT.state.after !== '/login' ? FT.state.after : FT.homeFor(user);
    FT.state.after = null;
    FT.go(to, { replace: true });
  }
  FT.route('/login', async (ctx) => {
    await getSite();
    ctx.title = 'Sign in';
    const demo = FT.backend === 'local';
    ctx.mount((root) => {
      root.querySelectorAll('[data-demo]').forEach((b) => b.addEventListener('click', async () => {
        FT.busy(b, true);
        try { const r = await FT.api('auth.login', { email: b.dataset.demo, password: 'demo123' }); await afterLogin(r.user); }
        catch (err) { FT.handleError(err); } finally { FT.busy(b, false); }
      }));
    });
    return authShell('Sign in', 'Consultants, staff and clients all sign in here.', html`
      <form class="form" data-submit="login" id="login-form">
        ${FT.fields([{ name: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'username', placeholder: 'you@example.com' }, { name: 'password', label: 'Password', type: 'password', required: true, autocomplete: 'current-password' }])}
        <div class="field"><button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button></div>
        <div class="field row between small"><a href="#/forgot">Forgot password?</a><a href="#/signup">New practice? Start free trial</a></div>
        <div class="form-error" hidden></div>
      </form>
      ${demo ? html`<div class="demo-box"><div class="row">${FT.icon('sparkles')}<b class="small">Try the demo, no password needed</b></div><div class="demo-grid">
        <button class="demo-pick" data-demo="consultant@fintax.demo">Tax consultant<small>Abdul Rehman, firm owner</small></button>
        <button class="demo-pick" data-demo="client@fintax.demo">Client portal<small>Muhammad Asif</small></button>
        <button class="demo-pick" data-demo="admin@fintax.demo">Master admin<small>FinTax control panel</small></button>
        <button class="demo-pick" data-demo="staff@fintax.demo">Staff member<small>Hina Javed, associate</small></button>
      </div><span class="xs muted">Demo password for all accounts: demo123</span></div>` : ''}
    `);
  }, { layout: 'auth', guestOnly: true, skeleton: false });
  FT.onSubmit('login', async (v) => { const r = await FT.api('auth.login', v); await afterLogin(r.user); });

  FT.route('/forgot', async (ctx) => {
    await getSite();
    ctx.title = 'Reset password';
    return authShell('Reset your password', 'For security, passwords are reset by a person, not by email links.', html`
      <form class="form" data-submit="forgot" id="forgot-form">
        ${FT.field({ name: 'email', label: 'Email you sign in with', type: 'email', required: true, autocomplete: 'username' })}
        <div class="field"><button class="btn btn-primary btn-lg btn-block" type="submit">Request a reset</button></div>
        <div class="form-error" hidden></div>
      </form>
      <div class="callout">${FT.icon('info')}<span>Clients: your tax consultant sets a new password and shares it with you. Staff: your practice owner does it. Practice owners: the ${FT.brandName()} team does it for you.</span></div>
      <a href="#/login" class="small">Back to sign in</a>`);
  }, { layout: 'auth', guestOnly: true, skeleton: false });
  FT.onSubmit('forgot', async (v, form) => {
    await FT.api('auth.forgot', v);
    form.outerHTML = String(html`<div class="callout">${FT.icon('circle-check')}<span>Request received. If an account uses <b>${v.email}</b>, the right person has been notified and will share a new password with you.</span></div>`);
  });

  FT.route('/signup', async (ctx) => {
    const site = await getSite();
    ctx.title = 'Start free trial';
    if (!site.allowSignups) return authShell('Sign-ups are paused', 'We are onboarding practices in small groups. Leave your details and we will contact you.', html`<a class="btn btn-primary" href="#/" data-act="contact">Contact us</a>`);
    const plans = site.plans || [];
    const planId = ctx.query.plan && plans.some((p) => p.id === ctx.query.plan) ? ctx.query.plan : (plans.find((p) => p.highlight) || plans[0] || {}).id;
    const cycle = ctx.query.cycle === 'monthly' ? 'monthly' : 'annual';
    ctx.mount((root) => mountSignup(root));
    return authShell('Start your free trial', site.trialDays + ' days of every feature. No card needed.', html`
      <div class="steps-dots" aria-hidden="true"><i class="on" data-dot="1"></i><i data-dot="2"></i><i data-dot="3"></i></div>
      <form id="signup-form" class="stack" novalidate>
        <div class="form" data-step="1">
          ${FT.fields([{ name: 'name', label: 'Your name', required: true, autocomplete: 'name' }, { name: 'email', label: 'Work email', type: 'email', required: true, autocomplete: 'email' }, { name: 'phone', label: 'Mobile (WhatsApp)', type: 'tel', autocomplete: 'tel', placeholder: '03XX XXXXXXX' }, { name: 'password', label: 'Create a password', type: 'password', required: true, autocomplete: 'new-password', hint: 'At least 6 characters' }])}
        </div>
        <div class="form" data-step="2" hidden>
          ${FT.fields([{ name: 'firmName', label: 'Practice name', required: true, placeholder: 'e.g. Rehman Tax Advisors' }, { name: 'city', label: 'City', type: 'select', options: FT.C.CITIES, value: 'Lahore', col: 6 }, { name: 'clientsEstimate', label: 'Clients you handle', type: 'select', options: ['Under 50', '50 to 150', '150 to 400', 'Over 400'], value: '50 to 150', col: 6 }])}
        </div>
        <div class="stack" data-step="3" hidden>
          <div class="seg" role="radiogroup" aria-label="Billing period"><button type="button" class="${cycle === 'annual' ? 'active' : ''}" data-cyc="annual">Yearly, 2 months free</button><button type="button" class="${cycle === 'monthly' ? 'active' : ''}" data-cyc="monthly">Monthly</button></div>
          <input type="hidden" name="cycle" value="${cycle}">
          <div class="plan-pick">${plans.map((p) => html`<label><input type="radio" name="planId" value="${p.id}" ${p.id === planId ? raw('checked') : ''}><span class="pp"><b>${p.name}</b><span class="pr" data-a="${'Rs ' + FT.n(p.annual) + ' / year'}" data-m="${'Rs ' + FT.n(p.monthly) + ' / month'}">${cycle === 'annual' ? 'Rs ' + FT.n(p.annual) + ' / year' : 'Rs ' + FT.n(p.monthly) + ' / month'}</span><span class="xs muted">${p.tagline}</span></span></label>`)}</div>
          <p class="xs muted">You will not be charged now. Choose how to pay when your trial ends.</p>
        </div>
        <div class="form-error" hidden></div>
        <div class="row"><button type="button" class="btn btn-lg" data-back hidden>Back</button><button type="submit" class="btn btn-primary btn-lg grow" data-next>Continue</button></div>
      </form>
      <p class="small muted">Already using ${FT.brandName()}? <a href="#/login">Sign in</a></p>`, 'Set up your practice in a few minutes.');
  }, { layout: 'auth', guestOnly: true, skeleton: false });
  function mountSignup(root) {
    const form = root.querySelector('#signup-form');
    let step = 1;
    const show = () => {
      form.querySelectorAll('[data-step]').forEach((s) => { s.hidden = +s.dataset.step !== step; });
      root.querySelectorAll('[data-dot]').forEach((d) => d.classList.toggle('on', +d.dataset.dot <= step));
      form.querySelector('[data-back]').hidden = step === 1;
      form.querySelector('[data-next]').lastChild.textContent = step === 3 ? 'Create my practice' : 'Continue';
      const box = form.querySelector('.form-error'); box.hidden = true;
      const first = form.querySelector('[data-step="' + step + '"] input:not([type=hidden]), [data-step="' + step + '"] select'); if (first && window.innerWidth > 640) first.focus();
    };
    form.querySelector('[data-back]').addEventListener('click', () => { step = Math.max(1, step - 1); show(); });
    form.querySelectorAll('[data-cyc]').forEach((b) => b.addEventListener('click', () => {
      form.querySelectorAll('[data-cyc]').forEach((x) => x.classList.toggle('active', x === b));
      form.querySelector('[name=cycle]').value = b.dataset.cyc;
      form.querySelectorAll('.pr').forEach((p) => { p.textContent = b.dataset.cyc === 'annual' ? p.dataset.a : p.dataset.m; });
    }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = form.querySelector('[data-step="' + step + '"]');
      for (const el of cur.querySelectorAll('[required]')) if (!String(el.value).trim()) { FT.formError(form, 'Fill in ' + (el.dataset.label || el.name) + '.'); el.focus(); return; }
      if (step === 1) {
        const em = form.querySelector('[name=email]').value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { FT.formError(form, 'Enter a valid email address.'); return; }
        if (form.querySelector('[name=password]').value.length < 6) { FT.formError(form, 'Use at least 6 characters for the password.'); return; }
      }
      if (step < 3) { step++; show(); return; }
      const btn = form.querySelector('[data-next]');
      FT.busy(btn, true);
      try {
        const r = await FT.api('auth.signup', FT.formData(form));
        await FT.loadMe();
        const rootEl = document.getElementById('root'); if (rootEl) rootEl.dataset.layout = '';
        FT.go('/app', { replace: true });
        FT.toast('Welcome, ' + r.user.name.split(' ')[0] + '. Your free trial has started.');
      } catch (err) { FT.formError(form, err.message); if (err.code === 'exists') { step = 1; show(); FT.formError(form, err.message); } }
      finally { FT.busy(btn, false); }
    });
  }
})();
