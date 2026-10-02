// Genetics 2.0: expression, inheritance odds, mutation, lineage, the breeding screen's odds,
// in-game breeding rules, and the Phase 1 exit test (the simulator's Apex pace).
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser, page, errors;
before(async () => {
  srv = await startServer(); browser = await launch();
  ({page, errors} = await openGame(browser, srv.url));
  await page.evaluate(() => {
    closeModal();
    // A bare creature for pure genetics checks: genome plus the fields express() reads.
    window.mk = (genome, o = {}) => express({id: o.id || 0, species: 'pyrrox', stage: 0, gen: o.gen ?? 1, sex: o.sex || 'F', pers: 'calm', genome, ...o});
    window.plain = (over = {}) => ({...genomeFrom({}, []), ...over});
  });
});
after(async () => { await browser.close(); srv.server.close(); });

test('stats show 60% of the better copy plus 40% of the worse', async () => {
  const r = await page.evaluate(() => {
    const c = mk(plain({pow: [9, 4], vig: [11, 10], kn: [6, 6]}));
    return [c.genes.pow, c.genes.vig, c.genes.kn];
  });
  assert.deepEqual(r, [7, 10.6, 6]);
});

test('dominant traits show with one copy, recessive ones need two', async () => {
  const r = await page.evaluate(() => {
    const c = mk(plain({t1: ['thick', null], t2: ['keen', null], t3: ['keen', 'keen']}));
    const d = mk(plain({t1: ['keen', 'glow']}));
    return {c: c.traits, carried: carriedTraits(mk(plain({t1: ['keen', null]}))), d: d.traits};
  });
  assert.deepEqual(r.c, ['thick', 'keen']);
  assert.deepEqual(r.carried, ['keen']);
  assert.deepEqual(r.d, ['glow'], 'a dominant trait beats a recessive one in the same slot');
});

test('looks: natural hue dominant, patterns beat plain, size blends, Prismatic needs two copies', async () => {
  const r = await page.evaluate(() => [
    expressLooks(plain({hue: [0, 5], pat: [0, 5], size: [0, 3], shine: [1, 0]})),
    expressLooks(plain({hue: [3, 5], pat: [2, 5], size: [2, 3], shine: [1, 1]})),
    expressLooks(plain({shine: [0, 2]})).shine,
  ]);
  assert.deepEqual(r[0], {hue: 0, pat: 5, size: 2, shine: 0});
  assert.deepEqual(r[1], {hue: 3, pat: 2, size: 3, shine: 1});
  assert.equal(r[2], 2, 'Bloomscar shows with one copy');
});

test('the father passes his better copy 65% of the time, the mother 50%', async () => {
  const r = await page.evaluate(() => {
    const rng = makeRng(11), mom = mk(plain({pow: [8, 2]}), {sex: 'F'}), dad = mk(plain({pow: [9, 3]}), {sex: 'M'});
    let momBetter = 0, dadBetter = 0, persMom = 0, persDad = 0; const N = 20000;
    mom.pers = 'brave'; dad.pers = 'timid';
    for (let i = 0; i < N; i++) {
      const g = inherit(mom, dad, {rate: 0}, rng).genome;
      momBetter += g.pow[0] === 8; dadBetter += g.pow[1] === 9;
      const p = inheritPersonality(mom, dad, rng); persMom += p === 'brave'; persDad += p === 'timid';
    }
    return {mom: momBetter / N, dad: dadBetter / N, persMom: persMom / N, persDad: persDad / N};
  });
  assert.ok(Math.abs(r.mom - 0.5) < 0.02, `mother ${r.mom}`);
  assert.ok(Math.abs(r.dad - 0.65) < 0.02, `father ${r.dad}`);
  // 50% mother, 30% father, 20% random (which can also land on either parent's personality).
  assert.ok(Math.abs(r.persMom - (0.5 + 0.2 / 8)) < 0.02, `personality from mother ${r.persMom}`);
  assert.ok(Math.abs(r.persDad - (0.3 + 0.2 / 8)) < 0.02, `personality from father ${r.persDad}`);
});

