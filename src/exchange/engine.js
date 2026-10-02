/* ================= The Exchange: market engine =================
   A pure market. Every function takes the market state `st` (plain JSON, saved with the game)
   and returns events; nothing here touches the DOM or the player's save. The same functions run
   in a Web Worker for the game, in-thread for tests and the Economy Sandbox, and could run on a
   server later: the client only ever sends the operations listed in `OPS` at the bottom.

   What it models (numbers in src/data/exchange.json):
     - Commodities trade on an order book per good. Orders that cross fill at the resting
       order's price. Posting costs FEES.post, and every sale pays FEES.tax; both leave the game.
     - Unique goods (creatures, eggs, weapons, prints) sell by auction with an optional buyout.
     - Bounties: breeders and collectors post standing requests for genetics.
     - About 60 traders in six archetypes produce, consume, die, earn income and pay upkeep.
       Each holds a belief about what every good is worth, nudged by every trade it makes or
       misses, and that belief sets its bids and asks.
     - Shocks (cave-ins, migrations, estate sales, harvests), a news feed, and price history.
   The player is owner 'P'. The client removes goods or coin from the save before calling
   (escrow); the engine hands them back through events: fill, refund, won, sold, returned. */
import X from '../data/exchange.json';
import {SPECIES,BASE_SPECIES,TYPES,GUNS,GUN_IDS,TYPE_IDS,PERS_IDS} from '../content.js';
import {rollGenome,express,STAT_LOCI,GRADE_LOCI,hasPedigree} from '../genetics.js';

const GOODS=Object.keys(X.COMMODITIES),CATS=Object.keys(X.UNIQUES);
const REF=g=>X.COMMODITIES[g]?X.COMMODITIES[g].ref:X.UNIQUES[g].ref;

/* ---------- randomness kept in the state (so a saved market replays exactly) ---------- */
function rnd(st){st.rng=(st.rng+0x6D2B79F5)|0;let t=Math.imul(st.rng^(st.rng>>>15),1|st.rng);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296}
const rint=(st,[a,b])=>a+Math.floor(rnd(st)*(b-a+1));
const rfloat=(st,[a,b])=>a+rnd(st)*(b-a);
const rpick=(st,a)=>a[Math.floor(rnd(st)*a.length)];
const R=st=>()=>rnd(st);
const round=v=>Math.round(v*100)/100;
const nid=st=>st.nextId++;

/* ---------- appraisal: what a unique good is "worth" before the market has its say ---------- */
function appraise(item){
  if(item.kind==='gun'){const t=GUNS[item.id].tier;return[0,90,150,240,380][t]*[0.7,1,1.3,1.7,2.4][item.q||0]}
  if(item.kind==='print')return[0,80,120,180,260][GUNS[item.id].tier];
  const c=item.kind==='egg'?item.child:item.c;
  const tier=Math.max(...[c.type,c.type2].filter(Boolean).map(t=>TYPES[t].tier));
  const avg=STAT_LOCI.reduce((a,k)=>a+c.genes[k],0)/STAT_LOCI.length;
  let v=[0,120,180,260,360][tier]*Math.pow(avg/6,1.5)*(1+.15*(c.gen||0))*(c.gen>=3?1.3:1)*[1,3,5][c.looks.shine]*(hasPedigree(c)?1.5:1)*(c.type2?1.6:1);
  return item.kind==='egg'?v*.6:v;
}
const isRare=item=>{const c=item.kind==='egg'?item.child:item.c;return!!c&&(c.looks.shine>0||c.gen>=3||hasPedigree(c)||!!c.type2)};

