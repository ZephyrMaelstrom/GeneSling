# The v5 prototype

The playable prototype lives in `prototype/`. It is a single self-contained HTML file (`prototype/index.html`) assembled from plain JavaScript modules. Phase 0 of the roadmap replaces this with a proper modular build; until then, this is how it works.

Live test build (Claude artifact): https://claude.ai/artifact/AX7hVsu2K8rtW8MLRW6CHs

## Build and test

```bash
python3 prototype/build.py          # src/shell.html + src/*.js -> prototype/index.html
npm install                         # once, installs puppeteer for the tests
npm test                            # runs every prototype/tests/*.test.js headless
```

- Open `prototype/index.html` directly in a browser to play. No server needed.
- Tests drive the game through its global functions (`startRaid`, `hurtEnemy`, `useCage`, `act(...)`, and so on) rather than through clicks, and fail on any page error.
- Set `CHROME_PATH` to use a Chromium you already have instead of the one puppeteer downloads.

## Files

| File | What it holds |
| --- | --- |
| `src/shell.html` | The page: all CSS, HTML layout, HUD, touch controls, modals. Everything before the `<script>` tag. |
| `src/data.js` | All content tables: lore intro, `TYPES`, `SPECIES`, `HYBRIDS`, `ATTACKS`, `ABILITIES`, evolution `LINES`, elements and `REACTIONS`, `COMBOS`, personalities (`PERS`), bond thresholds, `GENES`/`TRAITS`, `GUNS` (16 guns + 8 melee), `BUFFS`, `CURSES`, `ROOM_MODS`, hideout `SECTIONS`, `RESEARCH`, `FOES`, `BOSSES`, the Keeper `JOURNAL`, `NPCS` and their quests. |
| `src/state.js` | Save state `S`, creature creation and `stats()`, evolution, research, codex (dex), rewards, NPC quests, hideout sections, Keeper rank, day processing, hatching, breeding, deaths and the memorial. |
| `src/sprites.js` | Procedural canvas sprites: a body drawer per species and hybrid, evolution stage dressing (final forms get an aura), eggs, NPCs, and the DOM sprite painter. |
| `src/audio.js` | WebAudio sound effects and generative music (hideout, depths, abyss, boss tracks). |
| `src/map.js` | The illustrated hideout map canvas: buildings that grow by tier, wandering creatures, NPCs, the dungeon gate. |
| `src/ui.js` | Tabs and screens: raid prep, hideout, roster, breeding, research, armory and market, codex, Test Lab, settings, the intro story. |
| `src/raid.js` | Dungeon generation, the tutorial map, raid start and end, combat, companions, abilities, combos, elemental reactions, curses, room modifiers, bosses, extraction. |
| `src/draw.js` | Raid rendering, minimap, HUD updates, pause menu, input handling and boot. |
| `archive/` | Earlier single-file builds v1 to v4, for reference only. |

Load order matters: the build concatenates `data, state, sprites, audio, map, ui, raid, draw` into one script.

## Things to know

- **Saves** are in `localStorage` under `genesling-save-v5`, with `S.v = 5`. A version mismatch resets the save. Phase 0 replaces this with versioned IndexedDB saves and migrations.
- **Test Lab** (the Lab tab) has loadouts and shortcuts for testing: evolve-ready creatures, max bond, arena with combos, curses and room twists, replay the tutorial, reveal the codex, add shards.
- **Phone layout** is handled by media queries in `shell.html`, including offsets for the boss bar and party list at widths under 700 px.
- **Randomness** uses `Math.random()` today. Phase 0 adds a seeded generator.
- The page also checks for `window.claude` hooks so it runs inside a Claude artifact; outside one they're ignored.

## What v5 already has

- Raids on floors 1 to 6 with 24 enemy types, 8 bosses, wardens, secret rooms, shrines, curses and 6 room modifiers.
- 21 species and 7 hybrids across 7 types, each with its own body, up to 3 evolutions that change attack pattern and ability, elemental reactions, two-creature combos, bond stars and 8 personalities.
- Capture by cage radius, slot-3 swaps, extraction (rift, gate, cliff), loss on death.
- Hideout map with sections and effectiveness meters, research tree, armory with crafting and scrapping, market, codex with milestones, Keeper rank and journal, NPC quests (Brannoc, Pip, Sorrel), sound and music, a 3-room tutorial.
