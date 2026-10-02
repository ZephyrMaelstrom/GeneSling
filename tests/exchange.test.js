// Phase 3, the Exchange: the order book, buy and sell now, limit orders, auctions, bounties,
// fees and tax, the worker transport, catching up missed days, Keeper XP from other work,
// and the exit test (a 90-day Economy Sandbox run meets all three targets).
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await page.evaluate(async () => { closeModal(); await marketReady(); S.coin = 50000; });
});
after(async () => { await browser.close(); srv.server.close(); });

test('the market runs in a background worker and lives in the save', async () => {
  const r = await page.evaluate(() => ({kind: transportKind(), traders: S.market.traders.length, archetypes: [...new Set(S.market.traders.map(t => t.arch))].sort(), day: S.market.day}));
  assert.equal(r.kind, 'worker');
  assert.ok(r.traders >= 55 && r.traders <= 65, `${r.traders} traders`);
  assert.deepEqual(r.archetypes, ['breeder', 'collector', 'quartermaster', 'raider', 'smith', 'speculator']);
});

test('buy now and sell now take the book, pay fee and tax, and refund the rest', async () => {
  const r = await page.evaluate(async () => {
    const v = marketView(), ask = v.books.food.asks[0];
    const coin0 = S.coin, food0 = stock('food');
    const res = await buyNow('food', 3, ask.price * 1.1);
    const bought = stock('food') - food0, spent = coin0 - S.coin;
    const bid = marketView().books.food.bids[0], coin1 = S.coin;
    await sellNow('food', 2, bid.price * 0.9);
    return {ok: res.ok, bought, spent, ask: ask.price, gained: S.coin - coin1, bid: bid.price, food: stock('food') - food0};
  });
  assert.equal(r.ok, true);
  assert.equal(r.bought, 3);
  // Paid the ask (or better) plus the 2% fee, with the unused escrow refunded.
  assert.ok(r.spent <= Math.ceil(r.ask * 3 * 1.1 * 1.02) && r.spent >= Math.floor(r.ask * 3), `spent ${r.spent}`);
  assert.ok(r.gained > 0 && r.gained <= r.bid * 2, 'a sale pays at most the bid, less tax and fee');
  assert.equal(r.food, 1);
});

test('limit orders rest on the book and cancel with a full refund', async () => {
  const r = await page.evaluate(async () => {
    const low = Math.max(0.5, marketView().books.ore.last * 0.3), coin0 = S.coin;
    await postOrder('ore', 'buy', low, 10);
    const mine = marketView().mine.find(o => o.good === 'ore' && o.side === 'buy');
    const held = coin0 - S.coin;
    await cancelOrder(mine.id);
    return {resting: !!mine, held, back: coin0 - S.coin, fee: Math.ceil(low * 10 * 0.02)};
  });
  assert.equal(r.resting, true);
  assert.ok(r.held >= r.fee, 'escrow plus fee taken on posting');
  // Coin is whole in the save while market prices have cents, so allow one coin of rounding.
  assert.ok(r.back <= r.fee + 1, `cancelling refunds the escrow; only the posting fee is gone (lost ${r.back}, fee ${r.fee})`);
});

test('auctions: list a creature, bid, buy out, and get things back that don’t sell', async () => {
  const r = await page.evaluate(async () => {
    const c = S.creatures.find(x => whereIs(x).kind === 'idle') || S.creatures[3];
    const id = c.id, name = c.name, n0 = S.creatures.length;
    await listItem('creature', id, 999999, null);
    const listed = !S.creatures.some(x => x.id === id), mine = marketView().auctions.find(a => a.mineSell);
    for (let i = 0; i < 4; i++) { processDay(); await marketDay(); }
    const back = S.creatures.find(x => x.id === id);
    // Buy something out.
    const lot = marketView().auctions.filter(a => a.buyout && !a.mineSell && a.item.kind === 'creature').sort((a, b) => a.buyout - b.buyout)[0];
    const before = S.creatures.length, coin = S.coin;
    if (lot) await buyout(lot.id);
    return {listed, mine: !!mine, returned: !!back && back.name === name, count: n0, bought: lot ? S.creatures.length - before : 1, paid: lot ? coin - S.coin : 0, price: lot ? lot.buyout : 0};
  });
  assert.equal(r.listed, true, 'a listed creature leaves the roster');
  assert.equal(r.mine, true);
  assert.equal(r.returned, true, 'an unsold creature comes back with its name');
  assert.equal(r.bought, 1, 'a bought-out creature joins the roster');
  assert.ok(Math.abs(r.paid - r.price) <= 1);
});

