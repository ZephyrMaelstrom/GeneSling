/* ================= Hideout map: buildings grow with tiers, creatures wander, NPCs wait ================= */
import {$,fxRnd} from './util.js';
import {NPCS,NPC_IDS,RES_IDS,SECTIONS} from './content.js';
import {S,byId,npcAttention,secTier,sectionUnlocked,syncNpcs,ui} from './state.js';
import {OL,drawCreature,drawPerson} from './sprites.js';
import {sfx} from './audio.js';
import {act,openNpc,renderSecPanel} from './ui.js';
import {R} from './raid.js';
const HMAP={W:1000,H:470,raf:0,bg:null,wander:{},hover:null,t:0};
const BUILD={
  nursery:{x:150,y:200,w:120},training:{x:390,y:185,w:130},warroom:{x:625,y:185,w:120},archive:{x:860,y:200,w:120,link:'research',name:'Archive'},
  forge:{x:110,y:375,w:125},garden:{x:300,y:395,w:125},spring:{x:500,y:405,w:130},roost:{x:700,y:375,w:115},vault:{x:885,y:395,w:120},
};
const NPC_SPOT={brannoc:{x:195,y:395},pip:{x:775,y:395},sorrel:{x:225,y:215}};
const GATE={x:500,y:84,r:46};
const BOARD={x:500,y:262};
function hmapBg(){
  const c=document.createElement('canvas');c.width=HMAP.W;c.height=HMAP.H;const g=c.getContext('2d');
  const sky=g.createLinearGradient(0,0,0,HMAP.H);sky.addColorStop(0,'#0e0a1f');sky.addColorStop(.35,'#1b1438');sky.addColorStop(1,'#2a2050');
  g.fillStyle=sky;g.fillRect(0,0,HMAP.W,HMAP.H);
  g.fillStyle='#120c26';g.beginPath();g.moveTo(0,0);for(let x=0;x<=HMAP.W;x+=40)g.lineTo(x,90+Math.sin(x*.05)*18+((x*7)%23));g.lineTo(HMAP.W,0);g.closePath();g.fill();
  g.fillStyle='#2f2558';g.beginPath();g.moveTo(0,140);for(let x=0;x<=HMAP.W;x+=25)g.lineTo(x,128+Math.sin(x*.03)*10);g.lineTo(HMAP.W,HMAP.H);g.lineTo(0,HMAP.H);g.closePath();g.fill();
  for(let i=0;i<260;i++){const x=(i*137.5)%HMAP.W,y=150+((i*61)%310);g.fillStyle=i%3?'rgba(255,255,255,.04)':'rgba(0,0,0,.12)';g.fillRect(x,y,3+(i%4),2)}
  g.strokeStyle='rgba(201,180,138,.25)';g.lineWidth=14;g.lineCap='round';g.beginPath();g.moveTo(500,120);g.lineTo(500,300);g.moveTo(110,330);g.quadraticCurveTo(500,290,890,330);g.moveTo(150,180);g.quadraticCurveTo(500,250,860,180);g.stroke();
  for(let i=0;i<26;i++){const x=(i*173)%HMAP.W,y=145+((i*97)%300);if(Math.abs(x-500)<70&&y<300)continue;const col=['#5de8b0','#ff8fe0','#58c2ff','#ffcf4a'][i%4];g.fillStyle='#f2e4c9';g.fillRect(x-1,y-6,3,7);g.fillStyle=col;g.beginPath();g.ellipse(x,y-6,6,4,0,Math.PI,0);g.fill()}
  return c;
}
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
function drawHideoutMap(){
  const cv=$('#hmap');if(!cv||ui.tab!=='hideout'||R||$('#app').hidden){HMAP.raf=0;return}
  const dpr=window.devicePixelRatio||1,rect=cv.getBoundingClientRect();
  const W=Math.round(rect.width*dpr),H=Math.round(rect.width*HMAP.H/HMAP.W*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}
  const g=cv.getContext('2d');HMAP.t+=1/60;const t=HMAP.t;
  g.setTransform(W/HMAP.W,0,0,H/HMAP.H,0,0);
  if(!HMAP.bg)HMAP.bg=hmapBg();g.drawImage(HMAP.bg,0,0);
  g.fillStyle='#0a0718';g.beginPath();g.ellipse(GATE.x,GATE.y+20,GATE.r+10,GATE.r,0,Math.PI,0);g.lineTo(GATE.x+GATE.r+10,GATE.y+40);g.lineTo(GATE.x-GATE.r-10,GATE.y+40);g.closePath();g.fill();
  const glow=g.createRadialGradient(GATE.x,GATE.y+30,4,GATE.x,GATE.y+30,GATE.r+10);glow.addColorStop(0,`rgba(255,92,168,${.55+.2*Math.sin(t*2)})`);glow.addColorStop(1,'rgba(255,92,168,0)');g.fillStyle=glow;g.beginPath();g.arc(GATE.x,GATE.y+30,GATE.r+10,0,7);g.fill();
  g.strokeStyle=HMAP.hover==='gate'?'#ffcf4a':'#5d43a3';g.lineWidth=4;g.beginPath();g.ellipse(GATE.x,GATE.y+20,GATE.r+10,GATE.r,0,Math.PI,0);g.stroke();
  g.font='600 14px "Pixelify Sans",monospace';g.textAlign='center';g.fillStyle='rgba(14,10,31,.82)';g.fillRect(GATE.x-62,GATE.y-52,124,20);g.fillStyle='#ff9bbf';g.fillText('Into the Bloom',GATE.x,GATE.y-37);
  g.fillStyle='#6b4a2a';g.strokeStyle=OL;g.lineWidth=3;g.fillRect(BOARD.x-4,BOARD.y-10,8,30);g.fillRect(BOARD.x-34,BOARD.y-44,68,38);g.strokeRect(BOARD.x-34,BOARD.y-44,68,38);
  g.fillStyle='#f6eedb';[[-26,-38],[-2,-40],[12,-34]].forEach(([dx,dy])=>{g.fillRect(BOARD.x+dx,BOARD.y+dy,14,16)});
  g.fillStyle='rgba(14,10,31,.82)';g.fillRect(BOARD.x-36,BOARD.y+22,72,20);g.fillStyle=HMAP.hover==='board'?'#ffcf4a':'#f6eedb';g.fillText('Codex',BOARD.x,BOARD.y+37);
  const order=Object.entries(BUILD).sort((a,b)=>a[1].y-b[1].y);
  for(const[k,b]of order){
    drawBuilding(g,k,b,t);
    if(!SECTIONS[k])continue;
    const ids=S.sections[k].ids.slice(0,5);
    ids.forEach((id,i)=>{const c=byId(id);if(!c)return;
      let w=HMAP.wander[id];if(!w||w.k!==k){w=HMAP.wander[id]={k,x:b.x+fxRnd(-b.w*.5,b.w*.5),y:b.y+fxRnd(30,48),tx:0,ty:0,wait:fxRnd(0,2),face:1}}
      if(w.wait>0){w.wait-=1/60}else{const dx=w.tx-w.x,dy=w.ty-w.y,l=Math.hypot(dx,dy);if(l<2||!w.tx){w.tx=b.x+fxRnd(-b.w*.6,b.w*.6);w.ty=b.y+fxRnd(28,50);w.wait=fxRnd(1,3)}else{w.x+=dx/l*.6;w.y+=dy/l*.4;w.face=dx<0?-1:1}}
      drawCreature(g,c,w.x,w.y,.62,t,{face:w.face,seed:id})});
  }
  syncNpcs();
  for(const id of NPC_IDS){if(!S.npc[id])continue;const p=NPC_SPOT[id];drawPerson(g,id,p.x,p.y,1.15,t);
    if(npcAttention(id)){const by=p.y-38+Math.sin(t*4)*3;g.fillStyle='#ffcf4a';g.strokeStyle=OL;g.lineWidth=2;g.beginPath();g.arc(p.x,by,10,0,7);g.fill();g.stroke();g.fillStyle=OL;g.font='700 14px "Pixelify Sans",monospace';g.textAlign='center';g.fillText('!',p.x,by+5)}
    if(HMAP.hover==='npc:'+id){g.strokeStyle='#ffcf4a';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,22,0,7);g.stroke()}
    g.font='600 12px "Pixelify Sans",monospace';g.textAlign='center';g.fillStyle='rgba(14,10,31,.8)';const nm=NPCS[id].name,tw=g.measureText(nm).width+10;g.fillRect(p.x-tw/2,p.y+18,tw,16);g.fillStyle=NPCS[id].col;g.fillText(nm,p.x,p.y+30)}
  HMAP.raf=requestAnimationFrame(drawHideoutMap);
}
function hmapHit(e){
  const cv=$('#hmap');const r=cv.getBoundingClientRect();const x=(e.clientX-r.left)*HMAP.W/r.width,y=(e.clientY-r.top)*HMAP.H/r.height;
  for(const id of NPC_IDS){if(!S.npc[id])continue;const p=NPC_SPOT[id];if(Math.hypot(x-p.x,y-(p.y-4))<24)return'npc:'+id}
  if(Math.hypot(x-GATE.x,y-(GATE.y+20))<GATE.r+12)return'gate';
  if(Math.abs(x-BOARD.x)<40&&y>BOARD.y-48&&y<BOARD.y+44)return'board';
  for(const[k,b]of Object.entries(BUILD)){const h=44+5*9+40;if(Math.abs(x-b.x)<b.w*.62&&y>b.y-h&&y<b.y+34)return k}
  return null;
}
function startHideoutMap(){
  const cv=$('#hmap');if(!cv)return;
  cv.onmousemove=e=>{HMAP.hover=hmapHit(e);cv.style.cursor=HMAP.hover?'pointer':'default'};
  cv.onmouseleave=()=>{HMAP.hover=null};
  cv.onclick=e=>{const h=hmapHit(e);if(!h)return;sfx('ui');
    if(h==='gate'){act('tab',{k:'raid'});return}
    if(h==='board'){act('tab',{k:'codex'});return}
    if(h.startsWith('npc:')){openNpc(h.slice(4));return}
    if(BUILD[h].link){act('tab',{k:BUILD[h].link});return}
    ui.section=h;HMAP.sel=h;renderSecPanel()};
  HMAP.sel=ui.section;
  if(!HMAP.raf)HMAP.raf=requestAnimationFrame(drawHideoutMap);
}

export {HMAP,BUILD,NPC_SPOT,GATE,BOARD,hmapBg,hmapTier,drawBuilding,shade,drawHideoutMap,hmapHit,startHideoutMap};
