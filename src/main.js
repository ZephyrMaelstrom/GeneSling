/* ================= Entry point =================
   Loads every module in the old v5 load order, exposes the game's top-level names on
   window (tests and the browser console drive the game through them, as in v5), then boots.
   window.gameReady resolves once the save is loaded and the hideout is drawn. */
import * as rng from './rng.js';
import * as util from './util.js';
import * as content from './content.js';
import * as saves from './save.js';
import * as state from './state.js';
import * as sprites from './sprites.js';
import * as audio from './audio.js';
import * as map from './map.js';
import * as ui from './ui.js';
import * as raid from './raid.js';
import * as draw from './draw.js';

for(const mod of [rng,util,content,saves,state,sprites,audio,map,ui,raid,draw]){
  for(const k of Object.keys(mod)){
    // Getters, so values a module reassigns (S, R, ...) always read live.
    try{Object.defineProperty(window,k,{get:()=>mod[k],configurable:true,enumerable:false})}catch(e){}
  }
}
window.gameReady=draw.boot();
