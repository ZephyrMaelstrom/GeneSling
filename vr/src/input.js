/* Input for both ways to play.
   Flat screen: WASD, mouse look, mouse buttons for sling and cage, keys for the rest.
   VR (WebXR, Quest): left stick moves, right stick turns or teleports. The frame hand holds the
   sling; pinch the pouch with the other hand's trigger, pull and release. The other hand's grip
   makes a cage to throw. The frame hand's trigger offers food. A: send companions / use, B: recall,
   X / Y: skills, left stick press: wrist panel. Left-handed mode swaps the hands. */
import * as THREE from 'three';
import {G, emit} from './ctx.js';
import {VR} from './data.js';
import {mat, sfx, audioInit} from './gfx.js';
import {heightAt, DELVE_Z} from './world.js';
import {slingShot, throwCage, updateTame, commandAttack, commandRecall, useSkill, buzz} from './combat.js';
import {borderBlock, startTrip} from './home.js';
import {isSafe, borderX} from './state.js';

const keys = {}, v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), q1 = new THREE.Quaternion();
const ray = new THREE.Raycaster();
let mouse = {down: false, rdown: false, t0: 0, rt0: 0, nx: 0, ny: 0, click: false};

export function initInput(canvas) {
  const P = G.player;
  addEventListener('keydown', e => {
    if (e.repeat) return; keys[e.code] = true; audioInit();
    if (e.code === 'Tab') { e.preventDefault(); if (G.panelKind) G.closePanel(); else G.openPanel('wrist'); }
    if (e.code === 'Escape' && G.panelKind) G.closePanel();
    if (G.panelKind || P.dead) return;
    if (e.code === 'KeyE') useTarget();
    if (e.code === 'KeyC') P.crouchToggle = !P.crouchToggle;
    if (e.code === 'KeyQ') commandAttack(aimedActor(G.camera.getWorldPosition(v1), camFwd(v2)));
    if (e.code === 'KeyX') commandRecall();
    if (e.code === 'Digit1') useSkill(0);
    if (e.code === 'Digit2') useSkill(1);
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => {
    audioInit();
    if (G.panelKind) { setMouse(e); mouse.click = true; return; }
    if (!document.pointerLockElement) { canvas.requestPointerLock && canvas.requestPointerLock(); return; }
    if (P.dead) return;
    if (e.button === 0) { mouse.down = true; mouse.t0 = G.t; }
    if (e.button === 2) { mouse.rdown = true; mouse.rt0 = G.t; }
  });
  addEventListener('mouseup', e => {
    if (e.button === 0 && mouse.down) { mouse.down = false; const draw = Math.min(1, (G.t - mouse.t0) / VR.SLING.drawSeconds); slingShot(slingOrigin(), camFwd(v2), draw); G.draw = 0; }
    if (e.button === 2 && mouse.rdown) { mouse.rdown = false; const k = Math.min(1, (G.t - mouse.rt0) / 0.5), f = camFwd(v2); throwCage(slingOrigin(), f.multiplyScalar(6 + 9 * k).add(v3.set(0, 2.2, 0))); }
  });
  addEventListener('mousemove', e => {
    if (G.panelKind) { setMouse(e); return; }
    if (document.pointerLockElement !== canvas) return;
    P.yaw -= e.movementX * 0.0022; P.pitch = Math.max(-1.45, Math.min(1.45, P.pitch - e.movementY * 0.0022));
  });
  function setMouse(e) { const r = canvas.getBoundingClientRect(); mouse.nx = (e.clientX - r.left) / r.width * 2 - 1; mouse.ny = -(e.clientY - r.top) / r.height * 2 + 1; }
}
const camFwd = v => G.camera.getWorldDirection(v);
function slingOrigin() { const o = G.camera.getWorldPosition(new THREE.Vector3()); return o.addScaledVector(camFwd(v3), 0.35).add(v1.set(0, -0.08, 0)); }

/* ---------- picking ---------- */
// The interactable nearest the aim ray, within its range of the player.
function pickInteract(origin, dir) {
  let best = null, bd = 1e9;
  for (const it of G.interactables) {
    if (it.dead || !it.label()) continue;
    if (it.pos.distanceTo(G.player.pos) > it.range + 0.6) continue;
    v1.subVectors(it.pos, origin); const along = v1.dot(dir); if (along < 0) continue;
    const off = v1.addScaledVector(dir, -along).length(), score = off / Math.max(1, along * 0.35);
    if (off < 1.1 && score < bd) { bd = score; best = it; }
  }
  return best;
}
export function aimedActor(origin, dir) {
  let best = null, bd = Math.cos(8 * Math.PI / 180);
  for (const a of [...G.wilds, ...G.foes]) { if (a.dead || a.caged) continue; v1.set(a.pos.x, a.pos.y + 0.4, a.pos.z).sub(origin); const d = v1.length(); if (d > 30) continue; const dot = v1.divideScalar(d).dot(dir); if (dot > bd) { bd = dot; best = a; } }
  return best;
}
function useTarget() { if (G.target) G.target.use(); }

/* ---------- movement shared by both modes ---------- */
function walk(dx, dz, dt) {
  const P = G.player, ox = P.pos.x;
  let nx = P.pos.x + dx * dt, nz = P.pos.z + dz * dt;
  if (G.inDelve) {
    nx = Math.max(-10.2, Math.min(10.2, nx)); nz = Math.max(DELVE_Z - 9.5, Math.min(DELVE_Z + 57.5, nz));
    for (const wz of [DELVE_Z + 11, DELVE_Z + 34]) if (Math.abs(nx) > 3 && Math.sign(P.pos.z - wz) !== Math.sign(nz - wz)) nz = P.pos.z;
    P.pos.set(nx, 0, nz); return;
  }
  const X0 = VR.ZONES[0].x0 + 1.5, X1 = VR.ZONES[VR.ZONES.length - 1].x1 - 1.5;
  nx = Math.max(X0, Math.min(X1, nx)); nz = Math.max(-VR.WORLD_Z + 3, Math.min(VR.WORLD_Z - 3, nz));
  nx = borderBlock(ox, nx, nz);
  if (heightAt(nx, nz) - heightAt(P.pos.x, P.pos.z) > 0.6) { nx = P.pos.x; nz = P.pos.z; } // too steep
  for (const [tx, tz, k] of G.treeSpots) { const ddx = nx - tx, ddz = nz - tz, r = 0.3 * k + 0.25, d2 = ddx * ddx + ddz * ddz; if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); nx = tx + ddx / d * r; nz = tz + ddz / d * r; } }
  P.pos.set(nx, heightAt(nx, nz), nz);
  // leaving your land starts an expedition
  if (!isSafe(P.pos.x) && !G.S.trip) startTrip();
}

