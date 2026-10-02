/* ================= State ================= */
import {rand} from './rng.js';
import {clamp,pick} from './util.js';
import {ENDGAME,PRIDE,ARMORY_TH,BASE_SPECIES,BOND_TH,BOSS_IDS,EXCHANGE_DATA,FOE_IDS,GENES,GENETICS,GUNS,JOURNAL,KEEPER_PERKS,LINES,MODES,NPCS,NPC_IDS,PERS_IDS,RESEARCH,RES_COST,SECTIONS,SECTION_IDS,SEC_TH,SPECIES,TRAITS,TYPES,hybridFor,makeName,rollTraits,typesOf} from './content.js';
import {SAVE_VERSION,save} from './save.js';
import {sfx} from './audio.js';
import {renderAll} from './ui.js';
import {isApex,GOOD_TRAITS,GRADE_LOCI,TRAIT_LOCI,ancestors,bonusSlotOpen,cutFree,express,genomeFrom,hasPedigree,inherit,inheritPersonality,isInbred,mutationRate,pureRun,rollGenome} from './genetics.js';
import {breederMark,comfort,perk,pridify} from './hideout.js';
import {DEMO} from './flags.js';
import {bloomify} from './bloom.js';
import {applyChamber,chamberBlock,endgameDay,endgamify,mutlabBonus} from './endgame.js';
import {STORY_STATS,lorify} from './lore.js';
import {pay,give,expAway,fatigueMul,itemName,mouths,newItem,passLegacy,rosterCap,rosterCount,runStations,tickExpeditions,tickFatigue} from './jobs.js';
let S=null;
const setS=v=>{S=v};
let ui={tab:'raid',section:'forge',filter:'all',sellId:null,resetArm:false,mom:'',dad:'',scrapArm:null,codex:'creatures',dexType:'ember',
  exp:{dest:'',team:['','','']},eco:{src:'fresh',seed:1,good:'ore',qty:0,injDay:1},mk:{tab:'goods',good:null,qty:1,price:'',cat:'all',listKind:'creature',listRef:''},lab:{species:'bastion',origin:'wild',sex:'R',level:10,max:false,proven:false,t1:'',t2:'',t3:''},gl:{id:'',gene:'vig'},tt:{id:'',slot:'t1'},sim:{}};

