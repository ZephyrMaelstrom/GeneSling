// Phase 4, the hideout builder: the grid layout and build mode, hillside terraces, decor and
// Comfort, creature life (dens, play, friends), titles, trophies, the Hall of Legends, the
// breeder's sigil, image export, and the v9 → v10 save migration.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame, wait} from './helpers.js';

let srv, browser, page, errors, context;
before(async () => {
  srv = await startServer(); browser = await launch();
  ({context, page, errors} = await openGame(browser, srv.url));
  await page.evaluate(() => { closeModal(); S.coin = 20000; Object.keys(JOBS.MATERIALS).forEach(m => give(m, 60)); });
});
after(async () => { await browser.close(); srv.server.close(); });

test('a new hideout is laid out on the grid with nothing overlapping', async () => {
  const r = await page.evaluate(() => {
    const solid = S.layout.filter(i => layer(i.key) === 'solid');
    const overlap = solid.some(a => solid.some(b => a !== b && (() => { const [aw, ah] = foot(a.key), [bw, bh] = foot(b.key); return a.x < b.x + bw && b.x < a.x + aw && a.y < b.y + bh && b.y < a.y + ah; })()));
    const inside = S.layout.every(i => { const [w, h] = foot(i.key); return i.x >= 0 && i.x + w <= PRIDE.GRID.cols && i.y >= minRow() && i.y + h <= PRIDE.GRID.baseRows; });
    return {stations: STATION_KEYS.every(k => S.layout.some(i => i.key === k)), board: S.layout.some(i => i.key === 'board'), dens: S.layout.filter(i => i.key === 'den').length, overlap, inside, comfort: comfort()};
  });
  assert.equal(r.stations, true, 'every station is on the map');
  assert.equal(r.board, true);
  assert.equal(r.dens, 2);
  assert.equal(r.overlap, false);
  assert.equal(r.inside, true);
  assert.equal(r.comfort, 0, 'a plain hideout has no Comfort, so nothing changes until decor goes up');
});

test('build mode: things move to free tiles only, stations stay on the map, paths are flooring', async () => {
  const r = await page.evaluate(() => {
    const forge = stationItem('forge'), garden = stationItem('garden');
    const intoGarden = moveItem(forge.id, garden.x, garden.y);
    const offMap = moveItem(forge.id, 19, 0);
    const storeStation = storeItem(forge.id);
    craftDecor('lantern'); const before = S.decor.lantern;
    // Lanterns can stand on a path tile, but not on another lantern.
    const path = S.layout.find(i => i.key === 'path' && fits('lantern', i.x, i.y));
    const lamp = placeNew('lantern', path.x, path.y);
    const stack = placeNew('lantern', path.x, path.y);
    const stored = storeItem(lamp.id);
    return {intoGarden, offMap, storeStation, onPath: !!lamp, stack, stored, back: S.decor.lantern === before};
  });
  assert.equal(r.intoGarden, false);
  assert.equal(r.offMap, false);
  assert.equal(r.storeStation, false);
  assert.equal(r.onPath, true);
  assert.equal(r.stack, null);
  assert.equal(r.stored, true);
  assert.equal(r.back, true, 'a stored lantern goes back into stores');
});

test('tapping the map in build mode picks things up and sets them down', async () => {
  const r = await page.evaluate(async () => {
    ui.tab = 'hideout'; renderAll(); act('buildmode'); await new Promise(r => setTimeout(r, 100));
    const cv = $('#hmap'), rect = cv.getBoundingClientRect();
    const at = (tx, ty) => ({clientX: rect.left + (tx + .5) * PRIDE.GRID.tile * rect.width / HMAP.W, clientY: rect.top + (tileY(ty) + PRIDE.GRID.tile / 2) * rect.height / mapH()});
    craftDecor('flowerbed');
    act('placepick', {k: 'flowerbed'});
    let spot = null; for (let y = 6; y >= 0 && !spot; y--) for (let x = 0; x < 20; x++) if (fits('flowerbed', x, y)) { spot = {x, y}; break; }
    buildClick(at(spot.x, spot.y));
    const placed = S.layout.find(i => i.key === 'flowerbed' && i.x === spot.x && i.y === spot.y);
    buildClick(at(spot.x, spot.y));                 // pick it up
    const picked = HMAP.pick && HMAP.pick.id === placed.id;
    let to = null; for (let y = 6; y >= 0 && !to; y--) for (let x = 19; x >= 0; x--) if (fits('flowerbed', x, y, placed.id) && (x !== spot.x || y !== spot.y)) { to = {x, y}; break; }
    buildClick(at(to.x, to.y));
    const moved = placed.x === to.x && placed.y === to.y;
    const panel = $('#secPanel').innerText.includes('Comfort');
    act('buildmode');
    return {placed: !!placed, picked, moved, panel};
  });
  assert.deepEqual(r, {placed: true, picked: true, moved: true, panel: true});
});

