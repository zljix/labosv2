import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.build',{recursive:true});
await build({entryPoints:['verification/workspace25b.test.tsx'],bundle:true,platform:'node',format:'esm',external:['jsdom','react','react-dom/*'],loader:{'.css':'empty'},outfile:'.build/workspace25b.test.mjs'});
const result=spawnSync(process.execPath,['--test','.build/workspace25b.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
