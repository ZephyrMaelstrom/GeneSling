/* ================= A creature's own history =================
   Each creature keeps a short log of what happened to it (c.log), shown on the Story tab of its page,
   and counters for raids, extracts and kills. Entries are [day, kind, detail]; the words for each kind
   are in HISTORY.text in src/data/creatures.json, with {x} standing for the detail, so the log stays
   small in the save (at most HISTORY.max entries; the first one is always kept).

   Raids are recorded from the 'raid:end' event; hatching, evolving and titles call logEvent directly. */
import {HISTORY as H,BLOOM} from './content.js';
import {S,byId} from './state.js';
import {on} from './events.js';

function logEvent(c,kind,detail=''){
  if(!c)return;
  const log=c.log||(c.log=[]);
  log.push([S?S.day:1,kind,String(detail)]);
  // Keep the first entry (how it came to you) and the newest ones.
  if(log.length>H.max)log.splice(1,log.length-H.max);
}
const eventText=([,kind,x])=>(H.text[kind]||kind).replace('{x}',x);
// Where a raid happened, in words: "Floor 5 of the Ember Abyss".
function placeName(floor,vein){
  const v=vein&&BLOOM.VEINS[vein];
  return v&&vein!=='rootworks'?`Floor ${floor} of ${v.name.replace(/^The /,'the ')}`:`Floor ${floor}`;
}
// The newest first, as the Story tab shows them.
const history=c=>(c.log||[]).slice().reverse().map(e=>({day:e[0],kind:e[1],text:eventText(e)}));

// A raid that ended: catches, kills, extracts, bosses and close calls.
on('raid:end',r=>{
  const where=placeName(r.floor,r.vein);
  for(const c of r.caught||[])logEvent(c,'caught',where);
  if(!r.extracted)return;
  for(const m of r.party||[]){
    const c=m.c;if(m.downed||!S.creatures.includes(c))continue;
    c.extracts=(c.extracts||0)+1;c.kills=(c.kills||0)+(m.kills||0);c.lastRaid=S.day;
    if(r.boss)logEvent(c,'boss',r.boss);
    if(m.hpFrac!=null&&m.hpFrac<H.nearDeath){logEvent(c,'neardeath',where);c.nearDeaths=(c.nearDeaths||0)+1}
  }
},{order:5});
// A newly hatched creature, and its parents hear of it.
function logHatch(c){
  const mom=byId(c.mom),dad=byId(c.dad),names=[mom,dad].filter(Boolean).map(p=>p.name);
  logEvent(c,'hatched',names.length?names.join(' and '):'parents now gone');
  for(const p of [mom,dad])if(p)logEvent(p,'child',c.name);
}

export {logEvent,logHatch,eventText,history,placeName};
