/* ================= Hideout UI ================= */
import {$,clamp,esc,fxPick,pick} from './util.js';
import {ABILITIES,ARMORY_TIERS,ATTACKS,BASE_SPECIES,BOND_PASSIVE,BOND_TH,BOSSES,BOSS_IDS,COMBOS,DONATE_PTS,ELEM,FOES,FOE_IDS,GENES,GUNS,GUN_IDS,HYBRIDS,JOBS,JOURNAL,LINES,LORE_INTRO,MODES,NPCS,NPC_IDS,PERS,REACTIONS,RESEARCH,RES_IDS,SCRAP_ORE,SECTIONS,SECTION_IDS,SEC_TH,SPECIES,TRAITS,TRAIT_IDS,TYPES,TYPE_IDS,comboFor,comboKey,rollTraits,speciesOf} from './content.js';
import {save} from './save.js';
import {DEX_MILES,DEX_TOTAL,S,addBond,addKeeperXp,addLog,armoryTier,breed,breedBlock,bump,buyResearch,byId,cageCap,canEvolve,dexFoe,dexForm,dexScore,eggCap,evolve,evolveCost,expandCost,formName,formOf,giveReward,hatchEgg,keeperNeed,lineOf,makeCreature,modeUnlocked,newGame,nextForm,npcAttention,npcQuest,npcTurnIn,processDay,researchCost,secCap,secContribution,secScore,secTier,sectionUnlocked,sectionUnlockedArmory,sellValue,sexSym,slotBonus,stats,supportText,typeTier,ui,unplace,whereIs,xpNeed} from './state.js';
import {paintSprites,sexChip,spr,sprSp,stars,typeChips} from './sprites.js';
import {auVol,sfx} from './audio.js';
import {HMAP,startHideoutMap} from './map.js';
import {startRaid} from './raid.js';
import {GRADE_LOCI,TRAIT_LOCI,express,expressTrait} from './genetics.js';
import {geneSight,genomeBlock,lineageChips,previewHtml,runSim,simPanel,traitName,treeHtml} from './geneui.js';
import {amt,buildPen,craft,craftWeapon,expAway,fatigueMul,give,itemByUid,itemName,makerText,mouths,newItem,overCap,repair,rosterCap,rosterCount,scrapItem,startExpedition,usable} from './jobs.js';
import {candidateOption,expeditionPanel,fatBar,gearPanel,memberRow,memorialView,roleChip,rosterBar,runSupply,stationPanel,supplyPanel,workshopView} from './workui.js';
import {startMarket,marketDay} from './exchange/market.js';
import {viewExchange,economyPanel,runEconomy} from './exchangeui.js';
import {bindCharts} from './chart.js';
import {marketView,onMarket,buyNow,sellNow,postOrder,cancelOrder,bid,buyout,listItem,fulfilBounty} from './exchange/market.js';
const TABS=[['raid','Raid'],['hideout','Hideout'],['roster','Roster'],['breeding','Breeding'],['research','Research'],['armory','Workshop'],['exchange','Exchange'],['codex','Codex'],['lab','Test Lab'],['settings','Settings']];
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
  const m=$('#main');
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
const tierTag=t=>`<span class="chip tier t${t}">T${t}</span>`;
const persChip=c=>`<span class="chip pers" title="${esc(PERS[c.pers].desc)}">${PERS[c.pers].name}</span>`;

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
      <div class="slot-body">${spr(c,56)}<div style="min-width:0;flex:1"><div class="nm">${esc(c.name)} <small style="color:var(--gold)">Lv ${c.level}</small></div>
      <div class="status">${sexSym(c.sex)} ${esc(formName(c))} · ${ATTACKS[st.atkId].name}</div>
      <div class="row" style="gap:4px">${typeChips(c)}${roleChip(c)}${stars(st.star)}${c.origin==='wild'&&!c.proven?'<span class="chip warn">Unproven</span>':''}</div></div></div>
      ${hpBar(c)}
      <p class="status">${sup?'Passive: '+supportText(c):(i===0?'Q':'E')+': '+A.name+'. '+A.desc+'.'}</p>
      <div class="row"><button class="btn small" data-act="choose" data-slot="${i}">Change</button><button class="btn small" data-act="clearslot" data-slot="${i}">${sup?'Leave free':'Remove'}</button></div></div>`;
  }).join('');
  let combo='';
  if(slots[0]&&slots[1]){const cb=comboFor(slots[0].type,slots[1].type),special=!!COMBOS[comboKey(slots[0].type,slots[1].type)];combo=`<div class="combo ${special?'special':''}"><b>Combo · ${cb.name}</b><span>${cb.desc} Press C, or the Combo button, when it charges.</span></div>`}
  const risk=slots.filter(Boolean).map(c=>esc(c.name));[...L.guns,L.satchel].forEach(uid=>{const it=itemByUid(uid);if(it)risk.push(esc(itemName(it)))});if(L.tonics)risk.push(`${L.tonics} tonic${L.tonics>1?'s':''}`);
  const vt=secTier('vault');const keeps=[vt>=1&&'slot 3 creature',vt>=2&&'held weapons',vt>=4&&'slot 1 companion',vt>=5?'60% of coin and all ore':vt>=3&&'30% of coin',armoryTier()>=4&&vt<2&&'primary weapon'].filter(Boolean);
  const modes=Object.entries(MODES).map(([k,m])=>{const un=modeUnlocked(k);return`<label class="toggle ${un?'':'locked'}"><input type="checkbox" id="mode-${k}" data-act="mode" data-k="${k}" ${S.modes[k]&&un?'checked':''} ${un?'':'disabled'}> <span><b style="font-family:var(--display)">${m.name}</b>${un?'':' · locked'}<br><small class="status">${un?m.desc:`Reach War Room tier ${m.need[1]} to unlock.`}</small></span></label>`}).join('');
  const bossRow=BOSS_IDS.map(b=>{const n=S.progress.bosses[b]||0,B=BOSSES[b];return`<div class="trophy ${n?'won':''}" title="${esc(B.blurb)}"><canvas class="spr" width="48" height="48" data-boss="${b}" ${n?'':'data-sil="1"'}></canvas><span>${n?esc(B.name):'???'}</span><small>${B.set?'Floor 6':'Floor 3'}${n?' · ×'+n:''}</small></div>`}).join('');
  const kn=keeperNeed();
  return`<div class="cols">
  <section class="card"><h2>Loadout</h2>
    ${S.tutorialDone?'':`<div class="combo special"><b>New here?</b><span>A short guided raid teaches moving, fighting, catching and extracting. Nothing is at risk.</span><div class="row"><button class="btn small primary" data-act="tutorial">Play the tutorial</button></div></div>`}
    <p class="hint">Two companions fight beside you. Slot 3 holds a support creature for its passive, or stays free so a caged catch has somewhere to go.</p>
    <div class="slots">${slotHtml}</div>${combo}
    <h3>Gear</h3>${gearPanel()}
    <p class="hint">You'll carry ${Math.min(cageCap(),S.cages.basic+S.cages.gilded)} of up to ${cageCap()} cages. Unused cages come home if you extract.</p>
    <div class="risk"><b>Lost if you die:</b> ${risk.length?risk.join(', '):'nothing of yours'}, plus cages, buffs and loot.${keeps.length?' Your hideout keeps: '+keeps.join(', ')+'.':''}</div>
    ${modes?`<h3>Raid modes</h3><div class="modes">${modes}</div>`:''}
    ${overCap()?`<div class="risk"><b>Pens over capacity.</b> ${rosterCount()}/${rosterCap()} creatures. Sell some or build a pen in the Roster tab before raiding.</div>`:''}
    <div class="row"><button class="btn primary" data-act="deploy" ${overCap()?'disabled':''}>Deploy raid</button><button class="btn" data-act="scav">Scav run (no risk)</button></div>
  </section>
  <section class="card"><h2>Keeper rank ${S.keeper.level}</h2>
    <div class="bar"><i style="width:${S.keeper.xp/kn*100}%;background:var(--gold)"></i></div>
    <p class="status">${S.keeper.xp}/${kn} XP. Every raid earns Keeper XP, even ones you lose. Each rank pays coin and a cage, unlocks a page of Ilsa's journal, and some open new sections.</p>
    <h3>Bosses</h3><div class="trophies">${bossRow}</div>
    <p class="status">One of four bosses waits at the end of Floor 3 (best faced with companions around Lv 10). Beating it opens Floors 4–6, the Ember Abyss, where a second set of bosses waits (around Lv 25). First victories give memory shards.</p>
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

