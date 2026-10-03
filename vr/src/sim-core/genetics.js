/* ================= Genetics 2.0 =================
   Every creature carries a genome: two alleles per locus, the first from the mother and
   the second from the father.
     - Combat stats (pow, vig, swf, tem, foc, grt): grades 1-10, Apex 11 only by mutation.
     - Work stats (kn, yld): grades 1-10.
     - Trait slots (t1-t3): a trait id or null per allele. Dominant traits show with one
       copy, recessive ones only with two. A fourth slot (t4) shows only on a cut-free
       creature's final form.
     - Looks (hue, pat, size, shine): see expressLooks.
   Everything here is pure: functions take creatures or genomes and a random function r(),
   so the game, the breeding preview and the Test Lab simulator all share one code path.
   All tunable numbers live in src/data/genetics.json. */
import {GENETICS as GX,TRAITS,TRAIT_IDS,DEFECTS,LINES,PERS_IDS} from './content.js';
import {makeRng,mixSeed} from './rng.js';

const {STAT_LOCI,WORK_LOCI,TRAIT_LOCI,BONUS_LOCUS,LOOK_LOCI}=GX;
const GRADE_LOCI=[...STAT_LOCI,...WORK_LOCI];
const ALL_TRAIT_LOCI=[...TRAIT_LOCI,BONUS_LOCUS];
const ALL_LOCI=[...GRADE_LOCI,...ALL_TRAIT_LOCI,...LOOK_LOCI];
const GOOD_TRAITS=TRAIT_IDS.filter(k=>!TRAITS[k].defect);

const round1=v=>Math.round(v*10)/10;
const rint=(r,a,b)=>a+Math.floor(r()*(b-a+1));
const rpick=(r,a)=>a[Math.floor(r()*a.length)];
function rweight(r,ws){let x=r()*ws.reduce((a,b)=>a+b,0);for(let i=0;i<ws.length;i++){x-=ws[i];if(x<0)return i}return ws.length-1}
const rtrait=(r,pool=GOOD_TRAITS)=>pool[rweight(r,pool.map(k=>TRAITS[k].w||0))];
const maxGrade=k=>STAT_LOCI.includes(k)?GX.GRADE.apex:GX.GRADE.max;

/* ---------- making genomes ---------- */
// A random genome. kind 'wild' rolls by floor (deeper is better); anything else uses the BRED range.
function rollGenome(r,kind='wild',floor=1){
  const W=GX.WILD,f=Math.max(1,Math.min(W.gradeMin.length,floor||1))-1,G={};
  const grade=()=>kind==='wild'?(r()<W.tenChance[f]?10:rint(r,W.gradeMin[f],W.gradeMax[f])):rint(r,GX.BRED.gradeMin,GX.BRED.gradeMax);
  for(const k of GRADE_LOCI)G[k]=[grade(),grade()];
  const tr=()=>r()<W.traitAllele?rtrait(r):null;
  for(const k of TRAIT_LOCI)G[k]=[tr(),tr()];
  G[BONUS_LOCUS]=[null,null];
  const hue=()=>r()<W.hueNatural?0:rint(r,1,GX.HUES.length-1);
  G.hue=[hue(),hue()];
  G.pat=[rweight(r,W.patWeights),rweight(r,W.patWeights)];
  G.size=[rweight(r,W.sizeWeights),rweight(r,W.sizeWeights)];
  G.shine=[r()<W.prismatic?1:0,r()<W.prismatic?1:0];
  return G;
}
// A genome where every allele pair matches the given expressed values (for v5 saves, starters
// and the Test Lab). Accepts the v5 gene names: Haste became Tempo and Temper became Focus.
function genomeFrom(genes={},traits=[]){
  const old={hst:'tem',tmp:'foc'},v={};
  for(const k in genes)v[old[k]||k]=genes[k];
  const G={};
  for(const k of GRADE_LOCI){const x=Math.round(v[k]!=null?v[k]:GX.LEGACY_DEFAULT);G[k]=[x,x]}
  TRAIT_LOCI.forEach((k,i)=>{const t=traits[i]||null;G[k]=[t,t]});
  G[BONUS_LOCUS]=[null,null];
  G.hue=[0,0];G.pat=[0,0];G.size=[1,1];G.shine=[0,0];
  return G;
}

