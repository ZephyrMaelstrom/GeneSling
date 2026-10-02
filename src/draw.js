/* ---------- drawing ---------- */
import {$,TOUCH,clamp,dist,esc,fxRnd} from './util.js';
import {LORE,ABILITIES,BUFFS,CURSES,ELEM,GUNS,ROOM_MODS,SPECIES,TYPES,comboFor} from './content.js';
import {loadSave,migrate,save} from './save.js';
import {S,formName,newGame,secTier,setS,sexSym,stats,supportText} from './state.js';
import {itemName} from './jobs.js';
import {OL,drawCreature} from './sprites.js';
import {auVol,sfx} from './audio.js';
import {openIntro,renderAll,weaponLine} from './ui.js';
import {CU,R,RH,RW,TS,applyBuff,applyCurse,bagUsed,buy,cageReady,canRelease,releaseCreature,capRadius,comboReady,doRoll,endRaid,interact,isWeak,keys,modOn,msg,stickBases,stickR,swapSlot3,switchGun,touch,update,useAbility,useCage,useCombo} from './raid.js';
import {startMarket} from './exchange/market.js';
import {pickEnding,chooseVein,drawDark,drawShadow,drawTwists} from './veins.js';
import {sessionStart} from './demo.js';
import {runeWall} from './endgame.js';
import {applyPalette,bulletCol,frameTime,renderScale} from './access.js';
let ctx,cv,mini,mctx;
// Pins the page while a raid is on screen and restores the hideout's scroll position after.
let pageScroll=0;
function lockPage(on){
  const h=document.documentElement;if(on===h.classList.contains('raiding'))return;
  if(on){pageScroll=window.scrollY;h.classList.add('raiding')}else{h.classList.remove('raiding');window.scrollTo(0,pageScroll)}
}
// On phones a raid goes full screen and turns the screen sideways where the browser allows it
// (Chrome on Android does, from a tap). Anywhere it doesn't, nothing happens.
function goLandscape(){
  if(S.opts.fullscreen===false)return;
  const el=document.documentElement,o=screen.orientation;
  const lock=()=>{try{if(o&&o.lock)o.lock('landscape').catch(()=>{})}catch(e){}};
  try{
    if(document.fullscreenElement){lock();return}
    if(el.requestFullscreen)el.requestFullscreen({navigationUI:'hide'}).then(lock).catch(()=>{});
  }catch(e){}
}
// Belt and braces for browsers that still scroll a pinned page: swallow every touch drag mid-raid.
// Nothing in a raid scrolls: its menus are laid out to fit the screen at once (see fitOverlay).
document.addEventListener('touchmove',e=>{if(document.documentElement.classList.contains('raiding'))e.preventDefault()},{passive:false});
function resize(){
  // The render scale follows the Quality setting (auto steps down on slow phones; see access.js).
  const dpr=renderScale();cv.width=Math.round(innerWidth*dpr);cv.height=Math.round(innerHeight*dpr);
  if(R){R.vw=innerWidth;R.vh=innerHeight;R.dpr=dpr;R.scale=clamp(Math.min(innerWidth,innerHeight)/(TS*10.5),.7,1.6)}
}
function drawFoeBody(g,d,x,y,s,t,o){
  const c=o.flash?'#fff':d.col,seed=o.seed||0,face=o.face||1;
  g.save();g.translate(x,y);g.scale(s,s);
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(0,14,13,4,0,0,7);g.fill();
  g.strokeStyle=OL;g.lineWidth=2.2;g.lineJoin='round';
  const fs=()=>{g.fill();g.stroke()};
  const eye=(ex,ey,r)=>{g.fillStyle='#ffef9a';g.beginPath();g.arc(ex,ey,r,0,7);fs();g.fillStyle='#d6243f';g.fillRect(ex-1,ey-1,2,2)};
  switch(d.body){
    case'blob':{const b=Math.sin(t*5+seed)*1.5;g.fillStyle=c;g.beginPath();g.ellipse(0,b,13,12,0,0,7);fs();g.fillStyle='rgba(0,0,0,.25)';g.fillRect(-13,4+b,26,5);eye(face*3,-2+b,4);break}
    case'bat':{const w=Math.sin(t*16+seed)*5;g.fillStyle=c;[-1,1].forEach(k=>{g.beginPath();g.moveTo(k*4,0);g.lineTo(k*18,-7+w);g.lineTo(k*13,5);g.closePath();fs()});g.beginPath();g.arc(0,0,8,0,7);fs();g.fillStyle='#ff4f6e';g.fillRect(-4,-2,3,3);g.fillRect(2,-2,3,3);break}
    case'grub':{const dir=o.dir!=null?o.dir:(face<0?Math.PI:0);g.rotate(dir);g.fillStyle=c;[-12,-5].forEach(px=>{g.beginPath();g.arc(px,0,8,0,7);fs()});g.beginPath();g.arc(4,0,10,0,7);fs();g.fillStyle=OL;g.beginPath();g.moveTo(8,-4);g.lineTo(15,0);g.lineTo(8,4);g.closePath();g.fill();g.fillStyle='#ffef9a';g.fillRect(4,-6,3,3);g.fillRect(4,3,3,3);break}
    case'totem':{g.fillStyle=c;g.fillRect(-11,-18,22,32);g.strokeRect(-11,-18,22,32);g.fillStyle='rgba(0,0,0,.3)';g.fillRect(-11,-18,22,6);g.fillStyle=d.bcol||'#fff';g.globalAlpha=.6+.4*Math.sin(t*4+seed);g.beginPath();g.arc(0,0,5,0,7);g.fill();g.globalAlpha=1;
      if(d.dmg===0){g.strokeStyle=OL;g.beginPath();g.moveTo(-16,-4);g.lineTo(16,-4);g.stroke();g.fillStyle='#ff6688';g.beginPath();g.arc(0,0,7,0,7);g.fill();g.fillStyle='#fff';g.beginPath();g.arc(0,0,4,0,7);g.fill();g.fillStyle='#ff6688';g.beginPath();g.arc(0,0,2,0,7);g.fill()}break}
    case'wisp':{const fl=Math.sin(t*10+seed)*3;g.fillStyle=d.col;g.globalAlpha=.35;g.beginPath();g.arc(0,0,14,0,7);g.fill();g.globalAlpha=1;g.beginPath();g.moveTo(-6,2);g.quadraticCurveTo(-face*16,8+fl,-face*18,-4);g.quadraticCurveTo(-face*8,-2,-6,-4);g.fill();g.fillStyle=o.flash?'#fff':'#f6ffff';g.beginPath();g.arc(0,0,7,0,7);fs();g.fillStyle=OL;g.fillRect(-3,-2,2,3);g.fillRect(2,-2,2,3);break}
    case'slime':{const sq=1+Math.sin(t*4+seed)*.06;g.scale(1/sq,sq);g.fillStyle=c;g.beginPath();g.moveTo(-14,10);g.quadraticCurveTo(-15,-12,0,-13);g.quadraticCurveTo(15,-12,14,10);g.closePath();fs();g.fillStyle='rgba(255,255,255,.4)';g.beginPath();g.ellipse(-5,-5,3,5,-.4,0,7);g.fill();g.fillStyle=OL;g.fillRect(-4,0,3,4);g.fillRect(3,0,3,4);break}
    case'imp':{g.fillStyle=c;g.beginPath();g.moveTo(-10,12);g.lineTo(0,-8);g.lineTo(10,12);g.closePath();fs();g.beginPath();g.arc(0,-6,7,0,7);fs();g.fillStyle='#f6eedb';[-1,1].forEach(k=>{g.beginPath();g.moveTo(k*3,-11);g.lineTo(k*8,-19);g.lineTo(k*7,-9);g.closePath();fs()});g.fillStyle='#ffef9a';g.fillRect(-4,-8,3,2);g.fillRect(2,-8,3,2);break}
    case'spider':{g.strokeStyle=OL;g.lineWidth=2;const w=Math.sin(t*14+seed)*2;for(let i=0;i<4;i++)[-1,1].forEach(k=>{g.beginPath();g.moveTo(0,0);g.lineTo(k*14,-8+i*5+(i%2?w:-w));g.lineTo(k*17,-2+i*5);g.stroke()});g.fillStyle=c;g.beginPath();g.ellipse(0,0,10,8,0,0,7);fs();g.fillStyle='#ff4f6e';[-4,-1,2,5].forEach(px=>g.fillRect(px-1,-3,2,2));break}
    case'knight':{g.fillStyle='#c9c4d8';g.fillRect(face*6,-6,8*face,16);g.strokeRect(face*6,-6,8*face,16);g.fillStyle=c;g.beginPath();g.moveTo(-11,12);g.lineTo(-11,-6);g.quadraticCurveTo(0,-18,11,-6);g.lineTo(11,12);g.closePath();fs();g.fillStyle=OL;g.fillRect(-7,-6,14,3);g.fillStyle=d.bcol||'#fff';g.fillRect(-5,-6,3,3);g.fillRect(2,-6,3,3);break}
    case'eye':{g.fillStyle=c;g.beginPath();g.arc(0,0,13,0,7);fs();g.fillStyle='#f6eedb';g.beginPath();g.arc(0,0,8,0,7);fs();g.fillStyle=OL;g.beginPath();g.arc(Math.cos(t*2+seed)*3,Math.sin(t*1.5+seed)*2,4,0,7);g.fill();[0,1,2,3].forEach(i=>{const a=i*Math.PI/2+t;g.fillStyle=c;g.beginPath();g.moveTo(Math.cos(a)*12,Math.sin(a)*12);g.lineTo(Math.cos(a+.2)*18,Math.sin(a+.2)*18);g.lineTo(Math.cos(a+.4)*12,Math.sin(a+.4)*12);g.fill()});break}
    case'skull':{g.fillStyle=c;g.beginPath();g.arc(0,-3,11,Math.PI,0);g.lineTo(11,4);g.lineTo(6,10);g.lineTo(-6,10);g.lineTo(-11,4);g.closePath();fs();g.fillStyle=OL;g.beginPath();g.arc(-4,-2,3.2,0,7);g.arc(4,-2,3.2,0,7);g.fill();g.fillStyle=d.bcol;g.fillRect(-5,-3,2,2);g.fillRect(3,-3,2,2);g.fillStyle=OL;g.fillRect(-4,6,2,3);g.fillRect(0,6,2,3);g.fillRect(4,6,1,3);break}
    case'brute':{g.fillStyle=c;g.fillRect(-14,-14,28,26);g.strokeRect(-14,-14,28,26);g.fillStyle='rgba(255,255,255,.12)';g.fillRect(-14,-14,28,7);g.fillStyle=d.bcol;g.fillRect(-8,-5,5,4);g.fillRect(3,-5,5,4);g.fillStyle=OL;g.fillRect(-6,4,12,3);break}
  }
  g.restore();
}
function drawBossBody(g,d,x,y,s,t,flash){
  const c=flash?'#fff':d.col,c2=flash?'#fff':d.col2;
  g.save();g.translate(x,y);g.scale(s,s);
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(0,40,40,10,0,0,7);g.fill();
  g.strokeStyle=OL;g.lineWidth=3;g.lineJoin='round';
  const fs=()=>{g.fill();g.stroke()};
  switch(d.body){
    case'bloom':{for(let i=0;i<8;i++){const a=i/8*Math.PI*2+Math.sin(t)*.1;g.save();g.rotate(a);g.fillStyle=i%2?c:d.bcol;g.beginPath();g.ellipse(0,-26,11,20,0,0,7);fs();g.restore()}
      g.fillStyle=c2;g.beginPath();g.arc(0,0,18,0,7);fs();g.fillStyle='#fff';g.beginPath();g.arc(0,0,9,0,7);fs();g.fillStyle=OL;g.beginPath();g.arc(Math.cos(t)*3,Math.sin(t*1.3)*3,5,0,7);g.fill();break}
    case'wyrm':{for(let i=5;i>=1;i--){const ox=-i*16,oy=Math.sin(t*3-i*.8)*10;g.fillStyle=i%2?c:c2;g.beginPath();g.arc(ox,oy,20-i*2,0,7);fs()}
      g.fillStyle=c;g.beginPath();g.ellipse(6,0,26,20,0,0,7);fs();g.fillStyle='#f6eedb';[-1,1].forEach(k=>{g.beginPath();g.moveTo(-2,k*12);g.lineTo(-14,k*30);g.lineTo(6,k*16);g.closePath();fs()});
      g.fillStyle='#ffef9a';g.beginPath();g.arc(18,-7,5,0,7);fs();g.beginPath();g.arc(18,7,5,0,7);fs();g.fillStyle=OL;g.fillRect(19,-8,2,3);g.fillRect(19,6,2,3);break}
    case'king':{g.fillStyle='#c9c4d8';g.fillRect(18,-14,14,34);g.strokeRect(18,-14,14,34);g.fillStyle=c;g.beginPath();g.moveTo(-26,30);g.lineTo(-26,-10);g.quadraticCurveTo(0,-40,26,-10);g.lineTo(26,30);g.closePath();fs();
      g.fillStyle=OL;g.fillRect(-18,-10,36,7);g.fillStyle=d.bcol;g.fillRect(-12,-10,6,5);g.fillRect(6,-10,6,5);
      g.fillStyle=c2;g.beginPath();g.moveTo(-18,-28);g.lineTo(-18,-42);g.lineTo(-9,-34);g.lineTo(0,-46);g.lineTo(9,-34);g.lineTo(18,-42);g.lineTo(18,-28);g.closePath();fs();break}
    case'roc':{const w=Math.sin(t*6)*10;g.fillStyle=c2;[-1,1].forEach(k=>{g.beginPath();g.moveTo(k*10,-4);g.quadraticCurveTo(k*50,-30+w,k*56,6);g.quadraticCurveTo(k*30,8,k*10,10);g.closePath();fs()});
      g.fillStyle=c;g.beginPath();g.ellipse(0,4,22,26,0,0,7);fs();g.fillStyle='#ffb347';g.beginPath();g.moveTo(-6,-10);g.lineTo(0,4);g.lineTo(6,-10);g.closePath();fs();
      g.fillStyle='#fff';g.fillRect(-12,-18,7,7);g.fillRect(5,-18,7,7);g.fillStyle=OL;g.fillRect(-9,-15,3,3);g.fillRect(8,-15,3,3);break}
    case'diamond':{g.fillStyle=c;g.beginPath();g.moveTo(0,-44);g.lineTo(32,-6);g.lineTo(0,38);g.lineTo(-32,-6);g.closePath();fs();g.strokeStyle='rgba(255,255,255,.6)';g.lineWidth=2;g.beginPath();g.moveTo(-32,-6);g.lineTo(32,-6);g.moveTo(0,-44);g.lineTo(-10,-6);g.lineTo(0,38);g.moveTo(0,-44);g.lineTo(10,-6);g.stroke();
      for(let i=0;i<3;i++){const a=t+i*2.09;g.fillStyle=c2;g.strokeStyle=OL;g.lineWidth=2;g.save();g.translate(Math.cos(a)*48,Math.sin(a)*30);g.beginPath();g.moveTo(0,-10);g.lineTo(7,0);g.lineTo(0,10);g.lineTo(-7,0);g.closePath();fs();g.restore()}break}
    case'choir':{g.fillStyle='rgba(60,20,90,.4)';g.beginPath();g.arc(0,0,44,0,7);g.fill();
      [[0,-20],[-22,14],[22,14]].forEach(([ex,ey],i)=>{g.fillStyle=c;g.beginPath();g.arc(ex,ey,16,0,7);fs();g.fillStyle='#f6eedb';g.beginPath();g.arc(ex,ey,10,0,7);fs();g.fillStyle=c2;g.beginPath();g.arc(ex+Math.cos(t*2+i)*4,ey+Math.sin(t*2+i)*3,5,0,7);g.fill()});break}
    case'prime':{g.fillStyle=c;g.fillRect(-36,-32,72,64);g.strokeRect(-36,-32,72,64);g.fillStyle='rgba(255,255,255,.1)';g.fillRect(-36,-32,72,12);g.fillStyle='#2a2a3a';[-1,1].forEach(k=>{g.fillRect(k>0?36:-50,-20,14,30);g.strokeRect(k>0?36:-50,-20,14,30)});
      g.fillStyle=c2;g.fillRect(-20,-12,12,8);g.fillRect(8,-12,12,8);g.fillStyle=OL;g.fillRect(-14,10,28,6);break}
  }
  g.restore();
}
function lightning(g,a,b,col){g.strokeStyle=col;g.lineWidth=3;g.beginPath();g.moveTo(a.x,a.y);const n=6;for(let i=1;i<n;i++){const k=i/n;g.lineTo(a.x+(b.x-a.x)*k+fxRnd(-8,8),a.y+(b.y-a.y)*k+fxRnd(-8,8))}g.lineTo(b.x,b.y);g.stroke();g.strokeStyle='#fff';g.lineWidth=1;g.stroke()}
function draw(){
  const g=ctx,p=R.p,s=R.scale,dpr=R.dpr,t=R.t,M=R.map;
  R.camx=p.x;R.camy=p.y;
  const sx=R.shake>0?fxRnd(-3,3):0,sy=R.shake>0?fxRnd(-3,3):0;
  g.setTransform(dpr,0,0,dpr,0,0);g.fillStyle='#0d0a1c';g.fillRect(0,0,R.vw,R.vh);
  g.imageSmoothingEnabled=false;
  g.setTransform(dpr*s,0,0,dpr*s,dpr*(R.vw/2-R.camx*s+sx),dpr*(R.vh/2-R.camy*s+sy));
  const vx0=R.camx-R.vw/2/s-TS,vy0=R.camy-R.vh/2/s-TS,vw=R.vw/s+TS*2,vh=R.vh/s+TS*2;
  const cx0=Math.max(0,vx0),cy0=Math.max(0,vy0),cw=Math.min(R.mapCv.width-cx0,vw),ch=Math.min(R.mapCv.height-cy0,vh);
  if(cw>0&&ch>0)g.drawImage(R.mapCv,cx0,cy0,cw,ch,cx0,cy0,cw,ch);
  M.rooms.forEach(r=>{if(r.mod&&r.visited){g.strokeStyle=ROOM_MODS[r.mod].col;g.globalAlpha=.35+.15*Math.sin(t*2);g.lineWidth=4;g.strokeRect(r.ox*TS+2,r.oy*TS+2,RW*TS-4,RH*TS-4);g.globalAlpha=1}
    if(!r.locked)return;
    // Sealed for good (a gauntlet's way back, a sinkhole): rubble, not the red bars of a fight.
    if(r.sealed){r.doors.forEach(i=>{const x=(i%M.W)*TS,y=Math.floor(i/M.W)*TS;g.fillStyle='#4a3e30';g.fillRect(x,y,TS,TS);g.fillStyle='#6e5c45';g.fillRect(x+3,y+4,12,10);g.fillRect(x+16,y+14,13,12);g.fillStyle='#2e261d';g.fillRect(x+6,y+20,8,7)});return}
    r.doors.forEach(i=>{const x=(i%M.W)*TS,y=Math.floor(i/M.W)*TS;g.fillStyle='#5a1d33';g.fillRect(x,y,TS,TS);g.fillStyle='#ff6688';for(let k=4;k<TS;k+=9)g.fillRect(x+k,y,3,TS);g.fillRect(x,y,TS,3)})});
  if(R.heardCrack||S.settings.reveal||secTier('roost')>=3||R.scout){for(const[i]of M.cracks){const x=(i%M.W+.5)*TS,y=(Math.floor(i/M.W)+.5)*TS;g.globalAlpha=.35+.3*Math.sin(t*5+i);g.fillStyle='#ffcf4a';g.beginPath();g.arc(x+Math.sin(t*3+i)*6,y+Math.cos(t*2+i)*6,2.5,0,7);g.fill();g.globalAlpha=1}}
  g.font='600 12px "Pixelify Sans", monospace';g.textAlign='center';
  M.rooms.forEach(r=>{
    if(r.hidden)return;   // a secret room shows nothing (not even its chest) until its wall is broken
    if(r.kind==='stairs'){g.fillStyle='#120c24';g.fillRect(r.cx-26,r.cy-26,52,52);for(let k=0;k<4;k++){g.fillStyle=k%2?'#3a2e66':'#4b3d85';g.fillRect(r.cx-26+k*4,r.cy-26+k*13,52-k*8,11)}g.fillStyle='#ffcf4a';g.fillText('STAIRS DOWN',r.cx,r.cy-34)}
    const zone=(x,y,col,label)=>{const pulse=4+Math.sin(t*3)*4;g.globalAlpha=.25;g.fillStyle=col;g.beginPath();g.arc(x,y,44+pulse,0,7);g.fill();g.globalAlpha=1;g.strokeStyle=col;g.lineWidth=3;g.setLineDash([8,6]);g.lineDashOffset=-t*20;g.beginPath();g.arc(x,y,44,0,7);g.stroke();g.setLineDash([]);g.fillStyle=col;g.fillText(label,x,y-56)};
    if(['gate','rift','cliff'].includes(r.kind)){
      const col={gate:'#ffcf4a',rift:'#9b7bff',cliff:'#4fe0c8'}[r.kind];zone(r.cx,r.cy,col,{gate:`GATE · ${M.floor>=4?40:20} COIN`,rift:'RIFT',cliff:'CLIFF · NEEDS GALE'}[r.kind]);
      if(R.cur===r&&R.ext>0){g.strokeStyle='#fff';g.lineWidth=5;g.beginPath();g.arc(r.cx,r.cy,52,-Math.PI/2,-Math.PI/2+R.ext/2.5*Math.PI*2);g.stroke()}
    }
    if(r.kind==='portal'){zone(r.cx-80,r.cy,'#9b7bff','RIFT HOME');if(r.deep)zone(r.cx+80,r.cy,'#ff5c7a',M.floor===3?'THE VEINS ↓':M.floor===6?'UNDERHEART ↓':'THE HEART ↓')}
    if(r.kind==='shop'){drawPeddler(g,r.cx,r.cy,t);g.fillStyle='#ffcf4a';g.fillText('PEDDLER',r.cx,r.cy-34)}
    if(r.kind==='shrine'){drawShrine(g,r.cx,r.cy,t,r.used);g.fillStyle=r.used?'#b4a9d8':'#5de8b0';g.fillText(r.used?'SHRINE (USED)':'SHRINE',r.cx,r.cy-36)}
    if(r.rune)drawRuneWall(g,r,t);
    if(r.page){const pg=r.page,b=Math.sin(t*3)*2;g.save();g.translate(pg.x,pg.y+b);g.rotate(-.15);g.fillStyle='#f2e6c8';g.strokeStyle=OL;g.lineWidth=2;g.fillRect(-9,-12,18,24);g.strokeRect(-9,-12,18,24);
      g.fillStyle='#8a7a5a';for(let k=-6;k<9;k+=4)g.fillRect(-6,k,12,1.5);g.restore();g.globalAlpha=.35+.25*Math.sin(t*4);g.strokeStyle='#fff3a8';g.beginPath();g.arc(pg.x,pg.y,18,0,7);g.stroke();g.globalAlpha=1}
    if(r.chest){const c=r.chest;g.fillStyle=c.open?'#5c4a2a':c.rich?'#ffcf4a':'#c98a2b';g.strokeStyle=OL;g.lineWidth=2;g.fillRect(c.x-14,c.y-10,28,20);g.strokeRect(c.x-14,c.y-10,28,20);g.fillStyle=c.open?'#3a2e1a':c.rich?'#fff6c8':'#ffcf4a';g.fillRect(c.x-14,c.y-10,28,6);g.fillRect(c.x-3,c.y-4,6,6)}
  });
  R.items.forEach(it=>{
    const b=Math.sin(t*4+it.x)*2;
    if(it.kind==='gun'){const G=GUNS[it.id];g.fillStyle='rgba(255,207,74,.18)';g.beginPath();g.arc(it.x,it.y,16,0,7);g.fill();g.save();g.translate(it.x,it.y+b);g.rotate(-.4);g.fillStyle=G.col;g.strokeStyle=OL;g.lineWidth=2;
      if(G.melee){g.fillRect(-12,-2,22,4);g.strokeRect(-12,-2,22,4);g.fillStyle='#6b4a12';g.fillRect(-14,-5,4,10);g.strokeRect(-14,-5,4,10)}else{g.fillRect(-10,-3,20,6);g.strokeRect(-10,-3,20,6);g.fillRect(-10,-3,5,10);g.strokeRect(-10,-3,5,10)}
      g.restore();g.font='600 10px "Pixelify Sans", monospace';g.fillStyle=G.col;g.fillText(G.name.toUpperCase(),it.x,it.y-18)}
    else if(it.kind==='buff'){g.fillStyle='#5de8b0';g.strokeStyle=OL;g.lineWidth=2;g.beginPath();g.arc(it.x,it.y+b,8,0,7);g.fill();g.stroke();g.fillStyle='#fff';g.fillRect(it.x-1.5,it.y+b-5,3,10);g.fillRect(it.x-5,it.y+b-1.5,10,3)}
    else{const col={cage:'#d8d0f0',food:'#7fd860',ore:'#c9b48a',hide:'#b07a4a',dust:'#ff8fe0',print:'#9fe8ff'}[it.id]||'#fff';g.fillStyle=col;g.strokeStyle=OL;g.lineWidth=2;g.fillRect(it.x-6,it.y+b-6,12,12);g.strokeRect(it.x-6,it.y+b-6,12,12)}
  });
  drawTwists(g,t);
  R.fields.forEach(f=>{g.globalAlpha=.2+.06*Math.sin(t*6);g.fillStyle=f.col||'#e0527a';g.beginPath();g.arc(f.x,f.y,f.r,0,7);g.fill();g.globalAlpha=.6;
    if(f.spin){g.strokeStyle=f.col;g.lineWidth=2;for(let k=0;k<3;k++){g.beginPath();g.arc(f.x,f.y,f.r*(.35+k*.22),t*4+k*2,t*4+k*2+2.2);g.stroke()}}g.globalAlpha=1});
  if(R.fortress>0){g.strokeStyle='rgba(227,176,75,.7)';g.lineWidth=3;g.setLineDash([10,6]);g.beginPath();g.arc(p.x,p.y,60,0,7);g.stroke();g.setLineDash([])}
  const rad=capRadius();
  const weakNear=R.enemies.some(e=>isWeak(e)&&dist(e,p)<rad*2.5);
  if(weakNear&&!R.slot3){const inRange=cageReady();g.strokeStyle=inRange?'rgba(255,207,74,.9)':'rgba(255,207,74,.35)';g.lineWidth=2;g.setLineDash([6,6]);g.lineDashOffset=t*15;g.beginPath();g.arc(p.x,p.y,rad,0,7);g.stroke();g.setLineDash([])}
  const ents=[];
  R.enemies.forEach(e=>ents.push({y:e.y,f:()=>drawEnemy(g,e)}));
  R.comps.forEach(m=>m&&ents.push({y:m.y,f:()=>drawComp(g,m)}));
  ents.push({y:p.y,f:()=>drawPlayer(g)});
  ents.sort((a,b)=>a.y-b.y).forEach(e=>e.f());
  R.swings.forEach(sw=>{const k=sw.t/sw.max;g.globalAlpha=.25+.5*k;g.fillStyle=sw.col;g.beginPath();g.moveTo(p.x,p.y);g.arc(p.x,p.y,sw.r,sw.a-sw.arc/2,sw.a+sw.arc/2);g.closePath();g.fill();g.globalAlpha=1;g.strokeStyle='#fff';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,sw.r,sw.a-sw.arc/2,sw.a+sw.arc/2);g.stroke()});
  R.bullets.forEach(b=>{
    if(b.lob){g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(b.x,b.y+4,b.r,b.r*.4,0,0,7);g.fill();g.fillStyle=OL;g.beginPath();g.arc(b.x,b.y-b.h,b.r+2,0,7);g.fill();g.fillStyle=b.col;g.beginPath();g.arc(b.x,b.y-b.h,b.r,0,7);g.fill();return}
    const bc=bulletCol(b);
    if(b.team==='e'){g.fillStyle='#fff';g.beginPath();g.arc(b.x,b.y,b.r+2,0,7);g.fill();g.fillStyle=bc;g.beginPath();g.arc(b.x,b.y,b.r,0,7);g.fill();if(bc!==b.col){g.fillStyle=OL;g.beginPath();g.arc(b.x,b.y,b.r*.4,0,7);g.fill()}}
    else{g.fillStyle=OL;g.beginPath();g.arc(b.x,b.y,b.r+1.5,0,7);g.fill();g.fillStyle=bc;g.beginPath();g.arc(b.x,b.y,b.r,0,7);g.fill()}
  });
  R.bolts.forEach(b=>{g.globalAlpha=Math.min(1,b.t*5);lightning(g,b.a,b.b,b.col);g.globalAlpha=1});
  R.fx.forEach(f=>{const k=f.t/f.max;g.globalAlpha=k;if(f.fill){g.fillStyle=f.col;g.globalAlpha=k*.45;g.beginPath();g.arc(f.x,f.y,f.r,0,7);g.fill()}else{g.strokeStyle=f.col;g.lineWidth=4;g.beginPath();g.arc(f.x,f.y,f.r*(1-k)+10,0,7);g.stroke()}g.globalAlpha=1});
  if(R.prism>0){g.strokeStyle='rgba(255,143,224,.6)';g.lineWidth=2;g.beginPath();g.arc(p.x,p.y,150,0,7);g.stroke()}
  g.font='600 13px "Pixelify Sans", monospace';
  R.floats.forEach(f=>{g.globalAlpha=clamp(f.t*1.5,0,1);g.fillStyle=OL;g.fillText(f.text,f.x+1,f.y+1);g.fillStyle=f.col;g.fillText(f.text,f.x,f.y)});g.globalAlpha=1;
  g.setTransform(dpr,0,0,dpr,0,0);
  if(modOn('fog')){g.fillStyle=`rgba(90,200,80,${.1+.04*Math.sin(t*2)})`;g.fillRect(0,0,R.vw,R.vh)}
  drawDark(g,s);
  if(modOn('dark')){const cx=R.vw/2,cy=R.vh/2,gr=g.createRadialGradient(cx,cy,90*s,cx,cy,190*s);gr.addColorStop(0,'rgba(5,3,15,0)');gr.addColorStop(1,'rgba(5,3,15,.95)');g.fillStyle=gr;g.fillRect(0,0,R.vw,R.vh)}
  if(TOUCH){
    const rr=stickR(),fixed=S.opts.stick==='fixed',bases=stickBases();
    [['move',touch.move,'rgba(255,255,255,'],['aim',touch.aim,'rgba(255,207,74,']].forEach(([k,tc,c])=>{
      let ox,oy,kx,ky;
      if(tc){ox=tc.ox;oy=tc.oy;const dx=tc.x-ox,dy=tc.y-oy,l=Math.hypot(dx,dy),q=l>rr?rr/l:1;kx=ox+dx*q;ky=oy+dy*q}
      else if(fixed){ox=bases[k].x;oy=bases[k].y;kx=ox;ky=oy}else return;
      g.strokeStyle=c+(tc?'.5)':'.22)');g.lineWidth=3;g.beginPath();g.arc(ox,oy,rr,0,7);g.stroke();
      g.fillStyle=c+(tc?'.55)':'.18)');g.beginPath();g.arc(kx,ky,rr*.4,0,7);g.fill();
    });
  }
}
// A rune wall: a carved slab along the top of the room. Letters the Archive has translated show as plain text.
function drawRuneWall(g,r,t){
  const w=LORE.WALLS.find(x=>x.id===r.rune);if(!w)return;
  const txt=runeWall(w.text),x=r.cx,y=r.oy*TS+TS*1.5,wd=Math.min(RW*TS-60,Math.max(160,txt.length*10+30));
  g.save();g.fillStyle='#3a3450';g.strokeStyle=OL;g.lineWidth=2;g.fillRect(x-wd/2,y-16,wd,32);g.strokeRect(x-wd/2,y-16,wd,32);
  g.fillStyle='#2a2440';g.fillRect(x-wd/2+4,y-12,wd-8,24);
  const seen=r.loreSeen;g.globalAlpha=seen?1:.6+.3*Math.sin(t*2);g.fillStyle=seen?'#c8b8ff':'#9b7bff';g.font='600 15px "Noto Sans Runic","Segoe UI Historic","Pixelify Sans",monospace';g.textAlign='center';g.textBaseline='middle';
  g.fillText(txt,x,y+1,wd-14);g.restore();g.textBaseline='alphabetic';g.font='600 12px "Pixelify Sans", monospace';g.textAlign='center';
}
function drawPeddler(g,x,y,t){
  g.save();g.translate(x,y);g.strokeStyle=OL;g.lineWidth=2;
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(0,16,16,4,0,0,7);g.fill();
  g.fillStyle='#8a5a3a';g.fillRect(-22,4,14,12);g.strokeRect(-22,4,14,12);
  g.fillStyle='#4a6fd8';g.beginPath();g.moveTo(-10,16);g.lineTo(0,-10);g.lineTo(10,16);g.closePath();g.fill();g.stroke();
  g.fillStyle='#ffcf4a';g.beginPath();g.moveTo(-12,-6);g.lineTo(0,-24);g.lineTo(12,-6);g.closePath();g.fill();g.stroke();
  g.fillStyle='#f3d2a8';g.fillRect(-4,-8,8,6);g.fillStyle='#ffe066';g.globalAlpha=.6+.4*Math.sin(t*5);g.beginPath();g.arc(14,-2,5,0,7);g.fill();g.globalAlpha=1;
  g.restore();
}
function drawShrine(g,x,y,t,used){
  g.save();g.translate(x,y);g.strokeStyle=OL;g.lineWidth=2;
  g.fillStyle='#6b6a8a';g.fillRect(-16,0,32,16);g.strokeRect(-16,0,32,16);g.fillRect(-10,-14,20,14);g.strokeRect(-10,-14,20,14);
  g.fillStyle=used?'#4a4a5a':'#5de8b0';g.globalAlpha=used?1:.7+.3*Math.sin(t*4);g.beginPath();g.moveTo(0,-30);g.lineTo(7,-20);g.lineTo(0,-12);g.lineTo(-7,-20);g.closePath();g.fill();g.stroke();g.globalAlpha=1;
  g.restore();
}
function hpOver(g,x,y,w,f,col){g.fillStyle=OL;g.fillRect(x-w/2-1,y-1,w+2,6);g.fillStyle='#3a1424';g.fillRect(x-w/2,y,w,4);g.fillStyle=col;g.fillRect(x-w/2,y,w*clamp(f,0,1),4)}
function pips(g,e,y){const ks=Object.keys(e.status);if(!ks.length)return;const w=ks.length*8;ks.forEach((k,i)=>{g.fillStyle=ELEM[k].col;g.strokeStyle=OL;g.lineWidth=1.5;g.beginPath();g.arc(e.x-w/2+4+i*8,y,3,0,7);g.fill();g.stroke()})}
function drawPlayer(g){
  const p=R.p,t=R.t;
  g.save();g.translate(p.x,p.y);
  g.fillStyle='rgba(0,0,0,.3)';g.beginPath();g.ellipse(0,13,10,3.5,0,0,7);g.fill();
  if(p.inv>0&&Math.floor(t*20)%2)g.globalAlpha=.5;
  if(p.roll>0)g.rotate((.3-p.roll)/.3*Math.PI*2*(p.rvx<0?-1:1));
  const face=Math.cos(R.aim)<0?-1:1;g.scale(face,1);
  g.strokeStyle=OL;g.lineWidth=2.2;g.lineJoin='round';
  g.fillStyle=p.hurt>0?'#fff':'#3f8f7a';g.beginPath();g.moveTo(-10,12);g.lineTo(-7,-4);g.lineTo(7,-4);g.lineTo(10,12);g.closePath();g.fill();g.stroke();
  g.fillStyle=p.hurt>0?'#fff':'#ffcf4a';g.beginPath();g.arc(0,-6,8,Math.PI,0);g.lineTo(9,0);g.lineTo(-9,0);g.closePath();g.fill();g.stroke();
  g.fillStyle='#f3d2a8';g.fillRect(-1,-6,7,5);g.strokeRect(-1,-6,7,5);g.fillStyle=OL;g.fillRect(3,-5,2,2);
  g.restore();
  const id=R.guns[R.active];
  if(id){const G=GUNS[id];g.save();g.translate(p.x,p.y+2);g.rotate(R.aim);g.fillStyle=G.col;g.strokeStyle=OL;g.lineWidth=2;
    if(G.melee){const L=Math.min(26,G.range*.45);g.fillRect(8,-2,L,4);g.strokeRect(8,-2,L,4);g.fillStyle='#6b4a12';g.fillRect(4,-5,4,10);g.strokeRect(4,-5,4,10)}
    else{const len=G.tier>=3?20:G.tier===2?17:14;g.fillRect(6,-3,len,6);g.strokeRect(6,-3,len,6)}g.restore()}
  if(R.shield>0){g.strokeStyle='rgba(88,194,255,.8)';g.lineWidth=3;g.beginPath();g.arc(p.x,p.y,20+Math.sin(t*10)*2,0,7);g.stroke()}
}
function drawComp(g,m){
  if(m.downed)g.globalAlpha=.55;
  drawCreature(g,m.c,m.x,m.y,.85,R.t,{face:m.face,flash:m.flash>0,seed:m.seed});
  g.globalAlpha=1;
  if(m.downed){g.strokeStyle='#5de8b0';g.lineWidth=3;g.beginPath();g.arc(m.x,m.y,22,-Math.PI/2,-Math.PI/2+m.rev/1.5*Math.PI*2);g.stroke();g.fillStyle='#ff6688';g.font='600 11px "Pixelify Sans", monospace';g.fillText(m.autoT>0?'SPRING…':'REVIVE',m.x,m.y-26)}
  else hpOver(g,m.x,m.y-26,26,m.hp/m.maxHp,'#5de8b0');
  if(R.taunt>0&&R.tauntEnt===m){g.strokeStyle='#e3b04b';g.lineWidth=2;g.beginPath();g.arc(m.x,m.y,24,0,7);g.stroke()}
  if(R.rally){g.strokeStyle='rgba(255,207,74,.6)';g.lineWidth=2;g.beginPath();g.arc(m.x,m.y,18+Math.sin(R.t*10)*2,0,7);g.stroke()}
}
function drawEnemy(g,e){
  const t=R.t;
  if(e.wind>0){const k=1-e.wind/.7;g.fillStyle=`rgba(255,${e.fire&&e.fire.kind==='charge'?90:220},90,${.25+.35*k})`;g.beginPath();g.arc(e.x,e.y,e.r+6+k*8,0,7);g.fill()}
  if(e.burn){g.fillStyle=`rgba(255,122,61,${.3+.2*Math.sin(t*12)})`;g.beginPath();g.arc(e.x,e.y-e.r*.6,e.r*.5,0,7);g.fill()}
  if(e.kind==='boss'){drawBossBody(g,e.def,e.x,e.y,e.r/40,t,e.flash>0);pips(g,e,e.y+e.r+10);return}
  if(e.poison){g.fillStyle=`rgba(155,227,90,${.3+.2*Math.sin(t*9)})`;g.beginPath();g.arc(e.x,e.y+e.r*.4,e.r*.55,0,7);g.fill()}
  if(e.dormant){g.fillStyle='rgba(200,168,255,.8)';g.font='700 11px "Pixelify Sans",monospace';g.textAlign='center';g.fillText('z',e.x+e.r,e.y-e.r-((t*20)%12))}
  if(e.shadow){drawShadow(g,e,t);hpOver(g,e.x,e.y-30,30,e.hp/e.maxHp,"#b4a9d8");return}
  if(e.kind==='wild'){
    drawCreature(g,e.c,e.x+(e.wind>0?fxRnd(-1,1):0),e.y,.9,t,{face:e.face,flash:e.flash>0,seed:e.seed});
    const f=e.hp/e.maxHp,weak=isWeak(e);hpOver(g,e.x,e.y-30,30,f,weak?'#ffcf4a':'#ff6688');pips(g,e,e.y-38);
    g.font='600 10px "Pixelify Sans", monospace';g.fillStyle=SPECIES[e.c.species].col;g.fillText(`WILD ${formName(e.c).toUpperCase()} ${sexSym(e.c.sex)} LV${e.c.level}`,e.x,e.y-44);
    if(weak){g.strokeStyle='#ffcf4a';g.lineWidth=2;g.setLineDash([4,4]);g.lineDashOffset=t*20;g.beginPath();g.arc(e.x,e.y,22+Math.sin(t*6)*2,0,7);g.stroke();g.setLineDash([])}
    return;
  }
  drawFoeBody(g,e.def,e.x+(e.wind>0&&e.fire.kind==='charge'?fxRnd(-1.5,1.5):0),e.y,e.r/14,t,{flash:e.flash>0,seed:e.seed,face:e.face,dir:e.chargeT>0?Math.atan2(e.cvy,e.cvx):null});
  hpOver(g,e.x,e.y-e.r-12,e.elite||e.def.body==='brute'?44:26,e.hp/e.maxHp,'#ff6688');pips(g,e,e.y-e.r-18);
  if(e.elite||e.def.body==='brute'){g.font='600 10px "Pixelify Sans", monospace';g.fillStyle='#ffa04f';g.fillText((e.elite?'ELITE ':'')+e.def.name.toUpperCase(),e.x,e.y-e.r-24)}
  if(e.stun>0&&e.stun<99){g.fillStyle='#9b7bff';g.font='600 11px "Pixelify Sans", monospace';g.fillText('STUN',e.x,e.y+e.r+14)}
}
function drawMini(){
  const g=mctx,M=R.map,W=240;g.clearRect(0,0,W,W);
  if(CU('blind')){g.fillStyle='#ff6688';g.font='600 22px "Pixelify Sans", monospace';g.textAlign='center';g.textBaseline='middle';g.fillText('BLIND',W/2,W/2);g.textBaseline='alphabetic';return}
  const n=M.G,cell=Math.floor((W-16)/n),pad=(W-cell*n)/2,box=cell-14;
  // Hidden rooms never show on the map until their wall is broken (scouting only makes the cracked wall sparkle).
  const show=r=>(r.visited||R.reveal)&&!r.hidden;
  const pos=r=>[pad+r.gx*cell+7,pad+r.gy*cell+7];
  g.strokeStyle='#4b3e87';g.lineWidth=4;
  M.rooms.forEach(r=>r.links.forEach(o=>{if(r.idx<o.idx&&show(r)&&show(o)){const[a,b]=pos(r),[c,d]=pos(o);g.beginPath();g.moveTo(a+box/2,b+box/2);g.lineTo(c+box/2,d+box/2);g.stroke()}}));
  const col={start:'#5de8b0',stairs:'#ffcf4a',gate:'#ffcf4a',rift:'#9b7bff',cliff:'#4fe0c8',chest:'#c98a2b',lair:'#ff6688',fight:'#6a5cab',arena:'#ff8fb1',shop:'#58c2ff',shrine:'#5de8b0',boss:'#ff3a5c',portal:'#9b7bff',secret:'#ffcf4a',tutA:'#5de8b0',tutB:'#6a5cab'};
  const lab={stairs:'S',gate:'G',rift:'R',cliff:'C',chest:'$',lair:'!',shop:'P',shrine:'+',boss:'B',portal:'O',secret:'?'};
  g.font='600 20px "Pixelify Sans", monospace';g.textAlign='center';g.textBaseline='middle';
  M.rooms.forEach(r=>{
    if(!show(r))return;const[x,y]=pos(r);
    g.globalAlpha=r.visited?1:.5;g.fillStyle=col[r.kind]||'#6a5cab';g.fillRect(x,y,box,box);
    if(r.mod&&r.visited){g.fillStyle=ROOM_MODS[r.mod].col;g.fillRect(x+box-10,y+box-10,10,10)}
    if(r.locked){g.strokeStyle='#ff6688';g.lineWidth=3;g.strokeRect(x,y,box,box)}
    g.globalAlpha=1;g.fillStyle=OL;if(lab[r.kind])g.fillText(lab[r.kind],x+box/2,y+box/2+1);
    if((secTier('roost')>=2||R.scout)&&r.plan&&!r.cleared&&r.plan.wilds.some(s=>SPECIES[s].w===1||TYPES[SPECIES[s].type].tier>=3)){g.fillStyle='#fff';g.fillText('*',x+box-6,y+8)}
    if(r===R.cur){g.strokeStyle='#fff';g.lineWidth=3;g.strokeRect(x-3,y-3,box+6,box+6)}
  });
  g.textBaseline='alphabetic';
}
function updHud(){
  const p=R.p;
  $('#hudHp').style.width=clamp(p.hp/p.maxHp,0,1)*100+'%';$('#hudHpTxt').textContent=`${Math.ceil(Math.max(0,p.hp))}/${p.maxHp}`;
  $('#hudGun').innerHTML=(R.guns.map((g,i)=>g?`<span class="${i===R.active?'on':''}">${GUNS[g].name}</span>`:'').filter(Boolean).join(' / ')||'No weapon')+` · Bag ${bagUsed()}/${R.bagCap}${R.tonics?` · ${R.tonics} tonic${R.tonics>1?'s':''}`:''}`;
  $('#hudFloor').textContent=R.mode==='arena'?'Arena':R.mode==='tutorial'?'Tutorial':`Floor ${R.map.floor}${R.mode==='scav'?' Scav':''}`;
  $('#hudCoin').textContent=R.bag.coin+'c';
  if(R.mode==='arena'||R.mode==='tutorial'||S.settings.noTimer)$('#hudTime').textContent='∞';
  else{const s=Math.max(0,Math.ceil(R.time));$('#hudTime').textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;$('#hudTime').style.color=s<60?'var(--rose)':''}
  const nb=Object.values(R.buffs).reduce((a,b)=>a+b,0),nc=R.curses.size;
  $('#hudBag').innerHTML=`<span>Cages ${R.mode==='arena'?'∞':R.cages.basic+R.cages.gilded}</span><span>${nb?nb+' buff'+(nb>1?'s':''):'No buffs'}${nc?` · <b style="color:var(--rose)">${nc} pact${nc>1?'s':''}</b>`:''}</span>`;
  let h=R.comps.map((m,i)=>{const k=i?'E':'Q';if(!m)return`<div class="pc"><span class="key">${k}</span><span class="nm" style="color:var(--muted)">Empty</span><span></span></div>`;
    const max=m.abilMax||1;
    return`<button class="pc ${m.downed?'down':''}" data-t="${i?'e':'q'}" aria-label="Use ${esc(m.c.name)}'s ability"><span class="key">${k}</span><span class="nm">${esc(m.c.name)} <small>Lv${m.c.level}</small></span><span class="cd">${m.downed?'DOWN':m.abil>0?Math.ceil(m.abil)+'s':ABILITIES[m.st.abilId].name}</span><div class="mini-bar"><i style="width:${m.hp/m.maxHp*100}%"></i></div><div class="cdb"><i style="width:${m.abil>0?(1-m.abil/max)*100:100}%"></i></div></button>`}).join('');
  if(!TOUCH&&R.comps[0]&&R.comps[1]){const cb=comboFor(R.comps[0].c.type,R.comps[1].c.type),rdy=comboReady();h+=`<button class="pc pcombo ${rdy?'ready':''}" data-t="combo" aria-label="Use combo ${cb.name}"><span class="key">C</span><span class="nm">${cb.name}</span><span class="cd">${rdy?'ready':Math.ceil(R.combo.cd)+'s'}</span><div class="cdb"><i style="width:${(1-R.combo.cd/R.combo.max)*100}%;background:var(--gold)"></i></div></button>`}
  if(R.slot3){const c=R.slot3.c,caged=c.captureRaid===R.id;h+=`<div class="pc s3 ${caged?'caged':''}"><span class="key">3</span><span class="nm">${esc(c.name)} · ${caged?'caught':'support'}</span>${TOUCH?'<span></span>':`<span class="sw"><button data-t="s1" aria-label="Swap with slot 1">⇄1</button><button data-t="s2" aria-label="Swap with slot 2">⇄2</button></span>`}</div>`}
  else h+=`<div class="pc s3"><span class="key">3</span><span class="nm" style="color:var(--muted)">Free for a catch</span><span></span></div>`;
  $('#hudParty').innerHTML=h;
  if(TOUCH){
    // Skill buttons show the ability (or its cooldown, filling as a clock); Catch shows the cages left.
    R.comps.forEach((m,i)=>{const b=$(i?'#tE':'#tQ'),ok=m&&!m.downed;b.classList.toggle('off',!ok||m.abil>0);
      b.style.setProperty('--cd',ok&&m.abil>0?Math.min(1,m.abil/(m.abilMax||1)):0);
      b.querySelector('span').textContent=!m?'Empty':m.downed?'Down':m.abil>0?Math.ceil(m.abil)+'s':ABILITIES[m.st.abilId].name});
    const cg=$('#tCage');cg.classList.toggle('off',!cageReady());cg.querySelector('span').textContent=R.mode==='arena'?'∞':`${R.cages.basic+R.cages.gilded} left`;
    $('#tCombo').hidden=!comboReady();
  }
  const bb=R.boss&&R.boss.hp>0;$('#bossBar').hidden=!bb;if(bb)$('#bossHp').style.width=clamp(R.boss.hp/R.boss.maxHp,0,1)*100+'%';
  $('.ccol').classList.toggle('low',!!bb);
  const rm=R.cur&&R.cur.mod&&R.cur.visited?ROOM_MODS[R.cur.mod]:null;const rmEl=$('#roomMod');if(rm){rmEl.hidden=false;rmEl.textContent=rm.name;rmEl.style.color=rm.col}else rmEl.hidden=true;
  const mEl=$('#hudMsg');if(R.msgT>0){mEl.hidden=false;mEl.textContent=R.msg}else mEl.hidden=true;
  const pr=$('#hudPrompt');if(R.prompt){pr.hidden=false;pr.textContent=R.prompt;pr.classList.toggle('tap',!!(R.canUse&&TOUCH))}else pr.hidden=true;
  drawMini();
}
let hudT=0,raf=0;
function startLoop(){cancelAnimationFrame(raf);raf=requestAnimationFrame(loop)}
function stopLoop(){cancelAnimationFrame(raf)}
function loop(ts){
  if(!R||R.over)return;
  const raw=ts-(R.last||ts),dt=Math.min(.04,raw/1000);R.last=ts;
  if(raw>0&&raw<250&&frameTime(raw))resize();
  if(!R.paused)update(dt);
  if(!R||R.over)return;
  draw();hudT+=dt;if(hudT>.1){hudT=0;updHud()}
  raf=requestAnimationFrame(loop);
}
// Raid menus never scroll. Each is laid out in landscape columns; if one still runs past the screen
// (a long buff list, a small window) its contents are zoomed down a step at a time until it fits.
function showOverlay(html){R.paused=true;R.firing=false;keys.clear();touch.move=touch.aim=null;$('#pause').hidden=false;$('#pauseBox').innerHTML=`<div class="ov">${html}</div>`;fitOverlay()}
function fitOverlay(){
  const box=$('#pauseBox'),ov=box.firstElementChild;if(!ov)return 1;
  let z=1;ov.style.zoom='';
  const over=()=>box.scrollHeight>box.clientHeight+1||box.scrollWidth>box.clientWidth+1;
  while(over()&&z>.56){z=+(z-.06).toFixed(2);ov.style.zoom=z}
  box.scrollTop=0;return z;
}
/* ---------- the raid menu (⚙, or Esc): backpack, creatures, weapons and settings; the raid waits while it's open ---------- */
const MENU_TABS=[['bag','Backpack'],['party','Creatures'],['gear','Weapons'],['options','Settings']];
function setPause(on){
  if(!R)return;R.paused=on;$('#pause').hidden=!on;if(!on){R.last=0;R.releaseArm=null;R.abandonArm=false;return}
  showOverlay(menuHtml());
}
function menuHtml(){
  const t=R.menuTab||'bag',where=R.mode==='arena'?'Arena':R.mode==='tutorial'?'Tutorial':`Floor ${R.map.floor}`;
  return`<div class="ovhead"><h2>${where}</h2><div class="mtabs" role="tablist">${MENU_TABS.map(([k,l])=>`<button class="tab" role="tab" aria-selected="${t===k}" data-p="mtab" data-k="${k}">${l}</button>`).join('')}</div><button class="btn primary" data-p="resume">Resume</button></div>
    ${({bag:menuBag,party:menuParty,gear:menuGear,options:menuOptions})[t]()}`;
}
function menuBag(){
  const b=R.bag,used=bagUsed(),it=(label,v)=>`<div class="mitem ${v?'':'empty'}"><span>${label}</span><b>${v}</b></div>`;
  const bl=Object.entries(R.buffs).map(([k,n])=>`<li><b>${BUFFS[k].name}${n>1?' ×'+n:''}</b> ${BUFFS[k].desc}</li>`).join('')+[...R.curses].map(k=>`<li class="bad"><b>${CURSES[k].name}</b> ${CURSES[k].desc}</li>`).join('');
  return`<div class="ovcols c2"><div class="ovcol"><p class="status">Bag ${used}/${R.bagCap} slots${R.satchel?' with your satchel':''}. Everything here is lost if you fall.</p><div class="bagbar"><i style="width:${Math.min(100,used/Math.max(1,R.bagCap)*100)}%"></i></div>
    <div class="mgrid">${it('Coin',b.coin)}${it('Ore',b.ore)}${it('Food',b.food)}${it('Hide',b.hide)}${it('Crystal dust',b.dust)}${it('Tonics',R.tonics)}${it('Cages',R.mode==='arena'?'∞':R.cages.basic)}${it('Gilded cages',R.cages.gilded)}</div>
    <p class="status">${R.caught||0} caught this raid · Keeper XP so far ${R.kxp}</p></div>
    <div class="ovcol"><h3>Buffs and pacts</h3>${bl?`<ul class="ovlist">${bl}</ul>`:'<p class="status">None yet. Shrines and the peddler sell them.</p>'}
    ${R.prints.length?`<h3>Prints</h3><p class="status">${R.prints.map(id=>GUNS[id].name).join(' · ')}</p>`:''}</div></div>`;
}
function menuParty(){
  const card=slot=>{
    const m=slot===2?R.slot3:R.comps[slot],label=slot===2?'Slot 3':`Combat ${slot+1}`;
    if(!m)return`<div class="mcre"><b>${label}</b><span class="status">${slot===2?'Free for a catch':'Empty'}</span></div>`;
    const c=m.c,caught=c.captureRaid===R.id,down=slot<2&&m.downed;
    const hp=slot===2?c.hp/stats(c).hp:m.hp/m.maxHp,armed=R.releaseArm===slot;
    const what=slot===2?(caught?'Caught this raid':`Support: ${supportText(c)}`):`Skill ${slot+1}: ${ABILITIES[m.st.abilId].name}${m.abil>0?` (${Math.ceil(m.abil)}s)`:''}`;
    const btns=(slot===2?`<button class="btn small" data-p="swap" data-i="0">To combat 1</button><button class="btn small" data-p="swap" data-i="1">To combat 2</button>`:'')
      +(canRelease(slot)?`<button class="btn small ${armed?'danger':''}" data-p="release" data-i="${slot}">${armed?`Confirm: release`:'Release'}</button>`:'');
    return`<div class="mcre ${caught?'caught':''} ${down?'down':''}"><b>${label}: ${esc(c.name)}</b><small class="status">${esc(formName(c))} · Lv ${c.level} · ${TYPES[c.type].name}${c.type2?'/'+TYPES[c.type2].name:''}${down?' · down':''}</small>
      <div class="bagbar"><i style="width:${clamp(hp,0,1)*100}%;background:var(--rose)"></i></div><span class="status">${what}</span>
      ${armed?`<p class="status warn">${S.creatures.includes(c)?`${esc(c.name)} is from your roster. Released, it leaves for good unless you catch it again before the raid ends.`:`${esc(c.name)} turns wild in this room.`}</p>`:''}
      ${btns?`<div class="row">${btns}</div>`:''}</div>`;
  };
  return`<p class="status">Slot 3 holds a catch or a support creature and can swap into combat. Release one to make room: it turns wild in this room, and you can catch it again.</p>
    <div class="ovcols c3">${[0,1,2].map(card).join('')}</div>`;
}
function menuGear(){
  const rows=[0,1].map(i=>{const id=R.guns[i];if(!id)return`<div class="mcre"><b>Weapon ${i+1}</b><span class="status">Empty</span></div>`;
    const it=R.gunItem[i];
    return`<div class="mcre ${i===R.active?'caught':''}"><b>${it?esc(itemName(it)):GUNS[id].name}</b><small class="status">${i===R.active?'in hand':'on your back'}${it?` · ${it.dur}/${it.max} durability`:id==='pistol'?' · never breaks':' · found this raid'}</small><span class="status">${weaponLine(GUNS[id])}</span></div>`}).join('');
  return`<div class="ovcols c2">${rows}</div><div class="row">${R.guns[0]&&R.guns[1]?'<button class="btn" data-p="switch">Switch weapon</button>':''}<span class="status">Weapons in your hands come home if you extract. Pick up finds by walking over them.</span></div>`;
}
function menuOptions(){
  const safe=R.mode==='arena'||R.mode==='tutorial';
  return`<p class="hint">${safe?'Leaving restores your creatures. Nothing is lost.':'Abandoning counts as death: everything you brought is lost.'}</p>
    <div class="row">${safe?`<button class="btn" data-p="leave">${R.mode==='tutorial'?'Leave the tutorial':'Leave the arena'}</button>`:`<button class="btn danger" data-p="abandon">${R.abandonArm?'Confirm: abandon and lose loadout':'Abandon raid'}</button>`}
    <button class="btn" data-p="mute">${S.opts.mute?'Sound on':'Mute'}</button>${TOUCH&&document.fullscreenEnabled?`<button class="btn" data-p="fullscreen">${document.fullscreenElement?'Leave full screen':'Full screen'}</button>`:''}</div>
    <p class="status">${TOUCH?'Stick and button sizes and left-handed layout are in the hideout’s Settings tab.':'WASD move · Mouse aim and attack · Space roll · Q/E skills · C combo · 1/2 swap slot 3 · R switch weapon · F catch · G use · Esc menu'}</p>`;
}
$('#pauseBox').addEventListener('click',e=>{
  const b=e.target.closest('[data-p]');if(!b||!R||b.disabled)return;const k=b.dataset.p;sfx('ui');
  if(k==='resume'){R.abandonArm=false;setPause(false)}
  if(k==='vein'){chooseVein(b.dataset.k);return}
  if(k==='ending'){pickEnding(b.dataset.k);return}
  if(k==='mtab'){R.menuTab=b.dataset.k;R.releaseArm=null;setPause(true)}
  if(k==='swap'){swapSlot3(+b.dataset.i);setPause(true)}
  if(k==='switch'){switchGun();setPause(true)}
  if(k==='release'){const i=+b.dataset.i;if(R.releaseArm!==i){R.releaseArm=i;setPause(true);return}R.releaseArm=null;if(releaseCreature(i))setPause(false);else setPause(true)}
  if(k==='mute'){S.opts.mute=!S.opts.mute;auVol();save();setPause(true)}
  if(k==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});else goLandscape();setPause(true)}
  if(k==='leave'){$('#pause').hidden=true;endRaid(R.mode==='arena'?'arena':'quit')}
  if(k==='abandon'){if(!R.abandonArm){R.abandonArm=true;setPause(true);return}$('#pause').hidden=true;endRaid('dead')}
  if(k==='buy')buy(+b.dataset.i);
  if(k==='bless'){const r=R.shrineRoom;if(r&&!r.used){r.used=true;applyBuff(b.dataset.k,true);setPause(false);msg(`${BUFFS[b.dataset.k].name}: ${BUFFS[b.dataset.k].desc}.`)}}
  if(k==='curse'){const r=R.shrineRoom;if(r&&!r.used){r.used=true;setPause(false);applyCurse(b.dataset.k)}}
});
$('#btnPause').addEventListener('click',()=>{if(R)setPause(!R.paused)});

