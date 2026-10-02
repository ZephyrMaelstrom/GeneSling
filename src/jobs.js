/* ================= Jobs and production (Phase 2) =================
   Every creature has a job: it fights, works a station, scouts on an expedition or breeds.
   This module holds the hideout economy:
     - materials (raw, refined, components) and a single way to pay and receive them,
     - weapons and satchels as individual items with quality, durability and a maker's mark,
     - stations: daily output from each posted creature's Yield, type match, level, traits and
       fatigue, plus foremen, crew chemistry and personality clashes,
     - crafting with quality tiers and recipe mastery, repairs and single-use prints,
     - the roster cap, Roost expeditions and the death legacy.
   All numbers live in src/data/jobs.json. */
import {GENES,EXCHANGE_DATA,GUNS,JOBS as J,SECTIONS,TYPES,WEAPON_COST} from './content.js';
import {S,addBond,addKeeperXp,addLog,byId,canCraft,formName,lineage,secTier,unplace,whereIs} from './state.js';
import {rand} from './rng.js';
import {GRADE_LOCI,ancestors,express} from './genetics.js';
import {comfort,perk} from './hideout.js';

/* ---------- materials ---------- */
// coin, ore, food and shards keep their v5 homes on S; everything else lives in S.mats.
// Keeper rank is time played, so crafting, hatching and trading earn Keeper XP too.
const XP=EXCHANGE_DATA.KEEPER_XP;
const TOP={coin:'coin',ore:'ore',food:'food',shard:'shards'};
const amt=id=>TOP[id]?S[TOP[id]]||0:(S.mats[id]||0);
function give(id,n){if(!n)return;if(TOP[id])S[TOP[id]]=(S[TOP[id]]||0)+n;else S.mats[id]=(S.mats[id]||0)+n}
const canPay=cost=>Object.entries(cost).every(([k,n])=>amt(k)>=n);
function pay(cost){if(!canPay(cost))return false;for(const [k,n] of Object.entries(cost))give(k,-n);return true}
const matName=id=>id==='coin'?'coin':id==='shard'?'memory shard':(J.MATERIALS[id]||{name:id}).name;
const costText=cost=>Object.entries(cost).filter(([,n])=>n).map(([k,n])=>`${n} ${k==='coin'?'c':matName(k).toLowerCase()}`).join(' · ');

/* ---------- items: weapons and satchels ---------- */
// An item is {uid, kind:'gun'|'satchel', id, q, dur, max, maker, fore, src}. The Scav Pistol is
// never an item: it can't break or be lost.
const QN=J.QUALITY.names;
function newItem(kind,id,q,o={}){
  const max=J.QUALITY.dur[q],it={uid:S.nextUid++,kind,id,q,dur:o.dur!=null?o.dur:max,max,maker:o.maker||null,fore:o.fore||null,src:o.src||'crafted'};
  S.items.push(it);return it;
}
const itemByUid=uid=>S.items.find(i=>i.uid===uid);
const itemBase=it=>it.kind==='gun'?GUNS[it.id].name:'Satchel';
function itemName(it){return`${QN[it.q]} ${itemBase(it)}`}
function makerText(it){
  if(it.src==='found')return'Found in the Bloom';
  if(it.src==='legacy')return'From Ilsa’s old stock';
  // Only finer goods (Superior and up) keep the maker's and foreman's names.
  if(it.q<2)return`Made in your Workshop${it.src==='print'?' from a print':''}`;
  return`Made by ${it.maker||'you'}${it.fore?` with ${it.fore}`:''}${it.src==='print'?', from a print':''}`;
}
const usable=it=>!!it&&it.dur>0;
// A weapon found in a raid: mostly Crude, part worn.
function foundGun(id){
  const D=J.DURABILITY,q=rand()<D.foundQuality[0]?0:1,max=J.QUALITY.dur[q];
  return newItem('gun',id,q,{src:'found',dur:Math.max(1,Math.round(max*(D.foundFraction[0]+rand()*(D.foundFraction[1]-D.foundFraction[0]))))});
}
const gunDmgMul=it=>it?J.QUALITY.dmg[it.q]:1;
const satchelSlots=it=>it&&usable(it)?J.QUALITY.satchelSlots[it.q]:0;
const repairCost=it=>{const n=Math.ceil((it.max-it.dur)*J.DURABILITY.repairPerPoint);return n?{[it.kind==='gun'?'ingot':'cloth']:n}:null};
function repair(uid){const it=itemByUid(uid);if(!it)return false;const c=repairCost(it);if(!c||!pay(c))return false;it.dur=it.max;addLog(`Repaired the ${itemName(it)}.`);return true}
function scrapItem(it){S.items=S.items.filter(x=>x!==it);if(S.loadout.guns.includes(it.uid))S.loadout.guns=S.loadout.guns.map(x=>x===it.uid?null:x);if(S.loadout.satchel===it.uid)S.loadout.satchel=null}