test('hillside terraces need Keeper rank and materials, and add rows above without moving anything', async () => {
  const r = await page.evaluate(() => {
    S.keeper.level = 1; const early = buyPlot();
    S.keeper.level = 4; const before = JSON.stringify(S.layout.map(i => [i.id, i.x, i.y])), rows = rowCount();
    const ok = buyPlot();
    craftDecor('banner'); const up = placeNew('banner', 3, -2);
    return {early, ok, rows: rowCount() - rows, same: JSON.stringify(S.layout.filter(i => i.key !== 'banner').map(i => [i.id, i.x, i.y])) === before, up: !!up, minRow: minRow()};
  });
  assert.equal(r.early, false);
  assert.equal(r.ok, true);
  assert.equal(r.rows, 2);
  assert.equal(r.same, true);
  assert.equal(r.up, true, 'decor can go on the new terrace');
  assert.equal(r.minRow, -2);
});

test('Comfort comes from decor, is capped at +20%, cuts fatigue and speeds bond', async () => {
  const r = await page.evaluate(() => {
    const worker = S.creatures.find(c => whereIs(c).kind === 'section');
    const fatBase = (() => { S.layout = S.layout.filter(i => !PRIDE.DECOR[i.key] || i.key === 'path' || i.key === 'den'); worker.fat = 0; tickFatigue(); return worker.fat; })();
    const c = S.creatures[0]; c.bondXp = 0; addBond(c, 100); const bondBase = c.bondXp;
    for (let n = 0; n < 6; n++) for (const k of ['fountain', 'totem', 'mushlamp', 'bench', 'lantern', 'flowerbed']) { craftDecor(k); autoPlace(k); }
    const pts = comfortPoints(), cf = comfort();
    worker.fat = 0; tickFatigue(); const fat = worker.fat;
    c.bondXp = 0; addBond(c, 100);
    return {pts, cf, fatBase, fat, bondBase, bond: c.bondXp};
  });
  assert.ok(r.pts * 0.005 >= 0.2, `enough decor for the cap (${r.pts} points)`);
  assert.equal(r.cf, 0.2, 'Comfort stops at +20%');
  assert.ok(Math.abs(r.fat - r.fatBase * 0.8) < 1e-9, `fatigue rose ${r.fat}, not ${r.fatBase} × 0.8`);
  assert.equal(r.bond, Math.round(r.bondBase * 1.2));
});

test('off-duty creatures sleep in dens at night, three to a den, and friends follow each other', async () => {
  const r = await page.evaluate(() => {
    const home = () => S.creatures.filter(c => ['idle', 'loadout'].includes(whereIs(c).kind));
    while (home().length < 8) { const c = makeCreature('pebblet', 'bred', 5); S.creatures.push(c); }
    home().forEach(c => { c.fat = 0; });
    const night = lifePlan(0.9), day = lifePlan(0.3);
    const perDen = {}; for (const p of night.values()) if (p.den) perDen[p.den] = (perDen[p.den] || 0) + 1;
    const tired = home()[0]; tired.fat = 80; const tiredDay = lifePlan(0.3).get(tired.id).state; tired.fat = 0;
    const [a, b] = home().slice(1, 3);
    a.bondXp = b.bondXp = 400; const before = areFriends(a, b);
    recordShared([a.id, b.id]); recordShared([a.id, b.id]); recordShared([a.id, b.id, 999]);
    const plan = lifePlan(0.3), pa = plan.get(a.id), pb = plan.get(b.id);
    return {allSleep: [...night.values()].every(p => p.state === 'sleep'), dens: Object.values(perDen), dayPlay: [...day.values()].every(p => p.state !== 'sleep'), tiredDay, before, after: areFriends(a, b),
      follow: (pa.state === 'follow' && pa.friend === b.id) || (pb.state === 'follow' && pb.friend === a.id), notBoth: !(pa.state === 'follow' && pb.state === 'follow')};
  });
  assert.equal(r.allSleep, true);
  assert.deepEqual(r.dens, [3, 3], 'two dens, three sleepers each; the rest sleep in the open');
  assert.equal(r.dayPlay, true);
  assert.equal(r.tiredDay, 'sleep', 'a tired creature naps by day');
  assert.equal(r.before, false);
  assert.equal(r.after, true, 'three raids home together and bonded: friends');
  assert.equal(r.follow, true);
  assert.equal(r.notBoth, true, 'one leads, one follows');
});

