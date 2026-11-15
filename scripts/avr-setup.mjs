import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const exec=promisify(execFile),cli=process.env.LAB_ARDUINO_CLI??'arduino-cli',root=resolve('avr-env');
try{
  const version=JSON.parse((await exec(cli,['version','--format','json'])).stdout);
  if(version.VersionString!=='1.3.1')throw Error('Instaliraj Arduino CLI 1.3.1 i dodaj ga u PATH.');
  await mkdir(root,{recursive:true});
  const run=async args=>{const r=await exec(cli,args,{timeout:300000,maxBuffer:1024*1024});process.stdout.write(r.stdout);};
  await run(['config','init','--overwrite','--dest-dir',root]);
  const args=['--config-file',resolve(root,'arduino-cli.yaml')];
  await run([...args,'config','set','directories.data',resolve(root,'data')]);
  await run([...args,'config','set','directories.user',resolve(root,'user')]);
  await run([...args,'core','update-index']);await run([...args,'core','install','arduino:avr@1.8.6']);
  console.log('Razvojni most je pripremljen. Prevođenje sada ne preuzima biblioteke ni nove alate.');
}catch(e){console.error(e.stderr??e.message);process.exitCode=1;}
