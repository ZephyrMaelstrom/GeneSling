'use strict';
/* ================= Utilities ================= */
const $=s=>document.querySelector(s);
const rnd=(a,b)=>a+Math.random()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(Math.random()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wpick=(items,wf)=>{const ws=items.map(wf);let x=Math.random()*ws.reduce((a,b)=>a+b,0);for(let i=0;i<items.length;i++){x-=ws[i];if(x<=0)return items[i]}return items[items.length-1]};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d};
const SAVE_KEY='genesling-save-v5';
const TOUCH=(window.matchMedia&&matchMedia('(pointer: coarse)').matches)||('ontouchstart' in window);

/* ================= Lore ================= */
const LORE_INTRO=[
  'Under the hills lies the Bloom: a living dungeon that grows its own creatures and wraps every one of them in a root-thread called a tether.',
  'While a creature is tethered, the Bloom can take it back. Fall inside and the roots drink you, creature and keeper alike. Only an extraction point is strong enough to cut the tether cleanly.',
  'The last Keeper of this hideout, Ilsa Marrow, went down to the sixth floor a year ago and never came back. Her creatures are gone. Her journal is still on the desk.',
  'The hideout is yours now. Catch, raise and breed creatures, cut them free, and find out what Ilsa found.'];

/* ================= Types ================= */
const TYPES={
  ember:{name:'Ember',color:'#ff7a3d',acc:'#ffd23f',tier:1,base:{hp:140,atk:16,spd:170},elem:'burn',support:'+10% weapon damage',weight:30},
  fungal:{name:'Fungal',color:'#e0527a',acc:'#b8f06a',tier:1,base:{hp:180,atk:12,spd:150},elem:'spore',support:'+2 food when you extract',weight:30},
  tide:{name:'Tide',color:'#3fa9ff',acc:'#c8f4ff',tier:2,base:{hp:160,atk:11,spd:160},elem:'soak',support:'You regenerate 1 HP per second',weight:16},
  echo:{name:'Echo',color:'#9b7bff',acc:'#e8c8ff',tier:2,base:{hp:130,atk:13,spd:190},elem:'static',support:'Reveals the floor map and hollow walls',weight:14},
  gale:{name:'Gale',color:'#4fe0c8',acc:'#fff6a8',tier:3,base:{hp:135,atk:17,spd:220},elem:'gust',support:'Unlocks cliff extracts, +10% move speed',weight:5},
  crystal:{name:'Crystal',color:'#ff8fe0',acc:'#ffffff',tier:3,base:{hp:150,atk:12,spd:150},elem:'brittle',support:'20% chance to block a hit',weight:3.5},
  warden:{name:'Warden',color:'#e3b04b',acc:'#ffcf4a',tier:4,base:{hp:260,atk:12,spd:135},elem:'stagger',support:'+15% max HP for you',weight:1.5},
};
const TYPE_IDS=Object.keys(TYPES);
const TIER=['','Common','Uncommon','Rare','Very rare'];

/* ================= Species (each has its own body) ================= */
const SPECIES={
  cindlet:{name:'Cindlet',type:'ember',col:'#ff9a4d',shade:'#c2561d',size:.85,mods:{hp:.85,atk:.95,spd:1.15,rate:1.1},w:6,blurb:'A hopping spark with a flame tuft.'},
  pyrrox:{name:'Pyrrox',type:'ember',col:'#ff6a3d',shade:'#b33a1d',size:1,mods:{hp:1,atk:1.15,spd:1,rate:1},w:3,blurb:'A fox with a burning tail.'},
  magmaul:{name:'Magmaul',type:'ember',col:'#b8452b',shade:'#5a1a10',size:1.15,mods:{hp:1.3,atk:1.1,spd:.85,rate:.85},w:1,blurb:'A lava bear, slow and molten.'},
  puffcap:{name:'Puffcap',type:'fungal',col:'#e0527a',shade:'#9c2c4f',size:.9,mods:{hp:1.15,atk:.9,spd:.95,rate:1},w:6,blurb:'A sturdy little mushroom.'},
  shroomite:{name:'Shroomite',type:'fungal',col:'#c04ad8',shade:'#5a1a6b',size:1,mods:{hp:1,atk:1.15,spd:1,rate:1},w:3,blurb:'A horned beetle with a toadstool shell.'},
  mycelisk:{name:'Mycelisk',type:'fungal',col:'#ff8a5c',shade:'#a8452a',size:1.1,mods:{hp:1.1,atk:1,spd:.9,rate:1.25},w:1,blurb:'A serpent of living mycelium.'},
  dewdrip:{name:'Dewdrip',type:'tide',col:'#5cc8ff',shade:'#2a7ab3',size:.85,mods:{hp:.9,atk:.95,spd:1.15,rate:1.1},w:6,blurb:'A bouncy water droplet.'},
  coralisk:{name:'Coralisk',type:'tide',col:'#ff7a6a',shade:'#a83a2a',size:1,mods:{hp:1.25,atk:.95,spd:.9,rate:1},w:3,blurb:'A crab wearing a coral crown.'},
  tidewyrm:{name:'Tidewyrm',type:'tide',col:'#2f6bff',shade:'#1a3a9a',size:1.1,mods:{hp:1.1,atk:1.2,spd:1,rate:1},w:1,blurb:'A deep-water eel.'},
  chirrup:{name:'Chirrup',type:'echo',col:'#b39bff',shade:'#6f55c2',size:.85,mods:{hp:.9,atk:.95,spd:1.2,rate:1.05},w:6,blurb:'A chattering cave flier.'},
  vesperbat:{name:'Vesperbat',type:'echo',col:'#7b5bff',shade:'#3a2290',size:1,mods:{hp:1,atk:1,spd:1,rate:1.25},w:3,blurb:'A big-eared bat that pulses in bursts.'},
  umbrowl:{name:'Umbrowl',type:'echo',col:'#4a3a8f',shade:'#251a52',size:1.1,mods:{hp:1.1,atk:1.25,spd:.9,rate:1},w:1,blurb:'A shadow owl with a heavy cry.'},
  zephling:{name:'Zephling',type:'gale',col:'#7ff0dc',shade:'#2fae98',size:.85,mods:{hp:.9,atk:.95,spd:1.2,rate:1.05},w:6,blurb:'A breezy fledgling.'},
  kestrix:{name:'Kestrix',type:'gale',col:'#2fc4a8',shade:'#145a4c',size:1,mods:{hp:1,atk:1.2,spd:1,rate:1},w:3,blurb:'A razor-taloned hawk.'},
  stormwing:{name:'Stormwing',type:'gale',col:'#3f8fd8',shade:'#1f4f8a',size:1.1,mods:{hp:1.1,atk:1,spd:1,rate:1.25},w:1,blurb:'A sky ray that rides thunderheads.'},
  shardling:{name:'Shardling',type:'crystal',col:'#ffa8e8',shade:'#c25aa8',size:.85,mods:{hp:.9,atk:1,spd:1.05,rate:1.15},w:6,blurb:'A chip off a bigger gem.'},
  prismoth:{name:'Prismoth',type:'crystal',col:'#c49bff',shade:'#7a52c2',size:1,mods:{hp:1,atk:1.05,spd:1.15,rate:1},w:3,blurb:'A moth with light-bending wings.'},
  geodon:{name:'Geodon',type:'crystal',col:'#8a6fb3',shade:'#3a2a5a',size:1.15,mods:{hp:1.35,atk:1,spd:.85,rate:.95},w:1,blurb:'A tortoise carrying a geode.'},
  pebblet:{name:'Pebblet',type:'warden',col:'#b8b0a0',shade:'#6a6458',size:.85,mods:{hp:.9,atk:.95,spd:1.15,rate:1.05},w:6,blurb:'A pebble that rolls everywhere.'},
  bastion:{name:'Bastion',type:'warden',col:'#e3b04b',shade:'#9a7220',size:1,mods:{hp:1.3,atk:.95,spd:.95,rate:1},w:3,blurb:'A living fortress wall.'},
  monolord:{name:'Monolord',type:'warden',col:'#7a6a5a',shade:'#3a3028',size:1.15,mods:{hp:1.15,atk:1.25,spd:.9,rate:1},w:1,blurb:'A floating monolith with a crown.'},
};
const HYBRIDS=[
  {id:'blazewing',name:'Blazewing',types:['ember','gale'],col:'#ff8a3d',shade:'#1f9585'},
  {id:'bogbloom',name:'Bogbloom',types:['tide','fungal'],col:'#4fb3a0',shade:'#9c2c4f'},
  {id:'resonyx',name:'Resonyx',types:['crystal','echo'],col:'#d88fff',shade:'#4a2fb3'},
  {id:'forgeheart',name:'Forgeheart',types:['warden','ember'],col:'#e39a3b',shade:'#7a2316'},
  {id:'squallfin',name:'Squallfin',types:['gale','tide'],col:'#3fd8e8',shade:'#1a3a9a'},
  {id:'duskcap',name:'Duskcap',types:['fungal','echo'],col:'#9a4ad8',shade:'#3a1a5a'},
  {id:'gemguard',name:'Gemguard',types:['crystal','warden'],col:'#f0a0c8',shade:'#9a7220'},
];
HYBRIDS.forEach(h=>{SPECIES[h.id]={name:h.name,hybrid:true,types:h.types,col:h.col,shade:h.shade,size:1.05,mods:{hp:1.2,atk:1.2,spd:1.05,rate:1.1},w:0,blurb:`Rare ${TYPES[h.types[0]].name}/${TYPES[h.types[1]].name} hybrid.`}});
const SPECIES_IDS=Object.keys(SPECIES);
const BASE_SPECIES=SPECIES_IDS.filter(k=>!SPECIES[k].hybrid);
const speciesOf=t=>BASE_SPECIES.filter(k=>SPECIES[k].type===t);
const hybridFor=(a,b)=>{if(a===b)return null;const h=HYBRIDS.find(h=>h.types.includes(a)&&h.types.includes(b));return h?h.id:null};
const typesOf=c=>c.type2?[c.type,c.type2]:[c.type];

