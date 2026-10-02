/* ================= Content =================
   The tables live in src/data/*.json so content and balance can change without
   touching the engine. This module loads them and derives the id lists and lookups. */
import SPECIES_DATA from './data/species.json';
import {pick,wpick} from './util.js';
const {TYPES,TIER,SPECIES,HYBRIDS,LINE_DATA,SYL,END}=SPECIES_DATA;
import ATTACKS_DATA from './data/attacks.json';
const {ATTACKS,ABILITIES,TYPE_ABIL,ELEM,REACTIONS,COMBOS}=ATTACKS_DATA;
import CREATURES_DATA from './data/creatures.json';
const {PERS,BOND_TH,BOND_PASSIVE,BOND_PERKS,GENES,GENE_HINT,TRAITS,NEG_TRAITS}=CREATURES_DATA;
import ITEMS_DATA from './data/items.json';
const {GUNS,WEAPON_COST,SCRAP_ORE,DONATE_PTS,BUFFS}=ITEMS_DATA;
import DUNGEON_DATA from './data/dungeon.json';
const {CURSES,ROOM_MODS,MODES}=DUNGEON_DATA;
import ENEMIES_DATA from './data/enemies.json';
const {FOES,WILD_FIRE}=ENEMIES_DATA;
import BOSSES_DATA from './data/bosses.json';
const {BOSSES}=BOSSES_DATA;
// Phase 7: fuller memories for the bosses added after v5 (the v5 ones keep their words).
for(const [k,t] of Object.entries(LORE.MEMORIES))if(BOSSES[k])BOSSES[k].lore=t;
import HIDEOUT_DATA from './data/hideout.json';
const {SEC_TH,SECTIONS,ARMORY_TH,ARMORY_TIERS,KEEPER_PERKS,RESEARCH,RES_COST}=HIDEOUT_DATA;
import STORY_DATA from './data/story.json';
const {LORE_INTRO,JOURNAL}=STORY_DATA;
// Phase 7: the three new residents, and each original resident's story arc after their v5 quests.
const NPCS={...STORY_DATA.NPCS,...LORE.RESIDENTS};
// The forty Old Keeper relics, in the order the Archive reads them.
ENDGAME.RELICS=LORE.RELICS;
for(const [k,qs] of Object.entries(LORE.ARCS))NPCS[k].quests=[...NPCS[k].quests,...qs];
import GENETICS from './data/genetics.json';
import JOBS from './data/jobs.json';
import EXCHANGE_DATA from './data/exchange.json';
import PRIDE from './data/pride.json';
import BLOOM from './data/bloom.json';
import ENDGAME from './data/endgame.json';
import LORE from './data/lore.json';


/* ================= Types ================= */
const TYPE_IDS=Object.keys(TYPES);

/* ================= Species (each has its own body) ================= */
HYBRIDS.forEach(h=>{SPECIES[h.id]={name:h.name,hybrid:true,types:h.types,col:h.col,shade:h.shade,size:1.05,mods:{hp:1.2,atk:1.2,spd:1.05,rate:1.1},w:0,blurb:`Rare ${TYPES[h.types[0]].name}/${TYPES[h.types[1]].name} hybrid.`}});
const SPECIES_IDS=Object.keys(SPECIES);
const BASE_SPECIES=SPECIES_IDS.filter(k=>!SPECIES[k].hybrid);
const speciesOf=t=>BASE_SPECIES.filter(k=>SPECIES[k].type===t);
const hybridFor=(a,b)=>{if(a===b)return null;const h=HYBRIDS.find(h=>h.types.includes(a)&&h.types.includes(b));return h?h.id:null};
const typesOf=c=>c.type2?[c.type,c.type2]:[c.type];

/* ================= Evolution lines: [name, level, attack, ability, gene need] ================= */
const LINES={};
for(const k in LINE_DATA)LINES[k]=LINE_DATA[k].map(([name,lv,atk,abil,need])=>({name,lv,atk,abil,need:need||null}));

