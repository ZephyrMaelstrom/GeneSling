/* The valley: terrain, zones, trees, the homestead's buildings, Heartroots, the Waystone,
   the Delve and the day–night cycle. */
import * as THREE from 'three';
import {G} from './ctx.js';
import {VR} from './data.js';
import {mat, makeLabel} from './gfx.js';
import {isClaimed, zoneAt, borderX} from './state.js';

const W = VR.ZONES[VR.ZONES.length - 1].x1 - VR.ZONES[0].x0, X0 = VR.ZONES[0].x0, Z = VR.WORLD_Z;
export const DELVE_Z = 260; // the Delve is built far south, out of sight of the valley

// One height function serves the mesh and the gameplay, so feet and ground always agree.
export function heightAt(x, z) {
  if (z > 150) return 0;
  let h = 0.9 * Math.sin(x * 0.06 + 1.3) * Math.cos(z * 0.08) + 0.45 * Math.sin(x * 0.17 + z * 0.13) + 0.25 * Math.sin(z * 0.31 - x * 0.07);
  if (x < -24) h *= 0.25;                                         // the homestead is a level meadow
  const edge = Math.abs(z) - (Z - 8); if (edge > 0) h += edge * edge * 0.12; // valley walls
  const ends = Math.max(X0 + 6 - x, x - (X0 + W - 6)); if (ends > 0) h += ends * ends * 0.12;
  return h;
}

let ground, groundCols, treeCrowns, treeTrunks, sun, hemi, sky, fogCol, bloomMotes, borderRing, borderLabel;
const tmp = new THREE.Color(), tmp2 = new THREE.Color();

export function buildWorld() {
  const scene = G.scene;
  scene.background = new THREE.Color('#9fd3ff');
  fogCol = new THREE.Color('#9fd3ff');
  scene.fog = new THREE.Fog(fogCol, 30, 110);
  hemi = new THREE.HemisphereLight('#dff2ff', '#4a3a2a', 1.1); scene.add(hemi);
  sun = new THREE.DirectionalLight('#fff1d6', 1.6); sun.position.set(30, 60, 20); scene.add(sun);

  // Terrain
  const geo = new THREE.PlaneGeometry(W, Z * 2, 132, 48); geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + X0 + W / 2, z = p.getZ(i); p.setXYZ(i, x, heightAt(x, z), z); }
  geo.computeVertexNormals();
  groundCols = new Float32Array(p.count * 3); geo.setAttribute('color', new THREE.BufferAttribute(groundCols, 3));
  ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}));
  scene.add(ground); recolorGround();

  // Trees (instanced: one draw call for crowns, one for trunks)
  const spots = [];
  let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 420; i++) {
    const x = X0 + 4 + r() * (W - 8), z = -Z + 4 + r() * (Z * 2 - 8);
    if (x < -26 && Math.abs(z) < 26) continue;          // keep the homestead clear
    if (Math.abs(z) < 5 && r() < 0.85) continue;         // a rough trail down the valley
    spots.push([x, z, 0.8 + r() * 0.9]);
  }
  treeTrunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.26, 2, 5), mat('#6b4a2e'), spots.length);
  treeCrowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.4, 3.4, 6), mat('#ffffff'), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
  spots.forEach(([x, z, k], i) => {
    const y = heightAt(x, z);
    m.compose(v.set(x, y + k, z), q, s.set(k, k, k)); treeTrunks.setMatrixAt(i, m);
    m.compose(v.set(x, y + k * 3, z), q, s.set(k, k, k)); treeCrowns.setMatrixAt(i, m);
  });
  treeCrowns.userData.spots = spots; scene.add(treeTrunks, treeCrowns); recolorTrees();
  G.treeSpots = spots;

  // Rocks and grass tufts
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.6, 0), mat('#8b8790'), 120);
  for (let i = 0; i < 120; i++) { const x = X0 + r() * W, z = -Z + 6 + r() * (Z * 2 - 12), k = 0.4 + r() * 1.2; m.compose(v.set(x, heightAt(x, z) + k * 0.2, z), q.setFromEuler(new THREE.Euler(r(), r(), r())), s.set(k, k * 0.7, k)); rocks.setMatrixAt(i, m); }
  scene.add(rocks);
  const grass = new THREE.InstancedMesh(new THREE.ConeGeometry(0.12, 0.5, 3), mat('#6f9a3e'), 900);
  for (let i = 0; i < 900; i++) { const x = X0 + r() * W, z = -Z + 6 + r() * (Z * 2 - 12); m.compose(v.set(x, heightAt(x, z) + 0.2, z), q.identity(), s.set(1, 0.7 + r(), 1)); grass.setMatrixAt(i, m); }
  scene.add(grass);

  // Bloom tendrils in Blightfen
  const blight = VR.ZONES[2];
  const tend = new THREE.InstancedMesh(new THREE.TorusGeometry(0.9, 0.16, 5, 8, Math.PI), mat('#8a3fd1', {emissive: '#3b1060'}), 70);
  for (let i = 0; i < 70; i++) { const x = blight.x0 + 4 + r() * (blight.x1 - blight.x0 - 8), z = -Z + 8 + r() * (Z * 2 - 16), k = 0.8 + r() * 1.6; m.compose(v.set(x, heightAt(x, z), z), q.setFromEuler(new THREE.Euler(0, r() * 6, 0)), s.set(k, k, k)); tend.setMatrixAt(i, m); }
  tend.userData.zone = 'blight'; G.tendrils = tend; scene.add(tend);

  // Floating Bloom motes near the player while in Blightfen
  const mg = new THREE.BufferGeometry(), mp = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) { mp[i * 3] = (r() - 0.5) * 30; mp[i * 3 + 1] = r() * 6; mp[i * 3 + 2] = (r() - 0.5) * 30; }
  mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  bloomMotes = new THREE.Points(mg, new THREE.PointsMaterial({color: '#d49bff', size: 0.09, transparent: true, opacity: 0.8}));
  scene.add(bloomMotes);

  buildHomestead();
  buildLandmarks();
  buildDelve();
}

