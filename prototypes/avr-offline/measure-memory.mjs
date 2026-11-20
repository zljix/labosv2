// Node-only measurement: this is not browser RSS or a school-device benchmark.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {compile,unpackSDK} from './compiler.mjs';
import {EXAMPLES} from './examples.mjs';
import runtime from './runtime-manifest.json' with {type:'json'};
const require=createRequire(import.meta.url),dir=resolve('.build/avr-toolchain');
const sdk=unpackSDK(await readFile(dir+'/'+runtime.sdkFile));
const instantiate=WebAssembly.instantiate,fetch=globalThis.fetch,observations=[];
let current;
WebAssembly.instantiate=async function(...args){
  const result=await Reflect.apply(instantiate,WebAssembly,args),instance=result.instance??result;
  for(const value of Object.values(instance.exports))if(value instanceof WebAssembly.Memory)current.push(value);
  return result;
};
globalThis.fetch=()=>{throw Error('Network forbidden during memory test');};
try{
  const factory=async name=>async options=>{
    current=[];const memories=current;
    const module=await require(dir+'/'+name+'.cjs')(options);
    const record=()=>observations.push({tool:name,linearMemoryBytes:memories.map(m=>m.buffer.byteLength)});
    if(options.noInitialRun){const callMain=module.callMain;module.callMain=(...args)=>{try{return callMain(...args);}finally{record();}};}
    else record();
    return module;
  };
  const result=await compile({board:'nano',files:EXAMPLES.multi.files},{sdk,factory});
  const evidence={scope:'One Node process, Nano multi-file compile; not browser peak RSS. Linear memories sampled at tool completion, not continuous high-water tracking.',runtime:process.version,packageHash:runtime.packageHash,observations,elapsedMs:result.elapsedMs,nodeMaxRSSKiB:process.resourceUsage().maxRSS,nodeMemoryAtEnd:process.memoryUsage()};
  await writeFile('.build/avr-memory-evidence.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence,null,2));
}finally{WebAssembly.instantiate=instantiate;globalThis.fetch=fetch;}