const lineOf=c=>LINES[c.species];
const formOf=c=>lineOf(c)[Math.min(c.stage||0,lineOf(c).length-1)];
const nextForm=c=>lineOf(c)[(c.stage||0)+1]||null;
const formName=c=>formOf(c).name;
function wildStageFor(species,level,floor){
  const L=LINES[species],cap=floor>=4?2:floor>=2?1:0;let s=0;
  for(let i=1;i<L.length&&i<=cap;i++)if(level>=L[i].lv)s=i;return s;
}
// o.genome sets the whole genome. Otherwise one is rolled, and o.genes / o.traits (expressed
// values, as in v5) override the stats and trait slots with matching allele pairs.
function makeGenome(wild,o){
  if(o.genome)return o.genome;
  const G=rollGenome(rand,wild?'wild':'bred',o.floor||1);
  if(o.genes||o.traits){const L=genomeFrom(o.genes||{},o.traits||[]);if(o.genes)for(const k of GRADE_LOCI)G[k]=L[k];if(o.traits)for(const k of TRAIT_LOCI)G[k]=L[k]}
  return G;
}
function makeCreature(species,origin,level,o={}){
  const sp=SPECIES[species];
  const type=o.type||(sp.hybrid?sp.types[0]:sp.type);
  const type2=sp.hybrid?(o.type2||sp.types.find(t=>t!==type)):null;
  const wild=origin==='wild';
  const c={id:S.nextId++,species,type,type2,sex:o.sex||(rand()<.5?'F':'M'),name:o.name||makeName(type),origin,
    proven:!wild||!!o.proven,stage:o.stage||0,pers:o.pers||pick(PERS_IDS),
    genome:makeGenome(wild,o),
    level:level||1,xp:0,bondXp:o.bondXp!=null?o.bondXp:(wild?0:30),gen:o.gen||0,raids:0,
    captureRaid:o.captureRaid!=null?o.captureRaid:-1,mom:o.mom??null,dad:o.dad??null,pure:o.pure||1,bred:0};
  express(c);c.hp=stats(c).hp;return c;
}
const bondStar=c=>BOND_TH.filter(t=>(c.bondXp||0)>=t).length;
function addBond(c,n){const before=bondStar(c);c.bondXp=(c.bondXp||0)+Math.round(n*(c.pers==='loyal'?1.5:1)*(res('bond',0)?1.5:1)*(1+comfort()));return bondStar(c)>before}
function stats(c){
  const B=TYPES[c.type].base,m=SPECIES[c.species].mods,g=c.genes,l=1+.07*(c.level-1),has=k=>c.traits.includes(k),st=c.stage||0;
  const E=GENETICS.EFFECTS,n=E.neutral,size=c.looks?c.looks.size:1;
  const bs=bondStar(c),bm=bs>=4?1.12:bs>=2?1.05:1;
  let hp=B.hp*m.hp*(.6+g.vig*.08)*l*(1+.15*st)*bm,atk=B.atk*m.atk*(.6+g.pow*.08)*l*(1+.15*st)*bm,spd=B.spd*m.spd*(.85+g.swf*.03)*(1+.03*st),rate=m.rate*(.8+g.tem*.04);
  hp*=E.sizeHp[size];
  if(has('thick'))hp*=1.12;if(has('frail'))hp*=.9;if(has('glow'))atk*=1.1;if(has('quick'))spd*=1.12;if(has('clumsy'))spd*=.9;if(has('rapid'))rate*=1.15;
  const p=c.pers;if(p==='brave')atk*=1.1;if(p==='playful')spd*=1.15;
  const obey=c.origin==='bred'||p==='loyal'?1:clamp(.4+g.foc*.03+(bs-1)*.1+(c.proven?.1:0),.2,1);
  const f=formOf(c);
  return{hp:Math.round(hp),atk:Math.round(atk*10)/10,spd:Math.round(spd),rate:Math.round(rate*100)/100,obey,
    taken:(has('sturdy')?.85:1)*(p==='timid'?.85:1)*(1+(n-g.grt)*E.gritTaken)*(has('brittle')?E.brittleTaken:1),regen:has('regen')?.015:0,reach:has('reach')?1.3:1,
    abil:(has('focus')?.8:1)*(has('lazy')?1.25:1)*(p==='calm'?.85:1)*(res('bond',3)?.9:1)*(1+(n-g.foc)*E.focusAbil),
    crit:(has('keen')?.15:0)+(p==='fierce'?.1:0)+Math.max(0,g.foc-n)*E.focusCrit,vamp:has('vamp')?.08:0,
    atkId:f.atk,abilId:f.abil,star:bs};
}
const xpNeed=c=>25*c.level;
function gainXp(c,amt){
  c.xp+=Math.round(amt*(c.pers==='playful'?1.2:1));let ups=0;
  while(c.xp>=xpNeed(c)&&c.level<40){c.xp-=xpNeed(c);c.level++;ups++}
  if(ups)c.hp=Math.min(stats(c).hp,c.hp+Math.round(stats(c).hp*.1*ups));
  return ups;
}
function canEvolve(c){const n=nextForm(c);return!!n&&c.proven&&c.level>=n.lv&&(!n.need||c.genes[n.need[0]]>=n.need[1])}
function evolveCost(c){const s=(c.stage||0)+1,last=s===lineOf(c).length-1,half=res('bond',4)?.5:1;return{coin:Math.round(80*s*half),ore:Math.round(8*s*half),shard:last&&lineOf(c).length>2?1:0}}
function evolve(c){
  if(!canEvolve(c))return false;const k=evolveCost(c);
  if(S.coin<k.coin||S.ore<k.ore||S.shards<k.shard)return false;
  S.coin-=k.coin;S.ore-=k.ore;S.shards-=k.shard;
  const old=formName(c);c.stage=(c.stage||0)+1;const bonus=grantBonusSlot(c);express(c);c.hp=stats(c).hp;
  if(bonus)addLog(`${c.name} is cut free and fully evolved, and gained a fourth trait slot: ${TRAITS[bonus].name}.`);
  dexForm(c.species,c.stage,'owned');bump('evolutions');
  addLog(`${c.name} evolved from ${old} into ${formName(c)}!`);
  return old;
}
// A cut-free creature in its final form gains a fourth trait slot, rolled once and then inherited.
function grantBonusSlot(c){
  const G=c.genome;if(!bonusSlotOpen(c)||G.t4[0]||G.t4[1])return null;
  const t=GOOD_TRAITS.filter(x=>!c.traits.includes(x)),pick1=t[Math.floor(rand()*t.length)];
  G.t4=[pick1,pick1];return pick1;
}
function defaultOpts(){return{fullscreen:true,stick:'fixed',stickSize:'M',btnSize:'M',hand:'right',dmgNums:true,shake:true,hudAlpha:.82,autoFire:true,vol:.7,music:.5,sfx:.8,mute:false}}
function newGame(){
  const secs={};SECTION_IDS.forEach(k=>secs[k]={cap:3,ids:[]});
  S={v:SAVE_VERSION,day:1,coin:200,food:24,ore:8,shards:0,cages:{basic:3,gilded:0},blueprints:{revolver:1,scatter:1,dagger:1,sword:1},
    creatures:[],eggs:[],sections:secs,armory:0,keeper:{level:1,xp:0},progress:{bosses:{},deepest:0,memories:{}},modes:{},research:{combat:0,capture:0,breeding:0,economy:0,bond:0},
    dex:{forms:{},foes:{},claimed:0},npc:{},journalRead:0,tutorialDone:false,introSeen:false,memorial:[],
    loadout:{guns:[null,null],slots:[null,null,null],satchel:null,tonics:0,map:null},
    stats:{raids:0,extracts:0,deaths:0,lost:0,captures:0,hybrids:0,bossKills:0,weaponsHome:0,scrapped:0,meleeKills:0,secrets:0,reactions:0,eggs:0,evolutions:0,hybridsHatched:0,combos:0},log:[],
    settings:{god:false,reveal:false,instant:false,noTimer:false,keepArena:true,genes:false},tree:{},
    mats:{},items:[],nextUid:1,prints:[],mastery:{},pens:0,expeditions:[],prod:{},keeperName:'',market:null,marketSync:1,opts:defaultOpts(),nextId:1};
  const a=makeCreature('pyrrox','bred',4,{name:'Cinder',sex:'M',pers:'brave',traits:['glow','rapid'],genes:{vig:6,pow:7,swf:5,hst:6,tmp:5}});
  const b=makeCreature('puffcap','bred',4,{name:'Morel',sex:'F',pers:'calm',traits:['thick','sturdy'],genes:{vig:7,pow:5,swf:4,hst:5,tmp:6}});
  const c=makeCreature('dewdrip','wild',3,{name:'Ripple',sex:'F',pers:'curious',proven:true,bondXp:70,traits:['lucky','regen'],genes:{vig:7,pow:6,swf:7,hst:6,tmp:5}});
  const d=makeCreature('cindlet','bred',2,{name:'Kindle',sex:'F',traits:['worker','quick']});
  const e=makeCreature('shroomite','bred',2,{name:'Puffin',sex:'M',traits:['worker','reach']});
  const f=makeCreature('coralisk','bred',2,{name:'Shoal',sex:'M',traits:['worker','thick']});
  pridify(S);bloomify(S);endgamify(S);lorify(S);
  S.creatures.push(a,b,c,d,e,f);S.creatures.forEach(x=>dexForm(x.species,0,'owned'));
  S.sections.forge.ids=[d.id];S.sections.garden.ids=[e.id];S.sections.spring.ids=[f.id];
  S.loadout.slots=[a.id,b.id,c.id];
  S.loadout.guns=[newItem('gun','revolver',1,{src:'legacy'}).uid,newItem('gun','sword',1,{src:'legacy'}).uid];
  syncNpcs();
  addLog('You took over Ilsa Marrow’s hideout. Kindle stokes the Forge, Puffin tends the Garden and Shoal keeps the Spring.');
}
function addLog(msg){S.log.unshift({day:S.day,msg});S.log=S.log.slice(0,60)}
const bump=(k,n=1)=>{S.stats[k]=(S.stats[k]||0)+n};

