// MIT · ESP32 MicroPython Lab. Bounded 4-wire ILI9341, physical 240 x 320 RAM.
// The model receives SPI bytes only. Text/geometry belong to the visible driver.
import {PeripheralError} from './peripherals.mjs';
const fail = message => {throw new PeripheralError('ILI9341: '+message,-95);};
const counts = new Map([[0x2a,4],[0x2b,4],[0x36,1],[0x3a,1],
  [0x26,1],[0xb1,2],[0xb4,1],[0xb6,3],[0xc0,1],[0xc1,1],[0xc5,2],[0xc7,1],[0xe0,15],[0xe1,15]]);
const rotations = new Map([[0x40,0],[0x20,1],[0x80,2],[0xe0,3]]);
export class ILI9341 {
  constructor(now){this.now=now;this.ram=new Uint16Array(240*320);this.written=0;this.reset();}
  reset(){
    this.on=false;this.sleep=true;this.inverse=false;this.madctl=0;this.format=0x66;
    this.cmd=-1;this.args=[];this.hi=null;this.x0=0;this.x1=239;this.y0=0;this.y1=319;
    this.x=0;this.y=0;this.readyAt=this.now()+120;
  }
  command(cmd){
    if(this.now()+1e-6<this.readyAt)fail('pričekaj 120 ms nakon napajanja/resetiranja ili izlaska iz sleep načina.');
    this.cmd=cmd;this.args=[];this.hi=null;
    if(cmd===0x01){this.reset();return;}
    if(cmd===0x10){this.sleep=true;return;}
    if(cmd===0x11){this.sleep=false;this.readyAt=this.now()+120;return;}
    if(cmd===0x28||cmd===0x29){this.on=cmd===0x29;return;}
    if(cmd===0x20||cmd===0x21){this.inverse=cmd===0x21;return;}
    if(cmd===0x2c){this.x=this.x0;this.y=this.y0;return;}
    if(cmd===0x00||cmd===0x13||counts.has(cmd))return;
    fail('naredba 0x'+cmd.toString(16)+' nije podržana (bez čitanja, scrolla, partial display moda i 9-bitnog SPI-ja).');
  }
  data(byte){
    if(this.now()+1e-6<this.readyAt)fail('podatkovni upis tijekom čekanja nakon resetiranja/sleep izlaza nije podržan.');
    if(this.cmd===0x2c){
      if(this.format!==0x55)fail('podržan je RGB565, COLMOD=0x55.');
      const r=rotations.get(this.madctl&0xf7);
      if(r===undefined)fail('najprije odaberi jednu od četiri deklarirane MADCTL rotacije.');
      const width=r%2?320:240,height=r%2?240:320;
      if(this.x1>=width||this.y1>=height)fail('ponovno postavi prozor nakon promjene rotacije.');
      if(this.hi===null){this.hi=byte;return;}
      let color=(this.hi<<8)|byte;this.hi=null;
      let x=this.x,y=this.y;
      if(r===1){x=239-this.y;y=this.x;}
      else if(r===2){x=239-this.x;y=319-this.y;}
      else if(r===3){x=this.y;y=319-this.x;}
      if(!(this.madctl&8))color=((color&31)<<11)|(color&0x7e0)|((color>>11)&31);
      this.ram[y*240+x]=color;this.written++;
      if(++this.x>this.x1){this.x=this.x0;if(++this.y>this.y1)this.y=this.y0;}
      return;
    }
    const count=counts.get(this.cmd);
    if(!count||this.args.length>=count)fail('podatak nema odgovarajuću naredbu.');
    this.args.push(byte);if(this.args.length!==count)return;
    const a=this.args;
    if(this.cmd===0x2a||this.cmd===0x2b){
      const lo=a[0]*256+a[1],hi=a[2]*256+a[3];
      const max=(this.madctl&32)?(this.cmd===0x2a?319:239):(this.cmd===0x2a?239:319);
      if(lo>hi||hi>max)fail('prozor je izvan adresne geometrije 240 × 320 (320 × 240 nakon zamjene osi).');
      if(this.cmd===0x2a){this.x0=lo;this.x1=hi;}else{this.y0=lo;this.y1=hi;}
    }
    if(this.cmd===0x36){
      if(!rotations.has(a[0]&0xf7))fail('deklarirane su rotacije 48/28/88/E8, uz promjenjivi BGR; drugi MADCTL bitovi nisu podržani.');
      this.madctl=a[0];
    }
    if(this.cmd===0x3a){this.format=a[0];if(a[0]!==0x55)fail('podržan je samo 16-bitni RGB565 (0x55).');}
    // Declared analog/gamma setup parameters are accepted, not simulated.
  }
  byte(value,dc){if(dc)this.data(value);else this.command(value);return 255;}
  snapshot(powered,backlight){
    const visible=powered&&backlight&&this.on&&!this.sleep;
    return {kind:'tft',controller:'ILI9341',width:240,height:320,powered,backlight,on:this.on,sleep:this.sleep,
      madctl:this.madctl,format:this.format,written:this.written,window:[this.x0,this.y0,this.x1,this.y1],
      pixels:Array.from(this.ram,c=>visible?(this.inverse?c^65535:c):0)};
  }
}
