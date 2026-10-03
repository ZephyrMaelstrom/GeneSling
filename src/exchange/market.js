/* ================= The Exchange in the game =================
   Glue between the save and the market. Every player action follows the same pattern:
     1. escrow: take the coin or goods out of the save right away (so they can't be spent twice),
     2. send the operation to the market (worker or in-thread),
     3. apply the events that come back: fills, refunds, auction wins and sales, bounty pay,
     4. keep the market's state in S.market and save.
   The market moves one day for every hideout day (processDay calls marketDay). If the page
   closed before a day reached the market, the next load catches it up. */
import {connect} from './client.js';
import {EXCHANGE as X,appraise} from './engine.js';
import {S,makeCreature,recordLineage,unplace,addLog,addKeeperXp,byId,whereIs} from '../state.js';
import {amt,give,newItem,scrapItem,expAway} from '../jobs.js';
import {save} from '../save.js';
import {SPECIES} from '../content.js';
import {on} from '../events.js';

let client=null,ready=null,mview=null;const listeners=new Set();
const onMarket=f=>{listeners.add(f);return()=>listeners.delete(f)};
const marketView=()=>mview;

/* ---------- stock: commodities live in the save's stores, cages on S.cages ---------- */
function stock(g){return g==='cage'?S.cages.basic:g==='gilded'?S.cages.gilded:amt(g)}
function addStock(g,n){if(g==='cage')S.cages.basic+=n;else if(g==='gilded')S.cages.gilded+=n;else give(g,n)}

/* ---------- connection ---------- */
async function send(op,args){
  const out=await client.send({op,args});
  S.market=out.state;mview=out.view;
  return out;
}
function startMarket(prefer){
  client=connect(prefer);
  const seed=(S.marketSeed=S.marketSeed||((S.nextId*2654435761)>>>0)||1);
  ready=send('init',{state:S.market||null,seed}).then(async()=>{
    if(S.marketSync==null)S.marketSync=S.day;
    // Catch up days the market missed (the page closed before the day reached it).
    let n=0;while(S.marketSync<S.day&&n++<30){await advanceOne()}
    S.marketSync=S.day;save();listeners.forEach(f=>f());
  }).catch(e=>{console.warn('GeneSling: the Exchange failed to start.',e)});
  return ready;
}
const marketReady=()=>ready||Promise.resolve();
const transportKind=()=>client?client.kind:null;

/* ---------- applying what the market sends back ---------- */
function materialize(item){
  if(item.kind==='gun'){const it=newItem('gun',item.id,item.q||0,{src:item.src||'found',dur:item.dur,maker:item.maker||null,fore:item.fore||null});return it.uid}
  if(item.kind==='print'){S.prints.push(item.id);return null}
  const fromPayload=c=>{
    const o={genome:c.genome,gen:c.gen||0,sex:c.sex,pers:c.pers,name:c.name,proven:true,pure:c.pure||1,stage:c.stage||0,type:c.type,type2:c.type2,bondXp:c.bondXp||0};
    const n=makeCreature(c.species,c.origin==='wild'?'wild':'bred',c.level||1,o);
    // A creature coming back from your own listing keeps its history.
    if(c.id!=null&&!byId(c.id)&&c.raids!=null){Object.assign(n,{id:c.id,raids:c.raids,xp:c.xp,bondXp:c.bondXp,mom:c.mom,dad:c.dad,fat:c.fat||0,captureRaid:c.captureRaid})}
    if(c.by)n.by=c.by;if(c.titles)n.titles=c.titles.slice();
    recordLineage(n);return n;
  };
  if(item.kind==='egg'){const ch=fromPayload(item.child);S.eggs.push({id:ch.id,days:item.days||2,child:ch,cols:[SPECIES[ch.species].col,'#ffcf4a'],parents:'the Exchange',hybrid:!!ch.type2});return ch.id}
  const c=fromPayload(item.c);S.creatures.push(c);return c.id;
}
function apply(ev){
  const notes=[];
  for(const e of ev||[]){
    if(e.coin)S.coin=Math.round((S.coin+e.coin)*100)/100;
    if(e.type==='fill'){if(e.side==='buy')addStock(e.good,e.qty);notes.push(`${e.side==='buy'?'Bought':'Sold'} ${e.qty} ${e.good} at ${e.price}`);addKeeperXp(X.KEEPER_XP.sale)}
    if(e.type==='refund'&&e.good)addStock(e.good,e.qty);
    if(e.type==='won'){materialize(e.item);notes.push(`Won ${e.label} for ${Math.round(e.price)} coin`)}
    if(e.type==='returned'){materialize(e.item);notes.push(`${e.label} didn’t sell and came back`)}
    if(e.type==='sold')notes.push(`${e.label} sold for ${Math.round(e.price)} coin`);
    if(e.type==='outbid')notes.push(`Outbid on ${e.label}`);
    if(e.type==='bounty'){notes.push(`Bounty paid: ${e.coin} coin`);addKeeperXp(X.KEEPER_XP.bounty)}
  }
  S.coin=Math.round(S.coin);
  if(notes.length)addLog('Exchange: '+notes.join('. ')+'.');
  return notes;
}
// undo() puts back what was escrowed if the market refuses the operation outright
// (when it refuses with its own refund events, those are applied instead).
async function run(op,args,undo){
  await marketReady();
  const out=await send(op,args);
  if(!out.res.ok&&undo&&!(out.res.ev||[]).some(e=>e.type==='refund'))undo();
  apply(out.res.ev);save();listeners.forEach(f=>f());
  return out.res;
}

