import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const stepperProfiles=registry.profiles.filter(p=>p.id.startsWith('24G-'));
export function alternateStepper(p:Project){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  p.files[file]=py?'def print(*args):\n    pass\n'+p.files[file].replace('step = Pin(2,','step = Pin(10,').replace('sleep_ms(4)','sleep_ms(2)\n        sleep_ms(2)'):
    '#include <Arduino.h>\ntemplate<class... T> void discard(T... values){}\n'+p.files[file].replace('STEP=2','STEP=10').replace('delay(4)','delay(2); delay(2)').replaceAll('Serial.print(','discard(').replaceAll('Serial.println(','discard(');
  if(p.circuit.kind==='editable'){
    const board=p.circuit.components.find(c=>c.kind==='board')!;
    const oldPin=terminals(board).find(t=>t.gpio===2)!.pin,newPin=terminals(board).find(t=>t.gpio===10)!.pin;
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===board.id&&e.pin===oldPin)e.pin=newPin;
    const names=new Map(p.circuit.components.map((c,i)=>[c.id,'stepper-alternative-'+i]));
    for(const c of p.circuit.components){c.id=names.get(c.id)!;c.label='Druga oznaka';c.x+=27;c.y+=19;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=names.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}
export function wrongStepper(p:Project,variant:string,advanced=false){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  if(advanced&&variant==='stepperControl')p.files[file]=p.files[file].replace(py?'reset.value(0)':'digitalWrite(RESET_PIN,LOW)',py?'reset.value(1)':'digitalWrite(RESET_PIN,HIGH)');
  else if(advanced){
    const ms=variant==='stepperBasic'?1602:6487;
    p.files[file]=py?'from time import ticks_ms\n'+p.files[file].replace('while True:',`while True:\n    if ticks_ms() >= ${ms}:\n        sleep_ms(100)\n        continue`):
      p.files[file].replace(/void loop\(\)\s*\{/,`void loop(){if(millis()>=${ms}){delay(100);return;}`);
  }else{
    const source=py?variant==='stepperBasic'?'pulse(50)':variant==='stepperMicro'?'pulse(10 * factor)':'pulse(10)':
      variant==='stepperBasic'?'pulse(PUNI_KORACI/4)':variant==='stepperMicro'?'pulse(PUNI_KORACI*factor[i]/20)':'pulse(10)';
    const replacement=py?variant==='stepperMicro'?'pulse(5 * factor)':variant==='stepperBasic'?'pulse(25)':'pulse(5)':
      variant==='stepperBasic'?'pulse(PUNI_KORACI/8)':variant==='stepperMicro'?'pulse(PUNI_KORACI*factor[i]/40)':'pulse(5)';
    p.files[file]=p.files[file].replaceAll(source,replacement);
  }return p;
}
