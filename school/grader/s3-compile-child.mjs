import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {compileS3} from '/app/scripts/s3-compile.mjs';
let raw='';
for await(const chunk of process.stdin){raw+=chunk;if(Buffer.byteLength(raw)>4194304)throw Error('Projekt je prevelik.');}
const {project,clang,opt}=JSON.parse(raw);
try{
  const artifact=await compileS3(project,{clang,opt});
  const locate=async bin=>bin.includes('/')?bin:(await promisify(execFile)('/usr/bin/which',[bin])).stdout.trim();
  const compilerIdentity={};
  for(const [name,bin]of Object.entries({clang,opt}))compilerIdentity[name]=createHash('sha256').update(await readFile(await locate(bin))).digest('hex');
  process.stdout.write(JSON.stringify({status:'compiled',artifact,compilerIdentity}));
}catch(error){
  // CompileError is emitted only after the pinned tools/core/libraries pass.
  // Missing tools or a version/core mismatch remain infrastructure failures.
  const infrastructure=/unable to execute command|doesn't exist|error while loading shared libraries|LLVM ERROR|ENOENT|EACCES|Cannot allocate memory|bad_alloc|timed out/.test(error.message);
  process.stdout.write(JSON.stringify({status:error.name==='CompileError'&&!infrastructure?'compile_error':'technical_error',diagnostic:String(error.message).slice(-2000)}));
}
