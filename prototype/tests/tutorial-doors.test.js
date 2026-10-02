const path=require('path');const puppeteer=require('puppeteer');const GAME='file://'+path.resolve(__dirname,'..','index.html');const LAUNCH={executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox']};
(async()=>{
 const b=await puppeteer.launch(LAUNCH);const p=await b.newPage();
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.setViewport({width:1200,height:820});
 await p.goto(GAME);await new Promise(r=>setTimeout(r,500));
 await p.evaluate(async()=>{closeModal();startRaid('tutorial');});
 await new Promise(r=>setTimeout(r,200));
 const st=()=>p.evaluate(()=>({step:R.tut.step,x:Math.round(R.p.x),cur:R.map.rooms.indexOf(R.cur)}));
 // walk around
 await p.keyboard.down('d');await new Promise(r=>setTimeout(r,800));await p.keyboard.up('d');
 await p.keyboard.down('a');await new Promise(r=>setTimeout(r,800));await p.keyboard.up('a');
 console.log(await st());
 await p.evaluate(()=>R.enemies.filter(e=>e.id==='dummy').forEach(e=>hurtEnemy(e,999,false,'p')));await new Promise(r=>setTimeout(r,200));
 await p.keyboard.press('Space');await new Promise(r=>setTimeout(r,300));
 await p.keyboard.press('q');await new Promise(r=>setTimeout(r,300));
 console.log(await st());
 await p.evaluate(()=>{R.p.y=R.map.rooms[0].cy});
 await p.keyboard.down('d');await new Promise(r=>setTimeout(r,4000));await p.keyboard.up('d');
 console.log(await st());
 // finish: catch etc via shortcuts
 await p.evaluate(async()=>{const w=R.tut.wild;w.x=R.p.x+50;w.y=R.p.y;hurtEnemy(w,w.maxHp*.6,false,'p')});await new Promise(r=>setTimeout(r,200));
 await p.evaluate(()=>useCage());await new Promise(r=>setTimeout(r,200));
 await p.evaluate(()=>swapSlot3(0));await new Promise(r=>setTimeout(r,200));
 console.log(await st());
 await p.evaluate(()=>{R.p.y=R.map.rooms[1].cy});
 await p.keyboard.down('d');await new Promise(r=>setTimeout(r,4000));await p.keyboard.up('d');
 console.log(await st(), await p.evaluate(()=>typeof R!=='undefined'&&R?R.prompt:'raid ended'));
 console.log(errs.length?errs:'no errors');await b.close();if(errs.length)process.exit(1);
})();
