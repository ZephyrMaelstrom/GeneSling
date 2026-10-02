/* ================= The Exchange tab =================
   News ticker, commodities (order book, price chart, buy and sell now, limit orders),
   auctions (bid, buy out, list your own), genetic bounties, and your open orders.
   Reads the market's view from exchange/market.js; every action goes through it. */
import {esc} from './util.js';
import {SPECIES,TYPES,GENES,GUNS,TRAITS} from './content.js';
import {S,ui,formName} from './state.js';
import {EXCHANGE as X,GOODS,CATS,REF,meetsBounty} from './exchange/engine.js';
import {marketView,stock,appraiseOwn,canList} from './exchange/market.js';
import {matName,QN} from './jobs.js';
import {geneSight,looksText} from './geneui.js';
import {lineChart,sparkline} from './chart.js';
import {runSandbox} from './exchange/sandbox.js';

const name=g=>g==='cage'?'Cage':g==='gilded'?'Gilded cage':matName(g);
const c0=v=>Math.round(v);
const pct=(a,b)=>b?Math.round((a/b-1)*100):0;
const fee=v=>Math.ceil(v*X.FEES.post);

function newsTicker(v){
  const items=v.news.slice(0,8);
  const shock=v.shocks.map(s=>`<span class="chip warn">${esc(s.name)}</span>`).join('');
  return`<div class="ticker" role="marquee" aria-label="Exchange news"><div class="ticker-track">${items.map(n=>`<span><small>Day ${n.day}</small> ${esc(n.text)}</span>`).join('')}${items.map(n=>`<span aria-hidden="true"><small>Day ${n.day}</small> ${esc(n.text)}</span>`).join('')}</div></div>${shock?`<div class="row" style="gap:6px">${shock}</div>`:''}`;
}

/* ---------- commodities ---------- */
function goodRow(g,b){
  const h=b.hist.slice(-14).map(x=>x[1]),wk=b.hist.length>7?b.hist[b.hist.length-8][1]:b.last,ch=pct(b.last,wk);
  const bid=b.bids[0],ask=b.asks[0];
  return`<button class="goodrow ${ui.mk.good===g?'on':''}" data-act="mkgood" data-k="${g}" aria-expanded="${ui.mk.good===g}">
    <span class="gname"><b>${name(g)}</b><small>you have ${stock(g)}</small></span>
    ${sparkline(h)}
    <span class="gprice"><b>${b.last}</b><small class="${ch>0?'up':ch<0?'down':''}">${ch>0?'+':''}${ch}% wk</small></span>
    <span class="gbook"><small>bid ${bid?bid.price:'–'}</small><small>ask ${ask?ask.price:'–'}</small></span></button>`;
}
function goodDetail(g,b){
  const q=Math.max(1,+ui.mk.qty||1),ask=b.asks[0],bid=b.bids[0];
  const buyLimit=ask?Math.ceil(ask.price*1.1*100)/100:null,sellLimit=bid?Math.floor(bid.price*.9*100)/100:null;
  const book=(rows,side)=>rows.length?rows.map(o=>`<tr class="${o.mine?'mine':''}"><td>${o.price}</td><td>${o.qty}${o.mine?' (yours)':''}</td></tr>`).join(''):`<tr><td colspan="2" class="status">No ${side}</td></tr>`;
  const price=+ui.mk.price||b.last;
  return`<div class="gooddetail">
    ${lineChart(b.hist.map(x=>[x[0],x[1]]),{label:`${name(g)} price`,unit:'coin',dec:2,ref:REF(g),refLabel:'reference '+REF(g),fmt:v=>v>=100?String(Math.round(v)):v.toFixed(1)})}
    <div class="books"><table><thead><tr><th colspan="2">Buyers (bids)</th></tr></thead><tbody>${book(b.bids,'bids')}</tbody></table>
      <table><thead><tr><th colspan="2">Sellers (asks)</th></tr></thead><tbody>${book(b.asks,'asks')}</tbody></table></div>
    <label class="field">Quantity<input id="mk-qty" type="number" min="1" value="${q}" data-act="mkqty"></label>
    <div class="row"><button class="btn primary" data-act="mkbuy" data-k="${g}" ${ask&&S.coin>=buyLimit*q*(1+X.FEES.post)?'':'disabled'}>Buy ${q} now${ask?` · up to ${c0(buyLimit*q)}c`:''}</button>
      <button class="btn" data-act="mksell" data-k="${g}" ${bid&&stock(g)>=q?'':'disabled'}>Sell ${q} now${bid?` · from ${c0(sellLimit*q)}c`:''}</button></div>
    <p class="status">Buying or selling now takes the best prices on the book, then refunds what isn’t used. A ${Math.round(X.FEES.post*100)}% fee is paid on posting and ${Math.round(X.FEES.tax*100)}% sales tax on every sale.</p>
    <h3>Post a limit order</h3>
    <div class="row"><label class="field">Price each<input id="mk-price" type="number" min="0.1" step="0.1" value="${price}" data-act="mkprice"></label></div>
    <div class="row"><button class="btn small" data-act="mkpost" data-k="${g}" data-side="buy" ${S.coin>=price*q+fee(price*q)?'':'disabled'}>Bid ${q} at ${price}</button>
      <button class="btn small" data-act="mkpost" data-k="${g}" data-side="sell" ${stock(g)>=q?'':'disabled'}>Offer ${q} at ${price}</button></div>
    <p class="status">Limit orders wait on the book and fill when a trader meets your price, usually at the next hideout day. Fee now: ${fee(price*q)} coin.</p></div>`;
}

