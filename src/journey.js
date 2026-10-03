/* ================= The Journey Simulator (Phase 8) =================
   Bot players run the whole 90-day journey on a throwaway save, through the game's own systems:
   Keeper rank and its rewards (addKeeperXp), catch-up, creature levels (gainXp), evolution (evolve),
   breeding, eggs, hatching, inheritance and mutation (breed, processDay), stations and fatigue
   (processDay), research (buyResearch), the roster cap, the act gates (balance.js), Ilsa, the
   endings and the Unbound tiers (endgame.js).
   Only the fighting is modelled. A party's power is its two combat companions' level, evolution
   stage and combat genes, plus gear and the player's skill; each floor is as hard as the wild
   creatures it's built around (BALANCE.WILD_LEVELS, the same table raids use), boss floors harder.
   The chance of getting through a floor is a logistic curve on the difference. A bot plans each raid
   as deep as its risk appetite allows, and a failed floor is a real death: the party dies.
   Four styles (src/data/balance.json): a raider, a crafter and a breeder, who each play about an
   hour and a half a day, and a casual player at about half an hour. A "day" here is a calendar day;
   the hideout day still moves on once per raid, as in the game. */
import {BALANCE,BASE_SPECIES,EXCHANGE_DATA,BLOOM,BOSSES,BOSS_IDS,ENDGAME,GENETICS,JOBS,SECTION_IDS,SECTIONS} from './content.js';
import {S,setS,newGame,makeCreature,gainXp,canEvolve,evolve,evolveCost,addKeeperXp,processDay,layEgg,breedBlock,unplace,secCap,forgeTier,
  eggCap,keeperNeed,buyResearch,researchCost,sellValue,addBond,weaponDmgMul,wildStageFor,expandCost,killCreature,stats} from './state.js';
import {mixSeed,rand,withSeed} from './rng.js';
import {pick,ri} from './util.js';
import {cutFree,genomeFrom} from './genetics.js';
import {amt,give,workUnit,rosterCap,buildPen} from './jobs.js';
import {rollWildIn,veinRich} from './bloom.js';
import {story,chooseEnding,clearTier,nextTier,unboundOpen} from './endgame.js';
import {gateOpen,catchupMul,veinBosses} from './balance.js';
import {holdSaves} from './save.js';
import {upgradeCost,upgradeBuilding,stationLevel} from './buildings.js';
import {hideoutFx} from './perks.js';

const J=BALANCE.JOURNEY,P=J.power,DEEP=BLOOM.VEIN_ORDER;
const sig=x=>1/(1+Math.exp(-x));
const N=GENETICS.EFFECTS.neutral;

/* ---------- power ---------- */
// Fighting strength from the game's own stats(): durability times damage output, square-rooted so it
// grows about in step with level. Genes, evolution, traits, bond and level all count as they do in a raid.
function crPower(c){if(!c)return 0;const s=stats(c);return Math.sqrt(s.hp/s.taken*s.atk*s.rate)}
// The yardstick: an average wild creature of the floor's level, neutral genes, as evolved as wilds get there.
const refCache={};
function refPower(f){
  if(refCache[f])return refCache[f];
  const W=BALANCE.WILD_LEVELS[Math.min(f,10)],lv=Math.round((W[0]+W[1])/2),g=genomeFrom({vig:N,pow:N,swf:N,tem:N,foc:N,grt:N},[]);
  const all=BASE_SPECIES.map(sp=>crPower(makeCreature(sp,'wild',lv,{genome:g,stage:wildStageFor(sp,lv,f),pers:'calm',sex:'F',name:'Ref'})));
  return refCache[f]=all.reduce((a,x)=>a+x,0)/all.length;
}
// Gear: the best weapon tier carried, and the hideout's weapon damage bonuses.
const gearMul=b=>(1+P.gearTier*Math.max(0,b.gear-1))*weaponDmgMul();
// A party's edge over a floor, in log units: the two combat companions (slot 3 a little), gear and skill.
function partyEdge(b,party,f,tier){
  // The Keeper fights too: with no companions left, a raid on the first floors is still possible.
  const [a,c,s3]=party.map(crPower),mine=(Math.max(P.player*refPower(1),(a+c)/2*(1-P.partyMin/4)+s3*P.partyMin/4))*gearMul(b);
  const ref=tier?refPower(9)*(1+J.unbound.perTier*tier):refPower(f);
  return Math.log(mine/ref)+b.style.skill-(isBoss(f)||(tier&&f===9)?P.boss:0);
}
const partyPower=(b,party)=>Math.round(Math.exp(partyEdge(b,party,1,0)-b.style.skill)*refPower(1)*10)/10;
const isBoss=f=>f===3||f===6||f===9||f===10;
const floorOdds=(b,party,f,tier)=>sig(partyEdge(b,party,f,tier)/P.slope);

