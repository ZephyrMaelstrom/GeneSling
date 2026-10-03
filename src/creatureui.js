/* ================= Creature cards and pages =================
   Every list of creatures shows the same small card (creatureCard): sprite, name, level, form, types,
   sex, one status line and at most one flag. Tapping a card opens the creature's own page
   (creaturePage), which takes over the main view beside the tab rail until Back:

     identity column   big sprite, name (tap to rename), form, types, level and XP, HP, bond, where it
                       is, and its most useful buttons
     Overview          stats with what makes them up, attack and ability, raid role, titles, evolution line
     Genes             the genome, as far as the player's tools can read it, and the family tree
     Work              what it would make at every station, fatigue, chemistry with the crew, expeditions
     Story             the codex entry for its form, then its own history (history.js)
     Actions           evolve, feed, party, station, breed, share, serums, sell, retire

   The page shows only what the player knows: gene numbers follow the Sequencer and Gene Lens
   (geneSight), and an unproven wild catch keeps its traits secret. Prev and next (or a swipe, or the
   arrow keys) step through the list the page was opened from. Inside a raid, the ⚙ Creatures tab
   shows a compact, read-only page (compactPage). */
import {$,esc,clamp} from './util.js';
import {ABILITIES,ATTACKS,BOND_PASSIVE,BOND_TH,GENES,JOBS as J,PERS,SECTIONS,SECTION_IDS,SPECIES,TRAITS,TYPES} from './content.js';
import {S,ui,byId,whereIs,unplace,stats,statParts,formName,lineOf,nextForm,canEvolve,evolveCost,xpNeed,sellValue,sectionUnlocked,secCap,secContribution,secTier,sexSym,supportText,bondStar} from './state.js';
import {spr,typeChips,sexChip,stars,paintSprites} from './sprites.js';
import {amt,serumLocus,fatigueMul,workUnit,crewMods,members,foremanOf,teamScale,roleInfo,expAway} from './jobs.js';
import {gradeStars} from './genetics.js';
import {geneSight,genomeBlock,lineageChips} from './geneui.js';
import {titleChips,bredBy} from './prideui.js';
import {ribbonChips} from './endgameui.js';
import {formLore} from './lore.js';
import {retireBlock} from './hideout.js';
import {history} from './history.js';
import {save} from './save.js';
import {renderAll,renderMain,statusText,closeModal} from './ui.js';
import {onAct,onChange,act} from './actions.js';

/* ---------- the card ---------- */
// Where it is, in a few words, with days left when it's away.
function whereLine(c){
  const w=whereIs(c);
  if(w.kind==='expedition'){const e=S.expeditions.find(x=>x.team.includes(c.id));return`Away: ${J.EXPEDITIONS[w.dest].name}${e?`, back in ${e.days} day${e.days===1?'':'s'}`:''}`}
  if(w.kind==='section')return SECTIONS[w.key].name;
  if(w.kind==='loadout')return w.slot<2?`Combat slot ${w.slot+1}`:'Slot 3';
  return'Resting';
}
// The one flag a card shows, most urgent first.
function cardFlag(c){
  const st=stats(c);
  if(canEvolve(c))return['go','Can evolve'];
  if(c.hp<st.hp)return['hurt',`Hurt ${Math.round(c.hp/st.hp*100)}%`];
  if((c.fat||0)>=60)return['warn','Tired'];
  if(!c.proven)return['warn','Unproven'];
  const first=(c.log||[])[0];if(first&&first[1]==='caught'&&first[0]>=S.day-1)return['new','New'];
  return null;
}
// opts.act / opts.data: what tapping does (default: open the page); opts.list: the list the page steps through;
// opts.ctx: one line of context under the card (e.g. what it would make at a station).
function creatureCard(c,opts={}){
  const st=stats(c),f=cardFlag(c),act=opts.act||'creature',data=Object.entries(opts.data||{}).map(([k,v])=>` data-${k}="${esc(String(v))}"`).join('');
  return`<button class="ccard${f?' f-'+f[0]:''}" data-act="${act}" data-id="${c.id}"${opts.list?` data-list="${esc(opts.list)}"`:''}${data} aria-label="${esc(c.name)}, ${esc(formName(c))}, level ${c.level}">
    ${spr(c,48)}<span class="cc-main"><span class="cc-name">${esc(c.name)} <small>${sexSym(c.sex)}</small> <b>Lv ${c.level}</b></span>
    <span class="cc-form">${esc(formName(c))}</span><span class="cc-types">${typeChips(c)}</span>
    <span class="cc-where">${esc(whereLine(c))}</span>${f?`<span class="cc-flag ${f[0]}">${f[1]}</span>`:''}
    ${c.hp<st.hp?`<span class="bar hp ${c.hp/st.hp<.35?'low':''}"><i style="width:${clamp(c.hp/st.hp,0,1)*100}%"></i></span>`:''}
    ${opts.ctx?`<span class="cc-ctx">${opts.ctx}</span>`:''}</span></button>`;
}