const byId=id=>S.creatures.find(c=>c.id===id);
function whereIs(c){
  for(const k in S.sections){const i=S.sections[k].ids.indexOf(c.id);if(i>=0)return{kind:'section',key:k,slot:i}}
  const j=S.loadout.slots.indexOf(c.id);if(j>=0)return{kind:'loadout',slot:j};
  const e=(S.expeditions||[]).find(x=>x.team.includes(c.id));if(e)return{kind:'expedition',dest:e.dest};
  if((S.mutlab||[]).includes(c.id))return{kind:'mutlab'};
  return{kind:'idle'};
}
function unplace(c){for(const k in S.sections)S.sections[k].ids=S.sections[k].ids.filter(x=>x!==c.id);if(S.mutlab)S.mutlab=S.mutlab.filter(x=>x!==c.id);S.loadout.slots=S.loadout.slots.map(x=>x===c.id?null:x)}
function killCreature(c,how){recordLineage(c);const leg=passLegacy(c);if(leg)addLog(`${leg.heir.name} carries on ${c.name}’s line and inherits ${leg.n} bond.`);unplace(c);S.creatures=S.creatures.filter(x=>x!==c);S.stats.lost++;S.memorial.unshift({name:c.name,form:formName(c),species:c.species,stage:c.stage||0,type:c.type,type2:c.type2,looks:c.looks,gen:c.gen,level:c.level,raids:c.raids||0,
    titles:[cutFree(c)&&'Cut free',hasPedigree(c)&&'Pedigree',c.origin==='bred'&&'Gen '+(c.gen||0)].filter(Boolean),heir:leg?leg.heir.name:null,day:S.day,how:how||'Lost in the Bloom'});S.memorial=S.memorial.slice(0,200)}
