import {build} from 'esbuild';
await build({
  entryPoints: ['school/grader/index.ts', 'school/grader/child.ts', 'school/grader/fixtures.ts', 'school/grader/official.ts', 'school/grader/official-child.ts', 'school/grader/radio-child.ts'],
  outdir: '.build/school-grader', outExtension: {'.js': '.mjs'},
  bundle: true, platform: 'node', format: 'esm', target: 'node24',
  define: {__APP_BASE__: '"/"', __APP_BUILD__: '"school-proof"'},
});
console.log('Neovisna provjera 23A: izgrađeni ograničeni izvršni adapteri.');

await build({entryPoints:['school/compiler/runner.mjs'],outfile:'.build/school-grader/runner.mjs',bundle:true,platform:'node',format:'esm',target:'node24'});