/* ---------- the hideout between raids ---------- */
const party=()=>S.loadout.slots.map(id=>S.creatures.find(c=>c.id===id)||null);
const free=()=>S.creatures.filter(c=>!S.loadout.slots.includes(c.id));
const posted=c=>SECTION_IDS.some(k=>S.sections[k].ids.includes(c.id));
// Picks the party: the two strongest fighters, and in slot 3 the best prospect still growing (cut-free first).
// needCut: everyone must be cut-free (the Underheart and below).
function chooseParty(needCut,keyType){
  const pool=S.creatures.filter(c=>!needCut||cutFree(c)).sort((a,b)=>crPower(b)-crPower(a));
  const two=pool.slice(0,2);
  // Slot 3 brings the newest generation along to grow (hatchlings level fastest in raids); failing that, the best cut-free creature.
  const rest=pool.filter(c=>!two.includes(c)),young=rest.filter(c=>c.level<P.growTo).sort((a,b)=>((b.gen||0)-(a.gen||0))||(breedScore(b)-breedScore(a)));
  let s3=young[0]||rest.sort((a,b)=>(cutFree(b)-cutFree(a))||(crPower(b)-crPower(a)))[0]||null;
  if(keyType&&!two.concat(s3).some(c=>c&&(c.type===keyType||c.type2===keyType))){const k=pool.find(c=>!two.includes(c)&&(c.type===keyType||c.type2===keyType));if(k)s3=k}
  [...two,s3].forEach(c=>{if(c)unplace(c)});
  S.loadout.slots=[two[0]?.id??null,two[1]?.id??null,s3?.id??null];
}
// Staff the stations with whoever adds most there, the youngest growing in Training.
function staff(){
  for(const k of SECTION_IDS)S.sections[k].ids=[];
  const avail=()=>free().filter(c=>!posted(c));
  const young=avail().filter(c=>c.level<12).sort((a,b)=>(b.gen||0)-(a.gen||0)).slice(0,secCap('training'));
  young.forEach(c=>S.sections.training.ids.push(c.id));
  for(const k of ['garden','nursery','forge','spring','vault','warroom','roost','apothecary']){
    if(!S.sections[k])continue;
    // Matching types first; a station short of tier 2 fills its open slots with anyone (off-type workers count less, but count).
    const fits=c=>!SECTIONS[k].type||c.type===SECTIONS[k].type||c.type2===SECTIONS[k].type;
    // Workers are ranked by what they'd make here with their perks and flaws; one that refuses the station is left out.
    const value=c=>workUnit(c,k,[c]),pickd=avail().filter(fits).filter(c=>value(c)>0).sort((a,b)=>value(b)-value(a)).slice(0,secCap(k));
    if(SECTIONS[k].type&&pickd.length<J.fillOffType)pickd.push(...avail().filter(c=>!fits(c)&&!pickd.includes(c)&&value(c)>0).sort((a,b)=>value(b)-value(a)).slice(0,Math.max(0,J.fillOffType-pickd.length)));
    pickd.forEach(c=>S.sections[k].ids.push(c.id));
  }
}
// Breed the best female with the best male (same species first), as many eggs as the Nursery allows.
const breedScore=c=>{const g=c.genes;return g.pow+g.vig+g.swf+g.tem};
// Worth keeping as breeding stock: genes first, then generation (cut-free lines matter for the gates).
const lineScore=c=>breedScore(c)*3+Math.min(c.gen||0,4)*4+(cutFree(c)?6:0);
function breedPairs(b){
  let laid=0;
  for(let i=0;i<b.style.breed&&S.eggs.length<eggCap();i++){
    const ready=S.creatures.filter(c=>c.proven&&c.level>=10);
    const moms=ready.filter(c=>c.sex==='F').sort((x,y)=>lineScore(y)-lineScore(x)).slice(0,3);
    const dads=ready.filter(c=>c.sex==='M').sort((x,y)=>lineScore(y)-lineScore(x)).slice(0,3);
    let best=null;
    for(const m of moms)for(const d of dads)if(!breedBlock(m,d)){const sc=lineScore(m)+lineScore(d);if(!best||sc>best.sc)best={m,d,sc}}
    if(!best)break;
    if(layEgg(best.m,best.d))laid++;else break;
  }
  return laid;
}
// Spend: evolutions, research, food, more station room, and selling the weakest when the pens are full.
function spend(b){
  for(const c of S.creatures)if(canEvolve(c)){const k=evolveCost(c);if(S.coin>=k.coin&&S.ore>=k.ore&&S.shards>=k.shard)evolve(c)}
  for(const br of ['combat','breeding','capture','economy','bond'])if(researchCost(br)&&S.coin>researchCost(br).coin*2)buyResearch(br);
  const mouths=S.creatures.length+S.sections.training.ids.length+2;
  while(S.food<mouths*2&&S.coin>=JOBS.MARKET_BUY.food10){S.coin-=JOBS.MARKET_BUY.food10;S.food+=10}
  for(const k of ['nursery','garden','forge','training']){const e=expandCost(k);if(S.sections[k].cap<6&&S.coin>e.coin*3&&S.ore>=e.ore){S.coin-=e.coin;S.ore-=e.ore;S.sections[k].cap++}}
  // When the pens fill, keep the party, the breeding stock (best by generation and genes) and each
  // station's best workers, and sell the rest, weakest first.
  // Pens need ingots and cloth. A hideout without the stations to make them buys them on the Exchange
  // (at its reference prices) once coin is plentiful; the Economy Sandbox tests the market itself.
  if((S.pens||0)<JOBS.ROSTER.maxPens){const pc=JOBS.ROSTER.penCost,C=EXCHANGE_DATA.COMMODITIES;
    const cost=pc.coin*((S.pens||0)+1)+Object.entries(pc).filter(([k])=>k!=='coin').reduce((a,[k,n])=>a+Math.max(0,n-amt(k))*C[k].ref*J.marketMarkup,0);
    if(S.coin>cost*J.penReserve){for(const [k,n] of Object.entries(pc))if(k!=='coin'){const need=Math.max(0,n-amt(k));S.coin-=Math.ceil(need*C[k].ref*J.marketMarkup);give(k,need)}buildPen()}}
  const limit=rosterCap()-3,keep=new Set(S.loadout.slots.filter(Boolean)),add=c=>{if(keep.size<limit)keep.add(c.id)};
  [...S.creatures].sort((x,y)=>lineScore(y)-lineScore(x)).slice(0,J.keepLine).forEach(add);
  for(const k of SECTION_IDS){if(!SECTIONS[k].type)continue;S.creatures.filter(c=>c.type===SECTIONS[k].type||c.type2===SECTIONS[k].type).sort((x,y)=>workUnit(y,k)-workUnit(x,k)).slice(0,J.keepWorkers).forEach(add)}
  while(S.creatures.length+S.eggs.length>=rosterCap()-1){
    const c=S.creatures.filter(x=>!keep.has(x.id)).sort((x,y)=>lineScore(x)-lineScore(y))[0];
    if(!c)break;unplace(c);S.creatures=S.creatures.filter(x=>x!==c);S.coin+=sellValue(c);b.sold++;
  }
  // Build up the stations in the bot's order, buying missing materials at the Exchange's reference prices
  // once coin is plentiful, as with pens.
  const C=EXCHANGE_DATA.COMMODITIES;
  for(const k of J.buildOrder){
    const c=upgradeCost(k);if(!c||S.keeper.level<c.rank||!S.sections[k].ids.length)continue;
    const short=Object.entries(c.mats).filter(([m])=>m!=='coin').map(([m,n])=>[m,Math.max(0,n-amt(m))]);
    const price=(c.mats.coin||0)+short.reduce((a,[m,n])=>a+n*C[m].ref*J.marketMarkup,0);
    if(S.coin<price*J.buildReserve)continue;
    for(const [m,n] of short)if(n){S.coin-=Math.ceil(n*C[m].ref*J.marketMarkup);give(m,n)}
    upgradeBuilding(k);
  }
  // The crafter makes its own weapons as the Forge allows; everyone else relies on finds.
  if(b.style.craft){const t=forgeTier();if(t>b.gear&&S.coin>=60*t){S.coin-=60*t;b.gear=t}}
}

