# GeneSling 1.0 — The Vision

> Exported from the GeneSling Claude doc (https://claude.ai/code/artifact/95b7ea62-89cc-46ac-aa39-e7963b245ec1) on 2026-10-02. This repo copy is the working reference for development; keep it updated when the design changes.

Oct 2, 2026 · @Conner Rittenhouse

## The pitch

**Catch it in the Bloom. Cut it free. Breed something the Bloom can never take back.**

GeneSling 1.0 is a browser roguelite where every run is a heist. You dive into a living dungeon with a gun, three creatures and a bag of cages. You fight through bullet-pattern rooms, weaken wild creatures and cage them. Then you choose the moment to run for an extraction point. Die inside and the Bloom keeps everything you brought: your loot, your catch and the companions you raised.

What you carry out builds a life above ground. Creatures are bred into lineages you design, gene by gene. They are posted to a hideout you lay out room by room. They produce goods you craft and trade on a living market. And slowly they show you what the Bloom is, and why it is afraid of everything that leaves.

### The fantasy in one line

Enter the Gungeon's hands, Palworld's creatures, Tarkov's stakes, and a breeder's patience.

### Six pillars

Every feature in this document has to serve at least one pillar. If it serves none, it is cut.

1. **Stakes you feel.** Nothing is safe until it is extracted. Loss is real but never total: the hideout, lineages and knowledge always survive.
2. **Genetics is the long game.** The dungeon is the gene pool and the hideout is the lab. The best creatures in the game are bred, not caught.
3. **Every creature has a job.** No creature is filler. Each one fights, works, guards, scouts or breeds, and its genes decide how well.
4. **Make it, sell it, own it.** Players produce real goods with their own maker's mark. Prices come from supply and demand, not a fixed shop table.
5. **A world that whispers.** The lore is a mystery told in fragments over months. Curious players are rewarded for digging; others can ignore it and still play.
6. **Pride of creation.** A player's creatures and hideout should be worth showing off, with lineages, rare looks, titles and rooms people want to visit.

### What 1.0 is not

- Not a gacha game. There is no premium currency and no paying to skip breeding or loss.
- Not a grind for its own sake. Every repeated raid should push at least one goal forward: a gene, a good, a lore fragment or a rank.
- Not multiplayer at launch. The economy, leaderboards and hideout visits are built so real players can be added later without redesigning anything.

## The 90-day journey

A dedicated player reaches the top of the game in about 90 days. That means roughly 1.5 hours a day, about 135 hours and 550 raids in total. A casual player at 30 minutes a day reaches the Heart in about six months, and nothing important is locked behind a timer they can't catch up on.

The journey runs in four acts. Each act ends in a gate that needs three kinds of progress at once: a boss kill (skill), a Keeper rank (time played) and a creature or hideout requirement (genetics and building). No one kind of progress can carry a player through alone.

| Act | Days | Keeper rank | What opens up | Gate to the next act |
| --- | --- | --- | --- | --- |
| I · Scavenger | 1 to 7 | 1 to 10 | Tutorial, the Rootworks (floors 1 to 3) and the first boss; the 7 original types; first breeding pairs; stations at tier 1 to 2 | Beat a Rootworks boss · Keeper rank 10 · 3 stations at tier 2 |
| II · Keeper | 8 to 30 | 10 to 25 | Vein choice (floors 4 to 6); Sequencer and Gene Lens; the Exchange and contracts; production chains, expeditions, hideout builder | Beat bosses in 2 veins · Keeper rank 25 · a Gen 3 cut-free creature |
| III · Breeder | 31 to 60 | 25 to 40 | The Underheart (floors 7 to 9), cut-free only; Lumen type; Splicer, Mutation Lab, stable hybrids, shows; Masterwork crafting | Free Ilsa on Floor 9 · Keeper rank 40 · a cut-free party of three |
| IV · Apex | 61 to 90 | 40 to 50 | The Heart and the ending choice; Unbound tiers 1 to 20; Bloomlords; Apex Chamber; Renown ladders | (top of the game) |

Each gate needs a boss, a rank and a creature or hideout goal, so skill, time and breeding all have to keep pace.

### How the pace is held

- **Raids drive the clock.** The hideout day advances once per raid, as it does in the prototype. Production, healing, egg incubation and growth all run on raids, not wall-clock time, so playing more is always faster.
- **Generations are the real speed limit.** An egg hatches in 2 to 4 hideout days, and a creature can breed at Lv 10. One generation takes about 8 raids. An apex genome needs about 10 to 14 selected generations, and that is where the 90 days go.
- **Daily and weekly beats keep people returning without punishing absence.** Contracts refresh daily, the Exchange restocks daily and the Deepening challenge changes weekly. Missed contracts bank up to 3 days.
- **Keeper rank curve.** Ranks 1 to 10 come in the first week. Each later rank costs more, so rank 40 lands around day 60 and rank 50 around day 90 for a dedicated player.
- **Catch-up.** A player who falls behind earns double Keeper XP until they're within 5 ranks of the week's expected rank.

## The core loop

One loop turns everything: raid, extract, breed, post, produce, trade, and back into the Bloom better equipped. Each step feeds the next, and the dungeon stays the only source of new genes, raw materials and lore.

**Raid → Extract → Breed → Post → Produce → Trade → back to Raid.** The Bloom is the only gene pool, the hideout is the only factory, and the Exchange connects the two.

### What a session looks like

1. **Plan (2 min).** Check the Contract Board and the Exchange. Pick a vein, a contract and a loadout of three creatures, plus weapons, cages and a crafted map if you have one.
2. **Raid (8 to 15 min).** Fight room by room. Weaken and cage wild creatures. Read the room twists, take or refuse shrine pacts, and decide when your bag is full enough to run.
3. **Extract or lose it.** Reach a rift, gate or cliff and hold the circle. Fail and the Bloom keeps your loadout, except what the Vault protects.
4. **Hideout (3 to 5 min).** The day advances. Workers produce, eggs incubate, creatures heal. Scan new catches' genomes, pair breeders, post workers and craft.
5. **Trade (1 to 2 min).** Sell surplus, fill buy orders for what your next plan needs, and post creatures or eggs with good genes.

### Raid controls on a phone

For now the game is laid out for an Android phone held sideways (a Galaxy S23 is about 780 × 360). On phones a raid goes full screen and turns the screen sideways where the browser allows it.

- **Move** with the stick at the bottom left and **attack** with the stick at the bottom right.
- **Skill 1 and Skill 2** (the two combat companions' abilities) sit above the attack stick, with the **combo** above them when it's ready. A large **Catch** button sits left of the attack stick, with **Roll** above it.
- The **minimap** and the **menu** (⚙) sit at the top right. Opening the menu pauses the raid. It holds the **backpack** (everything carried, bag slots, prints, buffs and pacts), the **creatures** (both combat slots and slot 3: swap slot 3 into combat, or release), the **weapons** (both slots with quality and durability, and switching), and settings (abandon, sound, full screen).
- **Releasing a creature** frees its slot for a better catch. It turns wild in the same room and attacks you, and you can weaken and catch it again. A creature from your roster that isn't caught again before the raid ends is gone for good, so the menu warns first. Nothing can be released in the tutorial, and in the arena only creatures caught there.
- Left-handed mode mirrors the controls. Stick and button sizes are in Settings.

### Why the loop holds

- **The Bloom is the only gene pool.** New alleles, mutations and rare traits only enter the game through wild catches. Even a master breeder keeps raiding.
- **The hideout is the only factory.** Raids bring raw materials, and only posted creatures turn them into goods. Even a raid-only player needs workers.
- **The market connects the two.** A player who loves fighting can sell raw catches and loot. A player who loves breeding can buy them. Both progress.

## Genetics

Every creature carries a real genome of 15 loci, two alleles each, and every stat, skill, job and look it has comes from that genome. Wild catches bring raw genetic variety. Breeding sorts it into something better. The best creatures in the game are about 12 generations from the wild.

### The genome

| Locus group | Loci | Alleles | What it decides |
| --- | --- | --- | --- |
| Combat stats | Power, Vigor, Swift, Tempo, Focus, Grit | Grade 1 to 10, plus Apex 11 from mutation only | Attack, HP, move speed, attack speed, ability cooldown and crits, damage resistance |
| Work stats | Knack, Yield | Grade 1 to 10 | Quality and quantity of what the creature produces when posted |
| Traits | 3 trait slots | Dominant or recessive, about 45 traits at launch | Combat, work, breeding and hideout perks, such as Ricochet, Artisan, Twin Eggs and Night Owl |
| Looks | Hue, Pattern, Size | 8 hues per species; spots, stripes, ombre, rings or runes; small to huge | Appearance; size also nudges HP and hitbox |
| Rarity | Shine | Normal, Prismatic (recessive), Bloomscar (mutation only) | The showpiece colorings players chase |

### How inheritance works

- **Each parent passes one allele per locus**, picked at random. A creature's stat shows 60% of its better allele plus 40% of its worse one, so both copies matter.
- **The mother decides species and type**, as in the prototype. **The father weighs stats.** He passes his better allele 65% of the time instead of 50%.
- **Recessive traits hide.** A recessive trait only shows when both copies carry it. Carriers look normal, so two plain parents can hatch a surprise.
- **Personality** comes from the mother 50% of the time, the father 30% and at random 20%.

### Mutation, the only way past the ceiling

Each locus has a 1.5% chance to mutate per egg. Most mutations nudge a grade up or down by 1. Some create a new trait, and a few create a defect such as Brittle or Short-lived. Apex alleles (grade 11) and Bloomscar shine only appear through mutation.

The chance rises with a Gen 0 wild parent (Bloomblood, +1%), Crystal creatures posted in the Mutation Lab (up to +2%) and crafted serums (+1% for one egg). Breeding with fresh wild catches is a deliberate gamble: more mutations, but wild genes drag grades down.

### Lineage

- **Generations.** Wild catches are Gen 0, and each hideout-born generation adds one. Every creature keeps a family tree five generations deep.
- **Inbreeding has a cost.** A shared ancestor within two generations gives a 25% chance of a defect. The fix is outcrossing with a new wild catch, which sends breeders back into the Bloom.
- **Cut-free creatures.** At Gen 3 a line is cut free. The Bloom can no longer pull on it, which matters in the Heart veins (see Lore), and it gains one bonus trait slot on its final evolution.
- **Pedigree.** Five straight generations of one species earn the line a Pedigree title, shown on its card and on the Exchange.

### Hybrids

18 hybrids launch, up from the prototype's 7. Recipes are found, not listed: a codex slot shows a silhouette and a riddle. A first-generation hybrid's eggs revert to a parent species half the time. A hybrid line bred true for three generations becomes stable and always breeds true.

### Tools that unlock the genome

| Act | Tool | What the player can see or do |
| --- | --- | --- |
| I | Keeper's eye | Star ratings only |
| II | Sequencer (Archive) | Exact expressed grades for every locus |
| II | Gene Lens (posted Echo creature) | Both alleles, including hidden recessive carriers |
| III | Splicer (Lab) | Move one allele from a donor to a recipient. The donor is consumed. |
| III | Mutation Lab (posted Crystal creatures) | Raise mutation odds |
| IV | Apex Chamber | Breed two Apex-carrying creatures with a guaranteed allele pass on one chosen locus |

### The long chase

An **Apex genome** has every combat stat at 10 or higher on both alleles. At the start of Act IV a top breeder has one or two. Players who chase a Prismatic, Apex, Pedigree, cut-free hybrid are chasing the rarest object in the game, and every one of them is different.

### Genetics 2.0 as built (Phase 1)

Decisions made while building, so the design and the code agree. Numbers live in `src/data/genetics.json`.

- **Fifteen loci.** The six combat stats, two work stats, three trait slots, hue, pattern, size and shine. A fourth trait slot (below) is carried by every creature but only shows on a cut-free final form.
- **The v5 genes map across.** Haste became Tempo and Temper became Focus, which now covers obedience as well as ability recharge and crits. Grit and Focus are neutral at grade 5. Knack and Yield are inherited now and start doing work in Phase 2.
- **Dominance of looks.** Hue: the lower hue number wins, so the species' natural color (hue 0) beats every other hue. Pattern: any pattern beats Plain, and between two patterns the earlier one in the list shows (spots, stripes, ombre, rings, runes), so Runes is the most recessive. Size blends (the average, rounded up). Prismatic needs two copies; Bloomscar shows with one.
- **Traits.** 20 traits at the end of Phase 1: the 16 from v5 (each now marked dominant or recessive) plus Twin Eggs (a mother's clutch is two eggs 25% of the time), Strong Blood (passes its better stat copy 75% of the time), Ricochet (shots bounce once) and Thrifty (eats nothing on days it works). The negative traits and defects are recessive. Defects: Brittle (takes 20% more damage) and Short-lived (can breed only twice).
- **Mutation.** 1.5% per locus per egg, +1% with a Gen 0 parent, +0.5% each from the first breeding research node and Nursery tier 4. A mutated stat moves one grade up or down; Apex 11 is reached only by mutating a 10, and only on combat stats. A mutated trait slot gains a new trait (80%) or a defect (20%). Shine mutates to Prismatic, or to Bloomscar a quarter of the time.
- **Inbreeding** means the two parents share an ancestor among themselves and their own parents (the child's parents and grandparents). The egg then has a 25% chance of a defect in both copies of one trait slot.
- **Fourth trait slot.** When a cut-free creature reaches its final form it rolls one positive trait into its fourth slot. Its children inherit the slot, but it only shows on their own cut-free final forms.
- **Pedigree** counts consecutive generations in which both parents were the creature's own species.
- **Tools.** Until the act structure exists, the Sequencer turns on when Dr. Sorrel arrives (Keeper rank 4 or a working Nursery), and the Gene Lens whenever an Echo creature is posted in the Roost.
- **Wild genes.** Wild alleles roll a grade range that rises with depth, with a small chance of a 10 that also rises with depth (8% by floor 6). The rest of the way to 10, and everything past it, comes from breeding and mutation.
- **The pace check.** The Test Lab simulator models a focused breeder with a Gene Lens: 6 eggs a generation, keeping the best 3 of 8 wild creatures met each generation, and a pool of 12. It reaches an Apex genome in a median of 13 generations, inside the 10 to 14 target. About 1 run in 10 takes past 40 generations; those breeders stall waiting for one missing locus.

## Every creature matters

In the midgame a player owns 20 to 40 creatures and has roughly 20 jobs to fill. Every good creature is wanted in at least two places at once, so every posting is a trade-off. Each creature can do five jobs: **fight, work, guard, scout or breed**. Its genome decides how well it does each one.

### The choice, in one example

Marlowe is a Tide with Swift 9/9, Yield 7 and the trait Tireless. This week she can:

- Go on raids as a **Medic**, healing the party 4% a second during her ability.
- Work the **Spring**, healing every creature at home fully and adding bond to all of them each day.
- Go into the **breeding pen** to pass her Swift 9 allele to a Gale line that needs it.
- Lead a **Roost expedition** to the Drowned Galleries, which needs a Tide to get through.

She can only do one. Whatever the player picks, the other three jobs get a weaker creature.

### Raid roles

Each evolution line has a raid role on top of its type. Three companion slots and six roles mean no loadout covers everything.

| Role | What it does in a raid |
| --- | --- |
| Striker | Highest damage; its combo hits hardest |
| Bulwark | Taunts, blocks shots, and shields the player |
| Medic | Heals the player and companions |
| Scout | Reveals the map, secret rooms and rare spawns |
| Hauler | +4 bag slots per Hauler. The base bag is 12 slots, so loot space is a real choice. |
| Catcher | Wider cage radius and better catch odds on weakened wilds |

### Hideout postings that read like a team sheet

- **Few slots, real effects.** A midgame station holds 3 to 5 creatures. Each posting shows its exact contribution, worked out from the creature's genes, such as "+3.4 spore silk a day (Yield 7, Fungal match)." A creature of the wrong type works at half rate.
- **Foremen.** The posted creature with the highest Focus becomes foreman and doubles one of its traits for the whole station.
- **Crew chemistry.** Certain pairs work better together. A Fungal and a Tide in the Garden makes Irrigation, +25% food. Clashing personalities, such as Brave with Timid, cost 10%.
- **Fatigue.** Working creatures tire. Without rest days or a comfortable hideout (see Pride), output falls by up to 40%. Rotating a bench of creatures beats always posting the same five.

### Jobs for the bench

- **Expeditions.** The Roost sends teams of three on offscreen trips lasting 2 to 5 hideout days. They bring back materials, eggs, lore rubbings and maps. Normal expeditions can injure but never kill. Perilous ones can kill and pay much better.
- **Tutoring.** A high-level creature in the Training Grounds levels young ones faster. It also teaches them a learned technique, a skill that isn't genetic and has to be passed from creature to creature.
- **Vein keys.** Some veins need certain types to enter or get through: Tide for flooded lanes, Echo to see in the Hollow Choir, Gale for cliff routes. A narrow roster closes off parts of the dungeon.

### Loss that hurts but builds

When a creature dies, its station meter drops and its job goes unfilled. That should sting. Its legacy carries on: its closest bred descendant inherits 25% of its bond, and it joins the Memorial wall with its titles and raid count. Lineages make loss part of a family story instead of a delete button.

## Production

Players make nearly everything they use, and much of what other players need. Raids bring raw materials, posted creatures refine them, and the player crafts finished goods that carry the player's maker's mark. There are nine stations, one per creature type, and each one turns a creature's Yield and Knack genes into goods.

### Stations

| Station | Type | Takes in | Makes |
| --- | --- | --- | --- |
| Forge | Ember | Ore, coal | Ingots, weapons, cage frames, tools |
| Garden | Fungal | Seeds, compost | Food, herbs, spore silk |
| Spring | Tide | Brine, herbs | Tonics, healing, bond |
| Roost | Echo | Teams of creatures | Expeditions, vein maps, lore rubbings |
| Loom | Gale | Spore silk, hide | Cloth, bags, harnesses, banners |
| Kiln | Crystal | Crystal dust, sand | Glass, lenses, crystal cages, Mutation Lab |
| Bastion | Warden | Stone, ingots | Building materials, hideout expansions, armor |
| Apothecary | Venom (new) | Bog sap, herbs | Serums, poison ammo, gene tonics |
| Archive | Lumen (new) | Rubbings, relics | Research, rune translation, blueprints |

### Production chains

Goods move through four steps. Each step is a decision about whether to sell now or add value first.

1. **Raw**, from raids and expeditions: ore, bog sap, crystal dust, hide, relics.
2. **Refined**, from posted creatures over hideout days: ingots, cloth, glass, tonic base.
3. **Components**, crafted by the player: barrels, cage cores, lenses, bag frames.
4. **Finished goods**: weapons, cages, bags, armor, charms, serums, vein maps, harnesses, decor, and eggs.

### Quality and the maker's mark

Every crafted item rolls one of five quality tiers: Crude, Fine, Superior, Masterwork or Legendary. The roll depends on the station's average Knack, the foreman's trait and the player's mastery of that recipe. Mastery rises each time a recipe is crafted, so players become known for something, such as the best bags or the best crystal cages.

Finer goods keep the maker's name and the name of the foreman creature, for example "Masterwork Ember Carbine, made by Conner with Pyrrovex." Weapons roll 2 to 4 affixes, so two Masterwork carbines are rarely the same.

### Blueprints

Blueprints come from raids, NPC quests and research. Most are permanent unlocks. Rare **single-use prints** can be crafted once and are traded on the Exchange, which gives explorers something valuable to sell to crafters.

### What keeps production needed

- Weapons, armor and bags lose durability and need repair materials.
- Cages are used up on every catch.
- Every creature eats food each day, and a larger roster costs more to feed.
- Everything carried into a raid can be lost there. That is the biggest sink in the game and the reason demand for crafted goods never dries up.

### Jobs and production as built (Phase 2)

Decisions made while building, so the design and the code agree. Every number lives in `src/data/jobs.json`.

- **Stations are the v5 sections.** The eight hideout sections keep their tiers and perks. Five of them also produce each day: the Forge smelts 2 ore into an ingot, the Garden grows food, herbs and spore silk, the Spring brews 2 herbs into a tonic, the Vault fires 2 crystal dust into glass, and the War Room weaves hide and silk into cloth. The Roost runs expeditions, the Nursery incubates eggs and the Training Grounds train. The Loom, Kiln and Bastion from the station table are covered by the War Room, Vault and Nursery until the hideout builder; the Apothecary arrived with the Venom type in Phase 5, and the Archive waits for Lumen.
- **Exact contributions.** A worker adds (0.5 + 0.1 × Yield) work units a day, times type match (1 for its type, 0.8 as a hybrid's second type, 0.5 off type), +2% per level, +10% per evolution, ×1.5 for Hard Worker, and up to −40% for fatigue. Every posting shows its number, and the add-creature list shows what each candidate would add and what it would leave short elsewhere. The tier meters still use the v5 points formula, with Yield in place of the old per-section gene.
- **Foreman** is the posted creature with the highest Focus. Its work traits (Hard Worker, Thrifty, Artisan, Tireless) apply to everyone at the station.
- **Chemistry pairs**: Fungal + Tide in the Garden (Irrigation, +25%), Ember + Gale at the Forge (Bellows, +20%), Crystal + Ember at the Vault (Kiln heat, +20%), Gale + Fungal in the War Room (Silk lines, +20%), Tide + Fungal at the Spring (Herbal baths, +20%). **Clashes**: Brave with Timid, Fierce with Calm, Greedy with Loyal, −10% each, at most −30%.
- **Fatigue** rises 12 a day at a station (6 if Tireless) and 8 on an expedition, and falls 30 on a day off. At 100 a worker produces 40% less. Comfort (from Pride) cuts the rise by up to 20%.
- **Upkeep and the roster cap.** Every creature eats 1 food a day, trainees 2, and Thrifty workers nothing. The pens hold 16 creatures, plus 4 per pen built (up to 6 pens; each costs coin, ingots and cloth). Over the cap you can't raid or breed until you sell or build.
- **Production chain.** Raw (ore, hide, crystal dust, food) → refined at stations (ingots, herbs, silk, cloth, glass, tonics) → components at the Workshop (weapon parts, cage cores, bag frames, lenses) → finished goods (weapons, cages, gilded cages, satchels). Weapons now cost weapon parts and coin instead of ore.
- **Quality** is rolled from the station's average Knack, recipe mastery (+0.75 per mastery level at 5, 15, 30 and 60 crafts), +1.5 for an Artisan and +2 from a print, plus a random 0 to 4. Crude / Fine / Superior / Masterwork / Legendary give weapons ×1 / 1.05 / 1.1 / 1.15 / 1.25 damage and 6 / 8 / 10 / 13 / 18 raids of durability; satchels give +2 to +6 bag slots. Superior and better keep the maker's name (set in Settings) and the foreman's form. Weapon affixes are left for later.
- **Durability.** Weapons and satchels lose 1 durability per raid and can't be taken out when broken. Repairs cost half an ingot (weapons) or half a cloth (satchels) per point. The Scav Pistol never breaks or gets lost. Weapons found in raids come home Crude or Fine and part worn.
- **Prints** drop from 6% of chests and half of bosses, take a bag slot, and forge their gun once with no blueprint or Forge tier needed.
- **Raid roles** come from the evolution line's species (three per type). Striker: +20% damage, its combos +30%. Bulwark: +25% HP, and you take 15% less damage while it fights within 140 px. Medic: heals you and the party 0.8% a second, 4% a second for 3 seconds after its ability. Scout: reveals the map, secret rooms and rare creatures. Hauler: +4 bag slots. Catcher: +30% cage radius and +10% catch chance. Combat roles work while that companion is standing; Scout, Hauler and Catcher work from any slot.
- **The bag** has 12 slots, each holding 10 of one material or one print. Coin and the weapons in hand need no room. When it's full, loot is left behind.
- **Tonics**: carry up to 3; one is drunk automatically at 25% HP and heals 40%.
- **Expeditions** (Roost tier 1 and up) send three creatures for 2 to 5 days to one of four places, two of which need a particular type. Haul grows with the team's level and Swift. Normal trips can injure (half HP) but never kill; perilous trips come later.
- **Death legacy.** The closest bred descendant (child first, then grandchild) inherits 25% of the fallen creature's bond. The Memorial wall keeps every fallen creature with its titles, raid count and heir.
- **Supply check.** The Test Lab's supply sandbox plays a week for a 25-creature hideout raiding once a day, once buying everything and once staffing the stations and crafting. Both stay supplied (no hunger, full cages every raid, no broken weapon taken out). The raid-only run spends most of its coin on food; the craft-heavy run ends the week far richer.

## The player economy

All trade goes through the **Exchange**, a real market of buy and sell orders whose prices come from supply and demand. At launch the other side of each trade is a population of simulated traders who raid, craft, breed, consume and lose goods like players do. A solo player gets a market that behaves like a live one. When real players arrive, they join the same market.

### How the Exchange works

- **Commodities** (ore, cloth, food, cages, tonics) trade on an order book. Players post buy or sell orders at a price, and matching orders fill on the next hideout day.
- **Unique goods** (creatures, eggs, crafted weapons, single-use prints) are listed as auctions with an optional buyout. A creature's listing shows its genome, as far as the seller has sequenced it, plus its lineage and titles.
- **Bounties** are standing requests from traders, such as "Wanted: Gale, Swift 8 or higher, Prismatic, 2,400 coin." They create demand for specific genetics, and they're the breeder's version of a raid contract.
- **One currency.** Coin is the only money. There is no premium currency.
- **Fees.** Posting an order costs 2%, and each sale pays 5% tax. Both remove coin from the game.

### The simulated traders

About 60 traders populate the solo market. Each has an archetype, a budget, an inventory, needs and a belief about what each item is worth. That belief moves after every trade they make or miss.

| Archetype | Produces | Consumes | Behavior |
| --- | --- | --- | --- |
| Raider | Raw materials, wild catches | Weapons, cages, tonics | Sells cheap after a good haul; loses gear when it dies offscreen |
| Smith | Weapons, armor, tools | Ore, coal, cloth | Buys raw materials in bulk and undercuts on Fine goods |
| Breeder | Eggs, bred creatures | Wild catches, food, serums | Posts genetic bounties and pays well for rare alleles |
| Collector | Nothing | Rare looks, Pedigree lines, relics | Bids high for showpieces and sets the top of the creature market |
| Speculator | Nothing | Anything underpriced | Buys dips and sells spikes, which keeps prices tight |
| Quartermaster | Food, basic cages | Coin | Market maker that keeps basics available at a wide spread |

The world adds shocks. A cave-in in the Ember Abyss cuts ore supply for a week. A Gale migration floods the market with wild Gales. A Keeper's estate sale dumps rare goods. Players who read the news trade better.

### Faucets and sinks

| Coin and goods enter through | Coin and goods leave through |
| --- | --- |
| Raid loot and sold catches | Death losses in raids |
| Creature production | Cages used up, food eaten, durability repaired |
| Contracts and bounties | Exchange fees and sales tax |
| Quest rewards | Hideout upgrades, splicing, serums, decor |

### Testing it solo

The Test Lab gets an Economy Sandbox. It can fast-forward the trader simulation 7, 30 or 90 days, inject or remove supply, and chart the results. Balance targets for 1.0:

- Total coin supply grows less than 3% a week after day 30.
- The price of a standard basket of 20 goods stays within ±15% of its day-30 level.
- A pure raider, a pure crafter and a pure breeder each reach Act III within 10% of the same day.

### The Exchange as built (Phase 3)

Decisions made while building, so the design and the code agree. Every number lives in `src/data/exchange.json`.

- **Sixteen commodities** trade on order books: the raw, refined and component materials from Phase 2 plus basic and gilded cages. **Unique goods** (creatures, eggs, weapons, prints) sell by auction with an optional buyout.
- **Buy now and sell now.** Besides resting limit orders (which fill when a trader meets your price, usually at the next hideout day), you can take the best prices on the book immediately. Basic supplies are always on offer because the Quartermaster keeps standing bids and asks around its reference prices.
- **Fees.** Posting an order costs 2% of its value; every sale pays 5% tax. Traders repost every day, so their 2% is charged when an order fills rather than every time it's posted.
- **Traders.** 60 traders: 20 raiders, 10 smiths, 12 breeders, 6 collectors, 8 speculators and 4 quartermasters. Each believes a price for every good, nudged toward each trade it makes and away from each trade it misses, and posts bids and asks from those beliefs. Production stops when stock piles up, so supply answers price. Traders pay upkeep of 3% of their coin plus 2 a day (their hideouts and living costs), which holds the coin supply steady. The Quartermaster trades with the settlements beyond the Rootworks: its treasury is topped up or skimmed each day, and it ships out what it buys, which is the market's outlet for surplus goods.
- **Auctions** run as proxy bids: each round the highest valuation leads and pays just over the second. Traders value a lot from an appraisal (type rarity, grades, generation, shine, Pedigree, hybrid; weapon tier and quality) times their own belief about that category. Collectors only chase rare looks, Pedigrees, cut-free lines and hybrids.
- **Bounties** are posted by breeders and collectors for a type with a minimum grade in one combat stat, sometimes also a shine. The reward is held by the poster until paid or expired (7 days).
- **Shocks**: a cave-in (ore production −70% for 7 days), a migration (one type's wild creatures flood the auctions for 5 days), an estate sale (six rare lots at low starting bids) and a bumper harvest (food and herbs up). Shocks, big sales and moves of 15% or more in a day go to the news ticker.
- **Keeper rank is time played.** Crafting (by quality), components, hatching eggs, filled orders and paid bounties now earn Keeper XP too, so a crafter or breeder ranks up alongside a raider.
- **The market runs in a background worker** behind a small protocol (`init`, `advance`, `postOrder`, `cancelOrder`, `marketOrder`, `listAuction`, `bid`, `buyout`, `fulfilBounty`, `inject`). The player's coin or goods are escrowed before each request and come back through events. A server can implement the same protocol later.
- **Economy Sandbox** (Test Lab): fast-forwards a copy of your market or a fresh one by 7, 30 or 90 days, with optional supply injected or removed. A model raider, crafter and breeder play the same 72 minutes a day alongside the traders. In 90-day runs across eight seeds, coin supply grew 1.2–1.7% a week after day 30, the basket stayed within 2–11% of its day-30 level, and all three reached Act III on day 29 or 30. Act III for the sandbox means Keeper rank 25, owning a Gen 3 cut-free creature and six weapons' worth of gear.

### Ready for real players

The solo Exchange runs on the same interface a server would use. Going online means moving order matching into Firebase Cloud Functions and validating inventories on the server. Simulated traders stay on as market makers, and their share of trades shrinks as real players take over.

## Dungeon variety

The 1.0 Bloom is ten floors deep and branches into five veins. Each floor is built from a vein, a layout and an event, plus an optional contract and map, so two raids rarely play the same way. The prototype's six floors become the Rootworks plus the first vein.

### The shape of the Bloom

- **Floors 1 to 3, the Rootworks.** The shared entrance, all seven original types, and the first boss.
- **Floors 4 to 6, the veins.** At the bottom of the Rootworks the player picks one of five veins. Each vein has its own look, enemies, creatures, materials and bosses.
- **Floors 7 to 9, the Underheart.** All the veins meet again. Only cut-free creatures can enter, because the Bloom pulls on anything still tethered.
- **Floor 10, the Heart.** The end of the story, and the start of Unbound mode (see Endgame).

### The five veins

| Vein | Floors | Signature twist | Needs | Rich in |
| --- | --- | --- | --- | --- |
| Ember Abyss | 4 to 6 | Lava vents erupt on a beat; burning floors | None | Ore, coal, Ember creatures |
| Drowned Galleries | 4 to 6 | Water rises room by room and seals doors | A Tide to swim flooded lanes | Brine, pearls, Tide creatures |
| Hollow Choir | 4 to 6 | Darkness; enemies hunt by sound, so firing gives away your position | An Echo to see | Relics, rubbings, Echo creatures |
| Glasswind Spires | 4 to 6 | Wind lanes push bullets and bodies; cliff drops between rooms | A Gale for cliff routes | Crystal dust, Gale and Crystal creatures |
| The Sump | 4 to 6 | Poison pools; creatures caught here carry extra mutations | None | Bog sap, Venom creatures, mutated wilds |

Each vein has three bosses that rotate, so 20 bosses launch in total: 3 in the Rootworks, 15 across the veins, 1 guarding the Underheart and the Heart itself.

### Floor layouts

Each floor rolls one of eight layouts, weighted by vein.

| Layout | How it plays |
| --- | --- |
| Warrens | The prototype's room grid; clear rooms and pick your route |
| Labyrinth | Narrow, twisting halls with more secret rooms |
| Gauntlet | A chain of arena rooms; the doors behind you lock |
| Sinkhole | The floor collapses behind you on a timer |
| Flood | Rooms fill and seal over time |
| Nest | One huge room holding a wild colony; a mass-catch event |
| Caravan | Escort a trader to the extract for a large payout |
| Mirror | The layout repeats with shadow copies of your own creatures |

### Events

About one raid in four rolls an event:

- **Migration.** A herd of one rare species passes through.
- **Surge.** The Bloom turns aggressive. Enemies get +30% damage and loot doubles.
- **Lost Keeper.** The echo of a dead Keeper appears. Follow it to a relic, or fight it for its gear.
- **Rival raiders.** Raiders from the simulated market compete for the same extract and can be robbed, or can rob you.
- **Estate cache.** A sealed Keeper camp full of old blueprints.

### Contracts and maps

- **Contracts** are optional goals picked before a raid: extract with a set amount of loot, catch a creature with given genes, escort, deliver, hunt a Warden, or survey a floor. They pay coin, Keeper XP and rare materials.
- **Vein maps** are crafted at the Roost and used up when you raid with them. A map can set a vein's species, raise its wild rate, add loot or make it harder for more reward. Maps are a crafted good, so explorers make them and sell them to breeders who are hunting one species.
- **The Deepening** is one fixed-seed raid each week. Everyone gets the same layout, and scores go on a leaderboard.

### The Bloom as built (Phase 5)

Decisions made while building, so the design and the code agree. Every number lives in `src/data/bloom.json`.

- **Veins.** Floors 1 to 3 are the Rootworks. Beating the Floor 3 boss opens a portal to the five veins; the player picks one for floors 4 to 6. The Drowned Galleries need a Tide, the Hollow Choir an Echo and the Glasswind Spires a Gale in the party (slot 3 counts). Each vein has its own palette, enemies (four new ones each, plus a few deep-dwellers borrowed from the Ember Abyss), wild-type weighting, materials and three rotating bosses. The Rootworks keeps its four.
- **Twists.** The **Ember Abyss**: lava vents in every fight room flash a warning ring, then erupt on a 3.2 s beat for 16 damage and leave burning ground. The **Drowned Galleries**: water rises in every room you've entered; deep water slows you and drowns you (5 HP a second) unless a Tide is standing in your party. The **Hollow Choir**: darkness with a small circle of sight (wider with an Echo), and enemies sleep until they hear you shoot within 430 px or you come within 110 px. The **Glasswind Spires**: each room has a wind lane that pushes you, your companions and every bullet (a Gale cuts the push to a third), and every floor has a cliff extract. **The Sump**: poison pools (7 HP a second; the Apothecary at tier 5 makes you immune), Sump foes drop bog sap, and every creature caught there carries an extra mutation.
- **Layouts.** Warrens (the prototype grid), Labyrinth (four more rooms, fewer foes each, up to two secret rooms), Gauntlet (one chain of rooms; rooms behind you lock once cleared), Sinkhole (rooms you've left collapse after 22 s, never the exits), Flood (the Drowned twist on any vein), Nest (one room holds a colony of 6 to 8 of one species and the floor gives 3 extra cages), Caravan (a trader follows you and pays 220 to 500 coin per floor number if you extract with it alive) and Mirror (some rooms hold uncatchable shadow copies of your companions). Boss floors only use layouts that can hold a boss room. A floor never repeats the layout of the floor above.
- **Events.** One raid in four rolls an event on one of floors 1 to 5: Migration (a herd of 4 to 6 of one rare species), Surge (+30% enemy damage, double coin), Lost Keeper (a strong echo that drops a tier 3 weapon and 2 memory shards), Rival Raiders (three raiders who steal a quarter of your bag's coin if they touch you, and drop it back with their own when beaten) and Estate Cache (a chest with two prints and extra coin).
- **Variety.** Everything about a raid comes from its seed, so a seed replays exactly. A new raid's seed is picked (from up to 400 candidates) so that its Rootworks layouts and event, and each vein's layouts, don't repeat any of the last 20 raids. A raid's combination is its three Rootworks layouts, its vein and that vein's layouts if it went down, and its event.
- **Contracts.** Three offers a day from seven kinds: Haul (extract with coin), Specimen (catch a type), Breeder's order (catch a grade), Hunt (defeat a number of enemies), Warden hunt (beat a lair's elite), Survey (reach a floor) and Delivery (extract with ore). One at a time; it pays coin, Keeper XP and materials on a successful extraction and lapses on a death.
- **Vein maps** are drawn at the Roost (tier 1) in the Workshop: Lure (the vein's types twice as often), Hoard (+50% coin) and Peril (enemies +30% health and damage, +60% coin and Keeper XP). Pick one on the Raid tab; it's used up when you reach its vein.
- **The Venom type.** Three species (Toxlet, Fangmire, Hydravine) with spore-style attacks that poison. Poison ticks longer and lighter than burning; it reacts with burning (Toxic Flare) and soaking (Spreading Blight). Its bond passive, Lingering, doubles its poison. As slot-3 support, your shots sometimes poison. Venom creatures only appear in the Sump until the Apothecary reaches tier 2. A Venom statue in the Hall of Legends brews a serum every few days.
- **The Apothecary** is the ninth station (Venom type). It brews bog sap and herbs into gene serums; a serum raises the weaker copy of a creature's lowest gene by 1, up to 10, from the creature's card. Its tiers: serums, Venom wilds outside the Sump, poison rounds, +25% output, immunity to Sump pools.
- **Content at the end of the phase:** 8 types, 24 base species, 45 enemies (including two that only events spawn), 19 bosses and 32 weapons (eight new: Bog Needler, Harpoon Gun, Choir Lantern, Windbow, Bile Cannon, Slagthrower, Tidebreaker and Venom Fang). Bog sap and serums aren't traded on the Exchange yet.

## Lore

The story is a mystery told in about 150 fragments over the 90 days, and each act asks a bigger question than the last. A player who never reads still knows the Bloom is alive and that Ilsa went missing. A player who reads everything, and cracks the rune cipher, learns what the Bloom is before the game tells them.

### Four questions, one per act

1. **Act I: What happened to Ilsa?** Her journal, her missing creatures, and Mother Bloom wearing her first companion's colors.
2. **Act II: Who were the Old Keepers?** Abandoned camps, forge coals, crowns, and runes that say KEEP IT ASLEEP.
3. **Act III: What is the Bloom?** Sorrel's theory that it is one organism, the song from the deep, and a Keeper's tether scar.
4. **Act IV: What will you do with it?** The Heart, Ilsa, and a choice.

### The truth (designer eyes only)

- Long ago the surface was dying, in what the runes call the Withering. An order of gardeners, the Old Keepers, planted the Bloom as an underground ark. Tethers were meant to protect its creatures: anything that died inside was regrown. That is why the Bloom "wastes nothing."
- The Bloom was meant to release everything once the surface healed. The Old Keepers feared it would never let go. Three of them sang it to sleep and stayed down to keep it asleep. They are the three voices Ilsa hears. Asleep, the Bloom dreams, and its nightmares are the monsters.
- The surface healed long ago. The hideout's green hills are proof. The Bloom is still asleep, lonely and afraid of everything that leaves.
- **The turn:** Keepers carry a faded tether too. Humans were among the life the Bloom sheltered, and the Keepers are their descendants. Ilsa found her own scar in her final entries. That is why she went down.
- **The payoff:** Ilsa is alive on Floor 9, half-sung into the Choir, holding the Bloom asleep in the Old Keepers' place. Freeing her is the Underheart boss fight.

### Three endings

At the Heart the player chooses to **Wake** the Bloom, **Sever** its tether or **Sing** it back to sleep. Each ending changes the hideout's look, gives its own title, and sets the rules of the post-game Unbound Bloom. A second save can pick another ending, so players can see all three.

### How fragments are found

| Channel | About how many | How it's found |
| --- | --- | --- |
| Ilsa's journal | 30 | Keeper rank milestones and pages found deeper in the Bloom |
| Old Keeper relics | 40 | Extracted from raids, then studied in the Archive by a Lumen creature |
| Boss memories | 20 | One per boss on its first kill |
| Codex entries | 1 per form | Rewritten as each creature evolves; the final form tells its Bloom history |
| NPC arcs | 6 characters | Quest chains for Brannoc, Pip and Sorrel, plus three new hideout residents |
| Whispers | 15 | Rare raid moments, about 1 in 200 raids, that never repeat |
| Murals | 8 | Hideout walls that change as the story advances |

### The rune cipher

Old Keeper runes are a real, consistent alphabet, and every rune wall in the Bloom spells out real words. The Archive translates letters slowly through Acts II and III. A sharp player can break the cipher on day one. Some walls give away things the game never says outright, such as a hidden hybrid recipe, a secret room and the name of the third singer. This is the hook for the curious: the game rewards people who take notes.

### Rules for the writing

- Show, then explain much later, or never.
- Every boss was something before the Bloom took it, and its memory says what.
- Nothing is wasted: each fragment answers one small question and raises one new one.

## Pride of creation

Players should look at a creature and think "I made that," then look at their hideout and want someone to see it. Pride comes from three things: looks no one else has, a history the player built, and a place to show both.

### Creatures worth showing

- **Looks from genes.** Hue, pattern, size and shine are inherited, so a rare look is bred, not bought. Each species has 8 hues × 6 patterns × 4 sizes × 3 shines, about 576 looks, and every evolution redraws them on the new body.
- **The family tree.** Every creature's card opens a five-generation tree with names, looks and notable genes. Players will name lines like dog breeders do, such as "the Marlowe line."
- **Breeder's sigil.** Players design a small sigil. Creatures they breed carry it as a faint mark, and Exchange listings show "Bred by" with it.
- **Titles earned, not bought.** A creature earns titles for what it does: Wyrmslayer, Fifty Extracts, Last One Standing, Pedigree, Cut-free. Titles show on its card and in raids.
- **Harnesses and charms.** Crafted gear that changes a creature's look and adds a small stat.
- **Creature cards.** One tap exports a shareable image of the creature with its look, genome summary, titles and lineage. It's made for posting.
- **Hall of Legends.** A veteran can be retired. It leaves the roster, becomes a statue in the hideout with its full record, and grants one small permanent perk. Fallen creatures go on the Memorial wall.

### A hideout that is yours

- **Free building.** The prototype's fixed map becomes a grid where players place stations, dens, paths, gardens and decor. Expansions add new plots up a hillside.
- **Creatures live there.** Posted creatures work at their stations. Off-duty creatures sleep in dens, play and wander the paths, and friends with high bond follow each other around.
- **Comfort.** Decor raises a Comfort score that cuts fatigue and speeds bond. It's capped at +20%, so a purely practical hideout is never punished but a beautiful one is rewarded.
- **Trophies.** Boss trophies, relics and Legendary weapons can be displayed. Each one shows the story of how it was won.
- **Visitors.** Each week an NPC visitor tours the hideout and rates it, adding Renown. Hideout snapshots export as images. Read-only visits to other players' hideouts come with online play.

### Pride as built (Phase 4)

Decisions made while building, so the design and the code agree. Every number lives in `src/data/pride.json`.

- **The grid.** The hideout is 20 tiles across (50 px each) and 7 rows deep, under the cliff and the cave mouth. Stations take 3×2 tiles, the Codex board, dens, benches and fountains 2×1, everything else 1×1. Stations and the board can be moved but never stored. Paths are flooring, so decor can stand on a path but not on other decor. Old saves get a layout that copies the old fixed map.
- **Build mode.** Tap Build under the map, tap a thing to pick it up and tap a tile to set it down (the footprint shows green where it fits, red where it doesn't). Things waiting in stores are placed from the panel below the map. Ordinary taps still open stations, NPCs, the gate and the Codex when build mode is off.
- **Hillside terraces.** Three terraces, each adding 2 rows above the yard: Keeper rank 4 and 400 coin and 40 ore, rank 7 and 900 coin and 10 ingots, rank 10 and 1800 coin, 15 ingots and 10 glass. Clearing one never moves anything already placed.
- **Decor** is made in the Workshop from Phase 2 materials: stone paths (4 at a time), dens, flower beds, lanterns, banners (they fly your sigil), mushroom lamps, benches, crystal totems and fountains.
- **Comfort.** Each decor piece has 0 to 6 points; placed trophies add 2 and statues 3. Each point is +0.5% Comfort, capped at +20% (40 points). Past 4 copies of the same decor, more add nothing, so variety beats a field of lanterns. Comfort cuts how fast workers and expedition teams tire and speeds all bond gains by the same percentage. Dens and paths are practical and add none, so a plain hideout plays exactly as before.
- **Creature life.** Off-duty creatures (idle or in the loadout) sleep in dens at night or when their fatigue is 50 or more, three to a den (the rest sleep in the open), and otherwise play along the paths. Two creatures are friends once they have come home from 3 raids together and both have ★2 bond; off duty, one follows the other. The hideout has its own day and night, a full cycle every four minutes on screen, with lamps lit after dark. It's for show only and never changes the game.
- **Titles.** Wyrmslayer (came home from a raid where a boss fell), Ten Extracts, Fifty Extracts, and Last One Standing (came home when every other companion fell). Pedigree and Cut free show beside them. Titles appear on the creature's card and on its shared image.
- **Trophies.** A boss's trophy comes home with the first raid that beats it and extracts, recording the day, the floor and who was there, and is placed at once. Bosses beaten before Phase 4 become trophies waiting in stores. Legendary weapons can be put on display from the Workshop, and taken down again.
- **Hall of Legends.** A creature with 8 raids home and level 15 or more can retire. It leaves the roster for good, becomes a statue in the hideout, and its type grants a perk: Ember +3% weapon damage, Fungal +1 food a day, Tide 5 more fatigue shed on a day off, Echo +5% Keeper XP from raids, Gale +5 max HP in raids, Crystal +5% coin from extractions, Warden +15 bond for hatchlings. Each type's perk stacks up to 3 times.
- **The breeder's sigil** is designed in Settings (5 shapes, 8 colours, 12 glyphs). Creatures bred from then on carry it as a faint mark on their sprite, and their cards and Exchange listings say "Bred by" with the sigil. It survives selling and buying back.
- **Shareable images.** "Share card" on any creature makes a 640×360 card: the creature, its types and shine, its eight grades as bars, titles, generation and parents, looks, bond, raids and the breeder's sigil. "Snapshot" under the map exports the hideout with a caption. Phones open the share sheet; elsewhere the PNG downloads.

### The demo as built (Phase 4)

- **What it holds.** The Rootworks (floors 1 to 3) and Act I. The portal below the Floor 3 boss stays shut and Keeper rank stops at 10. The Test Lab is hidden. It's built from the same code with one flag (`node build.mjs` writes `dist/demo/index.html`) and published at https://zephyrmaelstrom.github.io/GeneSling/demo/.
- **The end of the demo** is Act I's exit test: beat a Rootworks boss, reach Keeper rank 10 and have 3 stations at tier 2. The first time all three are met, an end screen thanks the player, offers feedback and links the full game. The hideout shows the three goals under the map.
- **The save carries into the full game.** The demo saves under its own name, so it can't overwrite a full-game save on the same site. With no save of its own, the full game loads the demo's.
- **Feedback** is a button in Settings and on the end screen. It goes to Firebase when a project is set in `src/data/firebase.json`, otherwise it opens a prefilled GitHub issue.
- **Play stats are opt-in and anonymous.** The demo asks once, after the tutorial. Events carry a random install id, the day and Keeper rank: `opt_in`, `session_start` (with whether the player is returning after 8 hours or more), `tutorial_done`, `raid_end`, `share` and `demo_complete`. They go to Firestore over its REST API, and only when `src/data/firebase.json` names a project. Nothing is sent from a build without one.

### Shows

Every week the hideout hosts a breeding show with three classes, such as "Best Prismatic Tide" or "Highest Swift Gale under Gen 5." Judging is by formula, so it's fair and can be run solo against the simulated breeders. Ribbons are permanent and appear on the winning creature's card.

## Endgame and the top

The top of GeneSling is measured by **Renown**, earned in four ways: depth, genetics, craft and collection. One number can't be won by grinding a single system. A dedicated player who started on day one should reach the top ladders around day 90, when each season ends.

### Where Renown comes from

| Track | How the top is reached | Renown |
| --- | --- | --- |
| Depth | Clear Unbound tiers 1 to 20 and place on the weekly Deepening | Each new tier and each top-100 finish |
| Genetics | Breed Apex genomes, stable hybrid lines and show winners | Each Apex creature, stable line and ribbon |
| Craft | Sell Masterwork and Legendary goods, and master recipes | Each recipe mastered and each Legendary sold |
| Collection | Complete the codex, find every looks variant and read every lore fragment | Each codex milestone |

### Unbound Bloom

After the Heart, the Bloom re-forms under the rules of the ending the player chose, and its depth becomes 20 Unbound tiers. Each tier adds one permanent rule, such as "enemy bullets split on walls" or "cages fail 25% of the time," and raises rewards. Apex materials, Bloomscar serums and the rarest relics drop only here. Tier 20 is the hardest content in the game and should take the best players their full 90 days.

### Bloomlords

Four optional super-bosses live in Unbound tiers 10 and up. Each one requires a party built to beat it: one hunts by sound and punishes guns, another reflects elements back at their source. They're the reason to keep a deep roster of perfected creatures, not just one perfect team.

### Seasons

- A season lasts 90 days, the same length as the full journey.
- Each season starts a **Fresh Season** ladder: a new hideout and a new save, ranked separately, like a league in Path of Exile. It's optional, and a player's main hideout is never wiped.
- At season end, titles, banners and hideout decor are awarded for ladder placement, and the Fresh Season hideout is merged into the main save as a second plot.
- Each season adds a rule twist and one new hybrid recipe, giving returning players something new to chase.

### The endgame as built (Phase 6)

Decisions made while building, so the design and the code agree. Every number lives in `src/data/endgame.json` (and the Underheart, Heart and Unbound veins in `src/data/bloom.json`).

- **The Underheart (Floors 7 to 9).** Every vein's Floor 6 boss leaves a portal down. Only a party of cut-free creatures (Gen 3 and later, slot 3 included) can take it; the game names anyone still tethered. The Underheart has its own palette, eight enemies (plus three borrowed deep-dwellers), Lumen and other rare wilds, and a twist: every 6 seconds the Choir's song pulls you toward the middle of the room (a Lumen in the party softens it). Chests there may hold Old Keeper relics. The clock gets 5 more minutes.
- **Freeing Ilsa.** The Floor 9 boss is Ilsa, Half-Sung: a choir-bodied fight with tetherlings and Hymn Knights. Beating her frees Ilsa (once), drops relics and opens the portal to the Heart.
- **The Heart (Floor 10)** is one antechamber and the Heart's own room. When it falls, the game asks: **Wake** (wild creatures 60% more common, enemies +10% health afterwards), **Sever** (coin +30%, enemies hit 15% harder) or **Sing** (enemies doze until they hear you, +20% health). Each gives a Keeper title. The Heart can be fought again to choose differently, so one save can see all three.
- **The Lumen type.** Three species (Glimmet, Halowing, Solaryx) found only in the Underheart and the Unbound Bloom. Its element, glare, dazzles (a short stun) and reacts with static (Starfire) and poison (Purge). As support it lights the dark and reveals hidden walls.
- **The Archive.** Relics come home from the Underheart (2 from Ilsa, half of its chests) and the Unbound Bloom. A Lumen archivist chosen on the Research tab translates one a day. Each relic is a lore fragment and teaches a few rune letters; the seven rune walls fill in as letters are learned. Twelve relics cover the whole alphabet.
- **The Unbound Bloom.** After an ending, 20 tiers, each three floors (7 to 9) with a boss at the bottom. Each tier keeps the earlier tiers' rules and adds one: Hardened, Quickened, Brittle Cages, Ricochet, Thin Blood, Twisted Rooms, Elite Guard, No Peddlers, Short Night, Bloomlords Stir, Regrowth, Darkness, Gales, Venom Tide, Eruptions, Fury, Fragile Bonds, Barren, Swarm and Unbound. Coin rises 8% and Keeper XP 6% per tier. Clearing a tier (beat its boss, extract) earns Renown; its boss drops apex shards, and from tier 8 Bloomscar serums.
- **Bloomlords** wait instead of the tier boss 35% of the time from tier 10: the Hush (guns do 30% damage), the Mirror King (half of every elemental hit comes back on its source), the Thousand (can't be hurt while its brood lives) and the Shade of You (shadow copies of your companions).
- **Gene tools.** The **Splicer** (Keeper rank 25; 400 coin and a serum) writes a donor's better allele over the recipient's weaker copy of one gene and uses the donor up. The **Mutation Lab** (rank 25) takes up to two Crystal creatures, +1% mutation chance per gene each, capped at +2%. The **Apex Chamber** (after the Heart; one apex shard) guarantees both parents' better allele on one chosen combat gene for the first egg of a pair that both carry an Apex allele. In the genetics simulator the median chase to an Apex genome stays at 13 generations with or without the chamber.
- **Renown** adds four tracks: depth (Unbound tiers and Deepening placings), genetics (Apex creatures, ribbons, hybrids hatched), craft (recipes mastered, Legendary weapons) and collection (Codex milestones, relics read, endings, freeing Ilsa).
- **Weekly shows.** Three classes a week from four kinds (finest genome, highest grade, best young creature, most striking looks), judged when the week ends against five rival breeders. Top three win ribbons, shown on the creature's card.
- **The weekly Deepening** is one fixed-seed raid a week. Score is floors, kills, coin, catches and extracting; your best goes on a ladder against 99 simulated Keepers until online play.
- **Seasons** last 90 days. Each has a twist (one type turns up twice as often). At a season's end the Keeper earns a Bronze, Silver or Gold title by Renown and a season banner. The Fresh Season ladder needs online play.
- **Content at the end of the phase:** 9 types, 27 base species, 18 hybrids, 129 evolution forms, 61 enemy entries (about 56 that spawn on floors), 21 bosses plus 4 Bloomlords, and 40 weapons. Apex shards and Bloomscar serums aren't traded on the Exchange yet.

## Launch scope, money and the road there

The prototype already proves the raid, capture, extract and evolve loop. Version 1.0 is about two and a half times its content, plus four new systems: the deep genome, production, the Exchange and the hideout builder.

### Content at launch

| Content | Prototype v5 | 1.0 |
| --- | --- | --- |
| Creature types | 7 | 9 (adds Venom from the Sump, and Lumen, found only in the Underheart) |
| Base species | 21 | 27 |
| Hybrids | 7 | 18, plus 1 new per season |
| Evolution forms | 91 | About 125 |
| Traits | Basic gene traits | About 45 inheritable traits |
| Floors | 6 | 10, plus 20 Unbound tiers |
| Veins | 1 | Rootworks, 5 veins, Underheart, Heart |
| Bosses | 8 | 20, plus 4 Bloomlords |
| Enemy types | 24 | About 60 |
| Weapons | 24 | 40 base designs with crafted affixes |
| Hideout stations | 5 sections | 9 stations, free-build grid |
| Lore fragments | About 35 | About 150, plus the rune cipher |
| NPC residents | 3 | 6 |

### How it makes money

These are recommendations. Prices aren't decided yet.

- **Free demo.** The Rootworks and all of Act I. The save carries into the full game.
- **Full game, one-time purchase.** Around $14.99.
- **Expansions.** A new vein, a new type, bosses and lore, at $6.99 to $9.99 each, about twice a year.
- **Supporter pack.** Soundtrack, hideout decor and a sigil frame. Cosmetic only.
- **Never.** No premium currency, loot boxes or paid timers. Anything bought with real money that affects power would break the economy and the pride pillar.

### Tech

- **Hosting** stays on GitHub Pages plus Firebase, as with APlay.
- **Client.** The single-file prototype moves to modules built with a bundler. It stays canvas 2D, works offline as an installable web app, and saves to the browser's IndexedDB.
- **Firebase.** Authentication, cloud save sync, purchase entitlements and leaderboards. Deepening runs are seeded and submitted with a run summary that the server checks.
- **Economy.** The trader simulation runs in a background worker behind the same interface the online Exchange will use.

### The road from v5 to 1.0

The build is split into ten phases over about 42 weeks, each ending in a playable build. The full plan, with goals, build lists and exit tests, is in [DEVELOPMENT_PHASES.md](DEVELOPMENT_PHASES.md), and the checklist version is [ROADMAP.md](ROADMAP.md).

### Open questions

- Should Fresh Season hideouts merge into the main save, or stay separate trophies?
- Do the Venom and Lumen names and roles fit the world, or should the two new types be something else?
- Should anything run on real time beyond daily contracts and the weekly Deepening?
