import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {actuatorCircuit,actuatorExamples,type ActuatorExample} from '../src/circuit/actuatorExamples';
import {createCircuitHost} from '../public/circuit-host.mjs';
import {compileCircuit,type SimulationFrame} from '../src/circuit/compile';
import {parseCircuit,makePart,terminals,type Circuit} from '../src/circuit/model';
import {checkCircuit} from '../src/circuit/netlist';
import {S3,UNO,NANO,type BoardId} from '../src/boards/profiles';
import {arduinoExampleProject} from '../src/runtime/arduinoExamples';
import {newProject,parseProject} from '../src/project/model';
import {exportZip,importProject} from '../src/project/archive';
import {exportSketch} from '../src/project/sketch';
import {validateArtifact} from '../public/avr-contract.mjs';
import {AVREngine} from '../src/runtime/avrEngine';
import {compileProject} from '../scripts/avr-compile.mjs';
import {Session} from '../dist/session.mjs';
const keys=Object.keys(actuatorExamples)as ActuatorExample[];
const machine=readFileSync('public/machine.py','utf8'),servo=readFileSync('public/drivers/servo.py','utf8');
mkdirSync('docs/stage14-evidence',{recursive:true});
const save=(name:string,v:any)=>writeFileSync('docs/stage14-evidence/'+name+'.json',JSON.stringify(v,null,2)+'\n');
const frame=(events:any[])=>events.filter(e=>e.type==='simulation').at(-1) as SimulationFrame;
const text=(events:any[])=>events.filter(e=>e.type==='console').map(e=>e.text).join('');
function fixture(key:ActuatorExample='dcDrive',board:BoardId=S3,edit=(c:Circuit)=>{}){
 const c=actuatorCircuit(key,board);edit(c);let now=0;const events:any[]=[];
 const h=createCircuitHost((e:any)=>events.push(e),{circuit:compileCircuit(c,board===S3?'micropython':'avr'),logicVoltage:board===S3?3.3:5,nowUs:()=>now,manualPublish:true});
 const set=(n:number,v:number)=>h.mode(n,1,0,v);
 const snapshot=(us=10000)=>{now+=us;h.flush();return frame(events);};
 return {c,h,set,events,snapshot,time:(us:number)=>{now+=us;}};
}
const factory=()=>{const w=new Worker(new URL('./node-worker.mjs',import.meta.url)),shim:any={postMessage:(d:any)=>w.postMessage(d),terminate:()=>w.terminate()};w.on('message',data=>shim.onmessage?.({data}));w.on('error',error=>shim.onerror?.(error));return shim;};
function python(key:ActuatorExample,code=actuatorExamples[key].code,c=actuatorCircuit(key)){return new Session(factory,machine,code,{circuit:compileCircuit(c)},undefined,{'servo.py':servo});}
function advance(e:AVREngine,ms=100){for(let n=0;n<ms;n+=10){e.runCycles(160000);e.frame();}}

