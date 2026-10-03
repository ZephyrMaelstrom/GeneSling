/* ================= Pride panels =================
   The hideout's build mode, the Hall of Legends and trophies, decor recipes for the Workshop,
   and the breeder's sigil designer for Settings. The rules are in hideout.js. */
import {$,esc} from './util.js';
import {BOSSES,PRIDE as P,TYPES} from './content.js';
import {S,byId,formName,ui} from './state.js';
import {canPay,costText,matName,amt} from './jobs.js';
import {sigilSvg} from './sprites.js';
import {comfort,comfortPoints,foot,isStation,layItem,nextPlot,placeable,plotBlock,retireBlock,storable,titlesOf,trophyName,trophyStory,buyPlot,craftDecor,displayWeapon,retire,setSigil,storeItem,takeDownWeapon} from './hideout.js';
import {HMAP} from './map.js';
import {openModal,renderAll,renderMain,renderSecPanel,validGuns} from './ui.js';
import {onAct,onChange} from './actions.js';
import {openShare,shareGo} from './share.js';
import {save} from './save.js';
import {sfx} from './audio.js';

const pct=v=>`${Math.round(v*100)}%`;
const itemLabel=i=>{
  if(!i)return'';
  if(isStation(i.key))return i.key==='archive'?'Archive':(i.key[0].toUpperCase()+i.key.slice(1)).replace('Warroom','War Room');
  if(i.key==='board')return'Codex board';
  if(i.key==='trophy'){const t=S.trophies.find(x=>x.id===i.ref);return t?trophyName(t):'Trophy'}
  if(i.key==='statue'){const l=S.legends.find(x=>x.id===i.ref);return l?`Statue of ${l.name}`:'Statue'}
  return P.DECOR[i.key]?P.DECOR[i.key].name:i.key;
};

/* ---------- the map card's toolbar ---------- */
const comfortChip=()=>`<span class="chip ${comfort()>0?'good':''}" title="Comfort cuts fatigue and speeds bond, up to +${pct(P.COMFORT.cap)}">Comfort +${pct(comfort())}</span>`;
const mapTools=()=>`<div class="row maptools"><button class="btn small ${HMAP.build?'primary':''}" data-act="buildmode" aria-pressed="${HMAP.build}">${HMAP.build?'Done building':'Build'}</button>
  <button class="btn small" data-act="snapshot">Snapshot</button>${comfortChip()}</div>`;

