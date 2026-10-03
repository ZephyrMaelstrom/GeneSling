// Step 2 of docs/IMPROVEMENTS.md: every list shows a small creature card, and each creature has a page of
// its own (identity column, Overview, Genes, Work, Story, Actions) showing only what the player knows;
// each creature keeps a history (save v16); the raid menu shows a compact, read-only page.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
const run = (fn, ...a) => page.evaluate(fn, ...a);
const PHONE = {width: 780, height: 360, isMobile: true, hasTouch: true};
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url, {viewport: PHONE}));
  await run(() => {
    closeModal(); S.settings.god = true; act('lab-squad', {}); act('lab-squad', {}); S.pens = 10;
    window.sleep = ms => new Promise(r => setTimeout(r, ms));
    window.endQuiet = how => { if (R) { R.enemies = []; endRaid(how || 'quit'); closeModal(); } };
    // Nothing on the page may be wider than the screen.
    window.overflow = () => document.documentElement.scrollWidth > innerWidth + 1;
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('the roster shows one small card per creature, with no stat grid or buttons, and fits a phone held sideways', async () => {
  const r = await run(() => {
    const c = S.creatures[0]; c.hp = 1;
    act('tab', {k: 'roster'});
    const cards = [...document.querySelectorAll('#main .ccard')], first = cards.find(x => +x.dataset.id === c.id);
    return {n: cards.length, total: rosterList().length, buttons: cards.reduce((a, x) => a + x.querySelectorAll('button').length, 0), stats: document.querySelectorAll('#main dl.stats, #main .genes').length,
      text: first.innerText, hurt: !!first.querySelector('.bar.hp'), tall: Math.max(...cards.map(x => x.getBoundingClientRect().height)), perRow: new Set(cards.map(x => Math.round(x.getBoundingClientRect().top))).size, overflow: overflow()};
  });
  assert.equal(r.n, r.total);
  assert.equal(r.buttons, 0, 'the card is one button, with none inside');
  assert.equal(r.stats, 0);
  assert.match(r.text, /Hurt \d+%/);
  assert.equal(r.hurt, true, 'an HP bar only when hurt');
  assert.ok(r.tall <= 130, `cards stay small (${r.tall}px)`);
  assert.ok(r.n / r.perRow >= 3, 'at least three cards a row at 780 × 360');
  assert.equal(r.overflow, false);
});

test('a card shows the most urgent flag only', async () => {
  const r = await run(() => {
    const c = makeCreature('cindlet', 'wild', 12, {proven: false}); S.creatures.push(c);
    const flags = [];
    flags.push(cardFlag(c));                          // unproven
    c.fat = 70; flags.push(cardFlag(c));              // tired beats unproven
    c.hp = 3; flags.push(cardFlag(c));                // hurt beats tired
    c.proven = true; flags.push(cardFlag(c));         // can evolve beats hurt (Lv 12 ≥ 10)
    S.creatures = S.creatures.filter(x => x !== c);
    return flags.map(f => f && f[1]);
  });
  assert.deepEqual(r.map(x => x.replace(/ \d+%/, '')), ['Unproven', 'Tired', 'Hurt', 'Can evolve']);
});

test('tapping a card opens its page; tabs redraw only their body; prev and next follow the list; Back returns', async () => {
  await run(() => { act('tab', {k: 'roster'}); window.scrollTo(0, 300); });
  const scroll = await run(() => scrollY);
  await page.$$eval('#main .ccard', els => els[2].click());
  const r = await run(() => {
    const L = rosterList().map(c => c.id), id = ui.creature, aside = document.querySelector('.cp-id'), out = {at: L.indexOf(id), tabs: {}};
    for (const k of ['overview', 'genes', 'work', 'story', 'actions']) { act('ctab', {k}); out.tabs[k] = document.querySelector('#cp-body').innerText.length > 40; }
    out.same = document.querySelector('.cp-id') === aside;
    act('cstep', {d: 1}); out.next = L.indexOf(ui.creature);
    act('cstep', {d: -1}); act('cstep', {d: -1}); out.prev = L.indexOf(ui.creature);
    out.overflow = overflow();
    return out;
  });
  assert.equal(r.at, 2);
  assert.deepEqual(Object.values(r.tabs), [true, true, true, true, true]);
  assert.equal(r.same, true, 'switching tabs leaves the identity column alone');
  assert.equal(r.next, 3); assert.equal(r.prev, 1);
  assert.equal(r.overflow, false, 'the page fits 780 px across');
  await page.$eval('[data-act="cback"]', el => el.click());
  const back = await run(() => ({route: ui.creature, roster: !!document.querySelector('#main .ccard'), y: scrollY}));
  assert.equal(back.route, null); assert.equal(back.roster, true);
  assert.equal(back.y, scroll, 'back at the same scroll position');
});

test('the Overview’s stat breakdown matches the real stats, and shows only what the player knows', async () => {
  const r = await run(() => {
    const prod = parts => parts.reduce((a, p) => a * p[1], 1);
    const bad = S.creatures.filter(c => { const s = stats(c), P = statParts(c);
      return Math.abs(prod(P.hp) - s.hp) > 1 || Math.abs(prod(P.atk) - s.atk) > .1 || Math.abs(prod(P.spd) - s.spd) > 1 || Math.abs(prod(P.rate) - s.rate) > .01; }).map(c => c.name);
    const wild = makeCreature('puffcap', 'wild', 5, {proven: false, traits: ['thick', 'glow', null]}); S.creatures.push(wild);
    S.settings.genes = false; act('creature', {id: wild.id}); act('ctab', {k: 'overview'});
    const hidden = document.querySelector('#cp-body').textContent, parts = document.querySelector('.cp-parts').textContent, starsOnly = !/Vigor\s*×/.test(parts) && /Vigor\s*★/.test(parts);
    act('ctab', {k: 'genes'}); const genesHidden = /Traits hidden/.test(document.querySelector('#cp-body').innerText);
    wild.proven = true; S.settings.genes = true; act('ctab', {k: 'overview'});
    const shown = [...document.querySelectorAll('.cp-parts')].map(x => x.textContent).join(' ');
    act('cback'); S.creatures = S.creatures.filter(c => c !== wild); S.settings.genes = false;
    return {bad, thickHidden: !/Thick Hide/.test(hidden), unknownNote: /unknown until it comes home/.test(hidden), starsOnly, genesHidden, numbers: /Vigor\s*×/.test(shown), thickShown: /Thick Hide/.test(shown)};
  });
  assert.deepEqual(r.bad, []);
  assert.equal(r.thickHidden, true, 'an unproven catch keeps its traits secret');
  assert.equal(r.unknownNote, true);
  assert.equal(r.starsOnly, true, 'without a Sequencer, genes show as stars');
  assert.equal(r.genesHidden, true);
  assert.equal(r.numbers, true, 'with the tools, the exact factor');
  assert.equal(r.thickShown, true);
});

test('the Work tab shows what it would make at each station, matching the station’s own numbers', async () => {
  const r = await run(() => {
    const c = S.creatures.find(x => x.type === 'ember'); unplace(c); S.sections.forge.ids = [c.id];
    const rep = stationReport('forge'), want = (rep.per(c) * JOBS.STATIONS.forge.out.ingot).toFixed(1);
    act('creature', {id: c.id}); act('ctab', {k: 'work'});
    const line = [...document.querySelectorAll('.cp-work li')].find(li => /Forge/.test(li.innerText)).innerText;
    act('cback');
    return {line, want};
  });
  assert.match(r.line, new RegExp(`${r.want} ingot`));
  assert.match(r.line, /works here now/);
});

test('the Actions tab: party slot, posting, breeding, renaming and selling', async () => {
  const r = await run(() => {
    const c = S.creatures.find(x => x.sex === 'F' && x.proven && !expAway(x)); act('creature', {id: c.id}); act('ctab', {k: 'actions'});
    act('cslot', {slot: 1}); const slot = S.loadout.slots[1] === c.id;
    const sel = document.querySelector('[data-act="cpost"]'); sel.value = 'garden'; sel.dispatchEvent(new Event('change', {bubbles: true}));
    const posted = S.sections.garden.ids.includes(c.id) && S.loadout.slots[1] !== c.id;
    const name = document.querySelector('[data-act="crename"]'); name.value = 'Marigold'; name.dispatchEvent(new Event('change', {bubbles: true}));
    const renamed = c.name === 'Marigold';
    act('ctab', {k: 'actions'}); act('cbreed'); const breed = ui.tab === 'breeding' && ui.mom === String(c.id) && ui.creature === null;
    const other = S.creatures.find(x => x !== c && !expAway(x)), n = S.creatures.length; act('creature', {id: other.id});
    act('sell', {id: other.id}); act('sell', {id: other.id});
    const sold = S.creatures.length === n - 1 && ui.creature === null && !!document.querySelector('#main');
    return {slot, posted, renamed, breed, sold};
  });
  assert.deepEqual(r, {slot: true, posted: true, renamed: true, breed: true, sold: true});
});

test('the party picker, station rows, breeding parents and the family tree all use cards or open the page', async () => {
  const r = await run(() => {
    act('tab', {k: 'raid'}); act('choose', {slot: '0'});
    const picker = document.querySelectorAll('#modal .ccard[data-act="pickslot"]').length; closeModal();
    const mom = S.creatures.find(x => x.sex === 'F' && x.proven), dad = S.creatures.find(x => x.sex === 'M' && x.proven);
    ui.mom = String(mom.id); ui.dad = String(dad.id); act('tab', {k: 'breeding'});
    const parents = document.querySelectorAll('#main .ccard').length;
    const w = S.creatures.find(x => !expAway(x) && x !== mom && x !== dad); unplace(w); S.sections.forge.ids = [w.id];
    act('tab', {k: 'hideout'}); act('section', {k: 'forge'});
    const station = document.querySelectorAll('#main .member [data-act="creature"]').length;
    act('tree', {id: mom.id}); const live = document.querySelectorAll('#modal .tnode.live').length;
    document.querySelector('#modal .tnode.live').click(); const opened = ui.creature === mom.id && document.querySelector('#modal').hidden;
    act('cback');
    return {picker, parents, station, live, opened};
  });
  assert.ok(r.picker > 10);
  assert.equal(r.parents, 2);
  assert.ok(r.station >= 1);
  assert.ok(r.live >= 1);
  assert.equal(r.opened, true);
});

test('each creature keeps its own history: catches, extracts and kills, hatching, children and evolving', async () => {
  const r = await run(async () => {
    const a = S.loadout.slots[0] ? byId(S.loadout.slots[0]) : S.creatures.find(c => !expAway(c));
    unplace(a); S.loadout.slots = [a.id, null, null]; const before = {extracts: a.extracts || 0, kills: a.kills || 0};
    startRaid('raid', 5, null, 'ember'); await sleep(150);
    R.comps[0].kills = 4; R.comps[0].hp = R.comps[0].maxHp * .1;
    const wild = makeCreature('pyrrox', 'wild', 6, {captureRaid: R.id}); R.slot3 = {c: wild};
    R.enemies = []; endRaid('extract', 'rift'); closeModal();
    const caught = history(wild)[0].text, mine = history(a).map(e => e.kind);
    // Hatching tells the parents.
    const mom = S.creatures.find(x => x.sex === 'F' && x.proven), dad = S.creatures.find(x => x.sex === 'M' && x.proven);
    const kid = makeCreature(mom.species, 'bred', 1, {mom: mom.id, dad: dad.id}); hatchEgg({child: kid});
    // Evolving.
    const ev = S.creatures.find(canEvolve); S.coin += 9999; S.ore += 999; S.shards += 9; evolve(ev);
    return {caught, mine, extracts: a.extracts - before.extracts, kills: a.kills - before.kills, kid: history(kid)[0].text, momKnows: history(mom)[0].text.includes(kid.name), evolved: history(ev)[0].kind};
  });
  assert.match(r.caught, /Caught on Floor 5 of the Ember Abyss/);
  assert.ok(r.mine.includes('neardeath'), 'came home at 10% HP');
  assert.equal(r.extracts, 1); assert.equal(r.kills, 4);
  assert.match(r.kid, /Hatched, the child of/);
  assert.equal(r.momKnows, true);
  assert.equal(r.evolved, 'evolved');
});

test('the history stays short in the save, keeping how the creature came to you', async () => {
  const r = await run(() => {
    const c = makeCreature('cindlet', 'bred', 1); logEvent(c, 'start');
    for (let i = 0; i < 60; i++) logEvent(c, 'boss', 'Boss ' + i);
    return {n: c.log.length, first: c.log[0][1], last: c.log[c.log.length - 1][2], max: HISTORY.max};
  });
  assert.equal(r.n, r.max); assert.equal(r.first, 'start'); assert.equal(r.last, 'Boss 59');
});

test('in a raid, the ⚙ Creatures tab opens a compact read-only page that fits without scrolling', async () => {
  const r = await run(async () => {
    S.loadout.slots = [S.creatures[0].id, S.creatures[1].id, null]; startRaid('raid', 1); await sleep(150);
    R.menuTab = 'party'; setPause(true);
    document.querySelector('[data-p="cview"]').click();
    const box = document.querySelector('#pauseBox'), mini = !!box.querySelector('.cpage-mini'), acts = box.querySelectorAll('[data-act]').length;
    const fits = box.scrollHeight <= box.clientHeight + 1, zoom = +(box.firstElementChild.style.zoom || 1);
    const painted = (() => { const cv = box.querySelector('canvas.spr'); const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })();
    document.querySelector('#pauseBox [data-p="cview"]').click(); const backToList = !box.querySelector('.cpage-mini');
    setPause(false); endQuiet();
    return {mini, acts, fits, zoom, painted, backToList};
  });
  assert.equal(r.mini, true); assert.equal(r.acts, 0, 'read-only: no hideout actions');
  assert.equal(r.fits, true); assert.ok(r.zoom >= .8, `readable at 780 × 360 (zoom ${r.zoom})`);
  assert.equal(r.painted, true, 'the sprite is drawn');
  assert.equal(r.backToList, true);
});

test('a v15 save loads as v16: every creature gets a history line and counters', async () => {
  const r = await run(() => {
    const d = JSON.parse(JSON.stringify(S)); d.v = 15; d.creatures.forEach(c => { delete c.log; delete c.kills; delete c.extracts; });
    const m = migrate(d);
    return {v: m.v, all: m.creatures.every(c => c.log.length === 1 && c.log[0][1] === 'before' && c.kills === 0 && c.extracts === 0), text: eventText(m.creatures[0].log[0])};
  });
  assert.deepEqual(r, {v: 17, all: true, text: 'Came with you from before the records began.'});
  assert.deepEqual(errors, []);
});
