import type {SimulationConfig} from '../circuit/compile';
import {createCircuitHost} from '../../public/circuit-host.mjs';
import {i2cLevelRoute} from '../../public/i2c-level-shifter.mjs';
type Host=ReturnType<typeof createCircuitHost>;

/** A slave on actual GPIO edges: START/STOP, MSB first, ninth-bit ACK and reads.
 * Candidate wires come only from compiled electrical nets, never sketch text.
 * Single master, no arbitration or clock stretching in this release.
 */
class SoftwareBus {
  private scl=1;private sda=1;private active=false;private stage='rx';
  private bits=0;private value=0;private address=true;private reading=false;private ack=false;
  private byte=255;private masterAck=false;
  constructor(readonly id:number,readonly dataPin:number,readonly clockPin:number,private dataNet:number,private clockNet:number,private host:Host){}
  private level(net:number){const v=this.host.sample().volts[net];return v===null?-1:v>=3.75?1:v<=1.25?0:-1;}
  private drive(low:boolean){this.host.busDrive('sw-i2c-'+this.id,this.dataPin,low);}
  private transmit(){this.byte=this.host.i2cStreamRead(this.id);this.bits=0;this.stage='tx';this.drive(!(this.byte&128));}
  observe(disabled:boolean){
    if(disabled){this.drive(false);this.active=false;this.scl=this.level(this.clockNet);this.sda=this.level(this.dataNet);return;}
    const scl=this.level(this.clockNet),sda=this.level(this.dataNet);
    if(scl<0||sda<0){this.active=false;this.drive(false);this.scl=scl;this.sda=sda;return;}
    if(this.scl===1&&scl===1&&this.sda===1&&sda===0){
      if(this.active)this.host.i2cStreamStop(this.id,false);
      this.active=true;this.stage='rx';this.bits=0;this.value=0;this.address=true;this.reading=false;
    }else if(this.scl===1&&scl===1&&this.sda===0&&sda===1){
      if(this.active)this.host.i2cStreamStop(this.id);this.active=false;this.drive(false);
    }else if(this.active&&this.scl!==scl){
      if(scl===1){
        if(this.stage==='rx'){
          this.value=(this.value<<1)|sda;
          if(++this.bits===8){
            if(this.address){this.reading=!!(this.value&1);this.ack=this.host.i2cStreamBegin(this.id,this.dataPin,this.clockPin,this.value>>1,!this.reading);this.address=false;}
            else this.ack=this.host.i2cStreamWrite(this.id,this.value);
            this.stage='ack-pending';
          }
        }else if(this.stage==='ack')this.stage='ack-end';
        else if(this.stage==='tx'){if(++this.bits===8)this.stage='tx-end';}
        else if(this.stage==='master-ack'){this.masterAck=sda===0;this.stage='master-ack-end';}
      }else{
        if(this.stage==='ack-pending'){this.drive(this.ack);this.stage='ack';}
        else if(this.stage==='ack-end'){
          this.drive(false);
          if(!this.ack)this.stage='wait';
          else if(this.reading)this.transmit();
          else {this.stage='rx';this.bits=0;this.value=0;}
        }else if(this.stage==='tx')this.drive(!(this.byte&(128>>this.bits)));
        else if(this.stage==='tx-end'){this.drive(false);this.stage='master-ack';}
        else if(this.stage==='master-ack-end'){if(this.masterAck)this.transmit();else this.stage='wait';}
      }
    }
    // Store the resolved level after slave drive; do not treat our ACK as START.
    this.scl=this.level(this.clockNet);this.sda=this.level(this.dataNet);
  }
}
export class AVRSoftwareI2C {
  private buses:SoftwareBus[]=[];
  constructor(config:SimulationConfig,host:Host){
    const seen=new Set<string>();
    for(const d of config.i2cDevices){
      const pairs=[[d.sda,d.scl],...(config.i2cLevelShifters??[]).flatMap(s=>[s.low,s.high])];
      for(const pair of pairs){
        if(!i2cLevelRoute(config.i2cLevelShifters,pair,[d.sda,d.scl]))continue;
        const sda=config.gpios.find(g=>g.net===pair[0]&&g.pin<20),scl=config.gpios.find(g=>g.net===pair[1]&&g.pin<20);
        const key=pair.join(':');if(!sda||!scl||sda.pin===scl.pin||seen.has(key))continue;seen.add(key);
        this.buses.push(new SoftwareBus(this.buses.length+1,sda.pin,scl.pin,pair[0],pair[1],host));
      }
    }
  }
  observe(twiEnabled:boolean){for(const b of this.buses)b.observe(twiEnabled&&b.dataPin===18&&b.clockPin===19);}
}