/* ---------- build mode ---------- */
function buildPanel(){
  const pk=HMAP.pick,sel=pk&&pk.kind==='move'?layItem(pk.id):null;
  const selected=sel?`<div class="slot"><div class="slot-label">Picked up</div><p><b>${esc(itemLabel(sel))}</b> · ${foot(sel.key).join('×')} tiles</p>
      <p class="status">Tap an empty spot on the map to move it there.</p>
      <div class="row">${storable(sel)?`<button class="btn small" data-act="storeitem" data-id="${sel.id}">Put in stores</button>`:'<span class="status">Stations and the Codex board stay on the map.</span>'}<button class="btn small" data-act="cancelpick">Put down</button></div></div>`
    :pk&&pk.kind==='place'?`<div class="slot"><div class="slot-label">Placing</div><p><b>${esc(pk.key==='trophy'||pk.key==='statue'?(placeable().find(x=>x.key===pk.key&&x.ref===pk.ref)||{}).name||'':P.DECOR[pk.key].name)}</b></p><p class="status">Tap an empty spot on the map.</p><div class="row"><button class="btn small" data-act="cancelpick">Cancel</button></div></div>`:'';
  const stores=placeable().map(x=>`<div class="invrow"><span><b>${esc(x.name)}</b>${x.n>1?` <small>×${x.n}</small>`:''} <small>${foot(x.key).join('×')}${P.DECOR[x.key]&&P.DECOR[x.key].comfort?` · +${P.DECOR[x.key].comfort} comfort`:P.PLACED_COMFORT[x.key]?` · +${P.PLACED_COMFORT[x.key]} comfort`:''}</small></span>
    <button class="btn small" data-act="placepick" data-k="${x.key}" ${x.ref!=null?`data-ref="${x.ref}"`:''}>Place</button></div>`).join('');
  const np=nextPlot(),why=plotBlock();
  return`<h2>Building</h2><p class="hint">Tap anything on the map to pick it up, then tap where it should go: green fits, red doesn't. Paths are flooring, so things can stand on them. Make decor, dens and paths in the Workshop.</p>
    ${selected}
    <h3>Comfort · +${pct(comfort())} <small class="status">of +${pct(P.COMFORT.cap)}</small></h3>
    <p class="status">${comfortPoints()} points from decor, trophies and statues (each point is +${(P.COMFORT.perPoint*100).toFixed(1)}%; past ${P.COMFORT.repeatCap} of the same decor, more add nothing). Comfort cuts how fast workers tire and speeds bond by the same amount.</p>
    <h3>In stores</h3>${stores||'<p class="empty">Nothing waiting to be placed. Make decor in the Workshop.</p>'}
    <h3>The hillside</h3>${np?`<p class="status">Clear the ${np.name.toLowerCase()} for ${P.GRID.hillRows} more rows: ${costText(np.cost)}, Keeper rank ${np.rank}.</p>
      <div class="row"><button class="btn small" data-act="buyplot" ${why?'disabled':''}>Clear the ${np.name.toLowerCase()}</button>${why?`<span class="status">${esc(why)}</span>`:''}</div>`:'<p class="status">Every terrace is cleared.</p>'}`;
}
function renderBuildPanel(){
  const p=$('#secPanel');if(!p)return;
  if(!HMAP.build)return;
  p.innerHTML=buildPanel();
}

