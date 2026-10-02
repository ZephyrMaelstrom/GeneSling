# Roadmap

> Exported from the GeneSling Claude doc (https://claude.ai/code/artifact/95b7ea62-89cc-46ac-aa39-e7963b245ec1) on 2026-10-02. This repo copy is the working reference for development; keep it updated when the design changes.

Oct 2, 2026 · @Conner Rittenhouse

Ten phases take GeneSling from the v5 prototype to a paid 1.0 in about 42 weeks. Work top to bottom: a phase starts only when the one before it passes its exit test. The reasoning behind each phase is in [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md). The full design is [DESIGN.md](DESIGN.md).

## The ten phases

| Phase | Weeks | What ships | Done when |
| --- | --- | --- | --- |
| 0 · Foundation | 1 to 2 | GitHub repo, modular build, content in data files, save migration, automated tests | v5 plays the same from the new build and old saves load |
| 1 · Genetics 2.0 | 3 to 6 | 14-locus genome, inheritance, mutation, lineage, looks from genes, Sequencer | An Apex genome takes 10 to 14 generations in simulation, and breeding feels worth planning |
| 2 · Jobs and production | 7 to 10 | Raid roles, raid bag, stations, fatigue, production chains, quality tiers | Testers face at least 3 hard posting choices per session |
| 3 · The Exchange | 11 to 14 | Order book, auctions, bounties, 60 simulated traders, Economy Sandbox | A 90-day sandbox run meets all three economy targets |
| 4 · Hideout builder and demo | 15 to 17 | Free building, creature life, Comfort, trophies, image export, **public demo** | Testers share cards unprompted; half of demo players return |
| 5 · The Bloom expands | 18 to 25 | 8 layouts, events, contracts, maps, all 5 veins, Venom type | 20 raids in a row with no repeated vein, layout and event combination |
| 6 · Underheart and endgame | 26 to 31 | Floors 7 to 10, Lumen type, 3 endings, Unbound tiers, Bloomlords, Renown, seasons | The Heart, all endings and Unbound tiers 1 to 5 are playable |
| 7 · Lore (alongside 5 and 6) | 18 to 31 | About 150 fragments, the rune cipher, 6 NPC arcs | The fragments tell the story in order, and the cipher can be broken |
| 8 · Balance and playtest | 32 to 36 | Bot players, tuning passes, 20-person closed playtest, accessibility | Simulated dedicated players reach the top around day 90 |
| 9 · Online and launch | 37 to 42 | Sign-in, cloud saves, payments, leaderboards, installable app, **1.0 and Season 1** | Purchases and saves sync across devices; cheated scores are rejected |

## Step by step

### Phase 0 · Foundation (weeks 1 to 2)

- [ ] Create the GitHub repo and turn on GitHub Pages (repo and deploy workflow done; Pages needs Settings → Pages → Source: GitHub Actions)
- [x] Split the v5 file into modules with a bundler build
- [x] Move species, attacks, items, enemies and bosses into data files
- [x] Add a seeded random number generator for replayable raids
- [x] Store saves in IndexedDB with a version number and migrations
- [x] Turn the headless test scripts into a suite that runs on every push
- [ ] Exit test: v5 plays the same, all tests pass, and a v5 save loads (automated checks pass; needs a hand test on a phone)

### Phase 1 · Genetics 2.0 (weeks 3 to 6)

- [x] Build the 14-locus genome and its data model (15 with Shine; see DESIGN.md)
- [x] Add inheritance: one allele from each parent, the father's 65% bias, recessive carriers and personality
- [x] Add mutation, defects, inbreeding risk, generations and the cut-free rule
- [x] Draw hue, pattern, size and shine on every species and evolution sprite
- [x] Add the first 20 traits
- [x] Build the Sequencer, Gene Lens, breeding outcome preview and family tree
- [x] Add a genetics simulator to the Test Lab
- [ ] Exit test: Apex in 10 to 14 generations, and five generations feel worth planning (simulator median 13; the hand test is still to do)

### Phase 2 · Jobs and production (weeks 7 to 10)

- [x] Add the six raid roles and the 12-slot raid bag
- [x] Rebuild the hideout sections as stations with exact contribution numbers
- [x] Add foremen, crew chemistry and fatigue
- [x] Add the roster cap and daily food upkeep
- [x] Build production chains, the five quality tiers, the maker's mark and recipe mastery
- [x] Add durability, repair, single-use prints and basic expeditions
- [x] Add the death legacy and the Memorial wall
- [ ] Exit test: at least 3 hard posting choices per session (supply check passes: raid-only and craft-heavy both stay supplied for a week; the hard-choices part needs playtesting)

### Phase 3 · The Exchange (weeks 11 to 14)

- [x] Build the order book for commodities
- [x] Add auctions with buyout for creatures, eggs, weapons and prints
- [x] Add genetic bounties
- [x] Build the six trader archetypes and run about 60 traders in a background worker
- [x] Add market shocks, fees, sales tax, price charts and the news ticker
- [x] Build the Economy Sandbox in the Test Lab
- [x] Exit test: a 90-day sandbox run meets all three economy targets

### Phase 4 · Hideout builder and demo (weeks 15 to 17)

- [x] Build free placement for stations, dens, paths, gardens and plots
- [x] Add creature life: sleeping, playing and following friends
- [x] Add crafted decor and the Comfort score
- [x] Add trophies, the Hall of Legends and the breeder's sigil
- [x] Add image export for hideout snapshots and creature cards
- [x] Cut the demo (the Rootworks and Act I) with a feedback button and opt-in play stats
- [ ] Publish the demo at a public link (built and deployed to /GeneSling/demo/ with `main`; feedback and stats need a Firebase project in `src/data/firebase.json`)
- [ ] Exit test: testers share cards unprompted, and half of demo players return

### Phase 5 · The Bloom expands (weeks 18 to 25)

- [x] Build the eight floor layouts
- [x] Add the five events, contracts and vein maps
- [x] Add the vein choice at the bottom of the Rootworks and the vein keys
- [x] Build the Drowned Galleries
- [x] Build the Hollow Choir
- [x] Rework the Ember Abyss into a full vein
- [x] Build the Glasswind Spires
- [x] Build the Sump, the Venom type and the Apothecary
- [x] Exit test: 20 raids in a row with no repeated vein, layout and event combination (tested by `tests/bloom.test.js` and the Test Lab's variety check; the key-type half needs testers)

### Phase 6 · Underheart and endgame (weeks 26 to 31)

- [x] Build floors 7 to 9, the cut-free entry rule and the Lumen type
- [x] Build the Floor 9 fight to free Ilsa
- [x] Build the Heart and the three endings
- [x] Add Unbound tiers 1 to 20 and the four Bloomlords
- [x] Add the Splicer, the Mutation Lab and the Apex Chamber
- [x] Add Renown, weekly shows, the weekly Deepening and seasons
- [x] Fill content to the 1.0 counts
- [x] Exit test: the Heart, all endings and Unbound tiers 1 to 5 are playable (`tests/endgame.test.js` from a Test Lab endgame save; the simulator median stays at 13 generations with the Apex Chamber)

### Phase 7 · Lore (weeks 18 to 31, alongside 5 and 6)

- [ ] Write Ilsa's 30 journal pages
- [ ] Write the 40 Old Keeper relics and 20 boss memories
- [ ] Write the 15 whispers and 8 murals
- [ ] Rewrite codex entries for every evolution
- [ ] Write the six NPC quest arcs
- [ ] Design the rune alphabet and write every rune wall
- [ ] Exit test: the fragments tell the story in order, and the cipher can be broken

### Phase 8 · Balance and playtest (weeks 32 to 36)

- [ ] Build bot players for raider, crafter, breeder and casual styles
- [ ] Run full 90-day simulations and tune ranks, gates, drops, mutation and traders
- [ ] Run a 20-person closed playtest for four weeks
- [ ] Optimize for mid-range phones
- [ ] Add colorblind palettes, aim assist and a slower-bullets option
- [ ] Exit test: simulated dedicated players reach the top around day 90

### Phase 9 · Online and launch (weeks 37 to 42)

- [ ] Add Firebase sign-in and cloud save sync
- [ ] Add payments and the demo-to-full-game unlock
- [ ] Add Deepening and Renown leaderboards with server-checked runs
- [ ] Make the game installable with offline play
- [ ] Make the store page, trailer and launch post
- [ ] Set up the Season 1 rule twist and its new hybrid
- [ ] Exit test: purchases and saves sync across devices, and cheated scores are rejected
- [ ] **Launch 1.0**