/* ---------- which creatures a page steps through ---------- */
const ROSTER_FILTERS={all:()=>true,evolve:canEvolve,wild:c=>c.origin==='wild',bred:c=>c.origin==='bred',unproven:c=>!c.proven,f:c=>c.sex==='F',m:c=>c.sex==='M',hybrid:c=>!!c.type2,idle:c=>whereIs(c).kind==='idle'};
function rosterList(){
  const f=ROSTER_FILTERS[ui.filter]||ROSTER_FILTERS.all;
  return S.creatures.filter(f).sort((a,b)=>b.level-a.level||(TYPES[b.type].tier||0)-(TYPES[a.type].tier||0)||a.id-b.id);
}
function listIds(key,id){
  if(key==='roster')return rosterList().map(c=>c.id);
  if(key&&key.startsWith('station:'))return S.sections[key.slice(8)].ids.slice();
  if(key==='party')return S.loadout.slots.filter(Boolean);
  return[id];
}

/* ---------- opening and closing ---------- */
function openCreature(id,list){
  const c=byId(+id);if(!c)return;
  if(ui.creature==null)ui.creatureFrom={scroll:window.scrollY};
  ui.creature=c.id;ui.creatureList=listIds(list,c.id);if(!ui.creatureList.includes(c.id))ui.creatureList=[c.id];
  ui.creatureTab=ui.creatureTab||'overview';ui.creatureArm=null;
  if(!$('#modal').hidden)closeModal();
  renderMain();window.scrollTo(0,0);
}
function closeCreature(){
  const from=ui.creatureFrom;ui.creature=null;ui.creatureArm=null;renderAll();
  if(from)window.scrollTo(0,from.scroll||0);
}
function step(d){
  const L=(ui.creatureList||[]).filter(id=>byId(id));if(!L.length)return;
  const i=L.indexOf(ui.creature);ui.creature=L[(i+d+L.length)%L.length];ui.creatureArm=null;renderMain();
}
// The page's creature, or null (and the route cleared) if it's gone: sold, retired or lost.
function pageCreature(){const c=ui.creature!=null?byId(ui.creature):null;if(!c&&ui.creature!=null)ui.creature=null;return c}