/* ---------- expression ---------- */
const expressGrade=([a,b])=>round1(GX.EXPRESS.better*Math.max(a,b)+GX.EXPRESS.worse*Math.min(a,b));
function expressTrait([a,b]){
  const dom=[a,b].find(x=>x&&TRAITS[x]&&TRAITS[x].dom);
  if(dom)return dom;
  return a&&a===b&&TRAITS[a]?a:null;
}
// Hue: the lower number is dominant (0, the species' natural color, beats every other hue).
// Pattern: any pattern beats Plain; between two patterns the earlier one shows (Runes is the most recessive).
// Size: blends (the average, rounded up). Shine: Bloomscar shows with one copy, Prismatic needs two.
function expressLooks(G){
  const [p,q]=G.pat;
  return{hue:Math.min(...G.hue),pat:p&&q?Math.min(p,q):p||q,size:Math.round((G.size[0]+G.size[1])/2),
    shine:G.shine.includes(2)?2:G.shine[0]===1&&G.shine[1]===1?1:0};
}
const isFinal=c=>{const L=LINES[c.species];return!!L&&(c.stage||0)>=L.length-1};
const cutFree=c=>(c.gen||0)>=GX.LINEAGE.cutFreeGen;
const bonusSlotOpen=c=>cutFree(c)&&isFinal(c);
// Refreshes the expressed values a creature carries: c.genes (grades, one decimal),
// c.traits (expressed trait ids, in slot order) and c.looks. Call after any genome change.
function express(c){
  const G=c.genome,genes={},traits=[];
  for(const k of GRADE_LOCI)genes[k]=expressGrade(G[k]);
  for(const k of (bonusSlotOpen(c)?ALL_TRAIT_LOCI:TRAIT_LOCI)){const t=expressTrait(G[k]||[null,null]);if(t&&!traits.includes(t))traits.push(t)}
  c.genes=genes;c.traits=traits;c.looks=expressLooks(G);
  return c;
}
// Trait alleles a creature carries but doesn't show.
function carriedTraits(c){
  const shown=new Set(c.traits),out=[];
  for(const k of ALL_TRAIT_LOCI)for(const t of c.genome[k]||[])if(t&&!shown.has(t)&&!out.includes(t))out.push(t);
  return out;
}
const isApex=G=>STAT_LOCI.every(k=>G[k][0]>=10&&G[k][1]>=10);
const hasApexAllele=G=>STAT_LOCI.some(k=>G[k].includes(GX.GRADE.apex));
const gradeStars=grade=>Math.max(1,Math.min(5,Math.ceil(grade/2)));

/* ---------- inheritance ---------- */
// Probability that a parent passes allele 0 (index into its pair) at a locus.
function passOdds(parent,k,isDad){
  const [a,b]=parent.genome[k];
  if(!GRADE_LOCI.includes(k)||a===b)return .5;
  const sb=parent.traits.includes('strongblood');
  const pBetter=sb?GX.INHERIT.strongBlood:isDad?GX.INHERIT.fatherBetter:.5;
  return a>b?pBetter:1-pBetter;
}
// Base mutation rate per locus for a pairing. bonus covers research and hideout upgrades.
const mutationRate=(mom,dad,bonus=0)=>GX.MUTATION.perLocus+((mom.gen||0)===0||(dad.gen||0)===0?GX.MUTATION.bloomblood:0)+bonus;

