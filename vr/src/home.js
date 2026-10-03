/* The loop: expeditions and extraction, death and recovery, the homestead day, stations,
   breeding, crafting, claims and Surges, the Delve, contracts and home life. */
import * as THREE from 'three';
import {G, on, emit} from './ctx.js';
import {VR} from './data.js';
import {rand} from './sim-core/rng.js';
import {SPECIES} from './sim-core/content.js';
import {mat, sfx, makeLabel, mergedMesh} from './gfx.js';
import {heightAt, recolorGround, addInteract, DELVE_ROOMS, DELVE_Z} from './world.js';
import {makeActor, removeActor, regrowPopulations, animate, move, hpBar} from './creatures.js';
import {makeFoe, syncParty} from './combat.js';
import {isNight} from './world.js';
import {ZONE, zoneAt, isClaimed, isSafe, borderX, stats, creatureById, give, take, has, pay, canAfford, keeperXp, creatureXp, bondUp, objective, unpost, where} from './state.js';

/* ---------- expeditions ---------- */
export function startTrip() {
  const S = G.S; if (S.trip) return;
  S.trip = {day: S.day, pack: {}, caught: []};
  emit('toast', 'Expedition started — nothing is safe until you bring it home');
}
export function packAdd(k, n) { if (G.S.trip) G.S.trip.pack[k] = (G.S.trip.pack[k] || 0) + n; else give(k, n); }
export function packCount() { const t = G.S.trip; return t ? Object.values(t.pack).reduce((a, b) => a + b, 0) + t.caught.length : 0; }

export function extract(how) {
  const S = G.S, t = S.trip; if (!t) return;
  const items = Object.entries(t.pack).filter(([, n]) => n > 0);
  for (const [k, n] of items) give(k, n);
  for (const c of t.caught) S.roster.push(c);
  const n = items.reduce((a, [, x]) => a + x, 0);
  keeperXp(VR.KEEPER_XP.extract + VR.KEEPER_XP.extractPerItem * (n + t.caught.length * 5), 'extract');
  for (const c of G.companions) { c.c.history.push(`Came home from an expedition on day ${S.day}`); creatureXp(c.c, 20); bondUp(c.c, 12); }
  S.stats.extracts++;
  if (t.caught.length) objective('extract');
  const done = checkContracts(t);
  S.trip = null; sfx('extract');
  G.openPanel('report', {title: how === 'waystone' ? 'Home by the Waystone' : 'You made it home', items, caught: t.caught, contracts: done});
  if (how === 'waystone') teleportHome();
  refreshHome(); emit('save');
}
function teleportHome(atBed) {
  const P = G.player, x = atBed ? -60 : borderX() - 5, z = atBed ? 2 : 0;
  P.pos.set(x, heightAt(x, z), z); P.yaw = atBed ? -Math.PI / 2 : Math.PI / 2; G.inDelve = false;
  for (const c of G.companions) c.pos.set(x - 1, heightAt(x - 1, z - 2), z - 2);
  emit('teleport');
}
on('playerDown', () => {
  const S = G.S, P = G.player; if (P.dead) return;
  P.dead = true; S.stats.deaths++;
  const zone = G.inDelve ? 'blight' : zoneAt(P.pos.x).id;
  const lost = S.trip ? {items: Object.entries(S.trip.pack).filter(([, n]) => n > 0), caught: S.trip.caught} : {items: [], caught: []};
  const taken = [];
  for (const a of G.companions.slice()) {
    if (zone === 'home') continue;
    S.taken.push({id: a.c.id, zone, until: S.day + VR.RECOVER_DAYS}); taken.push(a.c);
    a.c.history.push(`Taken by the Bloom in ${ZONE(zone).name} on day ${S.day}`);
    unpost(a.c.id);
  }
  S.trip = null;
  emit('fade', () => {
    clearField(); syncParty(); advanceDay(true);
    P.hp = P.maxHp; P.dead = false; teleportHome(true);
    G.openPanel('report', {title: 'The Bloom took you', dead: true, items: lost.items, caught: lost.caught, taken});
    emit('save');
  });
});
function clearField() {
  for (const a of G.wilds) removeActor(a); G.wilds = [];
  for (const a of G.foes) removeActor(a); G.foes = [];
  for (const s of G.shots) G.scene.remove(s.m); G.shots = [];
  if (G.surge) endSurge(false, true);
}

