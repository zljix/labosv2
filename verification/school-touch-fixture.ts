import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const touchProfiles=registry.profiles.filter(p=>p.id.startsWith('24J-'));
export function alternateTouch(p:Project,v:string){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';let code=p.files[file];
  code=py?code.replaceAll('while True:','while 1:').replaceAll('sleep_ms(100)','sleep_ms(50)\n    sleep_ms(50)'):
    code.replaceAll('delay(100)','delay(50);delay(50)');
  if(v==='iliGraphics')code=py?code.replace('tft.fill_rect(0, 0, 80, 48, 0xf800)',
    'tft.fill_rect(0, 0, 40, 48, 0xf800)\ntft.fill_rect(40, 0, 40, 48, 0xf800)'):
    code.replace('tft.fillRect(0,0,80,48,0xf800);','tft.fillRect(0,0,40,48,0xf800);tft.fillRect(40,0,40,48,0xf800);');
  if(v==='touchButton')code=py?code.replace('if down and not was_down:','if not was_down and down:'):
    code.replace('down&&!wasDown','!wasDown&&down');
  const from=v.startsWith('touch')?7:10,to=v.startsWith('touch')?3:5;
  code=py?code.replace(`Pin(${from}, Pin.OUT`,`Pin(${to}, Pin.OUT`):
    code.replace(`touch(${from})`,`touch(${to})`).replace(`tft(${from},9,8)`,`tft(${to},9,8)`)
      .replaceAll(`digitalWrite(${from},`,`digitalWrite(${to},`).replaceAll(`pinMode(${from},`,`pinMode(${to},`);
  p.files[file]=code;
  if(p.circuit.kind==='editable'){
    const b=p.circuit.components.find(c=>c.kind==='board')!,a=terminals(b).find(t=>t.gpio===from)!.pin,z=terminals(b).find(t=>t.gpio===to)!.pin;
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===b.id&&e.pin===a)e.pin=z;
    const ids=new Map(p.circuit.components.map((c,i)=>[c.id,'touch-alternative-'+i]));
    for(const c of p.circuit.components){c.id=ids.get(c.id)!;c.label='Drugi raspored';c.x+=23;c.y+=19;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}
export function wrongTouch(p:Project,v:string,advanced=false){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';let code=p.files[file];
  if(v==='iliGraphics')code=advanced?code.replaceAll('239, 319','238, 318').replaceAll('239,319','238,318'):code.replaceAll('0xf800','0x001f');
  if(v==='iliRotation')code=advanced?code.replace('range(4)','range(2)').replace('r<4','r<2'):code.replaceAll('0xf800','0x001f');
  if(v==='touchRaw')code=py?code.replace('irq()))',advanced?'(irq() if __import__("time").ticks_ms()<7500 else 2)))':'(irq()+2)))'):
    code.replace('Serial.println(digitalRead(2))',advanced?'Serial.println(millis()<7500?digitalRead(2):2)':'Serial.println(digitalRead(2)+2)');
  if(v==='touchCalibration'){
    if(advanced)code=code.replace('tft.fill_rect(x-2, y-2, 5, 5, 0xffe0)','tft.fill_rect(x-2, y-2, 5, 5, 0x07e0)')
      .replace('tft.fillRect(p.x-2,p.y-2,5,5,0xffe0)','tft.fillRect(p.x-2,p.y-2,5,5,0x07e0)');
    else code=py?code.replace('cal = (x0, x1, y0, y1)','cal = (200, 3900, 250, 3850)'):
      code.replace('Serial.print(F("CAL READY "))',`${s3?'calX0=200;calX1=3900;calY0=250;calY1=3850;':'x0=200;x1=3900;y0=250;y1=3850;'}Serial.print(F("CAL READY "))`);
  }
  if(v==='touchButton')code=advanced?code.replace('x < 210','x < 180').replace('p.x<210','p.x<180'):
    code.replace('down and not was_down','down').replace('down&&!wasDown','down');
  if(v==='touchRotation')code=py?code.replace('touch.point(rotation)',advanced?'touch.point(rotation if rotation<2 else 0)':'touch.point(0)'):
    code.replace('touch.point(p,rotation)',advanced?'touch.point(p,(rotation<2?rotation:0))':'touch.point(p,0)');
  if(code===p.files[file])throw Error('Negative did not change '+v+' '+p.board.id+' '+advanced);
  p.files[file]=code;return p;
}
