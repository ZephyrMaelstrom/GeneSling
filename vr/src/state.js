/* Save state, creatures and the Keeper. Creatures use GeneSling's genome code unchanged:
   rollGenome, express, inherit, isInbred, mutateGenome and inheritPersonality. */
import {G, emit} from './ctx.js';
import {VR} from './data.js';
import {rollGenome, express, inherit, inheritPersonality, isInbred, mutationRate, mutateGenome, pureRun, cutFree} from './sim-core/genetics.js';
import {SPECIES, PERS_IDS, PERS, TRAITS, makeName, TYPES} from './sim-core/content.js';
import {rand} from './sim-core/rng.js';

export const ZONE = id => VR.ZONES.find(z => z.id === id);
export const zoneAt = x => VR.ZONES.find(z => x >= z.x0 && x < z.x1) || (x < VR.ZONES[0].x0 ? VR.ZONES[0] : VR.ZONES[VR.ZONES.length - 1]);
export const isClaimed = id => id === 'home' || !!(G.S && G.S.zones[id] && G.S.zones[id].claimed);
// The safe border: the east edge of the last claimed zone in an unbroken run from home.
export function borderX() {
  let x = VR.ZONES[0].x1;
  for (const z of VR.ZONES.slice(1)) { if (isClaimed(z.id)) x = z.x1; else break; }
  return x;
}
export const isSafe = x => x < borderX();

function newState() {
  const S = {
    v: VR.SAVE_VERSION, day: 1, clock: 0.3, rank: 1, kxp: 0, coin: 0,
    items: {...VR.START.items}, roster: [], nextId: 1, party: [null, null, null], eggs: [], lineage: {},
    zones: {}, taken: [], posts: {forge: [], garden: [], spring: [], outpost: [], guard_thorn: [], guard_blight: []},
    objectives: {}, contracts: {day: 0, list: []}, trip: null, nodesDay: {}, boss: false, done: false,
    stats: {catches: 0, tames: 0, extracts: 0, deaths: 0, hatched: 0},
    settings: {turn: 'snap', snapDeg: 30, vignette: true, seated: false, leftHanded: false, move: 'smooth', aimAssist: true},
  };
  for (const z of VR.ZONES.slice(1)) {
    const pop = {};
    z.species.forEach((sp, i) => { pop[sp] = Math.max(1, Math.round(z.capacity * z.weights[i] / 100 * 2)); });
    S.zones[z.id] = {claimed: false, pressure: 0, pop};
  }
  return S;
}

export function makeCreature(species, o = {}) {
  const sp = SPECIES[species];
  const c = {
    id: o.id || G.S.nextId++, species, type: sp.type, sex: o.sex || (rand() < 0.5 ? 'F' : 'M'),
    gen: o.gen || 0, genome: o.genome || rollGenome(rand, 'wild', o.floor || 1), pers: o.pers || PERS_IDS[Math.floor(rand() * PERS_IDS.length)],
    name: o.name || makeName(sp.type), lvl: o.lvl || 1, xp: 0, bond: o.bond || 0, fatigue: 0, pure: o.pure || 1,
    mom: o.mom || null, dad: o.dad || null, bloom: !!o.bloom, history: [],
  };
  if (o.bloom && !o.genome) mutateGenome(c.genome, 1, rand); // Bloom-touched wilds carry an extra mutation, as the Sump's do
  express(c);
  c.hp = stats(c).hp;
  return c;
}

// Combat and work numbers from expressed genes (GeneSling's grade names).
export function stats(c) {
  const C = VR.CREATURE, g = c.genes, m = SPECIES[c.species].mods, lv = 1 + (c.lvl - 1) * 0.06;
  const size = C.sizes[c.looks.size] || 1, t = c.traits;
  let hp = (C.hpBase + C.hpPerVig * g.vig) * m.hp * lv * (0.85 + size * 0.15);
  let atk = (C.atkBase + C.atkPerPow * g.pow) * m.atk * lv;
  let spd = (C.speedBase + C.speedPerSwf * g.swf) * m.spd;
  let every = Math.max(0.9, (C.attackEvery + C.attackPerTem * g.tem) / m.rate);
  if (t.includes('thick')) hp *= 1.15; if (t.includes('frail')) hp *= 0.85;
  if (t.includes('quick')) spd *= 1.1; if (t.includes('rapid')) every *= 0.88;
  if (c.pers === 'brave') atk *= 1.1; if (c.pers === 'playful') spd *= 1.15;
  if (c.bloom) { hp *= C.bloomBuff; atk *= C.bloomBuff; }
  const grit = (g.grt - 5) * 0.03, cd = Math.max(5, VR.COMPANION.skillBaseCooldown + VR.COMPANION.skillPerFoc * (g.foc - 5)) * (c.pers === 'calm' ? 0.85 : 1);
  return {hp: Math.round(hp), atk: Math.round(atk * 10) / 10, spd, every, armor: Math.max(-0.15, Math.min(0.3, grit)), cd, size};
}
export const creatureById = id => G.S.roster.find(c => c.id === id);
export const typeName = t => TYPES[t] ? TYPES[t].name : t;
export const persName = p => PERS[p] ? PERS[p].name : p;
export const traitName = t => TRAITS[t] ? TRAITS[t].name : t;
export function where(c) {
  const S = G.S, i = S.party.indexOf(c.id);
  if (i >= 0) return i < 2 ? `Party slot ${i + 1}` : 'Party slot 3';
  for (const [k, ids] of Object.entries(S.posts)) if (ids.includes(c.id)) return k.startsWith('guard') ? 'Guarding ' + k.slice(6) : 'Working: ' + k;
  if (S.taken.some(t => t.id === c.id)) return 'Taken by the Bloom';
  return 'Resting';
}
export function unpost(id) {
  const S = G.S;
  for (const k in S.posts) S.posts[k] = S.posts[k].filter(x => x !== id);
  S.party = S.party.map(x => x === id ? null : x);
}

