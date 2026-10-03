/* ================= Hideout map =================
   Draws the hideout from S.layout (see hideout.js): stations grow with their tiers, decor,
   trophies and statues stand where the player put them, workers bustle at their stations and
   off-duty creatures sleep, play and follow their friends through a day and night.
   Build mode (HMAP.build) overlays the grid: tap a thing to pick it up, tap a tile to set it down. */
import {$,fxRnd,fxPick} from './util.js';
import {NPCS,NPC_IDS,RES_IDS,SECTIONS,BOSSES,PRIDE as P,GUNS} from './content.js';
import {S,byId,npcAttention,secTier,sectionUnlocked,syncNpcs,ui} from './state.js';
import {OL,drawCreature,drawPerson,drawSigil} from './sprites.js';
import {drawBossBody} from './draw.js';
import {sfx} from './audio.js';
import {openNpc,renderSecPanel} from './ui.js';
import {act} from './actions.js';
import {R} from './raid.js';
import {dayPhase,fits,foot,isNight,isStation,itemAt,layer,lifePlan,minRow,moveItem,placeNew,rowCount} from './hideout.js';
import {save} from './save.js';
import {openTrophy,openLegend,renderBuildPanel} from './prideui.js';

const G=P.GRID,T=G.tile;
const HMAP={W:G.cols*T,H:G.top+G.baseRows*T,raf:0,bg:null,bgKey:'',wander:{},hover:null,hoverTile:null,t:0,build:false,pick:null,plan:null,planT:-9};
const GATE={x:500,y:84,r:46};
// NPCs stand beside the station they belong to.
const NPC_HOME={brannoc:'forge',pip:'roost',sorrel:'nursery'};
const mapH=()=>G.top+rowCount()*T;
// Tile to map pixels (top-left corner of the tile), and back.
const tileX=x=>x*T;
const tileY=y=>G.top+(y-minRow())*T;
const toTile=(px,py)=>({x:Math.floor(px/T),y:Math.floor((py-G.top)/T)+minRow()});
// A station's building box, as drawBuilding wants it: x centre, y base, w width.
function bbox(i){const [w,h]=foot(i.key);return{x:tileX(i.x)+w*T/2,y:tileY(i.y)+h*T-28,w:125,link:i.key==='archive'?'research':null,name:i.key==='archive'?'Archive':null}}
function npcSpot(id){const i=S.layout.find(x=>x.key===(NPC_HOME[id]||NPCS[id].home));if(!i)return{x:500,y:300};const [w,h]=foot(i.key);return{x:tileX(i.x)+w*T+22,y:tileY(i.y)+h*T-24}}

/* ---------- background: sky, cliff, the cave mouth, terraces and grass ---------- */
function hmapBg(){
  const W=HMAP.W,H=mapH(),c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const sky=g.createLinearGradient(0,0,0,H);sky.addColorStop(0,'#0e0a1f');sky.addColorStop(.35,'#1b1438');sky.addColorStop(1,'#2a2050');
  g.fillStyle=sky;g.fillRect(0,0,W,H);
  g.fillStyle='#120c26';g.beginPath();g.moveTo(0,0);for(let x=0;x<=W;x+=40)g.lineTo(x,90+Math.sin(x*.05)*18+((x*7)%23));g.lineTo(W,0);g.closePath();g.fill();
  g.fillStyle='#2f2558';g.beginPath();g.moveTo(0,G.top+8);for(let x=0;x<=W;x+=25)g.lineTo(x,G.top-4+Math.sin(x*.03)*10);g.lineTo(W,H);g.lineTo(0,H);g.closePath();g.fill();
  // Terraces up the hillside: a shade lighter, with a stone wall along each one's front edge.
  for(let p=0;p<(S.plots||0);p++){
    const y0=G.top+p*G.hillRows*T,yb=y0+G.hillRows*T;g.fillStyle=p%2?'#43377c':'#4a3d86';g.fillRect(0,y0,W,G.hillRows*T);
    // A dry-stone wall along the terrace's front edge.
    g.fillStyle='#6a5c9e';g.fillRect(0,yb-10,W,10);g.fillStyle='#53478a';for(let x=0;x<W;x+=24){g.fillRect(x+(p%2)*12,yb-10,22,4);g.fillRect(x+12-(p%2)*12,yb-5,22,4)}
    g.fillStyle='rgba(0,0,0,.3)';g.fillRect(0,yb,W,4);
  }
  for(let i=0;i<300;i++){const x=(i*137.5)%W,y=G.top+((i*61)%(H-G.top));g.fillStyle=i%3?'rgba(255,255,255,.04)':'rgba(0,0,0,.12)';g.fillRect(x,y,3+(i%4),2)}
  // The cave mouth into the Bloom, in the cliff above everything.
  g.fillStyle='#0a0718';g.beginPath();g.ellipse(GATE.x,GATE.y+20,GATE.r+10,GATE.r,0,Math.PI,0);g.lineTo(GATE.x+GATE.r+10,GATE.y+40);g.lineTo(GATE.x-GATE.r-10,GATE.y+40);g.closePath();g.fill();
  return c;
}

