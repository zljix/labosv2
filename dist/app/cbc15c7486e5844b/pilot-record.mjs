// MIT. A record contains manually entered observations, never certified evidence.
export const pilotChecks=['concepts','circuit','code','feedback','stop','recovery','submission','review','keyboard','offline'];
const limits={participant:80,date:10,appVersion:80,computer:300,browser:200,minutes:10,assistance:6000,issues:6000,measurements:6000,conclusion:6000};
const choices={recordKind:['unselected','pupil','device','development'],input:['Miš i tipkovnica','Samo tipkovnica','Dodir'],target:['micropython','s3-cpp','uno','nano'],peer:['none','micropython','s3-cpp','uno','nano'],outcome:['unconfirmed','independent','assisted','blocked'],offlineMethod:['untried','pwa','local-http']};
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function pilotObservations(input,lessons){
 if(!object(input))throw Error('Zapis nema objekt opažanja.');
 const result={};
 for(const [key,max]of Object.entries(limits)){
  const value=input[key]??'';
  if(typeof value!=='string'||value.length>max)throw Error('Nevaljano polje: '+key+'.');
  result[key]=value;
 }
 for(const [key,values]of Object.entries(choices)){
  const value=input[key]??(key==='recordKind'?'unselected':key==='offlineMethod'?'untried':undefined);
  if(!values.includes(value))throw Error('Nepodržana vrijednost: '+key+'.');
  result[key]=value;
 }
 if(typeof input.lesson!=='string'||!lessons.includes(input.lesson))throw Error('Nepoznata vježba ili varijanta.');
 result.lesson=input.lesson;
 for(const key of pilotChecks){if(input[key]!==undefined&&typeof input[key]!=='boolean')throw Error('Nevaljana potvrda koraka: '+key+'.');result[key]=input[key]??false;}
 if(result.date&&(!/^\d{4}-\d{2}-\d{2}$/.test(result.date)||!Number.isFinite(Date.parse(result.date))||new Date(result.date).toISOString().slice(0,10)!==result.date))throw Error('Datum nije valjan kalendarski dan.');
 if(result.minutes&&(!/^\d+(\.\d+)?$/.test(result.minutes)||Number(result.minutes)>1000))throw Error('Trajanje mora biti od 0 do 1000 minuta.');
 return result;
}
export function pilotProblems(data){
 if(data.outcome==='unconfirmed')return [];
 const errors=[];
 if(data.recordKind==='unselected')errors.push('Odaberi je li zapis učenički pilot, provjera uređaja ili razvojni pregled.');
 for(const [key,label]of [['date','datum'],['appVersion','inačicu otvorene aplikacije'],['computer','računalo i OS'],['browser','preglednik i verziju'],['minutes','trajanje'],['conclusion','zaključak']])if(!data[key].trim())errors.push('Upiši '+label+'.');
 if(data.recordKind==='pupil'&&!data.participant.trim())errors.push('Upiši oznaku učenika bez imena.');
 if(data.outcome==='assisted'&&!data.assistance.trim())errors.push('Opiši pruženu pomoć.');
 if(data.outcome==='blocked'&&!data.issues.trim())errors.push('Opiši problem koji je blokirao rad.');
 if(data.lesson==='radio/radio'&&data.peer==='none')errors.push('Za radio navedi cilj čvora B.');
 if(data.lesson!=='radio/radio'&&data.peer!=='none')errors.push('Drugi čvor odabire se samo za radio vježbu.');
 if(data.offline&&(data.offlineMethod==='untried'||!data.measurements.trim()))errors.push('Za potvrđen offline pokus odaberi način i opiši pripremu, isključenje mreže i novo otvaranje.');
 return errors;
}
export function createPilotRecord(input,{lessons,appVersion},recordedAt=new Date().toISOString()){
 const observations=pilotObservations(input,lessons),errors=pilotProblems(observations);
 if(errors.length)throw Error(errors.join('\n'));
 if(typeof appVersion!=='string'||appVersion.length>80||typeof recordedAt!=='string'||!Number.isFinite(Date.parse(recordedAt)))throw Error('Nevaljana inačica ili vrijeme zapisa.');
 return {format:'esp32-lab-pilot',version:3,generatedForVersion:appVersion,recordedAt,classification:observations.outcome==='unconfirmed'?'draft':observations.recordKind,observations};
}
export function importPilotRecord(text,lessons){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>131072)throw Error('Datoteka zapisa smije imati najviše 128 KiB.');
 let record;try{record=JSON.parse(text);}catch{throw Error('Datoteka nije valjan JSON zapis.');}
 if(!object(record)||record.format!=='esp32-lab-pilot'||![2,3].includes(record.version))throw Error('Nepodržan format ili inačica zapisa pilota.');
 if(typeof record.generatedForVersion!=='string'||record.generatedForVersion.length>80||typeof record.recordedAt!=='string'||!Number.isFinite(Date.parse(record.recordedAt)))throw Error('Nevaljani metapodaci zapisa.');
 // Old records remain editable without assigning a previously unknown scope.
 return {sourceVersion:record.version,observations:pilotObservations(record.observations,lessons)};
}
