import type { Project } from '../project/model';
import { practices, type ExerciseId } from '../lessons/collectionPlans';
import type { LabId } from '../lessons/ursLab';
import sheets from '../lessons/ursLabSheets.json';
import { practiceCriteria } from './practiceCriteria';
import { labHints } from './labCriteria';
import { labSnapshot, responseFile, savedTrial } from './snapshot';

export const collectionChecker = '26C.1';
export interface Criterion {
  id: string;
  description: string;
  maxPoints: number;
}
export interface CheckResult {
  passed: boolean;
  explanation: string;
}
export interface Trial {
  key: string;
  index: number;
  project: Project;
  inputs: Record<string, any>;
  label: string;
  libraryB?: boolean;
}
export const success: CheckResult = {
  passed: true,
  explanation: 'Potvrđeno ponovnim izvođenjem spremljenog pokusa.'
};
export function collectionProfile(key: string) {
  const [track, id] = key.split('/');
  const lab = track === 'urs-lv',
    lesson = id as ExerciseId,
    lv = id as LabId;
  if (lab ? !Object.hasOwn(sheets, id) : !['iot', 'us'].includes(track) || !Object.hasOwn(practices, id))
    throw Error('Nepoznata vježba.');
  const criteria: Criterion[] = lab
    ? sheets[lv].tasks.map((text, i) => ({
        id: 'P' + (i + 1),
        maxPoints: [3, 3, 4][i],
        description: 'P' + (i + 1) + ' · ' + text
      }))
    : [
        practiceCriteria[lesson].baseline,
        practiceCriteria[lesson].change,
        practiceCriteria[lesson].question
      ].map((description, i) => ({
        description,
        id: ['pocetni', 'izmjena', 'tumacenje'][i],
        maxPoints: [3, 5, 2][i]
      }));
  const instructions = lab
    ? 'Spremi inačice P1, P2 i P3. Svaka se izvodi zasebno prema uvjetima uz podzadatak.'
    : 'Zabilježi početni i izmijenjeni pokus te odgovori na pitanje za bodovanje. Provjeravač izvodi obje spremljene inačice u simulatoru.';
  return {
    id: '26C-' + track + '-' + id + '@1',
    taskKey: key,
    kind: 'collection',
    targets: lab ? [id === 'LV16' ? 'micropython' : 'nano'] : ['micropython', 's3-cpp'],
    title: lab ? 'Provjera programa P1–P3' : 'Provjera pokusa i tumačenja',
    instructions,
    criteria,
    checkerVersion: collectionChecker,
    contract: {
      family: 'collection',
      version: 1,
      taskKey: key,
      scenario: { source: 'saved-trials' },
      limits: { cpuSecondsPerTrial: 58, outputBytes: 1048576, wallMsPerTrial: 65000 },
      evidence: lab
        ? labHints[lv]
        : [
            practiceCriteria[lesson].baseline,
            practiceCriteria[lesson].change,
            practiceCriteria[lesson].question,
            ...practiceCriteria[lesson].choices
          ]
    }
  };
}
export function answerChoices(id: ExerciseId) {
  const q = practiceCriteria[id];
  return q.choices.map((text, i) => ({ text, value: String(i + 1) }));
}
export async function assessCollection(key: string, p: Project, run: (trial: Trial) => Promise<CheckResult>) {
  const profile = collectionProfile(key),
    [track, id] = key.split('/'),
    lab = track === 'urs-lv';
  let before: ReturnType<typeof savedTrial>;
  if (!lab)
    try {
      before = savedTrial(p, 0);
    } catch {
      /* A damaged capture only affects criteria that need it. */
    }
  const checks = [];
  for (const [i, c] of profile.criteria.entries()) {
    let result: CheckResult;
    if (!lab && i === 2) {
      const ok = p.files[responseFile] === String(practiceCriteria[id as ExerciseId].answer + 1);
      result = {
        passed: ok,
        explanation: ok
          ? 'Tumačenje rezultata je točno.'
          : 'Odaberi tumačenje i usporedi ga s opažanjem iz pokusa.'
      };
    } else {
      let snapshot: ReturnType<typeof savedTrial>;
      try {
        if (lab) {
          const project = labSnapshot(p, i + 1, id === 'LV16');
          if (project) snapshot = { project, inputs: {} };
        } else snapshot = i === 0 ? before : savedTrial(p, i);
      } catch {
        /* Invalid evidence belongs only to this criterion. */
      }
      if (!snapshot)
        result = {
          passed: false,
          explanation: lab
            ? 'Spremi čitljivu inačicu programa za P' + (i + 1) + '.'
            : 'Zabilježi ' + (i ? 'izmijenjeni' : 'početni') + ' pokus u ovoj vježbi.'
        };
      else {
        const trial = {
          key,
          index: i,
          ...snapshot,
          label: p.files['oznaka-prikaza.txt']?.trim().slice(0, 22) ?? ''
        };
        result = await run(trial);
        if (result.passed && i === 1 && ['V4.2', 'V4.3'].includes(id)) {
          if (!before)
            result = {
              passed: false,
              explanation: 'Za usporedbu programa A i B spremi i početni program A.'
            };
          else {
            const lib = p.language === 'micropython' ? 'ventil.py' : 'ventil.h';
            const a = {
              ...before.project,
              files: { ...before.project.files, [lib]: trial.project.files[lib] }
            };
            result = await run({ ...trial, project: a, libraryB: false });
          }
        }
        if (result.passed && i === 1 && id === 'V3.6') {
          const parts = before?.project.circuit.components;
          if (
            !parts ||
            !trial.project.circuit.components.some((c) =>
              parts.some((b) => b.id === c.id && (b.x !== c.x || b.y !== c.y))
            )
          )
            result = {
              passed: false,
              explanation: 'Premjesti komponentu i sačuvaj električne veze iz početnog pokusa.'
            };
        }
      }
    }
    checks.push({ ...c, ...result, points: result.passed ? c.maxPoints : 0 });
  }
  return {
    status: 'evaluated',
    points: checks.reduce((total, c) => total + c.points, 0),
    maxPoints: 10,
    criteria: checks,
    message: 'Bodovi se odnose na spremljene pokuse i njihove objavljene kriterije.'
  };
}
