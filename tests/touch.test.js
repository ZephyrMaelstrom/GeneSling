// Phone controls: dragging a joystick must move the player, never the page behind the raid
// (Opera and Chrome on Android scrolled the hideout underneath, sliding the whole screen).
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame, wait} from './helpers.js';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });

test('dragging a joystick moves the player and leaves the page pinned', async () => {
  const {page, errors} = await openGame(browser, srv.url, {viewport: {width: 390, height: 844, isMobile: true, hasTouch: true}});
  // A long roster page, scrolled down, as it would be when the player taps Raid from below.
  await page.evaluate(() => { closeModal(); act('lab-squad', {}); act('lab-squad', {}); ui.tab = 'roster'; renderAll(); window.scrollTo(0, 600); });
  const scrolled = await page.evaluate(() => window.scrollY);
  assert.ok(scrolled > 0, 'the hideout page can scroll');

  await page.evaluate(() => { S.settings.god = true; startRaid('arena'); });
  await wait(200);
  const locked = await page.evaluate(() => ({cls: document.documentElement.classList.contains('raiding'),
    pos: getComputedStyle(document.body).position, overflow: getComputedStyle(document.body).overflow}));
  assert.deepEqual(locked, {cls: true, pos: 'fixed', overflow: 'hidden'});

  const before = await page.evaluate(() => ({x: R.p.x, y: R.p.y, h: innerHeight, vv: visualViewport.offsetTop}));
  // Drag the left (move) stick up and to the right.
  await page.touchscreen.touchStart(80, 700);
  for (let i = 1; i <= 8; i++) { await page.touchscreen.touchMove(80 + i * 6, 700 - i * 8); await wait(30); }
  await wait(300);
  const during = await page.evaluate(() => ({x: R.p.x, y: R.p.y, h: innerHeight, vv: visualViewport.offsetTop, stick: !!touch.move,
    scrollTop: document.scrollingElement.scrollTop}));
  await page.touchscreen.touchEnd();
  assert.equal(during.stick, true, 'the move stick took the touch');
  assert.ok(Math.hypot(during.x - before.x, during.y - before.y) > 20, 'the player moved');
  assert.equal(during.h, before.h, 'the viewport did not resize');
  assert.equal(during.vv, before.vv, 'the visual viewport did not shift');
  assert.equal(during.scrollTop, 0, 'the page did not scroll');

  // A drag that starts on a HUD element (not the canvas) is swallowed too.
  const prevented = await page.evaluate(() => {
    const el = document.querySelector('#raid'), t = new Touch({identifier: 9, target: el, clientX: 200, clientY: 400});
    const ev = new TouchEvent('touchmove', {touches: [t], changedTouches: [t], cancelable: true, bubbles: true});
    el.dispatchEvent(ev); return ev.defaultPrevented;
  });
  assert.equal(prevented, true);

  await page.evaluate(() => { R.enemies = []; endRaid('arena'); closeModal(); ui.tab = 'roster'; renderAll(); });
  await wait(100);
  const afterRaid = await page.evaluate(() => ({cls: document.documentElement.classList.contains('raiding'), pos: getComputedStyle(document.body).position}));
  assert.deepEqual(afterRaid, {cls: false, pos: 'static'}, 'the page is unpinned after the raid');
  assert.deepEqual(errors, []);
});
