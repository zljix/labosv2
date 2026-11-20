export function isolatedToolRunner(createWorker,loadAssets) {
  return async (name,args,output,{files,progress,diagnostics,timings})=>{
    progress(name);
    const assets=loadAssets?await loadAssets(name):{};
    return new Promise((resolve,reject)=>{
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
    worker.onmessage=({data})=>data.type==='result'?finish(null,data):finish(Error(data.message||'Neispravan odgovor alata.'));
    // Project buffers are small; keep originals for the following stages.
    try{worker.postMessage({name,args,output,files:[...files],assets},Object.values(assets));}catch(error){finish(error);}
  });
  };
}
