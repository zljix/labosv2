import {examples as coreExamples} from '../../public/examples.mjs';
import {NANO, UNO} from '../boards/profiles';
import {basicExamples} from '../circuit/examples';
import {environmentExamples} from '../circuit/environmentExamples';
import {opticalExamples} from '../circuit/max30102Examples';
import {peripheralExample} from '../circuit/peripheralExamples';
import {rtcExamples} from '../circuit/rtcExamples';
import {sdExamples} from '../circuit/sdExamples';
import {newProject} from '../project/model';
import {loadRadioPair} from '../radio/examples';
import {arduinoExamples, loadArduinoExample, type ArduinoExample} from '../runtime/arduinoExamples';
import {s3Examples, loadS3Example, type S3Example} from '../runtime/s3Examples';
import {lessons} from './catalog';
import {practices, type ExerciseId} from './collectionPlans';
import {sequence, tracks, type Track} from './IotUsCatalog';
import titles from './iotUsTitles.json';
import {createPythonExample, ursLessons, ursTargets, variantAvailable, type UrsTarget} from './ursCatalog';
import {labIds, ursLabSheets, type LabId} from './ursLab';
import {teachingLesson, URS_GUIDE_VERSION} from './ursTeaching';

export type CatalogTarget = UrsTarget | 'plc';
export const targetLabels:Record<CatalogTarget, string> = {
  micropython:'ESP32-S3 · MicroPython', 's3-cpp':'ESP32-S3 · Arduino C++',
  uno:ursTargets.uno.label, nano:ursTargets.nano.label, plc:'PLC · Structured Text',
};
export const groupLabels = {
  intro:'Početne vježbe', guided:'Vođeni pokusi', examples:'Primjeri za pločice',
  core:'Pokusi jezgre', lab:'URS', iot:tracks.iot, us:tracks.us,
};
export type ProjectGroup = keyof typeof groupLabels;
export type StandaloneKind = 'example' | 'core' | 'radio';

type ProjectRoute =
  | {kind:'intro'; id:string}
  | {kind:'guided'; lesson:string; variant:string}
  | {kind:StandaloneKind; id:string}
  | {kind:'lab'; id:LabId}
  | {kind:'practice'; track:Track; id:ExerciseId};

interface ExampleInfo {title:string; hint:string}
type ExampleEditions = Partial<Record<UrsTarget, ExampleInfo>>;
export interface CatalogEntry {
  key:string; group:ProjectGroup; title:string; description:string; targets:CatalogTarget[];
  route:ProjectRoute; keywords?:string; editions?:ExampleEditions;
}

const targets = Object.keys(ursTargets) as UrsTarget[];
const pythonGroups: [string, Record<string, ExampleInfo>][] = [
  ['basic', basicExamples], ['env', environmentExamples], ['rtc', rtcExamples],
  ['sd', sdExamples], ['optical', opticalExamples], ['peripheral', {regulator:peripheralExample}],
];
const pythonPrefixes = new Map<string,string>();
const boardExamples = new Map<string,ExampleEditions>();
function register(key:string, target:UrsTarget, info:ExampleInfo) {
  const editions = boardExamples.get(key) ?? {};
  editions[target] = info;
  boardExamples.set(key,editions);
}
for (const [prefix,group] of pythonGroups) {
  for (const [key,example] of Object.entries(group)) {
    register(key,'micropython',example);
    pythonPrefixes.set(key,prefix);
  }
}
for (const [key,example] of Object.entries(s3Examples)) register(key,'s3-cpp',example);
for (const [key,example] of Object.entries(arduinoExamples)) {
  register(key,'uno',example);
  register(key,'nano',example);
}

