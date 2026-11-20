import {copyFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

// Node test files run in parallel. Publish complete CommonJS adapters atomically
// so another process cannot require a file while copyFile has truncated it.
export async function prepareNodeTools(dir) {
  for(const name of ['cc1','cc1plus','avr-as','avr-ld','objcopy']) {
    const target=dir+'/'+name+'.cjs',temporary=target+'.'+randomUUID()+'.tmp';
    await copyFile(dir+'/'+name+'.js',temporary);
    await rename(temporary,target);
  }
}
