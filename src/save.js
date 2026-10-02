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
     place as a backup. */
import {S,defaultOpts} from './state.js';

const SAVE_VERSION=6;
const LEGACY_KEY='genesling-save-v5';   // v5 prototype, localStorage
const FALLBACK_KEY='genesling-save';     // used only when IndexedDB is unavailable
const DB_NAME='genesling',STORE='saves',SLOT='main';

// MIGRATIONS[n] turns a version-n save into a version-(n+1) save.
const MIGRATIONS={
  // v6: storage moved from localStorage to IndexedDB. The data itself is unchanged.
  5:d=>d,
};

function migrate(d){
  if(!d||typeof d!=='object'||typeof d.v!=='number')throw new Error('not a GeneSling save');
  if(d.v>SAVE_VERSION)throw new Error(`save is version ${d.v}, this build reads up to ${SAVE_VERSION}`);
  while(d.v<SAVE_VERSION){
    const step=MIGRATIONS[d.v];if(!step)throw new Error(`no migration from save version ${d.v}`);
    const from=d.v;d=step(d);d.v=from+1;
  }
  d.opts=Object.assign(defaultOpts(),d.opts||{});
  return d;
}

/* ---------- IndexedDB ---------- */
let dbP=null;
function openDb(){
  if(!dbP)dbP=new Promise((res,rej)=>{
    if(!window.indexedDB)return rej(new Error('IndexedDB unavailable'));
    const q=indexedDB.open(DB_NAME,1);
    q.onupgradeneeded=()=>q.result.createObjectStore(STORE);
    q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);q.onblocked=()=>rej(new Error('IndexedDB blocked'));
  });
  return dbP;
}
function idb(mode,fn){return openDb().then(db=>new Promise((res,rej)=>{
  const tx=db.transaction(STORE,mode),st=tx.objectStore(STORE);let out;
  const q=fn(st);if(q)q.onsuccess=()=>{out=q.result};
  tx.oncomplete=()=>res(out);tx.onerror=tx.onabort=()=>rej(tx.error);
}))}
const idbGet=k=>idb('readonly',st=>st.get(k));
const idbPut=(k,v)=>idb('readwrite',st=>st.put(v,k));
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};

let useIdb=true;
async function readRecord(){
  try{const r=await idbGet(SLOT);if(r)return r}catch(e){useIdb=false}
  const fb=lsGet(FALLBACK_KEY);if(fb)return{data:fb};
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
function save(){
  if(!S)return;S.v=SAVE_VERSION;
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

export {SAVE_VERSION,MIGRATIONS,migrate,loadSave,save,saveDone};
