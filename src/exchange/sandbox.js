/* ================= The Economy Sandbox =================
   Fast-forwards a copy of a market 7, 30 or 90 days, with optional supply injected or removed,
   and three model players trading in it alongside the traders:
     - a pure raider: raids all session, sells raw finds, buys weapons and a cut-free creature;
     - a pure crafter: half raids, half crafting; buys inputs, sells parts, makes its own gear;
     - a pure breeder: half raids, half breeding; sells eggs, buys weapons.
   Each plays the same time a day, and Keeper XP is time played (raids, crafts and hatchings all
   earn it), so they progress together unless the market starves one of what it needs.
   It reports the three balance targets from the design (TARGETS in exchange.json):
     1. coin supply grows less than 3% a week after day 30,
     2. the 20-good basket stays within ±15% of its day-30 level,
     3. raider, crafter and breeder reach Act III within 10% of each other. */
import {EXCHANGE as X,createMarket,dayStep,addOrder,listAuctionRaw,basketIndex,traderCoin,appraise,makeItem} from './engine.js';

const A=X.AGENT,P=X.PLAYSTYLES,ACT=X.ACT3;
// Total Keeper XP needed to reach a rank (the game's curve: 120 × rank per rank).
const xpFor=rank=>120*rank*(rank-1)/2;
function addAgents(st){
  for(const k of Object.keys(P))st.traders.push({id:'agent:'+k,name:P[k].name,arch:'agent',style:k,coin:300,inv:{},belief:{},ubelief:{},want:{},start:300,
    xp:0,gear:0,gen:0,crafts:0,eggs:0,act3:null,won:[]});
}
const sell=(st,t,good,qty)=>{if(qty>0)addOrder(st,{owner:t.id,good,side:'sell',price:st.last[good]*.97,qty})};
const buy=(st,t,good,qty)=>{if(qty>0&&t.coin>st.last[good]*qty*1.2)addOrder(st,{owner:t.id,good,side:'buy',price:st.last[good]*1.05,qty})};
// A player who needs something bids on the cheapest few lots, up to AGENT.bidOver × appraisal.
function bidOn(st,t,pred,share){
  const lots=st.auctions.filter(x=>x.seller!==t.id&&pred(x)&&x.leader!==t.id).sort((x,y)=>x.price-y.price).slice(0,A.lotsPerDay);
  for(const a of lots){
    const max=Math.min(t.coin*share,a.appraisal*A.bidOver);if(max<=a.price*(1+X.AUCTION.step)||max<a.start)continue;
    if(a.buyout&&a.buyout<=max&&t.coin>=a.buyout){a.leader=t.id;a.max=a.buyout;a.price=a.buyout;a.ends=st.day;continue}
    a.leader=t.id;a.max=max;a.price=Math.max(a.start,Math.min(max,a.price*(1+X.AUCTION.step)));a.bids++;
  }
}
function agentDay(st,t){
  const S=P[t.style];
  // Time played: raids, crafts and hatchings.
  t.xp+=S.raidsPerDay*A.raidXp+S.craftsPerDay*A.craftXp+S.eggsPerDay*A.hatchXp;
  const loot=S.raidsPerDay*A.raidCoin;t.coin+=loot;st.flows.income+=loot;
  for(const [g,n] of Object.entries(A.raidRaw))t.inv[g]=(t.inv[g]||0)+n*S.raidsPerDay;
  // Spending on the hideout, like every trader's upkeep.
  const up=t.coin*X.UPKEEP.rate+X.UPKEEP.flat;t.coin=Math.max(0,t.coin-up);st.flows.upkeep+=up;
  for(const it of t.won.splice(0))if(it.kind==='gun')t.gear+=A.gearPerGun;else if(it.kind==='creature'&&it.c.gen>=ACT.cutFreeGen)t.gen=Math.max(t.gen,it.c.gen);
  if(t.style==='crafter'){
    // Crafting eats inputs (bought when short), makes parts to sell, and some of its own gear.
    for(let i=0;i<S.craftsPerDay;i++){const ok=Object.entries(A.craftInput).every(([g,n])=>(t.inv[g]||0)>=n);if(!ok)break;
      for(const [g,n] of Object.entries(A.craftInput))t.inv[g]-=n;t.crafts++;if(t.crafts%6===0)t.gear+=1;else t.inv[A.craftOutput]=(t.inv[A.craftOutput]||0)+1}
    for(const [g,n] of Object.entries(A.craftInput))buy(st,t,g,n*S.craftsPerDay-(t.inv[g]||0));
    sell(st,t,A.craftOutput,t.inv[A.craftOutput]||0);
  }else for(const g of Object.keys(A.raidRaw))sell(st,t,g,t.inv[g]||0);
  if(t.style==='breeder'){
    t.eggs+=S.eggsPerDay;t.gen=Math.max(t.gen,Math.floor(t.eggs/A.generationEggs));
    // Surplus hatchlings go to auction; a few a day keeps the coin coming.
    for(let i=0;i<2;i++){const it=makeItem(st,i?'egg':'creature',{gen:Math.max(1,Math.min(t.gen,4))});listAuctionRaw(st,t.id,it,appraise(it)*.7,appraise(it)*1.4,3)}
  }
  if(t.gear<ACT.gearScore&&t.style!=='crafter')bidOn(st,t,a=>a.item.kind==='gun',.4);
  if(t.gen<ACT.cutFreeGen&&t.style!=='breeder')bidOn(st,t,a=>a.item.kind==='creature'&&a.item.c.gen>=ACT.cutFreeGen,.8);
  if(t.act3==null&&t.xp>=xpFor(ACT.keeperRank)&&t.gen>=ACT.cutFreeGen&&t.gear>=ACT.gearScore)t.act3=st.day-st.sandboxStart;
}
// opts: {days, seed, market (a state to copy), agents, inject: [{day, good, qty}]}
function runSandbox(opts={}){
  const days=opts.days||X.TARGETS.days;
  const st=opts.market?structuredClone(opts.market):createMarket(opts.seed||1);
  const d0=st.day;st.sandboxStart=d0;if(opts.agents!==false)addAgents(st);
  const inj=opts.inject||[];const series=[];
  for(let i=1;i<=days;i++){
    for(const x of inj.filter(x=>x.day===i)){const holders=st.traders.filter(t=>t.arch!=='collector'&&t.arch!=='agent');for(let k=0;k<Math.abs(x.qty);k++){const t=holders[k%holders.length];t.inv[x.good]=Math.max(0,(t.inv[x.good]||0)+(x.qty>0?1:-1))}}
    for(const t of st.traders)if(t.arch==='agent')agentDay(st,t);
    dayStep(st);
    const prices={};for(const g of Object.keys(X.COMMODITIES))prices[g]=st.last[g];
    series.push({d:i,coin:Math.round(traderCoin(st)),basket:basketIndex(st),prices});
  }
  return{series,report:report(st,series,d0),news:st.news.slice(0,15),agents:st.traders.filter(t=>t.arch==='agent').map(t=>({style:t.style,name:t.name,act3:t.act3,xp:Math.round(t.xp),gear:t.gear,gen:t.gen,coin:Math.round(t.coin)}))};
}
// The three targets, measured from day TARGETS.fromDay.
function report(st,series,d0){
  const T=X.TARGETS,from=series.find(x=>x.d===T.fromDay),last=series[series.length-1];
  const out={days:series.length};
  if(from&&last.d>from.d){
    out.coinWeekly=Math.pow(last.coin/from.coin,7/(last.d-from.d))-1;
    out.basketDev=Math.max(...series.filter(x=>x.d>=T.fromDay).map(x=>Math.abs(x.basket/from.basket-1)));
    out.coinOk=out.coinWeekly<T.coinGrowthWeek;out.basketOk=out.basketDev<=T.basketBand;
  }
  const acts=st.traders.filter(t=>t.arch==='agent').map(t=>t.act3);
  if(acts.length){
    out.acts=Object.fromEntries(st.traders.filter(t=>t.arch==='agent').map(t=>[t.style,t.act3]));
    if(acts.every(x=>x!=null)){const lo=Math.min(...acts),hi=Math.max(...acts);out.actSpread=(hi-lo)/lo;out.actOk=out.actSpread<=T.actSpread}
    else out.actOk=false;
  }
  out.pass=!!(out.coinOk&&out.basketOk&&out.actOk);
  return out;
}
export {runSandbox,xpFor};
