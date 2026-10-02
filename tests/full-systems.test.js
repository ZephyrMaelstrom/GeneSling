// The v5 systems sweep: tabs, tutorial, evolution, research, NPC quests, every attack form,
// combos, room mods, curses, bosses, a floor-1 raid with death, and a floor-3 boss with extraction.
import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {startServer, launch, openGame} from './helpers.js';

let srv, browser;
before(async () => { srv = await startServer(); browser = await launch(); });
after(async () => { await browser.close(); srv.server.close(); });

test('every v5 system runs without errors', {timeout: 120000}, async () => {
 const {page, errors} = await openGame(browser, srv.url);
 const out=await page.evaluate(async()=>{const wait=ms=>new Promise(r=>setTimeout(r,ms));const o=[];const step=async(name,f)=>{try{await f()}catch(err){o.push('ERR@'+name+': '+err.message+' '+err.stack.split('\n').slice(1,3).join(' '))}};
  o.push('intro modal '+!$('#modal').hidden);closeModal();
  await step('tabs',async()=>{for(const t of TABS.map(x=>x[0])){ui.tab=t;renderAll();await wait(30)}
    for(const c of ['creatures','enemies','bosses','journal','reactions','story']){ui.tab='codex';ui.codex=c;renderAll();await wait(10)}
    for(const t of [...TYPE_IDS,'hybrid']){ui.dexType=t;ui.codex='creatures';renderAll();await wait(5)}
    for(const k of [...SECTION_IDS,'log']){ui.tab='hideout';ui.section=k;renderAll();await wait(10)}
    ui.tab='hideout';renderAll();await wait(300);o.push('map raf '+!!HMAP.raf);openNpc('brannoc');o.push('npc modal '+$('#modalBox').innerText.slice(0,60).replace(/\n/g,' '));closeModal()});
  await step('tutorial',async()=>{startRaid('tutorial');await wait(100);
    R.p.x+=150;await wait(100);R.p.x-=150;await wait(100);o.push('tut step '+R.tut.step);
    R.enemies.filter(e=>e.id==='dummy').forEach(e=>hurtEnemy(e,999,false,'p'));await wait(100);o.push('tut step '+R.tut.step);
    doRoll();await wait(100);useAbility(0);if(R.comps[0].abil===0)useAbility(0);await wait(100);o.push('tut step '+R.tut.step+' abil '+R.tut.abil);
    const B=R.map.rooms[1];R.p.x=B.cx-100;R.p.y=B.cy;await wait(200);o.push('tut step '+R.tut.step+' wild '+!!R.tut.wild);
    const w=R.tut.wild;w.x=R.p.x+50;w.y=R.p.y;hurtEnemy(w,w.maxHp*.6,false,'p');await wait(150);o.push('tut step '+R.tut.step);
    useCage();await wait(100);o.push('tut step '+R.tut.step+' slot3 '+(R.slot3&&R.slot3.c.name));
    swapSlot3(0);await wait(150);o.push('tut step '+R.tut.step);
    const C=R.map.rooms[2];R.p.x=C.cx;R.p.y=C.cy;R.comps.forEach(m=>{if(m){m.x=C.cx;m.y=C.cy}});await wait(3200);
    o.push('tutorial done '+S.tutorialDone+' creatures '+S.creatures.length+' modal '+$('#modalBox').innerText.slice(0,40).replace(/\n/g,' '));closeModal()});
  await step('evolve',async()=>{const c=byId(S.loadout.slots[0]);act('lab-evoready',{});const f0=formName(c);act('evolve',{id:c.id});o.push('evolved '+f0+' -> '+formName(c)+' atk '+stats(c).atkId);closeModal()});
  await step('research',async()=>{S.coin+=2000;S.ore+=500;S.shards+=10;for(const k of RES_IDS)for(let i=0;i<3;i++)buyResearch(k);o.push('research '+JSON.stringify(S.research))});
  await step('npc',async()=>{S.stats.weaponsHome=3;o.push('brannoc quest '+JSON.stringify(npcQuest('brannoc')));act('turnin',{k:'brannoc'});o.push('brannoc q '+S.npc.brannoc.q+' blueprint carbine '+!!S.blueprints.carbine);closeModal()});
  await step('arena-systems',async()=>{S.settings.god=true;startRaid('arena');await wait(100);
    const r=R.map.start;
    // every attack kind via every species line form
    let n=0;for(const sp in LINES){LINES[sp].forEach((f,i)=>{const c=makeCreature(sp,'bred',30,{stage:i});const m=makeComp(c);spawnFoe(spawnPos(r),'husk',1,r);const tg=R.enemies[R.enemies.length-1];const K=ATTACKS[m.st.atkId];if(K.kind!=='dash')compAttack(m,tg,K);doAbility(m,m.st.abilId);n++})}
    await wait(1500);o.push('forms tested '+n+' bullets '+R.bullets.length+' fields '+R.fields.length+' reactions '+S.stats.reactions);
    R.enemies=[];R.bullets=[];R.fields=[];
    // combos
    const pairs=Object.keys(COMBOS).concat(['ember+ember','tide+warden']);
    for(const k of pairs){const[t1,t2]=k.split('+');R.comps=[makeComp(makeCreature(speciesOf(t1)[0],'bred',10)),makeComp(makeCreature(speciesOf(t2)[0],'bred',10))];for(let i=0;i<4;i++)spawnFoe(spawnPos(r,100),'husk',1,r);R.combo.cd=0;useCombo();await wait(400)}
    o.push('combos used '+S.stats.combos+' reactions '+S.stats.reactions);
    // room mods & curses
    for(const md of ROOM_MOD_IDS){r.mod=md;spawnFoe(spawnPos(r),'husk',1,r);await wait(200)}r.mod=null;
    for(const c of CURSE_IDS)applyCurse(c);await wait(300);o.push('curses '+R.curses.size+' maxHp '+R.p.maxHp);
    // bosses
    for(const id of BOSS_IDS){R.enemies=[];spawnBoss(r,id);R.boss.cd=0;await wait(1200)}
    o.push('bosses ok');
    R.enemies=[];endRaid('arena');await wait(50);closeModal()});
  await step('raid',async()=>{S.settings.god=true;startRaid('raid',1);await wait(100);
    for(const rm of R.map.rooms){if(rm.kind==='secret')continue;R.p.x=rm.cx;R.p.y=rm.cy+60;R.mouse={x:700,y:300};R.firing=true;await wait(250)}
    o.push('f1 enemies '+R.enemies.length+' mods '+R.map.rooms.filter(x=>x.mod).map(x=>x.mod).join(','));
    R.enemies=[];R.bullets=[];R.map.rooms.forEach(x=>x.locked=false);const st=R.map.rooms.find(x=>x.kind==='stairs');st.spawned=true;R.p.x=st.cx;R.p.y=st.cy;R.cur=st;await wait(1500);
    o.push('floor '+R.map.floor);endRaid('dead');await wait(50);o.push('death modal '+$('#modalBox').innerText.slice(0,120).replace(/\n+/g,' / '));closeModal();
    o.push('keeper '+S.keeper.level+' xp '+S.keeper.xp+' deepest '+S.progress.deepest+' pip '+!!S.npc.pip)});
  await step('boss3',async()=>{S.loadout.slots.forEach(id=>{const c=byId(id);if(c){c.level=12;c.hp=stats(c).hp}});startRaid('raid',3);await wait(100);const br=R.map.rooms.find(x=>x.kind==='boss');R.p.x=br.cx;R.p.y=br.cy+80;await wait(300);
    R.boss.hp=1;hurtEnemy(R.boss,5,false,'p');await wait(200);o.push('shards '+S.shards+' memories '+JSON.stringify(S.progress.bosses));R.enemies=[];R.p.x=br.cx-80;R.p.y=br.cy;await wait(2300);o.push('extract '+(!R||R.over));o.push($('#modalBox').innerText.slice(0,200).replace(/\n+/g,' / '));closeModal()});
  await step('final-tabs',async()=>{for(const t of TABS.map(x=>x[0])){ui.tab=t;renderAll();await wait(20)}ui.tab='codex';ui.codex='bosses';renderAll();o.push('dex '+dexScore()+'/'+DEX_TOTAL())});
  return o.join('\n')});
 const lines=out.split('\n');const has=re=>lines.some(l=>re.test(l));
 console.log(out);
 assert.ok(!has(/^ERR@/), 'a step threw:\n'+lines.filter(l=>l.startsWith('ERR@')).join('\n'));
 assert.ok(has(/^intro modal true$/));
 assert.ok(has(/^map raf true$/));
 assert.ok(has(/^tut step 8$/), 'tutorial reaches its last step');
 assert.ok(has(/^tutorial done true creatures \d+ modal Tutorial complete/));
 assert.ok(has(/^evolved \S+ -> \S+ atk \w+/) && !has(/^evolved (\S+) -> \1 /), 'evolution changes the form');
 assert.ok(has(/^research \{"combat":3,"capture":3,"breeding":3,"economy":3,"bond":3\}$/));
 assert.ok(has(/^brannoc q 1 blueprint carbine true$/));
 assert.ok(has(/^forms tested 100 /));   // 91 v5 forms plus Phase 5's nine Venom forms
 assert.ok(has(/^combos used 12 /));
 assert.ok(has(/^curses 6 /));
 assert.ok(has(/^bosses ok$/));
 assert.ok(has(/^floor 2$/), 'took the stairs to floor 2');
 assert.ok(has(/^death modal Lost in the dungeon/));
 assert.ok(has(/^extract true$/), 'extracted after the floor-3 boss');
 assert.ok(has(/^dex \d+\/\d+$/));
 assert.deepEqual(errors, []);
});
