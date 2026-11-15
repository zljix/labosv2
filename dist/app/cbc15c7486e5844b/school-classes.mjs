const $ = s => document.querySelector(s);
const node = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
const time = value => value ? new Intl.DateTimeFormat('hr-HR', {dateStyle:'medium', timeStyle:'short', timeZone:'Europe/Zagreb'}).format(new Date(value)) + ' (Zagreb)' : 'Bez roka';
const targetNames = {micropython:'ESP32-S3 · MicroPython', 's3-cpp':'ESP32-S3 · Arduino C++', uno:'Arduino Uno R3 · C++', nano:'Arduino Nano classic · C++'};
const actionNames = {create:'Novi učenički račun', link:'Poveži postojeći račun', member:'Već je član razreda'};

function options(select, items, placeholder, selected) {
  select.replaceChildren(); const first = node('option', placeholder); first.value = ''; select.append(first);
  for (const [id,label] of items) { const option = node('option',label); option.value = String(id); select.append(option); }
  if (items.some(([id])=>String(id)===String(selected))) select.value = String(selected);
}
function describe(container, definition, rubric) {
  container.replaceChildren(node('h3', definition.code+' · '+definition.variantTitle),node('p',definition.goal));
  for (const [title,text] of [['Prije početka',definition.before],['Promjena programa ili ulaza',definition.change],['Kvar i oporavak',definition.fault],['Očekivano opažanje',definition.expected],['Dodatna uputa nastavnika',definition.teacherNotes]]) {
    if (text) container.append(node('h4',title),node('p',text));
  }
  const terms=node('dl'); for (const [term,text] of definition.concepts) terms.append(node('dt',term),node('dd',text));
  const details=node('details');details.append(node('summary','Pojmovi i pitanja'),terms);
  const questions=node('ol');for (const question of definition.questions) questions.append(node('li',question));details.append(questions);container.append(details);
  if (rubric) {
    if(rubric.instructions)container.append(node('h4',rubric.title),node('p',rubric.instructions));
    container.append(node('h4','Objavljeni kriteriji'));
    const criteria=node('ul');for (const item of rubric.criteria) criteria.append(node('li',item.description+(item.maxPoints===null?'':' · najviše '+item.maxPoints+' bodova')));container.append(criteria);
    container.append(node('p',rubric.authority==='server-verified'?'Automatska provjera: najviše '+rubric.maxPoints+' bodova. Podržani ciljevi: '+rubric.targets.map(t=>targetNames[t]).join(', ')+'. Rezultat prati spremljenu reviziju.':rubric.maxPoints===null?'Bodovanje još nije uključeno. Kriteriji služe pripremi rada.':'Planirano najviše '+rubric.maxPoints+' bodova. Automatsko bodovanje još nije uključeno; ovo nisu osvojeni bodovi.','account-note'));
  }
}

