/* ================= The Bloom expands (Phase 5) =================
   Which vein, layout and event each floor gets, contracts, vein maps, and the variety check.
     - Floors 1 to 3 are the Rootworks. At the bottom the player picks one of five veins for
       floors 4 to 6; three of them need a creature of their key type in the party.
     - Every floor rolls a layout (weighted by vein), never the same as the floor above it.
       About one raid in four rolls an event, on one of its floors.
     - All of it comes from the raid seed, so a seed always replays the same raid. A new raid's seed
       is picked so its combination (each floor's layout, and its event) doesn't repeat any of the
       last VARIETY.memory raids.
   Numbers live in src/data/bloom.json. The runtime side of twists and events is in veins.js. */
import {BLOOM as B,BOSSES,BOSS_IDS,GENES,SPECIES,TYPES,TYPE_IDS,speciesOf} from './content.js';
import {mixSeed,newSeed,rand,withSeed} from './rng.js';
import {pick,ri,wpick} from './util.js';
import {S,addKeeperXp,addLog,secTier} from './state.js';
import {GRADE_LOCI} from './genetics.js';
import {canPay,costText,give,pay} from './jobs.js';
import {seasonTypeMul,tierTwists,unboundBoss} from './endgame.js';
import {on} from './events.js';

const VEIN_IDS=Object.keys(B.VEINS),DEEP=B.VEIN_ORDER,LAYOUT_IDS=Object.keys(B.LAYOUTS),EVENT_IDS=Object.keys(B.EVENTS.list);
const veinIdx=v=>VEIN_IDS.indexOf(v);
// Floors 1-3 the Rootworks, 4-6 the chosen vein, 7-9 the Underheart, 10 the Heart (Unbound raids pass their own vein).
const veinOfFloor=(f,deep)=>deep==='unbound'?'unbound':f<=3?'rootworks':f<=6?(deep||'ember'):f<=9?'underheart':'heart';
const isBoss=f=>f%3===0;

/* ---------- floor plans ---------- */
// The raid's event, if any: which one and on which floor (1 to 5).
function raidEvent(seed){
  return withSeed(mixSeed(seed,90210),()=>rand()<B.EVENTS.chance?{id:pick(EVENT_IDS),floor:ri(1,5)}:null);
}
// One floor's layout. Boss floors only use layouts that can hold a boss room.
function floorLayout(seed,f,vein){
  if(vein==='heart')return'heart';
  return withSeed(mixSeed(seed,7000+f*16+veinIdx(vein)),()=>{
    const ok=LAYOUT_IDS.filter(k=>!isBoss(f)||B.LAYOUTS[k].boss);
    const prev=f>1?floorLayout(seed,f-1,veinOfFloor(f-1,vein)):null;
    const pool=ok.filter(k=>k!==prev);
    return wpick(pool,k=>B.LAYOUTS[k].w[vein]||.5);
  });
}
// tier: the Unbound tier (0 outside Unbound), whose rules and twists ride along on the plan.
function floorPlan(seed,f,vein,tier=0){
  vein=veinOfFloor(f,vein);const ev=vein==='heart'||tier?null:raidEvent(seed);
  return{vein,layout:floorLayout(seed,f,vein),event:ev&&ev.floor===f?ev.id:null,tier,twists:tier?tierTwists(tier):[]};
}
// What a raid would look like down to the floor it reaches, through a vein: [{f, vein, layout, event}].
function raidPlans(seed,deepest,vein){const out=[];for(let f=1;f<=deepest;f++)out.push({f,...floorPlan(seed,f,vein)});return out}
// A raid's combination: its Rootworks layouts, the vein it went down (and that vein's layouts) and its event.
// A raid that ends early still had the whole Rootworks laid out, so its first three floors always count.
function signature(plans){const ev=plans.find(p=>p.event);return`${plans.length>3?plans[3].vein:'rootworks'}|${plans.map(p=>p.layout).join('>')}|${ev?ev.event+'@'+ev.f:'-'}`}
// The parts a seed decides before anyone knows how deep the raid will go: the Rootworks and each vein's floors.
// An event below Floor 3 only shows in a raid that goes that deep, so it belongs to the vein keys, not the Rootworks key.
const seedKeys=seed=>{const ev=raidEvent(seed),e=ev?ev.id+'@'+ev.floor:'-',shallow=!ev||ev.floor<=3;
  return['root|'+[1,2,3].map(f=>floorLayout(seed,f,'rootworks')).join('>')+'|'+(shallow?e:'-'),...DEEP.map(v=>v+'|'+[4,5,6].map(f=>floorLayout(seed,f,v)).join('>')+(shallow?'':'|'+e))]};

