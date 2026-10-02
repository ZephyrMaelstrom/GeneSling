/* ================= Jobs and production screens =================
   The Workshop (stores, crafting, gear, repairs, market), the production side of each station
   (exact output per creature, foreman, chemistry, fatigue), Roost expeditions, the Memorial
   wall, and the gear part of raid prep. Every number shown comes from jobs.js, so what the
   screen promises is what the day delivers. */
import {esc} from './util.js';
import {JOBS as J,SECTIONS,TYPES,TRAITS,GUNS,GUN_IDS,SCRAP_ORE,DONATE_PTS,ARMORY_TH,ARMORY_TIERS,PERS} from './content.js';
import {S,armoryTier,byId,cageCap,canCraft,formName,secContribution,secTier,sectionUnlockedArmory,whereIs} from './state.js';
import {spr} from './sprites.js';
import {simulateSupply} from './supply.js';
import {decorRecipes} from './prideui.js';
import {amt,matName,costText,canPay,QN,itemByUid,itemName,makerText,usable,repairCost,stationReport,foremanOf,typeMatch,workUnit,qualityOdds,masteryLevel,recipeCost,weaponCost,rosterCap,rosterCount,overCap,penCost,roleInfo,expAway,expeditionBlock,teamScale} from './jobs.js';

const f1=v=>(Math.round(v*10)/10).toString();
const outName=k=>Object.keys(J.STATIONS[k].out).map(m=>matName(m).toLowerCase()).join(', ');
const recipeLine=k=>{const R=J.STATIONS[k];const ins=Object.entries(R.in).map(([m,n])=>`${n} ${matName(m).toLowerCase()}`).join(' + ');
  return`${ins||'Nothing needed'} → ${Object.entries(R.out).map(([m,n])=>`${n} ${matName(m).toLowerCase()}`).join(', ')}`};
const fatBar=c=>`<div class="bar fat" title="Fatigue ${Math.round(c.fat||0)}%"><i style="width:${Math.min(100,c.fat||0)}%"></i></div>`;
const whereText=c=>{const w=whereIs(c);return w.kind==='section'?SECTIONS[w.key].name:w.kind==='loadout'?'raid loadout':w.kind==='expedition'?'away':''};