/* ================= Companion attacks ================= */
const ATTACKS={
  ember1:{name:'Fire Bolt',desc:'One fire bolt',kind:'shot',n:1,spd:380,mult:1,cd:1.1},
  ember2:{name:'Twin Bolts',desc:'Two fire bolts',kind:'shot',n:2,spread:.12,spd:380,mult:.9,cd:1.1},
  emberFan:{name:'Ember Fan',desc:'Three bolts in a fan',kind:'shot',n:3,spread:.15,spd:400,mult:.85,cd:1.1},
  flamethrower:{name:'Flamethrower',desc:'A short stream of flame',kind:'stream',n:6,gap:.05,spread:.18,spd:330,mult:.42,life:.5,cd:1.3,r:6},
  emberBurst:{name:'Burst Bolts',desc:'Three bolts that explode',kind:'shot',n:3,spread:.15,spd:400,mult:.8,cd:1.15,r:6,explode:42},
  foxfire:{name:'Foxfire',desc:'Three homing flames',kind:'shot',n:3,spread:.5,spd:300,mult:.8,cd:1.2,r:6,homing:3,life:2},
  solarLance:{name:'Solar Lance',desc:'A fast beam that pierces everything',kind:'shot',n:1,spd:900,mult:2.2,cd:1.4,r:7,pierce:8,life:.9},
  magmaSlam:{name:'Magma Slam',desc:'Charges in and erupts',kind:'dash',sp:420,range:140,mult:1,cd:1.6,end:'fire'},
  meteor:{name:'Meteor',desc:'Lobs a fireball that bursts',kind:'lob',n:1,mult:1.6,rad:70,cd:1.8},
  eruption:{name:'Eruption',desc:'Three meteors at once',kind:'lob',n:3,mult:1.2,rad:65,cd:2},
  spore1:{name:'Spore',desc:'One slowing spore',kind:'shot',n:1,spd:260,mult:.9,cd:1.3,r:6,slow:1.2},
  spore2:{name:'Twin Spores',desc:'Two slowing spores',kind:'shot',n:2,spread:.2,spd:260,mult:.85,cd:1.3,r:6,slow:1.2},
  sporeFan:{name:'Spore Fan',desc:'Three spores, longer slow',kind:'shot',n:3,spread:.2,spd:270,mult:.8,cd:1.3,r:6,slow:1.8},
  sporeMortar:{name:'Spore Mortar',desc:'Lobs a pod that leaves a cloud',kind:'lob',n:1,mult:.9,rad:60,cd:1.7,cloud:true},
  thornRing:{name:'Thorn Ring',desc:'Eight thorns in every direction',kind:'ring',n:8,spd:300,mult:.6,cd:1.5},
  seedHoming:{name:'Seeker Seeds',desc:'Three seeds that curve to foes',kind:'shot',n:3,spread:.6,spd:260,mult:.75,cd:1.3,homing:3,life:2},
  hornCharge:{name:'Horn Charge',desc:'Rams enemies and knocks them back',kind:'dash',sp:480,range:170,mult:1.2,cd:1.4,knock:24},
  hornQuake:{name:'Horn Quake',desc:'Rams and sends a shockwave',kind:'dash',sp:480,range:170,mult:1.3,cd:1.5,knock:24,end:'shock'},
  sporeStream:{name:'Spore Stream',desc:'A rapid stream of slowing spores',kind:'stream',n:7,gap:.06,spread:.12,spd:300,mult:.35,life:.8,cd:1.3,slow:1.2},
  bubble1:{name:'Bubble',desc:'One bubble',kind:'shot',n:1,spd:280,mult:.8,cd:1.2,r:6},
  bubblePierce:{name:'Pierce Bubble',desc:'A bubble that passes through a foe',kind:'shot',n:1,spd:300,mult:.9,cd:1.2,r:6,pierce:1},
  bubbleBounce:{name:'Bounce Bubbles',desc:'Three bubbles that bounce off walls',kind:'shot',n:3,spread:.15,spd:300,mult:.7,cd:1.2,r:6,bounce:2,life:2},
  geyser:{name:'Geyser',desc:'Water erupts under the target',kind:'strike',mult:1.5,rad:55,delay:.5,cd:1.6},
  tidalWave:{name:'Tidal Wave',desc:'A wide wave that rolls through foes',kind:'shot',n:1,spd:240,mult:1.4,cd:1.6,r:14,pierce:6,life:1.4},
  clawPinch:{name:'Claw Pinch',desc:'Scuttles in and pinches hard',kind:'dash',sp:380,range:110,mult:1.4,cd:1.3,knock:10},
  clawCrush:{name:'Claw Crush',desc:'Pinches and splashes a ring of bubbles',kind:'dash',sp:400,range:120,mult:1.5,cd:1.4,end:'ring'},
  whirlpool:{name:'Whirlpool',desc:'A swirling pool that pulls enemies in',kind:'field',rad:80,dur:2.5,mult:.6,pull:60,cd:2.2},
  pulse2:{name:'Twin Pulse',desc:'Two sonic pulses',kind:'shot',n:2,spread:.08,spd:420,mult:.6,cd:1,r:4},
  pulse3:{name:'Triple Pulse',desc:'Three sonic pulses',kind:'shot',n:3,spread:.08,spd:420,mult:.6,cd:1,r:4},
  pulse4:{name:'Piercing Pulse',desc:'Four pulses that pierce',kind:'shot',n:4,spread:.08,spd:440,mult:.6,cd:1,r:4,pierce:1},
  pulseHoming:{name:'Seeking Pulse',desc:'Four pulses that seek foes',kind:'shot',n:4,spread:.3,spd:400,mult:.6,cd:1,r:4,homing:2.5,life:1.8},
  sonicRing:{name:'Sonic Ring',desc:'A ring of ten pulses',kind:'ring',n:10,spd:380,mult:.5,cd:1.3},
  chainShock:{name:'Chain Shock',desc:'A bolt that jumps between foes',kind:'chain',jumps:3,mult:1.1,cd:1.3},
  screech:{name:'Screech',desc:'A cone of fast sound',kind:'shot',n:7,spread:.08,spd:520,mult:.4,cd:1.2,r:4,life:.6},
  dive:{name:'Dive Strike',desc:'Dives at a foe',kind:'dash',sp:560,range:190,mult:1,cd:1.3},
  diveFast:{name:'Swift Dive',desc:'Faster dives that hit twice as hard',kind:'dash',sp:640,range:200,mult:2,cd:1},
  diveRing:{name:'Gust Dive',desc:'Dives end in a ring of wind',kind:'dash',sp:640,range:210,mult:2,cd:1,end:'ring'},
  featherFan:{name:'Feather Fan',desc:'Five feathers in a wide fan',kind:'shot',n:5,spread:.2,spd:460,mult:.55,cd:1.1,r:4},
  tornado:{name:'Tornado',desc:'A twister that travels and shreds',kind:'field',rad:50,dur:2,mult:.7,move:160,cd:2},
  lightning:{name:'Lightning',desc:'Strikes a foe and arcs to others',kind:'chain',jumps:4,mult:1.3,cd:1.3},
  shard3:{name:'Shard Spray',desc:'Three shards',kind:'shot',n:3,spread:.12,spd:340,mult:.5,cd:1.4,r:4},
  shard5:{name:'Wide Spray',desc:'Five shards',kind:'shot',n:5,spread:.12,spd:340,mult:.5,cd:1.4,r:4},
  shard5p:{name:'Piercing Spray',desc:'Five piercing shards',kind:'shot',n:5,spread:.12,spd:360,mult:.5,cd:1.4,r:4,pierce:1},
  shardSplit:{name:'Split Shard',desc:'Shards that split in three',kind:'shot',n:2,spread:.2,spd:360,mult:.7,cd:1.4,r:5,split:true},
  orbit:{name:'Orbiting Shards',desc:'Six shards circle, then launch',kind:'orbit',n:6,mult:.6,cd:1.8},
  prismBeam:{name:'Prism Beam',desc:'A long piercing beam of light',kind:'shot',n:1,spd:900,mult:2,cd:1.4,r:6,pierce:6,life:.9},
  slam:{name:'Stone Slam',desc:'Slams a foe',kind:'dash',sp:420,range:130,mult:.9,cd:1.6,knock:20},
  slamShock:{name:'Shock Slam',desc:'Slams and sends a shockwave',kind:'dash',sp:420,range:130,mult:1,cd:1.6,knock:30,end:'shock'},
  quakeSlam:{name:'Quake Slam',desc:'Slams, shocks and draws aggro',kind:'dash',sp:440,range:140,mult:1.1,cd:1.6,knock:30,end:'quake'},
  rollBoulder:{name:'Boulder Roll',desc:'Rolls a huge piercing boulder',kind:'shot',n:1,spd:230,mult:1.6,cd:1.7,r:13,pierce:5,life:1.6},
  boulderLob:{name:'Boulder Toss',desc:'Throws a boulder that cracks the ground',kind:'lob',n:1,mult:1.7,rad:70,cd:1.9},
  runeBolt:{name:'Rune Bolt',desc:'Two heavy rune bolts',kind:'shot',n:2,spread:.15,spd:360,mult:1,cd:1.4,r:7},
  runeHoming:{name:'Rune Seekers',desc:'Four runes that seek foes',kind:'shot',n:4,spread:.5,spd:320,mult:.8,cd:1.5,r:6,homing:3,life:2},
};
/* ================= Abilities ================= */
const ABILITIES={
  flameRing:{name:'Flame Ring',desc:'Blasts 12 fire bolts in a ring',cd:8},
  meteorShower:{name:'Meteor Shower',desc:'Six meteors rain on nearby foes',cd:9},
  infernoNova:{name:'Inferno Nova',desc:'Burns every enemy nearby and blasts a 24-bolt ring',cd:10},
  sporeField:{name:'Spore Field',desc:'A cloud that slows and damages for 4s',cd:8},
  healBloom:{name:'Healing Bloom',desc:'Heals you 25 and your companions 30%',cd:10},
  rotCloud:{name:'Rot Cloud',desc:'A huge spore cloud that spores everything inside',cd:10},
  tideShield:{name:'Tide Shield',desc:'You take no damage for 3s and heal 20',cd:8},
  tidalSurge:{name:'Tidal Surge',desc:'Sixteen piercing bubbles roll forward',cd:9},
  deluge:{name:'Deluge',desc:'Shields you, heals everyone and soaks all nearby foes',cd:11},
  echoPing:{name:'Echo Ping',desc:'Stuns nearby enemies for 1.6s',cd:8},
  sonicBoom:{name:'Sonic Boom',desc:'Stuns for 2.5s and deals heavy damage',cd:10},
  stormCall:{name:'Storm Call',desc:'Charges every nearby foe with static, then thunder strikes',cd:11},
  gustDash:{name:'Gust Dash',desc:'Dashes through foes for heavy damage',cd:8},
  cyclone:{name:'Cyclone',desc:'A cyclone that pulls enemies in and shreds them',cd:10},
  skyStrike:{name:'Sky Strike',desc:'Three lightning strikes on the strongest foes',cd:10},
  prismWard:{name:'Prism Ward',desc:'Turns enemy bullets near you back on them for 3s',cd:8},
  shardStorm:{name:'Shard Storm',desc:'24 piercing shards in every direction',cd:9},
  mirrorField:{name:'Mirror Field',desc:'Reflects bullets for 5s and makes foes brittle',cd:11},
  taunt:{name:'Taunt',desc:'Enemies attack it for 4s; it takes half damage',cd:8},
  quake:{name:'Quake',desc:'Stuns everything within reach and staggers them',cd:10},
  fortress:{name:'Fortress',desc:'Taunts, and the whole party takes half damage for 5s',cd:11},
};
const TYPE_ABIL={ember:'flameRing',fungal:'sporeField',tide:'tideShield',echo:'echoPing',gale:'gustDash',crystal:'prismWard',warden:'taunt'};

