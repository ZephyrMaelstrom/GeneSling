/* Combat: projectiles, the sling, cages, taming, companions, skills and combos,
   Bloomlings and Rootmaw. */
import * as THREE from 'three';
import {G, on, emit} from './ctx.js';
import {VR} from './data.js';
import {TYPES, comboFor} from './sim-core/content.js';
import {rand} from './sim-core/rng.js';
import {mat, sfx} from './gfx.js';
import {makeActor, removeActor, hurt, weakened, animate, move, hpBar} from './creatures.js';
import {heightAt, DELVE_ROOMS} from './world.js';
import {creatureById, stats, creatureXp, keeperXp, bondUp, objective, zoneAt, isSafe, has, take, give, unpost} from './state.js';

const ELEM_COL = {ember: '#ff7a3d', fungal: '#c04ad8', tide: '#5cc8ff', foe: '#c060ff', player: '#e8e0d0'};
const shotGeo = new THREE.IcosahedronGeometry(1, 1), ringGeo = new THREE.TorusGeometry(1.25, 0.18, 4, 12);
const shotMats = {}, ringMat = new THREE.MeshBasicMaterial({color: '#ffffff'});
const shotMat = c => shotMats[c] ||= new THREE.MeshBasicMaterial({color: c});
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();

/* ---------- haptics ---------- */
export function buzz(hand, strength, ms) {
  const s = G.xrSession; if (!s) return;
  for (const src of s.inputSources) if (!hand || src.handedness === hand) {
    const h = src.gamepad && src.gamepad.hapticActuators && src.gamepad.hapticActuators[0];
    if (h && h.pulse) h.pulse(strength, ms);
  }
}

/* ---------- projectiles ---------- */
export function fire(from, pos, vel, dmg, o = {}) {
  const col = ELEM_COL[o.elem || from] || '#ffffff', r = o.r || (from === 'player' ? 0.07 : 0.14);
  const m = new THREE.Mesh(shotGeo, shotMat(col)); m.scale.setScalar(r); m.position.copy(pos);
  if (from === 'wild' || from === 'foe') { const ring = new THREE.Mesh(ringGeo, ringMat); m.add(ring); m.userData.ring = ring; } // enemy shots keep GeneSling's white ring
  G.scene.add(m);
  G.shots.push({m, pos: m.position, vel: vel.clone(), from, dmg, elem: o.elem, owner: o.owner, life: o.life || 4, grav: o.grav || 0, r});
}
function playerHit(p) {
  // The player's body is a capsule from the head down to the floor, so leaning and ducking dodge.
  const head = G.camera.getWorldPosition(v3), feetY = G.player.pos.y;
  if (p.y > head.y + 0.15 || p.y < feetY) return false;
  const dx = p.x - head.x, dz = p.z - head.z, rr = p.y > head.y - 0.35 ? 0.2 : 0.3;
  return dx * dx + dz * dz < rr * rr;
}
function actorHit(a, p, extra = 0) {
  const s = a.body.userData.baseScale || 1, cy = a.pos.y + 0.4 * s, rad = 0.42 * s + extra;
  const dx = p.x - a.pos.x, dy = p.y - cy, dz = p.z - a.pos.z;
  return dx * dx + dy * dy * 0.6 + dz * dz < rad * rad;
}
export function updateShots(dt) {
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i]; s.life -= dt;
    s.vel.y -= s.grav * dt; s.pos.addScaledVector(s.vel, dt);
    if (s.m.userData.ring) s.m.userData.ring.lookAt(G.camera.getWorldPosition(v1));
    let done = s.life <= 0 || s.pos.y < (G.inDelve ? 0 : heightAt(s.pos.x, s.pos.z)) - 0.05;
    if (!done && (s.from === 'player' || s.from === 'party')) {
      for (const list of [G.wilds, G.foes]) for (const a of list) {
        if (done || a.dead || a.hp <= 0 || a.caged) continue;
        if (s.from === 'party' && a.faction === 'wild' && weakened(a) && s.owner && s.owner.cmd !== a) continue; // companions spare weakened wilds
        if (actorHit(a, s.pos)) { done = true; hurt(a, s.dmg, {from: s.from, owner: s.owner}); if (s.from === 'player') { sfx('hit'); buzz('right', 0.4, 20); objective('sling'); } }
      }
    } else if (!done) {
      if (!G.player.dead && playerHit(s.pos)) { done = true; hurtPlayer(s.dmg); }
      if (!done) for (const c of G.companions) if (!c.dead && c.hp > 0 && c.slot < 2 && actorHit(c, s.pos)) { done = true; hurt(c, s.dmg, {from: s.from}); break; }
      if (!done && G.surge && G.surge.stone && s.pos.distanceTo(G.surge.stone.position) < 1.2) { done = true; G.surge.hp -= s.dmg; }
    }
    if (done) { G.scene.remove(s.m); G.shots.splice(i, 1); }
  }
}

