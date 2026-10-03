/* ================= Genetics screens =================
   What the player can see of a genome depends on their tools (DESIGN.md, "Tools that unlock
   the genome"):
     - Keeper's eye (always): star ratings only.
     - Sequencer (once Dr. Sorrel arrives): exact expressed grades.
     - Gene Lens (an Echo creature posted in the Roost): both alleles, hidden carriers and
       exact breeding odds.
   The Test Lab's "Reveal genomes" switch turns the Gene Lens view on for testing. */
import {esc} from './util.js';
import {GENES,GENE_HINT,GENETICS as GX,TRAITS,SPECIES,LINES,typesOf,rollTraits} from './content.js';
import {S,breedsLeft,byId,hybridChance,inbred,lineage,mutBonus,sexSym,addLog,ui} from './state.js';
import {GRADE_LOCI,ALL_LOCI,LOOK_LOCI,breedOdds,carriedTraits,cutFree,hasPedigree,isApex,gradeStars,mutationRate,pureRun,simulate,express,expressTrait} from './genetics.js';
import {onAct,onChange} from './actions.js';
import {openModal,renderAll,renderMain,renderSecPanel} from './ui.js';
import {save} from './save.js';
import {sfx} from './audio.js';

/* ---------- sight ---------- */
function toolOn(k){
  const T=GX.TOOLS[k];
  if(k==='sequencer')return!!S.npc[T.npc];
  if(k==='lens')return S.sections[T.section].ids.map(byId).some(c=>c&&typesOf(c).includes(T.type));
  return false;
}
const geneSight=()=>S.settings.genes||toolOn('lens')?'alleles':toolOn('sequencer')?'grades':'stars';
const SIGHT_NOTE={
  stars:'Keeper’s eye: star ratings only. Dr. Sorrel’s Sequencer reads exact grades.',
  grades:'Sequencer: exact grades. Post an Echo creature in the Roost for the Gene Lens, which shows both copies of every gene.',
  alleles:'Gene Lens: both copies of every gene. A stat shows 60% of its better copy plus 40% of its worse one.'};
const starText=n=>'★'.repeat(n)+`<i>${'★'.repeat(5-n)}</i>`;
const fmt=v=>Number.isInteger(v)?String(v):v.toFixed(1);
const allele=v=>v>=GX.GRADE.apex?`<b class="apex" title="Apex allele">${v}</b>`:String(v);

/* ---------- names ---------- */
const lookName=(k,v)=>({hue:GX.HUES,pat:GX.PATTERNS,size:GX.SIZES,shine:GX.SHINES})[k][v];
const looksText=L=>`${lookName('hue',L.hue)} hue · ${lookName('pat',L.pat)} · ${lookName('size',L.size)}`;
const traitName=t=>t?TRAITS[t].name:'empty';
const traitLi=t=>`<li class="${TRAITS[t].defect||['lazy','frail','clumsy'].includes(t)?'neg':''}"><b>${TRAITS[t].name}</b>${TRAITS[t].dom?'':' <small>(recessive)</small>'} · ${TRAITS[t].desc}</li>`;