/* ---------- variety: pick a seed whose combinations are fresh ---------- */
function bloomState(){return S.bloom||(S.bloom=newBloom())}
function newBloom(){return{seen:[],contracts:{day:0,offers:[],active:null,done:0},maps:[],nextMap:1}}
function pickRaidSeed(){
  const seen=new Set(bloomState().seen);let best=null,bestScore=1e9;
  for(let i=0;i<B.VARIETY.tries;i++){
    const s=newSeed(),score=seedKeys(s).filter(k=>seen.has(k)).length;
    if(score<bestScore){best=s;bestScore=score;if(!score)break}
  }
  return best;
}
// Remember the combinations a raid used (called when a real raid starts).
function rememberSeed(seed){
  const b=bloomState(),keys=seedKeys(seed);
  b.seen=[...keys,...b.seen].slice(0,B.VARIETY.memory*keys.length);
}

/* ---------- veins ---------- */
const veinBlock=(vein,partyTypes)=>{const k=B.VEINS[vein].key;return k&&!partyTypes.includes(k)?`Needs ${/^[AEIOU]/.test(TYPES[k].name)?'an':'a'} ${TYPES[k].name} in your party`:''};
function pickBoss(vein,tier){return vein==='unbound'?unboundBoss(tier||1):pick(BOSS_IDS.filter(b=>(BOSSES[b].vein||'rootworks')===vein))}
// Wild creatures in a vein lean toward its types; Venom only lives in the Sump (or wherever the Apothecary's T2 lets it).
function wildTypeWeight(t,floor,vein,lair,mapMul){
  const T=TYPES[t],rareMul=(floor===1?1:floor===2?2:floor>=4?3.5:3)*(lair?2:1);
  let w=T.weight*(T.tier===3?rareMul:T.tier===4?(floor>=3?2:1):1);
  if(t==='venom')w=vein==='sump'?0:secTier('apothecary')>=2?.8:0;
  // A vein's signature types: at least an average type's weight, multiplied.
  const vw=(B.VEINS[vein].types||{})[t];if(vw)w=Math.max(w,12)*vw*(mapMul||1);
  return w*seasonTypeMul(t);
}
function rollWildIn(floor,vein,lair,mapMul){
  const type=wpick(TYPE_IDS,t=>wildTypeWeight(t,floor,vein||veinOfFloor(floor),lair,mapMul));
  return wpick(speciesOf(type),k=>SPECIES[k].w*(SPECIES[k].w===1?(floor>=2?2:1):1));
}
// A Migration herd: one rare species.
function herdSpecies(vein){const rare=Object.keys(SPECIES).filter(k=>!SPECIES[k].hybrid&&(SPECIES[k].w===1||TYPES[SPECIES[k].type].tier>=3)&&(SPECIES[k].type!=='venom'||vein==='sump'));return pick(rare)}

