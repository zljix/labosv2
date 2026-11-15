import {getBoard,type BoardId,type Language} from '../boards/profiles';
import {boardOf,localTerminals} from '../circuit/model';
import {boardMetadata,forkProject,initialCode,parseProject,type Project} from './model';
import {runtimeProfile,projectTarget} from '../runtime/profiles';

export function boardChangePreview(p:Project,target:BoardId) {
  const from=getBoard(p.board.id),to=getBoard(target),c=p.circuit;
  const board=c.kind==='editable'?c.components.find(x=>x.kind==='board'):undefined;
  const attached=c.kind==='editable'&&board?c.wires.filter(w=>w.from.component===board.id||w.to.component===board.id):[];
  const pins=board?localTerminals(board):[];
  return {from,to,detachedWires:attached.map(w=>({id:w.id,pins:[w.from,w.to].filter(e=>e.component===board?.id).map(e=>pins.find(t=>t.pin===e.pin)?.label??e.pin)})),
    notes:[
      from.logicVoltage!==to.logicVoltage?`Logička razina mijenja se s ${from.logicVoltage.toLocaleString('hr-HR')} V na ${to.logicVoltage.toLocaleString('hr-HR')} V. Provjeri napajanje i razine svih modula.`:'Logička razina ostaje ista; raspored priključaka se razlikuje.',
      'Vodiči priključeni na staru pločicu odspajaju se u novoj kopiji. Ostali spojevi i sve izvorne datoteke ostaju sačuvani. Nema automatskog preslikavanja GPIO brojeva.',
      'Kôd se ne prevodi iz jednog jezika u drugi. Odabrani jezik koristi zasebnu početnu datoteku.',
      ...(to.short==='Nano classic'?['Nano A6/A7 služe samo kao analogni ulazi.']:[]),
      ...(c.kind==='stage0-fixture'?['Fiksni ESP32 pokus zamijenit će se praznim sklopom nove pločice.']:[]),
    ]};
}
export function deriveProject(p:Project,boardId:BoardId,language:Language=getBoard(boardId).languages[0]):Project {
  parseProject(p);
  if(p.board.id===boardId&&p.language===language)throw Error('Odaberi drugu pločicu ili jezik.');
  const next=forkProject(p,' — '+getBoard(boardId).short),profile=getBoard(boardId);
  next.board=boardMetadata(boardId,language);next.language=language;next.runtimeProfile=runtimeProfile(boardId,language);
  next.entryFile=language==='micropython'?'main.py':'main.ino';next.target={fqbn:projectTarget(boardId,language)};
  // Both language sources are retained. Existing content at the target entrypoint wins.
  if(!Object.hasOwn(next.files,next.entryFile))next.files[next.entryFile]=initialCode(language);
  next.settings.activeFile=next.entryFile;next.settings.example='';
  if(next.circuit.kind==='editable'){
    const board=next.circuit.components.find(p=>p.kind==='board')!;
    if(p.board.id!==boardId)next.circuit.wires=next.circuit.wires.filter(w=>w.from.component!==board.id&&w.to.component!==board.id);
    if(p.board.id!==boardId){board.x=Math.max(-10000,board.x+boardOf(board).width-profile.width);board.properties.boardProfileId=boardId;board.label=profile.short;}
  }else{
    next.circuit={kind:'editable',modelVersion:1,components:[{id:'board',kind:'board',label:profile.short,x:70,y:80,rotation:0,properties:{boardProfileId:boardId}}],wires:[]};
  }
  return parseProject(next);
}
