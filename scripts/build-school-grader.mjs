import {build} from 'esbuild';
await build({
  entryPoints: ['school/grader/index.ts', 'school/grader/child.ts', 'school/grader/fixtures.ts'],
  outdir: '.build/school-grader', outExtension: {'.js': '.mjs'},
  bundle: true, platform: 'node', format: 'esm', target: 'node24',
  define: {__APP_BASE__: '"/"', __APP_BUILD__: '"school-proof"'},
});
console.log('Neovisna provjera 23A: izgrađeni ograničeni izvršni adapteri.');
