/* ================= Endgame panels (Phase 6) =================
   The story so far, the Unbound Bloom, the Deepening, seasons and Renown on the Raid tab; the
   Splicer, Mutation Lab, Apex Chamber and weekly shows on the Breeding tab; the Archive's
   translation work on the Research tab; and the Test Lab's endgame shortcuts. */
import {esc} from './util.js';
import {LORE,ENDGAME as E,GENES} from './content.js';
import {wallKnown} from './lore.js';
import {S,byId,formName,ui} from './state.js';
import {amt,costText} from './jobs.js';
import {GRADE_LOCI,STAT_LOCI} from './genetics.js';
import {archivist,chamberBlock,chamberOpen,eligible,knownLetters,ladder,mutlabBonus,mutlabCreatures,nextTier,renown,rulesFor,runeOf,runeWall,seasonOf,seasonTwist,showClasses,spliceBlock,story,unboundOpen,weekOf} from './endgame.js';

const opt=(list,sel,lab)=>`<option value="">${lab}</option>`+list.map(c=>`<option value="${c.id}" ${String(sel)===String(c.id)?'selected':''}>${esc(c.name)} · ${esc(formName(c))} Lv ${c.level}</option>`).join('');

/* ---------- Raid tab ---------- */
function bloomBelow(){
  const st=story(),r=renown(),wk=weekOf(S.day),sn=seasonOf(S.day),tw=seasonTwist(sn),D=S.deepening;
  const steps=[['Free Ilsa on Floor 9',st.ilsa],['Reach the Heart on Floor 10',st.heart],['Choose an ending',!!st.ending]];
  const tier=Math.min(+ui.tier||nextTier(),nextTier());
  const unbound=unboundOpen()?`<h3>The Unbound Bloom</h3><p class="hint">Twenty tiers, three floors each. Every tier keeps the rules of the ones before and adds one more. Clear the boss on the third floor and extract to clear a tier. Bloomlords stir from tier ${E.UNBOUND.lordFrom}.</p>
    <div class="row"><select data-act="tiersel" aria-label="Unbound tier">${Array.from({length:nextTier()},(_,i)=>`<option value="${i+1}" ${i+1===tier?'selected':''}>Tier ${i+1}${i+1<=S.unbound.cleared?' ✓':''}</option>`).join('')}</select>
    <button class="btn primary" data-act="unbound" data-k="${tier}">Enter tier ${tier}</button></div>
    <p class="status">${S.unbound.cleared}/${E.UNBOUND.tiers} tiers cleared. In force at tier ${tier}: ${rulesFor(tier).map(x=>`<b>${x.name}</b>`).join(', ')}.</p>`
    :`<p class="status">The Unbound Bloom opens once you've chosen an ending at the Heart.</p>`;
  const lad=ladder(wk);
  return`<h3>The Bloom below</h3><ul class="tierlist">${steps.map(([t,ok])=>`<li class="${ok?'on':''}"><b>${ok?'✓':'·'}</b> <span>${t}</span></li>`).join('')}</ul>
    ${st.ending?`<p class="status">You chose to <b style="color:${E.ENDINGS[st.ending].col}">${E.ENDINGS[st.ending].name}</b> the Bloom. ${E.ENDINGS[st.ending].unbound.desc}</p>`:''}
    <p class="hint">The Underheart (Floors 7 to 9) lies below every vein's boss. Only cut-free creatures (Gen 3 and later) can go down.</p>
    ${unbound}
    <h3>The Deepening · week ${wk}</h3><p class="hint">One fixed-seed raid a week, the same for every Keeper. Score: floors, kills, coin, catches and extracting. Run it as often as you like; your best counts.</p>
    <div class="row"><button class="btn" data-act="deepening">Run this week's Deepening</button><span class="status">${D.week===wk&&D.best!=null?`Best ${D.best}, rank ${D.rank} of 100`:'No run yet this week'} · top score ${lad[0]}</span></div>
    <h3>Renown · ${r.total}</h3><dl class="kv"><dt>Depth</dt><dd>${r.depth}</dd><dt>Genetics</dt><dd>${r.genetics}</dd><dt>Craft</dt><dd>${r.craft}</dd><dt>Collection</dt><dd>${r.collection}</dd></dl>
    <p class="status">Season ${sn}, day ${(S.day-1)%E.SEASON.days+1} of ${E.SEASON.days}: <b>${tw.name}</b>. ${tw.desc}${S.keeperTitles.length?` Titles: ${S.keeperTitles.map(esc).join(', ')}.`:''}</p>`;
}

