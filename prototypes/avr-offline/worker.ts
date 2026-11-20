console.info('AVR_DIAG parent-start');
import {compile} from './compiler.mjs';
import {isolatedToolRunner} from './tool-runner.mjs';
import {simulate} from './simulation';

async function compileLocal(input:any) {
  const runner=isolatedToolRunner(()=>new Worker(new URL('tool-worker.js',self.location.href)));
  return compile(input,{sdk:new Map(),runner,progress:(tool:string)=>postMessage({type:'progress',tool})});
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