const typeTier=c=>Math.max(...typesOf(c).map(t=>TYPES[t].tier));
function sellValue(c){return Math.round((12*typeTier(c)**2+c.level*5)*(c.type2?1.5:1)*(1+.4*(c.stage||0)))}
const sexSym=s=>s==='F'?'♀':'♂';
const abilType=c=>c.type2||c.type;
const supportText=c=>typesOf(c).map(t=>TYPES[t].support).join(' · ');

/* ---------- research ---------- */
const res=(b,i)=>!!S&&!!S.research&&S.research[b]>i;
function researchCost(b){const i=S.research[b];return RES_COST[i]||null}
function buyResearch(b){const k=researchCost(b);if(!k||S.coin<k.coin||S.ore<k.ore||S.shards<k.shard)return false;S.coin-=k.coin;S.ore-=k.ore;S.shards-=k.shard;S.research[b]++;addLog(`Research: ${RESEARCH[b].nodes[S.research[b]-1]}.`);return true}

/* ---------- dex ---------- */
function dexForm(sp,st,kind){const k=sp+':'+st,d=S.dex.forms[k]||(S.dex.forms[k]={});d.seen=1;if(kind==='owned')d.owned=1;if(kind==='caught')d.caught=(d.caught||0)+1}
function dexFoe(id,kill){const d=S.dex.foes[id]||(S.dex.foes[id]={seen:1,kills:0});if(kill)d.kills++}
function dexScore(){let n=0;for(const k in S.dex.forms)if(S.dex.forms[k].seen)n++;n+=Object.keys(S.dex.foes).length;n+=Object.keys(S.progress.bosses).length;return n}
const DEX_MILES=[{n:10,reward:{coin:100}},{n:20,reward:{ore:25,cage:2}},{n:35,reward:{coin:250,gilded:2}},{n:50,reward:{shard:2}},{n:70,reward:{coin:500,ore:60}},{n:90,reward:{shard:4,gilded:3}},{n:115,reward:{coin:1200,shard:6}}];
const DEX_TOTAL=()=>Object.values(LINES).reduce((a,l)=>a+l.length,0)+FOE_IDS.length+BOSS_IDS.length;

