// Build GeneSlingVR: bundle src/main.js (Three.js + the GeneSling sim core) with esbuild and
// inline it into src/shell.html, producing one self-contained dist/index.html.
// dist-dev/index.html is the same build with __DEV__ on, which exposes the game on window.vr for tests.
//   node build.mjs          build both once
//   node build.mjs --watch  rebuild on every change
import * as esbuild from 'esbuild';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const base = {entryPoints: ['src/main.js'], bundle: true, format: 'iife', write: false, logLevel: 'warning', minify: true, legalComments: 'none'};

function emit(result, out) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const shell = readFileSync('src/shell.html', 'utf8');
  mkdirSync(out.slice(0, out.lastIndexOf('/')), {recursive: true});
  writeFileSync(out, shell.replace('/*__GAME__*/', () => js));
  console.log(`built ${out} (${(js.length / 1024).toFixed(0)} KB of script)`);
}

async function buildAll() {
  emit(await esbuild.build({...base, define: {__DEV__: 'false'}}), 'dist/index.html');
  emit(await esbuild.build({...base, minify: false, define: {__DEV__: 'true'}}), 'dist-dev/index.html');
}

await buildAll();
if (process.argv.includes('--watch')) {
  const {watch} = await import('node:fs');
  let t = null;
  watch('src', {recursive: true}, () => { clearTimeout(t); t = setTimeout(() => buildAll().catch(e => console.error(e.message)), 150); });
  console.log('watching src/ …');
}
