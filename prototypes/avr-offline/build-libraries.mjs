import {readFile,readdir,writeFile,mkdir,unlink} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {verifyLibraryFiles} from '../../scripts/avr-compile.mjs';
import {compilerFlags,runTool,TARGETS} from './compiler.mjs';
import {LIBRARIES,BUILTINS,libraryPaths} from './libraries.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');

export async function buildLibraries({sdk,source,assets,here,factory}){
  const vendor=resolve(here,'../../vendor/arduino');
  const lock=JSON.parse(await readFile(vendor+'/lock.json','utf8'));
  const packages=new Map(), evidence={libraries:{},boards:{}};
  async function walk(base,prefix=''){
    const files=[];
    for(const entry of await readdir(base+'/'+prefix,{withFileTypes:true})){
      const path=prefix+entry.name;
      if(entry.isDirectory())files.push(...await walk(base,path+'/'));
      else if(entry.isFile())files.push(path);
      else throw Error('Nedopuštena poveznica biblioteci: '+path);
    }
    return files.sort();
  }
  for(const name of [...BUILTINS,...LIBRARIES.map(x=>x.name)]){
    const builtin=BUILTINS.includes(name), base=builtin?source+'/libraries/'+name:vendor+'/'+name;
    if(!builtin){
      const pin=lock[name],expected=LIBRARIES.find(x=>x.name===name);
      if(pin.version!==expected.version||pin.digest!==expected.digest||digest(JSON.stringify(pin.files))!==pin.digest)throw Error('Library lock mismatch: '+name);
      await verifyLibraryFiles(base,pin);
    }
    const paths=await walk(base),prefix=paths.some(p=>p.startsWith('src/'))?'src/':'';
    const files=new Map();
    for(const path of paths){
      if(!path.startsWith(prefix)||! /\.(h|hpp|c|cpp|S|inc)$/.test(path))continue;
      files.set('/sysroot/libraries/'+name+'/include/'+path.slice(prefix.length),await readFile(base+'/'+path));
    }
    for(const [path,bytes] of files)sdk.set(path,bytes);
    packages.set(name,files);
    evidence.libraries[name]={version:builtin?'ArduinoCore-avr-1.8.8':lock[name].version,sourceDigest:null};
    evidence.libraries[name].sourceDigest=builtin?digest(JSON.stringify([...files].map(([p,b])=>[p,digest(b)]))):lock[name].digest;
  }
  for(const board of Object.keys(TARGETS)){
    evidence.boards[board]={};
    for(const [name,library] of packages){
      const sources=[...library.keys()].filter(p=>/\.(c|cpp|S)$/.test(p));
      if(!sources.length)continue;
      const files=new Map(sdk),objects=[],commands=[],diagnostics=[];
      const dir=resolve(assets,'library-objects',board,name);await mkdir(dir,{recursive:true});
      const dependencies=name==='DallasTemperature'?[{name:'OneWire'}]:[];
      const include=libraryPaths(board,[{name},...dependencies].filter(x=>!BUILTINS.includes(x.name))).includes;
      for(let i=0;i<sources.length;i++){
        const path=sources[i],cpp=path.endsWith('.cpp'),assembly=path.endsWith('.S'),asm='/build/unit'+i+'.s',obj='/build/unit'+i+'.o';
        console.log('Library',board,name,path.split('/').pop());
        const call=async(tool,args,output)=>{commands.push({tool,args,output});return runTool(tool,args,output,{files,factory,diagnostics});};
        await call(cpp?'cc1plus':'cc1',[...compilerFlags(board),...include,...(assembly?['-E','-lang-asm','-D__ASSEMBLER__']:cpp?['-std=gnu++11','-fno-exceptions','-fno-rtti','-fno-threadsafe-statics']:['-std=gnu11']),path,'-o',asm],asm);
        await call('avr-as',['-mmcu=atmega328p','-mgcc-isr','-o',obj,asm],obj);
        const local=dir+'/unit'+i+'.o';await writeFile(local,files.get(obj));objects.push(local);
      }
      const archive=dir+'/lib'+name+'.a';await unlink(archive).catch(e=>{if(e.code!=='ENOENT')throw e;});
      const ar=spawnSync('ar',['rcsD',archive,...objects],{encoding:'utf8'});
      if(ar.status!==0)throw Error('Library archive: '+ar.stderr);
      const bytes=await readFile(archive);sdk.set('/sysroot/arduino/boards/'+board+'/lib'+name+'.a',bytes);
      evidence.boards[board][name]={bytes:bytes.length,sha256:digest(bytes),commands,diagnostics};
    }
  }
  for(const path of [...sdk.keys()])if(path.startsWith('/sysroot/libraries/')&&/\.(c|cpp|S)$/.test(path))sdk.delete(path);
  await writeFile(here+'/library-build-manifest.json',JSON.stringify(evidence,null,2)+'\n');
}
