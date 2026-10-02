# GeneSling

A browser creature-capture extraction roguelite: "Enter the Gungeon meets Palworld with Tarkov stakes." Fight through bullet-pattern dungeon rooms, weaken and cage wild creatures, and extract before you die. Anything not extracted is lost. Creatures are bred, posted to a hideout and evolved between raids. Owner and designer: Conner. Single player for now, planned as a paid web game with expansions.

## Where things are

- `docs/DESIGN.md`: the full 1.0 design (pillars, 90-day structure, genetics, jobs, production, economy, dungeons, lore, endgame, scope). Read the relevant section before building a system.
- `docs/ROADMAP.md`: the ten phases with checklists. **Tick boxes here as work lands.**
- `docs/DEVELOPMENT_PHASES.md`: the reasoning, build list and exit test for each phase, plus risks.
- `docs/PROTOTYPE.md`: how the current v5 prototype is built, file by file.
- `prototype/`: the playable v5 game. `src/` is the source; `index.html` is generated.

## Current status

- v5 prototype is complete and playable (floors 1 to 6, 8 bosses, evolutions, combos, hideout map, research, codex, tutorial, sound).
- **Next: Phase 0 (Foundation)** in `docs/ROADMAP.md`. Update this line when a phase's exit test passes.

## Commands

```bash
python3 prototype/build.py   # rebuild prototype/index.html from prototype/src
npm install                  # once
npm test                     # build, then run the headless tests; fails on any page error
```

Always rebuild and run the tests after changing anything in `prototype/src`. Never hand-edit `prototype/index.html`; it's generated (and committed so it can be served as a page).

## Design rules that don't change

- Creatures die permanently if they aren't extracted. Caught creatures start at full health.
- Up to two combat companions plus slot 3, which holds a catch or a support creature and can swap into combat.
- In breeding, the mother sets species and type; the father weighs stats more heavily. Rare cross-type pairings make dual-type hybrids.
- Creature types give both combat effects and hideout perks; rarer types come rarely from raids.
- Art: simple 2D, colorful retro fantasy. Sprites are drawn procedurally on canvas, no image assets so far.
- Touch-first: fixed on-screen joysticks, playable on a phone. Check phone layouts at about 390 px wide.
- No premium currency, loot boxes or paid timers, ever.
- Hosting: GitHub Pages plus Firebase (same setup as Conner's APlay app).
- Every feature must serve one of the six pillars in `docs/DESIGN.md`.

## How to work here

- Each roadmap phase ends in a playable build Conner can test on his phone, and is done only when its exit test passes.
- Keep `docs/` current. If a design decision changes, update `docs/DESIGN.md` in the same change.
- From Phase 0 on, never reset saves. Any save-format change needs a migration.
- Put tunable numbers (rates, curves, prices) in data, not logic, so balance passes don't need code changes.
- Tests drive the game through its global functions (`startRaid`, `hurtEnemy`, `useCage`, `act(...)`). For UI in headless tests, click with `el.click()` via `$eval`, not mouse coordinates.

## Known pitfalls in the prototype

- Elements using the `hidden` attribute need `display:none !important` in CSS or they still show.
- The HUD combo row uses the class `pcombo`; `.combo` is taken by creature cards.
- `endRaid` has a re-entrancy guard; keep it when touching raid endings.
- Every doorway is two door tiles, one owned by each room. Locking a room locks its side. The tutorial locks only its first and exit rooms.
- Companions are set to spare weakened wild creatures so they can be caged.
