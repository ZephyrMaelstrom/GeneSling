/* Every panel's content, the flat-screen HUD and the VR wrist display. */
import * as THREE from 'three';
import {G, on, emit} from './ctx.js';
import {VR} from './data.js';
import {Panel} from './panel.js';
import {makeLabel} from './gfx.js';
import {SPECIES, TYPES} from './sim-core/content.js';
import {GENETICS as GX} from './sim-core/content.js';
import {breedOdds, carriedTraits} from './sim-core/genetics.js';
import {creatureById, stats, typeName, persName, traitName, where, bondStars, canBreed, breed, hatch, canAfford, isClaimed, ZONE, zoneAt, keeperXp, objective, unpost, resetSave, borderX} from './state.js';
import {stationOutput, workUnits, post, postable, setSlot, sleep, craft, startSurge, updateSigns, refreshHome, pet, packCount} from './home.js';
import {syncParty} from './combat.js';

let panel;
export function initUI() { panel = new Panel(); G.panelObj = panel; }
G.openPanel = (kind, arg) => {
  const b = BUILD[kind]; if (!b) return;
  G.panelKind = kind; panel.open(p => b(p, arg));
  if (!G.xr && document.pointerLockElement) document.exitPointerLock();
  emit('panel', kind);
};
G.closePanel = () => { panel.close(); G.panelKind = null; };
const reopen = (k, a) => G.openPanel(k, a);

const GENE_NAMES = {pow: 'Power', vig: 'Vigor', swf: 'Swift', tem: 'Tempo', foc: 'Focus', grt: 'Grit', kn: 'Knack', yld: 'Yield'};
const sexIcon = s => s === 'F' ? '♀' : '♂';
const line = c => `${c.name} · ${SPECIES[c.species].name} ${sexIcon(c.sex)} · Lv ${c.lvl} · Gen ${c.gen}`;
const itemsLine = o => Object.entries(o).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing';
const PER = 6;
function paged(p, list, row) {
  const pages = Math.max(1, Math.ceil(list.length / PER)), pg = Math.min(p.page, pages - 1);
  list.slice(pg * PER, pg * PER + PER).forEach(row);
  if (pages > 1) { p.br(); p.btn('◀ Prev', () => p.setPage(Math.max(0, pg - 1)), {on: pg > 0}); p.btn(`Page ${pg + 1} / ${pages}`, () => {}, {on: false}); p.btn('Next ▶', () => p.setPage(Math.min(pages - 1, pg + 1)), {on: pg < pages - 1}); }
}