/* ---------- rewards ---------- */
function giveReward(r){
  const out=[];
  if(r.coin){S.coin+=r.coin;out.push(`${r.coin} coin`)}
  if(r.ore){S.ore+=r.ore;out.push(`${r.ore} ore`)}
  if(r.cage){S.cages.basic+=r.cage;out.push(`${r.cage} cage${r.cage>1?'s':''}`)}
  if(r.gilded){S.cages.gilded+=r.gilded;out.push(`${r.gilded} gilded cage${r.gilded>1?'s':''}`)}
  if(r.shard){S.shards+=r.shard;out.push(`${r.shard} memory shard${r.shard>1?'s':''}`)}
  if(r.blueprint){S.blueprints[r.blueprint]=1;out.push(`${GUNS[r.blueprint].name} blueprint`)}
  if(r.weapon){const it=newItem('gun',r.weapon,1,{src:'crafted',maker:'Brannoc'});S.blueprints[r.weapon]=1;out.push(itemName(it))}
  if(r.egg){const sp=pick(BASE_SPECIES.filter(k=>SPECIES[k].w===1));const G=rollGenome(rand,'wild',6),T=genomeFrom({},rollTraits(2,[],true));TRAIT_LOCI.forEach(k=>G[k]=T[k]);const ch=makeCreature(sp,'bred',1,{genome:G});S.eggs.push({id:ch.id,days:2,child:ch,cols:[SPECIES[sp].col,'#ffcf4a'],parents:'Ilsa’s last nest',hybrid:true});out.push('a mysterious egg')}
  return out.join(', ');
}

/* ---------- NPCs ---------- */
// Story counts (relics read, walls copied, pages found, Ilsa freed, an ending chosen, the deepest generation) are always absolute.
function npcStat(q){if(STORY_STATS[q.stat])return STORY_STATS[q.stat]();return q.abs?(q.stat==='deepest'?S.progress.deepest||0:S.stats[q.stat]||0):S.stats[q.stat]||0}
function npcArrives(a){return !!(a.always||(a.keeper!=null&&S.keeper.level>=a.keeper)||(a.deepest!=null&&(S.progress.deepest||0)>=a.deepest)||(a.section&&secTier(a.section)>=a.tier))}
function syncNpcs(){const arrived=[];for(const id of NPC_IDS){if(S.npc[id])continue;if(npcArrives(NPCS[id].arrive)){const q=NPCS[id].quests[0];S.npc[id]={q:0,base:npcStat(q),met:false};arrived.push(id)}}return arrived}
function npcQuest(id){const st=S.npc[id];if(!st)return null;const q=NPCS[id].quests[st.q];if(!q)return null;const v=q.abs?npcStat(q):npcStat(q)-st.base;return{q,v:Math.min(v,q.n),done:v>=q.n}}
function npcAttention(id){const st=S.npc[id];if(!st)return false;if(!st.met)return true;const p=npcQuest(id);return!!(p&&p.done)}
function npcTurnIn(id){const p=npcQuest(id);if(!p||!p.done)return null;const st=S.npc[id];const got=giveReward(p.q.reward);st.q++;const nq=NPCS[id].quests[st.q];if(nq)st.base=npcStat(nq);addLog(`${NPCS[id].name}: quest complete. Received ${got}.`);return got}

/* ---------- sections ---------- */
const sectionUnlocked=k=>!SECTIONS[k].unlock||S.keeper.level>=SECTIONS[k].unlock;
const slotBonus=()=>(S.keeper.level>=7?1:0)+(S.keeper.level>=12?1:0);
const secCap=k=>Math.min(10,S.sections[k].cap+slotBonus());
function secContribution(c,k){
  const sec=SECTIONS[k];let aff=1;
  if(sec.type){aff=c.type===sec.type?2:c.type2===sec.type?1.6:.6}
  return(5+c.level*1.6+c.genes[sec.gene]*1.5)*aff*(c.traits.includes('worker')?1.5:1)*(1+.1*(c.stage||0))*fatigueMul(c);
}
const secScore=k=>S.sections[k].ids.map(byId).filter(Boolean).reduce((a,c)=>a+secContribution(c,k),0);
const secTier=k=>{if(!S||!sectionUnlocked(k))return 0;const s=secScore(k);return SEC_TH.filter(t=>s>=t).length};
const expandCost=k=>({coin:40*S.sections[k].cap,ore:4*S.sections[k].cap});
const sectionUnlockedArmory=()=>S.keeper.level>=3;
const armoryTier=()=>sectionUnlockedArmory()?ARMORY_TH.filter(t=>S.armory>=t).length:0;
function weaponDmgMul(){const a=armoryTier();return(a>=5?1.2:a>=3?1.1:a>=1?1.05:1)*(secTier('forge')>=5?1.1:1)*(secTier('warroom')>=3?1.1:1)*(res('combat',1)?1.08:1)*(1+perk('dmg'))}
const cageCap=()=>3+(S.keeper.level>=5?1:0)+(S.keeper.level>=9?1:0)+(armoryTier()>=2?1:0)+(res('capture',0)?1:0);
const eggCap=()=>[0,1,2,2,2,3][secTier('nursery')]+(res('breeding',3)&&secTier('nursery')?1:0);
const modeUnlocked=m=>{const[k,t]=MODES[m].need;return secTier(k)>=t};
const canCraft=id=>{const g=GUNS[id];return g.tier>=1&&!!S.blueprints[id]&&secTier('forge')>=[0,1,2,4,5][g.tier]};
const priceMul=()=>res('economy',1)?.8:1;

