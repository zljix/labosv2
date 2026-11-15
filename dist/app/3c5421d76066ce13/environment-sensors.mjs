// MIT. Register/protocol models, shared by MicroPython and the AVR adapters.
// Calibration sets are the published Bosch reference vectors. The inverse
// search produces ADC words; the user's driver performs the compensation.
import {PeripheralError} from './peripherals.mjs';
const reject = message => { throw new PeripheralError(message, -95); };
const shift = (n,b) => Math.floor(n / 2**b);
const nearest = (target,lo,hi,fn,increasing=true) => {
  while (hi-lo>1) { const mid=Math.floor((hi+lo)/2); if ((fn(mid)<target)===increasing) lo=mid; else hi=mid; }
  return Math.abs(fn(lo)-target)<=Math.abs(fn(hi)-target)?lo:hi;
};
export const BMP180_CAL = Object.freeze([408,-72,-14383,32741,32757,23153,6190,4,-32768,-8711,2868]);
export const BMP280_CAL = Object.freeze([27504,26435,-1000,36477,-10685,3024,2855,140,-7,15500,-14600,6000]);
export function bmp180Temperature(ut,c=BMP180_CAL) {
  const x1=shift((ut-c[5])*c[4],15),x2=Math.trunc(c[9]*2048/(x1+c[10])),b5=x1+x2;
  return {temperature:shift(b5+8,4)/10,b5};
}
export function bmp180Pressure(up,b5,oss=0,c=BMP180_CAL) {
  const b6=b5-4000;
  let x1=shift(c[7]*shift(b6*b6,12),11),x2=shift(c[1]*b6,11),x3=x1+x2;
  const b3=shift((c[0]*4+x3)*2**oss+2,2);
  x1=shift(c[2]*b6,13);x2=shift(c[6]*shift(b6*b6,12),16);x3=shift(x1+x2+2,2);
  const b4=shift(c[3]*(x3+32768),15),b7=(up-b3)*(50000/2**oss);
  let p=b7<0x80000000?Math.trunc(b7*2/b4):Math.trunc(b7/b4)*2;
  x1=shift(p,8)**2;x1=shift(x1*3038,16);x2=shift(-7357*p,16);
  p+=shift(x1+x2+3791,4);return p;
}
export function bmp280Temperature(adc,c=BMP280_CAL) {
  const v1=(adc/16384-c[0]/1024)*c[1],v2=(adc/131072-c[0]/8192)**2*c[2];
  return {temperature:(v1+v2)/5120,fine:v1+v2};
}
export function bmp280Pressure(adc,fine,c=BMP280_CAL) {
  let v1=fine/2-64000,v2=v1*v1*c[8]/32768;
  v2+=v1*c[7]*2;v2=v2/4+c[6]*65536;
  v1=(c[5]*v1*v1/524288+c[4]*v1)/524288;v1=(1+v1/32768)*c[3];
  let p=(1048576-adc-v2/4096)*6250/v1;
  v1=c[11]*p*p/2147483648;v2=p*c[10]/32768;
  return p+(v1+v2+c[9])/16;
}
class Registers {
  constructor(device,now){this.device=device;this.now=now;this.pointer=0;this.sample=0;}
  onAddress(write){this.update();this.writing=write;this.first=true;return true;}
  writeByte(byte){if(this.first){this.pointer=byte;this.first=false;}else{this.set(this.pointer,byte);this.pointer=(this.pointer+1)&255;}}
  write(bytes){for(const b of bytes)this.writeByte(b);}
  readByte(){const value=this.get(this.pointer);this.pointer=(this.pointer+1)&255;return value;}
  read(length){return Uint8Array.from({length},()=>this.readByte());}
  end(write=true,success=true,stop=true){if(stop){this.readLatch=undefined;this.readMeta=undefined;}}
  snapshot(powered){this.update();return {powered,temperature:this.device.temperature,pressure:this.device.pressure,busy:!!this.pending,
    calibrated:true,sample:this.sample,measuredTemperature:this.measuredTemperature??null,measuredHumidity:null,measuredPressure:this.measuredPressure??null};}
}
export class BMP180 extends Registers {
  constructor(device,now){super(device,now);this.reset();}
  reset(){this.pointer=0;this.pending=undefined;this.control=0;this.dataKind=undefined;this.readLatch=undefined;this.readMeta=undefined;this.data=new Uint8Array(3);this.readyAt=this.now()+10;this.measuredTemperature=null;this.measuredPressure=null;}
  set(reg,value){
    this.update();
    if(reg===0xe0&&value===0xb6){this.reset();return;}
    if(reg!==0xf4)reject('BMP180: registar je samo za čitanje ili nije podržan.');
    if(this.now()<this.readyAt||this.pending)throw new PeripheralError('BMP180: pretvorba ili početno čekanje još traje.');
    const temperature=value===0x2e,oss=value>>6;
    if(!temperature&&(value&63)!==0x34)reject('BMP180: očekivana naredba 0x2E ili 0x34 | (OSS << 6).');
    this.control=value;this.pending={temperature,oss,until:this.now()+(temperature?4.5:[4.5,7.5,13.5,25.5][oss]),t:this.device.temperature,p:this.device.pressure};
  }
  update(){
    const s=this.pending;if(!s||this.now()<s.until)return;
    const ut=nearest(s.t,21000,40000,u=>bmp180Temperature(u).b5/160),t=bmp180Temperature(ut);
    if(s.temperature){this.dataKind='temperature';this.data=Uint8Array.of(ut>>8,ut&255,0);this.measuredTemperature=t.temperature;}
    else {
      this.dataKind='pressure';const up=nearest(s.p,0,65535*2**s.oss,u=>bmp180Pressure(u,t.b5,s.oss)),raw=up*2**(8-s.oss);
      this.data=Uint8Array.of(raw>>16,(raw>>8)&255,raw&255);this.measuredPressure=bmp180Pressure(up,t.b5,s.oss);this.sample++;
    }
    this.control&=~32;this.pending=undefined;
  }
  get(reg){
    this.update();
    if(reg===0xd0)return 0x55;
    if(reg>=0xaa&&reg<=0xbf){const n=BMP180_CAL[(reg-0xaa)>>1];return ((reg&1)?n:n>>8)&255;}
    if(reg===0xf4)return this.control;
    if(reg>=0xf6&&reg<=0xf8){this.readLatch??=this.data.slice();this.readMeta??={temperature:this.measuredTemperature,humidity:null,pressure:this.measuredPressure,sample:this.sample,valid:this.dataKind==='pressure'};return this.readLatch[reg-0xf6];}
    if(reg===0xe0)return 0;
    reject('BMP180: nepodržan registar 0x'+reg.toString(16));
  }
}
export class BMP280 extends Registers {
  constructor(device,now){super(device,now);this.reset();}
  reset(){this.pointer=0;this.ctrl=0;this.config=0;this.pending=undefined;this.nextAt=Infinity;this.readyAt=this.now()+2;this.data=Uint8Array.of(128,0,0,128,0,0);this.readLatch=undefined;this.readMeta=undefined;this.measuredTemperature=null;this.measuredPressure=null;}
  start(at){
    const os=n=>n===0?0:2**(Math.min(n,5)-1),t=os(this.ctrl>>5),p=os((this.ctrl>>2)&7);
    this.pending={until:at+1.25+2.3*t+(p?2.3*p+.575:0),t:this.device.temperature,p:this.device.pressure,hasT:!!t,hasP:!!p};
  }
  set(reg,value){
    this.update();
    if(reg===0xe0&&value===0xb6){this.reset();return;}
    if(this.now()<this.readyAt)throw new PeripheralError('BMP280: početno učitavanje kalibracije još traje.');
    if(reg===0xf5){if(this.ctrl&3)reject('BMP280: config se postavlja u sleep načinu.');if(value&31)reject('BMP280: IIR filtar i 3-wire SPI nisu podržani u ovom funkcionalnom profilu.');this.config=value;return;}
    if(reg!==0xf4)reject('BMP280: registar je samo za čitanje ili nije podržan.');
    if(this.pending)throw new PeripheralError('BMP280: pričekaj dovršetak pretvorbe prije promjene načina.');
    this.ctrl=value;this.nextAt=Infinity;if(value&3)this.start(this.now());
  }
  update(){
    const now=this.now();
    for(let count=0;count<10000;count++){
      if(!this.pending){if(this.nextAt>now)break;this.start(this.nextAt);this.nextAt=Infinity;}
      const s=this.pending;if(now<s.until)break;
      const rt=nearest(s.t,0,1048575,u=>bmp280Temperature(u).temperature),t=bmp280Temperature(rt),rp=nearest(s.p,0,1048575,u=>bmp280Pressure(u,t.fine),false);
      const rawP=s.hasP?rp:0x80000,rawT=s.hasT?rt:0x80000;
      this.data=Uint8Array.of(rawP>>12,(rawP>>4)&255,(rawP&15)<<4,rawT>>12,(rawT>>4)&255,(rawT&15)<<4);
      this.measuredTemperature=s.hasT?t.temperature:null;this.measuredPressure=s.hasT&&s.hasP?bmp280Pressure(rp,t.fine):null;
      this.sample++;this.pending=undefined;
      if((this.ctrl&3)===3)this.nextAt=s.until+[.5,62.5,125,250,500,1000,2000,4000][this.config>>5];else this.ctrl&=~3;
    }
  }
  get(reg){
    this.update();
    if(reg===0xd0)return 0x58;
    if(reg>=0x88&&reg<=0x9f){const n=BMP280_CAL[(reg-0x88)>>1];return ((reg&1)?n>>8:n)&255;}
    if(reg===0xa0||reg===0xa1||reg===0xe0)return 0;
    if(reg===0xf3)return (this.pending?8:0)|(this.now()<this.readyAt?1:0);
    if(reg===0xf4)return this.ctrl;if(reg===0xf5)return this.config;
    if(reg>=0xf7&&reg<=0xfc){this.readLatch??=this.data.slice();this.readMeta??={temperature:this.measuredTemperature,humidity:null,pressure:this.measuredPressure,sample:this.sample,valid:this.measuredTemperature!==null&&this.measuredPressure!==null};return this.readLatch[reg-0xf7];}
    reject('BMP280: nepodržan registar 0x'+reg.toString(16));
  }
}
export function crc16(bytes){let crc=0xffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc&1)?(crc>>1)^0xa001:crc>>1;}return crc;}
export class AM2320 {
  constructor(device,now){this.device=device;this.now=now;this.reset();}
  reset(){this.sample??=0;this.readyAt=this.now()+2000;this.awake=false;this.wakeAt=Infinity;this.response=undefined;this.index=0;this.pending={temperature:this.device.temperature,humidity:this.device.humidity,until:this.readyAt};this.lastRead=-Infinity;this.measuredTemperature=null;this.measuredHumidity=null;}
  update(){if(this.pending&&this.now()>=this.pending.until){this.measuredTemperature=Math.round(this.pending.temperature*10)/10;this.measuredHumidity=Math.round(this.pending.humidity*10)/10;this.pending=undefined;this.sample++;}}
  onAddress(write,freq=100000){
    this.update();
    if(freq>100000)throw new PeripheralError('AM2320: najveći I2C takt je 100 kHz.');
    const now=this.now();if(now<this.readyAt)return false;
    if(!this.awake){if(!write)return false;this.awake=true;this.wakeAt=now+.8;this.expires=now+3000;return false;}
    if(now>this.expires){this.awake=false;return this.onAddress(write,freq);}
    if(now<this.wakeAt)return false;
    this.bytes=[];this.index=0;
    if(!write&&(!this.response||now<this.responseAt))return false;
    return true;
  }
  writeByte(byte){
    this.bytes.push(byte);if(this.bytes.length>3)reject('AM2320: očekivana naredba 03, početni registar, duljina.');
    if(this.bytes.length===3){
      const [cmd,start,length]=this.bytes;if(cmd!==3||length<1||length>4||start+length>4)reject('AM2320: podržano je čitanje registara vlage/temperature 0–3 naredbom 03.');
      if(this.now()-this.lastRead<2000)throw new PeripheralError('AM2320: između dvaju očitanja treba najmanje 2 s.');
      const h=Math.round(this.measuredHumidity*10),t=Math.round(Math.abs(this.measuredTemperature)*10)|(this.measuredTemperature<0?0x8000:0);
      const values=Uint8Array.of(h>>8,h&255,t>>8,t&255),body=Uint8Array.of(3,length,...values.slice(start,start+length)),crc=crc16(body);
      this.response=Uint8Array.of(...body,crc&255,crc>>8);this.responseAt=this.now()+1.5;
    }
  }
  write(bytes){for(const b of bytes)this.writeByte(b);}
  readByte(){if(!this.response||this.index>=this.response.length)reject('AM2320: čitanje izvan odgovora s CRC-om.');return this.response[this.index++];}
  read(length){return Uint8Array.from({length},()=>this.readByte());}
  end(write,successful=true){
    if(!successful)return;
    if(write&&this.bytes?.length&&this.bytes.length!==3)reject('AM2320: nepotpuna naredba.');
    if(!write&&this.response&&this.index===this.response.length){this.lastRead=this.now();this.pending={temperature:this.device.temperature,humidity:this.device.humidity,until:this.now()+2000};this.response=undefined;this.awake=false;}
  }
  snapshot(powered){this.update();return {powered,temperature:this.device.temperature,humidity:this.device.humidity,busy:!!this.pending,calibrated:this.sample>0,sample:this.sample,measuredTemperature:this.measuredTemperature,measuredHumidity:this.measuredHumidity};}
}
