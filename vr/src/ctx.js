/* The shared game context. Modules read and write G instead of importing each other's
   internals, which keeps the dependency graph flat. S (the save) lives on G.S. */
export const G = {
  S: null,            // the save state
  scene: null, camera: null, renderer: null, rig: null,
  xr: false,          // in an immersive session
  t: 0, dt: 0,        // seconds since start, frame delta
  player: null,       // {pos, vel, hp, maxHp, crouch, yaw, pitch, dead, zone}
  wilds: [],          // live wild creature actors
  companions: [],     // live companion actors (party slots 1 and 2, and slot 3 following)
  foes: [],           // Bloomlings and the boss
  shots: [],          // projectiles in flight
  cages: [],          // thrown cages in flight or shaking
  nodes: [],          // gatherable resource nodes
  interactables: [],  // things E / the A button can use: {obj, label(), use(), range}
  panel: null,        // the open in-world panel, if any
  hooks: {},          // event name -> [fn]
  input: null,
  inDelve: false,
  surge: null,
  fx: [],             // short-lived visual effects
  hitstop: 0,         // seconds of frozen time left (crits, combos)
  xrSession: null,
};
export function on(ev, fn) { (G.hooks[ev] ||= []).push(fn); }
export function emit(ev, ...a) { for (const f of G.hooks[ev] || []) f(...a); }