/* ================= Evolution lines: [name, level, attack, ability, gene need] ================= */
const LINE_DATA={
  cindlet:[['Cindlet',1,'ember1','flameRing'],['Cinderpup',10,'ember2','flameRing'],['Blazehound',20,'flamethrower','meteorShower'],['Infernox',30,'emberBurst','infernoNova',['pow',7]]],
  pyrrox:[['Pyrrox',1,'ember2','flameRing'],['Pyrrovex',12,'emberFan','flameRing'],['Flarefang',22,'foxfire','meteorShower'],['Solarix',32,'solarLance','infernoNova',['hst',7]]],
  magmaul:[['Magmaul',1,'magmaSlam','flameRing'],['Magmaw',15,'meteor','meteorShower'],['Calderon',28,'eruption','infernoNova',['vig',7]]],
  puffcap:[['Puffcap',1,'spore1','sporeField'],['Toadstool',10,'spore2','sporeField'],['Sporelord',20,'sporeMortar','healBloom'],['Mycoking',30,'thornRing','rotCloud',['vig',7]]],
  shroomite:[['Shroomite',1,'hornCharge','sporeField'],['Shroomhorn',12,'hornCharge','sporeField'],['Fungaroth',22,'hornQuake','healBloom'],['Blightbeetle',32,'hornQuake','rotCloud',['pow',7]]],
  mycelisk:[['Mycelisk',1,'sporeFan','sporeField'],['Hyphaserp',15,'sporeStream','healBloom'],['Rhizowyrm',28,'seedHoming','rotCloud',['hst',7]]],
  dewdrip:[['Dewdrip',1,'bubble1','tideShield'],['Ripplet',10,'bubblePierce','tideShield'],['Torrentail',20,'bubbleBounce','tidalSurge'],['Tsunamaw',30,'tidalWave','deluge',['pow',7]]],
  coralisk:[['Coralisk',1,'clawPinch','tideShield'],['Coralclaw',12,'clawPinch','tideShield'],['Reefguard',22,'clawCrush','tidalSurge'],['Atollossus',32,'geyser','deluge',['vig',7]]],
  tidewyrm:[['Tidewyrm',1,'bubblePierce','tideShield'],['Deepwyrm',15,'whirlpool','tidalSurge'],['Maelstrix',28,'tidalWave','deluge',['hst',7]]],
  chirrup:[['Chirrup',1,'pulse2','echoPing'],['Chitterwing',10,'pulse3','echoPing'],['Screechling',20,'screech','sonicBoom'],['Banshriek',30,'sonicRing','stormCall',['hst',7]]],
  vesperbat:[['Vesperbat',1,'pulse3','echoPing'],['Vespercall',12,'pulse4','echoPing'],['Nightvesper',22,'pulseHoming','sonicBoom'],['Duskchorus',32,'chainShock','stormCall',['pow',7]]],
  umbrowl:[['Umbrowl',1,'pulse4','echoPing'],['Gloomhoot',15,'chainShock','sonicBoom'],['Eclipsowl',28,'sonicRing','stormCall',['tmp',7]]],
  zephling:[['Zephling',1,'dive','gustDash'],['Zephyrin',10,'diveFast','gustDash'],['Galewing',20,'featherFan','cyclone'],['Tempestra',30,'tornado','skyStrike',['swf',7]]],
  kestrix:[['Kestrix',1,'dive','gustDash'],['Razorkest',12,'diveFast','gustDash'],['Skyreaver',22,'diveRing','cyclone'],['Stormtalon',32,'lightning','skyStrike',['pow',7]]],
  stormwing:[['Stormwing',1,'featherFan','gustDash'],['Thunderray',15,'lightning','cyclone'],['Cyclonox',28,'tornado','skyStrike',['hst',7]]],
  shardling:[['Shardling',1,'shard3','prismWard'],['Facetling',10,'shard5','prismWard'],['Prismheart',20,'shard5p','shardStorm'],['Diamantine',30,'shardSplit','mirrorField',['vig',7]]],
  prismoth:[['Prismoth',1,'shard3','prismWard'],['Lumimoth',12,'shard5','prismWard'],['Spectramoth',22,'orbit','shardStorm'],['Auroramoth',32,'prismBeam','mirrorField',['hst',7]]],
  geodon:[['Geodon',1,'shard5','prismWard'],['Amethortoise',15,'orbit','shardStorm'],['Gemcitadel',28,'shardSplit','mirrorField',['vig',7]]],
  pebblet:[['Pebblet',1,'slam','taunt'],['Rollstone',10,'slam','taunt'],['Boulderling',20,'rollBoulder','quake'],['Avalanchion',30,'boulderLob','fortress',['vig',7]]],
  bastion:[['Bastion',1,'slam','taunt'],['Bulwark',12,'slamShock','taunt'],['Rampart',22,'slamShock','quake'],['Citadelion',32,'quakeSlam','fortress',['tmp',7]]],
  monolord:[['Monolord',1,'runeBolt','taunt'],['Obelord',15,'runeHoming','quake'],['Pantheon',28,'boulderLob','fortress',['pow',7]]],
  blazewing:[['Blazewing',1,'emberFan','gustDash'],['Phoenixwing',20,'foxfire','skyStrike']],
  bogbloom:[['Bogbloom',1,'bubbleBounce','sporeField'],['Mirelord',20,'whirlpool','rotCloud']],
  resonyx:[['Resonyx',1,'shard5','echoPing'],['Harmonyx',20,'prismBeam','stormCall']],
  forgeheart:[['Forgeheart',1,'slamShock','flameRing'],['Anvilheart',20,'quakeSlam','infernoNova']],
  squallfin:[['Squallfin',1,'diveFast','tideShield'],['Stormfin',20,'diveRing','deluge']],
  duskcap:[['Duskcap',1,'sporeFan','echoPing'],['Nightbloom',20,'sporeMortar','sonicBoom']],
  gemguard:[['Gemguard',1,'shard5p','taunt'],['Jewelward',20,'orbit','fortress']],
};
const LINES={};
for(const k in LINE_DATA)LINES[k]=LINE_DATA[k].map(([name,lv,atk,abil,need])=>({name,lv,atk,abil,need:need||null}));

