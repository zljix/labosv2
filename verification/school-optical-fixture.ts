import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const opticalProfiles=registry.profiles.filter(p=>p.id.startsWith('24L-'));
export function alternateOptical(p:Project){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';
  let code=p.files[file].replaceAll('senzor','uredaj');
  code=py?code.replaceAll('while True:','while 1:').replaceAll('0.02 *','0.025 *').replace('sleep_ms(700)','sleep_ms(350)\n    sleep_ms(350)'):
    code.replaceAll('.02f *','.025f *').replace('delay(700)','delay(350); delay(350)');
  if(s3)code=code.replace('sda=Pin(8), scl=Pin(9)','sda=Pin(6), scl=Pin(7)').replace('Wire.begin(8,9,100000)','Wire.begin(6,7,100000)');
  p.files[file]=code;
  if(p.circuit.kind==='editable'){
    const board=p.circuit.components.find(c=>c.kind==='board')!;
    if(s3)for(const [from,to]of [[8,6],[9,7]]){
      const old=terminals(board).find(t=>t.gpio===from)!.pin,next=terminals(board).find(t=>t.gpio===to)!.pin;
      for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===board.id&&e.pin===old)e.pin=next;
    }
    const ids=new Map(p.circuit.components.map((c,i)=>[c.id,'optical-alternative-'+i]));
    for(const part of p.circuit.components){part.id=ids.get(part.id)!;part.label='Drugi raspored';part.x+=27;part.y+=21;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }
  return p;
}
export function wrongOptical(p:Project,v:string,advanced=false){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';let code=p.files[file];
  if(v==='opticalRegisters')code=advanced?code.replace('senzor.shutdown(True)','senzor.shutdown(False)').replace('senzor.shutdown(true)','senzor.shutdown(false)'):
    code.replaceAll('MAX MODE=','MAX WRONG MODE=');
  if(v==='opticalRaw'){
    if(py){code='from time import ticks_ms\n'+code;code=code.replace('uzorak[0]',advanced?'(uzorak[0] if ticks_ms() < 2200 else 0)':'uzorak[0] + 1');}
    else code=code.replace('Serial.print(red);',advanced?'Serial.print(millis()<2200?red:0);':'Serial.print(red+1);');
  }
  if(v==='opticalFrequency'){
    if(py){code='from time import ticks_ms\n'+code;code=code.replace('6000.0 / (n - zadnji)',advanced?'6000.0 / (n - zadnji) + (50 if ticks_ms() >= 10000 else 0)':'6000.0 / (n - zadnji) + 50');}
    else code=code.replace('6000.f / (n - zadnji)',advanced?'6000.f / (n - zadnji) + (millis()>=10000?50:0)':'6000.f / (n - zadnji) + 50');
  }
  if(v==='opticalOverflow')code=advanced?code.replace('range(broj)','range(broj - 1)').replace('i < n;','i < n - 1;'):
    code.replace('(broj, izgubljeno)','(broj - 1, izgubljeno)').replace('Serial.print(n);','Serial.print(n-1);');
  if(code===p.files[file])throw Error('Negative did not change '+v+' '+p.board.id+' '+advanced);
  p.files[file]=code;return p;
}
