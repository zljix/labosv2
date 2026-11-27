import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import registry from '../school/grader/profiles.json';
import { gradingCoverage } from '../school/grader/coverage';
import { gradeJob } from '../school/grader/official';
import { jobFor } from './school-contract-fixture';
import { modifiedPractice } from './collection-solution-fixture';
import { practiceCriteria } from '../src/grading/practiceCriteria';
import type { ExerciseId } from '../src/lessons/collectionPlans';
import { collectionProfile } from '../src/grading/collections';
import { trialFile, trialSnapshot, responseFile } from '../src/grading/snapshot';
import { defaultScale, proposedGrade } from '../src/grading/marks';
import { cleanCollectionSources } from '../src/platform/collectionPrivacy';
import type { Project } from '../src/project/model';

function starter(set: string, id: string, target = 'micropython'): Project {
  return JSON.parse(
    readFileSync('.build/school-catalog/' + set + '-' + id.replace('.', '_') + '-' + target + '.json', 'utf8')
  );
}
async function official(key: string, p: Project) {
  return gradeJob(jobFor(p, collectionProfile(key)), { root: process.cwd() });
}

test('every published collection/target has its own current executable rubric and sums to ten', () => {
  const matrix = gradingCoverage('test');
  assert.deepEqual(matrix.totals, { exercises: 138, combinations: 388, supported: 388 });
  assert.equal(matrix.collections.length, 115);
  for (const row of matrix.collections) {
    const profile = collectionProfile(row.taskKey);
    assert.deepEqual(
      registry.profiles.find((p) => p.id === row.grading.profileId),
      profile
    );
    assert.equal(
      profile.criteria.reduce((n, c) => n + c.maxPoints, 0),
      10
    );
    assert(profile.targets.includes(row.target));
  }
  assert.deepEqual(
    [0, 4, 5, 6, 6.5, 7.9, 8, 9, 10].map((n) => proposedGrade(n, 10, defaultScale)),
    [1, 1, 2, 2, 3, 3, 4, 5, 5]
  );
  assert.equal(proposedGrade(7, 10, [40, 55, 70, 85]), 4);
});

test('school checks the two saved MicroPython programs independently of editable output and current source', async () => {
  const p = starter('iot', 'P0'),
    key = 'iot/P0';
  p.files['pocetni-pokus.txt'] = 'Pozdrav iz Labosa';
  p.files['izmijenjeni-pokus.txt'] = 'Moj uspješan pokus';
  assert.equal((await official(key, p)).points, 0);
  p.files[trialFile(0)] = trialSnapshot(p);
  p.files[responseFile] = '2';
  p.files[trialFile(1)] = trialSnapshot(p);
  assert.equal((await official(key, p)).points, 5);
  p.files['main.py'] = p.files['main.py'].replace('Pozdrav iz Labosa', '3.e').replace('1000', '2000');
  p.files[trialFile(1)] = trialSnapshot(p);
  p.files['main.py'] = 'print("nespremljena izmjena")';
  const correct = await official(key, p);
  assert.equal(correct.status, 'evaluated', JSON.stringify(correct));
  assert.equal(correct.points, 10);
  assert.deepEqual(
    correct.criteria.map((c: any) => c.points),
    [3, 5, 2]
  );
  p.files[trialFile(0)] = '{bad';
  p.files[responseFile] = '3';
  assert.equal((await official(key, p)).points, 5);
});

test('S3 C++ uses the installed binary bound to the saved source and does not grade an unavailable compiler as zero', async () => {
  const p = starter('us', 'P0', 's3-cpp');
  p.files[trialFile(0)] = trialSnapshot(p);
  assert.equal((await official('us/P0', p)).points, 3);
  p.files['main.ino'] = p.files['main.ino'].replace('Pozdrav iz Labosa', 'Promjena');
  p.files[trialFile(1)] = trialSnapshot(p);
  p.files['pokus-poslije-build.json'] = p.files['s3-build.json'];
  const result = await official('us/P0', p);
  assert.equal(result.points, null);
  assert.equal(result.status, 'technical_error');
});

