/* Creature bodies built from the genome (hue, pattern, size, shine), wild behavior and the
   valley's populations. One merged mesh per creature keeps draw calls low on Quest. */
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {G, emit} from './ctx.js';
import {VR} from './data.js';
import {SPECIES, TYPES} from './sim-core/content.js';
import {rand} from './sim-core/rng.js';
import {stats, makeCreature, ZONE, zoneAt, isClaimed, isSafe, creatureById} from './state.js';
import {heightAt, isNight} from './world.js';
import {makeLabel, sfx} from './gfx.js';

const HUE_SHIFT = [0, 0.05, 0.12, 0.28, 0.45, 0.55, 0.72, 0.88];
const c1 = new THREE.Color(), c2 = new THREE.Color(), c3 = new THREE.Color();

function shifted(hex, hue) { const c = new THREE.Color(hex); if (hue) c.offsetHSL(HUE_SHIFT[hue] || 0, 0, 0); return c; }
// Pattern mask in the part's local space: 0 = base colour, 1 = shade colour.
function patternAt(pat, p) {
  switch (pat) {
    case 1: { const n = Math.sin(p.x * 23) * Math.sin(p.y * 19 + 1) * Math.sin(p.z * 21 + 2); return n > 0.35 ? 1 : 0; } // spots
    case 2: return Math.sin(p.z * 26 + p.y * 4) > 0.3 ? 1 : 0;   // stripes
    case 3: return Math.max(0, Math.min(1, 0.5 - p.y * 2.2));    // ombre
    case 4: return Math.sin(Math.hypot(p.x, p.z) * 34) > 0.45 ? 1 : 0; // rings
    case 5: { const gx = Math.floor(p.x * 14), gy = Math.floor(p.y * 14), gz = Math.floor(p.z * 14); return ((gx * 7 + gy * 13 + gz * 5) & 7) === 0 ? 1 : 0; } // runes
    default: return 0;
  }
}
// part(geo, colour mode, transform). mode: 'body' (patterned), 'shade', 'acc', 'eye', 'pale'
function part(geo, mode, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0]) {
  const g = geo.toNonIndexed(); g.scale(...scl); g.rotateX(rot[0]); g.rotateY(rot[1]); g.rotateZ(rot[2]); g.translate(...pos);
  g.userData.mode = mode; return g;
}
const sph = (r, d = 1) => new THREE.IcosahedronGeometry(r, d), cone = (r, h, s = 6) => new THREE.ConeGeometry(r, h, s), cyl = (a, b, h, s = 7) => new THREE.CylinderGeometry(a, b, h, s), boxg = (w, h, d) => new THREE.BoxGeometry(w, h, d);

