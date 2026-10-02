/* ================= The hideout you build (Phase 4) =================
   The rules behind the hideout map; map.js draws it and prideui.js shows the panels.
     - Layout: S.layout is a list of placed things on a grid of 50 px tiles, {id, key, x, y, ref?}.
       Stations, the Codex board, dens and decor block their tiles; paths are flooring, so things
       can stand on them. Rows 0 to 6 are the yard; each hillside terrace adds rows above it with
       negative numbers, so clearing one never moves anything already placed.
     - Decor is crafted in the Workshop (S.decor holds what's in stores) and raises Comfort, which
       cuts fatigue and speeds bond, capped at +20%.
     - Creature life: off-duty creatures sleep in dens at night or when tired, play, and follow
       friends (creatures that came home from raids together and have bonded).
     - Trophies, the Hall of Legends and its perks, titles, and the breeder's sigil.
   All numbers live in src/data/pride.json. */
import {PRIDE as P,SECTION_IDS,BOSSES,EXCHANGE_DATA} from './content.js';
import {S,addLog,addKeeperXp,bondStar,formName,recordLineage,unplace,whereIs} from './state.js';
import {canPay,costText,expAway,itemByUid,itemName,makerText,pay,scrapItem} from './jobs.js';

const G=P.GRID;

/* ---------- layout ---------- */
const STATION_KEYS=[...SECTION_IDS,'archive'];
const isStation=k=>STATION_KEYS.includes(k);
const foot=k=>P.FOOT[isStation(k)?'station':k]||[1,1];
const layer=k=>k==='path'?'ground':'solid';
const minRow=()=>-(S.plots||0)*G.hillRows;
const rowCount=()=>G.baseRows+(S.plots||0)*G.hillRows;
function defaultLayout(){let n=1;return P.DEFAULT_LAYOUT.map(([key,x,y])=>({id:n++,key,x,y}))}
const layItem=id=>S.layout.find(i=>i.id===id);
const stationItem=k=>S.layout.find(i=>i.key===k);
function overlaps(i,x,y,w,h){const [iw,ih]=foot(i.key);return x<i.x+iw&&i.x<x+w&&y<i.y+ih&&i.y<y+h}
// Whether `key` can stand with its top-left tile at x,y (ignoring the placed item `ignore`).
function fits(key,x,y,ignore){
  const [w,h]=foot(key);
  if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||x+w>G.cols||y<minRow()||y+h>G.baseRows)return false;
  const L=layer(key);
  return!S.layout.some(i=>i.id!==ignore&&layer(i.key)===L&&overlaps(i,x,y,w,h));
}
// The front-most thing on a tile: solid things before paths.
function itemAt(x,y){
  const on=i=>{const [w,h]=foot(i.key);return x>=i.x&&x<i.x+w&&y>=i.y&&y<i.y+h};
  return S.layout.find(i=>layer(i.key)==='solid'&&on(i))||S.layout.find(on)||null;
}
const nextLayId=()=>S.layout.reduce((a,i)=>Math.max(a,i.id),0)+1;
const placedRef=(key,ref)=>S.layout.some(i=>i.key===key&&i.ref===ref);
// Everything in stores that can go on the map.
function placeable(){
  const out=[];
  for(const k in P.DECOR)if((S.decor[k]||0)>0)out.push({key:k,n:S.decor[k],name:P.DECOR[k].name});
  for(const t of S.trophies)if(!placedRef('trophy',t.id))out.push({key:'trophy',ref:t.id,n:1,name:trophyName(t)});
  for(const l of S.legends)if(!placedRef('statue',l.id))out.push({key:'statue',ref:l.id,n:1,name:`Statue of ${l.name}`});
  return out;
}
function placeNew(key,x,y,ref){
  if(key==='trophy'||key==='statue'){const list=key==='trophy'?S.trophies:S.legends;if(!list.some(t=>t.id===ref)||placedRef(key,ref))return null}
  else if(!P.DECOR[key]||!(S.decor[key]>0))return null;
  if(!fits(key,x,y))return null;
  const it={id:nextLayId(),key,x,y};if(ref!=null)it.ref=ref;
  if(P.DECOR[key])S.decor[key]--;
  S.layout.push(it);return it;
}
function moveItem(id,x,y){const i=layItem(id);if(!i||!fits(i.key,x,y,id))return false;i.x=x;i.y=y;return true}
const storable=i=>!!i&&!isStation(i.key)&&i.key!=='board';
function storeItem(id){
  const i=layItem(id);if(!storable(i))return false;
  S.layout=S.layout.filter(x=>x!==i);if(P.DECOR[i.key])S.decor[i.key]=(S.decor[i.key]||0)+1;
  return true;
}
// The first free spot, from the front of the yard backwards.
function autoPlace(key,ref){
  for(let y=G.baseRows-1;y>=minRow();y--)for(let x=0;x<G.cols;x++)if(fits(key,x,y))return placeNew(key,x,y,ref);
  return null;
}

