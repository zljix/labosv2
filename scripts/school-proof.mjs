import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gradeProject} from '../.build/school-grader/index.mjs';
import {proofFixtures} from '../.build/school-grader/fixtures.mjs';

const root = process.cwd(), fixtures = proofFixtures(), results = [];
const directory = resolve(process.env.LAB_PROOF_OUTPUT ?? 'docs/stage23a-evidence');
await mkdir(directory, {recursive: true});
for (const [name, project] of Object.entries(fixtures)) {
  const compile = ['changed', 'arduinoWrong'].includes(name);
  const result = await gradeProject(project, {root, compile, cli: process.env.LAB_ARDUINO_CLI, data: process.env.LAB_ARDUINO_DATA});
  const expected = ['wrong', 'arduinoWrong'].includes(name) ? 2 : 10;
  const pass = result.status === 'evaluated' && result.points === expected;
  results.push({name, expected, pass, result});
  await writeFile(resolve(directory, name + '.project.json'), JSON.stringify(project, null, 2) + '\n');
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}: ${result.points ?? result.status}/${result.maxPoints ?? 10}`);
}
const report = {stage: '23A', generatedAt: new Date().toISOString(), node: process.version, platform: process.platform + '/' + process.arch,
  scope: 'Independent feasibility proof; no school users or official grade records.', results, passed: results.filter(item => item.pass).length, total: results.length};
await writeFile(resolve(directory, 'grading.json'), JSON.stringify(report, null, 2) + '\n');
if (report.passed !== report.total) process.exitCode = 1;
