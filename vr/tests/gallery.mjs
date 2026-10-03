// Renders a lineup of creatures with different genomes, for checking looks-from-genes by eye.
import puppeteer from 'puppeteer';
import {resolve} from 'node:path';
const browser = await puppeteer.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage(); await page.setViewport({width: 1280, height: 720});
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('file://' + resolve('dist-dev/index.html'));
await page.waitForFunction('window.gameReady === true');
await page.click('#btnDesk'); await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => {
  const {G, THREE} = vr; G.closePanel();
  G.player.pos.set(-40, vr.heightAt(-40, 30), 30); G.player.yaw = 0; G.player.pitch = -0.32;
  const sp = ['cindlet', 'pyrrox', 'puffcap', 'shroomite', 'dewdrip', 'coralisk'];
  const looks = [[0, 1, 1, 0], [3, 2, 2, 0], [5, 3, 1, 1], [0, 4, 3, 0], [6, 5, 0, 2], [2, 0, 2, 0]];
  sp.forEach((s, i) => {
    const c = vr.makeCreature(s, {floor: 3}); const [h, p, z, sh] = looks[i];
    c.genome.hue = [h, h]; c.genome.pat = [p, p]; c.genome.size = [z, z]; c.genome.shine = [sh, sh];
    vr.express(c);
    const x = -40 - 5 + (i % 3) * 5, zz = 30 - 6 - Math.floor(i / 3) * 4;
    const a = vr.makeActor(c, 'home', new THREE.Vector3(x, vr.heightAt(x, zz), zz)); a.heading = Math.PI; a.grp.rotation.y = Math.PI + (i - 2.5) * 0.15;
    a.bar.set([`${c.species} · ${['Natural','Warm','Sunlit','Verdant','Tidal','Azure','Dusk','Blush'][h]} ${['Plain','Spots','Stripes','Ombre','Rings','Runes'][p]}`]); a.bar.visible = true;
  });
});
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({path: 'tests/shots/00-gallery.png'});
console.log(errors.length ? errors : 'ok'); await browser.close();
