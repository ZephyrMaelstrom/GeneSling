/* ================= State ================= */
let S=null;
let ui={tab:'raid',section:'forge',filter:'all',sellId:null,resetArm:false,mom:'',dad:'',scrapArm:null,codex:'creatures',dexType:'ember',
  lab:{species:'bastion',origin:'wild',sex:'R',level:10,max:false,proven:false,t1:'',t2:''},gl:{id:'',gene:'vig'},tt:{id:'',slot:'0'}};

function randGenes(min,max){const g={};for(const k in GENES)g[k]=ri(min,max);return g}
const lineOf=c=>LINES[c.species];
const formOf=c=>lineOf(c)[Math.min(c.stage||0,lineOf(c).length-1)];
const nextForm=c=>lineOf(c)[(c.stage||0)+1]||null;
const formName=c=>formOf(c).name;
function wildStageFor(species,level,floor){
  const L=LINES[species],cap=floor>=4?2:floor>=2?1:0;let s=0;
  for(let i=1;i<L.length&&i<=cap;i++)if(level>=L[i].lv)s=i;return s;
}
function makeCreature(species,origin,level,o={}){
  const sp=SPECIES[species];
  const type=o.type||(sp.hybrid?sp.types[0]:sp.type);
  const type2=sp.hybrid?(o.type2||sp.types.find(t=>t!==type)):null;
  const wild=origin==='wild';
  const c={id:S.nextId++,species,type,type2,sex:o.sex||(Math.random()<.5?'F':'M'),name:o.name||makeName(type),origin,
    proven:!wild||!!o.proven,stage:o.stage||0,pers:o.pers||pick(PERS_IDS),
    genes:o.genes||(wild?randGenes(Math.min(6,2+Math.ceil((o.floor||1)/2)),10):randGenes(2,7)),
    traits:o.traits||rollTraits(wild?(Math.random()<.5?2:1):2),
    level:level||1,xp:0,bondXp:o.bondXp!=null?o.bondXp:(wild?0:30),gen:o.gen||0,raids:0,
    captureRaid:o.captureRaid!=null?o.captureRaid:-1};
  c.hp=stats(c).hp;return c;
}
const bondStar=c=>BOND_TH.filter(t=>(c.bondXp||0)>=t).length;
function addBond(c,n){const before=bondStar(c);c.bondXp=(c.bondXp||0)+Math.round(n*(c.pers==='loyal'?1.5:1)*(res('bond',0)?1.5:1));return bondStar(c)>before}
function stats(c){
  const B=TYPES[c.type].base,m=SPECIES[c.species].mods,g=c.genes,l=1+.07*(c.level-1),has=k=>c.traits.includes(k),st=c.stage||0;
  const bs=bondStar(c),bm=bs>=4?1.12:bs>=2?1.05:1;
  let hp=B.hp*m.hp*(.6+g.vig*.08)*l*(1+.15*st)*bm,atk=B.atk*m.atk*(.6+g.pow*.08)*l*(1+.15*st)*bm,spd=B.spd*m.spd*(.85+g.swf*.03)*(1+.03*st),rate=m.rate*(.8+g.hst*.04);
  if(has('thick'))hp*=1.12;if(has('frail'))hp*=.9;if(has('glow'))atk*=1.1;if(has('quick'))spd*=1.12;if(has('clumsy'))spd*=.9;if(has('rapid'))rate*=1.15;
  const p=c.pers;if(p==='brave')atk*=1.1;if(p==='playful')spd*=1.15;
  const obey=c.origin==='bred'||p==='loyal'?1:clamp(.4+g.tmp*.03+(bs-1)*.1+(c.proven?.1:0),.2,1);
  const f=formOf(c);
  return{hp:Math.round(hp),atk:Math.round(atk*10)/10,spd:Math.round(spd),rate:Math.round(rate*100)/100,obey,
    taken:(has('sturdy')?.85:1)*(p==='timid'?.85:1),regen:has('regen')?.015:0,reach:has('reach')?1.3:1,
    abil:(has('focus')?.8:1)*(has('lazy')?1.25:1)*(p==='calm'?.85:1)*(res('bond',3)?.9:1),crit:(has('keen')?.15:0)+(p==='fierce'?.1:0),vamp:has('vamp')?.08:0,
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
  const old=formName(c);c.stage=(c.stage||0)+1;c.hp=stats(c).hp;
  dexForm(c.species,c.stage,'owned');bump('evolutions');
  addLog(`${c.name} evolved from ${old} into ${formName(c)}!`);
  return old;
}
function defaultOpts(){return{stick:'fixed',stickSize:'M',btnSize:'M',hand:'right',dmgNums:true,shake:true,hudAlpha:.82,autoFire:true,vol:.7,music:.5,sfx:.8,mute:false}}
function newGame(){
  const secs={};SECTION_IDS.forEach(k=>secs[k]={cap:3,ids:[]});
  S={v:5,day:1,coin:200,food:24,ore:8,shards:0,cages:{basic:3,gilded:0},guns:{pistol:1,revolver:1,sword:1},blueprints:{revolver:1,scatter:1,dagger:1,sword:1},
    creatures:[],eggs:[],sections:secs,armory:0,keeper:{level:1,xp:0},progress:{bosses:{},deepest:0,memories:{}},modes:{},research:{combat:0,capture:0,breeding:0,economy:0,bond:0},
    dex:{forms:{},foes:{},claimed:0},npc:{},journalRead:0,tutorialDone:false,introSeen:false,memorial:[],
    loadout:{guns:['revolver','sword'],slots:[null,null,null]},
    stats:{raids:0,extracts:0,deaths:0,lost:0,captures:0,hybrids:0,bossKills:0,weaponsHome:0,scrapped:0,meleeKills:0,secrets:0,reactions:0,eggs:0,evolutions:0,hybridsHatched:0,combos:0},log:[],
    settings:{god:false,reveal:false,instant:false,noTimer:false,keepArena:true},opts:defaultOpts(),nextId:1};
  const a=makeCreature('pyrrox','bred',4,{name:'Cinder',sex:'M',pers:'brave',traits:['glow','rapid'],genes:{vig:6,pow:7,swf:5,hst:6,tmp:5}});
  const b=makeCreature('puffcap','bred',4,{name:'Morel',sex:'F',pers:'calm',traits:['thick','sturdy'],genes:{vig:7,pow:5,swf:4,hst:5,tmp:6}});
  const c=makeCreature('dewdrip','wild',3,{name:'Ripple',sex:'F',pers:'curious',proven:true,bondXp:70,traits:['lucky','regen'],genes:{vig:7,pow:6,swf:7,hst:6,tmp:5}});
  const d=makeCreature('cindlet','bred',2,{name:'Kindle',sex:'F',traits:['worker','quick']});
  const e=makeCreature('shroomite','bred',2,{name:'Puffin',sex:'M',traits:['worker','reach']});
  const f=makeCreature('coralisk','bred',2,{name:'Shoal',sex:'M',traits:['worker','thick']});
  S.creatures.push(a,b,c,d,e,f);S.creatures.forEach(x=>dexForm(x.species,0,'owned'));
  S.sections.forge.ids=[d.id];S.sections.garden.ids=[e.id];S.sections.spring.ids=[f.id];
  S.loadout.slots=[a.id,b.id,c.id];
  syncNpcs();
  addLog('You took over Ilsa Marrow’s hideout. Kindle stokes the Forge, Puffin tends the Garden and Shoal keeps the Spring.');
}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(S))}catch(e){}}
function load(){try{const r=localStorage.getItem(SAVE_KEY);if(r){const d=JSON.parse(r);if(d&&d.v===5){d.opts=Object.assign(defaultOpts(),d.opts||{});return d}}}catch(e){}return null}
function addLog(msg){S.log.unshift({day:S.day,msg});S.log=S.log.slice(0,60)}
const bump=(k,n=1)=>{S.stats[k]=(S.stats[k]||0)+n};