const BUILD = {
  wrist(p, tab = 'status') {
    const S = G.S, P = G.player;
    p.title('Wrist', `Day ${S.day} · ${timeOfDay()} · Keeper rank ${S.rank}`);
    for (const [k, l] of [['status', 'Status'], ['pack', 'Pack'], ['party', 'Party'], ['goals', 'Goals'], ['settings', 'Settings']]) p.btn(l, () => reopen('wrist', k), {accent: tab === k});
    p.sep();
    if (tab === 'status') {
      p.bar('Your HP', P.hp / P.maxHp, {right: `${Math.round(P.hp)} / ${P.maxHp}`});
      p.bar('Keeper XP', S.kxp / (VR.KEEPER_RANK_COST * S.rank / 10), {color: '#ffb347', right: `rank ${S.rank}`});
      p.text(`Where: ${G.inDelve ? 'The Delve' : zoneAt(P.pos.x).name}${S.trip ? ' — on an expedition' : ' — safe on your land'}`);
      if (S.trip) p.text(`Pack: ${itemsLine(S.trip.pack)}; ${S.trip.caught.length} caught. Hold the gate circle or a Waystone for ${VR.HOLD_SECONDS} s to bring it home.`, {color: '#ffd9a0'});
      for (const t of S.taken) { const c = creatureById(t.id); if (c) p.text(`${c.name} was taken by the Bloom in ${ZONE(t.zone).name}. Cage it there by day ${t.until} to bring it back.`, {color: '#ff9a8a'}); }
      p.text(`Cages ${S.items.cage || 0} · Food ${S.items.food || 0} · Lure ${S.items.lure || 0} · Tonics ${S.items.tonic || 0} · Coin ${S.coin}`, {color: '#bdb3d6'});
    } else if (tab === 'pack') {
      p.text('At home: ' + itemsLine(S.items));
      if (S.trip) { p.text('In your pack (lost if you fall): ' + itemsLine(S.trip.pack), {color: '#ffd9a0'}); }
      const caught = S.trip ? S.trip.caught : [];
      if (caught.length) { p.text('Caught this trip:', {bold: true}); for (const c of caught) { p.text(line(c), {indent: 10}); p.btn('Test it in slot 3', () => { S.party[2] = null; S.roster.push(c); S.trip.caught = S.trip.caught.filter(x => x !== c); S.party[2] = c.id; syncParty(); emit('toast', `${c.name} follows you in slot 3`); reopen('wrist', 'pack'); }); } }
    } else if (tab === 'party') {
      S.party.forEach((id, i) => {
        const c = id && creatureById(id), a = G.companions.find(x => x.slot === i);
        if (!c) { p.text(`Slot ${i + 1}: empty`, {color: '#8a80a8'}); return; }
        p.text(`Slot ${i + 1}: ${line(c)}`, {bold: true});
        if (a) p.bar('HP', a.hp / a.maxHp, {right: `${Math.round(a.hp)} / ${a.maxHp}`});
        if (i < 2) p.text(`Skill (${i + 1}): ${VR.SKILLS[c.type].name} — ${VR.SKILLS[c.type].desc}`, {color: '#bdb3d6', size: 20});
        p.btn('Page', () => reopen('creature', c.id));
      });
      p.text('Use both skills within 2 s for a combo.', {color: '#bdb3d6', size: 20});
    } else if (tab === 'goals') {
      for (const o of VR.OBJECTIVES) p.text(`${S.objectives[o.id] ? '✔' : '○'}  ${o.text}`, {color: S.objectives[o.id] ? '#7ee08a' : '#f1ecff', size: 21});
      p.sep(); p.text("Today's contracts:", {bold: true});
      for (const k of S.contracts.list) p.text(`${k.done ? '✔' : '○'}  ${k.text} → ${itemsLine(k.reward)}`, {size: 20, color: k.done ? '#7ee08a' : '#d8d0ee'});
    } else if (tab === 'settings') {
      const st = S.settings, t = (k, a, b) => () => { st[k] = st[k] === a ? b : a; reopen('wrist', 'settings'); };
      p.text('Comfort (VR):', {bold: true});
      p.btn(`Turning: ${st.turn}`, t('turn', 'snap', 'smooth')); p.btn(`Snap: ${st.snapDeg}°`, () => { st.snapDeg = st.snapDeg === 30 ? 45 : st.snapDeg === 45 ? 15 : 30; reopen('wrist', 'settings'); });
      p.btn(`Moving: ${st.move}`, t('move', 'smooth', 'teleport')); p.btn(`Vignette: ${st.vignette ? 'on' : 'off'}`, t('vignette', true, false));
      p.btn(`Seated: ${st.seated ? 'on' : 'off'}`, t('seated', true, false)); p.btn(`Left-handed: ${st.leftHanded ? 'on' : 'off'}`, t('leftHanded', true, false));
      p.br(); p.text('Play:', {bold: true});
      p.btn(`Aim assist: ${st.aimAssist ? 'on' : 'off'}`, t('aimAssist', true, false));
      p.br(); p.btn('Start a new game…', () => reopen('confirmReset'));
    }
  },
  confirmReset(p) {
    p.title('Start over?', 'This erases your save on this device.');
    p.btn('Yes, erase and restart', () => { resetSave(); location.reload(); }, {accent: true}); p.btn('No, keep playing', () => G.closePanel());
  },
  station(p, k) {
    const S = G.S, {units, out, st} = stationOutput(k), ids = S.posts[k];
    p.title(st.name, `${typeName(st.type)} station · ${st.slots} slots · off-type workers work at half rate`);
    p.text(`Output tomorrow: ${Object.entries(out).map(([m, v]) => `${v} ${m}`).join(', ') || 'nothing'}${Object.keys(st.takes).length ? ` · uses ${itemsLine(Object.fromEntries(Object.entries(st.takes).map(([m, n]) => [m, Math.ceil(units) * n])))} (you have ${itemsLine(Object.fromEntries(Object.keys(st.takes).map(m => [m, S.items[m] || 0])))})` : ''}`);
    p.sep();
    for (const id of ids) { const c = creatureById(id); if (!c) continue; p.text(`${line(c)} · +${workUnits(c, k)} units · fatigue ${Math.round(c.fatigue || 0)}`); p.btn('Remove', () => { unpost(id); updateSigns(); refreshHome(); reopen('station', k); }); }
    if (ids.length < st.slots) p.btn('Add a worker', () => reopen('pick', {title: `Post to ${st.name}`, filter: postable, info: c => `+${workUnits(c, k)} units (Yield ${c.genes.yld}${c.type === st.type ? ', type match' : ', off type'})`, sort: c => -workUnits(c, k), act: c => { post(c, k); reopen('station', k); }}), {accent: true});
  },
  pick(p, o) {
    const S = G.S, list = S.roster.filter(o.filter).sort((a, b) => o.sort ? o.sort(a) - o.sort(b) : 0);
    p.title(o.title, `${list.length} available`);
    if (!list.length) p.text('Nobody is free. Creatures in your party, or taken by the Bloom, can\'t be posted.', {color: '#bdb3d6'});
    paged(p, list, c => { p.text(`${line(c)} — ${o.info ? o.info(c) : where(c)}`, {size: 21}); p.btn('Choose', () => o.act(c)); });
  },
  sleep(p) {
    const S = G.S;
    p.title('Sleep until morning?', `Day ${S.day} → ${S.day + 1}`);
    p.text('Workers produce, creatures eat and heal, eggs grow, the Bloom pushes on unguarded land, and the valley\'s herds recover.');
    p.text(`Food: ${S.items.food || 0} for ${S.roster.length} creatures.`, {color: (S.items.food || 0) < S.roster.length ? '#ff9a8a' : '#bdb3d6'});
    p.btn('Sleep', () => { G.closePanel(); sleep(); }, {accent: true});
  },
  morning(p, report) {
    p.title(`Morning, day ${G.S.day}`);
    if (!report || !report.length) p.text('A quiet night.');
    for (const r of report || []) p.text('• ' + r);
    p.btn('Good morning', () => G.closePanel(), {accent: true});
  },
  pen(p) {
    const S = G.S, sel = G.penSel ||= {mom: null, dad: null}, m = creatureById(sel.mom), d = creatureById(sel.dad);
    p.title('Breeding pen', `Mother sets species and type; the father passes his better stat copy more often. Both need level ${VR.BREED_LEVEL}.`);
    p.btn(m ? `Mother: ${m.name} (${SPECIES[m.species].name})` : 'Choose a mother', () => reopen('pick', {title: 'Choose a mother', filter: c => c.sex === 'F' && !S.taken.some(t => t.id === c.id), info: c => `Lv ${c.lvl} · ${typeName(c.type)}`, act: c => { sel.mom = c.id; reopen('pen'); }}));
    p.btn(d ? `Father: ${d.name} (${SPECIES[d.species].name})` : 'Choose a father', () => reopen('pick', {title: 'Choose a father', filter: c => c.sex === 'M' && !S.taken.some(t => t.id === c.id) && (!m || c.type === m.type), info: c => `Lv ${c.lvl} · ${typeName(c.type)}`, act: c => { sel.dad = c.id; reopen('pen'); }}));
    p.sep();
    const why = canBreed(m, d);
    if (m && d && !why) {
      const odds = breedOdds(m, d);
      p.text('Predicted grades for the egg (before mutation):', {bold: true});
      for (const k of ['pow', 'vig', 'swf', 'tem', 'foc', 'grt', 'yld']) {
        const g = odds.grades[k], lo = g[0][0], hi = g[g.length - 1][0], ev = g.reduce((a, [v, q]) => a + v * q, 0);
        p.bar(GENE_NAMES[k], ev / 11, {right: lo === hi ? `${lo}` : `${lo}–${hi} (avg ${ev.toFixed(1)})`, labelW: 120, w: 340});
      }
      p.btn('Breed this pair', () => { const r = breed(m, d); objective('breed'); keeperXp(10); emit('toast', `${r.eggs.length > 1 ? 'Twin eggs!' : 'An egg'} — it goes to the Nursery${r.inbred ? ' (related parents: defect risk)' : ''}`); updateSigns(); G.penSel = {mom: null, dad: null}; reopen('nursery'); }, {accent: true});
    } else p.text(why || 'Choose a pair.', {color: '#bdb3d6'});
  },
  nursery(p) {
    const S = G.S;
    p.title('Nursery', 'Eggs hatch after 2 to 4 homestead days. Sleep to pass a day.');
    if (!S.eggs.length) p.text('No eggs yet. Breed a pair in the pen.', {color: '#bdb3d6'});
    for (const e of S.eggs) {
      const ready = e.hatchDay <= S.day, mom = creatureById(e.mom), dad = creatureById(e.dad);
      p.text(`${SPECIES[e.species].name} egg · Gen ${e.gen} · from ${mom ? mom.name : '?'} × ${dad ? dad.name : '?'}${e.mutations ? ' · it feels different…' : ''}`);
      if (ready) p.btn('Hatch it', () => { const c = hatch(e); objective('hatch'); emit('toast', `${c.name} hatched!`); emit('hatched', c); refreshHome(); updateSigns(); reopen('creature', c.id); }, {accent: true});
      else p.btn(`${e.hatchDay - S.day} day${e.hatchDay - S.day > 1 ? 's' : ''} to go`, () => {}, {on: false});
    }
  },
  craft(p) {
    const S = G.S;
    p.title('Workbench', `You have: ${itemsLine(S.items)}`);
    for (const r of VR.RECIPES) { p.text(`${r.name} — costs ${itemsLine(r.cost)}`, {size: 22}); p.btn('Craft', () => { craft(r); reopen('craft'); }, {on: canAfford(r.cost)}); }
    p.sep(); p.text('Ore comes from rocks in the wild, fiber from reeds, herbs from flowers. The Forge turns ore into ingots overnight; the Garden grows food and herbs; the Spring brews tonics.', {size: 20, color: '#bdb3d6'});
  },
  board(p, tab = 'roster') {
    const S = G.S;
    p.title('Contract board', `${S.roster.length} creatures · day ${S.day}`);
    for (const [k, l] of [['roster', 'Roster'], ['contracts', 'Contracts'], ['memorial', 'Memorial']]) p.btn(l, () => reopen('board', k), {accent: tab === k});
    p.sep();
    if (tab === 'contracts') { for (const k of S.contracts.list) p.text(`${k.done ? '✔' : '○'}  ${k.text} → ${itemsLine(k.reward)}`); p.text('Contracts pay when you extract with what they ask for. New ones each day.', {color: '#bdb3d6', size: 20}); }
    else if (tab === 'memorial') { const m = S.memorial || []; if (!m.length) p.text('No one lost yet. Keep it that way.', {color: '#bdb3d6'}); for (const x of m) p.text(`${x.name} the ${SPECIES[x.species].name} — lost on day ${x.day}`); }
    else paged(p, S.roster.slice().sort((a, b) => b.lvl - a.lvl), c => { p.text(`${line(c)} · ${where(c)}`, {size: 21}); p.btn('Page', () => reopen('creature', c.id)); });
  },
  creature(p, id) {
    const S = G.S, c = creatureById(id); if (!c) { p.title('Gone'); return; }
    const st = stats(c), L = c.looks, sp = SPECIES[c.species];
    p.title(`${c.name} ${sexIcon(c.sex)}`, `${sp.name} · ${typeName(c.type)} · Lv ${c.lvl} · Gen ${c.gen}${c.gen >= 3 ? ' · cut free' : ''} · ${persName(c.pers)} · bond ★${bondStars(c.bond || 0)}`);
    p.text(`${where(c)} · HP ${st.hp} · Attack ${st.atk} · Fatigue ${Math.round(c.fatigue || 0)}`, {size: 21, color: '#bdb3d6'});
    for (const k of ['pow', 'vig', 'swf', 'tem', 'foc', 'grt', 'kn', 'yld']) p.bar(GENE_NAMES[k], c.genes[k] / 11, {right: `${c.genes[k]}  (${c.genome[k][0]} / ${c.genome[k][1]})`, labelW: 120, w: 300, color: c.genome[k].includes(11) ? '#ffd23f' : '#7ee08a'});
    const carried = carriedTraits(c);
    p.text(`Traits: ${c.traits.map(traitName).join(', ') || 'none'}${carried.length ? ` · carries ${carried.map(traitName).join(', ')}` : ''}`, {size: 21});
    p.text(`Looks: ${GX.HUES[L.hue]} ${GX.PATTERNS[L.pat]}, ${GX.SIZES[L.size]}${L.shine === 1 ? ', Prismatic' : L.shine === 2 ? ', Bloomscar' : ''}`, {size: 21});
    if (c.history.length) p.text(c.history.slice(-2).join(' · '), {size: 19, color: '#bdb3d6'});
    if (!S.taken.some(t => t.id === c.id)) {
      p.btn('Slot 1', () => { setSlot(c, 0); reopen('creature', id); }); p.btn('Slot 2', () => { setSlot(c, 1); reopen('creature', id); }); p.btn('Slot 3', () => { setSlot(c, 2); reopen('creature', id); });
      if (S.party.includes(c.id) || Object.values(S.posts).some(v => v.includes(c.id))) p.btn('Rest at home', () => { unpost(c.id); syncParty(); refreshHome(); reopen('creature', id); });
      if (!S.trip) p.btn(c.pettedDay === S.day ? 'Petted today' : 'Pet (+bond)', () => { pet(c); reopen('creature', id); }, {on: c.pettedDay !== S.day});
    }
  },
  heartroot(p, zid) {
    const S = G.S, z = ZONE(zid), zs = S.zones[zid];
    if (!zs.claimed) {
      p.title(`${z.name} Heartroot`, 'The Bloom\'s grip on this land.');
      p.text(`Plant a Ward Stone here and the Bloom will Surge: ${z.surge.waves} waves over ${z.surge.seconds} seconds against the stone. Keep it standing and ${z.name} becomes yours — calm wilds, a new border, ${zid === 'thorn' ? 'a Quarry outpost, ' : ''}and land to build on.`);
      p.text('Claimed land needs guards. Unguarded, its Bloom pressure rises 20% a day and at 100% the land is lost.', {color: '#bdb3d6', size: 21});
      if (G.surge) p.text('A Surge is already under way.', {color: '#ff9a8a'});
      else p.btn((S.items.ward || 0) > 0 ? 'Plant the Ward Stone — start the Surge' : 'You need a Ward Stone', () => { G.closePanel(); startSurge(zid); }, {accent: true, on: (S.items.ward || 0) > 0});
    } else {
      const key = 'guard_' + zid, ids = S.posts[key];
      p.title(`${z.name} — yours`, `Bloom pressure ${zs.pressure}% · ${ids.length} guard${ids.length === 1 ? '' : 's'} (each lowers pressure 15% a day)`);
      for (const id of ids) { const c = creatureById(id); if (c) { p.text(`${line(c)} · Grit ${c.genes.grt} · Vigor ${c.genes.vig}`); p.btn('Remove', () => { unpost(id); refreshHome(); reopen('heartroot', zid); }); } }
      if (ids.length < 3) p.btn('Post a guard', () => reopen('pick', {title: `Guard ${z.name}`, filter: postable, info: c => `Grit ${c.genes.grt} · Vigor ${c.genes.vig}`, sort: c => -(c.genes.grt + c.genes.vig), act: c => { post(c, key); reopen('heartroot', zid); }}), {accent: true});
    }
  },
  report(p, r) {
    p.title(r.title);
    if (r.dead) {
      p.text(`Lost from your pack: ${r.items.map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing'}${r.caught.length ? `; ${r.caught.length} caught creature${r.caught.length > 1 ? 's' : ''}` : ''}.`, {color: '#ff9a8a'});
      for (const c of r.taken) p.text(`${c.name} was taken by the Bloom. Find it and cage it within ${VR.RECOVER_DAYS} days to bring it home.`, {color: '#ffd9a0'});
      p.text('You wake in your bed. A day has passed.', {color: '#bdb3d6'});
    } else {
      p.text(`Brought home: ${r.items.map(([k, n]) => `${n} ${k}`).join(', ') || 'no materials'}.`);
      for (const c of r.caught) p.text(`New: ${line(c)} — ${c.traits.map(traitName).join(', ') || 'no visible traits'}`, {color: '#7ee08a', size: 21});
      for (const k of r.contracts || []) p.text(`Contract done: ${k.text} → ${itemsLine(k.reward)}`, {color: '#ffd9a0', size: 21});
    }
    p.btn('Continue', () => G.closePanel(), {accent: true});
  },
  claimed(p, zid) {
    const z = ZONE(zid);
    p.title(`${z.name} is yours`);
    p.text(`Your border has moved east. Wild creatures here are calm and easier to tame.${zid === 'thorn' ? ' A Quarry outpost now stands in the meadow: post an Ember worker for ore.' : ''}`);
    p.text('Post guards at the Heartroot, or the Bloom will slowly take it back.', {color: '#ffd9a0'});
    p.btn('Post a guard now', () => reopen('heartroot', zid), {accent: true}); p.btn('Later', () => G.closePanel());
  },
  mvp(p) {
    const S = G.S;
    p.title('You closed the loop', 'Every MVP goal is done.');
    p.text(`Day ${S.day} · Keeper rank ${S.rank} · ${S.stats.catches} caged, ${S.stats.tames} tamed, ${S.stats.hatched} hatched, ${S.stats.extracts} expeditions home, ${S.stats.deaths} falls.`);
    p.text('Thank you for testing GeneSlingVR. Keep playing — Blightfen has a second Heartroot, and Rootmaw can be fought again.');
    p.btn('Keep playing', () => G.closePanel(), {accent: true});
  },
  intro(p) {
    p.title('GeneSlingVR', 'The Bloom has broken the surface.');
    p.text('Walk east through the Homestead gate into Thornmeadow. Weaken wild creatures with your sling and cage them, or crouch and offer food to tame the calm ones. Bring what you catch home through the gate. Breed, build, and plant a Ward Stone at the Heartroot to make the meadow yours.');
    p.text(G.xr ? 'Left stick moves, right stick turns. Left hand holds the sling: pinch the pouch with the right trigger, pull back, let go. Right grip makes a cage — throw it. Left trigger offers food. A sends your companions where you point, B recalls them, X and Y fire their skills. Press the left stick for your wrist panel.' : 'Click to look around. The goals list on the right walks you through the whole loop.', {color: '#bdb3d6', size: 21});
    p.btn('Let\'s go', () => G.closePanel(), {accent: true});
  },
};
on('mvpDone', () => setTimeout(() => G.openPanel('mvp'), 1500));

