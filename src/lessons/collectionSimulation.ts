import {runtimeAsset} from '../platform/assets';
import {newProject, type Project} from '../project/model';
import {emptyCircuit,makePart,terminals} from '../circuit/model';
import {S3} from '../boards/profiles';
import {oneWireCircuit} from '../circuit/oneWireExamples';
import {analogCircuit} from '../circuit/analogExamples';
import {loadEnvironmentDrivers} from '../circuit/environmentExamples';
import {AVR_LIBRARY_FILE,libraryManifest} from '../../public/avr-contract.mjs';
import {S3_BUILD_FILE,validateArtifact} from '../../public/s3-contract.mjs';
import {ledCircuit} from './CollectionProgram';
import {practices,type ExerciseId,type Practice} from './collectionPlans';
import type {Edition} from './IotUsPilot';
import type {Track} from './IotUsCatalog';

export interface PracticeKey {track:Track;exercise:ExerciseId;edition:Edition}
export function readPractice(project:Project):PracticeKey|undefined{
  try{
    const k=JSON.parse(project.files['zbirka.json']);
    if(k.simulation===1 && (k.track==='iot'||k.track==='us') && Object.hasOwn(practices,k.exercise) &&
      k.edition===(project.language==='micropython'?'MicroPython':'Arduino'))return k;
  }catch{}
}

function setupRig(rig:Practice['rig']){
  const sensor=['temperature','calibration','compare','model','alarm','network','library'].includes(rig);
  const servo=['pwm','servo','model','alarm','network','library'].includes(rig);
  const alarm=rig==='alarm'||rig==='network';
  const led=rig==='light'||rig==='pwm'||(servo && rig!=='servo');
  const c=rig==='blink'?ledCircuit():sensor?oneWireCircuit('ds18b20'):rig==='light'?analogCircuit('temt6000'):emptyCircuit();
  const board=c.components[0],pads=terminals(board);
  const gpio=(n:number)=>pads.find(t=>t.gpio===n)!.pin;
  const ground=pads.find(t=>t.role==='ground')!.pin;
  const supply=pads.find(t=>t.role==='3v3')!.pin;
  function wire(from:string,pin:string,to:string,end:string,color='#087f8c'){
    c.wires.push({id:'cw'+c.wires.length,from:{component:from,pin},to:{component:to,pin:end},points:[],color});
  }
  function addLed(pin:number,y:number,name:string){
    const r=makePart('resistor',610,y,'r'+pin),diode=makePart('led',845,y,'led'+pin);
    r.properties.resistance=1000;r.label='1 kΩ';diode.label=name;diode.properties.color=pin===47?'red':'green';
    c.components.push(r,diode);
    wire(board.id,gpio(pin),r.id,'1');wire(r.id,'2',diode.id,'A');wire(diode.id,'K',board.id,ground,'#334155');
  }
  if(led)addLed(21,300,'LED cilja');
  if(alarm)addLed(47,435,'Alarm');
  if(servo){
    const power=makePart('powerSupply',375,605,'napajanje'),part=makePart('sg90',760,605,'servo');
    power.properties.supplyVoltage=5;c.components.push(power,part);
    wire(power.id,'+',part.id,'V+','#d04b46');wire(power.id,'-',part.id,'GND','#334155');
    wire(power.id,'-',board.id,ground,'#334155');wire(board.id,gpio(14),part.id,'SIG');
  }
  if(rig==='compare'){
    const d=makePart('dht22',810,150,'dht22'),r=makePart('resistor',800,50,'dhtPull');
    d.properties.moduleVoltage=3.3;r.properties.resistance=4700;c.components.push(d,r);
    wire(board.id,supply,d.id,'VCC','#d04b46');wire(board.id,ground,d.id,'GND','#334155');
    wire(board.id,gpio(5),d.id,'DATA');wire(r.id,'1',d.id,'VCC','#d04b46');wire(r.id,'2',d.id,'DATA');
  }
  return {c,sensor};
}

export async function createPractice(k:PracticeKey){
  const {rig}=practices[k.exercise],mp=k.edition==='MicroPython',ext=mp?'py':'ino',header=mp?'py':'h';
  async function source(path:string){
    const r=await fetch(runtimeAsset('pokusi/'+path));
    if(!r.ok)throw Error('Nije moguće učitati program simulacije: '+path);
    return r.text();
  }
  const {c,sensor}=setupRig(rig);
  let program=await source(rig+'/main.'+ext);
  const protocol=k.exercise==='V4.4'?'TCP':['V2.1','V2.2','V2.3'].includes(k.exercise)?'HTTP':'MQTT';
  if(rig==='network')program=program.replace('"HTTP"',JSON.stringify(protocol));
  const project=newProject(program,(k.track==='iot'?'IoT':'US')+' · '+k.exercise+' · '+k.edition,S3,mp?'micropython':'arduino-cpp');
  project.circuit=c;
  if(sensor){
    project.files['ulazi.'+header]=await source('common/ulazi.'+header);
    if(mp){
      Object.assign(project.files,await loadEnvironmentDrivers('ds18b20'));
      if(rig==='compare')Object.assign(project.files,await loadEnvironmentDrivers('dht22'));
    }else{
      const libs=[{name:'OneWire',version:'2.3.8'},{name:'DallasTemperature',version:'4.0.6'}];
      if(rig==='compare')libs.push({name:'DHT',version:'1.4.6'});
      project.files[AVR_LIBRARY_FILE]=libraryManifest(libs);
    }
  }
  if(['model','alarm','library','network'].includes(rig))project.files['ventil.'+header]=await source('common/ventil.'+header);
  project.files['zbirka.json']=JSON.stringify({...k,instructions:'v14',simulation:1});
  if(!mp){
    const suffix=rig==='network'&&protocol!=='HTTP'?'-'+protocol.toLowerCase():'';
    const compiled=JSON.parse(await source(rig+'/pocetni'+suffix+'.json'));
    await validateArtifact(project,compiled);
    project.files[S3_BUILD_FILE]=JSON.stringify(compiled);
  }
  return project;
}
