/* ================= Veins in play (Phase 5) =================
   The runtime side of the Bloom's variety: each vein's twist, the layout rules that change how a
   floor plays, events, the caravan, mirror shadows, and the vein choice at the bottom of the
   Rootworks. Called from raid.js (floorStart, twistUpdate, hooks) and draw.js (drawing).
     vents  (Ember Abyss)       lava vents erupt on a beat and leave burning ground
     flood  (Drowned, Flood)    rooms fill with water; without a Tide it drags and drowns
     dark   (Hollow Choir)      you see a little; enemies sleep until they hear you shoot
     wind   (Glasswind Spires)  each room's wind pushes bodies and bullets; a cliff waits on every floor
     poison (the Sump)          poison pools; creatures caught here carry extra mutations
   Numbers live in src/data/bloom.json. */
import {BLOOM as B,TYPES,GUNS,SPECIES} from './content.js';
import {S} from './state.js';
import {rand} from './rng.js';
import {dist,ri} from './util.js';
import {R,RH,RW,TS,bagAdd,descend,float,gunOfTier,hurtComp,hurtPlayer,msg,partyCreatures,roomAt,spawnFoe,spawnPos,wildEnemy} from './raid.js';
import {veinBlock,useMap} from './bloom.js';
import {ENDGAME as ED} from './content.js';
import {chooseEnding,rulesFor,tethered,unboundMods} from './endgame.js';
import {OL,drawCreature} from './sprites.js';
import {drawPeddler,showOverlay,setPause} from './draw.js';
import {onEnding} from './lore.js';
import {gateBlockText} from './balance.js';
import {gateBlocked} from './playtest.js';
import {mutateGenome} from './genetics.js';
import {sfx} from './audio.js';
import {hideoutFx} from './perks.js';

const EXITS=['stairs','gate','rift','cliff','boss','portal'];
const TW=B.TWISTS,LR=B.LAYOUT_RULES,EV=B.EVENTS.list;
const plan=()=>R.map.plan||{vein:'rootworks',layout:'warrens',event:null};
const twist=()=>B.VEINS[plan().vein].twist;
// Every twist on this floor: the vein's own plus any an Unbound tier lays over it (plan.twists).
const hasTwist=k=>twist()===k||!!(plan().twists&&plan().twists.includes(k));
const flooding=()=>hasTwist('flood')||plan().layout==='flood';
const isDark=()=>hasTwist('dark');
// The vein's key type is in the party and standing (a downed companion doesn't count; slot 3 does).
function keyActive(type){type=type||B.VEINS[plan().vein].key;return!!type&&partyCreatures().some(c=>c.type===type||c.type2===type)}
const floodKey=()=>keyActive('tide');

/* ---------- a new floor ---------- */
function floorStart(){
  const P=plan(),f=R.map.floor;
  if(f>=4&&R.vein&&!R.vmap)R.vmap=useMap(R.vein);
  const m=R.vmap&&f>=4?B.MAPS.kinds[R.vmap.kind]:{};
  const surge=P.event==='surge';
  R.fmods={dmg:(surge?EV.surge.dmg:1)*(m.dmg||1),hp:m.hp||1,coin:(surge?EV.surge.loot:1)*(m.coin||1),kxp:m.kxp||1,wild:m.wild||1};
  // An Unbound tier (and the ending chosen at the Heart) weigh on every floor.
  if(R.tier){const u=unboundMods(R.tier);for(const k in u)R.fmods[k]*=u[k]}
  R.beat=0;R.caravan=null;R.shadowed=new Set();
  if(P.layout==='caravan'&&f%3!==0&&R.mode==='raid'){const C=LR.caravan;R.caravan={x:R.p.x+30,y:R.p.y+20,hp:C.hp,maxHp:C.hp,pay:ri(C.pay[0],C.pay[1])*f}}
  if(P.layout==='nest'&&R.mode==='raid'){R.cages.basic+=LR.nest.cages}
  const L=B.LAYOUTS[P.layout]||{name:'The Heart',desc:'The Bloom itself waits in the next room.'},V=B.VEINS[P.vein];
  const bits=[R.tier?`Unbound tier ${R.tier} · floor ${f-6} of 3 · ${L.name}.`:`Floor ${f} · ${V.short} · ${L.name}.`,L.desc];
  if(R.tier)bits.push(`Rules: ${rulesFor(R.tier).map(x=>x.name).join(', ')}.`);
  if(P.layout==='nest')bits.push(`+${LR.nest.cages} cages for the colony.`);
  if(P.layout==='caravan'&&R.caravan)bits.push(`Keep the trader alive to the extract: ${R.caravan.pay} coin.`);
  if(P.event)bits.push(`Event: ${EV[P.event].name}. ${EV[P.event].desc}`);
  if(R.vmap&&f>=4)bits.push(`Your ${B.MAPS.kinds[R.vmap.kind].name.toLowerCase()} is in play.`);
  if(f>=4&&V.key&&!keyActive())bits.push(`No ${TYPES[V.key].name} standing in your party: the ${twist()==='flood'?'water':twist()==='dark'?'dark':'wind'} has its way.`);
  return bits.join(' ');
}

