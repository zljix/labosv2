import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const directory=dirname(fileURLToPath(import.meta.url));
const root=resolve(directory,'../checker'),config=process.env.LAB_SCHOOL_CONFIG;
if(!config)throw Error('Postavi privatni LAB_SCHOOL_CONFIG.');
const {compileInteractive,probeCompilers}=await import(pathToFileURL(resolve(root,'.build/school-grader/runner.mjs')).href);
const options={root,cli:process.env.LAB_ARDUINO_CLI,data:process.env.LAB_ARDUINO_DATA,s3Toolchain:process.env.LAB_S3_TOOLCHAIN,clang:process.env.LAB_WASM_CXX,opt:process.env.LAB_WASM_OPT};
function call(action,input){return new Promise((resolveResult,reject)=>{
  const child=spawn(process.env.PHP_BIN||'php',[resolve(directory,'compilation.php'),action,config],{stdio:['pipe','pipe','pipe']});
  let out='',err='';const timer=setTimeout(()=>child.kill('SIGKILL'),15000);
  child.stdout.on('data',b=>{out+=b;if(Buffer.byteLength(out)>1600000)child.kill('SIGKILL');});child.stderr.on('data',b=>err=(err+b).slice(-1000));
  child.on('error',e=>{clearTimeout(timer);reject(e);});child.on('close',code=>{clearTimeout(timer);if(code!==0)return reject(Error(err||'Privatni servis nedostupan.'));try{resolveResult(JSON.parse(out));}catch(e){reject(e);}});
  child.stdin.on('error',()=>{});child.stdin.end(input?JSON.stringify(input):'');
});}
// Probe through exactly the same isolated path as learner jobs; never infer
// readiness solely from installed filenames or successful catalogue examples.
const targets=await probeCompilers(options);
await call('heartbeat',{targets});
console.log(JSON.stringify({event:'readiness',targets}));
if(!process.argv.includes('--probe')){
  let stopping=false,controller;
  for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{stopping=true;controller?.abort();});
  do{
    await call('heartbeat',{targets});
    const {job}=await call('claim');
    if(!job){if(process.argv.includes('--once'))break;await delay(1500);continue;}
    controller=new AbortController();const jobController=controller;let checking=false;
    const poll=setInterval(async()=>{if(checking)return;checking=true;try{if(!(await call('active',{id:job.id,lease:job.lease})).active)jobController.abort();}catch{jobController.abort();}finally{checking=false;}},1000);
    let result;
    try{result=await compileInteractive(job.project,{...options,signal:jobController.signal});}
    finally{clearInterval(poll);}
    const stored=await call('complete',{id:job.id,lease:job.lease,result});
    console.log(JSON.stringify({event:'completed',id:job.id,status:result.status,accepted:stored.accepted,durationMs:result.durationMs}));
    // A pathological user program must not disable the target for the class.
    // Tool readiness is probed at service startup, independent of user input.
    controller=undefined;
  }while(!stopping&&!process.argv.includes('--once'));
}