export function createSchoolPortal({request,getUser,run,message,reloadUsers}) {
  let classes=[], catalog, versions=[], selectedClass, preview, epoch=0;
  const staff=()=>getUser() && getUser().role!=='student';
  function clearPreview(){preview=null;$('#csv-preview').replaceChildren();$('#csv-commit').hidden=true;$('#csv-existing').checked=false;}
  function clear(){++epoch;classes=[];selectedClass=undefined;catalog=undefined;versions=[];clearPreview();$('#school-work').hidden=true;$('#class-detail').hidden=true;$('#invite-result').textContent='';$('#csv-text').value='';$('#school-assignments').replaceChildren();}
  function drawVersion(){
    const version=versions.find(v=>v.id===Number($('#assignment-version').value));
    options($('#assignment-target'),version?version.definition.targets.map(t=>[t,targetNames[t]+(version.rubric.authority==='server-verified'&&!version.rubric.targets.includes(t)?' · bez službenog bodovanja':'')]):[],'Odaberi cilj');
    $('#published-task').replaceChildren();if(version)describe($('#published-task'),version.definition,version.rubric);
  }
  function drawCatalog(){
    const item=catalog?.entries.find(e=>e.key===$('#task-key').value);$('#task-preview').replaceChildren();
    if(item){
      describe($('#task-preview'),item);
      const support=node('ul');
      for(const target of item.targets){
        const g=item.gradingSupport?.[target];
        support.append(node('li',targetNames[target]+' · '+(g?.status==='supported'?'Automatska provjera dostupna: '+g.title+' (najviše '+g.maxPoints+' bodova). '+g.requirement:'Službeno bodovanje nije podržano. '+(g?.reason??''))));
      }
      $('#task-preview').append(node('h4','Podrška bodovanja po cilju'),support);
    }
    const profiles=(catalog?.gradingProfiles??[]).filter(p=>p.taskKey===item?.key);
    options($('#task-grading'),profiles.map(p=>[p.id,p.title]),'Opisni / ručno planirani kriteriji');drawGrading();
  }
  function drawGrading(){const profile=catalog?.gradingProfiles?.find(p=>p.id===$('#task-grading').value);$('#grading-preview').textContent=profile?.instructions??'';$('#task-criteria').disabled=!!profile;}
  function drawAssignments(assignments){
    const host=$('#school-assignments');host.replaceChildren();
    if(!assignments.length){host.append(node('p',staff()?'Razredu još nije dodijeljena vježba. Objavi inačicu zadatka pa je dodijeli razredu.':'Još nema dostupnih dodijeljenih vježbi. Nakon potvrde članstva osvježi pregled.'));return;}
    for(const a of assignments){
      const card=node('article',undefined,'assignment-card');
      card.append(node('p',a.className+' · '+a.schoolYear+' · inačica '+a.task.version,'label'),node('h3',a.task.definition.code+' · '+a.task.definition.variantTitle),node('p',targetNames[a.target]),node('p','Rok: '+time(a.dueAt)),node('p',a.available?'Dostupno za rad':'Privremeno skriveno','stage'));
      const enabled=a.task.rubric.authority==='server-verified'&&a.task.rubric.targets.includes(a.target);
      card.append(node('p',enabled?'Službena provjera uključena · najviše '+a.task.rubric.maxPoints+' bodova':'Službeno bodovanje za ovu dodjelu nije uključeno.','account-note'));
      const details=node('details');details.append(node('summary','Pročitaj upute i kriterije'));const contents=node('div');describe(contents,a.task.definition,a.task.rubric);details.append(contents);card.append(details);
      if(a.available || staff()){
        const link=node('a',staff()?'Otvori početnu kopiju':'Otvori / nastavi vježbu u laboratoriju','button');link.href='./?schoolAssignment='+a.id;card.append(link);
      }
      if(staff()){
        const button=node('button',a.available?'Sakrij učenicima':'Omogući učenicima','secondary');button.type='button';button.addEventListener('click',()=>void run(async()=>{await request('assignment-availability',{assignmentId:a.id,available:!a.available});await refreshAssignments();message('Dostupnost vježbe je spremljena.');}));card.append(button);
      }
      if(staff()){const live=node('a','Pregled spremljenih radova','button');live.href='./?schoolReview='+a.classId+'&schoolExercise='+a.id;card.append(live);}
      card.append(node('small','Učenički rad sprema se na školskom poslužitelju. Ponovno otvaranje nastavlja posljednju spremljenu reviziju. Objavljena pilot-provjera prikazuje bodove u laboratoriju. Ondje završavaš i zaključavaš spremljenu reviziju te pregledavaš predaje i dopuštene dorade.'));host.append(card);
    }
  }
  async function refreshAssignments(){
    const tick=epoch;const user=getUser();if(!user||user.mustChangePassword)return;
    const classId=staff()?$('#class-select').value:'';
    if(staff()&&!classId){drawAssignments([]);return;}
    const state=await request('assignments'+(classId?'&classId='+classId:''));if(tick===epoch)drawAssignments(state.assignments);
  }
  function memberRow(person,kind){
    const row=node('tr');row.append(node('td',person.displayName),node('td',person.username),node('td',person.active?'Aktivan':'Neaktivan'));
    const td=node('td');
    if(kind==='student'||getUser().role==='admin'){
      const button=node('button','Ukloni iz razreda','secondary');button.type='button';
      button.addEventListener('click',()=>void run(async()=>{await request('membership',{classId:selectedClass.id,userId:person.id,kind,present:false});await openClass();await reloadUsers(false);message('Članstvo je uklonjeno; račun i raniji zapisi ostaju sačuvani.');}));td.append(button);
    }row.append(td);return row;
  }
  async function openClass(){
    const id=Number($('#class-select').value);++epoch;clearPreview();$('#invite-result').textContent='';$('#class-detail').hidden=true;
    if(!id){selectedClass=undefined;drawAssignments([]);return;}
    const tick=epoch;const result=await request('class&id='+id);if(tick!==epoch)return;selectedClass=result.class;
    $('#class-heading').textContent=selectedClass.name+' · '+selectedClass.schoolYear;$('#class-detail').hidden=false;
    $('#class-students').replaceChildren(...selectedClass.students.map(s=>memberRow(s,'student')));
    $('#class-teachers').replaceChildren(...selectedClass.teachers.map(s=>memberRow(s,'teacher')));
    $('#class-student-note').textContent=selectedClass.students.length+' učenika u razredu.';
    $('#teacher-assignment').hidden=getUser().role!=='admin';
    if(getUser().role==='admin'){
      const people=(await request('users')).users.filter(u=>u.role==='teacher'&&u.active&&!selectedClass.teachers.some(t=>t.id===u.id));
      if(tick!==epoch)return;options($('#teacher-user'),people.map(u=>[u.id,u.displayName+' ('+u.username+')']),'Odaberi nastavnika');
    }
    $('#join-requests').replaceChildren();
    for(const item of selectedClass.requests){
      const row=node('div',undefined,'request-row');row.append(node('p',item.student.displayName+' ('+item.student.username+') · '+time(item.requestedAt)));
      for(const [approve,label] of [[true,'Potvrdi učenika'],[false,'Odbij zahtjev']]){
        const button=node('button',label,approve?'':'secondary');button.type='button';button.addEventListener('click',()=>void run(async()=>{await request('review-join',{requestId:item.id,approve});await openClass();await reloadUsers(false);message(approve?'Učenik je potvrđen i vidi razredne vježbe.':'Zahtjev je odbijen.');}));row.append(button);
      }$('#join-requests').append(row);
    }
    if(!selectedClass.requests.length)$('#join-requests').append(node('p','Nema zahtjeva na čekanju.'));
    $('#invite-status').textContent=selectedClass.invites.length?selectedClass.invites.map(i=>'Aktivan kod do '+time(i.expiresAt)+' · iskorišteno '+i.usedCount+'/'+i.maxUses+' mjesta.').join(' '):'Nema aktivnog pozivnog koda.';
    await refreshAssignments();
  }
  async function refresh(){
    const user=getUser();if(!user||user.mustChangePassword){clear();return;}
    const tick=++epoch;$('#school-work').hidden=false;$('#school-staff').hidden=!staff();$('#school-student').hidden=staff();
    const result=await request('classes');if(tick!==epoch)return;classes=result.classes;
    if(staff()){
      const selected=$('#class-select').value;
      options($('#class-select'),classes.map(c=>[c.id,c.name+' · '+c.schoolYear]),'Odaberi razred',selected||classes[0]?.id);
      if(!catalog)catalog=(await request('catalog')).catalog;if(tick!==epoch)return;
      options($('#task-key'),catalog.entries.map(e=>[e.key,e.code+' · '+e.title+' · '+e.variantTitle]),'Odaberi vježbu',$('#task-key').value);
      versions=(await request('task-versions')).versions;if(tick!==epoch)return;
      options($('#assignment-version'),versions.map(v=>[v.id,v.definition.code+' · '+v.definition.variantTitle+' · v'+v.version]),'Odaberi objavljenu inačicu',$('#assignment-version').value);
      drawVersion();await openClass();
    }else{
      $('#student-classes').textContent=classes.length?'Moji razredi: '+classes.map(c=>c.name+' ('+c.schoolYear+')').join(', '):'Još nema potvrđenog članstva u razredu.';
      const states={pending:'Čeka potvrdu nastavnika',approved:'Nastavnik je potvrdio zahtjev',rejected:'Zahtjev je odbijen'};
      const data=await request('my-requests');if(tick!==epoch)return;$('#my-requests').replaceChildren(...data.requests.map(r=>node('p',r.className+' · '+r.schoolYear+' — '+states[r.status])));
      await refreshAssignments();
    }
  }
  function form(selector,work,{reset=true}={}){$(selector).addEventListener('submit',event=>{event.preventDefault();const el=event.currentTarget;const fields=Object.fromEntries(new FormData(el));void run(async()=>{await work(fields);if(reset)el.reset();});});}
  $('#refresh-school').addEventListener('click',()=>void run(refresh));
  $('#class-select').addEventListener('change',()=>void run(openClass));
  $('#task-key').addEventListener('change',drawCatalog);$('#task-grading').addEventListener('change',drawGrading);$('#assignment-version').addEventListener('change',drawVersion);
  form('#create-class-form',async fields=>{const result=await request('create-class',fields);await refresh();$('#class-select').value=String(result.class.id);await openClass();message('Razred je stvoren. Dodaj učenike i dodijeli vježbe.');});
  form('#teacher-form',async fields=>{if(!selectedClass)throw Error('Odaberi razred.');await request('membership',{classId:selectedClass.id,userId:Number(fields.userId),kind:'teacher',present:true});await openClass();message('Nastavnik je dodijeljen razredu.');});
  form('#invite-form',async fields=>{if(!selectedClass)throw Error('Odaberi razred.');const result=await request('create-invite',{classId:selectedClass.id,hours:Number(fields.hours),maxUses:Number(fields.maxUses)});await openClass();$('#invite-result').textContent=result.invite.code;message('Novi kod prikazan je samo sada. Podijeli ga učenicima svojeg razreda; svaki zahtjev treba tvoju potvrdu.');});
  $('#revoke-invite').addEventListener('click',()=>void run(async()=>{if(!selectedClass)throw Error('Odaberi razred.');await request('revoke-invites',{classId:selectedClass.id});await openClass();message('Pozivni kodovi više se ne mogu koristiti. Već zaprimljeni zahtjevi ostaju za pregled.');}));
  $('#csv-text').addEventListener('input',clearPreview);
  $('#csv-file').addEventListener('change',event=>void run(async()=>{clearPreview();const file=event.target.files[0];if(!file)return;if(file.size>60000)throw Error('CSV može imati najviše 60 kB.');$('#csv-text').value=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());message('CSV je učitan. Pregledaj plan uvoza prije spremanja.');}));
  form('#csv-form',async()=>{
    if(!selectedClass)throw Error('Odaberi razred.');clearPreview();const csv=$('#csv-text').value;
    const result=await request('preview-students',{classId:selectedClass.id,csv});preview={classId:selectedClass.id,csv,token:result.previewToken};
    const table=node('table'),head=node('thead'),hr=node('tr');for(const label of ['Ime i prezime','Korisničko ime','Radnja'])hr.append(node('th',label));head.append(hr);table.append(head);const body=node('tbody');
    for(const row of result.rows){const tr=node('tr');tr.append(node('td',row.displayName),node('td',row.username),node('td',actionNames[row.action]));body.append(tr);}table.append(body);$('#csv-preview').append(table);$('#csv-commit').hidden=false;
    $('#csv-link-label').hidden=!result.rows.some(r=>r.action==='link');message('Pregled uvoza je spreman. Lozinke se ne prikazuju u pregledu.');
  },{reset:false});
  $('#import-csv').addEventListener('click',()=>void run(async()=>{
    if(!preview||preview.classId!==selectedClass?.id||preview.csv!==$('#csv-text').value)throw Error('Ponovno pregledaj CSV.');
    const result=await request('import-students',{classId:preview.classId,csv:preview.csv,previewToken:preview.token,linkExisting:$('#csv-existing').checked});
    $('#csv-text').value='';$('#csv-file').value='';clearPreview();await openClass();await reloadUsers(false);message('Uvoz završen: '+result.created+' novih računa, '+result.added+' dodanih članova, '+result.unchanged+' već u razredu.');
  }));
  form('#join-class-form',async fields=>{await request('join-class',fields);await refresh();message('Zahtjev je poslan. Nastavnik treba potvrditi tvoj identitet i članstvo.');});
  form('#publish-task-form',async fields=>{
    const criteria=!fields.gradingProfile&&(fields.criteria??'').trim()?fields.criteria.trim().split('\n').map(line=>{const match=line.match(/^(.*?)\s*\|\s*(\d+)\s*$/);if(!match)throw Error('Svaki kriterij upiši kao opis | broj bodova.');return {description:match[1].trim(),maxPoints:Number(match[2])};}):null;
    const result=await request('publish-task',{taskKey:fields.taskKey,teacherNotes:fields.teacherNotes,criteria,gradingProfile:fields.gradingProfile||null});await refresh();$('#assignment-version').value=String(result.task.id);drawVersion();message('Objavljena je nepromjenjiva inačica '+result.task.version+'. Sada je dodijeli razredu.');
  },{reset:false});
  form('#assignment-form',async fields=>{if(!selectedClass)throw Error('Odaberi razred.');await request('create-assignment',{classId:selectedClass.id,taskVersionId:Number(fields.taskVersionId),target:fields.target,dueAt:fields.dueAt?new Date(fields.dueAt).toISOString():null});await refreshAssignments();message('Vježba je dodijeljena odabranom razredu.');},{reset:false});
  return {refresh,clear};
}
