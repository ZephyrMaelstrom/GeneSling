// Shared test setup: serve dist/ over HTTP (like GitHub Pages) and open the game in headless Chrome.
// Each openGame() call gets a fresh browser context, so storage (IndexedDB, localStorage) starts empty.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import puppeteer from 'puppeteer';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json'};
export const wait = ms => new Promise(r => setTimeout(r, ms));

// Serve the repo root, so tests can open dist/index.html and the archived v5 build.
export async function startServer() {
  const server = http.createServer(async (req, res) => {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await readFile(file);
      res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'}).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {server, url: `http://127.0.0.1:${server.address().port}`};
}

export async function launch() {
  return puppeteer.launch({executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox']});
}

// Opens a page in a fresh context, collects page errors, and waits for the game to boot.
// opts.before(page) runs before navigation (e.g. to plant a save); opts.page = a path under the repo.
export async function openGame(browser, base, opts = {}) {
  const context = opts.context || await browser.createBrowserContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  await page.setViewport(opts.viewport || {width: 1200, height: 820});
  if (opts.before) await opts.before(page);
  await page.goto(base + (opts.page || '/dist/index.html'));
  if (!opts.page) await page.evaluate(() => window.gameReady);
  else await wait(500);
  return {context, page, errors};
}
