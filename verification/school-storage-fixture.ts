import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
import {terminals} from '../src/circuit/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const storageProfiles=registry.profiles.filter(p=>p.id.startsWith('24K-'));
export function alternateStorage(p:Project,v:string){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';let code=p.files[file];
  code=py?code.replaceAll('while True:','while 1:').replace(/^(\s*)sleep_ms\(1000\)/gm,'$1sleep_ms(500)\n$1sleep_ms(500)'):
    code.replaceAll('delay(1000)','delay(500);delay(500)');
  const from=v.startsWith('rtc')?(s3?6:4):10,to=v.startsWith('rtc')?9:3;
  code=py?code.replace(`Pin(${from})`,`Pin(${to})`):code.replace(`sat(${from},`,`sat(${to},`).replace('LabSD sd(10)','LabSD sd(3)');
  // S3 SPI.begin's CS argument also names the remapped pin.
  if(!py&&v.startsWith('sd'))code=code.replace('SPI.begin(12,13,11,10)','SPI.begin(12,13,11,3)');
  p.files[file]=code;
  if(p.circuit.kind==='editable'){
    const b=p.circuit.components.find(c=>c.kind==='board')!,old=terminals(b).find(t=>t.gpio===from)!.pin,next=terminals(b).find(t=>t.gpio===to)!.pin;
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===b.id&&e.pin===old)e.pin=next;
    const ids=new Map(p.circuit.components.map((c,i)=>[c.id,'storage-alternative-'+i]));
    for(const c of p.circuit.components){c.id=ids.get(c.id)!;c.label='Drugi raspored';c.x+=23;c.y+=19;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}
export function wrongStorage(p:Project,v:string,advanced=false){
  const py=p.language==='micropython',file=py?'main.py':'main.ino';let code=p.files[file];
  if(v==='rtcRead'){
    if(py){code='from time import ticks_ms\n'+code;code=code.replace('(y, mo, d, h, m, s, dan)',advanced?'(y + (1 if ticks_ms() >= 6400 else 0), mo, d, h, m, s, dan)':'(y+1, mo, d, h, m, s, dan)');}
    else code=code.replace('Serial.print(d.year)',advanced?'Serial.print(d.year+(millis()>=6400?1:0))':'Serial.print(d.year+1)');
  }
  if(v==='rtcMemory'){
    if(advanced){const needle=py?'sat.write_protect(False)':'sat.writeProtect(false);',at=code.lastIndexOf(needle);code=code.slice(0,at)+code.slice(at).replace(needle,py?'sat.write_protect(True)':'sat.writeProtect(true);');}
    else code=code.replace('prethodno + 1','prethodno + 2').replace('before+1','before+2');
  }
  if(v==='rtcClock'){
    if(py){code='from time import ticks_ms\n'+code;code=code.replace('h * 100 + m',advanced?'h * 100 + m + (1 if ticks_ms() >= 6400 else 0)':'h * 100 + m + 1');}
    else code=code.replace('d.hour*100+d.minute',advanced?'d.hour*100+d.minute+(millis()>=6400?1:0)':'d.hour*100+d.minute+1');
  }
  if(v==='sdInspect')code=advanced?code.replace('SD FILES','IGNORED FILES').replace('SD FAT16 MOUNT=','IGNORED MOUNT='):code.replace('SIGNATURE=','WRONG SIGNATURE=');
  if(v==='sdFiles')code=advanced?code.replace('SD FILE BYTES=','IGNORED BYTES='):code.replaceAll('Pozdrav iz FAT16 preko SPI!','Pogresan podatak preko SPI!');
  if(v==='sdLogger'){
    if(advanced)code=py?code.replace('f.write(redak)','f.write(redak) if uzorak < 2 else None'):
      code.replace('LabDS1302::DateTime d;if(!sat.datetime(d))','if(uzorak>=2){delay(1000);return;}LabDS1302::DateTime d;if(!sat.datetime(d))');
    else code=code.replace('uzorak = 0','uzorak = 1').replace('unsigned uzorak=0','unsigned uzorak=1');
  }
  if(code===p.files[file])throw Error('Negative did not change '+v+' '+p.board.id+' '+advanced);
  p.files[file]=code;return p;
}
