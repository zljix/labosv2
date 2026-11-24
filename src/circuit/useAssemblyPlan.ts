import {useEffect,useState} from 'react';
import type {Circuit} from './model';
import type {BreadboardPlan} from './breadboardPlan';

export function useAssemblyPlan(c:Circuit,key:string) {
  const [result,setResult]=useState<{key:string;plan:BreadboardPlan|null}>();
  useEffect(()=>{
    if(!c.wires.length || typeof Worker==='undefined'){setResult({key,plan:null});return;}
    let worker:Worker|undefined;
    try {
      worker=new Worker(new URL('./assemblyWorker.ts',import.meta.url),{type:'module'});
      worker.onmessage=(event:MessageEvent<BreadboardPlan|null>)=>{setResult({key,plan:event.data});worker?.terminate();};
      worker.onerror=()=>{setResult({key,plan:null});worker?.terminate();};
      worker.postMessage(c);
    } catch {worker?.terminate();setResult({key,plan:null});}
    // A previous project must never replace the current drawing.
    return ()=>{if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate();}};
  },[key]);
  return result?.key===key?result.plan:undefined;
}