/* ---------- a raid ---------- */
function raidPlan(b){
  const st=story();
  // In the Unbound Bloom: the next tier if the party can take it, the last cleared one to farm if not,
  // and back to the ordinary Bloom to rebuild when even that is too much.
  if(unboundOpen()){chooseParty(true);const pt=party();
    for(const t of [nextTier(),Math.max(1,S.unbound.cleared||1)]){const odds=J.unbound.floors.reduce((a,f)=>a*floorOdds(b,pt,f,t),1);if(odds>=b.style.risk)return{tier:t,floors:J.unbound.floors}}}
  // Through the gates, as deep as the bot dares.
  const deepest=S.progress.deepest||0;
  const canUH=gateOpen('underheart')&&S.creatures.filter(cutFree).length>=3;
  chooseParty(canUH);
  const vein=pickVein(b);if(vein&&BLOOM.VEINS[vein].key)chooseParty(canUH,BLOOM.VEINS[vein].key);
  let max=3;if(deepest>=3&&gateOpen('veins'))max=6;
  if(max===6&&canUH&&party().every(c=>!c||cutFree(c)))max=st.ilsa&&gateOpen('heart',party().filter(Boolean))?10:9;
  return{vein,floors:Array.from({length:max},(_,i)=>i+1)};
}
function pickVein(b){
  const pt=new Set(S.creatures.flatMap(c=>[c.type,c.type2].filter(Boolean)));
  const ok=DEEP.filter(v=>!BLOOM.VEINS[v].key||pt.has(BLOOM.VEINS[v].key));
  const fresh=ok.filter(v=>!BOSS_IDS.some(id=>BOSSES[id].vein===v&&S.progress.bosses[id]));
  return(fresh.length?fresh:ok)[b.raids%Math.max(1,(fresh.length?fresh:ok).length)]||'ember';
}
const killsOn=f=>J.kills.base+J.kills.perLocal*((f-1)%3);
function raid(b,day){
  const plan=raidPlan(b),pt=party(),tier=plan.tier||0,K=J.killXp;
  // Go as deep as the risk appetite allows: stop before the cumulative odds of coming home drop below it.
  let surv=1,target=plan.floors[0];
  for(const f of plan.floors){const p=floorOdds(b,pt,f,tier);if(surv*p<b.style.risk&&f>plan.floors[0])break;surv*=p;target=f}
  let kxp=0,xp=0,coin=0,ore=0,food=0,died=false,reached=plan.floors[0]-1,bossDown=null;
  for(const f of plan.floors){
    if(f>target)break;
    if(rand()>floorOdds(b,pt,f,tier)){died=true;reached=f;break}
    reached=f;const loc=(f-1)%3,deep=f>=4?K.deep:1,kills=killsOn(f);
    kxp+=kills*2.5+(f===4?60:0)+(f===7&&!tier?ENDGAME.UNDERHEART.kxp:0);
    xp+=kills*(K.foe[loc]*.7+K.wild*.3)*deep;
    const m=1+J.loot.perFloorMul*(f-1),fv=f>=4&&f<=6&&!tier?plan.vein:null;coin+=ri(J.loot.coin[0],J.loot.coin[1])*m;
    // What the vein is rich in, as in a real raid's pickups.
    ore+=J.loot.ore*m*veinRich(fv,'ore');food+=J.loot.food*veinRich(fv,'food');if(rand()<veinRich(fv,'shards'))S.shards++;
    if(isBoss(f)||(tier&&f===9)){
      const vein=tier?'unbound':f<=3?'rootworks':f<=6?plan.vein:f<=9?'underheart':'heart';
      const id=f===9&&!tier?'ilsa':f===10?'heart':pick(BOSS_IDS.filter(x=>(BOSSES[x].vein||'rootworks')===vein))||null;
      if(id){const first=!S.progress.bosses[id];S.progress.bosses[id]=(S.progress.bosses[id]||0)+1;S.shards+=first?(f>=4?4:2):(f>=4?2:1);kxp+=(f>=4?J.boss.kxpDeep:J.boss.kxp)*(first?1:BALANCE.BOSS_XP.repeat);xp+=J.boss.xp;bossDown=id}
    }
  }
  S.progress.deepest=Math.max(S.progress.deepest||0,tier?7:reached-(died?1:0));
  // Keeper XP comes home either way, as in endRaid.
  // Unbound tiers pay more Keeper XP, as unboundMods does in a real raid.
  addKeeperXp((kxp+(died?0:40)+reached*25)*(1+ENDGAME.UNBOUND.kxpPerTier*tier)*catchupMul(day));
  b.raids++;S.stats.raids++;
  if(died){
    b.deaths++;S.stats.deaths++;
    pt.forEach((c,i)=>{if(!c)return;if(i===0&&hideoutFx().keep.companion)return;if(i===2&&stationLevel('vault')>=1)return;killCreature(c,`Fell on Floor ${reached}`)});
  }else{
    S.stats.extracts++;S.coin+=Math.round(coin);S.ore+=Math.round(ore);S.food+=food;
    pt.forEach((c,i)=>{if(!c)return;gainXp(c,i<2?25+xp:10+xp/4);c.raids++;addBond(c,20);if(!c.proven)c.proven=true});
    // One catch a raid: the best of a few wild creatures met on the deepest floor.
    if(!tier&&rand()<.9){
      const f=reached,W=BALANCE.WILD_LEVELS[Math.min(f,10)],vein=f>=4&&f<=6?plan.vein:null;
      const cands=Array.from({length:J.catchCandidates},()=>{const sp=rollWildIn(f,vein,false,1),lv=ri(W[0],W[1]);return makeCreature(sp,'wild',lv,{floor:f,stage:wildStageFor(sp,lv,f)})});
      // Types the hideout is short of (a station below tier 2 for want of workers) are worth more.
      const need=t=>SECTION_IDS.some(k=>SECTIONS[k].type===t&&S.sections[k].ids.length<2)?J.catchNeed:0;
      const val=c=>breedScore(c)+crPower(c)/4+need(c.type);
      const best=cands.sort((x,y)=>val(y)-val(x))[0];
      best.proven=true;S.creatures.push(best);S.stats.captures++;
    }
    if(rand()<J.gunFind){const t=Math.min(4,1+Math.floor(reached/3));if(t>b.gear)b.gear=t}
    if(bossDown==='ilsa')story().ilsa=true;
    if(bossDown==='heart'&&!story().heart){story().heart=true;chooseEnding('wake')}
    if(tier&&reached>=9)clearTier(tier);
  }
  processDay();
}