// A station that isn't on the map yet (one added by an update): its default spot if free, else the first fit.
function placeStation(key){
  if(S.layout.some(i=>i.key===key))return null;
  const d=P.DEFAULT_LAYOUT.find(([k])=>k===key),spots=d?[[d[1],d[2]]]:[];
  for(let y=minRow();y<G.baseRows;y++)for(let x=0;x<G.cols;x++)spots.push([x,y]);
  for(const [x,y] of spots)if(fits(key,x,y)){const it={id:nextLayId(),key,x,y};S.layout.push(it);return it}
  return null;
}

/* ---------- hillside terraces ---------- */
const nextPlot=()=>P.PLOTS[S.plots||0]||null;
function plotBlock(){
  const p=nextPlot();if(!p)return'Every terrace is cleared.';
  if(S.keeper.level<p.rank)return`Needs Keeper rank ${p.rank}.`;
  if(!canPay(p.cost))return`Needs ${costText(p.cost)}.`;
  return'';
}
function buyPlot(){
  const p=nextPlot();if(!p||plotBlock())return false;
  pay(p.cost);S.plots=(S.plots||0)+1;
  addLog(`Cleared the ${p.name.toLowerCase()} up the hillside: ${G.hillRows} new rows to build on.`);
  return true;
}

/* ---------- decor and Comfort ---------- */
function craftDecor(k){
  const D=P.DECOR[k];if(!D||!pay(D.cost))return false;
  S.decor[k]=(S.decor[k]||0)+D.make;addKeeperXp(EXCHANGE_DATA.KEEPER_XP.component);
  addLog(`Workshop: made ${D.make>1?D.make+' '+D.name.toLowerCase()+' tiles':'a '+D.name.toLowerCase()}.`);
  return true;
}
// Placed decor, trophies and statues add points. Past repeatCap copies, the same decor adds nothing,
// so variety beats a field of lanterns.
function comfortPoints(){
  const seen={};let pts=0;
  for(const i of S.layout||[]){
    const D=P.DECOR[i.key],v=D?D.comfort:P.PLACED_COMFORT[i.key]||0;if(!v)continue;
    seen[i.key]=(seen[i.key]||0)+1;if(D&&seen[i.key]>P.COMFORT.repeatCap)continue;
    pts+=v;
  }
  return pts;
}
// Comfort as a fraction, 0 to 0.2: fatigue rises that much slower and bond grows that much faster.
const comfort=()=>S&&S.layout?Math.min(P.COMFORT.cap,comfortPoints()*P.COMFORT.perPoint):0;