/* ---------- the player ---------- */
export function hurtPlayer(dmg) {
  const P = G.player; if (P.dead || G.godMode) return;
  P.hp -= dmg; sfx('hurt'); buzz(null, 0.7, 60); emit('playerHurt');
  if (P.hp < P.maxHp * 0.25 && take('tonic')) { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.4); emit('toast', 'Drank a tonic'); sfx('heal'); }
  if (P.hp <= 0) { P.hp = 0; emit('playerDown'); }
}

// Aim assist: bend the shot up to a few degrees toward the nearest target in the cone.
function assist(origin, dir) {
  if (!G.S.settings.aimAssist) return dir;
  const lim = Math.cos(VR.SLING.assistDeg * Math.PI / 180); let best = null, bestDot = lim;
  for (const a of [...G.wilds, ...G.foes]) {
    if (a.dead || a.hp <= 0 || a.caged) continue;
    v1.set(a.pos.x, a.pos.y + 0.4 * (a.body.userData.baseScale || 1), a.pos.z).sub(origin);
    const d = v1.length(); if (d > 40) continue; v1.divideScalar(d);
    const dot = v1.dot(dir); if (dot > bestDot) { bestDot = dot; best = v1.clone(); }
  }
  return best ? dir.clone().lerp(best, 0.85).normalize() : dir;
}
// draw: 0..1 of a full draw
export function slingShot(origin, dir, draw) {
  const L = VR.SLING; draw = Math.max(0.15, Math.min(1, draw));
  const d = assist(origin, dir.clone().normalize());
  fire('player', origin, d.multiplyScalar(L.minSpeed + (L.maxSpeed - L.minSpeed) * draw), L.baseDamage + (L.maxDamage - L.baseDamage) * draw, {grav: L.gravity, life: 3});
  sfx('sling'); buzz('right', 0.25 + draw * 0.5, 30);
}