/* ================= Elements and reactions ================= */
const ELEM={burn:{name:'Burning',col:'#ff7a3d'},spore:{name:'Spored',col:'#b8f06a'},soak:{name:'Soaked',col:'#5cc8ff'},static:{name:'Static',col:'#c8a8ff'},gust:{name:'Buffeted',col:'#4fe0c8'},brittle:{name:'Brittle',col:'#ffffff'},stagger:{name:'Staggered',col:'#e3b04b'}};
const REACTIONS=[
  {a:'burn',b:'soak',name:'Steam Burst',col:'#e8f4ff',desc:'Burning + Soaked: a scalding blast hits everything nearby.'},
  {a:'burn',b:'spore',name:'Combustion',col:'#ffb347',desc:'Burning + Spored: the spores explode.'},
  {a:'soak',b:'static',name:'Electrocute',col:'#c8a8ff',desc:'Soaked + Static: lightning chains to up to four foes.'},
  {a:'spore',b:'soak',name:'Overgrowth',col:'#7fd860',desc:'Spored + Soaked: roots hold the foe in place.'},
  {a:'brittle',b:'gust',name:'Shatter',col:'#ffffff',desc:'Brittle + Buffeted: the foe cracks for triple damage.'},
  {a:'brittle',b:'stagger',name:'Shatter',col:'#ffffff',desc:'Brittle + Staggered: the foe cracks for triple damage.'},
  {a:'static',b:'gust',name:'Thunderclap',col:'#fff6a8',desc:'Static + Buffeted: a thunderclap stuns the foe.'},
];
const reactionFor=(x,y)=>REACTIONS.find(r=>(r.a===x&&r.b===y)||(r.a===y&&r.b===x));

/* ================= Combos (slot 1 + slot 2 types) ================= */
const COMBOS={
  'ember+gale':{name:'Fire Tornado',desc:'A burning twister rolls toward your aim.'},
  'crystal+tide':{name:'Refracting Shield',desc:'You are shielded for 3s and reflect bullets for 5s.'},
  'ember+fungal':{name:'Spore Blast',desc:'Explosions burst on every enemy nearby, burning and sporing them.'},
  'fungal+tide':{name:'Bog Bloom',desc:'Heals the party and soaks and slows enemies in a wide pool.'},
  'crystal+echo':{name:'Resonance',desc:'Stuns every enemy in the room for 2s and makes them brittle.'},
  'gale+tide':{name:'Storm Surge',desc:'Three rings of soaking bubbles.'},
  'echo+tide':{name:'Thunderstorm',desc:'Soaks and charges every enemy in the room, setting off Electrocute.'},
  'ember+warden':{name:'Molten Fortress',desc:'The party takes half damage for 5s inside a ring of fire.'},
  'echo+gale':{name:'Sky Splitter',desc:'Lightning strikes every enemy in the room.'},
  'crystal+warden':{name:'Diamond Wall',desc:'Taunts enemies for 5s, reflects bullets and staggers them.'},
};
const comboKey=(a,b)=>[a,b].sort().join('+');
const comboFor=(a,b)=>COMBOS[comboKey(a,b)]||(a===b?{name:'Twin Fury',desc:'Both companions attack twice as fast and hit 25% harder for 5s.'}:{name:'Pack Rally',desc:'Both companions attack 60% faster for 5s.'});

/* ================= Personalities ================= */
const PERS={
  brave:{name:'Brave',desc:'Chases enemies farther. +10% attack.'},
  timid:{name:'Timid',desc:'Sticks close to you. Takes 15% less damage.'},
  greedy:{name:'Greedy',desc:'Enemies it defeats drop 50% more coin.'},
  curious:{name:'Curious',desc:'Sniffs out hollow walls and secret rooms.'},
  loyal:{name:'Loyal',desc:'Always obeys. Gains bond 50% faster.'},
  fierce:{name:'Fierce',desc:'+10% critical hit chance.'},
  calm:{name:'Calm',desc:'Ability recharges 15% faster.'},
  playful:{name:'Playful',desc:'Moves 15% faster and earns 20% more XP.'},
};
const PERS_IDS=Object.keys(PERS);

/* ================= Bond ================= */
const BOND_TH=[0,60,180,400,750];
const BOND_PASSIVE={
  ember:{name:'Kindling',desc:'Its burns deal 50% more damage.'},
  fungal:{name:'Mend',desc:'Heals you 1.5 HP per second while it is near you.'},
  tide:{name:'Undertow',desc:'Enemies it soaks are also slowed.'},
  echo:{name:'Keen Ears',desc:'Hears hollow walls from twice as far.'},
  gale:{name:'Tailwind',desc:'You move 8% faster while it fights beside you.'},
  crystal:{name:'Facet Guard',desc:'10% chance to block a hit aimed at you.'},
  warden:{name:'Bulwark',desc:'Enemies prefer to attack it over you.'},
};
const BOND_PERKS=['Bonded','+5% HP and attack','Bond passive unlocked','+12% HP and attack','Last Stand: survives one knockout per raid and unleashes its ability'];

/* ================= Genes & traits ================= */
const GENES={vig:'Vigor',pow:'Power',swf:'Swift',hst:'Haste',tmp:'Temper'};
const GENE_HINT={vig:'max HP',pow:'attack',swf:'move speed',hst:'attack speed',tmp:'obedience when wild'};
const TRAITS={
  thick:{name:'Thick Hide',desc:'+12% max HP',w:3},
  glow:{name:'Glowcore',desc:'+10% attack',w:3},
  quick:{name:'Quickfoot',desc:'+12% move speed',w:3},
  rapid:{name:'Rapid Pulse',desc:'+15% attack speed',w:3},
  keen:{name:'Keen Eye',desc:'15% chance to deal double damage',w:2},
  sturdy:{name:'Sturdy',desc:'Takes 15% less damage',w:2},
  regen:{name:'Regrowth',desc:'Heals 1.5% of max HP per second in raids',w:2},
  reach:{name:'Long Reach',desc:'Shots fly 30% farther and faster',w:2},
  focus:{name:'Focused',desc:'Ability recharges 20% faster',w:2},
  vamp:{name:'Leech Fang',desc:'Heals 8% of the damage it deals',w:1.5},
  lucky:{name:'Lucky Charm',desc:'+10% capture chance while in your party',w:1.5},
  hoard:{name:'Hoarder',desc:'+15% coin from raids it survives',w:1.5},
  worker:{name:'Hard Worker',desc:'+50% contribution to hideout sections',w:2},
  lazy:{name:'Drowsy',desc:'Ability recharges 25% slower',w:1.2},
  frail:{name:'Frail',desc:'-10% max HP',w:1.2},
  clumsy:{name:'Clumsy',desc:'-10% move speed',w:1.2},
};
const TRAIT_IDS=Object.keys(TRAITS);
const NEG_TRAITS=['lazy','frail','clumsy'];
function rollTraits(n,exclude=[],posOnly){const out=[];let g=0;while(out.length<n&&g++<200){const t=wpick(TRAIT_IDS,k=>TRAITS[k].w);if(posOnly&&NEG_TRAITS.includes(t))continue;if(!out.includes(t)&&!exclude.includes(t))out.push(t)}return out}

