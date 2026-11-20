import {normalizeLibraries,libraryPaths} from './libraries.mjs';
import runtime from './runtime-manifest.json' with {type:'json'};
import {parseHex, sha256} from '../../public/avr-contract.mjs';

export const PACKAGE_HASH=runtime.packageHash;
export const PROFILE = 'labos-avr-offline-prototype-2';
export const UPSTREAM = 'avr-gcc-15.2.0-pcbkit-4';
export const TARGETS = {uno: {variant:'standard', macro:'UNO', flash:32256}, nano: {variant:'eightanaloginputs', macro:'NANO', flash:30720}};
const encoder = new TextEncoder();
export function normalizeInput(input) {
  if (!Object.hasOwn(TARGETS,input?.board)) throw Error('Prototip podržava samo Uno i klasični Nano.');
  const files = {}; let bytes = 0;
  const paths = Object.keys(input.files ?? {}).sort();
  if (!paths.length || paths.length > 32) throw Error('Dopuštene su 1–32 izvorne datoteke.');
  for (const path of paths) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*\.(ino|cpp|c|h|hpp)$/.test(path) || path.toLowerCase()==='sketch.cpp' || (path.endsWith('.ino') && path !== 'main.ino')) throw Error('Prototip prihvaća main.ino i .cpp/.c/.h/.hpp datoteke u korijenu; sketch.cpp je rezerviran: ' + path);
    if (typeof input.files[path] !== 'string') throw Error('Izvor mora biti tekst.');
    bytes += encoder.encode(input.files[path]).length;
    if (bytes > 262144) throw Error('Izvor prelazi 256 KiB.');
    files[path] = input.files[path];
  }
  if (!Object.hasOwn(files, 'main.ino')) throw Error('Nedostaje main.ino.');
  if (new Set(paths.map(p=>p.toLowerCase())).size !== paths.length) throw Error('Dvostruka putanja.');
  return {profile:PROFILE, upstream:UPSTREAM, packageHash:PACKAGE_HASH, board:input.board, libraries:normalizeLibraries(input.libraries), files};
}
export const fingerprint = input => sha256(JSON.stringify(normalizeInput(input)));

export function unpackSDK(buffer) {
  const bytes = new Uint8Array(buffer);
  if (new TextDecoder().decode(bytes.subarray(0,8)) !== 'PCBSDK01') throw Error('Neispravan SDK.');
  const size = new DataView(bytes.buffer, bytes.byteOffset).getUint32(8,true), start = 12 + size;
  if (start > bytes.length) throw Error('Nepotpun SDK.');
  const entries = JSON.parse(new TextDecoder().decode(bytes.subarray(12,start))), files = new Map();
  for (const entry of entries) {
    const {path,offset,length} = entry;
    if (!/^\/sysroot\/[A-Za-z0-9_./+-]+$/.test(path) || path.split('/').includes('..') || files.has(path) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset<0 || length<0 || start+offset+length>bytes.length) throw Error('Neispravna putanja ili duljina SDK-a.');
    files.set(path,bytes.subarray(start+offset,start+offset+length));
  }
  return files;
}

function writeFiles(FS, files) {
  for (const [path, bytes] of files) {
    FS.mkdirTree(path.slice(0,path.lastIndexOf('/')) || '/');
    FS.writeFile(path,bytes);
  }
}

export async function runTool(name,args,output,{files,factory,progress=()=>{},diagnostics=[],timings=[]}) {
    progress(name); const t = performance.now(); const messages=[];
    const create = await factory(name);
    const options = {arguments:args.slice(), print:x=>messages.push(String(x)), printErr:x=>messages.push(String(x)),
      preRun:[m=>{writeFiles(m.FS,files);m.FS.mkdirTree(output.slice(0,output.lastIndexOf("/")));}], noInitialRun:name==='cc1'||name==='cc1plus'};
    const module = await create(options);
    const status = options.noInitialRun ? module.callMain(args.slice()) : undefined;
    diagnostics.push(...messages);
    if (status && status!==0) throw Error(messages.join('\n') || name+' nije uspio.');
    let result;
    try { result=module.FS.readFile(output).slice(); }
    catch { throw Error(messages.join('\n') || name+': nema rezultata.'); }
    if (!result.length || messages.some(x=>/\b(?:fatal error|error):|undefined reference/.test(x))) throw Error(messages.join('\n') || 'Prazan rezultat.');
    files.set(output,result); timings.push({tool:name,ms:Math.round(performance.now()-t)});
    return result;
  }

export function compilerFlags(board) {
  const target=TARGETS[board];
  const includes=['-I/project','-I/sysroot/arduino/cores/arduino','-I/sysroot/arduino/variants/'+target.variant,'-isystem','/sysroot/gcc-include','-isystem','/sysroot/avr/include'];
  return ['-quiet','-Os','-mmcu=avr5','-mn-flash=1','-mno-skip-bug','-D__AVR_ATmega328P__','-D__AVR_DEVICE_NAME__=atmega328p','-DF_CPU=16000000L','-DARDUINO=10819','-DARDUINO_AVR_'+target.macro,'-DARDUINO_ARCH_AVR','-ffunction-sections','-fdata-sections',...includes];
}

