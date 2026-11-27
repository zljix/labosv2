import { practiceScenario } from './practiceReplay';
import { labScenario } from './labReplay';
import { replay, type MPResources } from './replay';
import { success, type Trial, type CheckResult } from './collections';
import type { LabId } from '../lessons/ursLab';
import type { ExerciseId } from '../lessons/collectionPlans';

export async function runTrial(
  trial: Trial,
  artifact: any,
  seed: number,
  resources?: MPResources
): Promise<CheckResult> {
  const [track, id] = trial.key.split('/'),
    lab = track === 'urs-lv';
  const checkB = trial.index === 1 && ['V4.2', 'V4.3'].includes(id) && trial.libraryB !== false;
  const plan = lab
    ? labScenario(id as LabId, trial.index + 1, trial.project, seed, trial.label)
    : practiceScenario(id as ExerciseId, trial.index === 1, trial.project, trial.inputs, seed, checkB);
  const stages = await replay(trial.project, artifact, plan.steps, resources);
  return plan.check(stages)
    ? success
    : {
        passed: false,
        explanation: lab
          ? 'U pokusu P' +
            (trial.index + 1) +
            ' izmjereni izlazi ili ispis nisu ispunili uvjet uz podzadatak.'
          : 'Usporedi spremljeni sklop, ulaze i izlaz programa s opisom ovoga kriterija.'
      };
}
