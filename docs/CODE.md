# How the code is built

GeneSling is plain JavaScript in ES modules, bundled by esbuild into one self-contained page, `dist/index.html`. The game is still the v5 prototype in content and feel; Phase 0 rebuilt the project around it.

Live builds: GitHub Pages deploys `main` on every push (see below). The older v5 test build is a Claude artifact: https://claude.ai/artifact/AX7hVsu2K8rtW8MLRW6CHs

## Build and test

```bash
npm install        # once
npm run build      # src/ -> dist/index.html and dist/demo/index.html (release), and the same two in dist-dev/ (dev)
npm run dev        # rebuild dist/index.html and dist-dev/index.html on every change in src/
npm run lint       # ESLint: undeclared names and stale imports
npm test           # build, then run every tests/*.test.js (the browser ones in headless Chrome)
```

- Open `dist/index.html` in a browser to play, straight from disk or from any static server.
- Set `CHROME_PATH` to use a Chromium you already have instead of the one puppeteer downloads.
- `dist/` is the release build GitHub Pages serves: it exposes nothing on `window` but `gameReady`. `dist-dev/` is the dev build (`__DEV__` true) for the tests and the browser console: every module's exports are on `window.gs`, and each name is also on `window` itself. Use `dist-dev/index.html` when you want the console.
- Neither `dist/` nor `dist-dev/` is committed. GitHub Actions builds them.

## Continuous integration and hosting

- `.github/workflows/ci.yml` runs lint, build and the full test suite on every push and pull request.
- `.github/workflows/pages.yml` builds and deploys `dist/` to GitHub Pages on every push to `main`: the full game at `/GeneSling/` and the demo at `/GeneSling/demo/`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Files