/* ---------- the vein choice at the bottom of the Rootworks ---------- */
function openVeinChoice(){
  const types=partyCreatures().flatMap(c=>[c.type,c.type2].filter(Boolean));
  const cards=B.VEIN_ORDER.map(v=>{const V=B.VEINS[v],why=veinBlock(v,types);
    return`<div class="mcre" style="box-shadow:0 0 0 2px ${why?'var(--line)':V.col}"><b style="color:${V.col}">${V.name}</b>${V.key?`<small class="status">Key: ${TYPES[V.key].name}</small>`:'<small class="status">No key needed</small>'}
      <small class="grow">${V.blurb}</small>
      <button class="btn small ${why?'':'primary'}" data-p="vein" data-k="${v}" ${why?'disabled':''}>${why||'Go down'}</button></div>`}).join('');
  showOverlay(`<div class="ovhead"><h2>Five veins below</h2><span class="status">Floors 4 to 6. Three veins need their key type in your party, slot 3 included. Everything hits much harder: +6 minutes on the clock.</span><button class="btn" data-p="resume">Not yet</button></div><div class="ovcols c5">${cards}</div>`);
}
function chooseVein(v){
  const types=partyCreatures().flatMap(c=>[c.type,c.type2].filter(Boolean));
  if(!B.VEINS[v]||veinBlock(v,types))return false;
  R.vein=v;setPause(false);descend(4);return true;
}

/* ---------- the Underheart and the Heart ---------- */
// Only cut-free creatures can follow you below Floor 6.
function enterUnderheart(){
  const bad=tethered(partyCreatures());
  if(bad.length){setPause(false);msg(`The Underheart won't let ${bad.map(c=>c.name).join(' and ')} pass: still tethered to the Bloom. Only cut-free creatures (Gen 3 and later) can go down.`);R.stairT=-3;return false}
  const why=gateBlockText('underheart');
  if(why){setPause(false);msg(why);gateBlocked('underheart');R.stairT=-4;return false}
  descend(7);return true;
}
// A Bloomlord that copies your party sends shadows first.
function lordShadows(b){const r=b.room;for(const m of R.comps){if(!m||m.downed)continue;const c=structuredClone(m.c);c.name='Shade of '+c.name;const e=wildEnemy(spawnPos(r),c,r);e.shadow=true;e.hp=e.maxHp=Math.round(e.maxHp*ED.LORDS.mirror.hp*3)}}
function openEndingChoice(){
  const cards=Object.entries(ED.ENDINGS).map(([k,D])=>`<div class="mcre" style="box-shadow:0 0 0 2px ${D.col}"><b style="color:${D.col}">${D.name}</b><small class="grow">${D.desc}</small>
    <small class="status">Afterwards: ${D.unbound.desc} Title: ${D.title}.</small><button class="btn small primary" data-p="ending" data-k="${k}">${D.name} the Bloom</button></div>`).join('');
  showOverlay(`<div class="ovhead"><h2>The Heart</h2><span class="status">Ilsa is beside you. The Bloom is quiet, and listening. What will you do with it?</span></div><div class="ovcols c3">${cards}</div><p class="status">Whatever you choose, the Bloom re-forms as the Unbound Bloom, twenty tiers deep. You can come back to the Heart and choose again.</p>`);
}
function pickEnding(k){if(!chooseEnding(k))return false;onEnding();setPause(false);msg(`You ${ED.ENDINGS[k].name.toLowerCase()} the Bloom. Step into the rift to go home, ${ED.ENDINGS[k].title}.`);return true}