/* ---------- cages ---------- */
const cageGeo = new THREE.IcosahedronGeometry(0.16, 0), cageMat = mat('#d9c38a', {emissive: '#6a5020', wireframe: false});
export function throwCage(origin, vel) {
  if (!take('cage')) { emit('toast', 'No cages left'); return false; }
  const m = new THREE.Mesh(cageGeo, cageMat); m.position.copy(origin); G.scene.add(m);
  G.cages.push({m, pos: m.position, vel: vel.clone(), state: 'fly', t: 0, clean: vel.length() > 6});
  sfx('cage'); buzz('right', 0.3, 30); return true;
}
export function catchChance(a, clean) {
  const C = VR.CAGE, miss = 1 - a.hp / a.maxHp;
  let p = C.base + C.missingHpBonus * Math.pow(miss, 1.3) + (weakened(a) ? C.weakBonus : 0) + (clean ? C.cleanThrowBonus : 0) - (a.c.bloom ? C.bloomPenalty : 0);
  if (a.c.owned) p = Math.max(p, 0.85); // your own Bloom-taken companion wants to come home
  if (zoneAt(a.pos.x) && G.S.zones[zoneAt(a.pos.x).id] && G.S.zones[zoneAt(a.pos.x).id].claimed) p += 0.1;
  return Math.max(C.minChance, Math.min(C.maxChance, p));
}
export function updateCages(dt) {
  const C = VR.CAGE;
  for (let i = G.cages.length - 1; i >= 0; i--) {
    const k = G.cages[i];
    if (k.state === 'fly') {
      k.vel.y -= C.gravity * dt; k.pos.addScaledVector(k.vel, dt); k.m.rotation.x += dt * 8;
      const hit = G.wilds.find(a => !a.dead && !a.caged && actorHit(a, k.pos, C.burstRadius * 0.4));
      if (hit) {
        k.state = 'shake'; k.target = hit; k.t = 0; k.shakes = 0; k.chance = catchChance(hit, k.clean);
        k.roll = rand(); hit.caged = true; hit.body.visible = false; hit.bar.visible = false;
        k.m.scale.setScalar(2.6); k.pos.set(hit.pos.x, hit.pos.y + 0.35, hit.pos.z); sfx('cage');
      } else if (k.pos.y < heightAt(k.pos.x, k.pos.z) || k.t > 4) { k.state = 'ground'; k.t = 0; k.pos.y = heightAt(k.pos.x, k.pos.z) + 0.16; }
      k.t += dt;
    } else if (k.state === 'shake') {
      k.t += dt; const a = k.target;
      k.m.rotation.z = Math.sin(k.t * 22) * 0.35 * Math.max(0, 1 - (k.t % C.shakeSeconds) / C.shakeSeconds * 2);
      if (k.t > C.shakeSeconds * (k.shakes + 1)) {
        k.shakes++; sfx('shake'); buzz('right', 0.5, 60);
        // each shake is one third of the roll: escaping early means the roll missed by a lot
        const passed = k.roll < Math.pow(k.chance, k.shakes / C.shakes);
        if (!passed) { a.caged = false; a.body.visible = true; a.hp = Math.min(a.maxHp, a.hp + a.maxHp * 0.1); a.aggro = true; a.state = 'flee'; sfx('escape'); emit('toast', `${a.c.owned ? a.c.name : 'It'} broke free (${Math.round(k.chance * 100)}% chance)`); remove(i); continue; }
        if (k.shakes >= C.shakes) { caught(a, 'cage'); remove(i); continue; }
      }
    } else if (k.state === 'ground') {
      k.t += dt; k.m.rotation.y += dt;
      if (k.pos.distanceTo(G.player.pos) < 1.4) { give('cage'); emit('toast', 'Picked the cage back up'); remove(i); continue; }
      if (k.t > 12) { remove(i); continue; }
    }
  }
  function remove(i) { G.scene.remove(G.cages[i].m); G.cages.splice(i, 1); }
}

// A wild creature joins you, by cage or by taming.
export function caught(a, how) {
  const S = G.S, c = a.c;
  removeActor(a); G.wilds.splice(G.wilds.indexOf(a), 1);
  if (c.owned) { // a fallen companion, recovered
    delete c.owned; c.bloom = false; S.taken = S.taken.filter(t => t.id !== c.id);
    c.hp = stats(c).hp; c.history.push(`Recovered from the Bloom on day ${S.day}`);
    const slot = S.party.indexOf(null);
    if (slot >= 0 && slot < 2) { S.party[slot] = c.id; G.syncParty(); emit('toast', `${c.name} is back with you!`); }
    else emit('toast', `${c.name} recovered — waiting at home`);
    sfx('caught'); return;
  }
  c.id = S.nextId++; c.history.push(`${how === 'tame' ? 'Tamed' : 'Caged'} in ${zoneAt(a.pos.x).name} on day ${S.day}`);
  if (how === 'tame') { c.bond = VR.TAME.startBond; S.stats.tames++; keeperXp(VR.KEEPER_XP.tame, 'tame'); objective('tame'); }
  else { S.stats.catches++; keeperXp(VR.KEEPER_XP.catch, 'catch'); objective('cage'); }
  c.hp = stats(c).hp;
  const zid = zoneAt(a.pos.x).id; if (S.zones[zid] && S.zones[zid].pop[c.species] > 0) S.zones[zid].pop[c.species]--;
  S.lineage[c.id] = {mom: null, dad: null};
  for (const comp of G.companions) if (comp.slot < 2) creatureXp(comp.c, 10);
  if (isSafe(G.player.pos.x) || !S.trip) { S.roster.push(c); emit('toast', `${c.name} the ${c.species} joins you`); }
  else { S.trip.caught.push(c); emit('toast', `${c.name} caught — bring it home to keep it`); }
  emit('caught', c, how); sfx(how === 'tame' ? 'tame' : 'caught'); buzz(null, 0.6, 120);
}

