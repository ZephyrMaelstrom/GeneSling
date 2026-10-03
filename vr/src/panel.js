/* In-world panels: a canvas on a plane, laid out immediate-mode. The same panel is clicked by
   the mouse on a flat screen and by the controller ray in VR. */
import * as THREE from 'three';
import {G} from './ctx.js';
import {sfx} from './gfx.js';

const W = 1024, H = 760;
export class Panel {
  constructor() {
    this.cv = document.createElement('canvas'); this.cv.width = W; this.cv.height = H;
    this.ctx = this.cv.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.cv); this.tex.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2 * H / W), new THREE.MeshBasicMaterial({map: this.tex, transparent: true, depthTest: false}));
    this.mesh.renderOrder = 10; this.mesh.visible = false; G.scene.add(this.mesh);
    this.buttons = []; this.hover = -1; this.builder = null;
  }
  open(builder) { this.builder = builder; this.page = 0; this.mesh.visible = true; this.place(); this.render(); }
  close() { this.mesh.visible = false; this.builder = null; }
  get isOpen() { return this.mesh.visible; }
  place() {
    const cam = G.camera, p = cam.getWorldPosition(new THREE.Vector3()), q = cam.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(q); fwd.y = 0; fwd.normalize();
    this.mesh.position.copy(p).addScaledVector(fwd, G.xr ? 0.85 : 0.95); this.mesh.position.y = p.y - (G.xr ? 0.12 : 0.02);
    this.mesh.lookAt(p.x, this.mesh.position.y, p.z);
  }
  render() {
    const c = this.ctx; this.buttons = []; let x = 40, y = 34; const lineH = 34, pad = 40;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(22,16,40,0.94)'; c.beginPath(); c.roundRect(4, 4, W - 8, H - 8, 28); c.fill();
    c.strokeStyle = 'rgba(255,179,71,0.5)'; c.lineWidth = 3; c.stroke();
    c.textBaseline = 'top';
    const api = {
      title: (t, sub) => { c.font = '600 38px system-ui,sans-serif'; c.fillStyle = '#ffd9a0'; c.fillText(t, pad, y); y += 50; x = pad; if (sub) api.text(sub, {size: 21, color: '#bdb3d6'}); },
      text: (t, o = {}) => {
        if (x !== pad) { y += 58; x = pad; }
        c.font = `${o.bold ? '600 ' : ''}${o.size || 23}px system-ui,sans-serif`; c.fillStyle = o.color || '#f1ecff';
        const words = String(t).split(' '); let line = '';
        for (const w of words) { const test = line ? line + ' ' + w : w; if (c.measureText(test).width > W - pad * 2 - (o.indent || 0)) { c.fillText(line, pad + (o.indent || 0), y); y += lineH; line = w; } else line = test; }
        if (line) { c.fillText(line, pad + (o.indent || 0), y); y += lineH; }
      },
      bar: (label, f, o = {}) => {
        if (x !== pad) { y += 58; x = pad; }
        c.font = '21px system-ui,sans-serif'; c.fillStyle = '#d8d0ee'; c.fillText(label, pad, y + 2);
        const bx = pad + (o.labelW || 190), bw = o.w || 300;
        c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(bx, y + 6, bw, 16);
        c.fillStyle = o.color || '#7ee08a'; c.fillRect(bx, y + 6, bw * Math.max(0, Math.min(1, f)), 16);
        if (o.right) { c.fillStyle = '#f1ecff'; c.fillText(o.right, bx + bw + 14, y + 2); }
        y += 30;
      },
      btn: (label, fn, o = {}) => {
        c.font = '600 23px system-ui,sans-serif';
        const bw = o.w || Math.max(110, c.measureText(label).width + 36), bh = 48;
        if (x + bw > W - pad) { y += 58; x = pad; }
        const i = this.buttons.length, on = o.on !== false;
        c.fillStyle = !on ? 'rgba(255,255,255,0.08)' : i === this.hover ? '#ffcf7a' : o.accent ? '#ffb347' : '#4a3a78';
        c.beginPath(); c.roundRect(x, y, bw, bh, 12); c.fill();
        c.fillStyle = !on ? '#776d90' : (i === this.hover || o.accent) ? '#2a1a08' : '#f6f1ff'; c.textAlign = 'center'; c.fillText(label, x + bw / 2, y + 12, bw - 12); c.textAlign = 'left';
        this.buttons.push({x, y, w: bw, h: bh, fn: on ? fn : null}); x += bw + 12;
      },
      br: (n = 1) => { if (x !== pad) { y += 58; x = pad; } y += 10 * n; },
      sep: () => { if (x !== pad) { y += 58; x = pad; } c.fillStyle = 'rgba(255,255,255,0.12)'; c.fillRect(pad, y + 6, W - pad * 2, 2); y += 18; },
      get y() { return y; }, H,
      page: this.page, setPage: (n) => { this.page = n; this.render(); },
      rerender: () => this.render(),
    };
    if (this.builder) this.builder(api);
    // a close button on every panel
    c.font = '600 26px system-ui'; const cx = W - 74, cy = 22;
    c.fillStyle = this.hover === this.buttons.length ? '#ff8a7a' : '#5a3a5a'; c.beginPath(); c.roundRect(cx, cy, 52, 52, 12); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText('✕', cx + 26, cy + 12); c.textAlign = 'left';
    this.buttons.push({x: cx, y: cy, w: 52, h: 52, fn: () => G.closePanel()});
    this.tex.needsUpdate = true;
  }
  // uv from a raycast hit -> canvas pixels
  buttonAt(uv) { const px = uv.x * W, py = (1 - uv.y) * H; return this.buttons.findIndex(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h); }
  pointer(uv, click) {
    const i = uv ? this.buttonAt(uv) : -1;
    if (i !== this.hover) { this.hover = i; this.render(); }
    if (click && i >= 0 && this.buttons[i].fn) { sfx('ui'); const fn = this.buttons[i].fn; fn(); if (this.isOpen) this.render(); return true; }
    return false;
  }
}
