/* ================= Perks and flaws =================
   Every creature brings its own perks and flaws. Nothing reads a station's score any more: a station,
   a raid or a clutch of eggs asks its creatures what they bring.

   Where they come from (src/data/perks.json):
     LINES[line]        the line's signature perk and flaw, and a mastery perk for its final form
     HYBRIDS[id]        a perk from each parent line at 80% strength, and a flaw of its own
     PERSONALITY[pers]  a perk (the personality's own effect) and a flaw
     earned in play     working 30 days at one station, 25 raids home, close calls, Wyrmslayer;
                        Burnt Out and Homesick, which clear
   Traits keep their own effects and show beside these on the creature's page.

   Each perk has a scope (at):
     'station'  while posted at its station (st: a station, a list, or 'any'): work effects (out, tire,
                crewOut, crewTire ...) and effects on the whole hideout or on raids (heal, eggSlots,
                reveal, keep, weaponDmg ...). So a Shardling either fights beside you or guards your coin.
     'party'    while in the raid party: its own damage, HP, damage taken and speed
     'home'     always: food eaten, XP, expeditions
   A perk's numbers grow with its creature: +10% per evolution stage, ×1.25 at ★3 bond and ×1.5 at ★5.
   Flaws stay as they are.

   perksOf(c)      every perk and flaw, with its strength and whether the player knows it
   workMods(c, k)  how c's own perks and its crew change its output and fatigue at station k
   hideoutFx()     everything posted creatures do for the hideout and for raids, summed
   partyFx(c)      c's own raid perks while it's in the party */
import {PERKS_DATA as D,SPECIES,LINES as FORMS} from './content.js';
import {S,byId,whereIs,bondStar} from './state.js';

const P=D.PERKS,SC=D.SCALE;
// Effects whose size grows with the creature. The rest are switches or whole counts.
const GROWS=new Set(['out','crewOut','crewTire','tire','make','heal','bondAll','comfort','mutation','hybrid','hatchBond','scrapOre','keepCoin','playerHp','weaponDmg','compHp','wildMul','bossDmg','kxp','allOut','dmg','hp']);

const lineOf=c=>SPECIES[c.species]&&SPECIES[c.species].hybrid?null:c.species;
const finalForm=c=>(c.stage||0)>=(FORMS[c.species]||[]).length-1;
const formSeen=(sp,st)=>!!(S&&S.dex&&S.dex.forms[sp+':'+(st||0)]&&S.dex.forms[sp+':'+(st||0)].seen);

// Which earned perks and flaws a creature has now.
function earned(c){
  const E=D.EARNED,out=[];
  for(const [k,n] of Object.entries(c.days||{}))if(n>=E.hand.days&&P['hand_'+k])out.push('hand_'+k);
  if((c.extracts||0)>=E.veteran.extracts)out.push('veteran');
  if((c.nearDeaths||0)>=E.survivor.nearDeaths)out.push('survivor');
  if((c.titles||[]).includes(E.bossbane.title))out.push('bossbane');
  if(c.burnt)out.push('burntout');
  if((c.raids||0)>0&&S&&S.day-(c.lastRaid??S.day)>=E.homesick.days)out.push('homesick');
  return out;
}
// How strong c's perks are: its evolution stage and bond.
function strength(c){const b=bondStar(c);return(1+SC.perStage*(c.stage||0))*(b>=5?SC.bond5:b>=3?SC.bond3:1)}

// Every perk and flaw c has: [{id, ...the perk, src, s (strength), known}]. Cached per creature until
// something that changes them does (its stage, bond stars, personality, earned perks, the Codex).
const cache=new WeakMap();
function perksOf(c){
  const e=earned(c),seen=formSeen(c.species,0),key=`${c.species}|${c.stage||0}|${c.pers}|${bondStar(c)}|${e.join(',')}|${seen}`;
  const hit=cache.get(c);if(hit&&hit.key===key)return hit.out;
  const out=[],s=strength(c),add=(id,src,mul=1,known=true)=>{const p=P[id];if(p)out.push({id,...p,src,s:p.kind==='flaw'?1:s*mul,known})};
  const line=lineOf(c);
  if(line&&D.LINES[line]){const [perk,flaw,mastery]=D.LINES[line];add(perk,'species',1,seen);add(flaw,'species',1,seen);if(finalForm(c)&&mastery)add(mastery,'mastery',1,seen)}
  const H=D.HYBRIDS[c.species];
  if(H){add(D.LINES[H[0]][0],'hybrid',SC.hybrid,seen);add(D.LINES[H[1]][0],'hybrid',SC.hybrid,seen);add(H[2],'hybrid',1,seen)}
  const pe=D.PERSONALITY[c.pers];if(pe){add(pe[0],'personality');add(pe[1],'personality')}
  for(const id of e)add(id,'earned');
  cache.set(c,{key,out});
  return out;
}
// Is perk p (of a creature posted at station `at`, or null) working at station k? k null: anywhere it's posted.
const stMatch=(p,k)=>p.st==='any'||p.st===k||(Array.isArray(p.st)&&p.st.includes(k));
const postOf=c=>{const w=whereIs(c);return w.kind==='section'?w.key:null};
const val=(p,key)=>{const v=p.fx[key];return typeof v==='number'&&GROWS.has(key)?v*p.s:v};

