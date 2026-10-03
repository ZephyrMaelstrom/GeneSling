/* ================= Saves =================
   The save lives in IndexedDB (database "genesling", store "saves", key "main") as
   {v, saved, data}, where data is the JSON of S. Every save carries a version
   number, and loading runs the migrations below in order until the save is current.

   Rules (from Phase 0 on):
   - Never reset a save. Any change to the save format bumps SAVE_VERSION and adds a
     migration from the previous version.
   - A save that can't be read or migrated (corrupt, or from a newer build) is copied
     to a backup key before anything new is written over it.
   - The v5 prototype's localStorage save is read once on first load and left in
     place as a backup.
   - The demo saves under its own names (database "genesling-demo"), so it can't overwrite the
     full game's save on the same site. With no save of its own, the full game loads the demo's,
     which is how a demo save carries into the full game. */
import {genomeFrom,express} from './genetics.js';
import {pridify,placeStation} from './hideout.js';
import {bloomify} from './bloom.js';
import {endgamify} from './endgame.js';
import {lorify} from './lore.js';
import {balancify} from './balance.js';
import {S,setS} from './state.js';
import {adoptOpts} from './device.js';
import {DEMO} from './flags.js';
import {perkify} from './buildings.js';

const SAVE_VERSION=17;
const LEGACY_KEY='genesling-save-v5';   // v5 prototype, localStorage
const NAMES={full:{db:'genesling',fallback:'genesling-save'},demo:{db:'genesling-demo',fallback:'genesling-demo-save'}};
const OWN=DEMO?NAMES.demo:NAMES.full;
const FALLBACK_KEY=OWN.fallback;          // used only when IndexedDB is unavailable
const DB_NAME=OWN.db,STORE='saves',SLOT='main';

// MIGRATIONS[n] turns a version-n save into a version-(n+1) save.
const MIGRATIONS={
  // v6: storage moved from localStorage to IndexedDB. The data itself is unchanged.
  5:d=>d,
  // v7 (Genetics 2.0): every creature gets a genome. Its v5 genes and traits become matching
  // allele pairs, so it looks and fights the same; Haste becomes Tempo and Temper becomes Focus.
  // New loci (Grit, Knack, Yield) start at the neutral grade, looks at the species default.
  // Parents of v5 creatures were never recorded, so their family trees start with them.
  6:d=>{
    const fix=c=>{if(!c||c.genome)return;c.genome=genomeFrom(c.genes||{},c.traits||[]);c.mom=c.mom??null;c.dad=c.dad??null;c.pure=c.pure||1;c.bred=c.bred||0};
    (d.creatures||[]).forEach(fix);(d.eggs||[]).forEach(e=>fix(e.child));
    d.tree=d.tree||{};d.settings=Object.assign({genes:false},d.settings||{});
    return d;
  },
  // v8 (Jobs and production): materials, weapons as items with quality and durability, pens,
  // expeditions and fatigue. Every weapon owned becomes a Fine item at full durability. Pens
  // are pre-built so nobody starts over the new roster cap.
  7:d=>{
    d.mats=d.mats||{};d.items=d.items||[];d.nextUid=d.nextUid||1;d.prints=d.prints||[];d.mastery=d.mastery||{};
    d.expeditions=d.expeditions||[];d.prod=d.prod||{};d.keeperName=d.keeperName||'';
    const mk=id=>{const it={uid:d.nextUid++,kind:'gun',id,q:1,dur:8,max:8,maker:null,fore:null,src:'legacy'};d.items.push(it);return it};
    const made={};
    for(const [id,n] of Object.entries(d.guns||{})){if(id==='pistol')continue;made[id]=[];for(let i=0;i<n;i++)made[id].push(mk(id).uid)}
    const L=d.loadout||(d.loadout={slots:[null,null,null]});
    L.guns=(L.guns||[]).map(id=>id&&id!=='pistol'&&made[id]&&made[id].length?made[id].shift():null);
    if(L.guns.length<2)L.guns.length=2;L.guns=[L.guns[0]??null,L.guns[1]??null];
    L.satchel=L.satchel??null;L.tonics=L.tonics||0;
    delete d.guns;
    const n=(d.creatures||[]).length;d.pens=Math.max(d.pens||0,Math.ceil(Math.max(0,n-16)/4));
    (d.creatures||[]).forEach(c=>{c.fat=c.fat||0});(d.eggs||[]).forEach(e=>{e.child.fat=0});
    return d;
  },
  // v9 (The Exchange): the market's state lives in the save. It's created on first load.
  8:d=>{d.market=d.market??null;d.marketSync=d.marketSync??d.day;return d},
  // v10 (Hideout builder): the fixed map becomes a grid layout (laid out like the old map), with decor,
  // hillside terraces, friendships, titles, the Hall of Legends and the breeder's sigil. Bosses already
  // beaten come home as trophies, waiting in stores to be placed.
  9:pridify,
  // v11 (The Bloom expands): the Apothecary station (placed on the map where it fits), and the Bloom's
  // state: recent raid combinations, contracts and vein maps.
  10:d=>{
    d.sections=d.sections||{};d.sections.apothecary=d.sections.apothecary||{cap:3,ids:[]};
    if(d.layout){const keep=S;setS(d);try{placeStation('apothecary')}finally{setS(keep)}}
    return bloomify(d);
  },
  // v12 (Underheart and endgame): the story (Ilsa, the Heart, the ending), Unbound progress, the Archive,
  // the Mutation Lab, shows and ribbons, the Deepening, seasons, Keeper titles and the Renown log.
  11:endgamify,
  // v13 (Lore): journal pages carried home, rune walls copied and whispers heard.
  12:lorify,
  // v14 (Balance): when the save began, for catch-up Keeper XP.
  13:balancify,
  // v15 (Groundwork): device options (joysticks, sound, palette, render scale...) leave the save for this
  // device's local storage, so a synced or restored save doesn't carry one phone's settings to another.
  // The first device to load the old save keeps its options, unless it already has its own.
  14:d=>{adoptOpts(d.opts);delete d.opts;return d},
  // v16 (Creature pages): each creature keeps a short history (c.log) and counts its kills and extracts.
  // Nothing was recorded before, so old creatures start with one line saying so; eggs start empty.
  15:d=>{
    const day=d.day||1;
    (d.creatures||[]).forEach(c=>{c.log=c.log||[[day,'before','']];c.kills=c.kills||0;c.extracts=c.extracts||0});
    (d.eggs||[]).forEach(e=>{const c=e.child;c.log=c.log||[];c.kills=c.kills||0;c.extracts=c.extracts||0});
    return d;
  },
  // v17 (Perks): stations become buildings with levels, and creatures bring their own perks and flaws.
  // Each station's building starts at the level matching the tier it had, so nothing built is lost.
  16:perkify,
};

