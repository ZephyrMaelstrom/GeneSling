/* ================= Underheart and endgame (Phase 6) =================
   The end of the story and the reasons to keep playing after it:
     - the Underheart (floors 7 to 9, cut-free creatures only), freeing Ilsa on Floor 9, the Heart
       on Floor 10 and the three endings (Wake, Sever, Sing),
     - the Unbound Bloom: tiers 1 to 20, each adding one permanent rule, and four Bloomlords,
     - breeding tools: the Splicer, the Mutation Lab and the Apex Chamber,
     - the Archive's rune translation with a Lumen creature, from relics found deep down,
     - Renown, weekly shows, the weekly Deepening and 90-day seasons.
   Numbers live in src/data/endgame.json. */
import {BALANCE,LORE,ENDGAME as E,BOSSES,BOSS_IDS,GENES,SPECIES,TYPES,TYPE_IDS} from './content.js';
import {S,addLog,byId,lineOf,makeCreature,recordLineage,stats,unplace} from './state.js';
import {mixSeed,rand,withSeed} from './rng.js';
import {pick,ri} from './util.js';
import {GRADE_LOCI,STAT_LOCI,cutFree,express,hasApexAllele,isApex} from './genetics.js';
import {canPay,costText,give,masteryLevel,pay} from './jobs.js';
import {on} from './events.js';

/* ---------- state ---------- */
const story=()=>S.story||(S.story={ilsa:false,heart:false,ending:null,endings:{}});
function endgamify(d){
  d.story=d.story||{ilsa:false,heart:false,ending:null,endings:{}};
  d.unbound=d.unbound||{cleared:0,runs:0};
  d.archive=d.archive||{archivist:null,read:0,unread:0};
  d.mutlab=d.mutlab||[];
  d.shows=d.shows||{week:0,entries:{},results:[]};
  d.deepening=d.deepening||{week:0,best:null,rank:null,history:[]};
  d.season=d.season||{n:1,awarded:0};
  d.keeperTitles=d.keeperTitles||[];
  d.renownLog=d.renownLog||{apex:0,legendary:0,deepening:0,ribbons:0};
  (d.creatures||[]).forEach(c=>{c.ribbons=c.ribbons||[]});
  return d;
}

/* ---------- the Underheart: cut-free creatures only ---------- */
// Party creatures still tethered to the Bloom (not yet cut free), which the Underheart won't let pass.
const tethered=party=>party.filter(c=>!cutFree(c));
function onStoryBoss(def){
  const st=story();
  if(def.story==='ilsa'){const first=!st.ilsa;st.ilsa=true;if(first)addLog('Ilsa Marrow is free. She is weak, and she remembers your name.');return first?'Ilsa is free! The song breaks, and the way to the Heart opens below.':'The Choir falls quiet again. The Heart waits below.'}
  if(def.story==='heart'){st.heart=true;return'The Heart stills. Choose what happens to the Bloom.'}
  return null;
}
function chooseEnding(k){
  const D=E.ENDINGS[k];if(!D)return false;const st=story();
  st.ending=k;st.endings[k]=true;
  if(!S.keeperTitles.includes(D.title))S.keeperTitles.push(D.title);
  addLog(`The Heart: you chose to ${D.name.toLowerCase()} the Bloom. You are ${D.title}. The Bloom re-forms, twenty tiers deep.`);
  return true;
}
const endingRules=()=>{const k=story().ending;return k?E.ENDINGS[k].unbound:{}};

