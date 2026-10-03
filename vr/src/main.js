/* GeneSlingVR — boot, the renderer and XR session, and the frame loop. */
import * as THREE from 'three';
import {G, on, emit} from './ctx.js';
import {VR} from './data.js';
import {load, save, isSafe} from './state.js';
import {buildWorld, updateWorld} from './world.js';
import {updateWild, updatePopulations, animate} from './creatures.js';
import {updateShots, updateCages, updateCompanions, updateFoes, updateFx, syncParty} from './combat.js';
import {buildNodes, updateExtraction, updateSurge, updateDelve, updateHome, refreshHome, rollContracts, buildOutpost, updateSigns, updateNightBloom} from './home.js';
import {initUI, updateHUD, initXRHud, updateXRHud} from './ui.js';
import {initInput, initXR, updateDesktop, updateXR} from './input.js';
import {audioInit, mat} from './gfx.js';
import {heightAt} from './world.js';
import * as STATE from './state.js';
import * as HOME from './home.js';
import * as COMBAT from './combat.js';
import * as CREATURES from './creatures.js';
import {express} from './sim-core/genetics.js';

const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation && renderer.xr.setFoveation(1);
document.body.prepend(renderer.domElement);

G.renderer = renderer;
G.scene = new THREE.Scene();
G.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 400);
G.rig = new THREE.Group(); G.rig.add(G.camera); G.scene.add(G.rig);
G.camera.position.y = VR.PLAYER.eye;

const fresh = load();
G.player = {pos: new THREE.Vector3(-58, 0, 0), hp: VR.PLAYER.hp, maxHp: VR.PLAYER.hp, dead: false, crouch: false, speed: 0, yaw: -Math.PI / 2, pitch: 0};
G.player.pos.y = heightAt(G.player.pos.x, G.player.pos.z);
// a save made mid-expedition reloads at home: the pack was never brought back
if (G.S.trip) G.S.trip = null;

buildWorld();
buildNodes();
initUI();
rollContracts();
syncParty();
refreshHome();
buildOutpost();
updateSigns();
// the food you offer when taming on a flat screen
G.foodMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat('#ffb86b')); G.foodMesh.position.set(0.12, -0.3, -0.55); G.foodMesh.visible = false; G.camera.add(G.foodMesh);
initInput(renderer.domElement);
initXR(renderer);
initXRHud(renderer.xr.getControllerGrip(0));

/* ---------- start screen ---------- */
const $ = s => document.querySelector(s);
const btnVR = $('#btnVR'), btnDesk = $('#btnDesk');
function begin() { $('#start').style.display = 'none'; audioInit(); if (fresh) G.openPanel('intro'); }
btnDesk.onclick = () => { begin(); renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock(); };
if (navigator.xr && navigator.xr.isSessionSupported) {
  navigator.xr.isSessionSupported('immersive-vr').then(ok => {
    btnVR.disabled = !ok; btnVR.textContent = ok ? 'Enter VR' : 'VR not available here';
  }).catch(() => { btnVR.textContent = 'VR not available here'; });
} else btnVR.textContent = 'VR not available here';
btnVR.onclick = async () => {
  try {
    const session = await navigator.xr.requestSession('immersive-vr', {optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking']});
    await renderer.xr.setSession(session);
    G.xr = true; G.xrSession = session; G.camera.position.set(0, 0, 0);
    session.addEventListener('end', () => { G.xr = false; G.xrSession = null; G.camera.position.set(0, VR.PLAYER.eye, 0); $('#start').style.display = 'flex'; });
    begin();
  } catch (e) { btnVR.textContent = 'Could not start VR'; console.warn(e); }
};
addEventListener('resize', () => { G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ---------- fades, saves ---------- */
on('fade', (fn) => {
  const f = $('#fade'); f.style.opacity = 1; G.fading = true;
  setTimeout(() => { fn(); setTimeout(() => { f.style.opacity = 0; G.fading = false; }, 150); }, 380);
});
on('save', save);
setInterval(() => { if (!G.S.trip) save(); }, 15000);
addEventListener('beforeunload', () => { if (!G.S.trip) save(); });
on('teleport', () => { G.rig.position.copy(G.player.pos); });
on('playerHurt', () => { if (G.xr) return; const f = $('#fade'); f.style.background = '#600'; f.style.opacity = 0.25; setTimeout(() => { f.style.opacity = 0; setTimeout(() => (f.style.background = '#000'), 300); }, 90); });

/* ---------- the frame ---------- */
const clock = new THREE.Clock();
let frames = 0, ftAcc = 0;
G.frameTimes = [];
function frame() {
  const t0 = performance.now();
  let dt = Math.min(0.05, clock.getDelta());
  G.t += dt;
  if (G.hitstop > 0) { G.hitstop -= dt; dt *= 0.05; }
  G.dt = dt;
  if (G.xr) updateXR(dt); else updateDesktop(dt);
  if (!G.fading) {
    updateWorld(dt);
    updatePopulations(dt);
    for (const a of G.wilds) { if (!a.dead && !a.caged) { updateWild(a, dt); animate(a, dt); } }
    updateCompanions(dt);
    updateFoes(dt);
    updateShots(dt);
    updateCages(dt);
    updateFx(dt);
    updateExtraction(dt);
    updateSurge(dt);
    updateDelve();
    updateHome(dt);
    updateNightBloom(dt);
    G.claimedHere = isSafe(G.player.pos.x);
  }
  if (G.xr) updateXRHud(dt); else updateHUD(dt);
  renderer.render(G.scene, G.camera);
  const ft = performance.now() - t0; ftAcc += ft; frames++;
  if (frames % 60 === 0) { G.frameTimes.push(ftAcc / 60); ftAcc = 0; if (G.frameTimes.length > 30) G.frameTimes.shift(); }
}
renderer.setAnimationLoop(frame);

if (__DEV__) { window.vr = {G, VR, emit, THREE, heightAt, express, ...STATE, ...HOME, ...COMBAT, ...CREATURES}; window.gameReady = true; }
void syncParty;
