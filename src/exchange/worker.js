/* The Exchange's background worker: keeps the market state off the main thread and answers
   protocol messages in order. Built as its own bundle and inlined into the page (see build.mjs). */
import {handle} from './protocol.js';
let state=null;
self.onmessage=e=>{
  const {id,msg}=e.data;
  try{const out=handle(state,msg);state=out.state;self.postMessage({id,out})}
  catch(err){self.postMessage({id,error:String(err&&err.stack||err)})}
};
