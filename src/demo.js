/* ================= The demo, feedback and opt-in play stats =================
   The demo is the Rootworks (floors 1 to 3) and Act I: Keeper rank stops at 10, the portal below the
   Floor 3 boss stays shut, and the Test Lab is hidden. It saves under its own name, so it can never
   overwrite the full game's save on the same site, and the full game picks the demo's save up on its
   first load (the save carries into the full game).

   Play stats are opt-in and anonymous: a random install id, the day, the Keeper rank and what
   happened (a session started, the tutorial was finished, a raid ended, the demo was completed).
   Nothing leaves the device unless the player says yes AND src/data/firebase.json names a Firebase
   project; events then go to Firestore over its REST API. Feedback goes to the same project, or to
   a prefilled GitHub issue when no project is set. */
import {BOSSES,PRIDE as P} from './content.js';
import FB from './data/firebase.json';
import {DEMO} from './flags.js';
import {S,ui} from './state.js';
import {save} from './save.js';
import {esc,$} from './util.js';
import {queueModal,closeModal,openModal,renderMain} from './ui.js';
import {on} from './events.js';
import {onAct,onChange} from './actions.js';
import {stationsBuilt} from './balance.js';

const ISSUES='https://github.com/ZephyrMaelstrom/GeneSling/issues/new';

/* ---------- Act I goals: the demo's end ---------- */
function demoGoals(){
  const G=P.DEMO.goals;
  return[
    {name:'Beat a Rootworks boss',v:Object.keys(S.progress.bosses).filter(b=>BOSSES[b]&&BOSSES[b].set===0).length,n:G.bosses},
    {name:`Reach Keeper rank ${G.rank}`,v:S.keeper.level,n:G.rank},
    {name:`${G.stations.n} stations at level ${G.stations.level} with ${G.stations.workers} workers each`,v:stationsBuilt(G.stations),n:G.stations.n},
  ];
}
const demoComplete=()=>demoGoals().every(g=>g.v>=g.n);
// Called after every raid. The first time Act I's goals are all met, the demo's end screen shows.
function demoProgress(){
  if(!DEMO||!S||(S.demo&&S.demo.done)||!demoComplete())return false;
  S.demo={done:true,day:S.day};save();track('demo_complete',{});
  queueModal(demoEndHtml());
  return true;
}
const demoEndHtml=()=>`<h2 class="res-title win">You finished Act I</h2>
  <p>That's the end of the GeneSling demo: the Rootworks, its bosses and the first act of Ilsa's story.</p>
  <p class="hint">Your save carries into the full game. Open it on this same device and browser and your hideout, creatures and trophies will be waiting. You can keep playing the demo too.</p>
  <div class="row"><button class="btn primary" data-act="feedback">Send feedback</button><a class="btn" href="../">Open the full game</a><button class="btn" data-act="close">Keep playing</button></div>`;
const demoGoalsHtml=()=>`<ul class="tierlist">${demoGoals().map(g=>`<li class="${g.v>=g.n?'on':''}"><b>${g.v>=g.n?'✓':Math.min(g.v,g.n)+'/'+g.n}</b> <span>${g.name}</span></li>`).join('')}</ul>`;

/* ---------- opt-in play stats ---------- */
const sent=[];   // the latest events, newest first (shown in Settings, read by tests)
const configured=()=>!!(FB.apiKey&&FB.projectId);
const statsOn=()=>!!(S&&S.telemetry&&S.telemetry.on);
function installId(){const a=new Uint8Array(12);crypto.getRandomValues(a);return[...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
// Firestore's REST API wants typed fields.
function toFields(o){
  const f={};
  for(const [k,v] of Object.entries(o))f[k]=typeof v==='number'?{doubleValue:v}:typeof v==='boolean'?{booleanValue:v}:{stringValue:String(v)};
  return{fields:f};
}
function post(collection,obj){
  if(!configured())return Promise.resolve(false);
  const url=`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(FB.projectId)}/databases/(default)/documents/${collection}?key=${encodeURIComponent(FB.apiKey)}`;
  return fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(toFields(obj)),keepalive:true}).then(r=>r.ok).catch(()=>false);
}
function track(ev,data={}){
  if(!statsOn())return null;
  const e={ev,id:S.telemetry.id,demo:DEMO,playtest:!!S.telemetry.playtest,day:S.day,rank:S.keeper.level,t:Date.now(),...data};
  sent.unshift(e);sent.length=Math.min(sent.length,30);
  post(P.STATS.collection,e);
  return e;
}
// After every raid: the play stat, then the demo's end screen if Act I is done. The day and rank are as they
// stood when the raid ended, before the next day began.
on('raid:done',r=>{track('raid_end',{outcome:r.outcome,floor:r.floor,deepest:r.deepest,mode:r.mode,day:r.day,rank:r.rank});demoProgress()});
function setStats(on){
  S.telemetry=Object.assign(S.telemetry||{},{asked:true,on:!!on});
  if(on&&!S.telemetry.id)S.telemetry.id=installId();
  if(!on)sent.length=0;
  save();if(on)track('opt_in',{tutorial:!!S.tutorialDone});
}
// Counted on every load: "returning" means the last session was more than STATS.returnHours ago.
function sessionStart(){
  if(!S)return;
  const T=S.telemetry||(S.telemetry={asked:false,on:false}),now=Date.now();
  const returning=!!T.last&&now-T.last>=P.STATS.returnHours*3600e3;
  T.last=now;T.sessions=(T.sessions||0)+1;save();
  track('session_start',{returning,sessions:T.sessions,tutorial:!!S.tutorialDone});
  // A closed-playtest link (…/GeneSling/?playtest) marks the save, and the full game then asks too.
  if(/[?&]playtest\b/.test(location.search||''))T.playtest=true;
  if((DEMO||T.playtest)&&S.tutorialDone&&!T.asked)askStats();
}
const statsAskHtml=()=>`<h2>Help shape GeneSling?</h2>
  <p>May ${DEMO?'the demo':'GeneSling'} send anonymous play stats? They're a random id for this device, the day and Keeper rank, and when you finish the tutorial, end a raid, open a new act, reach a gate you can't pass yet${DEMO?' or finish the demo':''}. No names, no creatures, nothing else.</p>
  <p class="hint">You can change this any time in Settings.</p>
  <div class="row"><button class="btn primary" data-act="stats" data-k="1">Yes, send stats</button><button class="btn" data-act="stats" data-k="0">No thanks</button></div>`;
