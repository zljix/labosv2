import type {RuntimeHandle} from './adapter';
import type {SimulationConfig} from '../circuit/compile';
let serial=0;
export class AVRSession implements RuntimeHandle {
  readonly id=++serial;private stopped=false;private worker:Worker;
  constructor(factory:()=>Worker,hex:string,circuit:SimulationConfig,adcChannels:number,observe:(event:any)=>void,staticRamBytes=0,prototypeEEPROM=false){
    this.worker=factory();
    this.worker.onmessage=({data})=>{if(!this.stopped&&data.session===this.id)observe(data);};
    this.worker.onerror=e=>{if(!this.stopped)observe({type:'error',message:e.message||'AVR Worker nije dostupan.'});};
    this.worker.postMessage({type:'run',session:this.id,hex,circuit,adcChannels,staticRamBytes,prototypeEEPROM});
  }
  input(data:Record<string,unknown>){if(!this.stopped)this.worker.postMessage({...data,type:'input',session:this.id});}
  stop(){if(this.stopped)return;this.stopped=true;this.worker.terminate();}
}
