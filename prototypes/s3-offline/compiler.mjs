import {fileTree,compileUnit,invoke} from './clang.mjs';
import binaryen from './node_modules/binaryen/index.js';
import {S3_IMPORTS, validateModule} from '../../public/s3-contract.mjs';

export async function compileSketch(source,core) {
  return compileFiles({'main.ino':source},core,[]);
}

export async function compileFiles(sources, core, libraries, progress = () => {}) {
  const inos = Object.keys(sources).filter(path => path.endsWith('.ino')).sort();
  const order = ['main.ino',...inos.filter(path => path !== 'main.ino')];
  const sketch = '#include <Arduino.h>\n' + order.map(path =>
    `#line 1 "${path}"\n${sources[path]}\n`).join('\n');
  const files = {...core, project:fileTree({...sources,'sketch.ino.cpp':sketch}),
    'imports.txt':S3_IMPORTS.join('\n')+'\n'};
  const includes = ['-Iinclude','-Iproject'];
  const archives = {};
  for (const {name,headers,archive} of libraries) {
    files[name] = fileTree(headers);
    includes.push('-I'+name);
    archives[name+'.a'] = Uint8Array.from(atob(archive),c=>c.charCodeAt(0));
  }
  const units = ['core.cpp','project/sketch.ino.cpp',...Object.keys(sources)
    .filter(path=>/\.(c|cpp)$/.test(path)).map(path=>'project/'+path)];
  const objects = {};
  for (const [index,path] of units.entries()) {
    const label = path==='core.cpp'?'Arduino jezgra':path==='project/sketch.ino.cpp'?'.ino datoteke':path.slice('project/'.length);
    progress(`Prevođenje: ${label} (${index+1}/${units.length})`);
    try {
      objects['unit'+index+'.o'] = await compileUnit(path,files,includes);
    } catch (error) { throw Error(error.message.replaceAll('project/','')); }
  }
  progress('Povezivanje programa i biblioteka…');
  const exports = ['lab_init','lab_setup','lab_loop','lab_async_data'];
  const bytes = await invoke(['clang++','--target=wasm32-unknown-unknown','-nostdlib',
    ...Object.keys(objects),...Object.keys(archives),'-Wl,--no-entry,--export-memory,--initial-memory=2097152,--max-memory=2097152,-z,stack-size=65536',
    '-Wl,--allow-undefined-file=imports.txt', ...exports.map(name => '-Wl,--export='+name), '-o','raw.wasm'],
    {...objects,...archives,'imports.txt':files['imports.txt']},'raw.wasm');
  progress('Priprema programa za simulator…');
  const module = binaryen.readBinary(bytes);
  try {
    binaryen.setPassArgument('asyncify-imports', S3_IMPORTS.map(name => 'env.' + name).join(','));
    module.runPasses(['asyncify', 'strip-debug']);
    const bytes = module.emitBinary();
    validateModule(bytes);
    return bytes;
  } finally {
    module.dispose();
  }
}
