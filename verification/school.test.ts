import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve, join} from 'node:path';
import {gradeProject} from '../school/grader/index';
import {proofFixtures} from '../school/grader/fixtures';
import {sandboxCommand, runSandbox} from '../school/grader/sandbox.mjs';
import {readFileSync} from 'node:fs';
import {importProject, exportZip} from '../src/project/archive';
import {AVREngine} from '../src/runtime/avrEngine';
import {compileCircuit} from '../src/circuit/compile';
import {validateArtifact} from '../public/avr-contract.mjs';

const root = process.cwd();
test('actual 22I reviewed ZIP reopens unchanged and executes its exact original AVR program', async () => {
  const project = importProject(new Uint8Array(readFileSync('docs/stage22i-evidence/browser-reviewed.zip')), 'predaja22I.zip');
  assert.deepEqual(importProject(exportZip(project), 'ponovno.zip'), project);
  const artifact = await validateArtifact(project, JSON.parse(project.files['avr-build.json']));
  const events: any[] = [], engine = new AVREngine(artifact.hex, compileCircuit(project.circuit as any, 'avr'), event => events.push(event), 6, artifact.staticRamBytes);
  try {
    for (let step = 0; step < 175; step++) { engine.runCycles(64000); engine.frame(); }
    const frames = events.filter(event => event.type === 'simulation');
    assert(frames.some(frame => Object.values(frame.leds).some((led: any) => led.currentMa > 1)));
    assert(frames.some(frame => Object.values(frame.leds).some((led: any) => led.currentMa === 0)));
  } finally { engine.dispose(); }
});
test('real MicroPython reference and alternate implementations follow trusted input stimuli', async () => {
  const fixtures = proofFixtures();
  for (const project of [fixtures.python, fixtures.alternate]) {
    const report = await gradeProject(project, {root});
    assert.equal(report.status, 'evaluated', report.message); assert.equal(report.points, 10);
    assert.equal(report.samples.length, 5); assert.equal(report.authority, 'feasibility-only');
  }
});
test('printed fake points and constant LOW cannot pass input-dependent criteria', async () => {
  const project: any = proofFixtures().wrong; project.score = 10;
  const report = await gradeProject(project, {root});
  assert.equal(report.status, 'evaluated', report.message); assert.equal(report.points, 2);
  assert.equal(report.criteria[1].points, 0); assert.equal(report.criteria[2].points, 0);
});
test('electrically equivalent visual layout preserves the result', async () => {
  const project = proofFixtures().alternate;
  if (project.circuit.kind !== 'editable') throw Error();
  for (const part of project.circuit.components) { part.x += 80; part.y += 40; }
  for (const wire of project.circuit.wires) wire.points = [{x: 20, y: 20}];
  const report = await gradeProject(project, {root}); assert.equal(report.points, 10, report.message);
});
test('AVR uses the trusted exact-source binary and ignores a forged uploaded artifact', async () => {
  const project = proofFixtures().arduino;
  project.files['avr-build.json'] = JSON.stringify({hex: 'FORGED', points: 10});
  const report = await gradeProject(project, {root});
  assert.equal(report.status, 'evaluated', report.message); assert.equal(report.points, 10);
  assert.equal(report.provenance.method, 'trusted-catalogue-exact-source');
});
test('AVR source changes require recompilation and never run a stale binary', async () => {
  const project = proofFixtures().changed;
  const report = await gradeProject(project, {root});
  assert.equal(report.status, 'unsupported'); assert.equal(report.points, null);
});
test('busy Python is terminated with a distinct execution limit and no invented zero', async () => {
  const project = proofFixtures().python; project.files['main.py'] = 'while True:\n pass\n';
  const report = await gradeProject(project, {root, timeoutMs: 700});
  assert.equal(report.status, 'execution_limit'); assert.equal(report.points, null);
});
test('syntax errors are student program errors rather than a successful result', async () => {
  const project = proofFixtures().python; project.files['main.py'] = 'while :\n';
  const report = await gradeProject(project, {root});
  assert.equal(report.status, 'program_error'); assert.equal(report.points, 0);
});
test('sandbox hides host files and environment, denies children and has no network', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'labosv2-probe-'));
  try {
    const path = join(directory, 'probe.mjs');
    await writeFile(path, `import fs from 'node:fs';import cp from 'node:child_process';let files=false,children=false,network=false;try{fs.readFileSync('/etc/passwd')}catch{files=true}try{cp.execFileSync('/usr/bin/true')}catch{children=true}try{await fetch('http://1.1.1.1',{signal:AbortSignal.timeout(500)})}catch{network=true}console.log(JSON.stringify({files,children,network,secret:process.env.LAB_DB_PASSWORD??null}));`);
    const report: any = await runSandbox(sandboxCommand(root, path), {}, 3000);
    assert.deepEqual(report, {files: true, children: true, network: true, secret: null});
  } finally { await rm(directory, {recursive: true, force: true}); }
});
test('missing sandbox prerequisites fail closed rather than rerunning on the host', async () => {
  const report = await gradeProject(proofFixtures().python, {root: resolve(root, 'missing-school-root')});
  assert.equal(report.status, 'technical_error'); assert.equal(report.points, null);
});