/* ---------- player actions ---------- */
const fee=v=>Math.ceil(v*X.FEES.post);
// Buy now, paying at most `limit` a unit. Escrow covers the worst case; the rest comes back.
async function buyNow(good,qty,limit){
  const hold=Math.ceil(limit*qty);if(S.coin<hold+fee(hold))return{ok:false,why:'Not enough coin'};
  S.coin-=hold;return run('marketOrder',{good,side:'buy',qty,limit},()=>{S.coin+=hold});
}
async function sellNow(good,qty,limit){
  if(stock(good)<qty)return{ok:false,why:'Not enough in stores'};
  if(S.coin<fee(qty*limit))return{ok:false,why:'Not enough coin for the fee'};
  addStock(good,-qty);return run('marketOrder',{good,side:'sell',qty,limit},()=>addStock(good,qty));
}
// A resting limit order. The posting fee is paid now.
async function postOrder(good,side,price,qty){
  const value=price*qty;
  if(side==='buy'){if(S.coin<value+fee(value))return{ok:false,why:'Not enough coin'};S.coin-=value}
  else{if(stock(good)<qty)return{ok:false,why:'Not enough in stores'};if(S.coin<fee(value))return{ok:false,why:'Not enough coin for the fee'};addStock(good,-qty)}
  return run('postOrder',{good,side,price,qty},()=>{if(side==='buy')S.coin+=value;else addStock(good,qty)});
}
const cancelOrder=id=>run('cancelOrder',{id});
// Listing a creature, egg, weapon or print. The thing leaves the save until it sells or returns.
async function listItem(kind,ref,start,buyout){
  let item=null;
  if(kind==='creature'){const c=byId(ref);if(!c||expAway(c))return{ok:false,why:'Unavailable'};unplace(c);S.creatures=S.creatures.filter(x=>x!==c);item={kind,c:structuredClone(c)}}
  if(kind==='egg'){const e=S.eggs.find(x=>x.id===ref);if(!e)return{ok:false};S.eggs=S.eggs.filter(x=>x!==e);item={kind,child:structuredClone(e.child),days:e.days}}
  if(kind==='gun'){const it=S.items.find(i=>i.uid===ref&&i.kind==='gun');if(!it)return{ok:false};scrapItem(it);item={kind,id:it.id,q:it.q,dur:it.dur,max:it.max,maker:it.maker,fore:it.fore,src:it.src}}
  if(kind==='print'){const i=S.prints.indexOf(ref);if(i<0)return{ok:false};S.prints.splice(i,1);item={kind,id:ref}}
  if(!item)return{ok:false};
  return run('listAuction',{item,start,buyout:buyout||null},()=>materialize(item));
}
async function bid(id,max){if(S.coin<max)return{ok:false,why:'Not enough coin'};S.coin-=max;return run('bid',{id,max})}
async function buyout(id){
  const a=mview&&mview.auctions.find(x=>x.id===id);if(!a||!a.buyout)return{ok:false};
  if(S.coin<a.buyout)return{ok:false,why:'Not enough coin'};S.coin-=a.buyout;return run('buyout',{id},()=>{S.coin+=a.buyout});
}
// Hands a creature to a bounty. It leaves the save only if the bounty accepts it.
async function fulfilBounty(id,cid){
  const c=byId(cid);if(!c||expAway(c))return{ok:false};
  const res=await run('fulfilBounty',{id,c:structuredClone(c)});
  if(res.ok){unplace(c);S.creatures=S.creatures.filter(x=>x!==c);addLog(`${c.name} went to a bounty hunter’s client.`);save();listeners.forEach(f=>f())}
  return res;
}
// One market day, called after each hideout day.
async function advanceOne(){const out=await send('advance',{});apply(out.res.ev);S.marketSync=(S.marketSync||0)+1}
function marketDay(){
  if(!client)return Promise.resolve();
  ready=marketReady().then(async()=>{while(S.marketSync<S.day)await advanceOne();save();listeners.forEach(f=>f())});
  return ready;
}
// Each day that passes in the real game moves the market on (the hideout's day advances first).
on('day:passed',()=>{marketDay()},{order:20});
// The appraised value of something you own, to suggest listing prices.
function appraiseOwn(kind,ref){
  if(kind==='creature'){const c=byId(ref);return c?appraise({kind,c}):0}
  if(kind==='egg'){const e=S.eggs.find(x=>x.id===ref);return e?appraise({kind,child:e.child}):0}
  if(kind==='gun'){const it=S.items.find(i=>i.uid===ref);return it?appraise({kind,id:it.id,q:it.q}):0}
  if(kind==='print')return appraise({kind,id:ref});
  return 0;
}
const canList=c=>whereIs(c).kind!=='expedition';

export {startMarket,marketReady,marketView,onMarket,transportKind,stock,addStock,buyNow,sellNow,postOrder,cancelOrder,listItem,bid,buyout,fulfilBounty,marketDay,appraiseOwn,canList,apply,materialize};