/* ---------- making goods ---------- */
const NAMES=['Asha','Bram','Corin','Dela','Eskel','Fen','Gilda','Hob','Ines','Jory','Kael','Lio','Mira','Nell','Oswin','Pell','Quill','Rook','Sable','Tamsin','Ulric','Vera','Wren','Yara','Zeb'];
function makeCreaturePayload(st,o={}){
  const species=o.species||rpick(st,BASE_SPECIES.filter(k=>!o.type||SPECIES[k].type===o.type));
  const gen=o.gen||0,G=rollGenome(R(st),'wild',o.floor||rint(st,[2,6]));
  // Bred stock is better: each generation of selection lifts every grade by one, up to 10.
  if(gen)for(const k of GRADE_LOCI)G[k]=G[k].map(v=>Math.min(10,v+gen-1));
  const c={species,type:SPECIES[species].type,type2:null,stage:0,gen,pure:gen?Math.min(gen+1,rint(st,[1,gen+1])):1,genome:G,
    sex:rnd(st)<.5?'F':'M',pers:rpick(st,PERS_IDS),level:o.level||rint(st,[3,14]),name:rpick(st,NAMES)+['ling','wick','ra','o','ett','us'][rint(st,[0,5])],
    origin:gen?'bred':'wild'};
  express(c);return c;
}
function makeItem(st,cat,o={}){
  if(cat==='creature')return{kind:'creature',c:makeCreaturePayload(st,o)};
  if(cat==='egg')return{kind:'egg',child:makeCreaturePayload(st,{...o,level:1,gen:o.gen||rint(st,[1,4])}),days:2};
  if(cat==='gun'){const id=rpick(st,GUN_IDS.filter(k=>GUNS[k].tier>=1));const r=rnd(st);return{kind:'gun',id,q:r<.45?0:r<.8?1:r<.95?2:r<.99?3:4}}
  return{kind:'print',id:rpick(st,GUN_IDS.filter(k=>GUNS[k].tier>=2))};
}
const itemLabel=it=>it.kind==='gun'?GUNS[it.id].name:it.kind==='print'?`Print: ${GUNS[it.id].name}`:it.kind==='egg'?`Egg (${SPECIES[it.child.species].name})`:`${it.c.name}, ${SPECIES[it.c.species].name}`;

/* ---------- market creation ---------- */
function createMarket(seed=1){
  const st={v:1,day:0,rng:seed|0,nextId:1,traders:[],books:{},auctions:[],bounties:[],news:[],hist:{},uhist:{},last:{},shocks:[],
    flows:{fees:0,tax:0,upkeep:0,income:0,exported:0},daily:[]};
  for(const g of GOODS){st.books[g]={bids:[],asks:[]};st.hist[g]=[];st.last[g]=REF(g)}
  for(const c of CATS)st.uhist[c]=[];
  for(const [arch,A] of Object.entries(X.ARCHETYPES))for(let i=0;i<A.count;i++){
    const t={id:'t'+nid(st),name:`${rpick(st,NAMES)} the ${A.name.toLowerCase()}`,arch,coin:rint(st,A.coin),inv:{},belief:{},ubelief:{},want:{}};t.start=t.coin;
    for(const g of GOODS)t.belief[g]=REF(g)*rfloat(st,[.85,1.15]);
    for(const c of CATS)t.ubelief[c]=rfloat(st,[.85,1.15]);
    st.traders.push(t);
  }
  news(st,'The Exchange opens. Traders from across the Rootworks set up their stalls.','open');
  // Warm up so prices, beliefs and stock settle before the player arrives.
  for(let i=0;i<X.WARMUP_DAYS;i++)dayStep(st);
  st.flows={fees:0,tax:0,upkeep:0,income:0,exported:0};
  return st;
}
const trader=(st,id)=>st.traders.find(t=>t.id===id);
function news(st,text,kind='info'){st.news.unshift({day:st.day,text,kind});st.news=st.news.slice(0,40)}