/* ---------- the page ---------- */
const TABS=[['overview','Overview'],['genes','Genes'],['work','Work'],['story','Story'],['actions','Actions']];
function creaturePage(c){
  const L=(ui.creatureList||[c.id]).filter(id=>byId(id)),i=L.indexOf(c.id),t=ui.creatureTab||'overview';
  return`<section class="cpage" id="cpage" data-id="${c.id}">
    <div class="cp-top"><button class="btn small" data-act="cback">‹ Back</button>
      ${L.length>1?`<span class="cp-nav"><button class="btn small" data-act="cstep" data-d="-1" aria-label="Previous creature">‹</button><span class="status">${i+1} of ${L.length}</span><button class="btn small" data-act="cstep" data-d="1" aria-label="Next creature">›</button></span>`:''}</div>
    <div class="cp-cols">${identity(c)}
      <div class="cp-main"><div class="filters cp-tabs" role="tablist">${TABS.map(([k,l])=>`<button class="tab" role="tab" aria-selected="${t===k}" data-act="ctab" data-k="${k}">${l}</button>`).join('')}</div>
      <div id="cp-body">${tabBody(c,t)}</div></div></div></section>`;
}
function identity(c){
  const st=stats(c),bs=bondStar(c),nb=BOND_TH[bs],nf=nextForm(c);
  const ev=nf?evolveButton(c):'';
  return`<aside class="cp-id"><div class="cp-head">${spr(c,72)}<div class="cp-headtext">
    <label class="cp-rename"><span class="sr">Name</span><input type="text" value="${esc(c.name)}" maxlength="16" data-act="crename" aria-label="Name"></label>
    <div class="status">${esc(formName(c))}</div><div>${sexChip(c)} ${typeChips(c)}</div></div></div>
    <div class="status">Lv ${c.level} · XP ${c.xp}/${xpNeed(c)}</div><div class="bar" title="XP"><i style="width:${c.xp/xpNeed(c)*100}%;background:var(--sky)"></i></div>
    <div class="status">HP ${c.hp}/${st.hp}</div><div class="bar hp ${c.hp/st.hp<.35?'low':''}"><i style="width:${clamp(c.hp/st.hp,0,1)*100}%"></i></div>
    <div class="status">${stars(bs)} ${nb!=null?`${c.bondXp||0}/${nb}`:'max bond'}</div>
    <div class="status cp-where">${esc(statusText(c))}</div>
    <div class="row">${ev}<button class="btn small" data-act="feed" data-id="${c.id}" ${S.food<1?'disabled':''}>Feed</button></div></aside>`;
}
function evolveButton(c){
  const nf=nextForm(c);if(!nf)return'';const ok=canEvolve(c),k=evolveCost(c),afford=S.coin>=k.coin&&S.ore>=k.ore&&S.shards>=k.shard;
  const why=!c.proven?'Must be proven first':c.level<nf.lv?`Needs Lv ${nf.lv}`:nf.need&&c.genes[nf.need[0]]<nf.need[1]?`Needs ${GENES[nf.need[0]]} ${nf.need[1]}+`:'';
  return`<button class="btn small ${ok&&afford?'primary':''}" data-act="evolve" data-id="${c.id}" ${ok&&afford?'':'disabled'} title="${ok?`${k.coin} coin, ${k.ore} ore${k.shard?', '+k.shard+' shard':''}`:esc(why)}">${ok?`Evolve: ${k.coin}c ${k.ore} ore${k.shard?' '+k.shard+'◆':''}`:`${nf.name}: ${why}`}</button>`;
}
function tabBody(c,t){return({overview,genes,work,story,actions}[t]||overview)(c)}

