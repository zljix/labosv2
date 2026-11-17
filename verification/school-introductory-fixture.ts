import {readFileSync} from 'node:fs';
import registry from '../school/grader/profiles.json';
import {createLessonProject} from '../src/lessons/catalog';
import {terminals} from '../src/circuit/model';
import type {Project} from '../src/project/model';
export {jobFor} from './school-contract-fixture';
export const introductoryProfiles=registry.profiles.filter(p=>p.id.startsWith('24O-'));
export function introductoryProject(id:string,solution=true){
  const drivers=Object.fromEntries(['aht10.py','ssd1306.py','servo.py'].map(n=>[n,readFileSync('public/drivers/'+n,'utf8')]));
  return createLessonProject(id,drivers,solution);
}
export function alternateIntroductory(p:Project,id:string){
  let code=p.files['main.py'];
  if(id==='led-time')code='from machine import Pin\nfrom time import sleep_ms\nlamp=Pin(4,Pin.OUT)\ndef phase(value,ms):\n lamp.value(value)\n sleep_ms(ms)\nwhile 1:\n phase(1,250)\n phase(0,750)\n';
  if(id==='button')code='from machine import Pin\nimport time\nswitch=Pin(5,Pin.IN,Pin.PULL_UP)\nlamp=Pin(4,Pin.OUT)\nwhile 1:\n if switch.value(): lamp.off()\n else: lamp.on()\n time.sleep_ms(250)\n';
  if(id==='adc-pwm')code=code.replace('adc.read_u16()','int(adc.read()*65535/4095)').replaceAll('vrijednost','ocitanje');
  if(['aht-oled','regulator'].includes(id)){
    code=code.replaceAll('temperatura','toplina').replaceAll('vlaga','relativna');
    code=code.replace('toplina, 0, 0)','toplina, 16, 32)').replace('relativna, 0, 16)','relativna, 16, 48)').replace('relativna, 0, 14)','relativna, 16, 48)');
    // The optional labels/bar are free graphics and must not overwrite numbers.
    code=code.split('\n').filter(l=>!l.includes('zaslon.text("Servo:')&&!l.includes('zaslon.text("OTVORENO')&&!l.includes('zaslon.rect(')&&!l.includes('zaslon.fill_rect(')).join('\n');
  }
  const remaps=id==='aht-oled'||id==='regulator'?[[8,6],[9,7],[10,12],[11,13],[4,2]]:[[4,6],[5,7],[1,2]];
  if(p.circuit.kind==='editable'){
    const board=p.circuit.components.find(c=>c.kind==='board')!;
    for(const [old,next] of remaps){
      code=code.replaceAll('Pin('+old+',','Pin('+next+',').replaceAll('Pin('+old+')','Pin('+next+')').replaceAll('Servo('+old+')','Servo('+next+')');
      const a=terminals(board).find(t=>t.gpio===old)!.pin,b=terminals(board).find(t=>t.gpio===next)!.pin;
      for(const w of p.circuit.wires)for(const e of [w.from,w.to])if(e.component===board.id&&e.pin===a)e.pin=b;
    }
    const ids=new Map(p.circuit.components.map((c,i)=>[c.id,'intro-alternate-'+i]));
    for(const c of p.circuit.components){c.id=ids.get(c.id)!;c.label='Drugi raspored';c.x+=25;c.y+=16;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }
  p.files['main.py']=code;return p;
}
export function wrongIntroductory(p:Project,id:string,advanced=false){
  let code=p.files['main.py'];
  if(id==='led-time')code=advanced?code.replace('sleep_ms(250)','sleep_ms(500)').replace('sleep_ms(750)','sleep_ms(500)'):'from machine import Pin\nfrom time import sleep_ms\nl=Pin(4,Pin.OUT,value=1)\nwhile True: sleep_ms(100)\n';
  if(id==='button')code='from machine import Pin\nfrom time import sleep_ms,ticks_ms\nb=Pin(5,Pin.IN,Pin.PULL_UP)\nl=Pin(4,Pin.OUT)\nwhile True:\n l.value('+(advanced?'not b.value() if ticks_ms()<1950 else 0':'b.value()')+')\n sleep_ms(20)\n';
  if(id==='adc-pwm')code=code.replace('led.duty_u16(vrijednost)',advanced?'led.duty_u16(vrijednost if __import__("time").ticks_ms()<3000 else 65535)':'led.duty_u16(65535 if vrijednost>=32768 else 0)');
  if(id==='aht-oled')code=advanced?code.replace('zaslon.show()','# no show(): console/framebuffer is not an OLED'):code.replace('sleep_ms(500)','sleep_ms(2400)');
  if(id==='regulator')code=advanced?code.replace('if temperatura >= PRAG_OTVARANJA:','if round(temperatura, 1) >= PRAG_OTVARANJA:').replace('elif temperatura <= PRAG_ZATVARANJA:','elif round(temperatura, 1) <= PRAG_ZATVARANJA:'):code.replace('PRAG_ZATVARANJA = 26','PRAG_ZATVARANJA = 28');
  if(code===p.files['main.py'])throw Error('Unchanged negative fixture '+id);
  p.files['main.py']=code;return p;
}
