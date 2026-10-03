/* ================= Station buildings =================
   What a station can do comes from its building, which the Keeper upgrades once with coin, materials
   and Keeper rank: weapon tiers at the Forge, egg slots at the Nursery, the Gene Lab at the Training
   Grounds. How well it does it comes from the creatures posted there and their perks (perks.js).

   buildingLevel(k)  the level bought, 1 to its max (0 while the station is still locked by rank)
   stationLevel(k)   the level that counts today: the building's level if anyone works there, else 0.
                     An empty building does nothing, as an unstaffed station always has.
   Numbers live in BUILDINGS in src/data/perks.json. */
import {PERKS_DATA,SECTIONS,SECTION_IDS} from './content.js';
import {S,byId,sectionUnlocked,addLog} from './state.js';
import {canPay,pay,costText} from './jobs.js';

const B=PERKS_DATA.BUILDINGS;
const maxLevel=k=>B.levels[k].length;
const buildingLevel=k=>!S||!sectionUnlocked(k)?0:Math.max(1,Math.min(maxLevel(k),(S.buildings&&S.buildings[k])||1));
const staffed=k=>!!S&&S.sections[k].ids.some(id=>byId(id));
const stationLevel=k=>staffed(k)?buildingLevel(k):0;
// What the next level costs: materials for pay(), and the Keeper rank it needs.
function upgradeCost(k){const c=B.cost[buildingLevel(k)+1];if(!c)return null;const {rank,...mats}=c;return{rank:rank||0,mats}}
function upgradeBlock(k){
  if(!sectionUnlocked(k))return`The ${SECTIONS[k].name} is locked.`;
  const c=upgradeCost(k);if(!c)return'Fully built.';
  if(S.keeper.level<c.rank)return`Needs Keeper rank ${c.rank}.`;
  if(!canPay(c.mats))return`Needs ${costText(c.mats)}.`;
  return'';
}
function upgradeBuilding(k){
  if(upgradeBlock(k))return false;
  const c=upgradeCost(k);pay(c.mats);S.buildings[k]=buildingLevel(k)+1;
  addLog(`The ${SECTIONS[k].name} was built up to level ${S.buildings[k]}: ${B.levels[k][S.buildings[k]-1]}.`);
  return true;
}
// A fresh hideout: every station at level 1.
const newBuildings=()=>Object.fromEntries(SECTION_IDS.map(k=>[k,1]));

export {maxLevel,buildingLevel,staffed,stationLevel,upgradeCost,upgradeBlock,upgradeBuilding,newBuildings};

/* ---------- the v17 save ---------- */
// The tier ladder this replaces: a station's tier was how many of these its workers' summed score passed.
const OLD_TH=[15,45,100,180,300];
function oldTier(d,k){
  const sec=SECTIONS[k],by=Object.fromEntries((d.creatures||[]).map(c=>[c.id,c]));
  if(sec.unlock&&(d.keeper?d.keeper.level:1)<sec.unlock)return 0;
  const score=(((d.sections||{})[k]||{}).ids||[]).map(id=>by[id]).filter(Boolean).reduce((a,c)=>{
    const aff=!sec.type?1:c.type===sec.type?2:c.type2===sec.type?1.6:.6,g=(c.genes&&c.genes[sec.gene])||5;
    return a+(5+c.level*1.6+g*1.5)*aff*((c.traits||[]).includes('worker')?1.5:1)*(1+.1*(c.stage||0))*(1-.4*Math.min(100,c.fat||0)/100)},0);
  return OLD_TH.filter(t=>score>=t).length;
}
// Old tier to new building level, station by station (some stations have fewer levels now).
const FROM_TIER={spring:t=>t>=2?2:1,roost:t=>t>=4?2:1,vault:t=>t>=3?2:1,warroom:t=>t>=5?3:t>=4?2:1,apothecary:t=>t>=4?3:t>=2?2:1};
function perkify(d){
  d.buildings=d.buildings||{};d.sections=d.sections||{};
  for(const k of SECTION_IDS){const t=oldTier(d,k);d.buildings[k]=Math.max(d.buildings[k]||1,Math.min(maxLevel(k),(FROM_TIER[k]||(x=>x))(t)||1))}
  const fix=c=>{c.days=c.days||{};c.nearDeaths=c.nearDeaths??(c.log||[]).filter(e=>e[1]==='neardeath').length;c.lastRaid=c.lastRaid??d.day};
  (d.creatures||[]).forEach(fix);(d.eggs||[]).forEach(e=>fix(e.child));
  return d;
}
export {perkify};
