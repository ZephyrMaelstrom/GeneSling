/* ================= Hideout UI ================= */
import {$,clamp,esc,fxPick,pick} from './util.js';
import {BALANCE,LORE,BLOOM,ABILITIES,ATTACKS,BASE_SPECIES,BOND_TH,BOSSES,BOSS_IDS,COMBOS,ELEM,FOES,FOE_IDS,GENES,GUNS,GUN_IDS,HYBRIDS,JOBS,LINES,LORE_INTRO,MODES,NPCS,NPC_IDS,PERS,REACTIONS,RESEARCH,RES_IDS,SECTIONS,SECTION_IDS,SPECIES,TRAITS,TRAIT_IDS,TYPES,TYPE_IDS,comboFor,comboKey,speciesOf,PERKS_DATA} from './content.js';
import {save} from './save.js';
import {DEX_MILES,DEX_TOTAL,S,addBond,addKeeperXp,addLog,armoryTier,breed,breedBlock,buyResearch,byId,cageCap,canEvolve,dexFoe,dexForm,dexScore,eggCap,evolve,expandCost,formName,formOf,giveReward,hatchEgg,keeperNeed,lineOf,makeCreature,modeUnlocked,newGame,nextForm,npcAttention,npcQuest,npcTurnIn,passDay,researchCost,secCap,sectionUnlocked,sellValue,sexSym,slotBonus,stats,supportText,ui,unplace,whereIs} from './state.js';
import {paintSprites,spr,sprSp,stars,typeChips} from './sprites.js';
import {auVol,sfx} from './audio.js';
import {HMAP,startHideoutMap} from './map.js';
import {R,startRaid} from './raid.js';
import {DEMO} from './flags.js';
import {calendarDay,catchupMul,expectedRank,gateNeeds,nextGate} from './balance.js';
import {formLore,pagesFound,secretHybridKnown} from './lore.js';
import {journeyPanel} from './journeyui.js';
import {applyPalette,resetScale} from './access.js';
import {journalView,labLorePanel,muralView,storyView} from './loreui.js';
import {buildPanel,hallPanel,mapTools,sigilPanel} from './prideui.js';
import {demoGoalsHtml,statsPanel} from './demo.js';
import {mapH} from './map.js';
import {contractBoard,labBloom,mapPicker,veinCodex} from './bloomui.js';
import {archivePanel,bloomBelow,breedingTools,labEndgamePanel} from './endgameui.js';


import {GRADE_LOCI,TRAIT_LOCI,expressTrait} from './genetics.js';
import {geneSight,previewHtml,simPanel,traitName} from './geneui.js';
import {amt,expAway,give,itemByUid,itemName,mouths,newItem,overCap,rosterCap,rosterCount,usable,costText,workUnit} from './jobs.js';
import {candidateOption,expeditionPanel,gearPanel,memberRow,memorialView,roleChip,rosterBar,stationPanel,supplyPanel,workshopView} from './workui.js';
import {startMarket} from './exchange/market.js';
import {viewExchange,economyPanel} from './exchangeui.js';
import {bindCharts} from './chart.js';
import {onMarket} from './exchange/market.js';
import {onAct,onChange,onInput,act,changed,inputted} from './actions.js';
import {OPTS,saveOpts} from './device.js';
import {creatureCard,creaturePage,pageCreature,rosterList} from './creatureui.js';
import {hideoutFx} from './perks.js';
import {stationLevel,buildingLevel,maxLevel,upgradeBlock,upgradeBuilding,upgradeCost} from './buildings.js';
// The demo has no Test Lab.
const TABS=[['raid','Raid'],['hideout','Hideout'],['roster','Roster'],['breeding','Breeding'],['research','Research'],['armory','Workshop'],['exchange','Exchange'],['codex','Codex'],['lab','Test Lab'],['settings','Settings']].filter(([k])=>!(DEMO&&k==='lab'));
function renderAll(){renderHeader();renderTabs();renderMain()}
function renderHeader(){
  const n=mouths();
  $('#res').innerHTML=`<span class="pill">Keeper <b>${S.keeper.level}</b> <small>${S.keeper.xp}/${keeperNeed()}</small></span><span class="pill">Day <b>${S.day}</b></span><span class="pill">Coin <b>${S.coin}</b></span><span class="pill">Food <b>${S.food}</b> <small>−${n}/day</small></span><span class="pill">Ore <b>${S.ore}</b></span><span class="pill">Shards <b>${S.shards}</b></span><span class="pill">Cages <b>${S.cages.basic}</b>${S.cages.gilded?` <small>+${S.cages.gilded} gilded</small>`:''}</span>`;
}
function renderTabs(){
  const dot=k=>(k==='hideout'&&NPC_IDS.some(id=>npcAttention(id)))||(k==='codex'&&(milestoneReady()||journalNew()))||(k==='roster'&&S.creatures.some(canEvolve));
  $('#tabs').innerHTML=TABS.map(([k,l])=>`<button class="tab" role="tab" id="tab-${k}" aria-selected="${ui.tab===k}" data-act="tab" data-k="${k}">${l}${dot(k)?'<i class="dot" aria-label="new"></i>':''}</button>`).join('');
}
function renderMain(){
  const m=$('#main'),c=pageCreature();
  // A creature's page, opened from any list, takes the main view until Back.
  if(c){m.innerHTML=creaturePage(c);paintSprites(m);return}
  m.innerHTML=({raid:viewRaid,hideout:viewHideout,roster:viewRoster,breeding:viewBreeding,research:viewResearch,armory:viewArmory,exchange:viewExchange,codex:viewCodex,lab:viewLab,settings:viewSettings}[ui.tab])();
  paintSprites(m);
  if(ui.tab==='hideout')startHideoutMap();
}
function hpBar(c){const m=stats(c).hp,p=clamp(c.hp/m,0,1);return`<div class="bar hp ${p<.35?'low':''}" title="${c.hp}/${m} HP"><i style="width:${p*100}%"></i></div>`}
function statusText(c){
  const w=whereIs(c);
  if(w.kind==='section')return`In the ${SECTIONS[w.key].name}`;
  if(w.kind==='loadout')return w.slot<2?`In loadout, combat slot ${w.slot+1}`:'In loadout, slot 3';
  if(w.kind==='expedition')return`Away on the ${JOBS.EXPEDITIONS[w.dest].name.toLowerCase()}`;
  return'Idle in the pens';
}
// Drops gear the loadout can no longer use (lost, scrapped or broken). An empty first slot means the pistol.
function validGuns(){
  const L=S.loadout,ok=(uid,kind)=>{const it=itemByUid(uid);return it&&it.kind===kind&&usable(it)};
  L.guns=[0,1].map(i=>L.guns[i]&&ok(L.guns[i],'gun')?L.guns[i]:null);
  if(L.guns[0]&&L.guns[0]===L.guns[1])L.guns[1]=null;
  if(L.satchel&&!ok(L.satchel,'satchel'))L.satchel=null;
  L.tonics=Math.max(0,Math.min(L.tonics||0,JOBS.TONIC.carry,amt('tonic')));
}
function weaponLine(g){
  const el=g.elem?` · ${ELEM[g.elem].name.toLowerCase()}`:'';
  if(g.melee){const b=[`${g.dmg}${g.hits?'×'+g.hits:''} dmg`,`${g.rate}/s`,`reach ${g.range}`];b.push(g.reflect?'reflects bullets':'cuts bullets');if(g.lunge)b.push('lunges');if(g.shock)b.push('shockwave');if(g.wave)b.push('crescent wave');if(g.leech)b.push('lifesteal');return b.join(' · ')+el}
  const bits=[`${g.dmg}${g.pellets?'×'+g.pellets:''}${g.burst?'×'+g.burst:''}${g.ring?'×'+g.ring:''} dmg`,`${g.rate}/s`];
  if(g.pierce)bits.push(`pierce ${g.pierce}`);if(g.explode)bits.push('explodes');if(g.bounce)bits.push('bounces');if(g.homing)bits.push('homing');if(g.split)bits.push('splits');if(g.spin)bits.push('spins up');
  return bits.join(' · ')+el;
}
const persChip=c=>`<span class="chip pers" title="${esc(PERS[c.pers].desc)}">${PERS[c.pers].name}</span>`;

