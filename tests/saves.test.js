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

// Everything in the v5 save must come through. Creatures gain a genome (their v5 genes and
// traits as matching allele pairs), lineage fields, and expressed genes under the new names.
const NEW_NAMES = {vig: 'vig', pow: 'pow', swf: 'swf', hst: 'tem', tmp: 'foc'};
const stripCreature = c => { const {genome, genes, traits, looks, mom, dad, pure, bred, fat, ...rest} = c; return rest; };
// Phase 2 turned weapon counts (guns) into items and added the economy fields; those are checked separately.
const P2 = ['mats', 'items', 'nextUid', 'prints', 'mastery', 'pens', 'expeditions', 'prod', 'keeperName', 'guns', 'loadout', 'market', 'marketSync', 'marketSeed'];
const strip = s => ({...Object.fromEntries(Object.entries(s).filter(([k]) => !P2.includes(k))), v: 0, tree: undefined, settings: {...s.settings, genes: undefined},
  creatures: s.creatures.map(stripCreature), eggs: s.eggs.map(e => ({...e, child: stripCreature(e.child)}))});
function assertSameSave(loaded, v5) {
  assert.equal(loaded.v, 9);
  assert.deepEqual(strip(loaded), strip(v5));
  // Every weapon the v5 save owned is now an item, and the loadout points at the same weapons.
  for (const [id, n] of Object.entries(v5.guns)) if (id !== 'pistol') assert.equal(loaded.items.filter(i => i.id === id).length, n, `${n} × ${id}`);
  assert.deepEqual(loaded.loadout.slots, v5.loadout.slots);
  assert.deepEqual(loaded.loadout.guns.map(uid => uid && loaded.items.find(i => i.uid === uid).id), v5.loadout.guns.map(g => g === 'pistol' ? null : g));
  assert.ok(loaded.creatures.length <= 16 + 4 * loaded.pens, 'pens were built so the roster fits');
  for (const [i, old] of v5.creatures.entries()) {
    const c = loaded.creatures[i];
    assert.deepEqual(c.traits, old.traits, `${old.name} keeps its traits`);
    for (const [k, n] of Object.entries(NEW_NAMES)) {
      assert.equal(c.genes[n], old.genes[k], `${old.name} keeps ${k} as ${n}`);
      assert.deepEqual(c.genome[n], [old.genes[k], old.genes[k]]);
    }
    assert.deepEqual(c.looks, {hue: 0, pat: 0, size: 1, shine: 0});
  }
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
  assert.equal(stored.rec.v, 9);
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
    return {v5: tryM({v: 5, opts: {}}), v6: tryM({v: 6}), v7: tryM({v: 7}), v8: tryM({v: 8}), v9: tryM({v: 9}), v4: tryM({v: 4}), v99: tryM({v: 99}), junk: tryM('x'), version: SAVE_VERSION};
  });
  assert.deepEqual(r, {v5: 9, v6: 9, v7: 9, v8: 9, v9: 9, v4: 'error', v99: 'error', junk: 'error', version: 9});
  await context.close();
});