test('all seven actuator examples on three boards preserve sources, profiles, JSON, ZIP and sketch',async()=>{
 const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8'));
 for(const board of [S3,UNO,NANO]as const)for(const key of keys){const p=board===S3?newProject(actuatorExamples[key].code,actuatorExamples[key].title):arduinoExampleProject(key,board);p.circuit=actuatorCircuit(key,board);assert.deepEqual(parseCircuit(p.circuit),p.circuit);assert.deepEqual(checkCircuit(p.circuit).diagnostics,[],key);assert.deepEqual(importProject(exportZip(p),'a.zip'),parseProject(p));if(board!==S3){await validateArtifact(p,artifacts[board][key]);assert(exportSketch(p).length>0);}}
});
test('strict parser rejects invalid source, servo calibration, relay, jumper and motor parameters',()=>{
 for(const [key,id,property,value]of [['sg90Sweep','servoSupply','supplyVoltage',13],['sg90Sweep','sg90','servoMinUs',2100],['relayContacts','relay1','activeLevel','auto'],['dcDrive','bridge1','jumperA',1],['dcDrive','bridge1','bridgeDrop',5],['dcDrive','motor1','ratedVoltage',0]]as const){const c=actuatorCircuit(key);(c.components.find(p=>p.id===id)!.properties as any)[property]=value;assert.throws(()=>parseCircuit(c),property);}
});
test('relay starts on NC without IN drive and actually switches electrical LED paths',()=>{
 const f=fixture('relayContacts');try{let s=f.snapshot();assert.equal(s.actuators!.relays.relay1.contact,'COM–NC');assert(s.leds.relayLED1.brightness>0);assert.equal(s.leds.relayLED0.brightness,0);f.set(6,0);s=f.snapshot();assert.equal(s.actuators!.relays.relay1.contact,'COM–NO');assert(s.leds.relayLED0.brightness>0);assert.equal(s.leds.relayLED1.brightness,0);f.set(6,1);assert.equal(f.snapshot().actuators!.relays.relay1.contact,'COM–NC');save('relay',s);}finally{f.h.dispose();}
});
test('active HIGH relay starts inactive, energizes on HIGH, and drops on missing supply',()=>{
 const f=fixture('relayContacts',S3,c=>{c.components.find(p=>p.id==='relay1')!.properties.activeLevel='high';});try{assert(!f.snapshot().actuators!.relays.relay1.energized);f.set(6,1);assert(f.snapshot().actuators!.relays.relay1.energized);}finally{f.h.dispose();}
 for(const pin of ['VCC','GND','LV']){const f=fixture('relayContacts',S3,c=>{c.wires=c.wires.filter(w=>!(w.to.component==='relay1'&&w.to.pin===pin));});try{f.set(6,0);const s=f.snapshot();assert(!s.actuators!.relays.relay1.powered,pin);assert.equal(s.actuators!.relays.relay1.contact,'COM–NC');}finally{f.h.dispose();}}
});
test('relay dynamic contact short is diagnosed as an output conflict',()=>{
 const f=fixture('relayContacts',S3,c=>{c.wires.push({id:'short',from:{component:'relay1',pin:'NO'},to:{component:'loadSupply',pin:'-'},color:'#334155',points:[]});});try{assert.equal(f.set(6,0),-2);assert(f.snapshot().diagnostics.some(d=>d.code==='output-conflict'));}finally{f.h.dispose();}
});
test('L298N implements forward, reverse, both brake states and EN coast on both channels',()=>{
 const f=fixture('dualDrive');try{for(const n of [4,5,8,9,10,11])f.set(n,0);for(const [x,y,mode,u]of [[1,0,'naprijed',4],[0,1,'natrag',-4],[0,0,'kočenje',0],[1,1,'kočenje',0]]as const){f.set(8,x);f.set(9,y);f.set(10,y);f.set(11,x);f.set(4,1);f.set(5,1);f.snapshot();const s=f.snapshot();assert.equal(s.actuators!.bridges.bridge1.channels[0].mode,mode);assert(Math.abs(s.actuators!.motors.motor1.voltage!-u)<.02);assert(Math.abs(s.actuators!.motors.motor2.voltage!+u)<.02);}f.set(4,0);f.snapshot();assert.equal(f.snapshot().actuators!.bridges.bridge1.channels[0].mode,'slobodno');assert.equal(f.snapshot().actuators!.motors.motor1.voltage,null);}finally{f.h.dispose();}
});
test('functional PWM gives a signed average voltage and independent channel duties',()=>{
 const f=fixture('dualDrive');try{f.set(8,1);f.set(9,0);f.set(10,0);f.set(11,1);f.h.pwm(4,1000,32768);f.h.pwm(5,1000,49151);const s=f.snapshot();assert(Math.abs(s.actuators!.motors.motor1.voltage!-2)<.02);assert(Math.abs(s.actuators!.motors.motor2.voltage!+3)<.02);assert(Math.abs(s.actuators!.motors.motor1.relativeSpeed-33.333)<.1);save('dual-pwm',s);}finally{f.h.dispose();}
});
test('actual switched GPIO motor voltage is integrated by elapsed virtual time',()=>{
 const f=fixture();try{f.set(8,1);f.set(9,0);f.set(4,0);f.snapshot(0);f.set(4,1);f.time(250);f.set(4,0);f.time(750);const s=f.snapshot(0);assert(Math.abs(s.actuators!.motors.motor1.voltage!-1)<.01);}finally{f.h.dispose();}
});
test('motor polarity reversal reverses reported direction without changing code',()=>{
 const f=fixture('dcDrive',S3,c=>{for(const w of c.wires.filter(w=>w.to.component==='motor1'))w.to.pin=w.to.pin==='M+'?'M-':'M+';});try{f.set(8,1);f.set(9,0);f.set(4,1);assert.equal(f.snapshot().actuators!.motors.motor1.direction,-1);}finally{f.h.dispose();}
});
test('missing VS, VSS and explicitly disconnected board ground prevent motor drive',()=>{
 for(const kind of ['VS','VSS','common-ground']){const f=fixture('dcDrive',S3,c=>{c.wires=c.wires.filter(w=>kind==='common-ground'?!(w.from.component===c.components[0].id&&w.to.component==='bridge1'&&w.to.pin==='GND'):!(w.to.component==='bridge1'&&w.to.pin===kind));});try{f.set(8,1);f.set(9,0);f.set(4,1);const s=f.snapshot();assert(!s.actuators!.bridges.bridge1.powered,kind);assert.equal(s.actuators!.motors.motor1.direction,0,kind);}finally{f.h.dispose();}}
});
test('installed EN jumper requires GPIO removal; external supplies and motor GPIO shorts are rejected',()=>{
 const jumper=actuatorCircuit('dcDrive');jumper.components.find(p=>p.id==='bridge1')!.properties.jumperA=true;assert.throws(()=>compileCircuit(jumper),/jumper/);
 const motor=actuatorCircuit('dcDrive');motor.wires.find(w=>w.to.component==='motor1')!.from={component:motor.components[0].id,pin:terminals(motor.components[0]).find(t=>t.gpio===7)!.pin};assert.throws(()=>compileCircuit(motor),/izravni GPIO/);
 const high=actuatorCircuit('dcDrive');high.wires.push({id:'high',from:{component:'motorSupply',pin:'+'},to:{component:high.components[0].id,pin:terminals(high.components[0]).find(t=>t.gpio===6)!.pin},color:'#d04b46',points:[]});assert.throws(()=>compileCircuit(high),/napon GPIO/);
 const short=actuatorCircuit('dcDrive');short.wires.push({id:'short',from:{component:'bridge1',pin:'OUT1'},to:{component:'bridge1',pin:'OUT2'},color:'#334155',points:[]});assert.throws(()=>compileCircuit(short),/Kratki spoj/);
});
test('both EN jumpers can run bridge channels from VSS without a GPIO enable source',()=>{
 const f=fixture('dualDrive',S3,c=>{const b=c.components.find(p=>p.id==='bridge1')!;b.properties.jumperA=b.properties.jumperB=true;c.wires=c.wires.filter(w=>!['ENA','ENB'].includes(w.to.pin));});try{f.set(8,1);f.set(9,0);f.set(10,0);f.set(11,1);const s=f.snapshot();assert(s.actuators!.motors.motor1.voltage!>3.9);assert(s.actuators!.motors.motor2.voltage!< -3.9);}finally{f.h.dispose();}
});
test('SG90 calibration maps pulses and requires the explicit shared ground',()=>{
 const f=fixture('sg90Sweep');try{for(const [pulse,angle]of [[1000,0],[1500,90],[2000,180]]){f.h.pwm(6,50,Math.round(pulse*65535/20000));const s=f.snapshot();assert(Math.abs(s.servos.sg90.angle!-angle)<.1);}f.h.pwm(6,1000,32768);assert.equal(f.snapshot().servos.sg90.angle,null);}finally{f.h.dispose();}
 const g=fixture('sg90Sweep',S3,c=>{c.wires=c.wires.filter(w=>!(w.from.component==='servoSupply'&&w.to.component===c.components[0].id));});try{g.h.pwm(6,50,4915);assert(!g.snapshot().servos.sg90.powered);}finally{g.h.dispose();}
});
test('active buzzer sounds on DC while passive piezo requires valid alternating frequency',()=>{
 for(const [key,active]of [['activeAlarm',true],['piezoTone',false]]as const){const f=fixture(key);try{f.set(7,1);assert.equal(f.snapshot().actuators!.buzzers.buzzer1.active,active);f.set(7,0);assert(!f.snapshot().actuators!.buzzers.buzzer1.active);f.h.pwm(7,880,32768);const s=f.snapshot().actuators!.buzzers.buzzer1;assert(s.active);assert.equal(s.frequency,active?2300:880);f.h.pwm(7,880,0);assert(!f.snapshot().actuators!.buzzers.buzzer1.active);}finally{f.h.dispose();}}
});
test('passive piezo follows captured GPIO pulses and silences after last edge expires',()=>{
 const f=fixture('piezoTone');try{f.set(7,0);f.h.capturePulse(7,500,1000);assert.equal(f.snapshot(0).actuators!.buzzers.buzzer1.frequency,1000);assert(!f.snapshot(4000).actuators!.buzzers.buzzer1.active);}finally{f.h.dispose();}
});
test('bounded actuator records reset for a new session',()=>{
 const f=fixture('activeAlarm');try{for(let i=0;i<200;i++){f.set(7,i%2);f.snapshot();}assert.equal(f.snapshot().actuators!.trace.length,128);}finally{f.h.dispose();}const g=fixture('activeAlarm');try{assert(g.snapshot().actuators!.trace.length<5);}finally{g.h.dispose();}
});
for(const key of keys)test(`actual MicroPython ${key} controls model and Stop preserves results`,async()=>{
 const markers:Record<ActuatorExample,string>={sg90Sweep:'SG90 ANGLE=90',relayContacts:'RELAY ON',activeAlarm:'ACTIVE ON',piezoTone:'TONE=880',dcDrive:'MOTOR FORWARD PWM=32768',dualDrive:'DUAL A=+50',servoMotorTone:'COMBINED ANGLE=45'};
 const s=python(key);try{await s.wait((s:Session)=>s.text.includes(markers[key])||s.status==='error');assert.notEqual(s.status,'error',s.text);assert(s.text.includes(markers[key]),s.text);const f=frame(s.events);assert.equal(f.diagnostics.length,0,JSON.stringify(f.diagnostics));if(key==='sg90Sweep')assert(f.servos.sg90.powered);if(key==='relayContacts')assert(f.actuators!.relays.relay1.energized);if(['activeAlarm','piezoTone','servoMotorTone'].includes(key))assert(f.actuators!.buzzers.buzzer1.active);if(['dcDrive','dualDrive','servoMotorTone'].includes(key))assert(f.actuators!.motors.motor1.relativeSpeed>0);save('python-'+key,{console:s.text,frame:f});const before=JSON.stringify(f);assert(await s.stop()<500);assert.equal(JSON.stringify(frame(s.events)),before);}finally{await s.stop();}
});
for(const board of [UNO,NANO]as const)test(`${board}: seven actual compiled sketches drive servo, relay, tones and DC outputs`,()=>{
 const artifacts=JSON.parse(readFileSync('public/avr-examples.json','utf8')),out=[];
 for(const key of keys){const a=artifacts[board][key],events:any[]=[],e=new AVREngine(a.hex,compileCircuit(actuatorCircuit(key,board),'avr'),(x:any)=>events.push(x),board===NANO?8:6,a.staticRamBytes);try{advance(e,300);const s=frame(events);assert.equal(s.diagnostics.length,0,key+JSON.stringify(s.diagnostics));if(key==='sg90Sweep')assert(Math.abs(s.servos.sg90.angle!)<1);if(key==='relayContacts')assert(s.leds.relayLED0.brightness>0);if(['activeAlarm','piezoTone','servoMotorTone'].includes(key))assert(s.actuators!.buzzers.buzzer1.active,key);if(['dcDrive','dualDrive','servoMotorTone'].includes(key))assert(s.actuators!.motors.motor1.relativeSpeed>0,key);if(key==='servoMotorTone'){assert(Math.abs(s.servos.sg90.angle!-45)<1);assert(Math.abs(s.actuators!.buzzers.buzzer1.frequency!-880)<20);assert(Math.abs(s.actuators!.motors.motor1.voltage!-2)<.1);}out.push({key,console:text(events),frame:s});}finally{e.dispose();}}save(board===UNO?'uno-examples':'nano-examples',out);
});
for(const board of [UNO,NANO]as const)test(`${board}: newly compiled timer conflicts are visible in actual pulse output`,{skip:!process.env.LAB_ARDUINO_CLI},async()=>{
 const p=arduinoExampleProject('servoMotorTone',board);p.files['main.ino']=`#include <Servo.h>\nServo s;\nvoid setup(){Serial.begin(9600);pinMode(3,OUTPUT);pinMode(9,OUTPUT);analogWrite(3,128);analogWrite(9,128);Serial.println(F("BASELINE"));delay(200);s.attach(8,1000,2000);s.write(90);tone(4,880);Serial.println(F("CONFLICT READY"));}\nvoid loop(){}\n`;
 const a=await compileProject(p),events:any[]=[],e=new AVREngine(a.hex,compileCircuit(actuatorCircuit('servoMotorTone',board),'avr'),(x:any)=>events.push(x),board===NANO?8:6,a.staticRamBytes);try{advance(e,150);const baseline=frame(events);for(const pin of ['3','9']){assert(Math.abs(baseline.gpios[pin].freq!-490)<10);assert(Math.abs(baseline.gpios[pin].duty!/65535-.5)<.05);}advance(e,350);assert(text(events).includes('CONFLICT READY'));const s=frame(events);assert(Math.abs((s.gpios['3']?.freq??490)-490)>50||Math.abs((s.gpios['3']?.duty??0)/65535-.5)>.2,'tone must disrupt Timer2 PWM');assert(Math.abs((s.gpios['9']?.freq??0)-490)>50||Math.abs((s.gpios['9']?.duty??0)/65535-.5)>.2,'Servo must disrupt Timer1 PWM');save(board===UNO?'uno-timer-conflict':'nano-timer-conflict',{console:text(events),frame:s});}finally{e.dispose();}
});

