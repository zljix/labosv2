import {compile, unpackSDK} from './compiler.mjs';
import {readPackage,SDK_FILE} from './package.mjs';
import {simulate} from './simulation';

async function compileLocal(input:any) {
  const bytes=await readPackage(), factories=new Map();
  const factory=async(name:string)=> {
    if(!factories.has(name)) {
      const url=URL.createObjectURL(new Blob([bytes.get(name+'.js')!],{type:'text/javascript'}));
      try {
        // Pinned, hash-verified upstream scripts. These scripts never fetch WASM:
        // cc1/cc1plus receive wasmBinary; binutils contain their WASM inline.
        (self as any).importScripts(url);
        const create=(self as any)[name==='cc1'||name==='cc1plus'?'createModule':'Module'];
        if(typeof create!=='function')throw Error('Nedostaje tvornica: '+name);
        factories.set(name,(options:any)=>create({...options,...(bytes.has(name+'.wasm')?{wasmBinary:bytes.get(name+'.wasm')}:{})}));
      } finally { URL.revokeObjectURL(url); }
    }
    return factories.get(name);
  };
  return compile(input,{sdk:unpackSDK(bytes.get(SDK_FILE)),factory,progress:(tool:string)=>postMessage({type:'progress',tool})});
}
let busy=false;
self.onmessage=async({data})=>{
  if(busy){postMessage({type:'error',message:'Posao je već pokrenut.'});return;}
  busy=true;
  try {
    if(data.type==='compile')postMessage({type:'compiled',result:await compileLocal(data.input)});
    else if(data.type==='simulate')postMessage({type:'simulated',result:await simulate(data.input,data.result,data.project,data.durationMs)});
    else throw Error('Nepoznata radnja.');
  }catch(error){postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}
  finally{busy=false;}
};
