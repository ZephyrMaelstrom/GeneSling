// Build the game: bundle src/main.js with esbuild and inline it into src/shell.html,
// producing one self-contained dist/index.html (works from a web server, a file:// URL or a Claude artifact).
//   node build.mjs           build once
//   node build.mjs --watch   rebuild on every change in src/
import * as esbuild from 'esbuild';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const OUT = 'dist/index.html';
const options = {
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  write: false,
  logLevel: 'warning',
};

// The Exchange worker is bundled on its own and handed to the page bundle as a string, so the
// game stays one self-contained file.
async function workerSource() {
  const r = await esbuild.build({entryPoints: ['src/exchange/worker.js'], bundle: true, format: 'iife', write: false, logLevel: 'warning'});
  return r.outputFiles[0].text;
}
const workerPlugin = {
  name: 'exchange-worker-src',
  setup(b) {
    b.onResolve({filter: /^exchange-worker-src$/}, () => ({path: 'exchange-worker-src', namespace: 'worker-src'}));
    b.onLoad({filter: /.*/, namespace: 'worker-src'}, async () => ({contents: `export default ${JSON.stringify(await workerSource())};`, loader: 'js', watchFiles: []}));
  },
};
options.plugins = [workerPlugin];

function emit(result) {
  const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const shell = readFileSync('src/shell.html', 'utf8');
  mkdirSync('dist', {recursive: true});
  writeFileSync(OUT, shell + '<script>\n' + js + '</script>\n');
  console.log(`built ${OUT} (${Math.round(js.length / 1024)} KB of script)`);
}

if (process.argv.includes('--watch')) {
  const ctx = await esbuild.context({
    ...options,
    plugins: [workerPlugin, {name: 'emit', setup(b) { b.onEnd(r => { if (!r.errors.length) emit(r); }); }}],
  });
  await ctx.watch();
  console.log('watching src/ ...');
} else {
  emit(await esbuild.build(options));
}