/* ================= Weapons ================= */
const GUNS={
  pistol:{name:'Scav Pistol',tier:0,dmg:7,rate:2.6,spread:.05,speed:540,life:1.1,col:'#ffe38a',desc:'Never lost. Reliable but weak.'},
  revolver:{name:'Revolver',tier:1,dmg:17,rate:1.4,spread:.02,speed:640,life:1.2,col:'#ffd27a',desc:'Heavy single shots.'},
  scatter:{name:'Scattergun',tier:1,dmg:5,rate:1.2,spread:.32,speed:480,pellets:5,life:.6,col:'#ffb347',desc:'Five pellets. Brutal up close.'},
  repeater:{name:'Repeater',tier:1,dmg:4,rate:7,spread:.15,speed:560,life:.9,col:'#9dffcf',desc:'Sprays fast, low damage per shot.'},
  galefan:{name:'Gale Fan',tier:1,dmg:5,rate:2.2,spread:.22,speed:640,pellets:3,life:.45,col:'#4fe0c8',elem:'gust',desc:'Three short-range darts that buffet.'},
  carbine:{name:'Ember Carbine',tier:2,dmg:7,rate:1.5,burst:3,burstGap:.08,spread:.04,speed:600,life:1,col:'#ff7a3d',elem:'burn',desc:'Three-round bursts that burn.'},
  longbow:{name:'Longbow',tier:2,dmg:28,rate:.85,speed:840,pierce:1,life:1.4,col:'#e8d8a8',r:5,desc:'Slow arrows that pierce one foe.'},
  spore:{name:'Spore Launcher',tier:2,dmg:12,rate:1,speed:340,explode:62,life:.8,col:'#e0527a',r:6,elem:'spore',desc:'Bursting pods that spore an area.'},
  tidecaster:{name:'Tidecaster',tier:2,dmg:8,rate:2,speed:380,bounce:2,life:1.8,col:'#5cc8ff',r:7,elem:'soak',desc:'Soaking bubbles that bounce twice.'},
  echorifle:{name:'Echo Rifle',tier:2,dmg:11,rate:1.8,speed:720,pierce:2,life:1.2,col:'#9b7bff',elem:'static',desc:'Charged shots that pierce two foes.'},
  prism:{name:'Prism Splitter',tier:3,dmg:10,rate:1.6,speed:520,split:3,life:1.1,col:'#ff8fe0',r:6,elem:'brittle',desc:'Splits in three and makes foes brittle.'},
  mortar:{name:'Warden Mortar',tier:3,dmg:24,rate:.65,speed:300,explode:95,life:1,col:'#e3b04b',r:8,elem:'stagger',desc:'Big shells that stagger.'},
  hex:{name:'Hexblaster',tier:3,dmg:9,rate:2.2,speed:300,homing:3.5,life:2,col:'#c27bff',r:6,elem:'static',desc:'Charged orbs that curve to enemies.'},
  gatling:{name:'Thunder Gatling',tier:3,dmg:4,rate:12,spread:.2,speed:600,spin:true,life:.9,col:'#7fd7ff',desc:'Spins up to a storm of bullets.'},
  lance:{name:'Arc Lance',tier:3,dmg:21,rate:1.1,speed:760,pierce:9,life:1.3,col:'#7fd7ff',r:6,elem:'static',desc:'A charged line that pierces all.'},
  starfall:{name:'Starfall Staff',tier:4,dmg:10,rate:1,ring:8,speed:420,life:1,col:'#ffe066',r:6,elem:'brittle',desc:'A ring of eight brittle stars.'},
  dagger:{name:'Dagger',melee:true,tier:1,dmg:11,rate:3.4,range:36,arc:1.3,col:'#d8d0f0',desc:'Quick stabs. Cuts bullets in a narrow arc.'},
  sword:{name:'Ironbrand',melee:true,tier:1,dmg:18,rate:2,range:46,arc:1.9,col:'#e8e8f8',desc:'Balanced sword. Cuts bullets in front of you.'},
  spear:{name:'Pike',melee:true,tier:2,dmg:20,rate:1.6,range:70,arc:.6,lunge:120,col:'#c9b48a',desc:'Long thrust that carries you forward.'},
  whip:{name:'Thornlash',melee:true,tier:2,dmg:13,rate:2.3,range:84,arc:.9,col:'#7fc85a',elem:'spore',desc:'Long reach that spores foes.'},
  hammer:{name:'Quake Maul',melee:true,tier:2,dmg:34,rate:.9,range:48,arc:2.3,knock:40,shock:70,col:'#b8862f',elem:'stagger',desc:'Crushing blows that stagger.'},
  scythe:{name:'Reaper Scythe',melee:true,tier:3,dmg:24,rate:1.4,range:60,arc:3.2,reflect:true,col:'#9b7bff',desc:'Huge sweep that sends bullets back.'},
  fangs:{name:'Twin Fangs',melee:true,tier:3,dmg:9,hits:2,rate:3,range:38,arc:1.5,leech:.06,col:'#ff6688',elem:'burn',desc:'Burning double slashes that heal you.'},
  moonblade:{name:'Moonblade',melee:true,tier:4,dmg:26,rate:1.6,range:54,arc:2.4,wave:true,reflect:true,col:'#7fd7ff',elem:'brittle',desc:'Crescent waves that reflect bullets.'},
};
const GUN_IDS=Object.keys(GUNS);
const WEAPON_COST={1:{coin:60,ore:4},2:{coin:110,ore:8},3:{coin:180,ore:14},4:{coin:320,ore:26}};
const SCRAP_ORE=[0,3,6,10,16];
const DONATE_PTS=[0,10,25,55,100];

/* ================= Run buffs and curses ================= */
const BUFFS={
  dmg:{name:'Sharpened Edge',desc:'+15% weapon damage'},
  rate:{name:'Hair Trigger',desc:'+15% attack speed'},
  speed:{name:'Swift Boots',desc:'+12% move speed'},
  hp:{name:'Heartstone',desc:'+25 max HP and heal 25'},
  pdmg:{name:'Pack Fury',desc:'Companions deal 20% more damage'},
  ptough:{name:'Pack Hide',desc:'Companions take 20% less damage'},
  cage:{name:'Wide Snare',desc:'+40% cage radius, +10% capture chance'},
  roll:{name:'Featherstep',desc:'Roll recharges 35% faster'},
  leech:{name:'Leech Charm',desc:'Heal 1 HP for every 25 damage you deal'},
  pierce:{name:'Drill Tips',desc:'Your shots pierce one more enemy'},
  abil:{name:'Quick Bond',desc:'Companion abilities recharge 25% faster'},
  greed:{name:'Greedy Eye',desc:'+30% coin found'},
  time:{name:'Hourglass Shard',desc:'+60 seconds on the raid clock'},
};
const BUFF_IDS=Object.keys(BUFFS);
const CURSES={
  glass:{name:'Glass Cannon',desc:'+40% weapon damage, but −30 max HP.'},
  blood:{name:'Blood Pact',desc:'+30% attack speed, but you cannot heal.'},
  doom:{name:'Doom Clock',desc:'+25% move speed, but lose 90 seconds on the clock.'},
  toll:{name:'Greed’s Toll',desc:'+60% coin, but enemies have 25% more HP.'},
  feral:{name:'Feral Pact',desc:'Companions deal +40% damage, but abilities recharge 50% slower.'},
  blind:{name:'Blind Faith',desc:'+1 pierce and +20% damage, but no minimap.'},
};
const CURSE_IDS=Object.keys(CURSES);

/* ================= Room modifiers ================= */
const ROOM_MODS={
  dark:{name:'Darkness',desc:'You can only see close to you.',col:'#6a5cab'},
  slick:{name:'Slick Floor',desc:'You slide when you move.',col:'#9fe8ff'},
  fog:{name:'Poison Fog',desc:'You and your companions lose health until the room is clear.',col:'#7fd860'},
  golden:{name:'Golden Room',desc:'Enemies drop double coin.',col:'#ffcf4a'},
  silence:{name:'Silence',desc:'Companion abilities and combos are sealed.',col:'#b4a9d8'},
  frenzy:{name:'Frenzy',desc:'Enemies attack faster. Companions earn 50% more XP.',col:'#ff5c7a'},
};
const ROOM_MOD_IDS=Object.keys(ROOM_MODS);

/* ================= Hideout sections ================= */
const SEC_TH=[15,45,100,180,300];
const SECTIONS={
  forge:{name:'Forge',type:'ember',gene:'pow',col:'#ff7a3d',blurb:'Ember creatures stoke the furnace. Unlocks weapon tiers you can craft.',
    tiers:['Craft tier 1 weapons you have blueprints for','Craft tier 2 weapons','Gilded cages and +50% ore from scrapping','Craft tier 3 weapons','Craft tier 4 weapons and +10% weapon damage']},
  garden:{name:'Garden',type:'fungal',gene:'vig',col:'#7fd860',blurb:'Fungal creatures grow food for the whole hideout.',
    tiers:['3 food per day','6 food per day','10 food per day','15 food per day','22 food per day']},
  spring:{name:'Spring',type:'tide',gene:'tmp',col:'#3fa9ff',blurb:'Tide creatures tend the healing waters.',
    tiers:['Creatures heal 50% per day','Creatures heal fully each day','Every creature gains 5 bond per day','Companions get +10% max HP in raids','One free auto-revive per raid']},
  roost:{name:'Roost',type:'echo',gene:'swf',col:'#9b7bff',blurb:'Echo creatures scout the dungeon ahead of you.',
    tiers:['Reveal the full floor map','Mark rooms that hold rare creatures','Show secret rooms on the map','+30% wild creature encounters','Reveal which boss waits below']},
  vault:{name:'Vault',type:'crystal',gene:'vig',col:'#ff8fe0',blurb:'Crystal creatures guard what you bring back.',
    tiers:['Keep your slot 3 creature if you die','Keep the weapons in your hands if you die','Keep 30% of raid coin if you die','Your slot 1 companion survives your death','Keep 60% of raid coin and all ore if you die']},
  nursery:{name:'Nursery',type:'warden',gene:'tmp',col:'#e3b04b',blurb:'Warden creatures watch over eggs. Needed for any breeding.',
    tiers:['Breed one egg at a time, 2-day hatch','Two eggs at once','Eggs hatch in 1 day','Mutations 25%, hybrid odds 15%','Three eggs, hybrids 20%, hatchlings start at Lv 5']},
  training:{name:'Training Grounds',type:null,gene:'pow',unlock:2,col:'#c9b48a',blurb:'Any creature placed here trains every day for XP and bond. Trainees eat 2 food a day.',
    tiers:['Trainees gain 30 XP a day','45 XP a day and the Gene Lab opens','60 XP a day','75 XP a day and the Trait Tutor opens','100 XP a day']},
  warroom:{name:'War Room',type:'gale',gene:'swf',unlock:4,col:'#4fe0c8',blurb:'Gale creatures plan raids. Unlocks bonuses and raid modes.',
    tiers:['+10 max HP for you','Unlocks the Hunter’s Moon mode','+10% weapon damage','Unlocks the Iron Will mode','Start every raid with a random buff, unlocks Swarm mode']},
};
const SECTION_IDS=Object.keys(SECTIONS);
const ARMORY_TH=[40,120,260,480,800];
const ARMORY_TIERS=['+5% weapon damage','Carry 1 more cage','+10% weapon damage in total','Keep your primary weapon if you die','+20% weapon damage in total'];
const MODES={
  hunter:{name:'Hunter’s Moon',need:['warroom',2],desc:'Twice as many wild creatures. Enemies have 20% more HP. +20% Keeper XP.'},
  iron:{name:'Iron Will',need:['warroom',4],desc:'Enemies hit 40% harder. +60% coin and +50% Keeper XP.'},
  swarm:{name:'Swarm',need:['warroom',5],desc:'Two more enemies per room. +30% coin and more buff orbs.'},
};
const KEEPER_PERKS={2:'Training Grounds unlocked, Pip the scout arrives',3:'Armory unlocked',4:'War Room unlocked, Dr. Sorrel arrives',5:'Carry 1 more cage',7:'Every section gains 1 free slot',9:'Carry 1 more cage',12:'Every section gains 1 free slot'};

