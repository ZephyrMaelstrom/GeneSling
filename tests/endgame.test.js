// Phase 6, Underheart and endgame: the Underheart's cut-free rule, freeing Ilsa, the Heart and its three
// endings, Unbound tiers and their rules, Bloomlords, the Splicer, Mutation Lab and Apex Chamber, the
// Archive, Renown, shows, the Deepening, seasons, the v12 save and the exit test.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
const run = fn => page.evaluate(fn);
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await run(() => {
    closeModal(); S.settings.god = true; labEndgame();
    window.sleep = ms => new Promise(r => setTimeout(r, ms));
    window.killBoss = async () => { const br = R.map.rooms.find(x => x.kind === 'boss'); R.p.x = br.cx; R.p.y = br.cy + 80; await sleep(250); R.boss.hp = 1; hurtEnemy(R.boss, 5, false, 'p'); await sleep(250); return br; };
    window.endQuiet = how => { if (R) { R.enemies = []; endRaid(how || 'quit'); closeModal(); } };
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('content at the 1.0 counts', async () => {
  const r = await run(() => ({types: TYPE_IDS.length, species: BASE_SPECIES.length, hybrids: HYBRIDS.length, bosses: BOSS_IDS.filter(b => BOSSES[b].vein !== 'bloomlord').length,
    lords: BOSS_IDS.filter(b => BOSSES[b].vein === 'bloomlord').length, foes: Object.keys(FOES).length, guns: GUN_IDS.length, forms: Object.values(LINES).reduce((a, l) => a + l.length, 0)}));
  assert.equal(r.types, 9); assert.equal(r.species, 27); assert.equal(r.hybrids, 18);
  assert.ok(r.bosses >= 20, `${r.bosses} bosses`); assert.equal(r.lords, 4);
  assert.ok(r.foes >= 58, `${r.foes} enemies`); assert.equal(r.guns, 40);
  assert.ok(r.forms >= 120, `${r.forms} evolution forms`);
});

test('the Underheart takes only cut-free creatures, and Floor 9 frees Ilsa', async () => {
  const r = await run(async () => {
    startRaid('raid', 6, null, 'ember'); await sleep(120);
    const br = await killBoss(); const deep = br.deep;
    const keep = R.comps; R.comps = [makeComp(makeCreature('pebblet', 'bred', 10)), null];
    enterUnderheart(); const blocked = R.map.floor === 6;
    R.comps = keep; enterUnderheart(); const vein = R.map.plan.vein, floor = R.map.floor;
    descend(9); await sleep(100); const boss = R.map.rooms.find(x => x.kind === 'boss').bossId;
    const b9 = await killBoss();
    const out = {deep, blocked, vein, floor, boss, ilsa: story().ilsa, toHeart: b9.deep};
    endQuiet('extract');
    out.relics = S.archive.unread;
    return out;
  });
  assert.deepEqual({...r, relics: r.relics >= 2}, {deep: true, blocked: true, vein: 'underheart', floor: 7, boss: 'ilsa', ilsa: true, toHeart: true, relics: true});
});

test('Phase 6 exit test: the Heart is playable, every ending can be picked, and Unbound tiers 1 to 5 clear', async () => {
  const r = await run(async () => {
    const endings = [];
    for (const k of ['wake', 'sever', 'sing']) {
      startRaid('raid', 9, null, 'ember'); await sleep(100); await killBoss();
      descend(10); await sleep(100);
      const shape = R.map.rooms.map(x => x.kind).join(',');
      await killBoss(); await sleep(1400);
      const asked = !$('#pause').hidden && $('#pauseBox').innerText.includes('The Heart');
      pickEnding(k); endings.push({k, shape, asked, chosen: story().ending, title: S.keeperTitles.includes(ENDGAME.ENDINGS[k].title)});
      endQuiet('extract');
    }
    const tiers = [];
    for (let t = 1; t <= 5; t++) {
      startRaid('raid', 7, null, 'unbound', {tier: t}); await sleep(100);
      const rules = rulesFor(t).length, f0 = R.map.floor;
      descend(8); await sleep(60); descend(9); await sleep(60);
      await killBoss(); endQuiet('extract');
      tiers.push({t, f0, rules, cleared: S.unbound.cleared});
    }
    return {endings, tiers, all: Object.keys(story().endings).sort(), shards: amt('apexshard')};
  });
  for (const e of r.endings) assert.deepEqual(e, {k: e.k, shape: 'start,boss,secret', asked: true, chosen: e.k, title: true});
  assert.deepEqual(r.all, ['sever', 'sing', 'wake']);
  assert.deepEqual(r.tiers.map(t => t.cleared), [1, 2, 3, 4, 5]);
  assert.deepEqual(r.tiers.map(t => t.rules), [1, 2, 3, 4, 5]);
  assert.ok(r.tiers.every(t => t.f0 === 7));
  assert.ok(r.shards > 5, 'tier bosses drop apex shards');
});

test('Unbound rules 1 to 5 bite: health, bullet speed, cages, ricochets and healing', async () => {
  const r = await run(async () => {
    const out = {};
    startRaid('raid', 7, null, 'unbound', {tier: 5}); await sleep(100);
    out.hp = R.fmods.hp >= 1.15;
    const b = shoot('e', R.p.x, R.p.y, 0, 100, 1); out.fast = Math.abs(Math.hypot(b.vx, b.vy) - 120) < 1e-6;
    let fails = 0; S.settings.god = true;
    for (let i = 0; i < 200; i++) { const c = makeCreature('pebblet', 'wild', 5); const e = wildEnemy({x: R.p.x, y: R.p.y}, c, R.cur); e.hp = 0.0001 * e.maxHp; if (!tryCapture(e, 'gilded')) fails++; R.slot3 = null; R.enemies = R.enemies.filter(x => x !== e); }
    out.cages = fails > 20 && fails < 90;
    // Ricochet: an enemy bullet into a wall splits.
    R.bullets = []; const wall = (() => { const r0 = R.cur; return {x: r0.ox * TS - 4, y: r0.cy - TS * 3}; })();   // off the door line, so the wall is solid
    shoot('e', wall.x + 30, wall.y, Math.PI, 300, 5, {life: 2}); for (let i = 0; i < 20 && R.bullets.length < 2; i++) updBullets(1 / 30);
    out.rico = R.bullets.length >= 2;
    R.p.hp = 50; healPlayer(10); out.thin = Math.abs(R.p.hp - 57) < 1e-6;
    endQuiet();
    return out;
  });
  assert.deepEqual(r, {hp: true, fast: true, cages: true, rico: true, thin: true});
});

test('Bloomlords: deaf to guns, brood shields, reflected elements and shadow copies', async () => {
  const r = await run(async () => {
    const out = {}; labEndgame();
    startRaid('arena'); await sleep(100); const room = R.map.start;
    const spawn = id => { R.enemies = []; spawnBoss(room, id); return R.boss; };
    let b = spawn('lord_hush'); let h = b.hp; hurtEnemy(b, 100, true, 'p'); out.deaf = Math.round(h - b.hp);
    h = b.hp; hurtEnemy(b, 100, true, 'melee'); out.melee = Math.round(h - b.hp);
    b = spawn('lord_thousand'); b.brood.push(spawnFoe(spawnPos(room), 'bloomspawn', 7, room)); h = b.hp; hurtEnemy(b, 100, true, 'p'); out.brood = h - b.hp;
    b.brood.forEach(x => { x.hp = 0; }); hurtEnemy(b, 100, true, 'p'); out.broodDown = h - b.hp;
    b = spawn('lord_mirrorking'); const m = R.comps.find(Boolean); const mh = m.hp; hurtEnemy(b, 100, true, m, 'burn'); out.reflect = mh - m.hp;
    spawn('lord_shade'); out.shadows = R.enemies.filter(e => e.shadow).length;
    endRaid('arena'); closeModal();
    return out;
  });
  assert.equal(r.deaf, 30); assert.equal(r.melee, 100);
  assert.equal(r.brood, 0); assert.equal(r.broodDown, 100);
  assert.equal(r.reflect, 50);
  assert.ok(r.shadows >= 1);
});

test('the Splicer, the Mutation Lab and the Apex Chamber', async () => {
  const r = await run(() => {
    const out = {};
    const d = makeCreature('pebblet', 'bred', 10, {genome: genomeFrom({pow: 10}, [])}), rc = makeCreature('pebblet', 'bred', 10, {genome: genomeFrom({pow: 3}, [])});
    S.creatures.push(d, rc); give('serum', 2); S.coin += 1000;
    const res = splice(d.id, rc.id, 'pow'); out.splice = res && rc.genome.pow.includes(10) && !S.creatures.includes(d);
    const cr = [1, 2, 3].map(() => { const c = makeCreature('shardling', 'bred', 10); S.creatures.push(c); return c; });
    const before = mutBonus(); setMutlab(cr.map(c => c.id)); out.mutlab = Math.round((mutBonus() - before) * 1000) / 1000; out.posted = whereIs(cr[0]).kind;
    // Apex Chamber: two Apex carriers, a guaranteed pass on Vigor.
    const mom = makeCreature('pebblet', 'bred', 10, {sex: 'F', proven: true}), dad = makeCreature('pebblet', 'bred', 10, {sex: 'M', proven: true});
    mom.genome.vig = [11, 2]; dad.genome.vig = [3, 11]; mom.genome.pow = [11, 4]; dad.genome.pow = [11, 4]; express(mom); express(dad); S.creatures.push(mom, dad);
    if (!secTier('nursery')) { const w = makeCreature('bastion', 'bred', 30); S.creatures.push(w); S.sections.nursery.ids.push(w.id); }
    S.pens = 30; S.eggs = []; ui.mom = String(mom.id); ui.dad = String(dad.id); ui.apexLocus = 'vig'; const shards = amt('apexshard');
    story().heart = true; S.coin += 100; S.food += 10; const laid = breed(); ui.apexLocus = '';
    out.chamber = laid && JSON.stringify(laid[0].genome.vig) === '[11,11]' && amt('apexshard') === shards - 1;
    return out;
  });
  assert.equal(r.splice, true);
  assert.equal(r.mutlab, 0.02, 'two Crystal creatures, capped at +2%');
  assert.equal(r.posted, 'mutlab');
  assert.equal(r.chamber, true);
});

test('the genetics simulator: the Apex Chamber keeps the chase at 10 generations or more', async () => {
  const r = await run(() => { const a = simulate({runs: 150}, 11), c = simulate({runs: 150, apexChamber: true}, 11); return {base: a.median, chamber: c.median, used: c.results.reduce((x, y) => x + y.chambered, 0)}; });
  console.log(`median generations to Apex: ${r.base} without the chamber, ${r.chamber} with it (${r.used} chamber eggs)`);
  assert.ok(r.used > 0, 'the chamber was used');
  assert.ok(r.chamber >= 10, `median ${r.chamber}`);
});

test('the Archive translates a relic a day with a Lumen archivist', async () => {
  const r = await run(() => {
    labEndgame(); const every = LORE.ARCHIVE.odileEvery; LORE.ARCHIVE.odileEvery = 1e9; S.archive.read = 0; S.archive.unread = 3; S.archive.archivist = null; const known0 = knownLetters().size;
    processDay(); const without = S.archive.read;
    S.archive.archivist = S.creatures.find(c => c.type === 'lumen').id;
    processDay(); processDay();
    LORE.ARCHIVE.odileEvery = every;
    return {without, read: S.archive.read, letters: knownLetters().size > known0, wall: runeWall('KEEP IT ASLEEP')};
  });
  assert.equal(r.without, 0); assert.equal(r.read, 2); assert.equal(r.letters, true);
  assert.equal(r.wall, 'KEEP IT ASLEEP', 'the first relics read KEEP IT ASLEEP');
});

test('weekly shows award ribbons, and Renown counts them', async () => {
  const r = await run(() => {
    const w = weekOf(S.day), classes = showClasses(w), r0 = renown().genetics;
    // A perfect entrant for every class.
    classes.forEach((o, i) => { const sp = speciesOf(o.type)[0]; const c = makeCreature(sp, 'bred', 20, {genome: genomeFrom(Object.fromEntries(['pow', 'vig', 'swf', 'tem', 'foc', 'grt'].map(k => [k, 10])), [])}); c.genome.shine = [1, 1]; c.genome.pat = [3, 3]; express(c); c.gen = 1; S.creatures.push(c); enterShow(i, c.id); });
    while (weekOf(S.day) === w) processDay();
    const won = S.shows.results.filter(x => x.week === w);
    return {classes: classes.length, judged: won.length, firsts: won.filter(x => x.place === 1).length, renown: renown().genetics > r0};
  });
  assert.equal(r.classes, 3); assert.equal(r.judged, 3);
  assert.ok(r.firsts >= 1, `${r.firsts} first places`);
  assert.equal(r.renown, true);
});

test('the weekly Deepening is the same raid for everyone and goes on a ladder', async () => {
  const r = await run(async () => {
    const w = weekOf(S.day), sig = () => JSON.stringify(R.map.rooms.map(x => [x.gx, x.gy, x.kind]));
    startRaid('raid', 1, null, null, {deepening: w}); await sleep(80); const a = sig(), seed = R.seed; R.kills = 20; endQuiet('extract');
    startRaid('raid', 1, null, null, {deepening: w}); await sleep(80); const b = sig(); endQuiet();
    return {same: a === b, seed: seed === deepeningSeed(w), best: S.deepening.best > 0, rank: S.deepening.rank >= 1 && S.deepening.rank <= 100, ladder: ladder(w).length};
  });
  assert.deepEqual(r, {same: true, seed: true, best: true, rank: true, ladder: 99});
});

test('a season ends with a title and banner, and the next season changes its twist', async () => {
  const r = await run(() => {
    S.renownLog.deepening = 5000; const n = S.season.n, banners = S.decor.banner || 0, tw = seasonTwist(n).name;
    while (seasonOf(S.day) === n) processDay();
    return {n2: S.season.n, title: S.keeperTitles.some(t => t.includes(`Season ${n}`)), banner: (S.decor.banner || 0) > banners, twist: seasonTwist(S.season.n).name !== tw};
  });
  assert.deepEqual(r, {n2: 2, title: true, banner: true, twist: true});
});

test('a v11 save loads into v12', async () => {
  const ctx = await browser.createBrowserContext();
  const {page: p2, errors: e2} = await openGame(browser, srv.url, {context: ctx});
  await p2.evaluate(async () => {
    const d = JSON.parse(JSON.stringify(S));
    for (const k of ['story', 'unbound', 'archive', 'mutlab', 'shows', 'deepening', 'season', 'keeperTitles', 'renownLog']) delete d[k];
    d.creatures.forEach(c => delete c.ribbons); d.v = 11;
    const db = await new Promise((res, rej) => { const q = indexedDB.open('genesling'); q.onsuccess = () => res(q.result); q.onerror = rej; });
    await new Promise(res => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put({v: 11, saved: Date.now(), data: JSON.stringify(d)}, 'main'); tx.oncomplete = res; });
    db.close();
  });
  await p2.reload(); await p2.evaluate(() => window.gameReady);
  const s = await p2.evaluate(() => ({v: S.v, story: S.story, unbound: S.unbound.cleared, ribbons: S.creatures.every(c => Array.isArray(c.ribbons)), season: S.season.n}));
  assert.deepEqual(s, {v: 13, story: {ilsa: false, heart: false, ending: null, endings: {}}, unbound: 0, ribbons: true, season: 1});
  assert.deepEqual(e2, []);
  await ctx.close();
});

test('the endgame screens render without errors', async () => {
  await run(() => { for (const t of ['raid', 'breeding', 'research', 'lab', 'roster', 'codex']) { ui.tab = t; renderAll(); } });
  assert.deepEqual(errors, []);
});