export function recolorGround() {
  const p = ground.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), zone = zoneAt(x);
    tmp.set(isClaimed(zone.id) ? zone.claimedGround : zone.ground);
    // blend across zone edges
    const next = VR.ZONES.find(zz => zz.x0 === zone.x1);
    if (next && zone.x1 - x < 6) { tmp2.set(isClaimed(next.id) ? next.claimedGround : next.ground); tmp.lerp(tmp2, (6 - (zone.x1 - x)) / 12); }
    const n = 0.92 + 0.08 * Math.sin(x * 1.7 + z * 2.3);
    tmp.multiplyScalar(n * (y > 4 ? 0.85 : 1));
    if (Math.abs(z) < 2.2 && x > -24) tmp.lerp(tmp2.set('#b59a6a'), 0.45); // the trail
    groundCols[i * 3] = tmp.r; groundCols[i * 3 + 1] = tmp.g; groundCols[i * 3 + 2] = tmp.b;
  }
  ground.geometry.attributes.color.needsUpdate = true;
  if (treeCrowns) recolorTrees();
  if (G.tendrils) G.tendrils.visible = !isClaimed('blight');
  if (borderRing) placeBorder();
}
function recolorTrees() {
  treeCrowns.userData.spots.forEach(([x, z], i) => {
    const zone = zoneAt(x);
    tmp.set(zone.kind === 'bloom' && !isClaimed(zone.id) ? '#6a3d8f' : zone.kind === 'wild' && !isClaimed(zone.id) ? '#3f7d3a' : '#4f9a45');
    tmp.offsetHSL((Math.sin(i * 12.9) * 0.04), 0, Math.sin(i * 7.1) * 0.05);
    treeCrowns.setColorAt(i, tmp);
  });
  treeCrowns.instanceColor.needsUpdate = true;
}

/* ---------- the homestead ---------- */
function box(w, h, d, col, x, y, z, o) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(col, o)); b.position.set(x, y, z); G.scene.add(b); return b; }
export function addInteract(obj, pos, label, use, range = 3) { const it = {obj, pos, label, use, range}; G.interactables.push(it); return it; }

