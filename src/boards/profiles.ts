import s3 from '../../boards/esp32-s3-devkitc-1-v1.1-n16r8.json';

export const S3 = 'espressif.esp32-s3-devkitc-1.v1.1.n16r8';
export const UNO = 'arduino.uno-r3.atmega328p';
export const NANO = 'arduino.nano-classic.atmega328p';
export type BoardId = typeof S3 | typeof UNO | typeof NANO;
export type Language = 'micropython' | 'arduino-cpp';
export type Capability = 'input' | 'output' | 'adc' | 'pwm' | 'sda' | 'scl' | 'mosi' | 'miso' | 'sck' | 'ss' | 'rx' | 'tx' | 'interrupt';
export type PinRole = 'gpio' | 'analog' | 'ground' | '3v3' | '5v' | 'reserved' | 'enable';
export interface BoardPin {id:string;label:string;x:number;y:number;role:PinRole;gpio?:number;capabilities:Capability[];mcuPin?:string;note?:string}
export interface BoardProfile {
  id:BoardId;version:string;title:string;short:string;description:string;logicVoltage:number;
  width:number;height:number;languages:Language[];pins:BoardPin[];links:string[][];
  adc:{bits:number;reference:number;fullScale:number};pwmPins:number[];clockHz?:number;sramBytes?:number;
  fqbn?:string;firmware?:string;sources:string[];
}
export const languageName = (l:Language) => l === 'micropython' ? 'MicroPython' : 'Arduino C/C++';
const pwm = [3,5,6,9,10,11];
function avrPin(id:string,x:number,y:number):BoardPin {
  const digital=/^D\d+$/.test(id), analog=/^A\d$/.test(id), n=digital?Number(id.slice(1)):analog?14+Number(id.slice(1)):undefined;
  const inputOnly=analog&&(n??0)>=20;
  const caps:Capability[]=n===undefined?[]:inputOnly?['adc']:['input','output'];
  if(analog&&!inputOnly)caps.push('adc');
  if(n!==undefined&&pwm.includes(n))caps.push('pwm');
  for(const [num,cap]of [[0,'rx'],[1,'tx'],[2,'interrupt'],[3,'interrupt'],[10,'ss'],[11,'mosi'],[12,'miso'],[13,'sck'],[18,'sda'],[19,'scl']]as const)if(n===num)caps.push(cap);
  const alias=id==='SDA'?18:id==='SCL'?19:undefined;
  if(alias!==undefined)caps.push('input','output','adc',alias===18?'sda':'scl');
  const gpio=n??alias;
  return {id,label:id.startsWith('GND')?'GND':id.startsWith('RST')?'RST':id,x,y,
    role:inputOnly?'analog':gpio!==undefined?'gpio':id.startsWith('GND')?'ground':id==='3V3'?'3v3':id==='5V'||id==='IOREF'?'5v':id==='NC'?'reserved':'enable',
    gpio,capabilities:caps,mcuPin:gpio===undefined?undefined:gpio<8?`PD${gpio}`:gpio<14?`PB${gpio-8}`:gpio<20?`PC${gpio-14}`:`ADC${gpio-14}`,
    note:inputOnly?'Samo analogni ulaz; nema digitalnog ulaza, izlaza ni PWM-a.':id==='AREF'?'Vanjska referenca ADC-a; ovdje nije izvor napajanja.':id==='VIN'?'Ulaz vanjskog napajanja; nije izlaz 5 V.':id==='NC'?'Nepovezan položaj; ne koristi se.':undefined};
}
const s3Pins:BoardPin[]=Object.entries(s3.headers).flatMap(([header,labels])=>labels.map((label,i)=>{
  const gpio=label.startsWith('GPIO')?Number(label.slice(4)):undefined,reserved=gpio!==undefined&&s3.unavailableForExternalUse.includes(gpio);
  const capabilities:Capability[]=gpio===undefined||reserved?[]:['input','output','pwm'];
  if(gpio!==undefined&&s3.simulation.supportedAdcGpio.includes(gpio))capabilities.push('adc');
  return {id:`${header}.${i+1}`,label,x:header==='J1'?0:200,y:60+i*20,gpio,capabilities,
    role:reserved?'reserved':gpio!==undefined?'gpio':label==='GND'?'ground':label==='3V3'?'3v3':label==='5V'?'5v':'enable',
    note:reserved?'Rezervirano za octal PSRAM.':gpio!==undefined&&s3.strapPins.includes(gpio)?'Strapping pin: stanje pri uključenju utječe na pokretanje.':gpio===19||gpio===20?'Native USB.':undefined} as BoardPin;
}));
const unoTop=['SCL','SDA','AREF','GND','D13','D12','D11','D10','D9','D8','D7','D6','D5','D4','D3','D2','D1','D0'];
const unoBottom=['NC','IOREF','RST','3V3','5V','GND2','GND3','VIN','A0','A1','A2','A3','A4','A5'];
const nanoLeft=['D1','D0','RST','GND','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12'];
const nanoRight=['VIN','GND2','RST2','5V','A0','A1','A2','A3','A4','A5','A6','A7','AREF','3V3','D13'];
export const BOARDS:Record<BoardId,BoardProfile>={
  [S3]:{id:S3,version:'0.0.1',title:'ESP32-S3 DevKitC-1',short:'ESP32-S3',description:'v1.1 · N16R8 · 44 priključka · 3,3 V logika',logicVoltage:3.3,width:200,height:540,languages:['micropython','arduino-cpp'],pins:s3Pins,links:[['J1.1','J1.2'],['J1.22','J3.1','J3.21','J3.22']],adc:{bits:12,reference:3.3,fullScale:3.1},pwmPins:s3.simulation.supportedGpio,firmware:'ESP32_GENERIC_S3/spiram-oct@1.29.0',sources:[s3.source]},
  [UNO]:{id:UNO,version:'0.1.0',title:'Arduino Uno R3',short:'Uno R3',description:'ATmega328P · 16 MHz · 5 V logika · 2 KiB SRAM',logicVoltage:5,width:430,height:300,languages:['arduino-cpp'],
    pins:[...unoTop.map((id,i)=>avrPin(id,35+i*20+(i>=10?20:0),0)),...unoBottom.map((id,i)=>avrPin(id,55+i*20+(i>=8?25:0),300))],
    links:[['GND','GND2','GND3'],['5V','IOREF'],['SDA','A4'],['SCL','A5']],adc:{bits:10,reference:5,fullScale:5},pwmPins:pwm,clockHz:16000000,sramBytes:2048,fqbn:'arduino:avr:uno',sources:['https://docs.arduino.cc/hardware/uno-rev3/','https://content.arduino.cc/assets/A000066-full-pinout.pdf']},
  [NANO]:{id:NANO,version:'0.1.0',title:'Arduino Nano classic',short:'Nano classic',description:'ATmega328P · 16 MHz · 5 V logika · A6/A7 samo analogno',logicVoltage:5,width:180,height:400,languages:['arduino-cpp'],
    pins:[...nanoLeft.map((id,i)=>avrPin(id,0,60+i*20)),...nanoRight.map((id,i)=>avrPin(id,180,60+i*20))],
    links:[['GND','GND2'],['RST','RST2']],adc:{bits:10,reference:5,fullScale:5},pwmPins:pwm,clockHz:16000000,sramBytes:2048,fqbn:'arduino:avr:nano:cpu=atmega328',sources:['https://docs.arduino.cc/hardware/nano/','https://www.arduino.cc/en/uploads/Main/ArduinoNanoManual23.pdf']},
};
export function isBoardId(id:unknown):id is BoardId {return typeof id==='string'&&Object.hasOwn(BOARDS,id);}
export function getBoard(id:unknown):BoardProfile {if(!isBoardId(id))throw Error('Profil pločice nije podržan.');return BOARDS[id];}
export function requirePinUse(id:BoardId,pinId:string,capability:Capability):BoardPin {
  const profile=getBoard(id),pin=profile.pins.find(p=>p.id===pinId);
  if(!pin||!pin.capabilities.includes(capability))throw Error(`${profile.short} · ${pinId}: tražena uporaba ${capability} nije podržana.${pin?.note?' '+pin.note:''}`);
  return pin;
}
export function pinDescription(pin:BoardPin,profile:BoardProfile) {
  return [pin.label,`${profile.logicVoltage.toLocaleString('hr-HR')} V logika`,pin.mcuPin,pin.capabilities.map(c=>({input:'digitalni ulaz',output:'digitalni izlaz',adc:`ADC ${profile.adc.bits} bita`,pwm:'PWM',sda:'I2C SDA',scl:'I2C SCL',mosi:'SPI MOSI',miso:'SPI MISO',sck:'SPI SCK',ss:'SPI SS',rx:'UART RX',tx:'UART TX',interrupt:'vanjski prekid'})[c]).join(' · '),pin.note].filter(Boolean).join(' · ');
}