/* ---------- creature life ---------- */
// The hideout's own clock, for show only: a full day every LIFE.dayLength seconds of looking at it.
const dayPhase=t=>((t/P.LIFE.dayLength)%1+1)%1;
const isNight=ph=>ph>=P.LIFE.nightFrom;
const pairKey=(a,b)=>a<b?a+'-'+b:b+'-'+a;
// Creatures that came home from the same raid. Friends have shared enough raids and bonded.
function recordShared(ids){
  ids=[...new Set(ids)];
  for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++){const k=pairKey(ids[i],ids[j]);S.friends[k]=(S.friends[k]||0)+1}
}
const sharedRaids=(a,b)=>S.friends[pairKey(a.id,b.id)]||0;
const areFriends=(a,b)=>sharedRaids(a,b)>=P.LIFE.friendRaids&&bondStar(a)>=P.LIFE.friendBond&&bondStar(b)>=P.LIFE.friendBond;
const friendsOf=c=>S.creatures.filter(o=>o!==c&&areFriends(c,o));
// Who is home and off duty (idle, or in the loadout), and what each is doing at this time of day:
// {state:'sleep', den} in a den (den null when every den is full), {state:'follow', friend}, or {state:'play'}.
function lifePlan(ph){
  const home=S.creatures.filter(c=>{const k=whereIs(c).kind;return k==='idle'||k==='loadout'});
  const dens=S.layout.filter(i=>i.key==='den').map(d=>({id:d.id,n:0}));
  const plan=new Map(),night=isNight(ph);
  for(const c of home)if(night||(c.fat||0)>=P.LIFE.sleepFatigue){
    const den=dens.find(x=>x.n<P.LIFE.denCap);if(den)den.n++;
    plan.set(c.id,{state:'sleep',den:den?den.id:null});
  }
  for(const c of home){
    if(plan.has(c.id))continue;
    const f=friendsOf(c).find(o=>{const p=plan.get(o.id);return home.includes(o)&&!(p&&(p.state==='sleep'||p.friend===c.id))});
    plan.set(c.id,f?{state:'follow',friend:f.id}:{state:'play'});
  }
  return plan;
}

/* ---------- titles ---------- */
function giveTitle(c,id){c.titles=c.titles||[];if(c.titles.includes(id))return false;c.titles.push(id);return true}
const titlesOf=c=>(c.titles||[]).filter(k=>P.TITLES[k]).map(k=>({id:k,...P.TITLES[k]}));
// After an extraction (raid counts already updated). party: [{c, downed}]. Returns notes.
function extractTitles(party,bossDown){
  const notes=[],home=party.filter(m=>!m.downed),got=(c,k)=>notes.push(`${c.name} earned the title ${P.TITLES[k].name}`);
  for(const {c} of home){
    if(bossDown&&giveTitle(c,'wyrmslayer'))got(c,'wyrmslayer');
    for(const k of ['ten','fifty'])if((c.raids||0)>=P.TITLES[k].raids&&giveTitle(c,k))got(c,k);
  }
  if(party.length>=2&&home.length===1&&giveTitle(home[0].c,'last'))got(home[0].c,'last');
  return notes;
}

/* ---------- trophies ---------- */
const nextTrophyId=()=>S.trophies.reduce((a,t)=>Math.max(a,t.id),0)+1;
const trophyName=t=>t.kind==='boss'?`${BOSSES[t.boss].name} trophy`:`${itemName(t.item)} on display`;
const listText=a=>a.length<2?a.join(''):a.slice(0,-1).join(', ')+' and '+a[a.length-1];
function trophyStory(t){
  if(t.kind==='weapon')return`${makerText(t.item)}. Put on display on day ${t.day}.`;
  if(t.legacy)return'Beaten before the trophy hall was built.';
  return`Beaten on day ${t.day} on Floor ${t.floor}, ${t.party.length?'with '+listText(t.party):'alone'}, and carried home.`;
}
// A boss's trophy comes home with the first raid that beats it and extracts.
function awardBossTrophy(bossId,party,floor){
  if(S.trophies.some(t=>t.kind==='boss'&&t.boss===bossId))return null;
  const t={id:nextTrophyId(),kind:'boss',boss:bossId,day:S.day,floor,party};
  S.trophies.push(t);autoPlace('trophy',t.id);
  addLog(`The ${trophyName(t)} now stands in the hideout.`);
  return t;
}
// Only Legendary weapons go on display. They leave the gear list until taken down.
function displayWeapon(uid){
  const it=itemByUid(uid);if(!it||it.kind!=='gun'||it.q<4)return null;
  scrapItem(it);const t={id:nextTrophyId(),kind:'weapon',item:it,day:S.day};
  S.trophies.push(t);autoPlace('trophy',t.id);addLog(`Put the ${itemName(it)} on display.`);
  return t;
}
function takeDownWeapon(id){
  const t=S.trophies.find(x=>x.id===id&&x.kind==='weapon');if(!t)return false;
  S.trophies=S.trophies.filter(x=>x!==t);S.layout=S.layout.filter(i=>!(i.key==='trophy'&&i.ref===id));S.items.push(t.item);
  return true;
}

