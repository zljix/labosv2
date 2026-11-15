// Local development bridge. Never run this script as an Internet-facing service.
import {readFile,writeFile,mkdtemp,mkdir,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {buildInput,inputHash,sha256,parseHex,AVR_TOOLCHAIN,AVR_TARGETS} from '../public/avr-contract.mjs';

const exec=promisify(execFile);
const vendor=resolve(dirname(fileURLToPath(import.meta.url)),'../vendor/arduino');
export class CompileError extends Error {
  constructor(message,diagnostics=[]){super(message);this.name='CompileError';this.diagnostics=diagnostics;}
}
export function parseDiagnostics(text) {
  return text.split(/\r?\n/).flatMap(line=>{
    const m=line.match(/^(.+?):(\d+)(?::(\d+))?:\s*(fatal error|error|warning|note):\s*(.*)$/);
    if(!m)return [];
    return [{file:m[1].replaceAll('\\','/'),line:Number(m[2]),column:Number(m[3]??1),severity:m[4].includes('error')?'error':m[4],message:m[5]}];
  }).slice(0,50);
}
export async function verifyLibraryFiles(base,pinned) {
  async function list(prefix='') {
    const entries=await readdir(join(base,prefix),{withFileTypes:true}),paths=[];
    for(const e of entries){const path=prefix?prefix+'/'+e.name:e.name;if(e.isDirectory())paths.push(...await list(path));else if(e.isFile())paths.push(path);else throw Error('Nedopuštena poveznica u biblioteci.');}
    return paths;
  }
  const paths=(await list()).sort();
  if(JSON.stringify(paths)!==JSON.stringify(Object.keys(pinned.files).sort()))throw Error('Izmijenjen popis datoteka biblioteke. Ponovno preuzmi paket prevoditelja.');
  for(const path of paths)if(await sha256(await readFile(join(base,path)))!==pinned.files[path])throw Error('Izmijenjena biblioteka. Ponovno preuzmi paket prevoditelja.');
}
export async function compileProject(project,options={}) {
  const input=buildInput(project),cli=options.cli??process.env.LAB_ARDUINO_CLI??'arduino-cli',conf=options.config??process.env.LAB_ARDUINO_CONFIG??(existsSync('avr-env/arduino-cli.yaml')?'avr-env/arduino-cli.yaml':undefined);
  const prefix=conf?['--config-file',resolve(conf)]:[];
  const run=async(args,extra={})=>await exec(cli,[...prefix,...args],{timeout:60000,maxBuffer:1024*1024,windowsHide:true,signal:options.signal,...extra});
  const out=async args=>(await run(args)).stdout;
  const version=JSON.parse(await out(['version','--format','json']));
  if(version.VersionString!==AVR_TOOLCHAIN.cli)throw Error('Potreban je Arduino CLI '+AVR_TOOLCHAIN.cli+'.');
  const cores=JSON.parse(await out(['core','list','--format','json']));
  const core=(cores.platforms??[]).find(p=>p.id==='arduino:avr');
  if(core?.installed_version!== '1.8.6')throw Error('Prvo instaliraj zaključani core arduino:avr@1.8.6.');
  const config=JSON.parse(await out(['config','dump','--format','json'])).config;
  const gccRoot=join(config.directories.data,'packages','arduino','tools','avr-gcc',AVR_TOOLCHAIN.gcc);
  const gccVersion=(await exec(join(gccRoot,'bin',process.platform==='win32'?'avr-g++.exe':'avr-g++'),['--version'],{timeout:10000})).stdout;
  if(!gccVersion.includes('7.3.0'))throw Error('Neodgovarajući AVR GCC.');
  const lock=JSON.parse(await readFile(join(vendor,'lock.json'),'utf8')),libraryArgs=[];
  for(const lib of input.toolchain.libraries){
    const pinned=lock[lib.name];if(!pinned||pinned.version!==lib.version||pinned.digest!==lib.digest||await sha256(JSON.stringify(pinned.files))!==lib.digest)throw Error('Neodgovarajući paket biblioteke '+lib.name+'. Ponovno preuzmi most.');
    await verifyLibraryFiles(join(vendor,lib.name),pinned);
    libraryArgs.push('--library',join(vendor,lib.name));
  }
  const job=await mkdtemp(join(tmpdir(),'esp32-lab-avr-'));
  try {
    const sketch=join(job,'LabSketch'),output=join(job,'build'),user=join(job,'user');await mkdir(sketch);await mkdir(user);
    for(const [path,text]of Object.entries(input.files)){
      const dest=join(sketch,path==='main.ino'?'LabSketch.ino':path);await mkdir(join(dest,'..'),{recursive:true});await writeFile(dest,text,'utf8');
    }
    const normalize=text=>String(text).replaceAll('\\','/').replaceAll(sketch.replaceAll('\\','/')+'/LabSketch.ino','main.ino').replaceAll(sketch.replaceAll('\\','/')+'/', '').replaceAll(vendor.replaceAll('\\','/'),'biblioteke').replaceAll(config.directories.data.replaceAll('\\','/'),'alatni-lanac').replaceAll(job.replaceAll('\\','/'),'[posao]');
    let diagnostics;
    try{const result=await run(['compile','--fqbn',input.fqbn,'--jobs','1','--warnings','all','--build-path',output,...libraryArgs,sketch],{env:{...process.env,ARDUINO_DIRECTORIES_USER:user}});diagnostics=normalize(result.stdout+'\n'+result.stderr);}
    catch(e){const message=normalize(e.stderr??e.message).slice(-16000);throw new CompileError(message,parseDiagnostics(message));}
    const hex=await readFile(join(output,'LabSketch.ino.hex'),'utf8');
    const loaded=parseHex(hex,AVR_TARGETS[input.boardId].flash);
    const size=(await exec(join(gccRoot,'bin',process.platform==='win32'?'avr-size.exe':'avr-size'),[join(output,'LabSketch.ino.elf')],{timeout:10000})).stdout.trim().split(/\r?\n/).at(-1).trim().split(/\s+/).map(Number);
    const staticRamBytes=size[1]+size[2];
    if(!Number.isSafeInteger(staticRamBytes)||staticRamBytes>2048)throw Error('Program prelazi 2048 B SRAM-a.');
    return {format:'esp32-lab-avr-build',version:1,boardId:input.boardId,boardProfile:input.boardProfile,fqbn:input.fqbn,toolchain:input.toolchain,
      inputHash:await inputHash(project),hexHash:await sha256(hex),hex,flashBytes:loaded.extent,staticRamBytes,compiledAt:new Date().toISOString(),diagnostics:diagnostics.slice(-12000),messages:parseDiagnostics(diagnostics)};
  } finally {await rm(job,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try {
    const [file,out]=process.argv.slice(2);if(!file||!out)throw Error('Uporaba: node scripts/avr-compile.mjs projekt.json rezultat.avr.json');
    const bytes=await readFile(file);if(bytes.length>2097152)throw Error('Projekt prelazi 2 MiB.');
    const artifact=await compileProject(JSON.parse(bytes.toString('utf8')));await writeFile(out,JSON.stringify(artifact,null,2)+'\n');
    console.log('Prevedeno: '+artifact.fqbn+' · Flash '+artifact.flashBytes+' B · statički SRAM '+artifact.staticRamBytes+' B');
  } catch(e){console.error(e.message);process.exitCode=1;}
}