/* ---------- keeper rank ---------- */
const keeperNeed=()=>120*S.keeper.level;
function addKeeperXp(n){
  const out=[];S.keeper.xp+=Math.round(n);
  // The demo stops at Keeper rank 10, the end of Act I.
  if(DEMO&&S.keeper.level>=PRIDE.DEMO.maxRank)S.keeper.xp=Math.min(S.keeper.xp,keeperNeed()-1);
  while(S.keeper.xp>=keeperNeed()){
    S.keeper.xp-=keeperNeed();S.keeper.level++;const L=S.keeper.level;
    const coin=30*L;S.coin+=coin;S.cages.basic+=1;
    if(DEMO&&L>=PRIDE.DEMO.maxRank)S.keeper.xp=Math.min(S.keeper.xp,keeperNeed()-1);
    const j=JOURNAL.find(e=>e.rank===L);
    out.push(`Keeper rank ${L}: +${coin} coin, +1 cage${KEEPER_PERKS[L]?'. '+KEEPER_PERKS[L]:''}${j?'. New journal entry: '+j.title:''}`);
  }
  syncNpcs();
  return out;
}

/* ---------- days ---------- */
// An egg brought back by an expedition: a wild-blooded hatchling of one of the team's types.
function expeditionEgg(team){
  const types=[...new Set(team.flatMap(c=>typesOf(c)))],sps=BASE_SPECIES.filter(k=>types.includes(SPECIES[k].type));
  const sp=sps[Math.floor(rand()*sps.length)]||pick(BASE_SPECIES);
  const ch=makeCreature(sp,'bred',1,{genome:rollGenome(rand,'wild',5)});recordLineage(ch);
  S.eggs.push({id:ch.id,days:2,child:ch,cols:[SPECIES[sp].col,'#9fe8ff'],parents:'an expedition nest',hybrid:false});
}
function hatchEgg(e){addKeeperXp(EXCHANGE_DATA.KEEPER_XP.hatch);const c=e.child;if(isApex(c.genome))S.renownLog.apex=(S.renownLog.apex||0)+1;if(perk('bond'))c.bondXp=(c.bondXp||0)+perk('bond');if(grantBonusSlot(c))express(c);S.creatures.push(c);dexForm(e.child.species,e.child.stage||0,'owned');if(e.child.type2)bump('hybridsHatched')}
function processDay(){
  S.day++;const notes=[];pruneTree();
  const trainees=S.sections.training.ids.length;
  const n=mouths();
  if(S.food>=n)S.food-=n;
  else{const short=n-S.food;S.food=0;S.creatures.forEach(c=>{c.hp=Math.max(1,Math.round(c.hp*.9))});notes.push(`Food ran short by ${short}. Creatures went hungry.`)}
  if(res('economy',3))S.food+=3;
  S.food+=perk('food');
  // Venom legends brew a little serum every day.
  if(perk('serum')){const k='legend:serum',v=(S.prod[k]||0)+perk('serum'),n=Math.floor(v+1e-9);S.prod[k]=v-n;if(n)give('serum',n)}
  runStations(notes);
  tickExpeditions(notes,expeditionEgg);
  tickFatigue();
  const sp=secTier('spring');
  S.creatures.forEach(c=>{const m=stats(c).hp;c.hp=sp>=2?m:Math.min(m,Math.round(c.hp+m*(sp>=1?.5:.35)))});
  if(sp>=3)S.creatures.forEach(c=>addBond(c,5));
  const tt=secTier('training'),txp=[20,30,45,60,75,100][tt];let lvls=0;
  S.sections.training.ids.map(byId).filter(Boolean).forEach(c=>{lvls+=gainXp(c,txp);addBond(c,4)});
  if(trainees)notes.push(`Trainees earned ${txp} XP each${lvls?` (${lvls} level-up${lvls>1?'s':''})`:''}.`);
  for(const k in S.sections){if(k==='training')continue;S.sections[k].ids.map(byId).filter(Boolean).forEach(c=>gainXp(c,6))}
  if(secTier('nursery')){
    const hatched=[];
    S.eggs.forEach(e=>{e.days--;if(e.days<=0){hatchEgg(e);hatched.push(e.child)}});
    S.eggs=S.eggs.filter(e=>e.days>0);
    hatched.forEach(c=>notes.push(`An egg hatched: ${c.name}, a ${sexSym(c.sex)} ${SPECIES[c.species].name}${c.type2?' (hybrid!)':''}.${hatchNotes(c)}`));
  }else if(S.eggs.length)notes.push('Eggs are waiting. The Nursery needs Wardens to keep incubating.');
  endgameDay(notes);
  addLog(`Day ${S.day}. `+(notes.join(' ')||'A quiet day at the hideout.'));
}