/* ---------- each frame ---------- */
const inRoom=(r,x,y)=>r&&x>=r.ox*TS&&x<=(r.ox+RW)*TS&&y>=r.oy*TS&&y<=(r.oy+RH)*TS;
// Movement multiplier for the player from water.
function moveMul(){
  if(!flooding())return 1;const r=R.cur;if(!r||!r.water||floodKey())return 1;
  return 1-(1-TW.flood.slow)*Math.min(1,r.water/TW.flood.deep);
}
function twistUpdate(dt){
  const P=plan(),p=R.p,r=R.cur;
  // The Underheart's song: every few beats it pulls you toward the middle of the room (a Lumen softens it).
  if(hasTwist('song')&&r&&r.kind!=='start'){const G=TW.song,ph=R.beat%G.every;if(ph<G.dur){const k=keyActive('lumen')?G.lumenMul:1,dx=r.cx-p.x,dy=r.cy-p.y,l=Math.hypot(dx,dy)||1;
    if(l>40)R.songPull={x:dx/l*G.pull*k*dt,y:dy/l*G.pull*k*dt};if(ph<dt)msg('The Choir sings, and the Bloom pulls.')}else R.songPull=null}else R.songPull=null;
  R.beat+=dt;
  // Lava vents: a warning ring, then an eruption that leaves burning ground.
  if(hasTwist('vents')&&r&&r.vents&&r.spawned){
    const V=TW.vents,ph=R.beat%V.every;
    r.ventPhase=ph;
    if(ph<dt&&R.beat>dt)for(const v of r.vents){
      R.fx.push({x:v.x,y:v.y,r:V.radius,t:.35,max:.35,col:'#ff8a3d',fill:true});sfx('hit');
      if(dist(v,p)<V.radius+p.r)hurtPlayer(V.dmg);
      R.comps.forEach(m=>{if(m&&!m.downed&&dist(v,m)<V.radius+m.r)hurtComp(m,V.dmg*.6)});
      (R.hazards=R.hazards||[]).push({x:v.x,y:v.y,r:V.radius*.8,t:V.burnT,dps:V.burnDps,col:'#ff7a3d'});
    }
  }
  // Poison pools (the Sump), unless the Apothecary has reached tier 5.
  if(hasTwist('poison')&&r&&r.pools&&!hideoutFx().poisonImmune){for(const q of r.pools)if(dist(q,p)<TW.poison.radius){hurtPlayer(TW.poison.dps*dt);break}}
  // Lingering hazards: burning ground.
  if(R.hazards){for(const h of R.hazards){h.t-=dt;if(dist(h,p)<h.r)hurtPlayer(h.dps*dt)}R.hazards=R.hazards.filter(h=>h.t>0)}
  // Water rises in every room you've entered.
  if(flooding()){
    for(const rm of R.map.rooms)if(rm.visited&&rm.kind!=='start')rm.water=Math.min(1,(rm.water||0)+TW.flood.rise*dt);
    if(r&&r.water>=TW.flood.deep&&!floodKey()){hurtPlayer(TW.flood.drown*dt);if(!R.drownWarned){R.drownWarned=true;msg('The water is over your head. Find a Tide, or get out of the deep rooms.')}}
  }
  // Wind lanes push you, your companions and every bullet in the room.
  if(hasTwist('wind')&&r&&r.wind){
    const W=TW.wind,k=keyActive('gale')?W.keyPush:1,wx=r.wind.x*W.push*k*dt,wy=r.wind.y*W.push*k*dt;
    R.windMove={x:wx,y:wy};
    for(const b of R.bullets)if(!b.lob&&!b.orbit&&inRoom(r,b.x,b.y)){b.vx+=r.wind.x*W.bullet*dt;b.vy+=r.wind.y*W.bullet*dt}
  }else R.windMove=null;
  // The dark: sleeping enemies notice you up close.
  if(isDark())for(const e of R.enemies)if(e.dormant&&dist(e,p)<TW.dark.notice)wake(e);
  // Gauntlet: the rooms behind you seal once you've moved on (only if the way ahead stays open).
  if(P.layout==='gauntlet'&&r&&r.chain!=null)for(const rm of R.map.rooms)if(rm.chain!=null&&rm.chain<r.chain&&rm.visited&&rm.cleared&&!rm.sealed&&safeToSeal(rm)){seal(rm);if(!R.sealSaid){R.sealSaid=true;msg('The way back has sealed. This floor only goes forward.')}}
  // Sinkhole: rooms you've left fall in (never the way out).
  if(P.layout==='sinkhole')for(const rm of R.map.rooms){
    if(rm===r||!rm.visited||rm.sealed||EXITS.includes(rm.kind))continue;
    rm.left=(rm.left||0)+dt;
    if(rm.left>LR.sinkhole.after-LR.sinkhole.warn&&!rm.warned){rm.warned=true;msg('The floor behind you is giving way.')}
    if(rm.left>LR.sinkhole.after&&!inRoom(rm,p.x,p.y)&&safeToSeal(rm)){seal(rm);R.fx.push({x:rm.cx,y:rm.cy,r:140,t:.6,max:.6,col:'#8a6a4a'})}
  }
  if(r)r.left=0;
  updCaravan(dt);
  // Rival raiders rob you if they reach you.
  for(const e of R.enemies)if(e.rival&&!e.robbed&&e.hp>0&&dist(e,p)<e.r+p.r+6){e.robbed=true;const n=Math.floor(R.bag.coin*EV.rivals.steal);R.bag.coin-=n;e.loot=(e.loot||0)+n;float(p.x,p.y-30,`Robbed: -${n} coin`,'#ff6688',true);msg('A rival raider lifted coin from your bag. Take it back.')}
}
// Sealing a room (the gauntlet's way back, a sinkhole's collapse) must never trap the Keeper: a room
// seals only if, without it, every exit and every room not yet explored can still be reached from here.
function openFrom(start,without){
  const seen=new Set([start]),q=[start];
  while(q.length){const a=q.shift();for(const b of a.links)if(b!==without&&!b.sealed&&!b.hidden&&!seen.has(b)){seen.add(b);q.push(b)}}
  return seen;
}
function safeToSeal(rm){
  const here=R.cur;if(!here||rm===here||inRoom(rm,R.p.x,R.p.y))return false;
  const reach=openFrom(here,rm);
  return R.map.rooms.every(x=>x===rm||x.sealed||x.hidden||x.kind==='secret'||!(EXITS.includes(x.kind)||!x.visited)||reach.has(x));
}
function seal(rm){rm.sealed=true;rm.locked=true;rm.tutLock=true}
function wake(e){if(!e.dormant)return;e.dormant=false;e.cd=Math.max(e.cd||0,.6);float(e.x,e.y-e.r-12,'!','#ff6688',true)}
// Firing in the dark wakes everything that can hear it.
function makeNoise(x,y){if(!isDark())return;for(const e of R.enemies)if(e.dormant&&Math.hypot(e.x-x,e.y-y)<TW.dark.hear)wake(e)}
const seeRadius=()=>keyActive('echo')||keyActive('lumen')?TW.dark.seeKey:TW.dark.see;