/* ---------- order book ---------- */
const sortBook=b=>{b.bids.sort((x,y)=>y.price-x.price||x.id-y.id);b.asks.sort((x,y)=>x.price-y.price||x.id-y.id)};
// Adds an order. Player orders pay the posting fee now; traders pay it when they fill (they
// reprice every day, so charging them per posting would just burn coin).
function addOrder(st,o,ev){
  const order={id:nid(st),owner:o.owner,good:o.good,side:o.side,price:round(Math.max(.01,o.price)),qty:Math.floor(o.qty),day:st.day,gtc:o.owner==='P'};
  if(order.qty<=0)return null;
  if(o.owner==='P'){const fee=round(order.price*order.qty*X.FEES.post);st.flows.fees+=fee;ev&&ev.push({type:'fee',coin:-fee})}
  st.books[o.good][o.side==='buy'?'bids':'asks'].push(order);
  return order;
}
// Moves goods and coin for one trade. Buyer pays `price` per unit; the seller keeps it less tax.
function settle(st,good,buyer,seller,qty,price,buyPrice,ev){
  const gross=round(price*qty),tax=round(gross*X.FEES.tax),traderFee=o=>o!=='P'?round(gross*X.FEES.post):0;
  st.flows.tax+=tax;
  const fb=traderFee(buyer),fs=traderFee(seller);st.flows.fees+=fb+fs;
  if(buyer==='P'){ev.push({type:'fill',side:'buy',good,qty,price,coin:round((buyPrice-price)*qty)})}
  else{const t=trader(st,buyer);t.coin-=gross+fb;t.inv[good]=(t.inv[good]||0)+qty}
  if(seller==='P'){ev.push({type:'fill',side:'sell',good,qty,price,coin:round(gross-tax)})}
  else{const t=trader(st,seller);t.coin+=gross-tax-fs;t.inv[good]=(t.inv[good]||0)-qty}
  st.tradesToday.push({good,qty,price});
}
// Can this order still be honoured? (Traders may have spent the coin or used the goods.)
function alive(st,o){
  if(o.qty<=0)return false;if(o.owner==='P')return true;
  const t=trader(st,o.owner);if(!t)return false;
  if(o.side==='buy')return t.coin>=o.price*(1+X.FEES.post);
  return(t.inv[o.good]||0)>=1;
}
function match(st,good,ev){
  const b=st.books[good];sortBook(b);
  for(;;){
    b.bids=b.bids.filter(o=>alive(st,o));b.asks=b.asks.filter(o=>alive(st,o));
    const bid=b.bids[0],ask=b.asks[0];if(!bid||!ask||bid.price<ask.price)break;
    if(bid.owner===ask.owner){(bid.id>ask.id?b.bids:b.asks).shift();continue}
    let qty=Math.min(bid.qty,ask.qty);
    if(ask.owner!=='P')qty=Math.min(qty,trader(st,ask.owner).inv[good]||0);
    const price=bid.id<ask.id?bid.price:ask.price;
    if(bid.owner!=='P')qty=Math.min(qty,Math.floor(trader(st,bid.owner).coin/(price*(1+X.FEES.post))));
    if(qty<=0){(bid.owner!=='P'&&trader(st,bid.owner).coin<price?b.bids:b.asks).shift();continue}
    settle(st,good,bid.owner,ask.owner,qty,price,bid.price,ev);
    bid.qty-=qty;ask.qty-=qty;bid.filled=(bid.filled||0)+qty;ask.filled=(ask.filled||0)+qty;
    learn(st,bid.owner,good,price,true);learn(st,ask.owner,good,price,true);
  }
}
function learn(st,owner,good,price,filled,side){
  if(owner==='P')return;const t=trader(st,owner);if(!t)return;const B=X.BELIEF;let v=t.belief[good];
  if(filled)v+=(price-v)*B.filled;else v*=side==='buy'?1+B.missed:1-B.missed;
  t.belief[good]=Math.max(REF(good)*B.min,Math.min(REF(good)*B.max,v));
}