// The next act gate: what it needs, ticked off as it's met, and catch-up when it's on.
function gatePanel(){
  const k=nextGate(),cu=catchupMul()>1;
  const catchup=cu?`<p class="status" style="color:var(--mint)">Catch-up: double Keeper XP from raids until you're within ${BALANCE.CATCHUP.within} ranks of rank ${expectedRank(calendarDay())}, where most Keepers are on day ${calendarDay()}.</p>`:'';
  if(!k)return catchup;
  const G=BALANCE.GATES[k],needs=gateNeeds(k);
  return`<h3>Next gate: ${G.name}</h3><ul class="tierlist">${[{text:G.floor===3?'Beat a Rootworks boss on Floor 3':G.floor===6?'Beat a vein boss on Floor 6':'Free Ilsa on Floor 9',ok:(S.progress.deepest||0)>G.floor||(G.floor===9&&!!(S.story&&S.story.ilsa))},...needs].map(n=>`<li class="${n.ok?'on':''}"><b>${n.ok?'✓':'·'}</b> <span>${esc(n.text)}</span></li>`).join('')}</ul>${catchup}`;
}
function viewRaid(){
  validGuns();
  const L=S.loadout,slots=L.slots.map(byId);
  const labels=['Combat · Q','Combat · E','Slot 3 · support or free'];
  const slotHtml=slots.map((c,i)=>{
    const sup=i===2;
    if(!c)return`<div class="slot ${sup?'support':''}"><div class="slot-label">${labels[i]}</div>
      <p class="empty">${sup?'Free. Keep it empty to cage a wild creature mid-raid, then swap it with slot 1 or 2 to test it.':'Empty'}</p>
      <button class="btn small" data-act="choose" data-slot="${i}">Choose</button></div>`;
    const st=stats(c),A=ABILITIES[st.abilId];
    return`<div class="slot ${sup?'support':''}"><div class="slot-label">${labels[i]}</div>
      <div class="slot-body"><button class="sprlink" data-act="creature" data-id="${c.id}" data-list="party" aria-label="Open ${esc(c.name)}’s page">${spr(c,56)}</button><div style="min-width:0;flex:1"><div class="nm">${esc(c.name)} <small style="color:var(--gold)">Lv ${c.level}</small></div>
      <div class="status">${sexSym(c.sex)} ${esc(formName(c))} · ${ATTACKS[st.atkId].name}</div>
      <div class="row" style="gap:4px">${typeChips(c)}${roleChip(c)}${stars(st.star)}${c.origin==='wild'&&!c.proven?'<span class="chip warn">Unproven</span>':''}</div></div></div>
      ${hpBar(c)}
      <p class="status">${sup?'Passive: '+supportText(c):(i===0?'Q':'E')+': '+A.name+'. '+A.desc+'.'}</p>
      <div class="row"><button class="btn small" data-act="choose" data-slot="${i}">Change</button><button class="btn small" data-act="clearslot" data-slot="${i}">${sup?'Leave free':'Remove'}</button></div></div>`;
  }).join('');
  let combo='';
  if(slots[0]&&slots[1]){const cb=comboFor(slots[0].type,slots[1].type),special=!!COMBOS[comboKey(slots[0].type,slots[1].type)];combo=`<div class="combo ${special?'special':''}"><b>Combo · ${cb.name}</b><span>${cb.desc} Press C, or the Combo button, when it charges.</span></div>`}
  const risk=slots.filter(Boolean).map(c=>esc(c.name));[...L.guns,L.satchel].forEach(uid=>{const it=itemByUid(uid);if(it)risk.push(esc(itemName(it)))});if(L.tonics)risk.push(`${L.tonics} tonic${L.tonics>1?'s':''}`);
  const vl=stationLevel('vault'),hf=hideoutFx(),coinPct=Math.round(Math.min(PERKS_DATA.SCALE.keepCoinCap,(PERKS_DATA.BUILDINGS.vaultCoin[vl]||0)+hf.keepCoin)*100);
  const keeps=[vl>=1&&'slot 3 creature',hf.keep.weapons&&'held weapons',hf.keep.companion&&'slot 1 companion',coinPct&&`${coinPct}% of coin`,hf.keepOre&&'all ore',armoryTier()>=4&&!hf.keep.weapons&&'primary weapon'].filter(Boolean);
  const modes=Object.entries(MODES).map(([k,m])=>{const un=modeUnlocked(k);return`<label class="toggle ${un?'':'locked'}"><input type="checkbox" id="mode-${k}" data-act="mode" data-k="${k}" ${S.modes[k]&&un?'checked':''} ${un?'':'disabled'}> <span><b style="font-family:var(--display)">${m.name}</b>${un?'':' · locked'}<br><small class="status">${un?m.desc:`Build the War Room to level ${m.need[1]} and post someone there.`}</small></span></label>`}).join('');
  const bossRow=BOSS_IDS.map(b=>{const n=S.progress.bosses[b]||0,B=BOSSES[b];return`<div class="trophy ${n?'won':''}" title="${esc(B.blurb)}"><canvas class="spr" width="48" height="48" data-boss="${b}" ${n?'':'data-sil="1"'}></canvas><span>${n?esc(B.name):'???'}</span><small>${B.vein==='bloomlord'?'Bloomlord':B.vein&&B.vein!=='rootworks'&&BLOOM.VEINS[B.vein]?BLOOM.VEINS[B.vein].short:'Floor 3'}${n?' · ×'+n:''}</small></div>`}).join('');
  const kn=keeperNeed();
  return`<div class="cols">
  <section class="card"><h2>Loadout</h2>
    ${S.tutorialDone?'':`<div class="combo special"><b>New here?</b><span>A short guided raid teaches moving, fighting, catching and extracting. Nothing is at risk.</span><div class="row"><button class="btn small primary" data-act="tutorial">Play the tutorial</button></div></div>`}
    <p class="hint">Two companions fight beside you. Slot 3 holds a support creature for its passive, or stays free so a caged catch has somewhere to go.</p>
    <div class="slots">${slotHtml}</div>${combo}
    <h3>Gear</h3>${gearPanel()}
    ${mapPicker()}${contractBoard()}
    <p class="hint">You'll carry ${Math.min(cageCap(),S.cages.basic+S.cages.gilded)} of up to ${cageCap()} cages. Unused cages come home if you extract.</p>
    <div class="risk"><b>Lost if you die:</b> ${risk.length?risk.join(', '):'nothing of yours'}, plus cages, buffs and loot.${keeps.length?' Your hideout keeps: '+keeps.join(', ')+'.':''}</div>
    ${modes?`<h3>Raid modes</h3><div class="modes">${modes}</div>`:''}
    ${overCap()?`<div class="risk"><b>Pens over capacity.</b> ${rosterCount()}/${rosterCap()} creatures. Sell some or build a pen in the Roster tab before raiding.</div>`:''}
    <div class="row"><button class="btn primary" data-act="deploy" ${overCap()?'disabled':''}>Deploy raid</button><button class="btn" data-act="scav">Scav run (no risk)</button></div>
  </section>
  <section class="card"><h2>Keeper rank ${S.keeper.level}</h2>
    <div class="bar"><i style="width:${S.keeper.xp/kn*100}%;background:var(--gold)"></i></div>
    <p class="status">${S.keeper.xp}/${kn} XP. Every raid earns Keeper XP, even ones you lose. Each rank pays coin and a cage, unlocks a page of Ilsa's journal, and some open new sections.</p>
    ${gatePanel()}
    <h3>Bosses</h3><div class="trophies">${bossRow}</div>
    ${bloomBelow()}
    <p class="status">One of four bosses waits at the end of Floor 3 (best faced with companions around Lv 10). Beating it opens the five veins below: the Ember Abyss, the Drowned Galleries, the Hollow Choir, the Glasswind Spires and the Sump, each with its own twist and three bosses (around Lv 25). First victories give memory shards.</p>
    <h3>How raids work</h3>
    <ul class="plain">
      <li>Rooms seal until every enemy is beaten or caught. Enemies glow before they fire.</li>
      <li>Weaken a wild creature below half health, get close and use a cage. Catches return to full health.</li>
      <li>Elements combine: burning + soaked makes steam, soaked + static electrocutes, brittle + buffeted shatters. Check the Codex for all seven.</li>
      <li>Melee weapons cut enemy bullets inside their swing.</li>
      <li>Cracked walls hide secret rooms. Echo and Curious creatures can hear them.</li>
      <li>Shrines offer blessings, or cursed pacts with a strong upside and a drawback.</li>
    </ul>
    <dl class="kv"><dt>Raids</dt><dd>${S.stats.raids}</dd><dt>Extractions</dt><dd>${S.stats.extracts}</dd><dt>Deepest floor</dt><dd>${S.progress.deepest||0}</dd><dt>Bosses beaten</dt><dd>${S.stats.bossKills}</dd><dt>Reactions</dt><dd>${S.stats.reactions}</dd><dt>Creatures lost</dt><dd>${S.stats.lost}</dd></dl>
  </section></div>`;
}

