# GeneSling: improving and preparing for future development

Written October 2026, after Phase 8. A copy of the shared plan, kept here so the code can point at it. The diagrams live in the shared version.

## Progress

- **Step 1, Groundwork: done.** The event bus (`src/events.js`), the action registry (`src/actions.js`), device options out of the save (`src/device.js`, save v15), the release build without globals (tests use the dev build in `dist-dev/`, with `window.gs`), and data schemas with a cross-reference test (`src/data/schema/`, `tests/data.test.js`). See `docs/CODE.md`.
- **Step 2, Creature pages: done.** One small card (`creatureCard`) in the roster, the party picker, the breeding screen, station crews and the family tree; a page per creature with the identity column and the five tabs, prev and next through the list it came from, and a compact read-only page in the raid menu (`src/creatureui.js`). Each creature keeps a history (`src/history.js`, save v16). The history keeps 24 entries rather than 40, to keep saves small. Exchange listings and the expedition and station pickers still use their dropdowns.
- Also fixed: each vein's "rich in" bonuses were never applied; now they are, in raids and in the Journey Simulator (still Act IV on day 58).
- Step 3, Perk rework: next.

## Summary

Before going online, GeneSling should make two changes: give every creature its own page, and replace threshold-based station perks with perks and flaws carried by each creature. Then pay down a short list of code debt that online play will otherwise make expensive.