/* ---------- gene serums (the Apothecary) ---------- */
// A serum raises the weaker copy of the creature's lowest grade by 1, up to 10.
function serumLocus(c){
  const open=GRADE_LOCI.filter(k=>Math.min(...c.genome[k])<10);
  return open.length?open.reduce((a,k)=>(c.genes[k]<c.genes[a]||(c.genes[k]===c.genes[a]&&Math.min(...c.genome[k])<Math.min(...c.genome[a]))?k:a)):null;
}
function useSerum(c){
  const k=c&&serumLocus(c);if(!k||amt('serum')<1)return null;
  const pair=c.genome[k],w=pair[0]<=pair[1]?0:1;pair[w]++;give('serum',-1);express(c);
  addLog(`A gene serum raised ${c.name}'s weaker ${GENES[k]} copy to ${pair[w]}.`);
  return k;
}

/* ---------- stations ---------- */
const prodStation=k=>!!J.STATIONS[k];
const fatigueMul=c=>1-J.FATIGUE.maxPenalty*Math.min(100,c.fat||0)/100;
const members=k=>S.sections[k].ids.map(byId).filter(Boolean);
// The posted creature with the highest Focus runs the station; its work traits apply to everyone.
function foremanOf(k){const m=members(k);return m.length?m.reduce((a,b)=>(b.genes.foc>a.genes.foc?b:a)):null}
const crewHas=(k,trait)=>{const f=foremanOf(k);return c=>c.traits.includes(trait)||(!!f&&f.traits.includes(trait))};
function typeMatch(c,k){const t=SECTIONS[k].type;if(!t)return 1;return c.type===t?J.WORK.match:c.type2===t?J.WORK.secondary:J.WORK.offType}
// Work units one creature puts into a station per day, before station-wide bonuses.
function workUnit(c,k){
  const W=J.WORK,worker=crewHas(k,'worker')(c);
  return(W.base+W.perYield*c.genes.yld)*typeMatch(c,k)*(1+W.perLevel*c.level)*(1+W.perStage*(c.stage||0))*(worker?W.worker:1)*fatigueMul(c);
}
// Station-wide modifiers: crew chemistry pairs and personality clashes.
function crewMods(k){
  const m=members(k),hasType=t=>m.some(c=>c.type===t||c.type2===t);
  const chem=J.CHEMISTRY.filter(x=>x.station===k&&x.types.every(hasType));
  const clashes=J.CLASHES.filter(([a,b])=>m.some(c=>c.pers===a)&&m.some(c=>c.pers===b));
  const pen=Math.min(J.CLASH_MAX,clashes.length*J.CLASH_PENALTY);
  return{chem,clashes,mul:(1+chem.reduce((a,x)=>a+x.bonus,0))*(1-pen)};
}
// What a station makes in a day, and what limits it. Pure: doesn't change stock.
function stationReport(k){
  const R=J.STATIONS[k];if(!R)return null;
  const m=members(k),mods=crewMods(k),f=foremanOf(k);
  const tierMul=k==='garden'?J.WORK.gardenTier[secTier(k)]:k==='apothecary'?J.WORK.apothecaryTier[secTier(k)]:1;
  const rows=m.map(c=>({c,u:workUnit(c,k)}));
  const units=rows.reduce((a,r)=>a+r.u,0)*mods.mul*tierMul*(R.rate||1);
  // Batches: each needs R.in; inputs on hand can cap it.
  let batches=units,limit=null;
  for(const [mat,n] of Object.entries(R.in)){const can=amt(mat)/n;if(can<batches){batches=can;limit=mat}}
  const out={};for(const [mat,n] of Object.entries(R.out))out[mat]=batches*n;
  const per=c=>{const r=rows.find(x=>x.c===c);return r?r.u*mods.mul*tierMul*(R.rate||1):0};
  return{k,rows,units,batches,limit,out,in:R.in,mods,foreman:f,per,tierMul};
}
// Daily production. Fractions carry over in S.prod so small crews still make whole goods.
function runStations(notes){
  for(const k in J.STATIONS){
    const rep=stationReport(k);if(!rep||!rep.rows.length)continue;
    const R=J.STATIONS[k];const prog=S.prod[k]=(S.prod[k]||0)+rep.batches;
    let whole=Math.floor(prog+1e-9);
    for(const [mat,n] of Object.entries(R.in))whole=Math.min(whole,Math.floor(amt(mat)/n));
    if(whole<=0)continue;
    S.prod[k]=Math.min(prog-whole,1);
    for(const [mat,n] of Object.entries(R.in))give(mat,-n*whole);
    const made=[];
    for(const [mat,n] of Object.entries(R.out)){
      const key=k+':'+mat,total=n*whole+(S.prod[key]||0),v=Math.floor(total+1e-9);
      S.prod[key]=total-v;if(v){give(mat,v);made.push(`${v} ${matName(mat).toLowerCase()}`)}
    }
    if(made.length)notes.push(`The ${SECTIONS[k].name} ${R.verb} ${made.join(', ')}.`);
  }
}
// Fatigue: working raises it, rest lowers it. Tireless (or a Tireless foreman) halves the rise.
function tickFatigue(){
  const F=J.FATIGUE;
  for(const c of S.creatures){
    const w=whereIs(c);let d=-F.rest-perk('rest');
    if(w.kind==='section'){d=F.work*(crewHas(w.key,'tireless')(c)?F.tireless:1)*(1-comfort())}
    else if(w.kind==='expedition')d=F.expedition*(1-comfort());
    c.fat=Math.max(0,Math.min(100,(c.fat||0)+d));
  }
}
// Who eats today: everyone, except Thrifty workers (or anyone under a Thrifty foreman).
function mouths(){
  let n=S.creatures.length+S.sections.training.ids.length;
  for(const c of S.creatures){const w=whereIs(c);if(w.kind==='section'&&crewHas(w.key,'thrifty')(c))n--}
  return Math.max(0,n);
}