test('motor overvoltage warns about peak voltage even when PWM average is low',()=>{
 const f=fixture('dcDrive',S3,c=>{c.components.find(p=>p.id==='motorSupply')!.properties.supplyVoltage=12;});try{f.set(8,1);f.set(9,0);f.h.pwm(4,1000,10000);const s=f.snapshot();assert(s.actuators!.motors.motor1.voltage!<2);assert(s.diagnostics.some(d=>d.code==='motor-overvoltage'));}finally{f.h.dispose();}
});
test('Nano analog-only control pin and mismatched relay LV are diagnosed',()=>{
 const c=actuatorCircuit('activeAlarm',NANO);c.wires.find(w=>w.to.pin==='SIG')!.from.pin='A6';assert(checkCircuit(c).diagnostics.some(d=>d.code==='actuator-digital-pin'));
 const r=actuatorCircuit('relayContacts');r.components.find(p=>p.id==='relay1')!.properties.logicVoltage=5;assert.throws(()=>compileCircuit(r),/LV profil/);
});
for(const board of [UNO,NANO]as const)test(`${board}: tone reconfigures Timer2 and disrupts the real IR carrier`,{skip:!process.env.LAB_ARDUINO_CLI},async()=>{
 const p=arduinoExampleProject('irTransmit',board);p.files['main.ino']=`#include "lab_nec.h"
void setup(){Serial.begin(9600);LabNECSender::begin();LabNECSender::send(0,69);Serial.println(F("IR BASELINE"));delay(100);tone(4,880);LabNECSender::send(0,70);Serial.println(F("IR CONFLICT"));}
void loop(){}
`;
 const a=await compileProject(p),events:any[]=[],e=new AVREngine(a.hex,compileCircuit(p.circuit as Circuit,'avr'),(x:any)=>events.push(x),board===NANO?8:6,a.staticRamBytes);try{advance(e,95);const first=frame(events);assert(text(events).includes('IR BASELINE'));assert(first.infrared!.irRx.transitions>0);const before=first.infrared!.irRx.transitions;advance(e,200);const after=frame(events);assert(text(events).includes('IR CONFLICT'));assert.equal(after.infrared!.irRx.transitions,before);save(board===UNO?'uno-ir-tone-conflict':'nano-ir-tone-conflict',{console:text(events),before:first.infrared,after:after.infrared});}finally{e.dispose();}
});
test('production Nano Worker runs the combined actuator program and terminates within 500 ms',async()=>{
 const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8')),asset=manifest.files.find((f:any)=>/^\/assets\/avrWorker-.*\.js$/.test(f.url));assert(asset);
 const a=JSON.parse(readFileSync('public/avr-examples.json','utf8'))[NANO].servoMotorTone,events:any[]=[];
 const w=new Worker(new URL('./avr-built-worker.mjs',import.meta.url),{workerData:{path:pathToFileURL(resolve('dist'+asset.url)).href}});
 let pending:{check:()=>boolean;done:()=>void;fail:(e:Error)=>void}|undefined;
 const wait=(check:()=>boolean)=>new Promise<void>((ok,bad)=>{if(check()){ok();return;}const timer=setTimeout(()=>{pending=undefined;bad(Error('Worker timeout '+text(events)));},20000);pending={check,done:()=>{clearTimeout(timer);pending=undefined;ok();},fail:e=>{clearTimeout(timer);pending=undefined;bad(e);}};});
 w.on('message',e=>{events.push(e);if(e.type==='error')pending?.fail(Error(e.message));else if(pending?.check())pending.done();});w.on('error',e=>pending?.fail(e));
 try{w.postMessage({type:'run',session:140,hex:a.hex,circuit:compileCircuit(actuatorCircuit('servoMotorTone',NANO),'avr'),adcChannels:8,staticRamBytes:a.staticRamBytes});await wait(()=>!!frame(events)?.actuators?.buzzers.buzzer1.active&&frame(events).servos.sg90.angle!==null);const f=frame(events);assert(f.actuators!.motors.motor1.relativeSpeed>0);assert(Math.abs(f.actuators!.buzzers.buzzer1.frequency!-880)<20);const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);save('production-worker',{version:manifest.version,build:manifest.build,console:text(events),frame:f,stopMs,scope:'Node/Linux production Worker bundle'});}finally{await w.terminate();}
});

