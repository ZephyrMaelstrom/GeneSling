import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });

test('a new game boots to the intro with a starting roster', async () => {
  const {page, errors} = await openGame(browser, srv.url);
  const s = await page.evaluate(() => ({intro: !$('#modal').hidden, v: S.v, creatures: S.creatures.length, tab: ui.tab}));
  assert.equal(s.intro, true);
  assert.equal(s.v, 8);
  assert.ok(s.creatures > 0);
  assert.deepEqual(errors, []);
});
