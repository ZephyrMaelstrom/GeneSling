// Phase 8, balance and playtest: the Journey Simulator's exit test (bot players reach Act IV between days
// 55 and 65 and the top Unbound tiers around day 90), the act gates and catch-up in the real game, the
// Keeper rank curve and boss XP, the Unbound tier rank gate, accessibility options, the render scale,
// the playtest pace record and the v14 save.
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
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('exit test: simulated dedicated players reach Act IV between days 55 and 65, and the top tiers around day 90', async () => {
  const r = await run(() => {
    const before = JSON.stringify(S), runs = runJourneys(), rep = journeyReport(runs);
    return {rep, styles: [...new Set(runs.map(x => x.style))], untouched: JSON.stringify(S) === before,
      again: JSON.stringify(journeyOf('breeder', 2).acts) === JSON.stringify(runs.find(x => x.style === 'breeder' && x.seed === 2).acts)};
  });
  console.log(r.rep.checks.map(c => `${c.ok ? 'ok ' : 'FAIL '}${c.name}: ${c.got}`).join('\n'));
  assert.deepEqual(r.styles, ['raider', 'crafter', 'breeder', 'casual']);
  for (const c of r.rep.checks) assert.ok(c.ok, `${c.name}: ${c.got}, want ${c.want}`);
  assert.equal(r.untouched, true, 'the real save is untouched');
  assert.equal(r.again, true, 'the same seed plays the same journey');
});

test('a simulation never writes the save', async () => {
  const r = await run(() => ({held: holdSaves(() => save()) === undefined, normal: save() instanceof Promise}));
  assert.deepEqual(r, {held: true, normal: true});
});

test('the act gates hold the portals until rank, stations and creatures are ready', async () => {
  const r = await run(async () => {
    newGame(); S.introSeen = true; S.tutorialDone = true; S.settings.god = true;
    const v0 = gateOpen('veins'), needs = gateNeeds('veins').map(x => x.text);
    startRaid('raid', 3); await sleep(150);
    const br = R.map.rooms.find(x => x.kind === 'boss'); R.cur = br; br.kind = 'portal'; br.deep = true;
    R.p.x = br.cx + 80; R.p.y = br.cy; R.stairT = 1.19; await sleep(200);
    const blocked = !R.paused && /won't open yet/.test(R.msg), paceGate = S.telemetry.pace.gates.veins.blocked != null;
    endQuiet();
    S.keeper.level = 10; for (const k of ['forge', 'garden', 'spring']) { S.sections[k].ids = []; S.buildings[k] = 2; for (let i = 0; i < 4; i++) { const c = makeCreature(BASE_SPECIES.find(sp => SPECIES[sp].type === SECTIONS[k].type), 'bred', 20); S.creatures.push(c); S.sections[k].ids.push(c.id); } }
    const v1 = gateOpen('veins');
    const uh = gateNeeds('underheart').map(x => x.ok), heart = gateBlockText('heart');
    labEndgame(); const after = ['veins', 'underheart', 'heart'].map(k => gateOpen(k));
    return {v0, needs, blocked, paceGate, v1, uh, heart, after};
  });
  assert.equal(r.v0, false);
  assert.ok(r.needs.some(t => /Keeper rank 10/.test(t)) && r.needs.some(t => /3 stations at level 2 with 2 workers/.test(t)));
  assert.equal(r.blocked, true, 'Floor 3’s portal explains what is missing instead of opening');
  assert.equal(r.paceGate, true, 'the wait is recorded for the playtest');
  assert.equal(r.v1, true);
  assert.ok(r.uh.includes(false));
  assert.match(r.heart, /Keeper rank 40/);
  assert.deepEqual(r.after, [true, true, true], 'the Test Lab endgame save is past every gate');
});

