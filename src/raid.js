/* ================= Raid engine ================= */
import {fxRand,mixSeed,newSeed,rand,seedRng,withSeed} from './rng.js';
import {$,TOUCH,angDiff,clamp,dist,esc,fxRi,pick,ri,rnd,shuffle,wpick} from './util.js';
import {ENDGAME,BLOOM,ABILITIES,ATTACKS,BOND_PASSIVE,BOSSES,BOSS_IDS,BUFFS,BUFF_IDS,CURSES,CURSE_IDS,FOES,FOE_IDS,GENETICS,GUNS,GUN_IDS,JOBS,NPCS,NPC_IDS,ROOM_MODS,ROOM_MOD_IDS,SPECIES,TRAITS,TYPES,TYPE_IDS,WILD_FIRE,comboFor,comboKey,foePool,reactionFor,speciesOf,typesOf} from './content.js';
import {save} from './save.js';
import {S,unplace,addBond,addKeeperXp,addLog,armoryTier,bondStar,bump,byId,cageCap,canEvolve,dexFoe,dexForm,formName,gainXp,keeperNeed,killCreature,makeCreature,modeUnlocked,npcQuest,priceMul,passDay,res,secTier,sexSym,stats,ui,weaponDmgMul,wildStageFor} from './state.js';
import {sfx} from './audio.js';
import {startHideoutMap} from './map.js';
import {closeModal,openModal,renderAll,validGuns} from './ui.js';
import {goLandscape,lockPage,resize,showOverlay,startLoop,stopLoop} from './draw.js';
import {amt,foundGun,give,gunDmgMul,itemByUid,itemName,matName,roleInfo,roleOf,satchelSlots,scrapItem,usable} from './jobs.js';
import {emit} from './events.js';
import {express} from './genetics.js';
import {caravanPay,catchable,caughtExtras,deathExtras,enterExtras,floorStart,moveMul,makeNoise,openVeinChoice,twistUpdate} from './veins.js';
import {lordDamage,clearTier,onStoryBoss,ruleOn,tierLoot,deepeningSeed} from './endgame.js';
import {enterUnderheart,lordShadows,openEndingChoice} from './veins.js';
import {richAmount,veinRich,floorPlan,herdSpecies,pickBoss,pickRaidSeed,rememberSeed,rollWildIn,veinIdx,veinOfFloor} from './bloom.js';
import {awardBossTrophy,extractTitles,perk,recordShared} from './hideout.js';
import {DEMO,tutorialDone} from './demo.js';
import {lorePick,loreRoom,placeLore,restChest} from './lore.js';
import {BALANCE,LORE} from './content.js';
import {catchupMul,gateBlockText} from './balance.js';
import {assistAim,enemyBulletMul,resetScale} from './access.js';
import {gateBlocked} from './playtest.js';
import {OPTS} from './device.js';
import {logEvent} from './history.js';
const TS=32,RW=15,RH=11,CW=RW+6,CH=RH+6;
let R=null;
const keys=new Set();
const touch={move:null,aim:null};
const localFloor=f=>(f-1)%3+1;
const isBossFloor=f=>f%3===0;
const capT=()=>res('capture',3)?.6:.5;
const isWeak=e=>e.kind==='wild'&&!e.shadow&&e.hp>0&&e.hp/e.maxHp<=capT();

function rollWildSpecies(floor,lair,vein){return rollWildIn(floor,vein||(R&&R.map&&R.map.plan?R.map.plan.vein:null),lair,R&&R.vmap&&R.vmap.kind==='lure'?BLOOM.MAPS.kinds.lure.typeMul:1)}
function newRoom(rooms,grid,gx,gy,kind){const r={gx,gy,ox:gx*CW+3,oy:gy*CH+3,links:[],kind:kind||'fight',spawned:false,cleared:false,locked:false,visited:false,doors:[],idx:rooms.length};rooms.push(r);grid[gx+','+gy]=r;return r}
// plan: {vein, layout, event} from bloom.js (the arena and tutorial pass none).
function genMap(floor,arena,bossId,plan){
  plan=plan||{vein:veinOfFloor(floor),layout:'warrens',event:null};
  const LR=BLOOM.LAYOUT_RULES,lay=plan.layout,vein=plan.vein,tws=new Set([BLOOM.VEINS[vein].twist,...(plan.twists||[])]),tier=plan.tier||0,ub=id=>ruleOn(tier,id);
  // The Heart: one antechamber and the Heart's own room.
  if(lay==='heart'&&!arena){const rooms=[],grid={},a=newRoom(rooms,grid,1,1,'start'),b=newRoom(rooms,grid,2,1,'boss');a.links.push(b);b.links.push(a);a.dist=0;b.dist=1;a.cleared=a.visited=true;b.bossId=bossId;
    // The Keepers' Rest: a hidden room below the antechamber, given away by one rune wall.
    const rest=newRoom(rooms,grid,1,2,'secret');rest.hidden=true;rest.host=a;rest.rest=true;rest.links.push(a);a.links.push(rest);rest.chest={x:0,y:0,open:false,rich:true};rest.plan={foes:[],wilds:[]};
    const M=buildMap(rooms,grid,4,4,floor,false,a);M.plan=plan;return M}
  const G=arena?1:4,rooms=[],grid={};const loc=localFloor(floor),set=floor>=4?1:0;
  const add=(gx,gy,kind)=>newRoom(rooms,grid,gx,gy,kind);
  const start=add(arena?0:ri(0,3),arena?0:ri(0,3));
  const target=arena?1:8+loc+(lay==='labyrinth'?LR.labyrinth.rooms:0);let guard=0;
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  if(lay==='gauntlet'){
    // A chain: every new room hangs off the last one, so there's one way through.
    let last=start;
    while(rooms.length<target&&guard++<400){const opts=dirs.map(([dx,dy])=>[last.gx+dx,last.gy+dy]).filter(([x,y])=>x>=0&&y>=0&&x<G&&y<G&&!grid[x+','+y]);
      if(!opts.length)break;const [nx,ny]=pick(opts);const b=add(nx,ny);last.links.push(b);b.links.push(last);last=b}
  }
  while(rooms.length<target&&guard++<1000){const a=pick(rooms);const[dx,dy]=pick(dirs);const nx=a.gx+dx,ny=a.gy+dy;
    if(nx<0||ny<0||nx>=G||ny>=G||grid[nx+','+ny])continue;const b=add(nx,ny);a.links.push(b);b.links.push(a)}
  start.dist=0;const q=[start];while(q.length){const r=q.shift();for(const n of r.links)if(n.dist==null){n.dist=r.dist+1;q.push(n)}}
  start.kind=arena?'arena':'start';start.cleared=true;start.visited=true;
  if(!arena){
    const others=rooms.filter(r=>r!==start).sort((a,b)=>b.dist-a.dist);let i=0;const set1=k=>{if(others[i])others[i++].kind=k};
    if(isBossFloor(floor)){set1('boss');set1('rift');set1('cliff')}else{set1('stairs');set1('gate');if(tws.has('wind'))set1('cliff')}
    if(loc>=2)set1('lair');
    const rest=shuffle(others.slice(i));let j=0;const put=k=>{if(rest[j])rest[j++].kind=k;return rest[j-1]};
    put('chest');put('chest');
    if(rand()<.75&&!ub('nopeddlers'))put('shop');
    if(rand()<.35)put('shrine');
    const pool=foePool(floor,vein),newIntro=loc+set*3;
    const swarm=S.modes.swarm&&modeUnlocked('swarm')?2:0;
    const wildMul=(S.modes.hunter&&modeUnlocked('hunter')?2:1)*(secTier('roost')>=4?1.3:1)*(res('capture',4)?1.25:1);
    for(const r of rooms){
      if(['start','shop','shrine','boss'].includes(r.kind))continue;
      const base={fight:[3,4],chest:[1,2],stairs:[3,4],gate:[2,3],rift:[3,4],cliff:[2,3],lair:[3,4]}[r.kind];
      const n=Math.max(1,ri(base[0],base[1])+(loc-1)+swarm+(ub('swarm')?2:0)-(lay==='labyrinth'?LR.labyrinth.foesMinus:0));
      const wc=r.kind==='lair'?(rand()<.5?1:0):(rand()<(loc===3?.26:.2)*wildMul?1:0);
      const foes=[];while(foes.length<n-wc)foes.push(wpick(pool,k=>FOES[k].intro===newIntro||FOES[k].vein===vein&&vein!=='rootworks'?2.2:1));
      r.plan={foes,wilds:Array.from({length:wc},()=>rollWildSpecies(floor,r.kind==='lair',vein)),elite:r.kind==='lair'};
      if((r.kind==='fight'||r.kind==='lair')&&(ub('twisted')||rand()<(floor===1?.15:.25)))r.mod=pick(ROOM_MOD_IDS);
    }
    const fights=()=>shuffle(rooms.filter(r=>r.kind==='fight'||r.kind==='chest'));
    // Layouts.
    if(lay==='gauntlet')rooms.forEach(r=>{r.chain=r.dist});
    if(lay==='nest'){const r=fights()[0];if(r){const sp=rollWildSpecies(floor,true,vein);r.nest=sp;r.mod=null;
      r.plan={foes:Array.from({length:LR.nest.foes},()=>pick(pool)),wilds:Array.from({length:ri(LR.nest.wilds[0],LR.nest.wilds[1])},()=>sp),elite:false}}}
    if(lay==='mirror')rooms.forEach(r=>{if(r.kind==='fight'&&rand()<LR.mirror.rooms)r.mirror=true});
    // Events placed on this floor.
    const ev=plan.event;
    if(ev==='migration'){const r=fights()[0];if(r){const sp=herdSpecies(vein),E=BLOOM.EVENTS.list.migration;r.plan.wilds.push(...Array.from({length:ri(E.herd[0],E.herd[1])},()=>sp));r.herd=sp}}
    if(ev==='lostkeeper'){const r=fights()[0];if(r)r.plan.keeper=true}
    if(ev==='rivals'){const r=fights()[0];if(r)r.plan.rivals=BLOOM.EVENTS.list.rivals.n}
    if(ev==='cache'){const r=rooms.find(x=>x.kind==='chest')||fights()[0];if(r){r.cache=true;if(r.kind!=='chest')r.kind='chest'}}
    if(bossId)rooms.find(r=>r.kind==='boss').bossId=bossId;
    const secrets=lay==='labyrinth'?LR.labyrinth.secrets:1;
    for(let k=0;k<secrets;k++)if(rand()<(lay==='labyrinth'?.9:.65)){
      const hosts=shuffle(rooms.filter(r=>!['boss','start','secret'].includes(r.kind)));
      outer:for(const h of hosts)for(const[dx,dy]of shuffle([[1,0],[-1,0],[0,1],[0,-1]])){const nx=h.gx+dx,ny=h.gy+dy;if(nx<0||ny<0||nx>=G||ny>=G||grid[nx+','+ny])continue;
        const s=add(nx,ny,'secret');s.hidden=true;s.host=h;s.links.push(h);h.links.push(s);s.chest={x:0,y:0,open:false,rich:true};
        s.plan={foes:[],wilds:rand()<.4?[rollWildSpecies(floor,true,vein)]:[]};break outer}
    }
  }
  const M=buildMap(rooms,grid,G,G,floor,arena,start);M.plan=plan;
  // Vein twists that live in the map: lava vents, poison pools and wind lanes.
  if(!arena)for(const r of rooms){
    if(['start','shop','shrine','secret'].includes(r.kind))continue;
    const spot=()=>({x:(r.ox+rnd(2,RW-2))*TS,y:(r.oy+rnd(2,RH-2))*TS});
    if(tws.has('vents'))r.vents=Array.from({length:BLOOM.TWISTS.vents.perRoom},spot);
    if(tws.has('poison'))r.pools=Array.from({length:BLOOM.TWISTS.poison.pools},spot);
    if(tws.has('wind')){const a=pick([0,Math.PI/2,Math.PI,-Math.PI/2]);r.wind={x:Math.round(Math.cos(a)),y:Math.round(Math.sin(a))}}
  }
  return M;
}
function genTutorialMap(){
  const rooms=[],grid={};
  const a=newRoom(rooms,grid,0,0,'tutA'),b=newRoom(rooms,grid,1,0,'tutB'),c=newRoom(rooms,grid,2,0,'rift');
  a.links.push(b);b.links.push(a,c);c.links.push(b);a.visited=true;a.spawned=true;b.spawned=true;c.spawned=true;
  a.locked=c.locked=true;a.tutLock=c.tutLock=true;
  return buildMap(rooms,grid,3,1,1,false,a);
}
function buildMap(rooms,grid,Gx,Gy,floor,arena,start){
  const W=Gx*CW,H=Gy*CH,tiles=new Uint8Array(W*H),doorOwner=new Map(),cracks=new Map();
  for(const r of rooms)for(let j=0;j<RH;j++)for(let i=0;i<RW;i++)tiles[(r.oy+j)*W+r.ox+i]=1;
  const done=new Set();
  for(const a of rooms)for(const b of a.links){
    const k=Math.min(a.idx,b.idx)+'-'+Math.max(a.idx,b.idx);if(done.has(k))continue;done.add(k);
    const[p,q2]=(a.gx<b.gx||a.gy<b.gy)?[a,b]:[b,a];
    const sec=p.kind==='secret'?p:q2.kind==='secret'?q2:null,host=sec?(sec===p?q2:p):null;
    const crack=sec?{hp:60+floor*20,max:60+floor*20,tiles:[],room:sec,broken:false,area:new Set()}:null;
    // A secret room's hallway and the room itself stay hidden (unpainted) until its cracked wall is broken.
    const floorT=i=>{tiles[i]=1;if(crack)crack.area.add(i)};
    const door=(i,r)=>{if(sec){if(r===host){tiles[i]=4;crack.tiles.push(i);cracks.set(i,crack)}else floorT(i);return}tiles[i]=3;doorOwner.set(i,r);r.doors.push(i)};
    if(p.gy===q2.gy){const cy=p.oy+(RH>>1);
      for(let x=p.ox+RW;x<q2.ox;x++)for(let y=cy-1;y<=cy+1;y++)floorT(y*W+x);
      for(let y=cy-1;y<=cy+1;y++){door(y*W+p.ox+RW,p);door(y*W+q2.ox-1,q2)}
    }else{const cx=p.ox+(RW>>1);
      for(let y=p.oy+RH;y<q2.oy;y++)for(let x=cx-1;x<=cx+1;x++)floorT(y*W+x);
      for(let x=cx-1;x<=cx+1;x++){door((p.oy+RH)*W+x,p);door((q2.oy-1)*W+x,q2)}
    }
  }
  for(const r of rooms){
    if(['fight','lair','chest','arena'].includes(r.kind)){
      const n=r.kind==='arena'?4:ri(0,3);
      for(let k=0;k<n;k++){const px=r.ox+ri(2,RW-4),py=r.oy+ri(2,RH-4);
        if(Math.abs(px+1-(r.ox+RW/2))<3.5&&Math.abs(py+1-(r.oy+RH/2))<3)continue;
        for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)tiles[(py+dy)*W+px+dx]=2}
    }
    r.cx=(r.ox+RW/2)*TS;r.cy=(r.oy+RH/2)*TS;
    if(r.kind==='chest'||r.kind==='lair')r.chest={x:r.cx,y:r.cy,open:false};
    if(r.kind==='secret'){r.chest.x=r.cx;r.chest.y=r.cy}
  }
  const hidden=new Set();
  // (The cracked wall itself is never hidden: it's drawn as an ordinary wall.)
  for(const cr of new Set(cracks.values())){for(let j=0;j<RH;j++)for(let i=0;i<RW;i++)cr.area.add((cr.room.oy+j)*W+cr.room.ox+i);cr.tiles.forEach(t=>cr.area.delete(t));cr.area.forEach(t=>hidden.add(t))}
  return{G:Math.max(Gx,Gy),Gx,Gy,W,H,tiles,doorOwner,cracks,hidden,rooms,grid,start,floor,arena:!!arena};
}
function solidAt(M,tx,ty){if(tx<0||ty<0||tx>=M.W||ty>=M.H)return true;const i=ty*M.W+tx,t=M.tiles[i];if(t===1)return false;if(t===3)return M.doorOwner.get(i).locked;return true}
function hitsWall(x,y,r){const M=R.map;const x0=Math.floor((x-r)/TS),x1=Math.floor((x+r)/TS),y0=Math.floor((y-r)/TS),y1=Math.floor((y+r)/TS);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++)if(solidAt(M,tx,ty))return true;return false}
function moveEnt(e,dx,dy){let moved=false;if(!hitsWall(e.x+dx,e.y,e.r)){e.x+=dx;moved=true}if(!hitsWall(e.x,e.y+dy,e.r)){e.y+=dy;moved=true}return moved}
function roomAt(x,y,m=0){
  const M=R.map,gx=Math.floor(x/TS/CW),gy=Math.floor(y/TS/CH),r=M.grid[gx+','+gy];if(!r)return null;
  if(x>=r.ox*TS+m&&x<=(r.ox+RW)*TS-m&&y>=r.oy*TS+m&&y<=(r.oy+RH)*TS-m)return r;return null;
}
const PALS={1:{a:'#2c4a55',b:'#284450',fl:'#3a6070',wall:'#336b66',top:'#5fb3a0',edge:'#142630'},2:{a:'#3a2a5e',b:'#33255a',fl:'#4a3878',wall:'#5d43a3',top:'#8d6fe0',edge:'#1d1438'},3:{a:'#2f3a2a',b:'#2a3426',fl:'#3f4f34',wall:'#4f6a3a',top:'#a8d86a',edge:'#141f0f'},
  4:{a:'#4a2a2a',b:'#432626',fl:'#5e3434',wall:'#8a3a3a',top:'#ff8a5c',edge:'#240f0f'},5:{a:'#3a1f2f',b:'#341b2a',fl:'#4f2a3f',wall:'#7a2a4f',top:'#ff5ca8',edge:'#1f0a14'},6:{a:'#1f1f2f',b:'#1b1b2a',fl:'#2f2f45',wall:'#3a3a5a',top:'#ffa04f',edge:'#0a0a14'},
  arena:{a:'#4a2f3f',b:'#43293a',fl:'#5e3c50',wall:'#7a3f5a',top:'#ff8fb1',edge:'#24101c'}};