/* ---------- stations ---------- */
function hmapTier(k){return k==='archive'?Math.min(5,1+Math.floor(RES_IDS.reduce((a,b)=>a+S.research[b],0)/6)):secTier(k)}
function drawBuilding(g,k,b,t){
  const sec=SECTIONS[k],tier=hmapTier(k),locked=k!=='archive'&&!sectionUnlocked(k),col=sec?sec.col:'#c9b48a';
  const w=b.w,x=b.x,y=b.y,hov=HMAP.hover===k;
  g.save();
  g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(x,y+4,w*.62,14,0,0,7);g.fill();
  g.strokeStyle=OL;g.lineWidth=3;g.lineJoin='round';
  if(tier===0){
    g.fillStyle='#4a4062';g.fillRect(x-w/2,y-14,w,14);g.strokeRect(x-w/2,y-14,w,14);
    g.fillStyle='#6a5f84';[[-40,-22],[-10,-26],[25,-20]].forEach(([dx,dy])=>{g.fillRect(x+dx,y+dy,16,10);g.strokeRect(x+dx,y+dy,16,10)});
    g.setLineDash([6,5]);g.strokeStyle=hov?'#ffcf4a':'rgba(201,180,138,.6)';g.lineWidth=2;g.strokeRect(x-w/2,y-80,w,80);g.setLineDash([]);
    if(locked){g.fillStyle='#8a5a3a';g.fillRect(x-24,y-58,48,24);g.strokeStyle=OL;g.lineWidth=2;g.strokeRect(x-24,y-58,48,24);g.fillStyle='#f6eedb';g.font='600 11px "Pixelify Sans",monospace';g.textAlign='center';g.fillText('RANK '+sec.unlock,x,y-42)}
  }else{
    const h=44+tier*9,wall=shade(col,-.45),roof=shade(col,-.15);
    if(k==='spring'){g.fillStyle='#3fa9ff';g.beginPath();g.ellipse(x,y-8,w*.5,22,0,0,7);g.fill();g.stroke();g.fillStyle='rgba(255,255,255,.35)';g.beginPath();g.ellipse(x-15+Math.sin(t)*6,y-12,14,4,0,0,7);g.fill()}
    const bx=k==='spring'?x+w*.32:x,bw=k==='spring'?w*.42:w,by=k==='spring'?y-18:y;
    if(tier>=4){g.fillStyle=wall;g.fillRect(bx+bw*.15,by-h-26,bw*.42,30);g.strokeRect(bx+bw*.15,by-h-26,bw*.42,30)}
    g.fillStyle=wall;g.fillRect(bx-bw/2,by-h,bw,h);g.strokeRect(bx-bw/2,by-h,bw,h);
    g.fillStyle='rgba(255,255,255,.06)';g.fillRect(bx-bw/2,by-h,bw,8);
    g.fillStyle=roof;g.beginPath();g.moveTo(bx-bw/2-10,by-h+2);g.lineTo(bx,by-h-30-tier*3);g.lineTo(bx+bw/2+10,by-h+2);g.closePath();g.fill();g.stroke();
    g.fillStyle='#2a1a10';g.fillRect(bx-9,by-26,18,26);g.strokeRect(bx-9,by-26,18,26);
    if(k==='forge'){g.fillStyle=`rgba(255,${120+Math.sin(t*6)*40|0},40,.9)`;g.fillRect(bx-7,by-22,14,22);g.fillStyle='#4a3a3a';g.fillRect(bx+bw*.25,by-h-40,14,40);g.strokeRect(bx+bw*.25,by-h-40,14,40);
      for(let i=0;i<4;i++){const p=(t*.5+i*.25)%1;g.fillStyle=`rgba(180,170,190,${.5*(1-p)})`;g.beginPath();g.arc(bx+bw*.25+7+Math.sin(t+i)*6,by-h-44-p*50,6+p*8,0,7);g.fill()}}
    if(tier>=2){g.fillStyle='#ffd27a';[[-.32,-.62],[.2,-.62]].forEach(([fx,fy])=>{g.fillRect(bx+bw*fx,by+h*fy,14,12);g.strokeRect(bx+bw*fx,by+h*fy,14,12)})}
    if(tier>=3){const px=bx-bw/2-4,py=by-h-6;g.strokeStyle=OL;g.lineWidth=2;g.beginPath();g.moveTo(px,py);g.lineTo(px,py-36);g.stroke();g.fillStyle=col;g.beginPath();g.moveTo(px,py-36);g.lineTo(px+20+Math.sin(t*4)*3,py-30);g.lineTo(px,py-24);g.closePath();g.fill();g.stroke()}
    if(tier>=5){const pk=by-h-30-tier*3;g.fillStyle=col;g.globalAlpha=.35+.25*Math.sin(t*3);g.beginPath();g.arc(bx,pk-10,18,0,7);g.fill();g.globalAlpha=1;g.fillStyle='#fff6c8';g.beginPath();g.arc(bx,pk-10,6,0,7);g.fill();g.strokeStyle=OL;g.lineWidth=2;g.stroke()}
    g.strokeStyle=OL;g.lineWidth=2;
    if(k==='garden'){[[-w*.6,-6],[w*.55,-4],[-w*.45,10]].forEach(([dx,dy],i)=>{g.fillStyle='#f2e4c9';g.fillRect(x+dx-2,y+dy-8,5,9);g.fillStyle=['#e0527a','#c04ad8','#ff8a5c'][i];g.beginPath();g.ellipse(x+dx,y+dy-8,9,6,0,Math.PI,0);g.closePath();g.fill();g.stroke()})}
    if(k==='roost'){g.fillStyle='#6b4a2a';g.fillRect(bx+bw/2+6,by-h-20,5,h+20);g.strokeRect(bx+bw/2+6,by-h-20,5,h+20);g.fillRect(bx+bw/2-2,by-h-20,22,4)}
    if(k==='vault'){g.fillStyle='#ff8fe0';g.beginPath();g.moveTo(bx,by-40);g.lineTo(bx+7,by-32);g.lineTo(bx,by-24);g.lineTo(bx-7,by-32);g.closePath();g.fill();g.stroke()}
    if(k==='nursery'){g.fillStyle='#f6eedb';g.beginPath();g.ellipse(bx+bw*.3,by-h*.45,7,9,0,0,7);g.fill();g.stroke()}
    if(k==='training'){[-1,1].forEach(s=>{const dx=x+s*(w*.6);g.fillStyle='#c9b48a';g.fillRect(dx-3,y-30,6,30);g.strokeRect(dx-3,y-30,6,30);g.beginPath();g.arc(dx,y-34,7,0,7);g.fill();g.stroke()})}
    if(k==='warroom'){g.fillStyle='#4fe0c8';g.fillRect(bx-bw*.4,by-h*.7,bw*.25,h*.25);g.strokeRect(bx-bw*.4,by-h*.7,bw*.25,h*.25)}
    if(k==='archive'){g.fillStyle='#c9b48a';for(let i=0;i<4;i++){g.fillRect(bx+bw*.15+i*7,by-h*.7,5,16);g.strokeRect(bx+bw*.15+i*7,by-h*.7,5,16)}}
    if(hov){g.strokeStyle='#ffcf4a';g.lineWidth=3;g.strokeRect(bx-bw/2-4,by-h-4,bw+8,h+8)}
  }
  const name=sec?sec.name:b.name;
  g.font='600 14px "Pixelify Sans",monospace';g.textAlign='center';
  const label=locked?name:k==='archive'?`${name} · Research`:`${name} · T${tier}`;
  const tw=g.measureText(label).width+14;g.fillStyle='rgba(14,10,31,.82)';g.fillRect(x-tw/2,y+12,tw,20);
  g.fillStyle=HMAP.sel===k?'#ffcf4a':locked?'#b4a9d8':'#f6eedb';g.fillText(label,x,y+27);
  g.restore();
}
function shade(hex,amt){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=v=>Math.round(amt<0?v*(1+amt):v+(255-v)*amt);return`rgb(${f(r)},${f(g)},${f(b)})`}

