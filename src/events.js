/* ================= Events =================
   A small event bus, so one system can react to another without the other knowing about it.
   The raid end used to call ten systems by name; now it emits what happened and each system
   subscribes in its own module.

   Events in use:
     'raid:end'   (report)  a raid (or scav run) is being settled, before Keeper XP and the day.
                            Handlers may push lines to report.notes for the results screen.
     'raid:done'  (report)  the raid is settled, saved and closed.
     'day:passed' ()        a day passed in the real game (after a raid, or Wait one day).
                            Never emitted by simulations, which call processDay() directly.

   Handlers run in ascending `order` (default 50), then in the order they subscribed. A handler
   that throws doesn't stop the rest. */
const handlers=new Map();
let seq=0;

// Subscribe to an event. Returns a function that unsubscribes.
function on(evt,fn,opts={}){
  const list=handlers.get(evt)||[];
  const h={fn,order:opts.order??50,seq:seq++};
  list.push(h);list.sort((a,b)=>a.order-b.order||a.seq-b.seq);
  handlers.set(evt,list);
  return()=>{const l=handlers.get(evt);if(l){const i=l.indexOf(h);if(i>=0)l.splice(i,1)}};
}
// Emit an event to every handler. Returns the payload, so callers can read what handlers added.
function emit(evt,payload){
  for(const h of (handlers.get(evt)||[]).slice()){
    // Rethrown on its own tick: it still shows as a page error (and fails the tests), but can't stop the other handlers.
    try{h.fn(payload)}catch(e){setTimeout(()=>{throw e},0)}
  }
  return payload;
}
// How many handlers an event has (for tests and the Test Lab).
const listenerCount=evt=>(handlers.get(evt)||[]).length;

export {on,emit,listenerCount};