function paintTile(g,M,x,y,pal){
  const hid=i=>M.hidden&&M.hidden.has(i);
  const walk=(x,y)=>{if(x<0||y<0||x>=M.W||y>=M.H)return false;const i=y*M.W+x,t=M.tiles[i];return(t===1||t===3)&&!hid(i)};
  if(hid(y*M.W+x))return;
  if(walk(x,y)){g.fillStyle=(x+y)%2?pal.a:pal.b;g.fillRect(x*TS,y*TS,TS,TS);if(fxRand()<.18){g.fillStyle=pal.fl;g.fillRect(x*TS+fxRi(4,24),y*TS+fxRi(4,24),fxRi(2,5),fxRi(2,4))}return}
  let near=false;for(let dy=-1;dy<=1&&!near;dy++)for(let dx=-1;dx<=1;dx++)if(walk(x+dx,y+dy)){near=true;break}
  if(!near&&M.tiles[y*M.W+x]!==4)return;
  g.fillStyle=pal.wall;g.fillRect(x*TS,y*TS,TS,TS);
  g.fillStyle=pal.top;g.fillRect(x*TS,y*TS,TS,6);
  g.fillStyle=pal.edge;g.fillRect(x*TS,y*TS+TS-4,TS,4);
  if(walk(x,y+1)){g.fillStyle='rgba(0,0,0,.25)';g.fillRect(x*TS,(y+1)*TS,TS,6)}
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(x*TS+(y%2?4:18),y*TS+12,10,2);
  // A hidden door looks like any wall until it's struck; then it cracks a little more with each blow.
  const cr=M.tiles[y*M.W+x]===4&&M.cracks.get(y*M.W+x);
  if(cr&&cr.hp<cr.max){const k=1-cr.hp/cr.max;g.strokeStyle='rgba(0,0,0,.5)';g.lineWidth=1.5;g.beginPath();g.moveTo(x*TS+8,y*TS+8);g.lineTo(x*TS+15,y*TS+16);if(k>.3){g.lineTo(x*TS+11,y*TS+24)}if(k>.6){g.moveTo(x*TS+15,y*TS+16);g.lineTo(x*TS+24,y*TS+19)}g.stroke()}
}
// Each vein has a palette per floor (in bloom.json); the arena keeps its own.
const palFor=M=>M.arena?PALS.arena:BLOOM.VEINS[(M.plan&&M.plan.vein)||veinOfFloor(M.floor)].pals[localFloor(M.floor)-1];
function renderMapCanvas(M){
  const c=document.createElement('canvas');c.width=M.W*TS;c.height=M.H*TS;const g=c.getContext('2d');
  const pal=palFor(M);
  g.fillStyle='#0d0a1c';g.fillRect(0,0,c.width,c.height);
  for(let y=0;y<M.H;y++)for(let x=0;x<M.W;x++)paintTile(g,M,x,y,pal);
  return c;
}
function damageCrack(i,dmg){
  const M=R.map,cr=M.cracks.get(i);if(!cr||cr.broken)return;
  const g=R.mapCv.getContext('2d'),pal=palFor(M),stage=k=>Math.floor(3*(1-k/cr.max)),was=stage(cr.hp);
  cr.hp-=dmg;R.fx.push({x:(i%M.W+.5)*TS,y:(Math.floor(i/M.W)+.5)*TS,r:10,t:.2,max:.2,col:'#c9b48a'});
  if(cr.hp>0){if(stage(cr.hp)!==was||was===0)cr.tiles.forEach(t=>paintTile(g,M,t%M.W,Math.floor(t/M.W),pal));return}
  cr.broken=true;
  // The wall gives way: the hallway and the room behind it appear, as plain floor.
  cr.tiles.forEach(t=>{M.tiles[t]=1;M.cracks.delete(t);M.hidden.delete(t)});
  const near=new Set();for(const t of [...cr.area,...cr.tiles]){M.hidden.delete(t);const x=t%M.W,y=Math.floor(t/M.W);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)near.add((y+dy)*M.W+x+dx)}
  near.forEach(t=>{const x=t%M.W,y=Math.floor(t/M.W);g.fillStyle='#0d0a1c';g.fillRect(x*TS,y*TS,TS,TS);paintTile(g,M,x,y,pal)});
  cr.room.hidden=false;R.fx.push({x:(cr.tiles[1]%M.W+.5)*TS,y:(Math.floor(cr.tiles[1]/M.W)+.5)*TS,r:60,t:.5,max:.5,col:'#ffcf4a'});
  msg('The wall crumbles. A secret room!');sfx('door');R.kxp+=20;
}

/* ---------- raid setup ---------- */
// Size from genes nudges the hitbox.
const hitboxMul=c=>GENETICS.EFFECTS.sizeHitbox[c.looks?c.looks.size:1];
/* ---------- raid roles ---------- */
// Combat roles (Striker, Bulwark, Medic) work while that companion is standing; Scout, Hauler and
// Catcher work from any loadout slot, slot 3 included.
const partyCreatures=()=>[...R.comps.filter(m=>m&&!m.downed).map(m=>m.c),...(R.slot3?[R.slot3.c]:[])];
const roleInParty=r=>!!R&&partyCreatures().some(c=>roleOf(c)===r);
const roleComp=(m,r)=>!!m&&!m.downed&&roleOf(m.c)===r;
/* ---------- the bag ---------- */
// Each slot holds BAG.stack of one material, or one print. Coin needs no room.
const BAG_MATS=['ore','food','hide','dust','sap'];
function bagUsed(){return BAG_MATS.reduce((a,m)=>a+Math.ceil((R.bag[m]||0)/JOBS.BAG.stack),0)+R.prints.length}
// A pickup goes into the bag, scaled by what this floor's vein is rich in (Ember Abyss ore ×1.6).
function bagAdd(mat,n,x,y){
  n=richAmount(R.map&&R.map.plan&&R.map.plan.vein,mat,n);
  const st=JOBS.BAG.stack,have=R.bag[mat]||0,room=(st-have%st)%st+Math.max(0,R.bagCap-bagUsed())*st,add=Math.min(n,room);
  R.bag[mat]=have+add;
  if(add<n&&x!=null){float(x,y-28,'Bag full','#ff6688',true);if(!R.bagWarned){R.bagWarned=true;msg('Your bag is full. Extract to bank it, or bring a Hauler or a satchel next time.')}}
  return add;
}
function makeComp(c){
  const st=stats(c),mh=Math.round(st.hp*(secTier('spring')>=4?1.1:1)*(res('bond',1)?1.1:1)*(roleOf(c)==='bulwark'?1+JOBS.ROLES.bulwark.hp:1));
  return{c,st,x:R.p.x+rnd(-30,30),y:R.p.y+rnd(-30,30),r:Math.round(12*hitboxMul(c)),hp:Math.max(1,Math.min(c.hp*(mh/st.hp),mh)),maxHp:mh,atk:st.atk,spd:st.spd,obey:st.obey,
    cd:rnd(.3,1),abil:0,downed:false,rev:0,sulk:0,obeyCheck:rnd(3,6),face:1,flash:0,dash:0,xpGain:0,kills:0,stuck:0,seed:rand()*9,lastStand:st.star>=5};
}
// Each floor is generated on its own stream seeded from the raid seed, the floor number and the vein,
// so the same seed always builds the same floors, whatever happened in the fight before.
function genFloor(seed,f,arena,vein,tier=0){
  const plan=arena?null:floorPlan(seed,f,vein,tier),v=plan?plan.vein:'rootworks';
  return withSeed(mixSeed(seed,f+veinIdx(v)*16+tier*256),()=>{const boss=(isBossFloor(f)||v==='heart')&&!arena?pickBoss(v,tier):null;return{boss,plan,M:genMap(f,arena,boss,plan)}});
}
// vein: for raids started below Floor 3 (the Test Lab), which vein the floors belong to.
// opts.tier: an Unbound tier (the raid runs floors 7 to 9 of the Unbound Bloom); opts.deepening: the week of a Deepening run.
function startRaid(mode,startFloor,seed,vein,opts={}){
  closeModal();
  const tier=opts.tier||0;if(tier){startFloor=ENDGAME.UNBOUND.floors[0];vein='unbound'}
  if(opts.deepening!=null)seed=deepeningSeed(opts.deepening);
  const f0=startFloor||1,tut=mode==='tutorial',real=mode==='raid'||mode==='scav';
  // A new raid's seed is picked so its layouts and event don't repeat a recent raid's.
  seed=seed!=null?seed>>>0:real?pickRaidSeed():newSeed();seedRng(mixSeed(seed,0));
  if(real&&opts.deepening==null)rememberSeed(seed);
  const deepVein=f0>=4?(vein||'ember'):null;
  const{M}=tut?{M:genTutorialMap()}:genFloor(seed,f0,mode==='arena',deepVein,tier);
  R={mode,seed,id:mode==='arena'||tut?mode:S.stats.raids+1,map:M,mapCv:renderMapCanvas(M),t:0,time:mode==='arena'||tut?0:600+(f0>=4?360:0)+(f0>=7?ENDGAME.UNDERHEART.timeAdd:0)-(ruleOn(tier,'shortnight')?120:0),
    p:{x:M.start.cx,y:M.start.cy+40,r:11,hp:100,maxHp:100,roll:0,rollCd:0,rvx:0,rvy:0,vx:0,vy:0,inv:0,hurt:0,slow:0,fireCd:0},
    comps:[null,null],slot3:null,enemies:[],bullets:[],fields:[],floats:[],fx:[],items:[],trail:[],swings:[],timers:[],bolts:[],
    bag:{coin:0,ore:0,food:0,hide:0,dust:0,sap:0},prints:[],tonics:0,satchel:null,bagCap:JOBS.BAG.slots,cages:{basic:0,gilded:0},guns:['pistol',null],gunItem:[null,null],active:0,spin:0,burst:[],
    buffs:{},curses:new Set(),leechAcc:0,aim:0,firing:false,mouse:null,shield:0,prism:0,taunt:0,tauntEnt:null,fortress:0,rally:null,
    combo:{cd:10,max:20*(res('bond',2)?.75:1)},kxp:0,kills:0,caught:0,autoRev:secTier('spring')>=5?1:0,
    msg:'',msgT:0,prompt:'',ext:0,stairT:0,cur:M.start,paused:false,over:false,last:0,saved:{},shops:{},taken:[],
    vein:deepVein,tier,deepening:opts.deepening??null,relics:0,vmap:null,fmods:{dmg:1,hp:1,coin:1,kxp:1,wild:1},hazards:[],beat:0,eliteKills:0,
    floorsSeen:new Set([f0]),heardCrack:false,god:tut,tut:tut?{step:0,moved:0,rolled:false,abil:false,lx:M.start.cx,ly:M.start.cy+40}:null};
  R.mods={hp:S.modes.hunter&&modeUnlocked('hunter')?1.2:1,dmg:S.modes.iron&&modeUnlocked('iron')?1.4:1,
    coin:(S.modes.iron&&modeUnlocked('iron')?1.6:1)*(S.modes.swarm&&modeUnlocked('swarm')?1.3:1)*(res('economy',0)?1.15:1),
    kxp:(S.modes.hunter&&modeUnlocked('hunter')?1.2:1)*(S.modes.iron&&modeUnlocked('iron')?1.5:1)*(res('economy',4)?1.15:1),buff:S.modes.swarm&&modeUnlocked('swarm')?1.5:1};
  if(mode==='scav'){R.cages.basic=1;S.stats.raids++;R.id=S.stats.raids;msg('Scav run: a loaner pistol and one cage. Nothing of yours is at risk.')}
  else{
    validGuns();
    const sl=S.loadout.slots.map(byId);
    // Weapons: R.guns holds gun ids for combat, R.gunItem the matching owned item (null for the
    // pistol or a gun found this raid). Broken weapons stay home.
    const its=S.loadout.guns.map(uid=>{const it=itemByUid(uid);return it&&usable(it)?it:null});
    R.gunItem=[its[0],its[1]];R.guns=its.map(it=>it?it.id:null);if(!R.guns[0]){R.guns[0]='pistol';R.gunItem[0]=null}
    if(mode==='arena'||tut){sl.forEach(c=>{if(c)R.saved[c.id]=c.hp});R.cages={basic:tut?3:99,gilded:0}}
    else{
      const sat=itemByUid(S.loadout.satchel);R.satchel=sat&&usable(sat)?sat:null;R.tonics=Math.min(S.loadout.tonics||0,amt('tonic'));give('tonic',-R.tonics);
      let n=cageCap();const g=Math.min(n,S.cages.gilded);S.cages.gilded-=g;n-=g;const b=Math.min(n,S.cages.basic);S.cages.basic-=b;R.cages={basic:b,gilded:g};
      R.taken=R.gunItem.filter(Boolean);
      S.stats.raids++;
    }
    R.comps=[sl[0]?makeComp(sl[0]):null,sl[1]?makeComp(sl[1]):null];
    R.bagCap=JOBS.BAG.slots+sl.filter(Boolean).reduce((a,c)=>a+((roleInfo(c)||{}).bag||0),0)+satchelSlots(R.satchel);
    R.slot3=sl[2]&&!tut?{c:sl[2]}:null;
    if(!tut)msg(mode==='arena'?'Arena: spawn foes from the panel. Leave from the pause menu.':`${floorStart()} Find the ${isBossFloor(f0)?'boss, rift or cliff':'stairs or the gate'}.`);
  }
  refreshSupport();R.p.hp=R.p.maxHp;
  if(mode==='raid'&&(secTier('warroom')>=5||res('combat',4)))applyBuff(pick(BUFF_IDS.filter(k=>k!=='time')),true);
  if(tut)tutEnter(0);
  placeLore(R.map);
  save();
  if(TOUCH)goLandscape();
  lockPage(true);$('#app').hidden=true;$('#raid').hidden=false;$('#actCol').hidden=!TOUCH;$('#hudKeys').hidden=TOUCH;
  $('#arenaPanel').hidden=mode!=='arena';if(mode==='arena')buildArenaPanel();
  $('#pause').hidden=true;$('#bossBar').hidden=true;$('#tutBox').hidden=!tut;$('#roomMod').hidden=true;
  applyOpts();
  resetScale();resize();startLoop();
}
function applyOpts(){
  const o=OPTS,raid=$('#raid');
  raid.style.setProperty('--tb',{S:'46px',M:'54px',L:'64px'}[o.btnSize]||'54px');
  raid.style.setProperty('--hud-a',o.hudAlpha);
  raid.classList.toggle('lefty',o.hand==='left');
  // The touch buttons sit around the aim stick, so they move with its size.
  const r=stickR(),{m,b}=stickInset(r);
  raid.style.setProperty('--sr',r+'px');raid.style.setProperty('--sm',m+'px');raid.style.setProperty('--sb',b+'px');
}
const stickR=()=>({S:42,M:52,L:64}[OPTS.stickSize]||52);
// Stick centres: m from the side edge, b from the bottom (kept low so the buttons fit above in landscape).
const stickInset=r=>({m:r+28,b:r+26});
function stickBases(){const r=stickR(),{m,b}=stickInset(r);const L={x:m,y:R.vh-b},Rr={x:R.vw-m,y:R.vh-b};return OPTS.hand==='left'?{move:Rr,aim:L}:{move:L,aim:Rr}}
const B=k=>R.buffs[k]||0;
const CU=k=>R.curses.has(k);
function refreshSupport(){
  const c=R.slot3&&R.slot3.c.captureRaid!==R.id?R.slot3.c:null;
  R.sup=new Set(c?typesOf(c):[]);
  const ratio=R.p.hp/R.p.maxHp;R.p.maxHp=Math.max(30,Math.round((100+25*B('hp')+(secTier('warroom')>=1?10:0)+(res('combat',0)?15:0)-(CU('glass')?30:0)+perk('hp'))*(R.sup.has('warden')?1.15:1)));R.p.hp=Math.max(1,Math.min(R.p.maxHp,Math.round(R.p.maxHp*ratio)));
  R.scout=roleInParty('scout');
  R.reveal=S.settings.reveal||secTier('roost')>=1||R.sup.has('echo')||R.sup.has('lumen')||R.scout;
}
function applyBuff(k,silent){
  R.buffs[k]=(R.buffs[k]||0)+1;
  if(k==='hp'){refreshSupport();R.p.hp=Math.min(R.p.maxHp,R.p.hp+25)}
  if(k==='time')R.time+=60;
  sfx('pickup');
  if(!silent){float(R.p.x,R.p.y-30,BUFFS[k].name,'#5de8b0',true);msg(`${BUFFS[k].name}: ${BUFFS[k].desc}.`)}
}
function applyCurse(k){if(R.curses.has(k))return;R.curses.add(k);if(k==='doom'&&R.time>0)R.time=Math.max(30,R.time-90);refreshSupport();float(R.p.x,R.p.y-30,CURSES[k].name,'#ff6688',true);msg(`${CURSES[k].name}: ${CURSES[k].desc}`);sfx('boss')}
function msg(t){R.msg=t;R.msgT=3.2}
function float(x,y,text,col,force){if(!force&&!OPTS.dmgNums&&/^\d+$/.test(String(text)))return;R.floats.push({x,y,text:String(text),col:col||'#f6eedb',t:1});if(R.floats.length>70)R.floats.shift()}
function partyHas(type){return R.comps.some(m=>m&&!m.downed&&typesOf(m.c).includes(type))||(R.slot3&&typesOf(R.slot3.c).includes(type))}
function partyTrait(tr){return R.comps.some(m=>m&&m.c.traits.includes(tr))||(R.slot3&&R.slot3.c.traits.includes(tr))}
const bondComp=(type,star=3)=>R.comps.some(m=>m&&!m.downed&&m.c.type===type&&m.st.star>=star);
const capRadius=()=>95*(1+.4*B('cage'))*(res('capture',1)?1.25:1)*(roleInParty('catcher')?1+JOBS.ROLES.catcher.radius:1);
const playerDmgMul=()=>weaponDmgMul()*gunDmgMul(R.gunItem&&R.gunItem[R.active])*(1+.15*B('dmg'))*(R.sup.has('ember')?1.1:1)*(CU('glass')?1.4:1)*(CU('blind')?1.2:1);
const modOn=(kind)=>{const r=R.cur;if(!r||r.mod!==kind)return false;if(kind==='dark'||kind==='slick')return true;return R.enemies.some(e=>e.room===r)};