/* ---------- Overview ---------- */
const STAT_LABEL={hp:'HP',atk:'Attack',spd:'Move',rate:'Rate'};
// One factor of a stat, as far as the player can see it.
function partText([label,x,src],c,sight){
  if(src==='trait'&&!c.proven)return null;
  if(src==='gene'&&sight==='stars'){const g={Vigor:'vig',Power:'pow',Swift:'swf',Tempo:'tem'}[label];return`<li><span>${label}</span><b>${'★'.repeat(gradeStars(c.genes[g]))}</b></li>`}
  return`<li><span>${esc(label)}</span><b>${x>=10?Math.round(x):'×'+(Math.round(x*100)/100)}</b></li>`;
}
function overview(c){
  const st=stats(c),P=statParts(c),sight=geneSight(),A=ABILITIES[st.abilId],K=ATTACKS[st.atkId],role=roleInfo(c),bp=BOND_PASSIVE[c.type],L=lineOf(c);
  const val={hp:st.hp,atk:st.atk,spd:st.spd,rate:'×'+st.rate};
  const statBox=k=>`<details class="cp-stat"><summary><span>${STAT_LABEL[k]}</span><b>${val[k]}</b></summary><ul class="cp-parts">${P[k].map(p=>partText(p,c,sight)).filter(Boolean).join('')}</ul></details>`;
  const chain=L.map((f,i)=>`<span class="evo ${i===(c.stage||0)?'on':i<(c.stage||0)?'done':''}">${f.name}${i?` <small>Lv ${f.lv}</small>`:''}</span>`).join('<i>›</i>');
  return`<div class="cp-grid"><div><div class="cp-stats">${['hp','atk','spd','rate'].map(statBox).join('')}</div>
      <p class="status">Tap a stat to see what makes it up.${c.proven?'':' Its traits stay unknown until it comes home from a raid.'}${c.origin==='wild'?` Obeys ${Math.round(st.obey*100)}% of the time.`:''}</p></div>
    <div><p class="status"><b class="lbl">Attack:</b> ${K.name}, ${K.desc.toLowerCase()}<br><b class="lbl">Ability:</b> ${A.name}, ${A.desc.toLowerCase()}</p>
      <p class="status"><b class="lbl">Personality:</b> ${PERS[c.pers].name}, ${esc(PERS[c.pers].desc)}</p>
      ${role?`<p class="status"><b class="lbl">Raid role:</b> ${role.name}, ${esc(role.desc)}</p>`:''}
      <p class="status"><b class="lbl">In slot 3:</b> ${esc(supportText(c))}</p>
      <p class="status"><b class="lbl">Bond ${bondStar(c)}★:</b> ${bondStar(c)>=3?`${bp.name}, ${esc(bp.desc)}`:`★3 unlocks ${bp.name}`}</p>
      <div class="row" style="gap:4px">${titleChips(c)}${ribbonChips(c)}${lineageChips(c)}</div></div></div>
    <div class="evochain">${chain}</div>`;
}

/* ---------- Genes ---------- */
function genes(c){
  return`${genomeBlock(c)}<p class="status">${c.origin==='bred'?`Generation ${c.gen||1}.`:'Caught wild.'} ${c.bred?`Bred ${c.bred} time${c.bred>1?'s':''}.`:''}</p>`;
}

/* ---------- Work ---------- */
// What it would put into station k in a day, alone, before crew chemistry and the inputs on hand.
function stationLine(c,k){
  const sec=SECTIONS[k],R=J.STATIONS[k],here=whereIs(c).kind==='section'&&whereIs(c).key===k;
  const tierMul=k==='garden'?J.WORK.gardenTier[secTier(k)]:k==='apothecary'?J.WORK.apothecaryTier[secTier(k)]:1;
  let what;
  if(R){const u=workUnit(c,k)*tierMul*(R.rate||1);what=Object.entries(R.out).map(([m,n])=>`${(u*n).toFixed(1)} ${J.MATERIALS[m]?J.MATERIALS[m].name.toLowerCase():m}`).join(', ')+' a day'}
  else what=`${secContribution(c,k).toFixed(1)} points toward the next tier`;
  const match=!sec.type?'':c.type===sec.type?' · its type':c.type2===sec.type?' · second type':' · off type';
  return`<li class="${here?'on':''}"><span><b>${sec.name}</b>${match}${here?' · works here now':''}</span><span>${what}</span></li>`;
}
function work(c){
  const w=whereIs(c),fat=Math.round(c.fat||0),rest=J.FATIGUE.rest,days=Math.ceil(fat/rest);
  let crew='';
  if(w.kind==='section'){
    const k=w.key,mods=crewMods(k),fm=foremanOf(k);
    crew=`<p class="status"><b class="lbl">In the ${SECTIONS[k].name}:</b> ${members(k).length}/${secCap(k)} workers${fm===c?' · it is the foreman (highest Focus)':''}.
      ${mods.chem.length?' Chemistry: '+mods.chem.map(x=>x.name).join(', ')+'.':''}${mods.clashes.length?` Clashes: ${mods.clashes.map(([a,b])=>`${PERS[a].name} and ${PERS[b].name}`).join(', ')}.`:''}</p>`;
  }
  const open=SECTION_IDS.filter(sectionUnlocked);
  return`<ul class="cp-work">${open.map(k=>stationLine(c,k)).join('')}</ul>
    <p class="status">Each line is this creature alone, before crew chemistry and the inputs on hand.</p>${crew}
    <p class="status"><b class="lbl">Fatigue:</b> ${fat}%${fat?`, working at ${Math.round(fatigueMul(c)*100)}%; rested in ${days} day${days===1?'':'s'} off work`:', fresh'}.</p>
    <p class="status"><b class="lbl">Expeditions:</b> sent alone it would bring home ×${teamScale([c]).toFixed(2)} of a trip's haul${expAway(c)?' (away now)':''}.</p>`;
}

