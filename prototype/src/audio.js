/* ================= Sound: synthesized effects and generative music ================= */
const AU={ctx:null,master:null,mus:null,fx:null,noise:null,last:{},track:null,timer:null,step:0,next:0,mel:[],bar:0};
function auInit(){
  if(AU.ctx)return true;
  try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
    AU.ctx=new C();AU.master=AU.ctx.createGain();AU.master.connect(AU.ctx.destination);
    AU.mus=AU.ctx.createGain();AU.mus.connect(AU.master);AU.fx=AU.ctx.createGain();AU.fx.connect(AU.master);
    const b=AU.ctx.createBuffer(1,Math.floor(AU.ctx.sampleRate*.6),AU.ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;AU.noise=b;
    auVol();AU.timer=setInterval(musicTick,25);return true}catch(e){AU.ctx=null;return false}
}
function auVol(){if(!AU.ctx||!S)return;const o=S.opts;AU.master.gain.value=o.mute?0:o.vol;AU.mus.gain.value=o.music*.32;AU.fx.gain.value=o.sfx*.5}
function tone(freq,dur,type='square',vol=.3,slide=0,when=0,dest,abs){
  const c=AU.ctx,t0=abs!=null?abs:c.currentTime+when;const o=c.createOscillator(),g=c.createGain();
  o.type=type;o.frequency.setValueAtTime(freq,t0);if(slide)o.frequency.exponentialRampToValueAtTime(Math.max(30,freq*slide),t0+dur);
  g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(vol,t0+.006);g.gain.exponentialRampToValueAtTime(.001,t0+dur);
  o.connect(g);g.connect(dest||AU.fx);o.start(t0);o.stop(t0+dur+.03);
}
function noise(dur,vol=.3,fc=2000,q=1,when=0,type='bandpass',dest,abs){
  const c=AU.ctx,t0=abs!=null?abs:c.currentTime+when;const s=c.createBufferSource();s.buffer=AU.noise;
  const f=c.createBiquadFilter();f.type=type;f.frequency.value=fc;f.Q.value=q;const g=c.createGain();
  g.gain.setValueAtTime(vol,t0);g.gain.exponentialRampToValueAtTime(.001,t0+dur);s.connect(f);f.connect(g);g.connect(dest||AU.fx);s.start(t0);s.stop(t0+dur+.03);
}
const SFX={
  shot:()=>tone(rnd(600,760),.07,'square',.1,.5),
  heavy:()=>{tone(180,.15,'sawtooth',.16,.4);noise(.1,.14,800)},
  swing:()=>noise(.12,.22,1800,.8,0,'highpass'),
  hit:()=>noise(.05,.16,2500,2),
  kill:()=>tone(520,.15,'square',.11,.3),
  hurt:()=>{tone(140,.2,'sawtooth',.24,.5);noise(.12,.15,600)},
  capture:()=>[523,659,784,1047].forEach((f,i)=>tone(f,.14,'triangle',.22,0,i*.08)),
  fail:()=>[392,330].forEach((f,i)=>tone(f,.16,'square',.14,0,i*.1)),
  level:()=>[523,659,784].forEach((f,i)=>tone(f,.12,'triangle',.2,0,i*.07)),
  evolve:()=>[392,523,659,784,1047,1319].forEach((f,i)=>tone(f,.28,'triangle',.18,0,i*.09)),
  boss:()=>{tone(70,1.2,'sawtooth',.28,.6);tone(73,1.2,'sawtooth',.22,.6);noise(1,.2,300,.5)},
  react:()=>{tone(1200,.18,'sine',.18,1.5);tone(1800,.12,'sine',.12,1.2,.04)},
  pickup:()=>tone(880,.08,'triangle',.18,1.5),
  ui:()=>tone(660,.04,'triangle',.08),
  ability:()=>{tone(300,.25,'triangle',.2,2);noise(.2,.1,1200)},
  combo:()=>{[262,330,392,523].forEach(f=>tone(f,.5,'sawtooth',.07));noise(.4,.18,900,.6)},
  roll:()=>noise(.12,.12,900,.7),
  door:()=>tone(110,.25,'square',.14,.8),
  coin:()=>{tone(988,.06,'square',.07);tone(1319,.1,'square',.07,0,.05)},
  quest:()=>[659,784,988,1319].forEach((f,i)=>tone(f,.18,'triangle',.18,0,i*.1)),
};
function sfx(n){if(!AU.ctx||!S||S.opts.mute)return;const now=performance.now();if(AU.last[n]&&now-AU.last[n]<45)return;AU.last[n]=now;try{SFX[n]&&SFX[n]()}catch(e){}}