/* ---------- spawning ---------- */
function spawnPos(r,minD=180){
  for(let i=0;i<40;i++){const x=(r.ox+rnd(1.5,RW-1.5))*TS,y=(r.oy+rnd(1.5,RH-1.5))*TS;if(!hitsWall(x,y,18)&&Math.hypot(x-R.p.x,y-R.p.y)>minD)return{x,y}}
  return{x:r.cx,y:r.cy};
}
function baseEnemy(pos,room){return{x:pos.x,y:pos.y,room,stun:0,slow:0,face:1,flash:0,hitCd:0,wind:0,rot:rand()*6,phase:0,queue:[],chargeT:0,strafe:pick([-1,1]),seed:rand()*9,shots:0,status:{},burn:null,lastHit:null}}
const hpMods=()=>R.mods.hp*(CU('toll')?1.25:1);
function spawnWild(pos,species,room,level){
  const f=R.map.floor,W=BALANCE.WILD_LEVELS[Math.min(f,10)];const lv=level||(f?ri(W[0],W[1]):0);
  const stage=R.mode==='arena'?wildStageFor(species,lv,6):wildStageFor(species,lv,f);
  const c=makeCreature(species,'wild',lv,{floor:f,stage});
  dexForm(species,stage,'seen');
  return wildEnemy(pos,c,room);
}
// A wild creature as an enemy: one rolled for the room, or one of yours set loose.
function wildEnemy(pos,c,room){
  const st=stats(c),fire=WILD_FIRE[c.type],hp=Math.round(st.hp*.7*hpMods());
  R.enemies.push(Object.assign(baseEnemy(pos,room),{kind:'wild',c,r:Math.round(14*hitboxMul(c)),hp,maxHp:hp,dmg:st.atk*.6*R.mods.dmg,spd:st.spd*.65,
    fire,every:fire.every/Math.max(.6,st.rate),cd:rnd(.8,1.8),melee:fire.kind==='charge'||c.type==='warden',bcol:SPECIES[c.species].col}));
  return R.enemies[R.enemies.length-1];
}
function spawnFoe(pos,id,floor,room,elite){
  const d=FOES[id],loc=localFloor(floor),hm=(1+.3*(loc-1))*hpMods()*(elite?3:1),dm=(1+.12*(loc-1))*R.mods.dmg;
  if(d.intro<99)dexFoe(id);
  const e=Object.assign(baseEnemy(pos,room),{kind:'foe',id,def:d,elite:!!elite,r:Math.round(d.r*(elite?1.35:1)),hp:Math.round(d.hp*hm),maxHp:Math.round(d.hp*hm),dmg:d.dmg*dm,spd:d.spd,fire:d.fire,every:d.fire.every*(elite?.8:1),cd:rnd(.9,2),melee:!!d.melee,bcol:d.bcol||'#ff6b6b'});
  R.enemies.push(e);return e;
}
function spawnBoss(r,id){
  const d=BOSSES[id],hp=Math.round(d.hp*hpMods());
  const b=Object.assign(baseEnemy({x:r.cx,y:r.cy-40},r),{kind:'boss',id,def:d,r:d.r,hp,maxHp:hp,dmg:d.dmg*R.mods.dmg,spd:d.spd,cd:1.6,ai:0,phase2:false,busy:0,orbit:0,melee:true,bcol:d.bcol,spin:0});
  R.enemies.push(b);R.boss=b;sfx('boss');
  if(d.lord==='mirror')lordShadows(b);if(d.lord==='brood')b.brood=[];
  $('#bossBar').hidden=false;$('#bossName').textContent=d.name;
  msg(`${d.name} awakens!`);
}
function enterRoom(r){
  r.visited=true;loreRoom(r);if(r.spawned)return;r.spawned=true;
  if(r.kind==='boss'){r.locked=true;spawnBoss(r,r.bossId);pullComps();return}
  if(!r.plan)return;
  const f=R.map.floor;
  r.plan.foes.forEach((id,i)=>spawnFoe(spawnPos(r),id,f,r,(r.plan.elite||ruleOn(R.tier,'eliteguard'))&&i===0));
  r.plan.wilds.forEach(s=>spawnWild(spawnPos(r),s,r));
  enterExtras(r);
  if(r.kind==='secret'){bump('secrets');if(rand()<.35){S.shards++;float(R.p.x,R.p.y-30,'+1 memory shard','#ff8fe0',true)}if(r.plan.wilds.length)msg(`A wild ${SPECIES[r.plan.wilds[0]].name} hides in the secret room.`);return}
  if(R.enemies.some(e=>e.room===r)){
    r.locked=true;pullComps();sfx('door');
    const w=r.plan.wilds;
    if(r.mod){msg(`${ROOM_MODS[r.mod].name}! ${ROOM_MODS[r.mod].desc}`)}
    else if(w.length){const rare=w.find(s=>SPECIES[s].w===1||TYPES[SPECIES[s].type].tier>=3);msg(rare?`Doors sealed. A rare ${SPECIES[rare].name} is here!`:`Doors sealed. A wild ${SPECIES[w[0]].name} is here.`)}
    else if(r.plan.elite)msg(`Doors sealed. An elite ${FOES[r.plan.foes[0]].name} guards this lair.`);
    else msg('Doors sealed. Clear the room.');
  }
}
function pullComps(){R.comps.forEach(m=>{if(m&&!roomAt(m.x,m.y,8)){m.x=R.p.x+rnd(-20,20);m.y=R.p.y+rnd(-20,20)}})}
function buildArenaPanel(){
  R.arenaLv=10;
  const spOpts=TYPE_IDS.map(t=>`<optgroup label="${TYPES[t].name}">${speciesOf(t).map(k=>`<option value="${k}">${SPECIES[k].name}</option>`).join('')}</optgroup>`).join('');
  $('#arenaPanel').innerHTML=`<details ${TOUCH?"":"open"}><summary>Test spawns</summary><div class="ap">
  <span class="lab">Enemy</span><div class="row"><select id="arFoe" aria-label="Enemy">${[0,1].map(s=>`<optgroup label="${s?'Ember Abyss':'Overgrown Depths'}">${FOE_IDS.filter(k=>FOES[k].set===s).map(k=>`<option value="${k}">${FOES[k].name}</option>`).join('')}</optgroup>`).join('')}</select>
  <select id="arTier" aria-label="Floor">${[1,2,3,4,5,6].map(f=>`<option value="${f}">F${f}</option>`).join('')}</select><button class="btn small" data-spawn="foe">Spawn</button><button class="btn small" data-spawn="elite">Elite</button></div>
  <span class="lab">Boss</span><div class="row"><select id="arBoss" aria-label="Boss">${BOSS_IDS.map(k=>`<option value="${k}">${BOSSES[k].name}</option>`).join('')}</select><button class="btn small" data-spawn="boss">Spawn</button></div>
  <span class="lab">Wild Lv <span id="arenaLv">10</span></span><div class="row"><select id="arSp" aria-label="Species">${spOpts}</select><button class="btn small" data-spawn="lv-">−</button><button class="btn small" data-spawn="lv+">+</button><button class="btn small" data-spawn="wild">Spawn</button></div>
  <span class="lab">Twist</span><div class="row"><select id="arMod" aria-label="Room twist"><option value="">None</option>${ROOM_MOD_IDS.map(k=>`<option value="${k}">${ROOM_MODS[k].name}</option>`).join('')}</select><button class="btn small" data-spawn="mod">Set</button></div>
  <span class="lab">Curse</span><div class="row"><select id="arCurse" aria-label="Curse">${CURSE_IDS.map(k=>`<option value="${k}">${CURSES[k].name}</option>`).join('')}</select><button class="btn small" data-spawn="curse">Take</button></div>
  <span class="lab">Give</span><div class="row"><button class="btn small" data-spawn="gun">Weapon</button><button class="btn small" data-spawn="buff">Buff</button><button class="btn small" data-spawn="combo">Combo</button></div>
  <span class="lab">Room</span><div class="row"><button class="btn small" data-spawn="clear">Clear</button><button class="btn small" data-spawn="heal">Heal party</button></div></div></details>`;
}
$('#arenaPanel').addEventListener('click',e=>{
  const b=e.target.closest('[data-spawn]');if(!b||!R)return;const k=b.dataset.spawn;const r=R.map.start;
  if(k==='lv-'||k==='lv+'){R.arenaLv=clamp(R.arenaLv+(k==='lv+'?(R.arenaLv>=10?5:1):-(R.arenaLv>10?5:1)),1,40);$('#arenaLv').textContent=R.arenaLv;return}
  if(k==='clear'){R.enemies=[];R.bullets=[];R.boss=null;$('#bossBar').hidden=true;return}
  if(k==='heal'){R.p.hp=R.p.maxHp;R.comps.forEach(m=>{if(m){m.downed=false;m.hp=m.maxHp}});return}
  if(k==='foe'||k==='elite')spawnFoe(spawnPos(r),$('#arFoe').value,+$('#arTier').value,r,k==='elite');
  if(k==='boss'){R.enemies.filter(e=>e.kind==='boss').forEach(e=>e.gone=true);spawnBoss(r,$('#arBoss').value)}
  if(k==='wild')spawnWild(spawnPos(r),$('#arSp').value,r,R.arenaLv);
  if(k==='mod'){r.mod=$('#arMod').value||null;if(r.mod)msg(`${ROOM_MODS[r.mod].name}: ${ROOM_MODS[r.mod].desc}`)}
  if(k==='curse')applyCurse($('#arCurse').value);
  if(k==='combo')R.combo.cd=0;
  if(k==='gun'){const g=pick(GUN_IDS.filter(x=>x!=='pistol'));R.items.push({kind:'gun',id:g,x:R.p.x+40,y:R.p.y});msg(`${GUNS[g].name} dropped. Stand on it and press Use.`)}
  if(k==='buff')applyBuff(pick(BUFF_IDS));
});

/* ---------- elements ---------- */
function applyElem(e,elem,dmg,src){
  if(!elem||e.hp<=0)return;
  for(const k in e.status){if(e.status[k]>0&&k!==elem){const r=reactionFor(k,elem);if(r){delete e.status[k];react(e,r,dmg,src);return}}}
  e.status[elem]=4;
  if(elem==='burn'){const bm=src&&src.c&&src.c.type==='ember'&&src.st.star>=3?1.5:1;e.burn={dps:Math.max(2,dmg*.3)*bm,t:3,src}}
  if(elem==='soak'&&src&&src.c&&src.c.type==='tide'&&src.st.star>=3&&e.kind!=='boss')e.slow=1.5;
  // Glare dazzles: a short stun (Lumen companions at 3 stars, Beacon, double it).
  if(elem==='glare'&&e.kind!=='boss')e.stun=Math.max(e.stun,.35*(src&&src.c&&src.c.type==='lumen'&&src.st.star>=3?2:1));
  // Poison: weaker than burning but lasts longer; Venom companions at 3 stars (Lingering) double it.
  if(elem==='poison'){const lm=src&&src.c&&src.c.type==='venom'&&src.st.star>=3?2:1;e.status.poison=4*lm;e.poison={dps:Math.max(1.5,dmg*.22),t:4.5*lm,src}}
}
function react(e,r,dmg,src){
  const base=Math.max(dmg,8)*(res('combat',3)?1.3:1);
  bump('reactions');sfx('react');float(e.x,e.y-e.r-26,r.name+'!',r.col,true);
  R.fx.push({x:e.x,y:e.y,r:60,t:.4,max:.4,col:r.col});
  if(r.name==='Steam Burst')explodeAt(e.x,e.y,85,base*2.5,'p',src,null,'#e8f4ff');
  else if(r.name==='Combustion')explodeAt(e.x,e.y,100,base*3,'p',src,null,'#ffb347');
  else if(r.name==='Electrocute'){const hit=[e];let cur=e;for(let i=0;i<4;i++){const nx=R.enemies.filter(x=>x.hp>0&&!hit.includes(x)&&dist(x,cur)<190).sort((a,b)=>dist(a,cur)-dist(b,cur))[0];if(!nx)break;R.bolts.push({a:{x:cur.x,y:cur.y},b:{x:nx.x,y:nx.y},t:.25,col:'#c8a8ff'});hurtEnemy(nx,base*2,false,src);hit.push(nx);cur=nx}hurtEnemy(e,base*2,false,src)}
  else if(r.name==='Overgrowth'){if(e.kind!=='boss')e.stun=1.8;e.slow=3;hurtEnemy(e,base*1.5,false,src)}
  else if(r.name==='Shatter'){hurtEnemy(e,base*3,false,src)}
  else if(r.name==='Starfire'){if(e.kind!=='boss')e.stun=1.5;hurtEnemy(e,base*2.6,false,src);R.bolts.push({a:{x:e.x,y:e.y-140},b:{x:e.x,y:e.y},t:.3,col:'#fff6c8'})}
  else if(r.name==='Purge'){const left=e.poison?e.poison.dps*e.poison.t:0;e.poison=null;hurtEnemy(e,left*2+base,false,src)}
  else if(r.name==='Toxic Flare'){explodeAt(e.x,e.y,90,base*2.2,'p',src,null,'#c8ff6a');R.fields.push({x:e.x,y:e.y,r:70,t:3,dps:base*.4,src,elem:'poison',col:'#9be35a'})}
  else if(r.name==='Spreading Blight'){for(const x of R.enemies)if(x.hp>0&&dist(x,e)<170){x.status.poison=4;x.poison={dps:Math.max(2,base*.35),t:5,src}}hurtEnemy(e,base*1.5,false,src)}
  else if(r.name==='Thunderclap'){if(e.kind!=='boss')e.stun=1.2;hurtEnemy(e,base*2,false,src);R.bolts.push({a:{x:e.x,y:e.y-120},b:{x:e.x,y:e.y},t:.25,col:'#fff6a8'})}
}

/* ---------- combat helpers ---------- */
// Poison rounds: a Venom in slot 3 (or the Apothecary at tier 3) gives the player's shots a chance to poison.
const poisonRounds=()=>!!R&&(R.sup.has('venom')||secTier('apothecary')>=3);
function hurtEnemy(e,dmg,quiet,src,elem){
  if(e.hp<=0)return;
  if(!elem&&src==='p'&&poisonRounds()&&rand()<.3)elem='poison';
  if(e.kind==='boss'&&e.def.lord)dmg=lordDamage(e,dmg,src,elem);e.hp-=dmg;e.flash=.08;if(src)e.lastHit=src;
  if((src==='p'||src==='melee')&&B('leech')){R.leechAcc+=dmg*B('leech');while(R.leechAcc>=25){R.leechAcc-=25;healPlayer(1)}}
  if(src&&src.c&&src.st.vamp)src.hp=Math.min(src.maxHp,src.hp+dmg*src.st.vamp);
  if(!quiet){float(e.x+rnd(-6,6),e.y-e.r-8,Math.round(dmg),'#ffe38a');sfx('hit')}
  if(e.kind==='wild'&&isWeak(e)&&!e.weakShown){e.weakShown=true;float(e.x,e.y-e.r-24,'Weak! Get close and cage it','#ffcf4a',true)}
  if(e.kind==='boss'&&!e.phase2&&e.hp<e.maxHp*.5){e.phase2=true;e.ai=0;msg(`${e.def.name} is enraged!`);sfx('boss');R.fx.push({x:e.x,y:e.y,r:120,t:.6,max:.6,col:'#ff5c7a'})}
  if(elem&&e.hp>0)applyElem(e,elem,dmg,src);
}
function hurtPlayer(d,slow){
  const p=R.p;if(S.settings.god||R.god||p.roll>0||R.shield>0||p.inv>0)return;
  if((R.sup.has('crystal')&&rand()<.2)||(bondComp('crystal')&&rand()<.1)){float(p.x,p.y-24,'Blocked','#ff8fe0',true);p.inv=.2;return}
  if(R.fortress>0)d*=.5;
  const BW=JOBS.ROLES.bulwark;if(R.comps.some(m=>roleComp(m,'bulwark')&&dist(m,p)<BW.range))d*=1-BW.shield;
  p.hp-=d;
  // Tonics are drunk automatically when HP runs low.
  if(p.hp>0&&R.tonics>0&&p.hp<p.maxHp*JOBS.TONIC.at){R.tonics--;p.hp=Math.min(p.maxHp,p.hp+p.maxHp*JOBS.TONIC.heal);float(p.x,p.y-34,'Tonic!','#5de8b0',true)}p.inv=.5;p.hurt=.15;if(slow)p.slow=slow;if(OPTS.shake)R.shake=.18;sfx('hurt');
  if(p.hp<=0)playerDown();
}
function hurtComp(m,d){
  if(m.downed)return;
  d*=m.st.taken*Math.pow(.8,B('ptough'))*(ruleOn(R.tier,'fragile')?1.2:1);if(R.taunt>0&&R.tauntEnt===m)d*=.5;if(R.fortress>0)d*=.5;
  m.hp-=d;m.flash=.08;
  if(m.hp<=0){
    if(m.lastStand){m.lastStand=false;m.hp=1;float(m.x,m.y-26,'Last Stand!','#ffcf4a',true);msg(`${m.c.name} refuses to fall!`);doAbility(m,m.st.abilId);return}
    m.hp=0;m.downed=true;m.rev=0;
    if(R.autoRev>0){R.autoRev--;m.autoT=2;float(m.x,m.y-22,'Spring blessing…','#58c2ff',true)}
    else{float(m.x,m.y-22,'Down!','#ff6688',true);msg(`${m.c.name} is down! Stand next to it to revive.`)}}
}
const healPlayer=a=>{if(CU('blood'))return;if(ruleOn(R.tier,'thinblood'))a*=.7;R.p.hp=Math.min(R.p.maxHp,R.p.hp+a)};
function playerDown(){
  if(R.mode==='arena'){R.p.hp=R.p.maxHp;R.enemies=R.enemies.filter(e=>e.kind==='boss');R.bullets=[];msg('You fell. The arena resets.');return}
  endRaid('dead');
}
function shoot(team,x,y,ang,speed,dmg,o={}){
  if(team==='e'&&R&&ruleOn(R.tier,'quickened'))speed*=1.2;
  if(team==='e')speed*=enemyBulletMul();
  const b={team,x,y,vx:Math.cos(ang)*speed,vy:Math.sin(ang)*speed,r:o.r||5,dmg,life:o.life||2.6,age:0,col:o.col||'#ff5c7a',slow:o.slow||0,
    pierce:o.pierce||0,hit:o.pierce?new Set():null,bounce:o.bounce||0,explode:o.explode||0,split:o.split||0,homing:o.homing||0,src:o.src||null,elem:o.elem||null,lob:o.lob||null,orbit:o.orbit||null,cloud:o.cloud||0};
  // Ricochet trait: a companion's shots bounce off a wall once.
  if(o.src&&o.src.c&&o.src.c.traits.includes('ricochet'))b.bounce=Math.max(b.bounce,1);
  R.bullets.push(b);return b;
}
const critMul=st=>st&&st.crit&&rand()<st.crit?2:1;
function nearestEnemy(from,range,spareWeak){let best=null,bd=range;for(const e of R.enemies){if(e.hp<=0)continue;if(spareWeak&&isWeak(e))continue;const d=dist(from,e)-e.r;if(d<bd){bd=d;best=e}}return best}
function pickTarget(e){
  if(R.taunt>0&&R.tauntEnt&&!R.tauntEnt.downed)return R.tauntEnt;
  let best=R.p,bd=dist(e,R.p);
  for(const m of R.comps){if(!m||m.downed)continue;const w=m.c.type==='warden'&&m.st.star>=3?.9:1.6;const d=dist(e,m)*w;if(d<bd){bd=d;best=m}}
  return best;
}
function explodeAt(x,y,rad,dmg,team,src,elem,col){
  R.fx.push({x,y,r:rad,t:.35,max:.35,col:col||(team==='e'?'#ff6b6b':'#ffcf4a'),fill:true});
  if(team==='e'){if(dist({x,y},R.p)<rad+R.p.r)hurtPlayer(dmg)}
  else{R.enemies.forEach(e=>{if(e.hp>0&&dist({x,y},e)<rad+e.r)hurtEnemy(e,dmg,false,src||'p',elem)});crackHitArea(x,y,rad,dmg)}
}
function crackHitArea(x,y,rad,dmg){
  const M=R.map;if(!M.cracks.size)return;
  for(const[i]of M.cracks){const cx=(i%M.W+.5)*TS,cy=(Math.floor(i/M.W)+.5)*TS;if(Math.hypot(cx-x,cy-y)<rad+16){damageCrack(i,dmg);return}}
}
const later=(t,f)=>R.timers.push({t,f});
const roomFoes=(r=R.cur)=>R.enemies.filter(e=>e.hp>0&&(e.room===r||dist(e,R.p)<420));