/* ---------- taming: offer food, keep still ---------- */
export function updateTame(dt, offering, handPos) {
  const P = G.player, T = VR.TAME;
  let target = null, best = T.range;
  if (offering) for (const a of G.wilds) {
    if (a.dead || a.caged || a.aggro || a.c.bloom || weakened(a)) continue;
    const d = a.pos.distanceTo(handPos); if (d < best) { best = d; target = a; }
  }
  for (const a of G.wilds) if (a !== target && a.trust > 0) a.trust = Math.max(0, a.trust - T.decayPerSecond * dt);
  G.tameTarget = target;
  if (!target) return;
  if (!has('food') && !has('lure')) { emit('hint', 'You need food or lure to tame'); return; }
  if (P.speed > T.maxPlayerSpeed) { target.trust = Math.max(0, target.trust - dt); if (target.c.pers === 'timid') { target.state = 'flee'; target.timer = 3; } return; }
  let rate = 1 / T.seconds * (P.crouch ? 1.3 : 1) * (has('lure') ? 2 : 1);
  if (target.c.pers === 'timid') rate /= T.timidFactor; if (target.c.pers === 'curious') rate /= T.curiousFactor;
  if (G.claimedHere) rate *= 1.4;
  target.state = 'wander'; target.goal = handPos.clone(); target.timer = 2; // it comes to sniff your hand
  target.trust += rate * dt; hpBar(target);
  if (Math.floor(target.trust * 8) !== Math.floor((target.trust - rate * dt) * 8)) buzz('left', 0.15, 20);
  if (target.trust >= 1) { take(has('lure') ? 'lure' : 'food'); caught(target, 'tame'); G.tameTarget = null; }
}

/* ---------- companions ---------- */
export function syncParty() {
  const S = G.S;
  for (const c of G.companions) { c.c.hp = Math.max(1, Math.round(c.hp)); removeActor(c); }
  G.companions = [];
  S.party.forEach((id, slot) => {
    const c = id && creatureById(id); if (!c) return;
    const p = G.player.pos, a = makeActor(c, 'party', new THREE.Vector3(p.x - 1.5 + slot * 1.5, p.y, p.z - 2));
    a.slot = slot; a.skillT = 0; a.mode = 'follow'; hpBar(a); G.companions.push(a);
  });
}
G.syncParty = syncParty;
let lastSkill = null;
export function commandAttack(target) { for (const c of G.companions) if (c.slot < 2) { c.cmd = target; c.mode = 'attack'; } emit('toast', target ? `Go! (${target.c ? target.c.name || target.c.species : 'target'})` : 'Go!'); }
export function commandRecall() { for (const c of G.companions) { c.cmd = null; c.mode = 'recall'; c.timer = 4; } emit('toast', 'Back to me'); }
export function useSkill(slot) {
  const a = G.companions.find(c => c.slot === slot); if (!a || a.hp <= 0) return;
  if (a.skillT > 0) { emit('toast', `${a.c.name}'s skill recharges in ${Math.ceil(a.skillT)} s`); return; }
  a.skillT = a.st.cd; const sk = VR.SKILLS[a.c.type], P = G.player;
  sfx('skill'); buzz(null, 0.4, 40);
  if (a.c.type === 'fungal') { P.hp = Math.min(P.maxHp, P.hp + P.maxHp * sk.heal); for (const c of G.companions) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * sk.heal); }
  else for (const t of hostiles()) { const d = t.pos.distanceTo(a.pos); if (d < sk.radius) { hurt(t, sk.damage + a.st.atk, {from: 'party', owner: a}); if (sk.push) { v1.subVectors(t.pos, a.pos).setY(0).normalize().multiplyScalar(sk.push); t.pos.add(v1); } } }
  burst(a.pos, ELEM_COL[a.c.type], sk.radius || 2.5);
  emit('toast', `${a.c.name}: ${sk.name}`);
  // Combo: both combat companions' skills within the window
  if (lastSkill && lastSkill.slot !== slot && G.t - lastSkill.t < VR.COMPANION.comboWindow) {
    const other = G.companions.find(c => c.slot === lastSkill.slot), cb = comboFor(a.c.type, other ? other.c.type : a.c.type);
    for (const t of hostiles()) if (t.pos.distanceTo(P.pos) < 9) hurt(t, VR.COMPANION.comboDamage, {from: 'party', owner: a});
    P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.1);
    burst(P.pos, '#ffd23f', 8); sfx('combo'); buzz(null, 1, 120); G.hitstop = 0.04;
    emit('toast', `COMBO — ${cb.name}`); lastSkill = null;
  } else lastSkill = {slot, t: G.t};
}
const hostiles = () => [...G.wilds.filter(w => w.aggro && !w.caged), ...G.foes].filter(t => !t.dead && t.hp > 0);
function burst(pos, col, r) {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 32), new THREE.MeshBasicMaterial({color: col, transparent: true, opacity: 0.8, side: THREE.DoubleSide}));
  m.rotation.x = -Math.PI / 2; m.position.set(pos.x, pos.y + 0.15, pos.z); G.scene.add(m);
  G.fx.push({m, t: 0, life: 0.5, r});
}
export function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; const k = f.t / f.life; f.m.scale.setScalar(1 + k * f.r * 1.6); f.m.material.opacity = 0.8 * (1 - k); if (k >= 1) { G.scene.remove(f.m); f.m.geometry.dispose(); G.fx.splice(i, 1); } }
}