/* ---------- one bot's journey ---------- */
const totalXp=L=>{let t=0;for(let i=1;i<L;i++)t+=keeperNeed(i);return t};
function journeyOf(style,seed=1,days){return holdSaves(()=>journeyRun(style,seed,days))}
function journeyRun(style,seed,days){
  const real=S,st=J.styles[style],b={style:st,key:style,gear:1,raids:0,deaths:0,sold:0,eggs:0,log:[],acts:{}};
  days=days||st.days||J.days;
  try{
    withSeed(mixSeed(seed,style.length*977),()=>{
      newGame();S.introSeen=true;S.tutorialDone=true;S.startedAt=0;
      for(let day=1;day<=days;day++){
        for(let i=0;i<st.raids;i++){staff();spend(b);b.eggs+=breedPairs(b);raid(b,day)}
        const d=S.progress.deepest||0,s=story();
        const mark=(k,ok)=>{if(ok&&b.acts[k]==null)b.acts[k]=day};
        mark('rank10',S.keeper.level>=10);mark('act2',d>=4);mark('act3',d>=7);mark('act4',s.ilsa&&gateOpen('heart',S.creatures.filter(cutFree)));mark('heart',s.heart);
        mark('gen3',S.creatures.some(cutFree));mark('veinBosses2',veinBosses()>=2);
        b.log.push({day,rank:S.keeper.level,kxp:S.keeper.xp+totalXp(S.keeper.level),deepest:d,tier:S.unbound.cleared||0,gen:Math.max(0,...S.creatures.map(c=>c.gen||0)),
          power:partyPower(b,party()),eggs:b.eggs,roster:S.creatures.length,coin:S.coin,cutFree:S.creatures.filter(cutFree).length,deaths:b.deaths});
      }
    });
    const last=b.log[b.log.length-1];
    return{style,name:st.name,days,acts:b.acts,raids:b.raids,deaths:b.deaths,sold:b.sold,eggs:b.eggs,rank:last.rank,tier:last.tier,gen:last.gen,
      tierDay:t=>{const x=b.log.find(l=>l.tier>=t);return x?x.day:null},log:b.log};
  }finally{setS(real)}
}
// Every style, for the Test Lab and the exit test. Returns plain data.
function runJourney(seed=1,styles=Object.keys(J.styles)){
  return styles.map(k=>{const r=journeyOf(k,seed);return{...r,seed,tierDays:[5,10,15,20].map(t=>r.tierDay(t)),tierDay:undefined}});
}
// Several seeds, every style: what the Test Lab and the exit test run.
const runJourneys=(seeds=J.seeds)=>seeds.flatMap(sd=>runJourney(sd));