/* ---------- abilities ---------- */
function compAtk(m){return m.atk*(roleOf(m.c)==='striker'?1+JOBS.ROLES.striker.dmg:1)*(1+.2*B('pdmg'))*(CU('feral')?1.4:1)*(R.rally?R.rally.dmg:1)}
function doAbility(m,id){
  const atk=compAtk(m),col=SPECIES[m.c.species].col,p=R.p;
  const tg=nearestEnemy(m,460);sfx('ability');
  const near=(rad)=>R.enemies.filter(e=>e.hp>0&&dist(e,m)<rad);
  switch(id){
    case'flameRing':for(let k=0;k<12;k++)shoot('p',m.x,m.y,k/12*Math.PI*2,360,atk*1.3,{col:TYPES.ember.color,r:6,src:m,elem:'burn'});break;
    case'meteorShower':{const ts=near(420);for(let i=0;i<6;i++){const t0=ts.length?ts[i%ts.length]:{x:p.x+rnd(-150,150),y:p.y+rnd(-150,150)};const x=t0.x+rnd(-20,20),y=t0.y+rnd(-20,20);R.fx.push({x,y,r:55,t:.45,max:.45,col:'#ff7a3d'});later(.15*i+.4,()=>explodeAt(x,y,60,atk*1.4,'p',m,'burn','#ff7a3d'))}break}
    case'infernoNova':near(240).forEach(e=>hurtEnemy(e,atk,false,m,'burn'));for(let k=0;k<24;k++)shoot('p',m.x,m.y,k/24*Math.PI*2,380,atk*1.1,{col:'#ffd23f',r:6,src:m,elem:'burn'});R.fx.push({x:m.x,y:m.y,r:240,t:.5,max:.5,col:'#ff7a3d'});break;
    case'sporeField':{const t0=tg||{x:p.x+Math.cos(R.aim)*120,y:p.y+Math.sin(R.aim)*120};R.fields.push({x:t0.x,y:t0.y,r:110,t:4,dps:atk*.9,src:m,elem:'spore',col:'#e0527a'});break}
    case'healBloom':healPlayer(25);R.comps.forEach(o=>{if(o&&!o.downed)o.hp=Math.min(o.maxHp,o.hp+o.maxHp*.3)});R.fx.push({x:m.x,y:m.y,r:160,t:.6,max:.6,col:'#7fd860'});break;
    case'rotCloud':{const t0=tg||m;R.fields.push({x:t0.x,y:t0.y,r:165,t:5,dps:atk*1.2,src:m,elem:'spore',col:'#c04ad8'});break}
    case'tideShield':R.shield=3;healPlayer(20);break;
    case'tidalSurge':{const a=tg?Math.atan2(tg.y-m.y,tg.x-m.x):R.aim;for(let k=0;k<16;k++)shoot('p',m.x,m.y,a+(k/15-.5)*1.3,300,atk*.9,{col:'#5cc8ff',r:7,pierce:3,src:m,elem:'soak',life:1.4});break}
    case'deluge':R.shield=3;healPlayer(30);R.comps.forEach(o=>{if(o&&!o.downed)o.hp=Math.min(o.maxHp,o.hp+o.maxHp*.3)});near(280).forEach(e=>hurtEnemy(e,atk*.5,false,m,'soak'));R.fx.push({x:m.x,y:m.y,r:280,t:.5,max:.5,col:'#3fa9ff'});break;
    case'echoPing':near(240).forEach(e=>{if(e.kind!=='boss'){e.stun=1.6;e.wind=0}hurtEnemy(e,atk*critMul(m.st),false,m,'static')});R.fx.push({x:m.x,y:m.y,r:240,t:.4,max:.4,col:'#9b7bff'});break;
    case'sonicBoom':near(260).forEach(e=>{if(e.kind!=='boss'){e.stun=2.5;e.wind=0}hurtEnemy(e,atk*2.2,false,m,'static')});R.fx.push({x:m.x,y:m.y,r:260,t:.5,max:.5,col:'#c8a8ff'});if(OPTS.shake)R.shake=.2;break;
    case'stormCall':{const ts=near(300);ts.forEach(e=>hurtEnemy(e,atk*.5,true,m,'static'));later(.6,()=>ts.forEach(e=>{if(e.hp>0){R.bolts.push({a:{x:e.x,y:e.y-140},b:{x:e.x,y:e.y},t:.25,col:'#fff6a8'});hurtEnemy(e,atk*1.8,false,m,'gust')}}));break}
    case'gustDash':{if(!tg){m.abil=1;float(m.x,m.y-26,'No target','#b4a9d8',true);return}const a=Math.atan2(tg.y-m.y,tg.x-m.x);m.dash=.32;m.dvx=Math.cos(a)*620;m.dvy=Math.sin(a)*620;m.dashHit=new Set();m.dashDmg=atk*2.5;m.dashEnd=null;m.knock=12;break}
    case'cyclone':{const t0=tg||m;R.fields.push({x:t0.x,y:t0.y,r:110,t:3,dps:atk,src:m,elem:'gust',pull:130,col:'#4fe0c8',spin:true});break}
    case'skyStrike':{const ts=R.enemies.filter(e=>e.hp>0&&dist(e,p)<480).sort((a,b)=>b.hp-a.hp).slice(0,3);ts.forEach((e,i)=>later(.2*i,()=>{if(e.hp<=0)return;R.bolts.push({a:{x:e.x+rnd(-20,20),y:e.y-160},b:{x:e.x,y:e.y},t:.3,col:'#fff6a8'});hurtEnemy(e,atk*3,false,m,'static')}));break}
    case'prismWard':R.prism=3;break;
    case'shardStorm':for(let k=0;k<24;k++)shoot('p',m.x,m.y,k/24*Math.PI*2,360,atk*.8,{col:'#ff8fe0',r:5,pierce:2,src:m,elem:'brittle'});break;
    case'mirrorField':R.prism=5;near(260).forEach(e=>hurtEnemy(e,atk*.4,true,m,'brittle'));R.fx.push({x:p.x,y:p.y,r:260,t:.5,max:.5,col:'#ffffff'});break;
    case'taunt':R.taunt=4;R.tauntEnt=m;break;
    case'quake':near(220).forEach(e=>{if(e.kind!=='boss')e.stun=1.5;hurtEnemy(e,atk*1.2,false,m,'stagger')});R.fx.push({x:m.x,y:m.y,r:220,t:.5,max:.5,col:'#e3b04b',fill:true});if(OPTS.shake)R.shake=.25;break;
    case'fortress':R.taunt=5;R.tauntEnt=m;R.fortress=5;break;
  }
  float(m.x,m.y-26,ABILITIES[id].name,col,true);
}
function useAbility(i){
  const m=R.comps[i];if(!m){msg('That combat slot is empty.');return}
  if(m.downed){msg(`${m.c.name} is down.`);return}
  if(m.abil>0)return;
  if(modOn('silence')){msg('Silence: abilities are sealed until the room is clear.');return}
  const max=ABILITIES[m.st.abilId].cd*m.st.abil*Math.max(.4,1-.25*B('abil'))*(CU('feral')?1.5:1);
  if(!R.tut&&rand()>m.obey){m.abil=max*.5;float(m.x,m.y-26,'Ignores you','#ff6688',true);return}
  m.abil=max;m.abilMax=max;doAbility(m,m.st.abilId);if(roleOf(m.c)==='medic')m.medicT=JOBS.ROLES.medic.burstTime;
  if(R.tut)R.tut.abil=true;
}
function comboReady(){const[a,b]=R.comps;return!!(a&&b&&!a.downed&&!b.downed&&R.combo.cd<=0)}
function useCombo(){
  const[a,b]=R.comps;if(!a||!b){msg('A combo needs companions in both combat slots.');return}
  if(a.downed||b.downed){msg('Both companions must be standing.');return}
  if(R.combo.cd>0)return;
  if(modOn('silence')){msg('Silence: combos are sealed until the room is clear.');return}
  const key=comboKey(a.c.type,b.c.type),cb=comboFor(a.c.type,b.c.type),p=R.p,atk=(compAtk(a)+compAtk(b))*.8*(roleComp(a,'striker')||roleComp(b,'striker')?1+JOBS.ROLES.striker.combo:1);
  R.combo.cd=R.combo.max;bump('combos');sfx('combo');float(p.x,p.y-40,cb.name+'!','#ffcf4a',true);msg(`${cb.name}! ${cb.desc}`);
  R.fx.push({x:p.x,y:p.y,r:120,t:.5,max:.5,col:'#ffcf4a'});
  const foes=roomFoes();
  switch(key){
    case'ember+gale':R.fields.push({x:p.x,y:p.y,r:75,t:3.5,dps:atk*1.2,src:a,elem:'burn',col:'#ff7a3d',spin:true,move:{vx:Math.cos(R.aim)*150,vy:Math.sin(R.aim)*150}});break;
    case'crystal+tide':R.shield=3;R.prism=5;break;
    case'ember+fungal':foes.slice(0,10).forEach((e,i)=>{hurtEnemy(e,atk*.3,true,a,'spore');later(.12*i+.2,()=>{if(e.hp>0)explodeAt(e.x,e.y,60,atk*1.2,'p',a,'burn','#ffb347')})});break;
    case'fungal+tide':healPlayer(R.p.maxHp*.4);R.comps.forEach(o=>{if(o&&!o.downed)o.hp=Math.min(o.maxHp,o.hp+o.maxHp*.4)});R.fields.push({x:p.x,y:p.y,r:170,t:4,dps:atk*.5,src:a,elem:'soak',col:'#4fb3a0',slowAll:true});break;
    case'crystal+echo':foes.forEach(e=>{if(e.kind!=='boss')e.stun=2;hurtEnemy(e,atk,false,a,'brittle')});R.fx.push({x:p.x,y:p.y,r:400,t:.6,max:.6,col:'#d88fff'});break;
    case'gale+tide':for(let w=0;w<3;w++)later(w*.35,()=>{for(let k=0;k<14;k++)shoot('p',R.p.x,R.p.y,k/14*Math.PI*2+w*.2,330,atk*.6,{col:'#3fd8e8',r:6,pierce:1,src:a,elem:'soak'})});break;
    case'echo+tide':foes.forEach((e,i)=>{hurtEnemy(e,atk*.3,true,a,'soak');later(.3+.05*i,()=>{if(e.hp>0){R.bolts.push({a:{x:e.x,y:e.y-140},b:{x:e.x,y:e.y},t:.25,col:'#c8a8ff'});hurtEnemy(e,atk*.8,false,b,'static')}})});break;
    case'ember+warden':R.fortress=5;for(let k=0;k<8;k++){const an=k/8*Math.PI*2;R.fields.push({x:p.x+Math.cos(an)*70,y:p.y+Math.sin(an)*70,r:34,t:5,dps:atk*.6,src:a,elem:'burn',col:'#ff7a3d'})}break;
    case'echo+gale':foes.forEach((e,i)=>later(.06*i,()=>{if(e.hp<=0)return;R.bolts.push({a:{x:e.x+rnd(-30,30),y:e.y-170},b:{x:e.x,y:e.y},t:.3,col:'#fff6a8'});hurtEnemy(e,atk*2,false,a,'static')}));break;
    case'crystal+warden':{const w=a.c.type==='warden'?a:b;R.taunt=5;R.tauntEnt=w;R.prism=5;foes.filter(e=>dist(e,p)<260).forEach(e=>hurtEnemy(e,atk*.6,false,w,'stagger'));break}
    default:R.rally=a.c.type===b.c.type?{t:5,mult:2,dmg:1.25}:{t:5,mult:1.6,dmg:1};
  }
}
function doRoll(){
  const p=R.p;if(p.rollCd>0||p.roll>0)return;
  let{mx,my}=moveVec();if(!mx&&!my){mx=Math.cos(R.aim);my=Math.sin(R.aim)}
  const l=Math.hypot(mx,my)||1;p.roll=.3;p.rollCd=.75*Math.pow(.65,B('roll'))*(res('combat',2)?.8:1);p.rvx=mx/l*440;p.rvy=my/l*440;sfx('roll');
  if(R.tut)R.tut.rolled=true;
}
function cageReady(){const rad=capRadius();return!R.slot3&&R.enemies.some(e=>catchable(e)&&e.hp>0&&(S.settings.instant||isWeak(e))&&dist(e,R.p)<rad+e.r)}
function useCage(){
  if(R.slot3){msg(`Slot 3 is full. Release a creature from the menu${TOUCH?' (⚙)':' (Esc)'} to make room.`);return}
  const kind=R.cages.gilded>0?'gilded':R.cages.basic>0?'basic':null;
  if(!kind){msg('No cages left.');return}
  const rad=capRadius();
  const near=R.enemies.filter(e=>catchable(e)&&e.hp>0&&dist(e,R.p)<rad+e.r);
  if(!near.length){msg('No wild creature inside the cage ring. Get closer.');return}
  const weak=near.filter(e=>S.settings.instant||isWeak(e)).sort((a,b)=>dist(a,R.p)-dist(b,R.p));
  if(!weak.length){msg(`Weaken it below ${Math.round(capT()*100)}% health first.`);return}
  if(R.mode!=='arena')R.cages[kind]--;
  R.fx.push({x:R.p.x,y:R.p.y,r:rad,t:.45,max:.45,col:'#ffcf4a'});
  tryCapture(weak[0],kind);
}
// Releasing sets a creature loose in the room you're in, to free a slot for a better catch. It turns
// wild and attacks, and can be weakened and caught again. One from your roster that isn't caught
// again is gone for good when the raid ends.
function canRelease(slot){
  if(!R||R.over||R.mode==='tutorial')return false;
  const m=slot===2?R.slot3:R.comps[slot];if(!m)return false;
  if(slot<2&&m.downed)return false;
  if(R.mode==='arena'&&S.creatures.includes(m.c))return false;   // the arena gives your creatures back afterwards
  return true;
}
function releaseCreature(slot){
  if(!canRelease(slot)){msg('That creature can’t be released here.');return null}
  const m=slot===2?R.slot3:R.comps[slot],c=m.c,owned=S.creatures.includes(c);
  if(slot===2)R.slot3=null;else{c.hp=Math.round(m.hp/m.maxHp*stats(c).hp);R.comps[slot]=null}
  if(owned){unplace(c);S.creatures=S.creatures.filter(x=>x!==c);addLog(`${c.name} was released in the Bloom on floor ${R.map.floor}.`)}
  c.captureRaid=-1;
  const room=roomAt(R.p.x,R.p.y,0)||R.cur;let pos={x:R.p.x,y:R.p.y};
  for(let i=0;i<24;i++){const a=rnd(0,Math.PI*2),d=rnd(70,110),x=R.p.x+Math.cos(a)*d,y=R.p.y+Math.sin(a)*d;if(!hitsWall(x,y,18)&&roomAt(x,y,0)===room){pos={x,y};break}}
  const e=wildEnemy(pos,c,room);e.released=true;e.cd=1.2;
  refreshSupport();sfx('fail');
  float(pos.x,pos.y-30,'Released!','#ff9bbf',true);
  msg(`${c.name} runs wild and turns on you.${owned?' Catch it again or it’s gone for good.':''}`);
  return e;
}
function swapSlot3(i){
  if(!R.slot3){msg('Slot 3 is empty.');return}
  const cur=R.comps[i];
  if(cur&&cur.downed){msg(`${cur.c.name} is down and can't be swapped out.`);return}
  const inc=R.slot3.c;
  if(cur){cur.c.hp=Math.round(cur.hp/cur.maxHp*stats(cur.c).hp);R.slot3={c:cur.c}}else R.slot3=null;
  const m=makeComp(inc);m.x=R.p.x+(i?20:-20);m.y=R.p.y+10;
  R.comps[i]=m;refreshSupport();sfx('pickup');
  float(m.x,m.y-26,`Go, ${inc.name}!`,'#ffcf4a',true);
  if(inc.captureRaid===R.id)msg(`Testing ${inc.name}. Wild catches may ignore you.`);
}
function switchGun(){
  if(!R.guns[1-R.active]){msg('Your other weapon slot is empty.');return}
  R.active=1-R.active;R.burst=[];R.spin=0;float(R.p.x,R.p.y-26,GUNS[R.guns[R.active]].name,'#ffe38a',true);sfx('ui');
}
function tryCapture(e,kind){
  const hpf=e.hp/e.maxHp,tier=TYPES[e.c.type].tier,rare=SPECIES[e.c.species].w===1?.85:1;
  let ch=(1-hpf)*1.15*(kind==='gilded'?1.7:1)*[1,1,.8,.6,.45][tier]*rare*(1-.12*(e.c.stage||0))+(partyTrait('lucky')?.1:0)+(roleInParty('catcher')?JOBS.ROLES.catcher.catch:0)+.1*B('cage')+(res('capture',2)?.1:0);
  if(e.stun>0)ch+=.1;if(R.mode==='tutorial')ch=1;
  if(ruleOn(R.tier,'brittlecages')&&!S.settings.instant&&rand()<.25){sfx('fail');float(e.x,e.y-e.r-12,'The cage shattered!','#ff6688',true);return false}
  if(S.settings.instant||rand()<ch){
    const c=e.c;caughtExtras(c);express(c);c.hp=stats(c).hp;c.captureRaid=R.id;c.bondXp=0;
    e.hp=0;e.captured=true;R.slot3={c};refreshSupport();R.caught++;R.kxp+=15;dexForm(c.species,c.stage||0,'caught');sfx('capture');
    float(e.x,e.y-e.r-12,'Caught!','#ffcf4a',true);msg(`Caught ${c.name}, a ${sexSym(c.sex)} ${formName(c)}! ${TOUCH?'Open the menu (⚙) to swap it in':'Press 1 or 2'} to test it.`);
    R.fx.push({x:e.x,y:e.y,r:60,t:.5,max:.5,col:'#ffcf4a'});
    return true;
  }
  sfx('fail');float(e.x,e.y-e.r-12,'Broke free!','#ff6688',true);e.stun=0;e.cd=.3;return false;
}
function nearestItem(){let best=null,bd=40;for(const it of R.items){if(it.kind!=='gun')continue;const d=dist(it,R.p);if(d<bd){bd=d;best=it}}return best}
function nearNpc(){const r=R.cur;if(!r||(r.kind!=='shop'&&r.kind!=='shrine'))return null;return dist(R.p,{x:r.cx,y:r.cy})<60?r:null}
function interact(){
  const it=nearestItem();
  if(it){
    R.items=R.items.filter(x=>x!==it);
    if(!R.guns[1]&&R.guns[0]){R.guns[1]=it.id;R.gunItem[1]=it.item||null;R.active=1}
    else{const old=R.guns[R.active],oldIt=R.gunItem[R.active];R.guns[R.active]=it.id;R.gunItem[R.active]=it.item||null;if(old)R.items.push({kind:'gun',id:old,item:oldIt,x:R.p.x+rnd(-14,14),y:R.p.y+18})}
    R.burst=[];R.spin=0;float(R.p.x,R.p.y-26,GUNS[it.id].name,'#ffe38a',true);sfx('pickup');return;
  }
  const r=nearNpc();if(!r)return;
  if(r.kind==='shop')openShop(r);else openShrine(r);
}

