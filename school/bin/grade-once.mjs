import {spawn} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

// Trusted broker only. PHP sees the database; gradeJob receives data over stdin
// and its disposable execution sandbox has no configuration, credentials or LAN.
const tools=dirname(fileURLToPath(import.meta.url)),php=process.env.PHP_BIN||'php';
const config=process.env.LAB_SCHOOL_CONFIG;if(!config)throw Error('Postavi privatni LAB_SCHOOL_CONFIG.');
const root=resolve(tools,'../checker');
function call(action,input){return new Promise((done,reject)=>{
  const p=spawn(php,[resolve(tools,'grading.php'),action,config],{stdio:['pipe','pipe','pipe']});let out='',err='';
  p.stdout.on('data',b=>{out+=b;if(out.length>8000000)p.kill('SIGKILL');});p.stderr.on('data',b=>err=(err+b).slice(-2000));
  p.on('error',reject);p.on('close',code=>{if(code!==0)return reject(Error(err||'Privatni servis nije dostupan.'));try{done(JSON.parse(out));}catch(e){reject(e);}});p.stdin.on('error',()=>{});p.stdin.end(input?JSON.stringify(input):'');
});}
const {job}=await call('claim');
if(!job){console.log(JSON.stringify({status:'idle'}));}else{
  const {gradeJob}=await import(pathToFileURL(resolve(root,'.build/school-grader/official.mjs')).href);
  const report=await gradeJob(job,{root,compile:process.env.LAB_GRADER_COMPILE==='1',cli:process.env.LAB_ARDUINO_CLI,data:process.env.LAB_ARDUINO_DATA,
    s3Toolchain:process.env.LAB_S3_TOOLCHAIN,clang:process.env.LAB_WASM_CXX,opt:process.env.LAB_WASM_OPT});
  const result=await call('complete',{jobId:job.jobId,lease:job.lease,report});console.log(JSON.stringify(result));
}