export async function createStandalone(kind:StandaloneKind, id:string, target:UrsTarget, peer:UrsTarget) {
  if (kind==='radio') return loadRadioPair(target,peer);
  if (kind==='core') {
    const example = (coreExamples as Record<string, ExampleInfo & {code:string}>)[id];
    if (!example || target!=='micropython') throw Error('Pokus jezgre traži ESP32-S3 i MicroPython.');
    const project = newProject(example.code,example.title);
    project.settings.example = id;
    project.circuit = {kind:'stage0-fixture',components:[],wires:[]};
    return project;
  }
  const info = boardExamples.get(id)?.[target];
  if (!info) throw Error('Taj primjer nema izvedbu za odabranu pločicu i jezik.');
  if (target==='s3-cpp') return loadS3Example(id as S3Example);
  if (target==='uno' || target==='nano') return loadArduinoExample(id as ArduinoExample,target==='uno'?UNO:NANO);
  const project = await createPythonExample(id);
  project.title = info.title;
  project.settings.example = pythonPrefixes.get(id) + '-' + id;
  return project;
}

export const projects:CatalogEntry[] = [
  ...lessons.map((lesson):CatalogEntry => ({
    key:'intro/'+lesson.id, group:'intro', title:'V'+lesson.number+' · '+lesson.title,
    description:lesson.goal, targets:['micropython'], route:{kind:'intro',id:lesson.id},
  })),
  ...ursLessons.flatMap(lesson => lesson.variants.map((variant):CatalogEntry => ({
    key:'guided/'+lesson.id+'/'+variant.id, group:'guided', title:variant.title,
    description:teachingLesson(lesson,variant.id,URS_GUIDE_VERSION).goal,
    keywords:[lesson.title, 'URS'+String(lesson.number).padStart(2,'0'), ...variant.components].join(' '),
    targets:targets.filter(target => variantAvailable(variant,target)),
    route:{kind:'guided',lesson:lesson.id,variant:variant.id},
  }))),
  ...Array.from(boardExamples, ([id,editions]):CatalogEntry => {
    const primary = (editions.micropython ?? editions['s3-cpp'] ?? editions.uno)!;
    return {
      key:'example/'+id, group:'examples', title:primary.title.replace(/^(S3 C\+\+|Arduino) · /,''),
      description:primary.hint, editions, targets:targets.filter(target => !!editions[target]),
      keywords:Object.values(editions).map(e => e.title).join(' '), route:{kind:'example',id},
    };
  }),
  {key:'radio',group:'examples',title:'NRF24 · radijska veza dvaju čvorova',
    description:'Odaberi pločicu za odašiljač i za prijamnik pa pokreni razmjenu poruka.',
    targets, route:{kind:'radio',id:'radio'}},
  ...Object.entries(coreExamples).map(([id,example]):CatalogEntry => ({
    key:'core/'+id, group:'core', title:example.title, description:example.hint,
    targets:['micropython'], route:{kind:'core',id},
  })),
  ...labIds.map((id):CatalogEntry => ({
    key:'lab/'+id, group:'lab', title:id+' · '+ursLabSheets[id].title,
    description:ursLabSheets[id].goals.join(' · '), keywords:'laboratorijska vježba P1 P2 P3',
    targets:[id==='LV16'?'plc':'nano'], route:{kind:'lab',id},
  })),
  ...(['iot','us'] as const).flatMap(track => (['P0',...sequence(track)] as ExerciseId[]).map((id):CatalogEntry => ({
    key:track+'/'+id, group:track, title:id+' · '+titles[id], description:practices[id].task,
    targets:['micropython','s3-cpp'], route:{kind:'practice',track,id},
  }))),
];

function normalize(value:string) {
  return value.toLocaleLowerCase('hr').normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/g,'d');
}
const searchText = new Map(projects.map(p => [p.key,normalize([
  p.key, p.title, p.description, groupLabels[p.group], p.keywords ?? '',
  ...p.targets.map(t => targetLabels[t]),
].join(' '))]));
export function findProjects(query:string, group:ProjectGroup|'all', target:CatalogTarget|'all') {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return projects.filter(p => (group==='all' || p.group===group) &&
    (target==='all' || p.targets.includes(target)) && words.every(w => searchText.get(p.key)!.includes(w)));
}