const byId=id=>S.creatures.find(c=>c.id===id);
function whereIs(c){
  for(const k in S.sections){const i=S.sections[k].ids.indexOf(c.id);if(i>=0)return{kind:'section',key:k,slot:i}}
  const j=S.loadout.slots.indexOf(c.id);if(j>=0)return{kind:'loadout',slot:j};
  return{kind:'idle'};
}
function unplace(c){for(const k in S.sections)S.sections[k].ids=S.sections[k].ids.filter(x=>x!==c.id);S.loadout.slots=S.loadout.slots.map(x=>x===c.id?null:x)}
function killCreature(c,how){unplace(c);S.creatures=S.creatures.filter(x=>x!==c);S.stats.lost++;S.memorial.unshift({name:c.name,form:formName(c),species:c.species,stage:c.stage||0,type:c.type,type2:c.type2,level:c.level,day:S.day,how:how||'Lost in the Bloom'});S.memorial=S.memorial.slice(0,40)}
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
  if(r.weapon){S.guns[r.weapon]=(S.guns[r.weapon]||0)+1;S.blueprints[r.weapon]=1;out.push(GUNS[r.weapon].name)}
  if(r.egg){const sp=pick(BASE_SPECIES.filter(k=>SPECIES[k].w===1));const ch=makeCreature(sp,'bred',1,{genes:randGenes(5,9),traits:rollTraits(2,[],true)});S.eggs.push({id:ch.id,days:2,child:ch,cols:[SPECIES[sp].col,'#ffcf4a'],parents:'Ilsa’s last nest',hybrid:true});out.push('a mysterious egg')}
  return out.join(', ');
}

