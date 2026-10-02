// Regenerates tests/fixtures/v5-save.json from the archived v5 prototype, so the save test
// loads a save the real v5 build wrote. Run with: node scripts/make-v5-fixture.js
// The v5 page is driven through its globals to build up a varied save: the tutorial, a Lab
// squad, research, an evolution, bond, an egg, and a floor-1 raid ending in death.
import {writeFileSync} from 'node:fs';
import {startServer, launch, openGame, wait} from '../tests/helpers.js';

const srv = await startServer();
const browser = await launch();
const {page, errors} = await openGame(browser, srv.url, {page: '/prototype/archive/genesling-v5.html'});
const raw = await page.evaluate(async () => {
  const pause = ms => new Promise(r => setTimeout(r, ms));
  closeModal();
  S.tutorialDone = true;
  act('lab-squad', {});
  S.coin += 3000; S.ore += 600; S.shards += 10; S.food += 40;
  for (const k of RES_IDS) { buyResearch(k); buyResearch(k); }
  act('lab-evoready', {}); evolve(byId(S.loadout.slots[0]));
  act('lab-bond', {}); act('lab-prove', {});
  S.sections.nursery = S.sections.nursery || {}; S.points = S.points || {};
  const F = S.creatures.find(c => c.sex === 'F'), M = S.creatures.find(c => c.sex === 'M');
  ui.mom = String(F.id); ui.dad = String(M.id); breed();
  S.settings.god = true; startRaid('raid', 1); await pause(300);
  R.enemies = []; endRaid('dead'); await pause(100); closeModal();
  S.settings.god = false;
  addLog('Fixture save written by the v5 prototype.');
  save();
  return localStorage.getItem('genesling-save-v5');
});
await browser.close(); srv.server.close();
if (errors.length) { console.error(errors); process.exit(1); }
const save = JSON.parse(raw);
writeFileSync('tests/fixtures/v5-save.json', JSON.stringify(save, null, 1) + '\n');
console.log(`wrote tests/fixtures/v5-save.json: v${save.v}, day ${save.day}, ${save.creatures.length} creatures, ${save.eggs.length} eggs`);
