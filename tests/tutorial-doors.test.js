// Walks the tutorial with the keyboard: the doors must hold until each step is done,
// and walking right at the end must reach the exit room's rift.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame, wait} from './helpers.js';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });

test('tutorial doors hold until each step is done', {timeout: 60000}, async () => {
  const {page: p, errors} = await openGame(browser, srv.url);
  await p.evaluate(() => { closeModal(); startRaid('tutorial'); });
  await wait(200);
  const st = () => p.evaluate(() => ({step: R.tut.step, x: Math.round(R.p.x), cur: R.map.rooms.indexOf(R.cur)}));
  const hold = async (key, ms) => { await p.keyboard.down(key); await wait(ms); await p.keyboard.up(key); };

  await hold('d', 800); await hold('a', 800);
  assert.equal((await st()).cur, 0, 'still in the first room after walking around');

  await p.evaluate(() => R.enemies.filter(e => e.id === 'dummy').forEach(e => hurtEnemy(e, 999, false, 'p')));
  await wait(200);
  await p.keyboard.press('Space'); await wait(300);
  await p.keyboard.press('q'); await wait(300);
  const afterAbility = await st();
  assert.ok(afterAbility.step >= 4, `step ${afterAbility.step} after dummies, roll and ability`);

  await p.evaluate(() => { R.p.y = R.map.rooms[0].cy; });
  await hold('d', 4000);
  assert.equal((await st()).cur, 1, 'walked through the open door into the catch room');

  await p.evaluate(() => { const w = R.tut.wild; w.x = R.p.x + 50; w.y = R.p.y; hurtEnemy(w, w.maxHp * .6, false, 'p'); });
  await wait(200);
  await p.evaluate(() => useCage()); await wait(200);
  await p.evaluate(() => swapSlot3(0)); await wait(200);
  assert.equal((await st()).step, 8);

  await p.evaluate(() => { R.p.y = R.map.rooms[1].cy; });
  await hold('d', 4000);
  const end = await st();
  const prompt = await p.evaluate(() => R ? R.prompt : 'raid ended');
  assert.equal(end.cur, 2, 'reached the exit room');
  assert.match(prompt, /Rift extract/);
  assert.deepEqual(errors, []);
});