/* ---------- shops and shrines ---------- */
const gunTierRoll=f=>{const l=localFloor(f),s=f>=4;return wpick([1,2,3,4],t=>s?[0,2,5,2][t-1]+(l-1)*[0,0,1,1][t-1]:l===1?[6,3,.6,0][t-1]:l===2?[3,5,2,.3][t-1]:[1,4,5,1][t-1])};
const gunOfTier=t=>pick(GUN_IDS.filter(k=>GUNS[k].tier===t));
function payCoin(n){if(R.bag.coin+S.coin<n)return false;const fb=Math.min(n,R.bag.coin);R.bag.coin-=fb;S.coin-=n-fb;return true}
function openShop(r){
  if(!R.shops[r.idx]){
    const f=R.map.floor,bs=shuffle(BUFF_IDS.filter(k=>k!=='time'||R.mode!=='arena')),pm=priceMul();
    const gt=gunTierRoll(f),g=gunOfTier(gt);
    R.shops[r.idx]=[{kind:'buff',id:bs[0],price:Math.round((30+15*f)*pm)},{kind:'buff',id:bs[1],price:Math.round((30+15*f)*pm)},{kind:'gun',id:g,price:Math.round(([0,55,85,125,170][gt]+10*f)*pm)},{kind:'heal',price:Math.round((25+5*f)*pm)},{kind:'cage',price:Math.round(30*pm)}];
  }
  const offers=R.shops[r.idx];
  showOverlay(`<div class="ovhead"><h2>Wandering Peddler</h2><span class="status">${R.bag.coin} raid coin + ${S.coin} banked. Raid coin is spent first.</span><button class="btn primary" data-p="resume">Back to the raid</button></div>
    <div class="ovcols offers">${offers.map((o,i)=>{const [nm,ds]=o.kind==='buff'?[BUFFS[o.id].name,BUFFS[o.id].desc]:o.kind==='gun'?[GUNS[o.id].name,`Tier ${GUNS[o.id].tier} ${GUNS[o.id].melee?'melee':'gun'} · ${GUNS[o.id].desc}`]:o.kind==='heal'?['Patch Kit','Heal yourself and your companions 50%']:['Snare Cage','One more basic cage for this raid'];
      return`<button class="choice offer" data-p="buy" data-i="${i}" ${o.sold||R.bag.coin+S.coin<o.price?'disabled':''}><span class="nm">${nm}</span><small>${ds}</small><b class="price">${o.sold?'Sold':o.price+'c'}</b></button>`}).join('')}</div>`);
  R.shopRoom=r;
}
function buy(i){
  const o=R.shops[R.shopRoom.idx][i];if(!o||o.sold||!payCoin(o.price))return;
  o.sold=true;sfx('coin');
  if(o.kind==='buff')applyBuff(o.id,true);
  if(o.kind==='gun')R.items.push({kind:'gun',id:o.id,x:R.p.x+30,y:R.p.y+20});
  if(o.kind==='heal'){healPlayer(R.p.maxHp*.5);R.comps.forEach(m=>{if(m&&!m.downed)m.hp=Math.min(m.maxHp,m.hp+m.maxHp*.5)})}
  if(o.kind==='cage')R.cages.basic++;
  openShop(R.shopRoom);
}
function openShrine(r){
  if(r.used){msg('The shrine has gone quiet.');return}
  if(!r.choices){r.cursed=rand()<.5;const bl=shuffle(BUFF_IDS.filter(k=>k!=='time'||R.mode!=='arena'));r.choices=r.cursed?[...shuffle(CURSE_IDS.filter(k=>!R.curses.has(k))).slice(0,2).map(k=>({curse:k})),{buff:bl[0]}]:bl.slice(0,3).map(k=>({buff:k}))}
  showOverlay(`<div class="ovhead"><h2>${r.cursed?'Cursed Shrine':'Old Shrine'}</h2><span class="status">${r.cursed?'Roots coil around this shrine. Its pacts are strong, and they cost something. Choose one gift.':'Choose one blessing.'} It lasts until this raid ends.</span><button class="btn" data-p="resume">Decide later</button></div>
    <div class="ovcols c3">${r.choices.map(c=>c.curse?`<button class="choice offer cursed" data-p="curse" data-k="${c.curse}"><span class="nm">${CURSES[c.curse].name} <span class="chip bad">Pact</span></span><small>${CURSES[c.curse].desc}</small></button>`:`<button class="choice offer" data-p="bless" data-k="${c.buff}"><span class="nm">${BUFFS[c.buff].name}</span><small>${BUFFS[c.buff].desc}</small></button>`).join('')}</div>`);
  R.shrineRoom=r;
}

/* ---------- player weapons ---------- */
function moveVec(){
  let mx=0,my=0;
  if(keys.has('KeyW')||keys.has('ArrowUp'))my-=1;if(keys.has('KeyS')||keys.has('ArrowDown'))my+=1;
  if(keys.has('KeyA')||keys.has('ArrowLeft'))mx-=1;if(keys.has('KeyD')||keys.has('ArrowRight'))mx+=1;
  if(touch.move){const r=stickR(),dx=touch.move.x-touch.move.ox,dy=touch.move.y-touch.move.oy,l=Math.hypot(dx,dy);if(l>6){const k=Math.min(1,l/r)/l;mx=dx*k;my=dy*k}}
  else{const l=Math.hypot(mx,my);if(l>1){mx/=l;my/=l}}
  return{mx,my};
}
function swing(g){
  const p=R.p,a=R.aim,dm=g.dmg*playerDmgMul()*(g.hits||1);sfx('swing');
  if(g.lunge){const st=g.lunge/6;for(let i=0;i<6;i++)moveEnt(p,Math.cos(a)*st,Math.sin(a)*st)}
  R.swings.push({x:p.x,y:p.y,a,arc:g.arc,r:g.range,t:.16,max:.16,col:g.col});
  let hit=0;
  for(const e of R.enemies){
    if(e.hp<=0)continue;const d=dist(e,p);if(d>g.range+e.r)continue;
    if(Math.abs(angDiff(Math.atan2(e.y-p.y,e.x-p.x),a))>g.arc/2+Math.atan2(e.r,Math.max(d,1)))continue;
    hurtEnemy(e,dm,false,'melee',g.elem);hit++;
    if(g.knock&&e.kind!=='boss'&&e.spd>0){const k=Math.atan2(e.y-p.y,e.x-p.x);moveEnt(e,Math.cos(k)*g.knock,Math.sin(k)*g.knock)}
  }
  if(g.leech&&hit)healPlayer(dm*g.leech*hit);
  for(let i=R.bullets.length-1;i>=0;i--){const b=R.bullets[i];if(b.team!=='e')continue;const d=dist(b,p);if(d>g.range+b.r+4)continue;
    if(Math.abs(angDiff(Math.atan2(b.y-p.y,b.x-p.x),a))>g.arc/2+.25)continue;
    if(g.reflect){b.team='p';const sp=Math.hypot(b.vx,b.vy)*1.2;const na=Math.atan2(b.y-p.y,b.x-p.x);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp;b.dmg=dm*.5;b.col=g.col;b.life=1.2;b.src='melee';b.homing=0;b.elem=g.elem||null}
    else{R.bullets.splice(i,1);R.fx.push({x:b.x,y:b.y,r:6,t:.15,max:.15,col:'#fff'})}}
  if(g.shock)explodeAt(p.x+Math.cos(a)*g.range*.7,p.y+Math.sin(a)*g.range*.7,g.shock,dm*.5,'p','melee',g.elem);
  else crackHitArea(p.x+Math.cos(a)*g.range*.7,p.y+Math.sin(a)*g.range*.7,g.range*.5,dm);
  if(g.wave)shoot('p',p.x+Math.cos(a)*20,p.y+Math.sin(a)*20,a,430,dm*.6,{col:g.col,r:10,pierce:3,life:.8,src:'melee',elem:g.elem});
}
function fireWeapon(){
  const p=R.p,id=R.guns[R.active];if(!id)return;const g=GUNS[id];
  makeNoise(p.x,p.y);
  let rate=g.rate*(1+.15*B('rate'))*(CU('blood')?1.3:1);
  if(g.melee){swing(g);p.fireCd=1/rate;return}
  const dm=g.dmg*playerDmgMul();sfx(g.dmg>=20||g.explode?'heavy':'shot');
  const o={col:g.col,r:g.r||4,pierce:(g.pierce||0)+B('pierce')+(CU('blind')?1:0),life:g.life||1.2,bounce:g.bounce,explode:g.explode,split:g.split,homing:g.homing,src:'p',elem:g.elem};
  const mx=p.x+Math.cos(R.aim)*16,my=p.y+Math.sin(R.aim)*16;
  const one=(ang)=>shoot('p',mx,my,ang,g.speed*rnd(.94,1.04),dm,o);
  if(g.ring){for(let k=0;k<g.ring;k++)one(R.aim+k/g.ring*Math.PI*2)}
  else if(g.burst){for(let k=0;k<g.burst;k++)R.burst.push({t:k*g.burstGap,f:()=>one(R.aim+rnd(-g.spread,g.spread))})}
  else for(let k=0;k<(g.pellets||1);k++)one(R.aim+rnd(-(g.spread||0),g.spread||0));
  if(g.spin)rate*=.3+.7*R.spin;
  p.fireCd=1/rate;
}

/* ---------- tutorial ---------- */
const TUT=[
  {t:()=>`Move with ${TOUCH?'the left stick':'W A S D'}. Walk around the room.`},
  {t:()=>`Attack the three training dummies. ${TOUCH?'Push the right stick toward them':'Aim with the mouse and hold the left button'}.`},
  {t:()=>`Roll with ${TOUCH?'the Roll button':'Space'}. You can't be hit mid-roll.`},
  {t:()=>`Use a companion's ability: ${TOUCH?'tap Cinder or Morel in the party list':'press Q or E'}.`},
  {t:()=>'The door is open. Head east into the next room.'},
  {t:()=>`A wild Cindlet! Weaken it until its health bar turns gold.`},
  {t:()=>`Get close and use a cage: ${TOUCH?'tap the gold Cage button':'press F'}. A free slot 3 holds your catch.`},
  {t:()=>`Swap your catch into the fight: ${TOUCH?'tap ⇄1 or ⇄2 on the slot 3 row':'press 1 or 2'}.`},
  {t:()=>'The way out is open. Stand in the rift circle to extract. Anything you extract with is yours to keep.'},
];
function tutEnter(i){
  const T=R.tut;T.step=i;const M=R.map,[A,Bm]=M.rooms;
  if(i===1){for(let k=0;k<3;k++)spawnFoe({x:A.cx-120+k*120,y:A.cy-90},'dummy',1,A)}
  if(i===3&&!R.comps.some(m=>m)){tutEnter(4);return}
  if(i===4){A.tutLock=false;A.locked=false;sfx('door')}
  if(i===5){const e=spawnWild({x:Bm.cx+90,y:Bm.cy},'cindlet',Bm,3);e.dmg=3;e.fire={kind:'fan',n:1,spread:0,spd:170,every:3.2};T.wild=e}
  if(i===8){const Cm=M.rooms[2];Cm.tutLock=false;Cm.locked=false;sfx('door')}
  $('#tutBox').innerHTML=`<b>Tutorial ${i+1}/${TUT.length}</b><span>${TUT[i].t()}</span>`;
}
function tutUpdate(){
  const T=R.tut,p=R.p,M=R.map,Bm=M.rooms[1];
  const d=Math.hypot(p.x-T.lx,p.y-T.ly);T.moved+=d;T.lx=p.x;T.ly=p.y;
  const s=T.step;
  if(s===0&&T.moved>260)tutEnter(1);
  else if(s===1&&!R.enemies.some(e=>e.id==='dummy'))tutEnter(2);
  else if(s===2&&T.rolled)tutEnter(3);
  else if(s===3&&T.abil)tutEnter(4);
  else if(s===4&&R.cur===Bm&&roomAt(p.x,p.y,40)===Bm)tutEnter(5);
  else if(s===5){if(!T.wild||T.wild.hp<=0&&!T.wild.captured){T.wild=null;tutEnter(5);return}if(isWeak(T.wild)){T.wild.stun=999;tutEnter(6)}}
  else if(s===6){if(R.slot3&&R.slot3.c.captureRaid===R.id)tutEnter(7);else if(T.wild&&T.wild.hp<=0&&!T.wild.captured){tutEnter(5)}}
  else if(s===7&&R.comps.some(m=>m&&m.c.captureRaid===R.id))tutEnter(8);
}