/* ---------- Story ---------- */
function story(c){
  const lore=formLore(c.species,c.stage||0)||SPECIES[c.species].blurb,h=history(c);
  return`<blockquote class="say">${esc(lore)}</blockquote>
    <p class="status">${bredBy(c)} ${c.raids||0} raids · ${c.extracts||0} extracts · ${c.kills||0} defeated${c.bred?` · ${c.bred} clutch${c.bred>1?'es':''}`:''}</p>
    <ul class="log cp-log">${h.map(e=>`<li><span>Day ${e.day}</span>${esc(e.text)}</li>`).join('')||'<li>Nothing recorded yet.</li>'}</ul>`;
}

/* ---------- Actions ---------- */
function actions(c){
  const sellArmed=ui.sellId===c.id,retireArmed=ui.creatureArm==='retire',rb=retireBlock(c),away=expAway(c);
  const stations=SECTION_IDS.filter(k=>sectionUnlocked(k)&&S.sections[k].ids.length<secCap(k)&&!S.sections[k].ids.includes(c.id));
  return`<div class="cp-actions">
    <div class="row">${evolveButton(c)}<button class="btn small" data-act="feed" data-id="${c.id}" ${S.food<1?'disabled':''}>Feed (1 food)</button></div>
    <div class="row"><span class="status">Party:</span>${[0,1,2].map(i=>`<button class="btn small" data-act="cslot" data-slot="${i}" ${away||S.loadout.slots[i]===c.id?'disabled':''}>${i<2?'Combat '+(i+1):'Slot 3'}</button>`).join('')}</div>
    <div class="row"><label class="field"><span class="status">Post to</span><select data-act="cpost" aria-label="Post to a station" ${away?'disabled':''}><option value="">Choose a station</option>${stations.map(k=>`<option value="${k}">${SECTIONS[k].name} (${S.sections[k].ids.length}/${secCap(k)})</option>`).join('')}</select></label></div>
    <div class="row"><button class="btn small" data-act="cbreed" ${c.proven?'':'disabled'}>Breed ${c.sex==='F'?'her':'him'}</button><button class="btn small" data-act="sharecard" data-id="${c.id}">Share card</button>
      ${amt('serum')>0&&serumLocus(c)?`<button class="btn small" data-act="serum" data-id="${c.id}">Gene serum (${amt('serum')})</button>`:''}
      ${amt('bloomscar')>0&&c.genome.shine[0]!==2&&c.genome.shine[1]!==2?`<button class="btn small" data-act="bloomscar" data-id="${c.id}">Bloomscar serum (${amt('bloomscar')})</button>`:''}</div>
    <div class="row"><button class="btn small ${sellArmed?'danger':''}" data-act="sell" data-id="${c.id}" ${away?'disabled':''}>${sellArmed?'Confirm: sell for '+sellValue(c)+' coin':'Sell for '+sellValue(c)+' coin'}</button>
      <button class="btn small ${retireArmed?'danger':''}" data-act="cretire" ${rb?'disabled':''} title="${esc(rb||'')}">${retireArmed?'Confirm: retire to the Hall':'Retire to the Hall of Legends'}</button>${rb?`<span class="status">${esc(rb)}</span>`:''}</div></div>`;
}

