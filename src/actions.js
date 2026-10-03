/* ================= Actions =================
   Every button, select and slider names an action in its data-act attribute. Each UI module
   registers the actions it owns here, next to the screen that shows them, instead of one long
   switch in ui.js:

     onAct('evolve', d => ...)        a click; d is the element's dataset
     onChange('mapsel', el => ...)    a select, checkbox or text field changed
     onInput('optr', el => ...)       a slider moved

   ui.js listens for clicks, changes and input on the page and dispatches through act(),
   changed() and inputted(). Tests and the hideout map call act(name, dataset) directly.
   Registering a name twice is a mistake and throws, so two screens can't fight over one action. */
const CLICK=new Map(),CHANGE=new Map(),INPUT=new Map();

function reg(table,kind,names,fn){
  for(const n of [].concat(names)){
    if(table.has(n))throw new Error(`The ${kind} action "${n}" is registered twice`);
    table.set(n,fn);
  }
}
const onAct=(names,fn)=>reg(CLICK,'click',names,fn);
const onChange=(names,fn)=>reg(CHANGE,'change',names,fn);
const onInput=(names,fn)=>reg(INPUT,'input',names,fn);

// Run a click action. Returns false if nothing is registered under that name.
function act(name,d={}){const f=CLICK.get(name);if(!f)return false;f(d,name);return true}
function changed(el){const f=CHANGE.get(el.dataset.act);if(!f)return false;f(el,el.dataset.act);return true}
function inputted(el){const f=INPUT.get(el.dataset.act);if(!f)return false;f(el,el.dataset.act);return true}
// Every registered name, for tests.
const actionNames=()=>({click:[...CLICK.keys()],change:[...CHANGE.keys()],input:[...INPUT.keys()]});

export {onAct,onChange,onInput,act,changed,inputted,actionNames};
