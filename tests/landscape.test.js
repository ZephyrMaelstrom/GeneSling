// Phones held sideways (a Galaxy S23 in landscape is about 780 × 360): the raid's touch controls sit
// where they should and don't overlap, the menu holds the backpack and creature and weapon management,
// releasing a creature sets it loose to be caught again, and the hideout's pinned bar stays compact.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame, wait} from './helpers.js';

const S23 = {width: 780, height: 360, isMobile: true, hasTouch: true, deviceScaleFactor: 3, isLandscape: true};
let srv, browser, page, errors;
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url, {viewport: S23}));
  await page.evaluate(() => closeModal());
});
after(async () => { await browser.close(); srv.server.close(); });

const rects = () => page.evaluate(() => {
  const r = id => { const b = document.getElementById(id).getBoundingClientRect(); return {l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height}; };
  const sb = stickBases(), sr = stickR();
  return {vw: innerWidth, vh: innerHeight, sb, sr, q: r('tQ'), e: r('tE'), combo: r('tCombo'), cage: r('tCage'), roll: r('tRoll'), menu: r('btnPause'), mini: r('mini'), left: document.querySelector('.lcol').getBoundingClientRect().bottom};
});

test('the raid controls are laid out for a phone held sideways', async () => {
  await page.evaluate(async () => { S.settings.god = true; startRaid('raid', 1); await new Promise(r => setTimeout(r, 300)); R.combo.cd = 0; });
  await wait(200);
  const x = await rects();
  const {sb, sr} = x, mv = sb.move, aim = sb.aim;
  assert.ok(mv.x < x.vw / 4 && mv.y > x.vh / 2, 'move stick bottom left');
  assert.ok(aim.x > x.vw * 3 / 4 && aim.y > x.vh / 2, 'aim stick bottom right');
  for (const k of ['q', 'e']) assert.ok(x[k].b <= aim.y - sr + 2 && Math.abs((x[k].l + x[k].r) / 2 - aim.x) < 70, `skill ${k} sits above the aim stick`);
  assert.ok(x.q.r <= x.e.l, 'skill 1 left of skill 2');
  assert.ok(x.combo.b <= Math.min(x.q.t, x.e.t) && x.combo.w > 0, 'combo above the skills');
  assert.ok(x.cage.r <= aim.x - sr && x.cage.w > x.q.w, 'a larger Catch button left of the aim stick');
  assert.ok(x.menu.t < 60 && x.mini.t < 60 && x.mini.r > x.vw - 20 && x.menu.r <= x.mini.l, 'menu button and minimap at the top right');
  assert.ok(x.left <= mv.y - sr, 'the stats and party column clears the move stick');
  const boxes = ['q', 'e', 'combo', 'cage', 'roll', 'menu', 'mini'].map(k => [k, x[k]]);
  for (const [a, A] of boxes) {
    assert.ok(A.l >= 0 && A.t >= 0 && A.r <= x.vw && A.b <= x.vh, `${a} is on screen`);
    for (const [b, B] of boxes) if (a < b) assert.ok(A.r <= B.l || B.r <= A.l || A.b <= B.t || B.b <= A.t, `${a} and ${b} don't overlap`);
  }
});

test('left-handed layout mirrors the controls', async () => {
  const x = await page.evaluate(async () => { S.opts.hand = 'left'; applyOpts(); await new Promise(r => setTimeout(r, 50));
    const b = id => document.getElementById(id).getBoundingClientRect(); const out = {aim: stickBases().aim, q: b('tQ').left, cage: b('tCage').right};
    S.opts.hand = 'right'; applyOpts(); return out; });
  assert.ok(x.aim.x < 200 && x.q < 200 && x.cage < 400);
});