/* ---------- traders' day ---------- */
const shockMul=(st,good)=>st.shocks.reduce((m,s)=>m*((X.SHOCKS.list[s.kind].produce||{})[good]||1),1);
// Agents (the Economy Sandbox's model players) are driven from outside, not by an archetype.
const isAgent=id=>typeof id==='string'&&id.startsWith('agent:');
function traderDay(st,t){
  const A=X.ARCHETYPES[t.arch];if(!A)return;
  // Income in, upkeep out.
  const inc=rint(st,A.income);t.coin+=inc;st.flows.income+=inc;
  // The Quartermaster trades for the settlements beyond the Rootworks, which keep its treasury
  // steady: shortfalls are topped up (a faucet) and surplus is shipped out (a sink).
  if(t.arch==='quartermaster'){const d=t.start-t.coin;if(d>0)st.flows.income+=d;else st.flows.upkeep-=d;t.coin=t.start;return void traderGoods(st,t,A)}
  const up=round(t.coin*X.UPKEEP.rate+X.UPKEEP.flat);t.coin=Math.max(0,t.coin-up);st.flows.upkeep+=up;
  traderGoods(st,t,A);
}
function traderGoods(st,t,A){
  // Production, which stops when stock piles up (supply answers price).
  for(const [g,range] of Object.entries(A.produce||{})){
    const cap=((range[0]+range[1])/2)*X.INVENTORY_DAYS;if((t.inv[g]||0)>=cap)continue;
    t.inv[g]=(t.inv[g]||0)+Math.round(rfloat(st,range)*shockMul(st,g));
  }
  for(const [a,na,b,nb,cap] of A.convert||[]){
    const can=Math.min(cap,Math.floor((t.inv[a]||0)/na));
    if(can>0&&(t.inv[b]||0)<cap*X.INVENTORY_DAYS){t.inv[a]-=can*na;t.inv[b]=(t.inv[b]||0)+can*nb}
  }
  // Consumption; what's missing, it wants more of tomorrow.
  t.want={};
  for(const [g,n] of Object.entries(A.consume||{})){
    const need=n<1?(rnd(st)<n?1:0):n;const have=t.inv[g]||0;
    t.inv[g]=Math.max(0,have-need);if(have<need)t.belief[g]=Math.min(REF(g)*X.BELIEF.max,t.belief[g]*(1+X.BELIEF.missed));
    t.want[g]=Math.ceil(n*X.INVENTORY_DAYS);
  }
  if(A.convert)for(const [a,na,,,cap] of A.convert)t.want[a]=Math.max(t.want[a]||0,na*cap*2);
  // Raiders sometimes die offscreen and lose what they carried.
  if(A.death&&rnd(st)<A.death){t.inv.cage=0;t.inv.tonic=0}
}
function postTraderOrders(st,t){
  const A=X.ARCHETYPES[t.arch],sp=X.BELIEF.spread;if(!A)return;
  if(t.arch==='quartermaster'){
    const Q=X.QUARTERMASTER;
    for(const g of GOODS){
      if((t.inv[g]||0)>0)addOrder(st,{owner:t.id,good:g,side:'sell',price:REF(g)*Q.ask,qty:t.inv[g]});
      addOrder(st,{owner:t.id,good:g,side:'buy',price:REF(g)*Q.bid,qty:Math.ceil(Q.exportCap/(REF(g)/10))});
    }
    return;
  }
  if(t.arch==='speculator'){
    for(const g of GOODS){
      const h=st.hist[g].slice(-14);if(h.length<5)continue;const mean=h.reduce((a,x)=>a+x.p,0)/h.length,last=st.last[g];
      if(last<mean*(1-A.edge))addOrder(st,{owner:t.id,good:g,side:'buy',price:last*1.02,qty:Math.floor(t.coin*.1/last)});
      if((t.inv[g]||0)>0&&last>mean*(1+A.edge*.5))addOrder(st,{owner:t.id,good:g,side:'sell',price:Math.max(last*.98,mean),qty:t.inv[g]});
    }
    return;
  }
  for(const g of GOODS){
    const have=t.inv[g]||0,want=t.want[g]||0,b=t.belief[g];
    if(have<want)addOrder(st,{owner:t.id,good:g,side:'buy',price:b*(1-sp*rnd(st)),qty:want-have});
    else if(have>want)addOrder(st,{owner:t.id,good:g,side:'sell',price:b*(1+sp*rnd(st)),qty:have-want});
  }
}

