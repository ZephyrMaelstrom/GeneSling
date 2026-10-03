// Phase 4, the demo: the Rootworks and Act I with Keeper rank capped at 10, its own save that
// carries into the full game, the end-of-demo screen, opt-in play stats and feedback.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame, wait} from './helpers.js';

let srv, browser, page, errors, context;
const idbMain = name => page.evaluate(async n => {
  const db = await new Promise((res, rej) => { const q = indexedDB.open(n); q.onsuccess = () => res(q.result); q.onerror = rej; q.onupgradeneeded = () => q.result.createObjectStore('saves'); });
  const rec = await new Promise(res => { const q = db.transaction('saves').objectStore('saves').get('main'); q.onsuccess = () => res(q.result); q.onerror = () => res(undefined); });
  db.close(); return rec ? JSON.parse(rec.data) : null;
}, name);
before(async () => {
  srv = await startServer(); browser = await launch();
  ({context, page, errors} = await openGame(browser, srv.url, {page: '/dist-dev/demo/index.html'}));
  await page.evaluate(() => window.gameReady);
  await page.evaluate(() => closeModal());
});
after(async () => { await browser.close(); srv.server.close(); });

test('the demo build is flagged, has no Test Lab and saves under its own name', async () => {
  const r = await page.evaluate(async () => { S.coin = 4321; save(); await saveDone(); return {demo: DEMO, lab: TABS.some(t => t[0] === 'lab'), title: document.title}; });
  assert.equal(r.demo, true);
  assert.equal(r.lab, false);
  assert.match(r.title, /Demo/);
  const own = await idbMain('genesling-demo'), full = await idbMain('genesling');
  assert.equal(own && own.coin, 4321);
  assert.equal(full, null, 'the full game’s save is never touched');
});

test('Keeper rank stops at 10 and the portal below the Rootworks stays shut', async () => {
  const r = await page.evaluate(async () => {
    S.keeper.level = 9; S.keeper.xp = 0; addKeeperXp(100000);
    const rank = S.keeper.level, room = S.keeper.xp < keeperNeed();
    S.settings.god = true; S.loadout.slots.forEach(id => { const c = byId(id); if (c) { c.level = 12; c.hp = stats(c).hp; } });
    startRaid('raid', 3); await new Promise(r => setTimeout(r, 120));
    const br = R.map.rooms.find(x => x.kind === 'boss'); R.p.x = br.cx; R.p.y = br.cy + 80; await new Promise(r => setTimeout(r, 300));
    R.boss.hp = 1; hurtEnemy(R.boss, 5, false, 'p'); await new Promise(r => setTimeout(r, 200));
    const portal = R.map.rooms.find(x => x.kind === 'portal');
    R.enemies = []; endRaid('extract'); closeModal(); S.settings.god = false;
    return {rank, room, portal: !!portal, deep: portal && portal.deep, boss: Object.keys(S.progress.bosses).length, trophy: S.trophies.length};
  });
  assert.equal(r.rank, 10);
  assert.equal(r.room, true);
  assert.equal(r.portal, true);
  assert.equal(r.deep, false, 'no way down to Floor 4 in the demo');
  assert.equal(r.boss, 1);
  assert.equal(r.trophy, 1);
});

test('meeting Act I’s goals shows the end of the demo once', async () => {
  const r = await page.evaluate(() => {
    closeModal();
    for (const k in S.sections) S.sections[k].ids = [];
    const before = demoComplete();
    for (const k of ['forge', 'garden', 'spring']) {
      const sp = BASE_SPECIES.find(s => SPECIES[s].type === SECTIONS[k].type);
      for (let i = 0; i < 2; i++) { const c = makeCreature(sp, 'bred', 30); S.creatures.push(c); S.sections[k].ids.push(c.id); }
      S.buildings[k] = 2;   // Act I's goal: three stations built to level 2, with two workers each
    }
    S.pens = 10;
    const goals = demoGoals().map(g => g.v >= g.n), detail = demoGoals();
    const shown = demoProgress(), text = $('#modalBox').innerText, again = demoProgress();
    closeModal();
    return {before, goals, detail, shown, text, again, done: S.demo.done};
  });
  assert.equal(r.before, false);
  assert.deepEqual(r.goals, [true, true, true], JSON.stringify(r.detail));
  assert.equal(r.shown, true);
  assert.match(r.text, /You finished Act I/);
  assert.match(r.text, /carries into the full game/);
  assert.equal(r.again, false);
  assert.equal(r.done, true);
});

test('play stats are opt-in: nothing is recorded until the player says yes', async () => {
  const r = await page.evaluate(() => {
    S.telemetry = {asked: false, on: false}; sent.length = 0;
    const off = track('raid_end', {outcome: 'extract'});
    tutorialDone(); const asked = $('#modalBox').innerText.includes('Help shape GeneSling'); closeModal();
    setStats(true); track('raid_end', {outcome: 'extract'});
    const on = sent.map(e => e.ev), id = S.telemetry.id, ev = sent[0];
    setStats(false); const after = track('raid_end', {});
    return {off, asked, on, id, keys: Object.keys(ev).sort(), after, cleared: sent.length, configured: configured(), fields: toFields({a: 1, b: true, c: 'x'})};
  });
  assert.equal(r.off, null);
  assert.equal(r.asked, true, 'the demo asks once the tutorial is done');
  assert.deepEqual(r.on, ['raid_end', 'opt_in']);
  assert.match(r.id, /^[0-9a-f]{24}$/);
  assert.deepEqual(r.keys, ['day', 'demo', 'ev', 'id', 'outcome', 'playtest', 'rank', 't'], 'no names or creatures in an event');
  assert.equal(r.after, null);
  assert.equal(r.cleared, 0);
  assert.equal(r.configured, false, 'no Firebase project in the repo, so nothing is sent');
  assert.deepEqual(r.fields, {fields: {a: {doubleValue: 1}, b: {booleanValue: true}, c: {stringValue: 'x'}}});
});

test('feedback opens a prefilled GitHub issue when no Firebase project is set', async () => {
  const r = await page.evaluate(async () => {
    let url = null; const open = window.open; window.open = u => { url = u; return null; };
    act('feedback'); const form = !!$('#fb-text'); $('#fb-text').value = 'The cages are great'; $('#fb-rate').value = 'Loved it';
    const how = await sendFeedback($('#fb-rate').value, $('#fb-text').value); const empty = await sendFeedback('', ' ');
    window.open = open; closeModal();
    return {form, how, empty, url: decodeURIComponent(url)};
  });
  assert.equal(r.form, true);
  assert.equal(r.how, 'github');
  assert.equal(r.empty, 'empty');
  assert.match(r.url, /github\.com\/ZephyrMaelstrom\/GeneSling\/issues\/new/);
  assert.match(r.url, /The cages are great/);
  assert.match(r.url, /Demo/);
});

test('the demo save carries into the full game on the same site', async () => {
  const coin = await page.evaluate(async () => { S.coin = 777; save(); await saveDone(); return S.coin; });
  const {page: full, errors: e2} = await openGame(browser, srv.url, {context});
  const r = await full.evaluate(() => ({demo: DEMO, coin: S.coin, done: !!(S.demo && S.demo.done), lab: TABS.some(t => t[0] === 'lab')}));
  assert.deepEqual(r, {demo: false, coin, done: true, lab: true});
  await full.evaluate(async () => { S.coin = 1; save(); await saveDone(); });
  assert.equal((await idbMain('genesling-demo')).coin, 777, 'the demo’s own copy is left alone');
  await wait(50);
  assert.deepEqual(e2, []);
  assert.deepEqual(errors, []);
});