test('the buttons fire skills, the combo and the cage', async () => {
  const r = await page.evaluate(async () => {
    R.comps[0].abil = 0; const tap = id => document.getElementById(id).dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    tap('tQ'); const used = R.comps[0].abil > 0;
    tap('tCage'); const msg1 = R.msg;
    updHud(); return {used, msg1, label: document.querySelector('#tCage span').textContent, skill: document.querySelector('#tE span').textContent};
  });
  assert.equal(r.used, true);
  assert.match(r.msg1, /wild creature|cages|Slot 3 is full/i);
  assert.match(r.label, /left/);
  assert.ok(r.skill.length > 0);
});

test('the menu holds the backpack, creatures, weapons and settings', async () => {
  const r = await page.evaluate(async () => {
    R.bag.ore = 7; R.tonics = 1;
    document.getElementById('btnPause').click();
    const t = () => document.getElementById('pauseBox').innerText;
    const bag = t(), paused = R.paused;
    const go = k => document.querySelector(`[data-p="mtab"][data-k="${k}"]`).click();
    go('party'); const party = t();
    go('gear'); const gear = t(); const before = R.active; const sw = document.querySelector('[data-p="switch"]'); if (sw) sw.click(); const switched = R.active !== before || !sw;
    go('options'); const opts = t();
    document.querySelector('[data-p="resume"]').click();
    return {paused, bag, party, gear, opts, switched, resumed: !R.paused};
  });
  assert.equal(r.paused, true);
  assert.match(r.bag, /Ore\s*7/); assert.match(r.bag, /Tonics\s*1/); assert.match(r.bag, /Bag \d+\/\d+/);
  assert.match(r.party, /Combat 1/); assert.match(r.party, /Slot 3/);
  assert.match(r.gear, /durability|never breaks/);
  assert.equal(r.switched, true);
  assert.match(r.opts, /Abandon raid/);
  assert.equal(r.resumed, true);
});

test('releasing a catch sets it loose in the room, and it can be caught again', async () => {
  const r = await page.evaluate(async () => {
    R.enemies = [];
    const c = makeCreature('cindlet', 'wild', 3); c.captureRaid = R.id; R.slot3 = {c};
    const full = (useCage(), R.msg);
    const e = releaseCreature(2);
    const loose = R.enemies.includes(e) && e.c === c && e.kind === 'wild' && R.slot3 === null && e.hp > 0;
    const room = roomAt(e.x, e.y, 0) === roomAt(R.p.x, R.p.y, 0);
    S.settings.instant = true; e.x = R.p.x + 10; e.y = R.p.y; useCage(); S.settings.instant = false;
    return {full, loose, room, again: R.slot3 && R.slot3.c === c};
  });
  assert.match(r.full, /Release a creature/);
  assert.equal(r.loose, true);
  assert.equal(r.room, true, 'it runs wild in the same room');
  assert.equal(r.again, true);
});

test('a released roster creature is gone unless caught again before the raid ends', async () => {
  const r = await page.evaluate(async () => {
    R.slot3 = null;
    const c = R.comps[1].c, n = S.creatures.length;
    document.getElementById('btnPause').click(); document.querySelector('[data-p="mtab"][data-k="party"]').click();
    document.querySelector('[data-p="release"][data-i="1"]').click();
    const warn = document.getElementById('pauseBox').innerText.includes('leaves for good');
    document.querySelector('[data-p="release"][data-i="1"]').click();
    const gone = !S.creatures.includes(c) && R.comps[1] === null && !R.paused;
    R.enemies = []; endRaid('extract'); closeModal();
    return {warn, gone, lost: !S.creatures.includes(c), count: n - S.creatures.length, log: S.log.some(l => l.msg.includes('released in the Bloom'))};
  });
  assert.equal(r.warn, true, 'the menu warns before releasing a roster creature');
  assert.equal(r.gone, true);
  assert.equal(r.lost, true);
  assert.equal(r.count, 1);
  assert.equal(r.log, true);
  const t = await page.evaluate(async () => { startRaid('tutorial'); await new Promise(r => setTimeout(r, 200)); const ok = canRelease(0); endRaid('quit'); closeModal(); return ok; });
  assert.equal(t, false, 'nothing can be released in the tutorial');
});