/* ---------- auctions ---------- */
function listAuctionRaw(st,seller,item,start,buyout,days){
  const a={id:nid(st),seller,item,label:itemLabel(item),appraisal:round(appraise(item)),start:round(start),buyout:buyout?round(buyout):null,
    price:round(start),leader:null,max:0,ends:st.day+days,bids:0};
  st.auctions.push(a);return a;
}
function traderValue(st,t,a){
  const A=X.ARCHETYPES[t.arch];if(!A)return 0;const cat=a.item.kind,w=(A.wantsUnique||{})[cat];
  if(!w||t.id===a.seller)return 0;if(A.rareOnly&&!isRare(a.item))return 0;
  return Math.min(t.coin*.6,a.appraisal*w*t.ubelief[cat]);
}
// One round of bidding: the top valuation leads, paying just over the second (like proxy bids).
function bidRound(st,a,ev){
  const vals=st.traders.map(t=>({who:t.id,v:Math.min(t.coin,traderValue(st,t,a)*rfloat(st,[.85,1.15]))})).filter(x=>x.v>=a.start);
  if(a.leader==='P'||isAgent(a.leader))vals.push({who:a.leader,v:a.max});
  if(!vals.length)return;
  vals.sort((x,y)=>y.v-x.v);const top=vals[0],second=vals[1];
  // Everyone outbid wants it a little more next time.
  for(const x of vals.slice(1))if(x.who!=='P'){const t=trader(st,x.who);t.ubelief[a.item.kind]=Math.min(X.BELIEF.max,t.ubelief[a.item.kind]*(1+X.BELIEF.missed))}
  if(a.buyout&&top.who!=='P'&&top.v>=a.buyout){a.price=a.buyout;a.leader=top.who;a.ends=st.day;a.bought=true;return}
  const price=round(Math.max(a.start,Math.min(top.v,second?second.v*(1+X.AUCTION.step):a.start)));
  if(a.leader==='P'&&top.who!=='P'){ev.push({type:'outbid',auction:a.id,label:a.label,coin:a.max})}
  if(top.who!==a.leader||price>a.price){a.max=top.who===a.leader?a.max:top.v;a.leader=top.who;a.price=price;a.bids++}
}
function closeAuction(st,a,ev){
  st.auctions=st.auctions.filter(x=>x!==a);
  if(!a.leader){if(a.seller==='P')ev.push({type:'returned',item:a.item,label:a.label});return}
  // A trader that can no longer pay loses the lead; the auction runs one more day.
  if(a.leader!=='P'&&trader(st,a.leader).coin<a.price){st.auctions.push(a);a.leader=null;a.price=a.start;a.ends=st.day+1;return}
  const tax=round(a.price*X.FEES.tax);st.flows.tax+=tax;
  if(a.seller==='P')ev.push({type:'sold',label:a.label,coin:round(a.price-tax),price:a.price});
  else{const s=trader(st,a.seller);if(s)s.coin+=a.price-tax}
  if(a.leader==='P')ev.push({type:'won',item:a.item,label:a.label,price:a.price,coin:round(a.max-a.price)});
  else{const b=trader(st,a.leader),w=((X.ARCHETYPES[b.arch]||{}).wantsUnique||{})[a.item.kind]||1;b.coin-=a.price;if(isAgent(b.id))(b.won=b.won||[]).push(a.item);
    b.ubelief[a.item.kind]+=((a.price/(a.appraisal*w))-b.ubelief[a.item.kind])*X.BELIEF.filled}
  const ratio=a.price/a.appraisal;(st.salesToday[a.item.kind]=st.salesToday[a.item.kind]||[]).push(ratio);
  if(a.price>=600)news(st,`${a.label} sold for ${Math.round(a.price)} coin.`,'sale');
}
function traderListings(st){
  const migr=st.shocks.find(s=>s.kind==='migration');
  for(const t of st.traders){
    const A=X.ARCHETYPES[t.arch];if(!A)continue;
    for(const [cat,p] of Object.entries(A.list||{})){
      const flood=migr&&cat==='creature'&&t.arch==='raider'?3:1;
      if(rnd(st)>=p*flood)continue;
      const item=makeItem(st,cat,{type:flood>1?migr.type:null,gen:t.arch==='breeder'&&cat==='creature'?rint(st,[1,4]):0});
      const v=appraise(item)*t.ubelief[cat];
      listAuctionRaw(st,t.id,item,v*X.AUCTION.startUnder*(flood>1?.7:1),rnd(st)<.6?v*X.AUCTION.buyoutOver:null,rint(st,X.AUCTION.days));
    }
  }
}