/* ---------- contracts ---------- */
const C=B.CONTRACTS.list;
function fillText(o){return C[o.kind].desc.replace('{n}',o.n).replace('{type}',o.type?TYPES[o.type].name:'').replace('{gene}',o.gene?GENES[o.gene]:'')}
function rollContract(kind){
  const T=C[kind],o={kind};
  if(T.n)o.n=ri(T.n[0],T.n[1]);
  if(kind==='haul')o.n=Math.round(o.n/10)*10;
  if(kind==='catchType')o.type=pick(TYPE_IDS.filter(t=>t!=='venom'));
  if(kind==='catchGrade')o.gene=pick(GRADE_LOCI.slice(0,4));
  const R0=T.reward;o.reward={};for(const k in R0)o.reward[k]=k==='coin'&&kind==='haul'?Math.round(o.n*R0.coin):R0[k];
  o.text=fillText(o);return o;
}
// Three offers a day, the same all day.
function contractOffers(){
  const c=bloomState().contracts;
  if(c.day!==S.day){c.day=S.day;c.offers=withSeed(mixSeed(S.marketSeed||7,S.day*31+5),()=>{const ks=[...Object.keys(C)],out=[];while(out.length<B.CONTRACTS.offers&&ks.length){const k=ks.splice(Math.floor(rand()*ks.length),1)[0];out.push(rollContract(k))}return out})}
  return c.offers;
}
function takeContract(i){const c=bloomState().contracts,o=contractOffers()[i];if(!o)return null;c.active={...o,day:S.day};return c.active}
const dropContract=()=>{bloomState().contracts.active=null};
const rewardText=r=>Object.entries(r).map(([k,n])=>k==='coin'?`${n} coin`:k==='kxp'?`${n} Keeper XP`:costText({[k]:n})).join(', ');
// Checks the active contract against how a raid ended. res: {extracted, bagCoin, bagOre, kills, eliteKills, deepest, caught:[creatures]}.
function settleContract(res){
  const c=bloomState().contracts,o=c.active;if(!o)return null;
  c.active=null;
  if(!res.extracted)return{ok:false,text:`Contract failed: ${o.text}`};
  const caught=res.caught||[];
  const ok={haul:res.bagCoin>=o.n,catchType:caught.some(x=>x.type===o.type||x.type2===o.type),catchGrade:caught.some(x=>x.genes[o.gene]>=o.n),
    hunt:res.kills>=o.n,elite:res.eliteKills>0,survey:res.deepest>=o.n,deliver:res.bagOre>=o.n}[o.kind];
  if(!ok)return{ok:false,text:`Contract not met: ${o.text}`};
  for(const [k,n] of Object.entries(o.reward)){if(k==='kxp')addKeeperXp(n);else give(k,n)}
  c.done=(c.done||0)+1;addLog(`Contract complete: ${o.text} Paid ${rewardText(o.reward)}.`);
  return{ok:true,text:`Contract complete! ${rewardText(o.reward)}.`};
}
// A contract is settled at the end of a raid or scav run.
on('raid:end',r=>{
  if(r.mode!=='raid'&&!r.scav)return;
  const cr=settleContract({extracted:r.extracted,bagCoin:r.bag.coin,bagOre:r.bag.ore,kills:r.kills,eliteKills:r.eliteKills,deepest:r.deepest,caught:r.caught});
  if(cr)r.notes.push(cr.text);
},{order:30});

/* ---------- vein maps (crafted at the Roost) ---------- */
const MK=B.MAPS.kinds;
const mapBlock=(kind)=>secTier('roost')<B.MAPS.needRoost?`Needs the Roost at tier ${B.MAPS.needRoost}`:!canPay(MK[kind].cost)?`Needs ${costText(MK[kind].cost)}`:'';
function craftMap(kind,vein){
  if(!MK[kind]||!DEEP.includes(vein)||mapBlock(kind))return null;
  pay(MK[kind].cost);const b=bloomState(),m={id:b.nextMap++,kind,vein};b.maps.push(m);
  addKeeperXp(4);addLog(`The Roost drew a ${MK[kind].name.toLowerCase()} of ${B.VEINS[vein].name}.`);return m;
}
const mapName=m=>`${MK[m.kind].name}: ${B.VEINS[m.vein].short}`;
// The map chosen for the next raid, if it's still in stores.
const loadoutMap=()=>{const id=S.loadout.map;return id?bloomState().maps.find(m=>m.id===id)||null:null};
function useMap(vein){const m=loadoutMap();if(!m||m.vein!==vein)return null;const b=bloomState();b.maps=b.maps.filter(x=>x!==m);S.loadout.map=null;return m}

/* ---------- the exit test: no repeated combination in a run of raids ---------- */
// Simulates n raids in a row the way the game picks them: a fresh seed avoiding recent combinations,
// then a depth and (past Floor 3) a vein chosen by a model player. Returns each raid's combination.
function varietyRun(n=20,seed=1){
  const keep=S.bloom;S.bloom=newBloom();const sigs=[];
  try{
    const pickRun=withSeed(seed,()=>Array.from({length:n},()=>({deep:ri(1,6),vein:pick(DEEP)})));
    for(const r of pickRun){const s=pickRaidSeed();rememberSeed(s);sigs.push(signature(raidPlans(s,Math.max(3,r.deep),r.vein)))}
  }finally{S.bloom=keep}
  const counts={};sigs.forEach(x=>counts[x]=(counts[x]||0)+1);
  return{sigs,repeats:Object.values(counts).filter(v=>v>1).length};
}

/* ---------- save v11 ---------- */
function bloomify(d){
  d.bloom=d.bloom||newBloom();
  if(d.loadout)d.loadout.map=d.loadout.map??null;
  return d;
}
export {VEIN_IDS,DEEP,LAYOUT_IDS,EVENT_IDS,veinIdx,veinOfFloor,raidEvent,floorLayout,floorPlan,raidPlans,signature,seedKeys,bloomState,newBloom,pickRaidSeed,rememberSeed,
  veinBlock,pickBoss,wildTypeWeight,rollWildIn,herdSpecies,contractOffers,takeContract,dropContract,rewardText,settleContract,mapBlock,craftMap,mapName,loadoutMap,useMap,
  varietyRun,bloomify};
