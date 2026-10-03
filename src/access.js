/* ================= Accessibility and performance (Phase 8) =================
   Options in Settings, numbers in BALANCE.ACCESS:
   - Colorblind palettes (red-green twice, blue-yellow): good and bad colors, both teams' bullets and every
     type's color are swapped for ones that stay apart under that kind of color vision. Enemy bullets keep
     their white ring and gain a dark core, so they read by shape as well as color.
   - Aim assist: on touch, the aim stick bends toward the nearest enemy inside a narrow cone.
   - Slower enemy bullets: every enemy bullet moves at 75% speed.
   - Render quality: the raid canvas draws at up to 2.5 pixels per screen pixel. "Auto" starts at 2 and steps
     down when frames run slow (and back up when they're fast), so mid-range phones keep a smooth frame rate. */
import {BALANCE,TYPES} from './content.js';
import {OPTS} from './device.js';


const A=BALANCE.ACCESS,BASE={};
for(const t in TYPES)BASE[t]=TYPES[t].color;
const palette=()=>A.palettes[OPTS.palette]||null;
// Recolors types and the page's good/bad colors for the chosen palette (called on boot and when it changes).
function applyPalette(){
  const p=palette();
  for(const t in TYPES)TYPES[t].color=p&&p.types[t]||BASE[t];
  const h=document.documentElement;h.dataset.palette=p?OPTS.palette:'normal';
  if(p){h.style.setProperty('--mint',p.good);h.style.setProperty('--rose',p.bad)}else{h.style.removeProperty('--mint');h.style.removeProperty('--rose')}
}
const bulletCol=b=>{const p=palette();return p?(b.team==='e'?p.enemy:p.friend):b.col};
const enemyBulletMul=()=>OPTS.slowBullets?A.slowBullets:1;
// Aim assist: bend an aim angle toward the nearest live enemy within the cone and range.
function assistAim(ang,from,enemies){
  if(!OPTS.aimAssist)return ang;const C=A.aimAssist;let best=null,bd=C.cone;
  for(const e of enemies){if(e.hp<=0||e.captured)continue;const dx=e.x-from.x,dy=e.y-from.y,d=Math.hypot(dx,dy);if(d>C.range)continue;
    let da=Math.atan2(dy,dx)-ang;da=Math.atan2(Math.sin(da),Math.cos(da));if(Math.abs(da)<bd){bd=Math.abs(da);best=da}}
  return best==null?ang:ang+best*C.pull;
}
/* ---------- render scale ---------- */
let scale=0,frames=[];
function renderScale(){
  const dpr=window.devicePixelRatio||1,q=OPTS.quality,Q=A.quality;
  if(q==='high')return Math.min(dpr,Q.high);if(q==='low')return Math.min(dpr,Q.low);
  if(!scale)scale=Math.min(dpr,Q.auto.start);return Math.min(dpr,scale);
}
// Called once a frame with its length in ms; returns true when the render scale changed (the canvas must resize).
function frameTime(ms){
  if(OPTS.quality!=='auto')return false;const Q=A.quality.auto,dpr=window.devicePixelRatio||1;
  frames.push(ms);let sum=0;for(const f of frames)sum+=f;if(sum<Q.window*1000)return false;
  const avg=sum/frames.length;frames=[];const was=renderScale();
  if(avg>Q.slowMs)scale=Math.max(Q.min,was-Q.step);else if(avg<Q.fastMs)scale=Math.min(Q.max,dpr,was+Q.step);
  return renderScale()!==was;
}
const resetScale=()=>{scale=0;frames=[]};

export {applyPalette,palette,bulletCol,enemyBulletMul,assistAim,renderScale,frameTime,resetScale};