/* ================= Research ================= */
const RESEARCH={
  combat:{name:'Combat',col:'#ff6688',nodes:['+15 max HP','+8% weapon damage','Roll recharges 20% faster','Elemental reactions deal 30% more damage','Start every raid with a random buff']},
  capture:{name:'Capture',col:'#ffcf4a',nodes:['Carry 1 more cage','Cage ring 25% wider','+10% capture chance','Catch below 60% health instead of 50%','+25% wild creature encounters']},
  breeding:{name:'Breeding',col:'#ff8fe0',nodes:['+5% mutation chance','Eggs hatch 1 day sooner','+5% hybrid chance','+1 incubator slot','Hatchlings start at Lv 5']},
  economy:{name:'Economy',col:'#7fd860',nodes:['+15% coin from raids','Market prices 20% lower','+50% ore from chests','+3 food per day','+15% Keeper XP']},
  bond:{name:'Bond',col:'#58c2ff',nodes:['+50% bond gain','Companions +10% max HP','Combos recharge 25% faster','Abilities recharge 10% faster','Evolution costs halved']},
};
const RES_IDS=Object.keys(RESEARCH);
const RES_COST=[{coin:50,ore:10,shard:0},{coin:100,ore:25,shard:0},{coin:200,ore:45,shard:1},{coin:350,ore:70,shard:2},{coin:500,ore:100,shard:3}];

/* ================= Enemies ================= */
const FOES={
  husk:{name:'Husk',set:0,intro:1,body:'blob',col:'#7d9150',bcol:'#ff6b6b',hp:34,spd:60,r:13,dmg:7,fire:{kind:'fan',n:1,spread:0,spd:190,every:2.6},lore:'Hollow shells the Bloom grows to fill empty rooms.'},
  hexbat:{name:'Hexbat',set:0,intro:1,body:'bat',col:'#7d43b8',bcol:'#c27bff',hp:22,spd:105,r:11,dmg:6,fire:{kind:'ring',n:6,spd:135,every:3.4},lore:'Bats whose tethers went sour.'},
  grubling:{name:'Grubling',set:0,intro:1,body:'grub',col:'#c98a5a',hp:30,spd:80,r:12,dmg:9,melee:true,fire:{kind:'charge',every:2.6,cspd:360},lore:'Root-eating larvae. They charge anything warm.'},
  sporetotem:{name:'Spore Totem',set:0,intro:1,body:'totem',col:'#6aa84f',bcol:'#b8f06a',hp:46,spd:0,r:14,dmg:7,fire:{kind:'cross',spd:140,every:2.8},lore:'A stump the Bloom uses as a turret.'},
  wisp:{name:'Wisp',set:0,intro:1,body:'wisp',col:'#9fe8ff',bcol:'#9fe8ff',hp:20,spd:120,r:10,dmg:6,fire:{kind:'homing',n:1,spd:120,turn:1.2,every:3},lore:'A loose scrap of tether that learned to float.'},
  slimelet:{name:'Slimelet',set:0,intro:1,body:'slime',col:'#7fd860',bcol:'#c8ff8a',hp:40,spd:45,r:14,dmg:7,split:{id:'slimeling',n:2},fire:{kind:'ring',n:4,spd:120,every:3,rot:.4},lore:'Sap given a body. Splits when struck.'},
  thornimp:{name:'Thorn Imp',set:0,intro:1,body:'imp',col:'#c84a3a',bcol:'#ff9a5c',hp:28,spd:90,r:11,dmg:7,fire:{kind:'fan',n:3,spread:.5,spd:180,every:2.8,blink:true},lore:'Pranksters that blink through the roots.'},
  rattler:{name:'Rattler',set:0,intro:1,body:'spider',col:'#8a6a4a',bcol:'#ffd27a',hp:26,spd:130,r:11,dmg:6,fire:{kind:'burst',n:3,gap:.15,spd:220,every:2.8},lore:'Fast spiders that spit in bursts.'},
  hollowknight:{name:'Hollow Knight',set:0,intro:2,body:'knight',col:'#5f8f8a',bcol:'#9fffe8',hp:70,spd:70,r:14,dmg:10,melee:true,fire:{kind:'charge',every:2.8,cspd:380,fan:5},lore:'Armor of keepers who fell. Nothing is inside.'},
  gazer:{name:'Gazer',set:0,intro:2,body:'eye',col:'#d84f7f',bcol:'#ff9bbf',hp:60,spd:30,r:14,dmg:8,fire:{kind:'spiral',n:2,spd:120,every:.5,step:.3},lore:'The Bloom watches through these.'},
  revenant:{name:'Revenant',set:0,intro:3,body:'skull',col:'#e8e0c8',bcol:'#ff5ca8',hp:80,spd:60,r:14,dmg:10,fire:{kind:'fan',n:5,spread:.9,spd:200,every:3,waves:2},lore:'What the roots leave of a fallen keeper.'},
  ogrolem:{name:'Ogrolem',set:0,intro:3,body:'brute',col:'#6b2a3a',bcol:'#ffa04f',hp:180,spd:45,r:20,dmg:12,melee:true,fire:{kind:'brute',n:10,spd:130,every:2.8},lore:'Stone and root packed into a fist.'},
  magmahusk:{name:'Magma Husk',set:1,intro:4,body:'blob',col:'#d9452b',bcol:'#ffb347',hp:120,spd:70,r:14,dmg:14,fire:{kind:'fan',n:3,spread:.4,spd:230,every:2.4},lore:'Husks baked by the Abyss heat.'},
  voidbat:{name:'Voidbat',set:1,intro:4,body:'bat',col:'#2a1c4f',bcol:'#b05cff',hp:90,spd:125,r:12,dmg:12,fire:{kind:'ring',n:10,spd:150,every:3.4,waves:2,rot:.31},lore:'They do not cast shadows.'},
  dreadmaw:{name:'Dreadmaw',set:1,intro:4,body:'grub',col:'#8f2a3a',bcol:'#ff7a5c',hp:130,spd:95,r:16,dmg:16,melee:true,fire:{kind:'charge',every:2.4,cspd:440,ring:8,rspd:130},lore:'Grublings that never stopped eating.'},
  runetotem:{name:'Rune Totem',set:1,intro:4,body:'totem',col:'#4f7fd8',bcol:'#7fd7ff',hp:160,spd:0,r:14,dmg:12,fire:{kind:'spiral',n:3,spd:135,every:.55,step:.24},lore:'Carved by someone. Ilsa’s notes mention runes.'},
  shadewisp:{name:'Shade Wisp',set:1,intro:4,body:'wisp',col:'#6a4ad8',bcol:'#c8a8ff',hp:70,spd:140,r:11,dmg:11,fire:{kind:'homing',n:2,spd:130,turn:1.5,every:2.8},lore:'Wisps that remember a name.'},
  acidslime:{name:'Acid Slime',set:1,intro:4,body:'slime',col:'#c8e83a',bcol:'#f0ff7a',hp:150,spd:50,r:16,dmg:12,split:{id:'acidling',n:3},fire:{kind:'ring',n:8,spd:130,every:3,rot:.2},lore:'Sap gone bad in the deep heat.'},
  heximp:{name:'Hex Imp',set:1,intro:4,body:'imp',col:'#8a2ad8',bcol:'#e05cff',hp:100,spd:100,r:12,dmg:12,fire:{kind:'ring',n:6,spd:160,every:2.8,blink:true},lore:'Imps that learned spite.'},
  weaver:{name:'Weaver',set:1,intro:4,body:'spider',col:'#3a3a5a',bcol:'#e8e8ff',hp:95,spd:140,r:12,dmg:11,fire:{kind:'fan',n:5,spread:.8,spd:170,every:2.8,slow:1.2},lore:'They spin tether into webs.'},
  dreadknight:{name:'Dread Knight',set:1,intro:5,body:'knight',col:'#3a2a5a',bcol:'#ff5c7a',hp:240,spd:80,r:15,dmg:18,melee:true,fire:{kind:'charge',every:2.6,cspd:440,fan:7},lore:'Hollow Knights that found a will.'},
  tyranteye:{name:'Tyrant Eye',set:1,intro:5,body:'eye',col:'#ff3a5c',bcol:'#ffd0dc',hp:220,spd:35,r:16,dmg:14,fire:{kind:'spiral',n:3,spd:135,every:.5,step:.27},lore:'Closer to the heart, the Bloom watches harder.'},
  lich:{name:'Lich',set:1,intro:6,body:'skull',col:'#a8f0e0',bcol:'#5cffc8',hp:260,spd:55,r:15,dmg:16,summon:'shadewisp',fire:{kind:'fan',n:5,spread:.9,spd:210,every:3,waves:3},lore:'A keeper who stopped resisting the roots.'},
  colossus:{name:'Colossus',set:1,intro:6,body:'brute',col:'#3a2a5a',bcol:'#ff5c7a',hp:600,spd:50,r:23,dmg:20,melee:true,fire:{kind:'brute',n:14,spd:150,every:2.6},lore:'It guards something below.'},
  slimeling:{name:'Slimeling',set:0,intro:99,body:'slime',col:'#a8ff8a',bcol:'#c8ff8a',hp:12,spd:80,r:9,dmg:5,melee:true,fire:{kind:'none',every:9}},
  acidling:{name:'Acidling',set:1,intro:99,body:'slime',col:'#e8ff7a',bcol:'#f0ff7a',hp:40,spd:90,r:10,dmg:9,melee:true,fire:{kind:'none',every:9}},
  dummy:{name:'Training Dummy',set:0,intro:99,body:'totem',col:'#c9b48a',bcol:'#c9b48a',hp:30,spd:0,r:14,dmg:0,fire:{kind:'none',every:9}},
};
const FOE_IDS=Object.keys(FOES).filter(k=>FOES[k].intro<99);
function foePool(floor){const set=floor<=3?0:1,local=(floor-1)%3+1+set*3;return FOE_IDS.filter(k=>FOES[k].set===set&&FOES[k].intro<=local)}
const WILD_FIRE={
  ember:{kind:'fan',n:1,spread:0,spd:250,every:2.3},
  fungal:{kind:'fan',n:3,spread:.6,spd:150,every:2.7,slow:1},
  tide:{kind:'fan',n:2,spread:.25,spd:170,every:2.5},
  echo:{kind:'burst',n:2,gap:.15,spd:280,every:2.5},
  crystal:{kind:'ring',n:6,spd:150,every:3,rot:.25},
  gale:{kind:'charge',every:2.3,cspd:460},
  warden:{kind:'ring',n:8,spd:120,every:3.3},
};