function speciesParts(sp) {
  const eyes = (x, y, z, r = 0.05) => [part(sph(r, 0), 'eye', [x, y, z]), part(sph(r, 0), 'eye', [-x, y, z])];
  switch (sp) {
    case 'cindlet': return [part(sph(0.34, 2), 'body', [0, 0.36, 0]), part(cone(0.16, 0.42, 5), 'acc', [0, 0.82, -0.02]), part(cone(0.08, 0.22, 4), 'shade', [0.18, 0.66, 0], [1, 1, 1], [0, 0, -0.5]), part(cone(0.08, 0.22, 4), 'shade', [-0.18, 0.66, 0], [1, 1, 1], [0, 0, 0.5]), ...eyes(0.12, 0.46, 0.29)];
    case 'pyrrox': return [part(sph(0.3, 2), 'body', [0, 0.5, 0], [1, 0.85, 1.55]), part(sph(0.22, 1), 'body', [0, 0.72, 0.5]), part(cone(0.07, 0.24, 4), 'shade', [0.12, 0.96, 0.48]), part(cone(0.07, 0.24, 4), 'shade', [-0.12, 0.96, 0.48]), part(cone(0.14, 0.62, 5), 'acc', [0, 0.62, -0.62], [1, 1, 1], [-1.1, 0, 0]),
      ...[[0.14, 0.3], [-0.14, 0.3], [0.14, -0.28], [-0.14, -0.28]].map(([x, z]) => part(boxg(0.09, 0.32, 0.09), 'shade', [x, 0.16, z])), ...eyes(0.09, 0.78, 0.68, 0.045)];
    case 'puffcap': return [part(cyl(0.17, 0.22, 0.42), 'pale', [0, 0.21, 0]), part(sph(0.38, 2), 'body', [0, 0.46, 0], [1, 0.62, 1]), ...eyes(0.08, 0.26, 0.19)];
    case 'shroomite': return [part(sph(0.3, 1), 'shade', [0, 0.25, 0], [1.1, 0.6, 1.3]), part(sph(0.34, 2), 'body', [0, 0.42, -0.04], [1, 0.62, 1.1]), part(cone(0.06, 0.32, 4), 'acc', [0, 0.38, 0.46], [1, 1, 1], [1.2, 0, 0]),
      ...[-0.18, 0, 0.18].flatMap(z => [part(boxg(0.3, 0.05, 0.05), 'shade', [0.32, 0.1, z]), part(boxg(0.3, 0.05, 0.05), 'shade', [-0.32, 0.1, z])]), ...eyes(0.1, 0.3, 0.36, 0.04)];
    case 'dewdrip': return [part(sph(0.33, 2), 'body', [0, 0.34, 0]), part(cone(0.2, 0.36, 8), 'body', [0, 0.74, 0]), ...eyes(0.11, 0.42, 0.28)];
    case 'coralisk': return [part(sph(0.34, 1), 'body', [0, 0.32, 0], [1.3, 0.62, 1]), part(sph(0.13, 1), 'shade', [0.5, 0.36, 0.26]), part(sph(0.13, 1), 'shade', [-0.5, 0.36, 0.26]),
      ...[-0.2, 0, 0.2].map((x, i) => part(cone(0.06, 0.34 + i % 2 * 0.1, 4), 'acc', [x, 0.66, -0.04])), ...[-0.15, 0.15].flatMap(z => [part(boxg(0.36, 0.05, 0.05), 'shade', [0.4, 0.12, z]), part(boxg(0.36, 0.05, 0.05), 'shade', [-0.4, 0.12, z])]), ...eyes(0.1, 0.48, 0.28)];
    default: return [part(sph(0.35, 2), 'body', [0, 0.38, 0]), ...eyes(0.12, 0.46, 0.3)];
  }
}

export function buildBody(c) {
  const sp = SPECIES[c.species] || {col: '#cccccc', shade: '#777777', size: 1};
  const L = c.looks, base = shifted(sp.col, L.hue), shade = shifted(sp.shade, L.hue), acc = new THREE.Color(TYPES[c.type] ? TYPES[c.type].acc : '#ffd23f');
  const parts = speciesParts(c.species), v = new THREE.Vector3();
  for (const g of parts) {
    const p = g.attributes.position, col = new Float32Array(p.count * 3), mode = g.userData.mode;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      if (mode === 'eye') c1.set('#1a1020'); else if (mode === 'acc') c1.copy(acc); else if (mode === 'pale') c1.set('#f2e6cf'); else if (mode === 'shade') c1.copy(shade);
      else c1.copy(base).lerp(shade, patternAt(L.pat, v) * 0.85);
      col[i * 3] = c1.r; col[i * 3 + 1] = c1.g; col[i * 3 + 2] = c1.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv');
  }
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  const m = new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true});
  if (c.bloom) { m.emissive.set('#7a20c0'); m.emissiveIntensity = 0.35; }
  if (L.shine === 2) { m.emissive.set('#c050ff'); m.emissiveIntensity = 0.5; }
  const mesh = new THREE.Mesh(geo, m);
  const s = (sp.size || 1) * VR.CREATURE.sizes[L.size] * 1.25;
  mesh.scale.setScalar(s); mesh.userData.baseScale = s;
  return mesh;
}

