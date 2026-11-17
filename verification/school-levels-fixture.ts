import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
import {alternateDisplay,wrongDisplay} from './school-displays-fixture';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const levelProfiles=registry.profiles.filter(p=>p.id.startsWith('24N-'));

export function alternateLevel(p:Project,v:string){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';
  if(v==='i2cOled32')p=alternateDisplay(p,'oled32');
  let code=p.files[file];
  if(v==='levelInput')code=py?'from machine import Pin\nfrom time import sleep_ms\nb=Pin(6,Pin.IN,Pin.PULL_UP)\nl=Pin(7,Pin.OUT)\nwhile 1:\n if b.value(): l.off()\n else: l.on()\n sleep_ms(15)\n':
    'void setup(){pinMode(6,INPUT_PULLUP);pinMode(7,OUTPUT);}void loop(){if(digitalRead(6)==LOW)digitalWrite(7,HIGH);else digitalWrite(7,LOW);delay(15);}\n';
  else if(v==='levelOutput'){
    const duration=py?500:s3?300:200;
    code=py?`from machine import Pin\nimport time\nl=Pin(6,Pin.OUT)\nwhile 1:\n l.value(1)\n time.sleep_ms(${duration/2})\n time.sleep_ms(${duration/2})\n l.value(0)\n time.sleep_ms(${duration})\n`:
      `void setup(){pinMode(6,OUTPUT);}void loop(){digitalWrite(6,1);delay(${duration/2});delay(${duration/2});digitalWrite(6,0);delay(${duration});}\n`;
  }else if(v==='i2cBmp280')code=code.replaceAll('temperatura','toplina').replaceAll('vrijednost','pritisak').replaceAll('2100','2000');
  if(v.startsWith('i2c')&&s3)code=code.replace('sda=Pin(8), scl=Pin(9)','sda=Pin(6), scl=Pin(7)').replace('Wire.begin(8,9,100000)','Wire.begin(6,7,100000)');
  p.files[file]=code;
  if(p.circuit.kind==='editable'){
    const board=p.circuit.components.find(c=>c.kind==='board')!;
    const remap=(from:number,to:number)=>{
      const old=terminals(board).find(t=>t.gpio===from)!.pin,next=terminals(board).find(t=>t.gpio===to)!.pin;
      for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===board.id&&e.pin===old)e.pin=next;
    };
    if(v==='levelInput'){remap(s3?5:2,6);remap(s3?4:9,7);}
    else if(v==='levelOutput')remap(s3?4:9,6);
    else if(s3){remap(8,6);remap(9,7);}
    const translator=p.circuit.components.find(c=>c.kind==='levelShifter');
    if(translator)for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===translator.id&&/^[AB][12]$/.test(e.pin))e.pin=e.pin[0]+(e.pin[1]==='1'?'2':'1');
    const ids=new Map(p.circuit.components.map((c,i)=>[c.id,'levels-alternative-'+i]));
    for(const part of p.circuit.components){part.id=ids.get(part.id)!;part.label='Drugi raspored';part.x+=23;part.y+=31;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}

export function wrongLevel(p:Project,v:string,advanced=false){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';let code=p.files[file];
  if(v==='i2cOled32')return wrongDisplay(p,'oled32',advanced);
  if(v==='levelInput')code=py?'from machine import Pin\nfrom time import sleep_ms,ticks_ms\nb=Pin(5,Pin.IN,Pin.PULL_UP)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value('+ (advanced?'not b.value() if ticks_ms()<1000 else 0':'b.value()') +')\n sleep_ms(15)\n':
    `void setup(){pinMode(${s3?5:2},INPUT_PULLUP);pinMode(${s3?4:9},OUTPUT);}void loop(){digitalWrite(${s3?4:9},${advanced?`millis()<1000?(digitalRead(${s3?5:2})==LOW):0`:`digitalRead(${s3?5:2})`});delay(15);}\n`;
  if(v==='levelOutput'){
    const duration=py?600:s3?400:300;
    code=py?'from machine import Pin\nfrom time import sleep_ms\nl=Pin(4,Pin.OUT,value=1)\nwhile True:\n '+(advanced?`l.on()\n sleep_ms(${duration})\n l.off()\n sleep_ms(${duration})`:'sleep_ms(100)')+'\n':
      `void setup(){pinMode(${s3?4:9},OUTPUT);digitalWrite(${s3?4:9},HIGH);}void loop(){${advanced?`digitalWrite(${s3?4:9},HIGH);delay(${duration});digitalWrite(${s3?4:9},LOW);delay(${duration});`:'delay(100);'}}\n`;
  }
  if(v==='i2cBmp280'){
    if(advanced)code=py?'from time import ticks_ms\n_saved_print=print\ndef print(*args):\n    if ticks_ms()<12000: _saved_print(*args)\n'+code:
      code.replaceAll('Serial.print(','if(millis()<12000)Serial.print(').replaceAll('Serial.println(','if(millis()<12000)Serial.println(');
    else code=py?code.replace('(temperatura, vrijednost)','(temperatura+5, vrijednost)'):code.replace('Serial.print(temperatura, 2)','Serial.print(temperatura+5, 2)');
  }
  if(code===p.files[file])throw Error('Negative fixture did not change '+v+' '+p.board.id+' '+advanced);
  p.files[file]=code;return p;
}
