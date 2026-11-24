import {mkdir, readdir, readFile, writeFile, cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {packLibraries} from './library-pack.mjs';
import {S3_CORE_FILES} from '../../public/s3-core-lock.mjs';
import {compileCircuit} from '../../src/circuit/compile';
import {exampleCircuit} from '../../src/circuit/examples';

const out = 'release';
await mkdir(out, {recursive: true});
await cp('node_modules/@yowasp/clang/gen', out + '/llvm', {recursive: true});
await cp('node_modules/binaryen/index.js', out + '/binaryen.js');
for (const name of ['index.html','app.mjs']) await cp(name, out + '/' + name);
const output = await build({
  metafile: true,
  entryPoints: ['worker.mjs','compiler.mjs','project-worker.mjs'], splitting: true, chunkNames: 'shared-[hash]', outExtension: {'.js':'.mjs'}, bundle: true, format: 'esm', outdir: out,
  plugins: [{name: 'tool-assets', setup(api) {
    api.onResolve({filter: /node_modules\/@yowasp\/clang\/gen\/bundle\.js$/}, () => ({path: './llvm/bundle.js', external: true}));
    api.onResolve({filter: /node_modules\/binaryen\/index\.js$/}, () => ({path: './binaryen.js', external: true}));
  }}]
});
const core = '../../runtime/arduino-s3/';
for (const [path,expected] of Object.entries(S3_CORE_FILES)) {
  const content = await readFile('../../' + path);
  if (createHash('sha256').update(content).digest('hex') !== expected)
    throw Error('S3 jezgra odstupa od zaključane verzije: ' + path);
}
const headers = {};
for (const name of await readdir(core + 'include')) headers[name] = await readFile(core + 'include/' + name, 'utf8');
await writeFile(out + '/core.json', JSON.stringify({'core.cpp': await readFile(core + 'core.cpp','utf8'), include: headers}));
await writeFile(out + '/circuit.json', JSON.stringify(compileCircuit(exampleCircuit('blink'))));
const libraries = await packLibraries(out, headers);
const paths = [...libraries,'index.html','app.mjs',...Object.keys(output.metafile.outputs).map(path => path.slice(out.length + 1)).sort(),'core.json','circuit.json','binaryen.js',
  ...(await readdir(out + '/llvm')).sort().map(n => 'llvm/' + n)];
const sums = {};
for (const name of paths) sums[name] = createHash('sha256').update(await readFile(out + '/' + name)).digest('hex');
const toolFiles = paths.filter(path => !['index.html','app.mjs','circuit.json','worker.mjs'].includes(path));
await writeFile(out + '/tools.json', JSON.stringify(toolFiles.map(path => ({path, sha256: sums[path]}))));
const worker = await readFile('cache-worker.js','utf8');
await writeFile(out + '/sw.js', 'const sums = ' + JSON.stringify(sums) + ';\nconst version = "' +
  createHash('sha256').update(JSON.stringify(sums)).update(worker).digest('hex') + '";\n' + worker);