/* ---------- the Unbound Bloom ---------- */
const U=E.UNBOUND;
const unboundOpen=()=>!!story().heart&&!!story().ending;
// Each Unbound tier also needs Keeper rank: tier 20 asks for rank 50 (src/data/balance.json).
const tierRank=t=>Math.ceil(BALANCE.UNBOUND_RANK.from+BALANCE.UNBOUND_RANK.perTier*t);
const nextTier=()=>{let t=Math.min(U.tiers,(S.unbound.cleared||0)+1);while(t>1&&S.keeper.level<tierRank(t)&&t>(S.unbound.cleared||0))t--;return Math.max(1,t)};
const rulesFor=tier=>U.rules.slice(0,tier);
// Whether rule id is in force in this raid (R.tier is the Unbound tier, 0 outside it).
const ruleOn=(tier,id)=>!!tier&&U.rules.findIndex(r=>r.id===id)<tier&&U.rules.some(r=>r.id===id);
// The floor modifiers an Unbound tier and the ending add to every floor.
function unboundMods(tier){
  const er=endingRules(),m={hp:1,dmg:1,coin:1+U.coinPerTier*tier,kxp:1+U.kxpPerTier*tier,wild:er.wild||1};
  m.hp*=(er.hp||1)*(ruleOn(tier,'hardened')?1.15:1)*(ruleOn(tier,'unbound')?1.25:1);
  m.dmg*=(er.dmg||1)*(ruleOn(tier,'fury')?1.25:1)*(ruleOn(tier,'unbound')?1.25:1);
  m.coin*=er.coin||1;
  return m;
}
// Twists the tier lays over every floor, on top of the vein's own.
function tierTwists(tier){return[ruleOn(tier,'darkness')&&'dark',ruleOn(tier,'gales')&&'wind',ruleOn(tier,'venomtide')&&'poison',ruleOn(tier,'eruptions')&&'vents',endingRules().sleep&&'dark'].filter(Boolean)}
// The boss at the bottom of a tier: any vein's boss, or from tier 10 sometimes a Bloomlord.
function unboundBoss(tier){
  const lords=BOSS_IDS.filter(b=>BOSSES[b].vein==='bloomlord');
  if(tier>=U.lordFrom&&rand()<U.lordChance)return pick(lords);
  return pick(BOSS_IDS.filter(b=>!['rootworks','underheart','heart','bloomlord'].includes(BOSSES[b].vein)));
}
function clearTier(tier){
  const was=S.unbound.cleared||0;if(tier<=was)return false;
  S.unbound.cleared=tier;addLog(`Unbound tier ${tier} cleared.${tier<U.tiers?` Tier ${tier+1} adds: ${U.rules[tier].name}.`:' The deepest the Bloom goes.'}`);
  return true;
}
// Apex shards (and from tier 8, Bloomscar serums) from a tier's boss.
function tierLoot(tier){const n=Math.floor(U.apexShards[0]+U.apexShards[1]*tier);give('apexshard',n);const b=tier>=U.bloomscarFrom?1:0;if(b)give('bloomscar',b);return{shards:n,bloomscar:b}}

/* ---------- Bloomlords ---------- */
const L=E.LORDS;
// Damage a Bloomlord takes, given who hit it. Returns the damage to apply.
function lordDamage(e,dmg,src,elem){
  const k=e.def&&e.def.lord;if(!k)return dmg;
  if(k==='deaf'&&(src==='p'))return dmg*L.deaf.gunMul;
  if(k==='brood'&&e.brood&&e.brood.some(x=>x.hp>0))return 0;
  if(k==='reflect'&&elem&&src&&src.c&&!src.downed)src.hp=Math.max(1,src.hp-dmg*L.reflect.frac);
  return dmg;
}

/* ---------- the Archive: relics and runes ---------- */
const RU=E.RUNES,ABC='ABCDEFGHIJKLMNOPQRSTUVWXYZ',GLYPHS=[...RU.alphabet];
const runeOf=ch=>{const i=ABC.indexOf(ch);return i<0?ch:GLYPHS[i]};
function knownLetters(){const s=new Set();E.RELICS.slice(0,S.archive.read).forEach(r=>[...r.letters].forEach(l=>s.add(l)));return s}
// A rune wall as the player can read it: known letters in plain text, the rest as runes.
const runeWall=text=>{const k=knownLetters();return[...text].map(ch=>ch===' '?' ':k.has(ch)?ch:runeOf(ch)).join('')};
const archivist=()=>{const c=byId(S.archive.archivist);return c&&(c.type==='lumen'||c.type2==='lumen')?c:null};
// Each day a Lumen archivist translates one relic.
// A Lumen archivist reads a relic a day. Without one, Odile Quill (once she has arrived) reads one every few days.
function archiveDay(notes){
  const A=S.archive,ar=archivist(),odile=!ar&&S.npc&&S.npc.odile&&S.day%LORE.ARCHIVE.odileEvery===0;
  if((!ar&&!odile)||!A.unread||A.read>=E.RELICS.length)return;
  const who=ar?ar.name:'Odile Quill',n=Math.min(A.unread,E.ARCHIVE.perDay);A.unread-=n;
  for(let i=0;i<n&&A.read<E.RELICS.length;i++){const r=E.RELICS[A.read++];notes.push(`${who} translated the ${r.name.toLowerCase()} in the Archive.`)}
}

