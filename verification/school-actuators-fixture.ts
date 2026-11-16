import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const actuatorProfiles=registry.profiles.filter(p=>p.id.startsWith('24F-'));
export function alternateActuator(p:Project){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  // Equivalent implementations split waits and remove all diagnostic output.
  p.files[file]=py?p.files[file].replace(/^([ \t]*)sleep_ms\(600\)/gm,(_line,indent)=>indent+'sleep_ms(300)\n'+indent+'sleep_ms(300)'):
    p.files[file].replaceAll('delay(600)','delay(300); delay(300)');
  if(py)p.files[file]='def print(*args):\n    pass\n'+p.files[file];
  else p.files[file]='#include <Arduino.h>\ntemplate<class... T> void discard(T... values){}\n'+p.files[file].replaceAll('Serial.print(','discard(').replaceAll('Serial.println(','discard(');
  if(p.circuit.kind==='editable'){
    const names=new Map(p.circuit.components.map((c,i)=>[c.id,'actuator-alternative-'+i]));
    for(const c of p.circuit.components){c.id=names.get(c.id)!;c.x+=25;c.y+=17;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=names.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}
export function wrongActuator(p:Project,variant:string,lateOnly=false){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  if(lateOnly){
    const cycle=({relayContacts:1400,activeAlarm:1000,piezoTone:2000,sg90Sweep:1800,dcDrive:2900,dualDrive:1600,servoMotorTone:1200} as Record<string,number>)[variant];
    // One complete cycle then freeze in its last phase. This retains the
    // first-cycle points and loses the two repeat-cycle points.
    p.files[file]=py?'from time import ticks_ms\n'+p.files[file].replace('while True:',`while True:\n    if ticks_ms() >= ${cycle}:\n        sleep_ms(100)\n        continue`):
      p.files[file].replace(/void loop\(\)\s*\{/,`void loop(){if(millis()>=${cycle}){delay(100);return;}`);
  }else{
    const replacements:Record<string,[string,string][]>={
      relayContacts:py?[['relej.value(0)','relej.value(1)']]:[['digitalWrite(7, LOW)','digitalWrite(7, HIGH)'],['digitalWrite(6,LOW)','digitalWrite(6,HIGH)']],
      activeAlarm:py?[['zujalica.value(1)','zujalica.value(0)']]:[['digitalWrite(4, HIGH)','digitalWrite(4, LOW)'],['digitalWrite(7,HIGH)','digitalWrite(7,LOW)']],
      piezoTone:py?[['(440, 880, 1320)','(660, 660, 660)']]:[['{440, 880, 1320}','{660, 660, 660}'],['{440,880,1320}','{660,660,660}']],
      sg90Sweep:py?[['(0, 90, 180)','(45, 45, 45)']]:[['{0, 90, 180}','{45, 45, 45}'],['int pulse=1000+angle*1000/180','int pulse=1250']],
      dcDrive:py?[['(16384, 32768, 65535)','(8192, 8192, 8192)']]:[['{64, 128, 255}','{32, 32, 32}'],['{64,128,255}','{32,32,32}']],
      dualDrive:py?[['enb.duty_u16(49151)','enb.duty_u16(32768)']]:[['analogWrite(ENB, 192)','analogWrite(ENB, 128)'],['analogWrite(ENB,192)','analogWrite(ENB,128)']],
      servoMotorTone:py?[['freq=880','freq=660']]:[['tone(4, 880)','tone(4, 660)'],['postaviTon(880)','postaviTon(660)']],
    };
    for(const [a,b]of replacements[variant])p.files[file]=p.files[file].replaceAll(a,b);
  }return p;
}
