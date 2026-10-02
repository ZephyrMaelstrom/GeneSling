// Doors in every zone: rooms lock when a fight starts and open when it's won, a room sealed for good (the
// gauntlet's way back, a sinkhole's collapse) never cuts the Keeper off from an exit or an unexplored room,
// and an enemy outside its room is put back so the doors can always open. Hidden rooms stay invisible
// until their own cracked wall is broken; then the hallway appears as plain floor.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
const run = (fn, ...a) => page.evaluate(fn, ...a);
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await run(() => {
    closeModal(); labEndgame(); S.settings.god = true; S.settings.noTimer = true;
    window.endQuiet = () => { if (R) { R.enemies = []; endRaid('quit'); closeModal(); } };
    const EXIT = ['stairs', 'gate', 'rift', 'cliff', 'boss', 'portal'];
    const tick = n => { for (let i = 0; i < n; i++) { if (!R || R.over) return; R.paused = false; update(0.05); } };
    // Walks a floor room by room the way a player might: into side branches and dead ends first, clearing
    // every fight, letting time pass so sinkholes fall in, and checking the doors and the way out each step.
    window.walkFloor = (floor, vein, seed, opts) => {
      startRaid('raid', floor, seed, vein, opts || {}); const M = R.map, out = {layout: M.plan.layout, vein: M.plan.vein, rooms: M.rooms.length, problems: [], sealed: 0, steps: 0};
      const reachable = () => openFrom(R.cur);
      for (let step = 0; step < 40; step++) {
        const reach = reachable();
        const next = [...reach].filter(r => !r.visited && !r.hidden && r.kind !== 'boss').sort((a, b) => a.links.length - b.links.length)[0];
        if (!next) break;
        R.p.x = next.cx; R.p.y = next.cy + 30; tick(3); out.steps++;
        if (R.cur !== next) { out.problems.push(`could not stand in room ${next.idx}`); break; }
        // Win the fight: every enemy of this room falls.
        // Win the fight: keep at it until nothing of this room is left standing (some foes split when they fall).
        for (let k = 0; k < 6 && R.enemies.some(e => e.room === next && e.hp > 0); k++) { for (const e of R.enemies) if (e.room === next && e.kind !== 'boss') e.hp = 0; tick(2); }
        tick(2);
        if (next.locked && !next.sealed) out.problems.push(`room ${next.idx} (${next.kind}) stayed locked after its fight: ${R.enemies.filter(e => e.room === next).map(e => (e.def ? e.def.name : e.kind) + ':' + Math.round(e.hp)).join(', ') || 'no enemies'}`);
        // Time passes: rooms behind may fall in (sinkhole) or seal (gauntlet).
        for (const r of M.rooms) if (r !== next && r.visited) r.left = (r.left || 0) + 40;
        tick(2);
        const now = reachable();
        if (!M.rooms.some(r => EXIT.includes(r.kind) && now.has(r))) out.problems.push(`no exit reachable from room ${next.idx} on step ${step}`);
        for (const r of M.rooms) if (!r.visited && !r.hidden && r.kind !== 'secret' && !r.sealed && !now.has(r)) out.problems.push(`unexplored room ${r.idx} cut off`);
        for (const r of M.rooms) if (r.locked && !r.sealed && r !== R.cur && !R.enemies.some(e => e.room === r && e.hp > 0)) out.problems.push(`room ${r.idx} locked with nobody inside`);
      }
      out.sealed = M.rooms.filter(r => r.sealed).length;
      endQuiet();
      return out;
    };
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('every zone and layout: doors open after each fight, and sealing never cuts off the way out', async () => {
  const r = await run(() => {
    const zones = [['rootworks', 2, null], ['ember', 5, 'ember'], ['drowned', 5, 'drowned'], ['choir', 5, 'choir'], ['spires', 5, 'spires'], ['sump', 5, 'sump'], ['underheart', 8, 'underheart']];
    const res = {}, problems = [];
    for (const [name, f, vein] of zones) {
      const seen = {};
      for (let s = 1; s <= 120 && Object.keys(seen).length < 8; s++) {
        const lay = floorPlan(s, f, vein || 'rootworks').layout; if (seen[lay]) continue;
        const w = walkFloor(f, vein, s); seen[lay] = w.sealed;
        w.problems.forEach(p => problems.push(`${name} ${lay} seed ${s}: ${p}`));
      }
      res[name] = seen;
    }
    // The Unbound Bloom and the Heart.
    story().heart = true; story().ending = 'wake';
    for (let s = 1; s <= 12; s++) { const w = walkFloor(7, 'unbound', s, {tier: 3}); w.problems.forEach(p => problems.push(`unbound seed ${s}: ${p}`)); }
    story().ilsa = true; const h = walkFloor(10, 'heart', 5); h.problems.forEach(p => problems.push(`heart: ${p}`));
    return {res, problems};
  });
  console.log(JSON.stringify(r.res));
  assert.deepEqual(r.problems, []);
  for (const z of ['ember', 'spires', 'sump']) assert.ok('sinkhole' in r.res[z] && 'gauntlet' in r.res[z], `${z} was walked with a sinkhole and a gauntlet`);
  assert.ok(Object.values(r.res).some(z => z.sinkhole > 0), 'sinkholes still fall in where it is safe');
});

test('an enemy pushed out of its room is put back, so the doors can open', async () => {
  const r = await run(async () => {
    startRaid('raid', 5, 21, 'sump'); const rm = R.map.rooms.find(x => x.kind === 'fight');
    R.p.x = rm.cx; R.p.y = rm.cy + 30; for (let i = 0; i < 3; i++) update(0.05);
    const e = R.enemies.find(x => x.room === rm); e.x = (rm.ox + RW + 2) * TS; e.y = rm.cy;   // out in the hallway
    for (let i = 0; i < 40; i++) { R.paused = false; update(0.05); }
    const back = e.x > rm.ox * TS && e.x < (rm.ox + RW) * TS;
    for (const x of R.enemies) if (x.room === rm) x.hp = 0;
    for (let i = 0; i < 4; i++) update(0.05);
    const open = !rm.locked; endQuiet();
    return {back, open};
  });
  assert.equal(r.back, true);
  assert.equal(r.open, true);
});

test('a hidden room is invisible until its own wall is broken, then the hallway is plain floor', async () => {
  const r = await run(async () => {
    let M = null;
    for (let s = 1; s < 200 && !M; s++) { startRaid('raid', 2, s); if (R.map.rooms.some(x => x.kind === 'secret')) M = R.map; else endQuiet(); }
    const sec = M.rooms.find(x => x.kind === 'secret'), crack = [...M.cracks.values()].find(c => c.room === sec);
    const g = R.mapCv.getContext('2d'), px = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3).join(',');
    const VOID = '13,10,28';
    // A hallway tile: in the hidden area, not in the room itself.
    const hall = [...crack.area].find(t => { const x = t % M.W, y = Math.floor(t / M.W); return !(x >= sec.ox && x < sec.ox + RW && y >= sec.oy && y < sec.oy + RH); });
    const hx = (hall % M.W) * TS + TS / 2, hy = Math.floor(hall / M.W) * TS + TS / 2;
    const ct = crack.tiles[1], wallPx = px((ct % M.W + .5) * TS, (Math.floor(ct / M.W) + .5) * TS);
    const before = {room: px(sec.cx, sec.cy), hall: px(hx, hy), wall: wallPx, crackHidden: crack.tiles.some(t => M.hidden.has(t)), hiddenFlag: sec.hidden, onMap: M.hidden.has(sec.oy * M.W + sec.ox + 3)};
    // A light blow cracks the wall but reveals nothing.
    damageCrack(crack.tiles[0], 5); const after1 = {room: px(sec.cx, sec.cy), hidden: sec.hidden};
    damageCrack(crack.tiles[0], 99999);
    const after2 = {room: px(sec.cx, sec.cy), hall: px(hx, hy), hidden: sec.hidden, walk: M.tiles[crack.tiles[0]] === 1, left: M.hidden.size};
    endQuiet();
    return {VOID, before, after1, after2};
  });
  assert.equal(r.before.room, r.VOID, 'the secret room is not painted');
  assert.equal(r.before.hall, r.VOID, 'nor is its hallway');
  assert.equal(r.before.hiddenFlag, true); assert.equal(r.before.onMap, true);
  assert.notEqual(r.before.wall, r.VOID, 'the hidden door is drawn, as a wall'); assert.equal(r.before.crackHidden, false);
  assert.equal(r.after1.room, r.VOID); assert.equal(r.after1.hidden, true);
  assert.notEqual(r.after2.room, r.VOID, 'once broken, the room appears');
  assert.notEqual(r.after2.hall, r.VOID, 'and the hallway, as floor');
  assert.equal(r.after2.hidden, false); assert.equal(r.after2.walk, true);
  assert.deepEqual(errors, []);
});