// Hold an extraction circle: the gate on your border, or a Waystone.
let holdT = 0;
export function updateExtraction(dt) {
  const S = G.S, P = G.player; G.hold = 0;
  if (!S.trip || P.dead || G.inDelve) { holdT = 0; return; }
  const pts = [{x: borderX() + 2.2, z: 0, how: 'gate'}, ...VR.WAYSTONES.map(w => ({...w, how: 'waystone'}))];
  const inRing = pts.find(p => Math.hypot(P.pos.x - p.x, P.pos.z - p.z) < 2);
  if (inRing) { holdT += dt; G.hold = holdT / VR.HOLD_SECONDS; if (Math.floor(holdT) !== Math.floor(holdT - dt)) sfx('ui'); if (holdT >= VR.HOLD_SECONDS) { holdT = 0; extract(inRing.how); } }
  else holdT = 0;
}
// The border is a wall of Bloom-thorn: you only pass through the gate, and only inward once extracted.
export function borderBlock(ox, nx, z) {
  const b = borderX(), S = G.S;
  if (ox >= b && nx < b) { // coming home
    if (Math.abs(z) > 2.2) return b; // only through the gate
    if (S.trip) return b;            // hold the circle first
  }
  if (ox < b && nx >= b && Math.abs(z) > 2.2) return b - 0.01;
  return nx;
}

/* ---------- resource nodes ---------- */
const NODE_LOOK = {ore: ['#8b8790', '#ffd23f'], fiber: ['#5f9a3a', '#c8e08a'], herbs: ['#5a8a3a', '#ff8ab0'], bloomshard: ['#6a2a9a', '#d49bff']};
export function buildNodes() {
  let seed = 31; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (const [zid, list] of Object.entries(VR.NODES)) {
    const z = ZONE(zid);
    for (const [kind, count] of list) for (let i = 0; i < count; i++) {
      const x = z.x0 + 5 + r() * (z.x1 - z.x0 - 10), zz = -VR.WORLD_Z + 10 + r() * (VR.WORLD_Z * 2 - 20), y = heightAt(x, zz);
      const [a, b] = NODE_LOOK[kind], parts = [];
      if (kind === 'ore') { parts.push({geo: new THREE.DodecahedronGeometry(0.5, 0), color: a, pos: [0, 0.3, 0]}); for (let k = 0; k < 3; k++) parts.push({geo: new THREE.OctahedronGeometry(0.1, 0), color: b, pos: [Math.sin(k * 2) * 0.35, 0.4 + k * 0.1, Math.cos(k * 2) * 0.35]}); }
      else if (kind === 'bloomshard') parts.push({geo: new THREE.OctahedronGeometry(0.35, 0), color: b, pos: [0, 0.6, 0], scale: [1, 1.8, 1]});
      else for (let k = 0; k < 5; k++) parts.push({geo: new THREE.ConeGeometry(0.08, kind === 'fiber' ? 1.1 : 0.5, 4), color: k % 2 ? a : b, pos: [Math.sin(k * 1.3) * 0.25, kind === 'fiber' ? 0.55 : 0.25, Math.cos(k * 1.3) * 0.25]});
      const g = mergedMesh(parts, kind === 'bloomshard' ? {emissive: '#5a1a8a', emissiveIntensity: 0.9} : {}); g.position.set(x, y, zz);
      G.scene.add(g);
      const node = {kind, g, zone: zid, used: false};
      node.it = addInteract(g, new THREE.Vector3(x, y + 0.5, zz), () => node.used ? null : `Gather ${kind}`, () => gather(node), 2.6);
      G.nodes.push(node);
    }
  }
}
export function gather(node) {
  if (node.used) return;
  const [a, b] = VR.NODE_YIELD[node.kind], n = a + Math.floor(rand() * (b - a + 1));
  node.used = true; node.g.visible = false; packAdd(node.kind, n); sfx('gather');
  emit('toast', `+${n} ${node.kind}${G.S.trip ? ' (in your pack)' : ''}`);
}
function respawnNodes() { for (const n of G.nodes) { n.used = false; n.g.visible = true; } }