/* ---------- the Hall of Legends ---------- */
function retireBlock(c){
  if(!c)return'Choose a creature.';
  if(expAway(c))return`${c.name} is away on an expedition.`;
  if((c.raids||0)<P.LEGEND.minRaids)return`Needs ${P.LEGEND.minRaids} raids home (has ${c.raids||0}).`;
  if(c.level<P.LEGEND.minLevel)return`Needs Lv ${P.LEGEND.minLevel}.`;
  return'';
}
// Retiring a veteran: it leaves the roster for good, becomes a statue with its record, and grants
// its type's perk. Each type's perk stacks up to LEGEND.maxStack times.
function retire(c){
  if(retireBlock(c))return null;
  recordLineage(c);unplace(c);S.creatures=S.creatures.filter(x=>x!==c);
  const L={id:c.id,name:c.name,form:formName(c),species:c.species,stage:c.stage||0,type:c.type,type2:c.type2,looks:c.looks,
    level:c.level,raids:c.raids||0,gen:c.gen||0,titles:titlesOf(c).map(t=>t.name),by:c.by||null,day:S.day,perk:c.type};
  S.legends.push(L);autoPlace('statue',L.id);
  const pk=P.PERKS[c.type];addLog(`${c.name} retired to the Hall of Legends. ${pk.name}: ${pk.desc.toLowerCase()}.`);
  return L;
}
// The total of one perk value (dmg, food, rest, kxp, hp, coin, bond) across all legends.
function perk(key){
  const per={};let v=0;
  for(const l of (S&&S.legends)||[]){
    const p=P.PERKS[l.perk];if(!p||!p[key])continue;
    per[l.perk]=(per[l.perk]||0)+1;if(per[l.perk]<=P.LEGEND.maxStack)v+=p[key];
  }
  return v;
}

/* ---------- the breeder's sigil ---------- */
function setSigil(o){
  const Z=P.SIGIL;
  S.sigil=o?{shape:Z.shapes.includes(o.shape)?o.shape:Z.shapes[0],color:Z.colors.includes(o.color)?o.color:Z.colors[0],glyph:Z.glyphs.includes(o.glyph)?o.glyph:Z.glyphs[0]}:null;
  return S.sigil;
}
// The maker's mark a creature bred now carries.
const breederMark=()=>({name:S.keeperName||'',sigil:S.sigil?{...S.sigil}:null});

/* ---------- save v10 ---------- */
// Fields Phase 4 adds to a save. Bosses already beaten come home as trophies, in stores.
function pridify(d){
  d.layout=d.layout||defaultLayout();d.plots=d.plots||0;d.decor=d.decor||{};d.friends=d.friends||{};
  d.legends=d.legends||[];d.sigil=d.sigil??null;d.demo=d.demo||null;d.telemetry=d.telemetry||null;
  if(!d.trophies){d.trophies=[];let n=1;for(const b of Object.keys((d.progress&&d.progress.bosses)||{}))if(BOSSES[b])d.trophies.push({id:n++,kind:'boss',boss:b,day:d.day,floor:0,party:[],legacy:true})}
  (d.creatures||[]).forEach(c=>{c.titles=c.titles||[]});
  return d;
}

export {placeStation,STATION_KEYS,isStation,foot,layer,minRow,rowCount,defaultLayout,layItem,stationItem,fits,itemAt,placeable,placedRef,placeNew,moveItem,storable,storeItem,autoPlace,
  nextPlot,plotBlock,buyPlot,craftDecor,comfortPoints,comfort,dayPhase,isNight,pairKey,recordShared,sharedRaids,areFriends,friendsOf,lifePlan,
  giveTitle,titlesOf,extractTitles,trophyName,trophyStory,awardBossTrophy,displayWeapon,takeDownWeapon,retireBlock,retire,perk,setSigil,breederMark,pridify};
