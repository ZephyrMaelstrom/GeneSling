/* ================= Utilities ================= */
import {rand,fxRand} from './rng.js';

const $=s=>document.querySelector(s);
const rnd=(a,b)=>a+rand()*(b-a);
const ri=(a,b)=>Math.floor(rnd(a,b+1));
const pick=a=>a[Math.floor(rand()*a.length)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const wpick=(items,wf)=>{const ws=items.map(wf);let x=rand()*ws.reduce((a,b)=>a+b,0);for(let i=0;i<items.length;i++){x-=ws[i];if(x<=0)return items[i]}return items[items.length-1]};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const angDiff=(a,b)=>{let d=a-b;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d};
// Visual-only versions: these never touch the seeded gameplay stream.
const fxRnd=(a,b)=>a+fxRand()*(b-a);
const fxRi=(a,b)=>Math.floor(fxRnd(a,b+1));
const fxPick=a=>a[Math.floor(fxRand()*a.length)];
const TOUCH=typeof window!=='undefined'&&((window.matchMedia&&matchMedia('(pointer: coarse)').matches)||('ontouchstart' in window));

export {$,rnd,ri,pick,clamp,esc,dist,wpick,shuffle,angDiff,fxRnd,fxRi,fxPick,TOUCH};