/* ---------- flat screen ---------- */
export function updateDesktop(dt) {
  const P = G.player;
  P.crouch = !!(P.crouchToggle || keys.ControlLeft);
  if (!P.dead && !G.panelKind) {
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
    const L = VR.PLAYER, spd = P.crouch ? L.crouch : keys.ShiftLeft ? L.run : L.walk;
    const len = Math.hypot(f, s) || 1, sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
    const vx = ((-sy * f) + (cy * s)) / len * spd, vz = ((-cy * f) - (sy * s)) / len * spd;
    if (f || s) walk(vx, vz, dt);
    P.speed = f || s ? spd : 0;
  } else P.speed = 0;
  G.rig.position.copy(P.pos); G.rig.rotation.y = P.yaw;
  const eye = P.crouch ? VR.PLAYER.crouchEye : VR.PLAYER.eye;
  G.camera.position.y += (eye - G.camera.position.y) * Math.min(1, dt * 10); G.camera.rotation.x = P.pitch;
  G.draw = mouse.down ? Math.min(1, (G.t - mouse.t0) / VR.SLING.drawSeconds) : 0;
  // offering food
  const offering = keys.KeyF && !P.dead && !G.panelKind;
  G.foodMesh.visible = !!offering;
  const hand = G.camera.getWorldPosition(new THREE.Vector3()).addScaledVector(camFwd(v2), 0.9).add(v1.set(0, -0.45, 0));
  updateTame(dt, offering, hand);
  // aim targets and prompts
  const o = G.camera.getWorldPosition(new THREE.Vector3()), d = camFwd(new THREE.Vector3());
  G.target = G.panelKind || P.dead ? null : pickInteract(o, d);
  document.querySelector('#prompt').textContent = G.target ? `[E] ${G.target.label()}` : '';
  document.querySelector('#cross').classList.toggle('hot', !!(G.target || aimedActor(o, d)));
  if (G.panelKind) {
    ray.setFromCamera(new THREE.Vector2(mouse.nx, mouse.ny), G.camera);
    const hit = ray.intersectObject(G.panelObj.mesh)[0];
    G.panelObj.pointer(hit ? hit.uv : null, mouse.click);
  }
  mouse.click = false;
}

