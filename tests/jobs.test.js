// Phase 2, jobs and production: stations, fatigue, foremen, chemistry, upkeep, the roster cap,
// crafting and quality, durability, the raid bag and roles, tonics, expeditions, the death
// legacy, and the exit test's supply check.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame, wait} from './helpers.js';

let srv, browser, page, errors;
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await page.evaluate(() => {
    closeModal();
    // A creature of a given species, posted nowhere, with exact genes.
    window.mkc = (sp, o = {}) => { const c = makeCreature(sp, 'bred', o.level || 10, {proven: true, genome: genomeFrom(o.genes || {}, o.traits || []), pers: o.pers || 'calm', sex: o.sex}); c.genome.pat = [0, 0]; express(c); S.creatures.push(c); return c; };
    window.post = (k, ...cs) => cs.forEach(c => { unplace(c); S.sections[k].ids.push(c.id); });
    window.clearStation = k => { S.sections[k].ids = []; S.sections[k].cap = 6; };
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('station output comes from Yield, type match and level, and the day delivers it', async () => {
  const r = await page.evaluate(() => {
    clearStation('forge'); S.mats = {}; S.ore = 40; S.prod = {};
    const a = mkc('pyrrox', {genes: {yld: 9}}), b = mkc('pyrrox', {genes: {yld: 3}}), off = mkc('puffcap', {genes: {yld: 9}});
    const ua = workUnit(a, 'forge'), ub = workUnit(b, 'forge'), uoff = workUnit(off, 'forge');
    post('forge', a, b);
    const rep = stationReport('forge'), before = amt('ingot'), ore = S.ore;
    processDay();
    return {ua, ub, ratioOff: uoff / ua, batches: rep.batches, made: amt('ingot') - before, oreUsed: ore - S.ore, sum: rep.per(a) + rep.per(b)};
  });
  assert.ok(r.ua > r.ub, 'higher Yield works faster');
  assert.equal(Math.round(r.ratioOff * 100) / 100, 0.5, 'an off-type worker makes half');
  assert.equal(r.made, Math.floor(r.batches + 1e-9), 'the day makes the whole batches the report promised');
  assert.equal(r.oreUsed, 2 * r.made, '2 ore per ingot');
  assert.ok(Math.abs(r.sum - r.batches) < 1e-9, 'per-creature numbers add up to the station total');
});

test('fatigue builds while working, rests off, and costs up to 40% output', async () => {
  const r = await page.evaluate(() => {
    clearStation('vault');
    const c = mkc('shardling'), idle = mkc('geodon'); idle.fat = 50; post('vault', c);
    const fresh = workUnit(c, 'vault'); tickFatigue(); const after1 = c.fat, idleAfter = idle.fat;
    c.fat = 100; const spent = workUnit(c, 'vault');
    const t = mkc('shardling', {traits: ['tireless']}); post('vault', t); t.fat = 0; tickFatigue();
    return {after1, ratio: spent / fresh, idle: idleAfter, tireless: t.fat};
  });
  assert.equal(r.after1, 12);
  assert.equal(Math.round(r.ratio * 100) / 100, 0.6);
  assert.equal(r.idle, 20, 'a day off restores 30');
  assert.equal(r.tireless, 6, 'Tireless tires half as fast');
});

test('the foreman (highest Focus) shares its work traits with the whole crew', async () => {
  const r = await page.evaluate(() => {
    clearStation('forge');
    const boss = mkc('magmaul', {genes: {foc: 10}, traits: ['worker']}), crew = mkc('pyrrox', {genes: {foc: 4}});
    const alone = workUnit(crew, 'forge');
    post('forge', boss, crew);
    return {foreman: foremanOf('forge') === boss, ratio: workUnit(crew, 'forge') / alone};
  });
  assert.equal(r.foreman, true);
  assert.equal(Math.round(r.ratio * 100) / 100, 1.5, 'Hard Worker applies to the crew');
});

test('crew chemistry and personality clashes change station output', async () => {
  const r = await page.evaluate(() => {
    clearStation('garden');
    const f = mkc('puffcap', {pers: 'brave'}); post('garden', f); const solo = crewMods('garden').mul;
    const t = mkc('dewdrip', {pers: 'calm'}); post('garden', t); const irrigated = crewMods('garden');
    const timid = mkc('shroomite', {pers: 'timid'}); post('garden', timid); const clash = crewMods('garden');
    return {solo, irr: irrigated.mul, chem: irrigated.chem.map(x => x.name), clash: clash.mul, clashes: clash.clashes.length};
  });
  assert.equal(r.solo, 1);
  assert.deepEqual(r.chem, ['Irrigation']);
  assert.equal(r.irr, 1.25);
  assert.equal(r.clashes, 1);
  assert.equal(Math.round(r.clash * 1000) / 1000, 1.125, 'brave and timid cost 10%');
});

test('upkeep: everyone eats, Thrifty workers don’t, and the roster cap blocks raids and eggs', async () => {
  const r = await page.evaluate(() => {
    clearStation('vault');
    const before = mouths(); const th = mkc('prismoth', {traits: ['thrifty']}); const withIdle = mouths();
    post('vault', th); const posted = mouths();
    while (rosterCount() <= rosterCap()) mkc('pebblet');
    const over = overCap(); ui.mom = ''; act('deploy', {}); const raided = !!R;
    const F = mkc('dewdrip', {sex: 'F'}), M = mkc('dewdrip', {sex: 'M'});
    const block = breedBlock(F, M);
    S.pens += 10; const fixed = overCap();
    return {before, withIdle, posted, over, raided, block, fixed};
  });
  assert.equal(r.withIdle, r.before + 1);
  assert.equal(r.posted, r.before, 'a Thrifty worker eats nothing');
  assert.equal(r.over, true);
  assert.equal(r.raided, false, 'no raid while over capacity');
  assert.match(r.block, /pens are full/);
  assert.equal(r.fixed, false);
});

test('crafting: components, quality from Knack and mastery, maker’s marks and prints', async () => {
  const r = await page.evaluate(() => {
    S.keeperName = 'Conner'; S.mats = {ingot: 40, glass: 20, cloth: 20}; S.coin = 9999; S.mastery = {};
    clearStation('forge'); clearStation('vault');
    const odds0 = qualityOdds('gun:revolver', 'forge');
    const smith = mkc('pyrrox', {genes: {kn: 10, foc: 10}}); post('forge', smith);
    const odds1 = qualityOdds('gun:revolver', 'forge');
    const parts = craft('parts'), partsLeft = amt('parts');
    const gun = craftWeapon('revolver');
    const mastery = S.mastery['gun:revolver'];
    craft('core'); const cagesBefore = S.cages.basic; craft('cages');
    S.prints = ['scatter']; S.blueprints.scatter = 0; S.mats.parts = 5;
    const fromPrint = craftWeapon('scatter', 0);
    return {sum: odds0.reduce((a, b) => a + b, 0), worst0: odds0[0], worst1: odds1[0], best1: odds1[3] + odds1[4], parts, partsLeft,
      gunQ: gun.q, maker: makerText(gun), mastery, cages: S.cages.basic - cagesBefore, printSrc: fromPrint && fromPrint.src, printsLeft: S.prints.length};
  });
  assert.ok(Math.abs(r.sum - 1) < 1e-9);
  assert.ok(r.worst1 < r.worst0, 'high Knack makes Crude rarer');
  assert.ok(r.best1 > 0, 'high Knack can make Masterwork or better');
  assert.equal(r.partsLeft, 1);
  assert.equal(r.mastery, 1);
  assert.match(r.maker, r.gunQ >= 2 ? /Made by Conner with \w+/ : /Made in your Workshop/);
  assert.ok(r.cages >= 2);
  assert.equal(r.printSrc, 'print', 'a print forges a gun without the blueprint');
  assert.equal(r.printsLeft, 0, 'and is used up');
});

test('gear wears each raid, breaks, gets repaired, and is lost on death', async () => {
  const r = await page.evaluate(async () => {
    S.settings.god = true; S.items = []; S.mats.ingot = 50;
    const g = newItem('gun', 'revolver', 1, {src: 'legacy'}); S.loadout.guns = [g.uid, null];
    const sat = newItem('satchel', 'satchel', 2, {}); S.loadout.satchel = sat.uid;
    while (overCap()) S.pens++;
    startRaid('raid', 1); await new Promise(r => setTimeout(r, 150));
    const bagCap = R.bagCap; R.enemies = []; endRaid('extract'); closeModal();
    const afterRaid = {gun: g.dur, sat: sat.dur, max: g.max, satMax: sat.max};
    g.dur = 0; validGuns(); const dropped = S.loadout.guns[0];
    repair(g.uid); const repaired = g.dur;
    S.loadout.guns = [g.uid, null]; S.loadout.satchel = sat.uid;
    startRaid('raid', 1); await new Promise(r => setTimeout(r, 150)); R.enemies = []; endRaid('dead'); closeModal();
    S.settings.god = false;
    return {bagCap, afterRaid, dropped, repaired, gunKept: !!itemByUid(g.uid), satKept: !!itemByUid(sat.uid)};
  });
  assert.equal(r.bagCap, 12 + 4, 'a Superior satchel adds 4 slots');
  assert.equal(r.afterRaid.gun, r.afterRaid.max - 1);
  assert.equal(r.afterRaid.sat, r.afterRaid.satMax - 1, 'the satchel wears too');
  assert.equal(r.dropped, null, 'a broken gun leaves the loadout');
  assert.equal(r.repaired, r.afterRaid.max);
  assert.equal(r.gunKept, false, 'gear carried into a death is lost');
  assert.equal(r.satKept, false);
});

test('the bag holds 10 of a material per slot; Haulers add room', async () => {
  const r = await page.evaluate(async () => {
    S.settings.god = true; S.items = []; S.loadout.satchel = null;
    const hauler = mkc('coralisk'); S.loadout.slots = [hauler.id, null, null];
    startRaid('raid', 1); await new Promise(r => setTimeout(r, 150));
    const cap = R.bagCap; const got = bagAdd('ore', 500); const used = bagUsed(); const more = bagAdd('hide', 5);
    R.enemies = []; endRaid('quit'); closeModal(); S.settings.god = false;
    return {cap, got, used, more};
  });
  assert.equal(r.cap, 16, 'a Hauler adds 4 slots');
  assert.equal(r.got, 160);
  assert.equal(r.used, 16);
  assert.equal(r.more, 0, 'a full bag takes nothing more');
});

test('raid roles: Striker hits harder, Bulwark shields, Medic heals, Catcher widens the cage, Scout reveals', async () => {
  const r = await page.evaluate(async () => {
    S.settings.god = false;
    const striker = mkc('pyrrox'), plain = mkc('cindlet'), bulwark = mkc('magmaul'), medic = mkc('puffcap'), catcher = mkc('mycelisk'), scout = mkc('zephling');
    S.loadout.slots = [striker.id, bulwark.id, catcher.id];
    startRaid('arena'); await new Promise(r => setTimeout(r, 150));
    const strikeRatio = compAtk(R.comps[0]) / R.comps[0].atk;
    const radius = capRadius();
    R.comps[1].x = R.p.x + 20; R.comps[1].y = R.p.y; R.p.inv = 0; const hp0 = R.p.hp; hurtPlayer(20); const shielded = hp0 - R.p.hp;
    R.comps[1].x = R.p.x + 500; R.p.inv = 0; const hp1 = R.p.hp; hurtPlayer(20); const open = hp1 - R.p.hp;
    R.enemies = []; endRaid('arena'); closeModal();
    S.loadout.slots = [medic.id, plain.id, scout.id];
    startRaid('arena'); await new Promise(r => setTimeout(r, 100));
    R.p.hp = 50; const reveal = R.reveal && R.scout; const plainRadius = capRadius();
    await new Promise(r => setTimeout(r, 1000)); const healed = R.p.hp > 50;
    R.enemies = []; endRaid('arena'); closeModal();
    return {strikeRatio, radius, plainRadius, shielded, open, healed, reveal};
  });
  assert.equal(Math.round(r.strikeRatio * 100) / 100, 1.2);
  assert.ok(Math.abs(r.radius / r.plainRadius - 1.3) < 1e-9, 'Catcher widens the cage radius 30%');
  assert.ok(Math.abs(r.shielded / r.open - 0.85) < 1e-6, 'Bulwark nearby: 15% less damage');
  assert.equal(r.healed, true, 'Medic heals over time');
  assert.equal(r.reveal, true, 'Scout reveals the map');
});

test('tonics are drunk automatically at low HP', async () => {
  const r = await page.evaluate(async () => {
    clearStation('spring'); S.mats.herbs = 0;   // so the day's brewing can't add tonics
    S.mats.tonic = 3; S.loadout.tonics = 2; S.items = []; S.loadout.slots = [null, null, null];
    startRaid('raid', 1); await new Promise(r => setTimeout(r, 100));
    const carried = R.tonics, stores = amt('tonic');
    R.p.inv = 0; R.p.hp = 30; hurtPlayer(10);
    const after = {tonics: R.tonics, hp: R.p.hp};
    R.enemies = []; endRaid('extract'); closeModal();
    return {carried, stores, after, back: amt('tonic')};
  });
  assert.equal(r.carried, 2);
  assert.equal(r.stores, 1);
  assert.equal(r.after.tonics, 1);
  assert.equal(r.after.hp, 60, '20 HP left, then +40%');
  assert.equal(r.back, 2, 'the unused tonic comes home');
});

test('expeditions take a team away and bring back loot', async () => {
  const r = await page.evaluate(() => {
    clearStation('roost'); post('roost', mkc('chirrup', {level: 30}), mkc('vesperbat', {level: 30}));
    const team = [mkc('dewdrip'), mkc('coralisk'), mkc('pebblet')];
    post('forge', team[0]);
    const block = expeditionBlock('galleries', team.map(c => c.id)), tier = secTier('roost');
    const ok = startExpedition('galleries', team.map(c => c.id));
    const away = team.every(c => whereIs(c).kind === 'expedition'), inForge = S.sections.forge.ids.includes(team[0].id);
    const hide = amt('hide');
    for (let i = 0; i < 5; i++) processDay();
    return {block, tier, ok, away, inForge, back: team.every(c => whereIs(c).kind !== 'expedition'), gotHide: amt('hide') > hide};
  });
  assert.equal(r.block, '');
  assert.equal(r.ok, true);
  assert.equal(r.away, true);
  assert.equal(r.inForge, false, 'leaving for an expedition frees its job');
  assert.equal(r.back, true);
  assert.equal(r.gotHide, true);
});

test('death legacy: the closest descendant inherits 25% of the bond, and the Memorial remembers', async () => {
  const r = await page.evaluate(() => {
    const mom = mkc('kestrix', {sex: 'F'}), dad = mkc('kestrix', {sex: 'M'}); mom.bondXp = 400;
    const kid = makeCreature('kestrix', 'bred', 1, {mom: mom.id, dad: dad.id, gen: 1}); kid.bondXp = 0; S.creatures.push(kid);
    const grand = makeCreature('kestrix', 'bred', 1, {mom: kid.id, dad: dad.id, gen: 2}); grand.bondXp = 0; S.creatures.push(grand);
    killCreature(mom, 'Fell on Floor 3');
    return {kid: kid.bondXp, grand: grand.bondXp, wall: S.memorial[0]};
  });
  assert.equal(r.kid, 100, 'the child, not the grandchild');
  assert.equal(r.grand, 0);
  assert.ok(r.wall.heir, 'the Memorial names the heir');
  assert.deepEqual(errors, []);
});

test('Phase 2 exit test: raid-only and craft-heavy play both stay supplied for a week', async () => {
  const r = await page.evaluate(() => [1, 2, 3].flatMap(seed => ['raid', 'craft'].map(p => { const l = simulateSupply(p, seed);
    return {p, seed, supplied: l.supplied, hungry: l.hungry, cageShort: l.cageShort, broken: l.broken, coin: l.end.coin}; })));
  for (const x of r) assert.ok(x.supplied, `${x.p} seed ${x.seed}: ${JSON.stringify(x)}`);
  console.log(r.map(x => `${x.p}#${x.seed} coin ${x.coin}`).join(' · '));
  assert.deepEqual(errors, []);
});

test('Lab shortcuts and every Phase 2 screen render without errors', async () => {
  const r = await page.evaluate(() => {
    act('lab-res', {k: 'guns'}); act('lab-res', {k: 'mats'}); act('lab-res', {k: 'bp'});
    for (const t of ['raid', 'roster', 'armory', 'lab', 'settings']) { ui.tab = t; renderAll(); }
    ui.tab = 'hideout';
    for (const k of [...SECTION_IDS, 'log', 'memorial']) { ui.section = k; renderAll(); }
    act('lab-supply', {});
    return {guns: S.items.filter(i => i.kind === 'gun').length, ingots: amt('ingot')};
  });
  assert.ok(r.guns >= 20, 'every weapon added as an item');
  assert.ok(r.ingots >= 30);
  assert.deepEqual(errors, []);
});
