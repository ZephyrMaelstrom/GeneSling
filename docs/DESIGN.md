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

### Why the loop holds

- **The Bloom is the only gene pool.** New alleles, mutations and rare traits only enter the game through wild catches. Even a master breeder keeps raiding.
- **The hideout is the only factory.** Raids bring raw materials, and only posted creatures turn them into goods. Even a raid-only player needs workers.
- **The market connects the two.** A player who loves fighting can sell raw catches and loot. A player who loves breeding can buy them. Both progress.

## Genetics

Every creature carries a real genome of 14 loci, two alleles each, and every stat, skill, job and look it has comes from that genome. Wild catches bring raw genetic variety. Breeding sorts it into something better. The best creatures in the game are about 12 generations from the wild.

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