test('Keeper rank curve, catch-up and boss XP follow balance.json', async () => {
  const r = await run(() => {
    newGame(); const K = BALANCE.KEEPER_CURVE;
    const need = [1, 10, 40].map(L => keeperNeed(L)), want = [1, 10, 40].map(L => Math.round(K.base * Math.pow(L, K.exp)));
    S.startedAt = Date.now() - 59.5 * 864e5; S.keeper.level = 10; const behind = catchupMul();
    S.keeper.level = 30; const near = catchupMul();
    return {need, want, behind, near, expected60: expectedRank(60), rep: BALANCE.BOSS_XP.repeat};
  });
  assert.deepEqual(r.need, r.want);
  assert.equal(r.behind, 2, 'far behind the expected rank: double Keeper XP');
  assert.equal(r.near, 1);
  assert.equal(r.expected60, 25);
  assert.ok(r.rep > 0 && r.rep < 1);
});

test('each Unbound tier needs Keeper rank too', async () => {
  const r = await run(() => {
    labEndgame(); story().heart = true; story().ending = 'wake'; S.unbound.cleared = 19;
    S.keeper.level = 45; const low = nextTier(); S.keeper.level = 50; const high = nextTier();
    return {low, high, need20: tierRank(20)};
  });
  assert.equal(r.need20, 46);
  assert.equal(r.low, 19, 'tier 20 waits for the rank');
  assert.equal(r.high, 20);
});

test('colorblind palettes, aim assist, slower bullets and the render scale', async () => {
  const r = await run(async () => {
    const ember = TYPES.ember.color;
    OPTS.palette = 'deutan'; applyPalette();
    const recolored = TYPES.ember.color !== ember && document.documentElement.dataset.palette === 'deutan' && getComputedStyle(document.documentElement).getPropertyValue('--rose').trim() === BALANCE.ACCESS.palettes.deutan.bad;
    const bullet = bulletCol({team: 'e', col: '#ff5c7a'});
    OPTS.palette = 'normal'; applyPalette(); const back = TYPES.ember.color === ember;
    S.settings.god = true; startRaid('raid', 1); await sleep(150);
    const b1 = shoot('e', R.p.x, R.p.y, 0, 100, 1); OPTS.slowBullets = true; const b2 = shoot('e', R.p.x, R.p.y, 0, 100, 1); OPTS.slowBullets = false;
    const e = {x: R.p.x + 200, y: R.p.y + 40, hp: 10}; OPTS.aimAssist = true; const bent = assistAim(0, R.p, [e]); OPTS.aimAssist = false; const straight = assistAim(0, R.p, [e]);
    OPTS.quality = 'auto'; resetScale(); const s0 = renderScale(); for (let i = 0; i < 80; i++) frameTime(40); const s1 = renderScale();
    OPTS.quality = 'low'; const low = renderScale(); OPTS.quality = 'auto';
    endQuiet();
    return {recolored, bullet, back, slow: Math.hypot(b2.vx, b2.vy) / Math.hypot(b1.vx, b1.vy), bent, straight, s0, s1, low, dpr: devicePixelRatio};
  });
  assert.equal(r.recolored, true); assert.equal(r.bullet, '#e69f00'); assert.equal(r.back, true);
  assert.ok(Math.abs(r.slow - 0.75) < 1e-9, 'slower enemy bullets move at 75%');
  assert.ok(r.bent > 0.1 && r.straight === 0, 'aim assist bends toward the enemy');
  assert.ok(r.s1 <= r.s0, 'slow frames lower the render scale');
  assert.equal(r.low, 1);
});

test('the playtest pace notes when each act opened', async () => {
  const r = await run(() => {
    newGame(); S.startedAt = Date.now() - 4.5 * 864e5; S.progress.deepest = 4; paceTick();
    return {acts: S.telemetry.pace.acts, rep: paceReport()};
  });
  assert.equal(r.acts[2], 5);
  assert.equal(r.rep.act2Ok, true);
});

test('a v13 save loads as v14 with a start date', async () => {
  const r = await run(() => { const d = migrate({...JSON.parse(JSON.stringify(S)), v: 13, startedAt: undefined}); return {v: d.v, started: typeof d.startedAt}; });
  assert.deepEqual(r, {v: 17, started: 'number'});
  assert.deepEqual(errors, []);
});