function mutateAllele(r,k,v){
  const M=GX.MUTATION;
  if(GRADE_LOCI.includes(k)){let n=v+(r()<M.statUp?1:-1);if(n>maxGrade(k))n=v-1;if(n<GX.GRADE.min)n=v+1;return n}
  if(ALL_TRAIT_LOCI.includes(k))return r()<M.traitDefect?rpick(r,DEFECTS):rtrait(r);
  if(k==='hue'){let n=rint(r,0,GX.HUES.length-2);return n>=v?n+1:n}
  if(k==='pat'){let n=rint(r,0,GX.PATTERNS.length-2);return n>=v?n+1:n}
  if(k==='size'){const n=v+(r()<.5?1:-1);return n<0||n>=GX.SIZES.length?v-(n-v):n}
  if(k==='shine')return v===1||r()<M.bloomscar?2:1;
  return v;
}
// Mutates n random loci of a genome in place (one allele each), as the Sump does to its creatures. Returns n.
function mutateGenome(G,n,r){
  const loci=[...GRADE_LOCI,...TRAIT_LOCI,'hue','pat','size'];
  for(let i=0;i<n;i++){const k=rpick(r,loci),j=r()<.5?0:1;G[k][j]=mutateAllele(r,k,G[k][j])}
  return n;
}
// Builds a child genome from two parents. Returns {genome, mutations, defect}.
// o.rate: mutation rate per locus; o.inbred: apply the inbreeding defect roll.
function inherit(mom,dad,o,r){
  const G={},mutations=[];
  for(const k of ALL_LOCI){
    const m=mom.genome[k]||[null,null],d=dad.genome[k]||[null,null];
    G[k]=[m[r()<passOdds(mom,k,false)?0:1],d[r()<passOdds(dad,k,true)?0:1]];
  }
  for(const k of ALL_LOCI){
    if(r()>=o.rate)continue;
    const i=r()<.5?0:1,from=G[k][i],to=mutateAllele(r,k,from);
    if(to===from)continue;G[k][i]=to;mutations.push({locus:k,from,to});
  }
  let defect=null;
  if(o.inbred&&r()<GX.INBREEDING.defectChance){const k=rpick(r,TRAIT_LOCI);defect=rpick(r,DEFECTS);G[k]=[defect,defect]}
  return{genome:G,mutations,defect};
}
function inheritPersonality(mom,dad,r){
  const x=r(),I=GX.INHERIT;
  return x<I.persMother?mom.pers:x<I.persMother+I.persFather?dad.pers:rpick(r,PERS_IDS);
}

/* ---------- lineage ---------- */
// get(id) returns a lineage record {mom, dad, ...} or undefined. Ancestors up to n generations up.
function ancestors(id,n,get){
  const out=new Set();let level=[id];
  for(let i=0;i<n;i++){const next=[];for(const x of level){const e=get(x);if(!e)continue;for(const p of [e.mom,e.dad])if(p!=null&&!out.has(p)){out.add(p);next.push(p)}}level=next}
  return out;
}
// Shared ancestor within INBREEDING.generations of the child (parents and grandparents by default).
function isInbred(momId,dadId,get){
  const n=GX.INBREEDING.generations-1;
  const a=ancestors(momId,n,get);a.add(momId);
  const b=ancestors(dadId,n,get);b.add(dadId);
  for(const x of a)if(b.has(x))return true;
  return false;
}
// Consecutive generations of one species, for the Pedigree title.
const pureRun=(species,mom,dad)=>mom.species===species&&dad.species===species?1+Math.min(mom.pure||1,dad.pure||1):1;
const hasPedigree=c=>(c.pure||1)>=GX.LINEAGE.pedigreeRun;