/* ---------- decor, dens, trophies and statues ---------- */
const label=(g,txt,x,y,col)=>{g.font='600 12px "Pixelify Sans",monospace';g.textAlign='center';const tw=g.measureText(txt).width+10;g.fillStyle='rgba(14,10,31,.8)';g.fillRect(x-tw/2,y,tw,16);g.fillStyle=col||'#f6eedb';g.fillText(txt,x,y+12)};
function pedestal(g,x,y){g.fillStyle='#5a5078';g.strokeStyle=OL;g.lineWidth=2.5;g.fillRect(x-16,y-14,32,14);g.strokeRect(x-16,y-14,32,14);g.fillStyle='#6d6390';g.fillRect(x-20,y-4,40,6);g.strokeRect(x-20,y-4,40,6)}
// Draws one placed thing with its feet at the bottom of its footprint.
function drawItem(g,i,t,night){
  const [w,h]=foot(i.key),x0=tileX(i.x),y0=tileY(i.y),cx=x0+w*T/2,by=y0+h*T-8;
  g.save();g.strokeStyle=OL;g.lineWidth=2.5;g.lineJoin='round';
  switch(i.key){
    case'board':{
      const x=cx,y=y0+T-6;g.fillStyle='#6b4a2a';g.fillRect(x-4,y-28,8,30);g.fillRect(x-34,y-62,68,38);g.strokeRect(x-34,y-62,68,38);
      g.fillStyle='#f6eedb';[[-26,-56],[-2,-58],[12,-52]].forEach(([dx,dy])=>{g.fillRect(x+dx,y+dy,14,16)});
      label(g,'Codex',x,y-2,HMAP.hover==='board'?'#ffcf4a':null);break}
    case'den':{
      g.fillStyle='#4a3a2a';g.beginPath();g.ellipse(cx,by-6,w*T*.44,22,0,Math.PI,0);g.closePath();g.fill();g.stroke();
      g.fillStyle='#120c1e';g.beginPath();g.ellipse(cx,by-4,16,13,0,Math.PI,0);g.closePath();g.fill();
      g.fillStyle='#7fd860';for(let k=-2;k<=2;k++){g.fillRect(cx+k*14-1,by-26-Math.abs(k)*-2,3,7)}break}
    case'flowerbed':{
      g.fillStyle='#4a3a2a';g.fillRect(cx-20,by-8,40,10);g.strokeRect(cx-20,by-8,40,10);
      ['#e0527a','#ffcf4a','#c04ad8','#ff8a5c'].forEach((c2,k)=>{const fx=cx-14+k*9,sw=Math.sin(t*2+k)*2;g.fillStyle='#5de8b0';g.fillRect(fx+sw*.3,by-20,2,12);g.fillStyle=c2;g.beginPath();g.arc(fx+sw,by-21,4.5,0,7);g.fill()});break}
    case'lantern':{
      g.fillStyle='#3a3050';g.fillRect(cx-2,by-40,4,40);g.fillStyle=night?'#ffe08a':'#d8b860';g.fillRect(cx-7,by-52,14,14);g.strokeRect(cx-7,by-52,14,14);break}
    case'banner':{
      g.fillStyle='#3a3050';g.fillRect(cx-14,by-56,3,56);g.fillStyle='#c04a6a';g.beginPath();g.moveTo(cx-11,by-54);g.lineTo(cx+16+Math.sin(t*3)*2,by-52);g.lineTo(cx+14,by-26);g.lineTo(cx+2,by-31);g.lineTo(cx-11,by-26);g.closePath();g.fill();g.stroke();
      if(S.sigil)drawSigil(g,S.sigil,cx+2,by-41,8);break}
    case'mushlamp':{
      g.fillStyle='#f2e4c9';g.fillRect(cx-4,by-26,8,26);g.strokeRect(cx-4,by-26,8,26);g.fillStyle=night?'#ff9be6':'#c06ab0';g.beginPath();g.ellipse(cx,by-26,17,12,0,Math.PI,0);g.closePath();g.fill();g.stroke();
      g.fillStyle='#fff';[[-8,-31],[5,-33]].forEach(([a,b])=>{g.beginPath();g.arc(cx+a,by+b,2.5,0,7);g.fill()});break}
    case'bench':{
      g.fillStyle='#8a5a3a';g.fillRect(cx-36,by-20,72,8);g.strokeRect(cx-36,by-20,72,8);g.fillRect(cx-36,by-36,72,7);g.strokeRect(cx-36,by-36,72,7);
      g.fillStyle='#5a3a2a';[-30,26].forEach(dx=>{g.fillRect(cx+dx,by-12,5,12);g.strokeRect(cx+dx,by-12,5,12)});break}
    case'totem':{
      g.fillStyle='#5a5078';g.fillRect(cx-10,by-12,20,12);g.strokeRect(cx-10,by-12,20,12);
      g.fillStyle=`hsl(${300+Math.sin(t)*30},90%,75%)`;g.beginPath();g.moveTo(cx,by-60);g.lineTo(cx+11,by-30);g.lineTo(cx,by-12);g.lineTo(cx-11,by-30);g.closePath();g.fill();g.stroke();break}
    case'fountain':{
      g.fillStyle='#6d6390';g.beginPath();g.ellipse(cx,by-10,40,14,0,0,7);g.fill();g.stroke();g.fillStyle='#3fa9ff';g.beginPath();g.ellipse(cx,by-12,32,9,0,0,7);g.fill();
      g.fillStyle='#6d6390';g.fillRect(cx-4,by-38,8,26);g.strokeRect(cx-4,by-38,8,26);
      for(let k=0;k<6;k++){const p=(t*.8+k/6)%1,a=k/6*Math.PI*2;g.fillStyle=`rgba(160,220,255,${1-p})`;g.beginPath();g.arc(cx+Math.cos(a)*p*26,by-40+p*p*30-p*12,2.5,0,7);g.fill()}break}
    case'trophy':{
      const tr=S.trophies.find(x=>x.id===i.ref);pedestal(g,cx,by);
      if(tr&&tr.kind==='boss'&&BOSSES[tr.boss])drawBossBody(g,BOSSES[tr.boss],cx,by-30,.3,t*.3,false);
      else if(tr){g.save();g.translate(cx,by-24);g.rotate(-.5);g.fillStyle='#ffcf4a';g.fillRect(-16,-4,30,8);g.strokeRect(-16,-4,30,8);g.fillStyle='#8a5a3a';g.fillRect(-16,2,8,10);g.restore()}
      if(HMAP.hover==='lay:'+i.id&&tr)label(g,tr.kind==='boss'?BOSSES[tr.boss].name:GUNS[tr.item.id].name,cx,by+2,'#ffcf4a');break}
    case'statue':{
      const L=S.legends.find(x=>x.id===i.ref);pedestal(g,cx,by);
      if(L)drawCreature(g,L,cx,by-30,.75,0,{face:1,stone:true,still:true});
      if(HMAP.hover==='lay:'+i.id&&L)label(g,L.name,cx,by+2,'#ffcf4a');break}
  }
  g.restore();
}
function drawPath(g,i){
  const x=tileX(i.x),y=tileY(i.y);g.fillStyle='rgba(201,180,138,.1)';g.fillRect(x,y+4,T,T-8);
  g.fillStyle='rgba(201,180,138,.2)';[[6,8,16,12],[27,11,15,11],[10,28,14,12],[29,29,15,11]].forEach(([a,b,w,h])=>{g.beginPath();g.ellipse(x+a+w/2,y+b+h/2,w/2,h/2,0,0,7);g.fill()});
}
// Warm light from lanterns and lamps after dark, drawn over the night tint.
function lights(g,t){
  g.save();g.globalCompositeOperation='lighter';
  for(const i of S.layout){
    if(i.key!=='lantern'&&i.key!=='mushlamp'&&i.key!=='fountain')continue;
    const [w,h]=foot(i.key),cx=tileX(i.x)+w*T/2,cy=tileY(i.y)+h*T-(i.key==='lantern'?52:28);
    const r=i.key==='lantern'?70:55,gr=g.createRadialGradient(cx,cy,2,cx,cy,r);
    gr.addColorStop(0,i.key==='lantern'?'rgba(255,200,110,.38)':'rgba(255,140,230,.3)');gr.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=gr;g.beginPath();g.arc(cx,cy,r+Math.sin(t*3)*2,0,7);g.fill();
  }
  g.restore();
}