/* ---------- bounties ---------- */
function traderBounties(st){
  for(const t of st.traders){
    const p=(X.ARCHETYPES[t.arch]||{}).bounty;if(!p||rnd(st)>=p)continue;
    const type=rpick(st,TYPE_IDS),locus=rpick(st,STAT_LOCI),min=rint(st,X.BOUNTY.minGrade),shine=rnd(st)<.15;
    const reward=Math.round(Math.min(t.coin*.5,(X.BOUNTY.reward[0]+(X.BOUNTY.reward[1]-X.BOUNTY.reward[0])*Math.pow((min-6)/3,1.6)*.7)*(shine?X.BOUNTY.shineBonus:1)*(1+.2*(TYPES[type].tier-1))));
    if(reward<X.BOUNTY.reward[0]||t.coin<reward*2)continue;
    t.coin-=reward;   // held until paid out or the bounty expires
    st.bounties.push({id:nid(st),poster:t.id,posterName:t.name,want:{type,locus,min,shine},reward,ends:st.day+X.BOUNTY.days});
  }
}
// Does a creature meet a bounty? Uses its expressed genes, as anyone inspecting it would.
function meetsBounty(b,c){const w=b.want;return(c.type===w.type||c.type2===w.type)&&c.genes[w.locus]>=w.min&&(!w.shine||c.looks.shine>0)}

/* ---------- shocks ---------- */
function shocks(st){
  st.shocks=st.shocks.filter(s=>{if(s.until<=st.day){news(st,`${X.SHOCKS.list[s.kind].name} is over.`,'shock');return false}return true});
  if(st.shocks.length||rnd(st)>=X.SHOCKS.chance)return;
  const kind=rpick(st,Object.keys(X.SHOCKS.list)),S0=X.SHOCKS.list[kind],s={kind,until:st.day+S0.days};
  if(kind==='migration')s.type=rpick(st,TYPE_IDS);
  st.shocks.push(s);
  news(st,S0.news.replace(/\{type\}/g,s.type?TYPES[s.type].name:''),'shock');
  if(kind==='estate'){const seller=st.traders[0].id;for(let i=0;i<S0.dump;i++){const cat=rpick(st,['print','gun','creature','creature']);const item=makeItem(st,cat,{gen:cat==='creature'?rint(st,[2,4]):0});listAuctionRaw(st,seller,item,appraise(item)*.4,null,3)}}
}

/* ---------- the day ---------- */
function dayStep(st){
  const ev=[];st.day++;st.tradesToday=[];st.salesToday={};
  shocks(st);
  // Unfilled trader orders from yesterday: missed trades nudge beliefs, then traders repost.
  for(const g of GOODS){const b=st.books[g];
    for(const o of [...b.bids,...b.asks])if(o.owner!=='P'&&o.qty>0&&!o.filled)learn(st,o.owner,g,0,false,o.side);
    b.bids=b.bids.filter(o=>o.owner==='P');b.asks=b.asks.filter(o=>o.owner==='P');
  }
  for(const t of st.traders)traderDay(st,t);
  for(const t of st.traders)postTraderOrders(st,t);
  for(const g of GOODS)match(st,g,ev);
  // The Quartermaster ships what it bought out of the Rootworks: a sink for surplus goods.
  for(const t of st.traders.filter(x=>x.arch==='quartermaster'))for(const g of GOODS){const own=Object.keys(X.ARCHETYPES.quartermaster.produce).includes(g);if(!own&&t.inv[g]){st.flows.exported+=t.inv[g]*REF(g);t.inv[g]=0}}
  // Auctions: listings, bids, closings.
  traderListings(st);
  for(const a of st.auctions.slice())bidRound(st,a,ev);
  for(const a of st.auctions.slice())if(a.ends<=st.day)closeAuction(st,a,ev);
  // Bounties: new ones, and expired ones go back to their posters.
  traderBounties(st);
  st.bounties=st.bounties.filter(b=>{if(b.ends<=st.day){const t=trader(st,b.poster);if(t)t.coin+=b.reward;return false}return true});
  record(st);
  return ev;
}
function record(st){
  for(const g of GOODS){
    const tr=st.tradesToday.filter(x=>x.good===g),vol=tr.reduce((a,x)=>a+x.qty,0);
    const p=vol?tr.reduce((a,x)=>a+x.price*x.qty,0)/vol:st.last[g];
    const prev=st.last[g];st.last[g]=round(p);
    st.hist[g].push({d:st.day,p:round(p),v:vol});if(st.hist[g].length>X.HISTORY_DAYS)st.hist[g].shift();
    if(vol&&prev&&Math.abs(p/prev-1)>=X.NEWS_MOVE)news(st,`${g[0].toUpperCase()+g.slice(1)} ${p>prev?'up':'down'} ${Math.round(Math.abs(p/prev-1)*100)}% to ${Math.round(p)} coin.`,'move');
  }
  for(const c of CATS){const s=(st.salesToday[c]||[]).sort((a,b)=>a-b);if(s.length){st.uhist[c].push({d:st.day,r:round(s[Math.floor(s.length/2)]),n:s.length});if(st.uhist[c].length>X.HISTORY_DAYS)st.uhist[c].shift()}}
  st.daily.push({d:st.day,coin:Math.round(traderCoin(st)),basket:round(basketIndex(st))});if(st.daily.length>X.HISTORY_DAYS)st.daily.shift();
}

