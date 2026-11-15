import {makePart,circuitBoard,type Circuit,type Endpoint} from './model';

/** Rewire the exact existing BMP280/OLED source; no substitute compiled code. */
export function i2cLevelCircuit(base:Circuit):Circuit {
 const c=structuredClone(base),board=c.components.find(p=>p.kind==='board')!,profile=circuitBoard(c),s3=profile.logicVoltage===3.3;
 const device=c.components.find(p=>p.kind==='bmp280'||p.kind==='ssd1306_32');
 if(!device)throw Error('I2C pretvornik traži pojedinačni BMP280 ili OLED128×32 primjer.');
 const pins=['SDA','SCL'];
 const signalWires=pins.map(pin=>c.wires.find(w=>[w.from,w.to].some(e=>e.component===device.id&&e.pin===pin)));
 if(signalWires.some(w=>!w))throw Error('Početni primjer nema očekivane I2C vodiče.');
 const endpoint=(component:string,pin:string):Endpoint=>({component,pin});
 const power=(volts:3.3|5)=>endpoint(board.id,profile.pins.find(p=>p.role===(volts===3.3?'3v3':'5v'))!.id);
 const ground=endpoint(board.id,profile.pins.find(p=>p.role==='ground')!.id);
 const remoteVoltage=s3?5:3.3,boardSide=s3?'L':'H',remoteSide=s3?'H':'L';
 device.properties.moduleVoltage=remoteVoltage;device.x=1040;device.y=150;
 const supply=c.wires.find(w=>[w.from,w.to].some(e=>e.component===device.id&&e.pin==='VCC'));
 if(!supply)throw Error('Početni primjer nema VCC vodič.');
 if(supply.from.component===device.id)supply.to=power(remoteVoltage);else supply.from=power(remoteVoltage);
 const converter=makePart('i2cLevelShifter',570,140,'i2cLevel1');converter.label='I2C · Lab 3,3 ↔ 5 V';c.components.push(converter);
 const add=(id:string,from:Endpoint,to:Endpoint,color='#087f8c')=>c.wires.push({id:'i2cLevel_'+id,from,to,color,points:[]});
 for(const [i,pin]of pins.entries()){
  const w=signalWires[i]!;
  const at=endpoint(converter.id,pin+'_'+boardSide);
  if(w.from.component===device.id)w.from=at;else w.to=at;
  w.points=[];
  add(pin,endpoint(converter.id,pin+'_'+remoteSide),endpoint(device.id,pin));
 }
 add('LV',power(3.3),endpoint(converter.id,'LV'),'#d04b46');
 add('HV',power(5),endpoint(converter.id,'HV'),'#d04b46');
 add('GND',ground,endpoint(converter.id,'GND'),'#334155');
 return c;
}
export function i2cLevelHint(s3:boolean,oled:boolean) {
 return `I2C Lab prema AN10441: LV=3V3, HV=5V i zajednička masa. Pločica je na ${s3?'SDA_L/SCL_L (3,3 V)':'SDA_H/SCL_H (5 V)'}, ${oled?'OLED128×32':'BMP280'} na ${s3?'SDA_H/SCL_H (5 V carrier s regulatorom/prilagodbom)':'SDA_L/SCL_L (izvorni modul 3,3 V)'}. Nema DIR-a: oba smjera dijele SDA/SCL. Pretvornik ima četiri 10 kΩ pull-up otpornika; modul zadržava svoje 4,7 kΩ. U Mjerenjima usporedi odvojene HIGH napone i stvarne I2C prijenose. Nepromijenjeni program i driver jednaki su postojećem ${oled?'OLED128×32':'BMP280'} primjeru. Promjena C++ izvora zahtijeva novo prevođenje. Model rješava DC i I2C transakcije; ne prikazuje pojedinačne bitove, RC bridove, clock-stretching ili najveću fizičku frekvenciju. Napajanje/izvedbu stvarnog modula treba zasebno provjeriti.`;
}