/* ---------- creatures ---------- */
// Somewhere to wander: a random path tile, or anywhere in the yard if there are no paths.
function wanderSpot(){
  const paths=S.layout.filter(i=>i.key==='path');
  if(paths.length){const p=fxPick(paths);return{x:tileX(p.x)+fxRnd(8,T-8),y:tileY(p.y)+fxRnd(18,T-6)}}
  return{x:fxRnd(30,HMAP.W-30),y:fxRnd(tileY(0)+20,mapH()-20)};
}
function step(w,tx,ty,sp){const dx=tx-w.x,dy=ty-w.y,l=Math.hypot(dx,dy);if(l<2)return true;w.x+=dx/l*Math.min(sp,l);w.y+=dy/l*Math.min(sp*.75,l);if(Math.abs(dx)>1)w.face=dx<0?-1:1;return false}
// Every creature drawn this frame: [{y, draw}] so they sort in with the buildings.
function creatureSprites(t){
  const out=[],seen=new Set();
  // Workers bustle about in front of their stations.
  for(const i of S.layout){
    if(!isStation(i.key)||!SECTIONS[i.key])continue;const b=bbox(i);
    S.sections[i.key].ids.slice(0,5).forEach(id=>{const c=byId(id);if(!c)return;seen.add(id);
      let w=HMAP.wander[id];if(!w||w.mode!=='work:'+i.key){w=HMAP.wander[id]={mode:'work:'+i.key,x:b.x+fxRnd(-b.w*.5,b.w*.5),y:b.y+fxRnd(18,26),tx:0,ty:0,wait:fxRnd(0,2),face:1}}
      if(w.wait>0)w.wait-=1/60;else if(!w.tx||step(w,w.tx,w.ty,.6)){w.tx=b.x+fxRnd(-b.w*.6,b.w*.6);w.ty=b.y+fxRnd(16,26);w.wait=fxRnd(1,3)}
      out.push({y:w.y,draw:g=>drawCreature(g,c,w.x,w.y,.62,t,{face:w.face,seed:id})})});
  }
  // Off duty: sleeping, following a friend or playing. The plan is refreshed every second.
  if(t-HMAP.planT>1){HMAP.plan=lifePlan(dayPhase(t));HMAP.planT=t}
  const dens={};let n=0;
  for(const [id,p] of HMAP.plan){
    const c=byId(id);if(!c||seen.has(id)||n>=P.LIFE.maxDrawn)continue;n++;
    let w=HMAP.wander[id];
    if(!w||w.mode!==p.state){const s=w||wanderSpot();w=HMAP.wander[id]={mode:p.state,x:s.x,y:s.y,tx:0,ty:0,wait:fxRnd(0,1.5),face:1,hop:0}}
    if(p.state==='sleep'){
      const den=p.den&&S.layout.find(i=>i.id===p.den);
      if(den){const k=dens[den.id]=(dens[den.id]||0)+1,[fw]=foot('den');w.tx=tileX(den.x)+fw*T/2+(k-2)*24;w.ty=tileY(den.y)+T-2}else if(!w.tx){const s=wanderSpot();w.tx=s.x;w.ty=s.y}
      step(w,w.tx,w.ty,1.2);
      out.push({y:w.y,draw:g=>{drawCreature(g,c,w.x,w.y,.5,0,{face:w.face,seed:id,still:true});g.fillStyle='rgba(220,230,255,.85)';g.font='700 11px "Pixelify Sans",monospace';g.textAlign='center';const z=(t*.6+id*.37)%1;g.globalAlpha=1-z;g.fillText('z',w.x+8+z*6,w.y-14-z*14);g.globalAlpha=1}});
      continue;
    }
    if(p.state==='follow'){
      const f=HMAP.wander[p.friend];
      if(f){const dx=f.x-w.x,dy=f.y-w.y,l=Math.hypot(dx,dy);if(l>26)step(w,f.x-dx/l*22,f.y-dy/l*22,1.1)}
    }else{
      if(w.wait>0)w.wait-=1/60;else if(!w.tx||step(w,w.tx,w.ty,.8)){const s=wanderSpot();w.tx=s.x;w.ty=s.y;w.wait=fxRnd(.5,2.5);w.hop=fxRnd(0,1)<.5?1.2:0}
      if(w.hop>0)w.hop-=1/60;
    }
    const hop=p.state==='play'&&w.hop>0?Math.abs(Math.sin(t*10))*6:0;
    out.push({y:w.y,draw:g=>drawCreature(g,c,w.x,w.y-hop,.55,t,{face:w.face,seed:id})});
  }
  return out;
}

