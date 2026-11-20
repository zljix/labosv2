import {access,readFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {delimiter,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {compileS3} from '/app/scripts/s3-compile.mjs';
let raw='';
for await(const chunk of process.stdin){raw+=chunk;if(Buffer.byteLength(raw)>4194304)throw Error('Projekt je prevelik.');}
const {project,clang,opt}=JSON.parse(raw);
try{
  const artifact=await compileS3(project,{clang,opt});
  const locate=async bin=>{
    if(bin.includes('/'))return bin;
    // Resolve within the administrator-selected sandbox PATH. /usr/bin/which
    // may point through /etc/alternatives, which is intentionally not mounted.
    for(const directory of (process.env.PATH??'').split(delimiter).filter(Boolean)){
      const candidate=resolve(directory,bin);
      try{await access(candidate,constants.X_OK);return candidate;}catch(error){
        if(!['ENOENT','EACCES','ENOTDIR'].includes(error.code))throw error;
      }
    }
    throw Error('Prevoditelj nije pronađen u dopuštenom PATH-u.');
  };
  const compilerIdentity={};
  for(const [name,bin]of Object.entries({clang,opt}))compilerIdentity[name]=createHash('sha256').update(await readFile(await locate(bin))).digest('hex');
  process.stdout.write(JSON.stringify({status:'compiled',artifact,compilerIdentity}));
}catch(error){
  // CompileError is emitted only after the pinned tools/core/libraries pass.
  // Missing tools or a version/core mismatch remain infrastructure failures.
  const infrastructure=/unable to execute command|doesn't exist|error while loading shared libraries|LLVM ERROR|ENOENT|EACCES|Cannot allocate memory|bad_alloc|timed out/.test(error.message);
  process.stdout.write(JSON.stringify({status:error.name==='CompileError'&&!infrastructure?'compile_error':'technical_error',message:infrastructure?'Prevoditelj nije dostupan.':String(error.message).slice(-16000),diagnostics:infrastructure?[]:(error.diagnostics??[])}));
}
