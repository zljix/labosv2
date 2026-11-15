import {makePart,circuitBoard,terminals,type Circuit,type Endpoint} from './model';

/** New wiring uses the exact existing blink/button source and compiled artifact. */
export function levelCircuit(base:Circuit,mode:'input'|'output'):Circuit {
 const board=structuredClone(base.components.find(p=>p.kind==='board')!),profile=circuitBoard(base),s3=profile.logicVoltage===3.3;
 board.x=50;board.y=70;
 const c:Circuit={kind:'editable',modelVersion:1,components:[board],wires:[]};
 const endpoint=(component:string,pin:string):Endpoint=>({component,pin});
 const power=(volts:3.3|5):Endpoint=>endpoint(board.id,profile.pins.find(p=>p.role===(volts===3.3?'3v3':'5v'))!.id);
 const ground=endpoint(board.id,profile.pins.find(p=>p.role==='ground')!.id);
 const gpio=(n:number):Endpoint=>endpoint(board.id,terminals(board).find(t=>t.gpio===n)!.pin);
 const shifter=makePart('levelShifter',410,90,'level1');shifter.label='SN74LVC2T45';c.components.push(shifter);
 const end=(pin:string):Endpoint=>endpoint(shifter.id,pin);
 const add=(id:string,from:Endpoint,to:Endpoint,color='#087f8c')=>c.wires.push({id:'level_'+id,from,to,color,points:[]});
 const resistor=makePart('resistor',830,110,'r1'),led=makePart('led',1050,115,'led1');
 resistor.properties.resistance=base.components.find(p=>p.id==='r1')?.properties.resistance??(s3?330:680);c.components.push(resistor,led);
 add('ledSeries',endpoint('r1','2'),endpoint('led1','A'));add('ledGround',endpoint('led1','K'),ground,'#334155');
 add('vcca',power(3.3),end('VCCA'),'#d04b46');add('vccb',power(5),end('VCCB'),'#d04b46');add('gnd',ground,end('GND'),'#334155');
 // Both channels share DIR; the board side always matches its logic supply.
 const aToB=mode==='output'?s3:!s3,source=aToB?'A':'B',dest=aToB?'B':'A';
 add('dir',aToB?power(3.3):ground,end('DIR'));
 add('unused',ground,end(source+'2'),'#334155');
 if(mode==='input'){
  const button=makePart('button',820,440,'sw1'),pull=makePart('resistor',820,300,'levelPull');pull.properties.resistance=10000;pull.label='Pull-up udaljene strane';c.components.push(button,pull);
  add('gpio',end(dest+'1'),gpio(s3?5:2));add('button',end(source+'1'),endpoint('sw1','A1'));add('buttonGround',endpoint('sw1','B1'),ground,'#334155');
  add('pullSupply',power(s3?5:3.3),endpoint(pull.id,'1'),'#d04b46');add('pullSignal',endpoint(pull.id,'2'),end(source+'1'));
  add('ledSignal',gpio(s3?4:9),endpoint('r1','1'));
 }else{
  const bias=makePart('resistor',820,330,'levelBias');bias.properties.resistance=100000;bias.label='Početni pull-down GPIO-a';c.components.push(bias);
  add('gpio',gpio(s3?4:9),end(source+'1'));add('ledSignal',end(dest+'1'),endpoint('r1','1'));
  add('biasSignal',end(source+'1'),endpoint(bias.id,'1'));add('biasGround',endpoint(bias.id,'2'),ground,'#334155');
 }
 return c;
}
export function levelHint(s3:boolean,mode:'input'|'output') {
 const direction=mode==='input'?(s3?'B → A':'A → B'):(s3?'A → B':'B → A');
 return `SN74LVC2T45: VCCA=3V3, VCCB=5V, GND zajednički. ${direction}; DIR=${direction==='A → B'?'3V3':'GND'}. Kanal 1 prenosi ${mode==='input'?'tipkalo prema GPIO'+(s3?'5':' D2'):'GPIO'+(s3?'4':' D9')+' prema serijskom otporniku i LED-u'}. Ulaz kanala 2 je na GND, izlaz ostaje slobodan. ${mode==='input'?'Vanjski 10 kΩ pull-up pripada udaljenoj strani; ulaz pločice zadržava postojeći INPUT_PULLUP. ':'Vanjski 100 kΩ pull-down određuje početni LOW dok program još nije postavio izlaz. '}U Sastavljanju promatraj oba napona. Ovo je GPIO push-pull profil sa zajedničkim DIR-om; za I2C treba drugi tip pretvornika. Izvor početnog programa jednak je postojećem primjeru ${mode==='input'?'Tipkalo':'Treptanje'}; promjena izvora traži novo C++ prevođenje.`;
}