function viewHideout(){
  const chips=SECTION_IDS.map(k=>`<button class="tab ${sectionUnlocked(k)?'':'lockedtab'}" aria-selected="${ui.section===k}" data-act="section" data-k="${k}">${SECTIONS[k].name} ${sectionUnlocked(k)?'L'+buildingLevel(k):'· locked'}</button>`).join('')+`<button class="tab" aria-selected="${ui.section==='legends'}" data-act="section" data-k="legends">Legends</button><button class="tab" aria-selected="${ui.section==='log'}" data-act="section" data-k="log">Log</button><button class="tab" aria-selected="${ui.section==='memorial'}" data-act="section" data-k="memorial">Memorial</button>`;
  const npcs=NPC_IDS.filter(id=>S.npc[id]).map(id=>`<button class="tab" data-act="npc" data-k="${id}">${NPCS[id].name}${npcAttention(id)?' <i class="dot"></i>':''}</button>`).join('');
  return`<section class="card mapcard"><div class="mapwrap" style="aspect-ratio:1000/${mapH()}"><canvas id="hmap" aria-label="Hideout map. Select a building to manage it."></canvas></div>
    ${mapTools()}
    <p class="status">${HMAP.build?'Building: tap something to pick it up, then tap where it should go.':'Tap a building to manage it, a person to talk, the cave mouth to raid, or the board to open the Codex. Off duty, creatures sleep in dens, play and follow their friends.'}</p>${DEMO?`<details class="demogoals"><summary>Demo: Act I goals</summary>${demoGoalsHtml()}</details>`:''}
    <div class="filters">${chips}</div>${npcs?`<div class="filters" style="margin-top:6px"><span class="status" style="align-self:center">Talk to:</span>${npcs}</div>`:''}</section>
    <section class="card secdetail" id="secPanel">${secBody()}</section>`;
}
const secBody=()=>HMAP.build?buildPanel():ui.section==='log'?logView():ui.section==='memorial'?memorialView():ui.section==='legends'?hallPanel():sectionDetail(ui.section);
function renderSecPanel(){const p=$('#secPanel');if(!p)return;p.innerHTML=secBody();paintSprites(p);
  document.querySelectorAll('.mapcard .filters [data-act="section"]').forEach(b=>b.setAttribute('aria-selected',b.dataset.k===ui.section))}
function logView(){
  return`<h2>Hideout log</h2><p class="hint">Each raid moves time forward one day. Every creature eats 1 food a day, trainees eat 2.</p>
    <div class="row"><button class="btn" data-act="wait">Wait one day</button></div><ul class="log">${S.log.map(l=>`<li><span>Day ${l.day}</span>${esc(l.msg)}</li>`).join('')}</ul>`;
}
function sectionDetail(k){
  const sec=SECTIONS[k];
  if(!sectionUnlocked(k))return`<h2>${sec.name}</h2><p class="hint">${sec.blurb}</p><div class="risk"><b>Locked.</b> Reach Keeper rank ${sec.unlock} to build the ${sec.name}. Keeper XP comes from every raid, won or lost.</div>`;
  const ids=S.sections[k].ids,cap=secCap(k),t=stationLevel(k),lvl=buildingLevel(k),cost=upgradeCost(k),why=upgradeBlock(k);
  // The building: what each level does, and what the next one costs.
  const tiers=PERKS_DATA.BUILDINGS.levels[k].map((d,i)=>`<li class="${lvl>i?'on':''}"><b>L${i+1}</b> <span>${d}</span>${i===lvl&&cost?` <small>${costText(cost.mats)}${cost.rank?` · rank ${cost.rank}`:''}</small>`:''}</li>`).join('');
  const members=ids.map(byId).filter(Boolean).map(c=>memberRow(c,k)).join('');
  const cand=S.creatures.filter(c=>!ids.includes(c.id)&&!expAway(c)).sort((a,b)=>{const crew=ids.map(byId).filter(Boolean);return workUnit(b,k,[...crew,b])-workUnit(a,k,[...crew,a])});
  const add=ids.length<cap&&cand.length?`<div class="row"><select id="addsel" aria-label="Add a creature">${cand.map(c=>candidateOption(c,k)).join('')}</select><button class="btn small primary" data-act="assign" data-k="${k}">Add</button></div>`:'';
  const ec=expandCost(k),canExp=S.sections[k].cap<10;
  let extra='';
  if(k==='training'){
    const pool=S.creatures;
    const sel=(id,val)=>`<select id="${id}" data-act="${id}">${pool.map(c=>`<option value="${c.id}" ${String(c.id)===String(val)?'selected':''}>${esc(c.name)} · ${esc(formName(c))} Lv ${c.level}</option>`).join('')}</select>`;
    if(!ui.gl.id&&pool[0])ui.gl.id=String(pool[0].id);if(!ui.tt.id&&pool[0])ui.tt.id=String(pool[0].id);
    if(!GRADE_LOCI.includes(ui.gl.gene))ui.gl.gene='pow';if(!TRAIT_LOCI.includes(ui.tt.slot))ui.tt.slot='t1';
    const gc=byId(+ui.gl.id),gv=gc?Math.min(...gc.genome[ui.gl.gene]):0,gcost={coin:20*(gv+1),ore:2*(gv+1)},sight=geneSight();
    const tc=byId(+ui.tt.id);
    extra=`<h3>Gene Lab ${t>=2?'':'· opens at level 2'}</h3>
      ${t>=2?`<p class="hint">Raise the weaker copy of one gene by 1, up to 10. Some evolutions need a gene at 7 or higher.</p>
      <div class="row">${sel('glc',ui.gl.id)}<select id="glg" data-act="glg">${GRADE_LOCI.map(g=>`<option value="${g}" ${ui.gl.gene===g?'selected':''}>${GENES[g]}${gc&&sight!=='stars'?' ('+gc.genes[g]+')':''}</option>`).join('')}</select>
      <button class="btn small" data-act="genelab" ${gc&&gv<10&&S.coin>=gcost.coin&&S.ore>=gcost.ore?'':'disabled'}>${gv>=10?'Maxed':`Train · ${gcost.coin}c ${gcost.ore} ore`}</button></div>`:'<p class="status">Build the Training Grounds to level 2 (with a trainee posted) to raise genes with coin and ore.</p>'}
      <h3>Trait Tutor ${t>=4?'':'· opens at level 4'}</h3>
      ${t>=4?`<p class="hint">Rewrite one trait slot, both copies, with a random positive trait. 60 coin and 8 ore.</p>
      <div class="row">${sel('ttc',ui.tt.id)}<select id="tts" data-act="tts">${tc?TRAIT_LOCI.map((k,i)=>`<option value="${k}" ${ui.tt.slot===k?'selected':''}>Slot ${i+1}: ${traitName(expressTrait(tc.genome[k]))}</option>`).join(''):''}</select>
      <button class="btn small" data-act="tutor" ${tc&&S.coin>=60&&S.ore>=8?'':'disabled'}>Retrain trait</button></div>`:'<p class="status">Build the Training Grounds to level 4 to swap out unwanted traits.</p>'}`;
  }
  return`<div class="row" style="justify-content:space-between"><h2>${sec.name}</h2><span class="tier">Level ${lvl}/${maxLevel(k)}</span></div>
    <p class="hint">${sec.blurb} ${sec.type?`${TYPES[sec.type].name} creatures work at full rate here, ${TYPES[sec.type].name} hybrids at 80%, others at half.`:'Every creature works at the same rate here.'} The building sets what the ${sec.name} can do; the creatures posted here, and their perks and flaws, set how well.</p>
    <p class="status">${t?`Working at level ${t}.`:`Level ${lvl} built, but nobody is posted, so it does nothing.`}</p>
    <ul class="tierlist">${tiers}</ul>
    ${cost?`<div class="row"><button class="btn small ${why?'':'primary'}" data-act="upgrade" data-k="${k}" ${why?'disabled':''}>Build level ${lvl+1} · ${costText(cost.mats)}</button>${why?`<span class="status">${esc(why)}</span>`:''}</div>`:'<p class="status">Fully built.</p>'}
    <h3>Creatures · ${ids.length}/${cap}</h3>
    <div class="members">${members||'<p class="empty">Nobody is assigned yet.</p>'}</div>
    ${add}
    ${canExp?`<div class="row"><button class="btn small" data-act="expand" data-k="${k}" ${S.coin>=ec.coin&&S.ore>=ec.ore?'':'disabled'}>Build a slot · ${ec.coin}c ${ec.ore} ore</button><span class="status">Up to 10 slots${slotBonus()?` (+${slotBonus()} from Keeper rank)`:''}</span></div>`:''}
    ${stationPanel(k)}${k==='roost'?expeditionPanel(ui):''}
    ${extra}`;
}