/* ---------- update ---------- */
const STRAY_T=1.5;
function update(dt){
  R.t+=dt;const p=R.p;
  if(R.mode!=='arena'&&R.mode!=='tutorial'&&!S.settings.noTimer){R.time-=dt;if(R.time<=0){endRaid('collapse');return}}
  R.shield=Math.max(0,R.shield-dt);R.prism=Math.max(0,R.prism-dt);R.taunt=Math.max(0,R.taunt-dt);R.fortress=Math.max(0,R.fortress-dt);R.shake=Math.max(0,(R.shake||0)-dt);
  R.combo.cd=Math.max(0,R.combo.cd-dt);if(R.rally){R.rally.t-=dt;if(R.rally.t<=0)R.rally=null}
  if(R.msgT>0)R.msgT-=dt;
  for(let i=R.timers.length-1;i>=0;i--){R.timers[i].t-=dt;if(R.timers[i].t<=0){const f=R.timers[i].f;R.timers.splice(i,1);f()}}
  if(touch.aim){const dx=touch.aim.x-touch.aim.ox,dy=touch.aim.y-touch.aim.oy,l=Math.hypot(dx,dy);if(l>12){R.aim=assistAim(Math.atan2(dy,dx),p,R.enemies);R.firing=OPTS.autoFire||l>stickR()*.6}else R.firing=false}
  else if(R.mouse){const s=R.scale;const wx=(R.mouse.x-R.vw/2)/s+R.camx,wy=(R.mouse.y-R.vh/2)/s+R.camy;R.aim=Math.atan2(wy-p.y,wx-p.x)}
  p.rollCd-=dt;p.inv=Math.max(0,p.inv-dt);p.hurt=Math.max(0,p.hurt-dt);p.slow=Math.max(0,p.slow-dt);p.fireCd-=dt;
  if(R.sup.has('tide'))healPlayer(dt);
  for(const m of R.comps){if(!roleComp(m,'medic'))continue;const M=JOBS.ROLES.medic,rate=(m.medicT>0?M.burst:M.regen)*dt;m.medicT=Math.max(0,(m.medicT||0)-dt);
    if(p.hp>0)p.hp=Math.min(p.maxHp,p.hp+p.maxHp*rate);R.comps.forEach(o=>{if(o&&!o.downed)o.hp=Math.min(o.maxHp,o.hp+o.maxHp*rate)})}
  if(p.roll>0){p.roll-=dt;moveEnt(p,p.rvx*dt,p.rvy*dt);p.vx=p.rvx*.3;p.vy=p.rvy*.3}
  else{let{mx,my}=moveVec();const sp=200*(R.sup.has('gale')?1.1:1)*(bondComp('gale')?1.08:1)*(1+.12*B('speed'))*(CU('doom')?1.25:1)*(p.slow>0?.6:1);
    const vm=moveMul();mx*=vm;my*=vm;
    if(modOn('slick')){p.vx+=(mx*sp-p.vx)*Math.min(1,dt*2);p.vy+=(my*sp-p.vy)*Math.min(1,dt*2)}else{p.vx=mx*sp;p.vy=my*sp}
    moveEnt(p,p.vx*dt,p.vy*dt);if(!R.mouse&&!touch.aim&&(mx||my))R.aim=Math.atan2(my,mx)}
  if(modOn('fog')){if(!S.settings.god&&!R.god&&R.shield<=0){p.hp-=2*dt;if(p.hp<=0){playerDown();return}}R.comps.forEach(m=>{if(m&&!m.downed)m.hp=Math.max(1,m.hp-m.maxHp*.02*dt)})}
  if(!R.trail.length||dist(R.trail[0],p)>12){R.trail.unshift({x:p.x,y:p.y});if(R.trail.length>60)R.trail.pop()}
  const gun=R.guns[R.active]?GUNS[R.guns[R.active]]:null;
  if(gun&&gun.spin)R.spin=R.firing?Math.min(1,R.spin+dt):Math.max(0,R.spin-dt*2);
  for(let i=R.burst.length-1;i>=0;i--){R.burst[i].t-=dt;if(R.burst[i].t<=0){R.burst[i].f();R.burst.splice(i,1)}}
  if(R.firing&&p.fireCd<=0&&p.roll<=0&&!R.burst.length)fireWeapon();
  R.comps.forEach((m,i)=>m&&updComp(m,dt,i));
  const frenzy=modOn('frenzy');
  R.enemies.forEach(e=>{
    for(const k in e.status){e.status[k]-=dt;if(e.status[k]<=0)delete e.status[k]}
    if(e.burn){e.burn.t-=dt;if(e.burn.t>0)hurtEnemy(e,e.burn.dps*dt,true,e.burn.src);else e.burn=null}
    if(e.hp>0&&ruleOn(R.tier,'regrowth'))e.hp=Math.min(e.maxHp,e.hp+e.maxHp*.01*dt);
    if(e.poison){e.poison.t-=dt;if(e.poison.t>0)hurtEnemy(e,e.poison.dps*dt,true,e.poison.src);else e.poison=null}
    if(e.kind==='boss')updBoss(e,dt);else updEnemy(e,dt*(frenzy?1.35:1));
  });
  updBullets(dt);if(R.over)return;
  updFields(dt);
  for(const e of R.enemies)if(e.hp<=0&&!e.gone){e.gone=true;onEnemyDeath(e)}
  R.enemies=R.enemies.filter(e=>!e.gone);
  const r=roomAt(p.x,p.y,22);
  if(r){if(r!==R.cur&&r.mod&&r.spawned&&!R.enemies.some(e=>e.room===r))0;R.cur=r;if(!r.spawned)enterRoom(r);r.visited=true;if(r.hidden){r.hidden=false}}
  else{const r2=roomAt(p.x,p.y,0);if(r2)R.cur=r2}
  // A locked room's enemy that ends up outside it (pushed by wind or water, split into a wall) is put back
  // inside after a moment, so it can always be fought and the doors can always open.
  for(const e of R.enemies){if(!e.room||e.hp<=0||e.kind==='boss'||e.rival)continue;const rm=e.room;
    const inside=e.x>rm.ox*TS&&e.x<(rm.ox+RW)*TS&&e.y>rm.oy*TS&&e.y<(rm.oy+RH)*TS&&!hitsWall(e.x,e.y,Math.max(4,e.r-4));
    if(inside){e.stray=0;continue}e.stray=(e.stray||0)+dt;
    if(e.stray>STRAY_T){const q=spawnPos(rm);e.x=q.x;e.y=q.y;e.stray=0}}
  R.map.rooms.forEach(rm=>{if(rm.tutLock)return;if(rm.locked&&!R.enemies.some(e=>e.room===rm&&e.hp>0)){rm.locked=false;rm.cleared=true;sfx('door');if(rm.kind!=='boss')msg('Room clear. The doors open.')}else if(rm.spawned&&!rm.locked)rm.cleared=true});
  R.map.rooms.forEach(rm=>{if(rm.chest&&!rm.chest.open&&!rm.locked&&dist(p,rm.chest)<34)openChest(rm)});
  lorePick();
  for(let i=R.items.length-1;i>=0;i--){const it=R.items[i];if((it.kind==='buff'||it.kind==='loot')&&dist(it,p)<26){R.items.splice(i,1);if(it.kind==='buff')applyBuff(it.id);else takeLoot(it)}}
  if(!R.heardCrack&&R.map.cracks.size){const hear=partyHas('echo')||R.comps.some(m=>m&&!m.downed&&m.c.pers==='curious')||(R.slot3&&R.slot3.c.pers==='curious');
    if(hear){const range=bondComp('echo')?520:260;for(const[i]of R.map.cracks){const cx=(i%R.map.W+.5)*TS,cy=(Math.floor(i/R.map.W)+.5)*TS;if(Math.hypot(cx-p.x,cy-p.y)<range){R.heardCrack=true;msg('Your companion hears a hollow wall nearby.');break}}}}
  if(R.tut)tutUpdate();
  if(R.mode!=='tutorial'){twistUpdate(dt);for(const w of [R.windMove,R.songPull])if(w){moveEnt(p,w.x,w.y);R.comps.forEach(m=>{if(m&&!m.downed)moveEnt(m,w.x,w.y)})}}
  objectives(dt);
  R.floats.forEach(f=>{f.t-=dt*.9;f.y-=24*dt});R.floats=R.floats.filter(f=>f.t>0);
  R.fx.forEach(f=>f.t-=dt);R.fx=R.fx.filter(f=>f.t>0);
  R.bolts.forEach(f=>f.t-=dt);R.bolts=R.bolts.filter(f=>f.t>0);
  R.swings.forEach(s=>s.t-=dt);R.swings=R.swings.filter(s=>s.t>0);
}
function updFields(dt){
  const p=R.p;
  R.fields.forEach(f=>{
    f.t-=dt;if(f.move){const nx=f.x+f.move.vx*dt,ny=f.y+f.move.vy*dt;if(!hitsWall(nx,ny,6)){f.x=nx;f.y=ny}else{f.move.vx*=-1;f.move.vy*=-1}}
    f.tick=(f.tick||0)-dt;const tick=f.tick<=0;if(tick)f.tick=.5;
    R.enemies.forEach(e=>{if(e.hp<=0||dist(e,f)>f.r+e.r)return;
      if(f.pull&&e.kind!=='boss'&&e.spd>0){const a=Math.atan2(f.y-e.y,f.x-e.x);moveEnt(e,Math.cos(a)*f.pull*dt,Math.sin(a)*f.pull*dt)}
      if(e.kind!=='boss'&&(f.elem==='spore'||f.slowAll))e.slow=.4;
      if(tick)hurtEnemy(e,f.dps*.5,true,f.src,f.elem)});
    if(f.slowAll&&tick&&dist(p,f)<f.r){healPlayer(2)}
  });
  R.fields=R.fields.filter(f=>f.t>0);
}
function compAttack(m,tgt,K){
  const a=Math.atan2(tgt.y-m.y,tgt.x-m.x),atk=compAtk(m)*critMul(m.st),rate=m.st.rate*(R.rally?R.rally.mult:1),reach=m.st.reach,el=TYPES[m.c.type].elem;
  const col=SPECIES[m.c.species].col,o={col,src:m,elem:el,r:K.r||5,pierce:K.pierce||0,bounce:K.bounce||0,explode:K.explode||0,homing:K.homing||0,slow:K.slow||0,split:K.split?3:0,life:(K.life||1.3)*reach};
  const fan=(n,spread,spd,mult)=>{for(let i=0;i<n;i++){const t=n===1?0:i/(n-1)-.5;shoot('p',m.x,m.y,a+t*(spread||.12)*(n-1),spd*reach,atk*mult,o)}};
  switch(K.kind){
    case'shot':fan(K.n,K.spread,K.spd,K.mult);break;
    case'stream':for(let i=0;i<K.n;i++)later(i*K.gap,()=>{if(m.downed)return;const t2=nearestEnemy(m,360,true)||tgt;const aa=Math.atan2(t2.y-m.y,t2.x-m.x)+rnd(-K.spread,K.spread);shoot('p',m.x,m.y,aa,K.spd*reach,atk*K.mult,o)});break;
    case'ring':for(let i=0;i<K.n;i++)shoot('p',m.x,m.y,a+i/K.n*Math.PI*2,K.spd*reach,atk*K.mult,o);break;
    case'lob':{const ts=R.enemies.filter(e=>e.hp>0&&!isWeak(e)&&dist(e,m)<380);for(let i=0;i<K.n;i++){const t2=i===0?tgt:(ts[i%Math.max(1,ts.length)]||tgt);
      shoot('p',m.x,m.y,0,0,atk*K.mult,{...o,r:7,lob:{sx:m.x,sy:m.y,tx:t2.x+rnd(-10,10),ty:t2.y+rnd(-10,10),T:.6,rad:K.rad},cloud:K.cloud?1:0})}break}
    case'strike':{const x=tgt.x,y=tgt.y;R.fx.push({x,y,r:K.rad,t:K.delay,max:K.delay,col:col});later(K.delay,()=>explodeAt(x,y,K.rad,atk*K.mult,'p',m,el,col));break}
    case'field':{const st=K.move?{x:m.x,y:m.y}:{x:tgt.x,y:tgt.y};R.fields.push({x:st.x,y:st.y,r:K.rad,t:K.dur,dps:atk*K.mult,src:m,elem:el,pull:K.pull||0,col,spin:true,move:K.move?{vx:Math.cos(a)*K.move,vy:Math.sin(a)*K.move}:null});break}
    case'chain':{const hit=[tgt];let cur=tgt;hurtEnemy(tgt,atk*K.mult,false,m,el);R.bolts.push({a:{x:m.x,y:m.y},b:{x:tgt.x,y:tgt.y},t:.2,col});
      for(let i=1;i<K.jumps;i++){const nx=R.enemies.filter(x=>x.hp>0&&!hit.includes(x)&&dist(x,cur)<170&&!isWeak(x)).sort((p1,p2)=>dist(p1,cur)-dist(p2,cur))[0];if(!nx)break;R.bolts.push({a:{x:cur.x,y:cur.y},b:{x:nx.x,y:nx.y},t:.2,col});hurtEnemy(nx,atk*K.mult*.8,false,m,el);hit.push(nx);cur=nx}break}
    case'orbit':for(let i=0;i<K.n;i++)shoot('p',m.x,m.y,0,0,atk*K.mult,{...o,r:5,life:3,orbit:{m,ang:i/K.n*Math.PI*2,rad:28,t:.9}});break;
  }
  m.cd=K.cd/rate;
}
function updComp(m,dt,idx){
  const p=R.p;m.flash=Math.max(0,m.flash-dt);
  if(m.downed){
    if(m.autoT>0){m.autoT-=dt;if(m.autoT<=0){m.downed=false;m.hp=Math.round(m.maxHp*.5);float(m.x,m.y-22,'Revived by the Spring','#58c2ff',true)}return}
    if(dist(m,p)<48){m.rev+=dt;if(m.rev>=1.5){m.downed=false;m.hp=Math.round(m.maxHp*.35);m.rev=0;float(m.x,m.y-22,'Revived','#5de8b0',true);sfx('level')}}else m.rev=Math.max(0,m.rev-dt);
    return;
  }
  m.abil=Math.max(0,m.abil-dt);m.cd-=dt;
  if(m.st.regen)m.hp=Math.min(m.maxHp,m.hp+m.maxHp*m.st.regen*dt);
  if(typesOf(m.c).includes('tide'))healPlayer(1.2*dt);
  if(m.c.type==='fungal'&&m.st.star>=3&&dist(m,p)<130)healPlayer(1.5*dt);
  if(modOn('fog'))0;
  if(m.obey<1&&m.sulk<=0){m.obeyCheck-=dt;if(m.obeyCheck<=0){m.obeyCheck=rnd(4,6);if(rand()>m.obey+.15){m.sulk=1.6;float(m.x,m.y-24,'?','#ffcf4a',true)}}}
  m.sulk=Math.max(0,m.sulk-dt);
  const K=ATTACKS[m.st.atkId],el=TYPES[m.c.type].elem;
  if(m.dash>0){
    m.dash-=dt;moveEnt(m,m.dvx*dt,m.dvy*dt);
    R.enemies.forEach(e=>{if(e.hp>0&&!m.dashHit.has(e)&&dist(e,m)<e.r+m.r+6){m.dashHit.add(e);hurtEnemy(e,m.dashDmg*critMul(m.st),false,m,el);const a=Math.atan2(e.y-m.y,e.x-m.x);if(e.spd>0&&e.kind!=='boss')moveEnt(e,Math.cos(a)*(m.knock||8),Math.sin(a)*(m.knock||8))}});
    if(m.dash<=0&&m.dashEnd){const end=m.dashEnd,atk=compAtk(m);m.dashEnd=null;
      if(end==='ring')for(let k=0;k<8;k++)shoot('p',m.x,m.y,k/8*Math.PI*2,300,atk*.6,{col:SPECIES[m.c.species].col,r:5,src:m,elem:el});
      if(end==='shock')explodeAt(m.x,m.y,70,atk*.6,'p',m,el);
      if(end==='quake'){explodeAt(m.x,m.y,90,atk*.7,'p',m,el);R.taunt=Math.max(R.taunt,1.5);R.tauntEnt=m}
      if(end==='fire'){explodeAt(m.x,m.y,60,atk*.7,'p',m,'burn','#ff7a3d');R.fields.push({x:m.x,y:m.y,r:45,t:2.5,dps:atk*.4,src:m,elem:'burn',col:'#ff7a3d'})}}
    return;
  }
  const tgt=nearestEnemy(m,340,true);
  let tr=R.trail,want=tr[Math.min(tr.length-1,(idx+1)*(m.c.pers==='timid'?2:4))]||p;
  if(m.c.pers==='brave'&&tgt&&dist(tgt,p)<300&&K.kind!=='dash'&&m.sulk<=0){const a=Math.atan2(m.y-tgt.y,m.x-tgt.x);want={x:tgt.x+Math.cos(a)*120,y:tgt.y+Math.sin(a)*120}}
  const dx=want.x-m.x,dy=want.y-m.y,l=Math.hypot(dx,dy);
  if(l>14){const sp=Math.max(m.spd,215)*(l>110?1.6:1);const st=Math.min(l,sp*dt);if(!moveEnt(m,dx/l*st,dy/l*st))m.stuck+=dt;else m.stuck=Math.max(0,m.stuck-dt)}
  if(dist(m,p)>(m.c.pers==='brave'?380:320)||m.stuck>.8){m.x=p.x+rnd(-18,18);m.y=p.y+rnd(-6,18);m.stuck=0}
  if(Math.abs(dx)>2)m.face=dx<0?-1:1;
  if(m.sulk>0||m.cd>0||!tgt)return;
  m.face=tgt.x<m.x?-1:1;
  if(K.kind==='dash'){
    const d=dist(m,tgt)-tgt.r,a=Math.atan2(tgt.y-m.y,tgt.x-m.x);
    if(d<K.range&&dist(tgt,p)<300){m.dash=Math.min(.34,(d+10)/K.sp+.05);m.dvx=Math.cos(a)*K.sp;m.dvy=Math.sin(a)*K.sp;m.dashHit=new Set();m.dashDmg=compAtk(m)*K.mult;m.knock=K.knock||8;m.dashEnd=K.end||null;m.cd=K.cd/(m.st.rate*(R.rally?R.rally.mult:1))}
    return;
  }
  compAttack(m,tgt,K);
}
function updEnemy(e,dt){
  e.flash=Math.max(0,e.flash-dt);e.hitCd-=dt;
  if(e.dormant)return;   // the Hollow Choir: asleep until it hears you
  for(let i=e.queue.length-1;i>=0;i--){const q=e.queue[i];q.t-=dt;if(q.t<=0){e.queue.splice(i,1);if(e.hp>0)q.f()}}
  if(e.stun>0){e.stun-=dt;return}
  e.slow=Math.max(0,e.slow-dt);
  const tgt=pickTarget(e);const dx=tgt.x-e.x,dy=tgt.y-e.y,d=Math.hypot(dx,dy)||1;
  const sp=e.spd*(e.slow>0?.5:1),a=Math.atan2(dy,dx);
  if(e.chargeT>0){
    e.chargeT-=dt;const moved=moveEnt(e,e.cvx*dt,e.cvy*dt);
    if(e.chargeT<=0||!moved){e.chargeT=0;if(e.fire.ring)ringShot(e,e.fire.ring,e.fire.rspd||130);if(e.fire.fan)fanShot(e,e.fire.fan,1,190)}
  }else if(e.wind>0){
    e.wind-=dt;if(e.wind<=0)release(e,tgt);
  }else{
    e.face=dx<0?-1:1;
    if(e.spd>0){
      if(e.melee)moveEnt(e,dx/d*sp*dt,dy/d*sp*dt);
      else{
        let mx=0,my=0;
        if(d>260){mx=dx/d;my=dy/d}else if(d<170){mx=-dx/d;my=-dy/d}else{mx=-dy/d*e.strafe;my=dx/d*e.strafe}
        if(e.def&&(e.def.body==='bat'||e.def.body==='wisp')){mx+=Math.sin(R.t*4+e.seed)*.6;my+=Math.cos(R.t*3+e.seed)*.6}
        if(!moveEnt(e,mx*sp*dt,my*sp*dt))e.strafe*=-1;
      }
    }
    e.cd-=dt;
    if(e.cd<=0&&d<560&&e.fire.kind!=='none'){
      if(e.fire.kind==='spiral'){pattern(e,a);e.cd=e.every}
      else if(e.fire.kind==='charge'){if(d<300){e.wind=.5;e.cd=e.every*rnd(.9,1.1)}}
      else{e.wind=.42;e.cd=e.every*rnd(.9,1.1)}
    }
  }
  if(e.melee&&e.dmg>0&&d<e.r+tgt.r+3&&e.hitCd<=0){e.hitCd=.9;tgt===R.p?hurtPlayer(e.dmg):hurtComp(tgt,e.dmg)}
}
function release(e,tgt){
  const a=Math.atan2(tgt.y-e.y,tgt.x-e.x);
  if(e.fire.kind==='charge'){e.chargeT=.5;const cs=e.fire.cspd||400;e.cvx=Math.cos(a)*cs;e.cvy=Math.sin(a)*cs;return}
  if(e.fire.blink){const r=e.room||R.cur;if(r){for(let i=0;i<10;i++){const ang=rnd(0,6.28),dd=rnd(150,220),x=tgt.x+Math.cos(ang)*dd,y=tgt.y+Math.sin(ang)*dd;if(roomAt(x,y,20)===r&&!hitsWall(x,y,e.r)){R.fx.push({x:e.x,y:e.y,r:20,t:.3,max:.3,col:e.bcol});e.x=x;e.y=y;break}}}}
  e.shots++;
  if(e.def&&e.def.summon&&e.shots%3===0&&R.enemies.length<14){spawnFoe({x:e.x+rnd(-30,30),y:e.y+rnd(-30,30)},e.def.summon,R.map.floor,e.room);R.fx.push({x:e.x,y:e.y,r:40,t:.4,max:.4,col:e.bcol})}
  pattern(e,Math.atan2(tgt.y-e.y,tgt.x-e.x));
}
function ringShot(e,n,spd,off=0){for(let i=0;i<n;i++)shoot('e',e.x,e.y,e.rot+off+i/n*Math.PI*2,spd,e.dmg,{col:e.bcol,r:5});e.rot+=(e.fire&&e.fire.rot)||.13}
function fanShot(e,n,spread,spd,slow){const tg=pickTarget(e),aa=Math.atan2(tg.y-e.y,tg.x-e.x);for(let i=0;i<n;i++){const t=n===1?0:i/(n-1)-.5;shoot('e',e.x,e.y,aa+t*spread,spd,e.dmg,{col:e.bcol,r:5,slow})}}
function pattern(e,a){
  const P=e.fire,sh=(ang,spd,r,o={})=>shoot('e',e.x,e.y,ang,spd,e.dmg,{col:e.bcol,r:r||5,slow:P.slow,...o});
  switch(P.kind){
    case'fan':{fanShot(e,P.n,P.spread,P.spd,P.slow);for(let w=1;w<(P.waves||1);w++)e.queue.push({t:.32*w,f:()=>fanShot(e,P.n,P.spread,P.spd,P.slow)});break}
    case'ring':{ringShot(e,P.n,P.spd);if(P.waves>1)e.queue.push({t:.35,f:()=>ringShot(e,P.n,P.spd,Math.PI/P.n)});break}
    case'cross':{for(let i=0;i<4;i++)sh(e.rot+i*Math.PI/2,P.spd);e.rot+=Math.PI/4;break}
    case'spiral':{for(let i=0;i<P.n;i++)sh(e.rot+i/P.n*Math.PI*2,P.spd);e.rot+=P.step;break}
    case'burst':{for(let i=0;i<P.n;i++)e.queue.push({t:i*P.gap,f:()=>{const tg=pickTarget(e);sh(Math.atan2(tg.y-e.y,tg.x-e.x),P.spd)}});break}
    case'homing':{for(let i=0;i<P.n;i++)sh(a+(i-(P.n-1)/2)*.5,P.spd,6,{homing:P.turn,life:4});break}
    case'brute':{if(e.phase%2===0)for(let i=0;i<P.n;i++)sh(i/P.n*Math.PI*2+e.rot,P.spd,7);else for(let i=0;i<7;i++)sh(a+(i/6-.5)*1.1,P.spd*1.2);e.phase++;e.rot+=.2;break}
  }
}

