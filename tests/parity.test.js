// Parity with v5: the content tables moved to src/data/*.json must match the archived v5
// build exactly, and creature stats must compute the same way.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

const TABLES = ['TYPES', 'TIER', 'SPECIES', 'HYBRIDS', 'LINES', 'ATTACKS', 'ABILITIES', 'TYPE_ABIL', 'ELEM', 'REACTIONS', 'COMBOS',
  'PERS', 'BOND_TH', 'BOND_PASSIVE', 'BOND_PERKS', 'GENES', 'GENE_HINT', 'TRAITS', 'NEG_TRAITS', 'GUNS', 'WEAPON_COST',
  'SCRAP_ORE', 'DONATE_PTS', 'BUFFS', 'CURSES', 'ROOM_MODS', 'MODES', 'SEC_TH', 'SECTIONS', 'ARMORY_TH', 'ARMORY_TIERS',
  'KEEPER_PERKS', 'RESEARCH', 'RES_COST', 'FOES', 'WILD_FIRE', 'BOSSES', 'LORE_INTRO', 'JOURNAL', 'NPCS', 'SYL', 'END'];

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });

// Reads every table, and the stats of one fixed creature per species, from a page.
const snapshot = page => page.evaluate(tables => {
  const out = {};
  // NPC arrival rules were functions in v5 and are data now; compare the rest of each NPC.
  for (const t of tables) out[t] = JSON.parse(JSON.stringify(eval(t), (k, v) => k === 'arrive' ? undefined : v));
  const genes = {vig: 7, pow: 6, swf: 5, hst: 8, tmp: 4};
  out.stats = Object.keys(SPECIES).map(sp => stats(makeCreature(sp, 'bred', 12, {genes, traits: ['keen'], pers: 'brave', sex: 'F', name: 'X'})));
  return out;
}, TABLES);

test('content and stats match the v5 build', async () => {
  const v5 = await openGame(browser, srv.url, {page: '/prototype/archive/genesling-v5.html'});
  const now = await openGame(browser, srv.url);
  const [a, b] = [await snapshot(v5.page), await snapshot(now.page)];
  for (const t of [...TABLES, 'stats']) assert.deepEqual(b[t], a[t], `${t} differs from v5`);
  assert.deepEqual(v5.errors, []);
  assert.deepEqual(now.errors, []);
});

test('NPCs arrive under the same conditions as v5', async () => {
  const {page} = await openGame(browser, srv.url);
  const r = await page.evaluate(() => {
    const out = [];
    for (const lvl of [1, 2, 3, 4, 5]) {
      S.keeper.level = lvl;
      const v5 = {brannoc: true, pip: lvl >= 2, sorrel: lvl >= 4 || secTier('nursery') >= 1};   // the v5 arrive() functions
      out.push(NPC_IDS.every(id => npcArrives(NPCS[id].arrive) === v5[id]));
    }
    return out;
  });
  assert.ok(r.every(Boolean));
});
