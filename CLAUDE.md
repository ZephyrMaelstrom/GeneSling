# GeneSling

A browser creature-capture extraction roguelite: "Enter the Gungeon meets Palworld with Tarkov stakes." Fight through bullet-pattern dungeon rooms, weaken and cage wild creatures, and extract before you die. Anything not extracted is lost. Creatures are bred, posted to a hideout and evolved between raids. Owner and designer: Conner. Single player for now, planned as a paid web game with expansions.

## Where things are

- `docs/DESIGN.md`: the full 1.0 design (pillars, 90-day structure, genetics, jobs, production, economy, dungeons, lore, endgame, scope). Read the relevant section before building a system.
- `docs/ROADMAP.md`: the ten phases with checklists. **Tick boxes here as work lands.**
- `docs/DEVELOPMENT_PHASES.md`: the reasoning, build list and exit test for each phase, plus risks.
- `docs/CODE.md`: how the code is built, file by file, plus the rules for randomness, saves and tests.
- `src/`: the game as ES modules; content tables are in `src/data/*.json`, genetics numbers in `src/data/genetics.json`, jobs and production numbers in `src/data/jobs.json`, market numbers in `src/data/exchange.json`, hideout-builder and demo numbers in `src/data/pride.json`, veins, layouts, events, contracts and maps in `src/data/bloom.json`, all the lore (acts, journal pages, relics, rune walls, whispers, murals, codex entries, residents' arcs) in `src/data/lore.json`, endgame numbers (endings, Unbound rules, Bloomlords, gene tools, relics, Renown, shows, the Deepening, seasons) in `src/data/endgame.json`, balance numbers (act gates, catch-up, the Keeper rank curve, boss XP, accessibility, the Journey Simulator) in `src/data/balance.json`. The market engine is in `src/exchange/`. `npm run build` bundles it into `dist/index.html` and the demo into `dist/demo/index.html` (the release build), and the same two into `dist-dev/` with the game exposed on `window` for tests and the console (generated, not committed). Data schemas are in `src/data/schema/`.
- `docs/PLAYTEST.md`: the closed playtest plan.
- `docs/IMPROVEMENTS.md`: the plan between Phase 8 and Phase 9 (creature pages, creature perks and flaws, groundwork for online play), with its progress.
- `tests/`: the headless test suite. `prototype/archive/`: the old single-file builds, v1 to v5.

## Current status

- v5 prototype is complete and playable (floors 1 to 6, 8 bosses, evolutions, combos, hideout map, research, codex, tutorial, sound).
- **Phase 0 (Foundation)**: code done; its exit test still needs Conner's hand test on his phone.
- **Phase 1 (Genetics 2.0)**: built; simulator median 13 generations to Apex. Waiting on Conner's hand test.
- **Phase 2 (Jobs and production)**: built; the supply sandbox passes. Waiting on playtests for the hard-choices half of the exit test.
- **Phase 3 (The Exchange)**: built, and its exit test passes (90-day Economy Sandbox meets all three targets).
- **Phase 4 (Hideout builder and demo)**: built; the demo deploys to `/GeneSling/demo/`. Feedback and play stats need Conner's Firebase project in `src/data/firebase.json`. The exit test (testers share cards unprompted, half of demo players return) needs real players.
- **Phase 5 (The Bloom expands)**: built; the variety half of the exit test passes (20 raids, no repeated combination). The other half (each vein's key type used in a tester's regular loadout) needs testers.
- **Phase 6 (Underheart and endgame)**: built, and its exit test passes from a Test Lab endgame save (the Heart, all three endings, Unbound tiers 1 to 5; the Apex Chamber keeps the simulator median at 13 generations). Leaderboards and the Fresh Season ladder wait for online play.
- **Phase 7 (Lore)**: built, and its exit test passes as automated checks (the fragments arrive act by act in story order; a solver given only the rune walls breaks the cipher). A human read-through of the fragments is still worth doing. The whole UI is landscape-first: raid menus fit the screen with nothing scrolling, and the hideout has a left tab rail.
- **Phase 8 (Balance and playtest)**: built. The simulated half of the exit test passes: in the Journey Simulator, dedicated bots reach Act IV on day 58 (median) and Unbound tier 16 to 20 by day 90, and the casual bot reaches the Heart around day 150. The act gates, catch-up, rank curve and Unbound rank gate are live in the game. The 20-person closed playtest (`docs/PLAYTEST.md`) needs Conner's Firebase project and testers. Update these lines when a phase's exit test passes.
- **Before Phase 9: the improvement plan** (`docs/IMPROVEMENTS.md`): creature pages, per-creature perks and flaws, and code groundwork for online play, in five steps. **Step 1 (Groundwork) is done**: the event bus, the action registry, device options out of the save (v15), a release build with nothing on `window`, and data schemas. Next: step 2, creature pages.

## Commands

```bash
npm install       # once
npm run build     # bundle src/ into dist/index.html
npm run dev       # rebuild on every change
npm run lint      # ESLint (undeclared names, stale imports)
npm test          # build, then run the headless test suite; fails on any page error
```

Run lint and the tests after changing anything in `src/`. CI runs both on every push, and GitHub Pages deploys `main`.

## Design rules that don't change

- Creatures die permanently if they aren't extracted. Caught creatures start at full health.
- Up to two combat companions plus slot 3, which holds a catch or a support creature and can swap into combat.
- In breeding, the mother sets species and type; the father weighs stats more heavily. Rare cross-type pairings make dual-type hybrids.
- Creature types give both combat effects and hideout perks; rarer types come rarely from raids.
- Art: simple 2D, colorful retro fantasy. Sprites are drawn procedurally on canvas, no image assets so far.
- Touch-first: fixed on-screen joysticks, playable on a phone. The whole game targets an Android S23 held sideways (about 780 × 360): move stick bottom left, attack stick bottom right, skills 1 and 2 above it, combo above those, a large Catch button left of it, minimap and the ⚙ menu (backpack, creatures, weapons, settings) top right. Raid menus must show everything at once with no scrolling (lay them out in columns; `fitOverlay()` is only a safety net); hideout pages may scroll, beside the left tab rail. Check layouts at 780 × 360.
- No premium currency, loot boxes or paid timers, ever.
- Hosting: GitHub Pages plus Firebase (same setup as Conner's APlay app).
- Every feature must serve one of the six pillars in `docs/DESIGN.md`.

## How to work here

- Each roadmap phase ends in a playable build Conner can test on his phone, and is done only when its exit test passes.
- Keep `docs/` current. If a design decision changes, update `docs/DESIGN.md` in the same change.
- From Phase 0 on, never reset saves. Any save-format change bumps `SAVE_VERSION` in `src/save.js`, adds a migration, and adds a test that the old save loads.
- Gameplay randomness goes through `rand()` (or `rnd`/`ri`/`pick`); never `Math.random()`. Visual-only randomness uses the `fx` versions so it can't shift a seeded raid.
- Put tunable numbers (rates, curves, prices) in data, not logic, so balance passes don't need code changes.
- Tests open the dev build (`dist-dev/`) and drive the game through its global functions (`startRaid`, `hurtEnemy`, `useCage`, `act(...)`), which `src/main.js` exposes on `window` (and `window.gs`) only in that build. Await `window.gameReady` first.
- New buttons register their action with `onAct('name', d => ...)` (`src/actions.js`) in the module that draws them; systems that react to a raid ending or a day passing subscribe with `on('raid:end', ...)` (`src/events.js`) instead of being called from `endRaid`. Device settings go in `OPTS` (`src/device.js`), never in `S`.
- After changing a data file's shape on purpose, run `node scripts/make-schemas.js --force` and check the schema diff. For UI in headless tests, click with `el.click()` via `$eval`, not mouse coordinates.

## Known pitfalls in the prototype

- Elements using the `hidden` attribute need `display:none !important` in CSS or they still show.
- The HUD combo row uses the class `pcombo`; `.combo` is taken by creature cards.
- `endRaid` has a re-entrancy guard; keep it when touching raid endings.
- A value one module reassigns (`S`, `R`) can't be assigned from another module; add a setter next to it (as with `setS`).
- Every doorway is two door tiles, one owned by each room. Locking a room locks its side. The tutorial locks only its first and exit rooms.
- Companions are set to spare weakened wild creatures so they can be caged.
