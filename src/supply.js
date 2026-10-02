/* ================= Supply sandbox (Phase 2 exit test) =================
   Plays a week of hideout days for a 25-creature hideout under two styles of play, using the
   game's own daily cycle (processDay: upkeep, stations, fatigue, expeditions) on a throwaway
   copy of the save. Raids are not played out: each one draws its loot from SUPPLY_SIM.raid
   and can end in death (losing the bag and the gear carried).
     - raid-only: nobody works a production station. Food and cages are bought with raid coin.
     - craft-heavy: the stations are staffed, and the player crafts cages, repairs weapons and
       carries tonics, buying only what production can't cover.
   "Supplied" means: nobody goes hungry, every raid leaves with a full set of cages, and no raid
   goes out with a broken weapon in hand. */
import {JOBS as J,BASE_SPECIES,SECTION_IDS,SECTIONS} from './content.js';
import {S,setS,makeCreature,processDay,secCap,unplace,stats} from './state.js';
import {makeRng,mixSeed,withSeed} from './rng.js';
import {amt,give,craft,repair,repairCost,canPay,newItem,usable,workUnit,mouths,itemByUid} from './jobs.js';

const P=J.SUPPLY_SIM;
// A deterministic mid-game hideout: P.roster creatures spread across the seven types, Lv 8 to 16.
function sandboxSave(seed){
  const base=structuredClone(S);
  base.creatures=[];base.eggs=[];base.tree={};base.expeditions=[];base.prod={};base.items=[];base.nextUid=1;base.mats={};base.log=[];
  for(const k in base.sections)base.sections[k]={cap:5,ids:[]};
  base.coin=P.startCoin;base.food=P.startFood;base.ore=0;base.cages={basic:P.startCages,gilded:0};base.pens=Math.ceil(Math.max(0,P.roster-16)/4);
  base.loadout={guns:[null,null],slots:[null,null,null],satchel:null,tonics:0};
  base.keeper={level:Math.max(base.keeper.level,6),xp:0};
  return base;
}
function populate(r){
  for(let i=0;i<P.roster;i++){
    const sp=BASE_SPECIES[i%BASE_SPECIES.length],c=makeCreature(sp,'bred',8+Math.floor(r()*9),{proven:true});
    S.creatures.push(c);
  }
  const it=newItem('gun','revolver',1,{src:'legacy'});S.loadout.guns=[it.uid,null];
  S.loadout.slots=S.creatures.slice(0,3).map(c=>c.id);
}
// Fill each production station with the creatures that add the most there.
function staff(){
  const free=()=>S.creatures.filter(c=>!S.loadout.slots.includes(c.id)&&!SECTION_IDS.some(k=>S.sections[k].ids.includes(c.id)));
  const order=['garden','forge','vault','warroom','spring','nursery'];
  for(const k of order){
    const cap=secCap(k);
    const pick=free().filter(c=>!SECTIONS[k].type||c.type===SECTIONS[k].type).sort((a,b)=>workUnit(b,k)-workUnit(a,k)).slice(0,cap);
    pick.forEach(c=>{unplace(c);S.sections[k].ids.push(c.id)});
  }
}
const roll=(r,[lo,hi])=>lo+Math.floor(r()*(hi-lo+1));
const buyCost={food10:J.MARKET_BUY.food10,cage:J.MARKET_BUY.cage};
function shop(policy,log){
  // Food for tomorrow plus a little margin.
  const need=mouths()+2;
  while(S.food<need&&S.coin>=buyCost.food10){S.coin-=buyCost.food10;S.food+=10;log.bought.food+=10}
  if(policy==='craft'){
    for(let i=0;i<4&&S.cages.basic<P.keepCages;i++){if(!craft('core'))break;craft('cages');log.crafted.cages++}
    for(const it of S.items)if(it.dur<it.max&&repairCost(it)&&canPay(repairCost(it))){repair(it.uid);log.crafted.repairs++}
  }
  while(S.cages.basic<P.keepCages&&S.coin>=buyCost.cage){S.coin-=buyCost.cage;S.cages.basic++;log.bought.cages++}
}
function raid(policy,r,log){
  if(S.cages.basic<P.keepCages)log.cageShort++;
  const gun=itemByUid(S.loadout.guns[0]);if(gun&&!usable(gun))log.broken++;
  const tonics=policy==='craft'?Math.min(P.keepTonics,amt('tonic')):0;give('tonic',-tonics);
  const used=Math.min(S.cages.basic,roll(r,P.cagesUsed));S.cages.basic-=used;
  if(r()<P.death){log.deaths++;if(gun&&usable(gun)){S.items=S.items.filter(x=>x!==gun);const n=newItem('gun','revolver',0,{src:'legacy'});S.loadout.guns[0]=n.uid}return}
  for(const [m,range] of Object.entries(P.raid))give(m,roll(r,range));
  give('tonic',Math.max(0,tonics-(r()<.5?1:0)));
  if(gun&&usable(gun))gun.dur=Math.max(0,gun.dur-J.DURABILITY.perRaid);
}
// Runs one style of play. Returns the week's record; the real save is untouched.
function simulateSupply(policy,seed=1){
  const real=S,r=makeRng(mixSeed(seed,policy==='craft'?2:1));
  const log={policy,days:[],hungry:0,cageShort:0,broken:0,deaths:0,bought:{food:0,cages:0},crafted:{cages:0,repairs:0}};
  setS(sandboxSave(seed));
  try{
    withSeed(mixSeed(seed,7),()=>{
      populate(r);if(policy==='craft')staff();
      for(let d=0;d<P.days;d++){
        shop(policy,log);
        raid(policy,r,log);
        const before=S.food,need=mouths();
        processDay();
        if(before<need)log.hungry++;
        log.days.push({day:d+1,coin:S.coin,food:S.food,cages:S.cages.basic,ore:S.ore,ingot:amt('ingot'),tonic:amt('tonic'),hp:Math.round(S.creatures.reduce((a,c)=>a+c.hp/stats(c).hp,0)/S.creatures.length*100)});
      }
    });
    log.end={coin:S.coin,food:S.food,cages:S.cages.basic,ingot:amt('ingot'),cloth:amt('cloth'),glass:amt('glass'),tonic:amt('tonic')};
  }finally{setS(real)}
  log.supplied=log.hungry===0&&log.cageShort===0&&log.broken===0;
  return log;
}

export {simulateSupply,sandboxSave};