export function timeOfDay() { const c = G.S.clock, h = Math.floor(c * 24), m = Math.floor((c * 24 - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; }

/* ---------- flat-screen HUD ---------- */
const $ = s => document.querySelector(s);
let hudT = 0;
export function updateHUD(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = 0.2;
  const S = G.S, P = G.player, zone = G.inDelve ? {name: 'The Delve'} : zoneAt(P.pos.x);
  const comp = G.companions.filter(c => c.slot < 2).map(c => `${c.c.name} ${Math.round(c.hp)}/${c.maxHp} · skill ${c.skillT > 0 ? Math.ceil(c.skillT) + 's' : 'ready'}`).join('<br>');
  $('#status').innerHTML = `<b>${zone.name}</b> · day ${S.day} · ${timeOfDay()}<br>HP<div class="bar"><i style="width:${P.hp / P.maxHp * 100}%;background:${P.hp < P.maxHp * 0.3 ? '#ff6a5a' : ''}"></i></div>` +
    `Rank ${S.rank} · cages ${S.items.cage || 0} · food ${S.items.food || 0} · tonics ${S.items.tonic || 0}<br>` +
    (S.trip ? `<span style="color:#ffd9a0">Expedition — pack ${packCount()} (lost if you fall)</span><br>` : '<span style="color:#7ee08a">Safe on your land</span><br>') +
    (G.hold > 0 ? `Extracting<div class="bar"><i style="width:${G.hold * 100}%;background:#7fd6ff"></i></div>` : '') +
    (G.surge ? `<span style="color:#d49bff">Surge: stone ${Math.round(G.surge.hp)}/${G.surge.max} · ${Math.ceil(Math.max(0, G.surge.cfg.seconds - G.surge.t))} s</span><br>` : '') +
    (G.draw > 0 ? `Sling<div class="bar"><i style="width:${G.draw * 100}%;background:#ffb347"></i></div>` : '') + (comp ? `<span style="color:#bdb3d6">${comp}</span>` : '');
  const next = VR.OBJECTIVES.filter(o => !S.objectives[o.id]).slice(0, 3);
  $('#obj').innerHTML = `<h4>Goals ${VR.OBJECTIVES.length - VR.OBJECTIVES.filter(o => !S.objectives[o.id]).length}/${VR.OBJECTIVES.length}</h4>` + (next.length ? next.map(o => '○ ' + o.text).join('<br>') : 'All done!') +
    (S.taken.length ? `<h4 style="margin-top:6px;color:#ff9a8a">Taken by the Bloom</h4>` + S.taken.map(t => { const c = creatureById(t.id); return c ? `${c.name} in ${ZONE(t.zone).name}, until day ${t.until}` : ''; }).join('<br>') : '');
  $('#hint').textContent = G.panelKind ? 'Click a button · Esc or ✕ to close' : document.pointerLockElement ? hintFor() : 'Click to look around';
}
function hintFor() {
  const z = zoneAt(G.player.pos.x);
  if (G.tameTarget) return 'Hold F and keep still — crouch (C) to calm it faster';
  if (z.id === 'home') return 'E use · Tab wrist · walk east through the gate to explore';
  return 'Hold left mouse: sling · right mouse: cage · F: offer food · Q/X: send/recall · 1 2: skills';
}
const toasts = [];
on('toast', (msg) => {
  const el = document.createElement('div'); el.textContent = msg; $('#toast').appendChild(el); setTimeout(() => el.remove(), 3200);
  toasts.push({msg, t: G.t});
  if (G.xr) xrToast(msg);
});
on('objective', (id) => emit('toast', '✔ ' + VR.OBJECTIVES.find(o => o.id === id).text));

/* ---------- VR: wrist display and toasts in view ---------- */
let wristLabel, xrToastLabel, xrToastT = 0;
export function initXRHud(leftGrip) {
  wristLabel = makeLabel(['', ''], {w: 512, h: 200, scale: 0.16});
  wristLabel.position.set(0, 0.07, 0.08); leftGrip.add(wristLabel); G.wristLabel = wristLabel;
  xrToastLabel = makeLabel([''], {w: 1024, h: 96, scale: 0.5}); xrToastLabel.position.set(0, -0.28, -1.1); G.camera.add(xrToastLabel); xrToastLabel.visible = false;
}
function xrToast(msg) { if (!xrToastLabel) return; xrToastLabel.set([msg]); xrToastLabel.visible = true; xrToastT = 3; }
export function updateXRHud(dt) {
  if (!wristLabel) return;
  xrToastT -= dt; if (xrToastT <= 0 && xrToastLabel) xrToastLabel.visible = false;
  const S = G.S, P = G.player;
  const l2 = G.hold > 0 ? `Extracting ${Math.round(G.hold * 100)}%` : G.surge ? `Stone ${Math.round(G.surge.hp)} · ${Math.ceil(Math.max(0, G.surge.cfg.seconds - G.surge.t))}s` : S.trip ? `Pack ${packCount()} · cages ${S.items.cage || 0}` : `Safe · cages ${S.items.cage || 0}`;
  const next = VR.OBJECTIVES.find(o => !S.objectives[o.id]);
  wristLabel.set([`HP ${Math.round(P.hp)}/${P.maxHp} · ${timeOfDay()}`, l2, next ? next.text : 'All goals done']);
}
export {borderX, isClaimed};