function buildHomestead() {
  const S = VR.STATIONS;
  const stationLook = {forge: ['#7a5a48', '#ff7a3d'], garden: ['#6b4a2e', '#c04ad8'], spring: ['#7d8a96', '#5cc8ff']};
  G.stationSigns = {};
  for (const [k, st] of Object.entries(S)) {
    const [x, , z] = st.pos, y = heightAt(x, z);
    const [base, acc] = stationLook[k];
    const b = box(3, 1.2, 2, base, x, y + 0.6, z);
    box(2.6, 0.25, 1.6, acc, x, y + 1.3, z, {emissive: acc, emissiveIntensity: 0.25});
    if (k === 'forge') box(0.6, 2.2, 0.6, '#5a4038', x + 1, y + 2.3, z - 0.5);
    if (k === 'garden') for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.5, 6), mat('#e0527a')); c.position.set(x - 1.2 + (i % 3) * 1.2, y + 1.6, z - 0.4 + Math.floor(i / 3) * 0.8); G.scene.add(c); }
    const sign = makeLabel([st.name, 'No workers'], {scale: 2.2}); sign.position.set(x, y + 3.2, z); G.scene.add(sign);
    G.stationSigns[k] = sign;
    addInteract(b, new THREE.Vector3(x, y + 1, z), () => `${st.name} — post workers`, () => G.openPanel('station', k));
  }
  // Bed, pen, nursery, workbench, contract board
  const spot = (x, z) => [x, heightAt(x, z), z];
  let [x, y, z] = spot(-62, 0);
  const bed = box(2.2, 0.5, 1.2, '#8a5a3c', x, y + 0.25, z); box(2.2, 0.2, 1.1, '#e8d8c0', x, y + 0.6, z);
  const hut = box(5, 3, 5, '#a07850', x - 3.2, y + 1.5, z); hut.rotation.y = 0.1;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.2, 4), mat('#b5523a')); roof.position.set(x - 3.2, y + 4.1, z); roof.rotation.y = Math.PI / 4; G.scene.add(roof);
  addInteract(bed, new THREE.Vector3(x, y + 0.5, z), () => 'Bed — sleep to end the day', () => G.openPanel('sleep'));
  [x, y, z] = spot(-44, 12);
  const pen = box(5, 0.6, 4, '#8b6a44', x, y + 0.3, z);
  for (const [dx, dz] of [[-2.5, 0], [2.5, 0], [0, -2], [0, 2]]) box(dz ? 5 : 0.15, 1, dz ? 0.15 : 4, '#6b4a2e', x + dx, y + 0.8, z + dz);
  addInteract(pen, new THREE.Vector3(x, y + 0.5, z), () => 'Breeding pen', () => G.openPanel('pen'));
  const penLabel = makeLabel(['Breeding pen'], {scale: 1.8}); penLabel.position.set(x, y + 2.4, z); G.scene.add(penLabel);
  [x, y, z] = spot(-36, 14);
  const nest = box(2, 0.8, 2, '#c9a46a', x, y + 0.4, z);
  G.nestPos = new THREE.Vector3(x, y + 0.9, z);
  addInteract(nest, new THREE.Vector3(x, y + 0.6, z), () => 'Nursery — eggs and hatching', () => G.openPanel('nursery'));
  G.nurseryLabel = makeLabel(['Nursery', 'No eggs'], {scale: 1.8}); G.nurseryLabel.position.set(x, y + 2.4, z); G.scene.add(G.nurseryLabel);
  [x, y, z] = spot(-46, -18);
  const bench = box(3, 1, 1.4, '#7a5a3a', x, y + 0.5, z); box(0.8, 0.4, 0.6, '#9aa0a8', x - 0.6, y + 1.2, z);
  addInteract(bench, new THREE.Vector3(x, y + 0.8, z), () => 'Workbench — craft', () => G.openPanel('craft'));
  const bl = makeLabel(['Workbench'], {scale: 1.6}); bl.position.set(x, y + 2.2, z); G.scene.add(bl);
  [x, y, z] = spot(-32, -8);
  const board = box(2.4, 1.8, 0.2, '#7a5a3a', x, y + 1.6, z); box(0.15, 1.6, 0.15, '#5a3a2a', x - 1, y + 0.8, z); box(0.15, 1.6, 0.15, '#5a3a2a', x + 1, y + 0.8, z);
  addInteract(board, new THREE.Vector3(x, y + 1.4, z), () => 'Contract board and roster', () => G.openPanel('board'));
  const brd = makeLabel(['Contracts · Roster'], {scale: 1.8}); brd.position.set(x, y + 3, z); G.scene.add(brd);
  // a few fences and lanterns for character
  for (let i = 0; i < 10; i++) box(0.12, 0.9, 2.4, '#6b4a2e', -69, heightAt(-69, -22 + i * 4.6) + 0.45, -22 + i * 4.6);
  for (const [lx, lz] of [[-30, 4], [-30, -4], [-58, 4], [-40, 0]]) { const ly = heightAt(lx, lz); box(0.12, 1.6, 0.12, '#4a3a2a', lx, ly + 0.8, lz); box(0.35, 0.35, 0.35, '#ffd27a', lx, ly + 1.7, lz, {emissive: '#ffb347', emissiveIntensity: 0.8}); }
}