/* ---------- input ---------- */
window.addEventListener('keydown',e=>{
  if(!R||R.over)return;
  if(e.target&&(e.target.tagName==='SELECT'||e.target.tagName==='INPUT'))return;
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
  if(e.code==='Escape'){setPause(!R.paused);return}
  if(R.paused||e.repeat)return;
  keys.add(e.code);
  const c=e.code;
  if(c==='Space')doRoll();if(c==='KeyQ')useAbility(0);if(c==='KeyE')useAbility(1);if(c==='KeyF')useCage();if(c==='KeyC')useCombo();
  if(c==='Digit1')swapSlot3(0);if(c==='Digit2'||c==='KeyX')swapSlot3(1);if(c==='KeyR')switchGun();if(c==='KeyG')interact();
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();if(R)R.firing=false});
function bindCanvas(){
  cv.addEventListener('mousemove',e=>{if(R)R.mouse={x:e.clientX,y:e.clientY}});
  cv.addEventListener('mousedown',e=>{if(!R||R.paused)return;R.mouse={x:e.clientX,y:e.clientY};if(e.button===2){doRoll();return}if(e.button===0)R.firing=true});
  window.addEventListener('mouseup',e=>{if(R&&e.button===0&&!touch.aim)R.firing=false});
  cv.addEventListener('contextmenu',e=>e.preventDefault());
  cv.addEventListener('touchstart',e=>{e.preventDefault();if(!R||R.paused)return;R.mouse=null;
    const fixed=S.opts.stick==='fixed',bases=stickBases(),left=S.opts.hand==='left';
    for(const t of e.changedTouches){
      const onLeft=t.clientX<innerWidth/2,kind=(onLeft!==left)?'move':'aim';
      if(touch[kind])continue;
      const base=fixed?bases[kind]:{x:t.clientX,y:t.clientY};
      touch[kind]={id:t.identifier,ox:base.x,oy:base.y,x:t.clientX,y:t.clientY};
    }},{passive:false});
  cv.addEventListener('touchmove',e=>{e.preventDefault();for(const t of e.changedTouches){[touch.move,touch.aim].forEach(o=>{if(o&&o.id===t.identifier){o.x=t.clientX;o.y=t.clientY}})}},{passive:false});
  const end=e=>{for(const t of e.changedTouches){if(touch.move&&touch.move.id===t.identifier)touch.move=null;if(touch.aim&&touch.aim.id===t.identifier){touch.aim=null;if(R)R.firing=false}}};
  cv.addEventListener('touchend',end);cv.addEventListener('touchcancel',end);
  $('#raid').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-t]');if(!b||!R)return;e.preventDefault();e.stopPropagation();const k=b.dataset.t;
    if(k==='pause'){setPause(!R.paused);return}if(R.paused)return;
    if(k==='roll')doRoll();if(k==='q')useAbility(0);if(k==='e')useAbility(1);if(k==='cage')useCage();if(k==='s1')swapSlot3(0);if(k==='s2')swapSlot3(1);if(k==='gun')switchGun();if(k==='use')interact();if(k==='combo')useCombo()});
}
window.addEventListener('resize',()=>{if(cv)resize();if(R&&!$('#pause').hidden)fitOverlay()});