/* ---------- actors ---------- */
export function makeActor(c, faction, pos) {
  const grp = new THREE.Group(), body = buildBody(c);
  grp.add(body); grp.position.copy(pos); G.scene.add(grp);
  const st = stats(c);
  const a = {c, faction, grp, body, pos: grp.position, vel: new THREE.Vector3(), heading: rand() * 6.28, st, maxHp: st.hp, hp: faction === 'party' ? Math.min(c.hp ?? st.hp, st.hp) : st.hp,
    state: 'wander', timer: 0, goal: null, target: null, attackT: 1 + rand() * 2, windup: 0, flash: 0, trust: 0, home: pos.clone(), zone: zoneAt(pos.x).id, height: 0.9 * body.userData.baseScale, dead: false, aggro: false};
  if (faction !== 'party') {
    a.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.68, 24), new THREE.MeshBasicMaterial({color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false}));
    a.ring.rotation.x = -Math.PI / 2; a.ring.position.y = 0.05; grp.add(a.ring);
  }
  a.bar = makeLabel([''], {w: 256, h: 48, scale: 0.7, bg: 'rgba(0,0,0,0)'}); a.bar.position.y = a.height + 0.45; grp.add(a.bar);
  return a;
}
export function removeActor(a) { a.dead = true; G.scene.remove(a.grp); if (a.faction !== 'foe') a.body.geometry.dispose(); a.body.material.dispose(); }

export function hpBar(a) {
  if (a.faction === 'foe') return;
  const f = Math.max(0, a.hp / a.maxHp), n = Math.round(f * 10);
  const name = a.faction === 'party' ? a.c.name : (a.c.owned ? `${a.c.name} (yours!)` : SPECIES[a.c.species].name + (a.c.bloom ? ' · Bloom' : ''));
  a.bar.set([`${name}  ${'█'.repeat(n)}${'░'.repeat(10 - n)}`]);
}

export const weakened = a => a.hp > 0 && a.hp / a.maxHp <= VR.CAGE.weakenedAt;
const PREDATORS = ['pyrrox', 'coralisk'], PREY = ['cindlet', 'dewdrip', 'puffcap'];

// Damage any actor. src: {from: 'player'|'party'|'wild'|'foe', elem}
export function hurt(a, dmg, src = {}) {
  if (a.dead || a.hp <= 0) return;
  dmg *= 1 - (a.st.armor || 0);
  if (a.c && a.c.traits && a.c.traits.includes('brittle')) dmg *= 1.2;
  a.hp -= dmg; a.flash = 0.12;
  emit('hit', a, dmg, src);
  if (a.faction === 'wild') {
    // Wild creatures are never killed by the player's side outright: they drop to 1 HP and stay weakened, so they can be caged.
    if (a.hp < 1 && src.from !== 'foe') a.hp = 1;
    if (!a.aggro) { a.aggro = true; const p = a.c.pers; a.state = (p === 'timid' || (p === 'calm' && rand() < 0.5) || (PREY.includes(a.c.species) && rand() < 0.4)) ? 'flee' : 'fight'; }
  }
  if (a.hp <= 0) emit('down', a, src);
  hpBar(a);
}

