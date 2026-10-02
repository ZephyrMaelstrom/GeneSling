// Phase 5, the Bloom expands: veins, layouts, events, contracts, vein maps, the Venom type and the
// Apothecary, the v11 save, and the exit test (20 raids in a row with no repeated combination).
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
const run = fn => page.evaluate(fn);
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await run(() => {
    closeModal(); S.coin = 20000; S.pens = 20;
    window.sleep = ms => new Promise(r => setTimeout(r, ms));
    // A raid on a floor with a given layout (or vein), found by trying seeds.
    window.seedFor = (f, vein, test) => { for (let s = 1; s < 20000; s++) { const p = floorPlan(s, f, vein); if (test(p, s)) return s; } return null; };
    window.goTo = async rm => { R.p.x = rm.cx; R.p.y = rm.cy; await sleep(120); };
    window.endQuiet = () => { if (R) { R.enemies = []; endRaid('quit'); closeModal(); } };
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('content: at least 8 types, 24 species, about 45 enemies, 15+ bosses and 32 weapons', async () => {
  const r = await run(() => ({types: TYPE_IDS.length, species: BASE_SPECIES.length, foes: Object.keys(FOES).length, bosses: BOSS_IDS.length, guns: GUN_IDS.length,
    perVein: Object.fromEntries(['rootworks', ...BLOOM.VEIN_ORDER].map(v => [v, BOSS_IDS.filter(b => BOSSES[b].vein === v).length])),
    venom: speciesOf('venom').length, sections: SECTION_IDS.includes('apothecary')}));
  assert.ok(r.types >= 8);
  assert.ok(r.species >= 24);
  assert.ok(r.foes >= 45, `${r.foes} enemies`);
  assert.ok(r.bosses >= 15, `${r.bosses} bosses`);
  assert.ok(r.guns >= 32);
  for (const v of ['ember', 'drowned', 'choir', 'spires', 'sump']) assert.equal(r.perVein[v], 3, `${v} has three bosses`);
  assert.equal(r.venom, 3);
  assert.equal(r.sections, true);
});

test('Phase 5 exit test: 20 raids in a row with no repeated combination, and every floor builds', async () => {
  const r = await run(() => {
    const out = [];
    for (const seed of [1, 2, 3, 4, 5]) out.push(varietyRun(20, seed));
    // Every vein and layout builds a connected floor with a way out.
    const bad = [];
    for (let s = 1; s <= 40; s++) for (const v of BLOOM.VEIN_ORDER) for (let f = 1; f <= 6; f++) {
      const {M, plan} = genFloor(s, f, false, v);
      const seen = new Set([M.start]), q = [M.start];
      while (q.length) { const x = q.shift(); for (const n of x.links) if (!seen.has(n)) { seen.add(n); q.push(n); } }
      const exits = M.rooms.filter(x => ['stairs', 'gate', 'boss', 'rift'].includes(x.kind)).length;
      if (seen.size !== M.rooms.length || !exits) bad.push(`${s}/${v}/${f}/${plan.layout}`);
    }
    return {repeats: out.map(x => x.repeats), n: out[0].sigs.length, bad: bad.slice(0, 5), sample: out[0].sigs.slice(0, 3)};
  });
  console.log('sample combinations:', r.sample.join(' · '));
  assert.equal(r.n, 20);
  assert.deepEqual(r.repeats, [0, 0, 0, 0, 0], 'no repeated vein, layout and event combination');
  assert.deepEqual(r.bad, [], 'every floor is connected and has an exit');
});

test('the same seed replays the same floors in each vein, and layouts never repeat floor to floor', async () => {
  const r = await run(() => {
    const sig = M => JSON.stringify(M.rooms.map(x => [x.gx, x.gy, x.kind, x.plan || null]));
    const same = BLOOM.VEIN_ORDER.every(v => sig(genFloor(77, 5, false, v).M) === sig(genFloor(77, 5, false, v).M));
    const differ = sig(genFloor(77, 5, false, 'drowned').M) !== sig(genFloor(77, 5, false, 'sump').M);
    let repeats = 0;
    for (let s = 1; s < 200; s++) for (const v of BLOOM.VEIN_ORDER) for (let f = 2; f <= 6; f++) if (floorPlan(s, f, v).layout === floorPlan(s, f - 1, v).layout) repeats++;
    const bossOk = BLOOM.VEIN_ORDER.every(v => BOSSES[genFloor(9, 6, false, v).boss].vein === v);
    return {same, differ, repeats, bossOk};
  });
  assert.deepEqual(r, {same: true, differ: true, repeats: 0, bossOk: true});
});

test('the vein choice needs the key type, and a vein map is used up on arrival', async () => {
  const r = await run(async () => {
    S.settings.god = true;
    startRaid('raid', 3); await sleep(150);
    R.comps = [null, null]; R.slot3 = null;
    const blocked = !chooseVein('drowned');
    const tide = makeCreature('dewdrip', 'bred', 20); R.slot3 = {c: tide};
    const m = (S.bloom.maps.push({id: 99, kind: 'peril', vein: 'drowned'}), S.loadout.map = 99, 99);
    const ok = chooseVein('drowned');
    const vein = R.map.plan.vein, floor = R.map.floor, mapUsed = !S.bloom.maps.some(x => x.id === m) && R.vmap && R.vmap.kind === 'peril', hp = R.fmods.hp;
    endQuiet(); S.settings.god = false;
    return {blocked, ok, vein, floor, mapUsed, hp};
  });
  assert.equal(r.blocked, true, 'no Tide, no Drowned Galleries');
  assert.equal(r.ok, true);
  assert.equal(r.vein, 'drowned');
  assert.equal(r.floor, 4);
  assert.equal(r.mapUsed, true);
  assert.equal(r.hp, 1.3, 'a peril map toughens the floor');
});

test('vein twists: vents, rising water, the dark, wind and poison pools', async () => {
  const r = await run(async () => {
    const out = {};
    const fightRoom = () => R.map.rooms.find(x => x.kind === 'fight' && x.plan) || R.map.rooms[1];
    // Vents erupt and burn.
    startRaid('raid', 4, null, 'ember'); await sleep(100);
    let rm = fightRoom(); await goTo(rm); R.enemies.forEach(e => { e.hp = 1e6; e.dmg = 0; e.fire = {kind: 'none', every: 99}; });
    const v = rm.vents[0]; R.p.x = v.x; R.p.y = v.y; R.p.hp = 100; R.beat = BLOOM.TWISTS.vents.every - 0.01; await sleep(300);
    out.vent = R.p.hp < 100; endQuiet();
    // Water rises; deep water drowns you without a Tide.
    startRaid('raid', 4, null, 'drowned'); await sleep(100);
    R.comps = [null, null]; R.slot3 = null;
    rm = fightRoom(); await goTo(rm); R.enemies.forEach(e => { e.dmg = 0; e.fire = {kind: 'none', every: 99}; e.melee = false; });
    const w0 = rm.water || 0; await sleep(400); out.rises = rm.water > w0;
    rm.water = 1; R.p.hp = 100; out.slow = moveMul() < 1; await sleep(400); out.drown = R.p.hp < 100;
    R.slot3 = {c: makeCreature('dewdrip', 'bred', 20)}; refreshSupport(); R.p.hp = R.p.maxHp; const hp1 = R.p.hp; await sleep(300); out.swim = R.p.hp >= hp1 && moveMul() === 1;
    endQuiet();
    // The dark: enemies sleep until they hear you.
    startRaid('raid', 4, null, 'choir'); await sleep(100);
    rm = fightRoom(); await goTo(rm);
    out.dormant = R.enemies.filter(e => e.room === rm).every(e => e.dormant);
    makeNoise(rm.cx, rm.cy); out.woken = R.enemies.filter(e => e.room === rm).every(e => !e.dormant);
    endQuiet();
    // Wind pushes you with no input.
    startRaid('raid', 4, null, 'spires'); await sleep(100);
    R.comps = [null, null]; R.slot3 = null;
    rm = R.map.rooms.find(x => x.wind && x.kind === 'fight'); await goTo(rm); R.enemies = [];
    const x0 = R.p.x, y0 = R.p.y; await sleep(400);
    out.wind = Math.hypot(R.p.x - x0, R.p.y - y0) > 5;
    out.cliff = R.map.rooms.some(x => x.kind === 'cliff');
    endQuiet();
    // Poison pools hurt, and Sump catches mutate.
    startRaid('raid', 4, null, 'sump'); await sleep(100);
    rm = fightRoom(); await goTo(rm); R.enemies.forEach(e => { e.dmg = 0; e.fire = {kind: 'none', every: 99}; e.melee = false; });
    // No companions (their healing can outpace a short sip of poison) and no invulnerability frames.
    R.comps = [null, null]; R.slot3 = null; refreshSupport(); const pool = rm.pools[0]; R.p.x = pool.x; R.p.y = pool.y; R.p.inv = 0; R.p.hp = 100; await sleep(500); out.pool = R.p.hp < 100;
    const c = makeCreature('toxlet', 'wild', 10), g0 = JSON.stringify(c.genome); caughtExtras(c); out.mutated = JSON.stringify(c.genome) !== g0;
    endQuiet();
    return out;
  });
  assert.deepEqual(r, {vent: true, rises: true, slow: true, drown: true, swim: true, dormant: true, woken: true, wind: true, cliff: true, pool: true, mutated: true});
});

test('layouts: gauntlet seals, sinkholes collapse, nests, caravans and mirrors', async () => {
  const r = await run(async () => {
    const out = {}; S.settings.god = true;
    const go = async lay => { const s = seedFor(2, 'rootworks', p => p.layout === lay); startRaid('raid', 2, s); await sleep(120); return R.map.plan.layout; };
    // Gauntlet: one chain, and the rooms behind lock.
    out.gauntlet = await go('gauntlet');
    const chain = R.map.rooms.filter(x => x.kind !== 'secret').sort((a, b) => a.chain - b.chain);
    for (const rm of chain.slice(0, 3)) { await goTo(rm); R.enemies = []; await sleep(80); }
    out.sealed = chain[0].sealed && chain[0].locked;
    endQuiet();
    // Sinkhole: a room you left falls in after a while.
    out.sinkhole = await go('sinkhole');
    const a = R.map.rooms.find(x => x.kind === 'fight'); await goTo(a); R.enemies = []; await sleep(60);
    await goTo(R.map.start); a.left = BLOOM.LAYOUT_RULES.sinkhole.after + 1; await sleep(80);
    out.collapsed = a.sealed === true;
    endQuiet();
    // Nest: one room full of one species, and extra cages.
    out.nest = await go('nest');
    const n = R.map.rooms.find(x => x.nest); out.colony = n.plan.wilds.length >= 6 && n.plan.wilds.every(s => s === n.nest); out.cages = R.cages.basic + R.cages.gilded;
    endQuiet();
    // Caravan: the trader pays out when you extract with it.
    out.caravan = await go('caravan');
    const pay = R.caravan.pay, coin = S.coin; R.caravan.x = R.p.x; R.caravan.y = R.p.y; R.enemies = []; endRaid('extract'); closeModal();
    out.paid = S.coin - coin >= pay;
    // Mirror: shadows of your own companions that can't be caged.
    out.mirror = await go('mirror');
    R.comps = [makeComp(makeCreature('pyrrox', 'bred', 10)), makeComp(makeCreature('puffcap', 'bred', 10))];
    const mr = R.map.rooms.find(x => x.mirror) || (R.map.rooms.find(x => x.kind === 'fight').mirror = true, R.map.rooms.find(x => x.mirror));
    await goTo(mr);
    const sh = R.enemies.filter(e => e.shadow);
    sh.forEach(e => { e.hp = 1; e.x = R.p.x + 5; e.y = R.p.y; }); R.slot3 = null;
    out.shadows = sh.length; out.uncatchable = !cageReady();
    endQuiet(); S.settings.god = false;
    return out;
  });
  assert.equal(r.gauntlet, 'gauntlet'); assert.equal(r.sealed, true);
  assert.equal(r.sinkhole, 'sinkhole'); assert.equal(r.collapsed, true);
  assert.equal(r.nest, 'nest'); assert.equal(r.colony, true); assert.ok(r.cages >= 3);
  assert.equal(r.caravan, 'caravan'); assert.equal(r.paid, true);
  assert.equal(r.mirror, 'mirror'); assert.ok(r.shadows >= 1); assert.equal(r.uncatchable, true);
});

test('events: surge, the Lost Keeper, rival raiders, an estate cache and a migration', async () => {
  const r = await run(async () => {
    const out = {}; S.settings.god = true;
    const go = async id => { let s = 1; while (true) { const e = raidEvent(s); if (e && e.id === id && e.floor <= 3) break; s++; } const f = raidEvent(s).floor; startRaid('raid', f, s); await sleep(120); };
    await go('surge'); out.surge = [R.fmods.dmg, R.fmods.coin]; endQuiet();
    await go('lostkeeper');
    let rm = R.map.rooms.find(x => x.plan && x.plan.keeper); await goTo(rm);
    const k = R.enemies.find(e => e.keeper), shards = S.shards, items = R.items.length; k.hp = 1; hurtEnemy(k, 5, false, 'p'); await sleep(100);
    out.keeper = S.shards - shards === 2 && R.items.length > items; endQuiet();
    await go('rivals');
    rm = R.map.rooms.find(x => x.plan && x.plan.rivals); await goTo(rm);
    const rv = R.enemies.find(e => e.rival); R.bag.coin = 100; rv.x = R.p.x; rv.y = R.p.y; await sleep(100);
    const after = R.bag.coin; rv.hp = 1; hurtEnemy(rv, 5, false, 'p'); await sleep(100);
    out.rivals = after < 100 && R.bag.coin > after; endQuiet();
    await go('cache');
    rm = R.map.rooms.find(x => x.cache); await goTo(rm); R.enemies = []; await sleep(80);
    R.p.x = rm.chest.x; R.p.y = rm.chest.y; await sleep(150);
    out.cache = rm.chest.open && R.items.filter(i => i.id === 'print').length >= 2; endQuiet();
    await go('migration');
    rm = R.map.rooms.find(x => x.herd); out.herd = rm.plan.wilds.filter(s => s === rm.herd).length >= 4; endQuiet();
    S.settings.god = false;
    return out;
  });
  assert.deepEqual(r.surge, [1.3, 2]);
  assert.equal(r.keeper, true);
  assert.equal(r.rivals, true, 'rivals rob you, and you rob them back');
  assert.equal(r.cache, true);
  assert.equal(r.herd, true);
});

test('contracts pay on a successful extraction and lapse on a death', async () => {
  const r = await run(async () => {
    S.settings.god = true;
    const offers = contractOffers(), again = contractOffers();
    S.bloom.contracts.offers[0] = {kind: 'hunt', n: 1, reward: {coin: 200, kxp: 70, ingot: 2}, text: 'Defeat 1 enemies in one raid and extract.'};
    takeContract(0);
    startRaid('raid', 1); await sleep(100); R.kills = 3;
    const coin = S.coin, ingot = amt('ingot'); R.enemies = []; endRaid('extract'); const text = $('#modalBox').innerText; closeModal();
    const paid = S.coin - coin, ingots = amt('ingot') - ingot;
    takeContract(1); startRaid('raid', 1); await sleep(100); R.enemies = []; endRaid('dead'); closeModal();
    S.settings.god = false;
    return {n: offers.length, stable: JSON.stringify(offers) === JSON.stringify(again), paid, ingots, text: text.includes('Contract complete'), lapsed: S.bloom.contracts.active === null};
  });
  assert.equal(r.n, 3); assert.equal(r.stable, true);
  assert.ok(r.paid >= 200, `paid ${r.paid}`); assert.equal(r.ingots, 2);
  assert.equal(r.text, true); assert.equal(r.lapsed, true);
});

test('vein maps are drawn at the Roost', async () => {
  const r = await run(() => {
    const roost = S.sections.roost.ids.slice(); S.sections.roost.ids = [];
    const no = craftMap('lure', 'sump');
    const e = makeCreature('vesperbat', 'bred', 30); S.creatures.push(e); S.sections.roost.ids.push(e.id);
    give('cloth', 3); give('herbs', 3);
    const m = craftMap('lure', 'sump');
    S.sections.roost.ids = roost;
    return {no, m: m && m.kind + '/' + m.vein, tier: secTier('roost') >= 1};
  });
  assert.equal(r.no, null);
  assert.equal(r.m, 'lure/sump');
});

test('Venom: poison, its reactions, Sump-only wilds, the Apothecary and gene serums', async () => {
  const r = await run(async () => {
    const out = {};
    S.settings.god = true; startRaid('raid', 1); await sleep(100);
    const e = spawnFoe(spawnPos(R.cur), 'husk', 1, R.cur); e.hp = e.maxHp = 1000;
    hurtEnemy(e, 10, true, 'p', 'poison'); const h0 = e.hp; await sleep(500); out.dot = e.hp < h0;
    e.status = {}; e.poison = null; hurtEnemy(e, 10, true, 'p', 'poison'); const h1 = e.hp; hurtEnemy(e, 10, true, 'p', 'burn'); out.flare = h1 - e.hp > 30;
    endQuiet(); S.settings.god = false;
    let root = 0, sump = 0;
    for (let i = 0; i < 400; i++) { if (SPECIES[rollWildIn(2, 'rootworks')].type === 'venom') root++; if (SPECIES[rollWildIn(5, 'sump')].type === 'venom') sump++; }
    out.root = root; out.sump = sump;
    // The Apothecary brews serums from bog sap and herbs.
    const tox = makeCreature('fangmire', 'bred', 20); S.creatures.push(tox); S.sections.apothecary.ids = [tox.id];
    give('sap', 10); give('herbs', 10); const before = amt('serum');
    for (let i = 0; i < 4; i++) processDay();
    out.brewed = amt('serum') > before;
    const c = makeCreature('pebblet', 'bred', 5, {genome: genomeFrom({vig: 3, pow: 6, swf: 6, tem: 6, foc: 6, grt: 6, kn: 6, yld: 6}, [])}); S.creatures.push(c);
    give('serum', 1); const k = useSerum(c); out.serum = k === 'vig' && Math.max(...c.genome.vig) === 4;
    return out;
  });
  assert.equal(r.dot, true, 'poison ticks');
  assert.equal(r.flare, true, 'poison + burn makes a Toxic Flare');
  assert.equal(r.root, 0, 'no Venom wilds in the Rootworks');
  assert.ok(r.sump > 40, `Venom is common in the Sump (${r.sump}/400)`);
  assert.equal(r.brewed, true);
  assert.equal(r.serum, true, 'a serum raises the lowest gene');
});

test('a v10 save loads into the current version with the Apothecary on the map', async () => {
  const ctx = await browser.createBrowserContext();
  const {page: p2, errors: e2} = await openGame(browser, srv.url, {context: ctx});
  await p2.evaluate(async () => {
    const d = JSON.parse(JSON.stringify(S));
    delete d.bloom; delete d.sections.apothecary; d.layout = d.layout.filter(i => i.key !== 'apothecary'); delete d.loadout.map; d.v = 10;
    const db = await new Promise((res, rej) => { const q = indexedDB.open('genesling'); q.onsuccess = () => res(q.result); q.onerror = rej; });
    await new Promise(res => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put({v: 10, saved: Date.now(), data: JSON.stringify(d)}, 'main'); tx.oncomplete = res; });
    db.close();
  });
  await p2.reload(); await p2.evaluate(() => window.gameReady);
  const s = await p2.evaluate(() => ({v: S.v, sec: !!S.sections.apothecary, placed: S.layout.some(i => i.key === 'apothecary'), bloom: !!S.bloom && Array.isArray(S.bloom.maps), map: S.loadout.map}));
  assert.deepEqual(s, {v: 13, sec: true, placed: true, bloom: true, map: null});
  assert.deepEqual(e2, []);
  await ctx.close();
});

test('the new screens render without errors', async () => {
  await run(async () => {
    for (const t of ['raid', 'armory', 'hideout']) { ui.tab = t; renderAll(); }
    ui.section = 'apothecary'; renderAll();
    ui.tab = 'codex'; ui.codex = 'veins'; renderAll();
    ui.tab = 'lab'; renderAll(); act('lab-variety');
    startRaid('raid', 3); await sleep(100); openVeinChoice(); setPause(false); endQuiet();
  });
  assert.deepEqual(errors, []);
});
