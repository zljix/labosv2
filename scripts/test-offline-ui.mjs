import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
mkdirSync('.build',{recursive:true});
await build({entryPoints:['verification/offline-ui.test.tsx'],bundle:true,platform:'node',format:'esm',external:['jsdom','react','react-dom/*'],loader:{'.css':'empty'},define:{__APP_BUILD__:'"ui-test"',__APP_BASE__:'"/labos/"'},outfile:'.build/offline-ui.test.mjs'});
const result=spawnSync(process.execPath,['--test','.build/offline-ui.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exitCode=result.status??1;