test('two plain carriers can hatch a surprise', async () => {
  const p = await page.evaluate(() => {
    const rng = makeRng(5), mom = mk(plain({t2: ['vamp', null]}), {sex: 'F'}), dad = mk(plain({t2: [null, 'vamp']}), {sex: 'M'});
    let shown = 0; const N = 8000;
    for (let i = 0; i < N; i++) if (express({...mom, genome: inherit(mom, dad, {rate: 0}, rng).genome}).traits.includes('vamp')) shown++;
    return {parents: [mom.traits.includes('vamp'), dad.traits.includes('vamp')], rate: shown / N, odds: breedOdds(mom, dad).traits.vamp};
  });
  assert.deepEqual(p.parents, [false, false]);
  assert.ok(Math.abs(p.rate - 0.25) < 0.02, `surprise rate ${p.rate}`);
  assert.equal(p.odds, 0.25, 'the breeding preview shows the same odds');
});

test('mutation: 1.5% per gene, more with a wild parent, Apex only from 10', async () => {
  const r = await page.evaluate(() => {
    const rng = makeRng(3), mom = mk(plain({pow: [10, 10]}), {gen: 2}), dad = mk(plain({pow: [10, 10]}), {sex: 'M', gen: 2});
    const wild = mk(plain(), {sex: 'M', gen: 0});
    let muts = 0, apex = 0, over = 0; const N = 20000;
    for (let i = 0; i < N; i++) {
      const g = inherit(mom, dad, {rate: mutationRate(mom, dad)}, rng);
      muts += g.mutations.length;
      for (const m of g.mutations) if (m.locus === 'pow' && m.to === 11) apex++;
      if (g.genome.kn.some(v => v > 10)) over++;
    }
    return {perLocus: muts / N / ALL_LOCI.length, apex, over, base: mutationRate(mom, dad), bloomblood: mutationRate(mom, wild)};
  });
  assert.ok(Math.abs(r.perLocus - 0.015) < 0.002, `per locus ${r.perLocus}`);
  assert.ok(r.apex > 0, 'Power 10 can mutate to Apex 11');
  assert.equal(r.over, 0, 'work stats never pass 10');
  assert.equal(r.base, 0.015);
  assert.equal(r.bloomblood, 0.025);
});

test('inbreeding: siblings and parent-child pairs are flagged and risk a defect 25% of the time', async () => {
  const r = await page.evaluate(() => {
    const tree = {1: {}, 2: {}, 3: {mom: 1, dad: 2}, 4: {mom: 1, dad: 2}, 5: {}, 6: {mom: 3, dad: 5}, 7: {}, 8: {mom: 6, dad: 7}, 9: {mom: 4, dad: 10}, 10: {}, 11: {mom: 5, dad: 7}};
    const get = id => tree[id];
    const rng = makeRng(9), mom = mk(plain(), {id: 3}), dad = mk(plain(), {id: 4, sex: 'M'});
    let defects = 0; const N = 8000;
    for (let i = 0; i < N; i++) if (inherit(mom, dad, {rate: 0, inbred: true}, rng).defect) defects++;
    return {sibs: isInbred(3, 4, get), parentChild: isInbred(6, 3, get), unrelated: isInbred(3, 5, get),
      cousins: isInbred(8, 9, get), halfSibs: isInbred(8, 11, get), defects: defects / N};
  });
  assert.deepEqual([r.sibs, r.parentChild, r.halfSibs, r.unrelated, r.cousins], [true, true, true, false, false]);
  assert.ok(Math.abs(r.defects - 0.25) < 0.02, `defect rate ${r.defects}`);
});

