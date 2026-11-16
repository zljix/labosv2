import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const eventProfiles=registry.profiles.filter(p=>p.id.startsWith('24E-'));
export function alternateEvent(p:Project){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  p.files[file]=py?p.files[file].replaceAll('sleep_ms(1)','sleep_ms(2)').replace('naredba = 70 if naredba == 69 else 69','naredba = 139 - naredba'):
    p.files[file].replaceAll('delay(1)','delay(2)').replace('command=command==69?70:69','command=139-command');
  if(py&&p.files[file].includes('stanje = ('))p.files[file]=p.files[file].replace('stanje = (clk.value(), dt.value(), sw.value())','stanje = tuple(p.value() for p in (clk, dt, sw))');
  if(p.circuit.kind==='editable'){
    const names=new Map(p.circuit.components.map((c,i)=>[c.id,'alternative-'+i]));
    for(const c of p.circuit.components){c.id=names.get(c.id)!;c.x+=17;c.y+=23;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=names.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}
export function wrongEvent(p:Project,variant:string,lateOnly=false){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  if(lateOnly){
    const after=variant.startsWith('encoder')||variant==='ky040'?6000:variant==='irTransmit'?2500:2100;
    p.files[file]=py?'from time import ticks_ms\n'+p.files[file].replace('while True:',`while True:\n    if ticks_ms() >= ${after}:\n        sleep_ms(100)\n        continue`):
      p.files[file].replace(/void loop\(\)\s*\{/,`void loop(){if(millis()>=${after}){delay(100);return;}`);
  }else if(variant==='irLED')p.files[file]=py?p.files[file].replace('led.duty_u16(svjetlina * 65535 // 100)','led.duty_u16(0)'):
    p.files[file].replaceAll('analogWrite(9,(long)brightness*255/100)','analogWrite(9,0)').replaceAll('analogWrite(7,(long)brightness*255/100)','analogWrite(7,0)');
  else if(variant==='irTransmit')p.files[file]=py?p.files[file].replace('naredba = 70 if naredba == 69 else 69','naredba = 69'):
    p.files[file].replace('command=command==69?70:69','command=69');
  else p.files[file]=py?'def print(*values):\n    pass\n'+p.files[file]:
    '#include <Arduino.h>\ntemplate<class... T> void discard(T... values){}\n'+p.files[file].replaceAll('Serial.print(','discard(').replaceAll('Serial.println(','discard(');
  return p;
}