/* ---------- breeding rules ---------- */
// Extra mutation chance per gene from research and the Nursery.
const mutBonus=()=>(res('breeding',0)?GENETICS.MUTATION.research:0)+(secTier('nursery')>=4?GENETICS.MUTATION.nursery:0)+mutlabBonus();
const breedsLeft=c=>c.traits.includes('shortlived')?Math.max(0,GENETICS.SHORT_LIVED_BREEDS-(c.bred||0)):Infinity;
// Why a pair can't breed, or '' if they can.
function breedBlock(mom,dad){
  if(!mom||!dad)return'Choose a mother and a father.';
  if(mom.sex!=='F'||dad.sex!=='M')return'Pair a female with a male.';
  if(!mom.proven||!dad.proven)return'Both parents must be proven.';
  if(expAway(mom)||expAway(dad))return'One of them is away on an expedition.';
  if(rosterCount()+S.eggs.length>=rosterCap())return`The pens are full (${rosterCount()}/${rosterCap()} with eggs). Build a pen or sell a creature first.`;
  if(!breedsLeft(mom)||!breedsLeft(dad))return`${!breedsLeft(mom)?mom.name:dad.name} is Short-lived and can't breed again.`;
  return'';
}

/* ---------- lineage ---------- */
// S.tree keeps a small record for every creature that has had or been a child, so family trees,
// inbreeding checks and pedigrees survive after a creature dies or is sold.
function recordLineage(c){S.tree[c.id]={name:c.name,species:c.species,stage:c.stage||0,type:c.type,type2:c.type2,sex:c.sex,gen:c.gen||0,mom:c.mom??null,dad:c.dad??null,looks:c.looks,origin:c.origin}}
const lineage=id=>{const c=byId(id);if(c)return c;const e=S.eggs.find(x=>x.child.id===id);return e?e.child:S.tree[id]};
function inbred(mom,dad){return isInbred(mom.id,dad.id,lineage)}
// Drop records more than LINEAGE.treeDepth generations above every living creature and egg.
function pruneTree(){
  const keep=new Set(),depth=GENETICS.LINEAGE.treeDepth-1;
  for(const c of [...S.creatures,...S.eggs.map(e=>e.child)]){keep.add(c.id);ancestors(c.id,depth,lineage).forEach(x=>keep.add(x))}
  for(const id in S.tree)if(!keep.has(+id))delete S.tree[id];
}
const LOCUS_NAME=k=>GENES[k]||({hue:'Hue',pat:'Pattern',size:'Size',shine:'Shine'})[k]||'Trait slot';
// What a hatchling's egg hid, told when it hatches.
function hatchNotes(c){
  const out=[],m=c.birth||{};
  if(m.defect)out.push(`The close bloodline left a defect: ${TRAITS[m.defect].name}`);
  for(const x of m.mutations||[]){
    if(x.to===GENETICS.GRADE.apex)out.push(`a mutation gave it an Apex ${GENES[x.locus]} allele`);
    else if(x.locus==='shine'&&x.to===2)out.push('a mutation scarred it with Bloomscar');
    else if(TRAIT_LOCI.includes(x.locus)||x.locus==='t4')out.push(`a mutation wrote ${TRAITS[x.to].defect?'a defect':'a new trait'} into its genes`);
  }
  if(c.looks.shine===1)out.push('it shimmers Prismatic');
  return out.length?' '+out.join('; ').replace(/^./,ch=>ch.toUpperCase())+'.':'';
}

