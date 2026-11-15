import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ComponentHelp from '../src/circuit/ComponentHelp';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {s3ControlExamples} from '../src/runtime/s3ControlExamples';
import {compileCircuit} from '../src/circuit/compile';
import {terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {unzipSync,strFromU8} from 'fflate';
import {S3_BUILD_FILE,validateArtifact,wasmBytes} from '../public/s3-contract.mjs';
import {createS3Engine} from '../public/s3-engine.mjs';
import {compileS3} from '../scripts/s3-compile.mjs';
import {S3} from '../src/boards/profiles';
import {componentSupport,SUPPORT_CATALOG} from '../src/boards/support';
import {supportRows} from '../src/boards/supportReport';

type Key=keyof typeof s3ControlExamples;
type P=ReturnType<typeof s3ExampleProject>;
const keys=Object.keys(s3ControlExamples) as Key[];
const artifacts=JSON.parse(readFileSync('public/s3-examples.json','utf8'));
const evidence:any[]=[];
const c=(p:P)=>p.circuit as Circuit;
const close=(a:number,b:number,t=.02)=>assert(Math.abs(a-b)<=t,`${a} != ${b} ± ${t}`);
const part=(p:P,id:string)=>c(p).components.find(d=>d.id===id)!;
const open=(p:P,id:string,pin:string)=>{c(p).wires=c(p).wires.filter(w=>!(w.to.component===id&&w.to.pin===pin));};
interface Options {
 loops?:number; edit?:(p:P)=>void; artifact?:any;
 setup?:(e:any)=>void; line?:(line:string,frame:any,e:any,marks:any[])=>boolean|void;
}
async function run(key:Key,o:Options={}) {
 const p=s3ExampleProject(key);o.edit?.(p);const a=o.artifact??artifacts[key];await validateArtifact(p,a);
 const events:any[]=[],marks:any[]=[];let frame:any,setupFrame:any,e:any,carry='',done=false;
 e=await createS3Engine(wasmBytes(a.wasm),compileCircuit(c(p)),(v:any)=>{
  events.push(v);if(v.type==='simulation')frame=structuredClone(v);
  if(v.type==='setup-complete'){setupFrame=structuredClone(frame);o.setup?.(e);}
  if(v.type==='console'){
   carry+=v.text;let at;
   while((at=carry.indexOf('\n'))>=0){
    const line=carry.slice(0,at).trim();carry=carry.slice(at+1);
    marks.push({line,frame:structuredClone(frame)});
    // Console can flush before the next simulation frame under concurrent load.
    // Snapshot after console delivery returns, then stop on the observed result.
    if(o.line?.(line,frame,e,marks)){done=true;queueMicrotask(()=>{e.snapshot();e.stop();});}
   }
  }
 },{fast:true});
 let error='';
 const timer=setTimeout(()=>e.stop(),15000);
 try{await e.run(o.loops??1);}catch(x:any){error=x.message;}finally{clearTimeout(timer);e.stop();}
 const text=events.filter(v=>v.type==='console').map(v=>v.text).join('');
 const result={key,text,error,done,frame,setupFrame,marks};evidence.push(result);return result;
}
test.after(()=>{mkdirSync('docs/stage22c-evidence',{recursive:true});writeFileSync('docs/stage22c-evidence/s3-controls-execution.json',JSON.stringify(evidence,null,2)+'\n');});

for(const key of keys)test(`${key}: exact compiled source, netlist, project ZIP and physical sketch files`,async()=>{
 const p=s3ExampleProject(key);assert.deepEqual(checkCircuit(c(p)).diagnostics,[]);
 p.files[S3_BUILD_FILE]=JSON.stringify(artifacts[key]);
 const q=importProject(exportZip(p),'s3-controls.zip');assert.deepEqual(q,parseProject(p));await validateArtifact(q,artifacts[key]);
 const sketch=unzipSync(exportSketch(q));
 for(const [path,source]of Object.entries(q.files).filter(([p])=>/\.(ino|h)$/.test(p)))assert.equal(strFromU8(sketch['LabSketch/'+(path==='main.ino'?'LabSketch.ino':path)]),source);
});
test('support matrix declares exactly the six added S3 component profiles with specific evidence',()=>{
 for(const id of ['ky040','relay','activeBuzzer','audio','dc','stepper']){
  const item=SUPPORT_CATALOG.find(x=>x.id===id)!;assert.equal(componentSupport(item,S3,'arduino-cpp').status,'experimental');
  assert.match(supportRows().find(r=>r.component===id&&r.target==='s3-cpp')!.evidence,/s3-controls/);
 }
 for(const id of ['buzzer'])assert.equal(componentSupport(SUPPORT_CATALOG.find(x=>x.id===id)!,S3,'arduino-cpp').status,'planned');
});
test('S3 C++ component help uses the selected board and language',()=>{
 for(const [kind,match]of [['ky040',/lab_encoder.h/],['relay',/GPIO6/],['passiveBuzzer',/ledcAttach/],['l298n',/GPIO4\/5/],['a4988',/GPIO2\/3/]]as const){
  const html=renderToStaticMarkup(createElement(ComponentHelp,{kind,boardId:S3,language:'arduino-cpp'}));assert.match(html,match);assert(!html.includes('from machine'));assert(!html.includes('Timer1'));
 }
});
test('raw KY-040 exposes four Gray transitions and the independent active LOW button',async()=>{
 let phase=0;
 const r=await run('encoderRaw',{loops:1000,line:(l,f,e)=>{
  if(phase===0&&l==='S3 RAW CLK=1 DT=1 SW=1'){phase=1;e.input({component:'enc1',encoderPosition:1});}
  else if(phase===1&&l==='S3 RAW CLK=1 DT=1 SW=1'){phase=2;e.input({component:'enc1',pressed:true});}
  else if(phase===2&&l==='S3 RAW CLK=1 DT=1 SW=0')return true;
 }});
 assert.equal(r.error,'');assert(r.done);assert.deepEqual(r.marks.map(m=>m.line),['S3 RAW CLK=1 DT=1 SW=1','S3 RAW CLK=0 DT=1 SW=1','S3 RAW CLK=0 DT=0 SW=1','S3 RAW CLK=1 DT=0 SW=1','S3 RAW CLK=1 DT=1 SW=1','S3 RAW CLK=1 DT=1 SW=0']);
});
for(const key of ['ky040','encoderBounce']as const)test(`${key}: three CW, two CCW and debounced SW reset execute in WASM`,async()=>{
 let phase=0;
 const r=await run(key,{loops:1500,setup:e=>e.input({component:'enc1',encoderPosition:3}),line:(l,f,e)=>{
  if(phase===0&&l.startsWith('S3 ENC P=3 ')){phase=1;e.input({component:'enc1',encoderPosition:1});}
  else if(phase===1&&l.startsWith('S3 ENC P=1 ')){phase=2;e.input({component:'enc1',pressed:true});}
  else if(phase===2&&l==='S3 ENC RESET P=0')return true;
 }});
 assert.equal(r.error,'');assert(r.done,r.text);assert.deepEqual(r.marks.filter(m=>m.line.startsWith('S3 ENC P=')).map(m=>m.line),[1,2,3,2,1].map((p,i)=>`S3 ENC P=${p} DIR=${i<3?'CW':'CCW'} ERR=0`));assert.equal(r.frame.encoders.enc1.position,1);
});
test('encoder program starts at zero even when the initial mechanical position is 42',async()=>{
 const r=await run('ky040',{loops:40,edit:p=>{part(p,'enc1').properties.encoderPosition=42;}});assert.equal(r.error,'');assert.equal(r.frame.encoders.enc1.position,42);assert.equal(r.text.trim(),'S3 ENC READY P=0');
});
test('swapping CLK and DT reverses the decoded sign through the actual circuit',async()=>{
 const r=await run('ky040',{loops:200,edit:p=>{for(const w of c(p).wires.filter(w=>w.to.component==='enc1'))if(w.to.pin==='CLK')w.to.pin='DT';else if(w.to.pin==='DT')w.to.pin='CLK';},setup:e=>e.input({component:'enc1',encoderPosition:1}),line:l=>l.startsWith('S3 ENC P=-1 ')});
 assert.equal(r.error,'');assert(r.done);assert.match(r.text,/P=-1 DIR=CCW/);
});
test('a button pulse shorter than the 20 ms filter does not reset the decoder',async()=>{
 const r=await run('ky040',{loops:5,setup:e=>e.input({component:'enc1',pressed:true})});assert.equal(r.error,'');assert(!r.text.includes('RESET'));
});
test('encoder PWM clamps both bounds and SW returns 50 without moving the mechanism',async()=>{
 let phase=0;
 const r=await run('encoderPWM',{loops:4000,setup:e=>e.input({component:'enc1',encoderPosition:12}),line:(l,f,e,marks)=>{
  if(phase===0&&marks.filter(m=>m.line==='S3 PWM=100').length===3){phase=1;e.input({component:'enc1',encoderPosition:-12});}
  else if(phase===1&&marks.filter(m=>m.line==='S3 PWM=0').length===5){phase=2;e.input({component:'enc1',pressed:true});}
  else if(phase===2&&l==='S3 PWM=50')return true;
 }});
 assert.equal(r.error,'');assert(r.done,r.text);const values=r.marks.map(m=>Number(m.line.match(/PWM=(\d+)/)?.[1])).filter(Number.isFinite);assert(values.every(v=>v>=0&&v<=100));assert.equal(r.frame.encoders.enc1.position,-12);close(r.frame.gpios['7'].duty/65535,127/255,.0001);
});
for(const pin of ['CLK','DT'])test(`KY-040 open ${pin} cannot yield a fabricated counter`,async()=>{
 const r=await run('ky040',{edit:p=>open(p,'enc1',pin)});assert.match(r.error,/Nepobuđen/);assert(!/ENC P=\d/.test(r.text));
});
for(const pin of ['VCC','GND'])test(`KY-040 missing ${pin} produces no completed step`,async()=>{
 const r=await run('ky040',{loops:120,edit:p=>open(p,'enc1',pin),setup:e=>e.input({component:'enc1',encoderPosition:1})});assert(!/ENC P=1 /.test(r.text));assert.equal(r.frame.encoders.enc1.powered,false);
});
test('an open SW remains pulled HIGH and cannot pass a physical button press to the program',async()=>{
 const r=await run('ky040',{loops:50,edit:p=>open(p,'enc1','SW'),setup:e=>e.input({component:'enc1',pressed:true})});assert.equal(r.error,'');assert(!r.text.includes('RESET'));assert.equal(r.frame.gpios['6'].level,1);
});
test('5 V KY-040 profile on S3 signals is rejected at compilation of the circuit',()=>{
 const p=s3ExampleProject('ky040');part(p,'enc1').properties.moduleVoltage=5;c(p).wires.find(w=>w.to.pin==='VCC')!.from.pin=terminals(c(p).components[0]).find(t=>t.role==='5v')!.pin;assert.throws(()=>compileCircuit(c(p)),/pull-up CLK\/DT na 5 V/);
});
test('compiled relay starts on NC and genuinely switches both electrical LED paths',async()=>{
 const r=await run('relayContacts');assert.equal(r.error,'');
 for(const [marker,on]of [['S3 RELAY READY OFF',false],['S3 RELAY ON -> COM-NO',true],['S3 RELAY OFF -> COM-NC',false]]as const){
  const f=r.marks.find(m=>m.line===marker)!.frame;assert.equal(f.actuators.relays.relay1.energized,on);assert.equal(f.actuators.relays.relay1.contact,on?'COM–NO':'COM–NC');assert.equal(f.leds.relayLED0.brightness>0,on);assert.equal(f.leds.relayLED1.brightness>0,!on);
 }
});
test('changing relay active level changes physical contact response without changing the artifact',async()=>{
 const r=await run('relayContacts',{edit:p=>{part(p,'relay1').properties.activeLevel='high';}});assert.equal(r.error,'');assert(!r.marks.find(m=>m.line==='S3 RELAY ON -> COM-NO')!.frame.actuators.relays.relay1.energized);assert(r.marks.find(m=>m.line==='S3 RELAY OFF -> COM-NC')!.frame.actuators.relays.relay1.energized);
});
for(const pin of ['VCC','LV','GND'])test(`relay missing ${pin} stays unenergized on NC`,async()=>{
 const r=await run('relayContacts',{edit:p=>open(p,'relay1',pin)});assert.equal(r.error,'');assert(r.marks.every(m=>!m.frame.actuators.relays.relay1.energized));assert(!r.marks.find(m=>m.line==='S3 RELAY ON -> COM-NO')!.frame.actuators.relays.relay1.powered);assert.equal(r.frame.actuators.relays.relay1.contact,'COM–NC');
});
test('open relay IN is held inactive by the declared module pull resistor',async()=>{
 const r=await run('relayContacts',{edit:p=>open(p,'relay1','IN')});assert.equal(r.error,'');assert(r.marks.every(m=>!m.frame.actuators.relays.relay1.energized));
});
test('loss of relay load power extinguishes LEDs while the control contacts still switch',async()=>{
 const r=await run('relayContacts',{edit:p=>open(p,'relay1','COM')});assert.equal(r.error,'');const f=r.marks.find(m=>m.line==='S3 RELAY ON -> COM-NO')!.frame;assert(f.actuators.relays.relay1.energized);assert.equal(f.leds.relayLED0.brightness,0);assert.equal(f.leds.relayLED1.brightness,0);
});
test('relay NO contact short to the load ground raises a real output conflict',async()=>{
 const r=await run('relayContacts',{edit:p=>c(p).wires.push({id:'short',from:{component:'relay1',pin:'NO'},to:{component:'loadSupply',pin:'-'},color:'#334155',points:[]})});assert.match(r.error,/sukob/);assert(r.frame.diagnostics.some((d:any)=>d.code==='output-conflict'));
});
test('active buzzer starts silent, oscillates at 2300 Hz on DC, and switches off',async()=>{
 const r=await run('activeAlarm');assert.equal(r.error,'');
 for(const [marker,on]of [['S3 ACTIVE READY OFF',false],['S3 ACTIVE ON',true],['S3 ACTIVE OFF',false]]as const){const b=r.marks.find(m=>m.line===marker)!.frame.actuators.buzzers.buzzer1;assert.equal(b.active,on);assert.equal(b.frequency,on?2300:null);}
});
for(const key of ['activeAlarm','piezoTone']as const)for(const pin of ['VCC','GND','SIG'])test(`${key}: missing ${pin} prevents sound from a valid compiled program`,async()=>{
 const r=await run(key,{edit:p=>open(p,'buzzer1',pin)});assert.equal(r.error,'');assert(r.marks.every(m=>!m.frame.actuators.buzzers.buzzer1.active));
});
test('passive piezo follows three LEDC frequencies, 400 ms gates, pauses and final OFF',async()=>{
 const r=await run('piezoTone');assert.equal(r.error,'');
 for(const hz of [440,880,1320]){const f=r.marks.find(m=>m.line==='S3 TONE='+hz)!.frame;assert.equal(f.actuators.buzzers.buzzer1.frequency,hz);close(f.actuators.buzzers.buzzer1.duty,128/255,.001);}
 assert(r.marks.filter(m=>m.line==='S3 TONE PAUSE'||m.line==='S3 TONE OFF').every(m=>!m.frame.actuators.buzzers.buzzer1.active));
 for(let i=0;i<3;i++){const on=r.marks.find(m=>m.line==='S3 TONE='+[440,880,1320][i])!,off=r.marks.filter(m=>m.line==='S3 TONE PAUSE')[i];close(off.frame.timeMs-on.frame.timeMs,100,2);const previous=i?r.marks.filter(m=>m.line==='S3 TONE PAUSE')[i-1].frame:r.setupFrame;close(on.frame.timeMs-previous.timeMs,400,2);}
});
test('compiled L298N produces three duty levels, Hi-Z coast, reverse and brake',async()=>{
 const r=await run('dcDrive');assert.equal(r.error,'');
 for(const duty of [64,128,255]){const f=r.marks.find(m=>m.line==='S3 MOTOR FORWARD PWM='+duty)!.frame;close(f.actuators.motors.motor1.voltage,4*duty/255);assert.equal(f.actuators.motors.motor1.direction,1);}
 assert.equal(r.marks.find(m=>m.line==='S3 MOTOR COAST')!.frame.actuators.motors.motor1.voltage,null);
 close(r.marks.find(m=>m.line==='S3 MOTOR REVERSE')!.frame.actuators.motors.motor1.voltage,-4*128/255);
 const f=r.marks.find(m=>m.line==='S3 MOTOR BRAKE')!.frame;close(f.actuators.motors.motor1.voltage,0);assert.equal(f.actuators.bridges.bridge1.channels[0].mode,'kočenje');
});
test('two compiled motor channels retain independent signs and enable duties',async()=>{
 const r=await run('dualDrive');assert.equal(r.error,'');const a=r.marks.find(m=>m.line==='S3 DUAL A=+50 B=-75')!.frame,b=r.marks.find(m=>m.line==='S3 DUAL A=+100 B=COAST')!.frame;
 close(a.actuators.motors.motor1.voltage,4*128/255);close(a.actuators.motors.motor2.voltage,-4*192/255);close(b.actuators.motors.motor1.voltage,4);assert.equal(b.actuators.motors.motor2.voltage,null);
});
for(const pin of ['VS','VSS','GND'])test(`L298N missing ${pin} prevents motor drive`,async()=>{
 const r=await run('dcDrive',{edit:p=>open(p,'bridge1',pin)});assert.equal(r.error,'');assert(r.marks.every(m=>!m.frame.actuators.bridges.bridge1.powered&&m.frame.actuators.motors.motor1.direction===0));
});
test('reversed motor wires reverse the measured direction without editing C++',async()=>{
 const r=await run('dcDrive',{edit:p=>{for(const w of c(p).wires.filter(w=>w.to.component==='motor1'))w.to.pin=w.to.pin==='M+'?'M-':'M+';}});assert.equal(r.error,'');assert.equal(r.marks.find(m=>m.line==='S3 MOTOR FORWARD PWM=128')!.frame.actuators.motors.motor1.direction,-1);
});
test('an installed EN jumper and direct motor GPIO connection are rejected',()=>{
 const p=s3ExampleProject('dcDrive');part(p,'bridge1').properties.jumperA=true;assert.throws(()=>compileCircuit(c(p)),/jumper/);
 const q=s3ExampleProject('dcDrive');c(q).wires.find(w=>w.to.component==='motor1')!.from={component:c(q).components[0].id,pin:terminals(c(q).components[0]).find(t=>t.gpio===7)!.pin};assert.throws(()=>compileCircuit(c(q)),/izravni GPIO/);
});
test('SG90, motor and 880 Hz piezo operate concurrently on four independent LEDC pins',async()=>{
 const r=await run('servoMotorTone');assert.equal(r.error,'');for(const angle of [45,135]){const f=r.marks.find(m=>m.line.startsWith('S3 COMBINED ANGLE='+angle))!.frame;close(f.servos.sg90.angle,angle,.15);close(f.actuators.motors.motor1.voltage,4*128/255);assert.equal(f.actuators.buzzers.buzzer1.frequency,880);assert.equal(f.gpios['6'].freq,50);assert.equal(f.gpios['4'].freq,1000);assert.equal(f.gpios['7'].freq,880);}
});
test('A4988 full-step program moves +90 and back to zero from actual STEP edges',async()=>{
 const r=await run('stepperBasic');assert.equal(r.error,'');const a=r.marks.find(m=>m.line==='STEPPER +90 deg')!.frame,b=r.marks.find(m=>m.line==='STEPPER 0 deg')!.frame;assert.equal(a.steppers.drivers.stepperDriver.accepted,50);assert.equal(a.steppers.motors.stepperMotor.angle,90);assert.equal(b.steppers.drivers.stepperDriver.accepted,100);assert.equal(b.steppers.motors.stepperMotor.angle,0);assert.equal(b.steppers.drivers.stepperDriver.rejected,0);
});
test('five compiled microstep modes each give 18 degrees and return to common Home',async()=>{
 const r=await run('stepperMicro');assert.equal(r.error,'');for(const factor of [1,2,4,8,16])for(const [suffix,angle]of [['+18 deg',18],['0 deg',0]]as const){const f=r.marks.find(m=>m.line===`MICRO 1/${factor} ${suffix}`)!.frame;assert.equal(f.steppers.drivers.stepperDriver.resolution,factor);assert.equal(f.steppers.motors.stepperMotor.angle,angle);assert.equal(f.steppers.drivers.stepperDriver.rejected,0);}
});
test('ENABLE, electrical RESET and SLEEP preserve their distinct translator/shaft meaning',async()=>{
 const r=await run('stepperControl',{line:l=>l==='CONTROL WAKE translator=5'});assert.equal(r.error,'');assert(r.done);const f=r.frame;assert.equal(f.steppers.drivers.stepperDriver.translatorTicks,80);assert.equal(f.steppers.drivers.stepperDriver.ignored,6);assert.equal(f.steppers.drivers.stepperDriver.rejected,0);assert.equal(f.steppers.motors.stepperMotor.idealAngle,27);assert.equal(f.steppers.motors.stepperMotor.positionCertain,false);assert.equal(f.steppers.motors.stepperMotor.angle,null);
});
for(const pin of ['VMOT','VDD','GND'])test(`A4988 missing ${pin} cannot drive a motor from printed angle text`,async()=>{
 const r=await run('stepperBasic',{edit:p=>open(p,'stepperDriver',pin)});assert.equal(r.error,'');assert.equal(r.frame.steppers.motors.stepperMotor.drivenTicks,0);assert(!r.frame.steppers.drivers.stepperDriver.enabled);
});
test('open A4988 phase preserves translator pulses but cannot move the disconnected motor',async()=>{
 const r=await run('stepperBasic',{edit:p=>open(p,'stepperMotor','A+')});assert.equal(r.error,'');assert.equal(r.frame.steppers.drivers.stepperDriver.accepted,100);assert(!r.frame.steppers.motors.stepperMotor.connected);assert.equal(r.frame.steppers.motors.stepperMotor.drivenTicks,0);
});
test('editing the visible decoder or main source invalidates the bundled artifact',async()=>{
 for(const path of ['main.ino','lab_encoder.h']){const p=s3ExampleProject('ky040');p.files[path]+='\n// promjena ucenika\n';await assert.rejects(()=>validateArtifact(p,artifacts.ky040),/hash|izvor|odgovara/i);}
});
test('actual compiler executes a slower student poll and exposes lost encoder steps',async()=>{
 const p=s3ExampleProject('ky040');p.files['main.ino']=p.files['main.ino'].replace('delay(1);','delay(100);');const a=await compileS3(p);
 const r=await run('ky040',{loops:10,artifact:a,edit:q=>{q.files['main.ino']=p.files['main.ino'];},setup:e=>e.input({component:'enc1',encoderPosition:3})});assert.equal(r.error,'');assert.equal(r.frame.encoders.enc1.position,3);assert(!r.text.includes('P=3 DIR=CW'));
 delete p.files['lab_encoder.h'];await assert.rejects(()=>compileS3(p),/lab_encoder.h.*not found/);
});