| File | What it holds |
| --- | --- |
| `src/shell.html` | The page: all CSS, HTML layout, HUD, touch controls, modals. The build appends the bundled script to it. |
| `src/main.js` | Entry point. Imports every module and boots. In the dev build it also exposes every module's exports as `window.gs` and on `window` (for tests and the console). `window.gameReady` resolves once the save is loaded. |
| `src/events.js` | The event bus: `on(evt, fn, {order})`, `emit(evt, payload)`. A system reacts to another without being called by name (see "Events and actions" below). |
| `src/actions.js` | The action registry: `onAct`, `onChange`, `onInput`, and `act(name, dataset)` to run one. Each UI module registers the actions its screen shows. |
| `src/device.js` | Device options (`OPTS`: joysticks, sound, palette, render scale...), kept in this device's local storage, not the save. Change a field, then `saveOpts()`. |
| `src/data/schema/*.schema.json` | A JSON Schema for each data file, checked by `tests/data.test.js`. Started by `scripts/make-schemas.js`. |
| `src/data/*.json` | All content tables: `species` (types, species, hybrids, evolution lines, names), `attacks` (attacks, abilities, elements, reactions, combos), `creatures` (personalities, bond, genes, traits), `items` (guns, weapon costs, run buffs), `dungeon` (curses, room modifiers, modes), `enemies`, `bosses`, `hideout` (sections, armory, Keeper perks, research), `story` (intro, journal, NPCs and their quests). |
| `src/data/genetics.json` | Every genetics number: loci, expression weights, inheritance and mutation odds, wild gene ranges by floor, stat effects of Grit, Focus and size, look names, tool unlocks, and the simulator's defaults. |
| `src/data/jobs.json` | Every Phase 2 number: materials, station recipes, work rates, fatigue, chemistry and clashes, quality tiers, mastery, recipes, durability, prints, the bag, tonics, raid roles per species, the roster cap, expeditions, the death legacy and the supply sandbox. |
| `src/data/pride.json` | Every Phase 4 number: the grid, footprints, hillside terraces, decor recipes and Comfort, creature life, Hall of Legends perks, titles, sigil parts, the demo's limits and goals, the default layout. |
| `src/data/firebase.json` | The Firebase project for feedback and opt-in play stats (`apiKey`, `projectId`). Empty in the repo, so nothing is sent. |
| `src/data/bloom.json` | Every Phase 5 number: the six veins (palettes, key types, twists, wild types, borrowed foes), twist numbers, the eight layouts and their weights per vein, layout rules, events, variety memory, contracts and vein maps. |
| `src/data/balance.json` | Phase 8's numbers: accessibility (palettes, aim assist, slower bullets, render quality), the playtest targets, the act gates, catch-up, wild creature levels by floor, boss XP, the Keeper rank curve, the Unbound tier rank gate, and the Journey Simulator's styles, power model and targets. |
| `src/data/lore.json` | Phase 7's words and numbers: the four acts and their gates, journal pages (where each is found), the 40 relics and the letters each teaches, the 16 rune walls, whispers and their odds, murals, a codex entry for every form, post-v5 boss memories, the residents' arcs and the three new residents, and the Archive's lore numbers. `content.js` merges the residents into `NPCS`, the arcs onto their quests, the relics into `ENDGAME.RELICS` and the memories into `BOSSES`. |
| `src/data/endgame.json` | Every Phase 6 number: the Underheart, endings, Unbound tiers and rules, Bloomlords, the Splicer, Mutation Lab and Apex Chamber, the Archive, the rune alphabet, Renown weights, shows, the Deepening and seasons. |
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
| `src/endgame.js` | Phase 6's rules: the story state, the Underheart's cut-free rule, endings, Unbound tiers, rules and modifiers, Bloomlords, gene tools, the Archive, Renown, shows, the Deepening, seasons, the Test Lab endgame save and the v12 save fields. |
| `src/balance.js` | The act gates (`gateNeeds`, `gateOpen`, `gateBlockText`, `nextGate`), catch-up (`calendarDay`, `expectedRank`, `catchupMul`) and the v14 save field. |
| `src/journey.js`, `src/journeyui.js` | The Journey Simulator: bot players on a throwaway save (`journeyOf`, `runJourneys`), the stats-based power model (`crPower`, `refPower`, `floorOdds`), the exit-test report (`journeyReport`), and its Test Lab panel. Runs inside `holdSaves()`, so it can never write the save. |
| `src/access.js` | Colorblind palettes (`applyPalette`, `bulletCol`), aim assist, slower enemy bullets and the raid canvas's render scale (`renderScale`, `frameTime`). |
| `src/playtest.js` | The playtest pace record (`paceTick`, `gateBlocked`, `paceReport`) and its events. |
| `src/lore.js`, `src/loreui.js` | Phase 7: the current act, the journal in story order, placing pages and rune walls in raid rooms (by index, never by random), picking pages up and keeping them on extract, the Keepers' Rest, whispers, murals, codex entries, story counts for quests, the v13 save field; and the Codex's journal, story-by-act and murals views and the Test Lab's lore tools. |
| `src/endgameui.js` | The Bloom below, Unbound and the Deepening on the Raid tab; gene tools and shows on the Breeding tab; the Archive on the Research tab; the Test Lab's endgame shortcuts. |
| `src/map.js` | The hideout map canvas, drawn from `S.layout`: buildings by tier, decor, trophies and statues, workers and off-duty creatures, day and night, and build mode's grid and taps. `renderMapTo(g, t)` draws into any canvas (the snapshot uses it). |
| `src/prideui.js` | Build mode's panel, the Hall of Legends, trophy and statue pop-ups, titles and "Bred by" on cards, decor recipes for the Workshop, and the sigil designer. |
| `src/share.js` | Creature cards and hideout snapshots as PNGs, shared through Web Share or downloaded. |
| `src/flags.js`, `src/demo.js` | The `DEMO` build flag; the demo's Act I goals and end screen, feedback, and opt-in play stats. |
| `src/ui.js` | Tabs and screens: raid prep, hideout, roster, breeding, research, armory and market, codex, Test Lab, settings, the intro story. |
| `src/raid.js` | Dungeon generation, the tutorial map, raid start and end, combat, companions, abilities, combos, reactions, curses, room modifiers, bosses, extraction. |
| `src/draw.js` | Raid rendering (including rune walls and journal pages), minimap, HUD, the game loop, the raid menus and `fitOverlay()` (raid menus never scroll: anything that still overflows is zoomed down to fit), input handling and boot. |
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

## The endgame

- Floors past 6: `veinOfFloor` maps 7 to 9 to the Underheart and 10 to the Heart; an Unbound raid is `startRaid('raid', 7, null, 'unbound', {tier})`, and `R.tier` turns its rules on (`ruleOn(R.tier, id)`). A Deepening is `startRaid('raid', 1, null, null, {deepening: week})`, seeded by `deepeningSeed(week)`.
- Boss defs carry `story` ('ilsa', 'heart') or `lord` ('deaf', 'reflect', 'brood', 'mirror'); `onStoryBoss` and `lordDamage` handle them.
- `endgameDay(notes)` runs inside `processDay`: the Archive's translation, show judging at a week's end and season changes.

## Balance and simulations

