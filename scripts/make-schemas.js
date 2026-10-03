// Writes a JSON Schema for each data file into src/data/schema/, inferred from the data as it is now.
//   node scripts/make-schemas.js            write a schema only for data files that have none
//   node scripts/make-schemas.js --force    rewrite them all
//
// The schemas are committed and checked by tests/data.test.js, so a typo in a key, a missing field or a
// value of the wrong type fails the tests. When a data file's shape changes on purpose, rerun this with
// --force and read the diff: every change in it should be one you meant.
//
// Inference: the top level of a file is a record (every key required, nothing else allowed). Below it, an
// object whose values are all objects is a table keyed by id: one schema for every row, whose required
// fields are those every row has and whose allowed fields are those any row has. Objects of plain values are
// records too, unless their key is in MAPS: then they map ids to values (GENES: pow → "Power"), and a new id
// needs no schema change.
import {readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync} from 'node:fs';

const DIR = 'src/data', OUT = 'src/data/schema';
const force = process.argv.includes('--force');

// Keys whose objects map ids (species, types, materials, ...) to plain values.
const MAPS = new Set(['TYPE_ABIL', 'GENES', 'GENE_HINT', 'KEEPER_PERKS', 'SPECIES_ROLE', 'RANK_PAGES', 'MEMORIES', 'CODEX', 'ARCS', 'LINE_DATA', 'SYL',
  'cost', 'in', 'out', 'loot', 'produce', 'consume', 'list', 'w', 'types', 'reward', 'penCost', 'raidRaw', 'craftInput', 'raid']);
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);

// Merge two schemas describing alternatives of the same value.
function merge(a, b) {
  if (!a) return b; if (!b) return a;
  const ta = [].concat(a.type), tb = [].concat(b.type);
  let type = [...new Set([...ta, ...tb])];
  const out = {type: type.length === 1 ? type[0] : type};
  if (a.properties || b.properties) {
    const pa = a.properties || {}, pb = b.properties || {};
    out.properties = {};
    for (const k of new Set([...Object.keys(pa), ...Object.keys(pb)])) out.properties[k] = merge(pa[k], pb[k]);
    // A field is required only if both alternatives require it (an alternative without properties is not an object).
    const ra = a.properties ? a.required || [] : null, rb = b.properties ? b.required || [] : null;
    const req = ra && rb ? ra.filter(k => rb.includes(k)) : ra || rb;
    if (req && req.length) out.required = req;
    out.additionalProperties = false;
  }
  if (a.additionalProperties && typeof a.additionalProperties === 'object' || b.additionalProperties && typeof b.additionalProperties === 'object') {
    if (!out.properties) out.additionalProperties = merge(typeof a.additionalProperties === 'object' ? a.additionalProperties : null, typeof b.additionalProperties === 'object' ? b.additionalProperties : null);
  }
  if (a.items || b.items) out.items = merge(a.items, b.items);
  return out;
}

function infer(v, depth, top, key) {
  const t = typeOf(v);
  if (t === 'array') {
    const s = {type: 'array'};
    let items = null; for (const x of v) items = merge(items, infer(x, depth + 1, false, null));
    if (items) s.items = items;
    return s;
  }
  if (t !== 'object') return {type: t};
  const vals = Object.values(v);
  if (!top && vals.length >= 2 && vals.every(isObj)) {
    // A table keyed by id: one schema for every row.
    let row = null; for (const x of vals) row = merge(row, infer(x, depth + 1, false, null));
    return {type: 'object', additionalProperties: row};
  }
  if (!top && MAPS.has(key) && !vals.some(isObj)) {
    // A map from ids to plain values (e.g. GENES: pow → "Power").
    let val = null; for (const x of vals) val = merge(val, infer(x, depth + 1, false, key));
    return {type: 'object', additionalProperties: val};
  }
  const properties = {};
  for (const [k, x] of Object.entries(v)) properties[k] = infer(x, depth + 1, false, k);
  return {type: 'object', properties, required: Object.keys(v), additionalProperties: false};
}

mkdirSync(OUT, {recursive: true});
for (const f of readdirSync(DIR).filter(f => f.endsWith('.json')).sort()) {
  const out = `${OUT}/${f.replace('.json', '.schema.json')}`;
  if (existsSync(out) && !force) continue;
  const data = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
  const schema = {$schema: 'https://json-schema.org/draft/2020-12/schema', $comment: `The shape of src/data/${f}. Started by scripts/make-schemas.js; checked by tests/data.test.js.`, ...infer(data, 0, true)};
  writeFileSync(out, JSON.stringify(schema, null, 1) + '\n');
  console.log('wrote', out);
}
