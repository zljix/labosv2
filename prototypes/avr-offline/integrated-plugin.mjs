import {build} from 'esbuild';
import {cp,mkdir,readFile} from 'node:fs/promises';
export function integratedAvrPlugin(root){
  return {name:'labos-integrated-avr-prototype',apply:'build',async writeBundle(){
    const source=root+'/.build/avr-offline',out=root+'/dist/offline-avr';
    const manifest=JSON.parse(await readFile(source+'/toolchain/manifest.json','utf8'));
    const expected=JSON.parse(await readFile(root+'/prototypes/avr-offline/runtime-manifest.json','utf8'));
    if(manifest.packageHash!==expected.packageHash)throw Error('Prvo izgradi aktualni offline AVR paket.');
    await mkdir(out,{recursive:true});await cp(source+'/toolchain',out+'/toolchain',{recursive:true});
    await build({entryPoints:[root+'/prototypes/avr-offline/worker.ts'],bundle:true,platform:'browser',target:'es2022',format:'iife',outfile:out+'/worker.js'});
  }};
}
