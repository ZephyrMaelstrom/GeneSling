/* ================= Lore (Phase 7) =================
   The story is told in fragments, over four acts that each ask a bigger question:
   - Ilsa's journal: 30 pages. Thirteen turn up with Keeper rank; seventeen lie on the floors of the Bloom
     and must be carried out (a page found on a raid you don't survive turns up again later).
   - Rune walls: 16 carved walls, copied the moment you walk into their room. They're a simple letter-for-
     letter cipher of the Old Keepers' alphabet, so a player can break it alone; the Archive translates
     letters slowly from relics. Three walls give away secrets: a hybrid, a hidden room and a name.
   - Whispers: 15 rare raid moments that never repeat. Murals: 8 hideout walls that change with each act.
   - Codex entries for every evolution (the last form tells its Bloom history), boss memories, relics,
     and quest arcs for six residents (data in content.js).
   Nothing here touches the gameplay random stream: rooms are chosen by index and whispers use fxRand. */
import {fxRand} from './rng.js';
import {LORE as L,JOURNAL} from './content.js';
import {S} from './state.js';
import {R,msg,float,later} from './raid.js';
import {sfx} from './audio.js';
import {runeWall} from './endgame.js';

const loreState=()=>S.lore||(S.lore={pages:[],walls:[],whispers:[]});
function lorify(d){d.lore=d.lore||{pages:[],walls:[],whispers:[]};return d}

/* ---------- acts ---------- */
const gateMet=g=>!g||Object.entries(g).every(([k,v])=>k==='deepest'?(S.progress.deepest||0)>=v:k==='ilsa'?!!(S.story&&S.story.ilsa)===v:false);
// The current act: the last one whose gate is met. Gates only ever open, so acts only move forward.
function currentAct(){let a=1;for(const A of L.ACTS)if(gateMet(A.gate))a=Math.max(a,A.n);return a}

/* ---------- Ilsa's journal ---------- */
const where=f=>f.floor?`somewhere on Floor ${f.floor}`:f.vein?`somewhere in ${veinName(f.vein)}`:f.rest?'in a room the Bloom keeps hidden':f.ending?'after the Heart':'';
const veinName=v=>({ember:'the Ember Abyss',drowned:'the Drowned Galleries',choir:'the Hollow Choir',spires:'the Glasswind Spires',sump:'the Sump'})[v]||v;
// All thirty pages in story order: {id, n, act, title, text, found, hint}.
function journal(){
  const a=currentAct(),st=loreState();
  const rank=JOURNAL.map(j=>{const [pa,n]=L.RANK_PAGES[j.rank];return{id:'r'+j.rank,n,act:pa,title:j.title,text:j.text,found:S.keeper.level>=j.rank&&a>=pa,
    hint:S.keeper.level<j.rank?`Reach Keeper rank ${j.rank} to find it.`:`It turns up in ${L.ACTS[pa-1].name}. ${L.ACTS[pa-1].opens}.`}});
  const found=L.PAGES.map(p=>({...p,found:st.pages.includes(p.id),hint:a<p.act?`It turns up in ${L.ACTS[p.act-1].name}. ${L.ACTS[p.act-1].opens}.`:`It lies ${where(p.find)}.`}));
  return[...rank,...found].sort((x,y)=>x.n-y.n);
}
const pagesFound=()=>journal().filter(p=>p.found).length;