/* ---------- quality, crafting and mastery ---------- */
const masteryLevel=r=>J.MASTERY.thresholds.filter(t=>(S.mastery[r]||0)>=t).length;
function knackOf(station){const m=station?members(station):[];return m.length?m.reduce((a,c)=>a+c.genes.kn,0)/m.length:J.QUALITY.emptyKnack}
function qualityBase(recipe,station,print){
  const f=station?foremanOf(station):null,Q=J.QUALITY;
  const art=station&&members(station).some(c=>c.traits.includes('artisan'))||(f&&f.traits.includes('artisan'))?Q.artisan:0;
  return knackOf(station)+masteryLevel(recipe)*J.MASTERY.perLevel+art+(print?Q.printBonus:0);
}
const tierFor=v=>J.QUALITY.thresholds.filter(t=>v>=t).length-1;
function rollQuality(recipe,station,print){return Math.max(0,Math.min(QN.length-1,tierFor(qualityBase(recipe,station,print)+rand()*J.QUALITY.roll)))}
// Odds of each quality tier for a recipe right now (for the crafting screen).
function qualityOdds(recipe,station,print){
  const b=qualityBase(recipe,station,print),Q=J.QUALITY,out=QN.map(()=>0),N=40;
  for(let i=0;i<N;i++)out[Math.max(0,Math.min(QN.length-1,tierFor(b+(i+.5)/N*Q.roll)))]+=1/N;
  return out;
}
const keeperName=()=>(S.keeperName||'').trim()||'the Keeper';
function stamp(station){const f=station?foremanOf(station):null;return{maker:keeperName(),fore:f?formName(f):null}}
function recipeCost(r){return{...J.RECIPES[r].in}}
function weaponCost(id){return{coin:WEAPON_COST[GUNS[id].tier].coin,parts:J.WEAPON_PARTS[GUNS[id].tier]}}
// Crafts one recipe. Returns a short description of what was made, or null.
function craft(r){
  const R=J.RECIPES[r];if(!R)return null;
  if(R.needForge&&secTier('forge')<R.needForge)return null;
  if(!pay(recipeCost(r)))return null;
  S.mastery[r]=(S.mastery[r]||0)+1;
  if(R.kind==='component'){addKeeperXp(XP.component);for(const [m,n] of Object.entries(R.out))give(m,n);return`${matName(Object.keys(R.out)[0])}`}
  const q=rollQuality(r,R.station);addKeeperXp(XP.craft[q]);
  if(R.cages){const n=R.cages+J.QUALITY.cageBonus[q];S.cages.basic+=n;return`${n} ${QN[q].toLowerCase()} cages`}
  if(R.gilded){S.cages.gilded+=R.gilded;return'a gilded cage'}
  if(R.satchel){const it=newItem('satchel','satchel',q,stamp(R.station));return itemName(it)}
  return null;
}
// Forges a weapon from its blueprint, or once from a single-use print (no blueprint or Forge tier needed).
function craftWeapon(id,printIdx){
  const usePrint=printIdx!=null&&S.prints[printIdx]===id;
  if(!usePrint&&!canCraft(id))return null;
  if(!pay(weaponCost(id)))return null;
  if(usePrint)S.prints.splice(printIdx,1);
  const key='gun:'+id;S.mastery[key]=(S.mastery[key]||0)+1;
  const q=rollQuality(key,'forge',usePrint);addKeeperXp(XP.craft[q]);if(q>=4&&S.renownLog)S.renownLog.legendary=(S.renownLog.legendary||0)+1;
  return newItem('gun',id,q,{...stamp('forge'),src:usePrint?'print':'crafted'});
}

