import {readFileSync} from 'node:fs';
import {resolve, sep} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function checkedPath(root, name) {
  if (!name || name.includes('\\') || name.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Unsafe package path: '+name);
  const file = resolve(root, name);
  if (!file.startsWith(resolve(root)+sep)) throw Error('Package path escaped root');
  return file;
}
export function verifyBytes(bytes, expected, label) {
  if (bytes.length !== expected.bytes || digest(bytes) !== expected.sha256) throw Error('Integrity mismatch: '+label);
}
export function verifyApplication(root, expectedBase, runtime, packed, licenses) {
  const manifest = JSON.parse(readFileSync(resolve(root,'offline-package.json')));
  if (manifest.base !== expectedBase) throw Error('Incorrect deployment base');
  for (const item of manifest.files) {
    if (!item.url.startsWith(expectedBase)) throw Error('Application escaped deployment base');
    verifyBytes(readFileSync(checkedPath(root,item.url.slice(expectedBase.length))), item, item.url);
  }
  if (!manifest.files.some(f => f.url === expectedBase+'offline-avr/worker.js')) throw Error('Integrated worker missing');
  if (manifest.files.some(f => f.url.startsWith(expectedBase+'offline-avr/toolchain/'))) throw Error('Compiler duplicated in app cache');
  const dir=resolve(root,'offline-avr/toolchain');
  const actual=JSON.parse(readFileSync(resolve(dir,'manifest.json')));
  if (JSON.stringify(actual)!==JSON.stringify(runtime)) throw Error('Compiler identity mismatch');
  for(const [name,expected] of Object.entries(runtime.files)) {
    const compressed=readFileSync(checkedPath(dir,name+'.gz'));
    if(compressed.length!==packed[name].bytes) throw Error('Compressed size mismatch: '+name);
    verifyBytes(gunzipSync(compressed,{maxOutputLength:expected.bytes}),expected,name);
  }
  for(const [name,expected] of Object.entries(licenses.files)) verifyBytes(readFileSync(checkedPath(dir,name)),expected,name);
  return manifest;
}
export function verifySources(root, inventory) {
  const records=[];
  for(const line of inventory.split('\n')) {
    if(!line.trim() || line.startsWith('#')) continue;
    const [name,sourceURL,sha256]=line.trim().split(/\s+/);
    if(!/^[a-f0-9]{64}$/.test(sha256)) throw Error('Invalid pinned source hash');
    const bytes=readFileSync(checkedPath(root,name));
    if(digest(bytes)!==sha256) throw Error('Source mismatch: '+name);
    records.push({name,sourceURL,sha256,bytes:bytes.length});
  }
  if(!records.length) throw Error('Empty source inventory');
  return records;
}