/* ---------- the day ---------- */
export function workUnits(c, stationKey) {
  const st = stationKey === 'outpost' ? VR.OUTPOST : VR.STATIONS[stationKey], W = VR.WORK, g = c.genes;
  let u = (0.5 + 0.1 * g.yld) * (c.type === st.type ? 1 : W.offTypeMatch) * (1 + W.perLevel * (c.lvl - 1));
  if (c.traits.includes('worker')) u *= 1.5;
  if (c.traits.includes('lazy')) u *= 0.8;
  u *= 1 - W.fatigueMaxCut * Math.min(1, (c.fatigue || 0) / 100);
  return Math.round(u * 100) / 100;
}
export function stationOutput(k) {
  const ids = G.S.posts[k] || [], st = k === 'outpost' ? VR.OUTPOST : VR.STATIONS[k];
  const units = ids.map(id => creatureById(id)).filter(Boolean).reduce((a, c) => a + workUnits(c, k), 0);
  const out = {}; for (const [m, n] of Object.entries(st.makes)) out[m] = Math.round(units * n * 10) / 10;
  return {units, out, st};
}
export function advanceDay(died) {
  const S = G.S, report = [];
  S.day++;
  // production (GeneSling Phase 2: units → goods, limited by inputs)
  S.carry ||= {};
  for (const k of [...Object.keys(VR.STATIONS), ...(isClaimed('thorn') ? ['outpost'] : [])]) {
    const {units, st} = stationOutput(k); if (!units) continue;
    let can = units + (S.carry[k] || 0);
    for (const [m, n] of Object.entries(st.takes)) can = Math.min(can, (S.items[m] || 0) / n);
    const whole = Math.floor(can); S.carry[k] = Math.min(1, can - whole);
    if (!whole) continue;
    for (const [m, n] of Object.entries(st.takes)) take(m, n * whole);
    const got = []; for (const [m, n] of Object.entries(st.makes)) { give(m, n * whole); got.push(`${n * whole} ${m}`); }
    report.push(`${st.name}: ${got.join(', ')}`);
  }
  // fatigue, healing, feeding
  const posted = new Set(Object.entries(S.posts).filter(([k]) => !k.startsWith('guard')).flatMap(([, v]) => v));
  let hungry = 0;
  for (const c of S.roster) {
    if (S.taken.some(t => t.id === c.id)) continue;
    if (posted.has(c.id)) c.fatigue = Math.min(100, (c.fatigue || 0) + VR.WORK.fatigueRise * (c.traits.includes('tireless') ? 0.5 : 1));
    else c.fatigue = Math.max(0, (c.fatigue || 0) - VR.WORK.fatigueRest);
    c.hp = stats(c).hp;
    if (!(posted.has(c.id) && c.traits.includes('thrifty'))) { if (!take('food', VR.UPKEEP_FOOD)) { hungry++; c.fatigue = Math.min(100, c.fatigue + 20); } }
  }
  if (hungry) report.push(`${hungry} creature${hungry > 1 ? 's' : ''} went hungry (more tired). Grow food at the Garden.`);
  // the Bloom keeps what it took for only so long
  for (const t of S.taken.slice()) if (S.day > t.until) {
    const c = creatureById(t.id); S.taken = S.taken.filter(x => x !== t);
    if (c) {
      S.roster = S.roster.filter(x => x !== c); unpost(c.id);
      (S.memorial ||= []).push({name: c.name, species: c.species, day: S.day, history: c.history.slice(-3)});
      const heir = S.roster.find(x => S.lineage[x.id] && (S.lineage[x.id].mom === c.id || S.lineage[x.id].dad === c.id));
      if (heir) { bondUp(heir, Math.round((c.bond || 0) * 0.25)); report.push(`${c.name} is gone for good. ${heir.name} inherits some of its bond.`); }
      else report.push(`${c.name} is gone for good. Its name is on the Memorial.`);
    }
  }
  // claimed land: guards hold the Bloom back, unguarded land slips
  for (const z of VR.ZONES.slice(1)) {
    const zs = S.zones[z.id]; if (!zs.claimed) continue;
    const guards = (S.posts['guard_' + z.id] || []).length;
    zs.pressure = Math.max(0, Math.min(100, zs.pressure + (guards ? -15 * guards : 20)));
    if (zs.pressure >= 100) { zs.claimed = false; zs.pressure = 0; S.posts['guard_' + z.id] = []; if (z.id === 'thorn') S.posts.outpost = []; report.push(`The Bloom took ${z.name} back. Post guards to hold land.`); recolorGround(); }
    else if (!guards) report.push(`${z.name} has no guards: Bloom pressure ${zs.pressure}%.`);
  }
  regrowPopulations(); respawnNodes(); rollContracts();
  S.clock = 0.27;
  if (Object.entries(S.posts).some(([k, v]) => !k.startsWith('guard') && v.length)) objective('post');
  const eggsReady = S.eggs.filter(e => e.hatchDay <= S.day).length;
  if (eggsReady) report.push(`${eggsReady} egg${eggsReady > 1 ? 's are' : ' is'} ready to hatch at the Nursery.`);
  G.lastDayReport = report;
  for (const c of G.companions) c.hp = c.maxHp;
  updateSigns(); refreshHome();
  if (!died) emit('save');
  return report;
}
export function sleep() {
  if (G.S.trip) { emit('toast', 'Finish your expedition first'); return; }
  emit('fade', () => { const r = advanceDay(); G.openPanel('morning', r); });
}
export function updateSigns() {
  for (const k of Object.keys(VR.STATIONS)) {
    const {out, st} = stationOutput(k), n = G.S.posts[k].length;
    G.stationSigns[k].set([st.name, n ? `${n} worker${n > 1 ? 's' : ''} · ` + Object.entries(out).map(([m, v]) => `+${v} ${m}/day`).join(', ') : 'No workers — post one here']);
  }
  if (G.outpostSign) { const {out} = stationOutput('outpost'); G.outpostSign.set([VR.OUTPOST.name, G.S.posts.outpost.length ? `+${out.ore} ore/day` : 'Post an Ember worker here']); }
  if (G.nurseryLabel) { const e = G.S.eggs; G.nurseryLabel.set(['Nursery', e.length ? `${e.length} egg${e.length > 1 ? 's' : ''} · ${e.filter(x => x.hatchDay <= G.S.day).length} ready` : 'No eggs']); }
}

