/* ================= Playtest pace (Phase 8) =================
   For the closed playtest: the save records when each act opened and how long each gate held the player
   back, counted in calendar days from when the save began. With play stats switched on, the same go out
   as events: 'act' (an act opened), 'gate_blocked' (a portal refused, at most once a day per gate, with what
   was missing) and 'gate_passed' (with the days spent waiting). The exit test asks that playtesters reach
   Act II at the expected pace and that nobody waits at a gate for more than a week (BALANCE.PLAYTEST). */
import {BALANCE} from './content.js';
import {S} from './state.js';
import {track} from './demo.js';
import {currentAct} from './lore.js';
import {calendarDay,gateNeeds} from './balance.js';

const pace=()=>{const T=S.telemetry||(S.telemetry={asked:false,on:false});return T.pace||(T.pace={act:1,acts:{1:1},gates:{}})};
// After every raid: note new acts and gates passed.
function paceTick(){
  if(!S)return;const P=pace(),day=calendarDay(),a=currentAct();
  for(let k=P.act+1;k<=a;k++){P.acts[k]=day;track('act',{act:k,calDay:day,raids:S.stats.raids})}
  P.act=Math.max(P.act,a);
  for(const [k,G] of Object.entries(BALANCE.GATES)){const g=P.gates[k];if(g&&g.blocked!=null&&g.passed==null&&(S.progress.deepest||0)>G.floor){g.passed=day;track('gate_passed',{gate:k,wait:day-g.blocked,calDay:day})}}
}
// A portal refused the player.
function gateBlocked(key){
  const P=pace(),day=calendarDay(),g=P.gates[key]||(P.gates[key]={});
  if(g.blocked==null)g.blocked=day;
  if(g.lastSent!==day){g.lastSent=day;track('gate_blocked',{gate:key,calDay:day,missing:gateNeeds(key).filter(x=>!x.ok).map(x=>x.text)})}
}
// The Test Lab's view of this save's pace against the playtest targets.
function paceReport(){
  const P=pace(),T=BALANCE.PLAYTEST,day=calendarDay();
  const waits=Object.entries(P.gates).map(([k,g])=>({gate:k,wait:(g.passed??day)-g.blocked,open:g.passed==null}));
  return{day,acts:P.acts,act2:P.acts[2]??null,act2Ok:P.acts[2]==null?day<=T.act2Day[1]:P.acts[2]<=T.act2Day[1],waits,stuck:waits.filter(w=>w.wait>T.maxGateWait)};
}
export {paceTick,gateBlocked,paceReport};
