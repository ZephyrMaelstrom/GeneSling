/* ================= Bloom panels (Phase 5) =================
   The contract board and vein map picker on the Raid tab, vein map recipes in the Workshop,
   the veins in the Codex, and the Test Lab's vein jumps and variety check. */
import {esc} from './util.js';
import {BLOOM as B,TYPES,BLOOM} from './content.js';
import {secTier,S,ui} from './state.js';
import {costText,amt} from './jobs.js';
import {bloomState,contractOffers,loadoutMap,mapBlock,mapName,rewardText,craftMap,dropContract,takeContract,varietyRun} from './bloom.js';
import {onAct,onChange} from './actions.js';
import {renderAll,renderMain} from './ui.js';
import {save} from './save.js';
import {sfx} from './audio.js';
import {startRaid} from './raid.js';

function contractBoard(){
  const c=bloomState().contracts,act=c.active,offers=contractOffers();
  const rows=offers.map((o,i)=>`<div class="invrow"><span style="flex:1;min-width:0"><b>${B.CONTRACTS.list[o.kind].name}</b> · ${esc(o.text)}<br><small class="status">Pays ${rewardText(o.reward)}</small></span>
    <button class="btn small ${act&&act.text===o.text?'primary':''}" data-act="contract" data-i="${i}" ${act&&act.text===o.text?'disabled':''}>${act&&act.text===o.text?'Taken':'Take'}</button></div>`).join('');
  return`<h3>Contracts</h3><p class="hint">Optional goals for your next raid, three new ones each day. One at a time; it pays if you extract with it done, and lapses if you fall.</p>
    ${act?`<div class="combo special"><b>Active: ${B.CONTRACTS.list[act.kind].name}</b><span>${esc(act.text)} Pays ${rewardText(act.reward)}.</span><div class="row"><button class="btn small" data-act="contractdrop">Drop it</button></div></div>`:''}
    ${rows}<p class="status">${c.done||0} contracts completed.</p>`;
}
function mapPicker(){
  const maps=bloomState().maps,cur=loadoutMap();
  return`<h3>Vein map</h3>${maps.length?`<p class="hint">A map is used up when you reach its vein. Without one, the veins play as they are.</p>
    <select data-act="mapsel" aria-label="Vein map for the next raid"><option value="">No map</option>${maps.map(m=>`<option value="${m.id}" ${cur&&cur.id===m.id?'selected':''}>${esc(mapName(m))}</option>`).join('')}</select>`
    :`<p class="status">No vein maps. The Roost draws them in the Workshop.</p>`}`;
}
function mapRecipes(ui){
  const K=B.MAPS.kinds,vein=ui.mapVein||B.VEIN_ORDER[0];
  const veinSel=`<select data-act="mapvein" aria-label="Vein">${B.VEIN_ORDER.map(v=>`<option value="${v}" ${v===vein?'selected':''}>${B.VEINS[v].name}</option>`).join('')}</select>`;
  return`<h3>Vein maps · the Roost</h3><p class="hint">Maps are used up when you raid their vein. Explorers sell them on to breeders hunting one species.${secTier('roost')<B.MAPS.needRoost?` The Roost needs to reach tier ${B.MAPS.needRoost} first.`:''}</p>
    <div class="row">${veinSel}</div><div class="recipes">${Object.entries(K).map(([k,M])=>{const why=mapBlock(k);
      return`<div class="recipe"><b>${M.name}</b><small>${esc(M.desc)}</small><small>${Object.entries(M.cost).map(([m,n])=>`<span class="${amt(m)>=n?'':'short'}">${costText({[m]:n})}</span>`).join(' · ')}</small>
      <button class="btn small" data-act="makemap" data-k="${k}" ${why?'disabled':''}>${why||'Draw'}</button></div>`}).join('')}</div>
    ${bloomState().maps.length?`<p class="status">In stores: ${bloomState().maps.map(m=>esc(mapName(m))).join(', ')}</p>`:''}`;
}
// The veins in the Codex.
function veinCodex(){
  return`<div class="grid">${['rootworks',...B.VEIN_ORDER].map(v=>{const V=B.VEINS[v];
    return`<section class="card"><h3 style="color:${V.col}">${V.name}</h3><p>${V.blurb}</p>${V.key?`<p class="status">Key: a ${TYPES[V.key].name} in your party.</p>`:''}</section>`}).join('')}</div>
    <h3>Floor layouts</h3><ul class="plain">${Object.values(B.LAYOUTS).map(L=>`<li><b>${L.name}</b>: ${L.desc}</li>`).join('')}</ul>
    <h3>Events</h3><ul class="plain">${Object.values(B.EVENTS.list).map(E=>`<li><b>${E.name}</b>: ${E.desc}</li>`).join('')}</ul>`;
}
function labBloom(ui){
  const r=ui.variety;
  return`<h3>Veins</h3><p class="hint">Jump straight to Floor 4 of a vein (the key type isn't checked here).</p>
    <div class="row">${B.VEIN_ORDER.map(v=>`<button class="btn small" data-act="lab-vein" data-k="${v}">${B.VEINS[v].short}</button>`).join('')}</div>
    <h3>Variety check (Phase 5 exit test)</h3><p class="hint">Simulates 20 raids in a row the way the game picks them, with a model player choosing depth and vein, and counts repeated combinations of vein, layouts and event.</p>
    <div class="row"><button class="btn" data-act="lab-variety">Run 20 raids</button></div>
    ${r?`<p class="status">${r.repeats?`<b style="color:var(--rose)">${r.repeats} repeated</b>`:'<b style="color:var(--mint)">No repeats</b>'} in ${r.sigs.length} raids.</p><ul class="plain" style="font-size:.8rem">${r.sigs.map(s=>`<li>${esc(s)}</li>`).join('')}</ul>`:''}`;
}

/* ---------- actions ---------- */
onAct('contract',d=>{if(takeContract(+d.i)){save();renderMain()}});
onAct('contractdrop',d=>{dropContract();save();renderMain()});
onAct('makemap',d=>{if(craftMap(d.k,ui.mapVein||BLOOM.VEIN_ORDER[0])){sfx('pickup');save();renderAll()}});
onAct('lab-vein',d=>{startRaid('raid',4,null,d.k)});
onAct('lab-variety',d=>{ui.variety=varietyRun(20,Date.now()%100000);renderMain()});
onChange('mapsel',el=>{S.loadout.map=el.value?+el.value:null;save()});
onChange('mapvein',el=>{ui.mapVein=el.value;renderMain()});
export {contractBoard,mapPicker,mapRecipes,veinCodex,labBloom};
