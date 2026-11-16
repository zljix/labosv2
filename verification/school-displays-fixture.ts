import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const displayProfiles=registry.profiles.filter(p=>p.id.startsWith('24H-'));
export function alternateDisplay(p:Project,v:string){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';let code=p.files[file];
  if(v!=='bmp280SPI')code=py?'def print(*args):\n    pass\n'+code:
    '#include <Arduino.h>\ntemplate<class... T> void discard(T... values){}\n'+code.replaceAll('Serial.print(','discard(').replaceAll('Serial.println(','discard(');
  code=py?code.replaceAll('while True:','while 1:').replaceAll('sleep_ms(1000)','sleep_ms(500)\n    sleep_ms(500)'):
    code.replaceAll('delay(1000)','delay(500);delay(500)');
  if(v==='lcd1602')code=code.replace('custom_char(0,','custom_char(1,').replace('chr(0)','chr(1)').replace('createChar(0,','createChar(1,').replace('write((uint8_t)0)','write((uint8_t)1)');
  if(v==='tftGraphics')code=code.replace('tft.fill_rect(0, 0, 42, 26, 0xf800)','tft.fill_rect(0, 0, 21, 26, 0xf800)\ntft.fill_rect(21, 0, 21, 26, 0xf800)')
    .replace('tft.fillRect(0,0,42,26,0xf800);','tft.fillRect(0,0,21,26,0xf800);tft.fillRect(21,0,21,26,0xf800);');
  p.files[file]=code;
  if(p.circuit.kind==='editable'){
    const board=p.circuit.components.find(c=>c.kind==='board')!;
    const remap=(from:number,to:number)=>{const a=terminals(board).find(t=>t.gpio===from)!.pin,b=terminals(board).find(t=>t.gpio===to)!.pin;
      for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===board.id&&e.pin===a)e.pin=b;};
    if(v.startsWith('tm')){
      const old=p.board.id.includes('esp32-s3')?4:2;remap(old,6);
      p.files[file]=p.files[file].replace(`Pin(${old})`,`Pin(6)`).replace(`prikaz(${old},`,`prikaz(6,`);
    }
    const ids=new Map(p.circuit.components.map((c,i)=>[c.id,'display-alternative-'+i]));
    for(const c of p.circuit.components){c.id=ids.get(c.id)!;c.label='Drugi raspored';c.x+=29;c.y+=17;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}
export function wrongDisplay(p:Project,v:string,advanced=false){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';let code=p.files[file];
  if(advanced&&['tmSegments','spiDashboard'].includes(v)){
    const stop=v==='tmSegments'?3900:9000;
    code=py?'from time import ticks_ms\n'+code.replace('while True:',`while True:\n    if ticks_ms() >= ${stop}:\n        sleep_ms(100)\n        continue`):
      code.replace(/void loop\(\)\s*\{/,`void loop(){if(millis()>=${stop}){delay(100);return;}`);
  }else if(v==='oled32')code=advanced?code.replace('brojac += 1','brojac += 0').replaceAll('brojac++','brojac').replaceAll('count++','count'):
    code.replaceAll('OLED 128 x 32','OLED 128 x 33').replaceAll('ESP32-S3 U8g2','ESP32-S3 U8g3');
  else if(v==='lcd1602')code=advanced?code.replace('brojac += 1','brojac += 0').replaceAll('brojac++','brojac').replaceAll('count++','count'):
    code.replaceAll('17,14','17,15').replaceAll('17, 14','17, 15');
  else if(v==='tmSegments')code=code.replaceAll('1 << bit','(1 << bit) ^ 1');
  else if(v==='tmClock')code=advanced?code.replace('sekunde + 1','sekunde + 0'):
    code.replace('12 * 60 + 34','13 * 60 + 34');
  else if(v==='tftGraphics')code=code.replaceAll(advanced?'0xf81f':'0xf800',advanced?'0x0000':'0x001f');
  else if(v==='tftRotation')code=advanced?code.replace('range(4)','range(2)').replace('r<4','r<2'):
    code.replaceAll('0xf800','0x001f');
  else if(v==='bmp280SPI'){
    if(advanced)code=py?'from time import ticks_ms\n_original_print=print\ndef print(*args):\n    if ticks_ms()<7000: _original_print(*args)\n'+code:
      code.replaceAll('Serial.print(','if(millis()<7000)Serial.print(').replaceAll('Serial.println(','if(millis()<7000)Serial.println(');
    else code=py?code.replace('(temperature, pressure)','(temperature+5, pressure)'):code.replace('Serial.print(t,2)','Serial.print(t+5,2)');
  }else if(v==='spiDashboard')code=code.replaceAll('0xffe0','0xf800');
  if(code===p.files[file])throw Error('Negative fixture did not change '+v+' '+p.board.id+' '+advanced);
  p.files[file]=code;return p;
}
