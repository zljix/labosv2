import {readFileSync} from 'node:fs';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import {terminals} from '../src/circuit/model';
import registry from '../school/grader/profiles.json';
export {jobFor,compilerOptions} from './school-contract-fixture';
export const radioProfile=registry.profiles.find(p=>p.id==='24M-radio@1')!;
export async function radioStarter(target:UrsTarget='micropython',peer:UrsTarget=target){
  const old=globalThis.fetch;globalThis.fetch=async(p:any)=>new Response(readFileSync('public/'+String(p).replace(/^\/app\/[^/]+\//,'')));
  try{return await createUrsProject('radio','radio',target,peer);}finally{globalThis.fetch=old;}
}
export function alternateRadio(p:any){
  for(const node of [p,p.radio.peer]){
    const py=node.language==='micropython',s3=node.board.id.includes('esp32-s3'),file=py?'main.py':'main.ino';
    node.files[file]=node.files[file].replace(/\bradio\b/g,'modul').replace('range(1, 11)','range(1, 1 + 10)');
    if(s3){node.files[file]=node.files[file].replace('Pin(10,','Pin(6,').replace('Pin(4,','Pin(5,').replace('modul(10, 4)','modul(6, 5)').replace('SPI.begin(12, 13, 11, 10)','SPI.begin(12, 13, 11, 6)');
      const board=node.circuit.components.find((c:any)=>c.kind==='board');
      for(const [a,b]of [[10,6],[4,5]]){const old=terminals(board).find(t=>t.gpio===a)!.pin,next=terminals(board).find(t=>t.gpio===b)!.pin;
        for(const w of node.circuit.wires)for(const e of [w.from,w.to])if(e.component===board.id&&e.pin===old)e.pin=next;}
    }
    const ids=new Map(node.circuit.components.map((c:any,i:number)=>[c.id,'radio-layout-'+i]));
    for(const c of node.circuit.components){c.id=ids.get(c.id);c.x+=25;c.y+=17;}
    for(const w of node.circuit.wires)for(const e of [w.from,w.to])e.component=ids.get(e.component);
    node.circuit.components.reverse();node.circuit.wires.reverse();
  }return p;
}
export function wrongRadio(p:any,advanced=false){
  if(advanced){const a=p,py=a.language==='micropython',file=py?'lab_nrf24.py':'lab_nrf24.h';
    const before=py?'self.command(0xe1)\n                    return False':'command(0xe1, 0, 0, 0); return false;';
    const after=py?'self.command(0xe1)\n                    return True':'command(0xe1, 0, 0, 0); return true;';
    if(!a.files[file].includes(before))throw Error('Missing MAX_RT branch');
    a.files[file]=a.files[file].replace(before,after);
  }else{const b=p.radio.peer,file=b.language==='micropython'?'main.py':'main.ino';
    b.files[file]=b.files[file].replace('print("RX", data[0])','print("RX", data[0] + 1)').replace('Serial.println(data[0]);','Serial.println(data[0]+1);');
  }return p;
}