/* ---------- Breeding tab ---------- */
function breedingTools(){
  const T=E.TOOLS,cs=S.creatures,d=byId(+ui.spDonor),rc=byId(+ui.spRecip),loc=ui.spLocus||'pow',why=spliceBlock(d,rc,loc);
  const genes=sel=>GRADE_LOCI.map(k=>`<option value="${k}" ${sel===k?'selected':''}>${GENES[k]}</option>`).join('');
  const splicer=S.keeper.level<T.splicer.rank?`<p class="status">The Splicer opens at Keeper rank ${T.splicer.rank}.</p>`:`<p class="hint">Move one allele from a donor to a recipient: the recipient's weaker copy of the gene becomes the donor's better copy. The donor is used up. ${costText(T.splicer.cost)} each.</p>
    <div class="row"><select data-act="spdonor" aria-label="Donor">${opt(cs,ui.spDonor,'Donor')}</select><select data-act="sprecip" aria-label="Recipient">${opt(cs,ui.spRecip,'Recipient')}</select><select data-act="splocus" aria-label="Gene">${genes(loc)}</select>
    <button class="btn small ${ui.spArm?'danger':''}" data-act="splice" ${why?'disabled':''}>${why||(ui.spArm?`Confirm: use up ${esc(d.name)}`:'Splice')}</button></div>
    ${d&&rc?`<p class="status">${esc(rc.name)}'s ${GENES[loc]} [${rc.genome[loc].join(', ')}] would take ${esc(d.name)}'s ${Math.max(...d.genome[loc])}.</p>`:''}`;
  const crystals=cs.filter(c=>c.type==='crystal'||c.type2==='crystal');
  const lab=S.keeper.level<T.mutlab.rank?`<p class="status">The Mutation Lab opens at Keeper rank ${T.mutlab.rank}.</p>`:`<p class="hint">Post up to ${T.mutlab.slots} Crystal creatures. Each adds +${T.mutlab.per*100}% mutation chance per gene to every egg, up to +${T.mutlab.cap*100}%. Posted creatures can't work elsewhere.</p>
    <div class="row">${[0,1].map(i=>`<select data-act="mutlab" data-i="${i}" aria-label="Mutation Lab slot ${i+1}">${opt(crystals,(S.mutlab||[])[i],'Empty')}</select>`).join('')}</div><p class="status">Now: +${(mutlabBonus()*100).toFixed(1)}% · ${mutlabCreatures().length} posted</p>`;
  const mom=byId(+ui.mom),dad=byId(+ui.dad),cw=chamberOpen()?chamberBlock(mom,dad):'Opens after the Heart';
  const chamber=`<p class="hint">Breed two Apex-carrying creatures with a guaranteed pass of each parent's better allele on one chosen combat gene. Uses ${costText(T.apex.cost)} (you have ${amt('apexshard')}).</p>
    <div class="row"><select data-act="apexlocus" aria-label="Chamber gene"><option value="">Don't use the chamber</option>${STAT_LOCI.map(k=>`<option value="${k}" ${ui.apexLocus===k?'selected':''}>${GENES[k]}</option>`).join('')}</select><span class="status">${cw||'Ready: the next egg from the pair above uses it.'}</span></div>`;
  return`<section class="card"><h2>Gene tools</h2><h3>Splicer</h3>${splicer}<h3>Mutation Lab</h3>${lab}<h3>Apex Chamber</h3>${chamber}</section>${showsPanel()}`;
}
function showsPanel(){
  const w=weekOf(S.day),classes=showClasses(w),sh=S.shows,left=7-((S.day-1)%7);
  const rows=classes.map((o,i)=>{const list=S.creatures.filter(c=>eligible(c,o)),cur=sh.week===w?sh.entries[i]:null;
    return`<div class="invrow"><span style="flex:1;min-width:0"><b>${esc(o.name)}</b><br><small>${esc(o.desc)}</small></span><select data-act="showenter" data-i="${i}" aria-label="Entry for ${esc(o.name)}">${opt(list,cur,list.length?'No entry':'Nobody eligible')}</select></div>`}).join('');
  const res=(sh.results||[]).slice(0,6).map(r=>`<li>Week ${r.week} · ${esc(r.cls)}: ${esc(r.name)} placed ${r.place}${['st','nd','rd'][r.place-1]||'th'}</li>`).join('');
  return`<section class="card"><h2>Shows · week ${w}</h2><p class="hint">Three classes a week, judged by formula against five rival breeders when the week ends (in ${left} day${left>1?'s':''}). Top three win ribbons, which stay on the creature's card and earn Renown.</p>${rows}${res?`<h3>Recent results</h3><ul class="plain">${res}</ul>`:''}</section>`;
}

