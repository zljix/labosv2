// MIT. Source-bound functional WASM artifacts; never ESP32 flashable binaries.
import {sha256,validArduinoPath,selectedLibraries as avrLibraries} from './avr-contract.mjs';
import {S3_CORE_DIGEST} from './s3-core-lock.mjs';
export const S3_BOARD='espressif.esp32-s3-devkitc-1.v1.1.n16r8';
export const S3_FQBN='esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi';
export const S3_BUILD_FILE='s3-build.json';
export const S3_COMPILE_FLAGS=Object.freeze(['--target=wasm32-unknown-unknown','-O1','-DARDUINO=10819','-ffreestanding','-fno-builtin','-fno-exceptions','-fno-rtti','-fno-threadsafe-statics','-fno-c++-static-destructors','-nostdlib','-nostdinc++','-Wall','-Wextra','-Wno-unused-parameter']);
export const S3_TOOLCHAIN=Object.freeze({compiler:'clang@19.1.7',optimizer:'binaryen@120',core:'esp32-lab-s3-functional@1.1.0',coreDigest:S3_CORE_DIGEST,flags:S3_COMPILE_FLAGS,dialect:'c++17/c11; explicit-prototypes',memoryBytes:2097152,asyncifyStackBytes:131072,libraries:[]});
export const S3_LIBRARY_NAMES=Object.freeze(['Bounce2','LabAHT10','LabI2CSensors','LabLCD1602','DHT','OneWire','DallasTemperature','U8g2','U8g2_12832']);
export function selectedLibraries(p){const libs=avrLibraries(p);if(libs.some(l=>!S3_LIBRARY_NAMES.includes(l.name)))throw Error('Ta biblioteka još nije podržana u funkcionalnom ESP32-S3 C++ profilu. Odaberi provjerenu biblioteku u prozoru Prevedi.');return libs;}
export function buildInput(p){
 if(p?.board?.id!==S3_BOARD||p.board.profileVersion!=='0.0.1'||p.language!=='arduino-cpp'||p.runtimeProfile?.id!=='arduino-s3-wasm'||p.runtimeProfile.version!==1||p.entryFile!=='main.ino'||p.target?.fqbn!==S3_FQBN)throw Error('Nepodržan ESP32-S3 Arduino cilj ili izvršni profil.');
 const files={};let size=0;
 for(const path of Object.keys(p.files??{}).sort()){
  if(!/\.(ino|c|cpp|h|hpp)$/.test(path))continue;
  if(!validArduinoPath(path)||typeof p.files[path]!=='string')throw Error('Neispravna Arduino izvorna putanja: '+path);
  size+=new TextEncoder().encode(p.files[path]).length;
  if(size>1048576||Object.keys(files).length>=64)throw Error('Arduino izvor prelazi dopuštenu veličinu.');
  files[path]=p.files[path];
 }
 if(typeof files['main.ino']!=='string'||new Set(Object.keys(files).map(x=>x.toLowerCase())).size!==Object.keys(files).length)throw Error('Nedostaje main.ino ili se izvorne putanje ponavljaju.');
 const libraries=selectedLibraries(p);
 return {format:'esp32-lab-s3-input',version:1,boardId:S3_BOARD,boardProfile:p.board.profileVersion,fqbn:S3_FQBN,entryFile:'main.ino',toolchain:libraries.length?{...S3_TOOLCHAIN,libraries}:S3_TOOLCHAIN,files};
}
export const inputHash=p=>sha256(JSON.stringify(buildInput(p)));
export const S3_IMPORTS=Object.freeze(['lab_gpio_mode','lab_gpio_write','lab_gpio_read','lab_adc','lab_pwm','lab_clock','lab_delay','lab_fault','lab_serial','lab_i2c_config','lab_i2c_tx','lab_i2c_rx','lab_spi_config','lab_spi_transfer','lab_spi_bytes','lab_pulse','sqrt','pow','log','exp','sin','cos','floor','ceil','round','fabs']);
export function wasmBytes(base64){
 if(typeof base64!=='string'||base64.length>106668||!base64.length||base64.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw Error('Neispravan ili prevelik WASM program.');
 const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));if(bytes.length>80000)throw Error('WASM program prelazi 80 000 B.');return bytes;
}
export function validateModule(bytes){
 // Bound the declared memory/table before instantiating untrusted imported bytes.
 let at=8;const uint=()=>{let v=0,shift=0;for(let i=0;i<5;i++){if(at>=bytes.length)throw Error('Prekinut WASM zapis.');const b=bytes[at++];v+=(b&127)*2**shift;if(!(b&128))return v;shift+=7;}throw Error('Predug WASM broj.');};
 let memories=0;
 while(at<bytes.length){const id=bytes[at++],size=uint(),end=at+size;if(end>bytes.length)throw Error('Prekinut WASM odjeljak.');
  if(id===5){memories=uint();if(memories!==1||uint()!==1||uint()!==32||uint()!==32)throw Error('WASM profil zahtijeva točno 2 MiB ograničene memorije.');}
  if(id===4){const n=uint();if(n>1)throw Error('Nepodržane WASM tablice.');for(let i=0;i<n;i++){if(bytes[at++]!==0x70)throw Error('Nepodržana WASM tablica.');const flags=uint(),lo=uint(),hi=flags===1?uint():lo;if(flags!==1||lo>4096||hi>4096)throw Error('Prevelika ili neograničena WASM tablica.');}}
  if(id===8)throw Error('WASM početna funkcija nije dopuštena.');at=end;
 }
 if(memories!==1)throw Error('Nedostaje WASM memorija.');
 const module=new WebAssembly.Module(bytes);
 if(WebAssembly.Module.imports(module).some(i=>i.module!=='env'||i.kind!=='function'||!S3_IMPORTS.includes(i.name)))throw Error('Program traži nepodržan WASM API.');
 const exports=WebAssembly.Module.exports(module);if(!exports.some(e=>e.name==='memory'&&e.kind==='memory'))throw Error('Nedostaje izvoz WASM memorije.');for(const name of ['lab_init','lab_setup','lab_loop','lab_async_data','asyncify_start_unwind','asyncify_stop_unwind','asyncify_start_rewind','asyncify_stop_rewind','asyncify_get_state'])if(!exports.some(e=>e.name===name&&e.kind==='function'))throw Error('Nedostaje izvršni WASM API: '+name);
 return module;
}
export async function validateArtifact(project,value){
 if(value?.format!=='esp32-lab-s3-build'||value.version!==1)throw Error('Odaberi ESP32-S3 WASM .json rezultat prevoditelja.');
 const input=buildInput(project);
 if(value.boardId!==input.boardId||value.boardProfile!==input.boardProfile||value.fqbn!==input.fqbn||JSON.stringify(value.toolchain)!==JSON.stringify(input.toolchain))throw Error('Prevedeni program pripada drugom cilju, bibliotekama ili alatnom lancu.');
 if(value.inputHash!==await inputHash(project))throw Error('Izvor je promijenjen. Ponovno prevedi ovaj projekt; stari program nije pokrenut.');
 const bytes=wasmBytes(value.wasm);if(value.wasmHash!==await sha256(bytes)||value.wasmBytes!==bytes.length||value.memoryBytes!==2097152)throw Error('WASM program ili njegovi metapodaci izmijenjeni su ili oštećeni.');
 validateModule(bytes);return value;
}
