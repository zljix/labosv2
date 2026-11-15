import { exportZip } from '../project/archive';
import { clone, parseProject, type Project } from '../project/model';
import { getLesson, lessonMarkdown, readWork } from './catalog';
import { readResult, sourceHash } from './verify';

export async function submissionProject(project:Project):Promise<Project> {
  const p=clone(project),work=readWork(p),lesson=work&&getLesson(work.lessonId);
  if(!work||!lesson)throw Error('Projekt nema valjane podatke vježbe.');
  if(work.student.trim().length<3)throw Error('Upiši ime i prezime prije predaje.');
  if(!work.group.trim())throw Error('Upiši razred ili grupu prije predaje.');
  if(work.answers.some(a=>!a.trim()))throw Error('Odgovori na sva pitanja i zapiši tražena opažanja prije predaje.');
  const result=readResult(p);
  if(!result||result.sourceHash!==await sourceHash(p))throw Error('Provedi novu provjeru rada za trenutačni kôd i sklop prije predaje. Možeš predati i rezultat s pogreškama.');
  // Regenerate descriptive instructions from the known lesson, never from imported claims.
  p.files['upute.md']=lessonMarkdown(lesson);
  p.files['predaja.md']=[
    `# Predaja · V${lesson.number}: ${lesson.title}`,
    `Učenik: ${work.student}\nRazred/grupa: ${work.group}`,
    `Pripremljeno: ${new Date().toISOString()}\nScenarij: ${lesson.id} · revizija 1\nSHA-256 koda i sklopa: ${result.sourceHash}`,
    `Lokalna samoprovjera: ${result.checks.filter(c=>c.passed).length}/${result.checks.length}. Ovo nije ovjerena ocjena ni dokaz autorstva. Nastavnik treba pregledati kôd, sklop i odgovore te izričito ponoviti ugrađenu provjeru. Hash povezuje sadržaj i zapis, ne dokazuje da zapis nije izmijenjen.`,
    '## Odgovori i dokazi',
    ...lesson.questions.map((q,i)=>`### ${i+1}. ${q}\n\n${work.answers[i]}`),
    '## Opažanja provjere',
    ...result.checks.map(c=>`- ${c.passed?'PROLAZI':'POTREBAN ISPRAVAK'} · ${c.title}\n  Očekivano: ${c.expected}\n  Opaženo: ${c.observed}`),
    'Paket se otvara uvozom kao zaustavljena kopija. Ni upute ni uvezeni zapis provjere ne izvršavaju se. Za ponavljanje aplikacija koristi svoj ugrađeni scenarij poznate revizije.',
  ].join('\n\n')+'\n';
  return parseProject(p);
}
export async function exportSubmission(p:Project){return exportZip(await submissionProject(p));}
