// Compile the exact Arduino IDE source export with the real Espressif core.
// No board is flashed or contacted. Firmware never enters the WASM runtime.
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,writeFile,mkdir,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {unzipSync,strFromU8} from 'fflate';
import {s3Examples,s3ExampleProject,type S3Example} from '../src/runtime/s3Examples';
import {radioNodeProject} from '../src/radio/examples';
import {exportSketch} from '../src/project/sketch';
import {selectedLibraries,S3_FQBN} from '../public/s3-contract.mjs';
import {verifyLibraryFiles} from '../scripts/avr-compile.mjs';
const exec=promisify(execFile),root=process.cwd(),dir=process.env.LAB_NATIVE_EVIDENCE_DIR??'docs/stage22f-evidence/native';
const cli=process.env.LAB_ARDUINO_CLI??'arduino-cli',config=process.env.LAB_ESP32_CONFIG;
if(!config)throw Error('Postavi LAB_ESP32_CONFIG na zasebni Arduino CLI profil s esp32:esp32@3.3.12.');
const prefix=['--config-file',resolve(config)],run=(args:string[])=>exec(cli,[...prefix,...args],{timeout:240000,maxBuffer:4*1024*1024});
const version=JSON.parse((await run(['version','--format','json'])).stdout);
const cores=JSON.parse((await run(['core','list','--format','json'])).stdout);
if(version.VersionString!=='1.3.1'||!cores.platforms.some((c:any)=>c.id==='esp32:esp32'&&c.installed_version==='3.3.12'))throw Error('Provjera zahtijeva Arduino CLI 1.3.1 i esp32:esp32@3.3.12.');
const configData=JSON.parse((await run(['config','dump','--format','json'])).stdout).config.directories.data;
const lock=JSON.parse(await readFile('vendor/arduino/lock.json','utf8'));
await mkdir(dir,{recursive:true});const results:any[]=[],job=await mkdtemp(join(tmpdir(),'lab-s3-native-'));
const normalize=(s:string)=>s.replaceAll(job,'[posao]').replaceAll(configData,'[espressif-alati]').replaceAll(root,'[izvor]');
try{
 const available=[...Object.keys(s3Examples),'radioTX','radioRX'];
 const keys=process.argv.slice(2).length?process.argv.slice(2):available;
 if(new Set(keys).size!==keys.length||keys.some(key=>!available.includes(key)))throw Error('Nepoznat ili ponovljen ključ primjera.');
 for(const key of keys){
  const p=key==='radioTX'||key==='radioRX'?radioNodeProject('s3-cpp',key==='radioTX'?'tx':'rx'):s3ExampleProject(key as S3Example);
  const bytes=exportSketch(p),files=unzipSync(bytes),base=join(job,key),build=join(base,'build');
  const fileHashes=Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b)).map(([name,content])=>[name,createHash('sha256').update(content).digest('hex')]));
  const input={key,fqbn:S3_FQBN,core:'esp32:esp32@3.3.12',cli:version.VersionString,fileHashes,exportHash:createHash('sha256').update(bytes).digest('hex'),sourceHash:createHash('sha256').update(strFromU8(files['LabSketch/LabSketch.ino'])).digest('hex')};
  for(const [name,content] of Object.entries(files)){const dest=join(base,name);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,content);}
  const libs=selectedLibraries(p),libraryArgs:string[]=[];
  for(const lib of libs){const path=join(root,'vendor/arduino',lib.name);await verifyLibraryFiles(path,lock[lib.name]);libraryArgs.push('--library',path);}
  const started=performance.now();let row:any;
  try{
   const r=await run(['compile','--fqbn',S3_FQBN,'--jobs','2','--warnings','all','--build-path',build,...libraryArgs,join(base,'LabSketch')]);
   const log=normalize(r.stdout+'\n'+r.stderr);await writeFile(dir+'/'+key+'.txt',log);
   const binaries=[];for(const name of (await readdir(build)).filter(n=>/\.ino\.(elf|bin)$/.test(n))){const binary=await readFile(join(build,name));binaries.push({name,bytes:binary.length,sha256:createHash('sha256').update(binary).digest('hex')});}
   if(binaries.length!==2)throw Error('Nedostaje ELF ili BIN rezultat.');
   row={...input,status:'pass',elapsedMs:Math.round(performance.now()-started),libraries:libs,binaries,summary:log.split('\n').filter(s=>/Sketch uses|Global variables|Maximum is/.test(s))};
  }catch(e:any){await writeFile(dir+'/'+key+'.txt',normalize((e.stdout??'')+'\n'+(e.stderr??'')+'\n'+e.message));row={...input,status:'fail',libraries:libs,message:normalize(e.stderr??e.message).slice(-4000)};}
  results.push(row);await writeFile(dir+'/results.json',JSON.stringify(results,null,2)+'\n');console.log(key+': '+row.status+(row.summary?' · '+row.summary.join(' '):' · '+row.message.slice(-300)));
 }
}finally{await rm(job,{recursive:true,force:true});}
if(results.some(r=>r.status!=='pass'))process.exitCode=1;
