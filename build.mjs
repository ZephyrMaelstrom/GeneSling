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
    plugins: [{name: 'emit', setup(b) { b.onEnd(r => { if (!r.errors.length) emit(r); }); }}],
  });
  await ctx.watch();
  console.log('watching src/ ...');
} else {
  emit(await esbuild.build(options));
}