function steer(a, tx, tz, speed, dt) {
  const dx = tx - a.pos.x, dz = tz - a.pos.z, d = Math.hypot(dx, dz);
  if (d > 0.05) { a.heading = Math.atan2(dx, dz); a.vel.set(dx / d * speed, 0, dz / d * speed); } else a.vel.set(0, 0, 0);
  move(a, dt); return d;
}
export function move(a, dt) {
  let nx = a.pos.x + a.vel.x * dt, nz = a.pos.z + a.vel.z * dt;
  if (!G.inDelve || a.pos.z < 150) {
    const z0 = VR.ZONES[0].x0 + 2, z1 = VR.ZONES[VR.ZONES.length - 1].x1 - 2;
    nx = Math.max(z0, Math.min(z1, nx)); nz = Math.max(-VR.WORLD_Z + 6, Math.min(VR.WORLD_Z - 6, nz));
    if (a.faction === 'wild' && isSafe(nx) && !isClaimed(zoneAt(a.pos.x).id)) nx = Math.max(nx, a.pos.x); // wilds don't wander into your land
  } else { nx = Math.max(-10, Math.min(10, nx)); }
  a.pos.x = nx; a.pos.z = nz; a.pos.y = heightAt(nx, nz);
  a.grp.rotation.y += ((a.heading - a.grp.rotation.y + Math.PI * 3) % (Math.PI * 2) - Math.PI) * Math.min(1, dt * 8);
}

export function animate(a, dt) {
  const moving = a.vel.lengthSq() > 0.04, s = a.body.userData.baseScale;
  a.body.position.y = moving ? Math.abs(Math.sin(G.t * 9 + a.c.id)) * 0.08 : 0;
  const sq = a.windup > 0 ? 1 + Math.sin(G.t * 40) * 0.06 : 1;
  a.body.scale.set(s * sq, s * (a.state === 'sleep' ? 0.82 : 1) / sq, s * sq);
  const m = a.body.material;
  if (a.flash > 0) { a.flash -= dt; m.emissive.set('#ffffff'); m.emissiveIntensity = 0.8; }
  else if (a.windup > 0) { m.emissive.set(TYPES[a.c.type].color); m.emissiveIntensity = 0.6 + Math.sin(G.t * 30) * 0.3; }
  else if (a.faction === 'wild' && weakened(a)) { m.emissive.set('#fff2a0'); m.emissiveIntensity = 0.25 + 0.25 * Math.sin(G.t * 8); }
  else if (a.c.looks.shine === 1) { m.emissive.setHSL((G.t * 0.15 + a.c.id * 0.1) % 1, 0.8, 0.5); m.emissiveIntensity = 0.35; }
  else if (a.c.looks.shine === 2 || a.c.bloom) { m.emissive.set(a.c.looks.shine === 2 ? '#c050ff' : '#7a20c0'); m.emissiveIntensity = 0.3 + 0.15 * Math.sin(G.t * 3); }
  else m.emissiveIntensity = 0;
  if (a.ring) {
    const showTrust = a.trust > 0.01, w = weakened(a);
    a.ring.material.opacity = showTrust ? 0.9 : w ? 0.7 : 0;
    a.ring.material.color.set(showTrust ? '#7ee08a' : '#fff2a0');
    a.ring.scale.setScalar(showTrust ? 0.6 + a.trust * 1.2 : 1 + Math.sin(G.t * 6) * 0.08);
  }
  a.bar.visible = a.faction === 'party' || a.aggro || a.hp < a.maxHp || a.trust > 0;
  a.bar.quaternion.copy(G.camera.getWorldQuaternion(new THREE.Quaternion()));
  a.bar.quaternion.premultiply(a.grp.getWorldQuaternion(new THREE.Quaternion()).invert());
}