/* ================= Bosses ================= */
const BOSSES={
  bloom:{name:'Mother Bloom',set:0,body:'bloom',col:'#e0527a',col2:'#7fd860',bcol:'#ffd1de',hp:3800,r:40,spd:0,move:'still',dmg:13,
    blurb:'A rooted flower that floods the room with spores and spawns slimes.',
    lore:'Before she rooted, she was Ilsa’s first companion: a Puffcap named Biscuit. The Bloom keeps what it takes and grows it into something it can use. Some part of her still turns toward the hideout’s light.',
    p1:[['spiral',{arms:3,spd:120,dur:2.4,step:.22,every:.18}],['ring',{n:22,spd:130,gap:4}],['summon',{foe:'slimelet',n:2}],['fan',{n:7,spread:1,spd:170,waves:2}]],
    p2:[['spiral',{arms:5,spd:130,dur:3,step:.2,every:.16}],['ring',{n:26,spd:140,gap:4,waves:2}],['summon',{foe:'slimelet',n:3}],['rain',{n:18,spd:110}]]},
  wyrm:{name:'Cinder Wyrm',set:0,body:'wyrm',col:'#ff6a3d',col2:'#ffd23f',bcol:'#ffb347',hp:3400,r:30,spd:115,move:'circle',dmg:14,
    blurb:'A burning serpent that circles you, breathes fire and dashes trailing embers.',
    lore:'The Wyrm was a Mycelisk that swallowed a forge coal from the old Keepers’ camp. It never stopped burning. The scorch marks on Floor 3 are a hundred years old.',
    p1:[['fan',{n:9,spread:1.2,spd:200}],['dash',{spd:420,dur:.9,trail:true}],['ring',{n:16,spd:140}]],
    p2:[['line',{n:14,spd:260,spread:.18,ways:3}],['dash',{spd:500,dur:1,trail:true}],['ring',{n:20,spd:150,waves:2}],['burst',{n:5,gap:.12,spd:260}]]},
  king:{name:'The Hollow King',set:0,body:'king',col:'#8a6fb3',col2:'#ffcf4a',bcol:'#c8a8ff',hp:4000,r:32,spd:70,move:'stalk',dmg:15,
    blurb:'A crowned knight that blinks around the room, cutting lines of blades and calling his guard.',
    lore:'The first Keeper. He tried to rule the Bloom instead of leaving it. It let him, and hollowed him out from the inside. The knights that follow him are his old crew.',
    p1:[['line',{n:12,spd:280,spread:0,ways:1}],['blink',{ring:12,spd:150}],['summon',{foe:'hollowknight',n:1}],['fan',{n:7,spread:1.1,spd:190}]],
    p2:[['line',{n:14,spd:300,spread:.5,ways:3}],['blink',{ring:16,spd:160}],['summon',{foe:'hollowknight',n:2}],['cross',{dur:2.5,spd:170,every:.2}]]},
  roc:{name:'Storm Roc',set:0,body:'roc',col:'#4fe0c8',col2:'#3f8fd8',bcol:'#c8fff4',hp:3300,r:34,spd:90,move:'hover',dmg:13,
    blurb:'A thunderbird that dives across the room and scatters feather volleys.',
    lore:'The Roc was born in the Bloom and never cut free. It has flown the same three floors its whole life, looking for a sky. Its feathers still smell like rain.',
    p1:[['dash',{spd:560,dur:.7,trail:false,ring:10}],['fan',{n:11,spread:1.6,spd:180}],['ring',{n:18,spd:150,gap:3}]],
    p2:[['dash',{spd:620,dur:.8,trail:true,ring:14}],['fan',{n:13,spread:1.8,spd:190,waves:2}],['homing',{n:6,spd:140,turn:1.4}],['ring',{n:22,spd:160,gap:3}]]},
  leviathan:{name:'Abyssal Leviathan',set:1,body:'wyrm',col:'#2f6bff',col2:'#3fd0c0',bcol:'#9fe8ff',hp:15000,r:38,spd:120,move:'circle',dmg:30,
    blurb:'A sea serpent that surrounds you in tidal rings with one way out.',
    lore:'There is an underground sea below the Abyss, and the Leviathan is how the Bloom drinks it. Ilsa’s Tidewyrm, Marrowtail, went into the water after her and came back as this.',
    p1:[['ring',{n:30,spd:130,gap:5,waves:2}],['dash',{spd:480,dur:1,trail:true}],['fan',{n:11,spread:1.3,spd:210,waves:2}]],
    p2:[['ring',{n:34,spd:140,gap:5,waves:3}],['dash',{spd:560,dur:1.1,trail:true,ring:16}],['spiral',{arms:4,spd:140,dur:3,step:.2,every:.15}],['rain',{n:24,spd:130}]]},
  matriarch:{name:'Crystal Matriarch',set:1,body:'diamond',col:'#ff8fe0',col2:'#c49bff',bcol:'#ffd0f4',hp:14000,r:36,spd:50,move:'stalk',dmg:28,
    blurb:'A living geode that splits light into crossing beams and shard storms.',
    lore:'Every crystal creature on the upper floors is a chip off her. She sheds them so they can wander up toward the light, because she cannot.',
    p1:[['line',{n:16,spd:300,spread:.7,ways:3}],['ring',{n:24,spd:150}],['burst',{n:7,gap:.1,spd:280}],['blink',{ring:18,spd:160}]],
    p2:[['line',{n:18,spd:320,spread:.45,ways:5}],['cross',{dur:3,spd:180,every:.16}],['ring',{n:28,spd:160,waves:2,gap:3}],['homing',{n:8,spd:150,turn:1.6}]]},
  choir:{name:'Void Choir',set:1,body:'choir',col:'#6a4ad8',col2:'#ff3a5c',bcol:'#e8c8ff',hp:13500,r:34,spd:40,move:'hover',dmg:27,
    blurb:'Three watching eyes that sing spirals in harmony and call shades.',
    lore:'Three Echo creatures that tried to call for help from the deep and were heard by the wrong thing. They still sing. Ilsa wrote down the melody. It is the song the hideout music box plays.',
    p1:[['spiral',{arms:6,spd:130,dur:3,step:.17,every:.17}],['summon',{foe:'shadewisp',n:3}],['fan',{n:9,spread:1.2,spd:200,waves:2}]],
    p2:[['spiral',{arms:8,spd:140,dur:3.5,step:-.16,every:.15}],['summon',{foe:'shadewisp',n:4}],['homing',{n:8,spd:150,turn:1.6}],['ring',{n:30,spd:150,gap:4,waves:2}]]},
  prime:{name:'Iron Colossus Prime',set:1,body:'prime',col:'#4a4a6a',col2:'#ff5c7a',bcol:'#ffa04f',hp:16000,r:42,spd:60,move:'stalk',dmg:32,
    blurb:'A walking siege engine. Slams send shockwaves; launchers fire seeking shells.',
    lore:'The old Keepers built it to dig straight down to the heart. It reached the sixth floor before the roots got into its gears. It still digs in its sleep.',
    p1:[['ring',{n:24,spd:150,waves:2}],['homing',{n:6,spd:150,turn:1.3}],['dash',{spd:380,dur:.8,trail:false,ring:20}],['fan',{n:9,spread:1,spd:220}]],
    p2:[['ring',{n:30,spd:160,waves:3,gap:3}],['homing',{n:10,spd:160,turn:1.5}],['dash',{spd:440,dur:.9,trail:true,ring:24}],['line',{n:16,spd:300,spread:.3,ways:3}]]},
};
const BOSS_IDS=Object.keys(BOSSES);