/* ---------- Research tab: the Archive ---------- */
function archivePanel(){
  const walls=LORE.WALLS.filter(w=>wallKnown(w.id)),A=S.archive,lumens=S.creatures.filter(c=>c.type==='lumen'||c.type2==='lumen'),ar=archivist(),k=knownLetters();
  const read=E.RELICS.slice(0,A.read).map(r=>`<li><b>${esc(r.name)}</b>: ${esc(r.text)}</li>`).join('');
  return`<section class="card" style="margin-bottom:16px"><h2>The Archive · rune translation</h2>
    <p class="hint">Old Keeper relics come from the Underheart and the Unbound Bloom. A Lumen creature working in the Archive translates one a day, and each relic teaches a few rune letters. ${A.read}/${E.RELICS.length} relics read, ${A.unread} waiting.</p>
    <div class="row"><select data-act="archivist" aria-label="Archivist">${opt(lumens,A.archivist,lumens.length?'No archivist':'No Lumen creatures yet')}</select><span class="status">${ar?`${esc(ar.name)} is studying.`:'Lumen creatures live only in the Underheart.'}</span></div>
    <h3>Rune walls · ${walls.length}/${LORE.WALLS.length} copied · ${k.size}/26 letters known</h3>
    <p class="hint">Each rune stands for one letter, always the same one. Walls are copied the moment you walk into their room in the Bloom. Translated letters show in plain text; the rest you can work out yourself.</p>
    ${walls.length?`<ul class="plain runes">${walls.map(w=>`<li>${esc(runeWall(w.text))}</li>`).join('')}</ul>`:'<p class="status">No walls copied yet. The first ones are on the Rootworks floors.</p>'}
    <div class="cipher">${[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(ch=>`<span><b>${runeOf(ch)}</b>${k.has(ch)?ch:'?'}</span>`).join('')}</div>
    ${read?`<h3>Relics read</h3><ul class="plain">${read}</ul>`:''}</section>`;
}

/* ---------- Test Lab ---------- */
const labEndgamePanel=()=>`<h3>Endgame</h3><p class="hint">An endgame party (three cut-free Lv 34 creatures, rank 45, apex shards), then jump to the deep floors.</p>
  <div class="row"><button class="btn" data-act="lab-endgame">Make an endgame save</button><button class="btn small" data-act="lab-deep" data-k="7">Underheart</button><button class="btn small" data-act="lab-deep" data-k="9">Floor 9 · Ilsa</button><button class="btn small" data-act="lab-deep" data-k="10">The Heart</button></div>
  <div class="row">${[1,5,10,20].map(t=>`<button class="btn small" data-act="lab-unbound" data-k="${t}">Unbound ${t}</button>`).join('')}<button class="btn small" data-act="lab-ending">Unlock Unbound</button></div>`;

const ribbonChips=c=>(c.ribbons||[]).slice(-3).map(r=>`<span class="chip title" title="Week ${r.week}: ${esc(r.cls)}">${['1st','2nd','3rd'][r.place-1]||''} · ${esc(r.cls)}</span>`).join('');

export {bloomBelow,breedingTools,showsPanel,archivePanel,labEndgamePanel,ribbonChips};