/* ---------- creature card ---------- */
function geneRows(c,sight){
  return GRADE_LOCI.map(k=>{
    const v=c.genes[k],[a,b]=c.genome[k],label=`<span title="${GENE_HINT[k]}">${GENES[k]}</span>`;
    if(sight==='stars')return`${label}<span class="gstars">${starText(gradeStars(v))}</span><span></span>`;
    const bar=`<div class="g"><i style="width:${Math.min(100,v*10)}%${v>10?';background:var(--gold)':''}"></i></div>`;
    return`${label}${bar}<span>${fmt(v)}${sight==='alleles'?` <small class="al" title="Its two copies">(${allele(Math.max(a,b))}, ${allele(Math.min(a,b))})</small>`:''}</span>`;
  }).join('');
}
function lineageChips(c){
  const out=[];
  if(c.origin==='bred')out.push(`<span class="chip good">Bred · Gen ${c.gen||0}</span>`);
  if(cutFree(c))out.push('<span class="chip good" title="Gen 3 or later: the Bloom can no longer pull on this line">Cut free</span>');
  if(hasPedigree(c))out.push(`<span class="chip warn" title="${c.pure} straight generations of one species">Pedigree</span>`);
  if(c.looks.shine)out.push(`<span class="chip ${c.looks.shine===2?'bad':'warn'} shine${c.looks.shine}">${lookName('shine',c.looks.shine)}</span>`);
  if(geneSight()==='alleles'&&isApex(c.genome))out.push('<span class="chip warn">Apex genome</span>');
  return out.join('');
}
// The genes, traits and looks section of a creature card.
function genomeBlock(c){
  const sight=geneSight();
  const traits=c.proven?c.traits.map(traitLi).join('')||'<li><b>No traits</b> · nothing shows in its trait slots</li>':'<li><b>Traits hidden</b> · revealed once proven</li>';
  const carried=sight==='alleles'?carriedTraits(c):[];
  return`<div class="genes">${geneRows(c,sight)}</div>
    <p class="status gsight">${SIGHT_NOTE[sight]}</p>
    <ul class="traits">${traits}</ul>
    ${carried.length?`<p class="status"><b class="lbl">Carries, hidden:</b> ${carried.map(t=>`<span class="${TRAITS[t].defect?'neg':''}">${TRAITS[t].name}</span>`).join(', ')}</p>`:''}
    <p class="status"><b class="lbl">Looks:</b> ${looksText(c.looks)}</p>
    <div class="row"><button class="btn small" data-act="tree" data-id="${c.id}">Family tree</button>${c.traits.includes('shortlived')?`<span class="status">${breedsLeft(c)} breeding${breedsLeft(c)===1?'':'s'} left</span>`:''}</div>`;
}

/* ---------- family tree ---------- */
function treeNode(id,counts){
  if(id==null)return'<div class="tnode unknown"><span>Unknown</span></div>';
  const e=lineage(id);
  if(!e)return'<div class="tnode unknown"><span>Not recorded</span></div>';
  const live=!!byId(id),form=LINES[e.species]?(LINES[e.species][Math.min(e.stage||0,LINES[e.species].length-1)]||{}).name:SPECIES[e.species].name;
  const twice=counts[id]>1;
  const tag=live?'button':'div',open=live?` data-act="creature" data-id="${id}"`:'';
  return`<${tag} class="tnode${twice?' twice':''}${live?' live':''}"${open} title="${twice?'Appears more than once in this tree':live?'Open its page':''}"><canvas class="spr" width="34" height="34" data-tree="${id}" aria-hidden="true"></canvas>
    <div><b>${esc(e.name)}</b> <small>${sexSym(e.sex)}</small><br><small>${esc(form)} · ${e.origin==='wild'||!(e.gen)?'Wild':'Gen '+e.gen}${live?'':' · gone'}${twice?' · ↺':''}</small></div></${tag}>`;
}
// Five generations: the creature, its parents, grandparents and so on, one column each.
function treeHtml(c){
  const levels=[[c.id]];
  for(let i=1;i<GX.LINEAGE.treeDepth;i++)levels.push(levels[i-1].flatMap(id=>{const e=id==null?null:lineage(id);return e?[e.mom??null,e.dad??null]:[null,null]}));
  const counts={};levels.slice(1).flat().forEach(id=>{if(id!=null)counts[id]=(counts[id]||0)+1});
  const cols=levels.map((ids,i)=>`<div class="tcol"><div class="slot-label">${['Itself','Parents','Grandparents','Great-grandparents','Great-great'][i]}</div><div class="tnodes">${ids.map(id=>treeNode(id,counts)).join('')}</div></div>`).join('');
  const notes=[];
  if(Object.values(counts).some(n=>n>1))notes.push('Ancestors marked ↺ appear more than once: this line has been inbred.');
  if(hasPedigree(c))notes.push(`Pedigree: ${c.pure} straight generations of ${SPECIES[c.species].name}.`);
  if(cutFree(c))notes.push('Cut free: Gen 3 or later.');
  return`<h2>${esc(c.name)}’s family</h2>
    <p class="hint">Mothers on top, fathers below. Scroll sideways for older generations. Wild catches and creatures from before records began have unknown parents.</p>
    <div class="tree">${cols}</div>
    ${notes.length?`<p class="status">${notes.join(' ')}</p>`:''}
    <div class="row"><button class="btn primary" data-act="close">Close</button></div>`;
}