/* ---------- the whole map ---------- */
// Draws the hideout into g in map coordinates (HMAP.W × mapH()). Used by the live map and the snapshot.
function renderMapTo(g,t,o={}){
  const key=(S.plots||0)+'';if(!HMAP.bg||HMAP.bgKey!==key){HMAP.bg=hmapBg();HMAP.bgKey=key}
  g.drawImage(HMAP.bg,0,0);
  const ph=o.phase!=null?o.phase:dayPhase(t),night=isNight(ph);
  const glow=g.createRadialGradient(GATE.x,GATE.y+30,4,GATE.x,GATE.y+30,GATE.r+10);glow.addColorStop(0,`rgba(255,92,168,${.55+.2*Math.sin(t*2)})`);glow.addColorStop(1,'rgba(255,92,168,0)');g.fillStyle=glow;g.beginPath();g.arc(GATE.x,GATE.y+30,GATE.r+10,0,7);g.fill();
  g.strokeStyle=HMAP.hover==='gate'?'#ffcf4a':'#5d43a3';g.lineWidth=4;g.beginPath();g.ellipse(GATE.x,GATE.y+20,GATE.r+10,GATE.r,0,Math.PI,0);g.stroke();
  g.font='600 14px "Pixelify Sans",monospace';g.textAlign='center';g.fillStyle='rgba(14,10,31,.82)';g.fillRect(GATE.x-62,GATE.y-52,124,20);g.fillStyle='#ff9bbf';g.fillText('Into the Bloom',GATE.x,GATE.y-37);
  for(const i of S.layout)if(layer(i.key)==='ground')drawPath(g,i);
  if(HMAP.build&&!o.snapshot)drawGrid(g);
  // Buildings, decor and creatures, back to front.
  const list=S.layout.filter(i=>layer(i.key)==='solid').map(i=>{const [,h]=foot(i.key);return{y:tileY(i.y)+h*T-(isStation(i.key)?28:8),draw:g2=>isStation(i.key)?drawBuilding(g2,i.key,bbox(i),t):drawItem(g2,i,t,night)}});
  list.push(...creatureSprites(t));
  list.sort((a,b)=>a.y-b.y).forEach(d=>d.draw(g));
  syncNpcs();
  for(const id of NPC_IDS){if(!S.npc[id])continue;const p=npcSpot(id);drawPerson(g,id,p.x,p.y,1.15,t);
    if(npcAttention(id)){const by=p.y-38+Math.sin(t*4)*3;g.fillStyle='#ffcf4a';g.strokeStyle=OL;g.lineWidth=2;g.beginPath();g.arc(p.x,by,10,0,7);g.fill();g.stroke();g.fillStyle=OL;g.font='700 14px "Pixelify Sans",monospace';g.textAlign='center';g.fillText('!',p.x,by+5)}
    if(HMAP.hover==='npc:'+id){g.strokeStyle='#ffcf4a';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,22,0,7);g.stroke()}
    label(g,NPCS[id].name,p.x,p.y+18,NPCS[id].col)}
  // Day and night: a blue tint that deepens after dusk, with the lamps lit.
  const dark=night?.42:ph>P.LIFE.nightFrom-.08?(ph-(P.LIFE.nightFrom-.08))/.08*.42:ph<.06?(.06-ph)/.06*.42:0;
  if(dark>0){g.fillStyle=`rgba(8,6,40,${dark})`;g.fillRect(0,0,HMAP.W,mapH());lights(g,t)}
  if(!o.snapshot){g.font='600 12px "Pixelify Sans",monospace';g.textAlign='left';g.fillStyle='rgba(14,10,31,.75)';g.fillRect(8,8,74,18);g.fillStyle=night?'#b4c8ff':'#ffe08a';g.fillText(night?'☾ Night':'☀ Day',14,21)}
  if(HMAP.build&&!o.snapshot)drawBuildMarks(g);
}
function drawGrid(g){
  g.save();g.strokeStyle='rgba(246,238,219,.12)';g.lineWidth=1;
  for(let x=0;x<=G.cols;x++){g.beginPath();g.moveTo(x*T,G.top);g.lineTo(x*T,mapH());g.stroke()}
  for(let y=0;y<=rowCount();y++){g.beginPath();g.moveTo(0,G.top+y*T);g.lineTo(HMAP.W,G.top+y*T);g.stroke()}
  g.restore();
}
// The picked-up thing glows; the tile under the pointer shows where it would land, green or red.
function drawBuildMarks(g){
  const pk=HMAP.pick;g.save();
  if(pk&&pk.kind==='move'){const i=S.layout.find(x=>x.id===pk.id);if(i){const [w,h]=foot(i.key);g.strokeStyle='#ffcf4a';g.lineWidth=3;g.setLineDash([6,4]);g.strokeRect(tileX(i.x)+2,tileY(i.y)+2,w*T-4,h*T-4)}}
  const ht=HMAP.hoverTile;
  if(pk&&ht){const key=pk.kind==='move'?(S.layout.find(x=>x.id===pk.id)||{}).key:pk.key;
    if(key){const [w,h]=foot(key),a=anchor(key,ht),ok=fits(key,a.x,a.y,pk.kind==='move'?pk.id:undefined);
      g.setLineDash([]);g.fillStyle=ok?'rgba(93,232,176,.25)':'rgba(255,92,122,.25)';g.strokeStyle=ok?'#5de8b0':'#ff5c7a';g.lineWidth=2;g.fillRect(tileX(a.x),tileY(a.y),w*T,h*T);g.strokeRect(tileX(a.x),tileY(a.y),w*T,h*T)}}
  g.restore();
}
// The top-left tile that centres a footprint on the tapped tile.
const anchor=(key,tile)=>{const [w,h]=foot(key);return{x:tile.x-Math.floor((w-1)/2),y:tile.y-Math.floor((h-1)/2)}};