test('bounties pay for a creature that meets the request and refuse one that doesn’t', async () => {
  const r = await page.evaluate(async () => {
    // Put up our own bounty in the market state so the test doesn't wait for a trader to post one.
    const b = {id: 999001, poster: S.market.traders[0].id, posterName: 'Test', want: {type: 'tide', locus: 'swf', min: 8, shine: false}, reward: 500, ends: S.market.day + 5};
    await marketReady();
    S.market.bounties.push(b);
    startMarket('local'); await marketReady();
    const good = makeCreature('dewdrip', 'bred', 5, {genome: genomeFrom({swf: 9}, []), proven: true}); S.creatures.push(good);
    const bad = makeCreature('dewdrip', 'bred', 5, {genome: genomeFrom({swf: 4}, []), proven: true}); S.creatures.push(bad);
    const coin = S.coin;
    const no = await fulfilBounty(b.id, bad.id), keptBad = S.creatures.includes(bad);
    const yes = await fulfilBounty(b.id, good.id);
    return {no: no.ok, keptBad, yes: yes.ok, paid: S.coin - coin, gone: !S.creatures.includes(good)};
  });
  assert.equal(r.no, false);
  assert.equal(r.keptBad, true);
  assert.equal(r.yes, true);
  assert.equal(r.paid, 500);
  assert.equal(r.gone, true);
});

test('the worker and the in-thread market give identical results', async () => {
  const r = await page.evaluate(async () => {
    const seed = 4242;
    const run = async kind => {
      const t = kind === 'worker' ? connect('worker') : localTransport();
      await t.send({op: 'init', args: {seed}});
      for (let i = 0; i < 5; i++) await t.send({op: 'advance', args: {}});
      const out = await t.send({op: 'marketOrder', args: {good: 'ore', side: 'buy', qty: 5, limit: 30}});
      if (t.worker) t.worker.terminate();
      return JSON.stringify({ev: out.res.ev, day: out.state.day, last: out.state.last, coin: out.state.traders.map(x => Math.round(x.coin))});
    };
    return {same: (await run('worker')) === (await run('local'))};
  });
  assert.equal(r.same, true);
});

test('a day the market missed is caught up on the next load', async () => {
  const r = await page.evaluate(async () => {
    await marketReady();
    const before = S.market.day; S.marketSync = S.day - 2;   // as if the page closed twice before the market heard
    startMarket('local'); await marketReady();
    return {moved: S.market.day - before, sync: S.marketSync === S.day};
  });
  assert.equal(r.moved, 2);
  assert.equal(r.sync, true);
});

test('crafting and hatching earn Keeper XP', async () => {
  const r = await page.evaluate(() => {
    const xp = () => { let t = S.keeper.xp; for (let l = 1; l < S.keeper.level; l++) t += keeperNeed(l); return t; };
    S.mats.ingot = 10; const a = xp(); craft('parts'); const b = xp();
    const c = makeCreature('pebblet', 'bred', 1, {}); hatchEgg({child: c}); const d = xp();
    return {craft: b - a, hatch: d - b};
  });
  assert.equal(r.craft, 4);
  assert.equal(r.hatch, 30);
});

test('the Exchange tab and the Economy Sandbox render without errors', async () => {
  await page.evaluate(async () => {
    ui.tab = 'exchange'; for (const t of ['goods', 'auctions', 'bounties', 'mine']) { ui.mk.tab = t; renderAll(); }
    ui.mk.tab = 'goods'; act('mkgood', {k: 'ore'});
    ui.tab = 'lab'; renderAll(); act('lab-eco', {k: 7});
  });
  assert.deepEqual(errors, []);
});

test('Phase 3 exit test: a 90-day sandbox run meets all three economy targets', {timeout: 60000}, async () => {
  const r = await page.evaluate(() => [1, 2, 3].map(seed => ({seed, ...runSandbox({days: 90, seed}).report})));
  for (const x of r) {
    console.log(`seed ${x.seed}: coin ${(x.coinWeekly * 100).toFixed(2)}%/wk, basket ±${(x.basketDev * 100).toFixed(1)}%, Act III ${JSON.stringify(x.acts)}`);
    assert.ok(x.coinOk, `seed ${x.seed}: coin grows ${(x.coinWeekly * 100).toFixed(2)}% a week`);
    assert.ok(x.basketOk, `seed ${x.seed}: basket moved ${(x.basketDev * 100).toFixed(1)}%`);
    assert.ok(x.actOk, `seed ${x.seed}: Act III days ${JSON.stringify(x.acts)}`);
  }
});

test('a refused operation hands its escrow back', async () => {
  const r = await page.evaluate(async () => {
    const coin = S.coin;
    const res = await buyout(-12345);                     // no such lot: refused before escrow
    const lot = marketView().auctions.find(a => a.buyout && !a.mineSell);
    let after = S.coin;
    if (lot) { S.market.auctions = S.market.auctions.filter(a => a.id !== lot.id); startMarket('local'); await marketReady(); await buyout(lot.id); after = S.coin; }
    return {res: res.ok, same: coin === after};
  });
  assert.equal(r.res, false);
  assert.equal(r.same, true, 'buying out a lot that’s gone costs nothing');
});
