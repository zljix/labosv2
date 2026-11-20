// Build-time only: board-specific Arduino cores using the same pinned WASM tools
// as the browser. No native AVR compiler or upstream precompiled core is used.
import {readFile,writeFile,readdir,mkdir,copyFile,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {buildLibraries} from './build-libraries.mjs';
import {unpackSDK,compilerFlags,runTool,TARGETS} from './compiler.mjs';

export const CORE_SOURCE={name:'ArduinoCore-avr-1.8.8.tar.gz',sha256:'e37de8a50ccf3a6a43aee2d482c066519ec05fb7fff63f57fd9daf0fd238b808'};
const digest=b=>createHash('sha256').update(b).digest('hex');
export function packSDK(files) {
  let offset=0;const entries=[], chunks=[];
  for(const [path,bytes] of [...files].sort(([a],[b])=>a<b?-1:a>b?1:0)){
    entries.push({path,offset,length:bytes.length});chunks.push(bytes);offset+=bytes.length;
  }
  const index=Buffer.from(JSON.stringify(entries)),header=Buffer.alloc(12);
  header.write('PCBSDK01');header.writeUInt32LE(index.length,8);
  return Buffer.concat([header,index,...chunks]);
}
export async function buildSDK({assets,here,upstream}) {
  const archive=resolve(assets,CORE_SOURCE.name);
  try{if(digest(await readFile(archive))!==CORE_SOURCE.sha256)throw Error('Source integrity');}
  catch{
    const result=spawnSync('curl',['-fsSL','--retry','2','--max-time','120',`https://github.com/pcbkit-io/toolchain/releases/download/${upstream.id}/${CORE_SOURCE.name}`,'-o',archive],{stdio:'inherit'});
    if(result.status!==0||digest(await readFile(archive))!==CORE_SOURCE.sha256)throw Error('Arduino source integrity failed');
  }
  const sourceDir=resolve(assets,'core-source');await mkdir(sourceDir,{recursive:true});
  const extract=spawnSync('tar',['-xzf',archive,'-C',sourceDir],{stdio:'inherit'});
  if(extract.status!==0)throw Error('Cannot extract pinned Arduino sources');
  const source=resolve(sourceDir,'ArduinoCore-avr-1.8.8'), original=unpackSDK(await readFile(assets+'/sdk.bin'));
  const sdk=new Map([...original].filter(([p])=>p.startsWith('/sysroot/avr/include/')||p.startsWith('/sysroot/gcc-include/')||p==='/sysroot/libgcc/avr5/libgcc.a'||p==='/sysroot/avr/lib/ldscripts/avr5.x'||/^\/sysroot\/avr\/lib\/avr5\/(crtatmega328p\.o|lib(atmega328p|c|m)\.a)$/.test(p)||p.startsWith('/sysroot/licenses/')));
  const coreDir=source+'/cores/arduino', names=(await readdir(coreDir)).sort();
  for(const name of names)sdk.set('/sysroot/arduino/cores/arduino/'+name,await readFile(coreDir+'/'+name));
  for(const target of Object.values(TARGETS))sdk.set('/sysroot/arduino/variants/'+target.variant+'/pins_arduino.h',await readFile(source+'/variants/'+target.variant+'/pins_arduino.h'));
  const require=createRequire(import.meta.url);
  for(const name of ['cc1','cc1plus','avr-as','avr-ld'])await copyFile(assets+'/'+name+'.js',assets+'/'+name+'.cjs');
  const factory=async name=>require(assets+'/'+name+'.cjs');
  const evidence={source:CORE_SOURCE,upstream:upstream.id,recipe:'prototypes/avr-offline/build-sdk.mjs',boards:{}};
  for(const board of Object.keys(TARGETS)){
    const files=new Map(sdk),objects=[],commands=[],diagnostics=[];
    const call=async(name,args,out)=>{commands.push({tool:name,args,output:out});return runTool(name,args,out,{files,factory,diagnostics});};
    for(const name of names.filter(n=>/\.(c|cpp|S)$/.test(n))){
      const input='/sysroot/arduino/cores/arduino/'+name,asm='/build/'+name+'.s',obj='/build/'+name+'.o',cpp=name.endsWith('.cpp'),assembly=name.endsWith('.S');
      console.log('Core',board,name);
      await call(cpp?'cc1plus':'cc1',[...compilerFlags(board),...(assembly?['-E','-lang-asm','-D__ASSEMBLER__']:cpp?['-std=gnu++11','-fno-exceptions','-fno-rtti','-fno-threadsafe-statics']:['-std=gnu11']),input,'-o',asm],asm);
      await call('avr-as',['-mmcu=atmega328p','-mgcc-isr','-o',obj,asm],obj);objects.push(obj);
    }
    const objectDir=resolve(assets,'core-objects',board);await mkdir(objectDir,{recursive:true});
    for(const obj of objects)await writeFile(objectDir+'/'+obj.split('/').pop(),files.get(obj));
    const archivePath=objectDir+'/libcore.a';
    await unlink(archivePath).catch(e=>{if(e.code!=='ENOENT')throw e;});
    // GNU ar writes architecture-neutral archives and indexes ELF AVR objects.
    // Deterministic mode removes host timestamps/UIDs from archive members.
    const arArgs=['rcsD',archivePath,...objects.map(p=>objectDir+'/'+p.split('/').pop())];
    const archived=spawnSync('ar',arArgs,{encoding:'utf8'});
    if(archived.status!==0)throw Error('Core archive: '+archived.stderr);
    commands.push({tool:'ar',args:['rcsD','libcore.a',...objects.map(p=>p.split('/').pop())]});
    const path='/sysroot/arduino/boards/'+board+'/libcore.a';
    const core=await readFile(archivePath);
    sdk.set(path,core);
    evidence.boards[board]={variant:TARGETS[board].variant,macro:'ARDUINO_AVR_'+TARGETS[board].macro,bytes:core.length,sha256:digest(core),commands,diagnostics};
  }
  await buildLibraries({sdk,source,assets,here,factory});
  // Sources travel separately; the browser only needs public core headers.
  for(const p of [...sdk.keys()])if(/\/cores\/arduino\/.*\.(c|cpp|S)$/.test(p))sdk.delete(p);
  const bytes=packSDK(sdk),metadata={bytes:bytes.length,sha256:digest(bytes)};
  const sdkFile='sdk-uno-nano-'+metadata.sha256.slice(0,16)+'.bin';
  await writeFile(assets+'/'+sdkFile,bytes);
  evidence.sdk={...metadata,entries:sdk.size,originalBytes:upstream.files['sdk.bin'].bytes};
  await writeFile(here+'/core-build-manifest.json',JSON.stringify(evidence,null,2)+'\n');
  const files={...upstream.files};delete files['ctags.js'];delete files['sdk.bin'];files[sdkFile]=metadata;
  const manifest={id:'labos-avr-uno-nano-libraries-3',upstream:upstream.id,sdkFile,files};
  manifest.packageHash=digest(JSON.stringify(manifest));
  await writeFile(here+'/runtime-manifest.json',JSON.stringify(manifest,null,2)+'\n');
  return manifest;
}