/* ---------- measures ---------- */
const traderCoin=st=>st.traders.reduce((a,t)=>a+t.coin,0)+st.bounties.reduce((a,b)=>a+b.reward,0);
// Price of a unique category: the median sale/appraisal ratio over the last 14 days of sales.
function uniquePrice(st,c){const h=st.uhist[c].slice(-14).map(x=>x.r).sort((a,b)=>a-b);return REF(c)*(h.length?h[Math.floor(h.length/2)]:1)}
const priceOf=(st,g)=>X.COMMODITIES[g]?st.last[g]:uniquePrice(st,g);
// The standard basket: each good's price over its reference price, averaged. 1.0 = reference.
function basketIndex(st){return X.BASKET.reduce((a,g)=>a+priceOf(st,g)/REF(g),0)/X.BASKET.length}

/* ---------- player operations ---------- */
// A limit order. The client has already escrowed price×qty coin (buy) or the goods (sell).
function postOrder(st,{good,side,price,qty}){
  const ev=[];if(!st.books[good]||!(price>0)||!(qty>0))return{ok:false,ev,why:'Bad order'};
  const o=addOrder(st,{owner:'P',good,side,price,qty},ev);match(st,good,ev);
  return{ok:true,ev,id:o&&o.id};
}
function cancelOrder(st,{id}){
  const ev=[];for(const g of GOODS){const b=st.books[g];for(const side of ['bids','asks']){const o=b[side].find(x=>x.id===id&&x.owner==='P');
    if(o){b[side]=b[side].filter(x=>x!==o);if(o.qty>0)ev.push(side==='bids'?{type:'refund',coin:round(o.price*o.qty)}:{type:'refund',good:g,qty:o.qty})}}}
  return{ok:true,ev};
}
// Buy or sell now against the book, up to qty, no worse than `limit` per unit.
// The client escrows qty×limit coin (buy) or qty goods (sell); leftovers come back as refunds.
function marketOrder(st,{good,side,qty,limit}){
  const ev=[];const b=st.books[good];if(!b)return{ok:false,ev};
  const o={id:nid(st),owner:'P',good,side,price:limit,qty,day:st.day};
  const fee=round(Math.min(qty,depth(st,good,side==='buy'?'asks':'bids',limit))*limit*X.FEES.post);st.flows.fees+=fee;ev.push({type:'fee',coin:-fee});
  st.books[good][side==='buy'?'bids':'asks'].unshift(o);o.id=-1;match(st,good,ev);
  st.books[good][side==='buy'?'bids':'asks']=st.books[good][side==='buy'?'bids':'asks'].filter(x=>x!==o);
  if(o.qty>0)ev.push(side==='buy'?{type:'refund',coin:round(o.price*o.qty)}:{type:'refund',good,qty:o.qty});
  return{ok:true,ev};
}
function depth(st,good,side,limit){return st.books[good][side].filter(o=>side==='asks'?o.price<=limit:o.price>=limit).reduce((a,o)=>a+o.qty,0)}
function listAuction(st,{item,start,buyout}){const a=listAuctionRaw(st,'P',item,start,buyout,X.AUCTION.playerDays);return{ok:true,ev:[],id:a.id}}
// A proxy bid: the client has escrowed `max` coin. Pays only what it takes to lead.
function bid(st,{id,max}){
  const ev=[],a=st.auctions.find(x=>x.id===id);
  if(!a||a.seller==='P'||max<a.start||max<=a.price&&a.leader)return{ok:false,ev:[{type:'refund',coin:max}],why:'Bid too low'};
  if(a.leader==='P')ev.push({type:'refund',coin:a.max});
  const second=a.leader&&a.leader!=='P'?a.price:a.start;
  a.leader='P';a.max=max;a.price=round(Math.max(a.start,Math.min(max,second*(1+X.AUCTION.step))));a.bids++;
  return{ok:true,ev};
}
function buyout(st,{id}){
  const ev=[],a=st.auctions.find(x=>x.id===id);if(!a||!a.buyout||a.seller==='P')return{ok:false,ev:[],why:'No buyout'};
  if(a.leader==='P')ev.push({type:'refund',coin:a.max});
  a.leader='P';a.max=a.buyout;a.price=a.buyout;closeAuction(st,a,ev);
  return{ok:true,ev};
}
function fulfilBounty(st,{id,c}){
  const b=st.bounties.find(x=>x.id===id);if(!b)return{ok:false,ev:[],why:'Gone'};
  if(!meetsBounty(b,c))return{ok:false,ev:[],why:'Does not meet the request'};
  st.bounties=st.bounties.filter(x=>x!==b);
  news(st,`${b.posterName} paid a ${b.reward}-coin bounty for a ${TYPES[b.want.type].name}.`,'sale');
  return{ok:true,ev:[{type:'bounty',coin:b.reward,label:`${TYPES[b.want.type].name} bounty`}]};
}
function advance(st){return{ok:true,ev:dayStep(st)}}
// Adds or removes stock across the market (Economy Sandbox).
function inject(st,{good,qty}){
  const holders=st.traders.filter(t=>t.arch!=='collector');
  for(let i=0;i<Math.abs(qty);i++){const t=holders[i%holders.length];t.inv[good]=Math.max(0,(t.inv[good]||0)+(qty>0?1:-1))}
  news(st,`${qty>0?'A glut of':'A shortage of'} ${good} hits the market (${qty>0?'+':''}${qty}).`,'shock');
  return{ok:true,ev:[]};
}

