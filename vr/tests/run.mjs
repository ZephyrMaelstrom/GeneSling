// Headless smoke test: load the dev build, play the whole MVP loop through the game's own functions,
// and fail on any page error. Screenshots land in tests/shots/.
import puppeteer from 'puppeteer';
import {mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
mkdirSync('tests/shots', {recursive: true});
const exe = process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await puppeteer.launch({executablePath: exe, headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1280,720']});
const page = await browser.newPage();
await page.setViewport({width: 1280, height: 720});
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('file://' + resolve('dist-dev/index.html'));
await page.waitForFunction('window.gameReady === true', {timeout: 30000});
const step = async (name, fn, arg) => { const r = await page.evaluate(fn, arg); console.log(`✓ ${name}${r !== undefined ? ': ' + JSON.stringify(r) : ''}`); return r; };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = n => page.screenshot({path: `tests/shots/${n}.png`});

await page.click('#btnDesk');
await wait(800);
await shot('01-start-intro');
await step('close intro', () => { vr.G.closePanel(); });
await wait(500); await shot('02-homestead');

// look east down the valley from the gate
await step('walk to the gate', () => { const P = vr.G.player; P.pos.set(-27, 0, 0); P.yaw = -Math.PI / 2; P.pitch = -0.05; });
await wait(600); await shot('03-gate-view');

// walk out through the gate with the keyboard, then check the thorn wall holds you out until you extract
await step('face east at the gate', () => { const P = vr.G.player; P.pos.set(-30, vr.heightAt(-30, 0), 0.5); P.yaw = -Math.PI / 2; });
await page.keyboard.down('KeyW'); for (let i = 0; i < 30 && !(await page.evaluate(() => !!vr.G.S.trip)); i++) await wait(500); await page.keyboard.up('KeyW');
const out = await step('walked out', () => ({x: +vr.G.player.pos.x.toFixed(1), trip: !!vr.G.S.trip}));
if (!out.trip) throw new Error('walking out did not start an expedition');
await step('turn back west, away from the gate', () => { const P = vr.G.player; P.pos.set(-20, vr.heightAt(-20, 8), 8); P.yaw = Math.PI / 2; });
await page.keyboard.down('KeyW'); await wait(3000); await page.keyboard.up('KeyW');
const blocked = await step('wall holds', () => +vr.G.player.pos.x.toFixed(2));
if (blocked < -24.05) throw new Error('walked through the border wall');
await step('cancel this trip for the scripted run', () => { vr.G.S.trip = null; });

// step out: an expedition begins, wilds spawn
const trip = await step('leave through the gate', async () => {
  const {G} = vr; const P = G.player; P.pos.set(-20, vr.heightAt(-20, 0), 0);
  // the walk() in input starts trips; emulate it
  if (!vr.isSafe(P.pos.x) && !G.S.trip) vr.startTrip();
  return !!G.S.trip;
});
if (!trip) throw new Error('trip did not start');
await wait(3500);
const wildCount = await step('wild creatures spawned', () => vr.G.wilds.length);
if (wildCount < 3) throw new Error('too few wilds');

// sling a wild down to weakened, then cage it
await step('stand near a wild', () => { const {G} = vr, P = G.player, a = G.wilds.find(w => !w.c.bloom); G.testWild = a; a.aggro = false; P.pos.set(a.pos.x - 6, vr.heightAt(a.pos.x - 6, a.pos.z), a.pos.z); P.yaw = -Math.PI / 2; P.pitch = 0; });
await wait(400);
await step('sling it and cage it (ticked by hand so it can\'t wander)', () => {
  const {G, THREE} = vr, a = G.testWild;
  const o = new THREE.Vector3(a.pos.x - 6, a.pos.y + 1.6, a.pos.z);
  vr.slingShot(o, new THREE.Vector3(a.pos.x, a.pos.y + 0.4, a.pos.z).sub(o).normalize(), 1);
  for (let i = 0; i < 20; i++) vr.updateShots(0.02);
  const hp = Math.round(a.hp); a.hp = 2; a.aggro = false;
  vr.throwCage(new THREE.Vector3(a.pos.x - 1.5, a.pos.y + 0.6, a.pos.z), new THREE.Vector3(6, 1.2, 0));
  for (let i = 0; i < 150; i++) vr.updateCages(0.02);
  return {slingObjective: !!G.S.objectives.sling, hpAfterSling: hp, max: a.maxHp, caged: !!G.S.objectives.cage};
});
await wait(2500);
const caught1 = await step('cage resolved', () => ({caught: vr.G.S.trip.caught.length, cages: vr.G.cages.length}));

// tame a calm creature
await step('tame a calm wild', () => {
  const {G} = vr; let a = G.wilds.find(w => !w.c.bloom && !w.aggro && !w.caged);
  if (!a) { a = vr.spawnWild('thorn', G.player.pos); a.c.bloom = false; }
  a.aggro = false; a.trust = 0;
  const hand = a.pos.clone().add(new vr.THREE.Vector3(1, 0.5, 0));
  G.player.speed = 0; G.player.crouch = true;
  for (let i = 0; i < 400 && !a.dead; i++) vr.updateTame(0.05, true, hand);
  return {tamed: a.dead, caught: G.S.trip.caught.length};
});

// guarantee two same-type opposite-sex catches for breeding later
await step('add a breeding pair to the pack', () => {
  const {G} = vr; const f = vr.makeCreature('dewdrip', {sex: 'F', floor: 3, lvl: 3}); const m = vr.makeCreature('dewdrip', {sex: 'M', floor: 3, lvl: 3});
  G.S.trip.caught.push(f, m); return G.S.trip.caught.length;
});

// gather a node
await step('gather a node', () => { const n = vr.G.nodes.find(n => n.zone === 'thorn' && !n.used); vr.gather(n); return vr.G.S.trip.pack; });
await shot('04-thornmeadow');

// extract at the gate: stand in the circle 8 s
await step('hold the gate circle', () => { const P = vr.G.player, x = vr.borderX() + 2.2; P.pos.set(x, vr.heightAt(x, 0), 0); P.yaw = Math.PI / 2; });
for (let i = 0; i < 40; i++) { const h = await page.evaluate(() => vr.G.hold); if (!(await page.evaluate(() => !!vr.G.S.trip))) break; await wait(1000); if (i % 5 === 0) console.log('  hold', h, await page.evaluate(() => vr.G.frameTimes.slice(-1))); }
const ex = await step('extracted', () => ({trip: !!vr.G.S.trip, roster: vr.G.S.roster.length, panel: vr.G.panelKind}));
if (ex.trip) throw new Error('extraction failed');
await shot('05-extract-report');
await step('close report', () => vr.G.closePanel());

// post a worker, open the station panel
await step('post to the Garden', () => { const {G} = vr; const c = G.S.roster.find(c => vr.postable(c)); vr.post(c, 'garden'); G.openPanel('station', 'garden'); return c.name; });
await wait(400); await shot('06-station-panel');
await step('close', () => vr.G.closePanel());

// breed the pair
await step('breed', () => {
  const {G} = vr; const f = G.S.roster.filter(c => c.species === 'dewdrip' && c.sex === 'F').pop(), m = G.S.roster.filter(c => c.species === 'dewdrip' && c.sex === 'M').pop();
  G.penSel = {mom: f.id, dad: m.id}; G.openPanel('pen');
  return vr.canBreed(f, m);
});
await wait(400); await shot('07-pen-preview');
await step('click Breed', () => { const p = vr.G.panelObj; const b = p.buttons.find(b => b.fn && p.builder); /* find by label is not stored; call breed directly */ const {G} = vr; const f = vr.creatureById(G.penSel.mom), m = vr.creatureById(G.penSel.dad); vr.breed(f, m); vr.objective('breed'); G.closePanel(); return G.S.eggs.length; });

// sleep until the egg hatches
for (let i = 0; i < 4; i++) await step('sleep', () => { vr.advanceDay(); return {day: vr.G.S.day, eggs: vr.G.S.eggs.map(e => e.hatchDay)}; });
await step('hatch', () => { const {G} = vr; const e = G.S.eggs.find(e => e.hatchDay <= G.S.day); const c = vr.hatch(e); vr.objective('hatch'); G.openPanel('creature', c.id); return {name: c.name, gen: c.gen, genes: c.genes, looks: c.looks}; });
await wait(400); await shot('08-creature-page');
await step('close', () => vr.G.closePanel());

// craft a Ward Stone (give materials)
await step('craft ward', () => { const {G} = vr; Object.assign(G.S.items, {ingot: 5, fiber: 5, tonic: 3}); const r = vr.VR.RECIPES.find(r => r.id === 'ward'); return vr.craft(r); });

// claim Thornmeadow: start a surge and fast-forward it
await step('start the surge', () => { const {G} = vr; const h = vr.VR.ZONES[1].heartroot; const P = G.player; P.pos.set(h.x - 5, vr.heightAt(h.x - 5, h.z), h.z); P.yaw = -Math.PI / 2; vr.startTrip(); vr.startSurge('thorn'); return !!G.surge; });
await wait(4000); await shot('09-surge');
await step('win the surge', () => { const {G} = vr; G.godMode = true; G.surge.t = G.surge.cfg.seconds; G.surge.wave = G.surge.cfg.waves; for (const f of G.foes.slice()) vr.hurt(f, 9999, {from: 'player'}); return G.foes.length; });
await wait(800);
const claimed = await step('claimed', () => ({claimed: vr.G.S.zones.thorn.claimed, border: vr.borderX(), trip: !!vr.G.S.trip, panel: vr.G.panelKind}));
if (!claimed.claimed) throw new Error('claim failed');
await shot('10-claimed');
await step('close', () => vr.G.closePanel());

// the Delve and Rootmaw
await step('go to the Delve', () => { const {G} = vr; const d = vr.VR.DELVE_MOUTH; G.player.pos.set(d.x - 2, vr.heightAt(d.x - 2, d.z), d.z); vr.startTrip(); G.enterDelve(); });
await wait(1200);
await step('walk to the boss room', () => { const {G} = vr; G.player.pos.set(0, 0, 260 + 44); G.player.yaw = Math.PI; });
await wait(1500); await shot('11-rootmaw');
await step('beat Rootmaw', () => { const {G} = vr; for (const f of G.foes.slice()) vr.hurt(f, 99999, {from: 'player'}); return {boss: G.S.boss, foes: G.foes.length}; });
await step('leave the Delve', () => { vr.G.player.pos.set(0, 0, 260 + 54); });
await wait(1500);
await step('back in Blightfen', () => ({inDelve: vr.G.inDelve, x: Math.round(vr.G.player.pos.x)}));
await step('look around Blightfen', () => { const P = vr.G.player; P.yaw = Math.PI / 2 + 0.6; });
await wait(2500); await shot('12-blightfen');

// death and recovery
await step('fall in Blightfen', () => { const {G} = vr; G.godMode = false; vr.hurtPlayer(9999); });
await wait(1500);
const death = await step('after death', () => ({taken: vr.G.S.taken.length, trip: !!vr.G.S.trip, panel: vr.G.panelKind, hp: vr.G.player.hp}));
await shot('13-death-report');
await step('close', () => vr.G.closePanel());

const goals = await step('objectives', () => Object.keys(vr.G.S.objectives));
await step('frame times (ms)', () => vr.G.frameTimes.slice(-5).map(x => Math.round(x * 10) / 10));
await browser.close();
if (errors.length) { console.error('PAGE ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('\nAll steps passed, no page errors.');
