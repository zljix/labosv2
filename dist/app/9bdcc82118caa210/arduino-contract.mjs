// Keep the AVR contract and all earlier AVR hashes byte-for-byte unchanged.
import * as avr from './avr-contract.mjs';
import * as s3 from './s3-contract.mjs';
const contract=p=>p?.board?.id===s3.S3_BOARD?s3:avr;
export const buildFile=p=>p?.board?.id===s3.S3_BOARD?s3.S3_BUILD_FILE:avr.AVR_BUILD_FILE;
export const buildInput=p=>contract(p).buildInput(p);
export const inputHash=p=>contract(p).inputHash(p);
export const validateArtifact=(p,a)=>contract(p).validateArtifact(p,a);
export const selectedLibraries=p=>contract(p).selectedLibraries(p);
export const memoryDescription=a=>a.format==='esp32-lab-s3-build'?`WASM ${a.wasmBytes} B · funkcionalni profil, bez mjerenja ESP32 SRAM-a`:`Flash ${a.flashBytes} B · statički SRAM ${a.staticRamBytes}/2048 B`;
