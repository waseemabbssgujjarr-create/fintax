/* Core logic tests: run with `node tests/core.test.js` */
'use strict';
const assert = require('assert');
const Core = require('../public/core/core.js');
const Seed = require('../public/core/seed.js');

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; } catch (e) { console.error('FAIL', name, '\n ', e && e.stack || e); process.exitCode = 1; } };
const throwsCode = (fn, code) => { try { fn(); } catch (e) { assert.strictEqual(e.code, code, 'expected ' + code + ' got ' + e.code + ': ' + e.message); return; } throw new Error('expected throw ' + code); };

assert.strictEqual(Core.sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
assert.strictEqual(Core.sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

const fixedNow = Date.parse('2026-10-21T18:00:00Z');
const core = Core.create({ preview: true, now: () => fixedNow });
const creds = Seed.seedDemo(core);
const login = (email) => core.exec(null, 'auth.login', { email, password: 'demo123' });

const admin = login(creds.adminEmail);
const owner = login(creds.consultantEmail);
const staff = login(creds.staffEmail);
const client = login(creds.clientEmail);

t('roles', () => { assert.strictEqual(admin.role, 'admin'); assert.strictEqual(owner.role, 'consultant'); assert.strictEqual(staff.role, 'staff'); assert.strictEqual(client.role, 'client'); });
t('bad login', () => throwsCode(() => core.exec(null, 'auth.login', { email: creds.adminEmail, password: 'nope' }), 'bad_login'));

t('public site', () => {
  const s = core.exec(null, 'public.site', {});
  assert.strictEqual(s.plans.length, 2);
  assert.ok(s.offer && s.offer.left >= 0 && s.offer.seats === 40, 'offer');
  assert.ok(s.deadlines.length > 0, 'deadlines');
  assert.ok(s.deadlines.some((d) => d.featured && d.date === '2026-10-31'), 'featured deadline present');
  assert.ok(s.signups.length > 0, 'signups');
  assert.strictEqual(s.stats, null, 'stats hidden below threshold');
  assert.ok(s.faqs.length >= 5);
  assert.strictEqual(s.testimonials.length, 0);
});

t('tax calc', () => {
  const r27 = core.taxCalc({ year: 2027, type: 'salaried', income: 2200000 });
  assert.strictEqual(r27.total, 116000);
  const r26 = core.taxCalc({ year: 2026, type: 'salaried', income: 3960000 });
  assert.strictEqual(r26.total, 574000);
  const r27b = core.taxCalc({ year: 2027, type: 'salaried', income: 7000000 });
  assert.strictEqual(r27b.total, 1424000);
  const biz = core.taxCalc({ year: 2027, type: 'business', income: 5600000 });
  assert.strictEqual(biz.total, 1610000);
  const bizS = core.taxCalc({ year: 2027, type: 'business', income: 12000000 });
  assert.strictEqual(bizS.tax, 1610000 + Math.round((12000000 - 5600000) * 0.45));
  assert.strictEqual(bizS.surcharge, Math.round(bizS.tax * 0.10));
  const sal26hi = core.taxCalc({ year: 2026, type: 'salaried', income: 12000000 });
  assert.strictEqual(sal26hi.surcharge, Math.round(sal26hi.tax * 0.09));
});

t('admin overview', () => {
  const o = core.exec(admin, 'admin.overview', {});
  assert.ok(o.kpis.firms >= 15);
  assert.ok(o.kpis.mrr > 0);
  assert.strictEqual(o.pending.length, 2);
  assert.strictEqual(o.revenue.length, 6);
});

t('admin plan edit reflects on site', () => {
  const plans = core.exec(admin, 'admin.plans', {});
  const p = plans[0];
  core.exec(admin, 'admin.plan.save', Object.assign({}, p, { monthly: 3999, annual: 39990, bullets: p.bullets.join('\n') }));
  const s = core.exec(null, 'public.site', {});
  assert.strictEqual(s.plans[0].monthly, 3999);
  assert.strictEqual(s.plans[0].annual, 39990);
  throwsCode(() => core.exec(admin, 'admin.plan.save', { id: 'nope', name: 'x' }), 'not_found');
});

t('payment approval activates firm', () => {
  const pays = core.exec(admin, 'admin.payments', {}).filter((p) => p.status === 'pending');
  assert.strictEqual(pays.length, 2);
  core.exec(admin, 'admin.payment.review', { id: pays[0].id, decision: 'approve' });
  const f = core.exec(admin, 'admin.firm', { id: pays[0].firmId });
  assert.strictEqual(f.firm.sub.status, 'active');
  throwsCode(() => core.exec(admin, 'admin.payment.review', { id: pays[1].id, decision: 'reject' }), 'bad_request'); // needs note
  core.exec(admin, 'admin.payment.review', { id: pays[1].id, decision: 'reject', note: 'Reference not found' });
});

t('forbidden across roles', () => {
  throwsCode(() => core.exec(owner, 'admin.overview', {}), 'forbidden');
  throwsCode(() => core.exec(client, 'clients.list', {}), 'forbidden');
  throwsCode(() => core.exec(staff, 'team.save', { name: 'X', email: 'x@example.com' }), 'owner_only');
  throwsCode(() => core.exec(null, 'firm.overview', {}), 'auth');
});

t('firm overview + lists', () => {
  const o = core.exec(owner, 'firm.overview', {});
  assert.ok(o.kpis.activeClients === 12, 'clients ' + o.kpis.activeClients);
  assert.ok(o.upcoming.length > 0);
  assert.ok(o.kpis.outstanding > 0);
  const cl = core.exec(owner, 'clients.list', {});
  assert.strictEqual(cl.length, 12);
  const asif = cl.find((c) => c.name === 'Muhammad Asif');
  assert.ok(asif.portal && asif.portal.enabled);
  const det = core.exec(owner, 'client.get', { id: asif.id });
  assert.ok(det.stats.pendingApprovals === 1);
  const fl = core.exec(owner, 'filings.list', {});
  assert.ok(fl.length > 20);
  assert.ok(fl.some((f) => f.overdue));
  const inv = core.exec(owner, 'invoices.list', {});
  assert.ok(inv.some((i) => i.status === 'overdue'));
  assert.ok(inv.some((i) => i.status === 'partial' || i.status === 'overdue'));
  assert.ok(inv.some((i) => i.status === 'paid'));
  const cal = core.exec(owner, 'calendar', { from: '2026-10-01', to: '2026-11-30' });
  assert.ok(cal.some((e) => e.kind === 'deadline' && e.date === '2026-11-18'));
  assert.ok(cal.some((e) => e.kind === 'deadline' && e.title.indexOf('Withholding') >= 0 && e.date === '2026-10-20'));
  const rep = core.exec(owner, 'reports', {});
  assert.ok(rep.series.length >= 6 && rep.totals.collected > 0 && rep.aging);
  const th = core.exec(owner, 'threads.list', {});
  assert.ok(th.length >= 10);
  const s = core.exec(owner, 'search', { q: 'meher' });
  assert.ok(s.clients.length === 1);
});

t('tenancy isolation', () => {
  const other = core.store.all('users').find((u) => u.role === 'consultant' && u.email !== creds.consultantEmail);
  const otherUser = { id: other.id };
  const asifId = core.store.all('clients').find((c) => c.name === 'Muhammad Asif').id;
  throwsCode(() => core.exec(otherUser, 'client.get', { id: asifId }), 'not_found');
  const docId = core.store.all('docs').find((d) => d.clientId === asifId).id;
  throwsCode(() => core.exec(otherUser, 'doc.get', { id: docId }), 'not_found');
  // client can't see other client's docs
  const meherDoc = core.store.all('docs').find((d) => d.name.indexOf('Annexure') === 0);
  throwsCode(() => core.exec(client, 'doc.get', { id: meherDoc.id }), 'not_found');
  // client can't see unshared firm doc of their own
  const reply = core.store.all('docs').find((d) => d.name.indexOf('Reply to 122') === 0);
  assert.ok(reply && !reply.shared);
  throwsCode(() => core.exec(owner, 'files.authorize', { blobId: 'missing' }), 'not_found');
});

t('client portal flows', () => {
  const home = core.exec(client, 'portal.home', {});
  assert.strictEqual(home.actions.requests.length, 2);
  assert.strictEqual(home.actions.approvals.length, 1);
  assert.strictEqual(home.actions.filingApprovals.length, 1);
  const docs = core.exec(client, 'portal.docs', {});
  assert.ok(docs.docs.every((d) => d.shared || d.uploaderRole === 'client'));
  const pending = home.actions.approvals[0];
  const det = core.exec(client, 'doc.get', { id: pending.id });
  assert.ok(det.comments.length >= 1);
  throwsCode(() => core.exec(client, 'doc.decide', { id: pending.id, decision: 'changes' }), 'bad_request');
  core.exec(client, 'doc.decide', { id: pending.id, decision: 'approved', note: 'Looks right' });
  const f = core.exec(owner, 'filings.list', {}).find((x) => x.approvalDocId === pending.id);
  assert.strictEqual(f.stage, 'ready', 'filing moved to ready after doc approval');
  // upload fulfils a request
  const req = home.actions.requests[0];
  core.exec(client, 'portal.upload', { name: 'Bank certificate.pdf', category: 'Bank profit or WHT certificate', size: 1000, mime: 'application/pdf', requestId: req.id });
  const after = core.exec(client, 'portal.home', {});
  assert.strictEqual(after.actions.requests.length, 1);
  // message
  core.exec(client, 'portal.send', { text: 'Uploaded the certificate.' });
  const ping = core.exec(owner, 'me.ping', {});
  assert.ok(ping.unread.messages >= 1);
  // pay
  const inv = core.exec(client, 'portal.invoices', {}).invoices.find((i) => i.status === 'sent');
  core.exec(client, 'portal.pay', { invoiceId: inv.id, amount: inv.balance, method: 'Raast', reference: 'R-1' });
  const pays = core.exec(owner, 'payments.list', {}).filter((p) => p.status === 'pending');
  assert.ok(pays.length >= 2);
  core.exec(owner, 'payment.confirm', { id: pays.find((p) => p.invoiceId === inv.id).id });
  const inv2 = core.exec(client, 'portal.invoices', {}).invoices.find((i) => i.id === inv.id);
  assert.strictEqual(inv2.status, 'paid');
});

t('consultant CRUD', () => {
  const c = core.exec(owner, 'client.save', { type: 'individual', name: 'Test Person', cnic: '35202-0000999-9', phone: '0390-0000999', email: 'test.person@example.com', registrations: ['FBR'] });
  const inv = core.exec(owner, 'portal.invite', { clientId: c.id });
  assert.ok(inv.password && inv.email === 'test.person@example.com');
  const tp = core.exec(null, 'auth.login', { email: inv.email, password: inv.password });
  assert.strictEqual(tp.role, 'client');
  const d = core.exec(owner, 'doc.create', { clientId: c.id, name: 'Draft.pdf', category: 'Tax return', size: 10, approval: true });
  assert.strictEqual(d.shared, true);
  const n = core.store.all('notifications').filter((x) => x.userId === tp.id);
  assert.ok(n.length === 1);
  const fl = core.exec(owner, 'filing.save', { clientId: c.id, type: 'itr', taxYear: 2026, dueDate: '2026-10-31' });
  core.exec(owner, 'filing.move', { id: fl.id, stage: 'filed', ackNumber: 'X1' });
  assert.ok(core.store.get('filings', fl.id).filedAt);
  const i = core.exec(owner, 'invoice.save', { clientId: c.id, items: [{ desc: 'Fee', qty: 1, rate: 10000 }], taxRate: 16, send: true });
  assert.strictEqual(i.total, 11600);
  core.exec(owner, 'payment.record', { invoiceId: i.id, amount: 11600 });
  assert.strictEqual(core.exec(owner, 'invoices.list', {}).find((x) => x.id === i.id).status, 'paid');
  const b = core.exec(owner, 'filing.bulk', { type: 'stx', authority: 'FBR', taxYear: 2027, period: '2026-11', dueDate: '2026-12-18', clientIds: core.exec(owner, 'clients.list', {}).filter((x) => x.registrations.indexOf('FBR') >= 0 && x.type !== 'individual').map((x) => x.id) });
  assert.ok(b.created >= 3);
  const team = core.exec(owner, 'team.save', { name: 'New Staff', email: 'new.staff@example.com' });
  assert.ok(team.password);
  const imp = core.exec(owner, 'client.import', { rows: [{ name: 'Imported One', cnic: '1', type: 'company' }, { name: 'Imported One', cnic: '1' }, {}] });
  assert.strictEqual(imp.created, 1);
  const v = core.exec(owner, 'vault.list', { clientId: core.store.all('clients').find((x) => x.name === 'Muhammad Asif').id });
  const r = core.exec(owner, 'vault.reveal', { id: v[0].id });
  assert.strictEqual(r.secret, 'Demo#Pass2026');
  core.exec(owner, 'client.delete', { id: c.id, confirm: 'Test Person' });
  assert.ok(!core.store.get('users', tp.id));
});

t('read-only when expired', () => {
  const expired = core.store.all('firms').find((f) => f.name === 'Peshawar Tax Consultants');
  const u = { id: expired.ownerId };
  assert.strictEqual(core.subscription(expired).status, 'expired');
  throwsCode(() => core.exec(u, 'client.save', { name: 'X' }), 'read_only');
  core.exec(u, 'firm.overview', {});
  core.exec(u, 'firm.pay', { planId: 'practice', cycle: 'monthly', reference: 'TX-1', method: 'JazzCash' });
});

t('plan limits + features', () => {
  const practiceFirm = core.store.all('firms').find((f) => f.name === 'Malik & Associates');
  const u = { id: practiceFirm.ownerId };
  throwsCode(() => core.exec(u, 'vault.list', { clientId: 'x' }), 'upgrade');
  throwsCode(() => core.exec(u, 'filing.bulk', { clientIds: ['x'] }), 'upgrade');
  core.exec(u, 'team.save', { name: 'Second', email: 'second@example.com' });
  throwsCode(() => core.exec(u, 'team.save', { name: 'Third', email: 'third@example.com' }), 'limit');
});

t('signup + forgot + impersonate', () => {
  const u = core.exec(null, 'auth.signup', { name: 'New Owner', email: 'new.owner@example.com', password: 'secret1', firmName: 'New Practice', city: 'Lahore', planId: 'firm', cycle: 'monthly' });
  assert.strictEqual(u.role, 'consultant');
  const me = core.exec(u, 'me.get', {});
  assert.strictEqual(me.sub.status, 'trial');
  assert.strictEqual(me.sub.daysLeft, 14);
  throwsCode(() => core.exec(null, 'auth.signup', { name: 'Dup', email: 'new.owner@example.com', password: 'secret1', firmName: 'X' }), 'exists');
  core.exec(null, 'auth.forgot', { email: 'new.owner@example.com' });
  assert.ok(core.exec(admin, 'admin.resets', {}).length >= 1);
  const imp = core.exec(admin, 'admin.impersonate', { firmId: me.firm.id });
  assert.strictEqual(imp.user.impersonatedBy, admin.id);
  const site = core.exec(null, 'public.site', {});
  assert.ok(site.signups[0].city === 'Lahore');
});

t('settings save', () => {
  const s = core.exec(admin, 'admin.settings.save', { section: 'site', data: { hero: { headline: 'New headline' } } });
  assert.strictEqual(s.site.hero.headline, 'New headline');
  assert.ok(s.site.hero.sub.length > 10, 'deep merge keeps other fields');
  const sys = core.exec(admin, 'admin.settings', {}).system;
  sys.rules[3].enabled = true;
  const s2 = core.exec(admin, 'admin.settings.save', { section: 'system', data: { rules: sys.rules, trialDays: 21 } });
  assert.strictEqual(s2.system.rules[3].enabled, true);
  assert.strictEqual(s2.system.trialDays, 21);
});

t('ticket flow', () => {
  const tk = core.exec(owner, 'support.create', { subject: 'Help', text: 'Need help' });
  core.exec(admin, 'ticket.reply', { id: tk.id, text: 'Sure' });
  assert.strictEqual(core.exec(owner, 'ticket.get', { id: tk.id }).status, 'waiting');
  const otherOwner = core.store.all('users').find((u) => u.role === 'consultant' && u.email === 'owner2@example.com');
  throwsCode(() => core.exec({ id: otherOwner.id }, 'ticket.get', { id: tk.id }), 'not_found');
});

console.log(passed + ' test groups passed' + (process.exitCode ? ' (with failures)' : ''));
const json = JSON.stringify(core.store.dump());
console.log('demo db size:', Math.round(json.length / 1024) + ' KB');
