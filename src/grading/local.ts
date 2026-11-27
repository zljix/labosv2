import { buildFile, validateArtifact } from '../../public/arduino-contract.mjs';
import { cachedBuild, rememberBuild } from '../runtime/arduinoBuild';
import { compileBrowserS3 } from '../runtime/offlineS3';
import { OFFLINE_AVR, loadOffline, offlineInput } from '../runtime/offlineAvr';
import { validateResult } from '../../prototypes/avr-offline/compiler.mjs';
import type { Project } from '../project/model';
import { appAsset } from '../platform/assets';
import { practices, type ExerciseId } from '../lessons/collectionPlans';
import { assessCollection, type CheckResult, type Trial } from './collections';
export const localBuildFile = (lab: boolean, i: number) =>
  lab ? 'P' + (i + 1) + '-build.json' : ['pokus-prije-build.json', 'pokus-poslije-build.json'][i];

export async function captureBuild(p: Project, raw?: string) {
  if (p.language !== 'arduino-cpp') return;
  for (const item of [raw, p.files[buildFile(p)]]) {
    if (item)
      try {
        const value = JSON.parse(item);
        try {
          return await validateArtifact(p, value);
        } catch {
          if (OFFLINE_AVR) return await validateResult(offlineInput(p), value);
        }
      } catch {
        /* Try a different source-bound compilation. */
      }
  }
  const existing = await cachedBuild(p);
  if (existing) return existing;
  if (OFFLINE_AVR && p.runtimeProfile.id === 'arduino-avr')
    try {
      return await loadOffline(p);
    } catch {}
}
async function localTrial(
  t: Trial,
  original: Project,
  seed: number,
  signal: AbortSignal
): Promise<CheckResult> {
  const [group, id] = t.key.split('/');
  let artifact: any;
  if (t.project.language === 'arduino-cpp') {
    const raw = original.files[localBuildFile(group === 'urs-lv', t.index)];
    artifact =
      (await captureBuild(t.project, raw)) ||
      (await captureBuild(t.project, original.files[buildFile(original)]));
    if (!artifact) {
      const rig = group === 'urs-lv' ? null : practices[id as ExerciseId].rig;
      const paths =
        rig === 'network'
          ? ['', '-mqtt', '-tcp'].map((s) => 'pokusi/network/pocetni' + s + '.json')
          : rig
            ? ['pokusi/' + rig + '/pocetni.json']
            : ['zbirke/urs-lv/' + id + '/pocetni.avr.json'];
      for (const path of paths) {
        const response = await fetch(appAsset(path), { signal });
        if (response.ok) {
          const value = await response.json();
          try {
            artifact = await validateArtifact(t.project, value);
            break;
          } catch {}
        }
      }
    }
    if (!artifact && t.libraryB === false && t.project.runtimeProfile.id !== 'arduino-avr') {
      artifact = await compileBrowserS3(t.project, signal, () => {});
      await rememberBuild(t.project, artifact);
    }
    if (!artifact)
      throw Error(
        'Nedostaje prijevod za ' +
          (group === 'urs-lv' ? 'P' + (t.index + 1) : t.index ? 'izmijenjeni pokus' : 'početni pokus') +
          '. Prevedi tu inačicu i ponovno je spremi. Školski provjeravač prevodi spremljeni izvor.'
      );
  }
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./trialWorker.ts', import.meta.url), { type: 'module' });
    const cleanup = () => {
      worker.terminate();
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      reject(Error('Provjera je prekinuta.'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(Error('Provjera je dosegla vremensko ograničenje. Bodovi za ovu provjeru nisu dodijeljeni.'));
    }, 90000);
    signal.addEventListener('abort', abort, { once: true });
    worker.onerror = () => {
      cleanup();
      reject(Error('Provjeravač se nije mogao pokrenuti.'));
    };
    worker.onmessage = ({ data }) => {
      cleanup();
      if (data.result) resolve(data.result);
      else reject(Error(data.error));
    };
    worker.postMessage({ trial: t, artifact, seed });
  });
}
export function localAssessment(key: string, p: Project, signal: AbortSignal) {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  return assessCollection(key, p, (t) => localTrial(t, p, seed, signal));
}