/* ---------- breeding preview ---------- */
const pct=p=>p>=.995?'100%':p<.005?'<1%':Math.round(p*100)+'%';
function previewHtml(mom,dad){
  const sight=geneSight(),odds=breedOdds(mom,dad),h=hybridChance(mom,dad),isIn=inbred(mom,dad);
  const rate=mutationRate(mom,dad,mutBonus()),anyMut=1-Math.pow(1-rate,ALL_LOCI.length);
  const gen=Math.max(mom.gen||0,dad.gen||0)+1,pure=pureRun(mom.species,mom,dad);
  const rows=GRADE_LOCI.map(k=>{
    const d=odds.grades[k],lo=d[0][0],hi=d[d.length-1][0];
    const label=`<span title="${GENE_HINT[k]}">${GENES[k]}</span>`;
    if(sight==='stars'){const a=gradeStars(lo),b=gradeStars(hi);return`${label}<span class="gstars">${starText(a)}</span><span>${a===b?'':'to '+b+'★'}</span>`}
    const bar=`<div class="g"><i style="left:${(lo-1)*10}%;width:${Math.max(2,(hi-lo)*10)}%"></i></div>`;
    if(sight==='grades')return`${label}${bar}<span>${lo===hi?fmt(lo):fmt(lo)+'–'+fmt(hi)}</span>`;
    return`${label}${bar}<span>${d.slice().sort((a,b)=>b[1]-a[1]).slice(0,3).map(([v,p])=>`${fmt(v)} <small>${pct(p)}</small>`).join(' · ')}</span>`;
  }).join('');
  const shown=new Set([...mom.traits,...dad.traits]);
  let traits;
  if(sight==='alleles'){
    const list=Object.entries(odds.traits).sort((a,b)=>b[1]-a[1]);
    traits=list.length?list.map(([t,p])=>`<span class="${TRAITS[t].defect?'neg':''}">${TRAITS[t].name} ${pct(p)}${shown.has(t)?'':' <small>(hidden in the parents)</small>'}</span>`).join(', '):'none';
  }else traits=(shown.size?[...shown].map(traitName).join(', '):'none showing')+'. Recessive traits can hide in plain parents; a Gene Lens shows them.';
  let looks='';
  if(sight==='alleles'){
    looks=LOOK_LOCI.map(k=>{const e=Object.entries(odds.looks[k]).sort((a,b)=>b[1]-a[1]);return`${({hue:'Hue',pat:'Pattern',size:'Size',shine:'Shine'})[k]}: ${e.map(([v,p])=>`${lookName(k,+v)} ${pct(p)}`).join(', ')}`}).join('<br>');
  }
  const notes=[];
  notes.push(`The egg will be Gen ${gen}${gen>=GX.LINEAGE.cutFreeGen?', cut free':''}${pure>=GX.LINEAGE.pedigreeRun?', with a Pedigree':''}.`);
  notes.push(`Mutation: ${(rate*100).toFixed(1)}% per gene${(mom.gen||0)===0||(dad.gen||0)===0?' (raised by a wild Gen 0 parent: Bloomblood)':''}, so about ${pct(anyMut)} of eggs carry at least one.`);
  if(mom.traits.includes('twin'))notes.push(`${esc(mom.name)} has Twin Eggs: ${Math.round(GX.TWIN_CHANCE*100)}% chance of two eggs.`);
  return`<div class="slot"><div class="slot-label">Likely offspring</div>
    <p><b style="font-family:var(--display)">${SPECIES[mom.species].name}</b> (from the mother)${h.id?` · <span style="color:var(--gold)">${Math.round(h.p*100)}% chance of a ${SPECIES[h.id].name} hybrid</span>`:''}</p>
    ${isIn?`<div class="risk"><b>Close family.</b> These two share an ancestor within two generations: ${Math.round(GX.INBREEDING.defectChance*100)}% chance the egg has a defect. Outcross with a wild catch to clear it.</div>`:''}
    <div class="genes">${rows}</div>
    <p class="status">${sight==='stars'?'Each parent passes one copy of every gene. The father passes his better copy 65% of the time.':sight==='grades'?'The range each stat can land in. The father passes his better copy 65% of the time.':'Most likely grades with their odds, before mutation.'}</p>
    <p class="status"><b class="lbl">Traits:</b> ${traits}</p>
    ${looks?`<p class="status"><b class="lbl">Looks:</b><br>${looks}</p>`:''}
    <p class="status">${notes.join(' ')} Personality: half the time like the mother, 30% like the father, otherwise new.</p></div>`;
}

