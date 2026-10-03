/* ================= The Journey Simulator in the Test Lab (Phase 8) =================
   Runs the four bot players over every seed in JOURNEY.seeds and shows when each reached each act,
   their Keeper rank over time, the Unbound tiers by day 90, and the exit test's verdict. */
import {esc} from './util.js';
import {BALANCE} from './content.js';
import {ui} from './state.js';
import {sparkline} from './chart.js';
import {runJourneys,journeyReport} from './journey.js';
import {paceReport} from './playtest.js';
import {onAct} from './actions.js';
import {renderAll} from './ui.js';

const J=BALANCE.JOURNEY;
function runJourneyLab(){
  const runs=runJourneys(),rep=journeyReport(runs);
  ui.journey={rep,rows:runs.map(r=>({seed:r.seed,name:r.name,acts:r.acts,deaths:r.deaths,raids:r.raids,eggs:r.eggs,tierDays:r.tierDays,
    rank:[30,60,90].map(d=>(r.log[Math.min(d,r.log.length)-1]||{}).rank),tier90:(r.log[Math.min(90,r.log.length)-1]||{}).tier,ranks:r.log.filter((x,i)=>i%3===0).map(x=>x.rank)}))};
  return ui.journey;
}
const d=v=>v==null?'—':v;
// This save's own pace, as the closed playtest will measure it.
function pacePanel(){
  const P=paceReport(),T=BALANCE.PLAYTEST;
  return`<h3>This save's pace</h3><p class="status">Calendar day ${P.day}. Acts opened on day ${Object.entries(P.acts).map(([a,d])=>`${a}: ${d}`).join(', ')}. ${P.waits.length?`Gate waits: ${P.waits.map(w=>`${w.gate} ${w.wait} day${w.wait===1?'':'s'}${w.open?' (still waiting)':''}`).join(', ')}.`:'No gate has held you back yet.'}</p>
    <p class="status">Playtest targets: Act II by day ${T.act2Day[1]}, no gate wait over ${T.maxGateWait} days. ${P.act2Ok&&!P.stuck.length?'On pace.':'Behind pace.'}</p>`;
}
function journeyPanel(){
  const R=ui.journey;
  const head=`<h3>Journey Simulator</h3><p class="hint">Bot players run the whole journey on a throwaway save through the game's own systems (Keeper rank, levels, breeding and hatching, stations, gates, Ilsa, the endings and the Unbound tiers); only the fighting is modelled. A raider, a crafter and a breeder play about 90 minutes a day for ${J.days} days, a casual player about 30 minutes a day for ${J.styles.casual.days}. Seeds ${J.seeds.join(', ')}.</p>
    <div class="row"><button class="btn" data-act="lab-journey">${R?'Run again':'Run the journey'}</button><span class="status">About ten seconds.</span></div>`;
  if(!R)return head+pacePanel();
  const rows=R.rows.map(r=>`<tr><td>${esc(r.name)} · ${r.seed}</td><td>${d(r.acts.act2)}</td><td>${d(r.acts.act3)}</td><td>${d(r.acts.act4)}</td><td>${d(r.acts.heart)}</td><td>${r.rank.map(d).join(' / ')}</td><td>${d(r.tier90)}</td><td>${d(r.tierDays[3])}</td><td>${r.deaths}</td><td>${sparkline(r.ranks)}</td></tr>`).join('');
  const checks=R.rep.checks.map(c=>`<li class="${c.ok?'on':''}"><b>${c.ok?'✓':'✗'}</b> <span>${esc(c.name)}: ${esc(String(c.got))} (want ${c.want.join(' to ')})</span></li>`).join('');
  return`${head}<div style="overflow-x:auto"><table class="jtable"><thead><tr><th>Player · seed</th><th>Act II</th><th>Act III</th><th>Act IV</th><th>Heart</th><th>Rank d30/60/90</th><th>Tier d90</th><th>Tier 20</th><th>Deaths</th><th>Rank</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3>Exit test ${R.rep.pass?'<span class="chip good">passes</span>':'<span class="chip bad">fails</span>'}</h3><ul class="tierlist">${checks}</ul>${pacePanel()}`;
}
/* ---------- actions ---------- */
onAct('lab-journey',d=>{runJourneyLab();renderAll()});
export {runJourneyLab,journeyPanel};