/* ---------- roster ---------- */
const rosterCap=()=>J.ROSTER.base+J.ROSTER.perPen*(S.pens||0);
const rosterCount=()=>S.creatures.length;
const overCap=()=>rosterCount()>rosterCap();
const penCost=()=>({...J.ROSTER.penCost,coin:J.ROSTER.penCost.coin*((S.pens||0)+1)});
function buildPen(){if((S.pens||0)>=J.ROSTER.maxPens||!pay(penCost()))return false;S.pens=(S.pens||0)+1;addLog(`Built a new pen. The roster holds ${rosterCap()} creatures.`);return true}

/* ---------- raid roles ---------- */
const roleOf=c=>J.SPECIES_ROLE[c.species]||null;
const roleInfo=c=>{const r=roleOf(c);return r?J.ROLES[r]:null};

/* ---------- expeditions ---------- */
const expAway=c=>S.expeditions.some(e=>e.team.includes(c.id));
function expeditionBlock(dest,ids){
  const D=J.EXPEDITIONS[dest];if(!D)return'Choose a destination.';
  if(secTier('roost')<1)return'The Roost needs tier 1 to send expeditions.';
  const team=ids.map(byId).filter(Boolean);
  if(team.length!==J.EXPEDITION_TEAM)return`Choose ${J.EXPEDITION_TEAM} creatures.`;
  if(new Set(ids).size!==ids.length)return'Choose three different creatures.';
  if(team.some(expAway))return'One of them is already away.';
  if(D.need&&!team.some(c=>D.need.some(t=>c.type===t||c.type2===t)))return`Needs a ${D.need.map(t=>TYPES[t].name).join(' or ')} creature.`;
  return'';
}
function startExpedition(dest,ids){
  if(expeditionBlock(dest,ids))return false;
  const team=ids.map(byId);team.forEach(unplace);
  S.expeditions.push({dest,team:ids.slice(),days:J.EXPEDITIONS[dest].days});
  addLog(`${team.map(c=>c.name).join(', ')} set out for the ${J.EXPEDITIONS[dest].name.toLowerCase()}.`);
  return true;
}
// Haul scales with the team's levels and Swift.
const teamScale=team=>1+team.reduce((a,c)=>a+J.EXPEDITION_SCALE.perLevel*c.level+J.EXPEDITION_SCALE.perSwift*(c.genes.swf-5),0)/team.length;
function tickExpeditions(notes,makeEgg){
  for(const e of S.expeditions.slice()){
    e.days--;if(e.days>0)continue;
    S.expeditions=S.expeditions.filter(x=>x!==e);
    const D=J.EXPEDITIONS[e.dest],team=e.team.map(byId).filter(Boolean),k=teamScale(team),got=[];
    for(const [mat,[lo,hi]] of Object.entries(D.loot)){const n=Math.round((lo+rand()*(hi-lo))*k);if(n>0){give(mat,n);got.push(`${n} ${matName(mat).toLowerCase()}${n>1&&mat==='shard'?'s':''}`)}}
    if(rand()<D.egg&&makeEgg){makeEgg(team);got.push('an egg')}
    const hurt=team.filter(()=>rand()<D.injury);hurt.forEach(c=>{c.hp=Math.max(1,Math.round(c.hp*.5))});
    team.forEach(c=>addBond(c,8));
    notes.push(`The ${D.name.toLowerCase()} team came home with ${got.join(', ')||'nothing'}.${hurt.length?` ${hurt.map(c=>c.name).join(' and ')} came back hurt.`:''}`);
  }
}