test('an extraction earns titles, records friendships and brings a boss trophy home', async () => {
  const r = await page.evaluate(async () => {
    S.settings.god = true;
    const party = S.loadout.slots.slice(0, 2).map(byId);
    party.forEach(c => { c.raids = 9; c.titles = []; });
    S.trophies = S.trophies.filter(t => t.boss !== 'wyrm');
    const shared = sharedRaids(party[0], party[1]);
    startRaid('raid', 1); await new Promise(r => setTimeout(r, 150));
    R.bossDown = BOSSES.wyrm; R.bossId = 'wyrm'; R.enemies = []; endRaid('extract');
    const text = $('#modalBox').innerText; closeModal(); S.settings.god = false;
    const t = S.trophies.find(x => x.boss === 'wyrm');
    return {titles: party.map(c => c.titles.slice().sort()), shared: sharedRaids(party[0], party[1]) - shared, trophy: !!t, placed: placedRef('trophy', t.id), story: trophyStory(t), text: text.includes('Wyrmslayer')};
  });
  assert.deepEqual(r.titles, [['ten', 'wyrmslayer'], ['ten', 'wyrmslayer']]);
  assert.equal(r.shared, 1);
  assert.equal(r.trophy, true);
  assert.equal(r.placed, true, 'the trophy is placed in the hideout');
  assert.match(r.story, /Beaten on day \d+ on Floor 1, with .+ and .+, and carried home\./);
  assert.equal(r.text, true, 'the results screen lists the titles');
});

test('Hall of Legends: veterans retire into statues and grant their type perk, stacking up to three', async () => {
  const r = await page.evaluate(() => {
    const mk = () => { const c = makeCreature('pyrrox', 'bred', 20); c.raids = 12; S.creatures.push(c); return c; };
    const rookie = makeCreature('pyrrox', 'bred', 20); S.creatures.push(rookie);
    const block = retireBlock(rookie);
    const d0 = weaponDmgMul();
    const first = retire(mk());
    const d1 = weaponDmgMul();
    for (let i = 0; i < 4; i++) retire(mk());
    const d5 = weaponDmgMul();
    return {block, statue: placedRef('statue', first.id), gone: !byId(first.id), up: d1 / d0, cap: d5 / d0, legends: S.legends.length};
  });
  assert.match(r.block, /Needs 8 raids home/);
  assert.equal(r.statue, true);
  assert.equal(r.gone, true);
  assert.ok(Math.abs(r.up - 1.03) < 1e-9, `one Ember legend: +3% damage (got ×${r.up})`);
  assert.ok(Math.abs(r.cap - 1.09) < 1e-9, `the perk stacks only three times (got ×${r.cap})`);
});

test('the breeder’s sigil marks creatures you breed and travels through the Exchange', async () => {
  const r = await page.evaluate(() => {
    S.keeperName = 'Conner'; setSigil({shape: 'hex', color: '#7fd860', glyph: '☾'});
    const mom = makeCreature('pebblet', 'bred', 5, {sex: 'F', proven: true}), dad = makeCreature('pebblet', 'bred', 5, {sex: 'M', proven: true});
    S.creatures.push(mom, dad); S.pens = 20;
    const t = secTier('nursery'); if (!t) { const w = makeCreature('wardlet' in SPECIES ? 'wardlet' : BASE_SPECIES.find(k => SPECIES[k].type === 'warden'), 'bred', 30); S.creatures.push(w); S.sections.nursery.ids.push(w.id); }
    ui.mom = String(mom.id); ui.dad = String(dad.id); S.eggs = []; const laid = breed();
    const child = laid && laid[0];
    const back = materialize({kind: 'creature', c: structuredClone(child)});
    const bc = byId(back);
    ui.tab = 'roster'; renderAll(); const card = document.body.innerHTML.includes('Bred by Conner');
    return {by: child && child.by, kept: bc && bc.by, card};
  });
  assert.deepEqual(r.by, {name: 'Conner', sigil: {shape: 'hex', color: '#7fd860', glyph: '☾'}});
  assert.deepEqual(r.kept, r.by, 'a creature bought on the Exchange keeps who bred it');
  assert.equal(r.card, true);
});