function drawHideoutMap(){
  const cv=$('#hmap');if(!cv||ui.tab!=='hideout'||R||$('#app').hidden){HMAP.raf=0;return}
  const dpr=Math.min(2,window.devicePixelRatio||1),rect=cv.getBoundingClientRect(),H=mapH();
  const Wp=Math.round(rect.width*dpr),Hp=Math.round(rect.width*H/HMAP.W*dpr);
  if(cv.width!==Wp||cv.height!==Hp){cv.width=Wp;cv.height=Hp}
  const g=cv.getContext('2d');HMAP.t+=1/60;HMAP.H=H;
  g.setTransform(Wp/HMAP.W,0,0,Hp/H,0,0);
  renderMapTo(g,HMAP.t);
  HMAP.raf=requestAnimationFrame(drawHideoutMap);
}

/* ---------- pointer ---------- */
function mapPoint(e){const cv=$('#hmap'),r=cv.getBoundingClientRect();return{x:(e.clientX-r.left)*HMAP.W/r.width,y:(e.clientY-r.top)*mapH()/r.height}}
// What's under the pointer: an NPC, the gate, or a placed thing ('lay:<id>', or a station's key).
function hmapHit(e){
  const {x,y}=mapPoint(e);
  for(const id of NPC_IDS){if(!S.npc[id])continue;const p=npcSpot(id);if(Math.hypot(x-p.x,y-(p.y-4))<24)return'npc:'+id}
  if(Math.hypot(x-GATE.x,y-(GATE.y+20))<GATE.r+12)return'gate';
  const tl=toTile(x,y);let i=itemAt(tl.x,tl.y);
  // Buildings stand taller than their footprint: the row above counts too.
  if(!i||layer(i.key)==='ground'){const up=itemAt(tl.x,tl.y+1);if(up&&isStation(up.key))i=up}
  if(!i)return null;
  if(isStation(i.key))return i.key;
  if(i.key==='board')return'board';
  return'lay:'+i.id;
}
function buildClick(e){
  const {x,y}=mapPoint(e),tl=toTile(x,y),pk=HMAP.pick;
  if(pk&&pk.kind==='place'){const a=anchor(pk.key,tl);if(placeNew(pk.key,a.x,a.y,pk.ref)){sfx('pickup');HMAP.pick=null;save();renderBuildPanel()}else sfx('ui');return}
  if(pk&&pk.kind==='move'){const i=S.layout.find(z=>z.id===pk.id);if(i){const a=anchor(i.key,tl);if(moveItem(i.id,a.x,a.y)){sfx('pickup');HMAP.pick=null;save();renderBuildPanel();return}}}
  const hit=itemAt(tl.x,tl.y)||(()=>{const up=itemAt(tl.x,tl.y+1);return up&&isStation(up.key)?up:null})();
  HMAP.pick=hit?{kind:'move',id:hit.id}:null;sfx('ui');renderBuildPanel();
}
function startHideoutMap(){
  const cv=$('#hmap');if(!cv)return;
  cv.onmousemove=e=>{if(HMAP.build){HMAP.hoverTile=toTile(mapPoint(e).x,mapPoint(e).y);HMAP.hover=null;cv.style.cursor='crosshair';return}HMAP.hover=hmapHit(e);cv.style.cursor=HMAP.hover?'pointer':'default'};
  cv.onmouseleave=()=>{HMAP.hover=null;HMAP.hoverTile=null};
  cv.onclick=e=>{
    if(HMAP.build){HMAP.hoverTile=toTile(mapPoint(e).x,mapPoint(e).y);buildClick(e);return}
    const h=hmapHit(e);if(!h)return;sfx('ui');
    if(h==='gate'){act('tab',{k:'raid'});return}
    if(h==='board'){act('tab',{k:'codex'});return}
    if(h.startsWith('npc:')){openNpc(h.slice(4));return}
    if(h.startsWith('lay:')){const i=S.layout.find(z=>z.id===+h.slice(4));if(i&&i.key==='trophy')openTrophy(i.ref);if(i&&i.key==='statue')openLegend(i.ref);return}
    if(h==='archive'){act('tab',{k:'research'});return}
    ui.section=h;HMAP.sel=h;renderSecPanel()};
  HMAP.sel=ui.section;
  if(!HMAP.raf)HMAP.raf=requestAnimationFrame(drawHideoutMap);
}

export {HMAP,GATE,NPC_HOME,mapH,tileX,tileY,toTile,bbox,npcSpot,hmapBg,hmapTier,drawBuilding,shade,drawItem,renderMapTo,drawHideoutMap,hmapHit,anchor,buildClick,startHideoutMap};
