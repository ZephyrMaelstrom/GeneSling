/* ================= The Exchange client =================
   A promise-based connection to the market. `connect()` prefers the background worker and
   falls back to running in-thread; both speak the protocol in protocol.js, in order. */
import {handle} from './protocol.js';
import WORKER_SRC from 'exchange-worker-src';

function localTransport(){
  let state=null,chain=Promise.resolve();
  return{kind:'local',send(msg){chain=chain.then(()=>{const out=handle(state,msg);state=out.state;return structuredClone(out)});return chain}};
}
function workerTransport(){
  const url=URL.createObjectURL(new Blob([WORKER_SRC],{type:'text/javascript'}));
  const w=new Worker(url);let seq=0;const waiting=new Map();
  w.onmessage=e=>{const {id,out,error}=e.data,p=waiting.get(id);if(!p)return;waiting.delete(id);error?p.reject(new Error(error)):p.resolve(out)};
  w.onerror=e=>{for(const p of waiting.values())p.reject(new Error(e.message||'worker error'));waiting.clear()};
  return{kind:'worker',send(msg){const id=++seq;return new Promise((resolve,reject)=>{waiting.set(id,{resolve,reject});w.postMessage({id,msg})})},worker:w};
}
function connect(prefer='worker'){
  if(prefer==='worker'&&typeof Worker!=='undefined'){try{return workerTransport()}catch(e){/* fall back */}}
  return localTransport();
}
export {connect,localTransport};