/* ---------- crafting ---------- */
export function craft(r) {
  if (!pay(r.cost)) return false;
  for (const [k, n] of Object.entries(r.gives)) give(k, n);
  keeperXp(VR.KEEPER_XP.craft, 'craft'); sfx('gather');
  if (r.id === 'ward') objective('ward');
  emit('toast', `Crafted ${r.name}`); return true;
}

/* ---------- contracts ---------- */
export function rollContracts() {
  const S = G.S; if (S.contracts.day === S.day) return;
  const pool = VR.CONTRACTS.slice(); const list = [];
  while (list.length < 3 && pool.length) list.push({...pool.splice(Math.floor(rand() * pool.length), 1)[0], done: false});
  S.contracts = {day: S.day, list};
}
function checkContracts(trip) {
  const done = [];
  for (const k of G.S.contracts.list) {
    if (k.done) continue;
    const ok = k.kind === 'catch' ? trip.caught.filter(c => c.type === k.type).length >= k.n : (trip.pack[k.item] || 0) >= k.n;
    if (ok) { k.done = true; for (const [m, n] of Object.entries(k.reward)) m === 'coin' ? (G.S.coin += n) : give(m, n); keeperXp(VR.KEEPER_XP.contract, 'contract'); done.push(k); }
  }
  return done;
}