- **Creature pages.** The roster card today carries about 25 pieces of information and 6 buttons per creature. Cut it to a glanceable card (sprite, name, level, form, types, one status line, one flag), and give each creature a full-screen page with tabs for Overview, Genes, Work, Story and Actions. The page shows only what the player has unlocked (Keeper's eye, Sequencer, Gene Lens), so discovery stays a reward.
- **Creature perks and flaws.** Today a station's 5 perks switch on when the summed score of its workers crosses a threshold (15, 45, 100, 180, 300). Rework this so each creature brings its own perks and flaws, derived from its species, genes, traits, personality, evolution and history. A station is then the sum of the actual creatures in it, and every posting is a choice between named trade-offs, not a race to a number.
- **Prep for online.** Split `raid.js` (1,283 lines), stop exposing 818 module exports on `window`, move the save to a schema with validation, and make raids replayable from a seed and an input log so the server can check Deepening scores.
- **Order.** Creature pages first (a UI change, no save change), then the perk model behind a save migration and a Journey Simulator re-tune, then the online prep. Section 10 has the order with sizes.

## Where the game stands

Phases 0 to 8 are built: about 7,500 lines of game code in 33 modules, 178 KB of content data in 17 JSON files, and 134 headless tests in 20 files, all passing. Save format version 14 loads every save back to the v5 prototype.

| Area | What exists | Weak spot found reading the code |
| --- | --- | --- |
| Creatures | 27 species, 18 hybrids, 129 forms; a 15-locus genome; 22 traits (2 of them defects); 8 personalities; bond stars | One roster card shows everything at once: stats, genome, bond, fatigue, XP, evolution chain and 6 buttons |
| Hideout | 9 stations with 5 tiers each; tiers are thresholds on summed worker score (15, 45, 100, 180, 300) | Workers are interchangeable points; which creature works matters only through a score |
| Hall of Legends | Retire a veteran, get a type perk that stacks 3 times | Seven fixed perks, one per type, so every Ember legend is the same |
| Raids | 10 floors, 9 veins, 8 layouts, act gates, Unbound tiers | `raid.js` is 1,283 lines holding generation, combat, AI, bosses, loot and the raid end |
| UI | HTML built from template strings; landscape-first; no-scroll raid menus | 98 inline `style=` attributes; one `act()` switch dispatches every button |
| Code shape | ES modules bundled by esbuild into one page | 818 exports all copied onto `window`; 44 two-way module import cycles |
| Data | Every tunable number in `src/data/*.json` | No schema: a typo in a key fails silently at runtime |
| Saves | IndexedDB, versioned migrations 5 to 14 | The whole state `S` is saved as one JSON blob, with no validation on load |
| Tests | Puppeteer suite: parity with v5, saves, journeys, doors, lore, cipher | A full run takes about 5 minutes; the variety and journey checks need fixed seeds to stay stable |

Nothing here is broken. These are the places where the next phases (creature pages, the perk model, online play) will cost more than they need to unless they are reshaped first.

## Creatures: a small card, and a page of their own

Every list of creatures in the game should show the same small card, and tapping any card opens that creature's own page. The page shows everything the player currently knows about it, and nothing they haven't unlocked yet.

### The card

The card answers three questions at a glance: who is this, is it ready, and where is it now. At 780 × 360 a card of about 150 × 84 px fits five across in the roster beside the tab rail, so a 40-creature roster is eight short rows instead of a long scroll.

- **Always shown:** sprite (56 px), name, level, form name, type chips, sex symbol.
- **One status line:** where it is ("Combat slot 1", "Forge", "Resting", "Away: Rootworks forage, back in 1 day").
- **At most one flag**, by priority: Can evolve › Hurt (HP bar appears only below 100%) › Tired (fatigue 60+) › Unproven › Caught this raid.
- **Gone from the card:** the stat grid, attack and ability text, evolution chain, bond line, genome, XP bar, fatigue bar and all six buttons. Each moves to the page (table below).

The same card appears wherever creatures are picked: the roster, the party slot picker, a station's add-worker list, the breeding mother and father pickers, the expedition team picker, Exchange listings and the family tree. Each picker adds one line of context under the card, such as "+3.4 ingots a day here" in a station list or "Hybrid chance 6%" in a breeding list. One card component then replaces about six bespoke row layouts.

### The page

The page is a full-screen view of one creature, laid out for landscape. A fixed identity column on the left holds the large sprite, name (tap to rename), form, types, level and XP, HP, bond stars, where it is, and its two or three most useful buttons. On the right are tabs:

1. **Overview:** HP, Attack, Move and Rate, each with a tap-to-see breakdown (level, stage, genes, traits, personality, bond); its attack and ability; raid role; perks and flaws (section 4); titles and ribbons.
2. **Genes:** the genome, shown as far as the player's tools allow (next list); breeding value; mutations it was born with; a link into the family tree.
3. **Work:** what it would produce in every station, as exact numbers; fatigue and when it recovers; how it gets on with the current crew (chemistry and clashes); whether it would make a good foreman; expedition fit.
4. **Story:** the codex entry for its form, then its history: where and when it was caught or hatched, raids survived, kills, bosses beaten, evolutions, children, titles earned, near-deaths, and who bred it (sigil).
5. **Actions:** evolve, feed, post to a station, put in the party, breed with (opens the breeding screen with this creature filled in), share card, serums, sell or release, retire to the Hall of Legends.

Left and right arrows (and a swipe) step to the next creature in whatever list the player came from. Back returns to that list at the same scroll position.

### Showing only what is known

The page reveals each piece of information only once the player has the tool that uncovers it, so unlocking the Sequencer or Gene Lens visibly changes every page.

| What | Before any tool | Keeper's eye (default) | Sequencer | Gene Lens |
| --- | --- | --- | --- | --- |
| Combat stats | Shown | Shown | Shown | Shown |
| Gene grades | Hidden | Stars, rounded | Exact grade | Exact grade |
| Allele pairs | Hidden | Hidden | Both alleles | Both alleles |
| Recessive traits carried | Hidden | Hidden | "Carries something" | Named |
| Traits of an unproven wild catch | "Unknown until proven" | Same | Same | Named |
| Perks and flaws (section 4) | Known ones only | Known ones only | Hinted when carried | Named when carried |

A wild catch keeps its traits secret until it survives a raid, as it does today. Its page shows question marks in their place, which gives the player a reason to bring it home.

### Where things move

| On today's card | Moves to |
| --- | --- |
| HP, Atk, Move, Rate grid | Overview tab, with breakdowns |
| Attack and ability text | Overview tab |
| Evolution chain and Evolve button | Identity column (button), Overview (chain) |
| Bond stars and passive | Identity column (stars), Overview (passive) |
| Genome block | Genes tab |
| XP bar | Identity column |
| Fatigue bar | Work tab, and the card's Tired flag |
| Feed, Sell, Share card, serums | Actions tab |
| "Bred by" sigil | Story tab |

### What it needs underneath

- **A history log per creature:** a new save field `c.log` holding up to 40 dated events (caught, hatched, evolved, boss beaten, child hatched, title earned, near-death), plus counters for kills, extracts and raids. This needs a save migration (version 15), but no backfill: old creatures start their log with "Came with you from before the records began".
- **A route:** `ui.creature = id` and `ui.creatureTab`, rendered by a new `creatureui.js` with `creatureCard(c, context)` and `creaturePage(c)`. The existing `genomeBlock`, `treeHtml`, `persChip` and `titleChips` move into it.
- **One card component:** every picker calls `creatureCard`, passing a context line, so the six bespoke row layouts can be deleted.
- **In raids:** the ⚙ Creatures tab keeps its no-scroll layout. Tapping a creature there opens a compact, read-only version of the page (identity column and Overview only) that fits one screen.

## Hideout perks: every creature brings its own perks and flaws

Replace the station tier ladders with two separate things. First, what a station can do comes from the building, upgraded with materials. Second, how well it does it comes from the specific creatures posted there, each with its own named perks and flaws. No bonus appears because a sum crossed a line. Every bonus comes from a creature the player can point at, and every creature has a downside worth weighing.

### What's wrong with thresholds today

Each station has 5 perks that switch on when the summed score of its workers reaches 15, 45, 100, 180 and 300 (`SEC_TH`). A worker's score is `(5 + 1.6 × level + 1.5 × Yield) × type match`. Three things follow:

- **Workers are interchangeable.** Two Lv 20 Ember creatures with the same Yield are worth exactly the same at the Forge, whoever they are.
- **Bonuses are cliffs.** At 99 points the Forge gives nothing at tier 3; at 100 it gives gilded cages and +50% ore. Players learn to read a meter, not their creatures.
- **Unrelated rewards are bundled.** The Spring's ladder runs healing, bond, raid HP, then a free revive. The Vault's runs keeping slot 3, weapons, coin, then your companion. None of these has to do with who works there.

### The new model

1. **The building sets what is possible.** Each station has a level from 1 to 5, raised with coin, materials and a Keeper rank (for example, Forge level 3 costs 400 coin, 12 ingots and 6 glass at rank 12). Levels unlock capabilities: weapon tiers at the Forge, egg slots at the Nursery, the Gene Lab at the Training Grounds. Upgrades are a spending decision, made once.
2. **Each creature brings perks and flaws.** A perk is a named, exact effect with a scope: one station, the whole hideout, raids or breeding. A flaw is the same, but costs something. Most creatures have 2 or 3 perks and 1 or 2 flaws.
3. **A station's result is the sum of its actual crew.** Output is the workers' base work (Yield, level, type match, fatigue, as today) plus every perk and flaw that applies there, plus crew effects (auras, chemistry, clashes). The station panel lists each worker with the perks and flaws active here in green and red, and the exact number each one adds or takes away.
4. **Strength scales with the creature, not with a meter.** A perk's size grows with evolution stage (+10% per stage) and bond (×1.25 at ★3, ×1.5 at ★5), so a raised, trusted creature is visibly better at its job.

### Where perks and flaws come from

| Source | How many | Inherited? | Example |
| --- | --- | --- | --- |
| Species line (signature) | 1 perk, often 1 flaw | Yes, with the species | Cindlet line: Kindler, +15% Forge output; Restless, tires 25% faster |
| Type | 1 mild perk at its own station | Yes | Any Ember: +10% at the Forge (today's type-match bonus, now named) |
| Traits on the trait loci | 0 to 3 | Yes, dominant or recessive as today | Hard Worker, Thrifty, Artisan, Tireless (existing), plus new hideout flaws such as Glutton and Loner |
| Personality | 1 perk and 1 flaw | As today (`inheritPersonality`) | Calm: crewmates tire 10% slower; Calm: −10% raid damage |
| Final evolution | 1 mastery perk | Through the species | Infernox: Forge can smelt one tier higher than its level |
| History (earned) | 0 to 3, gained in play | No (a 15% chance to pass a weaker "instinct") | Forge-hand: 30 days at the Forge, +10% there |

*(Diagram: perk sources · 6 sources, 1 creature, 4 places they apply.)*

Nothing reads a tier number any more: a station, a raid or a clutch of eggs asks its creatures what they bring, and the answer is the sum of those six sources, scaled by how far each creature has come.

Flaws are meant to be bred out. New hideout flaws sit on the trait loci as recessives, so a careful breeder can purge Glutton from a line over a few generations, just as defects work today. Species flaws can't be bred out, only outweighed. That keeps each line's character.

### Discovery

- A **species perk and flaw** are known once the form is in the Codex.
- A **personality** perk and flaw show from the start.
- **Trait-based** perks and flaws follow today's rules: hidden on an unproven wild catch, shown once it is proven or when a Sequencer or Gene Lens reads them.
- A **latent perk** (one that only shows at a particular station) is discovered after 3 days of working there, announced by a resident: "Brannoc says Kindle runs hotter at the Forge than he expected."
- **Earned** perks and flaws arrive with a log line and appear on the Story tab.

### Station by station: what the building does, what creatures do

| Station | Building levels unlock | Moves to creature perks (and who carries them) |
| --- | --- | --- |
| Forge | Craft weapon tiers 1 to 4; gilded cage recipe | +50% ore from scrapping (Pyrrox line); +10% weapon damage (Kestrix and Infernox final forms) |
| Garden | More plots (worker slots) | Every output bonus: Puffcap, Shroomite and Solaryx lines, Irrigation chemistry kept |
| Spring | Daily healing 35% → 50% → full | +5 bond a day (Halowing line); +10% raid HP (Dewdrip line); a free auto-revive (Tidewyrm final form) |
| Roost | Scouting reports in the raid HUD | Full floor map (Chirrup line); rare-room marks (Vesperbat line); hidden doors sparkle (Umbrowl line); boss forecast (Eclipsowl final form) |
| Vault | Storage slots | Keep slot 3 on death (Bastion line); keep weapons (Geodon line); keep 15% of raid coin each, up to 60% (Shardling line); companion survives (Gemcitadel final form) |
| Nursery | Egg slots 1 → 3; hatch time 2 → 1 days | Faster hatching (Pebblet line); +0.5% mutation per gene (Monolord line); hybrid odds (Bastion line) |
| Training | XP per day 30 → 100; Gene Lab, Trait Tutor | Coaching auras from personalities (Brave, Loyal) |
| War Room | Raid modes (Hunter's Moon, Iron Will, Swarm) | +10 max HP (Zephling line); start with a buff (Stormwing line); +10% weapon damage (Kestrix line) |
| Apothecary | Serum brewing | +25% serums (Toxlet line); poison rounds (Fangmire line); poison-pool immunity (Hydravine line) |

### Signature perks and flaws for the 27 base species (first pass)

These are a first draft to tune in the Journey Simulator, not final numbers. Percentages apply while the creature is posted at the named station unless the scope says otherwise.

| Line | Signature perk | Signature flaw |
| --- | --- | --- |
| Cindlet | Kindler: +15% Forge output | Restless: tires 25% faster |
| Pyrrox | Scrapper: +50% ore from scrapping | Showoff: −10% output when it is the only worker |
| Magmaul | Heat Sink: crewmates at its station tire 30% slower | Slow Start: half output on its first day at a new station |
| Puffcap | Green Thumb: +20% Garden output | Homebody: −10% damage in raids |
| Shroomite | Ploughman: +1 food a day at the Garden | Glutton: eats 2 food a day |
| Mycelisk | Root Network: +3% to every station (one counts) | Shy: won't work at the War Room |
| Dewdrip | Healer's Touch: Spring heals 25% more | Frail Shell: −10% max HP in raids |
| Coralisk | Reef Keeper: +20% tonics at the Spring | Territorial: clashes with another Coralisk at its station |
| Tidewyrm | Lifeguard (final form): one free auto-revive a raid | Deep Sleeper: needs 2 days off after 5 days of work |
| Chirrup | Mapper: full floor map in raids | Chatterbox: crewmates −5% output |
| Vesperbat | Night Scout: marks rooms with rare creatures | Light-shy: won't work at the Vault |
| Umbrowl | Hollow Ears: hidden doors sparkle | Brooding: 70% output while its bond is under ★2 |
| Zephling | Tailwind Drill: +10 max HP for you in raids | Flighty: 10% chance a day to skip work |
| Kestrix | Drill Sergeant: +10% weapon damage in raids | Fierce temper: clashes with Calm creatures |
| Stormwing | Storm Caller: start each raid with a random buff | Big Appetite: eats 2 food a day |
| Shardling | Coin Keeper: keep 15% of raid coin on death (stacks to 60%) | Brittle: takes 10% more damage in raids |
| Prismoth | Light Bender: +20% glass at the Vault | Distractible: −10% output while Comfort is under 5% |
| Geodon | Strongbox: keep the weapons in your hands on death | Slow Learner: −25% XP |
| Pebblet | Nest Warmer: eggs hatch a day sooner | Clumsy: −10% move speed in raids |
| Bastion | Brood Keeper: +1 egg slot | Stubborn: won't move station for 3 days after a move |
| Monolord | Ancestral Memory: +0.5% mutation per gene on eggs | Aloof: gives and gets no chemistry bonuses |
| Toxlet | Brewer: +25% gene serums | Toxic: crewmates tire 10% faster |
| Fangmire | Poisoner: your bullets sometimes poison | Cold-blooded: −15% output at the Spring and Garden |
| Hydravine | Antidote: no harm from poison pools | Three Mouths: eats 3 food a day |
| Glimmet | Archivist: reads a relic a day in the Archive | Night Owl: tires 20% faster |
| Halowing | Dawn Song: every creature gains 2 bond a day | Fragile: −10% max HP in raids |
| Solaryx | Sunlamp: +15% Garden output and +3 Comfort | Proud: won't share a station with Echo creatures |

The 18 hybrids each combine one perk from each parent line at 80% strength, and carry one flaw of their own (for example Phoenixwing: Kindler and Tailwind Drill at 80%; flaw Volatile, 5% chance a day to cost 1 fatigue to each crewmate). Being strong but quirky is what makes hybrids worth chasing.

### Personalities: one perk and one flaw each

| Personality | Perk | Flaw |
| --- | --- | --- |
| Brave | +10% raid damage; as foreman, Training XP +10% | Takes 10% more damage in raids |
| Timid | Tires 15% slower at any station | −15% output at the War Room |
| Greedy | +10% coin from raids it survives | Eats 1 extra food on days it works |
| Curious | Expeditions it joins find 1 extra item | 10% chance a day to wander off work (no output that day) |
| Loyal | Bond grows 25% faster | −20% output when moved to a new station (first 2 days) |
| Fierce | +10% critical chance in raids | Clashes with Calm and Timid crewmates |
| Calm | Crewmates tire 10% slower | −10% raid damage |
| Playful | +2 Comfort while off duty; friends form faster | −10% output at stations with no friend in the crew |

### Earned in play (history)

| Earned | Condition | Effect | Clears? |
| --- | --- | --- | --- |
| Forge-hand (and one per station) | 30 days worked at one station | +10% output there | Perk, permanent |
| Veteran | Home from 25 raids | +5% raid damage | Perk, permanent |
| Survivor | Home 3 times below 10% HP | +10% max HP in raids | Perk, permanent |
| Nursemaid | 10 hatchlings raised while posted at the Nursery | Hatchlings start with +10 bond | Perk, permanent |
| Wyrmslayer (existing title) | Home from a raid where a boss fell | +10% damage to bosses | Perk, permanent |
| Burnt Out | Reached 100 fatigue 3 times in 10 days | Tires 25% faster | Flaw, clears after 5 days off |
| Homesick | No raid in 30 days | −5% raid stats | Flaw, clears after one raid |
| Grudge | A crewmate died on a raid with it | −10% output beside that crewmate's type | Flaw, clears after 20 days |

### How it's stored and computed

- **One perk table** in a new `src/data/perks.json`: each perk and flaw has an id, name, description, scope (`station: "forge"`, `hideout`, `raid`, `breeding`) and an effect from a small closed list: `outputPct`, `outputFlat`, `fatigueMul`, `food`, `quality`, `crewOutputPct`, `crewFatigueMul`, `mutation`, `eggSlots`, `hatchDays`, `bond`, `comfort`, `reveal`, `deathKeep`, `raidHpPct`, `raidDmgPct`, `capture`, `refuses`, `clashesWith`.
- **One function** `perksOf(c)` gathers a creature's perks and flaws from all six sources, scaled by stage and bond, and marks which the player knows. `stationEffects(k)` sums them for a station; raids call `raidEffects(party)`. Stations, raids and the Journey Simulator all read through these two calls, never through a tier number.
- **Earned perks** are counters on the creature (`c.days.forge`, `c.raids`, `c.nearDeaths`), checked at the end of each day and each raid.

### Moving old saves

The change needs a save migration (version 15 or 16, together with the history log from section 3), and nobody loses anything:

- Each station's **building level** starts at its current tier, so every unlock a player has stays unlocked.
- Every creature gets its **species, type, personality and trait perks** derived from what it already has. Nothing is rolled at random, so the same save always migrates the same way.
- **Earned perks** start empty, apart from titles that already exist (Wyrmslayer and the Extract titles map across).
- Hall of Legends **statues keep their perk**, converted as in section 5.

## Knock-on changes

The perk model touches eight other systems. Each needs a small, specific change, and two of them (the act gates and the Journey Simulator) must change in the same release, or the 90-day pacing breaks.

### A worked example: choosing a Forge crew

The point of the rework is that crews like these are real choices. All three creatures are Lv 20, evolved once, with Yield 6. Output is in work units a day, using today's work formula plus the draft perks above.

| Crew | Output a day | What you gain | What it costs you |
| --- | --- | --- | --- |
| Kindle (Cindlet) + Ash (Cindlet) | 3.9 on working days, about 3.1 averaged | Two Kindlers: the highest raw output | Both Restless: tired in 4 days, so the Forge idles 1 day in 5 |
| Kindle (Cindlet) + Brick (Magmaul) | about 3.6 | Heat Sink cancels Kindle's Restless; the crew never needs a day off | Brick has a Slow Start; Brick can't also guard the Vault |
| Kindle (Cindlet) + Sly (Pyrrox) | about 3.6 | Scrapper turns old weapons into 50% more ore | Sly is your best gun-hand in raids: posting it here weakens your party |

Under today's thresholds, all three crews would score about the same and unlock the same tier.

### What else changes

| System | Change |
| --- | --- |
| Station panel | Lists each worker as a card, with the perks and flaws active here in green and red, the number each adds, and the total. The add-worker list shows what each candidate would add here and what it would leave behind (today's posting preview, extended to perks). |
| Act gates (`balance.json`) | "3 stations at tier 2" becomes "3 stations at building level 2, each with 2 workers". Building levels need Keeper rank, so the gate keeps its time-played part. The demo's Act I goals change the same way. |
| Raids | `raidEffects(party)` applies raid-scoped perks and flaws. Perks that act on raids from the hideout (Coin Keeper, Mapper, Storm Caller) need their creature posted at home. So your best Shardling either fights beside you or protects your coin, not both. That trade-off is new and intended. |
| Breeding | The breeding preview shows each parent's inheritable perks and flaws, and the odds a child carries them. Purging a recessive flaw becomes a breeding goal beside gene grades. Shows can add classes such as "Best flawless Garden line". |
| Hall of Legends | A retiring legend leaves its best perk to the whole hideout at 50% strength, instead of a fixed perk per type. Two legends with the same perk stack with diminishing returns (100%, then 50%, then 25%). Each statue becomes the story of a particular creature, not a type token. |
| Exchange | Listings show perks and flaws; the appraisal (`appraise` in the engine) adds a value for each known perk and subtracts for each flaw. Simulated breeders start trading "flaw-free" lines. |
| Codex | Each species page lists its signature perk and flaw, once seen. |
| Expeditions | Perks scoped to expeditions (Curious finds 1 extra item; a future Forager perk) apply to the team. |
| Journey Simulator | Bots pick crews by the value of their perks, buy building levels, and the targets are re-checked: Act IV between day 55 and 65 for dedicated players. Re-tuning goes in the same release as the perk model. |
| Tutorial and residents | Brannoc introduces perks at the Forge the first time a worker is posted; Sorrel introduces flaws at the first breeding. |

### Keep, simplify or remove

- **Keep** fatigue, chemistry pairs and personality clashes. They already work per creature and become ordinary perks and flaws in the new table.
- **Keep** Comfort with its cap of +20%. It's about the hideout, not the crew, so it doesn't conflict with the new model.
- **Simplify** foremen to the creature with the highest crew aura, with no separate foreman rules.
- **Remove** `SEC_TH`, `secTier()` and the five-line tier lists in `hideout.json`. 47 call sites read `secTier`, so give it a short-lived replacement, `stationLevel(k)`, and change call sites one system at a time.

## UI and UX streamlining

The hideout has grown to 10 tabs, and several pages are long scrolls of panels added phase by phase. The biggest gain is fewer places to look, plus one screen that says what to do next.

| Area | Today | Proposal | Size |
| --- | --- | --- | --- |
| Navigation | 10 tabs: Raid, Hideout, Roster, Breeding, Research, Workshop, Exchange, Codex, Test Lab, Settings | 7 tabs: Raid, Hideout, Creatures (roster + breeding), Workshop, Exchange, Codex, Settings. Research moves into its building on the hideout map. The Test Lab moves behind a developer switch in Settings. | M |
| What to do next | Red dots on tabs; the log; modals that queue up after a raid | A "Today" strip at the top of the Raid tab: eggs hatched, evolutions ready, residents with rewards, the next gate's checklist, a contract to take. Each item opens the right screen. | M |
| Raid prep | The Raid tab scrolls through party, gear, maps, contracts, cages, risk, modes, rank, bosses and story | One no-scroll loadout screen (party, gear, cages, map and contract, Deploy) at 780 × 360. Rank, bosses and story move to a Progress tab or the Codex. | M |
| After a raid | One report modal, then queued modals (rank-ups, journal pages, NPCs) | One report with pages, "Next" to step through. Rank-ups and finds appear as cards inside it, not separate pop-ups. | S |
| Roster | Filter chips, cards sorted by level | Sort by power, generation, type or where they are; filters for perks and flaws; select several creatures to sell, post or release at once | S |
| Stations | A section list plus a detail panel | The station page shows the crew as creature cards with perks (section 4), building level and upgrade cost, and the output with a 7-day sparkline | M |
| Help text | Long hint paragraphs on almost every panel | One-line hints, with an "i" button for the full explanation. Hints for systems the player already uses fade after the first week. | S |
| Confirmations | Mixed two-tap arming ("Confirm: sell for 120 coin") and modals | One rule: anything that destroys or loses something is two-tap with the cost in the button. Everything else acts at once, with Undo in a toast for 5 seconds. | S |
| Unlocks | Every tab is visible from day one | Tabs and panels appear when their system unlocks, each announced once (for example "The Exchange is open: sell spare finds to other Keepers here") | S |
| Raid HUD | Party panel, messages, prompts and a boss bar compete for the top half | Messages queue (one at a time, 2.5 seconds each); party cards collapse to portraits with HP rings; prompts sit just above the action buttons | S |
| Text size | Fixed type scale | A text size setting (90%, 100%, 115%, 130%) plus a 44 px minimum touch target in every list | S |

Size: S is about a day, M a few days, L a week or more, for one developer working with Claude.

## Code architecture and tech debt

The single most valuable change is to split the game into a pure core that runs without a browser and a browser shell around it. Online play needs that split: the server must replay raids and check saves with the same rules the client uses. Everything below either makes that split possible or gets cheaper after it.

| Debt | Where | Why it matters next | Fix | Size |
| --- | --- | --- | --- | --- |
| One 1,283-line raid module | `src/raid.js` | Map generation, combat, enemy AI, bosses, loot and the raid end share one file and one global `R` | Split into `raid/gen.js` (pure: seed → map), `combat.js`, `ai.js`, `bosses.js`, `companions.js`, `loot.js`, `end.js`; keep `R` and its setters in `raid/state.js` | L |
| No pure core | Game rules call `$()`, `msg()`, `sfx()` and `save()` directly | The server can't run rules that touch the DOM; tests need a whole browser | Rules return results and events; only the shell draws, plays sound and saves. `layEgg()` (Phase 8) is the pattern: `breed()` became a thin shell around it | L |
| 818 exports copied onto `window` | `src/main.js` | Name clashes have already bitten (`noise`, `act`); it also hands cheaters every function | One explicit test API, `window.gs`, built only in test and dev builds | M |
| 44 two-way import cycles | e.g. `state` ↔ `jobs`, `raid` ↔ `draw`, `hideout` ↔ `state` | Load order bugs, and a module can't be lifted out on its own | Layers that only import downward (diagram below), enforced with the `import/no-cycle` lint rule | M |
| `endRaid` calls ten systems | Lore, playtest, contracts, demo, telemetry, market, titles, trophies | Every new feature edits the raid end | A small event bus: `emit('raid:end', report)`, with each system subscribing | S |
| One `act()` switch for every button | `src/ui.js` | Every feature edits one switch; it's the source of the `act` name clash | Each UI module registers its own actions: `actions.register('evolve', fn)` | S |
| Whole-page redraws | `renderAll()` after almost every action | Scroll jumps and wasted work; it will get worse with creature pages | Redraw only the panel that changed (`renderPanel(id)`), keep scroll and focus | M |
| 98 inline `style=` attributes | UI template strings | Theming, colour-blind palettes and text size can't reach them | Move them to CSS classes | S |
| Data has no schema | `src/data/*.json` | A typo in a key fails silently; the perk table adds hundreds of references | A JSON Schema per file and a test that checks every cross-reference (each species has a Codex entry and perks; each perk id exists) | M |
| Untyped core | All modules | Larger refactors are risky without types | `// @ts-check` and JSDoc types on the core modules first; no build change needed | M |
| Device settings inside the save | `S.opts` | Online sync would copy one phone's joystick size to every device | Keep `opts` per device in local storage; sync only game state | S |

Size: S is about a day, M a few days, L a week or more.

*(Diagram: target code layers · 4 layers, imports only downward.)*

The pure core is the layer that matters for online play: the same files run in the phone's browser, in fast Node tests and in the Cloud Function that checks a ranked run. A lint rule refuses any import that points up a layer.

## Preparing for online play

Phase 9 adds accounts, cloud saves, payments and leaderboards. The game is in better shape for this than most single-player games: saves are versioned with migrations, gameplay randomness is seeded, and the Exchange already talks in messages. The gaps are below, roughly in the order they bite.

### Accounts and cloud saves

- **Sign in late, play first.** Start every player with Firebase anonymous auth so the demo and the first raids need no account. Offer Google sign-in when there's something to lose (first Apex creature, or the purchase) and link the anonymous account so nothing resets.
- **Saves fit easily.** Measured with the Journey Simulator: a fresh save is 8.4 KB, a breeder's save at day 90 is 58.7 KB (creatures 29.5 KB for 40 creatures, family tree 8.9 KB, log 7.4 KB, memorial 6.6 KB) and a raider's is 52.2 KB. Firestore's document limit is 1 MiB, so one document per player works for years of play. Trim the log to its last 200 lines and the memorial to its last 100 entries in the cloud copy, and gzip only if a save ever passes 300 KB.
- **Conflicts.** Add a `gen` counter to the save that goes up on every write. The cloud write is a transaction that refuses a lower or equal `gen`. When two phones disagree, show both (day, Keeper rank, creature count, last played) and let the player pick; never merge silently.
- **Backups.** Keep the last 5 cloud versions in a subcollection, written at most once an hour, so a bad migration or a mistaken pick can be undone from Settings.
- **Device settings stay local.** `S.opts` (joystick size, render scale, palette, sound) moves out of the save into local storage, as noted in the code section.
- **One migration path.** The server-side checks below run the same `migrate()` from the pure core, so a v13 save uploaded from an old cached build is upgraded the same way on both sides.

### Offline and installing

- A service worker that caches `index.html` and the data files turns the game into an installable PWA. The bundle is one file already, which makes this small.
- Play works offline; saves queue and sync on reconnect, with the `gen` rule above deciding conflicts.
- A version file next to the bundle lets an open game notice a new release and offer to reload between raids, never mid-raid.

### Paying for the game

- Keep the no-premium-currency rule: one purchase unlocks the full game, later expansions are separate unlocks.
- The demo already plays on the same save format. The unlock must keep that save: flip an `entitlements` field on the account, never a separate save.
- Entitlements live in a document only the server writes (a Cloud Function called by the payment provider's webhook). The client reads it and never writes it.

### Runs the server can trust

Only things other players see need checking: leaderboards, Deepening scores, Fresh Season ladders and, later, Exchange trades between players. A cheated private save hurts nobody, so the private game stays fully client-side.

- **Replay, don't trust.** A ranked run uploads its seed, the build version and an input log (stick and button states per fixed tick). A Cloud Function replays it with the pure core and accepts the score the replay produces, not the one the client claims.
- **This needs two code changes.** Raids must step on a fixed timestep (today `update(dt)` takes the frame's real `dt`), and the raid rules must run without the DOM. Both are part of the pure-core split in the code section.
- **Cheap checks first.** Before replays exist, reject impossible numbers: Renown and Keeper XP per day above what the Journey Simulator's raider ever earns, a Deepening floor reached faster than the floor's minimum clear time, creatures with stats above their genetic ceiling.
- **Don't hand out the tools.** The 818 `window` exports go behind a dev-only `window.gs`; Test Lab and god mode are stripped from the release build.

### Rules and versions

- Firestore security rules: a player reads and writes only their own save; entitlements and leaderboard entries are server-written only.
- Every upload carries the build version; the server refuses versions older than the oldest supported one and asks the client to reload.
- The Exchange engine in `src/exchange/` is already message-based, so a shared market later means moving it behind a Cloud Function, not rewriting it.

## Testing, tooling and performance

The suite is good at what it does: 134 tests in 20 files drive the real game in headless Chromium and fail on any page error. It is also slow (about five minutes) and every test pays for a browser. The perk rework will add many small rules that want fast, direct tests.

| Change | What it gives | Size |
| --- | --- | --- |
| Node unit tests for the pure core | Genetics, perk resolution, work output, migrations and the Exchange run in milliseconds without a browser. Keep the Puppeteer suite for flows and layout. | M (after the core split) |
| Data checks | A JSON Schema per data file plus one test for cross-references: every species has perks, a Codex entry and a sprite; every perk id, trait and station named anywhere exists. | M |
| Layout snapshots at 780 × 360 | A screenshot per raid menu, creature card and creature page, compared against a stored image. Catches overflow and scrolling before Conner's phone does. | M |
| The Journey Simulator as a gate | It already runs in the test suite; add a short version (one seed per style) that runs on every push and the full one nightly, so a perk or price change that moves Act IV off day 55 to 65 fails CI. | S |
| Split CI jobs | Lint, unit tests and browser tests as parallel jobs, with the browser tests sharded across 3 runners. | S |
| A perk lab | A Test Lab page that lists every creature's perks and flaws, their live effect at each station, and the crew total, so balance work doesn't need a raid. | S |

### Performance budgets

Phase 8 added the auto render scale, which handles slow frames on mid-range phones. Two things will grow with the plans in this document and are worth a budget each:

- **Hideout redraws.** Creature pages and perk text make each redraw heavier. Budget: a hideout tab change under 16 ms on a mid-range phone (measure with 4× CPU throttling in Chromium). The `renderPanel(id)` change in the code section is the fix if it goes over.
- **Perk lookups in the raid loop.** Perks that change combat must be folded into each creature's stats when the raid starts, never looked up per frame. A test can assert that `update()` stays under 4 ms at 4× throttling with a full party.
- **Bundle size.** The bundle is one HTML file; keep it under 1.5 MB gzipped so the first load on mobile data stays quick, and lazy-load the lore text if it grows.

## Suggested order of work

The two things Conner asked for come first, because they change how the game feels and testers will notice them. The code work that online play needs comes after, because the perk rework is easier to build before the core is split and easier to check after.

*(Diagram: order of work · 5 steps, 3 checks between them.)*

Each step ends in a build Conner can play on his phone, as every phase does now. The diamonds are the checks that must pass before the next step starts.

| Step | What lands | Needs first | Size |
| --- | --- | --- | --- |
| 1. Groundwork | The event bus for the raid end, the action registry, device options out of the save, the `window.gs` test API, data schemas and the cross-reference test | Nothing | About 1 to 2 weeks (five S and M items) |
| 2. Creature pages | Minimal cards everywhere a creature is listed, the tap-to-open page with its tabs, panel-only redraws, layout snapshots at 780 × 360 | Step 1's action registry and panel redraws make it cleaner, but it can start in parallel | L |
| 3. Perk rework | The perk and flaw table in data, the resolver, discovery, the station screen showing the crew's sum, the save migration and its test, the Perk lab, and the Journey Simulator retuned until Act IV lands on day 55 to 65 again | Step 2, since the page is where perks are read; step 1's schemas, since the table is large | L, the largest step |
| 4. Pure core | `src/raid.js` split, rules that return events instead of touching the DOM, a fixed timestep, Node unit tests, `@ts-check` on the core | Step 3, so the perk resolver is written once, in the core | L |
| 5. Online (Phase 9) | Anonymous then linked accounts, cloud saves with the `gen` rule and backups, the PWA, the unlock purchase, then replay checks for leaderboards | Step 4 for replay checks only | L |

**If online play needs to come sooner,** accounts, cloud saves and the PWA need only step 1 (device options out of the save). They can move ahead of steps 2 to 4; only the replay checks for leaderboards have to wait for the pure core.

## Risks and open questions for Conner

### Risks

| Risk | Why it could happen | What keeps it small |
| --- | --- | --- |
| Balance gets much harder | Six perk sources across every species, trait and personality is far more to tune than five thresholds per station | Effects come from one closed list; the Perk lab shows every number; the Journey Simulator runs on every push and fails if Act IV leaves day 55 to 65 |
| Flaws make creatures feel bad to own | A player benches every creature with a red line and the roster shrinks to a few "clean" ones | Every flaw is scoped (it hurts somewhere, not everywhere) and paired with a perk; no creature has more flaws than perks; species flaws are mild and the strong ones are earned and can fade |
| Too much on a small screen | Perks, flaws, genes, history and lore all want room at 780 × 360 | Cards stay minimal; the page splits into tabs; layout snapshots catch overflow before release |
| The migration surprises players | A favourite worker's output drops after the update | Perks are derived, not rolled; a one-time "what changed" screen lists each station's output before and after; the test loads a real v14 save and checks no station loses more than 15% |
| The pace moves during the playtest | The perk rework lands while testers are mid-journey | Run the closed playtest on today's build, or start it after step 3, never across it |
| The core split breaks things quietly | Moving 1,283 lines of raid code touches every system | Move one piece at a time with the full suite green between moves; the doors, seed and parity tests already pin the behaviour that matters |

### Decisions only Conner can make

1. **How many perks per creature?** The doc proposes 2 or 3 perks and 1 or 2 flaws for most creatures. Fewer is easier to read and balance; more gives more stories.
2. **Can flaws be fixed?** The proposal: species and personality flaws are permanent, earned flaws can fade (for example, a new earned flaw such as Skittish could fade after 10 calm raids). Or should some be curable at the Apothecary, as a reason to use it?
3. **Should some hideout features belong to creatures instead of buildings?** For example, the Roost's sparkle on hidden doors could come from a Gale creature with a "Keen-eyed" perk working there, instead of from Roost level 3.
4. **How much should be hidden?** The doc hides latent and trait perks until they're found. Some players love discovering them; others will want to plan from the catch screen.
5. **Do earned perks pass to offspring?** The proposal is a 15% chance of a weaker "instinct". Making them never pass keeps a creature's history its own; making them pass more often makes breeding stronger still.
6. **Pages and perks first, or online first?** The suggested order puts the two asked-for changes first. Accounts and cloud saves could move ahead if getting the paid version out sooner matters more.
7. **TypeScript?** JSDoc types with `@ts-check` give most of the safety with no build change. A full move to TypeScript is cleaner long-term but touches every file.
8. **Hideout navigation.** With seven tabs on the left rail plus creature pages, is the rail still the right shape, or should Creatures become the home screen of the hideout?
