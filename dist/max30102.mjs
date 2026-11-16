// MIT. MAX30102 polling profile. Raw RED/IR words pass through I2C/FIFO.
// The source is synthetic: no human physiology, SpO2 or calibrated optics.
import {PeripheralError} from './peripherals.mjs';
const reject = message => { throw new PeripheralError('MAX30102: '+message, -95); };
const rates=[50,100,200,400,800,1000,1600,3200];
const averages=[1,2,4,8,16,32,32,32];
export const OPTICAL_DEFAULTS=Object.freeze({opticalRate:72,opticalAmplitude:6000,opticalOffset:80000,opticalNoise:0,opticalContact:true});
export const OPTICAL_RANGES=Object.freeze({opticalRate:[40,180],opticalAmplitude:[0,30000],opticalOffset:[1000,160000],opticalNoise:[0,10000]});
export class MAX30102 {
  constructor(device,now){this.device=device;this.now=now;this.reset(true);}
  reset(power=true){
    // A software reset does not erase evidence of the completed bus transfers.
    // Power-on starts a new device lifetime; the ledger never chooses data.
    if(power||!this.transfers){this.transfers=[];this.transferSequence=0;this.transactionSequence=0;this.pending=null;}
    this.reg=new Uint8Array(256);this.reg[0]=power?1:0;
    this.pointer=0;this.first=true;this.count=0;this.sample=0;this.dropped=0;
    this.bank=Array(32).fill(null);this.latch=null;this.byteIndex=0;
    this.phase=0;this.noisePhase=0;this.averageCount=0;this.sums=[0,0];
    this.nextAt=Infinity;this.resetUntil=0;this.history=[];this.last=null;
  }
  get mode(){return this.reg[9]&7;}
  get rate(){return rates[(this.reg[10]>>2)&7];}
  get average(){return averages[this.reg[8]>>5];}
  get active(){return [2,3].includes(this.mode)&&!(this.reg[9]&192);}
  validTiming(mode=this.mode,config=this.reg[10]){
    if(![2,3].includes(mode))return true;
    // Datasheet Tables 11/12: reject invalid combinations explicitly.
    const max=(mode===3?[1600,800,400,400]:[3200,1600,1000,1000])[config&3];
    return rates[(config>>2)&7]<=max;
  }
  restartSampling(){this.nextAt=this.active?this.now()+1000/this.rate:Infinity;this.averageCount=0;this.sums=[0,0];}
  update(){
    const now=this.now();
    if(this.resetUntil&&now>=this.resetUntil){this.reg[9]=0;this.resetUntil=0;}
    if(!this.active||!Number.isFinite(this.nextAt)||now<this.nextAt)return;
    const period=1000/this.rate,step=2*Math.PI*(this.device.opticalRate??72)/60/this.rate;
    let remaining=Math.floor((now-this.nextAt+1e-8)/period)+1;
    while(remaining>0){
      // A stalled reader must not cause unbounded catch-up work. Full FIFO
      // rejects whole averaged groups; the oscillator still advances.
      if(this.count===32&&!this.averageCount){
        const groups=Math.floor(remaining/this.average),raw=groups*this.average;
        if(groups){this.reg[5]=Math.min(31,this.reg[5]+groups);this.sample+=groups;this.dropped+=groups;this.phase=(this.phase+step*raw)%(2*Math.PI);this.noisePhase=(this.noisePhase+1.61803398875*raw)%(2*Math.PI);this.nextAt+=period*raw;remaining-=raw;continue;}
      }
      const d=this.device,contact=d.opticalContact??true;
      const wave=Math.sin(this.phase)+.2*Math.sin(2*this.phase);
      const noise=(d.opticalNoise??0)*Math.sin(this.noisePhase);
      const dc=contact?(d.opticalOffset??80000):500,ac=contact?(d.opticalAmplitude??6000):0;
      const gain=[2,1,.5,.25][(this.reg[10]>>5)&3];
      const raw=[(.85*dc+.7*ac*wave+noise)*this.reg[12]/31*gain,(dc+ac*wave+noise)*this.reg[13]/31*gain];
      for(let i=0;i<2;i++)this.sums[i]+=Math.max(0,Math.min(262143,raw[i]));
      this.phase=(this.phase+step)%(2*Math.PI);this.noisePhase=(this.noisePhase+1.61803398875)%(2*Math.PI);
      const at=this.nextAt;this.nextAt+=period;remaining--;
      if(++this.averageCount!==this.average)continue;
      const mask=~((1<<(3-(this.reg[10]&3)))-1);
      const red=Math.round(this.sums[0]/this.average)&mask,ir=this.mode===3?Math.round(this.sums[1]/this.average)&mask:null;
      this.averageCount=0;this.sums=[0,0];this.sample++;
      if(this.count===32){this.reg[5]=Math.min(31,this.reg[5]+1);this.dropped++;continue;}
      this.bank[this.reg[4]]={index:this.sample,timeMs:at,red,ir};this.reg[4]=(this.reg[4]+1)&31;this.count++;
      this.reg[0]|=64;if(this.count>=32-(this.reg[8]&15))this.reg[0]|=128;
    }
  }
  onAddress(write,freq=100000){
    if(freq>400000)reject('najviše 400 kHz.');
    this.update();this.first=true;
    this.pending={transaction:++this.transactionSequence,operation:write?'write':'read',register:write?null:this.pointer,bytes:[],length:0};
    if(!write){this.latch=null;this.byteIndex=0;}
    return true;
  }
  writeByte(byte){
    if(this.first){this.pointer=byte;this.first=false;if(this.pending)this.pending.register=byte;return;}
    const reg=this.pointer;this.set(reg,byte);
    if(this.pending){this.pending.length++;if(this.pending.bytes.length<192)this.pending.bytes.push(byte);}
    if(reg!==7&&reg!==255)this.pointer=(reg+1)&255;
  }
  write(bytes){for(const byte of bytes)this.writeByte(byte);}
  set(reg,value){
    this.update();
    if(this.reg[9]&64)reject('pričekaj završetak resetiranja.');
    if(reg===9){
      if(value&64){this.reset(false);this.reg[9]=64;this.resetUntil=this.now()+1;return;}
      if(value&56||![0,2,3].includes(value&7))reject('podržani su idle, RED (2) i RED+IR (3); multi-LED nije uključen.');
      if(!this.validTiming(value&7))reject('nevaljana kombinacija frekvencije i širine impulsa.');
      this.reg[9]=value;this.restartSampling();return;
    }
    if([4,5,6].includes(reg)){
      this.reg[reg]=value&31;
      if(reg!==5){this.count=(this.reg[4]-this.reg[6]+32)&31;this.latch=null;this.byteIndex=0;}
      return;
    }
    if(reg===8){
      if(value&16)reject('ovaj polling profil podržava zaustavljanje FIFO-a kad je pun; rollover nije uključen.');
      this.reg[8]=value;this.restartSampling();return;
    }
    if(reg===10){if(value&128||!this.validTiming(this.mode,value))reject('nevaljana konfiguracija ADC-a/frekvencije/impulsa.');this.reg[10]=value;this.restartSampling();return;}
    if(reg===12||reg===13){this.reg[reg]=value;return;}
    if(reg===2){if(value&31)reject('rezervirani bit prekida.');this.reg[reg]=value;return;}
    if(reg===3&&value===0){this.reg[reg]=0;return;}
    reject('registar 0x'+reg.toString(16)+' je samo za čitanje ili izvan profila (INT, temperatura, multi-LED).');
  }
  readByte(){
    this.update();const reg=this.pointer;
    let value;
    if(reg===7)value=this.fifoByte();
    else if(reg===255)value=0x15;
    else if(reg===254)value=3; // Explicit synthetic revision for this Lab profile.
    else if([0,1,2,3,4,5,6,8,9,10,12,13].includes(reg))value=this.reg[reg];
    else reject('čitanje nepodržanog registra 0x'+reg.toString(16)+'.');
    if(reg===0||reg===1)this.reg[reg]=0;
    if(this.pending){this.pending.length++;if(this.pending.bytes.length<192)this.pending.bytes.push(value);}
    if(reg!==7&&reg!==255)this.pointer=(reg+1)&255;
    return value;
  }
  fifoByte(){
    this.reg[0]&=~64;
    if(!this.latch){
      if(!this.count)return 0; // Lab empty-read value, not a valid sample.
      const data=this.bank[this.reg[6]];
      if(!data)return 0;
      this.latch={...data};this.byteIndex=0;
      // Datasheet: RD_PTR advances at the FIRST byte of a sample.
      this.reg[6]=(this.reg[6]+1)&31;this.count--;this.reg[5]=0;
    }
    const value=this.byteIndex<3?this.latch.red:this.latch.ir??0;
    const byte=(value>>(16-8*(this.byteIndex%3)))&255;
    if(++this.byteIndex===(this.latch.ir===null?3:6)){
      this.last={...this.latch,readTimeMs:this.now(),transaction:this.pending?.transaction??null};this.history.push(this.last);if(this.history.length>128)this.history.shift();this.latch=null;this.byteIndex=0;
    }
    return byte;
  }
  read(length){return Uint8Array.from({length},()=>this.readByte());}
  end(write=true,success=true,stop=true){
    const p=this.pending;
    // Empty polling reads are frequent; retain full/shutdown status and FIFO
    // payloads so a batch draining 32 words cannot evict its full-FIFO proof.
    const routine=p?.operation==='read'&&[0,4,5].includes(p.register)&&this.count!==32
      &&!(this.reg[9]&128)&&(p.register!==5||p.bytes[0]===0);
    if(success&&p&&p.length&&!routine){
      this.transfers.push({...p,sequence:++this.transferSequence,timeMs:this.now(),mode:this.mode,
        shutdown:!!(this.reg[9]&128),count:this.count,generated:this.sample,dropped:this.dropped});
      if(this.transfers.length>64)this.transfers.shift();
    }
    this.pending=null;
    if(!write&&stop){this.latch=null;this.byteIndex=0;}
  }
  snapshot(powered){
    if(powered)this.update();
    return {powered,mode:this.mode,shutdown:!!(this.reg[9]&128),resetting:!!(this.reg[9]&64),sampleRate:this.rate,average:this.average,effectiveRate:this.rate/this.average,count:this.count,writePointer:this.reg[4],readPointer:this.reg[6],overflow:this.reg[5],dropped:this.dropped,generated:this.sample,status:this.reg[0],ledRed:this.reg[12],ledIR:this.reg[13],resolution:15+(this.reg[10]&3),last:this.last,readings:this.history.slice(),transfers:this.transfers.slice(),reason:!powered?'Bez napajanja':this.reg[9]&64?'Resetiranje':this.reg[9]&128?'Shutdown':!this.active?'Konfiguriraj programom':this.count===32?'FIFO pun: novi uzorci se gube':'Sintetski RED/IR · polling'};
  }
}