function buildLandmarks() {
  // Border circle: the claimed land's edge. Holding it ends an expedition.
  borderRing = new THREE.Mesh(new THREE.TorusGeometry(2, 0.1, 6, 32), mat('#ffd27a', {emissive: '#ffb347', emissiveIntensity: 0.7}));
  borderRing.rotation.x = Math.PI / 2; G.scene.add(borderRing);
  borderLabel = makeLabel(['Homestead gate', 'Stand here to bring your pack home'], {scale: 2.4});
  G.scene.add(borderLabel);
  placeBorder();
  // Waystone
  G.extractPoints = () => [{x: borderX() + 2.2, z: 0, name: 'the gate'}, ...VR.WAYSTONES];
  for (const w of VR.WAYSTONES) {
    const y = heightAt(w.x, w.z);
    box(0.8, 3.2, 0.8, '#c8c2d8', w.x, y + 1.6, w.z, {emissive: '#7fd6ff', emissiveIntensity: 0.35});
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2, 0.1, 6, 32), mat('#7fd6ff', {emissive: '#7fd6ff', emissiveIntensity: 0.8}));
    ring.rotation.x = Math.PI / 2; ring.position.set(w.x, y + 0.08, w.z); G.scene.add(ring);
    const l = makeLabel([w.name, 'Hold the circle to return home'], {scale: 2.4}); l.position.set(w.x, y + 4.2, w.z); G.scene.add(l);
  }
  // Heartroots
  G.heartroots = {};
  for (const z of VR.ZONES) if (z.heartroot) {
    const {x, z: zz} = z.heartroot, y = heightAt(x, zz);
    const g = new THREE.Group(); g.position.set(x, y, zz); G.scene.add(g);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 0), mat('#b45cff', {emissive: '#7a20c0', emissiveIntensity: 0.9}));
    core.position.y = 1.6; g.add(core);
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.18, 5, 8, Math.PI), mat('#6a2a9a')); t.rotation.y = i * 1.25; g.add(t); }
    const l = makeLabel([`${z.name} Heartroot`, 'Plant a Ward Stone to claim'], {scale: 2.6}); l.position.set(x, y + 4, zz); G.scene.add(l);
    G.heartroots[z.id] = {group: g, core, label: l, zone: z};
    addInteract(core, new THREE.Vector3(x, y + 1.6, zz), () => isClaimed(z.id) ? `${z.name} is yours — post guards here` : `${z.name} Heartroot — plant a Ward Stone`, () => G.openPanel('heartroot', z.id), 4);
  }
  // Delve mouth
  const d = VR.DELVE_MOUTH, dy = heightAt(d.x, d.z);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.7, 6, 10, Math.PI), mat('#3a2a4a')); arch.position.set(d.x, dy, d.z); G.scene.add(arch);
  const dark = box(3.6, 3, 0.4, '#0c0814', d.x, dy + 1.4, d.z);
  const dl = makeLabel(['The Delve', 'Rootmaw sleeps below'], {scale: 2.2}); dl.position.set(d.x, dy + 4.2, d.z); G.scene.add(dl);
  addInteract(dark, new THREE.Vector3(d.x, dy + 1.4, d.z), () => 'Enter the Delve (3 rooms and a boss)', () => G.enterDelve(), 4);
}
function placeBorder() {
  const x = borderX() + 2.2, y = heightAt(x, 0);
  borderRing.position.set(x, y + 0.08, 0); borderLabel.position.set(x, y + 3.6, 0);
  borderLabel.set([x > -20 ? 'Border gate' : 'Homestead gate', 'Stand here to bring your pack home']);
}