/* ---------- in a raid: pages and rune walls placed in rooms ---------- */
const storyRaid=()=>R&&(R.mode==='raid'||R.mode==='scav')&&!R.tier&&R.deepening==null;
const due=(list,floor,vein,have)=>list.filter(x=>currentAct()>=x.act&&!have(x)&&(x.find.floor===floor||(x.find.vein&&x.find.vein===vein&&floor>=4&&floor<=6)));
// Called for every new floor. Picks rooms by index, never by random, so seeded raids don't shift.
function placeLore(M){
  if(!storyRaid()||!M)return;
  R.lorePages=R.lorePages||[];
  const floor=M.floor,vein=M.plan&&M.plan.vein,st=loreState();
  const rooms=M.rooms.filter(r=>!['boss','secret','shop','shrine','portal'].includes(r.kind)&&(r.kind!=='start'||floor===10));
  if(!rooms.length)return;
  const page=due(L.PAGES,floor,vein,p=>st.pages.includes(p.id)||R.lorePages.includes(p.id))[0];
  const wall=due(L.WALLS,floor,vein,w=>st.walls.includes(w.id))[0];
  if(page){const r=rooms[(floor*7+3)%rooms.length];r.page={id:page.id,x:r.cx+70,y:r.cy-50}}
  if(wall){const r=rooms[(floor*5+1)%rooms.length];r.rune=wall.id}
}
// First step into a room: copy its rune wall, and maybe hear a whisper.
function loreRoom(r){
  if(!R||r.loreSeen)return;r.loreSeen=true;
  if(r.rune){const w=L.WALLS.find(x=>x.id===r.rune),st=loreState();if(w&&!st.walls.includes(w.id)){st.walls.push(w.id);sfx('quest');later(1.4,()=>msg(`A rune wall. You copy it down: ${runeWall(w.text)}`))}}
  if(storyRaid()&&r.kind!=='start'&&fxRand()<L.WHISPER.chance)whisper();
}
// Walking over a journal page picks it up. It is only kept if you extract.
function lorePick(){
  const r=R&&R.cur;if(!r||!r.page)return;
  if(Math.hypot(R.p.x-r.page.x,R.p.y-r.page.y)>28)return;
  R.lorePages.push(r.page.id);float(r.page.x,r.page.y-20,'A page of Ilsa’s journal','#f2e6c8',true);sfx('pickup');
  msg('A page of Ilsa’s journal! Extract to keep it.');r.page=null;
}
// The Keepers' Rest: a hidden room beside the Heart, told of by one rune wall.
function restChest(r){
  if(!r.rest)return;R.relics+=2;float(r.chest.x,r.chest.y-50,'Two Old Keeper relics','#fff3a8',true);
  if(!loreState().pages.includes('rest')&&!R.lorePages.includes('rest')){R.lorePages.push('rest');msg('Three chairs, two of them warm. On the third, a page in Ilsa’s hand.')}
}
// End of a raid: pages carried out are kept; the rest are lost and turn up again later.
function loreEnd(extracted){
  const got=R&&R.lorePages||[];if(!got.length)return'';
  if(!extracted)return`The journal page${got.length>1?'s':''} you found ${got.length>1?'are':'is'} lost with you. ${got.length>1?'They':'It'} will turn up again.`;
  const st=loreState();got.forEach(id=>{if(!st.pages.includes(id))st.pages.push(id)});
  return`You brought home ${got.length} page${got.length>1?'s':''} of Ilsa’s journal. Read ${got.length>1?'them':'it'} in the Codex.`;
}
// Choosing an ending at the Heart leaves the last page.
function onEnding(){const st=loreState();if(!st.pages.includes('after'))st.pages.push('after')}

/* ---------- whispers ---------- */
function whisperFits(w){
  if(currentAct()<w.act)return false;if(!R)return true;
  const f=R.map.floor,v=R.map.plan&&R.map.plan.vein;
  return(!w.vein||(w.vein===v&&f>=4&&f<=6))&&(!w.floor||w.floor===f);
}
function whisper(){
  const st=loreState(),w=L.WHISPERS.find(x=>!st.whispers.includes(x.id)&&whisperFits(x));if(!w)return null;
  st.whispers.push(w.id);if(R&&!R.over)later(2.5,()=>{msg(`A whisper: ${w.text}`);sfx('quest')});return w;
}

/* ---------- murals, codex, secrets ---------- */
const murals=()=>{const a=currentAct();return L.MURALS.map(m=>({...m,stage:a-1,text:m.stages[a-1]}))};
const formLore=(sp,stage)=>{const c=L.CODEX[sp];return c?c[Math.min(stage,c.length-1)]:''};
const wallKnown=id=>loreState().walls.includes(id);
// The secret hybrid is left off the breeding list until its wall is copied or one has been seen.
const secretHybridKnown=()=>{const w=L.WALLS.find(x=>x.secret==='hybrid');return(w&&wallKnown(w.id))||!!(S.dex&&S.dex.forms&&S.dex.forms[L.SECRET_HYBRID+':0']&&S.dex.forms[L.SECRET_HYBRID+':0'].seen)};
const fragments=()=>{const st=loreState();return pagesFound()+st.walls.length+st.whispers.length+(S.archive?S.archive.read:0)};
const FRAGMENT_TOTAL=()=>JOURNAL.length+L.PAGES.length+L.WALLS.length+L.WHISPERS.length+L.RELICS.length;
// Absolute story counts for residents' quests.
const STORY_STATS={relics:()=>S.archive?S.archive.read:0,walls:()=>loreState().walls.length,pages:pagesFound,ilsa:()=>S.story&&S.story.ilsa?1:0,
  ending:()=>S.story&&S.story.ending?1:0,maxGen:()=>Math.max(0,...S.creatures.map(c=>c.gen||0))};

/* ---------- the story so far, by act (Codex) ---------- */
function storyByAct(){
  const pages=journal(),st=loreState(),a=currentAct();
  return L.ACTS.map(A=>({...A,open:a>=A.n,
    pages:pages.filter(p=>p.act===A.n),
    walls:L.WALLS.filter(w=>w.act===A.n).map(w=>({...w,found:st.walls.includes(w.id)})),
    whispers:L.WHISPERS.filter(w=>w.act===A.n).map(w=>({...w,found:st.whispers.includes(w.id)}))}));
}

/* ---------- Test Lab ---------- */
function labLore(all){const st=loreState();if(all){st.pages=L.PAGES.map(p=>p.id);st.walls=L.WALLS.map(w=>w.id);st.whispers=L.WHISPERS.map(w=>w.id)}else{st.pages=[];st.walls=[];st.whispers=[]}}

export {loreState,lorify,currentAct,gateMet,journal,pagesFound,placeLore,loreRoom,lorePick,restChest,loreEnd,onEnding,whisper,whisperFits,murals,formLore,wallKnown,secretHybridKnown,fragments,FRAGMENT_TOTAL,STORY_STATS,storyByAct,labLore};
