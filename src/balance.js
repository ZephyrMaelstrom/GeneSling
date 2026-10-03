/* ================= Act gates and catch-up (Phase 8) =================
   Each act ends in a gate that needs a boss, a Keeper rank and a creature or hideout goal at once
   (docs/DESIGN.md, "The 90-day journey"). The bosses are the portals themselves: the Rootworks boss
   opens the way to the veins, a vein boss to the Underheart, and freeing Ilsa to the Heart. The rest
   is checked here, from src/data/balance.json:
     - the veins (Floor 3's portal): Keeper rank 10 and 3 stations at tier 2;
     - the Underheart (Floor 6's portal): rank 25, bosses beaten in 2 veins and a Gen 3 cut-free creature;
     - the Heart (Floor 9's portal): rank 40 and a cut-free party of three.
   Catch-up: a Keeper more than 5 ranks behind the rank expected for their calendar day (counted from
   when the save began) earns double Keeper XP from raids, so nothing is lost to a slow week. */
import {BALANCE as BL,BOSSES,SECTION_IDS} from './content.js';
import {S,byId} from './state.js';
import {cutFree} from './genetics.js';
import {buildingLevel} from './buildings.js';

const G=BL.GATES,DEEP=['ember','drowned','choir','spires','sump'];
const veinBosses=()=>DEEP.filter(v=>Object.keys(S.progress.bosses||{}).some(b=>S.progress.bosses[b]&&BOSSES[b]&&BOSSES[b].vein===v)).length;
// Stations built to a level and staffed by enough workers (the veins gate, and the demo's Act I goal).
const stationsBuilt=({level,workers})=>SECTION_IDS.filter(k=>buildingLevel(k)>=level&&S.sections[k].ids.filter(id=>byId(id)).length>=workers).length;
const loadoutParty=()=>S.loadout.slots.map(byId).filter(Boolean);
// What a gate needs, each with whether it's met. party: the creatures going down (defaults to the loadout).
function gateNeeds(key,party){
  const g=G[key],out=[];if(!g)return out;
  if(g.rank)out.push({text:`Keeper rank ${g.rank}`,ok:S.keeper.level>=g.rank});
  if(g.stations){const n=stationsBuilt(g.stations);out.push({text:`${g.stations.n} stations at level ${g.stations.level} with ${g.stations.workers} workers each (${n} now)`,ok:n>=g.stations.n})}
  if(g.veinBosses){const n=veinBosses();out.push({text:`Bosses beaten in ${g.veinBosses} veins (${n} so far)`,ok:n>=g.veinBosses})}
  if(g.cutFree){const n=S.creatures.filter(cutFree).length;out.push({text:'A Gen 3 cut-free creature',ok:n>=g.cutFree})}
  if(g.cutFreeParty){const n=(party||loadoutParty()).filter(c=>c&&cutFree(c)).length;out.push({text:`A cut-free party of three (${n} now)`,ok:n>=g.cutFreeParty})}
  return out;
}
const gateOpen=(key,party)=>gateNeeds(key,party).every(x=>x.ok);
function gateBlockText(key,party){
  const miss=gateNeeds(key,party).filter(x=>!x.ok).map(x=>x.text);
  return miss.length?`The way to ${G[key].name} won't open yet. Still needed: ${miss.join(', ')}.`:'';
}
// The next gate this Keeper hasn't passed, for the Raid tab.
function nextGate(){const d=S.progress.deepest||0;return d<4?'veins':d<7?'underheart':!(S.story&&S.story.heart)?'heart':null}

/* ---------- catch-up ---------- */
const calendarDay=(now=Date.now())=>S.startedAt?Math.max(1,Math.floor((now-S.startedAt)/864e5)+1):1;
function expectedRank(day){
  const E=BL.CATCHUP.expected;if(day<=E[0][0])return E[0][1];
  for(let i=1;i<E.length;i++)if(day<=E[i][0]){const [d0,r0]=E[i-1],[d1,r1]=E[i];return Math.floor(r0+(r1-r0)*(day-d0)/(d1-d0))}
  return E[E.length-1][1];
}
const catchupMul=(day=calendarDay())=>S.keeper.level<expectedRank(day)-BL.CATCHUP.within?BL.CATCHUP.mul:1;

// v14: when the save began, for catch-up. Old saves start counting from the day they're loaded.
function balancify(d){d.startedAt=d.startedAt||Date.now();return d}

export {stationsBuilt,gateNeeds,gateOpen,gateBlockText,nextGate,veinBosses,calendarDay,expectedRank,catchupMul,balancify};
