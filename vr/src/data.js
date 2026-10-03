/* All tunable numbers for GeneSlingVR live here so balance passes never touch logic.
   Genetics, species, traits and personalities come from the GeneSling sim core (src/sim-core). */

export const VR = {
  SAVE_KEY: 'genesling-vr-save',
  SAVE_VERSION: 1,

  // World layout along the x axis (metres). Zones run west to east, home first.
  ZONES: [
    {id: 'home', name: 'The Homestead', x0: -70, x1: -24, kind: 'claimed', ground: '#7fae58', claimedGround: '#7fae58'},
    {id: 'thorn', name: 'Thornmeadow', x0: -24, x1: 46, kind: 'wild', ground: '#93a54c', claimedGround: '#8fc062',
      species: ['cindlet', 'puffcap', 'dewdrip', 'pyrrox', 'shroomite', 'coralisk'], weights: [26, 26, 26, 8, 8, 6],
      capacity: 9, floor: 2, heartroot: {x: 12, z: -6}, surge: {seconds: 150, waves: 6, perWave: 3, stoneHp: 420}},
    {id: 'blight', name: 'Blightfen', x0: 46, x1: 132, kind: 'bloom', ground: '#6b5a7e', claimedGround: '#7fb070',
      species: ['pyrrox', 'shroomite', 'coralisk', 'cindlet', 'puffcap', 'dewdrip'], weights: [24, 24, 24, 10, 10, 8],
      capacity: 8, floor: 5, heartroot: {x: 96, z: 10}, surge: {seconds: 200, waves: 8, perWave: 4, stoneHp: 520}},
  ],
  WORLD_Z: 46, // half depth of the valley
  WAYSTONES: [{x: 120, z: -14, name: 'Deep Waystone'}],
  DELVE_MOUTH: {x: 112, z: 22},
  HOLD_SECONDS: 8,          // stand in an extraction circle this long
  RECOVER_DAYS: 3,          // a fallen companion roams as Bloom-taken this many homestead days
  DAY_SECONDS: 24 * 60,     // one in-world day–night cycle
  NIGHT_FROM: 0.72, NIGHT_TO: 0.24, // fraction of the cycle that is night (wraps)

  PLAYER: {hp: 120, walk: 3.2, run: 5.6, crouch: 1.4, eye: 1.62, crouchEye: 1.05},

  SLING: {maxDraw: 0.6, drawSeconds: 0.6, minSpeed: 12, maxSpeed: 34, baseDamage: 9, maxDamage: 26, assistDeg: 3, gravity: 6},
  CAGE: {gravity: 9.8, burstRadius: 1.1, shakes: 3, shakeSeconds: 0.55, weakenedAt: 0.35,
    base: 0.1, missingHpBonus: 0.85, weakBonus: 0.15, cleanThrowBonus: 0.08, bloomPenalty: 0.12, minChance: 0.05, maxChance: 0.96},
  TAME: {range: 2.4, seconds: 9, decayPerSecond: 0.25, maxPlayerSpeed: 1.6, timidFactor: 1.6, curiousFactor: 0.65, startBond: 60},

  CREATURE: {hpBase: 40, hpPerVig: 9, atkBase: 4, atkPerPow: 1.4, speedBase: 1.6, speedPerSwf: 0.22,
    attackEvery: 2.6, attackPerTem: -0.12, windup: 0.5, shotSpeed: 4.6, shotSpeedBloom: 5.6,
    sizes: [0.8, 1, 1.22, 1.45], bloomBuff: 1.25, aggroRange: 9, fleeRange: 7, sightRange: 22},

  COMPANION: {followDist: 2.4, skillBaseCooldown: 14, skillPerFoc: -0.8, comboWindow: 2, comboDamage: 40},
  SKILLS: {
    ember: {name: 'Flame Ring', desc: 'Burns everything within 3.5 m.', radius: 3.5, damage: 22},
    fungal: {name: 'Mend', desc: 'Heals you and the party 30% of max HP.', heal: 0.3},
    tide: {name: 'Undertow', desc: 'A wave that soaks and knocks foes back 4 m.', radius: 4, damage: 14, push: 4},
  },

  BLOOMLING: {hp: 30, damage: 9, speed: 2.4, shotEvery: 2.4, nightCap: 5},
  BOSS: {name: 'Rootmaw', hp: 900, ringEvery: 3.2, ringShots: 14, aimedEvery: 1.6, damage: 12},

  // Homestead stations: GeneSling's Phase 2 formula, worker units a day = (0.5 + 0.1 × Yield) × type match × level × fatigue.
  STATIONS: {
    forge: {name: 'Forge', type: 'ember', pos: [-40, 0, -12], takes: {ore: 2}, makes: {ingot: 1}, slots: 3},
    garden: {name: 'Garden', type: 'fungal', pos: [-52, 0, -6], takes: {}, makes: {food: 2, herbs: 1}, slots: 3},
    spring: {name: 'Spring', type: 'tide', pos: [-52, 0, 10], takes: {herbs: 2}, makes: {tonic: 1}, slots: 3},
  },
  OUTPOST: {name: 'Thornmeadow Quarry', type: 'ember', pos: [30, 0, 16], takes: {}, makes: {ore: 2}, slots: 2, zone: 'thorn'},
  WORK: {offTypeMatch: 0.5, perLevel: 0.02, fatigueRise: 12, fatigueRest: 30, fatigueMaxCut: 0.4},
  UPKEEP_FOOD: 1,

  RECIPES: [
    {id: 'cages', name: '3 Cages', cost: {ingot: 1, fiber: 1}, gives: {cage: 3}},
    {id: 'tonic', name: 'Tonic (heals 40%)', cost: {herbs: 2}, gives: {tonic: 1}},
    {id: 'ward', name: 'Ward Stone', cost: {ingot: 3, fiber: 2, tonic: 1}, gives: {ward: 1}},
    {id: 'lure', name: 'Lure food ×3', cost: {food: 2, herbs: 1}, gives: {lure: 3}},
  ],

  EGG_DAYS: [2, 4],
  BREED_LEVEL: 3,          // MVP: creatures can breed from level 3 (GeneSling uses 10)
  XP_PER_LEVEL: 60,
  KEEPER_XP: {catch: 30, tame: 45, extract: 40, extractPerItem: 2, craft: 6, hatch: 35, claim: 200, boss: 250, contract: 60},
  KEEPER_RANK_COST: 390,   // next rank costs 390 × rank XP, as in GeneSling Phase 8

  NODES: { // gatherable resource nodes per zone: [kind, count]
    thorn: [['ore', 10], ['fiber', 12], ['herbs', 8]],
    blight: [['ore', 10], ['fiber', 6], ['bloomshard', 6]],
  },
  NODE_YIELD: {ore: [2, 3], fiber: [2, 3], herbs: [1, 2], bloomshard: [1, 1]},

  START: {
    items: {cage: 6, food: 8, lure: 3, herbs: 2, ore: 2, fiber: 2, tonic: 1},
    party: [{species: 'cindlet', name: 'Ash', sex: 'M'}, {species: 'puffcap', name: 'Bramble', sex: 'F'}],
  },

  // The MVP's own act gate: the full loop, done once.
  OBJECTIVES: [
    {id: 'sling', text: 'Hit something with the sling'},
    {id: 'cage', text: 'Weaken a wild creature and cage it'},
    {id: 'tame', text: 'Tame a calm creature with food'},
    {id: 'extract', text: 'Bring a catch home (hold the gate circle)'},
    {id: 'post', text: 'Post a creature to a station, then sleep'},
    {id: 'breed', text: 'Breed a pair in the pen'},
    {id: 'hatch', text: 'Hatch an egg'},
    {id: 'ward', text: 'Craft a Ward Stone at the Workbench'},
    {id: 'claim', text: 'Claim Thornmeadow at its Heartroot'},
    {id: 'boss', text: 'Beat Rootmaw in the Blightfen Delve'},
  ],
  CONTRACTS: [
    {kind: 'catch', type: 'tide', n: 1, text: 'Catch a Tide creature', reward: {coin: 60, cage: 2}},
    {kind: 'catch', type: 'ember', n: 1, text: 'Catch an Ember creature', reward: {coin: 60, food: 3}},
    {kind: 'gather', item: 'ore', n: 6, text: 'Extract with 6 ore', reward: {coin: 50, ingot: 1}},
    {kind: 'gather', item: 'bloomshard', n: 2, text: 'Extract with 2 bloomshards', reward: {coin: 90, tonic: 1}},
    {kind: 'catch', type: 'fungal', n: 1, text: 'Catch a Fungal creature', reward: {coin: 60, herbs: 3}},
  ],
};
