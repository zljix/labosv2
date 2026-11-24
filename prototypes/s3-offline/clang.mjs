import {runClang} from './node_modules/@yowasp/clang/gen/bundle.js';
import {S3_COMPILE_FLAGS} from '../../public/s3-contract.mjs';

export function fileTree(flat) {
  const tree = Object.create(null);
  for (const [path, contents] of Object.entries(flat)) {
    const names = path.split('/');
    const name = names.pop();
    let parent = tree;
    for (const dir of names) parent = parent[dir] ??= Object.create(null);
    parent[name] = contents;
  }
  return tree;
}

export async function invoke(args, files, output) {
  const decoder = new TextDecoder();
  let diagnostics = '';
  try {
    const result = await runClang(args, files, {stderr(bytes) {
      if (bytes) diagnostics = (diagnostics + decoder.decode(bytes)).slice(-16000);
    }});
    if (!(result[output] instanceof Uint8Array)) throw Error('Prevoditelj nije izradio ' + output);
    return result[output];
  } catch (error) {
    throw Error(diagnostics.trim() || error.message);
  }
}

export function compileUnit(path, files, includes) {
  const cpp = !path.endsWith('.c');
  const cppOnly = ['-fno-rtti','-fno-threadsafe-statics','-fno-c++-static-destructors','-nostdinc++'];
  const flags = S3_COMPILE_FLAGS.filter(flag => cpp || !cppOnly.includes(flag));
  return invoke([cpp?'clang++':'clang', ...flags, ...includes, '-x', cpp?'c++':'c',
    cpp?'-std=c++17':'-std=c11','-c',path,'-o','unit.o'], files, 'unit.o');
}