/* ---------- wild behaviour ---------- */
export function updateWild(a, dt) {
  const P = G.player, dp = Math.hypot(P.pos.x - a.pos.x, P.pos.z - a.pos.z), C = VR.CREATURE;
  const zone = ZONE(a.zone), calmLand = isClaimed(a.zone), bloom = zone && zone.kind === 'bloom' && !calmLand;
  const spd = a.st.spd * (weakened(a) ? 0.5 : 1);
  a.timer -= dt;
  if (a.windup > 0) {
    a.windup -= dt; a.vel.set(0, 0, 0);
    if (a.windup <= 0 && a.target && !weakened(a)) emit('wildFire', a, a.target);
    return;
  }
  // Bloom-touched creatures, and anything in the Bloomland at night, hunt the Keeper on sight.
  if (!a.aggro && !P.dead && !calmLand && (a.c.bloom || (bloom && isNight())) && dp < C.aggroRange) { a.aggro = true; a.state = 'fight'; }
  if (a.aggro && dp > C.sightRange * 1.4) { a.aggro = false; a.state = 'wander'; }
  if (isNight() && !a.aggro && !bloom && a.state !== 'sleep' && rand() < dt * 0.05) a.state = 'sleep';
  if (!isNight() && a.state === 'sleep') a.state = 'wander';
  switch (a.state) {
    case 'sleep': a.vel.set(0, 0, 0); if (dp < 2 && !P.crouch && P.speed > 2) { a.state = 'wander'; } break;
    case 'flee': {
      const dx = a.pos.x - P.pos.x, dz = a.pos.z - P.pos.z, d = Math.hypot(dx, dz) || 1;
      steer(a, a.pos.x + dx / d * 4, a.pos.z + dz / d * 4, spd * 1.25, dt);
      if (dp > C.fleeRange * 2.2) { a.state = 'wander'; a.aggro = false; }
      return;
    }
    case 'fight': {
      if (P.dead) { a.state = 'wander'; a.aggro = false; break; }
      // pick a target: whoever is closest of the player and the party
      let tgt = {pos: P.pos, isPlayer: true}, best = dp;
      for (const c of G.companions) { if (c.dead || c.hp <= 0) continue; const d = c.pos.distanceTo(a.pos); if (d < best - 1) { best = d; tgt = c; } }
      a.target = tgt;
      const want = weakened(a) ? 9 : 5.5, tp = tgt.pos;
      const ang = Math.atan2(a.pos.x - tp.x, a.pos.z - tp.z) + dt * 0.6, d = Math.hypot(a.pos.x - tp.x, a.pos.z - tp.z);
      const r = d < want - 1 ? d + 1 : d > want + 1 ? d - 1 : d;
      steer(a, tp.x + Math.sin(ang) * r, tp.z + Math.cos(ang) * r, spd, dt);
      a.heading = Math.atan2(tp.x - a.pos.x, tp.z - a.pos.z);
      a.attackT -= dt;
      if (a.attackT <= 0 && !weakened(a) && d < C.sightRange) { a.attackT = a.st.every * (0.8 + rand() * 0.4); a.windup = C.windup; sfx('warn'); }
      return;
    }
    case 'hunt': {
      const prey = a.goal && !a.goal.dead ? a.goal : null;
      if (!prey || a.timer < 0) { a.state = 'wander'; break; }
      if (steer(a, prey.pos.x, prey.pos.z, spd * 1.1, dt) < 0.8) { prey.state = 'flee2'; prey.goal = a; prey.timer = 3; a.state = 'wander'; a.timer = 6; }
      return;
    }
    case 'flee2': { // prey running from a predator
      const pr = a.goal; if (!pr || a.timer < 0) { a.state = 'wander'; break; }
      const dx = a.pos.x - pr.pos.x, dz = a.pos.z - pr.pos.z, d = Math.hypot(dx, dz) || 1;
      steer(a, a.pos.x + dx / d * 4, a.pos.z + dz / d * 4, spd * 1.3, dt); return;
    }
    default: { // wander and graze
      if (!a.goal || a.timer < 0) {
        a.timer = 3 + rand() * 6;
        a.goal = rand() < 0.4 ? null : new THREE.Vector3(a.home.x + (rand() - 0.5) * 16, 0, a.home.z + (rand() - 0.5) * 16);
        // predators sometimes stalk nearby prey: a small food chain the Keeper can watch or use
        if (PREDATORS.includes(a.c.species) && rand() < 0.3) {
          const prey = G.wilds.find(w => w !== a && PREY.includes(w.c.species) && w.pos.distanceTo(a.pos) < 12);
          if (prey) { a.state = 'hunt'; a.goal = prey; a.timer = 8; return; }
        }
        // the Curious come to look at you; the Timid keep their distance
        if (a.c.pers === 'curious' && dp < 14) a.goal = P.pos.clone();
      }
      if (a.c.pers === 'timid' && dp < 4 && !P.crouch) { a.state = 'flee'; a.timer = 4; return; }
      if (a.goal) { if (steer(a, a.goal.x, a.goal.z, spd * 0.45, dt) < 0.6) a.goal = null; } else a.vel.set(0, 0, 0);
    }
  }
  move(a, 0);
}