const askStats=()=>queueModal(statsAskHtml());
// After the tutorial, the demo asks once.
function tutorialDone(){track('tutorial_done',{});const T=S.telemetry||{};if((DEMO||T.playtest)&&!T.asked)askStats()}

/* ---------- feedback ---------- */
const feedbackHtml=()=>`<h2>Feedback</h2><p class="hint">What did you enjoy, what confused you, what broke? ${configured()?'This goes straight to the developer.':'This opens a prefilled GitHub issue.'}</p>
  <label class="field">How was it?<select id="fb-rate"><option value="">Choose</option><option>Loved it</option><option>Liked it</option><option>It was OK</option><option>Didn't enjoy it</option></select></label>
  <label class="field">Your thoughts<textarea id="fb-text" rows="5" maxlength="2000" style="width:100%"></textarea></label>
  <div class="row"><button class="btn primary" data-act="sendfeedback">Send</button><button class="btn" data-act="close">Cancel</button></div><p class="status" id="fb-status"></p>`;
// Returns how it was sent: 'firebase', 'github' or 'empty'.
async function sendFeedback(rate,text){
  text=(text||'').trim().slice(0,2000);if(!text&&!rate)return'empty';
  const meta={demo:DEMO,day:S?S.day:0,rank:S?S.keeper.level:0,ua:navigator.userAgent.slice(0,120)};
  if(configured()){await post(P.STATS.feedback,{rate:rate||'',text,...meta,t:Date.now()});return'firebase'}
  const body=`${rate?'**'+rate+'**\n\n':''}${text}\n\n---\n${DEMO?'Demo':'Full game'} · day ${meta.day} · Keeper rank ${meta.rank}`;
  window.open(`${ISSUES}?title=${encodeURIComponent('Feedback: '+(text.split('\n')[0].slice(0,60)||rate))}&body=${encodeURIComponent(body)}&labels=feedback`,'_blank','noopener');
  return'github';
}
const statsPanel=()=>`<h3>Play stats</h3><p class="hint">Opt-in and anonymous. ${configured()?'':'Stats aren’t connected to a server in this build, so nothing is sent either way.'}</p>
  <label class="check"><input type="checkbox" data-act="statsopt" ${statsOn()?'checked':''}> Send anonymous play stats</label>
  ${statsOn()&&sent.length?`<p class="status">Latest: ${sent.slice(0,4).map(e=>esc(e.ev)).join(', ')}</p>`:''}
  <div class="row"><button class="btn small" data-act="feedback">Send feedback</button></div>`;

/* ---------- actions ---------- */
onAct('feedback',d=>{openModal(feedbackHtml())});
onAct('sendfeedback',d=>{const rate=$('#fb-rate').value,text=$('#fb-text').value;sendFeedback(rate,text).then(how=>{const st=$('#fb-status');if(st)st.textContent=how==='empty'?'Write something first.':how==='firebase'?'Thank you! Sent.':'Thank you! Finish sending it on GitHub.'})});
onAct('stats',d=>{setStats(d.k==='1');closeModal();if(ui.tab==='settings')renderMain()});
onChange('statsopt',el=>{setStats(el.checked);renderMain()});
export {DEMO,demoGoals,demoComplete,demoProgress,demoEndHtml,demoGoalsHtml,sent,configured,statsOn,track,setStats,sessionStart,askStats,tutorialDone,feedbackHtml,sendFeedback,statsPanel,toFields};