/* ---------- death legacy ---------- */
// The closest living bred descendant inherits LEGACY_BOND of the fallen creature's bond.
function legacyHeir(dead){
  let best=null,bestD=99;
  for(const c of S.creatures){
    if(c===dead)continue;
    for(let d=1;d<=4;d++){if(ancestors(c.id,d,lineage).has(dead.id)){if(d<bestD||(d===bestD&&c.level>best.level)){best=c;bestD=d}break}}
  }
  return best;
}
function passLegacy(dead){
  const heir=legacyHeir(dead);if(!heir)return null;
  const n=Math.round((dead.bondXp||0)*J.LEGACY_BOND);if(n<=0)return null;
  heir.bondXp=(heir.bondXp||0)+n;
  return{heir,n};
}

/* ---------- market ---------- */
const sellPrice=id=>(J.MATERIALS[id]||{}).sell||0;
function sellMat(id,n=1){if(amt(id)<n||!sellPrice(id))return false;give(id,-n);S.coin+=sellPrice(id)*n;return true}

export {serumLocus,useSerum,amt,give,canPay,pay,matName,costText,QN,newItem,itemByUid,itemName,itemBase,makerText,usable,foundGun,gunDmgMul,satchelSlots,repairCost,repair,scrapItem,
  prodStation,fatigueMul,members,foremanOf,typeMatch,workUnit,crewMods,stationReport,runStations,tickFatigue,mouths,
  masteryLevel,knackOf,rollQuality,qualityOdds,keeperName,recipeCost,weaponCost,craft,craftWeapon,
  rosterCap,rosterCount,overCap,penCost,buildPen,roleOf,roleInfo,expAway,expeditionBlock,startExpedition,teamScale,tickExpeditions,
  legacyHeir,passLegacy,sellPrice,sellMat};
