# How the code is built

GeneSling is plain JavaScript in ES modules, bundled by esbuild into one self-contained page, `dist/index.html`. The game is still the v5 prototype in content and feel; Phase 0 rebuilt the project around it.

Live builds: GitHub Pages deploys `main` on every push (see below). The older v5 test build is a Claude artifact: https://claude.ai/artifact/AX7hVsu2K8rtW8MLRW6CHs

## Build and test

```bash
npm install        # once
npm run build      # src/ -> dist/index.html and the demo, dist/demo/index.html
npm run dev        # rebuild on every change in src/
npm run lint       # ESLint: undeclared names and stale imports
npm test           # build, then run every tests/*.test.js in headless Chrome
```

- Open `dist/index.html` in a browser to play, straight from disk or from any static server.
- Set `CHROME_PATH` to use a Chromium you already have instead of the one puppeteer downloads.
- `dist/` is not committed. GitHub Actions builds it.

## Continuous integration and hosting

- `.github/workflows/ci.yml` runs lint, build and the full test suite on every push and pull request.
- `.github/workflows/pages.yml` builds and deploys `dist/` to GitHub Pages on every push to `main`: the full game at `/GeneSling/` and the demo at `/GeneSling/demo/`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Files

| File | What it holds |
| --- | --- |
| `src/shell.html` | The page: all CSS, HTML layout, HUD, touch controls, modals. The build appends the bundled script to it. |
| `src/main.js` | Entry point. Imports every module, exposes their top-level names on `window` (for tests and the console), and boots. `window.gameReady` resolves once the save is loaded. |
| `src/data/*.json` | All content tables: `species` (types, species, hybrids, evolution lines, names), `attacks` (attacks, abilities, elements, reactions, combos), `creatures` (personalities, bond, genes, traits), `items` (guns, weapon costs, run buffs), `dungeon` (curses, room modifiers, modes), `enemies`, `bosses`, `hideout` (sections, armory, Keeper perks, research), `story` (intro, journal, NPCs and their quests). |
| `src/data/genetics.json` | Every genetics number: loci, expression weights, inheritance and mutation odds, wild gene ranges by floor, stat effects of Grit, Focus and size, look names, tool unlocks, and the simulator's defaults. |
| `src/data/jobs.json` | Every Phase 2 number: materials, station recipes, work rates, fatigue, chemistry and clashes, quality tiers, mastery, recipes, durability, prints, the bag, tonics, raid roles per species, the roster cap, expeditions, the death legacy and the supply sandbox. |
| `src/data/pride.json` | Every Phase 4 number: the grid, footprints, hillside terraces, decor recipes and Comfort, creature life, Hall of Legends perks, titles, sigil parts, the demo's limits and goals, the default layout. |
| `src/data/firebase.json` | The Firebase project for feedback and opt-in play stats (`apiKey`, `projectId`). Empty in the repo, so nothing is sent. |
| `src/data/bloom.json` | Every Phase 5 number: the six veins (palettes, key types, twists, wild types, borrowed foes), twist numbers, the eight layouts and their weights per vein, layout rules, events, variety memory, contracts and vein maps. |
| `src/data/exchange.json` | Every Phase 3 number: commodities and reference prices, fees, the basket, trader archetypes, beliefs, upkeep, auctions, bounties, shocks, Keeper XP for non-raid work, the balance targets and the sandbox's model players. |
| `src/content.js` | Loads the JSON tables and derives id lists and lookups (`SPECIES_IDS`, `LINES`, `comboFor`, `foePool`, ...). |
| `src/rng.js` | The seeded random number generator. |
| `src/util.js` | Small helpers: `$`, `rnd`, `ri`, `pick`, `clamp`, `shuffle`, and their visual-only `fx` versions. |
| `src/genetics.js` | Genetics 2.0, all pure functions: rolling genomes, expression (`express(c)`), inheritance, mutation, lineage checks (inbreeding, pedigree), exact breeding odds, and the Test Lab simulator. |
| `src/geneui.js` | Genetics screens: what the Keeper's eye, Sequencer and Gene Lens show on creature cards, the breeding preview, the family tree, and the simulator panel. |
| `src/jobs.js` | Jobs and production: materials (`amt`, `give`, `pay`), items (weapons and satchels with quality, durability and maker's mark), station output and fatigue, foremen, chemistry, quality rolls and crafting, repairs, prints, the roster cap, raid roles, expeditions and the death legacy. |
| `src/workui.js` | The Workshop, station production panels, expeditions, the Memorial wall, the raid gear picker and the supply sandbox panel. |
| `src/supply.js` | The supply sandbox: a week of the real daily cycle on a throwaway copy of the save, for raid-only and craft-heavy play. |
| `src/exchange/engine.js` | The market: order books and matching, fees and tax, auctions, bounties, 60 traders, shocks, news, price history and the basket index. Pure: state in, events out. |
| `src/exchange/protocol.js` | The one message handler the game talks to (`{op, args}` → `{res, view, state}`); the worker, the tests and a future server all run it. |
| `src/exchange/worker.js`, `client.js` | The background worker and the promise-based client (worker by default, in-thread fallback). `build.mjs` inlines the worker's bundle into the page. |
| `src/exchange/market.js` | Game glue: escrow, applying fills, refunds, auction results and bounty pay to the save, the daily market step and catching up missed days. |
| `src/exchange/sandbox.js` | The Economy Sandbox and its three model players, and the three-target report. |
| `src/exchangeui.js`, `src/chart.js` | The Exchange tab and the Lab's sandbox panel; reusable line charts with crosshair tooltips and table views. |
| `src/save.js` | Versioned IndexedDB saves and migrations. |
| `src/state.js` | Save state `S`, creature creation and `stats()`, breeding and lineage records (`S.tree`), evolution, research, codex (dex), rewards, NPC quests, hideout sections, Keeper rank, day processing, hatching, breeding, deaths and the memorial. |
| `src/sprites.js` | Procedural canvas sprites: a body drawer per species and hybrid, evolution dressing, eggs, NPCs, and the DOM sprite painter. |
| `src/audio.js` | WebAudio sound effects and generative music. |
| `src/hideout.js` | Phase 4's rules: the grid layout (`S.layout`), placing, moving and storing, hillside terraces, decor crafting and Comfort, creature life (`lifePlan`), friendships, titles, trophies, the Hall of Legends and its perks (`perk(key)`), the breeder's sigil, and the v10 save fields (`pridify`). |
| `src/bloom.js` | Phase 5's rules: each floor's plan (vein, layout, event) from the seed, picking a fresh raid seed, wild-type weights per vein, vein keys and bosses, contracts, vein maps, the variety check and the v11 save fields. |
| `src/veins.js` | Phase 5 in play: vein twists (vents, flood, dark, wind, poison), layout rules (gauntlet, sinkhole, nest, caravan, mirror), events, the vein choice, and drawing them. |
| `src/bloomui.js` | The contract board and map picker on the Raid tab, map recipes in the Workshop, the veins in the Codex and the Test Lab's vein jumps and variety check. |
| `src/map.js` | The hideout map canvas, drawn from `S.layout`: buildings by tier, decor, trophies and statues, workers and off-duty creatures, day and night, and build mode's grid and taps. `renderMapTo(g, t)` draws into any canvas (the snapshot uses it). |
| `src/prideui.js` | Build mode's panel, the Hall of Legends, trophy and statue pop-ups, titles and "Bred by" on cards, decor recipes for the Workshop, and the sigil designer. |
| `src/share.js` | Creature cards and hideout snapshots as PNGs, shared through Web Share or downloaded. |
| `src/flags.js`, `src/demo.js` | The `DEMO` build flag; the demo's Act I goals and end screen, feedback, and opt-in play stats. |
| `src/ui.js` | Tabs and screens: raid prep, hideout, roster, breeding, research, armory and market, codex, Test Lab, settings, the intro story. |
| `src/raid.js` | Dungeon generation, the tutorial map, raid start and end, combat, companions, abilities, combos, reactions, curses, room modifiers, bosses, extraction. |
| `src/draw.js` | Raid rendering, minimap, HUD, the game loop, pause menu, input handling and boot. |
| `tests/` | The headless test suite (Node's built-in test runner with puppeteer). `tests/fixtures/v5-save.json` is a save written by the real v5 build. |
| `scripts/make-v5-fixture.js` | Regenerates that fixture from the archived v5 build. |
| `prototype/archive/` | Earlier single-file builds v1 to v5, for reference. `genesling-v5.html` is the last pre-Phase-0 build, and the parity test compares against it. |

Modules import what they use from each other. Modules that need each other at runtime import each other in a cycle, which is fine because they only use each other inside functions, never while loading.

## Content

Tunable numbers and content live in `src/data/*.json`, not in code. Adding a species, gun, enemy or boss is a data change, plus a sprite drawer in `sprites.js` or `draw.js` when it has a new body. NPC arrival rules are data too: `arrive: {always: true}`, `{keeper: 2}`, or `{keeper: 4, section: "nursery", tier: 1}` (any one condition is enough).

## Genetics

- A creature's genome is `c.genome`: `{locus: [fromMother, fromFather]}` for the stats (`pow vig swf tem foc grt kn yld`), trait slots (`t1 t2 t3`, plus the bonus slot `t4`) and looks (`hue pat size shine`).
- `c.genes` (expressed grades), `c.traits` (expressed traits) and `c.looks` are derived. Call `express(c)` after changing a genome; loading a save rebuilds them for every creature.
- `makeCreature(species, origin, level, o)` rolls a genome, or takes `o.genome`. `o.genes` and `o.traits` (v5-style expressed values) set matching allele pairs, which is handy for starters and tests.
- `S.tree` holds small lineage records (name, species, parents, looks) for parents and children, so family trees and inbreeding checks work after a creature is gone. Records more than five generations above every living creature are pruned each day.
- What the player sees depends on `geneSight()`: `stars`, `grades` (Sequencer) or `alleles` (Gene Lens, or the Test Lab's "Reveal genomes" switch).
- Run the simulator from the Test Lab, or call `simulate(options, seed)` from the console.

## Jobs and production

- Coin, ore, food and shards stay on `S` as in v5; every other material is in `S.mats`. Use `amt(id)`, `give(id, n)` and `pay(cost)` so code doesn't care where a material lives.
- Weapons and satchels are items in `S.items` (`{uid, kind, id, q, dur, max, maker, fore, src}`). `S.loadout.guns` and `S.loadout.satchel` hold item uids; an empty first gun slot means the Scav Pistol. In a raid, `R.guns` keeps gun ids for combat and `R.gunItem` the matching items (null for the pistol or a find).
- `stationReport(k)` is the single source for a station's numbers: what each creature adds, the foreman, chemistry, and what limits output. The day (`runStations`) and the screens both use it.
- The raid bag lives in `R.bag` with `R.bagCap`; add loot through `bagAdd(mat, n)`, which refuses what won't fit.

## The Exchange

- The market's whole state is `S.market` (about 150 KB). `S.marketSync` is the last hideout day the market has seen; on load, any missed days are replayed.
- Player actions go through `exchange/market.js`: it escrows coin or goods, sends the operation, and applies the returned events. Never change `S.market` directly.
- The engine keeps its own random generator inside the state, so a saved market replays exactly, and the worker and in-thread transports give identical results (tested).

## The hideout layout

- `S.layout` is a list of `{id, key, x, y, ref?}` in tiles. Rows 0 to 6 are the yard; terraces add rows with negative numbers (`minRow()`), so clearing one never moves anything. `ref` points a trophy at `S.trophies` and a statue at `S.legends`.
- Use `fits`, `placeNew`, `moveItem`, `storeItem` and `autoPlace` rather than editing `S.layout`. Stations and the board can't be stored.
- `comfort()` (0 to 0.2) is applied in `tickFatigue` and `addBond`; `perk(key)` sums legend perks and is applied where each one acts (weapon damage, daily food, rest, raid Keeper XP, player HP, extraction coin, hatchling bond).
- Creature life is visual. `lifePlan(phase)` decides who sleeps, follows or plays, and the map animates it with `fx` randomness.

## The demo and play stats

- `build.mjs` builds twice: `__DEMO__` is `false` for `dist/index.html` and `true` for `dist/demo/index.html`. Read it through `DEMO` in `flags.js`.
- The demo saves to IndexedDB `genesling-demo` (fallback `genesling-demo-save`). The full game reads that save when it has none of its own.
- To turn on feedback and play stats, create a Firebase project with Firestore, put its web `apiKey` and `projectId` in `src/data/firebase.json`, and allow create-only writes to the `stats` and `feedback` collections in the Firestore rules, for example `match /stats/{d} { allow create: if true; }` and the same for `feedback`. Reads stay closed.

## Veins, layouts and events

- `genFloor(seed, floor, arena, vein)` builds a floor from `floorPlan(seed, floor, vein)`; the plan is on `M.plan`. Floors 1 to 3 are always the Rootworks; `R.vein` is the vein chosen at the Floor 3 portal.
- `startRaid` picks a seed with `pickRaidSeed()` (unless one is given) and records it with `rememberSeed()`. Seeds passed in (tests, a future Deepening) are used as they are.
- Twists run in `twistUpdate(dt)` each frame; `floorStart()` sets the floor's modifiers (`R.fmods`, from events and maps) and message; `enterExtras(room)` spawns event enemies and shadows and puts the Choir's enemies to sleep.

## Randomness

- All gameplay randomness goes through `rand()` in `rng.js` (and the helpers `rnd`, `ri`, `pick`, `wpick`, `shuffle` built on it). Never call `Math.random()` in gameplay code.
- Purely visual randomness (screen shake, sparks, hideout wanderers, map flowers, music) uses `fxRand()` and `fxRnd`/`fxRi`/`fxPick`, so effects never shift the gameplay stream.
- `startRaid(mode, floor, seed)` takes an optional seed (a 32-bit integer; one is rolled when omitted) and stores it as `R.seed`. Each floor's map, room plans, modifiers and boss come from their own stream, seeded from the raid seed and the floor number, so the same seed always builds the same floors.
- Combat rolls use the raid's stream after that. They depend on frame timing, so exact replays of whole fights will also need a fixed time step and recorded inputs (planned with the Deepening).

## Saves

- The save lives in IndexedDB (database `genesling`, store `saves`, key `main`) as `{v, saved, data}`, with `data` the JSON of `S`. If IndexedDB isn't available, it falls back to `localStorage` under `genesling-save`.
- `SAVE_VERSION` in `save.js` is the current format (11). Version 11 added the Apothecary station (placed on the map where it fits) and the Bloom's state (`S.bloom`: recent raid combinations, contracts and vein maps). Version 10 added the hideout layout, terraces, decor, friendships, titles, trophies (bosses already beaten became trophies in stores), the Hall of Legends, the sigil, and the demo and play-stats state.
- Earlier formats: Version 9 added the Exchange's state. Version 7 added genomes: v5 genes and traits became matching allele pairs. Version 8 added materials, weapons as items (every owned weapon became a Fine item), pens, expeditions and fatigue. `MIGRATIONS[n]` upgrades a version-n save to n+1, and loading runs them in order.
- **Never reset saves.** Any change to the save format bumps `SAVE_VERSION` and adds a migration, plus a test that an old save loads.
- A save that can't be read or migrated (corrupt, or from a newer build) is copied to a `backup-<time>` key before a new game starts.
- On first load, the v5 save (`localStorage` key `genesling-save-v5`) is migrated into IndexedDB. The v5 copy stays where it is as a backup.
- `save()` is synchronous to call: it snapshots `S` and writes in the background. `await saveDone()` waits until everything is written.

## Tests

- Tests drive the game through its globals (`startRaid`, `hurtEnemy`, `useCage`, `act(...)`, `S`, `R`) and fail on any page error.
- `tests/helpers.js` serves the repo over HTTP and gives each `openGame()` a fresh browser context with empty storage. Await `window.gameReady` before touching the game (the helper does).
- `parity.test.js` checks every content table and creature stats against the archived v5 build, allowing only the listed Phase 1 changes; `saves.test.js` loads the v5 fixture through every migration; `seed.test.js` checks seeded floors; `genetics.test.js` checks expression, inheritance odds, mutation, inbreeding, breeding rules and the simulator's Apex pace; `jobs.test.js` checks stations, fatigue, foremen, chemistry, upkeep, the roster cap, crafting and quality, durability, the bag, raid roles, tonics, expeditions, the death legacy and the supply sandbox; `touch.test.js` checks the joysticks never move the page; `exchange.test.js` checks buying and selling, limit orders, auctions, bounties, refunds, worker/in-thread parity, catching up missed days, Keeper XP from other work, and the 90-day Economy Sandbox targets; `pride.test.js` checks the layout and build mode, terraces, Comfort, creature life and friends, titles, trophies, the Hall of Legends, the sigil, image export and the v9 save; `bloom.test.js` checks Phase 5's content counts, the variety exit test and that every floor builds, seeded replays per vein, vein keys and maps, every twist, layout and event, contracts, Venom and the Apothecary and the v10 save; `landscape.test.js` checks the sideways phone layout, the raid menu and releasing creatures; `demo.test.js` checks the demo's limits, its separate save and carry-over, the end screen, opt-in stats and feedback.

## What v5 has

- Raids on floors 1 to 6 with 24 enemy types, 8 bosses, wardens, secret rooms, shrines, curses and 6 room modifiers.
- 21 species and 7 hybrids across 7 types, each with its own body, up to 3 evolutions that change attack pattern and ability, elemental reactions, two-creature combos, bond stars and 8 personalities.
- Capture by cage radius, slot-3 swaps, extraction (rift, gate, cliff), loss on death.
- Hideout map with sections and effectiveness meters, research tree, armory with crafting and scrapping, market, codex with milestones, Keeper rank and journal, NPC quests (Brannoc, Pip, Sorrel), sound and music, a 3-room tutorial.

## Things to know

- **Test Lab** (the Lab tab) has loadouts and shortcuts for testing: evolve-ready creatures, max bond, arena with combos, curses and room twists, replay the tutorial, reveal the codex, add shards.
- **Phone layout**: the target for now is an Android phone held sideways (about 780 × 360). Media queries in `shell.html` compact the pinned hideout bar and the raid HUD at `(orientation:landscape) and (max-height:500px)`. The raid's touch buttons are placed around the aim stick from CSS variables (`--sm`, `--sb`, `--sr`) that `applyOpts()` sets from `stickInset()`, the same numbers `stickBases()` uses, so they move with the stick size and mirror in left-handed mode. `goLandscape()` asks for full screen and a landscape lock when a raid starts on a touch device.
- **Scrolling in raids**: a raid blocks page drags so joysticks can't move the page, except inside `#pauseBox`, `#modalBox` and `#arenaPanel` (the ⚙ menu, peddler, shrines, the vein choice and pop-ups), which scroll with a finger.
- **The raid menu** (`setPause` in `draw.js`) has Backpack, Creatures, Weapons and Settings tabs. `releaseCreature(slot)` in `raid.js` turns a companion or slot-3 creature into a wild enemy (`wildEnemy`) in the current room.
- The page checks for `window.claude` hooks so it also runs inside a Claude artifact; outside one they're ignored.
