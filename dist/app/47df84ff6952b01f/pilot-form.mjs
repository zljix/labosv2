import {pilotChecks,createPilotRecord,importPilotRecord} from './pilot-record.mjs';
const form=document.querySelector('#pilot'),status=document.querySelector('#status');
const options={lessons:[...form.elements.lesson.options].map(o=>o.value),appVersion:form.dataset.appVersion};
let dirty=false;
form.addEventListener('input',()=>{dirty=true;});form.addEventListener('change',()=>{dirty=true;});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
const values=()=>{const data=Object.fromEntries(new FormData(form));for(const key of pilotChecks)data[key]=form.elements[key].checked;return data;};
function save(draft=false){
 try{
  const data=values();if(draft)data.outcome='unconfirmed';
  const record=createPilotRecord(data,options),url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=draft?'ESP32_Lab_Pilot_Nacrt.json':'ESP32_Lab_Pilot_Zapis.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  if(draft)form.elements.outcome.value='unconfirmed';
  dirty=false;
  status.textContent=record.classification==='draft'?'Preuzet je nacrt. Pilot nije potvrđen.':record.classification==='pupil'?'Preuzet je ručni zapis učeničkog pilota. Unesene tvrdnje nisu automatski potvrđene.':record.classification==='device'?'Preuzet je zapis provjere uređaja. Učenički pilot ostaje zaseban.':'Preuzet je razvojni zapis. Ne potvrđuje učenički pilot.';
 }catch(error){status.textContent=error.message;status.focus();}
}
document.querySelector('#save').onclick=()=>save();document.querySelector('#draft').onclick=()=>save(true);
document.querySelector('#print').onclick=()=>window.print();
document.querySelector('#restore').onclick=()=>document.querySelector('#record-file').click();
document.querySelector('#record-file').onchange=async event=>{
 const file=event.target.files[0];if(!file)return;
 try{
  if(file.size>131072)throw Error('Datoteka zapisa smije imati najviše 128 KiB.');
  const record=importPilotRecord(await file.text(),options.lessons);
  if(dirty&&!window.confirm('Uvoz će zamijeniti unesena opažanja. Najprije preuzmi nacrt ako ih želiš sačuvati. Nastaviti s uvozom?'))return;
  for(const [name,value]of Object.entries(record.observations)){const field=form.elements[name];if(pilotChecks.includes(name))field.checked=value;else field.value=value;}
  dirty=false;status.textContent='Uvezen je zapis. Provjeri inačicu, vrstu zapisa i opažanja prije nastavka.'+(record.sourceVersion===2?' Stariji zapis nema oznaku vrste ni načina offline pokusa; odaberi ih prema stvarnom pokusu.':'');
 }catch(error){status.textContent=error.message;status.focus();}
 finally{event.target.value='';}
};