/* ---------- Hall of Legends and trophies ---------- */
const legendSpr=(l,size=64)=>`<canvas class="spr" width="${size}" height="${size}" data-legend="${l.id}" aria-label="Statue of ${esc(l.name)}"></canvas>`;
function perkList(){
  const types=Object.keys(P.PERKS).filter(t=>S.legends.some(l=>l.perk===t));
  return types.map(t=>{const n=Math.min(P.LEGEND.maxStack,S.legends.filter(l=>l.perk===t).length);return`<li><b>${P.PERKS[t].name}</b>${n>1?` ×${n}`:''} · ${P.PERKS[t].desc}</li>`}).join('');
}
function hallPanel(){
  const vets=S.creatures.filter(c=>!retireBlock(c)).sort((a,b)=>(b.raids||0)-(a.raids||0));
  const sel=byId(+ui.retire)||null,armed=ui.retireArm&&sel&&ui.retireArm===sel.id;
  const legends=S.legends.slice().reverse().map(l=>`<div class="slot"><div class="slot-body">${legendSpr(l)}<div><div class="nm">${esc(l.name)} <small class="status">${esc(l.form)} · Lv ${l.level}</small></div>
    <p class="status">${l.raids} raids home · Gen ${l.gen} · retired day ${l.day}${l.titles.length?' · '+l.titles.map(esc).join(', '):''}</p><p class="status" style="color:var(--gold)">${P.PERKS[l.perk].name}: ${P.PERKS[l.perk].desc}</p></div></div></div>`).join('');
  const trophies=S.trophies.map(t=>`<div class="invrow"><span><b>${esc(trophyName(t))}</b><br><small>${esc(trophyStory(t))}</small></span>${t.kind==='weapon'?`<button class="btn small" data-act="takedown" data-id="${t.id}">Take down</button>`:''}</div>`).join('');
  return`<h2>Hall of Legends</h2>
    <p class="hint">Retire a veteran (${P.LEGEND.minRaids}+ raids home and Lv ${P.LEGEND.minLevel}+) and it leaves the roster for good. It becomes a statue in the hideout with its full record, and its type grants a small permanent perk. Each type's perk stacks up to ${P.LEGEND.maxStack} times.</p>
    ${perkList()?`<ul class="plain">${perkList()}</ul>`:''}
    ${vets.length?`<div class="row"><select data-act="retiresel" aria-label="Veteran to retire"><option value="">Choose a veteran</option>${vets.map(c=>`<option value="${c.id}" ${sel&&sel.id===c.id?'selected':''}>${esc(c.name)} · ${esc(formName(c))} Lv ${c.level} · ${c.raids} raids</option>`).join('')}</select>
      <button class="btn small ${armed?'danger':''}" data-act="retire" ${sel?'':'disabled'}>${armed?`Confirm: retire ${esc(sel.name)} for good`:'Retire'}</button></div>
      ${sel?`<p class="status">${esc(sel.name)} is ${TYPES[sel.type].name}: ${P.PERKS[sel.type].name}, ${P.PERKS[sel.type].desc.toLowerCase()}.</p>`:''}`:'<p class="status">No veterans yet.</p>'}
    <div class="members">${legends||'<p class="empty">No legends yet.</p>'}</div>
    <h3>Trophies</h3>${trophies||'<p class="empty">Beat a boss and extract to bring its trophy home. Legendary weapons can go on display from the Workshop.</p>'}`;
}
function openTrophy(id){
  const t=S.trophies.find(x=>x.id===id);if(!t)return;
  openModal(`<div class="row" style="gap:12px;flex-wrap:nowrap">${t.kind==='boss'?`<canvas class="spr" width="88" height="88" data-boss="${t.boss}"></canvas>`:''}<h2>${esc(trophyName(t))}</h2></div>
    <p>${esc(trophyStory(t))}</p>${t.kind==='boss'?`<p class="status">${esc(BOSSES[t.boss].title||'')}</p>`:''}<div class="row"><button class="btn primary" data-act="close">Close</button></div>`);
}
function openLegend(id){
  const l=S.legends.find(x=>x.id===id);if(!l)return;
  openModal(`<div class="row" style="gap:12px;flex-wrap:nowrap">${legendSpr(l,88)}<div><h2>${esc(l.name)}</h2><p class="status">${esc(l.form)} · Lv ${l.level} · Gen ${l.gen}</p></div></div>
    <p>${l.raids} raids home. Retired to the Hall of Legends on day ${l.day}.${l.titles.length?' Titles: '+l.titles.map(esc).join(', ')+'.':''}${l.by&&l.by.name?` Bred by ${esc(l.by.name)}.`:''}</p>
    <p class="status" style="color:var(--gold)">${P.PERKS[l.perk].name}: ${P.PERKS[l.perk].desc}</p><div class="row"><button class="btn primary" data-act="close">Close</button></div>`);
}

/* ---------- creature cards: titles, the breeder's mark, sharing ---------- */
const titleChips=c=>titlesOf(c).map(t=>`<span class="chip title" title="${esc(t.desc)}">${esc(t.name)}</span>`).join('');
const bredBy=c=>c.by?`<span class="bredby">${sigilSvg(c.by.sigil,18)}Bred by ${esc(c.by.name||'you')}</span>`:'';

/* ---------- Workshop: decor recipes ---------- */
function decorRecipes(){
  const have=cost=>Object.entries(cost).map(([k,n])=>`<span class="${amt(k)>=n?'':'short'}">${n} ${matName(k).toLowerCase()} <small>(${amt(k)})</small></span>`).join(' · ');
  return Object.entries(P.DECOR).map(([k,D])=>`<div class="recipe"><div class="row" style="justify-content:space-between"><b>${D.name}${D.make>1?' ×'+D.make:''}</b><small>${D.comfort?'+'+D.comfort+' comfort':'no comfort'} · ${foot(k).join('×')} · ${S.decor[k]||0} in stores</small></div>
    <small>${esc(D.desc)}</small><small>${have(D.cost)}</small><button class="btn small" data-act="makedecor" data-k="${k}" ${canPay(D.cost)?'':'disabled'}>Make</button></div>`).join('');
}

