import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const analogProfiles=registry.profiles.filter(p=>p.id.startsWith('24C-'));
export function alternateAnalog(p:Project){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  if(py)p.files[file]=p.files[file].replaceAll('while True:','while 1:').replaceAll('sleep_ms(300)','sleep_ms(200)').replaceAll('sleep_ms(30)','sleep_ms(20)')
    .replaceAll('a.read_uv()','(a.read()*3100000/4095)').replaceAll('b.read_uv()','(b.read()*3100000/4095)').replaceAll('adc.read_u16()','adc.read()*65535//4095');
  else p.files[file]='#include <Arduino.h>\nint acquire(uint8_t pin){ return analogRead(pin); }\n'+p.files[file].replaceAll('analogRead(','acquire(').replaceAll('delay(300)','delay(200)').replaceAll('delay(100)','delay(80)');
  if(p.circuit.kind==='editable'){
    for(const component of p.circuit.components){component.x+=17;component.y+=23;}
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}
export function wrongAnalog(p:Project,variant:string,boundariesOnly=false){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';
  if(boundariesOnly){
    p.files[file]=py?'from time import ticks_ms\n'+(variant==='adc'?p.files[file].replace(/while (?:True|1):/,'while True:\n    if ticks_ms()>=3000:\n        led.duty_u16(0)\n        sleep_ms(100)\n        continue'):
      '_original_print=print\ndef print(*values):\n    if ticks_ms()<3000:\n        _original_print(*values)\n'+p.files[file]):
      p.files[file].replace(/void loop\(\)\s*\{/,'void loop(){if(millis()>=3000){delay(100);return;}');
  }else if(variant==='adc'){
    if(py)p.files[file]=p.files[file].replace('led.duty_u16(vrijednost)','led.duty_u16(0)');
    else p.files[file]='#include <Arduino.h>\nvoid stalled(int pin,int value){analogWrite(pin,0);}\n'+p.files[file].replaceAll('analogWrite(','stalled(');
  }else p.files[file]=py?'def print(*values):\n    pass\n'+p.files[file]:
    '#include <Arduino.h>\ntemplate<class... T> void discard(T... values){}\n'+p.files[file].replaceAll('Serial.print(','discard(').replaceAll('Serial.println(','discard(');
  return p;
}
export function moveAnalogGPIO(p:Project){
  if(p.circuit.kind!=='editable')throw Error('Expected editable circuit');
  const board=p.circuit.components.find(c=>c.kind==='board')!,s3=p.board.id.includes('esp32-s3');
  const pins=terminals(board),from=pins.find(t=>t.gpio===(s3?1:14))!.pin,to=pins.find(t=>t.gpio===(s3?7:16))!.pin;
  for(const wire of p.circuit.wires)for(const end of [wire.from,wire.to])if(end.component===board.id&&end.pin===from)end.pin=to;
  const file=p.language==='micropython'?'main.py':'main.ino';
  p.files[file]=p.language==='micropython'?p.files[file].replaceAll('Pin(1)','Pin(7)'):s3?
    p.files[file].replaceAll('analogRead(1)','analogRead(7)').replaceAll('labAnalogBegin(1)','labAnalogBegin(7)').replaceAll('analogSetPinAttenuation(1,','analogSetPinAttenuation(7,'):
    p.files[file].replaceAll('A0','A2');
  return p;
}