test('breeding odds add up and match what hatches', async () => {
  const r = await page.evaluate(() => {
    const rng = makeRng(21), mom = mk(rollGenome(rng, 'wild', 6), {sex: 'F'}), dad = mk(rollGenome(rng, 'wild', 6), {sex: 'M'});
    const odds = breedOdds(mom, dad), sums = GRADE_LOCI.map(k => odds.grades[k].reduce((a, [, p]) => a + p, 0));
    const want = odds.grades.pow.reduce((a, [v, p]) => a + v * p, 0);
    let got = 0; const N = 20000;
    for (let i = 0; i < N; i++) got += expressGrade(inherit(mom, dad, {rate: 0}, rng).genome.pow);
    return {sums, want, got: got / N};
  });
  r.sums.forEach(s => assert.ok(Math.abs(s - 1) < 1e-9));
  assert.ok(Math.abs(r.want - r.got) < 0.05, `expected ${r.want}, sampled ${r.got}`);
});

test('in-game breeding: lineage, generations, pedigree runs, Twin Eggs and Short-lived', async () => {
  const r = await page.evaluate(() => {
    S.coin = 1e6; S.food = 1e4;
    const wardens = [0, 1, 2, 3].map(() => { const w = makeCreature('bastion', 'bred', 30); S.creatures.push(w); return w; });
    S.sections.nursery.cap = 6; S.sections.nursery.ids = wardens.map(w => w.id);
    const F = makeCreature('dewdrip', 'wild', 10, {sex: 'F', proven: true, floor: 6});
    const M = makeCreature('dewdrip', 'wild', 10, {sex: 'M', proven: true, floor: 6});
    F.genome.t1 = ['twin', 'twin']; express(F);
    M.genome.t2 = ['shortlived', 'shortlived']; express(M);
    S.creatures.push(F, M); S.eggs = [];
    let clutches = 0, eggs = 0;
    for (let i = 0; i < 3; i++) { ui.mom = String(F.id); ui.dad = String(M.id); const laid = breed(); if (laid) { clutches++; eggs += laid.length; } act('lab-hatch', {}); }
    const kids = S.creatures.filter(c => c.mom === F.id && c.dad === M.id);
    const k = kids[0];
    return {clutches, eggs, kids: kids.length, gen: k.gen, pure: k.pure, rec: !!S.tree[F.id] && !!S.tree[k.id],
      block: breedBlock(F, M), sib: kids.length > 1 ? inbred(kids[0], kids[1]) : null};
  });
  assert.equal(r.clutches, 2, 'a Short-lived father breeds only twice');
  assert.ok(r.eggs >= 2 && r.eggs <= 4);
  assert.equal(r.kids, r.eggs);
  assert.equal(r.gen, 1);
  assert.equal(r.pure, 2, 'two generations of one species so far');
  assert.equal(r.rec, true, 'parents and children are in the lineage records');
  assert.match(r.block, /Short-lived/);
  if (r.sib !== null) assert.equal(r.sib, true);
  assert.deepEqual(errors, []);
});

test('cut-free creatures gain a fourth trait slot on their final evolution', async () => {
  const r = await page.evaluate(() => {
    const c = makeCreature('cindlet', 'bred', 40, {gen: 3, proven: true});
    S.creatures.push(c); S.coin = 1e6; S.ore = 1e4; S.shards = 99;
    const L = lineOf(c); c.genome.pow = [10, 10]; express(c);
    const before = c.traits.length;
    while (nextForm(c)) evolve(c);
    return {final: isFinal(c), cut: cutFree(c), t4: c.genome.t4[0], shows: c.traits.includes(c.genome.t4[0]), more: c.traits.length > before || c.traits.length === 4, stages: L.length};
  });
  assert.equal(r.final, true);
  assert.equal(r.cut, true);
  assert.ok(r.t4, 'rolled a bonus trait');
  assert.equal(r.shows, true);
});

test('Phase 1 exit test: a focused breeder reaches an Apex genome in 10 to 14 generations', {timeout: 60000}, async () => {
  const r = await page.evaluate(() => { const s = simulate({}, 1); return {median: s.median, reached: s.reached, runs: s.runs}; });
  console.log(`simulator: median ${r.median} generations, ${r.reached}/${r.runs} runs reached Apex`);
  assert.ok(r.median >= 10 && r.median <= 14, `median ${r.median}`);
  assert.ok(r.reached / r.runs >= 0.75, `only ${r.reached}/${r.runs} runs reached Apex`);
});