/* ================= Boot ================= */
async function start(data){
  cv=$('#cv');ctx=cv.getContext('2d');mini=$('#mini');mctx=mini.getContext('2d');bindCanvas();
  let loaded=null;
  if(data&&data.S){try{loaded=migrate(data.S)}catch(e){}}
  if(!loaded)loaded=await loadSave();
  setS(loaded);applyPalette();
  let fresh=false;if(!S){newGame();fresh=true}
  save();startMarket();renderAll();
  if(fresh||!S.introSeen){S.introSeen=true;save();openIntro(true)}
  sessionStart();
}
function boot(){
  if(window.claude&&window.claude.hot&&window.claude.hot.snapshot){try{window.claude.hot.snapshot(()=>({S}))}catch(e){}}
  return new Promise(res=>{const go=d=>res(start(d));if(window.claude?.hot?.ready)window.claude.hot.ready(go);else go(window.claude?.hot?.data??{})});
}

export {goLandscape,ctx,cv,mini,mctx,lockPage,resize,drawFoeBody,drawBossBody,lightning,draw,drawPeddler,drawShrine,hpOver,pips,drawPlayer,drawComp,drawEnemy,drawMini,updHud,hudT,raf,startLoop,stopLoop,loop,showOverlay,fitOverlay,setPause,bindCanvas,start,boot};
