import {compile} from './compiler.mjs';
import {isolatedToolRunner} from './tool-runner.mjs';
import {simulate} from './simulation';
import {FILES,SDK_FILE} from './package.mjs';

let fileSequence=0;
const pendingFiles=new Map<number,{resolve:(bytes:ArrayBuffer)=>void,reject:(error:Error)=>void}>();
const readInWindow=(name:string)=>new Promise<ArrayBuffer>((resolve,reject)=>{
  const id=++fileSequence;pendingFiles.set(id,{resolve,reject});postMessage({type:'read-package-file',id,name});
});

async function compileLocal(input:any) {
  const runner=isolatedToolRunner(()=>new Worker(new URL('tool-worker.js',self.location.href)),async(name:string)=>{
    const names=[name+'.js',...(Object.hasOwn(FILES,name+'.wasm')?[name+'.wasm']:[]),...(['cc1','cc1plus','avr-ld'].includes(name)?[SDK_FILE]:[])];
    const assets:Record<string,ArrayBuffer>={};for(const file of names)assets[file]=await readInWindow(file);return assets;
  });
  return compile(input,{sdk:new Map(),runner,progress:(tool:string)=>postMessage({type:'progress',tool})});
}
let busy=false;
self.onmessage=async({data})=>{
  if(data.type==='package-file'){
    const pending=pendingFiles.get(data.id);if(!pending)return;pendingFiles.delete(data.id);
    if(data.error)pending.reject(Error(String(data.error)));else pending.resolve(data.bytes);return;
  }
  if(busy){postMessage({type:'error',message:'Posao je već pokrenut.'});return;}
  busy=true;
  try {
    if(data.type==='compile')postMessage({type:'compiled',result:await compileLocal(data.input)});
    else if(data.type==='simulate')postMessage({type:'simulated',result:await simulate(data.input,data.result,data.project,data.durationMs)});
    else throw Error('Nepoznata radnja.');
  }catch(error){postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}
  finally{busy=false;}
};