/* ---------- breeding odds (for the preview) ---------- */
// Exact odds for one pairing, before mutation. Grades: {locus: [[expressed, p], ...]} sorted by value.
// traits: {traitId: p} chance the child shows it. looks: {locus: {value: p}} for expressed looks.
function breedOdds(mom,dad){
  const combos=k=>{
    const m=mom.genome[k]||[null,null],d=dad.genome[k]||[null,null],pm=passOdds(mom,k,false),pd=passOdds(dad,k,true),out=[];
    for(const [i,pi] of [[0,pm],[1,1-pm]])for(const [j,pj] of [[0,pd],[1,1-pd]])if(pi*pj>0)out.push([[m[i],d[j]],pi*pj]);
    return out;
  };
  const grades={};
  for(const k of GRADE_LOCI){const acc={};for(const [pair,p] of combos(k)){const v=expressGrade(pair);acc[v]=(acc[v]||0)+p}grades[k]=Object.entries(acc).map(([v,p])=>[+v,p]).sort((a,b)=>a[0]-b[0])}
  const traits={};
  for(const k of TRAIT_LOCI){const acc={};for(const [pair,p] of combos(k)){const t=expressTrait(pair);if(t)acc[t]=(acc[t]||0)+p}
    for(const t in acc)traits[t]=1-(1-(traits[t]||0))*(1-acc[t])}
  const looks={},probe={hue:[0,0],pat:[0,0],size:[1,1],shine:[0,0]};
  for(const k of LOOK_LOCI){const acc={};for(const [pair,p] of combos(k)){const v=expressLooks({...probe,[k]:pair})[k];acc[v]=(acc[v]||0)+p}looks[k]=acc}
  return{grades,traits,looks};
}

