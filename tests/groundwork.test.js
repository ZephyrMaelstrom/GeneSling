// Groundwork (step 1 of docs/IMPROVEMENTS.md): the event bus, the action registry, device options kept
// out of the save (v15), and the release build that exposes nothing on window.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
const run = (fn, ...a) => page.evaluate(fn, ...a);
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await run(() => { closeModal(); S.settings.god = true; });
});
after(async () => { await browser.close(); srv.server.close(); });

test('the release build exposes only gameReady; the dev build exposes window.gs', async () => {
  const {context, page: rel, errors: e2} = await openGame(browser, srv.url, {page: '/dist/index.html'});
  await rel.evaluate(() => window.gameReady);
  const r = await rel.evaluate(() => ({ready: typeof window.gameReady, gs: typeof window.gs, S: typeof window.S, startRaid: typeof window.startRaid, act: typeof window.act,
    tabs: document.querySelectorAll('#tabs .tab').length}));
  assert.deepEqual(r, {ready: 'object', gs: 'undefined', S: 'undefined', startRaid: 'undefined', act: 'undefined', tabs: r.tabs});
  assert.ok(r.tabs >= 9, 'the release build still boots and draws its tabs');
  // It still plays: the tab buttons work through the action registry.
  await rel.$eval('#tab-roster', el => el.click());
  assert.equal(await rel.$eval('#tab-roster', el => el.getAttribute('aria-selected')), 'true');
  assert.deepEqual(e2, []);
  await context.close();
  const d = await run(() => ({gs: typeof gs, same: gs.startRaid === startRaid, live: gs.S === S, n: Object.keys(gs).length}));
  assert.equal(d.gs, 'object'); assert.equal(d.same, true); assert.equal(d.live, true);
  assert.ok(d.n > 500);
});

test('events: handlers run in order, can unsubscribe, and one that throws does not stop the rest', async () => {
  const r = await run(async () => {
    const seen = [];
    const off1 = on('test:x', p => seen.push('b' + p), {order: 60});
    on('test:x', p => seen.push('a' + p), {order: 10});
    on('test:x', () => { throw new Error('boom from a handler'); }, {order: 20});
    on('test:x', p => seen.push('c' + p));
    emit('test:x', 1); off1(); emit('test:x', 2);
    await new Promise(r => setTimeout(r, 20));
    return {seen, n: listenerCount('test:x')};
  });
  assert.deepEqual(r.seen, ['a1', 'c1', 'b1', 'a2', 'c2']);
  assert.equal(r.n, 3);
  // The throw still surfaces as a page error, so a broken handler fails the tests.
  assert.ok(errors.some(e => /boom from a handler/.test(e)));
  errors.length = 0;
});

test('a raid end goes through the bus: notes from other systems, then raid:done; a day passes only in the real game', async () => {
  const r = await run(async () => {
    const got = [], days = [];
    const off = [on('raid:end', rep => { got.push(['end', rep.outcome, rep.extracted]); rep.notes.push('A note from a test system.'); }),
      on('raid:done', rep => got.push(['done', rep.day, rep.rank])), on('day:passed', () => days.push(S.day))];
    const day0 = S.day;
    startRaid('raid', 1); await new Promise(r => setTimeout(r, 100));
    R.enemies = []; endRaid('extract', 'rift');
    const note = $('#modalBox').innerText.includes('A note from a test system.'); closeModal();
    await new Promise(r => setTimeout(r, 50));
    processDay();                       // what the simulators call: no day:passed
    act('wait');                        // Wait one day
    off.forEach(f => f());
    return {got, days, day0, note, listeners: ['raid:end', 'raid:done', 'day:passed'].map(listenerCount)};
  });
  assert.deepEqual(r.got.map(x => x[0]), ['end', 'done']);
  assert.equal(r.got[0][1], 'extract'); assert.equal(r.got[0][2], true);
  assert.equal(r.got[1][1], r.day0, 'raid:done carries the day the raid ended on');
  assert.equal(r.note, true, 'a subscriber’s note shows on the results screen');
  assert.deepEqual(r.days, [r.day0 + 1, r.day0 + 3], 'day:passed after the raid and after Wait, not after a simulated day');
  // Lore, the Deepening and contracts settle on raid:end; telemetry and the demo on raid:done; the pace and the market on day:passed.
  assert.deepEqual(r.listeners, [3, 1, 2]);
});