/* ---------- Test Lab simulator ---------- */
let simOut=null;
function runSim(o){simOut=simulate(o,o.seed||1);return simOut}
function simPanel(L){
  const P={seed:1,...GX.SIM,...L},f=(k,l,min,max)=>`<label class="field">${l}<input id="sim-${k}" type="number" min="${min}" max="${max}" value="${P[k]}" data-act="sim" data-k="${k}"></label>`;
  let res='';
  if(simOut){
    const R=simOut,hist={};R.results.forEach(x=>{const b=x.cycles==null?'none':String(Math.floor(x.cycles/2)*2);hist[b]=(hist[b]||0)+1});
    const keys=Object.keys(hist).filter(k=>k!=='none').map(Number).sort((a,b)=>a-b),mx=Math.max(...Object.values(hist));
    const bars=keys.map(k=>`<div class="hrow"><span>${k}–${k+1}</span><div class="g"><i style="width:${hist[k]/mx*100}%"></i></div><span>${hist[k]}</span></div>`).join('')+(hist.none?`<div class="hrow"><span>never</span><div class="g"><i style="width:${hist.none/mx*100}%;background:var(--rose)"></i></div><span>${hist.none}</span></div>`:'');
    const ok=R.median!=null&&R.median>=10&&R.median<=14;
    res=`<p class="status"><b class="lbl">Median:</b> ${R.median??'never'} generations · 10th–90th percentile ${R.p10??'–'} to ${R.p90??`>${R.params.maxGens}`} · ${R.reached}/${R.runs} runs reached Apex within ${R.params.maxGens}</p>
      <p class="status" style="color:${ok?'var(--mint)':'var(--rose)'}">${ok?'On target: the design wants Apex in 10 to 14 generations.':'Off target: the design wants Apex in 10 to 14 generations.'}</p>
      <div class="hist">${bars}</div>`;
  }
  return`<h3>Genetics simulator</h3>
    <p class="hint">Breeds a focused line again and again, using the game’s own inheritance and mutation rules, to count how many generations it takes to reach an Apex genome (every combat stat 10+ on both copies).</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr))">
      ${f('runs','Runs',10,1000)}${f('eggsPerGen','Eggs a generation',1,20)}${f('wildSeen','Wild seen a generation',0,30)}${f('wildPerGen','Wild kept',0,10)}${f('floor','Catch floor',1,6)}${f('poolSize','Breeding pool',4,40)}${f('maxGens','Give up after',5,200)}${f('seed','Seed',1,99999)}
    </div>
    <div class="row"><button class="btn primary" data-act="lab-sim">Run simulator</button></div>${res}`;
}

/* ---------- actions ---------- */
onAct('genelab',d=>{const c=byId(+ui.gl.id);if(!c)return;const g=ui.gl.gene,pair=c.genome[g],w=pair[0]<=pair[1]?0:1,v=pair[w],cc={coin:20*(v+1),ore:2*(v+1)};if(v>=10||S.coin<cc.coin||S.ore<cc.ore)return;
      S.coin-=cc.coin;S.ore-=cc.ore;pair[w]=v+1;express(c);addLog(`Gene Lab: ${c.name}'s weaker ${GENES[g]} copy rose to ${v+1}.`);sfx('level');save();renderAll()});
onAct('tutor',d=>{const c=byId(+ui.tt.id);if(!c||S.coin<60||S.ore<8)return;S.coin-=60;S.ore-=8;const k=ui.tt.slot,old=expressTrait(c.genome[k]);const nt=rollTraits(1,c.traits,true)[0];c.genome[k]=[nt,nt];express(c);
      addLog(`Trait Tutor: ${c.name} ${old?`swapped ${TRAITS[old].name} for`:'learned'} ${TRAITS[nt].name}.`);save();renderAll()});
onAct('tree',d=>{const c=byId(+d.id);if(c)openModal(treeHtml(c))});
onAct('lab-sim',d=>{runSim(ui.sim);renderMain()});
onChange('glc',el=>{ui.gl.id=el.value;renderSecPanel()});
onChange('glg',el=>{ui.gl.gene=el.value;renderSecPanel()});
onChange('ttc',el=>{ui.tt.id=el.value;ui.tt.slot='0';renderSecPanel()});
onChange('tts',el=>{ui.tt.slot=el.value});
onChange('sim',el=>{ui.sim[el.dataset.k]=Math.max(+el.min||0,Math.min(+el.max||1e9,+el.value||0))});
export {toolOn,geneSight,lookName,looksText,genomeBlock,lineageChips,treeHtml,previewHtml,simPanel,runSim,traitName};