/* ---------- breeding tools ---------- */
const T=E.TOOLS;
// The Splicer: the recipient's weaker copy of one gene becomes the donor's better copy; the donor is used up.
function spliceBlock(donor,recip,locus){
  if(S.keeper.level<T.splicer.rank)return`Needs Keeper rank ${T.splicer.rank}`;
  if(!donor||!recip||donor===recip)return'Choose a donor and a different recipient';
  if(!GRADE_LOCI.includes(locus))return'Choose a gene';
  if(!canPay(T.splicer.cost))return`Needs ${costText(T.splicer.cost)}`;
  return'';
}
function splice(donorId,recipId,locus){
  const d=byId(donorId),r=byId(recipId);if(spliceBlock(d,r,locus))return null;
  pay(T.splicer.cost);const best=Math.max(...d.genome[locus]),pair=r.genome[locus],w=pair[0]<=pair[1]?0:1;pair[w]=best;express(r);
  recordLineage(d);unplace(d);S.creatures=S.creatures.filter(x=>x!==d);
  addLog(`The Splicer moved ${d.name}'s ${GENES[locus]} ${best} into ${r.name}. ${d.name} is gone.`);
  return{locus,value:best};
}
// The Mutation Lab: posted Crystal creatures raise mutation odds per locus, up to a cap.
const mutlabCreatures=()=>(S.mutlab||[]).map(byId).filter(c=>c&&(c.type==='crystal'||c.type2==='crystal'));
const mutlabBonus=()=>S&&S.keeper.level>=T.mutlab.rank?Math.min(T.mutlab.cap,mutlabCreatures().length*T.mutlab.per):0;
function setMutlab(ids){S.mutlab=ids.filter(id=>{const c=byId(id);return c&&(c.type==='crystal'||c.type2==='crystal')}).slice(0,T.mutlab.slots);return S.mutlab}
// The Apex Chamber (after the Heart): two Apex-carrying parents, and a guaranteed pass of each one's
// better allele on one chosen gene. Uses an Apex shard.
const chamberOpen=()=>!!story().heart;
function chamberBlock(mom,dad){
  if(!chamberOpen())return'Opens after the Heart';
  if(!mom||!dad)return'Choose both parents';
  if(!hasApexAllele(mom.genome)||!hasApexAllele(dad.genome))return'Both parents must carry an Apex allele (11)';
  if(!canPay(T.apex.cost))return`Needs ${costText(T.apex.cost)}`;
  return'';
}
function applyChamber(child,mom,dad,locus){
  if(!STAT_LOCI.includes(locus))return false;
  child.genome[locus]=[Math.max(...mom.genome[locus]),Math.max(...dad.genome[locus])];express(child);return true;
}

/* ---------- Renown ---------- */
const RN=E.RENOWN;
function renown(){
  const ribbons=S.creatures.flatMap(c=>c.ribbons||[]).concat(S.renownLog.ribbonList||[]);
  const depth=(S.unbound.cleared||0)*RN.tier+(S.renownLog.deepening||0);
  const apexNow=S.creatures.filter(c=>isApex(c.genome)).length;
  const genetics=Math.max(apexNow,S.renownLog.apex||0)*RN.apex+ribbons.reduce((a,r)=>a+(RN.ribbon[r.place-1]||0),0)+(S.stats.hybridsHatched||0)*RN.hybridHatched;
  const mastered=Object.keys(S.mastery||{}).filter(k=>masteryLevel(k)>=3).length;
  const craft=mastered*RN.recipeMastered+(S.renownLog.legendary||0)*RN.legendary;
  const st=story();
  const lore=S.lore?S.lore.pages.length+S.lore.walls.length+S.lore.whispers.length:0;
  const collection=(S.dex.claimed||0)*RN.milestone+(S.archive.read||0)*RN.relic+Object.keys(st.endings).length*RN.ending+(st.ilsa?RN.ilsa:0)+lore*LORE.ARCHIVE.fragmentRenown;
  return{depth,genetics,craft,collection,total:depth+genetics+craft+collection};
}

