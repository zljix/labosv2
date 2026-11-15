// MIT. Explicit composite module: 5 V LCD + PCF8574 and I2C level adapter.
// P0=RS, P1=R/W, P2=E, P3=backlight (HIGH), P4..7=D4..7.
// HD44780 instruction timing at nominal 270 kHz; ASCII subset + eight CGRAM glyphs.
import {PeripheralError} from './peripherals.mjs';
export class LCD1602 {
  constructor(device,now=()=>performance.now()){this.device=device;this.now=now;this.reset();}
  reset(){
    this.port=255;this.eightBit=true;this.high=null;this.readLow=false;this.readValue=0;
    this.ddram=new Uint8Array(128).fill(32);this.cgram=new Uint8Array(64);
    this.address=0;this.cgramMode=false;this.increment=true;this.entryShift=false;
    this.on=false;this.cursor=false;this.blink=false;this.shift=0;this.backlight=true;
    this.twoLine=false;this.readyAt=this.now()+40;this.busyUntil=this.readyAt;this.commands=0;this.writes=0;
  }
  onAddress(write,freq=100000){if(freq>100000)throw new PeripheralError('PCF8574: najveći podržani takt je 100 kHz.');return true;}
  nextAddress(delta=1){
    if(this.cgramMode)this.address=(this.address+delta+64)&63;
    else {
      const a=this.address;
      this.address=delta>0?(a===0x27?0x40:a===0x67?0:(a+1)&127):(a===0?0x67:a===0x40?0x27:(a-1)&127);
    }
  }
  instruction(value,rs){
    if(this.now()+1e-7<this.busyUntil)throw new PeripheralError('HD44780 je zauzet; dodaj čekanje ili pročitaj busy flag.');
    this.busyUntil=this.now()+.037;
    if(rs){
      if(this.cgramMode)this.cgram[this.address&63]=value&31;
      else {if(!(value<16||(value>=32&&value<=126)||value===255))throw new PeripheralError('LCD1602: podržan je ASCII 32–126, CGRAM 0–15 i puni znak 255; ostali CGROM znakovi nisu modelirani.');this.ddram[this.address&127]=value;}
      this.nextAddress(this.increment?1:-1);if(this.entryShift)this.shift=(this.shift+(this.increment?1:39))%40;this.writes++;return;
    }
    this.commands++;
    if(value&128){this.address=value&127;this.cgramMode=false;}
    else if(value&64){this.address=value&63;this.cgramMode=true;}
    else if(value&32){
      if(value&4)throw new PeripheralError('LCD1602: profil koristi 5 × 8 točaka; font 5 × 10 nije podržan.');
      this.eightBit=!!(value&16);this.twoLine=!!(value&8);this.high=null;
    }else if(value&16){if(value&8)this.shift=(this.shift+(value&4?39:1))%40;else this.nextAddress(value&4?1:-1);}
    else if(value&8){this.on=!!(value&4);this.cursor=!!(value&2);this.blink=!!(value&1);}
    else if(value&4){this.increment=!!(value&2);this.entryShift=!!(value&1);}
    else if(value&2){this.address=0;this.cgramMode=false;this.shift=0;this.busyUntil=this.now()+1.52;}
    else if(value&1){this.ddram.fill(32);this.address=0;this.cgramMode=false;this.shift=0;this.increment=true;this.busyUntil=this.now()+1.52;}
  }
  writeByte(value){
    const old=this.port;this.port=value&255;this.backlight=!!(value&8);
    const rs=!!(value&1),read=!!(value&2),rise=!(old&4)&&(value&4),fall=(old&4)&&!(value&4);
    if(read){
      if(rise&&!this.readLow)this.readValue=rs?(this.cgramMode?this.cgram[this.address&63]:this.ddram[this.address&127]):((this.now()<this.busyUntil?128:0)|this.address);
      if(fall){if(this.eightBit||this.readLow){if(rs)this.nextAddress(this.increment?1:-1);this.readLow=false;}else this.readLow=true;}
      return;
    }
    if(!fall)return;
    this.readLow=false;const nibble=value>>4;
    if(this.eightBit){if(rs)throw new PeripheralError('LCD1602: prije teksta inicijaliziraj 4-bitno sučelje.');this.instruction(nibble<<4,false);}
    else if(this.high===null){this.high={nibble,rs};}
    else {const h=this.high;this.high=null;if(h.rs!==rs)throw new PeripheralError('LCD1602: RS se promijenio između dvaju polubajtova.');this.instruction((h.nibble<<4)|nibble,rs);}
  }
  write(bytes){for(const b of bytes)this.writeByte(b);}
  readByte(){
    if((this.port&6)!==6)return this.port;
    const data=this.readLow?this.readValue<<4:this.readValue;
    return this.port&((data&240)|15); // Quasi-bidirectional pins must be released HIGH.
  }
  read(length){return Uint8Array.from({length},()=>this.readByte());}
  snapshot(powered){
    const visible=powered&&this.on,cells=Array.from({length:32},(_,i)=>visible&&(i<16||this.twoLine)?this.ddram[(i<16?0:64)+((i%16+this.shift)%40)]:32);
    const char=n=>n<16?'▧':n===255?'█':String.fromCharCode(n);
    return {kind:'lcd',bytes:[],powered,on:this.on,backlight:powered&&this.backlight,columns:16,rows:2,cells,
      lines:[cells.slice(0,16).map(char).join(''),cells.slice(16).map(char).join('')],cgram:Array.from(this.cgram),
      cursor:this.cursor,blink:this.blink,blinkOn:Math.floor(this.now()/500)%2===0,cursorAddress:this.address,shift:this.shift,
      cursorColumn:((this.address&63)-this.shift+40)%40,cursorRow:this.address>=64?1:0,
      busy:this.now()<this.busyUntil,commands:this.commands,writes:this.writes,port:this.port};
  }
}