function migrate(d){
  if(!d||typeof d!=='object'||typeof d.v!=='number')throw new Error('not a GeneSling save');
  if(d.v>SAVE_VERSION)throw new Error(`save is version ${d.v}, this build reads up to ${SAVE_VERSION}`);
  while(d.v<SAVE_VERSION){
    const step=MIGRATIONS[d.v];if(!step)throw new Error(`no migration from save version ${d.v}`);
    const from=d.v;d=step(d);d.v=from+1;
  }
  // Expressed genes, traits and looks are derived from the genome; rebuild them on every load.
  (d.creatures||[]).forEach(express);(d.eggs||[]).forEach(e=>express(e.child));
  return d;
}

/* ---------- IndexedDB ---------- */
const dbs={};
function openDb(name=DB_NAME){
  if(!dbs[name])dbs[name]=new Promise((res,rej)=>{
    if(!window.indexedDB)return rej(new Error('IndexedDB unavailable'));
    const q=indexedDB.open(name,1);
    q.onupgradeneeded=()=>q.result.createObjectStore(STORE);
    q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);q.onblocked=()=>rej(new Error('IndexedDB blocked'));
  });
  return dbs[name];
}
function idb(mode,fn,name){return openDb(name).then(db=>new Promise((res,rej)=>{
  const tx=db.transaction(STORE,mode),st=tx.objectStore(STORE);let out;
  const q=fn(st);if(q)q.onsuccess=()=>{out=q.result};
  tx.oncomplete=()=>res(out);tx.onerror=tx.onabort=()=>rej(tx.error);
}))}
const idbGet=(k,name)=>idb('readonly',st=>st.get(k),name);
const idbPut=(k,v)=>idb('readwrite',st=>st.put(v,k));
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};

let useIdb=true;
async function readRecord(){
  try{const r=await idbGet(SLOT);if(r)return r}catch(e){useIdb=false}
  const fb=lsGet(FALLBACK_KEY);if(fb)return{data:fb};
  if(!DEMO){
    // A demo save on this site carries into the full game. The demo's copy stays where it is.
    try{const r=await idbGet(SLOT,NAMES.demo.db);if(r)return{data:r.data,fromDemo:true}}catch(e){}
    const dfb=lsGet(NAMES.demo.fallback);if(dfb)return{data:dfb,fromDemo:true};
  }
  if(DEMO)return null;
  const legacy=lsGet(LEGACY_KEY);if(legacy)return{data:legacy,legacy:true};
  return null;
}
async function backup(raw){
  const key='backup-'+Date.now();
  try{if(useIdb){await idbPut(key,raw);return}}catch(e){}
  lsSet('genesling-'+key,typeof raw==='string'?raw:JSON.stringify(raw));
}

// Returns the migrated save, or null if there is none (or it couldn't be read; it is backed up first).
async function loadSave(){
  const rec=await readRecord();if(!rec)return null;
  try{return migrate(JSON.parse(rec.data))}
  catch(e){console.warn('GeneSling: could not load save, backing it up.',e);await backup(rec.legacy?rec.data:rec);return null}
}

/* ---------- writing ---------- */
// save() is called synchronously all over the game. It snapshots S right away and
// writes in the background; if a write is in flight, only the newest snapshot follows it.
let pending=null,writing=null;
// While a simulation plays on a throwaway copy of the save, nothing may be written.
let held=0;
function holdSaves(fn){held++;try{return fn()}finally{held--}}
function save(){
  if(!S||held)return;S.v=SAVE_VERSION;
  pending=JSON.stringify(S);
  if(!writing)writing=flush();
  return writing;
}
async function flush(){
  while(pending!==null){
    const data=pending;pending=null;
    const rec={v:SAVE_VERSION,saved:Date.now(),data};
    if(useIdb){try{await idbPut(SLOT,rec);continue}catch(e){useIdb=false}}
    lsSet(FALLBACK_KEY,data);
  }
  writing=null;
}
// Resolves once every save so far is on disk (used by tests and before reloads).
const saveDone=()=>writing||Promise.resolve();

export {holdSaves,SAVE_VERSION,NAMES,MIGRATIONS,migrate,loadSave,save,saveDone};