/* ---------- claims and Surges ---------- */
export function startSurge(zid) {
  const z = ZONE(zid), S = G.S;
  if (isClaimed(zid) || G.surge) return;
  if (!take('ward')) { emit('toast', 'You need a Ward Stone (craft one at the Workbench)'); return; }
  const {x, z: zz} = z.heartroot, y = heightAt(x, zz);
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 1.6, 6), mat('#d8d2e8', {emissive: '#7fd6ff', emissiveIntensity: 0.6}));
  stone.position.set(x + 2.2, y + 0.8, zz); G.scene.add(stone);
  const label = makeLabel(['Ward Stone'], {scale: 2.2}); label.position.set(x + 2.2, y + 2.6, zz); G.scene.add(label);
  G.surge = {zone: zid, t: 0, wave: 0, hp: z.surge.stoneHp, max: z.surge.stoneHp, stone, label, cfg: z.surge};
  sfx('surge'); emit('toast', `The Bloom surges! Hold the Ward Stone for ${z.surge.seconds} seconds`);
  void S;
}
export function updateSurge(dt) {
  const s = G.surge; if (!s) return;
  s.t += dt;
  const every = s.cfg.seconds / s.cfg.waves;
  if (s.wave < s.cfg.waves && s.t >= s.wave * every) {
    s.wave++;
    const c = ZONE(s.zone).heartroot;
    for (let i = 0; i < s.cfg.perWave + Math.floor(s.wave / 3); i++) { const an = rand() * 6.28, r = 16 + rand() * 6, x = c.x + Math.cos(an) * r, z = c.z + Math.sin(an) * r; makeFoe('bloomling', new THREE.Vector3(x, heightAt(x, z), z), {target: 'stone'}); }
    emit('toast', `Wave ${s.wave} of ${s.cfg.waves}`); sfx('warn');
  }
  const left = Math.max(0, s.cfg.seconds - s.t);
  s.label.set(['Ward Stone', `${Math.round(Math.max(0, s.hp))} / ${s.max} · ${Math.ceil(left)} s`]);
  s.stone.material.emissiveIntensity = 0.4 + 0.4 * Math.sin(G.t * (s.hp < s.max / 3 ? 12 : 3));
  if (s.hp <= 0) endSurge(false);
  else if (left <= 0 && !G.foes.some(f => f.target === 'stone')) endSurge(true);
}
export function endSurge(won, silent) {
  const s = G.surge; if (!s) return;
  G.scene.remove(s.stone, s.label); G.surge = null;
  for (const f of G.foes.filter(f => f.target === 'stone')) { removeActor(f); } G.foes = G.foes.filter(f => f.target !== 'stone');
  if (silent) return;
  if (!won) { emit('toast', 'The Ward Stone shattered. Craft another and try again.'); sfx('escape'); return; }
  const S = G.S, z = ZONE(s.zone);
  S.zones[s.zone].claimed = true; S.zones[s.zone].pressure = 0;
  keeperXp(VR.KEEPER_XP.claim, 'claim'); objective('claim');
  for (const w of G.wilds) if (w.zone === s.zone) { w.aggro = false; w.state = 'wander'; }
  recolorGround(); if (s.zone === 'thorn') buildOutpost();
  sfx('extract');
  emit('toast', `${z.name} is yours!`);
  // the border moved past you: whatever you carry is home
  if (S.trip && isSafe(G.player.pos.x)) extract('claim');
  G.openPanel('claimed', s.zone);
  emit('save');
}
let outpostBuilt = false;
export function buildOutpost() {
  if (outpostBuilt || !isClaimed('thorn')) return; outpostBuilt = true;
  const [x, , z] = VR.OUTPOST.pos, y = heightAt(x, z);
  const b = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 2), mat('#7a6a58')); b.position.set(x, y + 0.6, z); G.scene.add(b);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 1.6), mat('#ff7a3d', {emissive: '#ff7a3d', emissiveIntensity: 0.25})); top.position.set(x, y + 1.3, z); G.scene.add(top);
  G.outpostSign = makeLabel([VR.OUTPOST.name, ''], {scale: 2.2}); G.outpostSign.position.set(x, y + 3, z); G.scene.add(G.outpostSign);
  addInteract(b, new THREE.Vector3(x, y + 1, z), () => `${VR.OUTPOST.name} — post workers`, () => G.openPanel('station', 'outpost'));
  updateSigns();
}

