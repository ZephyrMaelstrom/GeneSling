// Parity with v5: the content tables moved to src/data/*.json must match the archived v5 build,
// apart from the deliberate Phase 1 (Genetics 2.0) changes listed in PHASE1 below, and creature
// stats must compute the same way when the new genes sit at their neutral grade.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

// Phase 1 renamed Haste to Tempo and Temper to Focus, gave traits dominance, added traits and
// defects, and reworded the mutation upgrades. These rewrite a v5 snapshot into the expected form.
const RENAME = {hst: 'tem', tmp: 'foc'};
const PHASE1 = {
  LINES: t => { for (const k in t) for (const f of t[k]) if (f.need) f.need[0] = RENAME[f.need[0]] || f.need[0]; return t; },
  SECTIONS: t => { for (const k in t) t[k].gene = RENAME[t[k].gene] || t[k].gene;
    t.nursery.tiers[3] = '+0.5% mutation chance per gene, hybrid odds 15%'; return t; },
  RESEARCH: t => { t.breeding.nodes[0] = '+0.5% mutation chance per gene'; return t; },
};
// Phase 2 (jobs and production): every station's contribution now grows with Yield, the Garden's
// tiers boost its production instead of adding flat food, and five blurbs mention what they make.
const PHASE2 = {
  SECTIONS: (t, now) => { for (const k in t) { t[k].gene = 'yld'; t[k].blurb = now[k].blurb; } t.garden.tiers = now.garden.tiers; return t; },
};
// Phase 5 (the Bloom expands) only adds: the Venom type and its species, lines and names, the poison
// element and its reactions, new weapons, foes, bosses and the Apothecary. Every v5 entry must be unchanged,
// apart from the vein each foe and boss now belongs to.
const GROWN = ['HYBRIDS', 'TYPES', 'SPECIES', 'LINES', 'TYPE_ABIL', 'ELEM', 'BOND_PASSIVE', 'GUNS', 'SECTIONS', 'FOES', 'WILD_FIRE', 'BOSSES', 'SYL', 'REACTIONS'];
const v5Only = (now, v5) => Array.isArray(v5) ? now.filter(x => v5.some(y => y.name === x.name)) : Object.fromEntries(Object.keys(v5).map(k => [k, now[k]]));
const noVein = t => { for (const k in t) if (t[k] && typeof t[k] === 'object') delete t[k].vein; return t; };
const CHANGED = ['GENES', 'GENE_HINT', 'TRAITS', 'NEG_TRAITS'];   // compared separately below
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
  // Grit and Focus at the neutral grade 5 add nothing, so v5's Temper 5 and Focus 5 must match.
  const genes = typeof GRADE_LOCI === 'undefined' ? {vig: 7, pow: 6, swf: 5, hst: 8, tmp: 5} : {vig: 7, pow: 6, swf: 5, tem: 8, foc: 5, grt: 5};
  // In this build, pin the whole genome so looks (size changes HP) stay at the species default.
  const o = typeof genomeFrom === 'undefined' ? {genes, traits: ['keen']} : {genome: genomeFrom(genes, ['keen'])};
  out.stats = Object.fromEntries(Object.keys(SPECIES).map(sp => [sp, stats(makeCreature(sp, 'bred', 12, {...o, pers: 'brave', sex: 'F', name: 'X'}))]));
  return out;
}, TABLES);

test('content and stats match the v5 build', async () => {
  const v5 = await openGame(browser, srv.url, {page: '/prototype/archive/genesling-v5.html'});
  const now = await openGame(browser, srv.url);
  const [a, b] = [await snapshot(v5.page), await snapshot(now.page)];
  for (const t of TABLES) {
    if (CHANGED.includes(t)) continue;
    let want = PHASE1[t] ? PHASE1[t](structuredClone(a[t])) : a[t];
    if (PHASE2[t]) want = PHASE2[t](structuredClone(want), b[t]);
    const got = GROWN.includes(t) ? noVein(structuredClone(v5Only(b[t], a[t]))) : b[t];
    assert.deepEqual(got, want, `${t} differs from v5`);
  }
  // Every v5 trait is still there with the same name, effect and weight; it now also has a dominance flag.
  for (const [k, t] of Object.entries(a.TRAITS)) assert.deepEqual({...b.TRAITS[k], dom: undefined}, {...t, dom: undefined}, `trait ${k}`);
  assert.deepEqual(v5Only(b.stats, a.stats), a.stats, 'stats differ from v5');
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
