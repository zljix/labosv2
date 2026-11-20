export function isolatedToolRunner(createWorker) {
  return (name,args,output,{files,progress,diagnostics,timings})=>new Promise((resolve,reject)=>{
    progress(name);
    let worker;try{worker=createWorker();}catch(error){reject(error);return;}
    let finished=false;
    const finish=async(error,data)=>{
      if(finished)return;finished=true;await worker.terminate();
      // Yield between realms so cleanup is not followed immediately by the
      // allocation of the next compiler instance in the same event turn.
      await new Promise(done=>setTimeout(done,0));
      if(error){reject(error);return;}
      const bytes=new Uint8Array(data.result);files.set(output,bytes);
      diagnostics.push(...data.diagnostics);timings.push(data.timing);resolve(bytes);
    };
    worker.onerror=event=>finish(Error(event.message||'Radni proces alata nije dostupan.'));
    worker.onmessage=({data})=>data.type==='debug'?console.info('AVR_DIAG',name,data.step):data.type==='result'?finish(null,data):finish(Error(data.message||'Neispravan odgovor alata.'));
    // Project buffers are small; keep originals for the following stages.
    try{worker.postMessage({name,args,output,files:[...files]});}catch(error){finish(error);}
  });
}