function viewRoster(){
  const F=[['all','All'],['evolve','Can evolve'],['wild','Wild'],['bred','Bred'],['unproven','Unproven'],['f','Female'],['m','Male'],['hybrid','Hybrids'],['idle','Idle']];
  const list=rosterList();
  return`<section class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><h2>Roster · ${S.creatures.length} creatures</h2>
    <div class="filters">${F.map(([k,l])=>`<button class="tab" aria-selected="${ui.filter===k}" data-act="filter" data-k="${k}">${l}</button>`).join('')}</div></div>
    ${rosterBar()}
    <p class="hint">Tap a creature to open its page: stats and what makes them, genes, work, its story, and everything you can do with it.</p></section>
    <div class="cgrid">${list.map(c=>creatureCard(c,{list:'roster'})).join('')||'<p class="empty">No creatures match this filter.</p>'}</div>`;
}

function viewBreeding(){
  const t=stationLevel('nursery');
  const moms=S.creatures.filter(c=>c.proven&&c.sex==='F'),dads=S.creatures.filter(c=>c.proven&&c.sex==='M');
  const opt=(list,sel)=>`<option value="">Choose</option>`+list.map(c=>`<option value="${c.id}" ${String(c.id)===String(sel)?'selected':''}>${esc(c.name)} · ${esc(formName(c))}${c.type2?' (hybrid)':''} Lv ${c.level}</option>`).join('');
  const a=byId(+ui.mom),b=byId(+ui.dad);
  const why=a||b?breedBlock(a,b):'';
  const pred=a&&b&&!why?previewHtml(a,b):why&&a&&b?`<div class="risk">${esc(why)}</div>`:'';
  const eggs=S.eggs.map(e=>`<div class="slot"><div class="slot-body"><canvas class="spr" width="56" height="56" data-egg="${e.cols.join(',')}" data-shiny="${e.hybrid?1:0}" aria-label="Egg"></canvas><div><div class="nm">${e.hybrid?'Shimmering egg':'Egg'} of ${esc(e.parents)}</div><p class="status">Hatches in ${e.days} day${e.days===1?'':'s'}${t?'':' (paused)'}</p></div></div></div>`).join('');
  const can=t&&a&&b&&!why&&S.coin>=20&&S.food>=3&&S.eggs.length<eggCap();
  return`<div class="cols"><section class="card"><h2>Breeding</h2>
    ${t?`<p class="hint">Pair a proven female and a proven male. The mother sets the species. Each parent passes one copy of every gene, and the father passes his better copy more often. 20 coin and 3 food per egg.</p>`:`<div class="risk"><b>Nursery offline.</b> Add Wardens (or Warden hybrids) to the Nursery in the Hideout until it reaches tier 1.</div>`}
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr))">
      <label class="field">Mother ♀<select id="breedMom" data-act="mom">${opt(moms,ui.mom)}</select></label>
      <label class="field">Father ♂<select id="breedDad" data-act="dad">${opt(dads,ui.dad)}</select></label>
      ${a||b?`<div class="cgrid two">${[a,b].filter(Boolean).map(p=>creatureCard(p,{ctx:p===a?'Mother: sets the species':'Father: weighs most in stats'})).join('')}</div>`:''}
    </div>${pred}
    <div class="row"><button class="btn primary" data-act="breed" ${can?'':'disabled'}>Lay an egg</button><span class="status">Incubator ${S.eggs.length}/${eggCap()}</span></div>
  </section>
  <section class="card"><h2>Incubator</h2>${eggs||'<p class="empty">No eggs yet.</p>'}
    <h3>Known hybrid pairings</h3><p class="hint">Rare when the parents' types match a pairing, in either order. Hybrids have both types, +20% HP and attack, and one evolution at Lv 20.</p>
    <ul class="plain">${HYBRIDS.filter(h=>h.id!==LORE.SECRET_HYBRID||secretHybridKnown()).map(h=>`<li><b>${h.name}</b>: ${TYPES[h.types[0]].name} + ${TYPES[h.types[1]].name}</li>`).join('')}</ul></section></div>
  <div class="cols" style="margin-top:16px">${breedingTools()}</div>`;
}

function viewResearch(){
  const cols=RES_IDS.map(b=>{const R0=RESEARCH[b],lv=S.research[b],k=researchCost(b);
    const nodes=R0.nodes.map((n,i)=>`<li class="${lv>i?'on':i===lv?'next':''}"><b>${i+1}</b><span>${n}</span></li>`).join('');
    const afford=k&&S.coin>=k.coin&&S.ore>=k.ore&&S.shards>=k.shard;
    return`<section class="card rescol" style="--rc:${R0.col}"><h3>${R0.name} <small class="status">${lv}/5</small></h3><ol class="resnodes">${nodes}</ol>
      ${k?`<button class="btn small ${afford?'primary':''}" data-act="research" data-k="${b}" ${afford?'':'disabled'}>Research · ${k.coin}c ${k.ore} ore${k.shard?' '+k.shard+' shard':''}</button>`:'<span class="chip good">Complete</span>'}</section>`}).join('');
  return`${archivePanel()}<section class="card" style="margin-bottom:16px"><h2>Archive research</h2><p class="hint">Permanent upgrades, paid in coin, ore and memory shards. Shards come from bosses, secret rooms, quests and Codex milestones. Each branch unlocks in order.</p>
    <p class="status">You have ${S.coin} coin, ${S.ore} ore and ${S.shards} shards.</p></section><div class="resgrid">${cols}</div>`;
}

function viewArmory(){return workshopView(ui)}