/* ---------- at a station ---------- */
const crewOf=k=>S.sections[k].ids.map(byId).filter(Boolean);
// Root Network and its kind: the strongest one posted anywhere counts, once.
const allOut=()=>hideoutFx().allOutMax;
const sameLine=(a,b)=>a.species===b.species||(SPECIES[a.species].line&&SPECIES[a.species].line===SPECIES[b.species].line);
// What c's perks, its crew and the hideout do to its work at station k: {out, tire, parts: [[label, ±frac]]}.
// out multiplies its output (0 when it refuses), tire multiplies the fatigue work costs it.
function workMods(c,k,crew=crewOf(k)){
  const mine=perksOf(c).filter(p=>p.at==='station'&&stMatch(p,k)),others=crew.filter(o=>o!==c);
  let out=1,tire=1;const parts=[];const add=(label,x,kind)=>{if(!x)return;out+=x;parts.push([label,x,kind])};
  for(const p of mine){
    const f=p.fx;
    if(f.out)add(p.name,val(p,'out'),p.kind);
    if(f.tire)tire+=val(p,'tire');
    if(f.soloOut&&!others.length)add(p.name,f.soloOut,p.kind);
    // Days already worked here: none yet if it has only just been posted (the preview and the day agree).
    if(f.settle&&(c.posted&&c.posted.k===k?c.posted.n:0)<f.settle.days)add(p.name,f.settle.out,p.kind);
    if(f.lowBond&&bondStar(c)<f.lowBond.below)add(p.name,f.lowBond.out,p.kind);
    if(f.lowComfort&&hideoutComfort()<f.lowComfort.below)add(p.name,f.lowComfort.out,p.kind);
    if(f.noFriend&&!others.some(o=>friendly(c,o)))add(p.name,f.noFriend,p.kind);
    if(f.refuse||(f.clashType&&others.some(o=>o.type===f.clashType||o.type2===f.clashType))){parts.push([p.name,-1,'flaw']);return{out:0,tire:0,parts,refuses:p.name}}
  }
  for(const o of others)for(const p of perksOf(o)){
    if(p.at!=='station'||!stMatch(p,k))continue;
    if(p.fx.crewOut)add(`${o.name}: ${p.name}`,val(p,'crewOut'),p.kind);
    if(p.fx.crewTire)tire+=val(p,'crewTire');
  }
  const ro=allOut();if(ro)add('Root Network',ro,'perk');
  if(c.skipped===S.day){parts.push(['Off today',-1,'flaw']);return{out:0,tire:0,parts,skipped:true}}
  return{out:Math.max(0,out),tire:Math.max(.2,tire),parts};
}
// Personality and line clashes in a crew, as [a, b, why] pairs (each costs output, as clashes always have).
function perkClashes(crew){
  const out=[];
  for(const a of crew)for(const p of perksOf(a)){
    if(p.at!=='station')continue;
    if(p.fx.clashLine)for(const b of crew)if(b!==a&&sameLine(a,b)&&b.id>a.id)out.push([a,b,p.name]);
    if(p.fx.clashPers)for(const b of crew)if(b!==a&&p.fx.clashPers.includes(b.pers))out.push([a,b,p.name]);
  }
  return out;
}
// Chemistry ignores the types of Aloof creatures.
const chemTypes=crew=>crew.filter(c=>!perksOf(c).some(p=>p.fx.noChem));