/* ---------- rooms: what an entered room spawns besides its plan ---------- */
function enterExtras(r){
  const f=R.map.floor;
  if(r.plan&&r.plan.keeper){const e=spawnFoe(spawnPos(r),'lostkeeper',f,r);e.keeper=true;e.hp=e.maxHp=Math.round(EV.lostkeeper.hp*(f>=4?3:1)*R.fmods.hp);msg('The echo of a Keeper turns to face you.')}
  if(r.plan&&r.plan.rivals)for(let i=0;i<r.plan.rivals;i++){const e=spawnFoe(spawnPos(r),'rival',f,r);e.rival=true;e.hp=e.maxHp=Math.round(EV.rivals.hp*(1+.4*(f-1)));e.loot=ri(EV.rivals.loot[0],EV.rivals.loot[1])}
  if(r.mirror)for(const m of R.comps){if(!m||m.downed)continue;const c=structuredClone(m.c);c.name='Shadow '+c.name;const e=wildEnemy(spawnPos(r),c,r);e.shadow=true;e.hp=e.maxHp=Math.round(e.maxHp*LR.mirror.hp*3);e.dmg*=LR.mirror.dmg*1.6}
  if(r.herd)msg(`A migrating herd of ${SPECIES[r.herd].name} is passing through!`);
  if(r.nest)msg(`A nest of wild ${SPECIES[r.nest].name}. Bring them down gently and cage what you can.`);
  if(isDark())for(const e of R.enemies)if(e.room===r&&e.kind!=='boss')e.dormant=true;
  if(R.fmods)for(const e of R.enemies)if(e.room===r&&!e.fmod){e.fmod=true;if(e.kind!=='wild'){e.hp=Math.round(e.hp*R.fmods.hp);e.maxHp=Math.round(e.maxHp*R.fmods.hp)}e.dmg*=R.fmods.dmg}
}
// Extra drops: Lost Keepers leave gear and shards, rivals what they carried, Sump foes bog sap.
function deathExtras(e){
  if(e.keeper){const g=gunOfTier(3);R.items.push({kind:'gun',id:g,x:e.x,y:e.y+20});S.shards+=EV.lostkeeper.shards;float(e.x,e.y-40,`+${EV.lostkeeper.shards} memory shards`,'#ff8fe0',true);msg(`The Lost Keeper fades. Its ${GUNS[g].name} stays behind.`)}
  if(e.rival){const n=Math.round((e.loot||0)*R.fmods.coin);R.bag.coin+=n;float(e.x,e.y-20,`+${n} coin`,'#ffcf4a',true)}
  if(hasTwist('poison')&&e.kind==='foe'&&!e.shadow&&rand()<B.SUMP_SAP.foe)bagAdd('sap',1,e.x,e.y);
}
// A creature caught in the Sump carries extra mutations; caught in a vein, bog sap comes with Venom.
function caughtExtras(c){
  if(twist()==='poison'){const n=mutateGenome(c.genome,TW.poison.mutations,rand);if(n)float(R.p.x,R.p.y-40,`Mutated ×${n}`,'#9be35a',true)}
  if(c.type==='venom')bagAdd('sap',B.SUMP_SAP.wild,R.p.x,R.p.y);
}
// Shadows from the Mirror layout can't be caged.
const catchable=e=>e.kind==='wild'&&!e.shadow;