/* ---------- Codex ---------- */
const journalNew=()=>pagesFound()>S.journalRead;
const milestoneReady=()=>{const m=DEX_MILES[S.dex.claimed];return!!m&&dexScore()>=m.n};
function viewCodex(){
  const T=[['creatures','Creatures'],['enemies','Enemies'],['bosses','Boss memories'],['journal','Ilsa’s journal'+(journalNew()?' •':'')],['reactions','Reactions & combos'],['veins','The veins'],['story','The story so far'],['murals','Murals']];
  const nav=`<div class="filters">${T.map(([k,l])=>`<button class="tab" aria-selected="${ui.codex===k}" data-act="codex" data-k="${k}">${l}</button>`).join('')}</div>`;
  const sc=dexScore(),m=DEX_MILES[S.dex.claimed];
  const head=`<section class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><h2>Codex · ${sc}/${DEX_TOTAL()} discovered</h2>
    ${m?`<button class="btn small ${sc>=m.n?'primary':''}" data-act="claim" ${sc>=m.n?'':'disabled'}>${sc>=m.n?'Claim':`Next reward at ${m.n}`}: ${rewardText(m.reward)}</button>`:'<span class="chip good">All milestones claimed</span>'}</div>${nav}</section>`;
  let body='';
  if(ui.codex==='creatures'){
    const tnav=`<div class="filters">${[...TYPE_IDS,'hybrid'].map(t=>`<button class="tab" aria-selected="${ui.dexType===t}" data-act="dextype" data-k="${t}">${t==='hybrid'?'Hybrids':TYPES[t].name}</button>`).join('')}</div>`;
    const list=ui.dexType==='hybrid'?HYBRIDS.map(h=>h.id):speciesOf(ui.dexType);
    body=`<section class="card">${tnav}<div class="dexlines">${list.map(sp=>{const L=LINES[sp];return`<div class="dexline"><div class="row" style="justify-content:space-between"><b>${SPECIES[sp].name} line</b><small class="status">${SPECIES[sp].hybrid?'Hybrid':({6:'Common',3:'Uncommon',1:'Rare'})[SPECIES[sp].w]}</small></div><div class="dexforms">${L.map((f,i)=>{const d=S.dex.forms[sp+':'+i]||{};const seen=!!d.seen;
      return`<div class="dexform ${seen?'':'unseen'}">${sprSp(sp,i,56,!seen)}<b>${seen?f.name:'???'}</b><small>${i?`Lv ${f.lv}${f.need?' · '+GENES[f.need[0]]+' '+f.need[1]:''}`:'Base form'}</small>${seen?`<small>${ATTACKS[f.atk].name} · ${ABILITIES[f.abil].name}</small><small>${d.owned?'Owned':'Seen'}${d.caught?' · caught '+d.caught:''}</small><small class="lore">${formLore(sp,i)}</small>`:''}</div>`}).join('<i class="arrow">›</i>')}</div></div>`}).join('')}</div></section>`;
  }else if(ui.codex==='enemies'){
    body=[0,1].map(s=>`<section class="card" style="margin-bottom:16px"><h3>${s?'The Ember Abyss · Floors 4–6':'Overgrown Depths · Floors 1–3'}</h3><div class="dexgrid">${FOE_IDS.filter(k=>FOES[k].set===s).map(k=>{const d=S.dex.foes[k];const F=FOES[k];
      return`<div class="dexform ${d?'':'unseen'}"><canvas class="spr" width="52" height="52" data-foe="${k}" ${d?'':'data-sil="1"'}></canvas><b>${d?F.name:'???'}</b><small>${d?`Floor ${F.intro} · ${d.kills} defeated`:`Appears from floor ${F.intro}`}</small>${d&&d.kills?`<small class="lore">${F.lore}</small>`:''}</div>`}).join('')}</div></section>`).join('');
  }else if(ui.codex==='bosses'){
    body=`<section class="card"><p class="hint">Each boss drops a memory shard the first time you beat it, revealing who it was before the Bloom changed it.</p><div class="memories">${BOSS_IDS.map(b=>{const B=BOSSES[b],won=S.progress.bosses[b];
      return`<div class="memory ${won?'':'unseen'}"><canvas class="spr" width="64" height="64" data-boss="${b}" ${won?'':'data-sil="1"'}></canvas><div><b>${won?B.name:'Unknown memory'}</b><small class="status">${B.set?'Floor 6':'Floor 3'}${won?' · beaten '+won+'×':''}</small><p>${won?B.lore:'Defeat this boss to recover its memory.'}</p></div></div>`}).join('')}</div></section>`;
  }else if(ui.codex==='journal'){
    S.journalRead=pagesFound();save();renderTabs();
    body=journalView();
  }else if(ui.codex==='veins'){
    body=veinCodex();
  }else if(ui.codex==='reactions'){
    body=`<div class="cols"><section class="card"><h2>Elemental reactions</h2><p class="hint">Companion attacks and some weapons apply an element. Hitting a foe that carries one element with a matching second element sets off a reaction.</p>
      <div class="elemrow">${Object.values(ELEM).map(e=>`<span class="chip" style="box-shadow:0 0 0 1.5px ${e.col};color:${e.col}">${e.name}</span>`).join('')}</div>
      <ul class="plain">${REACTIONS.filter((r,i,a)=>a.findIndex(x=>x.name===r.name)===i).map(r=>`<li><b style="color:${r.col}">${r.name}</b>: ${r.desc}${r.name==='Shatter'?' Also works with Staggered.':''}</li>`).join('')}</ul></section>
      <section class="card"><h2>Combos</h2><p class="hint">Your slot 1 and slot 2 companions' types decide your combo. Press C or the Combo button when it charges.</p>
      <ul class="plain">${Object.entries(COMBOS).map(([k,c])=>`<li><b>${c.name}</b> (${k.split('+').map(t=>TYPES[t].name).join(' + ')}): ${c.desc}</li>`).join('')}<li><b>Twin Fury</b> (same type): both attack twice as fast for 5s.</li><li><b>Pack Rally</b> (any other pair): both attack 60% faster for 5s.</li></ul></section></div>`;
  }else{
    body=ui.codex==='murals'?muralView():storyView();
  }
  return head+body;
}
function rewardText(r){const o=[];if(r.coin)o.push(r.coin+' coin');if(r.ore)o.push(r.ore+' ore');if(r.cage)o.push(r.cage+' cages');if(r.gilded)o.push(r.gilded+' gilded');if(r.shard)o.push(r.shard+' shards');return o.join(', ')}

