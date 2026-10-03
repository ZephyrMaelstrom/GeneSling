/* ================= Entry point =================
   Loads every module in the old v5 load order, then boots. window.gameReady resolves once the
   save is loaded and the hideout is drawn.

   The dev build (dist-dev/, built for the tests and `npm run dev`) also exposes the game to the
   browser console and the test suite: window.gs holds every module's exports, and each name is
   also put on window itself, so tests can write startRaid(...) as before. The release build
   (dist/, what GitHub Pages serves) exposes nothing but gameReady. */
import * as rng from './rng.js';
import * as events from './events.js';
import * as actions from './actions.js';
import * as device from './device.js';
import * as history from './history.js';
import * as creatureui from './creatureui.js';
import * as util from './util.js';
import * as content from './content.js';
import * as genetics from './genetics.js';
import * as jobs from './jobs.js';
import * as saves from './save.js';
import * as state from './state.js';
import * as geneui from './geneui.js';
import * as workui from './workui.js';
import * as supply from './supply.js';
import * as flags from './flags.js';
import * as hideout from './hideout.js';
import * as demo from './demo.js';
import * as share from './share.js';
import * as prideui from './prideui.js';
import * as bloom from './bloom.js';
import * as veins from './veins.js';
import * as bloomui from './bloomui.js';
import * as endgame from './endgame.js';
import * as endgameui from './endgameui.js';
import * as lore from './lore.js';
import * as loreui from './loreui.js';
import * as balance from './balance.js';
import * as journey from './journey.js';
import * as journeyui from './journeyui.js';
import * as access from './access.js';
import * as playtest from './playtest.js';
import * as exchange from './exchange/engine.js';
import * as market from './exchange/market.js';
import * as xclient from './exchange/client.js';
import * as sandbox from './exchange/sandbox.js';
import * as sprites from './sprites.js';
import * as audio from './audio.js';
import * as map from './map.js';
import * as ui from './ui.js';
import * as raid from './raid.js';
import * as draw from './draw.js';

if(flags.DEV){
  const gs={};
  for(const mod of [rng,events,actions,device,history,creatureui,util,content,genetics,jobs,saves,state,geneui,workui,supply,flags,hideout,demo,share,prideui,bloom,veins,bloomui,endgame,endgameui,lore,loreui,balance,journey,journeyui,access,playtest,exchange,market,xclient,sandbox,sprites,audio,map,ui,raid,draw]){
    for(const k of Object.keys(mod)){
      // Getters, so values a module reassigns (S, R, ...) always read live.
      const get={get:()=>mod[k],configurable:true,enumerable:true};
      Object.defineProperty(gs,k,get);
      try{Object.defineProperty(window,k,{...get,enumerable:false})}catch(e){}
    }
  }
  window.gs=gs;
}
window.gameReady=draw.boot();