/* ---------- auctions ---------- */
function creatureLines(c){
  const sight=geneSight(),seen=sight==='alleles'?'alleles':'grades';
  const g=Object.keys(GENES).map(k=>`${GENES[k]} ${seen==='alleles'?`${c.genome[k][0]}/${c.genome[k][1]}`:c.genes[k]}`).join(' · ');
  return`<small>${c.sex==='F'?'♀':'♂'} ${esc(SPECIES[c.species].name)} · ${c.origin==='wild'?'wild':'Gen '+c.gen}${c.gen>=3?' · cut free':''} · Lv ${c.level} · ${looksText(c.looks)}${c.looks.shine?` · <b style="color:var(--gold)">${['','Prismatic','Bloomscar'][c.looks.shine]}</b>`:''}</small>
    <small>${g}</small>${c.traits.length?`<small>Traits: ${c.traits.map(t=>TRAITS[t].name).join(', ')}</small>`:''}`;
}
function auctionCard(a){
  const it=a.item,days=Math.max(0,a.ends-(marketView().day));
  const info=it.kind==='gun'?`<small>${QN[it.q||0]} · Tier ${GUNS[it.id].tier}${it.dur!=null?` · ${it.dur}/${it.max} durability`:''}</small>`:it.kind==='print'?`<small>Single-use print · Tier ${GUNS[it.id].tier}</small>`:creatureLines(it.kind==='egg'?it.child:it.c);
  const minBid=Math.ceil(a.leader?a.price*(1+X.AUCTION.step)+1:a.start);
  const mine=a.mineSell?'<span class="chip">Your listing</span>':a.mineLead?'<span class="chip good">You lead</span>':'';
  return`<div class="auction"><div class="row" style="justify-content:space-between;gap:6px"><b>${esc(it.kind==='egg'?'Egg: '+SPECIES[it.child.species].name:a.label)}</b>${mine}</div>
    ${info}
    <small class="status">${a.leader?`Current bid ${c0(a.price)}`:`Starts at ${c0(a.start)}`}${a.buyout?` · buy out ${c0(a.buyout)}`:''} · ${days?`ends in ${days} day${days>1?'s':''}`:'ends today'} · ${esc(a.sellerName||'')}</small>
    ${a.mineSell?'':`<div class="row" style="gap:6px"><button class="btn small" data-act="mkbid" data-id="${a.id}" data-min="${minBid}" ${S.coin>=minBid?'':'disabled'}>Bid ${minBid}</button>${a.buyout?`<button class="btn small primary" data-act="mkbuyout" data-id="${a.id}" ${S.coin>=a.buyout?'':'disabled'}>Buy out ${c0(a.buyout)}</button>`:''}</div>`}</div>`;
}
function listForm(){
  const k=ui.mk.listKind||'creature';
  const opts=k==='creature'?S.creatures.filter(canList).map(c=>[c.id,`${c.name} · ${formName(c)} Lv ${c.level}`]):k==='egg'?S.eggs.map(e=>[e.id,`Egg of ${e.parents}`]):
    k==='gun'?S.items.filter(i=>i.kind==='gun').map(i=>[i.uid,`${QN[i.q]} ${GUNS[i.id].name} (${i.dur}/${i.max})`]):S.prints.map(id=>[id,`Print: ${GUNS[id].name}`]);
  const ref=ui.mk.listRef&&opts.some(o=>String(o[0])===String(ui.mk.listRef))?ui.mk.listRef:opts[0]&&opts[0][0];
  const val=ref!=null?Math.round(appraiseOwn(k,k==='print'?ref:+ref)):0;
  return`<h3>List something</h3><div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,150px),1fr))">
    <label class="field">Kind<select data-act="mklistkind">${['creature','egg','gun','print'].map(x=>`<option value="${x}" ${x===k?'selected':''}>${X.UNIQUES[x].name}</option>`).join('')}</select></label>
    <label class="field">Item<select id="mk-listref" data-act="mklistref">${opts.map(([id,l])=>`<option value="${id}" ${String(id)===String(ref)?'selected':''}>${esc(l)}</option>`).join('')||'<option>Nothing to list</option>'}</select></label>
    <label class="field">Starting bid<input id="mk-start" type="number" min="1" value="${Math.round(val*.8)||1}"></label>
    <label class="field">Buyout (optional)<input id="mk-buyout" type="number" min="0" value="${Math.round(val*1.5)||''}"></label></div>
    <div class="row"><button class="btn small primary" data-act="mklist" data-k="${k}" ${ref!=null?'':'disabled'}>List for ${X.AUCTION.playerDays} days</button><span class="status">Traders value this at about ${val} coin. It leaves your hideout until it sells or comes back.</span></div>`;
}