/* ---------- NPCs ---------- */
function npcStat(q){return q.abs?(q.stat==='deepest'?S.progress.deepest||0:S.stats[q.stat]||0):S.stats[q.stat]||0}
function syncNpcs(){const arrived=[];for(const id of NPC_IDS){if(S.npc[id])continue;if(NPCS[id].arrive()){const q=NPCS[id].quests[0];S.npc[id]={q:0,base:npcStat(q),met:false};arrived.push(id)}}return arrived}
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
  return(5+c.level*1.6+c.genes[sec.gene]*1.5)*aff*(c.traits.includes('worker')?1.5:1)*(1+.1*(c.stage||0));
}
const secScore=k=>S.sections[k].ids.map(byId).filter(Boolean).reduce((a,c)=>a+secContribution(c,k),0);
const secTier=k=>{if(!S||!sectionUnlocked(k))return 0;const s=secScore(k);return SEC_TH.filter(t=>s>=t).length};
const expandCost=k=>({coin:40*S.sections[k].cap,ore:4*S.sections[k].cap});
const sectionUnlockedArmory=()=>S.keeper.level>=3;
const armoryTier=()=>sectionUnlockedArmory()?ARMORY_TH.filter(t=>S.armory>=t).length:0;
function weaponDmgMul(){const a=armoryTier();return(a>=5?1.2:a>=3?1.1:a>=1?1.05:1)*(secTier('forge')>=5?1.1:1)*(secTier('warroom')>=3?1.1:1)*(res('combat',1)?1.08:1)}
const cageCap=()=>3+(S.keeper.level>=5?1:0)+(S.keeper.level>=9?1:0)+(armoryTier()>=2?1:0)+(res('capture',0)?1:0);
const eggCap=()=>[0,1,2,2,2,3][secTier('nursery')]+(res('breeding',3)&&secTier('nursery')?1:0);
const modeUnlocked=m=>{const[k,t]=MODES[m].need;return secTier(k)>=t};
const canCraft=id=>{const g=GUNS[id];return g.tier>=1&&!!S.blueprints[id]&&secTier('forge')>=[0,1,2,4,5][g.tier]};
const priceMul=()=>res('economy',1)?.8:1;

/* ---------- keeper rank ---------- */
const keeperNeed=()=>120*S.keeper.level;
function addKeeperXp(n){
  const out=[];S.keeper.xp+=Math.round(n);
  while(S.keeper.xp>=keeperNeed()){
    S.keeper.xp-=keeperNeed();S.keeper.level++;const L=S.keeper.level;
    const coin=30*L;S.coin+=coin;S.cages.basic+=1;
    const j=JOURNAL.find(e=>e.rank===L);
    out.push(`Keeper rank ${L}: +${coin} coin, +1 cage${KEEPER_PERKS[L]?'. '+KEEPER_PERKS[L]:''}${j?'. New journal entry: '+j.title:''}`);
  }
  syncNpcs();
  return out;
}