/* ---------- the caravan ---------- */
function updCaravan(dt){
  const c=R.caravan;if(!c||c.dead)return;const p=R.p,d=dist(c,p),C=LR.caravan;
  if(d>48&&d<520){const k=Math.min(1,C.speed*dt/d);const nx=c.x+(p.x-c.x)*k,ny=c.y+(p.y-c.y)*k;if(roomAt(nx,ny,0)||roomAt(nx,ny,-24)){c.x=nx;c.y=ny}}
  for(let i=R.bullets.length-1;i>=0;i--){const b=R.bullets[i];if(b.team==='e'&&dist(b,c)<b.r+14){c.hp-=b.dmg;R.bullets.splice(i,1)}}
  for(const e of R.enemies)if(e.melee&&e.hp>0&&dist(e,c)<e.r+16&&rand()<C.aggro*dt)c.hp-=e.dmg;
  if(c.hp<=0){c.dead=true;msg('The trader fell. No payout this floor.');sfx('fail')}
}
// Paid when you extract with the trader alive and close.
function caravanPay(){const c=R.caravan;if(!c||c.dead||dist(c,R.p)>200)return 0;R.caravan=null;return c.pay}

/* ---------- drawing (world space) ---------- */
function drawTwists(g,t){
  const r=R.cur,M=R.map;
  for(const rm of M.rooms){
    if(!rm.visited)continue;
    if(rm.water>0){g.fillStyle=`rgba(40,120,200,${Math.min(.5,rm.water*.5)})`;g.fillRect(rm.ox*TS,rm.oy*TS,RW*TS,RH*TS);
      g.strokeStyle='rgba(160,220,255,.25)';g.lineWidth=2;for(let k=0;k<5;k++){const y=rm.oy*TS+((t*20+k*70)%(RH*TS));g.beginPath();g.moveTo(rm.ox*TS,y);g.quadraticCurveTo(rm.cx,y+Math.sin(t+k)*6,(rm.ox+RW)*TS,y);g.stroke()}}
    if(rm.sealed){g.fillStyle='rgba(10,6,20,.55)';g.fillRect(rm.ox*TS,rm.oy*TS,RW*TS,RH*TS)}
    if(rm.pools)for(const q of rm.pools){g.globalAlpha=.55+.1*Math.sin(t*2+q.x);g.fillStyle='#5a8a2a';g.beginPath();g.ellipse(q.x,q.y,TW.poison.radius,TW.poison.radius*.7,0,0,7);g.fill();g.globalAlpha=1;
      g.fillStyle='#c8ff6a';for(let k=0;k<3;k++){const ph=(t*.7+k/3+q.x)%1;g.globalAlpha=1-ph;g.beginPath();g.arc(q.x+Math.sin(k*2+q.y)*14,q.y-ph*16,3,0,7);g.fill()}g.globalAlpha=1}
    if(rm.vents){const V=TW.vents,ph=rm===r?(R.beat%V.every):0;for(const v of rm.vents){g.fillStyle='#2a1010';g.strokeStyle=OL;g.lineWidth=2;g.beginPath();g.ellipse(v.x,v.y,14,9,0,0,7);g.fill();g.stroke();
      g.fillStyle='#ff8a3d';g.globalAlpha=.5+.3*Math.sin(t*6);g.beginPath();g.ellipse(v.x,v.y,8,5,0,0,7);g.fill();g.globalAlpha=1;
      if(rm===r&&ph>V.every-V.warn){const k=(ph-(V.every-V.warn))/V.warn;g.strokeStyle=`rgba(255,120,60,${.4+.5*k})`;g.lineWidth=3;g.setLineDash([6,5]);g.beginPath();g.arc(v.x,v.y,V.radius,0,7);g.stroke();g.setLineDash([])}}}
    if(rm.wind&&rm===r){g.strokeStyle='rgba(232,255,248,.35)';g.lineWidth=2;for(let k=0;k<10;k++){const ph=(t*.9+k*.13)%1,x0=rm.ox*TS+((k*137)%(RW*TS)),y0=rm.oy*TS+((k*71)%(RH*TS));
      const x=x0+rm.wind.x*ph*120,y=y0+rm.wind.y*ph*120;g.globalAlpha=Math.sin(ph*Math.PI)*.8;g.beginPath();g.moveTo(x,y);g.lineTo(x+rm.wind.x*26,y+rm.wind.y*26);g.stroke()}g.globalAlpha=1}
  }
  if(R.hazards)for(const h of R.hazards){g.globalAlpha=.35*Math.min(1,h.t);g.fillStyle=h.col;g.beginPath();g.arc(h.x,h.y,h.r,0,7);g.fill();g.globalAlpha=1}
  const c=R.caravan;if(c&&!c.dead){drawPeddler(g,c.x,c.y,t);g.fillStyle='#2a0f1c';g.fillRect(c.x-18,c.y-34,36,5);g.fillStyle='#5de8b0';g.fillRect(c.x-18,c.y-34,36*Math.max(0,c.hp/c.maxHp),5);g.font='600 11px "Pixelify Sans",monospace';g.textAlign='center';g.fillStyle='#ffcf4a';g.fillText(`TRADER · ${c.pay}c`,c.x,c.y-38)}
}
// Screen space: the dark of the Hollow Choir.
function drawDark(g,s){
  if(!isDark())return;const cx=R.vw/2,cy=R.vh/2,rad=seeRadius()*s;
  const gr=g.createRadialGradient(cx,cy,rad*.55,cx,cy,rad);gr.addColorStop(0,'rgba(4,2,12,0)');gr.addColorStop(1,'rgba(4,2,12,.97)');
  g.fillStyle=gr;g.fillRect(0,0,R.vw,R.vh);
}
// Shadows are drawn as grey statues come to life.
const drawShadow=(g,e,t)=>drawCreature(g,e.c,e.x,e.y,.9,t,{face:e.face,stone:true});

/* ---------- the Test Lab ---------- */
function labVein(v){if(!R)return;R.vein=v;descend(4)}

export {safeToSeal,openFrom,enterUnderheart,lordShadows,openEndingChoice,pickEnding,hasTwist,plan,twist,flooding,isDark,keyActive,floorStart,openVeinChoice,chooseVein,moveMul,twistUpdate,wake,makeNoise,seeRadius,enterExtras,deathExtras,caughtExtras,catchable,updCaravan,caravanPay,drawTwists,drawDark,drawShadow,labVein};