function viewLab(){
  const L=ui.lab,st=S.settings;
  const tg=(k,l,d)=>`<label class="toggle"><input type="checkbox" id="set-${k}" data-act="setting" data-k="${k}" ${st[k]?'checked':''}> <span><b style="font-family:var(--display)">${l}</b><br><small class="status">${d}</small></span></label>`;
  const spOpts=TYPE_IDS.map(t=>`<optgroup label="${TYPES[t].name}">${speciesOf(t).map(k=>`<option value="${k}" ${L.species===k?'selected':''}>${SPECIES[k].name}</option>`).join('')}</optgroup>`).join('')+
    `<optgroup label="Hybrids">${HYBRIDS.map(h=>`<option value="${h.id}" ${L.species===h.id?'selected':''}>${h.name}</option>`).join('')}</optgroup>`;
  const trOpts=sel=>`<option value="">Random</option>`+TRAIT_IDS.map(t=>`<option value="${t}" ${sel===t?'selected':''}>${TRAITS[t].name}</option>`).join('');
  return`<div class="cols"><section class="card"><h2>Test Lab</h2>
    <p class="hint">A sandbox for trying creatures, weapons, bosses and fights. Everything here edits your save directly.</p>
    <h3>Spawn a creature</h3>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))">
      <label class="field">Species<select id="lab-species" data-act="lab" data-k="species">${spOpts}</select></label>
      <label class="field">Sex<select id="lab-sex" data-act="lab" data-k="sex"><option value="R" ${L.sex==='R'?'selected':''}>Random</option><option value="F" ${L.sex==='F'?'selected':''}>Female ♀</option><option value="M" ${L.sex==='M'?'selected':''}>Male ♂</option></select></label>
      <label class="field">Origin<select id="lab-origin" data-act="lab" data-k="origin"><option value="wild" ${L.origin==='wild'?'selected':''}>Wild</option><option value="bred" ${L.origin==='bred'?'selected':''}>Bred</option></select></label>
      <label class="field">Level<input id="lab-level" type="number" min="1" max="40" value="${L.level}" data-act="lab" data-k="level"></label>
      <label class="field">Trait 1<select id="lab-t1" data-act="lab" data-k="t1">${trOpts(L.t1)}</select></label>
      <label class="field">Trait 2<select id="lab-t2" data-act="lab" data-k="t2">${trOpts(L.t2)}</select></label>
      <label class="field">Trait 3<select id="lab-t3" data-act="lab" data-k="t3">${trOpts(L.t3)}</select></label>
    </div>
    <div class="row"><label class="toggle"><input type="checkbox" id="lab-max" data-act="lab" data-k="max" ${L.max?'checked':''}> Max genes</label><label class="toggle"><input type="checkbox" id="lab-proven" data-act="lab" data-k="proven" ${L.proven?'checked':''}> Already proven</label></div>
    <div class="row"><button class="btn primary" data-act="lab-spawn">Add to roster</button><button class="btn" data-act="lab-squad">Add 10 random Lv 10 creatures</button></div>
    ${simPanel(ui.sim)}
    ${supplyPanel()}
    ${economyPanel(ui.eco)}
    <h3>Evolution and bond</h3>
    <div class="row"><button class="btn" data-act="lab-evoready">Make loadout ready to evolve</button><button class="btn" data-act="lab-evomax">Fully evolve loadout</button><button class="btn" data-act="lab-bond">Max bond for loadout</button></div>
    <h3>Jump into a raid</h3>
    <div class="row">${[1,2,3,4,5,6].map(f=>`<button class="btn small" data-act="lab-floor" data-k="${f}">Floor ${f}</button>`).join('')}<button class="btn small" data-act="tutorial">Tutorial</button></div>
    ${labBloom(ui)}
    ${labEndgamePanel()}
    ${labLorePanel()}
    ${journeyPanel()}
    <h3>Arena</h3>
    <p class="hint">One room with your loadout and endless cages. Spawn any enemy, boss, wild species, weapon, buff, curse or room twist. Nothing dies for real.</p>
    <div class="row"><button class="btn primary" data-act="arena">Enter the arena</button>${tg('keepArena','Keep arena catches','Creatures you cage in the arena join your roster.')}</div>
    <h3>Resources</h3>
    <div class="row"><button class="btn" data-act="lab-res" data-k="mats">+30 of every material</button><button class="btn" data-act="lab-res" data-k="coin">+500 coin</button><button class="btn" data-act="lab-res" data-k="food">+50 food</button><button class="btn" data-act="lab-res" data-k="ore">+50 ore</button><button class="btn" data-act="lab-res" data-k="shard">+5 shards</button><button class="btn" data-act="lab-res" data-k="cage">+5 cages</button><button class="btn" data-act="lab-res" data-k="guns">One of every weapon</button><button class="btn" data-act="lab-res" data-k="bp">Learn all blueprints</button><button class="btn" data-act="lab-res" data-k="keeper">+1 Keeper rank</button><button class="btn" data-act="lab-res" data-k="dex">Reveal the Codex</button></div>
    <div class="row"><button class="btn" data-act="wait">Advance a day</button><button class="btn" data-act="lab-heal">Heal everyone</button><button class="btn" data-act="lab-prove">Prove everyone</button><button class="btn" data-act="lab-xp">+5 levels to loadout</button><button class="btn" data-act="lab-hatch">Hatch eggs now</button></div>
  </section>
  <section class="card"><h2>Raid switches</h2>
    ${tg('god','God mode','You take no damage in raids.')}
    ${tg('reveal','Reveal maps','Show the whole map, including secret rooms.')}
    ${tg('instant','Guaranteed capture','Any cage on a wild creature in range works, at any health.')}
    ${tg('noTimer','No raid timer','The dungeon never collapses.')}
    ${tg('genes','Reveal genomes','See both copies of every gene and exact breeding odds, as with a Gene Lens.')}
    <h3>Save</h3><p class="hint">Progress saves in this browser only. Saves from earlier versions are upgraded when they load, never reset.</p>
    <div class="row"><button class="btn ${ui.resetArm?'danger':''}" data-act="reset">${ui.resetArm?'Confirm: wipe and restart':'Reset save'}</button></div>
  </section></div>`;
}

function viewSettings(){
  const o=OPTS;
  const seg=(k,vals,label)=>`<div class="field"><span>${label}</span><div class="seg">${vals.map(([v,l])=>`<button class="tab" aria-selected="${o[k]===v}" data-act="opt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  const tg=(k,l,d)=>`<label class="toggle"><input type="checkbox" id="opt-${k}" data-act="optc" data-k="${k}" ${o[k]?'checked':''}> <span><b style="font-family:var(--display)">${l}</b><br><small class="status">${d}</small></span></label>`;
  const sl=(k,l)=>`<label class="field">${l} <small class="status" id="v-${k}">${Math.round(o[k]*100)}%</small><input id="opt-${k}" type="range" min="0" max="1" step="0.05" value="${o[k]}" data-act="optr" data-k="${k}"></label>`;
  return`<div class="cols"><section class="card"><h2>Keeper</h2>
    <label class="field">Your name, for the maker’s mark<input id="keeper-name" type="text" maxlength="24" value="${esc(S.keeperName||'')}" placeholder="the Keeper" data-act="keepername"></label>
    <p class="status">Everything you craft at Superior quality or better carries your name and its foreman’s, like “Masterwork Ember Carbine, made by ${esc(S.keeperName||'the Keeper')} with Pyrrovex”.</p>
    ${sigilPanel()}</section>
  <section class="card"><h2>Touch controls</h2>
    ${seg('stick',[['fixed','Fixed'],['float','Floating']],'Joysticks')}
    <p class="status">Fixed sticks stay in the bottom corners. Floating sticks appear wherever your thumb lands.</p>
    ${seg('stickSize',[['S','Small'],['M','Medium'],['L','Large']],'Joystick size')}
    ${seg('btnSize',[['S','Small'],['M','Medium'],['L','Large']],'Button size')}
    ${seg('hand',[['right','Right-handed'],['left','Left-handed']],'Layout')}
    ${tg('autoFire','Fire while aiming','Pushing the aim stick also fires. Turn off to fire only past half tilt.')}
    ${tg('fullscreen','Full screen in raids','On phones, raids go full screen and turn the screen sideways where the browser allows it.')}
  </section>
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
  <section class="card"><h2>Sound</h2>
    ${tg('mute','Mute everything','Silences music and sound effects.')}
    ${sl('vol','Master volume')}${sl('music','Music')}${sl('sfx','Sound effects')}
    <p class="status">Music changes with where you are: the hideout, the Depths, the Abyss and boss fights.</p></section>
  <section class="card"><h2>Display</h2>
    ${tg('dmgNums','Damage numbers','Show floating numbers when you hit things.')}
    ${tg('shake','Screen shake','Shake the screen when you take damage.')}
    <label class="field">HUD opacity<input id="opt-hud" type="range" min="0.4" max="1" step="0.05" value="${o.hudAlpha}" data-act="opthud"></label></section>
  <section class="card"><h2>Accessibility and performance</h2>
    ${seg('palette',[['normal','Standard'],...Object.entries(BALANCE.ACCESS.palettes).map(([k,p])=>[k,p.name])],'Colors')}
    <p class="status">Colorblind palettes recolor good and bad, both sides' bullets and every type. Enemy bullets also keep a white ring and gain a dark core.</p>
    ${tg('aimAssist','Aim assist','On touch, the aim stick bends toward the nearest enemy in a narrow cone.')}
    ${tg('slowBullets','Slower enemy bullets',`Enemy bullets move at ${Math.round(BALANCE.ACCESS.slowBullets*100)}% speed.`)}
    ${seg('quality',[['auto','Auto'],['high','High'],['low','Battery saver']],'Raid graphics')}
    <p class="status">Auto draws raids sharp and steps the detail down if your phone slows, so it stays smooth.</p></section>
  <section class="card"><h2>Story and help</h2>
    <div class="row"><button class="btn" data-act="tutorial">Replay the tutorial</button><button class="btn" data-act="intro">Read the opening story</button></div></section>
  <section class="card"><h2>Feedback</h2>${statsPanel()}</section></div></div>`;
}

