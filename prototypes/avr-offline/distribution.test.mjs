import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root='dist/offline-avr/toolchain';
test('published compiler has matching corresponding source and pinned upstream directions',()=>{
 const d=JSON.parse(readFileSync(root+'/DISTRIBUTION.json'));
 const runtime=JSON.parse(readFileSync(root+'/manifest.json'));
 assert.equal(d.compilerPackage,runtime.packageHash);assert.equal(d.upstreamRecipeRedistributed,false);
 const bytes=readFileSync(root+'/'+d.sourceArchive);assert.equal(bytes.length,d.sourceArchiveBytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),d.sourceArchiveSha256);
 const archive=spawnSync('tar',['-tzf',root+'/'+d.sourceArchive],{encoding:'utf8'});assert.equal(archive.status,0);
 const entries=archive.stdout.trim().split('\n');
 for(const path of ['prototypes/avr-offline/build-sdk.mjs','prototypes/avr-offline/build-libraries.mjs','prototypes/avr-offline/DISTRIBUTION.md','package-lock.json','LICENSE'])assert(entries.includes(path),path);
 assert(!entries.some(x=>/^(?:dist|node_modules|\.git|\.build)\//.test(x)));
 const page=readFileSync('dist/compiler-sources.html','utf8');
 assert.equal(d.upstreamSources.length,19);
 for(const source of d.upstreamSources){assert(page.includes(source.url));assert(page.includes(source.sha256));}
 for(const recipe of d.recipe.files)assert(page.includes(d.recipe.commit+'/avr/'+recipe.name));
 for(const name of ['Emscripten-LICENSE.txt','musl-COPYRIGHT.txt','compiler-rt-LICENSE.txt','libcxx-LICENSE.txt','libcxxabi-LICENSE.txt']){
  assert(readFileSync(root+'/notices/'+name,'utf8').length>1000);assert(page.includes('notices/'+name));
 }
 const app=JSON.parse(readFileSync('dist/offline-package.json'));
 assert(app.files.some(f=>f.url===app.base+'compiler-sources.html'));
 assert(app.files.some(f=>f.url===app.base+'offline-avr/tool-worker.js'),'disposable tool worker must be available after an offline restart');
 assert(!app.files.some(f=>f.url.includes('/toolchain/')),'source and compiler archives are not auto-downloaded in app cache');
});