export function updateCompanions(dt) {
  const P = G.player;
  const fwd = v2.set(-Math.sin(P.yaw), 0, -Math.cos(P.yaw));
  for (const a of G.companions) {
    if (a.dead) continue;
    a.skillT = Math.max(0, a.skillT - dt); a.attackT -= dt; a.timer -= dt;
    const C = VR.COMPANION, spd = a.st.spd * 1.6;
    // slot 3 always follows; combat slots fight when there is something to fight
    let tgt = null;
    if (a.slot < 2 && a.mode !== 'recall') {
      if (a.cmd && !a.cmd.dead && a.cmd.hp > 0 && !a.cmd.caged) tgt = a.cmd; else { a.cmd = null; if (a.mode === 'attack') a.mode = 'follow'; }
      if (!tgt) { let best = 11; for (const h of hostiles()) { if (h.faction === 'wild' && weakened(h)) continue; const d = h.pos.distanceTo(a.pos); if (d < best) { best = d; tgt = h; } } }
    }
    if (a.mode === 'recall' && a.timer < 0) a.mode = 'follow';
    if (tgt) {
      const d = tgt.pos.distanceTo(a.pos), want = a.c.species === 'puffcap' || a.c.species === 'dewdrip' ? 5 : 3.5;
      if (d > want + 0.5) { v1.subVectors(tgt.pos, a.pos).setY(0).normalize(); a.vel.copy(v1.multiplyScalar(spd)); } else a.vel.set(0, 0, 0);
      a.heading = Math.atan2(tgt.pos.x - a.pos.x, tgt.pos.z - a.pos.z);
      if (a.attackT <= 0 && d < 12) {
        a.attackT = a.st.every;
        const o = v1.set(a.pos.x, a.pos.y + 0.4 * a.body.userData.baseScale, a.pos.z);
        const aim = v3.set(tgt.pos.x, tgt.pos.y + 0.4 * (tgt.body.userData.baseScale || 1), tgt.pos.z).sub(o).normalize().multiplyScalar(11);
        fire('party', o, aim, a.st.atk, {owner: a, elem: a.c.type});
      }
    } else {
      const side = a.slot === 0 ? 1 : a.slot === 1 ? -1 : 0, back = a.slot === 2 ? 3.2 : C.followDist;
      const tx = P.pos.x - fwd.x * back + fwd.z * side * 1.6, tz = P.pos.z - fwd.z * back - fwd.x * side * 1.6;
      const d = Math.hypot(tx - a.pos.x, tz - a.pos.z);
      if (d > 30) { a.pos.set(tx, heightAt(tx, tz), tz); a.vel.set(0, 0, 0); }
      else if (d > 0.6) { a.vel.set((tx - a.pos.x) / d * Math.min(spd * 1.4, d * 2), 0, (tz - a.pos.z) / d * Math.min(spd * 1.4, d * 2)); a.heading = Math.atan2(a.vel.x, a.vel.z); }
      else a.vel.set(0, 0, 0);
    }
    move(a, dt);
    if (G.inDelve) a.pos.y = 0;
    // Fungal bond passive (Mend): heals you while it is near
    if (a.c.type === 'fungal' && a.c.bond >= 60 && a.pos.distanceTo(P.pos) < 4 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + 1.5 * dt);
    animate(a, dt);
  }
}
on('down', (a) => {
  if (a.faction === 'party') {
    const S = G.S, c = a.c, zone = G.inDelve ? 'blight' : zoneAt(a.pos.x).id;
    removeActor(a); G.companions = G.companions.filter(x => x !== a);
    unpost(c.id);
    if (zone === 'home') { c.hp = 1; emit('toast', `${c.name} is knocked out`); return; }
    S.taken.push({id: c.id, zone, until: S.day + VR.RECOVER_DAYS});
    c.history.push(`Taken by the Bloom in ${zone} on day ${S.day}`);
    emit('toast', `${c.name} fell — the Bloom took it. Recover it within ${VR.RECOVER_DAYS} days!`);
    sfx('escape');
  } else if (a.faction === 'foe') {
    sfx('kill'); buzz('right', 0.8, 60);
    for (const c of G.companions) creatureXp(c.c, a.boss ? 120 : 8);
    if (a.boss) emit('bossDown', a);
    removeActor(a); G.foes = G.foes.filter(x => x !== a);
  }
});
on('hit', (a, dmg, src) => {
  if (src.owner && src.owner.c) creatureXp(src.owner.c, 1);
  if (a.faction === 'wild' && src.from === 'player' && G.hitstop <= 0 && weakened(a)) G.hitstop = 0.03;
});

