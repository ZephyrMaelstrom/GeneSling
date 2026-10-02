# How the code is built

GeneSling is plain JavaScript in ES modules, bundled by esbuild into one self-contained page, `dist/index.html`. The game is still the v5 prototype in content and feel; Phase 0 rebuilt the project around it.

Live builds: GitHub Pages deploys `main` on every push (see below). The older v5 test build is a Claude artifact: https://claude.ai/artifact/AX7hVsu2K8rtW8MLRW6CHs

## Build and test

```bash
npm install        # once
npm run build      # src/ -> dist/index.html
npm run dev        # rebuild on every change in src/
npm run lint       # ESLint: undeclared names and stale imports
npm test           # build, then run every tests/*.test.js in headless Chrome
```

- Open `dist/index.html` in a browser to play, straight from disk or from any static server.
- Set `CHROME_PATH` to use a Chromium you already have instead of the one puppeteer downloads.
- `dist/` is not committed. GitHub Actions builds it.

## Continuous integration and hosting

- `.github/workflows/ci.yml` runs lint, build and the full test suite on every push and pull request.
- `.github/workflows/pages.yml` builds and deploys `dist/` to GitHub Pages on every push to `main`. One-time setup: in the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.

## Files

| File | What it holds |
| --- | --- |
| `src/shell.html` | The page: all CSS, HTML layout, HUD, touch controls, modals. The build appends the bundled script to it. |
| `src/main.js` | Entry point. Imports every module, exposes their top-level names on `window` (for tests and the console), and boots. `window.gameReady` resolves once the save is loaded. |
| `src/data/*.json` | All content tables: `species` (types, species, hybrids, evolution lines, names), `attacks` (attacks, abilities, elements, reactions, combos), `creatures` (personalities, bond, genes, traits), `items` (guns, weapon costs, run buffs), `dungeon` (curses, room modifiers, modes), `enemies`, `bosses`, `hideout` (sections, armory, Keeper perks, research), `story` (intro, journal, NPCs and their quests). |
| `src/content.js` | Loads the JSON tables and derives id lists and lookups (`SPECIES_IDS`, `LINES`, `comboFor`, `foePool`, ...). |
| `src/rng.js` | The seeded random number generator. |
| `src/util.js` | Small helpers: `$`, `rnd`, `ri`, `pick`, `clamp`, `shuffle`, and their visual-only `fx` versions. |
| `src/save.js` | Versioned IndexedDB saves and migrations. |
| `src/state.js` | Save state `S`, creature creation and `stats()`, evolution, research, codex (dex), rewards, NPC quests, hideout sections, Keeper rank, day processing, hatching, breeding, deaths and the memorial. |
| `src/sprites.js` | Procedural canvas sprites: a body drawer per species and hybrid, evolution dressing, eggs, NPCs, and the DOM sprite painter. |
| `src/audio.js` | WebAudio sound effects and generative music. |
| `src/map.js` | The illustrated hideout map canvas. |
| `src/ui.js` | Tabs and screens: raid prep, hideout, roster, breeding, research, armory and market, codex, Test Lab, settings, the intro story. |
| `src/raid.js` | Dungeon generation, the tutorial map, raid start and end, combat, companions, abilities, combos, reactions, curses, room modifiers, bosses, extraction. |
| `src/draw.js` | Raid rendering, minimap, HUD, the game loop, pause menu, input handling and boot. |
| `tests/` | The headless test suite (Node's built-in test runner with puppeteer). `tests/fixtures/v5-save.json` is a save written by the real v5 build. |
| `scripts/make-v5-fixture.js` | Regenerates that fixture from the archived v5 build. |
| `prototype/archive/` | Earlier single-file builds v1 to v5, for reference. `genesling-v5.html` is the last pre-Phase-0 build, and the parity test compares against it. |

Modules import what they use from each other. Modules that need each other at runtime import each other in a cycle, which is fine because they only use each other inside functions, never while loading.

## Content

Tunable numbers and content live in `src/data/*.json`, not in code. Adding a species, gun, enemy or boss is a data change, plus a sprite drawer in `sprites.js` or `draw.js` when it has a new body. NPC arrival rules are data too: `arrive: {always: true}`, `{keeper: 2}`, or `{keeper: 4, section: "nursery", tier: 1}` (any one condition is enough).

## Randomness

- All gameplay randomness goes through `rand()` in `rng.js` (and the helpers `rnd`, `ri`, `pick`, `wpick`, `shuffle` built on it). Never call `Math.random()` in gameplay code.
- Purely visual randomness (screen shake, sparks, hideout wanderers, map flowers, music) uses `fxRand()` and `fxRnd`/`fxRi`/`fxPick`, so effects never shift the gameplay stream.
- `startRaid(mode, floor, seed)` takes an optional seed (a 32-bit integer; one is rolled when omitted) and stores it as `R.seed`. Each floor's map, room plans, modifiers and boss come from their own stream, seeded from the raid seed and the floor number, so the same seed always builds the same floors.
- Combat rolls use the raid's stream after that. They depend on frame timing, so exact replays of whole fights will also need a fixed time step and recorded inputs (planned with the Deepening).

## Saves

- The save lives in IndexedDB (database `genesling`, store `saves`, key `main`) as `{v, saved, data}`, with `data` the JSON of `S`. If IndexedDB isn't available, it falls back to `localStorage` under `genesling-save`.
- `SAVE_VERSION` in `save.js` is the current format (6). `MIGRATIONS[n]` upgrades a version-n save to n+1, and loading runs them in order.
- **Never reset saves.** Any change to the save format bumps `SAVE_VERSION` and adds a migration, plus a test that an old save loads.
- A save that can't be read or migrated (corrupt, or from a newer build) is copied to a `backup-<time>` key before a new game starts.
- On first load, the v5 save (`localStorage` key `genesling-save-v5`) is migrated into IndexedDB. The v5 copy stays where it is as a backup.
- `save()` is synchronous to call: it snapshots `S` and writes in the background. `await saveDone()` waits until everything is written.

## Tests

- Tests drive the game through its globals (`startRaid`, `hurtEnemy`, `useCage`, `act(...)`, `S`, `R`) and fail on any page error.
- `tests/helpers.js` serves the repo over HTTP and gives each `openGame()` a fresh browser context with empty storage. Await `window.gameReady` before touching the game (the helper does).
- `parity.test.js` checks every content table and creature stats against the archived v5 build; `saves.test.js` loads the v5 fixture; `seed.test.js` checks seeded floors.

## What v5 has

- Raids on floors 1 to 6 with 24 enemy types, 8 bosses, wardens, secret rooms, shrines, curses and 6 room modifiers.
- 21 species and 7 hybrids across 7 types, each with its own body, up to 3 evolutions that change attack pattern and ability, elemental reactions, two-creature combos, bond stars and 8 personalities.
- Capture by cage radius, slot-3 swaps, extraction (rift, gate, cliff), loss on death.
- Hideout map with sections and effectiveness meters, research tree, armory with crafting and scrapping, market, codex with milestones, Keeper rank and journal, NPC quests (Brannoc, Pip, Sorrel), sound and music, a 3-room tutorial.

## Things to know

- **Test Lab** (the Lab tab) has loadouts and shortcuts for testing: evolve-ready creatures, max bond, arena with combos, curses and room twists, replay the tutorial, reveal the codex, add shards.
- **Phone layout** is handled by media queries in `shell.html`, including offsets for the boss bar and party list at widths under 700 px.
- The page checks for `window.claude` hooks so it also runs inside a Claude artifact; outside one they're ignored.