// Each invocation gets a fresh Emscripten instance and virtual filesystem.
// There is no server compiler and no precompiled sketch lookup.
export async function compile(input, {sdk, factory, progress=()=>{}}) {
  input = normalizeInput(input);
  const started = performance.now(), target = TARGETS[input.board];
  const inputHash = await fingerprint(input), diagnostics = [], timings = [];
  const files = new Map(sdk);
  for (const [path,content] of Object.entries(input.files)) files.set('/project/'+path,encoder.encode(content));
  files.set('/project/sketch.cpp',encoder.encode('#include <Arduino.h>\n#line 1 "main.ino"\n'+input.files['main.ino']));
  const tool=(name,args,output)=>runTool(name,args,output,{files,factory,progress,diagnostics,timings});
  const libraries=libraryPaths(input.board,input.libraries);
  const common=[...compilerFlags(input.board),...libraries.includes];
  const sources=['sketch.cpp',...Object.keys(input.files).filter(p=>/\.(cpp|c)$/.test(p))], objects=[];
  for (let i=0;i<sources.length;i++) {
    const source=sources[i], cpp=source.endsWith('.cpp'), asm='/project/unit'+i+'.s', obj='/project/unit'+i+'.o';
    await tool(cpp?'cc1plus':'cc1',[...common,...(cpp?['-std=gnu++11','-fno-exceptions','-fno-rtti','-fno-threadsafe-statics']:['-std=gnu11']),'/project/'+source,'-o',asm],asm);
    await tool('avr-as',['-mmcu=atmega328p','-mgcc-isr','-o',obj,asm],obj); objects.push(obj);
  }
  const avr='/sysroot/avr/lib/avr5', core='/sysroot/arduino/boards/'+input.board;
  const elf=await tool('avr-ld',['-m','avr5','-T','/sysroot/avr/lib/ldscripts/avr5.x','--gc-sections','-o','/project/result.elf',avr+'/crtatmega328p.o',...objects,'-L'+avr,'-L/sysroot/libgcc/avr5','-L'+core,'--start-group',...libraries.archives,'-lcore','-lgcc','-lm','-lc','-latmega328p','--end-group'],'/project/result.elf');
  const staticRamBytes=elfStaticRAM(elf);
  if (staticRamBytes>2048) throw Error('Program prelazi 2048 B statičkog SRAM-a.');
  const hex=new TextDecoder().decode(await tool('objcopy',['-O','ihex','-R','.eeprom','/project/result.elf','/project/result.hex'],'/project/result.hex'));
  const loaded=parseHex(hex,target.flash);
  return {format:'labos-avr-prototype-build',version:2,profile:PROFILE,upstream:UPSTREAM,packageHash:PACKAGE_HASH,board:input.board,inputHash,hex,hexHash:await sha256(hex),flashBytes:loaded.extent,staticRamBytes,diagnostics,timings,elapsedMs:Math.round(performance.now()-started)};
}
function elfStaticRAM(bytes) {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if (v.getUint32(0,true)!==0x464c457f || bytes[4]!==1 || bytes[5]!==1) throw Error('Neispravan ELF32.');
  const offset=v.getUint32(32,true), size=v.getUint16(46,true), count=v.getUint16(48,true); let ram=0;
  if(size<40 || offset+size*count>bytes.length) throw Error('Nepotpune ELF sekcije.');
  for(let i=0;i<count;i++) {const p=offset+i*size, flags=v.getUint32(p+8,true), addr=v.getUint32(p+12,true), length=v.getUint32(p+20,true); if((flags&2)&&addr>=0x800100&&addr<0x810000)ram=Math.max(ram,addr-0x800100+length);}
  return ram;
}
export async function validateResult(input,result) {
  const normalized=normalizeInput(input);
  if(result?.format!=='labos-avr-prototype-build'||result.version!==2||result.profile!==PROFILE||result.upstream!==UPSTREAM||result.packageHash!==PACKAGE_HASH||result.board!==normalized.board||result.inputHash!==await fingerprint(input)) throw Error('Izvor ili pločica promijenjeni su. Ponovno prevedi program.');
  if(result.hexHash!==await sha256(result.hex)) throw Error('Oštećen HEX.');
  const loaded=parseHex(result.hex,TARGETS[result.board].flash);
  if(result.flashBytes!==loaded.extent||!Number.isSafeInteger(result.staticRamBytes)||result.staticRamBytes<0||result.staticRamBytes>2048)throw Error('Neispravna memorija rezultata.');
  return result;
}
