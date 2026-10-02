# Development phases

> Exported from the GeneSling Claude doc (https://claude.ai/code/artifact/95b7ea62-89cc-46ac-aa39-e7963b245ec1) on 2026-10-02. This repo copy is the working reference for development; keep it updated when the design changes.

Oct 2, 2026 · @Conner Rittenhouse

GeneSling goes from the v5 prototype to 1.0 in ten phases over about 42 weeks, with a free public demo at week 17. Each phase ends in a playable build you can test on your phone. The schedule assumes 10 to 15 hours a week, with Claude writing most of the code.

## At a glance

See the phase table in [ROADMAP.md](ROADMAP.md): Phases 0 to 4 run weeks 1 to 17 (public demo at week 17), Phases 5 to 7 run weeks 18 to 31 (lore alongside), Phase 8 runs weeks 32 to 36 and Phase 9 runs weeks 37 to 42 (1.0 launch).

Systems come first (Phases 1 to 4), then content (5 to 7), then proof and launch (8 and 9). Lore is written alongside the content it describes.

## How the phases work

- **Fun first, content second.** Each phase builds a system with a little content, proves it's fun, then fills it out. Phases 1 to 4 build systems. Phases 5 to 7 build content.
- **Every phase ships a playable build.** The build is published to the same test link as today, with the Test Lab updated so each new system can be tried in minutes.
- **Exit tests, not dates.** A phase is done when its exit test passes. If one runs long, later phases move; scope is cut before quality is.
- **Automated checks grow with the game.** The headless browser tests used for v1 to v5 become a suite that runs on every change, plus simulations for genetics, economy and pacing.
- **Saves migrate from Phase 0 on.** No more save resets after the foundation is in. Each phase adds a save migration instead.

## Phase 0 · Foundation (weeks 1 to 2)

**Goal:** turn the single-file prototype into a real project without changing how it plays.

**Build**

- A GitHub repo with the code split into modules and built with a bundler, deployed to GitHub Pages on every push.
- Game content (species, attacks, items, enemies, bosses) moved out of the code into data files, so content can grow without touching the engine.
- A seeded random number generator, so a raid can be replayed exactly. The Deepening and bug reports both need this.
- Saves stored in IndexedDB with a version number and a migration step.
- The headless test scripts turned into an automated test suite that runs on every push.

**Exit test:** the v5 game plays the same from the new build, all tests pass, and a v5-format save loads without loss.

## Phase 1 · Genetics 2.0 (weeks 3 to 6)

**Goal:** the vertical slice. Breeding should be the most interesting thing in the game before anything else is added.

**Build**

- The 14-locus genome: six combat stats, two work stats, three trait slots, and hue, pattern, size and shine.
- Inheritance rules: one allele from each parent, the father's 65% bias, personality inheritance and recessive carriers.
- Mutation, defects, inbreeding risk, generations and the cut-free rule at Gen 3.
- Looks drawn from genes. Every species and evolution sprite takes hue, pattern, size and shine.
- The first 20 traits, the Sequencer and the Gene Lens, a breeding screen that shows likely outcomes, and the five-generation family tree.
- A genetics simulator in the Test Lab that breeds thousands of generations to check the pace.

**Exit test:** the simulator shows a focused breeder reaching an Apex genome in 10 to 14 generations. In hand testing, five generations of a line feel worth planning, and two plain parents can hatch a surprise.

## Phase 2 · Jobs and production (weeks 7 to 10)

**Goal:** every creature has a job, and filling one job leaves another short.

**Build**

- The six raid roles (Striker, Bulwark, Medic, Scout, Hauler, Catcher) and a 12-slot raid bag.
- Stations for the seven current types, with exact contribution numbers from Yield and Knack, foremen, crew chemistry and fatigue.
- The roster cap and daily food upkeep.
- Production chains from raw to refined to component to finished, with five quality tiers, the maker's mark and recipe mastery.
- Durability and repair, single-use prints, and basic Roost expeditions.
- A death legacy: the closest descendant inherits 25% bond, and the Memorial wall.

**Exit test:** with 25 creatures and 20 jobs, testers say at least three postings a session were hard choices. A raid-only run and a craft-heavy run both stay supplied for a week of hideout days.

## Phase 3 · The Exchange (weeks 11 to 14)

**Goal:** a market that behaves like it's full of players, built so real players can join it later.

**Build**

- An order book for commodities, auctions with buyout for unique goods, and bounties for genetics.
- About 60 simulated traders across six archetypes, running in a background worker behind the same interface a server would use.
- Market shocks (cave-ins, migrations, estate sales), fees and sales tax, price history charts and a news ticker.
- The Economy Sandbox in the Test Lab: fast-forward 7, 30 or 90 days, inject or remove supply, and chart coin supply and prices.

**Exit test:** a 90-day sandbox run meets all three targets from the design: coin supply grows under 3% a week after day 30, the basket price stays within ±15%, and raider, crafter and breeder playstyles reach Act III within 10% of each other.

## Phase 4 · Hideout builder and the public demo (weeks 15 to 17)

**Goal:** a hideout players want to show off, then put the game in front of strangers for the first time.

**Build**

- The free-placement grid: stations, dens, paths, gardens and expansion plots.
- Creature life: off-duty creatures sleep, play and follow their high-bond friends.
- Crafted decor and the Comfort score, capped at +20%.
- Trophies, the Hall of Legends with retirement perks, and the breeder's sigil.
- Image export for hideout snapshots and creature cards.
- **The demo:** the Rootworks and Act I, using everything built in Phases 1 to 4, at a public link. It has a feedback button and opt-in, anonymous play stats sent to Firebase.

**Exit test:** testers share a creature card or a hideout snapshot without being asked. Demo stats show at least half of players who finish the tutorial come back for a second session.

## Phase 5 · The Bloom expands (weeks 18 to 25)

**Goal:** floors 1 to 6 at full variety, so no two raids play alike.

**Build, in this order**

1. **Dungeon systems (weeks 18 to 19).** The eight layouts, five events, contracts, vein maps, the vein choice at the bottom of the Rootworks, and vein keys that need certain creature types.
2. **Two new veins (weeks 20 to 22).** The Drowned Galleries and the Hollow Choir. They're the most different from what exists, so they prove the vein system.
3. **The other three veins (weeks 23 to 25).** The Ember Abyss reworked, plus the Glasswind Spires and the Sump. This brings in the Venom type and the Apothecary.

By the end of the phase: 8 types, about 24 base species, 15 bosses, about 45 enemy types and 32 weapon designs.

**Exit test:** 20 raids in a row with no repeated combination of vein, layout and event. Each vein's key type gets used in at least one tester's regular loadout.

## Phase 6 · Underheart and endgame (weeks 26 to 31)

**Goal:** the end of the story and a reason to keep playing after it.

**Build**

- Floors 7 to 9 (the Underheart), the cut-free entry rule, the Lumen type and the Archive's translation work.
- The Floor 9 fight to free Ilsa, the Heart, and the three endings: Wake, Sever and Sing.
- Unbound tiers 1 to 20, the four Bloomlords, the Splicer, the Mutation Lab and the Apex Chamber.
- Renown, weekly shows, the weekly Deepening (seeded and replayable) and the season structure.
- The remaining content to reach the 1.0 counts: 27 species, 18 hybrids, 20 bosses, about 60 enemies and 40 weapon designs.

**Exit test:** a tester with a Test Lab endgame save can play the Heart, pick each ending and clear Unbound tiers 1 to 5. The genetics simulator shows Apex Chamber breeding doesn't shorten the chase below 10 generations.

## Phase 7 · Lore, running alongside (weeks 18 to 31)

**Goal:** about 150 fragments, written while the places they describe are being built.

**Build**

- Ilsa's 30 journal pages, 40 Old Keeper relics, 20 boss memories, 15 whispers and 8 murals.
- Codex entries that are rewritten for each evolution.
- NPC quest arcs for Brannoc, Pip, Sorrel and three new residents.
- The rune alphabet and every rune wall's text, including the secrets it gives away.

**Exit test:** a reader who has only the fragments can piece together the four act questions in order. A tester given only the rune walls can break the cipher.

## Phase 8 · Balance and playtest (weeks 32 to 36)

**Goal:** prove the 90-day journey works before anyone pays for it.

**Build**

- Bot players that run the full journey in simulation, playing as a raider, a crafter, a breeder and a casual player.
- Tuning passes on the Keeper rank curve, gate requirements, drop rates, mutation odds and trader behavior, driven by those runs.
- A closed playtest with about 20 players from the demo's community, using the full game for four weeks with play stats on.
- Performance work for mid-range phones, plus accessibility options: colorblind palettes, aim assist and slower bullet speeds.

**Exit test:** simulated dedicated players reach Act IV between day 55 and 65 and the top Unbound tiers around day 90. Playtesters reach Act II at the expected pace, and none of them gets stuck at a gate for more than a week.

## Phase 9 · Online and launch (weeks 37 to 42)

**Goal:** a paid game people can buy, sync and come back to.

**Build**

- Firebase sign-in and cloud save sync across devices.
- Payments and entitlements: the demo unlocks into the full game with the save kept.
- Leaderboards for the Deepening and Renown, with seeded runs checked on the server.
- The game installable from the browser as an app, with offline play.
- A store page, a trailer and a launch post, plus the Season 1 rule twist and its new hybrid recipe.

**Exit test:** a purchase on one device unlocks on another, a save made offline syncs cleanly, and a tampered Deepening score is rejected.

## After launch

- **Every 90 days:** a new season with a rule twist, a new hybrid, Fresh Season ladders and end-of-season awards.
- **First major update, about 3 months after launch:** the online Exchange. Order matching moves into Firebase Cloud Functions, inventories are checked on the server, and simulated traders stay on as market makers.
- **Second major update:** read-only visits to other players' hideouts, and shows judged across all players.
- **Expansions, about twice a year:** a new vein, a new type, bosses and a lore arc.

## Risks to watch

| Risk | What it threatens | Fallback |
| --- | --- | --- |
| Genetics is deep but not fun | The whole game, since it's the core pillar | Phase 1 is the vertical slice. If its exit test fails, simplify to fewer loci before building on it. |
| The simulated market feels fake | The economy pillar and the case for going online later | Ship the Exchange with fewer goods and stronger trader personalities. Market news makes the traders feel like people. |
| Content takes longer than planned | Weeks 18 to 31 | Launch with 4 veins and add the fifth as the first free update. |
| 90 days of pacing can't be checked by hand | The structure pillar | Bot players in Phase 8, and pacing numbers kept in data files so they can be tuned without code changes. |
| Mobile performance with many effects | Players on phones | A performance budget per room from Phase 0, and a low-effects setting. |
| Cheating once leaderboards and trading are live | Fairness at the top | Seeded runs checked on the server at launch. Trading stays solo until server checks are in place. |