/* ---------- in a raid: the compact, read-only page ---------- */
function compactPage(c,live){
  const st=stats(c),A=ABILITIES[st.abilId],K=ATTACKS[st.atkId],hp=live?live.hp:c.hp,max=live?live.maxHp:st.hp;
  return`<div class="ovcols c2 cpage-mini"><div class="ovcol"><div class="row" style="gap:8px;flex-wrap:nowrap">${spr(c,72)}<div><b>${esc(c.name)}</b><br><small class="status">${sexSym(c.sex)} ${esc(formName(c))} · Lv ${c.level}</small>
      <div>${typeChips(c)}</div></div></div><div class="bagbar"><i style="width:${clamp(hp/max,0,1)*100}%;background:var(--rose)"></i></div><span class="status">HP ${Math.round(hp)}/${max} · ${stars(bondStar(c))}</span></div>
    <div class="ovcol"><p class="status"><b class="lbl">Attack</b> ${st.atk} · <b class="lbl">Move</b> ${st.spd} · <b class="lbl">Rate</b> ×${st.rate}</p>
      <p class="status"><b class="lbl">Attack:</b> ${K.name}, ${K.desc.toLowerCase()}<br><b class="lbl">Ability:</b> ${A.name}, ${A.desc.toLowerCase()}</p>
      <p class="status"><b class="lbl">Slot 3:</b> ${esc(supportText(c))} · ${PERS[c.pers].name}${c.proven?` · ${c.traits.map(t=>TRAITS[t].name).join(', ')||'no traits'}`:' · traits unknown'}</p>
      <button class="btn small" data-p="cview" data-i="-1">Back</button></div></div>`;
}

/* ---------- actions ---------- */
onAct('creature',d=>openCreature(d.id,d.list));
onAct('cback',()=>closeCreature());
onAct('cstep',d=>step(+d.d));
// Switching tabs redraws only the tab's body.
onAct('ctab',d=>{ui.creatureTab=d.k;const c=pageCreature(),b=$('#cp-body');if(!c||!b){renderMain();return}
  b.innerHTML=tabBody(c,d.k);document.querySelectorAll('.cp-tabs .tab').forEach(x=>x.setAttribute('aria-selected',x.dataset.k===d.k));paintSprites(b)});
onChange('crename',el=>{const c=pageCreature(),n=el.value.trim().slice(0,16);if(c&&n){c.name=n;save();renderAll()}else el.value=c?c.name:''});
onAct('cslot',d=>{const c=pageCreature();if(!c)return;act('pickslot',{slot:d.slot,id:c.id})});
onChange('cpost',el=>{const c=pageCreature(),k=el.value;if(!c||!k||S.sections[k].ids.length>=secCap(k))return;
  unplace(c);S.sections[k].ids.push(c.id);save();renderAll()});
onAct('cbreed',()=>{const c=pageCreature();if(!c)return;if(c.sex==='F')ui.mom=String(c.id);else ui.dad=String(c.id);ui.creature=null;ui.tab='breeding';renderAll();window.scrollTo(0,0)});
onAct('cretire',()=>{const c=pageCreature();if(!c)return;if(ui.creatureArm!=='retire'){ui.creatureArm='retire';renderMain();return}
  ui.creatureArm=null;ui.retire=String(c.id);ui.retireArm=c.id;act('retire')});

// Arrow keys and a sideways swipe step through the list.
if(typeof document!=='undefined'){
  document.addEventListener('keydown',e=>{if(ui.creature==null||!$('#cpage')||e.target.matches('input,select,textarea'))return;if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1);if(e.key==='Escape')closeCreature()});
  let sx=null,sy=null;
  document.addEventListener('touchstart',e=>{const p=e.target.closest&&e.target.closest('#cpage');if(!p||e.touches.length!==1){sx=null;return}sx=e.touches[0].clientX;sy=e.touches[0].clientY},{passive:true});
  document.addEventListener('touchend',e=>{if(sx==null||!e.changedTouches.length)return;const dx=e.changedTouches[0].clientX-sx,dy=e.changedTouches[0].clientY-sy;sx=null;
    if(Math.abs(dx)>70&&Math.abs(dx)>2*Math.abs(dy)&&!e.target.closest('input,select,details'))step(dx<0?1:-1)},{passive:true});
}

export {creatureCard,creaturePage,compactPage,cardFlag,whereLine,rosterList,listIds,openCreature,closeCreature,pageCreature,statParts};