/* ---------- the Delve: three rooms in a row, the last holds Rootmaw ---------- */
export const DELVE_ROOMS = [{x: 0, z: DELVE_Z}, {x: 0, z: DELVE_Z + 22}, {x: 0, z: DELVE_Z + 46}];
function buildDelve() {
  const floorM = mat('#3d2c52'), wallM = mat('#2a1d3a');
  const fl = new THREE.Mesh(new THREE.BoxGeometry(22, 0.4, 72), floorM); fl.position.set(0, -0.2, DELVE_Z + 22); G.scene.add(fl);
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 72), wallM); w.position.set(s * 11, 3, DELVE_Z + 22); G.scene.add(w); }
  for (const z of [DELVE_Z - 10, DELVE_Z + 58]) { const w = new THREE.Mesh(new THREE.BoxGeometry(22, 6, 0.6), wallM); w.position.set(0, 3, z); G.scene.add(w); }
  for (const z of [DELVE_Z + 11, DELVE_Z + 34]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 0.6), wallM); w.position.set(s * 7, 3, z); G.scene.add(w); }
  for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 0), mat('#b45cff', {emissive: '#b45cff', emissiveIntensity: 1})); c.position.set(i % 2 ? -10.4 : 10.4, 2.5, DELVE_Z - 6 + i * 5.5); G.scene.add(c); }
  const light = new THREE.PointLight('#c08aff', 40, 60); light.position.set(0, 5, DELVE_Z + 22); G.scene.add(light);
  G.delveExit = makeLabel(['Way out', 'Opens when Rootmaw falls'], {scale: 2.2}); G.delveExit.position.set(0, 3, DELVE_Z + 54); G.scene.add(G.delveExit);
}

/* ---------- day and night ---------- */
export const isNight = () => { const c = G.S.clock % 1; return c >= VR.NIGHT_FROM || c < VR.NIGHT_TO; };
export function updateWorld(dt) {
  const S = G.S; S.clock = (S.clock + dt / VR.DAY_SECONDS) % 1;
  const a = S.clock * Math.PI * 2, elev = Math.sin(a - Math.PI / 2 + Math.PI); // noon at 0.5
  const day = Math.max(0, Math.min(1, -Math.cos(a) * 1.6 + 0.3));
  sun.position.set(Math.cos(a - Math.PI / 2) * 60, 10 + 60 * Math.max(0.05, -Math.cos(a)), 20);
  sun.intensity = 0.25 + 1.4 * day; hemi.intensity = 0.35 + 0.8 * day;
  const pz = G.inDelve ? null : zoneAt(G.player.pos.x);
  const bloomy = pz && pz.kind === 'bloom' && !isClaimed(pz.id);
  tmp.set('#0e1030').lerp(tmp2.set('#9fd3ff'), day);
  if (bloomy) tmp.lerp(tmp2.set('#5a3a7a'), 0.55);
  if (G.inDelve) tmp.set('#140c22');
  G.scene.background.lerp(tmp, Math.min(1, dt * 2)); fogCol.copy(G.scene.background);
  G.scene.fog.far = G.inDelve ? 60 : bloomy ? 55 : 110;
  bloomMotes.visible = !!bloomy;
  if (bloomy) { bloomMotes.position.set(G.player.pos.x, G.player.pos.y, G.player.pos.z); bloomMotes.rotation.y += dt * 0.05; }
  for (const h of Object.values(G.heartroots || {})) {
    h.core.rotation.y += dt * 0.6; h.core.position.y = 1.6 + Math.sin(G.t * 1.5) * 0.15;
    const claimed = isClaimed(h.zone.id);
    h.core.material.color.set(claimed ? '#8fe08a' : '#b45cff'); h.core.material.emissive.set(claimed ? '#2a7a3a' : '#7a20c0');
    h.label.set([`${h.zone.name} Heartroot`, claimed ? `Yours · Bloom pressure ${Math.round(S.zones[h.zone.id].pressure)}%` : 'Plant a Ward Stone to claim']);
  }
  void elev;
}
