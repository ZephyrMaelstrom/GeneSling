/* ================= Shareable images =================
   Creature cards and hideout snapshots, drawn on a canvas and handed to the phone's share sheet
   (Web Share with files), or saved as a PNG where sharing files isn't supported. */
import {GENES,SPECIES,TYPES} from './content.js';
import {S,bondStar,byId,formName,lineage} from './state.js';
import {OL,drawCreature,drawSigil} from './sprites.js';
import {GRADE_LOCI,cutFree,hasPedigree} from './genetics.js';
import {lookName,looksText} from './geneui.js';
import {comfort,titlesOf} from './hideout.js';
import {HMAP,mapH,renderMapTo} from './map.js';
import {track} from './demo.js';
import {esc} from './util.js';
import {openModal} from './ui.js';

const FONT='"Pixelify Sans",monospace';
function rrect(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
function chip(g,x,y,txt,col,fg){g.font=`600 15px ${FONT}`;const w=g.measureText(txt).width+16;g.fillStyle=col;rrect(g,x,y,w,22,6);g.fill();g.fillStyle=fg||OL;g.textAlign='left';g.fillText(txt,x+8,y+16);return x+w+6}

/* ---------- the creature card: 640 × 360 ---------- */
function cardCanvas(c){
  const W=640,H=360,cv=document.createElement('canvas');cv.width=W;cv.height=H;const g=cv.getContext('2d');
  const tc=TYPES[c.type].color,tc2=c.type2?TYPES[c.type2].color:tc;
  const bg=g.createLinearGradient(0,0,W,H);bg.addColorStop(0,'#1b1438');bg.addColorStop(1,'#0e0a1f');g.fillStyle=bg;g.fillRect(0,0,W,H);
  g.fillStyle=tc;g.globalAlpha=.18;g.beginPath();g.moveTo(0,0);g.lineTo(300,0);g.lineTo(200,H);g.lineTo(0,H);g.closePath();g.fill();g.globalAlpha=1;
  g.strokeStyle=tc2;g.lineWidth=6;rrect(g,3,3,W-6,H-6,14);g.stroke();
  // The creature on a spotlight.
  const spot=g.createRadialGradient(130,190,10,130,190,130);spot.addColorStop(0,'rgba(255,255,255,.18)');spot.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=spot;g.fillRect(0,40,270,300);
  drawCreature(g,c,130,200,3.3,1.2,{face:1,still:true});
  // Name, form and level.
  g.textAlign='left';g.fillStyle='#f6eedb';g.font=`700 34px ${FONT}`;g.fillText(c.name,270,58);
  g.font=`500 17px ${FONT}`;g.fillStyle='#b4a9d8';g.fillText(`${formName(c)}${formName(c)!==SPECIES[c.species].name?' ('+SPECIES[c.species].name+')':''} · Lv ${c.level}`,270,84);
  let x=270;x=chip(g,x,96,TYPES[c.type].name,tc);if(c.type2)x=chip(g,x,96,TYPES[c.type2].name,tc2);
  x=chip(g,x,96,c.sex==='F'?'♀':'♂',c.sex==='F'?'#ff8fb1':'#7fc8ff');
  if(c.looks.shine)chip(g,x,96,lookName('shine',c.looks.shine),'#ffcf4a');
  // Genome summary: each expressed grade as a bar.
  g.font=`500 13px ${FONT}`;
  GRADE_LOCI.forEach((k,i)=>{const col=i%2,row=Math.floor(i/2),bx=270+col*180,by=136+row*24,v=c.genes[k]||0;
    g.fillStyle='#b4a9d8';g.fillText(GENES[k],bx,by+12);g.fillStyle='rgba(255,255,255,.1)';g.fillRect(bx+56,by+3,104,10);
    g.fillStyle=v>=9?'#ffcf4a':v>=7?'#5de8b0':'#58c2ff';g.fillRect(bx+56,by+3,104*Math.min(10,v)/10,10)});
  // Titles and lineage.
  const marks=[...titlesOf(c).map(t=>t.name),cutFree(c)&&'Cut free',hasPedigree(c)&&'Pedigree'].filter(Boolean);
  x=270;for(const m of marks.slice(0,4)){if(x>W-90)break;x=chip(g,x,238,m,'#3a2f66','#ffcf4a')}
  const mom=c.mom!=null&&lineage(c.mom),dad=c.dad!=null&&lineage(c.dad);
  g.font=`500 15px ${FONT}`;g.fillStyle='#f6eedb';
  g.fillText(c.origin==='bred'?`Gen ${c.gen||0}${mom&&dad?` · ${mom.name} × ${dad.name}`:''}`:'Caught wild',270,274);
  g.fillStyle='#b4a9d8';g.fillText(looksText(c.looks),270,294);
  g.fillText(`${bondStar(c)?'★'.repeat(bondStar(c))+' bond':'No bond yet'} · ${c.raids||0} raid${c.raids===1?'':'s'} home`,270,314);
  // The breeder's sigil and the game's mark.
  if(c.by&&c.by.sigil)drawSigil(g,c.by.sigil,288,334,14);
  g.fillStyle='#f6eedb';g.font=`500 14px ${FONT}`;g.fillText(c.by?`Bred by ${c.by.name||'a keeper'}`:'',c.by&&c.by.sigil?308:270,339);
  g.textAlign='right';g.fillStyle='#ff9bbf';g.font=`700 16px ${FONT}`;g.fillText('GeneSling',W-20,339);
  return cv;
}

/* ---------- the hideout snapshot ---------- */
function snapshotCanvas(){
  const H=mapH(),foot=44,cv=document.createElement('canvas');cv.width=HMAP.W;cv.height=H+foot;const g=cv.getContext('2d');
  renderMapTo(g,HMAP.t||1,{snapshot:true});
  g.fillStyle='#0e0a1f';g.fillRect(0,H,HMAP.W,foot);
  if(S.sigil)drawSigil(g,S.sigil,26,H+22,14);
  g.textAlign='left';g.fillStyle='#f6eedb';g.font=`700 20px ${FONT}`;g.fillText(`${S.keeperName?S.keeperName+'’s':'My'} hideout`,S.sigil?48:16,H+29);
  g.textAlign='right';g.font=`500 15px ${FONT}`;g.fillStyle='#b4a9d8';
  g.fillText(`Day ${S.day} · ${S.creatures.length} creatures · Comfort +${Math.round(comfort()*100)}% · `,HMAP.W-110,H+28);
  g.fillStyle='#ff9bbf';g.font=`700 18px ${FONT}`;g.fillText('GeneSling',HMAP.W-14,H+29);
  return cv;
}

/* ---------- sharing ---------- */
const blobOf=cv=>new Promise(r=>cv.toBlob(r,'image/png'));
// Share sheet where files can be shared (phones), otherwise a download. Returns how it went.
async function shareCanvas(cv,name,title){
  const blob=await blobOf(cv);if(!blob)return'failed';
  const file=new File([blob],name,{type:'image/png'});
  if(navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title});return'shared'}catch(e){if(e&&e.name==='AbortError')return'cancelled'}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  return'downloaded';
}
let pending=null;   // {cv, name, title, kind} shown in the preview
function openShare(kind,id){
  const c=kind==='card'?byId(id):null;if(kind==='card'&&!c)return null;
  const cv=kind==='card'?cardCanvas(c):snapshotCanvas();
  const name=kind==='card'?`genesling-${c.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`:`genesling-hideout-day-${S.day}.png`;
  pending={cv,name,kind,title:kind==='card'?`${c.name}, my ${formName(c)} in GeneSling`:'My GeneSling hideout'};
  openModal(`<h2>${kind==='card'?esc(c.name)+'’s card':'Hideout snapshot'}</h2><img class="sharepic" src="${cv.toDataURL('image/png')}" alt="${esc(pending.title)}">
    <div class="row"><button class="btn primary" data-act="sharego">${navigator.canShare?'Share':'Save image'}</button><button class="btn" data-act="close">Close</button></div><p class="status" id="share-status"></p>`);
  return pending;
}
async function shareGo(){
  if(!pending)return null;const how=await shareCanvas(pending.cv,pending.name,pending.title);
  if(how==='shared'||how==='downloaded')track('share',{kind:pending.kind,how});
  const st=document.querySelector('#share-status');if(st)st.textContent=how==='shared'?'Shared.':how==='downloaded'?'Saved to your downloads.':how==='cancelled'?'':'Couldn’t make the image.';
  return how;
}
export {cardCanvas,snapshotCanvas,blobOf,shareCanvas,openShare,shareGo};
