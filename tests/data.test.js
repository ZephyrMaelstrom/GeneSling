// The data files: each matches its schema (src/data/schema/), and every id one table uses to point at
// another exists there. Runs in Node with no browser, in well under a second.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

const DIR = new URL('../src/data/', import.meta.url);
const read = f => JSON.parse(readFileSync(new URL(f, DIR), 'utf8'));
const files = readdirSync(DIR).filter(f => f.endsWith('.json')).sort();
const D = Object.fromEntries(files.map(f => [f.replace('.json', ''), read(f)]));

test('every data file has a schema and matches it', () => {
  const ajv = new Ajv({allErrors: true, strict: true, allowUnionTypes: true});
  const problems = [];
  for (const f of files) {
    let schema;
    try { schema = read('schema/' + f.replace('.json', '.schema.json')); } catch { problems.push(`${f}: no schema in src/data/schema/`); continue; }
    const check = ajv.compile(schema);
    if (!check(D[f.replace('.json', '')])) for (const e of check.errors.slice(0, 8)) problems.push(`${f}${e.instancePath}: ${e.message}${e.params.additionalProperty ? ` (${e.params.additionalProperty})` : ''}`);
  }
  assert.deepEqual(problems, []);
});

test('the schemas catch a typo, a missing field and a wrong type', () => {
  const ajv = new Ajv({allErrors: true, strict: true, allowUnionTypes: true}), check = ajv.compile(read('schema/species.schema.json'));
  const bad = structuredClone(D.species);
  bad.SPECIES.cindlet.colr = bad.SPECIES.cindlet.col; delete bad.SPECIES.cindlet.col;
  bad.SPECIES.puffcap.size = 'big';
  assert.equal(check(bad), false);
  const msgs = check.errors.map(e => `${e.instancePath} ${e.message} ${e.params.additionalProperty || e.params.missingProperty || ''}`);
  assert.ok(msgs.some(m => /cindlet .*colr/.test(m)), 'unknown key');
  assert.ok(msgs.some(m => /cindlet .*required.* col/.test(m)), 'missing key');
  assert.ok(msgs.some(m => /puffcap\/size must be number/.test(m)), 'wrong type');
});

