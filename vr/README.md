# GeneSlingVR — MVP

**Walk into the Bloom. Catch it, tame it, breed it, and take the valley back.**

GeneSlingVR is GeneSling's creature genetics and extraction stakes in a living valley you stand inside. This is the MVP: one valley, three creature types, and the whole loop from expedition to claimed land, playable in a Meta Quest browser (WebXR) or on a flat screen with mouse and keyboard.

## Play

- **Quest 3 / 3S:** open the hosted page in the Quest browser and press **Enter VR**.
- **Flat screen:** open `dist/index.html` (or the hosted page) and press **Play on this screen**.

## The MVP loop (the ten goals on screen)

1. Hit something with the sling
2. Weaken a wild creature and cage it
3. Tame a calm creature with food
4. Bring a catch home (hold the gate circle 8 s)
5. Post a creature to a station, then sleep
6. Breed a pair in the pen
7. Hatch an egg
8. Craft a Ward Stone at the Workbench
9. Claim Thornmeadow at its Heartroot (survive the Surge)
10. Beat Rootmaw in the Blightfen Delve

## Controls

| Action | Quest controllers | Mouse and keyboard |
| --- | --- | --- |
| Move / turn | Left stick / right stick (snap or smooth) | WASD, mouse, Shift to run |
| Sling | Left hand holds it; pinch the pouch with the right trigger, pull back, release | Hold and release left mouse |
| Throw a cage | Hold right grip, throw, let go | Hold and release right mouse |
| Offer food (tame) | Hold left trigger with your hand out; keep still, crouch to calm it faster | Hold F (C to crouch) |
| Use / gather | Point the right hand, press A | E |
| Send / recall companions | A at a target / B | Q / X |
| Companion skills (both within 2 s = combo) | X / Y | 1 / 2 |
| Wrist panel (status, pack, party, goals, settings) | Press the left stick | Tab |

Comfort settings (wrist panel): snap or smooth turning, teleport movement, vignette, seated mode, left-handed mode, aim assist.

## What's in it

- **World:** the Homestead, Thornmeadow (wild) and Blightfen (Bloomland), a 24-minute day–night cycle, a thorn wall on your border with one gate, a Waystone deep in Blightfen, and a three-room Delve with the boss Rootmaw.
- **Creatures:** six species (Cindlet, Pyrrox, Puffcap, Shroomite, Dewdrip, Coralisk) across Ember, Fungal and Tide. Every body is built from its genome: hue, pattern, size and shine (Prismatic shifts colour, Bloomscar glows). Wilds graze, wander, sleep at night, flee or fight by personality, and predators stalk prey.
- **Populations:** each zone tracks how many of each species live there; catching thins them and they recover each day.
- **Stakes:** fall and you lose your pack and catches; your companions are taken by the Bloom and roam that zone for 3 days. Cage them there to bring them home, or they're lost to the Memorial.
- **Genetics:** GeneSling's own code — 15 loci, inheritance, mutation, inbreeding, lineage — with a pen preview of each egg's grade ranges.
- **Homestead:** Forge, Garden and Spring with GeneSling's work formula, fatigue and food upkeep; a Workbench, Nursery, contract board and your bed. Creatures that aren't with you live there and can be petted for bond.
- **Claims:** plant a Ward Stone at a Heartroot and hold it through a Surge. Claimed land moves your border, calms its wilds, adds a Quarry outpost, and needs guards or the Bloom takes it back.

## Develop

This folder lives inside the GeneSling repo as `vr/` and builds on its own:

```bash
cd vr
npm install          # once (set PUPPETEER_SKIP_DOWNLOAD=1 if Chrome is already installed)
npm run build        # bundle src/ into dist/index.html (and dist-dev/ for tests)
node build.mjs --watch
npm test             # build, then play the whole loop headless and fail on any page error
```

Tests need Chrome; set `CHROME=/path/to/chrome` if it isn't at the default path. `node tests/gallery.mjs` renders a creature lineup and `node tests/perf.mjs` counts draw calls (Quest budget: about 150).

## Code

| File | What it holds |
| --- | --- |
| `src/sim-core/` | GeneSling's genetics, content tables and RNG, copied unchanged (commit in `SOURCE_COMMIT`) |
| `src/data.js` | Every tunable number: zones, sling, cages, taming, stations, recipes, objectives |
| `src/state.js` | The save, creatures, items, Keeper rank, breeding and hatching |
| `src/world.js` | Terrain, zones, the homestead's buildings, Heartroots, Waystone, Delve, day–night |
| `src/creatures.js` | Genome-built bodies, wild behaviour and populations |
| `src/combat.js` | Shots, sling, cages, taming, companions, skills and combos, Bloomlings, Rootmaw |
| `src/home.js` | Expeditions, extraction, death and recovery, the day, stations, crafting, claims, the Delve |
| `src/ui.js`, `src/panel.js` | In-world panels (mouse or controller ray), the HUD and the wrist display |
| `src/input.js` | Flat-screen and WebXR input, the sling hand rig, comfort options |
| `src/main.js` | Boot, renderer, XR session and the frame loop |

## Deploying

The repo's Pages workflow builds `vr/` and publishes it at https://zephyrmaelstrom.github.io/GeneSling/vr/ on every push to `main`. WebXR needs HTTPS, which GitHub Pages provides.