/* ---------- populations ---------- */
const MAX_LIVE = 10;
export function spawnWild(zoneId, near, o = {}) {
  const z = ZONE(zoneId), S = G.S, pop = S.zones[zoneId].pop;
  const pool = z.species.filter(sp => pop[sp] > 0); if (!pool.length && !o.creature) return null;
  let sp = o.creature ? o.creature.species : null;
  if (!sp) { const ws = pool.map(s => pop[s] * (z.weights[z.species.indexOf(s)] || 1)); let x = rand() * ws.reduce((a, b) => a + b, 0); sp = pool[pool.length - 1]; for (let i = 0; i < pool.length; i++) { x -= ws[i]; if (x < 0) { sp = pool[i]; break; } } }
  let x, zz, tries = 0;
  do { const ang = rand() * 6.28, r = 14 + rand() * 18; x = near.x + Math.cos(ang) * r; zz = near.z + Math.sin(ang) * r; tries++; }
  while ((x < z.x0 + 2 || x > z.x1 - 2 || Math.abs(zz) > VR.WORLD_Z - 8) && tries < 20);
  x = Math.max(z.x0 + 2, Math.min(z.x1 - 2, x)); zz = Math.max(-VR.WORLD_Z + 8, Math.min(VR.WORLD_Z - 8, zz));
  const bloom = z.kind === 'bloom' && !isClaimed(zoneId) && rand() < 0.5;
  const c = o.creature || makeCreature(sp, {floor: z.floor, bloom, lvl: z.floor + Math.floor(rand() * 3), id: -1 - Math.floor(rand() * 1e9)});
  const a = makeActor(c, 'wild', new THREE.Vector3(x, heightAt(x, zz), zz));
  a.zone = zoneId; hpBar(a); G.wilds.push(a);
  return a;
}
export function updatePopulations(dt) {
  const P = G.player; if (G.inDelve || P.dead) return;
  G.popT = (G.popT || 0) - dt; if (G.popT > 0) return; G.popT = 1.5;
  // despawn far-off wilds (they return to the population)
  for (const a of G.wilds.slice()) if (a.pos.distanceTo(P.pos) > 70) { removeActor(a); G.wilds.splice(G.wilds.indexOf(a), 1); }
  for (const z of VR.ZONES.slice(1)) {
    const near = P.pos.x > z.x0 - 25 && P.pos.x < z.x1 + 25; if (!near) continue;
    // fallen companions roam their zone as Bloom-taken wilds until recovered or the window closes
    for (const t of G.S.taken) if (t.zone === z.id && !G.wilds.some(w => w.c.id === t.id)) { const c = creatureById(t.id); if (c) { c.owned = true; spawnWild(z.id, P.pos, {creature: c}); } }
    const live = G.wilds.filter(w => w.zone === z.id && !w.c.owned).length;
    const total = Object.values(G.S.zones[z.id].pop).reduce((a, b) => a + b, 0);
    for (let i = 0, want = Math.min(MAX_LIVE, total) - live; i < Math.min(3, want); i++) spawnWild(z.id, P.pos);
  }
}
export function regrowPopulations() {
  for (const z of VR.ZONES.slice(1)) {
    const pop = G.S.zones[z.id].pop;
    z.species.forEach((sp, i) => { const cap = Math.max(1, Math.round(z.capacity * z.weights[i] / 100 * 2)); pop[sp] = Math.min(cap, (pop[sp] || 0) + Math.ceil((cap - (pop[sp] || 0)) * 0.3)); });
  }
}
