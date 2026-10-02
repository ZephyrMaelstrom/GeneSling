// Phase 7 exit test, second half: "a tester given only the rune walls can break the cipher." The rune walls
// are shown here exactly as a player first sees them (every letter a rune), and a plain pattern-matching
// solver breaks them with nothing but an English word list: the words of the game's own text (with the
// walls left out) and a few hundred common words. No crib, no relics, no Archive.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = f => JSON.parse(readFileSync(new URL(`../src/data/${f}`, import.meta.url)));
const LORE = read('lore.json'), ENDGAME = read('endgame.json');
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', GLYPHS = [...ENDGAME.RUNES.alphabet];
const toRunes = t => [...t].map(ch => ch === ' ' ? ' ' : GLYPHS[ABC.indexOf(ch)]).join('');

// What a tester is handed: only the rune walls.
const walls = LORE.WALLS.map(w => toRunes(w.text));

// What a tester brings: English. The game's own text (minus the walls) plus common words.
const COMMON = `a an the and or but if so of to in on at by for from with as is it its be was were are am been do does did done
  go goes gone went come came make makes made take took keep kept hold held grow grows grew back long ago dies died die dead dream dreams
  dreamt sing sang sung song we us our you your they them their he she him her his i me my this that these those what who why how
  when where here there not no yes all any some one two three four five once twice thrice first second third last next new old
  world sky land sea above below under over inside outside heart door wall walls thread threads light dark night day morning
  free wake sleep asleep awake cut let lets bred breed true teeth cruel afraid kind love loved home left right stayed stay`;
const corpus = JSON.stringify([read('story.json'), {...LORE, WALLS: undefined}, read('bosses.json'), read('species.json'), read('bloom.json'), read('endgame.json')]);
const DICT = new Set([...corpus.toUpperCase().match(/[A-Z]+/g), ...COMMON.toUpperCase().split(/\s+/).filter(Boolean)]);

const pattern = w => { const m = new Map(); return [...w].map(c => { if (!m.has(c)) m.set(c, m.size); return m.get(c); }).join('.'); };
const byPattern = new Map();
for (const w of DICT) { const p = pattern(w); if (!byPattern.has(p)) byPattern.set(p, []); byPattern.get(p).push(w); }

// Backtracking: fix one rune word at a time to a dictionary word that agrees with every letter fixed so far.
function solve(cipherWords) {
  const words = [...new Set(cipherWords)].map(w => ({w: [...w], cands: byPattern.get(pattern([...w])) || []}));
  words.sort((a, b) => a.cands.length - b.cands.length || b.w.length - a.w.length);
  const key = new Map(), used = new Map();
  let steps = 0;
  const fits = (rw, pw) => rw.every((g, i) => (key.get(g) ?? pw[i]) === pw[i] && (used.get(pw[i]) ?? g) === g);
  const go = i => {
    if (++steps > 2e6) throw new Error('search too long');
    if (i === words.length) return true;
    const {w, cands} = words[i];
    for (const pw of cands) {
      if (!fits(w, pw)) continue;
      const added = [];
      w.forEach((g, k) => { if (!key.has(g)) { key.set(g, pw[k]); used.set(pw[k], g); added.push(g); } });
      if (go(i + 1)) return true;
      added.forEach(g => { used.delete(key.get(g)); key.delete(g); });
    }
    return false;
  };
  return go(0) ? {key, steps} : null;
}

test('the rune alphabet is a real, consistent alphabet', () => {
  assert.equal(GLYPHS.length, 26);
  assert.equal(new Set(GLYPHS).size, 26, 'one rune per letter');
  assert.equal(LORE.WALLS.length, 16);
  for (const w of LORE.WALLS) assert.match(w.text, /^[A-Z ]+$/, `${w.id} is plain words`);
});

test('a solver given only the rune walls breaks the cipher', () => {
  const words = walls.flatMap(w => w.split(' '));
  const out = solve(words);
  assert.ok(out, 'the walls can be read');
  const read = walls.map(w => [...w].map(g => g === ' ' ? ' ' : out.key.get(g)).join(''));
  assert.deepEqual(read, LORE.WALLS.map(w => w.text), 'every wall reads back as written');
  const letters = new Set(LORE.WALLS.map(w => w.text).join('').replace(/ /g, ''));
  assert.ok(letters.size >= 22, `the walls use ${letters.size} letters, enough to learn most of the alphabet`);
});

test('the secrets are on the walls: a hybrid, a hidden room and the third singer', () => {
  const s = Object.fromEntries(LORE.WALLS.filter(w => w.secret).map(w => [w.secret, w.text]));
  assert.match(s.hybrid, /VENOM.*LIGHT.*ECLIPSE/);
  assert.match(s.room, /DOOR.*BESIDE THE HEART/);
  assert.match(s.singer, /THIRD SINGER WAS MARROW/);
});
