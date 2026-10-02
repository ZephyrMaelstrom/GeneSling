/* ================= The Exchange: one protocol, three places to run it =================
   The game talks to the market only through `handle(state, message)`. A message is
   {op, args}; the reply is {res, view, state}. Today that runs in a Web Worker (or in-thread
   when workers aren't available, and in tests). Going online means running the same handler
   in a server function and validating the player's escrow there. */
import {createMarket,OPS,view} from './engine.js';

function handle(state,msg){
  if(msg.op==='init'){const st=msg.args.state||createMarket(msg.args.seed);return{res:{ok:true,ev:[]},view:view(st),state:st}}
  const fn=OPS[msg.op];if(!fn)return{res:{ok:false,ev:[],why:'Unknown operation'},view:view(state),state};
  const res=fn(state,msg.args||{});
  return{res,view:view(state),state};
}
export {handle};
