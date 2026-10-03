// Counts draw calls and triangles in a busy Thornmeadow view (Quest budget: ~150 calls, ~300k tris).
import puppeteer from 'puppeteer';
import {resolve} from 'node:path';
const browser = await puppeteer.launch({executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage(); await page.setViewport({width: 1280, height: 720});
await page.goto('file://' + resolve('dist-dev/index.html')); await page.waitForFunction('window.gameReady === true');
await page.click('#btnDesk'); await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => { const {G} = vr; G.closePanel(); G.player.pos.set(5, vr.heightAt(5, 0), 0); G.player.yaw = -Math.PI / 2; vr.startTrip(); for (let i = 0; i < 10; i++) vr.spawnWild('thorn', G.player.pos); });
await new Promise(r => setTimeout(r, 2500));
const info = await page.evaluate(() => { const i = vr.G.renderer.info.render; return {calls: i.calls, triangles: i.triangles, wilds: vr.G.wilds.length}; });
console.log(info); await browser.close();