test('every id a table points at exists', () => {
  const {species: sp, attacks: at, creatures: cr, hideout: hd, jobs: jb, items: it, dungeon: dg, bloom: bl, bosses: bo, enemies: en,
    lore: lo, story: st, pride: pr, exchange: ex, genetics: gx, endgame: eg, balance: ba} = D;
  const bad = [];
  const has = (where, set, id) => { if (!(set instanceof Set ? set.has(id) : id in set)) bad.push(`${where}: "${id}"`); };
  const TYPES = Object.keys(sp.TYPES), BASE = Object.keys(sp.SPECIES), HYB = sp.HYBRIDS.map(h => h.id);
  const FORMS = new Set([...BASE, ...HYB]), MATS = new Set(Object.keys(jb.MATERIALS));
  const GOODS = new Set([...MATS, 'coin', 'shard', 'shards', 'relic', 'kxp', 'cage', 'cages', 'gilded', 'blueprint']);
  // Foes and bosses that belong to no vein: event spawns and the Bloomlords.
  const HOMES = {...bl.VEINS, event: 1, bloomlord: 1};

  // Species, hybrids and their evolution lines.
  for (const [id, s] of Object.entries(sp.SPECIES)) has(`SPECIES.${id}.type`, sp.TYPES, s.type);
  for (const h of sp.HYBRIDS) h.types.forEach(t => has(`HYBRIDS.${h.id}.types`, sp.TYPES, t));
  assert.equal(new Set(HYB).size, HYB.length, 'hybrid ids are unique');
  for (const id of FORMS) { has('LINE_DATA', sp.LINE_DATA, id); has('lore CODEX', lo.CODEX, id); }
  for (const [id, line] of Object.entries(sp.LINE_DATA)) {
    has('LINE_DATA', FORMS, id);
    line.forEach(([, , atk, abil, need], i) => {
      has(`LINE_DATA.${id}[${i}] attack`, at.ATTACKS, atk); has(`LINE_DATA.${id}[${i}] ability`, at.ABILITIES, abil);
      if (need) has(`LINE_DATA.${id}[${i}] needs gene`, cr.GENES, need[0]);
    });
    if (lo.CODEX[id]) assert.equal(lo.CODEX[id].length, line.length, `CODEX.${id} has one entry per form`);
  }
  for (const id of Object.keys(lo.CODEX)) has('CODEX', FORMS, id);
  has('lore SECRET_HYBRID', new Set(HYB), lo.SECRET_HYBRID);
  for (const id of Object.keys(jb.SPECIES_ROLE)) { has('SPECIES_ROLE', FORMS, id); has(`SPECIES_ROLE.${id}`, jb.ROLES, jb.SPECIES_ROLE[id]); }

  // Types: every type has its ability, element, bond passive, wild fire, name syllables and hall perk.
  for (const t of TYPES) {
    for (const [name, table] of [['TYPE_ABIL', at.TYPE_ABIL], ['BOND_PASSIVE', cr.BOND_PASSIVE], ['WILD_FIRE', en.WILD_FIRE], ['SYL', sp.SYL]]) has(`${name} (type)`, table, t);
    has(`TYPES.${t}.elem`, at.ELEM, sp.TYPES[t].elem);
  }
  for (const [t, a] of Object.entries(at.TYPE_ABIL)) { has('TYPE_ABIL', sp.TYPES, t); has(`TYPE_ABIL.${t}`, at.ABILITIES, a); }
  for (const r of at.REACTIONS) { has(`REACTIONS ${r.name}`, at.ELEM, r.a); has(`REACTIONS ${r.name}`, at.ELEM, r.b); }
  for (const k of Object.keys(at.COMBOS)) k.split('+').forEach(t => has(`COMBOS.${k}`, sp.TYPES, t));
  for (const t of Object.keys(pr.PERKS)) has('pride PERKS', sp.TYPES, t);
  for (const [p, pal] of Object.entries(ba.ACCESS.palettes)) for (const t of TYPES) has(`ACCESS.palettes.${p}.types`, pal.types, t);

  // Genes and traits.
  for (const l of [...gx.STAT_LOCI, ...gx.WORK_LOCI]) { has('genetics loci', cr.GENES, l); has('GENE_HINT', cr.GENE_HINT, l); }
  for (const t of [...cr.NEG_TRAITS, ...jb.WORK_TRAITS]) has('trait list', cr.TRAITS, t);
  for (const pair of jb.CLASHES) pair.forEach(p => has('CLASHES', cr.PERS, p));
  has('genetics TOOLS.sequencer.npc', st.NPCS, gx.TOOLS.sequencer.npc);

  // Stations, production and the goods they move.
  for (const [k, s] of Object.entries(hd.SECTIONS)) { if (s.type !== null) has(`SECTIONS.${k}.type`, sp.TYPES, s.type); has(`SECTIONS.${k}.gene`, cr.GENES, s.gene); }
  for (const [k, s] of Object.entries(jb.STATIONS)) { has('STATIONS', hd.SECTIONS, k); [...Object.keys(s.in), ...Object.keys(s.out)].forEach(m => has(`STATIONS.${k}`, MATS, m)); }
  for (const [k, r] of Object.entries(jb.RECIPES)) {
    [...Object.keys(r.in || {}), ...Object.keys(r.out || {})].forEach(m => has(`RECIPES.${k}`, MATS, m));
    if (r.station) has(`RECIPES.${k}.station`, hd.SECTIONS, r.station);
  }
  for (const c of jb.CHEMISTRY) { has(`CHEMISTRY ${c.name}`, hd.SECTIONS, c.station); c.types.forEach(t => has(`CHEMISTRY ${c.name}`, sp.TYPES, t)); }
  for (const [k, e] of Object.entries(jb.EXPEDITIONS)) Object.keys(e.loot).forEach(m => has(`EXPEDITIONS.${k}.loot`, GOODS, m));
  for (const m of dg.MODES ? Object.values(dg.MODES) : []) has(`MODES ${m.name}`, hd.SECTIONS, m.need[0]);
  for (const g of Object.values(it.GUNS)) if (g.tier) has('WEAPON_COST tier', it.WEAPON_COST, String(g.tier));
  for (const [k, d] of Object.entries(pr.DECOR)) Object.keys(d.cost).forEach(m => has(`DECOR.${k}.cost`, GOODS, m));
  for (const p of pr.PLOTS) Object.keys(p.cost).forEach(m => has(`PLOTS ${p.name}`, GOODS, m));
  for (const [k, t] of Object.entries(eg.TOOLS)) Object.keys(t.cost || {}).forEach(m => has(`endgame TOOLS.${k}.cost`, GOODS, m));
  for (const [k, m] of Object.entries(bl.MAPS.kinds)) Object.keys(m.cost).forEach(x => has(`MAPS.${k}.cost`, GOODS, x));
  for (const [k, c] of Object.entries(bl.CONTRACTS.list)) Object.keys(c.reward).forEach(x => has(`CONTRACTS.${k}.reward`, GOODS, x));
  const PLACEABLE = new Set([...Object.keys(hd.SECTIONS), ...Object.keys(pr.DECOR), ...Object.keys(pr.FOOT), 'archive', 'gate', 'board', 'pens', 'hall']);
  for (const [k] of pr.DEFAULT_LAYOUT) has('DEFAULT_LAYOUT', PLACEABLE, k);

  // The market trades what the hideout makes.
  for (const g of Object.keys(ex.COMMODITIES)) has('COMMODITIES', GOODS, g);
  for (const g of ex.BASKET) has('BASKET', new Set([...Object.keys(ex.COMMODITIES), ...Object.keys(ex.UNIQUES)]), g);
  for (const [k, a] of Object.entries(ex.ARCHETYPES)) [...Object.keys(a.produce || {}), ...Object.keys(a.consume || {})].forEach(g => has(`ARCHETYPES.${k}`, ex.COMMODITIES, g));

  // The Bloom: veins, their types and foes, and the bosses that live there.
  const VEINS = Object.keys(bl.VEINS);
  for (const v of bl.VEIN_ORDER) has('VEIN_ORDER', bl.VEINS, v);
  for (const [k, v] of Object.entries(bl.VEINS)) {
    Object.keys(v.types || {}).forEach(t => has(`VEINS.${k}.types`, sp.TYPES, t));
    Object.keys(v.rich || {}).forEach(m => has(`VEINS.${k}.rich`, GOODS, m));
    (v.extraFoes || []).forEach(f => has(`VEINS.${k}.extraFoes`, en.FOES, f));
    if (v.twist) has(`VEINS.${k}.twist`, bl.TWISTS, v.twist);
    if (v.key) has(`VEINS.${k}.key`, sp.TYPES, v.key);
  }
  for (const [k, l] of Object.entries(bl.LAYOUTS)) Object.keys(l.w).forEach(v => has(`LAYOUTS.${k}.w`, bl.VEINS, v));
  for (const k of Object.keys(bl.LAYOUT_RULES)) has('LAYOUT_RULES', bl.LAYOUTS, k);
  for (const [k, f] of Object.entries(en.FOES)) if (f.vein) has(`FOES.${k}.vein`, HOMES, f.vein);
  for (const [k, b] of Object.entries(bo.BOSSES)) if (b.vein) has(`BOSSES.${k}.vein`, HOMES, b.vein);
  for (const k of Object.keys(lo.MEMORIES)) has('lore MEMORIES', bo.BOSSES, k);

  // Lore and residents.
  const ids = [...lo.PAGES.map(p => p.id), ...lo.WALLS.map(w => w.id), ...lo.WHISPERS.map(w => w.id)];
  assert.equal(new Set(ids).size, ids.length, 'page, wall and whisper ids are unique');
  for (const p of [...lo.PAGES, ...lo.WALLS]) if (p.find && p.find.vein) has(`lore ${p.id}.find.vein`, bl.VEINS, p.find.vein);
  for (const k of Object.keys(lo.ARCS)) has('lore ARCS', {...st.NPCS, ...lo.RESIDENTS}, k);
  for (const [k, n] of Object.entries(st.NPCS)) has(`NPCS.${k}.home`, hd.SECTIONS, n.home);
  for (const [k, r] of Object.entries(lo.RESIDENTS)) has(`RESIDENTS.${k}.home`, PLACEABLE, r.home);
  assert.ok(VEINS.length >= 9 && TYPES.length >= 9);
  assert.deepEqual(bad, []);
});