test('every action on every screen has a handler, and a name can only be registered once', async () => {
  const r = await run(async () => {
    labEndgame(); S.settings.genes = true;
    const names = actionNames(), missing = new Set(), seen = new Set();
    const scan = () => document.querySelectorAll('#app [data-act], #modal [data-act]').forEach(el => {
      const a = el.dataset.act; seen.add(a);
      // Fields fire change (a slider may use input instead); buttons and links click.
      const field = el.tagName === 'SELECT' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
      const ok = field ? names.change.includes(a) || names.input.includes(a) : names.click.includes(a);
      if (!ok) missing.add((field ? 'field:' : 'click:') + a);
    });
    for (const [k] of TABS) { act('tab', {k}); scan(); }
    act('tab', {k: 'hideout'});
    for (const k of SECTION_IDS) { act('section', {k}); scan(); }
    let dup = '';
    try { onAct('tab', () => {}); } catch (e) { dup = e.message; }
    act('tab', {k: 'raid'});
    return {missing: [...missing], seen: seen.size, clicks: names.click.length, dup};
  });
  assert.deepEqual(r.missing, []);
  assert.ok(r.seen > 60, `scanned ${r.seen} distinct actions`);
  assert.ok(r.clicks > 100);
  assert.match(r.dup, /registered twice/);
});

test('device options live on the device, not in the save', async () => {
  const r = await run(async () => {
    OPTS.stickSize = 'L'; OPTS.palette = 'tritan'; saveOpts(); save(); await saveDone();
    const inSave = 'opts' in JSON.parse(JSON.stringify(S)), stored = JSON.parse(localStorage.getItem('genesling-opts'));
    newGame(); const kept = OPTS.stickSize;
    resetOpts();
    return {inSave, stored: [stored.stickSize, stored.palette], kept, after: OPTS.stickSize};
  });
  assert.deepEqual(r, {inSave: false, stored: ['L', 'tritan'], kept: 'L', after: 'M'});
});

test('a v14 save loads as v15: its options move to a device that has none, and never overwrite a device’s own', async () => {
  const old = await run(() => { const d = JSON.parse(JSON.stringify(S)); d.v = 14; d.opts = {...defaultOpts(), hand: 'left', vol: 0.3, music: 0}; return d; });
  // A fresh device: the save's options become the device's.
  // Planted in the fallback slot the game reads when IndexedDB has no save yet.
  const {context, page: p2, errors: e2} = await openGame(browser, srv.url, {before: pg => pg.evaluateOnNewDocument(d => {
    if (!localStorage.getItem('genesling-save')) localStorage.setItem('genesling-save', JSON.stringify(d));
  }, old)});
  const a = await p2.evaluate(() => ({v: S.v, opts: 'opts' in S, hand: OPTS.hand, vol: OPTS.vol, music: OPTS.music}));
  assert.deepEqual(a, {v: 15, opts: false, hand: 'left', vol: 0.3, music: 0});
  // A device with its own options keeps them.
  const b = await p2.evaluate(old => { OPTS.hand = 'right'; saveOpts(); const d = migrate({...old, opts: {...old.opts, hand: 'left'}}); return {v: d.v, opts: 'opts' in d, hand: OPTS.hand}; }, old);
  assert.deepEqual(b, {v: 15, opts: false, hand: 'right'});
  assert.deepEqual(e2, []);
  await context.close();
  assert.deepEqual(errors, []);
});