/* ---------- VR ---------- */
const H = {}; // hands by role: H.frame (holds the sling) and H.draw (pinches, throws, points)
let snapReady = true, panelToggleReady = true, teleporting = false, teleMark = null, vignette = null;
export function initXR(renderer) {
  for (let i = 0; i < 2; i++) {
    const ctrl = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i);
    G.rig.add(ctrl, grip);
    const hand = {ctrl, grip, hist: [], prev: {}, handedness: null, gp: null};
    ctrl.addEventListener('connected', e => { hand.handedness = e.data.handedness; hand.gp = e.data.gamepad; assignRoles(); });
    ctrl.addEventListener('disconnected', () => { hand.handedness = null; hand.gp = null; });
    const glove = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.12), mat('#e8c8a0')); grip.add(glove);
    hand.glove = glove; H['h' + i] = hand;
  }
  // the sling: a Y frame, two bands and a pouch
  const frame = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 6), mat('#7a5232')); stem.position.y = 0.0; frame.add(stem);
  for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.09, 6), mat('#7a5232')); arm.position.set(s * 0.03, 0.09, 0); arm.rotation.z = -s * 0.5; frame.add(arm); }
  frame.rotation.x = -0.9; frame.position.set(0, 0.02, -0.04);
  G.slingFrame = frame;
  G.pouch = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), mat('#4a3a2a')); G.scene.add(G.pouch);
  G.bands = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({color: '#d0b080'}));
  G.bands.frustumCulled = false; G.scene.add(G.bands);
  G.handCage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat('#d9c38a', {emissive: '#6a5020'}));
  G.handFood = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#ffb86b'));
  G.pointer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -4)]), new THREE.LineBasicMaterial({color: '#ffffff', transparent: true, opacity: 0.6}));
  teleMark = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 24), new THREE.MeshBasicMaterial({color: '#7fd6ff', side: THREE.DoubleSide})); teleMark.rotation.x = -Math.PI / 2; teleMark.visible = false; G.scene.add(teleMark);
  // comfort vignette: a soft dark ring right in front of the eyes while moving
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const c = cv.getContext('2d');
  const gr = c.createRadialGradient(128, 128, 50, 128, 128, 128); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); c.fillStyle = gr; c.fillRect(0, 0, 256, 256);
  vignette = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({map: new THREE.CanvasTexture(cv), transparent: true, opacity: 0, depthTest: false}));
  vignette.position.z = -0.12; vignette.renderOrder = 20; G.camera.add(vignette);
  assignRoles();
}
function assignRoles() {
  const hs = [H.h0, H.h1].filter(Boolean), lh = G.S && G.S.settings.leftHanded;
  const left = hs.find(h => h.handedness === 'left') || hs[0], right = hs.find(h => h.handedness === 'right') || hs[1];
  H.frame = lh ? right : left; H.draw = lh ? left : right;
  if (!H.frame || !H.draw) return;
  H.frame.grip.add(G.slingFrame); H.draw.ctrl.add(G.pointer); if (G.wristLabel) H.frame.grip.add(G.wristLabel);
  H.lefty = lh;
}
const btn = (h, i) => !!(h && h.gp && h.gp.buttons[i] && h.gp.buttons[i].pressed);
const val = (h, i) => (h && h.gp && h.gp.buttons[i] ? h.gp.buttons[i].value : 0);
const axes = h => h && h.gp ? [h.gp.axes[2] || 0, h.gp.axes[3] || 0] : [0, 0];
function edge(h, i) { const now = btn(h, i), was = h.prev[i]; h.prev[i] = now; return now && !was; }
function released(h, i) { const now = btn(h, i), was = h.prev['r' + i]; h.prev['r' + i] = now; return !now && was; }

