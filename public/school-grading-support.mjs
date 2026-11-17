const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
export function mountGradingCoverage(data,root=document){
  const $=s=>root.querySelector(s),rows=data.rows;
  $('#summary').replaceChildren(...[[data.summary.supported,'podržanih kombinacija'],[data.summary.combinations,'URS kombinacija'],[data.summary.themes,'tema']].map(([n,label])=>{const p=node('p');p.append(node('strong',String(n)),node('span',label));return p;}));
  for(const [selector,key,label] of [['#family','family','familyTitle'],['#target','target','targetTitle']]){
    const select=$(selector);select.replaceChildren(select.firstElementChild);
    for(const [id,title] of new Map(rows.map(r=>[r[key],r[label]]))){const o=node('option',title);o.value=id;select.append(o);}
  }
  function draw(){
    const q=$('#query').value.trim().toLocaleLowerCase('hr'),family=$('#family').value,target=$('#target').value,status=$('#support').value;
    const selected=rows.filter(r=>(!family||r.family===family)&&(!target||r.target===target)&&(!status||r.grading.status===status)&&
      (!q||[r.code,r.lessonTitle,r.variantTitle,r.targetTitle,...r.preparationCriteria,...r.grading.criteria.map(c=>c.description)].join(' ').toLocaleLowerCase('hr').includes(q)));
    $('#result').textContent=`Prikazano ${selected.length} od ${rows.length} kombinacija. Podržano u ovom odabiru: ${selected.filter(r=>r.grading.status==='supported').length}.`;
    $('#rows').replaceChildren(...selected.map(r=>{
      const tr=node('tr'),name=node('td');name.append(node('strong',r.code+' · '+r.variantTitle),node('small',r.lessonTitle));
      const state=node('td'),badge=node('span',r.grading.status==='supported'?'Podržano':'Nije podržano');badge.className='badge '+r.grading.status;state.append(badge);
      if(r.grading.maxPoints!==null)state.append(node('small','Najviše '+r.grading.maxPoints+' bodova'));
      const cell=node('td'),details=node('details');details.append(node('summary',r.grading.status==='supported'?'Bodovni kriteriji':'Priprema i preostala provjera'));
      if(r.grading.instructions)details.append(node('p',r.grading.instructions));
      details.append(node('p',r.grading.reason));const list=node('ul');
      for(const text of r.grading.status==='supported'?r.grading.criteria.map(c=>c.description+' · '+c.maxPoints+' bodova'):r.preparationCriteria)list.append(node('li',text));
      details.append(list,node('p',r.grading.requirement));
      if(r.grading.profileId)details.append(node('small','Rubrika: '+r.grading.profileId));
      cell.append(details);tr.append(name,node('td',r.targetTitle),state,cell);return tr;
    }));
  }
  $('#filters').addEventListener('submit',e=>e.preventDefault());$('#query').addEventListener('input',draw);
  for(const id of ['#family','#target','#support'])$(id).addEventListener('change',draw);
  $('#introductory').replaceChildren(...data.introductory.map(l=>{const d=node('details');d.append(node('summary',l.code+' · '+l.title),node('p',l.reason),node('p',l.grading?.status==='supported'?'Školsko bodovanje: '+l.grading.profileId+' · najviše '+l.maxPoints+' bodova. '+l.grading.instructions:'Službeno bodovanje nije podržano.'));const ul=node('ul');for(const c of l.criteria)ul.append(node('li',c));d.append(ul);return d;}));draw();
}
if(typeof document!=='undefined'&&document.querySelector('#rows')){
  try{const response=await fetch(new URL('./school-grading-support.json',import.meta.url));if(!response.ok)throw Error('http');mountGradingCoverage(await response.json());}
  catch{document.querySelector('#result').textContent='Registar se nije mogao učitati. Osvježi stranicu ili preuzmi CSV.';}
}