- `breed()` is a thin wrapper: the breeding itself is `layEgg(mom, dad)`, which never saves, redraws or plays a sound. Simulations call the core functions only.
- `holdSaves(fn)` in `save.js` runs `fn` with saving switched off. Any simulation that swaps in a throwaway `S` (the Journey Simulator) runs inside it, so it can't write its copy over the real save.
- The Journey Simulator is deterministic for a seed: everything, `newGame()` included, runs inside `withSeed`.

## Doors and secret rooms

- A door tile (3) is solid while its owning room is `locked`. A room locks when a fight starts and unlocks when no live enemy has `e.room === room`. `sealed` rooms (gauntlet, sinkhole) also have `tutLock`, so they stay shut.
- Seal a room only through `safeToSeal(rm)` in `veins.js`, which checks that every exit and unexplored room stays reachable from `R.cur` (`openFrom`).
- A secret room's tiles, hallway and secret-side door tiles are in `M.hidden` (and on its crack as `crack.area`); `paintTile` leaves them unpainted, and `damageCrack` repaints the area when the wall breaks.

## Lore

- `currentAct()` is 1 to 4 from `S.progress.deepest` and `S.story.ilsa`. Don't export anything named `act`: `actions.js`'s `act()` is on `window` in the dev build.
- `placeLore(M)` runs for every new floor of a story raid (not Unbound, not the Deepening) and sets `room.page` and `room.rune` on rooms chosen by index; `loreRoom(r)` (from `enterRoom`) copies a wall and rolls a whisper with `fxRand`; `lorePick()` (each frame) picks a page up into `R.lorePages`; `loreEnd(extracted)` keeps or loses them. `S.lore = {pages, walls, whispers}`.
- Raid menus go through `showOverlay(html)`, which wraps the html in `.ov`; use `.ovhead` for the title row and `.ovcols` (`c2`, `c3`, `c5`, `offers`) for columns of cards. Never make a raid menu scroll.

## Events and actions