/* ---------- breeding ---------- */
function hybridChance(mom,dad){
  if(SPECIES[mom.species].hybrid||SPECIES[dad.species].hybrid)return{id:null,p:0};
  const id=hybridFor(mom.type,dad.type),t=secTier('nursery');return{id,p:id?(t>=5?.2:t>=4?.15:.1)+(res('breeding',2)?.05:0):0};
}
// Lays one clutch (one egg, two with Twin Eggs). Returns the eggs laid, or null.
function breed(){
  const mom=byId(+ui.mom),dad=byId(+ui.dad);
  if(breedBlock(mom,dad))return null;
  const t=secTier('nursery');
  if(!t||S.coin<20||S.food<3||S.eggs.length>=eggCap())return null;
  S.coin-=20;S.food-=3;
  recordLineage(mom);recordLineage(dad);
  const isIn=inbred(mom,dad),rate=mutationRate(mom,dad,mutBonus()),h=hybridChance(mom,dad);
  const twins=mom.traits.includes('twin')&&rand()<GENETICS.TWIN_CHANCE;
  const laid=[];
  for(let i=0;i<(twins?2:1);i++){
    let species=mom.species,type=mom.type,type2=mom.type2,isHybrid=false;
    if(h.id&&rand()<h.p){species=h.id;type=mom.type;type2=dad.type;isHybrid=true}
    const got=inherit(mom,dad,{rate,inbred:isIn},rand);
    const child=makeCreature(species,'bred',t>=5||res('breeding',4)?5:1,{type,type2,genome:got.genome,pers:inheritPersonality(mom,dad,rand),
      gen:Math.max(mom.gen||0,dad.gen||0)+1,mom:mom.id,dad:dad.id,pure:pureRun(species,mom,dad)});
    child.birth={mutations:got.mutations,defect:got.defect,inbred:isIn};child.by=breederMark();
    // The Apex Chamber: a guaranteed pass of both parents' better allele on one gene, for the first egg.
    if(i===0&&ui.apexLocus&&!chamberBlock(mom,dad)){pay(ENDGAME.TOOLS.apex.cost);applyChamber(child,mom,dad,ui.apexLocus);child.birth.chamber=ui.apexLocus}
    recordLineage(child);
    const days=Math.max(1,(t>=3?1:2)-(res('breeding',1)?1:0));
    S.eggs.push({id:child.id,days,child,cols:[SPECIES[mom.species].col,SPECIES[dad.species].col],parents:mom.name+' and '+dad.name,hybrid:isHybrid});
    bump('eggs');if(isHybrid)S.stats.hybrids++;laid.push(child);
  }
  mom.bred=(mom.bred||0)+1;dad.bred=(dad.bred||0)+1;
  const odd=laid.some(c=>c.type2);
  addLog(`${mom.name} and ${dad.name} produced ${twins?'twin eggs':'an egg'}.${odd?' Something unusual is inside.':''}${isIn?' They share close family, so a defect is possible.':''}`);
  sfx('pickup');ui.mom='';ui.dad='';save();renderAll();
  return laid;
}

export {S,setS,ui,makeGenome,grantBonusSlot,mutBonus,breedsLeft,breedBlock,recordLineage,lineage,inbred,pruneTree,hatchNotes,LOCUS_NAME,lineOf,formOf,nextForm,formName,wildStageFor,makeCreature,bondStar,addBond,stats,xpNeed,gainXp,canEvolve,evolveCost,evolve,defaultOpts,newGame,addLog,bump,byId,whereIs,unplace,killCreature,typeTier,sellValue,sexSym,abilType,supportText,res,researchCost,buyResearch,dexForm,dexFoe,dexScore,DEX_MILES,DEX_TOTAL,giveReward,npcStat,npcArrives,syncNpcs,npcQuest,npcAttention,npcTurnIn,sectionUnlocked,slotBonus,secCap,secContribution,secScore,secTier,expandCost,sectionUnlockedArmory,armoryTier,weaponDmgMul,cageCap,eggCap,modeUnlocked,canCraft,priceMul,keeperNeed,addKeeperXp,hatchEgg,processDay,hybridChance,breed};