// The exit test: the dedicated players' medians against the design's pace (JOURNEY.targets), each dedicated
// player within a wider band, and the casual player reaching the Heart in about six months.
const median=a=>{const v=[...a].sort((x,y)=>x-y),m=v.length>>1;return v.length%2?v[m]:(v[m-1]+v[m])/2};
function journeyReport(runs){
  const T=J.targets,ded=runs.filter(r=>r.style!=='casual'),cas=runs.filter(r=>r.style==='casual');
  const day=(r,k)=>r.acts[k]??999,at=(r,d,k)=>(r.log[Math.min(d,r.log.length)-1]||{})[k]??0;
  const m={act2:median(ded.map(r=>day(r,'act2'))),act3:median(ded.map(r=>day(r,'act3'))),act4:median(ded.map(r=>day(r,'act4'))),
    rank60:median(ded.map(r=>at(r,60,'rank'))),rank90:median(ded.map(r=>at(r,90,'rank'))),tier90:median(ded.map(r=>at(r,90,'tier'))),
    casualHeart:cas.length?median(cas.map(r=>day(r,'heart'))):null};
  const inR=(v,[a,b])=>v>=a&&v<=b;
  const checks=[
    {name:'Act II opens (median day)',got:m.act2,want:T.act2,ok:inR(m.act2,T.act2)},
    {name:'Act III opens (median day)',got:m.act3,want:T.act3,ok:inR(m.act3,T.act3)},
    {name:'Act IV opens (median day)',got:m.act4,want:T.act4,ok:inR(m.act4,T.act4)},
    {name:'Every dedicated player reaches Act IV',got:ded.map(r=>day(r,'act4')).join(', '),want:T.act4Each,ok:ded.every(r=>inR(day(r,'act4'),T.act4Each))},
    {name:'Keeper rank on day 60 (median)',got:m.rank60,want:T.rank60,ok:inR(m.rank60,T.rank60)},
    {name:'Keeper rank on day 90 (median)',got:m.rank90,want:T.rank90,ok:inR(m.rank90,T.rank90)},
    {name:'Unbound tier on day 90 (median)',got:m.tier90,want:[T.tier90,20],ok:m.tier90>=T.tier90},
  ];
  if(cas.length)checks.push({name:'Casual player reaches the Heart (median day)',got:m.casualHeart,want:T.casualHeart,ok:inR(m.casualHeart,T.casualHeart)});
  return{medians:m,checks,pass:checks.every(c=>c.ok)};
}

export {crPower,refPower,partyEdge,partyPower,floorOdds,journeyOf,runJourney,runJourneys,journeyReport};