/* ---------- weekly shows ---------- */
const SH=E.SHOWS;
const weekOf=day=>Math.floor((day-1)/SH.every)+1;
function showClasses(week){
  return withSeed(mixSeed(7777,week),()=>{
    const types=TYPE_IDS.filter(t=>t!=='lumen'),out=[];
    for(const C of SH.classes.slice().sort(()=>rand()-.5).slice(0,3)){
      const o={id:C.id,type:pick(types)};if(C.id==='gene')o.gene=pick(STAT_LOCI);if(C.gen)o.n=ri(C.gen[0],C.gen[1]);
      o.name=C.name.replace('{type}',TYPES[o.type].name).replace('{gene}',o.gene?GENES[o.gene]:'').replace('{n}',o.n);
      o.desc=C.desc.replace(/\{gene\}/g,o.gene?GENES[o.gene]:'').replace('{n}',o.n);out.push(o);
    }
    return out;
  });
}
const eligible=(c,o)=>!!c&&(c.type===o.type||c.type2===o.type)&&(o.id!=='young'||(c.gen||0)<o.n);
function showScore(c,o){
  if(o.id==='gene')return c.genes[o.gene];
  if(o.id==='looks'){const L=c.looks;return(L.shine?L.shine*4:0)+(L.pat?2+L.pat*.5:0)+Math.abs(L.size-1)*1.5+(L.hue?1:0)}
  return STAT_LOCI.reduce((a,k)=>a+c.genes[k],0);
}
// A rival breeder's entry, scaled to the class's best possible score.
function rivalScores(week,i,o){const top=o.id==='gene'?12:o.id==='looks'?12:66;return withSeed(mixSeed(week*13+i,99),()=>Array.from({length:SH.rivals},()=>top*(SH.rivalScore[0]+rand()*(SH.rivalScore[1]-SH.rivalScore[0]))))}
function enterShow(i,id){const w=weekOf(S.day),o=showClasses(w)[i],c=byId(id);if(!o||(c&&!eligible(c,o)))return false;if(S.shows.week!==w){S.shows.week=w;S.shows.entries={}}S.shows.entries[i]=id||null;return true}
// Judged when a week ends. Places 1 to 3 win ribbons.
function judgeShows(week){
  const sh=S.shows;if(sh.week!==week)return[];const out=[],classes=showClasses(week);
  classes.forEach((o,i)=>{
    const c=byId(sh.entries[i]);if(!eligible(c,o))return;
    const me=showScore(c,o),place=1+rivalScores(week,i,o).filter(x=>x>me).length;
    sh.results.unshift({week,cls:o.name,name:c.name,place});
    if(place<=3){c.ribbons=c.ribbons||[];c.ribbons.push({week,cls:o.name,place});out.push(`${c.name} took ${['first','second','third'][place-1]} in ${o.name}`)}
    else out.push(`${c.name} placed ${place}th in ${o.name}`);
  });
  sh.results=sh.results.slice(0,30);sh.entries={};
  return out;
}

/* ---------- the weekly Deepening ---------- */
const DP=E.DEEPENING;
const deepeningSeed=week=>mixSeed(424242,week);
function deepeningScore(res){const P=DP.score;return Math.round(res.deepest*P.floor+res.kills*P.kill+res.coin*P.coin+(res.extracted?P.extract:0)+res.caught*P.caught)}
// The simulated ladder: rival Keepers' scores for the week.
function ladder(week){return withSeed(mixSeed(week,5150),()=>Array.from({length:DP.rivals},()=>Math.max(0,Math.round(DP.rivalMean+(rand()+rand()+rand()-1.5)*DP.rivalSpread))).sort((a,b)=>b-a))}
function recordDeepening(week,score){
  const D=S.deepening;if(D.week!==week){D.week=week;D.best=null;D.rank=null}
  const rank=1+ladder(week).filter(x=>x>score).length;
  if(D.best==null||score>D.best){D.best=score;
    const was=D.rank;D.rank=rank;
    const top=RN.deepeningTop,bonus=rank===1?top[0]:rank<=10?top[1]:rank<=100?top[2]:0,old=was==null?0:was===1?top[0]:was<=10?top[1]:was<=100?top[2]:0;
    if(bonus>old)S.renownLog.deepening=(S.renownLog.deepening||0)+bonus-old;
  }
  D.history.unshift({week,score,rank});D.history=D.history.slice(0,20);
  return{score,rank,best:D.best};
}
// The Deepening's score is settled when its raid ends.
on('raid:end',r=>{
  if(r.deepening==null)return;
  const d=recordDeepening(r.deepening,deepeningScore({deepest:r.deepest,kills:r.kills,coin:r.bag.coin,extracted:r.extracted,caught:r.caught.length}));
  r.notes.push(`Deepening, week ${r.deepening}: ${d.score} points, rank ${d.rank} of 100. Your best this week: ${d.best}.`);
},{order:20});

