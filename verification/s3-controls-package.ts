// Executes the exact versioned Worker and WASM artifacts shipped by this release.
import {Worker} from 'node:worker_threads';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {s3ExampleProject} from '../src/runtime/s3Examples';
import {s3ControlExamples} from '../src/runtime/s3ControlExamples';
import {compileCircuit} from '../src/circuit/compile';
import type {Circuit} from '../src/circuit/model';
type Key=keyof typeof s3ControlExamples;
const manifest=JSON.parse(readFileSync('dist/offline-package.json','utf8'));
const release=resolve(`dist/app/${manifest.build}`);
const artifacts=JSON.parse(readFileSync(release+'/s3-examples.json','utf8'));
const results:any[]=[];
const close=(a:number,b:number,t=.03)=>assert(Math.abs(a-b)<=t,`${a} != ${b}`);
async function execute(key:Key,edit?:(p:ReturnType<typeof s3ExampleProject>)=>void,wantError?:RegExp) {
 const p=s3ExampleProject(key);edit?.(p);
 const w=new Worker(new URL('./s3-built-worker.mjs',import.meta.url),{workerData:{path:release+'/s3-worker.mjs'}});
 let consoleText='',frame:any,phase=0,carry='',error='';const marks:any[]=[];
 const input=(values:any)=>w.postMessage({type:'input',session:223,component:'enc1',...values});
 const terminals:Partial<Record<Key,string>>={relayContacts:'S3 RELAY OFF -> COM-NC',activeAlarm:'S3 ACTIVE OFF',piezoTone:'S3 TONE OFF',dcDrive:'S3 MOTOR BRAKE',dualDrive:'S3 DUAL A=+100 B=COAST',servoMotorTone:'S3 COMBINED ANGLE=135 MOTOR=50 TONE=880',stepperBasic:'STEPPER 0 deg',stepperMicro:'MICRO 1/16 0 deg',stepperControl:'CONTROL WAKE translator=5'};
 try {
  await new Promise<void>((done,reject)=>{
   const timer=setTimeout(()=>reject(Error(`${key}: packaged timeout ${consoleText}`)),20000);
   const finish=()=>{clearTimeout(timer);done();};
   w.on('error',e=>{clearTimeout(timer);reject(e);});
   w.on('message',e=>{
    try {
     if(e.type==='error'){error=e.message;if(wantError){assert.match(error,wantError);finish();}else{clearTimeout(timer);reject(Error(error));}return;}
     if(e.type==='simulation')frame=structuredClone(e);
     // Console and frames are throttled independently; wait for both observations.
     const settled=()=>{
      if(key==='encoderRaw'&&phase===3&&frame?.encoders.enc1.position===1)finish();
      if((key==='ky040'||key==='encoderBounce')&&phase===3&&frame?.encoders.enc1.position===1)finish();
      if(key==='encoderPWM'&&phase===2&&Math.abs(frame?.gpios['7']?.duty/65535-140/255)<.001){phase=3;input({pressed:true});}
      else if(key==='encoderPWM'&&phase===4&&Math.abs(frame?.gpios['7']?.duty/65535-127/255)<.001)finish();
     };
     settled();
     if(e.type!=='console')return;
     consoleText+=e.text;carry+=e.text;let at;
     while((at=carry.indexOf('\n'))>=0){
      const line=carry.slice(0,at).trim();carry=carry.slice(at+1);marks.push({line,frame:structuredClone(frame)});
      if(wantError)continue;
      if(key==='encoderRaw'){
       if(phase===0&&line==='S3 RAW CLK=1 DT=1 SW=1'){phase=1;input({encoderPosition:1});}
       else if(phase===1&&line==='S3 RAW CLK=0 DT=1 SW=1')phase=2;
       else if(phase===2&&line==='S3 RAW CLK=1 DT=1 SW=1')phase=3;
      }else if(key==='ky040'||key==='encoderBounce'){
       if(phase===0&&line==='S3 ENC READY P=0'){phase=1;input({encoderPosition:1});}
       else if(phase===1&&line==='S3 ENC P=1 DIR=CW ERR=0'){phase=2;input({pressed:true});}
       else if(phase===2&&line==='S3 ENC RESET P=0')phase=3;
      }else if(key==='encoderPWM'){
       if(phase===0&&line==='S3 PWM=50'){phase=1;input({encoderPosition:1});}
       else if(phase===1&&line==='S3 PWM=55')phase=2;
       else if(phase===3&&line==='S3 PWM=50')phase=4;
      }else if(line===terminals[key])finish();
      settled();
     }
    }catch(x){clearTimeout(timer);reject(x);}
   });
   w.postMessage({type:'run',session:223,project:p,artifact:artifacts[key],circuit:compileCircuit(p.circuit as Circuit)});
  });
  if(!wantError){
   const f=(marker:string)=>{const m=marks.find(x=>x.line===marker);assert(m,marker);return m.frame;};
   if(key==='relayContacts'){
    assert.equal(f('S3 RELAY READY OFF').actuators.relays.relay1.contact,'COM–NC');
    const on=f('S3 RELAY ON -> COM-NO'),off=f('S3 RELAY OFF -> COM-NC');assert(on.actuators.relays.relay1.energized&&on.leds.relayLED0.brightness>0&&on.leds.relayLED1.brightness===0);assert(!off.actuators.relays.relay1.energized&&off.leds.relayLED1.brightness>0);
   }
   if(key==='activeAlarm'){assert(!f('S3 ACTIVE READY OFF').actuators.buzzers.buzzer1.active);assert.equal(f('S3 ACTIVE ON').actuators.buzzers.buzzer1.frequency,2300);assert(!frame.actuators.buzzers.buzzer1.active);}
   if(key==='piezoTone'){for(const hz of [440,880,1320])assert.equal(f('S3 TONE='+hz).actuators.buzzers.buzzer1.frequency,hz);assert(!frame.actuators.buzzers.buzzer1.active);}
   if(key==='dcDrive'){for(const d of [64,128,255])close(f('S3 MOTOR FORWARD PWM='+d).actuators.motors.motor1.voltage,4*d/255);assert.equal(f('S3 MOTOR COAST').actuators.motors.motor1.voltage,null);close(f('S3 MOTOR REVERSE').actuators.motors.motor1.voltage,-4*128/255);close(frame.actuators.motors.motor1.voltage,0);}
   if(key==='dualDrive'){const a=f('S3 DUAL A=+50 B=-75');close(a.actuators.motors.motor1.voltage,4*128/255);close(a.actuators.motors.motor2.voltage,-4*192/255);assert.equal(frame.actuators.motors.motor2.voltage,null);}
   if(key==='servoMotorTone'){for(const angle of [45,135]){const a=f(`S3 COMBINED ANGLE=${angle} MOTOR=50 TONE=880`);close(a.servos.sg90.angle,angle,.15);close(a.actuators.motors.motor1.voltage,4*128/255);assert.equal(a.actuators.buzzers.buzzer1.frequency,880);}}
   if(key==='stepperBasic'){assert.equal(f('STEPPER +90 deg').steppers.motors.stepperMotor.angle,90);assert.equal(frame.steppers.motors.stepperMotor.angle,0);assert.equal(frame.steppers.drivers.stepperDriver.accepted,100);}
   if(key==='stepperMicro'){for(const n of [1,2,4,8,16]){const a=f(`MICRO 1/${n} +18 deg`);assert.equal(a.steppers.drivers.stepperDriver.resolution,n);assert.equal(a.steppers.motors.stepperMotor.angle,18);}assert.equal(frame.steppers.motors.stepperMotor.angle,0);}
   if(key==='stepperControl'){assert.equal(frame.steppers.drivers.stepperDriver.translatorTicks,80);assert.equal(frame.steppers.drivers.stepperDriver.ignored,6);assert.equal(frame.steppers.motors.stepperMotor.idealAngle,27);assert.equal(frame.steppers.motors.stepperMotor.angle,null);}
   assert.equal(frame.diagnostics.filter((d:any)=>d.severity==='error').length,0);
  }
  const at=performance.now();await w.terminate();const stopMs=performance.now()-at;assert(stopMs<500);
  results.push({key,fault:!!wantError,status:'pass',version:manifest.version,build:manifest.build,stopMs,error,console:consoleText,marks});
 }finally{await w.terminate();}
}
for(const key of Object.keys(s3ControlExamples)as Key[])await execute(key);
await execute('ky040',p=>{const c=p.circuit as Circuit;c.wires=c.wires.filter(w=>w.to.pin!=='CLK');},/Nepobuđen/);
await execute('relayContacts',p=>{(p.circuit as Circuit).wires.push({id:'short',from:{component:'relay1',pin:'NO'},to:{component:'loadSupply',pin:'-'},color:'#334155',points:[]});},/sukob/);
await execute('ky040',p=>{p.files['lab_encoder.h']+='\n// promjena bez novog prijevoda\n';},/hash|izvor|odgovara/i);
mkdirSync('docs/stage22c-evidence',{recursive:true});writeFileSync('docs/stage22c-evidence/packaged-s3-controls.json',JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({key,fault,status,stopMs})=>({key,fault,status,stopMs}))));
