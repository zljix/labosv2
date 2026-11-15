// Local trusted-source compiler. No shell, project build flags, or public service.
import {readFile,writeFile,mkdtemp,mkdir,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {buildInput,inputHash,validateArtifact,S3_IMPORTS,S3_COMPILE_FLAGS} from '../public/s3-contract.mjs';
import {S3_CORE_FILES,S3_CORE_DIGEST} from '../public/s3-core-lock.mjs';
import {sha256} from '../public/avr-contract.mjs';
import {CompileError,parseDiagnostics,verifyLibraryFiles} from './avr-compile.mjs';
const exec=promisify(execFile),root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export async function compileS3(project,options={}){
 const input=buildInput(project),clang=options.clang??process.env.LAB_WASM_CXX??'clang++-19',opt=options.opt??process.env.LAB_WASM_OPT??'wasm-opt';
 const run=(bin,args)=>exec(bin,args,{timeout:60000,maxBuffer:1048576,windowsHide:true,signal:options.signal});
 if(!(await run(clang,['--version'])).stdout.match(/clang version 19\.1\.7\b/))throw Error('Potreban je Clang 19.1.7 s WASM linkerom. Postavi LAB_WASM_CXX.');
 if(!(await run(opt,['--version'])).stdout.match(/version 120\b/))throw Error('Potreban je Binaryen wasm-opt 120. Postavi LAB_WASM_OPT.');
 if(await sha256(JSON.stringify(S3_CORE_FILES))!==S3_CORE_DIGEST)throw Error('Neispravan ugovor funkcionalnog C++ corea.');
 await verifyLibraryFiles(join(root,'runtime/arduino-s3'),{files:Object.fromEntries(Object.entries(S3_CORE_FILES).map(([path,digest])=>[path.slice('runtime/arduino-s3/'.length),digest]))});
 const lock=JSON.parse(await readFile(join(root,'vendor/arduino/lock.json'),'utf8')),librarySources=[],libraryIncludes=[];
 for(const lib of input.toolchain.libraries){const pinned=lock[lib.name];if(!pinned||pinned.version!==lib.version||pinned.digest!==lib.digest||await sha256(JSON.stringify(pinned.files))!==lib.digest)throw Error('Neispravna zaključana biblioteka '+lib.name);const base=join(root,'vendor/arduino',lib.name);await verifyLibraryFiles(base,pinned);const modern=Object.keys(pinned.files).some(path=>path.startsWith('src/'));libraryIncludes.push('-I'+(modern?join(base,'src'):base));for(const path of Object.keys(pinned.files))if(/\.(c|cpp)$/.test(path)&&(modern?path.startsWith('src/'):!path.includes('/')))librarySources.push(join(base,path));}
 const job=await mkdtemp(join(tmpdir(),'esp32-lab-s3-'));
 try{
  const source=join(job,'source');await mkdir(source);
  for(const [path,text]of Object.entries(input.files)){const destination=join(source,path);await mkdir(dirname(destination),{recursive:true});await writeFile(destination,text);}
  // .ino uses real C++ parsing. Explicit function declarations are required,
  // unlike Arduino IDE's separate automatic-prototype preprocessing.
  const inos=Object.keys(input.files).filter(p=>p.endsWith('.ino')).sort((a,b)=>a==='main.ino'?-1:b==='main.ino'?1:a.localeCompare(b));
  await writeFile(join(source,'sketch.cpp'),'#include <Arduino.h>\n'+inos.map(p=>`#line 1 "${p}"\n${input.files[p]}\n`).join('\n'));
  const sources=[join(root,'runtime/arduino-s3/core.cpp'),join(source,'sketch.cpp'),...Object.keys(input.files).filter(p=>/\.(c|cpp)$/.test(p)).map(p=>join(source,p)),...librarySources];
  const common=[...S3_COMPILE_FLAGS,'-I'+join(root,'runtime/arduino-s3/include'),'-I'+source,...libraryIncludes];
  const normalize=s=>String(s).replaceAll('\\','/').replaceAll(source.replaceAll('\\','/')+'/','').replaceAll(root.replaceAll('\\','/'),'paket-prevoditelja').replaceAll(job.replaceAll('\\','/'),'[posao]');
  let diagnostics='';const objects=[];
  try{
   for(let i=0;i<sources.length;i++){const out=join(job,i+'.o'),cpp=!sources[i].endsWith('.c'),flags=common.filter(f=>cpp||!['-fno-rtti','-fno-threadsafe-statics','-fno-c++-static-destructors','-nostdinc++'].includes(f));const r=await run(clang,[...flags,'-x',cpp?'c++':'c',cpp?'-std=c++17':'-std=c11','-c',sources[i],'-o',out]);diagnostics+=normalize(r.stdout+r.stderr);objects.push(out);}
   await writeFile(join(job,'imports.txt'),S3_IMPORTS.join('\n')+'\n');
   const raw=join(job,'raw.wasm'),wasm=join(job,'program.wasm');
   const link=await run(clang,['--target=wasm32-unknown-unknown','-nostdlib',...objects,'-Wl,--no-entry','-Wl,--export-memory','-Wl,--initial-memory=2097152','-Wl,--max-memory=2097152','-Wl,-z,stack-size=65536','-Wl,--allow-undefined-file='+join(job,'imports.txt'),...['lab_init','lab_setup','lab_loop','lab_async_data'].map(n=>'-Wl,--export='+n),'-o',raw]);diagnostics+=normalize(link.stdout+link.stderr);
   const optimized=await run(opt,[raw,'--asyncify','--pass-arg=asyncify-imports@'+S3_IMPORTS.map(n=>'env.'+n).join(','),'--strip-debug','-o',wasm]);diagnostics+=normalize(optimized.stdout+optimized.stderr);
   const bytes=await readFile(wasm),artifact={format:'esp32-lab-s3-build',version:1,boardId:input.boardId,boardProfile:input.boardProfile,fqbn:input.fqbn,toolchain:input.toolchain,inputHash:await inputHash(project),wasmHash:await sha256(bytes),wasm:bytes.toString('base64'),wasmBytes:bytes.length,memoryBytes:2097152,compiledAt:new Date().toISOString(),diagnostics:diagnostics.slice(-12000),messages:parseDiagnostics(diagnostics)};
   await validateArtifact(project,artifact);return artifact;
  }catch(e){if(e.name==='AbortError')throw e;const log=normalize(e.stderr??e.message).slice(-16000);throw new CompileError(log,parseDiagnostics(log));}
 }finally{await rm(job,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [file,out]=process.argv.slice(2);if(!file||!out)throw Error('Uporaba: node scripts/s3-compile.mjs projekt.json rezultat.s3.json');const bytes=await readFile(file);if(bytes.length>2097152)throw Error('Projekt prelazi 2 MiB.');const a=await compileS3(JSON.parse(bytes.toString()));await writeFile(out,JSON.stringify(a,null,2)+'\n');console.log('Prevedeno: funkcionalni ESP32-S3 WASM · '+a.wasmBytes+' B');}catch(e){console.error(e.message);process.exitCode=1;}
}