test('every raid menu fits the screen at once, and no drag in a raid scrolls anything', async () => {
  const r = await page.evaluate(async () => {
    S.settings.god = true; startRaid('raid', 1); await new Promise(res => setTimeout(res, 200));
    BUFF_IDS.slice(0, 6).forEach(k => applyBuff(k, true)); applyCurse(CURSE_IDS[0]);
    const c = makeCreature('cindlet', 'wild', 3); c.captureRaid = R.id; R.slot3 = {c};
    const box = document.getElementById('pauseBox'), out = {};
    const check = name => { const b = box.getBoundingClientRect();
      out[name] = {fits: box.scrollHeight <= box.clientHeight + 1 && box.scrollWidth <= box.clientWidth + 1, onScreen: b.top >= 0 && b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth,
        zoom: +(box.firstElementChild.style.zoom || 1), overflow: getComputedStyle(box).overflowY}; };
    for (const t of ['bag', 'party', 'gear', 'options']) { R.menuTab = t; setPause(true); check(t); }
    R.releaseArm = 1; R.menuTab = 'party'; setPause(true); check('release');
    setPause(false); openShop({idx: 0}); check('peddler');
    setPause(false); openShrine({idx: 1}); check('shrine');
    setPause(false); openVeinChoice(); check('veins');
    setPause(false); openEndingChoice(); check('ending');
    const drag = el => { const t = new Touch({identifier: 7, target: el, clientX: 300, clientY: 200});
      const ev = new TouchEvent('touchmove', {bubbles: true, cancelable: true, touches: [t], changedTouches: [t]}); el.dispatchEvent(ev); return ev.defaultPrevented; };
    out.dragMenu = drag(box.querySelector('.mcre') || box); out.dragHud = drag(document.getElementById('hudParty'));
    setPause(false); R.enemies = []; endRaid('quit'); closeModal(); S.settings.god = false;
    return out;
  });
  for (const k of ['bag', 'party', 'gear', 'options', 'release', 'peddler', 'shrine', 'veins', 'ending']) {
    assert.equal(r[k].fits, true, `${k} fits without scrolling`);
    assert.equal(r[k].onScreen, true, `${k} is on screen`);
    assert.equal(r[k].overflow, 'hidden', `${k} can't scroll`);
    assert.ok(r[k].zoom >= .8, `${k} needs little or no shrinking (zoom ${r[k].zoom})`);
  }
  assert.equal(r.dragMenu, true, 'a drag on a raid menu is blocked');
  assert.equal(r.dragHud, true, 'a drag elsewhere in the raid is blocked');
});

test('the hideout puts its tabs in a rail down the left side', async () => {
  const x = await page.evaluate(async () => { ui.tab = 'breeding'; renderAll(); await new Promise(r => setTimeout(r, 50));
    const box = el => { const b = el.getBoundingClientRect(); return {left: b.left, right: b.right, width: b.width, height: b.height, bottom: b.bottom}; };
    const n = box(document.getElementById('tabs')), m = box(document.getElementById('main')), last = box([...document.querySelectorAll('#tabs .tab')].pop());
    const cols = getComputedStyle(document.querySelector('.cols')).gridTemplateColumns.split(' ').length;
    return {n, m, last, cols, vh: innerHeight}; });
  assert.ok(x.n.left <= 0 && x.n.width < 140 && x.n.height > x.vh * .8, 'tabs run down the left edge');
  assert.ok(x.m.left >= x.n.right, 'the page sits beside the rail');
  assert.ok(x.last.bottom <= x.vh, 'every tab is reachable without scrolling the rail');
  assert.equal(x.cols, 2, 'pages use two columns sideways');
});

test('the hideout’s pinned bar stays compact sideways', async () => {
  const h = await page.evaluate(async () => { ui.tab = 'hideout'; renderAll(); await new Promise(r => setTimeout(r, 100)); return document.querySelector('.topbar').getBoundingClientRect().height; });
  assert.ok(h <= 44, `topbar is ${h}px tall`);
  assert.deepEqual(errors, []);
});