/* ---------- the hideout, and raids from it ---------- */
let comfortFn=()=>0,friendFn=()=>false;
// hideout.js hands these in (Comfort and friendships live there).
function setHideoutHooks(comfort,friends){comfortFn=comfort;friendFn=friends}
const hideoutComfort=()=>comfortFn();
const friendly=(a,b)=>friendFn(a,b);
// Everything posted creatures (and home-scoped perks) do for the hideout and raids, summed. Cached for the day
// and the postings, since raids ask for it often.
let memo=null,memoKey='';
function hideoutFx(){
  if(!S)return emptyFx();
  const key=S.day+'|'+Object.values(S.sections).map(s=>s.ids.join(',')).join(';')+'|'+S.creatures.length+'|'+S.creatures.reduce((a,c)=>a+(c.stage||0)*7+(c.bondXp||0),0);
  if(memo&&memoKey===key)return memo;
  const fx=emptyFx();
  for(const c of S.creatures){
    const k=postOf(c);
    for(const p of perksOf(c)){
      const live=p.at==='station'?k&&stMatch(p,k):p.at==='home';if(!live)continue;
      // A perk that refuses or clashes away its work still counts here only if the creature works.
      for(const [key2,v] of Object.entries(p.fx)){
        if(key2==='reveal')fx.reveal[v]=true;
        else if(key2==='keep')fx.keep[v]=true;
        else if(key2==='make'){for(const [m,n] of Object.entries(v))fx.make[m]=(fx.make[m]||0)+n*p.s}
        else if(key2==='comfort'&&p.at==='home'&&k)continue;   // Playful's Comfort is while off duty
        else if(key2==='allOut')fx.allOutMax=Math.max(fx.allOutMax,val(p,key2));
        else if(typeof v==='number'&&key2 in fx)fx[key2]+=val(p,key2);
        else if(v===true&&key2 in fx)fx[key2]=true;
      }
    }
  }
  fx.keepCoin=Math.min(SC.keepCoinCap,fx.keepCoin);
  memo=fx;memoKey=key;return fx;
}
function emptyFx(){return{allOutMax:0,reveal:{},keep:{},make:{},keepCoin:0,keepOre:false,playerHp:0,weaponDmg:0,buff:0,autoRevive:0,poisonRounds:false,poisonImmune:false,compHp:0,wildMul:0,bossDmg:0,kxp:0,
  heal:0,bondAll:0,comfort:0,eggSlots:0,hatchDays:0,mutation:0,hybrid:0,hatchBond:0,scrapOre:0,craftTier:0}}
const resetFxCache=()=>{memo=null};

/* ---------- in the party ---------- */
function partyFx(c){
  const fx={dmg:0,hp:0,taken:0,move:0,bossDmg:0};
  for(const p of perksOf(c))if(p.at==='party')for(const k in fx)if(p.fx[k])fx[k]+=val(p,k);
  return fx;
}
/* ---------- always ---------- */
function homeFx(c){
  const fx={food:0,xp:0,expItems:0};
  const k=postOf(c);
  for(const p of perksOf(c)){
    const on=p.at==='home'||(p.at==='station'&&k&&stMatch(p,k)&&p.fx.food);
    if(on)for(const key in fx)if(p.fx[key])fx[key]+=p.fx[key];
  }
  return fx;
}
// What c's perks and flaws do at station k, for the station panel and the posting list:
// [{name, kind, text}], with the exact output change where there is one. crew: who it works beside.
function activeHere(c,k,crew=crewOf(k)){
  const m=workMods(c,k,crew.includes(c)?crew:[...crew,c]),out=[],seen=new Set();
  for(const [name,x,kind] of m.parts){if(x===-1)out.push({name,kind:'flaw',text:m.skipped?'off today':'won’t work here'});else out.push({name,kind,text:`${x>0?'+':'−'}${Math.round(Math.abs(x)*100)}% output`});seen.add(name)}
  for(const p of perksOf(c)){
    if(p.at!=='station'||!stMatch(p,k)||seen.has(p.name)||!p.known)continue;
    if(p.fx.out||p.fx.soloOut||p.fx.settle||p.fx.lowBond||p.fx.lowComfort||p.fx.noFriend)continue;   // only when they bite
    out.push({name:p.name,kind:p.kind,text:perkText(p)});
  }
  return out;
}
// The numbers a perk shows on a page: "+18% Forge output" grows with the creature.
function perkText(p){
  const pct=x=>`${x>0?'+':'−'}${Math.round(Math.abs(x)*100)}%`;
  if(p.kind==='flaw'||p.s===1)return p.desc;
  const k=Object.keys(p.fx).find(x=>GROWS.has(x)&&typeof p.fx[x]==='number');
  return k?`${p.desc} (now ${['playerHp','make','comfort','bondAll','hatchBond'].includes(k)?'+'+Math.round(val(p,k)*10)/10:pct(val(p,k))})`:p.desc;
}

export {emptyFx as hideoutFxEmpty,activeHere,perksOf,workMods,perkClashes,chemTypes,hideoutFx,partyFx,homeFx,earned,strength,perkText,setHideoutHooks,resetFxCache,allOut};