/* ---------- bosses ---------- */
function bossAttack(b,name,P){
  const tg=pickTarget(b),a=Math.atan2(tg.y-b.y,tg.x-b.x);
  const sh=(x,y,ang,spd,o={})=>shoot('e',x,y,ang,spd,b.dmg,{col:b.bcol,r:6,...o});
  const ring=(n,spd,off,gap)=>{const g0=Math.floor(rand()*n);for(let i=0;i<n;i++){if(gap&&((i-g0+n)%n)<gap)continue;sh(b.x,b.y,b.rot+off+i/n*Math.PI*2,spd)}b.rot+=.17};
  const fan=(n,spr,spd)=>{const t2=pickTarget(b),aa=Math.atan2(t2.y-b.y,t2.x-b.x);for(let i=0;i<n;i++){const t=n===1?0:i/(n-1)-.5;sh(b.x,b.y,aa+t*spr,spd)}};
  let dur=0;
  switch(name){
    case'ring':ring(P.n,P.spd,0,P.gap||0);for(let w=1;w<(P.waves||1);w++)b.queue.push({t:.45*w,f:()=>ring(P.n,P.spd,Math.PI/P.n,P.gap||0)});dur=.45*((P.waves||1)-1);break;
    case'fan':fan(P.n,P.spread,P.spd);for(let w=1;w<(P.waves||1);w++)b.queue.push({t:.35*w,f:()=>fan(P.n,P.spread,P.spd)});dur=.35*((P.waves||1)-1);break;
    case'spiral':{const steps=Math.floor(P.dur/P.every);for(let k=0;k<steps;k++)b.queue.push({t:k*P.every,f:()=>{for(let i=0;i<P.arms;i++)sh(b.x,b.y,b.spin+i/P.arms*Math.PI*2,P.spd);b.spin+=P.step}});dur=P.dur;break}
    case'summon':{const r=b.room;for(let i=0;i<P.n&&R.enemies.length<12;i++){const pos=spawnPos(r,120);const sp=spawnFoe(pos,P.foe,R.map.floor,r);if(b.brood)b.brood.push(sp);R.fx.push({x:pos.x,y:pos.y,r:30,t:.4,max:.4,col:b.bcol})}dur=.3;break}
    case'dash':b.dashT=P.dur;b.dvx=Math.cos(a)*P.spd;b.dvy=Math.sin(a)*P.spd;b.trail=P.trail;b.trailT=0;b.endRing=P.ring||0;dur=P.dur;break;
    case'line':{const ways=P.ways||1;for(let k=0;k<P.n;k++)b.queue.push({t:k*.05,f:()=>{for(let w=0;w<ways;w++){const off=ways===1?0:(w/(ways-1)-.5)*P.spread*(ways-1);sh(b.x,b.y,a+off,P.spd,{r:5})}}});dur=P.n*.05;break}
    case'blink':{const r=b.room;for(let i=0;i<20;i++){const x=(r.ox+rnd(2,RW-2))*TS,y=(r.oy+rnd(2,RH-2))*TS;if(Math.hypot(x-R.p.x,y-R.p.y)>170){R.fx.push({x:b.x,y:b.y,r:40,t:.4,max:.4,col:b.bcol});b.x=x;b.y=y;break}}
      b.queue.push({t:.25,f:()=>ring(P.ring,P.spd,0,0)});dur=.3;break}
    case'cross':{const steps=Math.floor(P.dur/P.every);for(let k=0;k<steps;k++)b.queue.push({t:k*P.every,f:()=>{for(let i=0;i<4;i++)sh(b.x,b.y,b.spin+i*Math.PI/2,P.spd);b.spin+=.12}});dur=P.dur;break}
    case'homing':{for(let i=0;i<P.n;i++)sh(b.x,b.y,a+(i/(P.n-1||1)-.5)*2.4,P.spd,{homing:P.turn,life:4.5,r:7});dur=.3;break}
    case'rain':{for(let i=0;i<P.n;i++)b.queue.push({t:i*.07,f:()=>{const t2=pickTarget(b),ang=rnd(0,6.28),x=t2.x+Math.cos(ang)*300,y=t2.y+Math.sin(ang)*300;shoot('e',x,y,ang+Math.PI+rnd(-.15,.15),P.spd,b.dmg,{col:b.bcol,r:6,life:3.5})}});dur=P.n*.07;break}
  }
  b.busy=dur;
}
function updBoss(b,dt){
  b.flash=Math.max(0,b.flash-dt);b.hitCd-=dt;
  for(let i=b.queue.length-1;i>=0;i--){const q=b.queue[i];q.t-=dt;if(q.t<=0){b.queue.splice(i,1);if(b.hp>0)q.f()}}
  const d=b.def,r=b.room,tg=pickTarget(b);
  if(b.dashT>0){
    b.dashT-=dt;const moved=moveEnt(b,b.dvx*dt,b.dvy*dt);
    if(b.trail){b.trailT-=dt;if(b.trailT<=0){b.trailT=.08;shoot('e',b.x,b.y,rnd(0,6.28),30,b.dmg*.8,{col:b.bcol,r:6,life:2.5})}}
    if(b.dashT<=0||!moved){b.dashT=0;if(b.endRing){for(let i=0;i<b.endRing;i++)shoot('e',b.x,b.y,i/b.endRing*Math.PI*2,150,b.dmg,{col:b.bcol,r:6})}}
  }else{
    const sp=d.spd*(b.phase2?1.2:1)*(b.slow>0?.8:1);
    if(d.move==='circle'){b.orbit+=dt*sp/140;const gx=r.cx+Math.cos(b.orbit)*150,gy=r.cy+Math.sin(b.orbit)*90;moveEnt(b,(gx-b.x)*Math.min(1,dt*3),(gy-b.y)*Math.min(1,dt*3))}
    else if(d.move==='stalk'){const dd=dist(b,tg);if(dd>170){moveEnt(b,(tg.x-b.x)/dd*sp*dt,(tg.y-b.y)/dd*sp*dt)}}
    else if(d.move==='hover'){b.orbit+=dt;const gx=r.cx+Math.sin(b.orbit*.7)*170,gy=r.cy-40+Math.cos(b.orbit*1.1)*60;moveEnt(b,(gx-b.x)*Math.min(1,dt*2),(gy-b.y)*Math.min(1,dt*2))}
  }
  b.slow=Math.max(0,b.slow-dt);
  if(b.busy>0)b.busy-=dt;
  else if(b.wind>0){b.wind-=dt;if(b.wind<=0){const list=b.phase2?d.p2:d.p1,[nm,P]=list[b.ai%list.length];b.ai++;bossAttack(b,nm,P);b.cd=b.phase2?1:1.4}}
  else{b.cd-=dt;if(b.cd<=0)b.wind=.7}
  if(dist(b,tg)<b.r+tg.r&&b.hitCd<=0){b.hitCd=1;tg===R.p?hurtPlayer(b.dmg):hurtComp(tg,b.dmg)}
}
function onBossDeath(b){
  const d=b.def,set=d.set,r=b.room;
  R.boss=null;$('#bossBar').hidden=true;sfx('evolve');
  // A boss pays full Keeper XP the first time, and a share after that, so farming one boss can't outrun the journey.
  R.bossDown=d;R.kxp+=Math.round((set?600:250)*(S.progress.bosses[b.id]?BALANCE.BOSS_XP.repeat:1));
  const coin=Math.round((set?520:180)*R.mods.coin);R.bag.coin+=coin;bagAdd('ore',set?30:10,b.x,b.y);bagAdd(set?'dust':'hide',set?8:5,b.x,b.y);
  if(rand()<JOBS.PRINTS.boss)dropPrint(r.cx,r.cy+120);
  for(let i=0;i<2;i++)R.items.push({kind:'gun',id:gunOfTier(set?pick([3,4]):pick([2,3,3,4])),x:r.cx+(i?50:-50),y:r.cy+60});
  R.items.push({kind:'buff',id:pick(BUFF_IDS.filter(k=>k!=='time')),x:r.cx,y:r.cy+90});
  // The demo ends at the bottom of the Rootworks: no portal down.
  // Portals down: from Floor 3 to the veins, Floor 6 to the Underheart, Floor 9 (once Ilsa is free) to the Heart.
  const fl=R.map.floor,storyMsg=onStoryBoss(d);
  r.kind='portal';r.deep=!DEMO&&!R.tier&&(fl===3||fl===6||(fl===9&&d.story==='ilsa'));r.locked=false;r.cleared=true;R.bossId=b.id;
  if(fl>=7&&!R.tier){R.relics+=ENDGAME.UNDERHEART.relicBoss;float(b.x,b.y-80,`+${ENDGAME.UNDERHEART.relicBoss} relics`,'#fff3a8',true)}
  if(R.tier){R.tierBoss=true;const got=tierLoot(R.tier);float(b.x,b.y-80,`+${got.shards} apex shard${got.shards>1?'s':''}${got.bloomscar?' +1 Bloomscar serum':''}`,'#ffcf4a',true)}
  if(d.story==='heart')later(1.2,()=>openEndingChoice());
  R.fx.push({x:b.x,y:b.y,r:200,t:1,max:1,col:'#ffcf4a'});
  float(b.x,b.y-40,`+${coin} coin`,'#ffcf4a',true);
  if(R.mode==='arena'){r.kind='arena';return}
  const first=!S.progress.bosses[b.id];const sh=first?(set?4:2):(set?2:1);S.shards+=sh;
  float(b.x,b.y-60,`+${sh} memory shard${sh>1?'s':''}${first?' · new memory':''}`,'#ff8fe0',true);
  if(storyMsg){msg(storyMsg);if(first)addLog(`First victory over ${d.name}.`);S.progress.bosses[b.id]=(S.progress.bosses[b.id]||0)+1;S.stats.bossKills++;return}
  msg(first?`${d.name} falls, and a memory surfaces. Read it in the Codex. ${r.deep?'Take the rift home, or the portal down.':'Take the rift home.'}`:!r.deep?`${d.name} falls! Step into the rift to go home a champion.`:`${d.name} falls! Take the rift home, or the portal down to the Ember Abyss.`);
  if(first)addLog(`First victory over ${d.name}. A memory surfaced.`);
  S.progress.bosses[b.id]=(S.progress.bosses[b.id]||0)+1;S.stats.bossKills++;
}
function updBullets(dt){
  const M=R.map;
  for(let i=R.bullets.length-1;i>=0;i--){
    const b=R.bullets[i];b.age+=dt;b.life-=dt;
    if(b.lob){const L=b.lob,k=Math.min(1,b.age/L.T);b.x=L.sx+(L.tx-L.sx)*k;b.y=L.sy+(L.ty-L.sy)*k;b.h=Math.sin(k*Math.PI)*46;
      if(k>=1){R.bullets.splice(i,1);explodeAt(b.x,b.y,L.rad,b.dmg,'p',b.src,b.elem,b.col);if(b.cloud)R.fields.push({x:b.x,y:b.y,r:L.rad,t:3,dps:b.dmg*.3,src:b.src,elem:b.elem,col:b.col})}continue}
    if(b.orbit){const O=b.orbit;O.t-=dt;O.ang+=dt*7;b.x=O.m.x+Math.cos(O.ang)*O.rad;b.y=O.m.y+Math.sin(O.ang)*O.rad;
      if(O.t<=0||O.m.downed){const tg=nearestEnemy(b,420,true);const a=tg?Math.atan2(tg.y-b.y,tg.x-b.x):O.ang;b.vx=Math.cos(a)*440;b.vy=Math.sin(a)*440;b.orbit=null;b.life=1.2}continue}
    if(b.split&&b.age>=.22){R.bullets.splice(i,1);const a=Math.atan2(b.vy,b.vx),sp=Math.hypot(b.vx,b.vy);[-.35,0,.35].forEach(o=>shoot(b.team,b.x,b.y,a+o,sp,b.dmg*.75,{col:b.col,r:Math.max(3,b.r-1),life:b.life,src:b.src,elem:b.elem}));continue}
    if(b.homing){const tg=b.team==='p'?nearestEnemy(b,280):(b.age<2.5?R.p:null);if(tg){const cur=Math.atan2(b.vy,b.vx),want=Math.atan2(tg.y-b.y,tg.x-b.x),df=angDiff(want,cur);const na=cur+clamp(df,-b.homing*dt,b.homing*dt),sp=Math.hypot(b.vx,b.vy);b.vx=Math.cos(na)*sp;b.vy=Math.sin(na)*sp}}
    const ox=b.x,oy=b.y;b.x+=b.vx*dt;b.y+=b.vy*dt;
    let dead=b.life<=0;
    const tx=Math.floor(b.x/TS),ty=Math.floor(b.y/TS);
    if(!dead&&solidAt(M,tx,ty)){
      const ti=ty*M.W+tx;if(b.team==='p'&&M.tiles[ti]===4)damageCrack(ti,b.dmg);
      if(b.bounce>0){b.bounce--;if(solidAt(M,Math.floor(b.x/TS),Math.floor(oy/TS)))b.vx*=-1;if(solidAt(M,Math.floor(ox/TS),Math.floor(b.y/TS)))b.vy*=-1;b.x=ox;b.y=oy}
      else{dead=true;if(b.team==='e'&&!b.rico&&ruleOn(R.tier,'ricochet')){const a=Math.atan2(-b.vy,-b.vx),sp=Math.hypot(b.vx,b.vy)*.8;[-.5,.5].forEach(o=>{const nb=shoot('e',ox,oy,a+o,sp,b.dmg*.6,{col:b.col,r:Math.max(3,b.r-1),life:1.2});nb.rico=true})}}
    }
    if(!dead){
      if(b.team==='e'){
        if(R.prism>0&&dist(b,R.p)<150){b.team='p';b.vx*=-1.2;b.vy*=-1.2;b.col='#ff8fe0';b.dmg*=1.2;b.life=1.5;b.src='p';b.homing=0;b.elem='brittle';continue}
        if(dist(b,R.p)<b.r+R.p.r-2){if(R.p.roll<=0){hurtPlayer(b.dmg,b.slow);dead=true}if(R.over)return}
        else for(const m of R.comps){if(m&&!m.downed&&dist(b,m)<b.r+m.r){hurtComp(m,b.dmg);dead=true;break}}
      }else{
        for(const e of R.enemies){
          if(e.hp<=0||(b.hit&&b.hit.has(e)))continue;
          if(b.src&&b.src.c&&isWeak(e)&&!b.explode)continue;
          if(dist(b,e)<b.r+e.r){
            if(b.explode){dead=true;break}
            hurtEnemy(e,b.dmg,false,b.src,b.elem);if(b.slow&&e.kind!=='boss')e.slow=b.slow;
            if(b.pierce>0){b.pierce--;b.hit.add(e)}else{dead=true;break}
          }
        }
      }
    }
    if(dead){if(b.explode)explodeAt(b.x,b.y,b.explode,b.dmg,b.team,b.src,b.elem);R.bullets.splice(i,1)}
  }
}
function onEnemyDeath(e){
  if(e.kind==='boss'){onBossDeath(e);return}
  deathExtras(e);
  if(e.shadow){R.kills++;sfx('kill');float(e.x,e.y,'The shadow breaks','#b4a9d8',true);return}
  if(e.elite)R.eliteKills=(R.eliteKills||0)+1;
  const f=R.map.floor,gold=e.room&&e.room.mod==='golden'?2:1,greedy=e.lastHit&&e.lastHit.c&&e.lastHit.c.pers==='greedy'?1.5:1;
  const gm=(1+.3*B('greed'))*R.mods.coin*(CU('toll')?1.6:1)*gold*greedy*(R.fmods?R.fmods.coin:1);
  if(!e.captured){
    R.kills++;R.kxp+=e.kind==='wild'?4:2;sfx('kill');
    if(e.lastHit==='melee')bump('meleeKills');
    if(e.lastHit&&e.lastHit.c)e.lastHit.kills=(e.lastHit.kills||0)+1;
    if(e.kind==='wild'){const coin=Math.round(10*f*gm),mat=e.c.type==='crystal'||e.c.type2==='crystal'?'dust':'hide',got=bagAdd(mat,1,e.x,e.y);R.bag.coin+=coin;float(e.x,e.y,`+${coin} coin${got?` +1 ${matName(mat).toLowerCase()}`:''}`,'#ffcf4a',true);float(e.x,e.y+14,`Wild ${formName(e.c)} fainted`,'#b4a9d8',true)}
    else if(e.id!=='dummy'){
      dexFoe(e.id,true);
      const coin=Math.round((ri(3,7)*f+(e.def.body==='brute'?20:0)+(e.elite?30:0))*gm);R.bag.coin+=coin;float(e.x,e.y,`+${coin}`,'#ffcf4a');
      if(e.def.body==='brute'||e.elite)bagAdd('ore',2,e.x,e.y);
      if(e.def.split&&R.enemies.length<16)for(let i=0;i<e.def.split.n;i++)spawnFoe({x:e.x+rnd(-14,14),y:e.y+rnd(-14,14)},e.def.split.id,f,e.room);
      const roll=rand();
      if(roll<.04*R.mods.buff)R.items.push({kind:'buff',id:pick(BUFF_IDS.filter(k=>k!=='time'||R.mode!=='arena')),x:e.x,y:e.y});
      else if(roll<.16)R.items.push({kind:'loot',id:pick(['cage','food','ore','hide']),x:e.x,y:e.y});
    }
  }
  const xp=(e.kind==='wild'?14:(e.elite?40:(e.def.body==='brute'?30:6+4*localFloor(f)))*(f>=4?2:1))*(e.room&&e.room.mod==='frenzy'?1.5:1);
  R.comps.forEach(m=>{if(m&&!m.downed)m.xpGain+=xp});
}
function takeLoot(it){
  sfx('pickup');
  if(it.id==='cage'){R.cages.basic++;float(it.x,it.y-12,'+1 cage','#5de8b0',true)}
  if(['food','ore','hide','dust'].includes(it.id)){const n=bagAdd(it.id,2,it.x,it.y);if(n)float(it.x,it.y-12,`+${n} ${matName(it.id).toLowerCase()}`,'#5de8b0',true)}
  if(it.id==='print'){if(bagUsed()<R.bagCap){R.prints.push(it.gun);float(it.x,it.y-12,`Print: ${GUNS[it.gun].name}`,'#ffcf4a',true);msg(`A single-use print for the ${GUNS[it.gun].name}. Bank it to forge one without the blueprint.`)}else float(it.x,it.y-28,'Bag full','#ff6688',true)}
}
// A single-use print for a gun of at least PRINTS.minTier.
function dropPrint(x,y){const ids=GUN_IDS.filter(k=>GUNS[k].tier>=JOBS.PRINTS.minTier);R.items.push({kind:'loot',id:'print',gun:pick(ids),x,y})}
function openChest(r){
  r.chest.open=true;sfx('coin');const f=R.map.floor,gm=(1+.3*B('greed'))*R.mods.coin*(CU('toll')?1.6:1)*(R.fmods?R.fmods.coin:1)*(ruleOn(R.tier,'barren')?.5:1),rich=r.chest.rich;
  if(f>=7&&rand()<veinRich(R.tier?'unbound':'underheart','relic')){R.relics++;float(r.chest.x,r.chest.y-50,'An Old Keeper relic!','#fff3a8',true)}
  // In Act II the veins' old camps hold a few relics too, so the Archive's work can start before the Underheart.
  else if(f>=4&&f<=6&&!R.tier&&rand()<LORE.ARCHIVE.relicChestVeins){R.relics++;float(r.chest.x,r.chest.y-50,'An Old Keeper relic!','#fff3a8',true)}
  // The Hollow Choir's chests sometimes hold a memory shard.
  const vein=R.map.plan&&R.map.plan.vein;if(rand()<veinRich(vein,'shards')){S.shards++;float(r.chest.x,r.chest.y-64,'+1 memory shard','#ff8fe0',true)}
  restChest(r);
  if(r.cache){const E=BLOOM.EVENTS.list.cache,c=Math.round(ri(E.coin[0],E.coin[1])*gm);R.bag.coin+=c;for(let k=0;k<E.prints;k++)dropPrint(r.chest.x+(k?40:-40),r.chest.y+40);msg(`An estate cache! ${c} coin and old blueprints.`)}
  const coin=Math.round(ri(15,35)*f*gm*(rich?2:1)),ore=Math.round((ri(1,2)+localFloor(f)-1+(rich?ri(4,8):0)+(f>=4?2:0))*(res('economy',2)?1.5:1)),food=ri(1,3),xm=rand()<.5?'hide':'dust',xn=ri(1,3)+(rich?2:0);R.bag.coin+=coin;
  const go=bagAdd('ore',ore,r.chest.x,r.chest.y),gf=bagAdd('food',food,r.chest.x,r.chest.y),gx=bagAdd(xm,xn,r.chest.x,r.chest.y);
  float(r.chest.x,r.chest.y-20,`+${coin} coin${go?` +${go} ore`:''}${gf?` +${gf} food`:''}${gx?` +${gx} ${matName(xm).toLowerCase()}`:''}`,'#ffcf4a',true);
  if(rand()<JOBS.PRINTS.chest)dropPrint(r.chest.x,r.chest.y+40);
  const gunP=rich?1:r.kind==='lair'?.9:.45;
  if(rand()<.25){R.cages.basic++;float(r.chest.x,r.chest.y-36,'+1 cage','#5de8b0',true)}
  if(rand()<gunP){const g=gunOfTier(Math.min(4,gunTierRoll(f)+(rich?1:0)));R.items.push({kind:'gun',id:g,x:r.chest.x+rnd(-30,30),y:r.chest.y+30});msg(`The chest held a ${GUNS[g].name}. Stand on it and press Use to take it.`)}
  if(rand()<gunP/3*R.mods.buff)R.items.push({kind:'buff',id:pick(BUFF_IDS.filter(k=>k!=='time'||R.mode!=='arena')),x:r.chest.x+rnd(-30,30),y:r.chest.y-30});
}
function objectives(dt){
  const p=R.p,r=R.cur;R.prompt='';R.canUse=false;
  const it=nearestItem();
  if(it){R.canUse=true;const cur=R.guns[R.active];R.prompt=`${TOUCH?'Tap to':'G:'} take ${GUNS[it.id].name}${!R.guns[1]&&R.guns[0]?' into your empty slot':cur?' (drops your '+GUNS[cur].name+')':''}`;return}
  const npc=nearNpc();if(npc){R.canUse=!(npc.kind==='shrine'&&npc.used);R.prompt=npc.kind==='shop'?`${TOUCH?'Tap to':'G:'} trade with the peddler`:npc.used?'The shrine has gone quiet':`${TOUCH?'Tap to':'G:'} pray at the shrine`;return}
  if(R.mode==='arena'||!r)return;
  if(r.kind==='stairs'){
    if(dist(p,{x:r.cx,y:r.cy})<40&&!r.locked){R.stairT+=dt;R.prompt='Descending… '+Math.max(0,1.2-R.stairT).toFixed(1)+'s';if(R.stairT>=1.2)descend(R.map.floor+1)}
    else{R.stairT=0;if(!r.locked)R.prompt=`Stand on the stairs to go down to Floor ${R.map.floor+1}`}
    return;
  }
  if(r.kind==='portal'){
    const home={x:r.cx-80,y:r.cy},deep={x:r.cx+80,y:r.cy};
    if(dist(p,home)<44){R.ext+=dt;R.prompt=`Going home… ${Math.max(0,2-R.ext).toFixed(1)}s`;if(R.ext>=2){endRaid('extract','rift');return}}
    else if(r.deep&&dist(p,deep)<44){const fl=R.map.floor;R.stairT+=dt;R.prompt=`${fl===3?'The veins below':fl===6?'The Underheart below':'The Heart below'}… ${Math.max(0,1.2-R.stairT).toFixed(1)}s`;
      if(R.stairT>=1.2){R.stairT=-2;if(fl===3){const why=gateBlockText('veins');if(why){msg(why);gateBlocked('veins');R.stairT=-4}else openVeinChoice()}else if(fl===6)enterUnderheart();else{const why=gateBlockText('heart',partyCreatures());if(why){msg(why);gateBlocked('heart');R.stairT=-4}else descend(10)}}}
    else{R.ext=0;R.stairT=0;R.prompt=r.deep?`Left circle: home · Right circle: ${R.map.floor===3?'choose a vein':R.map.floor===6?'the Underheart (cut-free creatures only)':'the Heart'}`:'Step into the rift to go home'}
    return;
  }
  if(['gate','rift','cliff'].includes(r.kind)){
    const d=dist(p,{x:r.cx,y:r.cy}),cost=R.map.floor>=4?40:20;
    if(d<52){
      let ok=true,why='';
      if(r.locked){ok=false;why=R.tut?'Finish the lesson first':'Clear the room first'}
      else if(r.kind==='gate'&&R.bag.coin+S.coin<cost){ok=false;why=`The gate costs ${cost} coin`}
      else if(r.kind==='cliff'&&!partyHas('gale')){ok=false;why='The cliff needs a Gale in your party'}
      if(ok){R.ext+=dt;R.prompt=`Extracting… ${Math.max(0,2.5-R.ext).toFixed(1)}s`;if(R.ext>=2.5){if(r.kind==='gate')payCoin(cost);endRaid('extract',r.kind);return}}
      else{R.ext=0;R.prompt=why}
    }else{R.ext=0;if(!r.locked)R.prompt={gate:`Gate extract · ${cost} coin · stand in the circle`,rift:'Rift extract · free · stand in the circle',cliff:'Cliff extract · needs a Gale'}[r.kind]}
  }
}
function descend(f){
  const{boss,M}=genFloor(R.seed,f,false,R.vein,R.tier);R.map=M;R.mapCv=renderMapCanvas(M);R.cur=M.start;placeLore(M);
  R.p.x=M.start.cx;R.p.y=M.start.cy+40;R.trail=[];R.comps.forEach(m=>{if(m){m.x=R.p.x+rnd(-30,30);m.y=R.p.y+rnd(-10,30)}});
  R.enemies=[];R.bullets=[];R.fields=[];R.items=[];R.timers=[];R.stairT=0;R.ext=0;R.heardCrack=false;R.floorsSeen.add(f);sfx('door');
  S.progress.deepest=Math.max(S.progress.deepest||0,f);
  if(f===4){R.time+=360;R.kxp+=60}
  if(f===7&&!R.tier){R.time+=ENDGAME.UNDERHEART.timeAdd;R.kxp+=ENDGAME.UNDERHEART.kxp}
  R.hazards=[];R.drownWarned=false;
  const roost5=secTier('roost')>=5&&boss?` ${BOSSES[boss].name} waits below.`:'';
  msg(`${floorStart()}${f===4?' Everything here hits much harder. +6 minutes on the clock.':isBossFloor(f)?` A boss guards the end of this floor.${roost5}`:''}`);
}

