import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {arduinoExampleProject} from '../../src/runtime/arduinoExamples';
import {UNO,NANO} from '../../src/boards/profiles';
import {compile,unpackSDK,fingerprint,normalizeInput,validateResult} from './compiler.mjs';
import {LIBRARIES} from './libraries.mjs';
import {projectInput,updateProject,projectBundle,readProject} from './project-bridge';
import {simulate} from './simulation';
import runtime from './runtime-manifest.json' with {type:'json'};
const dir=resolve('.build/avr-toolchain'),require=createRequire(import.meta.url);
for(const name of ['cc1','cc1plus','avr-as','avr-ld','objcopy'])await copyFile(dir+'/'+name+'.js',dir+'/'+name+'.cjs');
const sdk=unpackSDK(await readFile(dir+'/'+runtime.sdkFile)),factory=async(name:string)=>require(dir+'/'+name+'.cjs');
const inputLabel=(board:string,key:string)=>`${board===UNO?'uno':'nano'}: ${key}`;
const cases=[
  ['aht10',/T=24.00 C RH=50.00/],['servo',/Servo=90/],['oled',/^$/],
  ['regulator',/T=24.00 RH=50.00 Servo=0/],['bmp180',/BMP180 T=24.00/],
  ['bmp280',/BMP280 T=24.00/],['am2320',/AM2320 T=24.00/],
  ['oled32',/OLED32 brojac=/],['lcd1602',/LCD spreman/],['lcdWeather',/LCD T=24.00/],
  ['dht11',/T=25.0/],['dht22',/T=25.0/],['ds18b20',/T=25.0000/],['bmp280SPI',/BMP280 SPI T=24.00/],
] as const;

test('all locked libraries compile real Uno/Nano lessons and drive their own circuits without fetch',async(t)=>{
  const evidence:any={packageHash:runtime.packageHash,scope:'Node WASM compilation and Labos AVR simulation; separate browser acceptance required',cases:[]};
  const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{throw Error('No network allowed');};
  try{
    for(const board of [UNO,NANO] as const)for(const [key,expected] of cases){
      await t.test(inputLabel(board,key),async()=>{
      const project=arduinoExampleProject(key,board),{input}=projectInput(project);
      const output=await compile(input,{sdk,factory}),run=await simulate(input,output,project,3000);
      assert.deepEqual(run.faults,[],key);assert.match(run.serial,expected,key);
      assert.deepEqual(run.lastFrame.diagnostics,[],key);
      if(['oled','regulator','oled32'].includes(key))assert(Object.values(run.lastFrame.displays).some((d:any)=>d.bytes?.some(Boolean)),key+' pixels');
      if(key==='servo')assert(run.lastFrame.servos.servo1.freq>49&&run.lastFrame.servos.servo1.freq<51);
      if(key==='aht10')assert(run.lastFrame.i2cTrace.some((t:any)=>t.address===0x38&&t.operation==='R'));
      const restored=await readProject(JSON.stringify(await projectBundle(project,output)));
      assert.deepEqual(restored.input.libraries,input.libraries);
      evidence.cases.push({board:input.board,key,libraries:input.libraries,elapsedMs:output.elapsedMs,flashBytes:output.flashBytes,staticRamBytes:output.staticRamBytes,hexHash:output.hexHash,serial:run.serial});
      await writeFile('.build/avr-library-evidence.json',JSON.stringify(evidence,null,2)+'\n');
      });
    }
    await writeFile('.build/avr-library-fixture.json',JSON.stringify(arduinoExampleProject('regulator',NANO)));
  }finally{globalThis.fetch=oldFetch;}
});

test('Bounce2 and EEPROM compile from the package; selection changes invalidate results and preserve projects',async()=>{
  const libraries=LIBRARIES.filter(x=>x.name==='Bounce2');
  for(const board of ['uno','nano']){
    const input={board,libraries,files:{'main.ino':`#include <Bounce2.h>
#include <EEPROM.h>
Bounce button;
void setup(){Serial.begin(9600);button.attach(2,INPUT_PULLUP);button.interval(5);Serial.print("EMPTY=");Serial.println(EEPROM.read(1023));EEPROM.update(1023,73);Serial.print("LAST=");Serial.println(EEPROM.read(1023));EEPROM.update(0,42);Serial.print("EEPROM=");Serial.println(EEPROM.read(0));}
void loop(){button.update();}`}};
    const output=await compile(input,{sdk,factory}),run=await simulate(input,output);
    assert.match(run.serial,/EMPTY=255/);assert.match(run.serial,/LAST=73/);assert.match(run.serial,/EEPROM=42/);assert.deepEqual(run.faults,[]);
    await assert.rejects(()=>validateResult({...input,libraries:[]},output),/promijenjeni/);
    const p=arduinoExampleProject('servo',board==='nano'?NANO:UNO),before=JSON.stringify(p);
    const updated=updateProject(p,{...projectInput(p).input,libraries});
    assert.equal(JSON.stringify(p),before);assert.deepEqual(updated.circuit,p.circuit);
    assert.deepEqual(projectInput(updated).input.libraries,normalizeInput(input).libraries);
  }
});

test('library versions, digests, dependencies and exclusive OLED packages are enforced',async()=>{
  const base={board:'uno',files:{'main.ino':'void setup(){} void loop(){}'}};
  const select=(name:string)=>LIBRARIES.find(x=>x.name===name)!;
  for(const libraries of [null,{},[{name:'Unknown',version:'1'}],[{...select('Servo'),version:'9'}],[{...select('Servo'),digest:'bad'}],[select('Servo'),select('Servo')],[select('DallasTemperature')],[select('U8g2'),select('U8g2_12832')]])assert.throws(()=>normalizeInput({...base,libraries}));
  assert.notEqual(await fingerprint(base),await fingerprint({...base,libraries:[select('Servo')]}));
  const pair=[select('Servo'),select('LabAHT10')];
  assert.equal(await fingerprint({...base,libraries:pair}),await fingerprint({...base,libraries:[...pair].reverse()}));
  await assert.rejects(()=>simulate(base,{},undefined,999999),/Trajanje/);
  try{await assert.rejects(()=>compile({...base,files:{'main.ino':'#include <Servo.h>\nvoid setup(){} void loop(){}'}},{sdk,factory}),/Servo.h/);}finally{process.exitCode=0;}
});