/* ---------- modals ---------- */
// wide: a landscape report (the end of a raid) that lays its sections out in columns.
function openModal(html,wide){$('#modal').hidden=false;$('#modalBox').classList.toggle('wide',!!wide);$('#modalBox').innerHTML=html;paintSprites($('#modalBox'))}
// Modals waiting for the open one to close (the demo's end screen after a raid's results, say).
const modalQueue=[];
function closeModal(){$('#modal').hidden=true;const next=modalQueue.shift();if(next)openModal(next)}
function queueModal(html){if($('#modal').hidden&&!R)openModal(html);else modalQueue.push(html)}
function openChooser(slot){
  const cur=S.loadout.slots[slot];
  const list=S.creatures.filter(c=>c.id!==cur&&!expAway(c)).sort((a,b)=>b.level-a.level);
  const items=list.map(c=>{const w=whereIs(c),st=stats(c);const note=w.kind==='section'?`Leaves the ${SECTIONS[w.key].name}`:w.kind==='loadout'?`Moves from slot ${w.slot+1}`:'';
    return creatureCard(c,{act:'pickslot',data:{slot},ctx:`${slot===2?'Passive: '+esc(supportText(c)):ABILITIES[st.abilId].name+' · '+ATTACKS[st.atkId].name}${note?` · <b>${note}</b>`:''}`})}).join('');
  openModal(`<h2>${slot===2?'Slot 3: support or free':'Combat slot '+(slot+1)}</h2>
    ${slot===2?'<p class="hint">A support creature gives its passive but stays out of the fight until you swap it into slot 1 or 2. Leave the slot free if you plan to cage something.</p>':''}
    <div class="choose-list cgrid">${slot===2?'<button class="choice" data-act="clearslot" data-slot="2"><span class="nm">Leave free for a capture</span></button>':''}${items||'<p class="empty">No other creatures.</p>'}</div>
    <div class="row"><button class="btn" data-act="close">Cancel</button></div>`);
}
function openNpc(id){
  const n=NPCS[id],st=S.npc[id];if(!st)return;
  let line;if(!st.met){line=n.intro;st.met=true;save()}else line=fxPick(n.idle);
  const p=npcQuest(id);
  const quest=p?`<div class="slot"><div class="slot-label">Quest ${st.q+1} of ${n.quests.length}</div><p>${p.q.text}</p>
    <div class="bar"><i style="width:${p.v/p.q.n*100}%;background:var(--gold)"></i></div><p class="status">${p.v}/${p.q.n} · Reward: ${questRewardText(p.q.reward)}</p>
    ${p.done?`<button class="btn primary" data-act="turnin" data-k="${id}">Turn in</button>`:''}</div>`:`<p class="status">${n.outro}</p>`;
  openModal(`<div class="row" style="gap:12px;flex-wrap:nowrap"><canvas class="spr" width="72" height="72" data-npc="${id}"></canvas><div><h2>${n.name}</h2><p class="status">${n.role} · ${SECTIONS[n.home]?SECTIONS[n.home].name:n.homeName}</p></div></div>
    <blockquote class="say">${line}</blockquote>${quest}<div class="row"><button class="btn" data-act="close">Goodbye</button></div>`);
  renderTabs();
}
function questRewardText(r){const o=[];if(r.coin)o.push(r.coin+' coin');if(r.ore)o.push(r.ore+' ore');if(r.cage)o.push(r.cage+' cages');if(r.gilded)o.push(r.gilded+' gilded cages');if(r.shard)o.push(r.shard+' shard'+(r.shard>1?'s':''));if(r.blueprint)o.push(GUNS[r.blueprint].name+' blueprint');if(r.weapon)o.push(GUNS[r.weapon].name);if(r.egg)o.push('a mysterious egg');return o.join(', ')}
function openIntro(first){
  openModal(`<h2 class="res-title">The Bloom</h2>${LORE_INTRO.map(p=>`<p>${p}</p>`).join('')}
    <div class="row">${first?'<button class="btn primary" data-act="tutorial">Play the tutorial</button><button class="btn" data-act="close">Skip to the hideout</button>':'<button class="btn primary" data-act="close">Close</button>'}</div>`);
}

/* ================= Actions ================= */
onMarket(()=>{if(!S)return;renderHeader();if(ui.tab==='exchange'&&!document.activeElement?.matches?.('input'))renderMain()});
bindCharts(document);
// The hideout, raid prep, roster, research, Codex, settings and Test Lab actions. Other screens register their own.
onAct('tab',d=>{ui.tab=d.k;ui.creature=null;ui.sellId=null;ui.resetArm=false;ui.scrapArm=null;renderAll();window.scrollTo(0,0)});
onAct('filter',d=>{ui.filter=d.k;renderMain()});
onAct('section',d=>{ui.section=d.k;HMAP.sel=d.k;if($('#secPanel'))renderSecPanel();else renderMain()});
onAct('codex',d=>{ui.codex=d.k;renderMain()});
onAct('dextype',d=>{ui.dexType=d.k;renderMain()});
onAct('close',d=>{closeModal()});
onAct('npc',d=>{openNpc(d.k)});
onAct('turnin',d=>{const got=npcTurnIn(d.k);if(got){sfx('quest');save();renderAll();const n=NPCS[d.k];openModal(`<div class="row" style="gap:12px;flex-wrap:nowrap"><canvas class="spr" width="72" height="72" data-npc="${d.k}"></canvas><h2>${n.name}</h2></div><blockquote class="say">${n.quests[S.npc[d.k].q-1].done}</blockquote><p class="status">Received ${got}.</p><div class="row"><button class="btn primary" data-act="npc" data-k="${d.k}">Continue</button><button class="btn" data-act="close">Close</button></div>`)}});
onAct('claim',d=>{const m=DEX_MILES[S.dex.claimed];if(m&&dexScore()>=m.n){const got=giveReward(m.reward);S.dex.claimed++;addLog(`Codex milestone ${m.n}: received ${got}.`);sfx('quest');save();renderAll()}});
onAct('research',d=>{if(buyResearch(d.k)){sfx('level');save();renderAll()}});
onAct('evolve',d=>{const c=byId(+d.id);const old=evolve(c);if(old){sfx('evolve');save();renderAll();
      openModal(`<h2 class="res-title win">${esc(c.name)} evolved!</h2><div class="row" style="justify-content:center;gap:10px">${sprSp(c.species,c.stage-1,80)}<b style="font-family:var(--display);font-size:1.6rem">›</b>${sprSp(c.species,c.stage,96)}</div>
        <p style="text-align:center">${esc(old)} became <b style="color:var(--gold)">${esc(formName(c))}</b>.</p><p class="status" style="text-align:center">New attack: ${ATTACKS[formOf(c).atk].name}. Ability: ${ABILITIES[formOf(c).abil].name}.</p><div class="row" style="justify-content:center"><button class="btn primary" data-act="close">Wonderful</button></div>`)}});