/* ---------- end of raid ---------- */
function restoreSaved(){R.comps.forEach(m=>{if(m&&R.saved[m.c.id]!=null)m.c.hp=R.saved[m.c.id]});if(R.slot3&&R.saved[R.slot3.c.id]!=null)R.slot3.c.hp=R.saved[R.slot3.c.id]}
function endRaid(outcome,via){
  if(!R||R.over)return;
  R.over=true;stopLoop();
  keys.clear();touch.move=touch.aim=null;
  if(R.mode==='arena'){
    restoreSaved();let kept='';
    const caught=[R.slot3&&R.slot3.c,...R.comps.map(m=>m&&m.c)].filter(c=>c&&c.captureRaid==='arena');
    caught.forEach(c=>{c.captureRaid=S.stats.raids;if(S.settings.keepArena){S.creatures.push(c);kept+=c.name+' '}});
    exitRaid();
    openModal(`<h2 class="res-title">Left the arena</h2><p class="hint">Your creatures are back at their pre-arena health.${kept?' Kept: '+esc(kept)+'(unproven).':''}</p><div class="row"><button class="btn primary" data-act="close">Back to the lab</button></div>`);
    save();return;
  }
  if(R.mode==='tutorial'){
    restoreSaved();
    const caught=[R.slot3&&R.slot3.c,...R.comps.map(m=>m&&m.c)].filter(c=>c&&c.captureRaid==='tutorial');
    let html;
    if(outcome==='extract'){
      caught.forEach(c=>{c.captureRaid=S.stats.raids-1;c.proven=true;S.creatures.push(c);S.stats.captures++;logEvent(c,'caught','the tutorial floor')});
      const first=!S.tutorialDone;S.tutorialDone=true;if(first){S.coin+=100;S.cages.basic+=2}
      addLog('Tutorial complete.'+(caught.length?` ${caught[0].name} joined the hideout.`:''));if(first)tutorialDone();
      html=`<h2 class="res-title win">Tutorial complete</h2><p>You extracted safely.${caught.length?` <b>${esc(caught[0].name)}</b> the Cindlet is yours now, already proven.`:''}</p>${first?'<p class="status">Reward: 100 coin and 2 cages.</p>':''}
        <ul class="plain"><li>Real raids go 3 floors deep, with a boss on Floor 3.</li><li>Anything you bring is lost if you fall, unless the Vault saves it.</li><li>Keeper XP comes from every raid, so even losses move you forward.</li><li>Visit the Hideout to meet Brannoc, and check Ilsa's journal in the Codex.</li></ul>`;
    }else html=`<h2 class="res-title">Tutorial ended</h2><p class="hint">Nothing was lost. You can replay it from the Raid tab or Settings.</p>`;
    exitRaid();openModal(html+`<div class="row"><button class="btn primary" data-act="close">To the hideout</button></div>`);save();return;
  }
  const L={home:[],lost:[],caught:[],proven:[],levels:[],loot:[],notes:[],keeper:[],bond:[],titles:[]};
  R.comps.forEach(m=>{if(m)m.c.hp=m.downed?0:Math.round(m.hp/m.maxHp*stats(m.c).hp)});
  const party=R.comps.filter(Boolean);
  const scav=R.mode==='scav',vt=scav?0:secTier('vault'),at=scav?0:armoryTier();
  const isNew=c=>!S.creatures.includes(c),caughtC=[];
  // Guns in hand at the end: [id, owned item or null for a find].
  const held=[0,1].filter(i=>R.guns[i]&&R.guns[i]!=='pistol').map(i=>[R.guns[i],R.gunItem[i]]);
  const takenHome=it=>held.some(([,x])=>x===it);
  const wear=it=>{it.dur=Math.max(0,it.dur-JOBS.DURABILITY.perRaid);if(!it.dur)L.notes.push(`Your ${itemName(it)} broke. Repair it in the Workshop.`)};
  const bringHome=([id,it])=>{if(it){wear(it);return it}const f=foundGun(id);bump('weaponsHome');if(!S.blueprints[id]){S.blueprints[id]=1;L.notes.push(`New blueprint: ${GUNS[id].name}.`)}return f};
  const loseItem=it=>{scrapItem(it)};
  const satchel=R.satchel||null;
  const deepest=Math.max(...R.floorsSeen);S.progress.deepest=Math.max(S.progress.deepest||0,deepest);
  const fell=`Fell on Floor ${R.map.floor}`;
  if(outcome==='extract'){
    S.stats.extracts++;
    const coinMul=1+.15*party.filter(m=>!m.downed&&m.c.traits.includes('hoard')).length;
    const coin=Math.round(R.bag.coin*coinMul*(1+perk('coin'))),food=R.bag.food+(R.sup.has('fungal')?2:0);
    S.coin+=coin;S.ore+=R.bag.ore;S.food+=food;give('hide',R.bag.hide);give('dust',R.bag.dust);give('sap',R.bag.sap||0);S.prints.push(...R.prints);give('tonic',R.tonics);
    const home=held.map(bringHome);
    S.cages.basic+=scav?0:R.cages.basic;S.cages.gilded+=R.cages.gilded;
    L.loot.push(`+${coin} coin`,`+${R.bag.ore} ore`,`+${food} food`);if(R.bag.hide)L.loot.push(`+${R.bag.hide} hide`);if(R.bag.dust)L.loot.push(`+${R.bag.dust} crystal dust`);if(R.bag.sap)L.loot.push(`+${R.bag.sap} bog sap`);
    R.prints.forEach(id=>L.loot.push(`Print: ${GUNS[id].name}`));if(R.tonics)L.loot.push(`${R.tonics} unused tonic${R.tonics>1?'s':''} back to stores`);
    home.forEach(it=>L.loot.push(`${itemName(it)}${R.taken.includes(it)?'':' (new)'}`));
    R.taken.forEach(it=>{if(!takenHome(it)){L.lost.push(`${itemName(it)} (left in the dungeon)`);loseItem(it)}});
    if(satchel)wear(satchel);
    const handle=(c,downed,xp,m)=>{
      if(downed){if(isNew(c))L.lost.push(`${c.name} (new catch, never revived)`);else{L.lost.push(`${c.name} (never revived)`);killCreature(c,fell)}return}
      if(isNew(c)){S.creatures.push(c);S.stats.captures++;caughtC.push(c);L.caught.push(`${c.name}, a wild ${sexSym(c.sex)} ${formName(c)} (Lv ${c.level})`);return}
      c.raids++;const ups=gainXp(c,xp);if(ups)L.levels.push(`${c.name} reached Lv ${c.level}${canEvolve(c)?' and can evolve':''}`);
      if(addBond(c,m?20+Math.round((m.kills||0)/2):10))L.bond.push(`${c.name} reached ${bondStar(c)}★ bond${bondStar(c)===3?': '+BOND_PASSIVE[c.type].name+' unlocked':bondStar(c)===5?': Last Stand unlocked':''}`);
      if(!c.proven&&c.captureRaid>=0&&c.captureRaid<R.id){c.proven=true;L.proven.push(`${c.name} is proven. Traits: ${c.traits.map(t=>TRAITS[t].name).join(', ')}`)}
      L.home.push(c.name);
    };
    party.forEach(m=>handle(m.c,m.downed,25+m.xpGain,m));
    if(R.slot3)handle(R.slot3.c,false,10+party.reduce((a,m)=>a+m.xpGain,0)/4,null);
    R.kxp+=40;
    const cp=caravanPay();if(cp){S.coin+=cp;L.loot.push(`+${cp} coin for seeing the trader home`)}
    if(R.relics){S.archive.unread+=R.relics;L.loot.push(`${R.relics} Old Keeper relic${R.relics>1?'s':''} for the Archive`)}
    if(R.tier&&R.tierBoss&&clearTier(R.tier))L.notes.push(`Unbound tier ${R.tier} cleared!${R.tier<ENDGAME.UNBOUND.tiers?` Tier ${R.tier+1} adds ${ENDGAME.UNBOUND.rules[R.tier].name}: ${ENDGAME.UNBOUND.rules[R.tier].desc}`:''}`);
    // Pride: titles, friendships between creatures that came home together, and a boss's trophy.
    L.titles=extractTitles(party.map(m=>({c:m.c,downed:m.downed})),!!R.bossDown);
    recordShared([...party.filter(m=>!m.downed).map(m=>m.c),R.slot3&&R.slot3.c].filter(c=>c&&S.creatures.includes(c)).map(c=>c.id));
    if(R.bossId&&awardBossTrophy(R.bossId,party.filter(m=>!m.downed).map(m=>m.c.name),R.map.floor))L.notes.push(`The ${BOSSES[R.bossId].name} trophy comes home with you. Place it in the Hideout.`);
  }else{
    S.stats.deaths++;
    L.notes.push(outcome==='collapse'?'The dungeon collapsed around you.':'You were knocked out.');
    party.forEach((m,i)=>{
      if(i===0&&vt>=4&&!isNew(m.c)){L.home.push(`${m.c.name} (Vault guardian)`);gainXp(m.c,m.xpGain);return}
      if(isNew(m.c))L.lost.push(`${m.c.name} (new catch)`);else{L.lost.push(m.c.name);killCreature(m.c,fell)}});
    if(R.slot3){
      const c=R.slot3.c;
      if(vt>=1){if(isNew(c)){S.creatures.push(c);S.stats.captures++;L.caught.push(`${c.name} (saved by the Vault)`)}else L.home.push(`${c.name} (saved by the Vault)`)}
      else{if(isNew(c))L.lost.push(`${c.name} (new catch)`);else{L.lost.push(c.name);killCreature(c,fell)}}
    }
    const keepG=vt>=2?held:(at>=4&&R.guns[0]&&R.guns[0]!=='pistol'?[[R.guns[0],R.gunItem[0]]]:[]);
    keepG.forEach(h=>{const it=bringHome(h);L.home.push(`${itemName(it)} (saved)`)});
    held.filter(h=>!keepG.includes(h)).forEach(([id,it])=>{L.lost.push(it?itemName(it):GUNS[id].name);if(it)loseItem(it)});
    R.taken.forEach(it=>{if(!held.some(([,x])=>x===it)){L.lost.push(itemName(it));loseItem(it)}});
    if(satchel){L.lost.push(itemName(satchel));loseItem(satchel)}
    const keepCoin=Math.round(R.bag.coin*(vt>=5?.6:vt>=3?.3:0)),keepOre=vt>=5?R.bag.ore:0;
    const keepMats=vt>=5;if(keepMats){give('hide',R.bag.hide);give('dust',R.bag.dust);give('sap',R.bag.sap||0)}
    if(keepCoin||keepOre){S.coin+=keepCoin;S.ore+=keepOre;L.home.push(`Vault saved ${keepCoin} coin${keepOre?', '+keepOre+' ore, '+R.bag.hide+' hide and '+R.bag.dust+' crystal dust':''}`)}
    const lostLoot=[R.bag.coin-keepCoin&&(R.bag.coin-keepCoin)+' coin',R.bag.ore-keepOre&&(R.bag.ore-keepOre)+' ore',R.bag.food&&R.bag.food+' food',!keepMats&&R.bag.hide&&R.bag.hide+' hide',!keepMats&&R.bag.dust&&R.bag.dust+' crystal dust',...R.prints.map(id=>'print: '+GUNS[id].name),R.tonics&&R.tonics+' tonics'].filter(Boolean);
    if(lostLoot.length)L.lost.push('Backpack: '+lostLoot.join(', '));
    const cg=scav?0:R.cages.basic+R.cages.gilded;if(cg)L.lost.push(`${cg} cage${cg>1?'s':''}`);
  }
  validGuns();
  // Other systems settle their part of the raid (journal pages, the Deepening, contracts) and add notes.
  const report=emit('raid:end',{outcome,via,mode:R.mode,scav,extracted:outcome==='extract',floor:R.map.floor,vein:R.map.plan&&R.map.plan.vein,deepest,boss:R.bossDown?R.bossDown.name:null,
    party:[...party.map(m=>({c:m.c,downed:m.downed,kills:m.kills||0,hpFrac:m.hp/m.maxHp})),...(R.slot3?[{c:R.slot3.c,downed:false,kills:0,hpFrac:null}]:[])],kills:R.kills,eliteKills:R.eliteKills||0,bag:R.bag,caught:caughtC,deepening:R.deepening,notes:L.notes});
  // Catch-up: a Keeper well behind the expected rank for their calendar day earns double.
  const kx=Math.round((R.kxp+deepest*25)*R.mods.kxp*(scav?.5:1)*(1+perk('kxp'))*(R.fmods?R.fmods.kxp:1)*catchupMul());
  L.keeper=addKeeperXp(kx);
  const title=outcome==='extract'?(R.bossDown?`Champion over ${R.bossDown.name}`:via==='gate'?'Extracted through the gate':via==='cliff'?'Leapt from the cliff':'Escaped through the rift'):(outcome==='collapse'?'Buried in the collapse':'Lost in the dungeon');
  addLog(`${scav?'Scav run':'Raid'}: ${title.toLowerCase()} on floor ${R.map.floor}.`+(L.caught.length?' Caught '+L.caught.length+'.':'')+(L.lost.length&&outcome!=='extract'?' Lost: '+L.lost.join(', ')+'.':''));
  report.day=S.day;report.rank=S.keeper.level;
  passDay();save();exitRaid();emit('raid:done',report);
  sfx(outcome==='extract'?'level':'fail');
  const sec=(h,arr,col)=>arr.length?`<div class="rsec"><h3 ${col?`style="color:${col}"`:''}>${h}</h3><ul class="plain">${arr.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:'';
  const quests=NPC_IDS.filter(id=>{const q=npcQuest(id);return q&&q.done}).map(id=>`${NPCS[id].name} has a reward waiting.`);
  openModal(`<h2 class="res-title ${outcome==='extract'?'win':'lose'}">${title}</h2>${L.notes.map(n=>`<p>${esc(n)}</p>`).join('')}
    <div class="slot"><div class="slot-label">Keeper XP</div><p><b style="font-family:var(--display);color:var(--gold)">+${kx}</b> · rank ${S.keeper.level} (${S.keeper.xp}/${keeperNeed()}) · ${R.kills} defeated · deepest floor ${deepest}</p>${L.keeper.map(k=>`<p class="status" style="color:var(--gold)">${esc(k)}</p>`).join('')}</div>
    <div class="report">${sec('Caught',L.caught,'var(--gold)')}${sec('Proven',L.proven,'var(--mint)')}${sec('Came home',L.home)}${sec('Level ups',L.levels)}${sec('Bond',L.bond,'var(--sky)')}${sec('Titles',L.titles,'var(--gold)')}${sec('Loot banked',L.loot)}${sec('Lost',L.lost,'var(--rose)')}${sec('Quests',quests,'var(--gold)')}</div>
    <p class="status">Day ${S.day} begins. ${esc(S.log[0].msg)}</p>
    <div class="row"><button class="btn primary" data-act="close">Back to the hideout</button></div>`,true);
}
function exitRaid(){
  $('#raid').hidden=true;$('#app').hidden=false;lockPage(false);
  ui.tab=R&&R.mode==='arena'?'lab':R&&R.mode==='tutorial'?'hideout':'raid';
  const done=R;renderAll();
  setTimeout(()=>{if(R===done){R=null;if(ui.tab==='hideout')startHideoutMap()}},0);
}

export {partyCreatures,stickInset,wildEnemy,canRelease,releaseCreature,TS,RW,RH,CW,CH,R,bagUsed,bagAdd,roleInParty,keys,touch,localFloor,isBossFloor,capT,isWeak,rollWildSpecies,newRoom,genMap,genTutorialMap,buildMap,solidAt,hitsWall,moveEnt,roomAt,PALS,paintTile,renderMapCanvas,damageCrack,makeComp,pickBoss,genFloor,startRaid,applyOpts,stickR,stickBases,B,CU,refreshSupport,applyBuff,applyCurse,msg,float,partyHas,partyTrait,bondComp,capRadius,playerDmgMul,modOn,spawnPos,baseEnemy,hpMods,spawnWild,spawnFoe,spawnBoss,enterRoom,pullComps,buildArenaPanel,applyElem,react,hurtEnemy,hurtPlayer,hurtComp,healPlayer,playerDown,shoot,critMul,nearestEnemy,pickTarget,explodeAt,crackHitArea,later,roomFoes,compAtk,doAbility,useAbility,comboReady,useCombo,doRoll,cageReady,useCage,swapSlot3,switchGun,tryCapture,nearestItem,nearNpc,interact,gunTierRoll,gunOfTier,payCoin,openShop,buy,openShrine,moveVec,swing,fireWeapon,TUT,tutEnter,tutUpdate,update,updFields,compAttack,updComp,updEnemy,release,ringShot,fanShot,pattern,bossAttack,updBoss,onBossDeath,updBullets,onEnemyDeath,takeLoot,openChest,objectives,descend,restoreSaved,endRaid,exitRaid};