test('Legendary weapons go on display and can be taken down again', async () => {
  const r = await page.evaluate(() => {
    const it = newItem('gun', 'revolver', 4, {src: 'crafted', maker: 'Conner'});
    const fine = newItem('gun', 'revolver', 1, {});
    const no = displayWeapon(fine.uid);
    const t = displayWeapon(it.uid);
    const shown = !S.items.includes(it) && placedRef('trophy', t.id);
    const story = trophyStory(t);
    const down = takeDownWeapon(t.id);
    return {no, shown, story, down, back: S.items.some(i => i.uid === it.uid), gone: !placedRef('trophy', t.id)};
  });
  assert.equal(r.no, null, 'only Legendary weapons');
  assert.equal(r.shown, true);
  assert.match(r.story, /Made by Conner/);
  assert.equal(r.down, true);
  assert.equal(r.back, true);
  assert.equal(r.gone, true);
});

test('creature cards and hideout snapshots export as PNG images', async () => {
  const r = await page.evaluate(async () => {
    const c = S.creatures[0]; c.titles = ['wyrmslayer'];
    const card = cardCanvas(c), snap = snapshotCanvas();
    const cb = await blobOf(card), sb = await blobOf(snap);
    const p = openShare('card', c.id); const how = await shareGo(); const img = !!$('#modalBox img.sharepic'); closeModal();
    openShare('snapshot'); const img2 = !!$('#modalBox img.sharepic'); closeModal();
    return {cw: card.width, ch: card.height, sw: snap.width, sh: snap.height, mh: mapH(), cb: cb.size, sb: sb.size, type: cb.type, name: p.name, how, img, img2};
  });
  assert.equal(r.cw, 640); assert.equal(r.ch, 360);
  assert.equal(r.sw, 1000); assert.equal(r.sh, r.mh + 44);
  assert.ok(r.cb > 5000 && r.sb > 20000, `real images (${r.cb} and ${r.sb} bytes)`);
  assert.equal(r.type, 'image/png');
  assert.match(r.name, /^genesling-[a-z0-9-]+\.png$/);
  assert.equal(r.how, 'downloaded', 'without a share sheet (desktop), the image is saved');
  assert.equal(r.img && r.img2, true);
});

test('the hideout, its panels and the Settings sigil designer render without errors', async () => {
  await page.evaluate(async () => {
    ui.tab = 'hideout'; renderAll(); await new Promise(r => setTimeout(r, 200));
    HMAP.t = PRIDE.LIFE.dayLength * 0.9; await new Promise(r => setTimeout(r, 1300));   // night: dens and lamps
    for (const k of ['legends', 'log', 'memorial', 'forge']) act('section', {k});
    act('buildmode'); act('buildmode');
    const tr = S.trophies[0]; if (tr) openTrophy(tr.id); closeModal();
    const lg = S.legends[0]; if (lg) openLegend(lg.id); closeModal();
    ui.tab = 'armory'; renderAll(); ui.tab = 'settings'; renderAll();
    act('sigil', {k: 'shape', v: 'star'}); act('sigilsave'); act('sigilclear');
    ui.tab = 'exchange'; ui.mk.tab = 'auctions'; renderAll();
  });
  assert.deepEqual(errors, []);
});

test('a v9 save loads into the current version with the old map’s layout, and beaten bosses as trophies', async () => {
  const ctx = await browser.createBrowserContext();
  const {page: p2, errors: e2} = await openGame(browser, srv.url, {context: ctx});
  const r = await p2.evaluate(async () => {
    const d = JSON.parse(JSON.stringify(S));
    for (const k of ['layout', 'plots', 'decor', 'friends', 'legends', 'sigil', 'demo', 'telemetry', 'trophies']) delete d[k];
    d.creatures.forEach(c => delete c.titles); d.v = 9; d.progress.bosses = {bloom: 1};
    const db = await new Promise((res, rej) => { const q = indexedDB.open('genesling'); q.onsuccess = () => res(q.result); q.onerror = rej; });
    await new Promise(res => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put({v: 9, saved: Date.now(), data: JSON.stringify(d)}, 'main'); tx.oncomplete = res; });
    db.close();
  });
  void r;
  await p2.reload(); await p2.evaluate(() => window.gameReady);
  const s = await p2.evaluate(() => ({v: S.v, layout: S.layout.length === defaultLayout().length, plots: S.plots, trophies: S.trophies.map(t => [t.boss, !!t.legacy]), placed: S.layout.some(i => i.key === 'trophy'), titles: S.creatures.every(c => Array.isArray(c.titles)), story: trophyStory(S.trophies[0])}));
  assert.equal(s.v, 12);
  assert.equal(s.layout, true);
  assert.equal(s.plots, 0);
  assert.deepEqual(s.trophies, [['bloom', true]]);
  assert.equal(s.placed, false, 'old trophies wait in stores to be placed');
  assert.equal(s.titles, true);
  assert.match(s.story, /before the trophy hall/);
  assert.deepEqual(e2, []);
  await ctx.close();
});
