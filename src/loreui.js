/* ================= Lore panels (Phase 7) =================
   The Codex's journal (thirty pages in story order, grouped by act), "The story so far" (each act's
   question with its pages, rune walls and whispers), the hideout murals, and the Test Lab's lore tools. */
import {esc} from './util.js';
import {LORE as L,LORE_INTRO} from './content.js';
import {runeWall} from './endgame.js';
import {currentAct,journal,murals,storyByAct,fragments,FRAGMENT_TOTAL,loreState} from './lore.js';

function journalView(){
  const pages=journal(),a=currentAct();
  return`<section class="card journal"><p class="hint">Ilsa Marrow kept this journal. Thirteen pages turn up with Keeper rank; the rest lie on the floors of the Bloom, where you must carry them out. ${pages.filter(p=>p.found).length}/${pages.length} found.</p>
    ${L.ACTS.map(A=>`<h3>${A.name}: ${A.question}</h3>${a<A.n?`<p class="status">${A.opens} to begin it.</p>`:''}
      ${pages.filter(p=>p.act===A.n).map(p=>p.found?`<article class="page"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p><small>Page ${p.n}</small></article>`
        :`<article class="page locked"><h3>Missing page ${p.n}</h3><p>${esc(p.hint)}</p></article>`).join('')}`).join('')}</section>`;
}

function storyView(){
  const a=currentAct(),acts=storyByAct();
  return`<section class="card journal" style="margin-bottom:16px"><article class="page"><h3>The Bloom</h3>${LORE_INTRO.map(p=>`<p>${p}</p>`).join('')}</article>
    <p class="status">You are in <b>${L.ACTS[a-1].name}</b>. ${fragments()}/${FRAGMENT_TOTAL()} fragments found: journal pages, rune walls, whispers and relics.</p></section>
    <div class="grid">${acts.map(A=>`<section class="card ${A.open?'':'lockedtab'}"><h2>${A.name}</h2><p class="trait"><b>${A.question}</b></p>
      ${A.open?`<p class="status">${A.pages.filter(p=>p.found).length}/${A.pages.length} journal pages · ${A.walls.filter(w=>w.found).length}/${A.walls.length} rune walls · ${A.whispers.filter(w=>w.found).length}/${A.whispers.length} whispers</p>
        ${A.walls.some(w=>w.found)?`<h3>Rune walls</h3><ul class="plain runes">${A.walls.filter(w=>w.found).map(w=>`<li>${esc(runeWall(w.text))}</li>`).join('')}</ul>`:''}
        ${A.whispers.some(w=>w.found)?`<h3>Whispers</h3><ul class="plain">${A.whispers.filter(w=>w.found).map(w=>`<li><i>${esc(w.text)}</i></li>`).join('')}</ul>`:''}`
      :`<p class="status">${A.opens} to open this act.</p>`}</section>`).join('')}</div>`;
}

function muralView(){
  const a=currentAct();
  return`<section class="card"><p class="hint">Eight murals on the hideout's walls. Nobody admits to painting them, and they change as the story moves on. They are in ${L.ACTS[a-1].name}.</p>
    <div class="wall">${murals().map(m=>`<div class="mural"><canvas class="spr" width="220" height="96" data-mural="${m.id}" data-stage="${m.stage}"></canvas><b>${esc(m.name)}</b><small class="status">${esc(m.where)}</small><p>${esc(m.text)}</p></div>`).join('')}</div></section>`;
}

const labLorePanel=()=>{const st=loreState();return`<h3>Lore</h3><p class="hint">Act ${currentAct()} · ${st.pages.length} found pages · ${st.walls.length} walls · ${st.whispers.length} whispers.</p>
  <div class="row"><button class="btn small" data-act="lab-lore" data-k="all">Reveal every fragment</button><button class="btn small" data-act="lab-lore" data-k="none">Forget them</button><button class="btn small" data-act="lab-whisper">Hear a whisper</button></div>`};

export {journalView,storyView,muralView,labLorePanel};
