/* ================= Device options =================
   Settings that belong to the phone, not to the game: fullscreen, joystick style and size, which
   hand holds the attack stick, the HUD's opacity, damage numbers, screen shake, auto-fire, volumes,
   the colour-blind palette, aim assist, slower bullets and the render scale.

   They live in this device's local storage, not in the save (from save v15), so a save synced to
   another phone or restored from a backup never carries this phone's joystick size with it, and
   starting a new game keeps them. The full game and the demo on the same site share them.

   OPTS is one object for the whole session: change a field, then call saveOpts(). */
const KEY='genesling-opts';
const defaultOpts=()=>({fullscreen:true,stick:'fixed',stickSize:'M',btnSize:'M',hand:'right',dmgNums:true,shake:true,hudAlpha:.82,autoFire:true,
  vol:.7,music:.5,sfx:.8,mute:false,palette:'normal',aimAssist:false,slowBullets:false,quality:'auto'});

const read=()=>{try{const t=localStorage.getItem(KEY);return t?JSON.parse(t):null}catch(e){return null}};
const stored=read();
const OPTS=Object.assign(defaultOpts(),stored||{});

function saveOpts(){try{localStorage.setItem(KEY,JSON.stringify(OPTS))}catch(e){}}
// A save from before v15 carried its options. The first time this device loads such a save, and has
// no options of its own yet, it takes them over; after that the device's own choices win.
function adoptOpts(o){
  if(!o||typeof o!=='object'||read())return false;
  for(const k of Object.keys(defaultOpts()))if(k in o)OPTS[k]=o[k];
  saveOpts();return true;
}
// Back to the defaults.
function resetOpts(){Object.assign(OPTS,defaultOpts());saveOpts()}

export {OPTS,defaultOpts,saveOpts,adoptOpts,resetOpts};
