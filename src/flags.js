/* ================= Build flags =================
   DEMO is true in the demo build (node build.mjs writes dist/demo/ with __DEMO__ defined as true).
   Kept in a module with no imports so anything can read it while the others are still loading. */
/* global __DEMO__ */
const DEMO=typeof __DEMO__!=='undefined'&&__DEMO__===true;
export {DEMO};
