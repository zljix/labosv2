import type {Project} from '../project/model';
import type {SimulationConfig,SimulationFrame} from '../circuit/compile';
// One active media domain; only an explicit capture writes project properties.
export class SDSessionMemory {
 private key='';private state:NonNullable<SimulationFrame['sdCards']>={};
 prepare(p:Project,c?:SimulationConfig){
  const key=JSON.stringify([p.id,p.board,p.circuit.kind==='editable'?p.circuit.components.filter(d=>d.kind==='microSD').map(d=>({id:d.id,properties:d.properties})):[],p.circuit.wires]);
  if(key!==this.key){this.key=key;this.state={};}
  for(const d of c?.spiDevices??[]){const s=this.state[d.id];if(d.kind==='microSD'&&s){d.sdState=structuredClone(s.state);d.sdInserted=s.inserted;d.sdWriteProtected=s.writeProtected;}}
  return Object.fromEntries(Object.entries(this.state).map(([id,s])=>[id,{sdInserted:s.inserted,sdWriteProtected:s.writeProtected}]));
 }
 observe(frame:SimulationFrame){this.state=structuredClone(frame.sdCards??{});}
}
