/* ================= Build flags =================
   DEMO is true in the demo build (node build.mjs writes dist/demo/ with __DEMO__ defined as true).
   DEV is true in the dev builds (dist-dev/, for the tests and the console), which expose the game on window.
   Kept in a module with no imports so anything can read it while the others are still loading. */
/* global __DEMO__, __DEV__ */
const DEMO=typeof __DEMO__!=='undefined'&&__DEMO__===true;
const DEV=typeof __DEV__!=='undefined'&&__DEV__===true;
export {DEMO,DEV};