/* ---------- stations ---------- */
// Per-day output a creature adds to a production station (as if it were posted there).
function addedOutput(c,k){
  const R=J.STATIONS[k];if(!R)return 0;
  const rep=stationReport(k);const mul=rep?rep.mods.mul*rep.tierMul*(R.rate||1):1;
  const main=Object.entries(R.out)[0];return workUnit(c,k)*mul*main[1];
}
function memberRow(c,k){
  const rep=stationReport(k),main=rep?Object.entries(J.STATIONS[k].out)[0]:null,f=foremanOf(k)===c;
  const prod=rep?`+${f1(rep.per(c)*main[1])} ${matName(main[0]).toLowerCase()}/day · `:'';
  const why=SECTIONS[k].type?(typeMatch(c,k)>=1?`${TYPES[SECTIONS[k].type].name} match`:typeMatch(c,k)>.7?'hybrid match':'off type, works at half rate'):'';
  return`<div class="member">${spr(c,40)}<div style="min-width:0;flex:1"><div class="nm">${esc(c.name)}${f?' <span class="chip warn" title="Highest Focus: its work traits apply to the whole station">Foreman</span>':''}</div>
    <small>${prod}+${Math.round(secContribution(c,k))} pts · Yield ${f1(c.genes.yld)}${why?' · '+why:''}</small>${fatBar(c)}</div>
    <button class="btn small" data-act="unassign" data-id="${c.id}" aria-label="Remove ${esc(c.name)}">×</button></div>`;
}
// Candidate list: what each creature would add here, and what it leaves behind.
function candidateOption(c,k){
  const w=whereIs(c),here=J.STATIONS[k]?` · +${f1(addedOutput(c,k))}/day`:'';
  let leaves='';if(w.kind==='section'&&J.STATIONS[w.key])leaves=` · leaves ${SECTIONS[w.key].name} −${f1(stationReport(w.key).per(c)*Object.values(J.STATIONS[w.key].out)[0])} ${outName(w.key).split(',')[0]}`;
  else if(w.kind==='section')leaves=` · leaves ${SECTIONS[w.key].name}`;else if(w.kind==='loadout')leaves=' · leaves the raid loadout';
  return`<option value="${c.id}">${esc(c.name)} · ${esc(formName(c))} Lv ${c.level} · +${Math.round(secContribution(c,k))} pts${here}${leaves}${c.fat>40?` · tired ${Math.round(c.fat)}%`:''}</option>`;
}
function stationPanel(k){
  const rep=stationReport(k);if(!rep)return'';
  const f=rep.foreman,ft=f?f.traits.filter(t=>J.WORK_TRAITS.includes(t)):[];
  const outs=Object.entries(rep.out).map(([m,v])=>`${f1(v)} ${matName(m).toLowerCase()}`).join(', ');
  const ins=Object.entries(rep.in).map(([m,n])=>`${matName(m)} ${amt(m)} (uses ${f1(rep.units*n)}/day at full speed)`).join(' · ');
  return`<div class="slot"><div class="slot-label">Production</div>
    <p><b>${recipeLine(k)}</b></p>
    <p class="status">${rep.rows.length?`Today: about <b>${outs}</b>.`:'Post creatures here to start production.'}${rep.limit?` <span style="color:var(--rose)">Short of ${matName(rep.limit).toLowerCase()}.</span>`:''}</p>
    ${ins?`<p class="status">Stock: ${ins}</p>`:''}
    ${f?`<p class="status"><b class="lbl">Foreman:</b> ${esc(f.name)} (Focus ${f1(f.genes.foc)})${ft.length?`, sharing ${ft.map(t=>TRAITS[t].name).join(', ')} with the crew`:', no work traits to share'}.</p>`:''}
    ${rep.mods.chem.map(x=>`<p class="status" style="color:var(--mint)"><b>${x.name}:</b> ${x.desc}.</p>`).join('')}
    ${rep.mods.clashes.map(([a,b])=>`<p class="status" style="color:var(--rose)"><b>Clash:</b> ${PERS[a].name} and ${PERS[b].name} bicker, −${Math.round(J.CLASH_PENALTY*100)}%.</p>`).join('')}
    <p class="hint">Output grows with Yield, level and evolution; wrong-type workers make half. Working creatures tire (up to −${Math.round(J.FATIGUE.maxPenalty*100)}% output); a day off restores ${J.FATIGUE.rest}%.</p></div>`;
}

/* ---------- expeditions (Roost) ---------- */
function expeditionPanel(ui){
  const t=secTier('roost'),E=ui.exp;
  const pool=S.creatures.filter(c=>!expAway(c)).sort((a,b)=>b.level-a.level);
  const sel=i=>`<select id="exp-${i}" data-act="expsel" data-i="${i}" aria-label="Team member ${i+1}"><option value="">Choose</option>${pool.map(c=>`<option value="${c.id}" ${String(E.team[i])===String(c.id)?'selected':''}>${esc(c.name)} · ${TYPES[c.type].name} Lv ${c.level}${whereText(c)?' ('+whereText(c)+')':''}</option>`).join('')}</select>`;
  const dests=Object.entries(J.EXPEDITIONS).map(([k,D])=>`<label class="toggle"><input type="radio" name="expdest" data-act="expdest" data-k="${k}" ${E.dest===k?'checked':''}> <span><b style="font-family:var(--display)">${D.name}</b> · ${D.days} days<br><small class="status">${D.desc} Brings ${Object.keys(D.loot).map(m=>matName(m).toLowerCase()).join(', ')}${D.egg?`, ${Math.round(D.egg*100)}% egg`:''}. ${Math.round(D.injury*100)}% injury risk each, never deadly.</small></span></label>`).join('');
  const ids=E.team.map(Number).filter(Boolean),block=E.dest?expeditionBlock(E.dest,ids):'Choose a destination.';
  const team=ids.map(byId).filter(Boolean),k=team.length?teamScale(team):1;
  const away=S.expeditions.map(e=>`<li><b>${J.EXPEDITIONS[e.dest].name}</b>: ${e.team.map(byId).filter(Boolean).map(c=>esc(c.name)).join(', ')} · back in ${e.days} day${e.days===1?'':'s'}</li>`).join('');
  return`<h3>Expeditions</h3>
    ${t<1?'<p class="status">The Roost needs tier 1 to send expeditions.</p>':`<p class="hint">Send a team of ${J.EXPEDITION_TEAM} on an offscreen trip. They can’t work, raid or breed until they return. Higher levels and Swift bring more back.</p>
    <div class="choose-list">${dests}</div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,180px),1fr))">${[0,1,2].map(sel).join('')}</div>
    <div class="row"><button class="btn primary" data-act="expgo" ${block?'disabled':''}>Send the team</button><span class="status">${block||`Haul ×${f1(k)} from this team.`}</span></div>`}
    ${away?`<ul class="plain">${away}</ul>`:''}`;
}