function meterHtml(score,th,tier){
  const max=th[th.length-1]*1.08,pct=Math.min(100,score/max*100);
  return`<div class="meter"><i style="width:${pct}%"></i>${th.map((t,i)=>`<b class="${tier>i?'on':''}" style="left:${t/max*100}%"><span>T${i+1}</span></b>`).join('')}</div>`;
}
function viewHideout(){
  const chips=SECTION_IDS.map(k=>`<button class="tab ${sectionUnlocked(k)?'':'lockedtab'}" aria-selected="${ui.section===k}" data-act="section" data-k="${k}">${SECTIONS[k].name} ${sectionUnlocked(k)?'T'+secTier(k):'· locked'}</button>`).join('')+`<button class="tab" aria-selected="${ui.section==='log'}" data-act="section" data-k="log">Log</button><button class="tab" aria-selected="${ui.section==='memorial'}" data-act="section" data-k="memorial">Memorial</button>`;
  const npcs=NPC_IDS.filter(id=>S.npc[id]).map(id=>`<button class="tab" data-act="npc" data-k="${id}">${NPCS[id].name}${npcAttention(id)?' <i class="dot"></i>':''}</button>`).join('');
  return`<section class="card mapcard"><div class="mapwrap"><canvas id="hmap" aria-label="Hideout map. Select a building to manage it."></canvas></div>
    <p class="status">Tap a building to manage it, a person to talk, the cave mouth to raid, or the board to open the Codex. Buildings grow as their tier rises.</p>
    <div class="filters">${chips}</div>${npcs?`<div class="filters" style="margin-top:6px"><span class="status" style="align-self:center">Talk to:</span>${npcs}</div>`:''}</section>
    <section class="card secdetail" id="secPanel">${secBody()}</section>`;
}
const secBody=()=>ui.section==='log'?logView():ui.section==='memorial'?memorialView():sectionDetail(ui.section);
function renderSecPanel(){const p=$('#secPanel');if(!p)return;p.innerHTML=secBody();paintSprites(p);
  document.querySelectorAll('.mapcard .filters [data-act="section"]').forEach(b=>b.setAttribute('aria-selected',b.dataset.k===ui.section))}
function logView(){
  return`<h2>Hideout log</h2><p class="hint">Each raid moves time forward one day. Every creature eats 1 food a day, trainees eat 2.</p>
    <div class="row"><button class="btn" data-act="wait">Wait one day</button></div><ul class="log">${S.log.map(l=>`<li><span>Day ${l.day}</span>${esc(l.msg)}</li>`).join('')}</ul>`;
}
function sectionDetail(k){
  const sec=SECTIONS[k];
  if(!sectionUnlocked(k))return`<h2>${sec.name}</h2><p class="hint">${sec.blurb}</p><div class="risk"><b>Locked.</b> Reach Keeper rank ${sec.unlock} to build the ${sec.name}. Keeper XP comes from every raid, won or lost.</div>`;
  const ids=S.sections[k].ids,cap=secCap(k),t=secTier(k),sc=secScore(k),next=SEC_TH[t];
  const tiers=sec.tiers.map((d,i)=>`<li class="${t>i?'on':''}"><b>T${i+1}</b> <span>${d}</span> <small>${SEC_TH[i]} pts</small></li>`).join('');
  const members=ids.map(byId).filter(Boolean).map(c=>memberRow(c,k)).join('');
  const cand=S.creatures.filter(c=>!ids.includes(c.id)&&!expAway(c)).sort((a,b)=>secContribution(b,k)-secContribution(a,k));
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
    extra=`<h3>Gene Lab ${t>=2?'':'· opens at T2'}</h3>
      ${t>=2?`<p class="hint">Raise the weaker copy of one gene by 1, up to 10. Some evolutions need a gene at 7 or higher.</p>
      <div class="row">${sel('glc',ui.gl.id)}<select id="glg" data-act="glg">${GRADE_LOCI.map(g=>`<option value="${g}" ${ui.gl.gene===g?'selected':''}>${GENES[g]}${gc&&sight!=='stars'?' ('+gc.genes[g]+')':''}</option>`).join('')}</select>
      <button class="btn small" data-act="genelab" ${gc&&gv<10&&S.coin>=gcost.coin&&S.ore>=gcost.ore?'':'disabled'}>${gv>=10?'Maxed':`Train · ${gcost.coin}c ${gcost.ore} ore`}</button></div>`:'<p class="status">Reach tier 2 to raise genes with coin and ore.</p>'}
      <h3>Trait Tutor ${t>=4?'':'· opens at T4'}</h3>
      ${t>=4?`<p class="hint">Rewrite one trait slot, both copies, with a random positive trait. 60 coin and 8 ore.</p>
      <div class="row">${sel('ttc',ui.tt.id)}<select id="tts" data-act="tts">${tc?TRAIT_LOCI.map((k,i)=>`<option value="${k}" ${ui.tt.slot===k?'selected':''}>Slot ${i+1}: ${traitName(expressTrait(tc.genome[k]))}</option>`).join(''):''}</select>
      <button class="btn small" data-act="tutor" ${tc&&S.coin>=60&&S.ore>=8?'':'disabled'}>Retrain trait</button></div>`:'<p class="status">Reach tier 4 to swap out unwanted traits.</p>'}`;
  }
  return`<div class="row" style="justify-content:space-between"><h2>${sec.name}</h2>${tierTag(t)}</div>
    <p class="hint">${sec.blurb} ${sec.type?`${TYPES[sec.type].name} creatures count double, ${TYPES[sec.type].name} hybrids 1.6×, others 0.6×.`:'Every creature counts the same here.'} Contribution grows with level, evolution and ${GENES[sec.gene]}.</p>
    ${meterHtml(sc,SEC_TH,t)}
    <p class="status">${Math.round(sc)} points${next?` · ${Math.round(next-sc)} more for tier ${t+1}`:' · maxed'}</p>
    <ul class="tierlist">${tiers}</ul>
    <h3>Creatures · ${ids.length}/${cap}</h3>
    <div class="members">${members||'<p class="empty">Nobody is assigned yet.</p>'}</div>
    ${add}
    ${canExp?`<div class="row"><button class="btn small" data-act="expand" data-k="${k}" ${S.coin>=ec.coin&&S.ore>=ec.ore?'':'disabled'}>Build a slot · ${ec.coin}c ${ec.ore} ore</button><span class="status">Up to 10 slots${slotBonus()?` (+${slotBonus()} from Keeper rank)`:''}</span></div>`:''}
    ${stationPanel(k)}${k==='roost'?expeditionPanel(ui):''}
    ${extra}`;
}