/* ---------- items ---------- */
export const has = (k, n = 1) => (G.S.items[k] || 0) >= n;
export function give(k, n = 1) { G.S.items[k] = (G.S.items[k] || 0) + n; }
export function take(k, n = 1) { if (!has(k, n)) return false; G.S.items[k] -= n; return true; }
export const canAfford = cost => Object.entries(cost).every(([k, n]) => has(k, n));
export function pay(cost) { if (!canAfford(cost)) return false; for (const [k, n] of Object.entries(cost)) take(k, n); return true; }

/* ---------- Keeper rank ---------- */
export function keeperXp(n, why) {
  const S = G.S; S.kxp += n;
  while (S.kxp >= VR.KEEPER_RANK_COST * S.rank / 10) { S.kxp -= VR.KEEPER_RANK_COST * S.rank / 10; S.rank++; emit('toast', `Keeper rank ${S.rank}`); }
  if (why) emit('xp', n, why);
}
export function creatureXp(c, n) {
  c.xp += n;
  while (c.xp >= VR.XP_PER_LEVEL * c.lvl) { c.xp -= VR.XP_PER_LEVEL * c.lvl; c.lvl++; emit('toast', `${c.name} reached level ${c.lvl}`); }
}
export function bondUp(c, n) { c.bond = Math.min(1000, (c.bond || 0) + n); }
export const bondStars = b => [0, 60, 180, 400, 750].filter(x => b >= x).length - 1;

export function objective(id) {
  const S = G.S; if (S.objectives[id]) return;
  S.objectives[id] = S.day; emit('objective', id);
  if (VR.OBJECTIVES.every(o => S.objectives[o.id]) && !S.done) { S.done = true; emit('mvpDone'); }
}

/* ---------- breeding ---------- */
export function canBreed(m, d) {
  if (!m || !d || m.id === d.id) return 'Pick two creatures.';
  if (m.sex !== 'F' || d.sex !== 'M') return 'The mother must be female and the father male.';
  if (m.lvl < VR.BREED_LEVEL || d.lvl < VR.BREED_LEVEL) return `Both parents need level ${VR.BREED_LEVEL}.`;
  if (m.type !== d.type) return 'Cross-type pairs (hybrids) arrive after the MVP. Pick two of one type.';
  if (m.traits.includes('shortlived') && (m.bred || 0) >= 2) return `${m.name} is Short-lived and can't breed again.`;
  return null;
}
export function breed(m, d) {
  const S = G.S, get = id => S.lineage[id];
  const inbred = isInbred(m.id, d.id, get);
  const res = inherit(m, d, {rate: mutationRate(m, d), inbred}, rand);
  m.bred = (m.bred || 0) + 1; d.bred = (d.bred || 0) + 1;
  const days = VR.EGG_DAYS[0] + Math.floor(rand() * (VR.EGG_DAYS[1] - VR.EGG_DAYS[0] + 1));
  const twin = m.traits.includes('twin') && rand() < 0.25;
  const eggs = [];
  for (let i = 0; i < (twin ? 2 : 1); i++) {
    const r2 = i ? inherit(m, d, {rate: mutationRate(m, d), inbred}, rand) : res;
    const egg = {id: S.nextId++, species: m.species, mom: m.id, dad: d.id, genome: r2.genome, mutations: r2.mutations.length, defect: r2.defect,
      gen: Math.max(m.gen, d.gen) + 1, pers: inheritPersonality(m, d, rand), pure: pureRun(m.species, m, d), hatchDay: S.day + days};
    S.eggs.push(egg); eggs.push(egg);
  }
  return {eggs, inbred};
}
export function hatch(egg) {
  const S = G.S;
  const c = makeCreature(egg.species, {genome: egg.genome, gen: egg.gen, mom: egg.mom, dad: egg.dad, pers: egg.pers, pure: egg.pure, bond: 30});
  c.id = egg.id; S.lineage[c.id] = {mom: egg.mom, dad: egg.dad};
  c.history.push(`Hatched on day ${S.day} (Gen ${c.gen})`);
  S.roster.push(c); S.eggs = S.eggs.filter(e => e !== egg); S.stats.hatched++;
  keeperXp(VR.KEEPER_XP.hatch, 'hatch');
  return c;
}
export {cutFree};

/* ---------- save ---------- */
export function save() {
  try { localStorage.setItem(VR.SAVE_KEY, JSON.stringify(G.S)); } catch (e) { /* storage may be blocked; play continues in memory */ }
}
export function load() {
  let S = null;
  try { const raw = localStorage.getItem(VR.SAVE_KEY); if (raw) S = JSON.parse(raw); } catch (e) { S = null; }
  if (S && S.v === VR.SAVE_VERSION) { G.S = S; return false; }
  // Future versions migrate here; never reset a readable save.
  G.S = newState();
  for (const p of VR.START.party) {
    const c = makeCreature(p.species, {name: p.name, sex: p.sex, floor: 3, lvl: 3, bond: 120});
    c.history.push('Your first companion');
    G.S.roster.push(c); G.S.lineage[c.id] = {mom: null, dad: null};
  }
  G.S.party = [G.S.roster[0].id, G.S.roster[1].id, null];
  return true;
}
export function resetSave() { try { localStorage.removeItem(VR.SAVE_KEY); } catch (e) { /* ignore */ } }
