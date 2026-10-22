/*! FinTax demo data. Loaded by the preview, and by the server only when SEED_DEMO=1.
 * Every phone number uses the unassigned 0390 prefix, every email is @example.com or
 * @fintax.demo, and every CNIC/NTN is a zero-padded placeholder, so nothing here
 * can reach a real person.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core.js'));
  else root.FinTaxSeed = factory(root.FinTaxCore);
})(typeof self !== 'undefined' ? self : this, function (Core) {
  'use strict';
  const { U } = Core;
  const DAY = U.DAY;

  function seedDemo(core, opts) {
    opts = opts || {};
    const I = core.internals;
    const t0 = I.now();
    const td = I.today();
    const ago = (days, hours) => U.iso(t0 - (days || 0) * DAY - (hours || 0) * 3600000);
    const dAgo = (n) => U.addDays(td, -n);
    const dIn = (n) => U.addDays(td, n);
    const pw = I.hasher.hash(opts.password || 'demo123');
    const put = (c, doc) => I.insert(c, doc);

    core.ensureBase({ name: 'Ayesha Kamal', email: 'admin@fintax.demo', password: opts.password || 'demo123' });
    const admin = I.all('users').find((u) => u.role === 'admin');

    /* ---------- site settings for the preview */
    const endOfDayIso = (ds) => U.iso(Date.parse(ds + 'T23:59:00+05:00'));
    core.saveSettings('site', {
      offer: { enabled: true, seats: 40, startAt: ago(70), deadline: endOfDayIso(dIn(9)) },
      contact: { email: 'hello@fintax.demo', hours: 'Mon to Sat, 10am to 7pm PKT', address: 'Lahore, Pakistan' },
    });
    core.saveSettings('payment', {
      bankName: 'Meezan Bank', accountTitle: 'FinTax Technologies', accountNumber: '0000-0100000000', iban: 'PK00MEZN0000000100000000',
      raast: '0390-0000000', jazzcash: '0390-0000000', easypaisa: '0390-0000000',
    });

    /* ---------- practices (what the master admin sees) */
    const plans = I.plansSorted();
    const planById = (id) => plans.find((p) => p.id === id);
    const firmSpecs = [
      { key: 'main', name: 'Rehman Tax Advisors', city: 'Lahore', owner: 'Abdul Rehman', email: 'consultant@fintax.demo', plan: 'firm', cycle: 'annual', status: 'active', created: 64, end: 301 },
      { name: 'Lahore Tax Chambers', city: 'Lahore', owner: 'Mehwish Tariq', plan: 'firm', cycle: 'annual', status: 'active', created: 170, end: 195 },
      { name: 'Islamabad Tax Studio', city: 'Islamabad', owner: 'Haris Siddiqui', plan: 'practice', cycle: 'monthly', status: 'active', created: 141, end: 22 },
      { name: 'Karachi Corporate Tax', city: 'Karachi', owner: 'Rabia Shaikh', plan: 'firm', cycle: 'monthly', status: 'active', created: 112, end: 4 },
      { name: 'Malik & Associates', city: 'Islamabad', owner: 'Usman Malik', plan: 'practice', cycle: 'annual', status: 'active', created: 41, end: 324 },
      { name: 'Peshawar Tax Consultants', city: 'Peshawar', owner: 'Gul Khan', plan: 'practice', cycle: 'monthly', status: 'active', created: 52, end: -4 },
      { name: 'Faisalabad Tax Point', city: 'Faisalabad', owner: 'Kashif Iqbal', plan: 'firm', cycle: 'monthly', status: 'active', created: 33, end: 18 },
      { name: 'Sialkot Exporters Tax Desk', city: 'Sialkot', owner: 'Waqas Cheema', plan: 'firm', cycle: 'annual', status: 'active', created: 27, end: 338 },
      { name: 'Hyderabad Tax Associates', city: 'Hyderabad', owner: 'Aamir Memon', plan: 'practice', cycle: 'monthly', status: 'suspended', created: 47, end: 13, reason: 'Two payments reversed by the bank' },
      { name: 'Gujranwala Tax Partners', city: 'Gujranwala', owner: 'Bilal Butt', plan: 'practice', cycle: 'monthly', status: 'active', created: 19, end: 11 },
      { name: 'Quetta Fiscal Advisors', city: 'Quetta', owner: 'Nasir Baloch', plan: 'practice', cycle: 'annual', status: 'trial', created: 9, trial: 5, pending: true },
      { name: 'Rawalpindi Tax Hub', city: 'Rawalpindi', owner: 'Sana Abbasi', plan: 'practice', cycle: 'monthly', status: 'trial', created: 6, trial: 8 },
      { name: 'Karachi Tax House', city: 'Karachi', owner: 'Farah Siddiqui', plan: 'firm', cycle: 'monthly', status: 'trial', created: 3, trial: 11 },
      { name: 'Abbottabad Tax Care', city: 'Abbottabad', owner: 'Hassan Jadoon', plan: 'practice', cycle: 'monthly', status: 'trial', created: 2, trial: 12 },
      { name: 'Multan Tax Clinic', city: 'Multan', owner: 'Sadia Bukhari', plan: 'practice', cycle: 'monthly', status: 'trial', created: 1, trial: 13, pending: true },
    ];
    let main = null, mainOwner = null;
    firmSpecs.forEach((s, i) => {
      const firm = put('firms', {
        name: s.name, city: s.city, phone: '0390-' + String(1000001 + i * 7).slice(0, 7), email: s.email || ('owner' + (i + 1) + '@example.com'), ntn: '', address: '',
        planId: s.plan, cycle: s.cycle, subStatus: s.status === 'suspended' ? 'suspended' : s.status, prevStatus: s.status === 'suspended' ? 'active' : null, suspendReason: s.reason || '',
        trialEndsAt: s.trial ? ago(-s.trial) : ago(s.created - 14), periodEnd: s.end != null && s.status !== 'trial' ? ago(-s.end) : null, activatedAt: s.status !== 'trial' ? ago(s.created - 10) : null,
        invoicePrefix: 'INV', invoiceSeq: 0, taxRate: 0, paymentTerms: 7, bank: {}, ownerId: null, demo: true, logo: '', createdAt: ago(s.created, 3),
      });
      const owner = put('users', { role: 'consultant', firmId: firm.id, name: s.owner, email: s.email || ('owner' + (i + 1) + '@example.com'), phone: firm.phone, title: 'Principal', passwordHash: pw, status: 'active', lastLoginAt: ago(Math.min(s.created, i % 4), 2), createdAt: firm.createdAt });
      I.patch('firms', firm.id, { ownerId: owner.id });
      // subscription payments history
      const plan = planById(s.plan);
      if (s.status !== 'trial') {
        if (s.cycle === 'annual') put('subPayments', { firmId: firm.id, userId: owner.id, planId: plan.id, cycle: 'annual', amount: plan.annual, method: i % 2 ? 'Bank transfer' : 'Raast', reference: 'FT' + (902110 + i * 13), paidOn: U.pktDate(Date.parse(ago(s.created - 11))), status: 'approved', reviewedAt: ago(s.created - 11, -2), reviewedBy: admin.id, note: '', createdAt: ago(s.created - 11) });
        else {
          const months = Math.max(1, Math.round((s.created - 14) / 30) + 1);
          for (let m = 0; m < months; m++) {
            const when = s.created - 12 - m * 30;
            if (when < 0) break;
            put('subPayments', { firmId: firm.id, userId: owner.id, planId: plan.id, cycle: 'monthly', amount: plan.monthly, method: ['JazzCash', 'Easypaisa', 'Bank transfer'][m % 3], reference: 'TX' + (55120 + i * 31 + m), paidOn: U.pktDate(Date.parse(ago(when))), status: 'approved', reviewedAt: ago(when, -3), reviewedBy: admin.id, note: '', createdAt: ago(when) });
          }
        }
      }
      if (s.pending) put('subPayments', { firmId: firm.id, userId: owner.id, planId: plan.id, cycle: s.cycle, amount: s.cycle === 'annual' ? plan.annual : plan.monthly, method: s.cycle === 'annual' ? 'Bank transfer' : 'JazzCash', reference: s.cycle === 'annual' ? 'IBFT-77310452' : 'JC-40913377', paidOn: dAgo(0), status: 'pending', note: s.cycle === 'annual' ? 'Paid from Bank Alfalah business account' : '', proofBlobId: null, proofName: '', createdAt: ago(0, 6 + i % 3) });
      if (s.key === 'main') { main = core.store.get('firms', firm.id); mainOwner = owner; }
    });

    // main firm profile
    main = I.patch('firms', main.id, {
      phone: '0390-1234567', email: 'consultant@fintax.demo', ntn: '0000001-1', address: 'Suite 4, Main Boulevard, Gulberg III, Lahore',
      invoicePrefix: 'RTA', taxRate: 16, taxLabel: 'PST (PRA)', paymentTerms: 7,
      invoiceNote: 'Fees are payable within 7 days. Please mention the invoice number with your transfer.',
      bank: { bankName: 'Meezan Bank', accountTitle: 'Rehman Tax Advisors', accountNumber: '0000-0200000000', iban: 'PK00MEZN0000000200000000', raast: '0390-1234567', jazzcash: '0390-1234567', easypaisa: '' },
      waTemplate: 'Assalam o Alaikum {name}, this is {firm}. {message}',
    });
    const F = main.id;
    const hina = put('users', { role: 'staff', firmId: F, name: 'Hina Javed', email: 'staff@fintax.demo', phone: '0390-1112233', title: 'Tax Associate', passwordHash: pw, status: 'active', lastLoginAt: ago(0, 1), createdAt: ago(60) });
    const omer = put('users', { role: 'staff', firmId: F, name: 'Omer Farooq', email: 'omer@example.com', phone: '0390-1112244', title: 'Article Trainee', passwordHash: pw, status: 'active', lastLoginAt: ago(1, 4), createdAt: ago(45) });
    const A = mainOwner.id, H = hina.id, O = omer.id;

    /* ---------- clients */
    const cl = (o) => put('clients', Object.assign({ firmId: F, archived: false, portalUserId: null, createdBy: A, tags: [], notes: '', businessName: '', rto: '', strn: '', address: '' }, o));
    const c1 = cl({ type: 'individual', profile: 'salaried', name: 'Muhammad Asif', cnic: '35202-0000101-1', ntn: '', email: 'client@fintax.demo', phone: '0390-0000101', city: 'Lahore', address: 'House 18, Block C, Johar Town, Lahore', rto: 'RTO Lahore', atl: 'active', registrations: ['FBR'], assignedTo: H, feeBasis: 'annual', feeAmount: 25000, tags: ['Salaried', 'Refund case'], notes: 'Senior engineer at a software house. Prefers WhatsApp. Has a car loan.', createdAt: ago(58) });
    const c2 = cl({ type: 'company', profile: '', name: 'Meher Textiles (Pvt) Ltd', businessName: 'Meher Textiles', cnic: '', ntn: '0000202-2', strn: '3200000000202', email: 'finance@mehertextiles.example.com', phone: '0390-0000202', city: 'Faisalabad', address: 'Plot 22, Industrial Estate, Faisalabad', rto: 'LTO Faisalabad', atl: 'active', registrations: ['FBR', 'PRA'], assignedTo: A, feeBasis: 'monthly', feeAmount: 75000, tags: ['Manufacturer', 'Monthly retainer'], notes: 'Weaving unit. Monthly sales tax plus PRA on services. CFO: Mr. Shahid.', createdAt: ago(57) });
    const c3 = cl({ type: 'aop', profile: '', name: 'Khan & Sons Traders', businessName: 'Khan & Sons', ntn: '0000303-3', strn: '3200000000303', email: 'khansons@example.com', phone: '0390-0000303', city: 'Peshawar', rto: 'RTO Peshawar', atl: 'active', registrations: ['FBR'], assignedTo: O, feeBasis: 'monthly', feeAmount: 20000, tags: ['Distributor'], createdAt: ago(55) });
    const c4 = cl({ type: 'individual', profile: 'professional', name: 'Dr. Sana Malik', cnic: '35202-0000404-4', email: 'sana.malik@example.com', phone: '0390-0000404', city: 'Lahore', rto: 'RTO Lahore', atl: 'active', registrations: ['FBR'], assignedTo: H, feeBasis: 'annual', feeAmount: 30000, tags: ['Doctor'], createdAt: ago(54) });
    const c5 = cl({ type: 'individual', profile: 'business', name: 'Bilal Ahmed', businessName: 'Bilal Electronics', cnic: '35201-0000505-5', email: 'bilal.ahmed@example.com', phone: '0390-0000505', city: 'Lahore', rto: 'RTO Lahore', atl: 'inactive', registrations: ['FBR'], assignedTo: O, feeBasis: 'per_filing', feeAmount: 15000, tags: ['Retailer', 'Notice'], notes: 'Missed last year. Needs ATL restored before buying property.', createdAt: ago(40) });
    const c6 = cl({ type: 'individual', profile: 'salaried', name: 'Zainab Hussain', cnic: '61101-0000606-6', email: 'zainab.h@example.com', phone: '0390-0000606', city: 'Islamabad', rto: 'RTO Islamabad', atl: 'active', registrations: ['FBR'], assignedTo: H, feeBasis: 'annual', feeAmount: 18000, createdAt: ago(39) });
    const c7 = cl({ type: 'aop', profile: '', name: 'Tandoor Corner', businessName: 'Tandoor Corner', ntn: '0000707-7', strn: 'P0000707', email: 'tandoorcorner@example.com', phone: '0390-0000707', city: 'Lahore', rto: 'RTO Lahore', atl: 'active', registrations: ['FBR', 'PRA'], assignedTo: O, feeBasis: 'monthly', feeAmount: 18000, tags: ['Restaurant'], createdAt: ago(52) });
    const c8 = cl({ type: 'company', profile: '', name: 'Swift Cargo Movers (SMC-Pvt) Ltd', businessName: 'Swift Cargo', ntn: '0000808-8', strn: 'S0000808', email: 'accounts@swiftcargo.example.com', phone: '0390-0000808', city: 'Karachi', rto: 'RTO Karachi', atl: 'active', registrations: ['FBR', 'SRB'], assignedTo: A, feeBasis: 'monthly', feeAmount: 60000, tags: ['Logistics', 'Notice'], createdAt: ago(56) });
    const c9 = cl({ type: 'individual', profile: 'freelancer', name: 'Imran Qureshi', cnic: '37405-0000909-9', email: 'imran.q@example.com', phone: '0390-0000909', city: 'Rawalpindi', rto: 'RTO Rawalpindi', atl: 'active', registrations: ['FBR'], assignedTo: H, feeBasis: 'annual', feeAmount: 20000, tags: ['IT exports', 'PSEB'], createdAt: ago(30) });
    const c10 = cl({ type: 'individual', profile: 'rental', name: 'Noor Fatima', cnic: '35202-0001010-0', email: 'noor.fatima@example.com', phone: '0390-0001010', city: 'Lahore', rto: 'RTO Lahore', atl: 'active', registrations: ['FBR'], assignedTo: H, feeBasis: 'annual', feeAmount: 22000, tags: ['Rental income'], createdAt: ago(28) });
    const c11 = cl({ type: 'aop', profile: '', name: 'Hamza Builders & Developers', businessName: 'Hamza Builders', ntn: '0001111-1', strn: '3200000001111', email: 'hamzabuilders@example.com', phone: '0390-0001111', city: 'Lahore', rto: 'RTO Lahore', atl: 'active', registrations: ['FBR', 'PRA'], assignedTo: O, feeBasis: 'monthly', feeAmount: 30000, tags: ['Construction'], createdAt: ago(50) });
    const c12 = cl({ type: 'individual', profile: 'overseas', name: 'Tariq Mehmood', cnic: '34101-0001212-2', email: 'tariq.m@example.com', phone: '0390-0001212', city: 'Dubai (overseas)', atl: 'unknown', registrations: ['FBR'], assignedTo: H, feeBasis: 'annual', feeAmount: 20000, tags: ['Overseas'], notes: 'Owns a plot in DHA Lahore. Wants to know if he must file.', createdAt: ago(8) });

    const portal = (c, email, last) => { const u = put('users', { role: 'client', firmId: F, clientId: c.id, name: c.name, email, phone: c.phone, passwordHash: pw, status: 'active', lastLoginAt: last, createdAt: ago(20) }); I.patch('clients', c.id, { portalUserId: u.id }); return u; };
    const p1 = portal(c1, 'client@fintax.demo', ago(1, 2));
    const p2 = portal(c2, 'finance@mehertextiles.example.com', ago(0, 3));
    portal(c4, 'sana.malik@example.com', ago(6));
    const p10 = portal(c10, 'noor.fatima@example.com', ago(0, 5));

    /* ---------- tax-season dates */
    const ty = U.taxYearOf(td) - 1; // returns being filed now
    const fd = core.settings('site').featuredDeadline || {};
    const itrDue = fd.enabled && fd.date && fd.date >= td ? fd.date : (U.ymd(ty, 9, 30) >= td ? U.ymd(ty, 9, 30) : dIn(10));
    const coDue = U.ymd(ty, 12, 31) >= td ? U.ymd(ty, 12, 31) : dIn(45);
    const curMonth = td.slice(0, 7);
    const prevMonth = U.addMonths(curMonth + '-01', -1).slice(0, 7);
    const prevDue = curMonth + '-18';
    const nextDue = U.addMonths(curMonth + '-01', 1).slice(0, 7) + '-18';
    const qEnd = [3, 6, 9, 12].filter((m) => U.ymd(+td.slice(0, 4), m, 1) < curMonth + '-01').pop() || 12;
    const qYear = qEnd === 12 && +td.slice(5, 7) <= 1 ? +td.slice(0, 4) - 1 : +td.slice(0, 4);
    const whtPeriod = qYear + '-Q' + (qEnd / 3);
    const whtDue = (qEnd === 12 ? (qYear + 1) + '-01' : qYear + '-' + U.pad(qEnd + 1)) + '-20';

    /* ---------- filings */
    const fil = (o) => put('filings', Object.assign({ firmId: F, createdBy: A, authority: 'FBR', period: '', taxPayable: 0, refund: 0, ackNumber: '', fee: 0, notes: '', filedAt: null, clientDecision: null }, o));
    const f1 = fil({ clientId: c1.id, type: 'itr', taxYear: ty, dueDate: itrDue, stage: 'client_approval', assignedTo: H, refund: 8750, notes: 'Employer deducted slightly more tax than chargeable. Refund claim included.', approvalNote: 'Please review the draft return and approve it so we can file.', createdAt: ago(25) });
    const f2 = fil({ clientId: c1.id, type: 'wealth', taxYear: ty, dueDate: itrDue, stage: 'in_progress', assignedTo: H, notes: 'Client asked to add a car bought in March.', clientDecision: { status: 'changes', note: 'Please add my car purchased in March (Honda City).', at: ago(1, 3) }, createdAt: ago(25) });
    fil({ clientId: c4.id, type: 'itr', taxYear: ty, dueDate: itrDue, stage: 'filed', assignedTo: H, taxPayable: 0, ackNumber: '2026-ITR-0004417', filedAt: ago(6, 5), createdAt: ago(30) });
    fil({ clientId: c4.id, type: 'wealth', taxYear: ty, dueDate: itrDue, stage: 'filed', assignedTo: H, ackNumber: '2026-WS-0004418', filedAt: ago(6, 5), createdAt: ago(30) });
    const f5 = fil({ clientId: c5.id, type: 'itr', taxYear: ty, dueDate: itrDue, stage: 'awaiting_docs', assignedTo: O, notes: 'Waiting for bank statements. Also responding to the s.114(4) notice.', createdAt: ago(18) });
    fil({ clientId: c6.id, type: 'itr', taxYear: ty, dueDate: itrDue, stage: 'in_progress', assignedTo: H, createdAt: ago(20) });
    fil({ clientId: c9.id, type: 'itr', taxYear: ty, dueDate: itrDue, stage: 'review', assignedTo: H, notes: 'Export proceeds through banking channel, PSEB certificate valid.', createdAt: ago(15) });
    fil({ clientId: c10.id, type: 'itr', taxYear: ty, dueDate: itrDue, stage: 'ready', assignedTo: H, taxPayable: 41500, notes: 'Approved by client. Rental schedule attached.', clientDecision: { status: 'approved', note: '', at: ago(2) }, createdAt: ago(16) });
    fil({ clientId: c12.id, type: 'itr', taxYear: ty, dueDate: itrDue, stage: 'not_started', assignedTo: H, createdAt: ago(8) });
    fil({ clientId: c2.id, type: 'itr', taxYear: ty, dueDate: coDue, stage: 'in_progress', assignedTo: A, notes: 'Audited accounts expected next month.', createdAt: ago(12) });
    fil({ clientId: c8.id, type: 'itr', taxYear: ty, dueDate: coDue, stage: 'awaiting_docs', assignedTo: A, createdAt: ago(12) });
    // monthly returns: last month (due this month) and this month (due next month)
    fil({ clientId: c2.id, type: 'stx', taxYear: U.taxYearOf(prevMonth + '-01'), period: prevMonth, dueDate: prevDue, stage: 'filed', assignedTo: A, taxPayable: 1284600, ackNumber: 'STR-' + prevMonth.replace('-', '') + '-0202', filedAt: ago(4, 2), createdAt: ago(20) });
    fil({ clientId: c3.id, type: 'stx', taxYear: U.taxYearOf(prevMonth + '-01'), period: prevMonth, dueDate: prevDue, stage: 'filed', assignedTo: O, taxPayable: 186400, ackNumber: 'STR-' + prevMonth.replace('-', '') + '-0303', filedAt: ago(5), createdAt: ago(20) });
    fil({ clientId: c11.id, type: 'stx', taxYear: U.taxYearOf(prevMonth + '-01'), period: prevMonth, dueDate: prevDue, stage: 'in_progress', assignedTo: O, notes: 'Purchase invoices from two suppliers still missing.', createdAt: ago(20) });
    fil({ clientId: c7.id, type: 'pst', authority: 'PRA', taxYear: U.taxYearOf(prevMonth + '-01'), period: prevMonth, dueDate: prevDue, stage: 'filed', assignedTo: O, taxPayable: 96200, ackNumber: 'PRA-' + prevMonth.replace('-', '') + '-0707', filedAt: ago(4), createdAt: ago(20) });
    fil({ clientId: c11.id, type: 'pst', authority: 'PRA', taxYear: U.taxYearOf(prevMonth + '-01'), period: prevMonth, dueDate: prevDue, stage: 'ready', assignedTo: O, taxPayable: 54000, createdAt: ago(20) });
    fil({ clientId: c8.id, type: 'pst', authority: 'SRB', taxYear: U.taxYearOf(prevMonth + '-01'), period: prevMonth, dueDate: prevDue, stage: 'filed', assignedTo: A, taxPayable: 212500, ackNumber: 'SRB-' + prevMonth.replace('-', '') + '-0808', filedAt: ago(3), createdAt: ago(20) });
    for (const [c, type, auth] of [[c2, 'stx', 'FBR'], [c3, 'stx', 'FBR'], [c11, 'stx', 'FBR'], [c7, 'pst', 'PRA'], [c8, 'pst', 'SRB'], [c11, 'pst', 'PRA']]) fil({ clientId: c.id, type, authority: auth, taxYear: U.taxYearOf(curMonth + '-01'), period: curMonth, dueDate: nextDue, stage: c === c2 ? 'awaiting_docs' : 'not_started', assignedTo: c.assignedTo, createdAt: ago(2) });
    fil({ clientId: c2.id, type: 'wht', taxYear: U.taxYearOf(whtDue), period: whtPeriod, dueDate: whtDue, stage: 'filed', assignedTo: A, ackNumber: 'WHT-' + whtPeriod + '-0202', filedAt: ago(2), createdAt: ago(14) });
    fil({ clientId: c8.id, type: 'wht', taxYear: U.taxYearOf(whtDue), period: whtPeriod, dueDate: whtDue, stage: 'in_progress', assignedTo: A, notes: 'Employee salary data from HR arrived late.', createdAt: ago(14) });

    /* ---------- documents */
    const doc = (o) => put('docs', Object.assign({ firmId: F, mime: 'application/pdf', size: 240000, blobId: null, note: '', shared: false, seenByFirm: true, seenByClient: true, approval: null, filingId: null, taxYear: ty }, o));
    const byClient = (c, name) => ({ uploadedBy: c.portalUserId, uploaderName: c.name, uploaderRole: 'client', clientId: c.id, name });
    const byFirm = (c, u, name) => ({ uploadedBy: u.id, uploaderName: u.name, uploaderRole: 'firm', clientId: c.id, name });
    doc(Object.assign(byClient(c1, 'CNIC front and back.jpg'), { category: 'CNIC or identity', mime: 'image/jpeg', size: 482113, createdAt: ago(20), demo: { kind: 'id', title: 'Computerized National Identity Card', rows: [['Name', 'Muhammad Asif'], ['Identity number', '35202-0000101-1'], ['Date of expiry', '2031-04-12']] } }));
    doc(Object.assign(byClient(c1, 'Salary certificate FY2025-26.pdf'), { category: 'Salary certificate', size: 186240, createdAt: ago(19), demo: { kind: 'letter', title: 'Salary certificate, 1 July ' + (ty - 1) + ' to 30 June ' + ty, rows: [['Employer', 'Crescent Software House (Pvt) Ltd'], ['Employee', 'Muhammad Asif'], ['Gross salary', 'Rs 3,960,000'], ['Tax deducted u/s 149', 'Rs 582,750'], ['Provident fund (employer)', 'Rs 198,000']] } }));
    doc(Object.assign(byClient(c1, 'Bank statement Jul ' + (ty - 1) + ' to Jun ' + ty + '.pdf'), { category: 'Bank statement', size: 1342210, createdAt: ago(19), demo: { kind: 'statement', title: 'Account statement', rows: [['Bank', 'Meezan Bank, Johar Town'], ['Period', '1 Jul ' + (ty - 1) + ' to 30 Jun ' + ty], ['Opening balance', 'Rs 412,380'], ['Closing balance', 'Rs 1,086,940'], ['Profit credited', 'Rs 46,500'], ['Tax withheld on profit', 'Rs 9,300']] } }));
    const dReturn = doc(Object.assign(byFirm(c1, hina, 'Draft income tax return TY' + ty + '.pdf'), { category: 'Tax return', size: 312450, shared: true, seenByClient: true, filingId: f1.id, createdAt: ago(3, 2), approval: { status: 'pending', requestedAt: ago(3, 2), requestedBy: H, note: 'Please review the draft return and approve it so we can file.' }, demo: { kind: 'return', title: 'Return of income, Tax Year ' + ty + ' (draft)', rows: [['Income from salary', 'Rs 3,960,000'], ['Taxable income', 'Rs 3,960,000'], ['Tax chargeable', 'Rs 574,000'], ['Tax deducted by employer', 'Rs 582,750'], ['Refundable', 'Rs 8,750'], ['Profit on debt (final tax)', 'Rs 46,500 taxed at source']] } }));
    I.patch('filings', f1.id, { approvalDocId: dReturn.id });
    const dWealth = doc(Object.assign(byFirm(c1, hina, 'Draft wealth statement TY' + ty + '.pdf'), { category: 'Wealth statement', size: 198770, shared: true, filingId: f2.id, createdAt: ago(3, 2), approval: { status: 'changes', requestedAt: ago(3, 2), requestedBy: H, note: '', decidedAt: ago(1, 3), decidedBy: p1.id, decisionNote: 'Please add my car purchased in March (Honda City). I will upload the registration book.' }, demo: { kind: 'return', title: 'Wealth statement as at 30 June ' + ty + ' (draft)', rows: [['Residential house, Johar Town', 'Rs 14,500,000'], ['Bank balances', 'Rs 1,086,940'], ['Household effects', 'Rs 650,000'], ['Liabilities: car loan', 'Rs 0'], ['Net assets', 'Rs 16,236,940']] } }));
    doc(Object.assign(byFirm(c1, hina, 'Income tax return TY' + (ty - 1) + ' acknowledgement.pdf'), { category: 'Tax return', size: 88100, shared: true, taxYear: ty - 1, createdAt: ago(55), demo: { kind: 'letter', title: 'Acknowledgement of return, Tax Year ' + (ty - 1), rows: [['Taxpayer', 'Muhammad Asif'], ['Acknowledgement', '2025-ITR-0007781'], ['Filed on', U.ymd(ty - 1, 9, 26)]] } }));
    const dSales = doc(Object.assign(byClient(c2, 'Sales register ' + U.monthLabel(prevMonth) + '.xlsx'), { category: 'Sales invoices', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 92700, seenByFirm: false, taxYear: U.taxYearOf(prevMonth + '-01'), createdAt: ago(0, 3), demo: { kind: 'sheet', title: 'Sales register, ' + U.monthLabel(prevMonth), rows: [['Invoices', '214'], ['Value excluding tax', 'Rs 46,380,000'], ['Output tax at 18%', 'Rs 8,348,400']] } }));
    doc(Object.assign(byClient(c2, 'Purchase register ' + U.monthLabel(prevMonth) + '.xlsx'), { category: 'Purchase records', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 71200, seenByFirm: false, taxYear: U.taxYearOf(prevMonth + '-01'), createdAt: ago(0, 3), demo: { kind: 'sheet', title: 'Purchase register, ' + U.monthLabel(prevMonth), rows: [['Invoices', '96'], ['Input tax claimed', 'Rs 7,063,800']] } }));
    doc(Object.assign(byFirm(c2, mainOwner, 'Annexure-C ' + U.monthLabel(prevMonth) + '.xlsx'), { category: 'Sales invoices', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 64400, shared: true, taxYear: U.taxYearOf(prevMonth + '-01'), createdAt: ago(5), demo: { kind: 'sheet', title: 'Annexure-C (sales), ' + U.monthLabel(prevMonth), rows: [['Buyers', '38'], ['Value', 'Rs 46,380,000'], ['Sales tax', 'Rs 8,348,400']] } }));
    doc(Object.assign(byFirm(c2, mainOwner, 'Draft financial statements FY' + ty + '.pdf'), { category: 'Financial statements', size: 902300, shared: true, createdAt: ago(1, 6), approval: { status: 'pending', requestedAt: ago(1, 6), requestedBy: A, note: 'Draft for management review before the auditors sign.' }, demo: { kind: 'return', title: 'Financial statements for the year ended 30 June ' + ty + ' (draft)', rows: [['Revenue', 'Rs 512,400,000'], ['Gross profit', 'Rs 71,736,000'], ['Profit before tax', 'Rs 24,980,000'], ['Taxation', 'Rs 7,244,200']] } }));
    doc(Object.assign(byFirm(c2, mainOwner, 'Show cause notice ST s.11(2).pdf'), { category: 'FBR notice', size: 154000, shared: true, createdAt: ago(11), demo: { kind: 'letter', title: 'Show cause notice under section 11(2), Sales Tax Act 1990', rows: [['Subject', 'Inadmissible input tax, Jan to Jun ' + (ty - 1)], ['Amount involved', 'Rs 1,850,000'], ['Reply by', dIn(14)]] } }));
    doc(Object.assign(byFirm(c4, hina, 'Return acknowledgement TY' + ty + '.pdf'), { category: 'Tax return', size: 90100, shared: true, createdAt: ago(6, 4), demo: { kind: 'letter', title: 'Acknowledgement of return, Tax Year ' + ty, rows: [['Taxpayer', 'Dr. Sana Malik'], ['Acknowledgement', '2026-ITR-0004417'], ['Status', 'Filed']] } }));
    doc(Object.assign(byFirm(c5, omer, 'Notice u-s 114(4) TY' + ty + '.pdf'), { category: 'FBR notice', size: 120400, createdAt: ago(17), demo: { kind: 'letter', title: 'Notice to furnish return of income, section 114(4)', rows: [['Taxpayer', 'Bilal Ahmed'], ['Tax year', String(ty)], ['Comply by', dIn(8)]] } }));
    doc(Object.assign(byFirm(c8, mainOwner, 'Notice u-s 122(9) TY' + (ty - 2) + '.pdf'), { category: 'FBR notice', size: 210400, taxYear: ty - 2, createdAt: ago(24) }));
    doc(Object.assign(byFirm(c8, mainOwner, 'Reply to 122(9), working draft.docx'), { category: 'Notice reply', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 64300, taxYear: ty - 2, createdAt: ago(2), note: 'Internal draft. Not shared with the client yet.' }));
    doc(Object.assign(byClient(c10, 'Rent agreement, House 45.pdf'), { category: 'Agreement or contract', size: 342000, createdAt: ago(14) }));
    doc(Object.assign(byClient(c10, 'JazzCash receipt for fee.jpg'), { category: 'Challan or CPR', mime: 'image/jpeg', size: 128400, seenByFirm: false, createdAt: ago(0, 5) }));
    doc(Object.assign(byFirm(c9, hina, 'PSEB registration certificate.pdf'), { category: 'Agreement or contract', size: 101200, createdAt: ago(14) }));
    doc(Object.assign(byFirm(c6, hina, 'Salary certificate FY' + (ty - 1) + '-' + String(ty).slice(2) + '.pdf'), { category: 'Salary certificate', size: 99100, createdAt: ago(18) }));

    // comments on documents
    const cm = (d, user, role, text, kind, at) => put('comments', { firmId: F, clientId: d.clientId, docId: d.id, userId: user.id, name: user.name, role, text, internal: false, kind: kind || 'comment', createdAt: at });
    cm(dReturn, hina, 'firm', 'Your refund for TY' + ty + ' comes to Rs 8,750 because your employer deducted a little more tax than chargeable. Please review and approve.', 'request', ago(3, 2));
    cm(dWealth, { id: p1.id, name: c1.name }, 'client', 'Please add my car purchased in March (Honda City). I will upload the registration book.', 'changes', ago(1, 3));
    cm(dWealth, hina, 'firm', 'Thank you. Please upload the registration book copy and we will send a revised draft the same day.', 'comment', ago(1, 1));

    /* ---------- document requests */
    const rq = (c, title, due, status, at) => put('requests', { firmId: F, clientId: c.id, title, note: '', dueDate: due, status: status || 'open', requestedBy: c.assignedTo || A, createdAt: at || ago(2) });
    rq(c1, 'Bank profit and withholding certificate TY' + ty, dIn(3), 'open', ago(2));
    rq(c1, 'Vehicle registration book (Honda City)', dIn(5), 'open', ago(1, 1));
    rq(c5, 'Bank statements Jul ' + (ty - 1) + ' to Jun ' + ty, dAgo(2), 'open', ago(12));
    rq(c2, U.monthLabel(curMonth) + ' sales and purchase registers', U.addMonths(curMonth + '-01', 1).slice(0, 7) + '-10', 'open', ago(1));
    rq(c10, 'Tenant CNIC copies', dAgo(10), 'fulfilled', ago(16));

    /* ---------- notices */
    const nt = (o) => put('notices', Object.assign({ firmId: F, createdBy: A, authority: 'FBR', title: '', noticeNo: '', amount: 0, priority: 'high', notes: '', visibleToClient: true, hearingDate: '' }, o));
    nt({ clientId: c5.id, section: '114(4)', title: 'Notice to file return for TY' + ty, noticeNo: 'IR-114-' + ty + '-55821', taxYear: ty, issueDate: dAgo(19), receivedDate: dAgo(17), dueDate: U.addDays(itrDue, -1) < td ? dIn(3) : U.addDays(itrDue, -1), status: 'in_progress', priority: 'urgent', assignedTo: O, notes: 'File the return before the compliance date to close the notice. Client to restore ATL status.' });
    nt({ clientId: c2.id, section: 'ST-11', title: 'Show cause on inadmissible input tax', noticeNo: 'ST-11-LTO-88213', taxYear: ty - 1, issueDate: dAgo(12), receivedDate: dAgo(11), dueDate: dIn(14), hearingDate: dIn(16), status: 'received', amount: 1850000, priority: 'high', assignedTo: A, notes: 'Collect input invoices for Jan to Jun. Two suppliers may be blacklisted.' });
    nt({ clientId: c8.id, section: '122(9)', title: 'Show cause before amending TY' + (ty - 2) + ' assessment', noticeNo: 'IR-122-' + (ty - 2) + '-30177', taxYear: ty - 2, issueDate: dAgo(25), receivedDate: dAgo(24), dueDate: dIn(22), status: 'in_progress', amount: 640000, priority: 'high', assignedTo: A, notes: 'Department disallowed fuel expenses. Prepare ledger extracts and vehicle logs.' });
    nt({ clientId: c3.id, section: '176', title: 'Information on bank credits', noticeNo: 'IR-176-' + (ty - 1) + '-12093', taxYear: ty - 1, issueDate: dAgo(48), receivedDate: dAgo(47), dueDate: dAgo(33), status: 'closed', priority: 'normal', assignedTo: O, notes: 'Replied with bank reconciliation. Closed without further action.' });
    nt({ clientId: c4.id, section: '177', title: 'Selected for audit, TY' + (ty - 1), noticeNo: 'IR-177-' + (ty - 1) + '-04412', taxYear: ty - 1, issueDate: dAgo(36), receivedDate: dAgo(35), dueDate: dAgo(6), status: 'responded', priority: 'high', assignedTo: H, notes: 'Documents submitted. Waiting for the officer.' });

    /* ---------- tasks */
    const tk = (o) => put('tasks', Object.assign({ firmId: F, createdBy: A, notes: '', clientId: null, priority: 'normal', status: 'todo', doneAt: null }, o));
    tk({ title: 'Add the Honda City to Asif\'s wealth statement and resend the draft', clientId: c1.id, dueDate: dIn(1), priority: 'high', assignedTo: H });
    tk({ title: 'Reconcile Asif\'s bank profit with the WHT certificate', clientId: c1.id, dueDate: dIn(2), priority: 'normal', assignedTo: H });
    tk({ title: 'Chase Bilal on WhatsApp for bank statements', clientId: c5.id, dueDate: td, priority: 'urgent', assignedTo: O });
    tk({ title: 'File Hamza Builders sales tax return for ' + U.monthLabel(prevMonth), clientId: c11.id, dueDate: prevDue, priority: 'urgent', assignedTo: O });
    tk({ title: 'Draft reply to the 122(9) show cause for Swift Cargo', clientId: c8.id, dueDate: dIn(15), priority: 'high', assignedTo: A, status: 'doing' });
    tk({ title: 'Prepare Annexure-C for Meher Textiles, ' + U.monthLabel(curMonth), clientId: c2.id, dueDate: dIn(16), assignedTo: A });
    tk({ title: 'Send fee reminders for overdue invoices', dueDate: dIn(1), assignedTo: A });
    tk({ title: 'Run an ATL status check for all individual clients', dueDate: dIn(7), assignedTo: O });
    tk({ title: 'Collect tenant CNICs from Noor Fatima', clientId: c10.id, dueDate: dAgo(10), status: 'done', doneAt: ago(9), assignedTo: H });

    /* ---------- events */
    put('events', { firmId: F, createdBy: A, title: 'Team review: return season backlog', date: dIn(1), time: '10:00', clientId: null, notes: 'Go through every filing still in preparation.' });
    put('events', { firmId: F, createdBy: A, title: 'Meeting with Meher Textiles CFO', date: dIn(4), time: '15:30', clientId: c2.id, notes: 'Discuss the s.11 show cause and audit timeline.' });

    /* ---------- invoices and payments */
    const retainers = [[c2, 75000, 16], [c8, 60000, 0], [c3, 20000, 0], [c7, 18000, 16], [c11, 30000, 16]];
    const invRows = [];
    const firstOf = (k) => U.addMonths(curMonth + '-01', -k);
    for (let k = 5; k >= 0; k--) {
      const ms = firstOf(k);
      const label = U.monthLabel(ms.slice(0, 7));
      for (const [c, amt, tax] of retainers) {
        const issue = U.addDays(ms, 1);
        let due = U.addDays(issue, 7), pay = null, partial = null;
        if (k >= 2) pay = U.addDays(issue, 6 + (amt % 4));
        if (k === 1) { if (c === c2) partial = 40000; if (c === c8 || c === c7) pay = U.addDays(issue, 8); }
        if (k === 0) { due = U.addDays(ms, 25); if (c === c8) pay = dAgo(2); }
        invRows.push({ c, issue, due, items: [{ desc: 'Monthly tax retainer, ' + label, qty: 1, rate: amt }], tax, pay, partial, status: 'sent' });
      }
    }
    invRows.push({ c: c6, issue: dAgo(28), due: dAgo(21), items: [{ desc: 'Income tax return and wealth statement, TY' + ty, qty: 1, rate: 18000 }], tax: 0, pay: dAgo(20), status: 'sent' });
    invRows.push({ c: c1, issue: dAgo(10), due: dIn(5), items: [{ desc: 'Annual tax retainer, first instalment', qty: 1, rate: 12500 }, { desc: 'Refund claim preparation, TY' + ty, qty: 1, rate: 3000 }], tax: 0, status: 'sent' });
    invRows.push({ c: c4, issue: dAgo(6), due: dIn(8), items: [{ desc: 'Return and wealth statement, TY' + ty, qty: 1, rate: 25000 }, { desc: 'Audit (s.177) documentation support', qty: 1, rate: 5000 }], tax: 0, status: 'sent' });
    invRows.push({ c: c10, issue: dAgo(9), due: dIn(5), items: [{ desc: 'Return with rental income schedule, TY' + ty, qty: 1, rate: 22000 }], tax: 0, proof: true, status: 'sent' });
    invRows.push({ c: c9, issue: dAgo(1), due: dIn(7), items: [{ desc: 'Return for IT export income, TY' + ty, qty: 1, rate: 20000 }], tax: 0, status: 'draft' });
    invRows.push({ c: c5, issue: dAgo(12), due: dAgo(5), items: [{ desc: 'Reply to s.114(4) notice and late return', qty: 1, rate: 15000 }], tax: 0, status: 'sent' });
    invRows.sort((a, b) => (a.issue > b.issue ? 1 : -1));
    let seq = 0;
    const methods = ['Bank transfer', 'Raast', 'JazzCash', 'Cheque', 'Bank transfer', 'Easypaisa'];
    invRows.forEach((r, idx) => {
      seq++;
      const inv = put('invoices', { firmId: F, clientId: r.c.id, number: 'RTA-' + r.issue.slice(0, 4) + '-' + U.pad(seq, 4), issueDate: r.issue, dueDate: r.due, items: r.items, taxRate: r.tax, taxLabel: r.tax ? 'PST (PRA)' : '', discount: 0, notes: '', status: r.status, sentAt: r.status === 'sent' ? U.iso(Date.parse(r.issue + 'T10:00:00+05:00')) : null, createdBy: A, createdAt: U.iso(Date.parse(r.issue + 'T10:00:00+05:00')) });
      const total = U.round2(r.items.reduce((s, i) => s + i.qty * i.rate, 0) * (1 + r.tax / 100));
      const when = (ds) => U.iso(Date.parse(ds + 'T15:00:00+05:00'));
      if (r.pay) put('payments', { firmId: F, clientId: r.c.id, invoiceId: inv.id, amount: total, method: methods[idx % methods.length], reference: 'REF' + (40211 + idx * 7), date: r.pay, status: 'confirmed', recordedBy: A, note: '', createdAt: when(r.pay) });
      if (r.partial) put('payments', { firmId: F, clientId: r.c.id, invoiceId: inv.id, amount: r.partial, method: 'Cheque', reference: 'CHQ-118204', date: U.addDays(r.issue, 9), status: 'confirmed', recordedBy: A, note: 'Balance promised next week', createdAt: when(U.addDays(r.issue, 9)) });
      if (r.proof) put('payments', { firmId: F, clientId: r.c.id, invoiceId: inv.id, amount: total, method: 'JazzCash', reference: 'JC-77129034', date: td, status: 'pending', submittedBy: p10.id, proofBlobId: null, proofName: 'JazzCash receipt for fee.jpg', proofMime: 'image/jpeg', note: 'Paid from my JazzCash wallet', createdAt: ago(0, 5) });
    });
    I.patch('firms', F, { invoiceSeq: seq });

    /* ---------- expenses */
    for (let k = 5; k >= 0; k--) {
      const ms = firstOf(k);
      const e = (day, category, description, amount, method) => { const d = U.addDays(ms, day); if (d <= td) put('expenses', { firmId: F, createdBy: A, date: d, category, description, amount, method }); };
      e(0, 'Office rent', 'Office rent, Gulberg', 45000, 'Bank transfer');
      e(0, 'Salaries', 'Staff salaries', 85000 + (k < 3 ? 10000 : 0), 'Bank transfer');
      e(9, 'Utilities', 'Electricity, internet and phones', 9500 + k * 400, 'Bank transfer');
      e(14, 'Printing and stationery', 'Files, printing and courier', 2800 + k * 200, 'Cash');
      if (k % 2 === 0) e(18, 'Travel', 'Visits to RTO and client sites', 5200, 'Cash');
      if (k === 3) e(20, 'Marketing', 'Facebook ads for return season', 18000, 'Bank transfer');
    }
    put('expenses', { firmId: F, createdBy: A, date: U.pktDate(Date.parse(ago(53))), category: 'Software and subscriptions', description: 'FinTax Firm Pro, annual', amount: planById('firm').annual, method: 'Raast' });

    /* ---------- messages */
    const msg = (c, user, role, text, at, read) => put('messages', { firmId: F, clientId: c.id, userId: user.id, name: user.name, role, text, readByFirm: role === 'firm' ? true : read !== false, readByClient: role === 'client' ? true : read !== false, createdAt: at });
    const asif = { id: p1.id, name: c1.name };
    msg(c1, hina, 'firm', 'Assalam o Alaikum Asif sahab. Your draft return for TY' + ty + ' is ready in the portal. Please review and approve when you can.', ago(3, 2));
    msg(c1, asif, 'client', 'Walaikum Assalam. I checked it. The wealth statement is missing my car, I bought a Honda City in March.', ago(1, 3));
    msg(c1, hina, 'firm', 'Thank you for pointing that out. Please upload the registration book copy and we will update the statement.', ago(1, 1));
    msg(c1, asif, 'client', 'I will upload it tonight. Will you file as soon as I approve?', ago(0, 20));
    msg(c1, hina, 'firm', 'Yes. We file the same day you approve both drafts, and the acknowledgement will appear in your portal.', ago(0, 19), false);
    const meher = { id: p2.id, name: c2.name };
    msg(c2, meher, 'client', U.monthLabel(prevMonth) + ' registers are uploaded. Please share Annexure-C for checking.', ago(5, 4));
    msg(c2, mainOwner, 'firm', 'Annexure-C is shared. We also need the input invoices for January to June for the s.11 show cause.', ago(5, 1));
    msg(c2, meher, 'client', 'Noted. Our accounts team will send the invoices this week.', ago(0, 3), false);
    msg(c10, { id: p10.id, name: c10.name }, 'client', 'I have paid the invoice through JazzCash and submitted the transaction ID.', ago(0, 5), false);

    /* ---------- credentials vault */
    const vlt = (c, portalName, username) => put('vault', { firmId: F, clientId: c.id, createdBy: A, portal: portalName, username, secret: I.cipher.encrypt('Demo#Pass2026'), pin: I.cipher.encrypt('1234'), notes: 'Demo credentials' });
    vlt(c1, 'FBR IRIS', '3520200001011');
    vlt(c2, 'FBR IRIS', '0000202');
    vlt(c2, 'PRA e-portal', 'P0000202');
    vlt(c8, 'SRB e-services', 'S0000808');

    /* ---------- notifications */
    const nf = (uid, title, body, link, kind, at, read) => put('notifications', { userId: uid, title, body: body || '', link: link || '', kind: kind || 'info', read: !!read, createdAt: at });
    nf(A, c2.name + ' uploaded Sales register ' + U.monthLabel(prevMonth) + '.xlsx', 'Sales invoices', '/app/clients/' + c2.id + '/documents?open=' + dSales.id, 'upload', ago(0, 3));
    nf(A, c10.name + ' submitted a payment of Rs 22,000', 'Confirm it under Payments.', '/app/payments', 'payment', ago(0, 5));
    nf(A, c1.name + ' requested changes on Draft wealth statement TY' + ty, 'Please add my car purchased in March (Honda City).', '/app/clients/' + c1.id + '/documents?open=' + dWealth.id, 'warning', ago(1, 3));
    nf(A, 'Payment verified. Firm Pro is active', 'Thank you for subscribing.', '/app/subscription', 'success', ago(53), true);
    nf(H, c1.name + ' requested changes on Draft wealth statement TY' + ty, '', '/app/clients/' + c1.id + '/documents?open=' + dWealth.id, 'warning', ago(1, 3));
    nf(H, 'Abdul Rehman assigned you a task', 'Reconcile Asif\'s bank profit with the WHT certificate', '/app/tasks', 'task', ago(2));
    nf(p1.id, 'Please review and approve: Draft income tax return TY' + ty, 'Rehman Tax Advisors', '/portal/documents?open=' + dReturn.id, 'approval', ago(3, 2));
    nf(p1.id, 'Document requested: Bank profit and withholding certificate TY' + ty, 'Rehman Tax Advisors', '/portal/documents?tab=requests', 'request', ago(2));
    nf(p1.id, 'New message from Rehman Tax Advisors', 'We file the same day you approve both drafts.', '/portal/messages', 'message', ago(0, 19));
    nf(admin.id, 'New sign-up: Multan Tax Clinic', 'Sadia Bukhari, Multan started a Practice trial', '/admin/firms', 'signup', ago(1, 2));
    nf(admin.id, 'Payment to verify: Quetta Fiscal Advisors', 'Rs 34,990 via Bank transfer', '/admin/payments', 'payment', ago(0, 6));
    nf(admin.id, 'New lead: Rashid Mehmood', 'Exit offer, Lahore', '/admin/leads', 'lead', ago(0, 2));

    /* ---------- activity for the main practice */
    const act = (user, action, summary, at, clientId) => put('activity', { firmId: F, userId: user.id, userName: user.name, role: user.role || 'client', action, summary, clientId: clientId || null, createdAt: at });
    act({ id: p2.id, name: c2.name, role: 'client' }, 'portal.upload', c2.name + ' uploaded Sales register ' + U.monthLabel(prevMonth) + '.xlsx', ago(0, 3), c2.id);
    act({ id: p10.id, name: c10.name, role: 'client' }, 'portal.pay', c10.name + ' submitted Rs 22,000 for a fee invoice', ago(0, 5), c10.id);
    act(hina, 'task.done', 'Hina Javed completed: Collect tenant CNICs from Noor Fatima', ago(9), c10.id);
    act(mainOwner, 'filing.stage', 'Sales tax return (' + U.monthLabel(prevMonth) + ') for Meher Textiles (Pvt) Ltd moved to Filed', ago(4, 2), c2.id);
    act({ id: p1.id, name: c1.name, role: 'client' }, 'doc.decide', c1.name + ' requested changes on Draft wealth statement TY' + ty, ago(1, 3), c1.id);
    act(hina, 'doc.approval', 'Sent Draft income tax return TY' + ty + ' to the client for approval', ago(3, 2), c1.id);
    act(mainOwner, 'doc.approval', 'Sent Draft financial statements FY' + ty + ' to the client for approval', ago(1, 6), c2.id);
    act(omer, 'notice.update', 'Updated notice s.114(4) Notice to file return for Bilal Ahmed (Preparing reply)', ago(2, 4), c5.id);
    act(mainOwner, 'invoice.send', 'Sent invoice to Dr. Sana Malik', ago(6), c4.id);
    act(hina, 'filing.stage', 'Income tax return (Tax Year ' + ty + ') for Dr. Sana Malik moved to Filed', ago(6, 5), c4.id);

    /* ---------- platform: leads, tickets, announcements */
    const ld = (name, city, source, status, at, message, practice) => put('leads', { name, email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com', phone: '0390-' + (2000000 + name.length * 1371), city, practice: practice || '', size: '', source, message: message || '', status, notes: '', createdAt: at });
    ld('Rashid Mehmood', 'Lahore', 'Exit offer', 'new', ago(0, 2));
    ld('Ayesha Noor', 'Karachi', 'Tax calculator', 'new', ago(0, 9));
    ld('Faisal Qadri', 'Islamabad', 'Contact form', 'contacted', ago(2), 'We are four people handling around 300 clients. Can we import from Excel?', 'Qadri Tax Services');
    ld('Shazia Rauf', 'Multan', 'Compliance calendar', 'demo', ago(4), '', 'Rauf & Co.');
    ld('Kamran Ali', 'Peshawar', 'Pricing', 'won', ago(9));
    ld('Junaid Akhtar', 'Sialkot', 'Exit offer', 'lost', ago(15), 'Only needs a tax calculator for now.');
    const firmBy = (name) => I.all('firms').find((f) => f.name === name);
    const fMalik = firmBy('Malik & Associates'), fFsd = firmBy('Faisalabad Tax Point');
    put('tickets', { firmId: fMalik.id, userId: fMalik.ownerId, userName: 'Usman Malik', subject: 'How do I import clients from Excel?', priority: 'normal', status: 'waiting', thread: [{ userId: fMalik.ownerId, name: 'Usman Malik', role: 'customer', text: 'We have 220 clients in an Excel sheet. Is there a way to bring them in without typing each one?', at: ago(2, 5) }, { userId: admin.id, name: admin.name, role: 'support', text: 'Yes. Open Clients, choose Import CSV and save your sheet as CSV first. Name, CNIC, NTN, phone and email columns are picked up automatically.', at: ago(2, 1) }], createdAt: ago(2, 5) });
    put('tickets', { firmId: fFsd.id, userId: fFsd.ownerId, userName: 'Kashif Iqbal', subject: 'Can we add our logo to invoices?', priority: 'normal', status: 'open', thread: [{ userId: fFsd.ownerId, name: 'Kashif Iqbal', role: 'customer', text: 'Our clients asked for invoices with our firm logo. Where do I upload it?', at: ago(0, 7) }], createdAt: ago(0, 7) });
    put('announcements', { title: 'New: create monthly returns for every registered client in one step', body: 'Open Filings and choose Bulk create. Pick the month and authority, and FinTax adds a return for each client who is registered there.', audience: 'consultants', active: true, link: '/app/filings', createdAt: ago(3) });

    return { adminEmail: 'admin@fintax.demo', consultantEmail: 'consultant@fintax.demo', staffEmail: 'staff@fintax.demo', clientEmail: 'client@fintax.demo', password: opts.password || 'demo123' };
  }

  return { seedDemo };
});