export function updateXR(dt) {
  const P = G.player, S = G.S;
  G.rig.position.set(P.pos.x, P.pos.y + (S.settings.seated ? 0.45 : 0), P.pos.z); G.rig.rotation.y = P.yaw;
  if (!H.frame || !H.draw || !H.frame.gp) return;
  if (H.lefty !== S.settings.leftHanded) assignRoles();
  const leftH = H.lefty ? H.draw : H.frame, rightH = H.lefty ? H.frame : H.draw;
  const head = G.camera.getWorldPosition(v1.set(0, 0, 0)).clone();
  const headLocalY = G.camera.position.y;
  P.crouch = headLocalY < 1.15 && !S.settings.seated;
  // turning (right stick x) around the head
  const [rx, ry] = axes(rightH);
  let turn = 0;
  if (S.settings.turn === 'snap') { if (Math.abs(rx) > 0.7 && snapReady) { turn = -Math.sign(rx) * S.settings.snapDeg * Math.PI / 180; snapReady = false; } if (Math.abs(rx) < 0.3) snapReady = true; }
  else if (Math.abs(rx) > 0.2) turn = -rx * 2.2 * dt;
  if (turn) { P.yaw += turn; const hx = head.x - P.pos.x, hz = head.z - P.pos.z, c = Math.cos(turn), s = Math.sin(turn); P.pos.x += hx - (hx * c + hz * s); P.pos.z += hz - (-hx * s + hz * c); }
  // moving (left stick), relative to where you look
  const [lx, ly] = axes(leftH);
  const camDir = G.camera.getWorldDirection(v2); camDir.y = 0; camDir.normalize();
  P.speed = 0;
  if (!P.dead && !G.panelKind && S.settings.move === 'smooth' && Math.hypot(lx, ly) > 0.15) {
    const spd = P.crouch ? VR.PLAYER.crouch : Math.hypot(lx, ly) > 0.95 ? VR.PLAYER.run * 0.8 : VR.PLAYER.walk; // push the stick all the way to jog
    const vx = (camDir.x * -ly + -camDir.z * lx) * spd, vz = (camDir.z * -ly + camDir.x * lx) * spd;
    walk(vx, vz, dt); P.speed = Math.hypot(vx, vz);
  }
  // teleport: push the right stick forward, aim, let go
  if (S.settings.move === 'teleport' && !P.dead) {
    if (ry < -0.6) { teleporting = true; const o = H.draw.ctrl.getWorldPosition(v3), d = new THREE.Vector3(0, 0, -1).applyQuaternion(H.draw.ctrl.getWorldQuaternion(q1)); let hit = null; for (let t = 0.5; t < 12; t += 0.25) { const p = o.clone().addScaledVector(d, t); p.y -= t * t * 0.04; if (p.y <= heightAt(p.x, p.z)) { hit = p; break; } } teleMark.visible = !!hit; if (hit) teleMark.position.set(hit.x, heightAt(hit.x, hit.z) + 0.05, hit.z); }
    else if (teleporting) { teleporting = false; if (teleMark.visible) { const dx = teleMark.position.x - P.pos.x, dz = teleMark.position.z - P.pos.z; walk(dx, dz, 1); P.speed = 2; } teleMark.visible = false; }
  }
  if (vignette) { const want = S.settings.vignette && (P.speed > 0.2 || turn) ? 0.85 : 0; vignette.material.opacity += (want - vignette.material.opacity) * Math.min(1, dt * 8); }
  G.rig.position.set(P.pos.x, P.pos.y + (S.settings.seated ? 0.45 : 0), P.pos.z); G.rig.rotation.y = P.yaw;

  // hand history for throwing velocity
  for (const h of [H.frame, H.draw]) { const p = h.grip.getWorldPosition(new THREE.Vector3()); h.hist.push([G.t, p]); while (h.hist.length > 6) h.hist.shift(); }
  const handVel = h => { const a = h.hist[0], b = h.hist[h.hist.length - 1]; return a && b && b[0] > a[0] ? b[1].clone().sub(a[1]).divideScalar(b[0] - a[0]) : new THREE.Vector3(); };

  // the sling: pinch near the fork with the draw hand's trigger
  const fork = G.slingFrame.localToWorld(v3.set(0, 0.13, 0)).clone();
  const drawPos = H.draw.grip.getWorldPosition(new THREE.Vector3());
  const trig = btn(H.draw, 0), grip = btn(H.draw, 1);
  const offering = btn(H.frame, 0);
  G.slingFrame.visible = !offering;
  if (!G.pinch && trig && !H.draw.prev.trig && drawPos.distanceTo(fork) < 0.14 && !offering && !G.panelKind) { G.pinch = true; }
  if (G.pinch) {
    const pull = Math.min(VR.SLING.maxDraw, drawPos.distanceTo(fork)); G.draw = pull / VR.SLING.maxDraw;
    G.pouch.position.copy(drawPos);
    if (Math.floor(G.draw * 6) !== Math.floor((G.lastDraw || 0) * 6)) buzz(H.draw.handedness, 0.08 + G.draw * 0.3, 10);
    G.lastDraw = G.draw;
    if (!trig) { G.pinch = false; const dir = fork.clone().sub(drawPos).normalize(); slingShot(fork, dir, G.draw); G.draw = 0; }
  } else { G.pouch.position.copy(fork); G.draw = 0; }
  G.pouch.visible = G.bands.visible = G.slingFrame.visible;
  const lp = G.slingFrame.localToWorld(new THREE.Vector3(-0.045, 0.13, 0)), rp = G.slingFrame.localToWorld(new THREE.Vector3(0.045, 0.13, 0));
  G.bands.geometry.setFromPoints([lp, G.pouch.position.clone(), rp]);
  H.draw.prev.trig = trig;
  // a cage appears in the draw hand while its grip is held; let go to throw
  if (grip && !G.pinch && !H.draw.holdingCage && (S.items.cage || 0) > 0 && !G.panelKind) { H.draw.holdingCage = true; H.draw.grip.add(G.handCage); }
  if (!grip && H.draw.holdingCage) {
    H.draw.holdingCage = false; H.draw.grip.remove(G.handCage);
    const vel = handVel(H.draw).multiplyScalar(1.5); if (vel.length() > 1.2) throwCage(drawPos, vel);
  }
  // offering food from the frame hand
  if (offering && !G.handFood.parent) H.frame.grip.add(G.handFood); if (!offering && G.handFood.parent) G.handFood.parent.remove(G.handFood);
  const fp = H.frame.grip.getWorldPosition(new THREE.Vector3());
  const extended = Math.hypot(fp.x - head.x, fp.z - head.z) > 0.3;
  updateTame(dt, offering && extended && !P.dead, fp);
  // the draw hand's ray: panels, things to use, and where to send companions
  const ro = H.draw.ctrl.getWorldPosition(new THREE.Vector3()), rd = new THREE.Vector3(0, 0, -1).applyQuaternion(H.draw.ctrl.getWorldQuaternion(q1));
  if (G.panelKind) {
    ray.set(ro, rd); const hit = ray.intersectObject(G.panelObj.mesh)[0];
    G.pointer.visible = true;
    G.panelObj.pointer(hit ? hit.uv : null, trig && !G.pinch && !H.draw.prev.panelTrig);
    H.draw.prev.panelTrig = trig;
  } else {
    G.target = P.dead ? null : pickInteract(ro, rd);
    G.pointer.visible = !!G.target;
    if (G.target) G.target.hint = true;
  }
  const A = H.lefty ? 4 : 4, B = 5;
  if (edge(rightH, A) && !G.panelKind) { if (G.target) G.target.use(); else commandAttack(aimedActor(ro, rd)); }
  if (edge(rightH, B) && !G.panelKind) commandRecall();
  if (edge(leftH, 4) && !G.panelKind) useSkill(0);
  if (edge(leftH, 5) && !G.panelKind) useSkill(1);
  if (btn(leftH, 3)) { if (panelToggleReady) { panelToggleReady = false; if (G.panelKind) G.closePanel(); else G.openPanel('wrist'); } } else panelToggleReady = true;
  void released; void val; void sfx; void emit; void borderX;
}