test('relay contact connecting a live H-bridge output to ground is diagnosed at runtime',()=>{
 const f=fixture('dcDrive',S3,c=>{
  const relay=makePart('relay',1300,500,'guard');c.components.push(relay);
  const b=c.components[0],gpio=terminals(b).find(t=>t.gpio===6)!.pin;
  const wire=(a:string,p:string,z:string,q:string)=>c.wires.push({id:'guard'+c.wires.length,from:{component:a,pin:p},to:{component:z,pin:q},color:'#087f8c',points:[]});
  wire(b.id,terminals(b).find(t=>t.role==='5v')!.pin,'guard','VCC');wire(b.id,terminals(b).find(t=>t.role==='3v3')!.pin,'guard','LV');wire(b.id,terminals(b).find(t=>t.role==='ground')!.pin,'guard','GND');wire(b.id,gpio,'guard','IN');wire('bridge1','OUT1','guard','COM');wire('guard','NO','guard','GND');
 });try{f.set(8,1);f.set(9,0);f.set(4,1);assert.equal(f.set(6,0),-2);assert(f.snapshot().diagnostics.some(d=>d.code==='bridge-output-conflict'));}finally{f.h.dispose();}
});

test('external DC supply cannot bypass the mandatory series resistor for an LED',()=>{
 const c=actuatorCircuit('relayContacts');c.wires=c.wires.filter(w=>w.from.component!=='relayR0'&&w.to.component!=='relayR0');c.wires.push({id:'unsafeLED',from:{component:'loadSupply',pin:'+'},to:{component:'relayLED0',pin:'A'},color:'#d04b46',points:[]});assert.throws(()=>compileCircuit(c),/bez serijskog otpornika/);
});