/* ---------- Bloomlings and Rootmaw ---------- */
const bloomGeo = (() => { const g = new THREE.IcosahedronGeometry(0.4, 0); return g; })();
const spikeGeo = new THREE.ConeGeometry(0.1, 0.5, 4);
export function makeFoe(kind, pos, o = {}) {
  const grp = new THREE.Group(); grp.position.copy(pos); G.scene.add(grp);
  const B = kind === 'boss' ? VR.BOSS : VR.BLOOMLING, scale = kind === 'boss' ? 3.2 : 1;
  const m = new THREE.MeshLambertMaterial({color: kind === 'boss' ? '#5a2a7a' : '#8a3fd1', emissive: '#4a1080', emissiveIntensity: 0.5, flatShading: true});
  const body = new THREE.Mesh(bloomGeo, m); body.position.y = 0.5; grp.add(body);
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 8; i++) { const dir = new THREE.Vector3(Math.sin(i * 2.4) * Math.cos(i * 0.9), Math.cos(i * 1.7) * 0.8 + 0.2, Math.cos(i * 2.4) * Math.cos(i * 0.9)).normalize(); const s = new THREE.Mesh(spikeGeo, m); s.position.copy(dir).multiplyScalar(0.42); s.quaternion.setFromUnitVectors(up, dir); body.add(s); }
  grp.scale.setScalar(scale); body.userData.baseScale = 1;
  const a = {kind, boss: kind === 'boss', grp, body, pos: grp.position, vel: new THREE.Vector3(), faction: 'foe', c: {name: kind === 'boss' ? B.name : 'Bloomling', species: 'bloomling', looks: {shine: 0}},
    st: {armor: 0, spd: B.speed || 1.2}, hp: B.hp * (o.hpMul || 1), maxHp: B.hp * (o.hpMul || 1), attackT: 1 + rand() * 2, ringT: 2, dead: false, flash: 0, target: o.target || null, summoned: false};
  a.bar = {set() {}, visible: false};
  G.foes.push(a); return a;
}
export function updateFoes(dt) {
  const P = G.player;
  for (const a of G.foes) {
    if (a.dead) continue;
    a.attackT -= dt; a.flash -= dt;
    a.body.material.emissiveIntensity = a.flash > 0 ? 1.5 : 0.5 + Math.sin(G.t * 4) * 0.2;
    a.body.rotation.y += dt * (a.boss ? 0.4 : 2);
    // targets: the Ward Stone during a Surge, else the nearest of you and your party
    let tp = P.pos, d = P.pos.distanceTo(a.pos);
    if (a.target === 'stone' && G.surge) { tp = G.surge.stone.position; d = tp.distanceTo(a.pos); }
    else for (const c of G.companions) if (c.slot < 2 && !c.dead) { const dc = c.pos.distanceTo(a.pos); if (dc < d - 2) { d = dc; tp = c.pos; } }
    const origin = v1.set(a.pos.x, a.pos.y + 0.5 * a.grp.scale.y, a.pos.z);
    if (a.boss) {
      a.ringT -= dt;
      if (a.ringT <= 0) { a.ringT = VR.BOSS.ringEvery * (a.hp < a.maxHp / 2 ? 0.7 : 1); const n = VR.BOSS.ringShots, off = rand(); for (let i = 0; i < n; i++) { const an = (i + off) / n * Math.PI * 2; fire('foe', origin, v2.set(Math.cos(an), 0, Math.sin(an)).multiplyScalar(4.2), VR.BOSS.damage, {life: 6}); } sfx('warn'); }
      if (a.attackT <= 0) { a.attackT = VR.BOSS.aimedEvery; const dir = v3.copy(G.camera.getWorldPosition(v3)).sub(origin).normalize(); for (const s of [-0.18, 0, 0.18]) fire('foe', origin, dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), s).multiplyScalar(6), VR.BOSS.damage, {life: 6}); }
      if (!a.summoned && a.hp < a.maxHp / 2) { a.summoned = true; for (let i = 0; i < 3; i++) makeFoe('bloomling', new THREE.Vector3(a.pos.x + (i - 1) * 4, 0, a.pos.z - 3)); emit('toast', 'Rootmaw calls its brood!'); }
      continue;
    }
    if (d > 5) { v2.subVectors(tp, a.pos).setY(0).normalize().multiplyScalar(a.st.spd); a.vel.copy(v2); } else a.vel.set(0, 0, 0);
    a.pos.addScaledVector(a.vel, dt); a.pos.y = G.inDelve || a.pos.z > 150 ? 0 : heightAt(a.pos.x, a.pos.z);
    if (a.attackT <= 0 && d < 16) {
      a.attackT = VR.BLOOMLING.shotEvery * (0.8 + rand() * 0.4);
      const aim = v3.copy(a.target === 'stone' && G.surge ? G.surge.stone.position : tp === P.pos ? G.camera.getWorldPosition(v3) : v3.copy(tp).setY(tp.y + 0.4)).sub(origin).normalize().multiplyScalar(VR.CREATURE.shotSpeed);
      fire('foe', origin, aim, VR.BLOOMLING.damage);
    }
  }
}
on('hit', (a) => { if (a.faction === 'foe') a.flash = 0.1; });

// Wild creatures fire at their target when a wind-up ends.
on('wildFire', (a, tgt) => {
  const o = v1.set(a.pos.x, a.pos.y + 0.4 * a.body.userData.baseScale, a.pos.z);
  const tp = tgt.isPlayer ? G.camera.getWorldPosition(v2) : v2.set(tgt.pos.x, tgt.pos.y + 0.4, tgt.pos.z);
  const spd = a.c.bloom ? VR.CREATURE.shotSpeedBloom : VR.CREATURE.shotSpeed;
  fire('wild', o, v3.copy(tp).sub(o).normalize().multiplyScalar(spd), a.st.atk, {elem: a.c.type});
});

export {DELVE_ROOMS, animate};
