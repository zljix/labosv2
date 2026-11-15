import {NRF24,RadioMedium} from './nrf24.mjs';
import {RadioClock} from './radio-clock.mjs';
import {SDCard} from './sd-card.mjs';
// MIT. Byte-level SPI teaching profiles. No source/console parsing and no SPICE.
import {XPT2046} from './xpt2046.mjs';
import {ILI9341} from './ili9341.mjs';
const isTFT = kind => kind==='st7735'||kind==='ili9341';
import {BMP280} from './environment-sensors.mjs';
import {PeripheralError} from './peripherals.mjs';
const unsupported = message => {throw new PeripheralError(message,-95);};
const ARG_COUNTS = new Map([[0x2a,4],[0x2b,4],[0x36,1],[0x3a,1],
  [0xb1,3],[0xb2,3],[0xb3,6],[0xb4,1],[0xc0,3],[0xc1,1],[0xc2,2],[0xc3,2],[0xc4,2],[0xc5,1],[0xe0,16],[0xe1,16]]);
export class ST7735 {
  constructor(now){this.now=now;this.ram=new Uint16Array(128*128);this.written=0;this.reset();}
  reset(){this.on=false;this.sleep=true;this.inverse=false;this.madctl=0;this.format=6;this.cmd=-1;this.args=[];this.hi=null;this.x0=0;this.x1=127;this.y0=0;this.y1=127;this.x=0;this.y=0;this.readyAt=this.now()+120;}
  command(cmd){
    if(this.now()+1e-6<this.readyAt)unsupported('ST7735: pričekaj 120 ms nakon napajanja/resetiranja ili izlaska iz sleep načina.');
    this.cmd=cmd;this.args=[];this.hi=null;
    if(cmd===1){this.reset();return;}
    if(cmd===0x10){this.sleep=true;return;}
    if(cmd===0x11){this.sleep=false;this.readyAt=this.now()+120;return;}
    if(cmd===0x28||cmd===0x29){this.on=cmd===0x29;return;}
    if(cmd===0x20||cmd===0x21){this.inverse=cmd===0x21;return;}
    if(cmd===0x2c){this.x=this.x0;this.y=this.y0;return;}
    if([0,0x13].includes(cmd)||ARG_COUNTS.has(cmd))return;
    unsupported('ST7735: naredba 0x'+cmd.toString(16)+' nije podržana (bez čitanja, scrolla i 9-bitnog SPI-ja).');
  }
  data(byte){
    if(this.now()+1e-6<this.readyAt)unsupported('ST7735: podatkovni upis tijekom čekanja nakon reseta/sleep izlaza nije podržan.');
    if(this.cmd===0x2c){
      if(this.format!==5)unsupported('ST7735: funkcionalni profil podržava RGB565, COLMOD=0x05.');
      if(this.hi===null){this.hi=byte;return;}
      let color=(this.hi<<8)|byte;this.hi=null;
      // Physical 1.44-inch green-tab profile, offsets from its panel driver.
      // The visible RAM stays in physical orientation when addressing rotates.
      const r=({192:0,160:1,0:2,96:3})[this.madctl&0xe0];
      const row=r<2?3:1,ox=r%2?row:2,oy=r%2?2:row;
      const u=this.x-ox,v=this.y-oy;
      if(u>=0&&u<128&&v>=0&&v<128){
        let x=u,y=v;
        if(r===1){x=127-v;y=u;}else if(r===2){x=127-u;y=127-v;}else if(r===3){x=v;y=127-u;}
        if(!(this.madctl&8))color=((color&31)<<11)|(color&0x7e0)|((color>>11)&31);
        this.ram[y*128+x]=color;
      }
      this.written++;if(++this.x>this.x1){this.x=this.x0;if(++this.y>this.y1)this.y=this.y0;}
      return;
    }
    const count=ARG_COUNTS.get(this.cmd);
    if(!count||this.args.length>=count)unsupported('ST7735: podatak nema odgovarajuću naredbu.');
    this.args.push(byte);if(this.args.length!==count)return;
    const a=this.args;
    if(this.cmd===0x2a||this.cmd===0x2b){const lo=a[0]*256+a[1],hi=a[2]*256+a[3],max=this.madctl&32?this.cmd===0x2a?161:131:this.cmd===0x2a?131:161;if(lo>hi||hi>max)unsupported('ST7735: prozor je izvan RAM geometrije 132 × 162.');if(this.cmd===0x2a){this.x0=lo;this.x1=hi;}else{this.y0=lo;this.y1=hi;}}
    if(this.cmd===0x36){if(![0,0x60,0xa0,0xc0].includes(a[0]&0xf7))unsupported('ST7735: deklarirane su četiri rotacije; drugi MADCTL bitovi nisu podržani.');this.madctl=a[0];}
    if(this.cmd===0x3a){this.format=a[0];if(a[0]!==5)unsupported('ST7735: podržan je samo 16-bitni RGB565 (0x05).');}
    // Analog power/gamma setup bytes are accepted, not electrically simulated.
  }
  byte(value,dc){if(dc)this.data(value);else this.command(value);return 255;}
  snapshot(powered,backlight){const visible=powered&&backlight&&this.on&&!this.sleep;return {kind:'tft',width:128,height:128,powered,on:this.on,sleep:this.sleep,backlight,madctl:this.madctl,format:this.format,written:this.written,window:[this.x0,this.y0,this.x1,this.y1],pixels:Array.from(this.ram,c=>visible?(this.inverse?c^65535:c):0)};}
}
class BMP280SPI {
  constructor(device,now){this.sensor=new BMP280(device,now);this.begin();}
  begin(){this.pointer=null;this.reading=false;this.address=true;}
  end(){this.sensor.end();this.begin();}
  reset(){this.sensor.reset();this.begin();}
  byte(value){
    if(this.address){this.reading=!!(value&128);this.pointer=value|128;this.address=false;return 255;}
    if(this.reading){const out=this.sensor.get(this.pointer);this.pointer=(this.pointer+1)&255;return out;}
    this.sensor.set(this.pointer,value);this.address=true;return 255;
  }
}
export function createSPIHost({c,pins,gpioNet,rootData,solution,clockUs,advanceUs,radioMedium,radioNode}){
  const localClock=radioMedium?null:new RadioClock();
  const medium=radioMedium??new RadioMedium(localClock);
  const devices=(c.spiDevices??[]).map(d=>({d,model:d.kind==='nrf24'?new NRF24((radioNode??'main')+':'+d.id,medium):d.kind==='microSD'?new SDCard(d,clockUs):isTFT(d.kind)?(d.kind==='ili9341'?new ILI9341(()=>clockUs()/1000):new ST7735(()=>clockUs()/1000)):d.kind==='xpt2046'?new XPT2046(d):new BMP280SPI(d,()=>clockUs()/1000),powered:false,selected:false,reset:1,resetAt:null,reason:'Čeka program'}));
  const buses=new Map(),trace=[],issues=new Map(),measurements=[],recorded=new Map();let count=0;
  const log=(device,operation,value,result)=>{trace.push({timeUs:clockUs(),device,operation,value,result});if(trace.length>100)trace.shift();};
  const same=(a,b)=>a!==undefined&&b!==undefined&&rootData().root(a)===rootData().root(b);
  const level=(d,net,v)=>v[net]===null||v[d.gnd]===null?null:v[net]-v[d.gnd]<=d.logicVoltage*.2?0:v[net]-v[d.gnd]>=d.logicVoltage*.8&&v[net]-v[d.gnd]<=d.logicVoltage+.3?1:null;
  const issue=(s,message)=>{s.reason=message;issues.set(s.d.id,{code:'spi-protocol',severity:'warning',message:s.d.id+': '+message,terminals:c.nets[s.d.cs].terminals,wires:c.nets[s.d.cs].wires});};
  function observe(v=solution().volts){
    if(localClock){const at=clockUs();while(localClock.next<=at)localClock.fire();localClock.now=Math.max(localClock.now,at);}
    for(const s of devices){const d=s.d,powered=(c.referenceGrounds??[]).some(g=>same(g,d.gnd))&&v[d.gnd]!==null&&Math.abs(v[d.gnd])<.05&&v[d.vcc]!==null&&Math.abs(v[d.vcc]-d.moduleVoltage)<.35;
      if(powered!==s.powered){if(d.kind==='nrf24')s.model.power(powered);else s.model.reset();s.selected=false;s.powered=powered;}
      if(!powered){s.reason='Provjeri napajanje i zajedničku masu';continue;}
      if(d.kind==='nrf24')s.model.setCE(level(d,d.ce,v)===1);
      if(isTFT(d.kind)){
        const rst=level(d,d.rst,v);
        if(rst===0&&s.reset!==0)s.resetAt=clockUs();
        if(rst===1&&s.reset===0){if(clockUs()-s.resetAt>=10){s.model.reset();log(d.id,'reset',0,'HW reset');}else issue(s,'RESET LOW treba trajati najmanje 10 µs.');s.resetAt=null;}
        s.reset=rst;
      }
      const selected=level(d,d.cs,v)===0;
      if(s.selected&&!selected&&d.kind==='bmp280_spi'){const m=s.model.sensor.readMeta;if(m?.valid&&m.sample!==recorded.get(d.id)){measurements.push({timeMs:clockUs()/1000,component:d.id,...m});recorded.set(d.id,m.sample);if(measurements.length>200)measurements.shift();}s.model.end();}
      if(!s.selected&&selected&&d.kind==='bmp280_spi')s.model.begin();
      if((d.kind==='nrf24'||d.kind==='xpt2046'||d.kind==='microSD')&&selected!==s.selected){if(selected)s.model.begin();else s.model.end();}
      s.selected=selected;s.reason=isTFT(d.kind)&&s.reset!==1?'RESET nije HIGH':selected?'Odabran CS LOW':'CS HIGH · neaktivan';
    }
  }
  function transfer(bus,bytes){
    const v=solution().volts;observe(v);
    for(const s of devices)if(s.d.kind==='microSD'&&s.powered&&!s.selected&&same(gpioNet.get(bus.sck),s.d.sck)&&same(gpioNet.get(bus.mosi),s.d.mosi)&&bytes.every(b=>b===255))s.model.clocks(bytes.length*8);
    const candidates=devices.filter(s=>s.powered&&s.selected&&same(gpioNet.get(bus.sck),s.d.sck)&&same(gpioNet.get(bus.mosi),s.d.mosi));
    const out=new Uint8Array(bytes.length).fill(255);
    if(!candidates.length){if(bytes.length)log('—','transfer',bytes[0],'Nema odabranog spojenog uređaja · MISO 0xFF');return out;}
    if(candidates.length>1){for(const s of candidates)issue(s,'Istodobno aktivni CS na istoj SPI sabirnici; funkcionalni model odbija prijenos.');return out;}
    const s=candidates[0],d=s.d;
    if(d.kind==='nrf24'&&(bus.mode!==0||bus.firstbit!==0||bus.freq>10000000)){issue(s,'NRF24: mode 0, MSB prvi, najviše 10 MHz.');return out;}
    if(d.kind==='microSD'&&(bus.mode!==0||bus.firstbit!==0||s.model.idle&&bus.freq>400000)){issue(s,'microSD: mode 0, MSB prvi, inicijalizacija najviše 400 kHz.');return out;}
    if(d.kind==='xpt2046'&&(bus.mode!==0||bus.firstbit!==0||bus.freq>2000000)){issue(s,'XPT2046: podržano SPI mode 0, MSB prvi, najviše 2 MHz.');return out;}
    if(![0,3].includes(bus.mode)||bus.firstbit!==0||bus.freq>10000000){issue(s,'Podržano: SPI mode 0/3, MSB prvi, najviše 10 MHz.');return out;}
    if(pins.get(bus.sck)?.mode!=='OUT'||pins.get(bus.mosi)?.mode!=='OUT'){issue(s,'SCK i MOSI trebaju biti digitalni izlazi.');return out;}
    if(isTFT(d.kind)&&(s.reset!==1||level(d,d.dc,v)===null))return out;
    const readable=(d.kind==='nrf24'||d.kind==='bmp280_spi'||d.kind==='xpt2046'||d.kind==='microSD')&&same(gpioNet.get(bus.miso),d.miso)&&pins.get(bus.miso)?.mode==='IN';
    if((d.kind==='nrf24'||d.kind==='bmp280_spi'||d.kind==='xpt2046'||d.kind==='microSD')&&!readable)issue(s,'MISO nije spojen na ulaz pločice; primljeni bajt je 0xFF.');
    try{
      const dc=isTFT(d.kind)?level(d,d.dc,v):1;
      for(let i=0;i<bytes.length;i++){const value=s.model.byte(bytes[i],dc);if(readable)out[i]=value;count++;if(d.kind==='bmp280_spi'||d.kind==='xpt2046'||!dc||i===0)log(d.id,dc?'data':'command',bytes[i],readable?'RX 0x'+out[i].toString(16).padStart(2,'0'):'write');}
    }catch(e){issue(s,e.message);return out;}
    return out;
  }
  return {
    observe,
    config(id,sck,mosi,miso,freq,mode,firstbit){if(!freq){buses.delete(id);return 0;}if(![sck,mosi].every(p=>gpioNet.has(p))||sck===mosi||miso!==-1&&(!gpioNet.has(miso)||miso===sck||miso===mosi)||freq<1||freq>10000000||!Number.isInteger(mode)||mode<0||mode>3||![0,1].includes(firstbit))return -22;buses.set(id,{sck,mosi,miso,freq,mode,firstbit});return 0;},
    exchange(id,bytes){const bus=buses.get(id);if(!bus)return -19;const out=transfer(bus,bytes);advanceUs?.(bytes.length*8e6/bus.freq);return out;},
    transfer,
    edges(root,edge){for(const s of devices)if(s.d.kind==='xpt2046'){edge(root(s.d.irq),root(s.d.vcc),10000);if(s.powered&&s.model.irqLow)edge(root(s.d.irq),root(s.d.gnd),20);}},
    conflicts(){const out=[];for(const s of devices)if(s.d.kind==='xpt2046'&&s.powered&&s.model.irqLow)for(const [pin,p]of pins)if(same(gpioNet.get(pin),s.d.irq)&&p.mode==='OUT'&&p.value)out.push(s.d.irq);return out;},
    input(data){const card=devices.find(s=>s.d.id===data.component&&s.d.kind==='microSD');if(card){if(typeof data.sdInserted==='boolean'&&data.sdInserted!==card.d.sdInserted){card.d.sdInserted=data.sdInserted;card.model.reset();}if(typeof data.sdWriteProtected==='boolean')card.d.sdWriteProtected=data.sdWriteProtected;}const touch=devices.find(s=>s.d.id===data.component&&s.d.kind==='xpt2046');if(touch)touch.model.input(data);const s=devices.find(s=>s.d.id===data.component&&s.d.kind==='bmp280_spi');if(s)for(const [key,lo,hi]of [['temperature',-40,85],['pressure',30000,110000]])if(Number.isFinite(data[key]))s.d[key]=Math.min(hi,Math.max(lo,data[key]));},
    snapshot(v){observe(v);return {radios:Object.fromEntries(devices.filter(s=>s.d.kind==='nrf24').map(s=>[s.d.id,{...s.model.snapshot(),reason:s.reason}])),sdCards:Object.fromEntries(devices.filter(s=>s.d.kind==='microSD').map(s=>[s.d.id,{...s.model.snapshot(s.powered),reason:s.reason}])),touches:Object.fromEntries(devices.filter(s=>s.d.kind==='xpt2046').map(s=>[s.d.id,{...s.model.snapshot(s.powered),reason:s.reason}])),tfts:Object.fromEntries(devices.filter(s=>isTFT(s.d.kind)).map(s=>[s.d.id,{...s.model.snapshot(s.powered,v[s.d.bl]!==null&&v[s.d.bl]-v[s.d.gnd]>=2.5&&v[s.d.bl]-v[s.d.gnd]<=3.6),reason:s.reason}])),sensors:Object.fromEntries(devices.filter(s=>s.d.kind==='bmp280_spi').map(s=>[s.d.id,s.model.sensor.snapshot(s.powered)])),trace:trace.slice(),count,measurements:measurements.slice(),diagnostics:[...issues.values()]};}
  };
}
