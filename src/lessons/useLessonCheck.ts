import { useEffect, useRef, useState } from 'react';
import type { Project } from '../project/model';
import { verifyLesson, sourceValue, type LessonResult } from './verify';
import {runtimeAsset} from '../platform/assets';

export function useLessonCheck(project:Project|undefined,onResult:(r:LessonResult)=>void,notify:(s:string)=>void) {
  const [busy,setBusy]=useState(false),[progress,setProgress]=useState('');
  const controller=useRef<AbortController>(undefined),current=useRef(project),callback=useRef(onResult);
  current.current=project;callback.current=onResult;
  const identity=project?.id,content=project?sourceValue(project):'';
  useEffect(()=>{controller.current?.abort();setBusy(false);setProgress('');},[identity,content]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function cancel(){controller.current?.abort();setBusy(false);setProgress('Provjera je prekinuta; raniji zapis nije zamijenjen.');}
  async function run(){
    if(!current.current||busy)return;
    const p=structuredClone(current.current),abort=new AbortController();
    controller.current=abort;setBusy(true);setProgress('Učitavanje interpretera…');
    try {
      const response=await fetch(runtimeAsset('machine.py'),{cache:'no-store',signal:abort.signal});
      if(!response.ok)throw Error('Ne mogu učitati MicroPython prilagodbu.');
      const machine=await response.text();
      const result=await verifyLesson(p,{machine,factory:()=>new Worker(runtimeAsset('worker.mjs'),{type:'module'})},abort.signal,setProgress);
      if(abort.signal.aborted||current.current?.id!==p.id||sourceValue(current.current)!==sourceValue(p))return;
      callback.current(result);
      const passed=result.checks.filter(c=>c.passed).length;
      setProgress(`${passed}/${result.checks.length} provjera prolazi. Ulazi izvornog projekta ostali su sačuvani.`);
      notify(passed===result.checks.length?'Provjera rada je dovršena. Zapiši odgovore i pripremi predaju.':'Provjera je pronašla odstupanja. Pogledaj očekivano i opaženo ponašanje.');
    } catch(e){
      if((e as Error).name!=='AbortError'){setProgress((e as Error).message);notify((e as Error).message);}
    } finally {if(controller.current===abort)setBusy(false);}
  }
  return {busy,progress,run,cancel};
}
