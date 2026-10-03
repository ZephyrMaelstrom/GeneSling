// Phase 7, lore: the fragment counts, Ilsa's journal (pages by rank and pages carried out of the Bloom),
// rune walls copied in raids, the Keepers' Rest, whispers, murals, codex entries for every form, the six
// residents' arcs, Odile's slow translation, the secret hybrid, the v13 save, and the exit test's first
// half: the fragments tell the four acts' story in order. (The cipher half is tests/cipher.test.js.)
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
const run = (fn, ...a) => page.evaluate(fn, ...a);
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await run(() => {
    closeModal(); S.settings.god = true;
    window.sleep = ms => new Promise(r => setTimeout(r, ms));
    window.endQuiet = how => { if (R) { R.enemies = []; endRaid(how || 'quit'); closeModal(); } };
    window.fresh = () => { newGame(); S.introSeen = true; S.settings.god = true; };
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('about 150 fragments: 30 pages, 40 relics, 20+ memories, 15 whispers, 8 murals, a codex entry per form, 6 arcs', async () => {
  const r = await run(() => ({pages: journal().length, relics: ENDGAME.RELICS.length, memories: BOSS_IDS.filter(b => BOSSES[b].lore).length,
    whispers: LORE.WHISPERS.length, murals: LORE.MURALS.length, stages: LORE.MURALS.every(m => m.stages.length === 4), walls: LORE.WALLS.length,
    forms: Object.entries(LINES).every(([sp, l]) => l.every((f, i) => formLore(sp, i).length > 20) && LORE.CODEX[sp].length === l.length),
    residents: NPC_IDS.length, arcs: NPC_IDS.map(id => NPCS[id].quests.length), letters: new Set(ENDGAME.RELICS.map(x => x.letters).join('')).size}));
  assert.equal(r.pages, 30); assert.equal(r.relics, 40); assert.ok(r.memories >= 20); assert.equal(r.whispers, 15);
  assert.equal(r.murals, 8); assert.equal(r.stages, true); assert.equal(r.walls, 16); assert.equal(r.forms, true);
  assert.equal(r.residents, 6); assert.ok(r.arcs.every(n => n >= 5), `quest chains ${r.arcs}`);
  assert.equal(r.letters, 26, 'the relics teach the whole alphabet');
});

test('exit test: the fragments tell the story in order, one act at a time', async () => {
  const r = await run(() => {
    fresh(); const out = [];
    // Walk a Keeper through the acts: rank up, then reach the veins, the Underheart, and free Ilsa.
    const steps = [[10, 3, false], [20, 6, false], [30, 9, false], [45, 9, true]];
    for (const [rank, deep, ilsa] of steps) {
      S.keeper.level = rank; S.progress.deepest = deep; story().ilsa = ilsa;
      const a = currentAct();
      // Every fragment that could be found now: rank pages, plus anything placed on any floor this act reaches.
      const open = journal().filter(p => p.found).map(p => p.act);
      const placeable = [...LORE.PAGES, ...LORE.WALLS].filter(x => x.act <= a).map(x => x.act);
      out.push({a, maxFound: Math.max(...open), maxPlace: Math.max(...placeable), pages: open.length});
    }
    const order = journal().map(p => p.act);
    return {out, ordered: order.every((x, i) => i === 0 || x >= order[i - 1]), questions: LORE.ACTS.map(x => x.question),
      perAct: LORE.ACTS.map(A => journal().filter(p => p.act === A.n).length + LORE.WALLS.filter(w => w.act === A.n).length + LORE.WHISPERS.filter(w => w.act === A.n).length)};
  });
  assert.deepEqual(r.out.map(x => x.a), [1, 2, 3, 4], 'each act opens in turn');
  for (const x of r.out) { assert.ok(x.maxFound <= x.a, `act ${x.a}: nothing from a later act is readable`); assert.ok(x.maxPlace <= x.a); }
  assert.ok(r.out[0].pages < r.out[1].pages && r.out[1].pages < r.out[2].pages, 'each act reveals more of the journal');
  assert.equal(r.ordered, true, 'the journal in page order runs Act I, II, III, IV');
  assert.deepEqual(r.questions, ['What happened to Ilsa?', 'Who were the Old Keepers?', 'What is the Bloom?', 'What will you do with it?']);
  assert.ok(r.perAct.every(n => n >= 5), `fragments per act: ${r.perAct}`);
});

test('a journal page found in a raid is kept only if you extract, and a rune wall is copied on sight', async () => {
  const r = await run(async () => {
    fresh(); startRaid('raid', 1); await sleep(150);
    const pr = R.map.rooms.find(x => x.page), wr = R.map.rooms.find(x => x.rune);
    const page = pr.page.id; R.cur = pr; R.p.x = pr.page.x; R.p.y = pr.page.y; lorePick();
    enterRoom(wr); const wall = loreState().walls.slice();
    endQuiet('dead'); const lost = loreState().pages.includes(page);
    startRaid('raid', 1); await sleep(150);
    const again = R.map.rooms.find(x => x.page)?.page.id;
    const pr2 = R.map.rooms.find(x => x.page); R.cur = pr2; R.p.x = pr2.page.x; R.p.y = pr2.page.y; lorePick();
    R.enemies = []; endRaid('extract'); const note = document.getElementById('modalBox').innerText; closeModal();
    return {page, wall, lost, again, kept: loreState().pages.includes(page), note: /page of Ilsa/.test(note), shown: journal().find(p => p.id === page).found};
  });
  assert.equal(r.page, 'clover'); assert.deepEqual(r.wall, ['dies']);
  assert.equal(r.lost, false, 'a page lost with you is not kept');
  assert.equal(r.again, 'clover', 'it turns up again');
  assert.equal(r.kept, true); assert.equal(r.note, true); assert.equal(r.shown, true);
});

test('Act II pages and walls wait in the veins; nothing later turns up early', async () => {
  const r = await run(async () => {
    fresh(); S.progress.deepest = 3; startRaid('raid', 4, null, 'ember'); await sleep(150);
    const early = R.map.rooms.filter(x => x.page || x.rune).length; endQuiet();
    S.progress.deepest = 4; startRaid('raid', 4, null, 'ember'); await sleep(150);
    const got = R.map.rooms.filter(x => x.page || x.rune).map(x => x.page ? x.page.id : x.rune); endQuiet();
    return {early, got: got.sort()};
  });
  assert.equal(r.early, 0, 'before Act II opens, the veins hold no Act II fragments');
  assert.deepEqual(r.got, ['ledger', 'withering']);
});

test('the Keepers’ Rest beside the Heart, and the last page after the ending', async () => {
  const r = await run(async () => {
    labEndgame(); story().ilsa = true; startRaid('raid', 10, null, 'heart'); await sleep(150);
    const rest = R.map.rooms.find(x => x.rest); const hidden = rest.hidden; openChest(rest);
    const carried = R.lorePages.slice(), relics = R.relics, wall = R.map.rooms.find(x => x.rune)?.rune;
    endQuiet('extract'); const kept = loreState().pages.includes('rest');
    const before = loreState().pages.includes('after'); startRaid('raid', 10, null, 'heart'); await sleep(100); pickEnding('sing'); endQuiet('extract');
    return {hidden, carried, relics, wall, kept, before, after: loreState().pages.includes('after')};
  });
  assert.equal(r.hidden, true, 'the room is hidden until its wall is struck');
  assert.deepEqual(r.carried, ['rest']); assert.ok(r.relics >= 2); assert.equal(r.wall, 'choice'); assert.equal(r.kept, true);
  assert.equal(r.before, false); assert.equal(r.after, true);
});

test('whispers come once each, only in their act, and never touch the seeded raid', async () => {
  const r = await run(async () => {
    fresh(); const heard = [];
    for (let i = 0; i < 20; i++) { const w = whisper(); if (w) heard.push(w.id); }
    const act1 = heard.every(id => LORE.WHISPERS.find(w => w.id === id).act === 1);
    // The same seed builds the same floor whether or not a whisper rolls.
    LORE.WHISPER.chance = 1; startRaid('raid', 1, 4242); await sleep(80); const a = JSON.stringify(R.map.rooms.map(x => [x.kind, x.gx, x.gy])); endQuiet();
    LORE.WHISPER.chance = 0; startRaid('raid', 1, 4242); await sleep(80); const b = JSON.stringify(R.map.rooms.map(x => [x.kind, x.gx, x.gy])); endQuiet();
    LORE.WHISPER.chance = 0.005;
    return {heard, unique: new Set(heard).size === heard.length, act1, same: a === b};
  });
  assert.ok(r.heard.length >= 3 && r.heard.length <= 4, `heard ${r.heard}`);
  assert.equal(r.unique, true); assert.equal(r.act1, true); assert.equal(r.same, true);
});

test('murals change with the act, and the codex rewrites each form', async () => {
  const r = await run(async () => {
    fresh(); const m1 = murals()[0].text; S.progress.deepest = 7; const m3 = murals()[0].text;
    ui.tab = 'codex'; ui.codex = 'murals'; renderAll(); const cvs = document.querySelectorAll('canvas[data-mural]').length;
    ui.codex = 'creatures'; ui.dexType = 'ember'; S.dex.forms['cindlet:3'] = {seen: true}; renderAll();
    const lore = [...document.querySelectorAll('.dexform small.lore')].map(x => x.textContent);
    ui.codex = 'story'; renderAll(); const story = document.getElementById('main').innerText;
    return {m1, m3, cvs, lore, story: /What is the Bloom\?/.test(story)};
  });
  assert.notEqual(r.m1, r.m3); assert.equal(r.cvs, 8);
  assert.ok(r.lore.some(t => /Infernox/.test(t)), 'the final form tells its Bloom history');
  assert.equal(r.story, true);
});

test('three new residents arrive with depth, and arcs use story progress', async () => {
  const r = await run(async () => {
    fresh(); const at = d => { S.progress.deepest = d; syncNpcs(); return ['odile', 'hesper', 'rowan'].filter(id => S.npc[id]); };
    const a3 = at(3), a4 = at(4), a5 = at(5), a7 = at(7);
    S.npc.odile.met = true; loreState().walls = ['asleep', 'dies']; const q = npcQuest('odile');
    const got = npcTurnIn('odile');
    // Brannoc's story picks up after his v5 quests.
    S.npc.brannoc.q = 4; S.npc.brannoc.base = 0; S.progress.deepest = 5; const b = npcQuest('brannoc');
    openNpc('rowan'); const modal = document.getElementById('modalBox').innerText; closeModal();
    return {a3, a4, a5, a7, done: q.done, got: !!got, next: npcQuest('odile').q.stat, b: b.done && /grandfather|Wyrm/.test(b.q.done), modal: /War Room/.test(modal)};
  });
  assert.deepEqual(r.a3, []); assert.deepEqual(r.a4, ['odile']); assert.deepEqual(r.a5, ['odile', 'hesper']); assert.deepEqual(r.a7, ['odile', 'hesper', 'rowan']);
  assert.equal(r.done, true); assert.equal(r.got, true); assert.equal(r.next, 'relics'); assert.equal(r.b, true); assert.equal(r.modal, true);
});

test('Odile reads a relic every third day without a Lumen, and walls read as letters are learned', async () => {
  const r = await run(() => {
    fresh(); S.progress.deepest = 4; syncNpcs(); S.archive.unread = 5; S.archive.read = 0;
    const read = []; for (let i = 0; i < 6; i++) { processDay(); read.push(S.archive.read); }
    loreState().walls = ['asleep']; ui.tab = 'research'; renderAll();
    return {read, wall: runeWall('KEEP IT ASLEEP'), panel: document.querySelector('.cipher') !== null, renown: renown().collection > 0};
  });
  assert.equal(r.read[r.read.length - 1], 2, `read over six days: ${r.read}`);
  assert.equal(r.wall, 'KEEP IT ASLEEP', 'the first two relics read the first wall');
  assert.equal(r.panel, true); assert.equal(r.renown, true);
});

test('the secret hybrid is off the breeding list until its wall is copied', async () => {
  const r = await run(() => {
    fresh(); ui.tab = 'breeding'; renderAll(); const before = document.getElementById('main').innerText.includes('Eclipsar');
    loreState().walls.push('eclipse'); renderAll(); const after = document.getElementById('main').innerText.includes('Eclipsar');
    return {before, after};
  });
  assert.equal(r.before, false); assert.equal(r.after, true);
});

test('a v12 save loads with empty lore', async () => {
  const r = await run(() => { const d = migrate({...JSON.parse(JSON.stringify(S)), v: 12, lore: undefined}); return {v: d.v, lore: d.lore}; });
  assert.deepEqual(r, {v: 17, lore: {pages: [], walls: [], whispers: []}});
  assert.deepEqual(errors, []);
});