/* ---------- seasons ---------- */
const SE=E.SEASON;
const seasonOf=day=>Math.floor((day-1)/SE.days)+1;
const seasonTwist=n=>SE.twists[(n-1)%SE.twists.length];
// At a season's end, a title and a banner for the Renown reached.
function seasonEnd(n){
  if(S.season.awarded>=n)return null;S.season.awarded=n;
  const r=renown().total,a=SE.awards.find(x=>r>=x.renown);
  if(!a){addLog(`Season ${n} ended.`);return null}
  const t=`${a.title}, Season ${n}`;S.keeperTitles.push(t);S.decor.banner=(S.decor.banner||0)+1;
  addLog(`Season ${n} ended with ${r} Renown: you are ${t}, and a season banner waits in stores.`);return t;
}

/* ---------- the day ---------- */
// Called from processDay after the day number moves on.
function endgameDay(notes){
  archiveDay(notes);
  const w=weekOf(S.day),pw=weekOf(S.day-1);
  if(w!==pw){const res=judgeShows(pw);if(res.length)notes.push('Show results: '+res.join('; ')+'.')}
  const sn=seasonOf(S.day);if(sn!==S.season.n){const t=seasonEnd(S.season.n);S.season.n=sn;notes.push(`Season ${sn} begins: ${seasonTwist(sn).name}.${t?` You finished last season as ${t}.`:''}`)}
}
// A season's twist makes one type turn up twice as often.
const seasonTypeMul=t=>seasonTwist(S&&S.season?S.season.n:1).type===t?2:1;

/* ---------- the Test Lab: an endgame save ---------- */
function labEndgame(){
  S.keeper.level=Math.max(S.keeper.level,45);S.coin+=20000;
  const party=['solaryx','tidewyrm','umbrowl'].map((sp,i)=>{const L=SPECIES[sp]?lineOf({species:sp}):null;
    const c=makeCreature(sp,'bred',34,{gen:4,proven:true,stage:L?L.length-1:0,sex:i%2?'M':'F'});express(c);c.hp=stats(c).hp;S.creatures.push(c);recordLineage(c);return c});
  S.loadout.slots=party.map(c=>c.id);
  // Past every gate: two vein bosses beaten (Keeper rank 45 and the cut-free party cover the rest).
  for(const b of ['prime','leviathan'])S.progress.bosses[b]=S.progress.bosses[b]||1;
  S.progress.deepest=Math.max(S.progress.deepest||0,6);
  S.pens=Math.max(S.pens||0,10);give('apexshard',5);give('serum',5);
  addLog('Test Lab: an endgame party of three cut-free creatures at Lv 34.');
  return party;
}

export {story,endgamify,tethered,onStoryBoss,chooseEnding,endingRules,unboundOpen,nextTier,tierRank,rulesFor,ruleOn,unboundMods,tierTwists,unboundBoss,clearTier,tierLoot,lordDamage,
  runeOf,knownLetters,runeWall,archivist,archiveDay,spliceBlock,splice,mutlabCreatures,mutlabBonus,setMutlab,chamberOpen,chamberBlock,applyChamber,
  renown,weekOf,showClasses,eligible,showScore,rivalScores,enterShow,judgeShows,deepeningSeed,deepeningScore,ladder,recordDeepening,seasonOf,seasonTwist,seasonEnd,endgameDay,seasonTypeMul,labEndgame};