/* ---------- the Delve ---------- */
let room = -1;
G.enterDelve = () => {
  if (!G.S.trip) startTrip();
  const P = G.player; G.inDelve = true; room = -1;
  emit('fade', () => {
    clearWilds();
    P.pos.set(0, 0, DELVE_Z - 6); P.yaw = Math.PI;
    for (const c of G.companions) c.pos.set(c.slot - 1, 0, DELVE_Z - 8);
    emit('toast', 'The Delve: three rooms. Rootmaw waits in the last.');
    emit('teleport');
  });
};
function clearWilds() { for (const a of G.wilds) removeActor(a); G.wilds = []; }
export function updateDelve() {
  if (!G.inDelve) return;
  const P = G.player, rIdx = DELVE_ROOMS.findIndex(r => Math.abs(P.pos.z - r.z) < 9);
  if (rIdx > room) {
    room = rIdx; const rz = DELVE_ROOMS[rIdx].z;
    if (rIdx < 2) for (let i = 0; i < 3 + rIdx * 2; i++) makeFoe('bloomling', new THREE.Vector3(-6 + rand() * 12, 0, rz + 2 + rand() * 5), {hpMul: 1 + rIdx * 0.3});
    else if (!G.S.boss || !G.bossFoughtThisVisit) { G.bossFoughtThisVisit = true; makeFoe('boss', new THREE.Vector3(0, 0, rz + 4), {hpMul: G.S.boss ? 1.2 : 1}); emit('toast', 'ROOTMAW wakes!'); sfx('surge'); }
  }
  // the way out opens once the boss room is clear
  const bossAlive = G.foes.some(f => f.boss);
  G.delveExit.set(['Way out', room === 2 && !bossAlive ? 'Walk into the light to leave' : 'Opens when Rootmaw falls']);
  if (room === 2 && !bossAlive && P.pos.z > DELVE_Z + 52) leaveDelve();
}
function leaveDelve() {
  const P = G.player, d = VR.DELVE_MOUTH;
  emit('fade', () => {
    for (const f of G.foes) removeActor(f); G.foes = [];
    G.inDelve = false; G.bossFoughtThisVisit = false; room = -1;
    P.pos.set(d.x - 3, heightAt(d.x - 3, d.z - 4), d.z - 4); P.yaw = Math.PI / 2;
    for (const c of G.companions) c.pos.set(d.x - 4, heightAt(d.x - 4, d.z - 6), d.z - 6);
    emit('toast', 'Back in Blightfen. Get your loot home!'); emit('teleport');
  });
}
on('bossDown', () => {
  const S = G.S, first = !S.boss; S.boss = true;
  packAdd('bloomshard', 3); packAdd('ore', 6);
  keeperXp(first ? VR.KEEPER_XP.boss : VR.KEEPER_XP.boss * 0.4, 'boss'); objective('boss');
  for (const c of G.companions) c.c.history.push(`Was there when Rootmaw fell (day ${S.day})`);
  emit('toast', 'Rootmaw falls! The way out is open.'); sfx('extract');
});