/* ---------- simulator ---------- */
// The focused breeder: one species, a pool of breeders, and Gene Lens insight (both alleles).
// Each generation it meets wildSeen wild creatures and keeps the wildPerGen that best fill
// the pool's gaps, hatches eggsPerGen eggs from its best pairs (the top `pairs` females, each
// with her best unrelated male) and keeps the best poolSize. Breeders are ranked by allele
// grades, with tenWeight extra per allele at 10+ (four times that where the pool is short of
// 10s). A run ends when a child carries an Apex genome: every combat stat at 10+ on both alleles.
// Returns per-run results and percentiles of the generation count.
function simulate(opts={},seed=1){
  const P={...GX.SIM,...opts},results=[];
  for(let run=0;run<P.runs;run++){
    const r=makeRng(mixSeed(seed,run)),reg=new Map();let nextId=1;
    const get=id=>reg.get(id);
    const add=(genome,gen,mom,dad,sex)=>{const c={id:nextId++,genome,gen,mom:mom?mom.id:null,dad:dad?dad.id:null,sex:sex||(r()<.5?'F':'M'),species:'sim',stage:0,pers:'calm'};express(c);reg.set(c.id,c);return c};
    const wild=()=>add(rollGenome(r,'wild',P.floor),0);
    // A focused breeder values 10s most where the pool has few of them.
    let scarce={};
    const tensIn=list=>{const t={};for(const k of STAT_LOCI)t[k]=list.reduce((a,c)=>a+(c.genome[k][0]>=10)+(c.genome[k][1]>=10),0);return t};
    const weigh=list=>{const t=tensIn(list);scarce={};for(const k of STAT_LOCI)scarce[k]=t[k]<4?P.tenWeight*4:P.tenWeight;return t};
    const score=c=>STAT_LOCI.reduce((a,k)=>a+c.genome[k][0]+c.genome[k][1]+(scarce[k]||P.tenWeight)*((c.genome[k][0]>=10)+(c.genome[k][1]>=10)),0)-(c.traits.some(t=>TRAITS[t].defect)?100:0);
    let pool=[];for(let i=0;i<P.wildPerGen*2;i++)pool.push(wild());
    let found=null,mutations=0,defects=0,chambered=0;
    for(let g=1;g<=P.maxGens&&!found;g++){
      // Of wildSeen catches, keep the wildPerGen that best fill loci the pool lacks 10s at.
      const tens=weigh(pool);
      const gap=c=>STAT_LOCI.reduce((a,k)=>a+((c.genome[k][0]>=10)+(c.genome[k][1]>=10))*(tens[k]<2?10:1)+(c.genome[k][0]+c.genome[k][1])/20,0);
      const seen=[];for(let i=0;i<P.wildSeen;i++)seen.push(wild());
      seen.sort((a,b)=>gap(b)-gap(a));pool.push(...seen.slice(0,P.wildPerGen));
      weigh(pool);
      const breeders=pool.filter(c=>!c.traits.includes('shortlived')||(c.bred||0)<GX.SHORT_LIVED_BREEDS);
      const F=breeders.filter(c=>c.sex==='F').sort((a,b)=>score(b)-score(a)),M=breeders.filter(c=>c.sex==='M').sort((a,b)=>score(b)-score(a));
      const pairs=[];
      for(const f of F.slice(0,P.pairs)){const m=M.find(x=>!isInbred(f.id,x.id,get))||M[0];if(m)pairs.push([f,m])}
      if(!pairs.length){pool=pool.concat([wild(),wild()]);continue}
      const kids=[];let chamberUses=0;
      for(let e=0;e<P.eggsPerGen;e++){
        const [mom,dad]=pairs[e%pairs.length];mom.bred=(mom.bred||0)+1;dad.bred=(dad.bred||0)+1;
        const res=inherit(mom,dad,{rate:mutationRate(mom,dad),inbred:isInbred(mom.id,dad.id,get)},r);
        mutations+=res.mutations.length;if(res.defect)defects++;
        // The Apex Chamber (opts.apexChamber): when both parents carry an Apex allele, up to chamberPerGen eggs a
        // generation get both parents' better allele on the gene the pool is shortest of 10s in.
        if(P.apexChamber&&chamberUses<(P.chamberPerGen||1)&&hasApexAllele(mom.genome)&&hasApexAllele(dad.genome)){
          const k=STAT_LOCI.slice().sort((a,b)=>Math.min(...res.genome[a])-Math.min(...res.genome[b]))[0];
          res.genome[k]=[Math.max(...mom.genome[k]),Math.max(...dad.genome[k])];chamberUses++;chambered++;
        }
        const kid=add(res.genome,Math.max(mom.gen,dad.gen)+1,mom,dad);kids.push(kid);
        if(isApex(kid.genome)&&!found)found={cycle:g,gen:kid.gen};
      }
      pool=pool.concat(kids);
      weigh(pool);
      const keep=s=>pool.filter(c=>c.sex===s).sort((a,b)=>score(b)-score(a)).slice(0,Math.ceil(P.poolSize/2));
      pool=[...keep('F'),...keep('M')];
    }
    const fixed=c=>STAT_LOCI.filter(k=>c.genome[k][0]>=10&&c.genome[k][1]>=10).length;
    const best=pool.reduce((a,c)=>Math.max(a,fixed(c)),0);
    results.push({cycles:found?found.cycle:null,gen:found?found.gen:null,mutations,defects,best,chambered});
  }
  // Percentiles count unfinished runs as never (null), so a median can't hide failures.
  const ok=results.filter(x=>x.cycles!=null).map(x=>x.cycles).sort((a,b)=>a-b);
  const all=results.map(x=>x.cycles==null?Infinity:x.cycles).sort((a,b)=>a-b);
  const q=p=>{const v=all[Math.min(all.length-1,Math.floor(p*all.length))];return v===Infinity?null:v};
  return{params:P,runs:results.length,reached:ok.length,median:q(.5),p10:q(.1),p90:q(.9),
    mean:ok.length?round1(ok.reduce((a,b)=>a+b,0)/ok.length):null,results};
}

export {mutateGenome,STAT_LOCI,WORK_LOCI,TRAIT_LOCI,BONUS_LOCUS,LOOK_LOCI,GRADE_LOCI,ALL_TRAIT_LOCI,ALL_LOCI,GOOD_TRAITS,
  rollGenome,genomeFrom,expressGrade,expressTrait,expressLooks,express,carriedTraits,isFinal,cutFree,bonusSlotOpen,
  isApex,hasApexAllele,gradeStars,passOdds,mutationRate,mutateAllele,inherit,inheritPersonality,
  ancestors,isInbred,pureRun,hasPedigree,breedOdds,simulate,rtrait};