/* ---------- what the client sees ---------- */
function view(st){
  const top=(arr,n)=>arr.slice(0,n).map(o=>({id:o.id,price:o.price,qty:o.qty,mine:o.owner==='P'}));
  const books={};for(const g of GOODS){const b=st.books[g];sortBook(b);books[g]={bids:top(b.bids,5),asks:top(b.asks,5),last:st.last[g],ref:REF(g),
    hist:st.hist[g].map(x=>[x.d,x.p,x.v])}}
  const mine=[];for(const g of GOODS)for(const s of ['bids','asks'])for(const o of st.books[g][s])if(o.owner==='P')mine.push({id:o.id,good:g,side:s==='bids'?'buy':'sell',price:o.price,qty:o.qty});
  return{day:st.day,books,mine,auctions:st.auctions.map(a=>({...a,mineLead:a.leader==='P',mineSell:a.seller==='P',sellerName:a.seller==='P'?'You':(trader(st,a.seller)||{}).name})),
    bounties:st.bounties,news:st.news.slice(0,12),shocks:st.shocks.map(s=>({...s,name:X.SHOCKS.list[s.kind].name})),
    unique:Object.fromEntries(CATS.map(c=>[c,{price:round(uniquePrice(st,c)),hist:st.uhist[c].map(x=>[x.d,round(x.r*REF(c))])}])),
    daily:st.daily,basket:round(basketIndex(st))};
}

const OPS={postOrder,cancelOrder,marketOrder,listAuction,bid,buyout,fulfilBounty,advance,inject};
export {isAgent,addOrder,listAuctionRaw,trader,uniquePrice,X as EXCHANGE,GOODS,CATS,REF,createMarket,dayStep,OPS,view,basketIndex,traderCoin,appraise,meetsBounty,priceOf,makeItem,itemLabel};
