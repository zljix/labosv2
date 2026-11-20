import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
await build({entryPoints:['verification/compiler-ui.test.tsx'],bundle:true,platform:'node',format:'esm',external:['jsdom','react','react-dom/*'],loader:{'.css':'empty'},outfile:'.build/compiler-ui.test.mjs',define:{__APP_BASE__:'"/"',__APP_BUILD__:'"test"'}});
const r=spawnSync(process.execPath,['--test','.build/compiler-ui.test.mjs'],{stdio:'inherit'});if(r.error)throw r.error;process.exitCode=r.status??1;
