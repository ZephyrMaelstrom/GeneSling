// Seeded randomness: the same seed must rebuild the same raid, floor by floor.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await page.evaluate(() => {
    closeModal();
    // A comparable summary of a floor: room layout, kinds, modifiers, spawn plans and boss.
    window.floorSig = M => JSON.stringify({boss: M.boss || null, rooms: M.rooms.map(r => [r.gx, r.gy, r.kind, r.mod || null, r.plan || null])});
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('the generator repeats for the same seed', async () => {
  const r = await page.evaluate(() => {
    seedRng(42); const a = Array.from({length: 8}, rand);
    seedRng(42); const b = Array.from({length: 8}, rand);
    seedRng(43); const c = Array.from({length: 8}, rand);
    return {same: JSON.stringify(a) === JSON.stringify(b), differs: JSON.stringify(a) !== JSON.stringify(c), inRange: a.every(x => x >= 0 && x < 1)};
  });
  assert.deepEqual(r, {same: true, differs: true, inRange: true});
});

test('the same seed builds the same floors, whatever happens in between', async () => {
  const r = await page.evaluate(async () => {
    const out = {floors: []};
    for (let f = 1; f <= 6; f++) {
      const a = floorSig(genFloor(9001, f, false).M);
      for (let i = 0; i < 50; i++) rand();   // gameplay in between must not matter
      const b = floorSig(genFloor(9001, f, false).M);
      out.floors.push(a === b);
    }
    out.otherSeedDiffers = floorSig(genFloor(9001, 1, false).M) !== floorSig(genFloor(9002, 1, false).M);
    return out;
  });
  assert.deepEqual(r.floors, [true, true, true, true, true, true]);
  assert.equal(r.otherSeedDiffers, true);
});

test('a raid started from a seed replays its map, and descending uses the seeded floor', async () => {
  const r = await page.evaluate(async () => {
    S.settings.god = true;
    startRaid('raid', 1, 777); const first = floorSig(R.map), seed = R.seed;
    descend(2); const f2 = floorSig(R.map);
    R.enemies = []; endRaid('quit'); closeModal();
    startRaid('raid', 1, 777); const again = floorSig(R.map);
    R.enemies = []; endRaid('quit'); closeModal();
    startRaid('raid', 1); const unseeded = R.seed;
    R.enemies = []; endRaid('quit'); closeModal();
    S.settings.god = false;
    return {seed, same: first === again, f2: f2 === floorSig(genFloor(777, 2, false).M), unseeded: Number.isInteger(unseeded)};
  });
  assert.deepEqual(r, {seed: 777, same: true, f2: true, unseeded: true});
  assert.deepEqual(errors, []);
});
