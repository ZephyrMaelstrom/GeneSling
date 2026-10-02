// Saves: a real v5 save (written by the archived v5 build) must load into this build without
// loss, move into IndexedDB, and survive a reload. Unreadable saves are backed up, never dropped.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {startServer, launch, openGame} from './helpers.js';

const V5 = readFileSync(new URL('./fixtures/v5-save.json', import.meta.url), 'utf8');
const plantV5 = page => page.evaluateOnNewDocument(raw => {
  if (!localStorage.getItem('genesling-save-v5')) localStorage.setItem('genesling-save-v5', raw);
}, JSON.stringify(JSON.parse(V5)));

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });

// Everything in the v5 save must come through unchanged, apart from the version number.
function assertSameSave(loaded, v5) {
  assert.equal(loaded.v, 6);
  assert.deepEqual({...loaded, v: 5}, v5);
}

test('a v5 save loads without loss and moves into IndexedDB', async () => {
  const v5 = JSON.parse(V5);
  const {context, page, errors} = await openGame(browser, srv.url, {before: plantV5});
  assertSameSave(await page.evaluate(() => JSON.parse(JSON.stringify(S))), v5);
  const ui = await page.evaluate(() => ({intro: !$('#modal').hidden, roster: S.creatures.length}));
  assert.equal(ui.intro, false, 'a loaded save skips the intro');
  assert.equal(ui.roster, v5.creatures.length);

  // The save is now in IndexedDB; the v5 copy stays in localStorage untouched as a backup.
  const stored = await page.evaluate(async () => {
    await saveDone();
    const db = await new Promise((res, rej) => { const q = indexedDB.open('genesling'); q.onsuccess = () => res(q.result); q.onerror = rej; });
    const rec = await new Promise(res => { const q = db.transaction('saves').objectStore('saves').get('main'); q.onsuccess = () => res(q.result); });
    db.close();
    return {rec, legacy: localStorage.getItem('genesling-save-v5')};
  });
  assert.equal(stored.rec.v, 6);
  assertSameSave(JSON.parse(stored.rec.data), v5);
  assert.deepEqual(JSON.parse(stored.legacy), v5);

  // Reload: the game now reads IndexedDB, and the migrated save still plays.
  await page.evaluate(() => { S.coin += 1; save(); return saveDone(); });
  await page.reload(); await page.evaluate(() => window.gameReady);
  const coin = await page.evaluate(() => S.coin);
  assert.equal(coin, v5.coin + 1, 'progress made after migrating is kept across a reload');
  await page.evaluate(async () => {
    S.settings.god = true; startRaid('raid', 1); await new Promise(r => setTimeout(r, 300));
    R.enemies = []; endRaid('quit'); closeModal();
  });
  assert.deepEqual(errors, []);
  await context.close();
});

test('a save from a newer build is backed up, not overwritten', async () => {
  const {context, page, errors} = await openGame(browser, srv.url);
  const future = {v: 99, saved: 1, data: JSON.stringify({v: 99, coin: 12345})};
  await page.evaluate(async rec => {
    await saveDone();
    const db = await new Promise(res => { const q = indexedDB.open('genesling'); q.onsuccess = () => res(q.result); });
    await new Promise(res => { const tx = db.transaction('saves', 'readwrite'); tx.objectStore('saves').put(rec, 'main'); tx.oncomplete = res; });
    db.close();
  }, future);
  await page.reload(); await page.evaluate(() => window.gameReady);
  const out = await page.evaluate(async () => {
    await saveDone();
    const db = await new Promise(res => { const q = indexedDB.open('genesling'); q.onsuccess = () => res(q.result); });
    const all = await new Promise(res => {
      const st = db.transaction('saves').objectStore('saves'), keys = st.getAllKeys(), vals = st.getAll();
      vals.onsuccess = () => res(keys.result.map((k, i) => [k, vals.result[i]]));
    });
    db.close();
    return {all, coin: S.coin};
  });
  const backup = out.all.find(([k]) => k.startsWith('backup-'));
  assert.ok(backup, 'the unreadable save was copied to a backup key');
  assert.deepEqual(backup[1], future);
  assert.notEqual(out.coin, 12345, 'the game started fresh instead');
  assert.deepEqual(errors, []);
  await context.close();
});

test('migrations run in order and refuse what they cannot read', async () => {
  const {context, page} = await openGame(browser, srv.url);
  const r = await page.evaluate(() => {
    const tryM = d => { try { return migrate(d).v; } catch (e) { return 'error'; } };
    return {v5: tryM({v: 5, opts: {}}), v6: tryM({v: 6}), v4: tryM({v: 4}), v99: tryM({v: 99}), junk: tryM('x'), version: SAVE_VERSION};
  });
  assert.deepEqual(r, {v5: 6, v6: 6, v4: 'error', v99: 'error', junk: 'error', version: 6});
  await context.close();
});
