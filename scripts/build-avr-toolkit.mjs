import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {zipSync} from 'fflate';
const entries={};
for(const path of ['scripts/avr-setup.mjs','scripts/avr-compile.mjs','scripts/avr-serve.mjs','scripts/s3-compile.mjs','public/avr-contract.mjs','public/s3-contract.mjs','public/s3-core-lock.mjs','public/arduino-contract.mjs','LICENSE'])entries[path]=new Uint8Array(readFileSync(path));
function addTree(root){for(const file of readdirSync(root,{withFileTypes:true})){const path=root+'/'+file.name;if(file.isDirectory())addTree(path);else entries[path]=new Uint8Array(readFileSync(path));}}
addTree('vendor/arduino');
addTree('runtime/arduino-s3');
const text=s=>new TextEncoder().encode(s);
entries['Pripremi.cmd']=text('@echo off\r\ncd /d "%~dp0"\r\nnode scripts/avr-setup.mjs\r\npause\r\n');
entries['Pokreni.cmd']=text('@echo off\r\ncd /d "%~dp0"\r\nnode scripts/avr-serve.mjs\r\npause\r\n');
entries['README.txt']=new Uint8Array(readFileSync('docs/arduino-bridge.txt'));
writeFileSync('public/arduino-development-bridge.zip',zipSync(entries,{level:6}));