/* ---------- Memorial wall ---------- */
function memorialView(){
  const wall=S.memorial.map((m,i)=>`<div class="memorial"><canvas class="spr" width="48" height="48" data-mem="${i}" aria-hidden="true"></canvas><div style="min-width:0">
    <div class="nm">${esc(m.name)}</div><small>${esc(m.form)} · Lv ${m.level}${m.raids?` · ${m.raids} raid${m.raids===1?'':'s'}`:''}</small><br>
    <small>${esc(m.how)}, day ${m.day}</small>${(m.titles||[]).length?`<br><small style="color:var(--gold)">${m.titles.map(esc).join(' · ')}</small>`:''}${m.heir?`<br><small style="color:var(--sky)">Its line goes on in ${esc(m.heir)}</small>`:''}</div></div>`).join('');
  return`<h2>Memorial wall</h2><p class="hint">Every creature the Bloom has kept. When one falls, its closest bred descendant inherits ${Math.round(J.LEGACY_BOND*100)}% of its bond.</p>
    <div class="wall">${wall||'<p class="empty">No one has fallen yet.</p>'}</div>`;
}

/* ---------- Workshop ---------- */
const have=cost=>Object.entries(cost).map(([k,n])=>`<span class="${amt(k)>=n?'':'short'}">${n} ${k==='coin'?'coin':matName(k).toLowerCase()} <small>(${amt(k)})</small></span>`).join(' · ');
const oddsBar=o=>`<div class="qodds" title="Quality odds">${o.map((p,i)=>p?`<i class="q${i}" style="flex:${p}"><span>${Math.round(p*100)>=12?QN[i]+' '+Math.round(p*100)+'%':''}</span></i>`:'').join('')}</div>`;
const qChip=it=>`<span class="chip q q${it.q}">${QN[it.q]}</span>`;
function durBar(it){return`<div class="bar dur" title="Durability ${it.dur}/${it.max}"><i style="width:${it.dur/it.max*100}%"></i></div>`}
function workshopView(ui){
  const ft=secTier('forge'),at=armoryTier(),un=sectionUnlockedArmory(),need=[0,1,2,4,5];
  const mats=Object.keys(J.MATERIALS).map(m=>`<div class="matrow"><span><b>${matName(m)}</b> <small>${esc(J.MATERIALS[m].desc)}</small></span><span class="num">${amt(m)}</span>
    <span class="row" style="gap:4px"><button class="btn small" data-act="mktrade" data-k="${m}">Trade on the Exchange</button></span></div>`).join('');
  const comp=Object.entries(J.RECIPES).filter(([,R])=>R.kind==='component').map(([k,R])=>`<div class="recipe"><div class="row" style="justify-content:space-between"><b>${R.name}</b><small>made ${S.mastery[k]||0}×</small></div>
    <small>${have(recipeCost(k))}</small><button class="btn small" data-act="make" data-k="${k}" ${canPay(recipeCost(k))?'':'disabled'}>Make</button></div>`).join('');
  const fin=Object.entries(J.RECIPES).filter(([,R])=>R.kind==='finished').map(([k,R])=>{const lock=R.needForge&&ft<R.needForge;
    return`<div class="recipe ${lock?'unknown':''}"><div class="row" style="justify-content:space-between"><b>${R.name}</b><small>mastery ${masteryLevel(k)} · ${S.mastery[k]||0}×</small></div>
    <small>${R.desc} Quality from the ${SECTIONS[R.station].name}’s Knack.</small>${oddsBar(qualityOdds(k,R.station))}
    <small>${have(recipeCost(k))}</small><button class="btn small" data-act="make" data-k="${k}" ${!lock&&canPay(recipeCost(k))?'':'disabled'}>${lock?`Needs Forge T${R.needForge}`:'Make'}</button></div>`}).join('');
  const unknown=GUN_IDS.filter(k=>GUNS[k].tier>=1&&!S.blueprints[k]).length;
  const guns=GUN_IDS.filter(k=>GUNS[k].tier>=1&&S.blueprints[k]).map(k=>{
    const g=GUNS[k],known=!!S.blueprints[k],c=weaponCost(k),ok=canCraft(k);
    return`<div class="recipe ${known?'':'unknown'}"><div class="row" style="justify-content:space-between"><b>${known?g.name:'Unknown blueprint'}</b><span class="chip tier t${g.tier}">T${g.tier}</span></div>
      ${known?`<small>${have(c)}</small>${oddsBar(qualityOdds('gun:'+k,'forge'))}<button class="btn small" data-act="forge" data-k="${k}" ${ok&&canPay(c)?'':'disabled'}>${ok?'Forge':`Needs Forge T${need[g.tier]}`}</button>`:'<small>Bring this weapon home from a raid to learn it.</small>'}</div>`}).join('');
  const prints=S.prints.map((id,i)=>`<div class="invrow"><span><b>Print: ${GUNS[id].name}</b> <small>single use · no blueprint or Forge tier needed · +${J.QUALITY.printBonus} quality</small></span>
    <button class="btn small" data-act="forgeprint" data-i="${i}" ${canPay(weaponCost(id))?'':'disabled'}>Forge · ${costText(weaponCost(id))}</button></div>`).join('');
  const gear=S.items.slice().sort((a,b)=>b.q-a.q).map(it=>{const rc=repairCost(it),arm=ui.scrapArm===it.uid,eq=S.loadout.guns.includes(it.uid)||S.loadout.satchel===it.uid;
    const tier=it.kind==='gun'?GUNS[it.id].tier:1;
    return`<div class="invrow gear"><span style="min-width:0;flex:1"><b>${qChip(it)} ${itemName(it).replace(QN[it.q]+' ','')}</b>${eq?' <small style="color:var(--gold)">equipped</small>':''}${it.dur?'':' <small style="color:var(--rose)">broken</small>'}<br>
      <small>${esc(makerText(it))} · ${it.dur}/${it.max} durability${it.kind==='gun'?` · ×${J.QUALITY.dmg[it.q]} damage`:` · +${J.QUALITY.satchelSlots[it.q]} bag slots`}</small>${durBar(it)}</span>
      <span class="row" style="gap:4px">${rc?`<button class="btn small" data-act="repair" data-uid="${it.uid}" ${canPay(rc)?'':'disabled'}>Repair · ${costText(rc)}</button>`:''}
      ${it.kind==='gun'?`<button class="btn small ${arm?'danger':''}" data-act="scrapitem" data-uid="${it.uid}">${arm?'Confirm scrap':'Scrap · +'+Math.round(SCRAP_ORE[tier]*(ft>=3?1.5:1))+' ore'}</button>
      <button class="btn small" data-act="donateitem" data-uid="${it.uid}" ${un?'':'disabled'}>Donate · +${DONATE_PTS[tier]}</button>`:''}
      ${it.kind==='gun'&&it.q>=4?`<button class="btn small" data-act="displayweapon" data-uid="${it.uid}">Put on display</button>`:''}</span></div>`}).join('');
  return`<div class="cols"><section class="card"><h2>Workshop</h2>
    <p class="hint">Stations turn raw finds into refined goods each day. Here you turn those into parts, then into gear that carries your maker’s mark. Quality comes from the station’s Knack, its foreman and how often you’ve made the recipe.</p>
    <h3>Components</h3><div class="recipes">${comp}</div>
    <h3>Cages and satchels</h3><div class="recipes">${fin}</div>
    <h3>Weapons · Forge T${ft}</h3><div class="recipes">${guns}</div>${unknown?`<p class="status">${unknown} more blueprint${unknown>1?'s':''} to find. Bring a weapon home from a raid to learn it.</p>`:''}
    ${prints?`<h3>Prints</h3>${prints}`:''}
    <h3>Decor</h3><p class="hint">Place decor in the Hideout’s build mode. It raises Comfort, which cuts fatigue and speeds bond, up to +20%.</p><div class="recipes">${decorRecipes()}</div>
    <h3>Your gear</h3>${gear||'<p class="empty">Only the Scav Pistol. Find more in raids or forge some.</p>'}
  </section>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
  <section class="card"><h2>Stores</h2><div class="mats">${mats}</div>
    <p class="status">Cages: ${S.cages.basic} basic, ${S.cages.gilded} gilded · you carry up to ${cageCap()} into a raid.</p></section>
  <section class="card"><h2>Buying and selling</h2>
    <p class="hint">Food, cages, materials and gear trade on the Exchange, where prices move with supply and demand.</p>
    <div class="row"><button class="btn small primary" data-act="mktrade" data-k="food">Buy food</button><button class="btn small" data-act="mktrade" data-k="cage">Buy cages</button><button class="btn small" data-act="mktrade" data-k="ore">Ore</button></div></section>
  <section class="card"><h2>Armory ${un?`<span class="chip tier t${at}">T${at}</span>`:''}</h2>
    ${un?`<p class="hint">Donate weapons to fill the Armory. Each tier is a permanent bonus.</p>
    <div class="meter"><i style="width:${Math.min(100,S.armory/ARMORY_TH[ARMORY_TH.length-1]*100)}%"></i></div>
    <p class="status">${S.armory} points${ARMORY_TH[at]?` · ${ARMORY_TH[at]-S.armory} more for tier ${at+1}`:' · maxed'}</p>
    <ul class="tierlist">${ARMORY_TIERS.map((d,i)=>`<li class="${at>i?'on':''}"><b>T${i+1}</b> <span>${d}</span> <small>${ARMORY_TH[i]} pts</small></li>`).join('')}</ul>`:'<div class="risk"><b>Locked.</b> Reach Keeper rank 3 to open the Armory.</div>'}
  </section></div></div>`;
}

