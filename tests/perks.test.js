// Step 3 of docs/IMPROVEMENTS.md: stations are buildings with levels, and each creature brings its own perks
// and flaws. Checks the perk sources and their strength, work at a station, the hideout and raid effects,
// earned perks, the act gate, the station panel and creature page, and the v16 save.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
const run = (fn, ...a) => page.evaluate(fn, ...a);
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await run(() => {
    closeModal(); S.settings.god = true; S.pens = 20; S.coin = 99999; S.ore = 999;
    window.sleep = ms => new Promise(r => setTimeout(r, ms));
    window.endQuiet = how => { if (R) { R.enemies = []; endRaid(how || 'quit'); closeModal(); } };
    // A fresh creature of a species, posted at a station (or nowhere).
    window.mk = (sp, lv = 20, o = {}) => { const c = makeCreature(sp, 'bred', lv, {pers: 'brave', ...o}); c.fat = 0; S.creatures.push(c); dexForm(sp, 0, 'owned'); return c; };
    window.post = (c, k) => { unplace(c); S.sections[k].ids.push(c.id); resetFxCache(); };
    window.clearAll = () => { for (const k of SECTION_IDS) S.sections[k].ids = []; S.loadout.slots = [null, null, null]; resetFxCache(); };
    window.ids = c => perksOf(c).map(p => p.id);
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('perks come from the line, its final form, hybrids, personality, and grow with the creature', async () => {
  const r = await run(() => {
    const kid = mk('cindlet', 5), top = mk('cindlet', 35, {stage: 3}), hyb = mk('blazewing', 20);
    const k = perksOf(kid).find(p => p.id === 'kindler').s, kTop = perksOf(top).find(p => p.id === 'kindler').s;
    top.bondXp = BOND_TH[4]; const kBond = perksOf(top).find(p => p.id === 'kindler').s;
    const flawS = perksOf(top).find(p => p.id === 'restless').s;
    return {kid: ids(kid), top: ids(top), hyb: perksOf(hyb).map(p => [p.id, Math.round(p.s * 100) / 100]), k, kTop, kBond, flawS};
  });
  assert.deepEqual(r.kid, ['kindler', 'restless', 'p_brave', 'f_brave']);
  assert.ok(r.top.includes('forgemaster'), 'the final form adds its mastery perk');
  assert.deepEqual(r.hyb.map(x => x[0]), ['kindler', 'tailwind', 'volatile', 'p_brave', 'f_brave'], 'a hybrid: a perk from each parent line, and a flaw of its own');
  assert.equal(r.hyb[0][1], 0.8, 'at 80% strength');
  assert.equal(r.k, 1); assert.ok(Math.abs(r.kTop - 1.3) < 1e-9, '+10% per evolution stage');
  assert.ok(Math.abs(r.kBond - 1.95) < 1e-9, '×1.5 at ★5 bond'); assert.equal(r.flawS, 1, 'flaws don’t grow');
});

test('a station’s output is its crew: Kindler and Restless at the Forge, a refusal, clashes, and crew effects', async () => {
  const r = await run(() => {
    clearAll();
    const kindle = mk('cindlet', 20, {pers: 'calm'}), brick = mk('magmaul', 20, {pers: 'calm'});
    kindle.genome.yld = [6, 6]; brick.genome.yld = [6, 6]; express(kindle); express(brick);
    post(kindle, 'forge');
    const solo = workMods(kindle, 'forge');
    post(brick, 'forge');
    const heat = workMods(kindle, 'forge');
    // Mycelisk is Shy: it won't work at the War Room.
    const shy = mk('mycelisk', 20); post(shy, 'warroom'); const refuse = workMods(shy, 'warroom');
    // Kestrix's Hot Temper clashes with Calm crewmates.
    const kes = mk('kestrix', 20, {pers: 'brave'}); post(kes, 'forge'); const cm = crewMods('forge');
    return {soloOut: solo.out, soloTire: solo.tire, heatTire: heat.tire, refuse: refuse.out, refusesName: refuse.refuses, clashes: cm.flawClashes.map(x => x[2]), unit: workUnit(kindle, 'forge') > 0};
  });
  assert.ok(Math.abs(r.soloOut - 1.15) < 1e-9, 'Kindler: +15% at the Forge');
  assert.ok(Math.abs(r.soloTire - 1.25) < 1e-9, 'Restless: tires 25% faster');
  assert.ok(Math.abs(r.heatTire - 0.85) < 1e-9, 'beside a Calm Magmaul: Heat Sink −30% and Calm −10%');
  assert.equal(r.refuse, 0); assert.equal(r.refusesName, 'Shy');
  assert.ok(r.clashes.includes('Hot Temper'));
  assert.equal(r.unit, true);
});

test('buildings: every station starts at level 1, upgrades cost coin, materials and rank, and an empty building does nothing', async () => {
  const r = await run(() => {
    clearAll(); S.keeper.level = 2;
    const start = SECTION_IDS.filter(sectionUnlocked).every(k => buildingLevel(k) === 1);
    const empty = stationLevel('nursery'), noEggs = eggCap();
    const w = mk('pebblet'); post(w, 'nursery');
    const staffed = stationLevel('nursery'), eggs1 = eggCap();
    const lowRank = upgradeBlock('nursery'); S.keeper.level = 12;
    const ok = upgradeBuilding('nursery'), eggs2 = eggCap(), lvl = buildingLevel('nursery');
    // Pebblet's Nest Warmer at the Nursery makes eggs hatch a day sooner (never under 1 day).
    // The Forge's level sets the weapon tier it can craft.
    const smith = mk('cindlet'); post(smith, 'forge');
    const tier1 = forgeTier(); S.buildings.forge = 4; const tier4 = forgeTier(); S.buildings.forge = 1;
    return {start, empty, noEggs, staffed, eggs1, lowRank, ok, eggs2, lvl, tier1, tier4};
  });
  assert.equal(r.start, true);
  assert.equal(r.empty, 0); assert.equal(r.noEggs, 0);
  assert.equal(r.staffed, 1); assert.equal(r.eggs1, 1);
  assert.match(r.lowRank, /Keeper rank 3/);
  assert.equal(r.ok, true); assert.equal(r.lvl, 2); assert.equal(r.eggs2, 2);
  assert.equal(r.tier1, 1); assert.equal(r.tier4, 3);
});

test('the hideout: the Spring heals by level and Healer’s Touch, Dawn Song adds bond, Ploughman grows food, Glutton eats more', async () => {
  const r = await run(() => {
    clearAll();
    const hurt = mk('cindlet'); const m = stats(hurt).hp;
    const heal = () => { hurt.hp = 1; processDay(); return (hurt.hp - 1) / m; };
    const none = heal();
    const dew = mk('dewdrip'); post(dew, 'spring'); const lvl1 = heal();
    const halo = mk('halowing'); post(halo, 'garden'); const b0 = hurt.bondXp; processDay(); const bond = hurt.bondXp - b0;
    const ploughFood = (() => { const sh = mk('shroomite'); post(sh, 'garden'); return hideoutFx().make.food; })();
    clearAll(); const mouths0 = mouths(); const g = mk('hydravine'); const mouths1 = mouths();
    S.creatures = S.creatures.filter(c => c !== g);
    return {none, lvl1, bond, ploughFood, extraMouths: mouths1 - mouths0};
  });
  assert.ok(Math.abs(r.none - 0.35) < 0.02, 'nobody posted: 35% a day');
  assert.ok(Math.abs(r.lvl1 - 0.5 * 1.25) < 0.02, 'level 1 heals 50%, and Healer’s Touch adds 25% of that');
  assert.ok(r.bond >= 2, 'Dawn Song: +2 bond a day to every creature');
  assert.equal(r.ploughFood, 1);
  assert.equal(r.extraMouths, 3, 'Three Mouths eats 3 food a day');
});

test('raids from home: Mapper reveals the map, Tailwind Drill adds HP, Coin Keeper keeps coin, and a companion’s own flaws', async () => {
  const r = await run(async () => {
    clearAll();
    const fighter = mk('magmaul', 20), soft = mk('puffcap', 20);
    S.loadout.slots = [fighter.id, soft.id, null];
    startRaid('raid', 1); await sleep(100);
    const plain = {reveal: R.reveal, hp: R.p.maxHp}; endQuiet('extract');
    const chirp = mk('chirrup'); post(chirp, 'roost');
    const zeph = mk('zephling'); post(zeph, 'warroom');
    const shard = mk('shardling'); post(shard, 'vault');
    S.loadout.slots = [fighter.id, soft.id, null];
    startRaid('raid', 1); await sleep(100);
    const homebody = R.comps[1].atk / stats(soft).atk;
    const withPerks = {reveal: R.reveal, hp: R.p.maxHp};
    R.bag.coin = 200; const coin0 = S.coin; R.enemies = []; endRaid('dead'); closeModal();
    return {plain, withPerks, homebody, kept: S.coin - coin0};
  });
  assert.equal(r.plain.reveal, false);
  assert.equal(r.withPerks.reveal, true, 'a Chirrup at the Roost maps every floor');
  assert.equal(r.withPerks.hp - r.plain.hp, 10, 'a Zephling at the War Room: +10 max HP');
  assert.ok(Math.abs(r.homebody - 0.9) < 0.01, 'Homebody: −10% damage');
  assert.equal(r.kept, Math.round(200 * 0.15), 'Coin Keeper: 15% of the bag kept on death (the Vault is level 1)');
});

test('earned in play: 30 days at a station, Burnt Out after running ragged, Homesick after a month without raids', async () => {
  const r = await run(() => {
    clearAll(); const c = mk('cindlet'); post(c, 'forge'); c.raids = 1; c.lastRaid = S.day;
    for (let i = 0; i < 30; i++) { c.fat = 0; processDay(); }
    const hand = ids(c).includes('hand_forge'), homesick = ids(c).includes('homesick');
    c.fat = 99; for (let i = 0; i < 3; i++) { c.fat = 99; processDay(); }
    const burnt = ids(c).includes('burntout');
    unplace(c); for (let i = 0; i < 5; i++) processDay();
    const cleared = !ids(c).includes('burntout');
    return {hand, homesick, burnt, cleared, story: history(c).map(e => e.text).join(' | ')};
  });
  assert.equal(r.hand, true); assert.equal(r.homesick, true);
  assert.equal(r.burnt, true); assert.equal(r.cleared, true);
  assert.match(r.story, /Forge-hand/);
});

test('the veins gate needs three stations built to level 2, each with two workers', async () => {
  const r = await run(() => {
    clearAll(); S.keeper.level = 10;
    for (const k of SECTION_IDS) S.buildings[k] = 1;
    const before = gateNeeds('veins').find(x => /stations/.test(x.text));
    for (const k of ['forge', 'garden', 'spring']) { S.buildings[k] = 2; for (let i = 0; i < 2; i++) post(mk(BASE_SPECIES.find(sp => SPECIES[sp].type === SECTIONS[k].type)), k); }
    const after = gateNeeds('veins').find(x => /stations/.test(x.text));
    return {before: before.ok, after: after.ok, text: after.text};
  });
  assert.equal(r.before, false); assert.equal(r.after, true);
  assert.match(r.text, /3 stations at level 2 with 2 workers/);
});

test('the station panel shows the building and each worker’s perks; the creature page lists its perks and flaws', async () => {
  const r = await run(() => {
    clearAll(); const c = mk('cindlet'); post(c, 'forge');
    act('tab', {k: 'hideout'}); act('section', {k: 'forge'});
    const panel = document.querySelector('#secPanel') || document.querySelector('#main');
    const text = panel.innerText, chips = [...panel.querySelectorAll('.pk')].map(x => x.className + ':' + x.textContent);
    const upgrade = !!panel.querySelector('[data-act="upgrade"]');
    act('creature', {id: c.id}); act('ctab', {k: 'overview'});
    const pageText = document.querySelector('.cp-perks').innerText; act('cback');
    return {level: /Level \d\/5/.test(text), upgrade, chips, pageText};
  });
  assert.equal(r.level, true); assert.equal(r.upgrade, true);
  assert.ok(r.chips.some(x => /good:Kindler \+15%/.test(x)), r.chips.join(' '));
  assert.match(r.pageText, /Kindler/); assert.match(r.pageText, /Restless/);
});

test('a v16 save loads as v17: each station’s building matches the tier it had', async () => {
  const r = await run(() => {
    clearAll();
    const d = JSON.parse(JSON.stringify(S)); d.v = 16; delete d.buildings;
    // A strong Garden crew (tier 3 or more under the old scores), an empty Vault.
    const crew = [0, 1, 2].map(() => { const c = mk('puffcap', 30, {stage: 2}); c.genome.yld = [9, 9]; express(c); return c; });
    d.creatures = JSON.parse(JSON.stringify(S.creatures)); d.sections.garden.ids = crew.map(c => c.id); d.sections.vault.ids = [];
    const m = migrate(d);
    return {v: m.v, garden: m.buildings.garden, vault: m.buildings.vault, counters: m.creatures.every(c => c.days && c.lastRaid != null)};
  });
  assert.equal(r.v, 17);
  assert.ok(r.garden >= 3, `the Garden keeps its tier as a level (${r.garden})`);
  assert.equal(r.vault, 1);
  assert.equal(r.counters, true);
  assert.deepEqual(errors, []);
});