onAct('choose',d=>{openChooser(+d.slot)});
onAct('pickslot',d=>{const c=byId(+d.id);unplace(c);S.loadout.slots[+d.slot]=c.id;closeModal();save();renderAll()});
onAct('clearslot',d=>{S.loadout.slots[+d.slot]=null;closeModal();save();renderAll()});
onAct('deploy',d=>{if(overCap()){renderAll();return}startRaid('raid')});
onAct('scav',d=>{startRaid('scav')});
onAct('arena',d=>{startRaid('arena')});
onAct('tutorial',d=>{closeModal();startRaid('tutorial')});
onAct('intro',d=>{openIntro(false)});
onAct('wait',d=>{passDay();save();renderAll()});
onAct('assign',d=>{const sel=$('#addsel');if(!sel)return;const c=byId(+sel.value);if(!c||S.sections[d.k].ids.length>=secCap(d.k))return;unplace(c);S.sections[d.k].ids.push(c.id);save();renderAll()});
onAct('unassign',d=>{const c=byId(+d.id);if(c){unplace(c);save();renderAll()}});
onAct('upgrade',d=>{if(upgradeBuilding(d.k)){sfx('level');save();renderAll()}});
onAct('expand',d=>{const ec=expandCost(d.k);if(S.coin<ec.coin||S.ore<ec.ore||S.sections[d.k].cap>=10)return;S.coin-=ec.coin;S.ore-=ec.ore;S.sections[d.k].cap++;save();renderAll()});
onAct('feed',d=>{const c=byId(+d.id);if(S.food<1)return;S.food--;addBond(c,10);c.hp=Math.min(stats(c).hp,c.hp+Math.round(stats(c).hp*.2));sfx('pickup');save();renderAll()});
onAct('sell',d=>{const c=byId(+d.id);if(!c||expAway(c))return;if(ui.sellId!==c.id){ui.sellId=c.id;renderMain();return}
      S.coin+=sellValue(c);unplace(c);S.creatures=S.creatures.filter(x=>x!==c);ui.sellId=null;addLog(`Sold ${c.name} for ${sellValue(c)} coin.`);sfx('coin');save();renderAll()});
onAct('breed',d=>{breed()});
onAct('opt',d=>{OPTS[d.k]=d.v;if(d.k==='palette')applyPalette();if(d.k==='quality')resetScale();saveOpts();renderAll()});
onAct('lab-spawn',(d,a)=>{const L=ui.lab;const lv=clamp(+L.level||1,1,40);
      let traits=null;if(L.t1||L.t2||L.t3){traits=[L.t1,L.t2,L.t3].map(t=>t||null)}
      const c=makeCreature(L.species,L.origin,lv,{proven:L.proven,sex:L.sex==='R'?null:L.sex,traits,genes:L.max?Object.fromEntries(GRADE_LOCI.map(k=>[k,10])):undefined,captureRaid:L.origin==='wild'&&!L.proven?S.stats.raids:-1});
      S.creatures.push(c);dexForm(c.species,0,'owned');addLog(`Test Lab: added ${c.name}, a ${sexSym(c.sex)} ${L.origin} ${SPECIES[c.species].name} at Lv ${lv}.`);save();renderAll()});
onAct('lab-squad',d=>{for(let i=0;i<10;i++){const sp=pick(BASE_SPECIES);const c=makeCreature(sp,'bred',10);S.creatures.push(c);dexForm(sp,0,'owned')}addLog('Test Lab: added 10 Lv 10 creatures.');save();renderAll()});
onAct('lab-evoready',d=>{S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{const n=nextForm(c);if(!n)return;c.level=Math.max(c.level,n.lv);c.proven=true;if(n.need)c.genes[n.need[0]]=Math.max(c.genes[n.need[0]],n.need[1]);c.hp=stats(c).hp});S.coin+=600;S.ore+=60;S.shards+=2;save();renderAll()});
onAct('lab-evomax',d=>{S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{const L=lineOf(c);c.stage=L.length-1;c.level=Math.max(c.level,L[L.length-1].lv);c.proven=true;for(let i=0;i<=c.stage;i++)dexForm(c.species,i,'owned');c.hp=stats(c).hp});save();renderAll()});
onAct('lab-bond',d=>{S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{c.bondXp=BOND_TH[4];c.hp=stats(c).hp});save();renderAll()});
onAct('lab-floor',d=>{startRaid('raid',+d.k)});
onAct('lab-res',d=>{const k=d.k;if(k==='coin')S.coin+=500;if(k==='food')S.food+=50;if(k==='ore')S.ore+=50;if(k==='shard')S.shards+=5;if(k==='cage')S.cages.basic+=5;
      if(k==='guns')GUN_IDS.forEach(g=>{if(g!=='pistol'&&!S.items.some(i=>i.kind==='gun'&&i.id===g))newItem('gun',g,1,{src:'legacy'})});
      if(k==='mats')Object.keys(JOBS.MATERIALS).forEach(m=>give(m,30));if(k==='bp')GUN_IDS.forEach(g=>S.blueprints[g]=1);
      if(k==='keeper')addKeeperXp(keeperNeed()-S.keeper.xp);
      if(k==='dex'){for(const sp in LINES)LINES[sp].forEach((f,i)=>dexForm(sp,i,'seen'));FOE_IDS.forEach(f=>dexFoe(f,true));BOSS_IDS.forEach(b=>{S.progress.bosses[b]=S.progress.bosses[b]||1})}
      save();renderAll()});
onAct('lab-heal',d=>{S.creatures.forEach(c=>c.hp=stats(c).hp);save();renderAll()});
onAct('lab-prove',d=>{S.creatures.forEach(c=>c.proven=true);save();renderAll()});
onAct('lab-xp',d=>{S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{c.level=Math.min(40,c.level+5);c.hp=stats(c).hp});save();renderAll()});
onAct('lab-hatch',d=>{const n=S.eggs.length;S.eggs.forEach(hatchEgg);S.eggs=[];if(n)addLog(`Test Lab: hatched ${n} egg${n>1?'s':''}.`);save();renderAll()});
onAct('lab-deep',d=>{startRaid('raid',+d.k,null,'ember')});
onAct('reset',d=>{if(!ui.resetArm){ui.resetArm=true;renderMain();return}ui.resetArm=false;newGame();save();startMarket();ui.tab='raid';renderAll();openIntro(true)});
document.addEventListener('click',e=>{
  if(e.target.id==='modal'){closeModal();return}
  const b=e.target.closest('[data-act]');if(!b||b.tagName==='SELECT'||b.tagName==='INPUT'||b.disabled)return;
  if(b.closest('#raid'))return;
  if(b.dataset.act!=='tab')sfx('ui');
  act(b.dataset.act,b.dataset);
});
document.addEventListener('change',e=>{const el=e.target;if(el.dataset.act)changed(el)});
onChange('gunsel',el=>{S.loadout.guns[+el.dataset.slot]=el.value?+el.value:null;validGuns();save();renderMain()});
onChange('keepername',el=>{S.keeperName=el.value.trim().slice(0,24);save()});
onChange('satchelsel',el=>{S.loadout.satchel=el.value?+el.value:null;validGuns();save();renderMain()});
onChange('tonicsel',el=>{S.loadout.tonics=+el.value||0;validGuns();save();renderMain()});
onChange('mom',el=>{ui.mom=el.value;renderMain()});
onChange('dad',el=>{ui.dad=el.value;renderMain()});
onChange('lab',el=>{const k=el.dataset.k;ui.lab[k]=el.type==='checkbox'?el.checked:el.value});
onChange('setting',el=>{S.settings[el.dataset.k]=el.checked;save();if(el.dataset.k==='genes')renderMain()});
onChange('mode',el=>{S.modes[el.dataset.k]=el.checked;save()});
onChange('optc',el=>{OPTS[el.dataset.k]=el.checked;saveOpts();auVol()});
onChange('opthud',el=>{OPTS.hudAlpha=+el.value;saveOpts()});
onInput('optr',el=>{OPTS[el.dataset.k]=+el.value;const v=$('#v-'+el.dataset.k);if(v)v.textContent=Math.round(el.value*100)+'%';auVol();saveOpts()});
document.addEventListener('input',e=>{const el=e.target;if(el.dataset.act)inputted(el)});

export {TABS,renderAll,renderHeader,renderTabs,renderMain,hpBar,statusText,validGuns,weaponLine,persChip,viewRaid,viewHideout,renderSecPanel,logView,sectionDetail,viewRoster,viewBreeding,viewResearch,viewArmory,journalNew,milestoneReady,viewCodex,rewardText,viewLab,viewSettings,openModal,closeModal,queueModal,openChooser,openNpc,questRewardText,openIntro};
