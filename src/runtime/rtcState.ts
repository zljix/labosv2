import type {Project} from '../project/model';
import type {SimulationConfig,SimulationFrame} from '../circuit/compile';
// Bounded, one-project volatile battery domain. Stop freezes the last frame.
// Export/reopen only uses explicitly captured project properties.rtcState.
export class RTCSessionMemory {
 private key='';private state:NonNullable<SimulationFrame['rtcDevices']>={};
 prepare(p:Project,c?:SimulationConfig){
  const key=JSON.stringify([p.id,p.board,p.circuit.kind==='editable'?p.circuit.components.filter(d=>d.kind==='ds1302').map(d=>({id:d.id,properties:d.properties})):[],p.circuit.wires]);
  if(key!==this.key){this.key=key;this.state={};}
  for(const d of c?.rtcDevices??[]){const s=this.state[d.id];if(s){d.rtcState=structuredClone(s.state);d.rtcMainPower=s.rtcMainPower;}}
  return Object.fromEntries(Object.entries(this.state).map(([id,s])=>[id,{rtcMainPower:s.rtcMainPower}]));
 }
 observe(frame:SimulationFrame){this.state=structuredClone(frame.rtcDevices??{});}
}
