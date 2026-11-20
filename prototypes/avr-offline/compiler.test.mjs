import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,copyFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {compile,normalizeInput,fingerprint,unpackSDK,validateResult} from './compiler.mjs';
import {EXAMPLES} from './examples.mjs';
import {simulate} from './simulation.ts';
import runtime from './runtime-manifest.json' with {type:'json'};
const dir=resolve('.build/avr-toolchain'), require=createRequire(import.meta.url);
for(const name of ['cc1','cc1plus','avr-as','avr-ld','objcopy'])await copyFile(dir+'/'+name+'.js',dir+'/'+name+'.cjs');
const sdk=unpackSDK(await readFile(dir+'/'+runtime.sdkFile));
const factory=async name=>require(dir+'/'+name+'.cjs');
test('real WASM tools compile Uno/Nano, separate C++ and separate C',async()=>{
  const evidence={runtime:process.version,platform:process.platform,scope:'Node WebAssembly compiler + unchanged Labos AVREngine; not browser offline proof',cases:[]};
  for(const board of ['uno','nano'])for(const example of ['blink','multi','c']){
    const input={board,files:EXAMPLES[example].files};const output=await compile(input,{sdk,factory});
    await validateResult(input,output);assert(output.flashBytes>100);assert(output.staticRamBytes>0);
    assert(output.hex.startsWith(':'));assert(output.timings.some(t=>t.tool===(example==='c'?'cc1':'cc1plus')));
    const simulation=await simulate(input,output);assert.equal(simulation.faults.length,0);
    assert.match(simulation.serial,example==='blink'?/Moj offline program/:example==='multi'?/REZULTAT=42/:/42/);
    if(example==='blink'){
      assert.match(simulation.serial,/ON 0/);assert.match(simulation.serial,/OFF 19[89]/);
      assert(simulation.samples.some(s=>s.level===1));assert(simulation.samples.some(s=>s.level===0));
      assert(simulation.samples.some(s=>s.ledCurrentMa>4));
    }
    evidence.cases.push({board,example,elapsedMs:output.elapsedMs,flashBytes:output.flashBytes,staticRamBytes:output.staticRamBytes,hexHash:output.hexHash,serial:simulation.serial,timings:output.timings});
    await assert.rejects(()=>validateResult({...input,files:{...input.files,'main.ino':input.files['main.ino']+'\n// edit'}},output),/promijenjeni/);
    await assert.rejects(()=>validateResult(input,{...output,profile:'pretend-cli'}),/promijenjeni/);
    await assert.rejects(()=>validateResult(input,{...output,hex:output.hex+'x'}),/Oštećen/);
  }
  await writeFile('.build/avr-prototype-node-evidence.json',JSON.stringify(evidence,null,2)+'\n');
});
test('board variants expose 6/8 analog inputs and compile user interrupt routines',async()=>{
  for(const board of ['uno','nano']){
    const expected=board==='uno'?6:8;
    const input={board,files:{'main.ino':`#include <avr/interrupt.h>
static_assert(NUM_ANALOG_INPUTS == ${expected}, "Wrong board variant");
volatile unsigned int ticks=0;
ISR(TIMER1_COMPA_vect){ticks++;}
void setup(){
 Serial.begin(9600); Serial.println(NUM_ANALOG_INPUTS);
 TCCR1A=0; TCCR1B=0; TCNT1=0; OCR1A=249;
 TCCR1B=(1<<WGM12)|(1<<CS11)|(1<<CS10); TIMSK1=(1<<OCIE1A);
 delay(25); noInterrupts(); unsigned int observed=ticks; interrupts();
 Serial.print("TICKS=");Serial.println(observed);
}
void loop(){delay(100);}`}};
    const output=await compile(input,{sdk,factory}),simulation=await simulate(input,output);
    assert.match(simulation.serial,new RegExp('^'+expected+'\\r?\\n'));
    assert(Number(simulation.serial.match(/TICKS=(\d+)/)?.[1])>=20,simulation.serial);
    assert.equal(simulation.faults.length,0);
    await assert.rejects(()=>validateResult(input,{...output,packageHash:'different SDK'}),/promijenjeni/);
  }
});
test('static SRAM and Flash overflows cannot produce a runnable result',async()=>{
  try{
    await assert.rejects(()=>compile({board:'uno',files:{'main.ino':'volatile char oversized[2050]; void setup(){oversized[2049]=1;} void loop(){}'}},{sdk,factory}),/2048|SRAM|overflow|region/);
    await assert.rejects(()=>compile({board:'uno',files:{'main.ino':'#include <avr/pgmspace.h>\nconst unsigned char a[17000] PROGMEM={1}; const unsigned char b[17000] PROGMEM={2}; void setup(){Serial.begin(9600);Serial.println(pgm_read_byte(a)+pgm_read_byte(b));} void loop(){}'}},{sdk,factory}),/Flash|flash|overflow|region|izvan|memorij/);
  }finally{process.exitCode=0;}
});
test('changed source generates new HEX and new behavior without any network API',async()=>{
  const previousFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('Network forbidden during this test');};
  try{
    const input={board:'uno',files:{'main.ino':EXAMPLES.blink.files['main.ino'].replace('INTERVAL = 200','INTERVAL = 73').replace('Moj offline program','UNIQUE_7391')}};
    const output=await compile(input,{sdk,factory}), simulation=await simulate(input,output);
    assert.match(simulation.serial,/UNIQUE_7391/);assert.match(simulation.serial,/OFF 7[23]/);assert(!simulation.serial.includes('Moj offline program'));
    const prior=JSON.parse(await readFile('.build/avr-prototype-node-evidence.json','utf8'));assert.notEqual(output.hexHash,prior.cases[0].hexHash);
    prior.changedSource={elapsedMs:output.elapsedMs,hexHash:output.hexHash,serial:simulation.serial,networkFetch:'throws if called'};
    await writeFile('.build/avr-prototype-node-evidence.json',JSON.stringify(prior,null,2)+'\n');
  }finally{globalThis.fetch=previousFetch;}
});
test('syntax and link errors are failures with useful locations',async()=>{
  await assert.rejects(()=>compile({board:'uno',files:{'main.ino':'void setup(){\n  this_is_invalid( ;\n}\nvoid loop(){}'}},{sdk,factory}),/main\.ino:2:/);
  await assert.rejects(()=>compile({board:'uno',files:{'main.ino':'extern void missing();\nvoid setup(){missing();}\nvoid loop(){}'}},{sdk,factory}),/undefined reference/);
  // Emscripten's Node adapter sets the host exitCode for expected tool errors.
  // The browser Worker has no process; reset only this Node test harness state.
  process.exitCode=0;
});
test('all inputs and identities bind to the result; unsafe paths are rejected',async()=>{
  const input={board:'uno',files:EXAMPLES.multi.files}, original=await fingerprint(input);
  assert.notEqual(await fingerprint({...input,board:'nano'}),original);
  assert.notEqual(await fingerprint({...input,files:{...input.files,'helper.cpp':'int dvostruko(int n){return n*3;}'}}),original);
  for(const path of ['../bad.h','/bad.h','sketch.cpp','other.ino','a/b.cpp'])assert.throws(()=>normalizeInput({...input,files:{...input.files,[path]:''}}));
  assert.throws(()=>normalizeInput({...input,board:'esp32'}));
  assert.throws(()=>normalizeInput({...input,files:{'main.ino':'x'.repeat(262145)}}));
  assert.throws(()=>unpackSDK(new Uint8Array(16)),/Neispravan SDK/);
});
