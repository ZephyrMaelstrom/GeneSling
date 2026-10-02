/* ================= Line charts =================
   One series per chart (no dual axes): a 2px line, hairline gridlines, the latest value
   labelled at the line's end, and a crosshair tooltip that snaps to the nearest day on hover,
   touch-drag or keyboard focus. Every chart also offers a table view of its points.
   Marks use the accent color; text stays in the ink colors. */
let uid=0;
const esc=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
const niceStep=span=>{const raw=span/3,p=Math.pow(10,Math.floor(Math.log10(raw||1))),m=raw/p;return(m<1.5?1:m<3.5?2:m<7.5?5:10)*p};
// points: [[x, y], ...] with x ascending. Returns markup; wire it up once with bindCharts(root).
function lineChart(points,o={}){
  const id='lc'+(++uid),W=o.w||320,H=o.h||140,pad={l:40,r:44,t:10,b:20},fmt=o.fmt||(v=>String(Math.round(v))),xfmt=o.xfmt||(x=>'Day '+x);
  if(points.length<2)return`<p class="status">Not enough history yet.</p>`;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  let lo=Math.min(...ys,o.min??Infinity),hi=Math.max(...ys,o.max??-Infinity);if(hi-lo<1e-9){hi+=1;lo-=1}
  const step=niceStep(hi-lo);lo=Math.floor(lo/step)*step;hi=Math.ceil(hi/step)*step;
  const x0=xs[0],x1=xs[xs.length-1],X=x=>pad.l+(x-x0)/((x1-x0)||1)*(W-pad.l-pad.r),Y=y=>pad.t+(1-(y-lo)/(hi-lo))*(H-pad.t-pad.b);
  const grid=[];for(let v=lo;v<=hi+1e-9;v+=step)grid.push(`<line x1="${pad.l}" x2="${W-pad.r}" y1="${Y(v)}" y2="${Y(v)}" class="lc-grid"/><text x="${pad.l-6}" y="${Y(v)+4}" class="lc-axis" text-anchor="end">${esc(fmt(v))}</text>`);
  const ref=o.ref!=null&&o.ref>=lo&&o.ref<=hi?`<line x1="${pad.l}" x2="${W-pad.r}" y1="${Y(o.ref)}" y2="${Y(o.ref)}" class="lc-ref"/><text x="${pad.l+4}" y="${Y(o.ref)-4}" class="lc-axis">${esc(o.refLabel||'reference')}</text>`:'';
  const path=points.map((p,i)=>`${i?'L':'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
  const last=points[points.length-1];
  const data=esc(JSON.stringify({pts:points.map(p=>[p[0],p[1],X(p[0]),Y(p[1])]),fmt:o.unit||'',dec:o.dec||0,xl:o.xlabel||'Day',H,pt:pad.t,pb:pad.b}));
  const table=`<details class="lc-table"><summary>Table</summary><table><thead><tr><th>${esc(o.xlabel||'Day')}</th><th>${esc(o.label||'Value')}</th></tr></thead><tbody>${points.slice(-30).reverse().map(p=>`<tr><td>${esc(xfmt(p[0]).replace(/^Day /,''))}</td><td>${esc(fmt(p[1]))}</td></tr>`).join('')}</tbody></table></details>`;
  return`<figure class="lchart" id="${id}"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label||'Chart')}: ${esc(fmt(last[1]))} on ${esc(xfmt(last[0]))}" tabindex="0" data-chart="${data}">
    ${grid.join('')}${ref}
    <text x="${pad.l}" y="${H-4}" class="lc-axis">${esc(xfmt(x0))}</text><text x="${W-pad.r}" y="${H-4}" class="lc-axis" text-anchor="end">${esc(xfmt(x1))}</text>
    <path d="${path}" class="lc-line"/>
    <circle cx="${X(last[0])}" cy="${Y(last[1])}" r="3" class="lc-dot"/><text x="${X(last[0])+6}" y="${Y(last[1])+4}" class="lc-end">${esc(fmt(last[1]))}</text>
    <line class="lc-cross" x1="0" x2="0" y1="${pad.t}" y2="${H-pad.b}" visibility="hidden"/><circle class="lc-hot" r="4" visibility="hidden"/>
    <rect class="lc-hit" x="${pad.l}" y="0" width="${W-pad.l-pad.r}" height="${H}"/></svg>
    <div class="lc-tip" hidden><b></b><span></span></div>${table}</figure>`;
}
// Crosshair and tooltip for every chart under root (event delegation, so re-renders are fine).
function bindCharts(root=document){
  if(root.__lcBound)return;root.__lcBound=true;
  const show=(svg,clientX)=>{
    const d=JSON.parse(svg.dataset.chart),r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal,x=(clientX-r.left)/r.width*vb.width;
    let best=d.pts[0];for(const p of d.pts)if(Math.abs(p[2]-x)<Math.abs(best[2]-x))best=p;
    const fig=svg.closest('.lchart'),tip=fig.querySelector('.lc-tip'),cross=svg.querySelector('.lc-cross'),hot=svg.querySelector('.lc-hot');
    cross.setAttribute('x1',best[2]);cross.setAttribute('x2',best[2]);cross.setAttribute('visibility','visible');
    hot.setAttribute('cx',best[2]);hot.setAttribute('cy',best[3]);hot.setAttribute('visibility','visible');
    tip.hidden=false;tip.querySelector('b').textContent=(+best[1]).toFixed(d.dec)+(d.fmt?' '+d.fmt:'');tip.querySelector('span').textContent=`${d.xl} ${best[0]}`;
    tip.style.left=Math.min(r.width-110,Math.max(0,best[2]/vb.width*r.width-50))+'px';
    svg.__idx=d.pts.indexOf(best);
  };
  const hide=svg=>{svg.querySelector('.lc-cross').setAttribute('visibility','hidden');svg.querySelector('.lc-hot').setAttribute('visibility','hidden');svg.closest('.lchart').querySelector('.lc-tip').hidden=true};
  root.addEventListener('pointermove',e=>{const svg=e.target.closest&&e.target.closest('svg[data-chart]');if(svg)show(svg,e.clientX)});
  root.addEventListener('pointerleave',e=>{const svg=e.target.closest&&e.target.closest('svg[data-chart]');if(svg)hide(svg)},true);
  root.addEventListener('focusout',e=>{if(e.target.matches&&e.target.matches('svg[data-chart]'))hide(e.target)});
  root.addEventListener('keydown',e=>{const svg=e.target.closest&&e.target.closest('svg[data-chart]');if(!svg||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();
    const d=JSON.parse(svg.dataset.chart),r=svg.getBoundingClientRect(),i=Math.max(0,Math.min(d.pts.length-1,(svg.__idx??d.pts.length-1)+(e.key==='ArrowRight'?1:-1)));
    show(svg,r.left+d.pts[i][2]/svg.viewBox.baseVal.width*r.width)});
}
// A tiny trend line for list rows (no axes); the full chart lives in the row's detail view.
function sparkline(vals,w=72,h=22){
  if(vals.length<2)return'';const lo=Math.min(...vals),hi=Math.max(...vals),s=hi-lo||1;
  const d=vals.map((v,i)=>`${i?'L':'M'}${(i/(vals.length-1)*(w-4)+2).toFixed(1)},${(h-3-(v-lo)/s*(h-6)).toFixed(1)}`).join('');
  return`<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}"/></svg>`;
}
export {lineChart,bindCharts,sparkline};
