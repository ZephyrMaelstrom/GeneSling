# GeneSlingVR

This is the `vr/` folder of the GeneSling repo; run every command from inside `vr/`. It has its own package.json and build, separate from the 2D game.

A WebXR (Meta Quest browser) take on GeneSling: GeneSling's genetics and extraction stakes in a living valley the player tames. Owner and designer: Conner. Design doc and roadmap: https://claude.ai/code/artifact/b1c3e98d-aa58-44fc-ad13-cbe1d8cc7ffb

## Rules that don't change

- Creatures die permanently if not recovered: a fallen companion roams its zone as Bloom-taken for `RECOVER_DAYS`, then goes to the Memorial.
- Two combat companions plus slot 3. Mother sets species and type; father weighs stats.
- No premium currency, loot boxes or paid timers.
- Genetics comes from `src/sim-core/` (GeneSling's code, unchanged). Don't fork its logic here; change it in GeneSling and copy it across, updating `SOURCE_COMMIT`.
- Tunable numbers go in `src/data.js`, not in logic.
- Gameplay randomness uses `rand()` from the sim core; visual-only randomness may use `Math.random()`.
- Any save-format change bumps `SAVE_VERSION` and adds a migration in `load()`; never reset a readable save.
- Quest budget: 72 fps, about 150 draw calls. Merge static multi-part props (`mergedMesh` in `gfx.js`); check with `node tests/perf.mjs`.

## Commands

```bash
npm run build   # dist/index.html (release) and dist-dev/index.html (exposes window.vr for tests)
npm test        # build, then the headless loop test; fails on any page error
```

## Status

MVP built (phases 0–7 of the design doc at prototype fidelity). All ten MVP goals pass in the headless loop test. Not yet tested on a real headset: the sling feel, comfort, and 72 fps on Quest are the first things to check. Next after the MVP: the Exchange at a Trading Post, more zones, hybrids.
