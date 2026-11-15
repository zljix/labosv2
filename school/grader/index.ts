import {readFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseProject} from '../../src/project/model';
import {compileCircuit} from '../../src/circuit/compile';
import {UNO, NANO, S3} from '../../src/boards/profiles';
import {buildInput, inputHash, validateArtifact} from '../../public/avr-contract.mjs';
import {sandboxCommand, runSandbox} from './sandbox.mjs';

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function gradeProject(input: unknown, options: {root: string; compile?: boolean; cli?: string; data?: string; timeoutMs?: number}) {
  const started = performance.now();
  let project;
  try { project = parseProject(input); } catch (error) {
    return {status: 'invalid_project', points: null, message: (error as Error).message, authority: 'feasibility-only'};
  }
  const snapshotHash = hash(project), base = {format: 'labosv2-grading-proof', version: 1, checkerVersion: '23A.1', rubric: '23A-button-led@1', authority: 'feasibility-only', snapshotHash,
    runtimeProfile: project.runtimeProfile, boardId: project.board.id, sourceRevision: project.revision};
  const root = resolve(options.root), build = resolve(root, '.build/school-grader');
  if (project.radio || project.circuit.kind !== 'editable' || !((project.language === 'micropython' && project.board.id === S3) || (project.language === 'arduino-cpp' && [UNO, NANO].includes(project.board.id as typeof UNO)))) {
    return {...base, status: 'unsupported', points: null, message: 'Dokaz 23A podržava jedan MicroPython S3 ili AVR Uno/Nano čvor s tipkalom i LED-icom.'};
  }
  // Incoming scores, console traces and incoming binaries never choose the result.
  let artifact: any, provenance: any = {method: 'source-execution'};
  try {
    let circuit;
    try { circuit = compileCircuit(project.circuit, project.language === 'micropython' ? 'micropython' : 'avr'); }
    catch (error) { return {...base, status: 'invalid_circuit', points: null, message: (error as Error).message}; }
    if (circuit.leds.length !== 1 || circuit.buttons.length !== 1) return {...base, status: 'unsupported', points: null, message: 'Probna rubrika 23A traži točno jednu LED-icu i jedno tipkalo.'};
    const checker = createHash('sha256');
    for (const path of ['.build/school-grader/index.mjs', '.build/school-grader/child.mjs', 'public/machine.py', 'public/runtime/micropython.mjs', 'public/runtime/micropython.wasm']) checker.update(await readFile(resolve(root, path)));
    const checkerHash = checker.digest('hex');
    if (project.language === 'arduino-cpp') {
      if (options.compile) {
        const result: any = await runSandbox(sandboxCommand(root, resolve(root, 'school/grader/compile-child.mjs'), {compiler: true, cli: options.cli, data: options.data}), project, 90000);
        if (result.status !== 'compiled') return {...base, ...result, points: null};
        artifact = await validateArtifact(project, result.artifact);
        provenance = {method: 'isolated-source-compilation', inputHash: artifact.inputHash, hexHash: artifact.hexHash, toolchain: artifact.toolchain};
      } else {
        const catalogue = JSON.parse(await readFile(resolve(root, 'public/avr-examples.json'), 'utf8'));
        const wanted = await inputHash(project);
        const entry: any = Object.values(catalogue[project.board.id] ?? {}).find((item: any) => item.inputHash === wanted);
        if (!entry) return {...base, status: 'unsupported', points: null, message: 'Izvor nema točan pouzdani katalogski artefakt. Potrebno je novo izolirano prevođenje (--compile).'};
        artifact = await validateArtifact(project, entry);
        provenance = {method: 'trusted-catalogue-exact-source', inputHash: wanted, hexHash: artifact.hexHash, toolchain: buildInput(project).toolchain};
      }
    }
    const result: any = await runSandbox(sandboxCommand(root, resolve(build, 'child.mjs')), {project, artifact}, options.timeoutMs ?? 10000);
    return {...base, ...result, checkerHash, provenance, durationMs: Math.round(performance.now() - started), isolation: 'Linux user+network+mount+PID namespaces; read-only inputs; empty environment'};
  } catch (error) {
    const limit = ['EXECUTION_LIMIT', 'OUTPUT_LIMIT'].includes((error as any).code);
    return {...base, status: limit ? 'execution_limit' : 'technical_error', points: null, message: (error as Error).message, durationMs: Math.round(performance.now() - started)};
  }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), path = args.find(arg => !arg.startsWith('--'));
  if (!path) { console.error('node .build/school-grader/index.mjs projekt.json [--compile]'); process.exitCode = 2; }
  else {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
    const bytes = await readFile(path); if (bytes.length > 2097152) throw Error('Projekt prelazi 2 MiB.');
    const report = await gradeProject(JSON.parse(bytes.toString('utf8')), {root, compile: args.includes('--compile'), cli: process.env.LAB_ARDUINO_CLI, data: process.env.LAB_ARDUINO_DATA});
    console.log(JSON.stringify(report, null, 2));
    if (report.points === null) process.exitCode = 2;
  }
}