const TRACKS={
  hideout:{bpm:76,root:57,scale:[0,2,4,7,9],bass:[0,null,null,null,null,null,null,null,5,null,null,null,null,null,null,null],bw:'triangle',lw:'triangle',dens:.3,hat:false,pad:[0,4,7]},
  depths:{bpm:96,root:50,scale:[0,3,5,7,10],bass:[0,null,0,null,7,null,0,null,3,null,3,null,7,null,5,null],bw:'square',lw:'triangle',dens:.35,hat:true,pad:[0,3,7]},
  abyss:{bpm:106,root:45,scale:[0,1,5,7,8],bass:[0,0,null,0,null,0,1,null,0,0,null,0,null,7,8,null],bw:'sawtooth',lw:'square',dens:.3,hat:true,pad:[0,1,7]},
  boss:{bpm:138,root:45,scale:[0,1,3,7,8],bass:[0,0,12,0,0,12,0,0,3,3,15,3,1,1,13,1],bw:'sawtooth',lw:'square',dens:.55,hat:true,pad:null},
};
const mtof=m=>440*Math.pow(2,(m-69)/12);
function newMelody(T){AU.mel=Array.from({length:16},(_,i)=>Math.random()<T.dens*(i%2?.6:1.3)?T.scale[ri(0,T.scale.length-1)]+12*ri(1,2):null)}
function musicFor(){if(R&&!R.over){if(R.boss&&R.boss.hp>0)return'boss';return R.map&&R.map.floor>=4?'abyss':'depths'}return'hideout'}
function musicTick(){
  if(!AU.ctx||!S)return;
  const want=musicFor();
  if(want!==AU.track){AU.track=want;AU.step=0;AU.bar=0;AU.next=AU.ctx.currentTime+.05;newMelody(TRACKS[want])}
  if(S.opts.mute||S.opts.music<=0){AU.next=AU.ctx.currentTime+.05;return}
  const T=TRACKS[AU.track],sixteenth=60/T.bpm/4;
  while(AU.next<AU.ctx.currentTime+.12){
    const st=AU.step%16,t0=AU.next;
    const b=T.bass[st];if(b!=null)tone(mtof(T.root-12+b),sixteenth*1.8,T.bw,.16,0,0,AU.mus,t0);
    const m=AU.mel[st];if(m!=null)tone(mtof(T.root+m),sixteenth*1.6,T.lw,.07,0,0,AU.mus,t0);
    if(T.hat&&st%2===1)noise(.03,.05,7000,1,0,'highpass',AU.mus,t0);
    if(T.hat&&(st===4||st===12)&&AU.track!=='hideout')noise(.08,.07,1500,1,0,'bandpass',AU.mus,t0);
    if(T.pad&&st===0)T.pad.forEach(p=>tone(mtof(T.root+p),sixteenth*16,'sine',.05,0,0,AU.mus,t0));
    AU.next+=sixteenth;AU.step++;
    if(AU.step%64===0){AU.bar++;if(AU.bar%2===0)newMelody(T)}
  }
}
['pointerdown','keydown','touchstart'].forEach(ev=>document.addEventListener(ev,()=>{if(auInit()&&AU.ctx.state==='suspended')AU.ctx.resume()},{passive:true}));