/* ================= Keeper's journal (one per rank) ================= */
const JOURNAL=[
  {rank:1,title:'To whoever finds this',text:'If you are reading this at my desk, I did not come back. The hideout is yours. Feed the creatures before you feed yourself, and never go deeper than your companions can carry you. — Ilsa Marrow, Keeper'},
  {rank:2,title:'The tether',text:'Every creature born in the Bloom has a root-thread in its chest. I call it the tether. Inside, the Bloom can pull on it at any time. Extraction points are the only places where the thread thins enough to cut. That is why we leave with them, never without them.'},
  {rank:3,title:'Why the dead stay down',text:'I lost Clover on Floor 2 today. I went back an hour later and there was nothing but a new flower where she fell. The Bloom does not waste anything.'},
  {rank:4,title:'Sorrel’s theory',text:'Wen Sorrel thinks the Bloom is one organism, and every creature is a cell it lets wander. If she is right, breeding cut-free creatures is the only way to make something it cannot take back. I hope she is right.'},
  {rank:5,title:'Evolution',text:'Cut-free creatures keep changing after they leave. Biscuit grew into something I had never seen in the dungeon. Out here, they grow for themselves instead of for the Bloom.'},
  {rank:6,title:'The boss on Floor 3',text:'Biscuit is gone. Something wearing her colors waits at the end of the third floor. I could not bring myself to fight it. Next time I will bring someone who never knew her.'},
  {rank:7,title:'Old camps',text:'Pip found an old Keeper camp on Floor 3, older than any record. Forge coals, a crown, a drilling machine. We are not the first to try this. We are only the first to keep a journal.'},
  {rank:8,title:'The Ember Abyss',text:'Below the third floor the Bloom gets hot, like a fever. Everything bites harder. Bring creatures that have grown up. The Abyss does not forgive young ones.'},
  {rank:9,title:'Runes',text:'There are carvings on the Abyss totems in a language I almost recognize. One repeats on every wall: KEEP IT ASLEEP.'},
  {rank:10,title:'The song',text:'Three voices sing in the deep, always the same melody. I hum it without meaning to. Marrowtail goes quiet when I do.'},
  {rank:11,title:'What the Bloom wants',text:'I do not think the Bloom is cruel. I think it is lonely, and it is afraid of everything that leaves. That is why it builds walls out of the creatures it loves.'},
  {rank:12,title:'The heart',text:'There is a seventh floor. I can hear it under the sixth, slow, like breathing. The heart is down there. If it can be cut free, maybe the whole Bloom can.'},
  {rank:14,title:'Last entry',text:'I am going down with Marrowtail. If we do not come back, do not follow until your creatures are stronger than mine were. When you reach the heart, do not kill it. Cut the tether. — I.'},
];

/* ================= NPCs and quests ================= */
const NPCS={
  brannoc:{name:'Brannoc',role:'Blacksmith',home:'forge',col:'#c84a3a',skin:'#e8b890',
    arrive:()=>true,arriveText:'The smith who keeps the Forge.',
    intro:'Name’s Brannoc. I forged Ilsa’s blades, and I’ll forge yours. Bring me steel from the deep and I’ll teach you what it’s worth.',
    idle:['The Bloom grows metal like it grows flowers. Nobody knows where it gets the ore.','Ilsa swung a Moonblade. Said the old Keepers left a pattern for it somewhere in the deep.','Melee is honest work. Blade meets bullet, bullet loses.','A weapon that comes home is a weapon that learned something.'],
    quests:[
      {text:'Bring home 2 weapons from raids.',stat:'weaponsHome',n:2,reward:{coin:80,blueprint:'carbine'},done:'Good steel. Here’s the pattern for an Ember Carbine.'},
      {text:'Scrap 3 weapons in the Armory.',stat:'scrapped',n:3,reward:{ore:25},done:'You’re learning what metal is for. Take some ore for the trouble.'},
      {text:'Defeat 40 enemies with a melee weapon.',stat:'meleeKills',n:40,reward:{blueprint:'scythe',coin:120},done:'That’s a fighter’s count. You’ve earned the Reaper Scythe pattern.'},
      {text:'Defeat a boss.',stat:'bossKills',n:1,reward:{weapon:'moonblade',shard:1},done:'Ilsa’s Moonblade. I kept it for whoever came next. It’s yours.'},
    ],outro:'Nothing left to teach you. Keep the Forge hot.'},
  pip:{name:'Pip Tallow',role:'Scout',home:'roost',col:'#4fe0c8',skin:'#f3d2a8',
    arrive:()=>S.keeper.level>=2,arriveText:'Arrives at Keeper rank 2.',
    intro:'Pip Tallow, scout! I map the Bloom for Keepers who’ll pay me in stories. Ilsa paid best. Let’s see what you’re worth.',
    idle:['The floors shift every time you go down, but the boss rooms never move. Weird, right?','If a wall sounds hollow, hit it. Echoes and Curious creatures can hear them.','I found an old camp on Floor 3 once. Crown, coals, a big drill. Older than anyone.','Rooms with a colored shimmer have a twist. Darkness, fog, gold. Read the banner.'],
    quests:[
      {text:'Reach Floor 2.',stat:'deepest',n:2,abs:true,reward:{coin:60,cage:2},done:'Floor 2! Here, cages. You’ll want spares.'},
      {text:'Find a secret room.',stat:'secrets',n:1,reward:{ore:20,coin:60},done:'Ha! You heard it too. Bloom hides its best stuff behind cracked walls.'},
      {text:'Trigger 15 elemental reactions.',stat:'reactions',n:15,reward:{coin:150,gilded:2},done:'Steam, sparks, roots! You fight like Ilsa. Gilded cages, my treat.'},
      {text:'Reach Floor 4, the Ember Abyss.',stat:'deepest',n:4,abs:true,reward:{shard:2,coin:200},done:'You made the Abyss. Ilsa’s notes say the runes there read KEEP IT ASLEEP. Take these shards.'},
    ],outro:'I’ve got nothing left to map that you haven’t walked. Stay safe down there.'},
  sorrel:{name:'Dr. Wen Sorrel',role:'Geneticist',home:'nursery',col:'#ff8fe0',skin:'#c8946a',
    arrive:()=>S.keeper.level>=4||secTier('nursery')>=1,arriveText:'Arrives at Keeper rank 4, or when the Nursery opens.',
    intro:'Wen Sorrel. I study tethers. Every creature you cut free and breed is a creature the Bloom can never take back. Let’s make a lot of them.',
    idle:['Mothers pass on the body, fathers pass on the strength. It’s the root-thread, I think.','Hybrids are the Bloom’s mistakes. Beautiful mistakes.','Evolution needs good genes, not just age. The Gene Lab is your friend.','Personality isn’t random. It’s what the creature learned before you caught it.'],
    quests:[
      {text:'Catch 3 wild creatures.',stat:'captures',n:3,reward:{coin:80,gilded:1},done:'Three new tethers cut. Lovely. A gilded cage for the next one.'},
      {text:'Lay 2 eggs in the Nursery.',stat:'eggs',n:2,reward:{ore:30},done:'Eggs! The first generation born free. Ore for the incubators.'},
      {text:'Evolve a creature.',stat:'evolutions',n:1,reward:{coin:150,shard:1},done:'It changed for itself, not for the Bloom. That’s exactly what I hoped.'},
      {text:'Hatch a hybrid.',stat:'hybridsHatched',n:1,reward:{egg:true,shard:1},done:'A hybrid! Here: an egg I recovered from Ilsa’s last nest. I don’t know what’s inside.'},
    ],outro:'You’ve done more for my research than a decade alone. Keep breeding them free.'},
};
const NPC_IDS=Object.keys(NPCS);
const SYL={ember:['Cin','Ash','Kin','Pyr','Scor','Em','Vol'],fungal:['Mor','Puf','Spo','Cap','Tru','Myc','Fen'],tide:['Rip','Brin','Mar','Wav','Cor','Nai','Sil'],echo:['Ech','Vesp','Nox','Chir','Dus','Umb','Lur'],gale:['Zeph','Aer','Gus','Kes','Sky','Fal','Wisp'],crystal:['Pris','Gem','Qua','Opa','Lum','Shar','Glim'],warden:['Gra','Bas','Tor','Mon','Ked','Ore','Hul']};
const END=['der','ra','ix','o','el','ling','ett','a','us','ble','ka','wyn'];
const makeName=t=>pick(SYL[t])+pick(END);
