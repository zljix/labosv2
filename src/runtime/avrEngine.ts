import {CPU,avrInstruction,AVRIOPort,PinState,portBConfig,portCConfig,portDConfig,AVRTimer,timer0Config,timer1Config,timer2Config,AVRADC,adcConfig,AVRUSART,usart0Config,AVRTWI,twiConfig,AVRSPI,spiConfig} from 'avr8js';
import {createCircuitHost} from '../../public/circuit-host.mjs';
import {parseHex} from '../../public/avr-contract.mjs';
import type {SimulationConfig,SimulationFrame} from '../circuit/compile';
import {AVRSoftwareI2C} from './avrI2C';

export const AVR_HZ=16000000;
/** ATmega328P registers and instructions drive the shared electrical model. */
export class AVREngine {
  readonly cpu:CPU;readonly ports:AVRIOPort[];readonly adc:AVRADC;readonly usart:AVRUSART;readonly twi:AVRTWI;readonly spi:AVRSPI;
  readonly host:ReturnType<typeof createCircuitHost>;
  private hasLeds=false;private softwareI2C:AVRSoftwareI2C;private staticEnd=0;private lowestSP=2303;
  private timedEdge=Infinity;
  private syncing=false;private previousCycle=0;private frameCycle=0;private frameStart=0;
  private ledArea:Record<string,number>={};private highArea=new Float64Array(20);
  private edges=new Map<number,{level:boolean;rise:number;period:number}>();
  private rx:number[]=[];private serial:number[]=[];private decoder=new TextDecoder();private faults:string[]=[];
  readonly busTrace:{kind:string;operation:string;value?:number;result?:string;timeUs:number}[]=[];
  constructor(hex:string,config:SimulationConfig,private emit:(event:any)=>void,adcChannels=6,staticRamBytes=0,options:Record<string,any>={}){
    const loaded=parseHex(hex);this.cpu=new CPU(new Uint16Array(loaded.bytes.buffer),2048);
    this.staticEnd=256+staticRamBytes;this.hasLeds=!!config.leds.length;
    this.ports=[new AVRIOPort(this.cpu,portDConfig),new AVRIOPort(this.cpu,portBConfig),new AVRIOPort(this.cpu,portCConfig)];
    new AVRTimer(this.cpu,timer0Config);new AVRTimer(this.cpu,timer1Config);new AVRTimer(this.cpu,timer2Config);
    this.host=createCircuitHost((event:any)=>this.hostEvent(event),{circuit:config,logicVoltage:5,adcPins:Array.from({length:adcChannels},(_,i)=>i+14),manualPublish:true,nowUs:()=>this.cpu.cycles/16,...options});
    this.adc=new AVRADC(this.cpu,adcConfig);this.adc.avcc=5;this.adc.aref=5;
    const adcRead=this.adc.onADCRead;
    this.adc.onADCRead=input=>{this.syncAnalog(adcChannels);if(input.type===0)this.host.adc(input.channel+14);adcRead(input);};
    this.usart=new AVRUSART(this.cpu,usart0Config,AVR_HZ);
    this.usart.onByteTransmit=value=>{this.serial.push(value);if(this.serial.length>=4096)this.flushSerial();};
    this.twi=new AVRTWI(this.cpu,twiConfig,AVR_HZ);
    this.twi.eventHandler={
      start:repeated=>{if(repeated)this.host.i2cStreamStop(0,false);this.trace('TWI',repeated?'repeated-start':'start');this.completeTwi(()=>this.twi.completeStart(),1);},
      stop:()=>{this.host.i2cStreamStop(0);this.trace('TWI','stop');this.completeTwi(()=>this.twi.completeStop(),1);},
      connectToSlave:(addr,write)=>{const ack=this.host.i2cStreamBegin(0,18,19,addr,write,this.twi.sclFrequency);this.trace('TWI',write?'address-write':'address-read',addr,ack?'ACK':'NACK');this.completeTwi(()=>this.twi.completeConnect(ack));},
      writeByte:value=>{const ack=this.host.i2cStreamWrite(0,value);this.trace('TWI','write',value,ack?'ACK':'NACK');this.completeTwi(()=>this.twi.completeWrite(ack));},
      readByte:()=>{const value=this.host.i2cStreamRead(0);this.trace('TWI','read',value);this.completeTwi(()=>this.twi.completeRead(value));},
    };
    this.softwareI2C=new AVRSoftwareI2C(config,this.host);
    this.spi=new AVRSPI(this.cpu,spiConfig,AVR_HZ);
    this.spi.onByte=value=>{
      const control=this.cpu.data[spiConfig.SPCR],mode=((control&8)?2:0)|((control&4)?1:0);
      const result=this.spi.isMaster?this.host.spiTransfer({sck:13,mosi:11,miso:12,freq:this.spi.spiFrequency,mode,firstbit:this.spi.dataOrder==='msbFirst'?0:1},Uint8Array.of(value))[0]:255;
      this.trace('SPI','transfer',value,'MISO=0x'+result.toString(16).padStart(2,'0'));
      this.cpu.addClockEvent(()=>this.spi.completeTransfer(result),this.spi.transferCycles);
    };
    for(const port of this.ports)port.addListener(()=>this.syncGPIO());
    this.syncGPIO();this.syncAnalog(adcChannels);
  }
  private completeTwi(done:()=>void,bits=9){this.cpu.addClockEvent(done,Math.max(1,Math.ceil(AVR_HZ*bits/this.twi.sclFrequency)));}
  private pin(n:number){return {port:this.ports[n<8?0:n<14?1:2],bit:n<8?n:n<14?n-8:n-14};}
  private trace(kind:string,operation:string,value?:number,result?:string){this.busTrace.push({kind,operation,value,result,timeUs:this.cpu.cycles/16});if(this.busTrace.length>100)this.busTrace.shift();}
  private integrate(){
    const cycles=this.cpu.cycles-this.previousCycle;if(!cycles)return;
    if(this.hasLeds)for(const [id,current]of Object.entries(this.host.sample().currents))this.ledArea[id]=(this.ledArea[id]??0)+(current as number)*cycles;
    for(let n=0;n<20;n++)if(this.edges.get(n)?.level)this.highArea[n]+=cycles;
    this.previousCycle=this.cpu.cycles;
  }
  private syncGPIO(){
    if(this.syncing)return;this.syncing=true;
    try {
      this.integrate();
      for(let n=0;n<20;n++){
        const {port,bit}=this.pin(n),state=port.pinState(bit),output=state===PinState.High||state===PinState.Low;
        this.host.mode(n,output?1:0,state===PinState.InputPullUp?1:0,state===PinState.High?1:0);
        const e=this.edges.get(n),level=state===PinState.High;
        if(!e)this.edges.set(n,{level,rise:level?this.cpu.cycles:0,period:0});
        else if(e.level!==level){if(level){e.period=e.rise?this.cpu.cycles-e.rise:0;e.rise=this.cpu.cycles;}else if(e.period)this.host.capturePulse(n,(this.cpu.cycles-e.rise)/16,e.period/16);e.level=level;}
      }
      this.softwareI2C.observe(!!(this.cpu.data[twiConfig.TWCR]&4));
      if(this.host.electricalStatus()<0){this.frame();throw Error('Sukob GPIO izlaza ili napajanja. Zaustavljeno; provjeri sklop i program.');}
      this.syncInputs();this.scheduleTimed();
    } finally {this.syncing=false;}
  }
  private scheduleTimed(){
    const edge=this.host.nextTimedEdgeUs();if(edge===this.timedEdge)return;this.timedEdge=edge;if(!Number.isFinite(edge))return;
    this.cpu.addClockEvent(()=>{if(this.timedEdge!==edge)return;this.timedEdge=Infinity;this.integrate();this.host.timedStep();this.syncInputs();this.scheduleTimed();},Math.max(1,Math.ceil(edge*16-this.cpu.cycles)));
  }
  private syncInputs(){
    for(let n=0;n<20;n++){
      const {port,bit}=this.pin(n),state=port.pinState(bit);
      if(state===PinState.Input||state===PinState.InputPullUp){const level=this.host.read(n,state===PinState.InputPullUp?1:0);port.setPin(bit,level===1);}
    }
  }
  private syncAnalog(channels:number){for(let n=0;n<channels;n++){const v=this.host.adc(n+14,false);this.adc.channelValues[n]=v>=0?v/1000000:0;}}
  private service(){if(this.rx.length&&this.usart.rxEnable&&!this.usart.rxBusy){if(this.usart.writeByte(this.rx[0]))this.rx.shift();}}
  runCycles(count:number){
    const target=this.cpu.cycles+count;
    while(this.cpu.cycles<target){const end=Math.min(target,this.cpu.cycles+4096);while(this.cpu.cycles<end){avrInstruction(this.cpu);this.cpu.tick();this.lowestSP=Math.min(this.lowestSP,this.cpu.SP);if(this.cpu.SP<this.staticEnd)throw Error('SRAM: stog je dosegnuo statičke podatke. Smanji memorijski spremnik i lokalne varijable.');}this.service();if(this.faults.length)throw Error(this.faults[0]);}
  }
  input(data:Record<string,any>){
    this.integrate();
    if(typeof data.serial==='string'){
      const bytes=new TextEncoder().encode(data.serial);if(this.rx.length+bytes.length>256)throw Error('Serijski ulaz je pun (najviše 256 bajtova na čekanju).');this.rx.push(...bytes);
    }else{this.host.input(data);this.syncGPIO();}
  }
  private flushSerial(){if(this.serial.length){this.emit({type:'console',text:this.decoder.decode(Uint8Array.from(this.serial),{stream:true})});this.serial=[];}}
  private hostEvent(event:any){
    if(event.type==='error'){this.faults.push(event.message);this.emit(event);return;}
    if(event.type!=='simulation')return;
    const elapsed=Math.max(1,this.frameCycle-this.frameStart);
    for(const [id,led]of Object.entries(event.leds) as [string,{currentMa:number;brightness:number}][]){
      const current=(this.ledArea[id]??0)/elapsed;led.currentMa=+current.toFixed(4);led.brightness=Math.max(0,Math.min(1,current/5));
    }
    for(const [id,gpio]of Object.entries(event.gpios) as [string,SimulationFrame['gpios'][string]][]){
      const n=Number(id),edge=this.edges.get(n);
      const timerControl=n===3||n===11?this.cpu.data[0xb0]:n===5||n===6?this.cpu.data[0x44]:n===9||n===10?this.cpu.data[0x80]:0;
      const shift=n===3||n===5||n===10?4:6;
      if(gpio.mode==='OUT'&&((timerControl>>shift)&3)&&[3,5,6,9,10,11].includes(n)){
        gpio.mode='PWM';gpio.duty=Math.round(this.highArea[n]/elapsed*65535);if(edge?.period)gpio.freq=AVR_HZ/edge.period;
      }
    }
    event.avr={cycles:this.cpu.cycles,clockHz:AVR_HZ,uartBaud:this.usart.baudRate,rxPending:this.rx.length,busTrace:this.busTrace.slice(),memory:{staticBytes:this.staticEnd-256,lowestSP:this.lowestSP,minFreeToStatic:Math.max(0,this.lowestSP-this.staticEnd+1)}};
    this.emit(event);
  }
  frame(){this.integrate();this.frameCycle=this.cpu.cycles;this.host.flush();this.flushSerial();this.frameStart=this.cpu.cycles;this.ledArea={};this.highArea.fill(0);}
  dispose(){this.host.dispose();this.rx=[];}
}