function creCard(c){
  const st=stats(c),sp=SPECIES[c.species],T=c.type,L=lineOf(c),nf=nextForm(c),A=ABILITIES[st.abilId],K=ATTACKS[st.atkId];
  const sellArmed=ui.sellId===c.id;
  const chain=L.map((f,i)=>`<span class="evo ${i===(c.stage||0)?'on':i<(c.stage||0)?'done':''}">${f.name}${i?` <small>Lv ${f.lv}</small>`:''}</span>`).join('<i>›</i>');
  let evo='';
  if(nf){const ok=canEvolve(c),k=evolveCost(c),afford=S.coin>=k.coin&&S.ore>=k.ore&&S.shards>=k.shard;
    const why=!c.proven?'Must be proven first':c.level<nf.lv?`Needs Lv ${nf.lv}`:nf.need&&c.genes[nf.need[0]]<nf.need[1]?`Needs ${GENES[nf.need[0]]} ${nf.need[1]}+`:'';
    evo=`<div class="row"><button class="btn small ${ok&&afford?'primary':''}" data-act="evolve" data-id="${c.id}" ${ok&&afford?'':'disabled'}>${ok?`Evolve into ${nf.name} · ${k.coin}c ${k.ore} ore${k.shard?' '+k.shard+' shard':''}`:`${nf.name}: ${why}`}</button></div>`}
  const bs=st.star,bp=BOND_PASSIVE[T],nextB=BOND_TH[bs];
  return`<article class="cre">${spr(c,72)}<div class="cre-main">
    <div class="cre-name">${esc(c.name)} <span class="lv">Lv ${c.level}</span></div>
    <div class="status">${esc(formName(c))} · ${sp.blurb}</div>
    <div class="row" style="gap:4px">${sexChip(c)}${typeChips(c)}${persChip(c)}${roleChip(c)}${c.origin==='bred'?'':(c.proven?'<span class="chip">Wild · Proven</span>':'<span class="chip warn">Wild · Unproven</span>')}${lineageChips(c)}</div>
    ${hpBar(c)}
    <dl class="stats"><div><dt>HP</dt><dd>${c.hp}/${st.hp}</dd></div><div><dt>Atk</dt><dd>${st.atk}</dd></div><div><dt>Move</dt><dd>${st.spd}</dd></div><div><dt>Rate</dt><dd>×${st.rate}</dd></div></dl>
    <p class="status"><b class="lbl">Attack:</b> ${K.name}, ${K.desc.toLowerCase()}<br><b class="lbl">Ability:</b> ${A.name}, ${A.desc.toLowerCase()}</p>
    <div class="evochain">${chain}</div>${evo}
    <div class="row" style="gap:6px">${stars(bs)}<small class="status">${nextB!=null?`${c.bondXp}/${nextB} bond`:'Max bond'}${bs>=3?` · ${bp.name}: ${bp.desc}`:` · ★3 unlocks ${bp.name}`}</small></div>
    ${genomeBlock(c)}
    <div class="bar" title="XP"><i style="width:${c.xp/xpNeed(c)*100}%;background:var(--sky)"></i></div>
    <p class="status"><b class="lbl">Fatigue</b> ${Math.round(c.fat||0)}%${c.fat>0?` · working at ${Math.round(fatigueMul(c)*100)}%`:''}</p>${fatBar(c)}
    <p class="status">${statusText(c)} · XP ${c.xp}/${xpNeed(c)}${c.origin==='wild'?` · obeys ${Math.round(st.obey*100)}%`:''}</p>
    <div class="row"><button class="btn small" data-act="feed" data-id="${c.id}" ${S.food<1?'disabled':''}>Feed (1 food)</button>
    <button class="btn small ${sellArmed?'danger':''}" data-act="sell" data-id="${c.id}">${sellArmed?'Confirm: sell for '+sellValue(c)+' coin':'Sell'}</button></div>
  </div></article>`;
}
function viewRoster(){
  const F=[['all','All'],['evolve','Can evolve'],['wild','Wild'],['bred','Bred'],['unproven','Unproven'],['f','Female'],['m','Male'],['hybrid','Hybrids'],['idle','Idle']];
  let list=S.creatures.slice();const f=ui.filter;
  if(f==='evolve')list=list.filter(canEvolve);
  if(f==='wild')list=list.filter(c=>c.origin==='wild');
  if(f==='bred')list=list.filter(c=>c.origin==='bred');
  if(f==='unproven')list=list.filter(c=>!c.proven);
  if(f==='f')list=list.filter(c=>c.sex==='F');
  if(f==='m')list=list.filter(c=>c.sex==='M');
  if(f==='hybrid')list=list.filter(c=>c.type2);
  if(f==='idle')list=list.filter(c=>whereIs(c).kind==='idle');
  list.sort((a,b)=>b.level-a.level||typeTier(b)-typeTier(a));
  return`<section class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><h2>Roster · ${S.creatures.length} creatures</h2>
    <div class="filters">${F.map(([k,l])=>`<button class="tab" aria-selected="${ui.filter===k}" data-act="filter" data-k="${k}">${l}</button>`).join('')}</div></div>
    ${rosterBar()}
    <p class="hint">Every species has its own evolution line. Each evolution changes its attack and ability and raises its stats. Bond grows from raids, feeding and training; stars unlock bonuses up to Last Stand at ★5.</p></section>
    <div class="grid">${list.map(creCard).join('')||'<p class="empty">No creatures match this filter.</p>'}</div>`;
}