/* ---------- raid prep: gear and roles ---------- */
function gearPanel(){
  const L=S.loadout,guns=S.items.filter(i=>i.kind==='gun'&&usable(i)),sats=S.items.filter(i=>i.kind==='satchel'&&usable(i));
  const label=it=>`${itemName(it)} (${it.dur}/${it.max})`;
  const gsel=slot=>{const cur=L.guns[slot],other=L.guns[1-slot];
    return`<select id="gun-${slot}" data-act="gunsel" data-slot="${slot}" aria-label="${slot?'Second':'First'} weapon"><option value="">${slot?'None':'Scav Pistol (never lost)'}</option>
      ${guns.filter(i=>i.uid!==other).map(i=>`<option value="${i.uid}" ${cur===i.uid?'selected':''}>${esc(label(i))}${GUNS[i.id].melee?' · melee':''}</option>`).join('')}</select>`};
  const wline=slot=>{const it=itemByUid(L.guns[slot]),g=it?GUNS[it.id]:slot?null:GUNS.pistol;return g?`<small>${g.desc}${it?` ${esc(makerText(it))}.`:''}</small>`:'<small>Room for a weapon you find.</small>'};
  const ssel=`<select id="satchel" data-act="satchelsel" aria-label="Satchel"><option value="">No satchel</option>${sats.map(i=>`<option value="${i.uid}" ${L.satchel===i.uid?'selected':''}>${esc(label(i))} · +${J.QUALITY.satchelSlots[i.q]} slots</option>`).join('')}</select>`;
  const tsel=`<select id="tonics" data-act="tonicsel" aria-label="Tonics to carry">${Array.from({length:Math.min(J.TONIC.carry,amt('tonic'))+1},(_,n)=>`<option value="${n}" ${(L.tonics||0)===n?'selected':''}>${n} tonic${n===1?'':'s'}</option>`).join('')}</select>`;
  const b=bagSize();
  return`<div class="gearrow"><div class="gunslot"><span class="slot-label">First weapon</span>${gsel(0)}${wline(0)}</div>
    <div class="gunslot"><span class="slot-label">Second weapon · R swaps</span>${gsel(1)}${wline(1)}</div>
    <div class="gunslot"><span class="slot-label">Satchel</span>${ssel}<small>Lost if you fall.</small></div>
    <div class="gunslot"><span class="slot-label">Tonics · ${amt('tonic')} in stores</span>${tsel}<small>Drunk automatically at ${Math.round(J.TONIC.at*100)}% HP; heals ${Math.round(J.TONIC.heal*100)}%.</small></div></div>
    <p class="status"><b class="lbl">Bag:</b> ${b.total} slots (${b.parts.join(' + ')}). Each slot holds ${J.BAG.stack} of one material, or one print. Coin and the weapons in your hands need no room.</p>`;
}
// Bag size for the current loadout: base, Haulers in any slot, and the satchel.
function bagSize(){
  const parts=[`${J.BAG.slots} base`];let total=J.BAG.slots;
  S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{const r=roleInfo(c);if(r&&r.bag){total+=r.bag;parts.push(`${r.bag} ${esc(c.name)}`)}});
  const sat=itemByUid(S.loadout.satchel);if(sat&&usable(sat)){const n=J.QUALITY.satchelSlots[sat.q];total+=n;parts.push(`${n} satchel`)}
  return{total,parts};
}
const roleChip=c=>{const r=roleInfo(c);return r?`<span class="chip role" title="${esc(r.desc)}">${r.name}</span>`:''};
function rosterBar(){
  const n=rosterCount(),cap=rosterCap(),pc=penCost(),maxed=(S.pens||0)>=J.ROSTER.maxPens;
  return`<div class="row" style="justify-content:space-between;gap:8px"><span class="status ${overCap()?'over':''}"><b class="lbl">Pens:</b> ${n}/${cap} creatures${overCap()?' · over capacity: sell some or build a pen before the next raid or egg':''}</span>
    ${maxed?'':`<button class="btn small" data-act="buildpen" ${canPay(pc)?'':'disabled'}>Build a pen (+${J.ROSTER.perPen}) · ${costText(pc)}</button>`}</div>`;
}

