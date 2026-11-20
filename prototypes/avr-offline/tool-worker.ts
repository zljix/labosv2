import {runTool,unpackSDK} from './compiler.mjs';
import {readPackageFile,FILES,SDK_FILE} from './package.mjs';
import {toolFiles} from './tool-files.mjs';

// One tool, one disposable realm. The parent terminates it before starting
// the next step, releasing the WASM instance and compiled JS together.
self.onmessage=async({data})=>{
  try {
    const {name,args,output}=data;const debug=step=>postMessage({type:'debug',step});debug('start');
    if(!['cc1','cc1plus','avr-as','avr-ld','objcopy'].includes(name))throw Error('Nepoznat alat.');
    debug('sdk-read');const sdk=['cc1','cc1plus','avr-ld'].includes(name)?unpackSDK(await readPackageFile(SDK_FILE)):new Map();
    debug('sdk-ready');const files=toolFiles(name,args,sdk,new Map(data.files));
    debug('script-read');const script=await readPackageFile(name+'.js');
    debug('script-ready');const binary=Object.hasOwn(FILES,name+'.wasm')?await readPackageFile(name+'.wasm'):undefined;
    debug('binary-ready');const url=URL.createObjectURL(new Blob([script],{type:'text/javascript'}));
    let create:any;
    try {(self as any).importScripts(url);create=(self as any)[name==='cc1'||name==='cc1plus'?'createModule':'Module'];}
    finally {URL.revokeObjectURL(url);}
    if(typeof create!=='function')throw Error('Nedostaje alat: '+name);
    const diagnostics:any[]=[],timings:any[]=[];
    debug('run-tool');const result=await runTool(name,args,output,{files,diagnostics,timings,factory:async()=>options=>create({...options,...(binary?{wasmBinary:binary}:{})})});
    (self as any).postMessage({type:'result',result,diagnostics,timing:timings[0]},[result.buffer]);
  } catch(error) {postMessage({type:'error',message:error instanceof Error?error.message:String(error)});}
};