function viewBreeding(){
  const t=secTier('nursery');
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
    </div>${pred}
    <div class="row"><button class="btn primary" data-act="breed" ${can?'':'disabled'}>Lay an egg</button><span class="status">Incubator ${S.eggs.length}/${eggCap()}</span></div>
  </section>
  <section class="card"><h2>Incubator</h2>${eggs||'<p class="empty">No eggs yet.</p>'}
    <h3>Known hybrid pairings</h3><p class="hint">Rare when the parents' types match a pairing, in either order. Hybrids have both types, +20% HP and attack, and one evolution at Lv 20.</p>
    <ul class="plain">${HYBRIDS.map(h=>`<li><b>${h.name}</b>: ${TYPES[h.types[0]].name} + ${TYPES[h.types[1]].name}</li>`).join('')}</ul></section></div>`;
}

function viewResearch(){
  const cols=RES_IDS.map(b=>{const R0=RESEARCH[b],lv=S.research[b],k=researchCost(b);
    const nodes=R0.nodes.map((n,i)=>`<li class="${lv>i?'on':i===lv?'next':''}"><b>${i+1}</b><span>${n}</span></li>`).join('');
    const afford=k&&S.coin>=k.coin&&S.ore>=k.ore&&S.shards>=k.shard;
    return`<section class="card rescol" style="--rc:${R0.col}"><h3>${R0.name} <small class="status">${lv}/5</small></h3><ol class="resnodes">${nodes}</ol>
      ${k?`<button class="btn small ${afford?'primary':''}" data-act="research" data-k="${b}" ${afford?'':'disabled'}>Research · ${k.coin}c ${k.ore} ore${k.shard?' '+k.shard+' shard':''}</button>`:'<span class="chip good">Complete</span>'}</section>`}).join('');
  return`<section class="card" style="margin-bottom:16px"><h2>Archive research</h2><p class="hint">Permanent upgrades, paid in coin, ore and memory shards. Shards come from bosses, secret rooms, quests and Codex milestones. Each branch unlocks in order.</p>
    <p class="status">You have ${S.coin} coin, ${S.ore} ore and ${S.shards} shards.</p></section><div class="resgrid">${cols}</div>`;
}

function viewArmory(){return workshopView(ui)}

/* ---------- Codex ---------- */
const journalNew=()=>JOURNAL.filter(j=>j.rank<=S.keeper.level).length>S.journalRead;
const milestoneReady=()=>{const m=DEX_MILES[S.dex.claimed];return!!m&&dexScore()>=m.n};
function viewCodex(){
  const T=[['creatures','Creatures'],['enemies','Enemies'],['bosses','Boss memories'],['journal','Ilsa’s journal'+(journalNew()?' •':'')],['reactions','Reactions & combos'],['story','The Bloom']];
  const nav=`<div class="filters">${T.map(([k,l])=>`<button class="tab" aria-selected="${ui.codex===k}" data-act="codex" data-k="${k}">${l}</button>`).join('')}</div>`;
  const sc=dexScore(),m=DEX_MILES[S.dex.claimed];
  const head=`<section class="card" style="margin-bottom:16px"><div class="row" style="justify-content:space-between"><h2>Codex · ${sc}/${DEX_TOTAL()} discovered</h2>
    ${m?`<button class="btn small ${sc>=m.n?'primary':''}" data-act="claim" ${sc>=m.n?'':'disabled'}>${sc>=m.n?'Claim':`Next reward at ${m.n}`}: ${rewardText(m.reward)}</button>`:'<span class="chip good">All milestones claimed</span>'}</div>${nav}</section>`;
  let body='';
  if(ui.codex==='creatures'){
    const tnav=`<div class="filters">${[...TYPE_IDS,'hybrid'].map(t=>`<button class="tab" aria-selected="${ui.dexType===t}" data-act="dextype" data-k="${t}">${t==='hybrid'?'Hybrids':TYPES[t].name}</button>`).join('')}</div>`;
    const list=ui.dexType==='hybrid'?HYBRIDS.map(h=>h.id):speciesOf(ui.dexType);
    body=`<section class="card">${tnav}<div class="dexlines">${list.map(sp=>{const L=LINES[sp];return`<div class="dexline"><div class="row" style="justify-content:space-between"><b>${SPECIES[sp].name} line</b><small class="status">${SPECIES[sp].hybrid?'Hybrid':({6:'Common',3:'Uncommon',1:'Rare'})[SPECIES[sp].w]}</small></div><div class="dexforms">${L.map((f,i)=>{const d=S.dex.forms[sp+':'+i]||{};const seen=!!d.seen;
      return`<div class="dexform ${seen?'':'unseen'}">${sprSp(sp,i,56,!seen)}<b>${seen?f.name:'???'}</b><small>${i?`Lv ${f.lv}${f.need?' · '+GENES[f.need[0]]+' '+f.need[1]:''}`:'Base form'}</small>${seen?`<small>${ATTACKS[f.atk].name} · ${ABILITIES[f.abil].name}</small><small>${d.owned?'Owned':'Seen'}${d.caught?' · caught '+d.caught:''}</small>`:''}</div>`}).join('<i class="arrow">›</i>')}</div></div>`}).join('')}</div></section>`;
  }else if(ui.codex==='enemies'){
    body=[0,1].map(s=>`<section class="card" style="margin-bottom:16px"><h3>${s?'The Ember Abyss · Floors 4–6':'Overgrown Depths · Floors 1–3'}</h3><div class="dexgrid">${FOE_IDS.filter(k=>FOES[k].set===s).map(k=>{const d=S.dex.foes[k];const F=FOES[k];
      return`<div class="dexform ${d?'':'unseen'}"><canvas class="spr" width="52" height="52" data-foe="${k}" ${d?'':'data-sil="1"'}></canvas><b>${d?F.name:'???'}</b><small>${d?`Floor ${F.intro} · ${d.kills} defeated`:`Appears from floor ${F.intro}`}</small>${d&&d.kills?`<small class="lore">${F.lore}</small>`:''}</div>`}).join('')}</div></section>`).join('');
  }else if(ui.codex==='bosses'){
    body=`<section class="card"><p class="hint">Each boss drops a memory shard the first time you beat it, revealing who it was before the Bloom changed it.</p><div class="memories">${BOSS_IDS.map(b=>{const B=BOSSES[b],won=S.progress.bosses[b];
      return`<div class="memory ${won?'':'unseen'}"><canvas class="spr" width="64" height="64" data-boss="${b}" ${won?'':'data-sil="1"'}></canvas><div><b>${won?B.name:'Unknown memory'}</b><small class="status">${B.set?'Floor 6':'Floor 3'}${won?' · beaten '+won+'×':''}</small><p>${won?B.lore:'Defeat this boss to recover its memory.'}</p></div></div>`}).join('')}</div></section>`;
  }else if(ui.codex==='journal'){
    S.journalRead=JOURNAL.filter(j=>j.rank<=S.keeper.level).length;save();renderTabs();
    body=`<section class="card journal"><p class="hint">Ilsa Marrow kept this journal. A new page turns up with each Keeper rank.</p>${JOURNAL.map(j=>j.rank<=S.keeper.level?`<article class="page"><h3>${j.title}</h3><p>${j.text}</p><small>Keeper rank ${j.rank}</small></article>`:`<article class="page locked"><h3>Missing page</h3><p>Reach Keeper rank ${j.rank} to find it.</p></article>`).join('')}</section>`;
  }else if(ui.codex==='reactions'){
    body=`<div class="cols"><section class="card"><h2>Elemental reactions</h2><p class="hint">Companion attacks and some weapons apply an element. Hitting a foe that carries one element with a matching second element sets off a reaction.</p>
      <div class="elemrow">${Object.values(ELEM).map(e=>`<span class="chip" style="box-shadow:0 0 0 1.5px ${e.col};color:${e.col}">${e.name}</span>`).join('')}</div>
      <ul class="plain">${REACTIONS.filter((r,i,a)=>a.findIndex(x=>x.name===r.name)===i).map(r=>`<li><b style="color:${r.col}">${r.name}</b>: ${r.desc}${r.name==='Shatter'?' Also works with Staggered.':''}</li>`).join('')}</ul></section>
      <section class="card"><h2>Combos</h2><p class="hint">Your slot 1 and slot 2 companions' types decide your combo. Press C or the Combo button when it charges.</p>
      <ul class="plain">${Object.entries(COMBOS).map(([k,c])=>`<li><b>${c.name}</b> (${k.split('+').map(t=>TYPES[t].name).join(' + ')}): ${c.desc}</li>`).join('')}<li><b>Twin Fury</b> (same type): both attack twice as fast for 5s.</li><li><b>Pack Rally</b> (any other pair): both attack 60% faster for 5s.</li></ul></section></div>`;
  }else{
    body=`<section class="card journal"><article class="page"><h3>The Bloom</h3>${LORE_INTRO.map(p=>`<p>${p}</p>`).join('')}</article></section>`;
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
  const o=S.opts;
  const seg=(k,vals,label)=>`<div class="field"><span>${label}</span><div class="seg">${vals.map(([v,l])=>`<button class="tab" aria-selected="${o[k]===v}" data-act="opt" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  const tg=(k,l,d)=>`<label class="toggle"><input type="checkbox" id="opt-${k}" data-act="optc" data-k="${k}" ${o[k]?'checked':''}> <span><b style="font-family:var(--display)">${l}</b><br><small class="status">${d}</small></span></label>`;
  const sl=(k,l)=>`<label class="field">${l} <small class="status" id="v-${k}">${Math.round(o[k]*100)}%</small><input id="opt-${k}" type="range" min="0" max="1" step="0.05" value="${o[k]}" data-act="optr" data-k="${k}"></label>`;
  return`<div class="cols"><section class="card"><h2>Keeper</h2>
    <label class="field">Your name, for the maker’s mark<input id="keeper-name" type="text" maxlength="24" value="${esc(S.keeperName||'')}" placeholder="the Keeper" data-act="keepername"></label>
    <p class="status">Everything you craft at Superior quality or better carries your name and its foreman’s, like “Masterwork Ember Carbine, made by ${esc(S.keeperName||'the Keeper')} with Pyrrovex”.</p></section>
  <section class="card"><h2>Touch controls</h2>
    ${seg('stick',[['fixed','Fixed'],['float','Floating']],'Joysticks')}
    <p class="status">Fixed sticks stay in the bottom corners. Floating sticks appear wherever your thumb lands.</p>
    ${seg('stickSize',[['S','Small'],['M','Medium'],['L','Large']],'Joystick size')}
    ${seg('btnSize',[['S','Small'],['M','Medium'],['L','Large']],'Button size')}
    ${seg('hand',[['right','Right-handed'],['left','Left-handed']],'Layout')}
    ${tg('autoFire','Fire while aiming','Pushing the aim stick also fires. Turn off to fire only past half tilt.')}
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
  <section class="card"><h2>Story and help</h2>
    <div class="row"><button class="btn" data-act="tutorial">Replay the tutorial</button><button class="btn" data-act="intro">Read the opening story</button></div></section></div></div>`;
}

/* ---------- modals ---------- */
function openModal(html){$('#modal').hidden=false;$('#modalBox').innerHTML=html;paintSprites($('#modalBox'))}
function closeModal(){$('#modal').hidden=true}
function openChooser(slot){
  const cur=S.loadout.slots[slot];
  const list=S.creatures.filter(c=>c.id!==cur&&!expAway(c)).sort((a,b)=>b.level-a.level);
  const items=list.map(c=>{const w=whereIs(c);const note=w.kind==='section'?`Leaves the ${SECTIONS[w.key].name}`:w.kind==='loadout'?`Moves from slot ${w.slot+1}`:'';const st=stats(c);
    return`<button class="choice" data-act="pickslot" data-slot="${slot}" data-id="${c.id}">${spr(c,44)}<span style="min-width:0;flex:1"><span class="nm">${esc(c.name)} · ${sexSym(c.sex)} ${esc(formName(c))} Lv ${c.level} ${'★'.repeat(st.star)}</span><small>${c.hp}/${st.hp} HP · ${slot===2?'Passive: '+supportText(c):ABILITIES[st.abilId].name+' · '+ATTACKS[st.atkId].name}${c.proven?'':' · Unproven'}</small>${note?`<small style="color:var(--gold)">${note}</small>`:''}</span></button>`}).join('');
  openModal(`<h2>${slot===2?'Slot 3: support or free':'Combat slot '+(slot+1)}</h2>
    ${slot===2?'<p class="hint">A support creature gives its passive but stays out of the fight until you swap it into slot 1 or 2. Leave the slot free if you plan to cage something.</p>':''}
    <div class="choose-list">${slot===2?'<button class="choice" data-act="clearslot" data-slot="2"><span class="nm">Leave free for a capture</span></button>':''}${items||'<p class="empty">No other creatures.</p>'}</div>
    <div class="row"><button class="btn" data-act="close">Cancel</button></div>`);
}
function openNpc(id){
  const n=NPCS[id],st=S.npc[id];if(!st)return;
  let line;if(!st.met){line=n.intro;st.met=true;save()}else line=fxPick(n.idle);
  const p=npcQuest(id);
  const quest=p?`<div class="slot"><div class="slot-label">Quest ${st.q+1} of ${n.quests.length}</div><p>${p.q.text}</p>
    <div class="bar"><i style="width:${p.v/p.q.n*100}%;background:var(--gold)"></i></div><p class="status">${p.v}/${p.q.n} · Reward: ${questRewardText(p.q.reward)}</p>
    ${p.done?`<button class="btn primary" data-act="turnin" data-k="${id}">Turn in</button>`:''}</div>`:`<p class="status">${n.outro}</p>`;
  openModal(`<div class="row" style="gap:12px;flex-wrap:nowrap"><canvas class="spr" width="72" height="72" data-npc="${id}"></canvas><div><h2>${n.name}</h2><p class="status">${n.role} · ${SECTIONS[n.home].name}</p></div></div>
    <blockquote class="say">${line}</blockquote>${quest}<div class="row"><button class="btn" data-act="close">Goodbye</button></div>`);
  renderTabs();
}
function questRewardText(r){const o=[];if(r.coin)o.push(r.coin+' coin');if(r.ore)o.push(r.ore+' ore');if(r.cage)o.push(r.cage+' cages');if(r.gilded)o.push(r.gilded+' gilded cages');if(r.shard)o.push(r.shard+' shard'+(r.shard>1?'s':''));if(r.blueprint)o.push(GUNS[r.blueprint].name+' blueprint');if(r.weapon)o.push(GUNS[r.weapon].name);if(r.egg)o.push('a mysterious egg');return o.join(', ')}
function openIntro(first){
  openModal(`<h2 class="res-title">The Bloom</h2>${LORE_INTRO.map(p=>`<p>${p}</p>`).join('')}
    <div class="row">${first?'<button class="btn primary" data-act="tutorial">Play the tutorial</button><button class="btn" data-act="close">Skip to the hideout</button>':'<button class="btn primary" data-act="close">Close</button>'}</div>`);
}

/* ================= Actions ================= */
// Exchange actions are async: re-render when the market answers, and explain a refusal.
function mkDone(p){Promise.resolve(p).then(res=>{if(res&&res.ok===false&&res.why)openModal(`<h2>Not this time</h2><p>${esc(res.why)}</p><div class="row"><button class="btn primary" data-act="close">OK</button></div>`);renderAll()})}
onMarket(()=>{if(!S)return;renderHeader();if(ui.tab==='exchange'&&!document.activeElement?.matches?.('input'))renderMain()});
bindCharts(document);
function act(a,d){
  switch(a){
    case'tab':ui.tab=d.k;ui.sellId=null;ui.resetArm=false;ui.scrapArm=null;renderAll();window.scrollTo(0,0);break;
    case'filter':ui.filter=d.k;renderMain();break;
    case'section':ui.section=d.k;HMAP.sel=d.k;if($('#secPanel'))renderSecPanel();else renderMain();break;
    case'codex':ui.codex=d.k;renderMain();break;
    case'dextype':ui.dexType=d.k;renderMain();break;
    case'close':closeModal();break;
    case'npc':openNpc(d.k);break;
    case'turnin':{const got=npcTurnIn(d.k);if(got){sfx('quest');save();renderAll();const n=NPCS[d.k];openModal(`<div class="row" style="gap:12px;flex-wrap:nowrap"><canvas class="spr" width="72" height="72" data-npc="${d.k}"></canvas><h2>${n.name}</h2></div><blockquote class="say">${n.quests[S.npc[d.k].q-1].done}</blockquote><p class="status">Received ${got}.</p><div class="row"><button class="btn primary" data-act="npc" data-k="${d.k}">Continue</button><button class="btn" data-act="close">Close</button></div>`)}break}
    case'claim':{const m=DEX_MILES[S.dex.claimed];if(m&&dexScore()>=m.n){const got=giveReward(m.reward);S.dex.claimed++;addLog(`Codex milestone ${m.n}: received ${got}.`);sfx('quest');save();renderAll()}break}
    case'research':if(buyResearch(d.k)){sfx('level');save();renderAll()}break;
    case'evolve':{const c=byId(+d.id);const old=evolve(c);if(old){sfx('evolve');save();renderAll();
      openModal(`<h2 class="res-title win">${esc(c.name)} evolved!</h2><div class="row" style="justify-content:center;gap:10px">${sprSp(c.species,c.stage-1,80)}<b style="font-family:var(--display);font-size:1.6rem">›</b>${sprSp(c.species,c.stage,96)}</div>
        <p style="text-align:center">${esc(old)} became <b style="color:var(--gold)">${esc(formName(c))}</b>.</p><p class="status" style="text-align:center">New attack: ${ATTACKS[formOf(c).atk].name}. Ability: ${ABILITIES[formOf(c).abil].name}.</p><div class="row" style="justify-content:center"><button class="btn primary" data-act="close">Wonderful</button></div>`)}break}
    case'choose':openChooser(+d.slot);break;
    case'pickslot':{const c=byId(+d.id);unplace(c);S.loadout.slots[+d.slot]=c.id;closeModal();save();renderAll();break}
    case'clearslot':S.loadout.slots[+d.slot]=null;closeModal();save();renderAll();break;
    case'deploy':if(overCap()){renderAll();break}startRaid('raid');break;
    case'make':{const got=craft(d.k);if(got){addLog(`Workshop: made ${got}.`);sfx('heavy');save();renderAll()}break}
    case'forge':case'forgeprint':{const id=a==='forge'?d.k:S.prints[+d.i];const it=craftWeapon(id,a==='forgeprint'?+d.i:null);if(it){addLog(`The Forge made a ${itemName(it)}. ${makerText(it)}.`);sfx('heavy');save();renderAll()}break}
    case'repair':if(repair(+d.uid)){sfx('heavy');save();renderAll()}break;
    case'scrapitem':{const it=itemByUid(+d.uid);if(!it||it.kind!=='gun')break;if(ui.scrapArm!==it.uid){ui.scrapArm=it.uid;renderMain();break}ui.scrapArm=null;
      const ore=Math.round(SCRAP_ORE[GUNS[it.id].tier]*(secTier('forge')>=3?1.5:1));scrapItem(it);S.ore+=ore;S.blueprints[it.id]=1;bump('scrapped');validGuns();addLog(`Scrapped a ${itemName(it)} for ${ore} ore.`);sfx('heavy');save();renderAll();break}
    case'donateitem':{const it=itemByUid(+d.uid);if(!it||it.kind!=='gun'||!sectionUnlockedArmory())break;const before=armoryTier(),pts=DONATE_PTS[GUNS[it.id].tier];scrapItem(it);S.armory+=pts;S.blueprints[it.id]=1;validGuns();
      addLog(`Donated a ${itemName(it)} to the Armory (+${pts} pts).${armoryTier()>before?' Armory tier '+armoryTier()+' reached: '+ARMORY_TIERS[armoryTier()-1]+'.':''}`);save();renderAll();break}
    case'buildpen':if(buildPen()){sfx('level');save();renderAll()}break;
    case'expgo':{const ids=ui.exp.team.map(Number);if(startExpedition(ui.exp.dest,ids)){ui.exp={dest:'',team:['','','']};sfx('ui');save();renderAll()}break}
    case'scav':startRaid('scav');break;
    case'arena':startRaid('arena');break;
    case'tutorial':closeModal();startRaid('tutorial');break;
    case'intro':openIntro(false);break;
    case'wait':processDay();save();renderAll();marketDay().then(()=>renderAll());break;
    case'assign':{const sel=$('#addsel');if(!sel)break;const c=byId(+sel.value);if(!c||S.sections[d.k].ids.length>=secCap(d.k))break;unplace(c);S.sections[d.k].ids.push(c.id);save();renderAll();break}
    case'unassign':{const c=byId(+d.id);if(c){unplace(c);save();renderAll()}break}
    case'expand':{const ec=expandCost(d.k);if(S.coin<ec.coin||S.ore<ec.ore||S.sections[d.k].cap>=10)break;S.coin-=ec.coin;S.ore-=ec.ore;S.sections[d.k].cap++;save();renderAll();break}
    case'genelab':{const c=byId(+ui.gl.id);if(!c)break;const g=ui.gl.gene,pair=c.genome[g],w=pair[0]<=pair[1]?0:1,v=pair[w],cc={coin:20*(v+1),ore:2*(v+1)};if(v>=10||S.coin<cc.coin||S.ore<cc.ore)break;
      S.coin-=cc.coin;S.ore-=cc.ore;pair[w]=v+1;express(c);addLog(`Gene Lab: ${c.name}'s weaker ${GENES[g]} copy rose to ${v+1}.`);sfx('level');save();renderAll();break}
    case'tutor':{const c=byId(+ui.tt.id);if(!c||S.coin<60||S.ore<8)break;S.coin-=60;S.ore-=8;const k=ui.tt.slot,old=expressTrait(c.genome[k]);const nt=rollTraits(1,c.traits,true)[0];c.genome[k]=[nt,nt];express(c);
      addLog(`Trait Tutor: ${c.name} ${old?`swapped ${TRAITS[old].name} for`:'learned'} ${TRAITS[nt].name}.`);save();renderAll();break}
    case'tree':{const c=byId(+d.id);if(c)openModal(treeHtml(c));break}
    case'lab-sim':{runSim(ui.sim);renderMain();break}
    case'lab-supply':{runSupply(1);renderMain();break}
    case'lab-eco':{runEconomy({...ui.eco,days:+d.k});renderMain();break}
    case'mktab':ui.mk.tab=d.k;renderMain();break;
    case'mkgood':ui.mk.good=ui.mk.good===d.k?null:d.k;ui.mk.price='';renderMain();break;
    case'mktrade':ui.tab='exchange';ui.mk.tab='goods';ui.mk.good=d.k;renderAll();break;
    case'mkcat':ui.mk.cat=d.k;renderMain();break;
    case'mkbuy':case'mksell':{const b=marketView().books[d.k],q=Math.max(1,+ui.mk.qty||1);
      const p=a==='mkbuy'?buyNow(d.k,q,Math.ceil(b.asks[0].price*1.1*100)/100):sellNow(d.k,q,Math.floor(b.bids[0].price*.9*100)/100);mkDone(p);break}
    case'mkpost':mkDone(postOrder(d.k,d.side,Math.max(.1,+ui.mk.price||marketView().books[d.k].last),Math.max(1,+ui.mk.qty||1)));break;
    case'mkcancel':mkDone(cancelOrder(+d.id));break;
    case'mkbid':mkDone(bid(+d.id,+d.min));break;
    case'mkbuyout':mkDone(buyout(+d.id));break;
    case'mklist':{const ref=$('#mk-listref').value,start=Math.max(1,+$('#mk-start').value||1),bo=+$('#mk-buyout').value||null;mkDone(listItem(d.k,d.k==='print'?ref:+ref,start,bo&&bo>start?bo:null));break}
    case'mkbounty':{const sel=$('#bounty-'+d.id);if(sel)mkDone(fulfilBounty(+d.id,+sel.value));break}
    case'feed':{const c=byId(+d.id);if(S.food<1)break;S.food--;addBond(c,10);c.hp=Math.min(stats(c).hp,c.hp+Math.round(stats(c).hp*.2));sfx('pickup');save();renderAll();break}
    case'sell':{const c=byId(+d.id);if(!c||expAway(c))break;if(ui.sellId!==c.id){ui.sellId=c.id;renderMain();break}
      S.coin+=sellValue(c);unplace(c);S.creatures=S.creatures.filter(x=>x!==c);ui.sellId=null;addLog(`Sold ${c.name} for ${sellValue(c)} coin.`);sfx('coin');save();renderAll();break}
    case'breed':breed();break;
    case'opt':S.opts[d.k]=d.v;save();renderMain();break;
    case'lab-spawn':{const L=ui.lab;const lv=clamp(+L.level||1,1,40);
      let traits=null;if(L.t1||L.t2||L.t3){traits=[L.t1,L.t2,L.t3].map(t=>t||null)}
      const c=makeCreature(L.species,L.origin,lv,{proven:L.proven,sex:L.sex==='R'?null:L.sex,traits,genes:L.max?Object.fromEntries(GRADE_LOCI.map(k=>[k,10])):undefined,captureRaid:L.origin==='wild'&&!L.proven?S.stats.raids:-1});
      S.creatures.push(c);dexForm(c.species,0,'owned');addLog(`Test Lab: added ${c.name}, a ${sexSym(c.sex)} ${L.origin} ${SPECIES[c.species].name} at Lv ${lv}.`);save();renderAll();break}
    case'lab-squad':{for(let i=0;i<10;i++){const sp=pick(BASE_SPECIES);const c=makeCreature(sp,'bred',10);S.creatures.push(c);dexForm(sp,0,'owned')}addLog('Test Lab: added 10 Lv 10 creatures.');save();renderAll();break}
    case'lab-evoready':S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{const n=nextForm(c);if(!n)return;c.level=Math.max(c.level,n.lv);c.proven=true;if(n.need)c.genes[n.need[0]]=Math.max(c.genes[n.need[0]],n.need[1]);c.hp=stats(c).hp});S.coin+=600;S.ore+=60;S.shards+=2;save();renderAll();break;
    case'lab-evomax':S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{const L=lineOf(c);c.stage=L.length-1;c.level=Math.max(c.level,L[L.length-1].lv);c.proven=true;for(let i=0;i<=c.stage;i++)dexForm(c.species,i,'owned');c.hp=stats(c).hp});save();renderAll();break;
    case'lab-bond':S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{c.bondXp=BOND_TH[4];c.hp=stats(c).hp});save();renderAll();break;
    case'lab-floor':startRaid('raid',+d.k);break;
    case'lab-res':{const k=d.k;if(k==='coin')S.coin+=500;if(k==='food')S.food+=50;if(k==='ore')S.ore+=50;if(k==='shard')S.shards+=5;if(k==='cage')S.cages.basic+=5;
      if(k==='guns')GUN_IDS.forEach(g=>{if(g!=='pistol'&&!S.items.some(i=>i.kind==='gun'&&i.id===g))newItem('gun',g,1,{src:'legacy'})});
      if(k==='mats')Object.keys(JOBS.MATERIALS).forEach(m=>give(m,30));if(k==='bp')GUN_IDS.forEach(g=>S.blueprints[g]=1);
      if(k==='keeper')addKeeperXp(keeperNeed()-S.keeper.xp);
      if(k==='dex'){for(const sp in LINES)LINES[sp].forEach((f,i)=>dexForm(sp,i,'seen'));FOE_IDS.forEach(f=>dexFoe(f,true));BOSS_IDS.forEach(b=>{S.progress.bosses[b]=S.progress.bosses[b]||1})}
      save();renderAll();break}
    case'lab-heal':S.creatures.forEach(c=>c.hp=stats(c).hp);save();renderAll();break;
    case'lab-prove':S.creatures.forEach(c=>c.proven=true);save();renderAll();break;
    case'lab-xp':S.loadout.slots.map(byId).filter(Boolean).forEach(c=>{c.level=Math.min(40,c.level+5);c.hp=stats(c).hp});save();renderAll();break;
    case'lab-hatch':{const n=S.eggs.length;S.eggs.forEach(hatchEgg);S.eggs=[];if(n)addLog(`Test Lab: hatched ${n} egg${n>1?'s':''}.`);save();renderAll();break}
    case'reset':if(!ui.resetArm){ui.resetArm=true;renderMain();break}ui.resetArm=false;newGame();save();startMarket();ui.tab='raid';renderAll();openIntro(true);break;
  }
}
document.addEventListener('click',e=>{
  if(e.target.id==='modal'){closeModal();return}
  const b=e.target.closest('[data-act]');if(!b||b.tagName==='SELECT'||b.tagName==='INPUT'||b.disabled)return;
  if(b.closest('#raid'))return;
  if(b.dataset.act!=='tab')sfx('ui');
  act(b.dataset.act,b.dataset);
});
document.addEventListener('change',e=>{
  const el=e.target,a=el.dataset.act;if(!a)return;
  if(a==='gunsel'){S.loadout.guns[+el.dataset.slot]=el.value?+el.value:null;validGuns();save();renderMain()}
  else if(a==='keepername'){S.keeperName=el.value.trim().slice(0,24);save()}
  else if(a==='satchelsel'){S.loadout.satchel=el.value?+el.value:null;validGuns();save();renderMain()}
  else if(a==='tonicsel'){S.loadout.tonics=+el.value||0;validGuns();save();renderMain()}
  else if(a==='expsel'){ui.exp.team[+el.dataset.i]=el.value;renderSecPanel()}
  else if(a==='expdest'){ui.exp.dest=el.dataset.k;renderSecPanel()}
  else if(a==='mom'){ui.mom=el.value;renderMain()}
  else if(a==='dad'){ui.dad=el.value;renderMain()}
  else if(a==='glc'){ui.gl.id=el.value;renderSecPanel()}
  else if(a==='glg'){ui.gl.gene=el.value;renderSecPanel()}
  else if(a==='ttc'){ui.tt.id=el.value;ui.tt.slot='0';renderSecPanel()}
  else if(a==='tts'){ui.tt.slot=el.value}
  else if(a==='lab'){const k=el.dataset.k;ui.lab[k]=el.type==='checkbox'?el.checked:el.value}
  else if(a==='eco'){ui.eco[el.dataset.k]=el.type==='number'?+el.value:el.value}
  else if(a==='mkqty'){ui.mk.qty=Math.max(1,+el.value||1);renderMain()}
  else if(a==='mkprice'){ui.mk.price=el.value;renderMain()}
  else if(a==='mklistkind'){ui.mk.listKind=el.value;ui.mk.listRef='';renderMain()}
  else if(a==='mklistref'){ui.mk.listRef=el.value;renderMain()}
  else if(a==='sim'){ui.sim[el.dataset.k]=Math.max(+el.min||0,Math.min(+el.max||1e9,+el.value||0))}
  else if(a==='setting'){S.settings[el.dataset.k]=el.checked;save();if(el.dataset.k==='genes')renderMain()}
  else if(a==='mode'){S.modes[el.dataset.k]=el.checked;save()}
  else if(a==='optc'){S.opts[el.dataset.k]=el.checked;save();auVol()}
  else if(a==='opthud'){S.opts.hudAlpha=+el.value;save()}
});
document.addEventListener('input',e=>{const el=e.target;if(el.dataset.act==='optr'){S.opts[el.dataset.k]=+el.value;const v=$('#v-'+el.dataset.k);if(v)v.textContent=Math.round(el.value*100)+'%';auVol();save()}});

export {TABS,renderAll,renderHeader,renderTabs,renderMain,hpBar,statusText,validGuns,weaponLine,tierTag,persChip,viewRaid,meterHtml,viewHideout,renderSecPanel,logView,sectionDetail,creCard,viewRoster,viewBreeding,viewResearch,viewArmory,journalNew,milestoneReady,viewCodex,rewardText,viewLab,viewSettings,openModal,closeModal,openChooser,openNpc,questRewardText,openIntro,act};