/* ---------- bounties ---------- */
function bountyCard(b){
  const w=b.want,days=Math.max(0,b.ends-marketView().day),ok=S.creatures.filter(c=>canList(c)&&meetsBounty(b,c));
  return`<div class="auction"><div class="row" style="justify-content:space-between"><b>Wanted: ${TYPES[w.type].name}, ${GENES[w.locus]} ${w.min}+${w.shine?', shiny':''}</b><span class="chip warn">${b.reward}c</span></div>
    <small class="status">${esc(b.posterName)} · ${days?`${days} day${days>1?'s':''} left`:'last day'}</small>
    ${ok.length?`<div class="row" style="gap:6px"><select id="bounty-${b.id}" aria-label="Creature to hand over">${ok.map(c=>`<option value="${c.id}">${esc(c.name)} · ${GENES[w.locus]} ${c.genes[w.locus]}</option>`).join('')}</select><button class="btn small primary" data-act="mkbounty" data-id="${b.id}">Hand over</button></div>`:'<small class="status">None of your creatures qualify yet.</small>'}</div>`;
}

function viewExchange(){
  const v=marketView();
  if(!v)return`<section class="card"><h2>The Exchange</h2><p class="hint">Opening the market…</p></section>`;
  const tab=ui.mk.tab||'goods';
  const tabs=[['goods','Commodities'],['auctions',`Auctions · ${v.auctions.length}`],['bounties',`Bounties · ${v.bounties.length}`],['mine','Your orders']].map(([k,l])=>`<button class="tab" aria-selected="${tab===k}" data-act="mktab" data-k="${k}">${l}</button>`).join('');
  let body='';
  if(tab==='goods')body=`<div class="goods">${GOODS.map(g=>goodRow(g,v.books[g])+(ui.mk.good===g?goodDetail(g,v.books[g]):'')).join('')}</div>`;
  if(tab==='auctions'){const f=ui.mk.cat||'all';const list=v.auctions.filter(a=>f==='all'||a.item.kind===f).sort((a,b)=>a.ends-b.ends);
    body=`<div class="filters">${['all',...CATS].map(c=>`<button class="tab" aria-selected="${f===c}" data-act="mkcat" data-k="${c}">${c==='all'?'All':X.UNIQUES[c].name}</button>`).join('')}</div>
      <div class="auctions">${list.slice(0,40).map(auctionCard).join('')||'<p class="empty">Nothing listed.</p>'}</div>${listForm()}`}
  if(tab==='bounties')body=`<p class="hint">Breeders and collectors pay for particular genetics. Hand over a creature that meets the request and the reward is yours.</p><div class="auctions">${v.bounties.map(bountyCard).join('')||'<p class="empty">No bounties posted right now.</p>'}</div>`;
  if(tab==='mine'){
    const ord=v.mine.map(o=>`<div class="invrow"><span>${o.side==='buy'?'Buying':'Selling'} ${o.qty} ${name(o.good)} at ${o.price}</span><button class="btn small" data-act="mkcancel" data-id="${o.id}">Cancel</button></div>`).join('');
    const bids=v.auctions.filter(a=>a.mineLead||a.mineSell).map(auctionCard).join('');
    body=`<h3>Open orders</h3>${ord||'<p class="empty">No open orders.</p>'}<h3>Your auctions and leading bids</h3><div class="auctions">${bids||'<p class="empty">None.</p>'}</div>`;
  }
  const basket=v.daily.map(x=>[x.d,x.basket]);
  return`<div class="cols"><section class="card"><h2>The Exchange</h2>${newsTicker(v)}
    <p class="hint">A live market of about 60 traders: raiders, smiths, breeders, collectors, speculators and the Quartermaster. Prices move with supply and demand, and with the news.</p>
    <div class="filters">${tabs}</div>${body}</section>
    <section class="card"><h2>Market pulse</h2>
      <p class="status">Basket of 20 goods against reference prices (1.00 = reference).</p>
      ${lineChart(basket,{label:'Basket index',dec:2,ref:1,refLabel:'reference',fmt:v=>v.toFixed(2)})}
      <h3>Latest news</h3><ul class="log">${v.news.map(n=>`<li><span>Day ${n.day}</span>${esc(n.text)}</li>`).join('')}</ul></section></div>`;
}
/* ---------- Test Lab: Economy Sandbox ---------- */
let eco=null;
function runEconomy(o){eco={...runSandbox({days:o.days,seed:o.seed,market:o.src==='live'&&S.market?S.market:null,inject:o.qty?[{day:o.injDay||1,good:o.good,qty:+o.qty}]:[]}),opts:{...o}};return eco}
function economyPanel(E){
  const goods=GOODS.map(g=>`<option value="${g}" ${E.good===g?'selected':''}>${name(g)}</option>`).join('');
  let res='';
  if(eco){
    const r=eco.report,T=X.TARGETS,mark=ok=>ok==null?'<span class="status">needs a 90-day run</span>':ok?'<span style="color:var(--mint)">✓ met</span>':'<span style="color:var(--rose)">✗ missed</span>';
    const g=eco.opts.good||'ore';
    res=`<div class="slot"><div class="slot-label">${r.days}-day run ${eco.opts.src==='live'?'from your market':'from a fresh market'}${eco.opts.qty?` · ${eco.opts.qty>0?'+':''}${eco.opts.qty} ${name(eco.opts.good)} on day ${eco.opts.injDay||1}`:''}</div>
      <ul class="plain"><li>Coin supply after day ${T.fromDay}: ${r.coinWeekly!=null?(r.coinWeekly*100).toFixed(1)+'% a week':'–'} (target under ${T.coinGrowthWeek*100}%) ${mark(r.coinOk)}</li>
      <li>Basket of 20 goods vs day ${T.fromDay}: ${r.basketDev!=null?'within '+(r.basketDev*100).toFixed(1)+'%':'–'} (target ±${T.basketBand*100}%) ${mark(r.basketOk)}</li>
      <li>Act III: ${eco.agents.map(a=>`${esc(a.name)} day ${a.act3??'not yet'}`).join(' · ')} (target within ${T.actSpread*100}%) ${mark(r.actSpread!=null?r.actOk:null)}</li></ul>
      <h3>Coin supply</h3>${lineChart(eco.series.map(x=>[x.d,x.coin]),{label:'Coin supply',unit:'coin',fmt:v=>v>=1e4?Math.round(v/1000)+'k':String(Math.round(v))})}
      <h3>Basket index</h3>${lineChart(eco.series.map(x=>[x.d,x.basket]),{label:'Basket index',dec:2,ref:1,refLabel:'reference',fmt:v=>v.toFixed(2)})}
      <h3>${name(g)} price</h3>${lineChart(eco.series.map(x=>[x.d,x.prices[g]]),{label:name(g)+' price',unit:'coin',dec:2,ref:REF(g),refLabel:'reference',fmt:v=>v>=100?String(Math.round(v)):v.toFixed(1)})}
      <h3>News</h3><ul class="log">${eco.news.slice(0,8).map(n=>`<li><span>Day ${n.day}</span>${esc(n.text)}</li>`).join('')}</ul></div>`;
  }
  return`<h3>Economy Sandbox</h3>
    <p class="hint">Fast-forwards a copy of the market with all its traders, plus a model raider, crafter and breeder trading alongside. Inject or remove supply to see how prices answer. Your save is not touched.</p>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,140px),1fr))">
      <label class="field">Start from<select data-act="eco" data-k="src"><option value="fresh" ${E.src!=='live'?'selected':''}>A fresh market</option><option value="live" ${E.src==='live'?'selected':''}>Your market</option></select></label>
      <label class="field">Seed<input type="number" min="1" value="${E.seed||1}" data-act="eco" data-k="seed"></label>
      <label class="field">Supply change<select data-act="eco" data-k="good">${goods}</select></label>
      <label class="field">Amount (− removes)<input type="number" value="${E.qty||0}" data-act="eco" data-k="qty"></label>
      <label class="field">On day<input type="number" min="1" value="${E.injDay||1}" data-act="eco" data-k="injDay"></label></div>
    <div class="row">${[7,30,90].map(d=>`<button class="btn ${d===90?'primary':''}" data-act="lab-eco" data-k="${d}">Fast-forward ${d} days</button>`).join('')}</div>${res}`;
}
export {viewExchange,economyPanel,runEconomy};