- **Events.** `emit('raid:end', report)` runs while a raid is settled: the report has the outcome, floor, deepest floor, kills, bag, catches and `notes`, and subscribers push lines to `notes` for the results screen (journal pages in `lore.js`, the Deepening in `endgame.js`, contracts in `bloom.js`). `raid:done` follows once the raid is saved and closed (play stats and the demo's end screen in `demo.js`). `day:passed` follows a day in the real game, after a raid or Wait one day (the playtest pace in `playtest.js`, the market in `exchange/market.js`). `passDay()` in `state.js` is `processDay()` plus that event; simulations call `processDay()` alone, so they never move the market or send stats.
- Handlers run in ascending `order` (default 50), then in the order they subscribed. One that throws doesn't stop the others; its error is rethrown on the next tick, so it still fails the tests.
- **Actions.** A button's `data-act="evolve"` runs the handler registered with `onAct('evolve', d => ...)`, with the button's dataset as `d`. Selects, checkboxes and text fields use `onChange`, sliders `onInput`. Register the action in the module that draws the screen (the Exchange's in `exchangeui.js`, the Workshop's in `workui.js`, and so on); `ui.js` keeps the hideout, raid prep, roster, research, Codex, settings and Test Lab's own. A name registered twice throws. `groundwork.test.js` renders every tab and station and checks every `data-act` it finds has a handler.

## Randomness

- All gameplay randomness goes through `rand()` in `rng.js` (and the helpers `rnd`, `ri`, `pick`, `wpick`, `shuffle` built on it). Never call `Math.random()` in gameplay code.
- Purely visual randomness (screen shake, sparks, hideout wanderers, map flowers, music) uses `fxRand()` and `fxRnd`/`fxRi`/`fxPick`, so effects never shift the gameplay stream.
- `startRaid(mode, floor, seed)` takes an optional seed (a 32-bit integer; one is rolled when omitted) and stores it as `R.seed`. Each floor's map, room plans, modifiers and boss come from their own stream, seeded from the raid seed and the floor number, so the same seed always builds the same floors.
- Combat rolls use the raid's stream after that. They depend on frame timing, so exact replays of whole fights will also need a fixed time step and recorded inputs (planned with the Deepening).

## Saves

- The save lives in IndexedDB (database `genesling`, store `saves`, key `main`) as `{v, saved, data}`, with `data` the JSON of `S`. If IndexedDB isn't available, it falls back to `localStorage` under `genesling-save`.
- `SAVE_VERSION` in `save.js` is the current format (15). Version 15 moved the device options (`S.opts`) out of the save into this device's local storage (`genesling-opts`); a device with no options of its own takes over the old save's. Version 14 added `S.startedAt` (when the save began, for catch-up). Version 13 added the lore state (`S.lore`: journal pages carried home, rune walls copied, whispers heard). Version 12 added the story (Ilsa, the Heart, the ending), Unbound progress, the Archive, the Mutation Lab, shows and ribbons, the Deepening, seasons, Keeper titles and the Renown log. Version 11 added the Apothecary station (placed on the map where it fits) and the Bloom's state (`S.bloom`: recent raid combinations, contracts and vein maps). Version 10 added the hideout layout, terraces, decor, friendships, titles, trophies (bosses already beaten became trophies in stores), the Hall of Legends, the sigil, and the demo and play-stats state.
- Earlier formats: Version 9 added the Exchange's state. Version 7 added genomes: v5 genes and traits became matching allele pairs. Version 8 added materials, weapons as items (every owned weapon became a Fine item), pens, expeditions and fatigue. `MIGRATIONS[n]` upgrades a version-n save to n+1, and loading runs them in order.
- **Never reset saves.** Any change to the save format bumps `SAVE_VERSION` and adds a migration, plus a test that an old save loads.
- A save that can't be read or migrated (corrupt, or from a newer build) is copied to a `backup-<time>` key before a new game starts.
- On first load, the v5 save (`localStorage` key `genesling-save-v5`) is migrated into IndexedDB. The v5 copy stays where it is as a backup.
- `save()` is synchronous to call: it snapshots `S` and writes in the background. `await saveDone()` waits until everything is written.

## Tests

- Browser tests open the dev build (`dist-dev/`) and drive the game through its globals (`startRaid`, `hurtEnemy`, `useCage`, `act(...)`, `S`, `R`, all also on `window.gs`) and fail on any page error.
- `data.test.js` runs in Node without a browser: every data file matches its schema in `src/data/schema/`, and every id one table uses for another exists (species types, evolution attacks and abilities, codex entries, station and recipe materials, vein foes, residents' homes, and so on). When a data file's shape changes on purpose, run `node scripts/make-schemas.js --force` and read the schema diff.
- `tests/helpers.js` serves the repo over HTTP and gives each `openGame()` a fresh browser context with empty storage. Await `window.gameReady` before touching the game (the helper does).
- `parity.test.js` checks every content table and creature stats against the archived v5 build, allowing only the listed Phase 1 changes; `saves.test.js` loads the v5 fixture through every migration; `seed.test.js` checks seeded floors; `genetics.test.js` checks expression, inheritance odds, mutation, inbreeding, breeding rules and the simulator's Apex pace; `jobs.test.js` checks stations, fatigue, foremen, chemistry, upkeep, the roster cap, crafting and quality, durability, the bag, raid roles, tonics, expeditions, the death legacy and the supply sandbox; `touch.test.js` checks the joysticks never move the page; `exchange.test.js` checks buying and selling, limit orders, auctions, bounties, refunds, worker/in-thread parity, catching up missed days, Keeper XP from other work, and the 90-day Economy Sandbox targets; `pride.test.js` checks the layout and build mode, terraces, Comfort, creature life and friends, titles, trophies, the Hall of Legends, the sigil, image export and the v9 save; `endgame.test.js` checks the 1.0 content counts, the Underheart, Ilsa, the Heart and every ending, Unbound tiers 1 to 5 and their rules, Bloomlords, gene tools and the simulator, the Archive, shows, the Deepening, seasons and the v11 save; `bloom.test.js` checks Phase 5's content counts, the variety exit test and that every floor builds, seeded replays per vein, vein keys and maps, every twist, layout and event, contracts, Venom and the Apothecary and the v10 save; `landscape.test.js` checks the sideways phone layout, that every raid menu fits the screen with nothing scrolling, the hideout's tab rail, the raid menu and releasing creatures; `lore.test.js` checks the fragment counts, the story-in-order exit test, pages carried out of raids, rune walls, the Keepers' Rest and last page, whispers, murals and codex entries, the residents, Odile's translation, the secret hybrid and the v13 save; `doors.test.js` walks every zone and layout (dead ends first, sinkholes falling) checking that fights unlock and sealing never cuts off an exit or an unexplored room, that stray enemies are returned, and that secret rooms stay unpainted until their wall breaks; `journey.test.js` runs the Journey Simulator exit test and checks the gates, catch-up, the rank curve and boss XP, the Unbound tier rank gate, accessibility options, the render scale, the playtest pace and the v14 save; `groundwork.test.js` checks the release build exposes nothing, the event bus and the raid's events, that every action on every screen has a handler, and device options and the v14 save; `cipher.test.js` breaks the rune walls with a pattern-matching solver given only the runes and an English word list; `demo.test.js` checks the demo's limits, its separate save and carry-over, the end screen, opt-in stats and feedback.

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