test('a completed or missing PLC level cannot substitute for another saved level', async () => {
  const p = starter('urs-lv', 'LV16');
  const decl = p.files['deklaracije.txt'].replace(
    'END_VAR',
    'Ready : BOOL;\nRequest : BOOL;\nWaitStart : TON;\nFaultLatched : BOOL;\nReset : BOOL;\nEND_VAR'
  );
  const edge = 'StartEdge := Start AND NOT StartOld; StartOld := Start;';
  const control =
    'IF NOT StopOK OR NOT ProtectionOK THEN Request := FALSE; ELSIF StartEdge THEN Request := TRUE; END_IF;';
  const timer = 'WaitStart(IN := Request, PT := T#2s); Motor := WaitStart.Q;';
  for (const n of [1, 2, 3]) p.files['P' + n + '-deklaracije.txt'] = decl;
  p.files['P1-program.txt'] = p.files['program.txt'] + '\nReady := StopOK AND ProtectionOK AND NOT Motor;';
  p.files['P2-program.txt'] = [edge, control, timer].join('\n');
  p.files['P3-program.txt'] = [
    edge,
    'IF NOT ProtectionOK THEN FaultLatched := TRUE; ELSIF Reset AND StopOK AND NOT Start THEN FaultLatched := FALSE; END_IF;',
    'IF FaultLatched OR NOT StopOK OR NOT ProtectionOK THEN Motor := FALSE; ELSIF StartEdge THEN Motor := TRUE; END_IF;'
  ].join('\n');
  const report = await official('urs-lv/LV16', p);
  assert.deepEqual(
    report.criteria?.map((c: any) => c.points),
    [3, 3, 4],
    JSON.stringify(report)
  );
  p.files['P2-program.txt'] = p.files['P1-program.txt'];
  delete p.files['P3-program.txt'];
  assert.equal((await official('urs-lv/LV16', p)).points, 3);
});

test('saving an offline snapshot for school removes temporary binaries and redacts nested station settings', () => {
  const p = starter('iot', 'P0');
  p.files['wifi.py'] = 'WIFI_PASSWORD = "tajna"';
  p.files[trialFile(0)] = trialSnapshot(p);
  p.files['pokus-prije-build.json'] = 'binary';
  cleanCollectionSources(p);
  assert.equal(p.files['pokus-prije-build.json'], undefined);
  assert(!p.files[trialFile(0)].includes('tajna'));
  assert(JSON.parse(p.files[trialFile(0)]).files['main.py']);
});

test('original and modified MicroPython experiments receive full points for every distinct IoT/US worksheet', async () => {
  const failures = [];
  for (const id of Object.keys(practiceCriteria) as ExerciseId[]) {
    const track = id.startsWith('V3.') ? 'us' : 'iot',
      p = starter(track, id);
    p.files[trialFile(0)] = trialSnapshot(p);
    const inputs = modifiedPractice(id, p);
    p.files[trialFile(1)] = trialSnapshot(p, inputs);
    p.files[responseFile] = String(practiceCriteria[id].answer + 1);
    const r = await official(track + '/' + id, p);
    if (r.points !== 10)
      failures.push([id, r.status, r.criteria?.filter((c: any) => !c.passed).map((c: any) => c.id)]);
  }
  assert.deepEqual(failures, []);
});
test(
  'Nano re-compiles three independent LED sketches before scoring their actual electrical waveform',
  { skip: !process.env.LAB_ARDUINO_CLI, timeout: 180000 },
  async () => {
    const p = starter('urs-lv', 'LV01', 'nano');
    const blink = (times: string) =>
      `void setup(){pinMode(13, OUTPUT);}\nvoid loop(){for(byte i=0;i<${times};i++){digitalWrite(13,HIGH);delay(200);digitalWrite(13,LOW);delay(200);}delay(1000);}`;
    p.files['P1-program.txt'] =
      'void setup(){pinMode(13, OUTPUT);} void loop(){digitalWrite(13,HIGH);delay(200);digitalWrite(13,LOW);delay(200);}';
    p.files['P2-program.txt'] = blink('2');
    p.files['P3-program.txt'] = 'const byte BROJ_TREPTAJA=3;\n' + blink('BROJ_TREPTAJA');
    const job = jobFor(p, collectionProfile('urs-lv/LV01'));
    const r = await gradeJob(job, {
      root: process.cwd(),
      compile: true,
      cli: process.env.LAB_ARDUINO_CLI,
      data: process.cwd() + '/avr-env/data'
    });
    assert.deepEqual(
      r.criteria?.map((c: any) => c.points),
      [3, 3, 4],
      JSON.stringify(r)
    );
  }
);
