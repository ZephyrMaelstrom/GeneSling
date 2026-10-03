/* ================= Seeded random numbers =================
   Gameplay randomness goes through rand(), which reads the current seeded stream.
   Each raid reseeds it, and each floor's map is generated from its own sub-seed,
   so a seed reproduces the same dungeon. Purely visual randomness (screen shake,
   wandering hideout creatures, music, noise) uses fxRand() so it never shifts the
   gameplay stream. */

// mulberry32: small, fast, good enough for games. Returns floats in [0, 1).
function makeRng(seed){
  let a=seed>>>0;
  return ()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296};
}
// Mix a seed with a number (floor, stream id) into a new, well-spread seed.
function mixSeed(seed,n){let h=Math.imul((seed>>>0)^Math.imul(n+1,0x9E3779B1),0x85EBCA6B);h^=h>>>13;h=Math.imul(h,0xC2B2AE35);return(h^(h>>>16))>>>0}
const newSeed=()=>(Math.random()*4294967296)>>>0;

let stream=makeRng(newSeed());
const rand=()=>stream();
function seedRng(seed){stream=makeRng(seed)}
// Run fn on its own seeded stream, then carry on with the outer stream untouched.
function withSeed(seed,fn){const outer=stream;stream=makeRng(seed);try{return fn()}finally{stream=outer}}
const fxRand=()=>Math.random();

export {makeRng,mixSeed,newSeed,rand,seedRng,withSeed,fxRand};
