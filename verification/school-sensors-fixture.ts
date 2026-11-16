import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
import {starter as initialProject} from './school-contract-fixture';
import type {UrsTarget} from '../src/lessons/ursCatalog';
export {jobFor,compilerOptions} from './school-contract-fixture';
export async function starter(taskKey:string,target:UrsTarget='micropython'){
  const p=await initialProject(taskKey,target);
  // The lesson deliberately starts with excessive polling. The grading
  // solution corrects that interval, just as the LED solution corrects timing.
  if(taskKey==='dht/dhtErrors'&&target==='micropython')p.files['main.py']=p.files['main.py'].replaceAll('sleep_ms(300)','sleep_ms(2100)');
  return p;
}
export const sensorProfiles=registry.profiles.filter(p=>p.id.startsWith('24D-'));
export function alternateSensor(p:Project){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  p.files[file]=py?p.files[file].replaceAll('while True:','while 1:').replaceAll('senzor','mjerenje').replaceAll('romovi','adrese').replaceAll('sleep_ms(2100)','sleep_ms(2050)'):
    p.files[file].replaceAll('senzor','mjerenje').replaceAll('delay(2100)','delay(2050)').replaceAll('delay(1000)','delay(900)');
  if(p.circuit.kind==='editable'){
    p.circuit.components.reverse();p.circuit.wires.reverse();
    for(const d of p.circuit.components){d.x+=23;d.y+=19;}
  }
  return p;
}
export function wrongSensor(p:Project,afterMs?:number){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  p.files[file]=py?(afterMs===undefined?'def print(*values):\n    pass\n':
    'from time import ticks_ms\n_original_print=print\ndef print(*values):\n    if ticks_ms()<'+afterMs+': _original_print(*values)\n')+p.files[file]:
    '#include <Arduino.h>\ntemplate<class... T> void discard(T... values){}\n'+p.files[file].replaceAll('Serial.print(',afterMs===undefined?'discard(':'if(millis()<'+afterMs+')Serial.print(').replaceAll('Serial.println(',afterMs===undefined?'discard(':'if(millis()<'+afterMs+')Serial.println(');
  return p;
}
export function movedSensor(p:Project){
  if(p.circuit.kind!=='editable')throw Error('Expected editable circuit');
  const board=p.circuit.components.find(c=>c.kind==='board')!,s3=p.board.id.includes('esp32-s3');
  const from=terminals(board).find(t=>t.gpio===(s3?4:2))!.pin,to=terminals(board).find(t=>t.gpio===6)!.pin;
  for(const w of p.circuit.wires)for(const end of [w.from,w.to])if(end.component===board.id&&end.pin===from)end.pin=to;
  const file=p.language==='micropython'?'main.py':'main.ino';p.files[file]=p.files[file].replaceAll('Pin(4)','Pin(6)').replace(/OneWire bus\([24]\);/,'OneWire bus(6);').replace(/DHT senzor\([24],/,'DHT senzor(6,');
  return p;
}