/* ---------- days ---------- */
function hatchEgg(e){S.creatures.push(e.child);dexForm(e.child.species,e.child.stage||0,'owned');if(e.child.type2)bump('hybridsHatched')}
function processDay(){
  S.day++;const notes=[];
  const trainees=S.sections.training.ids.length;
  const n=S.creatures.length+trainees;
  if(S.food>=n)S.food-=n;
  else{const short=n-S.food;S.food=0;S.creatures.forEach(c=>{c.hp=Math.max(1,Math.round(c.hp*.9))});notes.push(`Food ran short by ${short}. Creatures went hungry.`)}
  const gt=secTier('garden');let g=[0,3,6,10,15,22][gt]+(res('economy',3)?3:0);if(g){S.food+=g;notes.push(`The Garden grew ${g} food.`)}
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
    hatched.forEach(c=>notes.push(`An egg hatched: ${c.name}, a ${sexSym(c.sex)} ${SPECIES[c.species].name}${c.type2?' (hybrid!)':''}.`));
  }else if(S.eggs.length)notes.push('Eggs are waiting. The Nursery needs Wardens to keep incubating.');
  addLog(`Day ${S.day}. `+(notes.join(' ')||'A quiet day at the hideout.'));
}

/* ---------- breeding ---------- */
function hybridChance(mom,dad){
  if(SPECIES[mom.species].hybrid||SPECIES[dad.species].hybrid)return{id:null,p:0};
  const id=hybridFor(mom.type,dad.type),t=secTier('nursery');return{id,p:id?(t>=5?.2:t>=4?.15:.1)+(res('breeding',2)?.05:0):0};
}
const mutChance=()=>(secTier('nursery')>=4?.25:.12)+(res('breeding',0)?.05:0);
function breed(){
  const mom=byId(+ui.mom),dad=byId(+ui.dad);
  if(!mom||!dad||mom.sex!=='F'||dad.sex!=='M'||!mom.proven||!dad.proven)return;
  const t=secTier('nursery');
  if(!t||S.coin<20||S.food<3||S.eggs.length>=eggCap())return;
  S.coin-=20;S.food-=3;
  const mc=mutChance();
  let species=mom.species,type=mom.type,type2=mom.type2;
  const h=hybridChance(mom,dad);let isHybrid=false;
  if(h.id&&Math.random()<h.p){species=h.id;type=mom.type;type2=dad.type;isHybrid=true}
  const genes={};
  for(const k in GENES){let v=Math.random()<.7?dad.genes[k]:mom.genes[k];if(Math.random()<mc)v+=pick([-2,-1,1,1,2]);genes[k]=clamp(v,1,10)}
  const traits=[];
  for(let i=0;i<2;i++){
    let tr=null;
    if(Math.random()<.08)tr=rollTraits(1,traits)[0];
    else{const src=Math.random()<.6?dad:mom;const pool=src.traits.filter(x=>!traits.includes(x));const alt=(src===dad?mom:dad).traits.filter(x=>!traits.includes(x));tr=pool.length?pick(pool):alt.length?pick(alt):rollTraits(1,traits)[0]}
    traits.push(tr);
  }
  const r=Math.random(),pers=r<.5?mom.pers:r<.75?dad.pers:pick(PERS_IDS);
  const child=makeCreature(species,'bred',t>=5||res('breeding',4)?5:1,{type,type2,genes,traits,pers,gen:Math.max(mom.gen,dad.gen)+1});
  const days=Math.max(1,(t>=3?1:2)-(res('breeding',1)?1:0));
  S.eggs.push({id:child.id,days,child,cols:[SPECIES[mom.species].col,SPECIES[dad.species].col],parents:mom.name+' and '+dad.name,hybrid:isHybrid});
  bump('eggs');
  if(isHybrid){S.stats.hybrids++;addLog(`${mom.name} and ${dad.name} produced a shimmering egg. Something unusual is inside.`)}
  else addLog(`${mom.name} and ${dad.name} produced an egg.`);
  sfx('pickup');ui.mom='';ui.dad='';save();renderAll();
}