/* ---------- home life: creatures that aren't with you live at the homestead ---------- */
G.homeActors = [];
export function refreshHome() {
  for (const a of G.homeActors) { removeActor(a); a.it.dead = true; } G.homeActors = [];
  G.interactables = G.interactables.filter(i => !i.dead);
  const S = G.S, list = S.roster.filter(c => !S.party.includes(c.id) && !S.taken.some(t => t.id === c.id)).slice(0, 18);
  list.forEach((c, i) => {
    let base = [-50 + (i % 6) * 3, 2 + Math.floor(i / 6) * 3];
    for (const k of Object.keys(VR.STATIONS)) if (S.posts[k].includes(c.id)) base = [VR.STATIONS[k].pos[0] + 2.5, VR.STATIONS[k].pos[2] + 1.5];
    if (S.posts.outpost.includes(c.id)) base = [VR.OUTPOST.pos[0] + 2.5, VR.OUTPOST.pos[2] + 1.5];
    for (const z of ['thorn', 'blight']) if (S.posts['guard_' + z].includes(c.id)) { const h = ZONE(z).heartroot; base = [h.x + 3, h.z + 3]; }
    const a = makeActor(c, 'home', new THREE.Vector3(base[0], heightAt(base[0], base[1]), base[1]));
    a.home.set(base[0], 0, base[1]); a.bar.visible = false;
    a.it = addInteract(a.body, a.pos, () => `${c.name} — pet, and see its page`, () => { pet(c); G.openPanel('creature', c.id); }, 2.2);
    G.homeActors.push(a);
  });
  updateSigns();
}
export function pet(c) {
  const S = G.S; if (c.pettedDay === S.day) return;
  c.pettedDay = S.day; bondUp(c, 15); sfx('tame'); emit('toast', `${c.name} leans into your hand (+bond)`);
}
export function updateHome(dt) {
  const near = G.player.pos.x < -10 || G.homeActors.some(a => a.pos.distanceTo(G.player.pos) < 40);
  for (const a of G.homeActors) {
    a.timer -= dt;
    if (!near) continue;
    if (!a.goal || a.timer < 0) { a.timer = 3 + rand() * 5; a.goal = rand() < 0.5 ? null : new THREE.Vector3(a.home.x + (rand() - 0.5) * 5, 0, a.home.z + (rand() - 0.5) * 5); }
    if (a.goal) { const dx = a.goal.x - a.pos.x, dz = a.goal.z - a.pos.z, d = Math.hypot(dx, dz); if (d < 0.4) { a.goal = null; a.vel.set(0, 0, 0); } else { a.vel.set(dx / d * 0.8, 0, dz / d * 0.8); a.heading = Math.atan2(dx, dz); } } else a.vel.set(0, 0, 0);
    move(a, dt); animate(a, dt); a.bar.visible = false;
  }
}

/* ---------- posting ---------- */
export function postable(c) { const S = G.S; return !S.party.includes(c.id) && !S.taken.some(t => t.id === c.id); }
export function post(c, key) {
  unpost(c.id); G.S.posts[key].push(c.id); updateSigns(); refreshHome(); syncParty();
  emit('toast', `${c.name} → ${key.startsWith('guard') ? 'guarding ' + ZONE(key.slice(6)).name : key}`);
}
export function setSlot(c, slot) {
  const S = G.S;
  if (S.taken.some(t => t.id === c.id)) return;
  unpost(c.id); S.party[slot] = c.id; syncParty(); refreshHome();
}
export {where, hpBar, SPECIES};

/* ---------- night in the Bloomland ---------- */
let nightT = 0;
export function updateNightBloom(dt) {
  nightT -= dt; if (nightT > 0 || G.inDelve || G.player.dead) return; nightT = 4;
  const z = zoneAt(G.player.pos.x);
  if (z.kind !== 'bloom' || isClaimed(z.id) || !isNight()) return;
  const roaming = G.foes.filter(f => !f.target && !f.boss).length;
  if (roaming >= VR.BLOOMLING.nightCap) return;
  const an = rand() * 6.28, x = G.player.pos.x + Math.cos(an) * 18, zz = Math.max(-VR.WORLD_Z + 8, Math.min(VR.WORLD_Z - 8, G.player.pos.z + Math.sin(an) * 18));
  if (x < z.x0 || x > z.x1) return;
  makeFoe('bloomling', new THREE.Vector3(x, heightAt(x, zz), zz));
}
