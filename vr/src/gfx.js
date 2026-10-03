/* Small Three.js helpers: flat-shaded materials, canvas labels and sounds. */
import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const mat = (color, o = {}) => new THREE.MeshLambertMaterial({color, flatShading: true, ...o});

// A camera-facing text label drawn on a canvas. label.set(lines) redraws it.
export function makeLabel(lines, o = {}) {
  const w = o.w || 512, h = o.h || 128, cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({map: tex, transparent: true, depthWrite: false}));
  sp.scale.set(o.scale || 1.6, (o.scale || 1.6) * h / w, 1);
  sp.renderOrder = 5;
  let last = null;
  sp.set = (ls) => {
    const key = JSON.stringify(ls); if (key === last) return; last = key;
    const c = cv.getContext('2d'); c.clearRect(0, 0, w, h);
    if (!ls || !ls.length) { tex.needsUpdate = true; return; }
    c.fillStyle = o.bg || 'rgba(20,14,36,.78)';
    const r = 18; c.beginPath(); c.roundRect(4, 4, w - 8, h - 8, r); c.fill();
    c.textAlign = 'center'; c.textBaseline = 'middle';
    const n = ls.length, lh = (h - 16) / n;
    ls.forEach((t, i) => {
      c.font = `${i === 0 ? '600 ' : ''}${Math.floor(lh * (i === 0 ? 0.62 : 0.5))}px system-ui,sans-serif`;
      c.fillStyle = i === 0 ? (o.color || '#fff4dc') : '#cfc4ea';
      c.fillText(String(t), w / 2, 8 + lh * (i + 0.5), w - 24);
    });
    tex.needsUpdate = true;
  };
  sp.set(Array.isArray(lines) ? lines : [lines]);
  return sp;
}

/* ---------- sound: tiny WebAudio synth, no assets ---------- */
let ac = null;
export function audioInit() { try { ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume(); } catch (e) { ac = null; } }
export function sfx(kind) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  const S = {
    sling: ['triangle', 520, 180, 0.12, 0.18], hit: ['square', 240, 90, 0.08, 0.12], kill: ['sawtooth', 300, 60, 0.25, 0.14],
    cage: ['sine', 700, 350, 0.18, 0.15], shake: ['sine', 420, 400, 0.08, 0.12], caught: ['triangle', 520, 1040, 0.35, 0.18],
    escape: ['square', 300, 120, 0.25, 0.12], hurt: ['sawtooth', 160, 80, 0.15, 0.18], heal: ['sine', 500, 900, 0.3, 0.12],
    skill: ['triangle', 300, 800, 0.25, 0.16], combo: ['sawtooth', 200, 1200, 0.45, 0.16], ui: ['sine', 880, 880, 0.05, 0.08],
    tame: ['sine', 660, 990, 0.4, 0.14], gather: ['triangle', 380, 520, 0.1, 0.12], warn: ['square', 200, 200, 0.12, 0.08],
    hatch: ['triangle', 600, 1200, 0.5, 0.16], extract: ['sine', 440, 880, 0.6, 0.16], surge: ['sawtooth', 90, 60, 0.8, 0.14],
  }[kind] || ['sine', 440, 440, 0.1, 0.1];
  o.type = S[0]; o.frequency.setValueAtTime(S[1], t); o.frequency.exponentialRampToValueAtTime(Math.max(30, S[2]), t + S[3]);
  g.gain.setValueAtTime(S[4], t); g.gain.exponentialRampToValueAtTime(0.0001, t + S[3]);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + S[3] + 0.02);
}

// Merge several coloured parts into one mesh (one draw call). parts: [{geo, color, pos:[x,y,z], scale:[x,y,z], emissive?}]
export function mergedMesh(parts, o = {}) {
  const c = new THREE.Color(), geos = parts.map(p => {
    const g = p.geo.toNonIndexed(); if (p.scale) g.scale(...p.scale); if (p.rot) g.rotateY(p.rot); if (p.pos) g.translate(...p.pos);
    c.set(p.color); const n = g.attributes.position.count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv'); return g;
  });
  return new THREE.Mesh(mergeGeometries(geos), new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true, ...o}));
}
