import registry from '../school/grader/profiles.json';
import type {Project} from '../src/project/model';
export {starter,jobFor,compilerOptions} from './school-contract-fixture';
export const environmentProfiles=registry.profiles.filter(p=>p.id.startsWith('24I-'));

export function alternateEnvironment(p:Project,v:string){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';let code=p.files[file];
  if(v==='regulator'){
    code=py?code.replace(/    if temperatura >= PRAG_OTVARANJA:\n        otvoreno = True\n    elif temperatura <= PRAG_ZATVARANJA:\n        otvoreno = False/,
      '    otvoreno = (False if temperatura <= PRAG_ZATVARANJA else True if temperatura >= PRAG_OTVARANJA else otvoreno)'):
      s3?code.replace('if(t>=28)opened=true;else if(t<=26)opened=false;','opened=t<=26?false:t>=28?true:opened;'):
        code.replace('if (temperatura >= 28) otvoreno = true;\n  else if (temperatura <= 26) otvoreno = false;',
          'otvoreno = temperatura <= 26 ? false : temperatura >= 28 ? true : otvoreno;');
  }else{
    // Pressure reaches the OLED through an explicitly factored conversion.
    code=py?code.replace('(p180/100)','(p180*0.01)').replace('(p280/100)','(p280*0.01)'):
      s3?code.replace('oled.print(p/100,1)','oled.print(p*0.01,1)'):
        code.replace('oled.print(p180/100,1)','oled.print(p180*0.01,1)').replace('oled.print(p280/100,1)','oled.print(p280*0.01,1)');
  }
  code=py?code.replaceAll('while True:','while 1:').replace('sleep_ms(2100)','sleep_ms(1000)\n    sleep_ms(1100)'):
    code.replaceAll('delay(2100)','delay(1000);delay(1100)').replaceAll('delay(1900)','delay(900);delay(1000)');
  p.files[file]=code;
  if(p.circuit.kind==='editable'){
    const ids=new Map(p.circuit.components.map((c,i)=>[c.id,'environment-alternative-'+i]));
    for(const c of p.circuit.components){c.id=ids.get(c.id)!;c.label='Drugi raspored';c.x+=31;c.y+=17;}
    for(const w of p.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component)!;
    p.circuit.components.reverse();p.circuit.wires.reverse();
  }return p;
}

export function wrongEnvironment(p:Project,v:string,advanced=false){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';let code=p.files[file];
  if(v==='regulator'){
    if(advanced)code=py?code.replace('PRAG_OTVARANJA = 28','PRAG_OTVARANJA = 28.5'):
      s3?code.replace('t>=28','t>=28.5'):code.replace('temperatura >= 28','temperatura >= 28.5');
    else code=py?code.replace('elif temperatura <= PRAG_ZATVARANJA:','else:'):
      s3?code.replace('else if(t<=26)opened=false;','else opened=false;'):
        code.replace('else if (temperatura <= 26) otvoreno = false;','else otvoreno = false;');
  }else if(advanced){
    // Keep real bus writes and all new reads, but show the wrong numeric value.
    code=py?code.replace('(p280/100)','(p280/100+10)'):
      s3?code.replace('oled.print(p/100,1)','oled.print(p/100+10,1)'):code.replace('oled.print(p280/100,1)','oled.print(p280/100+10,1)');
  }else{
    code=py?code.replace('(t180, p180))','(t180+10, p180))'):
      s3?code.replace('Serial.print("BMP180 ");Serial.print(t);','Serial.print("BMP180 ");Serial.print(t+10);'):
        code.replace('Serial.print(t180,2)','Serial.print(t180+10,2)');
  }
  if(code===p.files[file])throw Error('Unchanged negative '+v+' '+p.board.id+' '+advanced);
  p.files[file]=code;return p;
}