/* ================= Elements and reactions ================= */
const reactionFor=(x,y)=>REACTIONS.find(r=>(r.a===x&&r.b===y)||(r.a===y&&r.b===x));

/* ================= Combos (slot 1 + slot 2 types) ================= */
const comboKey=(a,b)=>[a,b].sort().join('+');
const comboFor=(a,b)=>COMBOS[comboKey(a,b)]||(a===b?{name:'Twin Fury',desc:'Both companions attack twice as fast and hit 25% harder for 5s.'}:{name:'Pack Rally',desc:'Both companions attack 60% faster for 5s.'});

/* ================= Personalities ================= */
const PERS_IDS=Object.keys(PERS);

/* ================= Genes & traits ================= */
const TRAIT_IDS=Object.keys(TRAITS);
const DEFECTS=TRAIT_IDS.filter(k=>TRAITS[k].defect);
function rollTraits(n,exclude=[],posOnly){const out=[];let g=0;while(out.length<n&&g++<200){const t=wpick(TRAIT_IDS,k=>TRAITS[k].w);if(posOnly&&NEG_TRAITS.includes(t))continue;if(!out.includes(t)&&!exclude.includes(t))out.push(t)}return out}

/* ================= Weapons ================= */
const GUN_IDS=Object.keys(GUNS);

/* ================= Run buffs and curses ================= */
const BUFF_IDS=Object.keys(BUFFS);
const CURSE_IDS=Object.keys(CURSES);

/* ================= Room modifiers ================= */
const ROOM_MOD_IDS=Object.keys(ROOM_MODS);

/* ================= Hideout sections ================= */
const SECTION_IDS=Object.keys(SECTIONS);

/* ================= Research ================= */
const RES_IDS=Object.keys(RESEARCH);

/* ================= Enemies ================= */
const FOE_IDS=Object.keys(FOES).filter(k=>FOES[k].intro<99);
// The enemies of a floor: the vein's own, plus a few deep-dwellers it borrows from the Ember Abyss.
function foePool(floor,vein){
  vein=floor<=3?'rootworks':vein||'ember';const local=(floor-1)%3+1+(floor<=3?0:3);
  const own=FOE_IDS.filter(k=>FOES[k].vein===vein&&FOES[k].intro<=local);
  return[...own,...(BLOOM.VEINS[vein].extraFoes||[]).filter(k=>FOES[k]&&FOES[k].intro<=local)];
}

/* ================= Bosses ================= */
const BOSS_IDS=Object.keys(BOSSES);

/* ================= NPCs and quests ================= */
const NPC_IDS=Object.keys(NPCS);
const makeName=t=>pick(SYL[t])+pick(END);

export {LORE,ENDGAME,BLOOM,PRIDE,EXCHANGE_DATA,JOBS,GENETICS,DEFECTS,TYPES,TIER,SPECIES,HYBRIDS,SYL,END,ATTACKS,ABILITIES,TYPE_ABIL,ELEM,REACTIONS,COMBOS,PERS,BOND_TH,BOND_PASSIVE,BOND_PERKS,GENES,GENE_HINT,TRAITS,NEG_TRAITS,GUNS,WEAPON_COST,SCRAP_ORE,DONATE_PTS,BUFFS,CURSES,ROOM_MODS,MODES,FOES,WILD_FIRE,BOSSES,SEC_TH,SECTIONS,ARMORY_TH,ARMORY_TIERS,KEEPER_PERKS,RESEARCH,RES_COST,LORE_INTRO,JOURNAL,NPCS,TYPE_IDS,SPECIES_IDS,BASE_SPECIES,speciesOf,hybridFor,typesOf,LINES,reactionFor,comboKey,comboFor,PERS_IDS,TRAIT_IDS,rollTraits,GUN_IDS,BUFF_IDS,CURSE_IDS,ROOM_MOD_IDS,SECTION_IDS,RES_IDS,FOE_IDS,foePool,BOSS_IDS,NPC_IDS,makeName};