/* ---------- Settings: the breeder's sigil ---------- */
function sigilPanel(){
  const Z=P.SIGIL,cur=S.sigil||ui.sigilDraft||{shape:Z.shapes[0],color:Z.colors[0],glyph:Z.glyphs[0]};
  const pick=(k,list,lab)=>`<div class="row sigilrow" role="group" aria-label="${lab}">${list.map(v=>`<button class="btn small ${cur[k]===v?'primary':''}" data-act="sigil" data-k="${k}" data-v="${esc(v)}" aria-pressed="${cur[k]===v}" ${k==='color'?`style="--sw:${v}"`:''}>${k==='color'?`<i class="swatch" style="background:${v}"></i>`:k==='shape'?sigilSvg({...cur,shape:v},20):esc(v)}</button>`).join('')}</div>`;
  return`<h3>Breeder’s sigil</h3><p class="hint">Creatures you breed carry your sigil as a faint mark, and their cards and Exchange listings say who bred them. It flies on banners too.</p>
    <div class="row" style="gap:12px">${sigilSvg(cur,56)}<div><b>${S.sigil?'Your sigil':'Not set yet'}</b><p class="status">Bred under the name ${esc(S.keeperName||'(set your Keeper name above)')}</p></div></div>
    ${pick('shape',Z.shapes,'Shape')}${pick('color',Z.colors,'Colour')}${pick('glyph',Z.glyphs,'Glyph')}
    <div class="row"><button class="btn small primary" data-act="sigilsave">${S.sigil?'Save changes':'Use this sigil'}</button>${S.sigil?'<button class="btn small" data-act="sigilclear">Remove sigil</button>':''}</div>`;
}

/* ---------- actions ---------- */
onAct('buildmode',d=>{HMAP.build=!HMAP.build;HMAP.pick=null;renderMain()});
onAct('placepick',d=>{HMAP.pick={kind:'place',key:d.k,ref:d.ref!=null?+d.ref:undefined};renderBuildPanel()});
onAct('cancelpick',d=>{HMAP.pick=null;renderBuildPanel()});
onAct('storeitem',d=>{if(storeItem(+d.id)){HMAP.pick=null;save();renderBuildPanel()}});
onAct('buyplot',d=>{if(buyPlot()){sfx('level');save();renderAll()}});
onAct('makedecor',d=>{if(craftDecor(d.k)){sfx('heavy');save();renderAll()}});
onAct('retire',d=>{const c=byId(+ui.retire);if(!c)return;if(ui.retireArm!==c.id){ui.retireArm=c.id;renderSecPanel();return}ui.retireArm=null;const L=retire(c);if(L){ui.retire='';sfx('quest');save();renderAll();openLegend(L.id)}});
onAct('takedown',d=>{if(takeDownWeapon(+d.id)){save();renderAll()}});
onAct('displayweapon',d=>{if(displayWeapon(+d.uid)){validGuns();sfx('quest');save();renderAll()}});
onAct('trophy',d=>{openTrophy(+d.id)});
onAct('legend',d=>{openLegend(+d.id)});
onAct('sigil',d=>{const Z=S.sigil||ui.sigilDraft||{};ui.sigilDraft={shape:Z.shape,color:Z.color,glyph:Z.glyph,[d.k]:d.v};if(S.sigil){setSigil(ui.sigilDraft);save()}renderMain()});
onAct('sigilsave',d=>{setSigil(ui.sigilDraft||S.sigil||{});save();renderMain()});
onAct('sigilclear',d=>{setSigil(null);ui.sigilDraft=null;save();renderMain()});
onAct('sharecard',d=>{openShare('card',+d.id)});
onAct('snapshot',d=>{openShare('snapshot')});
onAct('sharego',d=>{shareGo()});
onChange('retiresel',el=>{ui.retire=el.value;ui.retireArm=null;renderSecPanel()});
export {itemLabel,comfortChip,mapTools,buildPanel,renderBuildPanel,legendSpr,perkList,hallPanel,openTrophy,openLegend,titleChips,bredBy,decorRecipes,sigilPanel};
