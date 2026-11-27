import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assessCollection, type Trial, type CheckResult } from '../../src/grading/collections';
import type { Project } from '../../src/project/model';
import { practices, type ExerciseId } from '../../src/lessons/collectionPlans';
import { inputHash, validateArtifact } from '../../public/arduino-contract.mjs';
import { runSandbox, sandboxCommand } from './sandbox.mjs';

interface Options {
  root: string;
  compile?: boolean;
  cli?: string;
  data?: string;
  s3Toolchain?: string;
  clang?: string;
  opt?: string;
  timeoutMs?: number;
}
export async function gradeCollection(key: string, project: Project, seed: string, options: Options) {
  const { root } = options,
    [set, id] = key.split('/');
  const cache = new Map<string, any>();
  async function trustedArtifact(p: Project, hash: string) {
    if (cache.has(hash)) return cache.get(hash);
    const rig = set === 'urs-lv' ? null : practices[id as ExerciseId].rig;
    const paths =
      rig === 'network'
        ? ['', '-mqtt', '-tcp'].map((s) => 'pokusi/network/pocetni' + s + '.json')
        : rig
          ? ['pokusi/' + rig + '/pocetni.json']
          : ['zbirke/urs-lv/' + id + '/pocetni.avr.json'];
    for (const path of paths) {
      const candidate = JSON.parse(await readFile(resolve(root, 'public', path), 'utf8'));
      // The installed S3 browser and native compiler formats hash different build contracts.
      // Validate the file against its own pinned contract before caching under this source key.
      try {
        const artifact = await validateArtifact(p, candidate);
        cache.set(hash, artifact);
        return artifact;
      } catch {
        continue;
      }
    }
  }
  async function check(trial: Trial): Promise<CheckResult> {
    const p = trial.project;
    let artifact;
    if (p.language === 'arduino-cpp') {
      const hash = await inputHash(p);
      artifact = await trustedArtifact(p, hash);
      if (!artifact) {
        if (!options.compile)
          throw Error(
            'Promijenjeni C++ program čeka školski prevoditelj. Uključi izolirano prevođenje i ponovi provjeru.'
          );
        const avr = p.runtimeProfile.id === 'arduino-avr';
        const command = avr
          ? sandboxCommand(root, resolve(root, 'school/grader/compile-child.mjs'), {
              compiler: true,
              cli: options.cli,
              data: options.data,
              bounded: true
            })
          : sandboxCommand(root, resolve(root, 'school/grader/s3-compile-child.mjs'), {
              s3Compiler: true,
              toolchainRoot: options.s3Toolchain,
              bounded: true
            });
        const result: any = await runSandbox(
          command,
          avr ? p : { project: p, clang: options.clang ?? 'clang++-19', opt: options.opt ?? 'wasm-opt' },
          90000
        );
        if (result.status === 'compile_error')
          return {
            passed: false,
            explanation: 'Prevođenje ove spremljene inačice nije uspjelo. Provjeri dijagnostiku prevoditelja.'
          };
        if (result.status !== 'compiled') throw Error('Školski prevoditelj nije dostupan.');
        artifact = await validateArtifact(p, result.artifact);
        cache.set(hash, artifact);
      }
    }
    return (await runSandbox(
      sandboxCommand(root, resolve(root, '.build/school-grader/collection-child.mjs'), {
        bounded: true,
        cpuSeconds: 58
      }),
      { trial, artifact, seed: parseInt(seed.slice(0, 8), 16) },
      options.timeoutMs ?? 65000
    )) as CheckResult;
  }
  try {
    return await assessCollection(key, project, check);
  } catch (e) {
    const limit = ['EXECUTION_LIMIT', 'OUTPUT_LIMIT', 'MEMORY_LIMIT'].includes((e as any).code);
    return {
      status: limit ? 'execution_limit' : 'technical_error',
      points: null,
      message: limit
        ? 'Dosegnuto je ograničenje izvođenja pokusa.'
        : !options.compile && String(e).includes('čeka školski')
          ? (e as Error).message
          : 'Provjeravač nije mogao dovršiti pokuse. Provjeri školski servis i ponovi provjeru.'
    };
  }
}
