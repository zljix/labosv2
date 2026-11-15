import {strToU8,zipSync} from 'fflate';
import {exportZip} from '../project/archive';
import {parseProject} from '../project/model';

const cell=(v:unknown)=>{const s=v==null?'':String(v);return '"'+(/^[\s\uFEFF]*[=+\-@]/u.test(s)||/^[\t\r\n]/.test(s)?"'"+s:s).replaceAll('"','""')+'"';};
export function achievementCsv(report:any):string{
  const head=['Razred','Školska godina','Učenik','Korisničko ime','Dodjela','Vježba','Inačica','Cilj','Status rada','Broj pokušaja','Trenutna revizija','Predaja','Vrednovana revizija','Automatski bodovi','Konačni bodovi','Maksimum','Izvor bodova','Stanje provjere','Korekcija – autor','Korekcija – razlog','Korekcija – vrijeme','Odabir predaje – razlog','Zaključano UTC','Vrijeme izvještaja UTC'];
  const rows=report.rows.map((r:any)=>{const a=r.assessment,g=a.grading,c=g.teacherReview;return [report.class.name,report.class.schoolYear,r.student.displayName,r.student.username,r.assignment.id,r.assignment.code+' · '+r.assignment.title,r.assignment.version,r.assignment.target,r.status,r.currentAttempt?.number??0,r.currentAttempt?.revision,r.submission?.id,r.submission?.revision,g.points,a.points,a.maxPoints,a.source,g.status,c?.author.displayName,c?.reason,c?.createdAt,r.selection?.reason,r.submission?.submittedAt,report.serverTime];});
  return '\uFEFF'+[head,...rows].map(row=>row.map(cell).join(';')).join('\r\n')+'\r\n';
}
// Only JSON obtained through the authenticated snapshot API enters this ZIP.
// External names never become paths. Both radio nodes and initial media are
// retained by the existing project archive implementation.
export function achievementProjects(report:any,works:any[]):Uint8Array{
  const entries:Record<string,Uint8Array>={'evidencija.csv':strToU8(achievementCsv(report)),'evidencija.json':strToU8(JSON.stringify(report,null,2))};
  const index=works.map(w=>({attemptId:w.attempt.id,studentId:w.student.id,revision:w.snapshot.revision,contentHash:w.snapshot.contentHash,path:`radovi/pokusaj-${w.attempt.id}-r${w.snapshot.revision}.zip`}));
  if(new Set(index.map(i=>i.path)).size!==index.length)throw Error('Izvoz sadrži dvostruku snimku.');
  index.forEach((i,n)=>{entries[i.path]=exportZip(parseProject(works[n].snapshot.project));});
  entries['snimke.json']=strToU8(JSON.stringify(index,null,2));
  return zipSync(entries,{level:6});
}