/* ---------- Test Lab: supply sandbox ---------- */
let supplyOut=null;
function runSupply(seed){supplyOut=['raid','craft'].map(p=>simulateSupply(p,seed||1));return supplyOut}
function supplyPanel(){
  const res=supplyOut?supplyOut.map(l=>`<div class="slot"><div class="slot-label">${l.policy==='raid'?'Raid-only':'Craft-heavy'} · ${l.supplied?'<span style="color:var(--mint)">stayed supplied</span>':'<span style="color:var(--rose)">ran short</span>'}</div>
    <p class="status">Hungry days ${l.hungry} · raids short of cages ${l.cageShort} · raids with a broken weapon ${l.broken} · deaths ${l.deaths}</p>
    <p class="status">Bought ${l.bought.food} food and ${l.bought.cages} cages · crafted ${l.crafted.cages} batches of cages and ${l.crafted.repairs} repairs</p>
    <p class="status">End of week: ${Object.entries(l.end).map(([k,v])=>`${v} ${k}`).join(' · ')}</p>
    <div class="hist">${l.days.map(d=>`<div class="hrow"><span>Day ${d.day}</span><div class="g"><i style="width:${Math.min(100,d.food)}%"></i></div><span>${d.food} food</span></div>`).join('')}</div></div>`).join(''):'';
  return`<h3>Supply sandbox</h3>
    <p class="hint">Plays a week of hideout days for a ${J.SUPPLY_SIM.roster}-creature hideout two ways, with the game’s own daily upkeep and stations: raiding only and buying supplies, or staffing the stations and crafting. Raids draw average loot and can end in death. Your save is not touched.</p>
    <div class="row"><button class="btn primary" data-act="lab-supply">Run a week</button></div>${res}`;
}

export {runSupply,supplyPanel,memberRow,candidateOption,stationPanel,expeditionPanel,memorialView,workshopView,gearPanel,bagSize,roleChip,rosterBar,fatBar};
