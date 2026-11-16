// MIT · ESP32 MicroPython Lab · functional 12-bit differential touch profile.
// No source parsing: SPI returns raw ADC channels, calibration lives in drivers.
import {PeripheralError} from './peripherals.mjs';
export class XPT2046 {
  constructor(device){this.device=device;this.conversions=0;this.last={};this.reset();}
  reset(){this.pending=[];this.pd=0;this.last={};}
  begin(){this.pending=[];}
  end(){this.pending=[];}
  get irqLow(){return !!this.device.touchDown&&this.pd===0;}
  channels(){
    const d=this.device,down=!!d.touchDown,p=Math.max(0,Math.min(100,d.touchPressure??50));
    const cal=Array.isArray(d.rawCalibration)&&d.rawCalibration.length===4&&d.rawCalibration.every(v=>Number.isFinite(v)&&v>=0&&v<=4095)
      &&d.rawCalibration[1]-d.rawCalibration[0]>=500&&d.rawCalibration[3]-d.rawCalibration[2]>=500?d.rawCalibration:[200,3900,250,3850];
    // Explicit synthetic panel: physical 240x320, endpoint calibration is fixed.
    // Z1/Z2 are dimensionless ADC readings, never force in N or pressure in Pa.
    return {x:down?cal[0]+Math.round((d.touchX??120)*(cal[1]-cal[0])/239):0,
      y:down?cal[2]+Math.round((d.touchY??160)*(cal[3]-cal[2])/319):0,
      z1:down?Math.round(p*20):0,z2:down?4095-Math.round(p*15):4095};
  }
  byte(tx){
    const out=this.pending.length?this.pending.shift():0;
    // Byte-aligned 24-clock and overlapped 16-clock conversions. A new command
    // may share the byte carrying the previous conversion's low result bits.
    if(tx&128){
      if(this.pending.length)throw new PeripheralError('XPT2046: nova naredba prerano; koristi 16 ili 24 takta po pretvorbi.',-95);
      const channel=(tx>>4)&7;
      if(tx&12||tx&2||![1,3,4,5].includes(channel))throw new PeripheralError('XPT2046: podržani su 12-bitni diferencijalni X/Y/Z1/Z2 i PD=00/01; AUX, VBAT, temperatura i 8-bitni način nisu podržani.',-95);
      const key=({1:'y',3:'z1',4:'z2',5:'x'})[channel],value=this.channels()[key];
      this.pending=[value>>5,(value&31)<<3];this.pd=tx&3;
      this.last={channel:key,value,command:tx};this.conversions++;
    }
    return out;
  }
  input(data){
    const d=this.device;
    if(typeof data.touchDown==='boolean')d.touchDown=data.touchDown;
    for(const [key,max]of [['touchX',239],['touchY',319],['touchPressure',100]])if(Number.isFinite(data[key]))d[key]=Math.max(0,Math.min(max,Math.round(data[key])));
  }
  snapshot(powered){return {powered,down:!!this.device.touchDown,x:this.device.touchX,y:this.device.touchY,pressure:this.device.touchPressure,
    irq:powered?(this.irqLow?0:1):null,pd:this.pd,raw:this.channels(),last:{...this.last},conversions:this.conversions};}
}
