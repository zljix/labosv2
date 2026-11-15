import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, writeFileSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {cpus, totalmem} from 'node:os';
import {setTimeout as delay} from 'node:timers/promises';
import {schoolFixture} from './school-http-fixture.mjs';
import {latencySummary} from './school-load-metrics.mjs';

// Never targets a school URL. The fixture accepts only a separate empty
// labosv2_test_* database and uses loopback HTTP with synthetic identities.
test('23I real PHP/MySQL: 30 students, concurrent saves, class polling and independently graded locked submissions', {timeout: 300000}, async t => {
  const f = await schoolFixture(t), samples = {}, students = [], visibility = [];
  const startedAt = new Date().toISOString(), started = performance.now();
  let verifiedPhases = 0;
  async function phase(name, work) {
    let failure;
    await t.test(name, async () => {
      try {await work(); verifiedPhases++;}
      catch (error) {failure = error; throw error;}
    });
    if (failure) throw Error('Stopped dependent workload after a failed scenario: ' + name, {cause: failure});
  }
  const ok = async (promise, expected = 200) => {const r = await promise; assert.equal(r.status, expected, r.text); return r.json;};
  async function timed(group, promise) {
    const began = performance.now(), result = await ok(promise);
    (samples[group] ??= []).push(performance.now() - began);
    return result;
  }
  const teacher = await f.make('load.teacher', 'teacher');
  for (let index = 0; index < 30; index++) students.push({...await f.make('load.student.' + index), revision: 1});
  const classroom = (await ok(teacher.client.call('create-class', {name: 'Sintetski razred 30', schoolYear: '2026/2027'}), 201)).class;
  const csv = 'username;displayName\n' + students.map(s => s.user.username + ';' + s.user.displayName).join('\n');
  const preview = await ok(teacher.client.call('preview-students', {classId: classroom.id, csv}));
  await ok(teacher.client.call('import-students', {classId: classroom.id, csv, previewToken: preview.previewToken, linkExisting: true}));
  const task = (await ok(teacher.client.call('publish-task', {taskKey: 'gpio/button', gradingProfile: '23E-button-led@1'}), 201)).task;
  const assignment = (await ok(teacher.client.call('create-assignment', {classId: classroom.id, taskVersionId: task.id, target: 'micropython'}), 201)).assignment;
  await phase('30 independent sessions log in and open only their own attempts', async () => {
    for (const student of students) {await ok(student.client.call('logout', {})); student.client = f.client();}
    await Promise.all(students.map(async student => {
      await timed('login', student.client.login(student.user.username, f.password));
      const opened = await timed('begin', student.client.call('begin-attempt', {assignmentId: assignment.id}));
      assert.equal(opened.student.id, student.user.id);
      student.id = opened.attempt.id; student.project = opened.snapshot.project; student.hash = opened.snapshot.contentHash;
    }));
    assert.equal(new Set(students.map(s => s.id)).size, 30);
    await ok(students[0].client.call('attempt&id=' + students[1].id), 403);
  });
  const roster = () => timed('classReview', teacher.client.call('class-work&assignmentId=' + assignment.id));
  await phase('three waves of 30 saves preserve every source; a 5-second teacher cycle sees all acknowledgements', async () => {
    for (let wave = 1; wave <= 3; wave++) {
      const saving = students.map(async (student, index) => {
        const project = structuredClone(student.project);
        project.files['main.py'] += '\n# Sintetski učenik ' + index + ', val ' + wave;
        const saved = (await timed('save', student.client.call('save-work', {attemptId: student.id, expectedRevision: student.revision, requestKey: randomUUID(), project}))).saved;
        student.revision++; student.project = project; student.hash = saved.contentHash; student.ackAt = performance.now();
        assert.equal(saved.revision, student.revision);
      });
      await Promise.all([...saving, roster()]);
      await delay(5000);
      const current = await roster(), observedAt = performance.now();
      assert.equal(current.rows.length, 30);
      for (const student of students) {
        const row = current.rows.find(row => row.student.id === student.user.id);
        assert.equal(row.attempt.id, student.id); assert.equal(row.attempt.revision, student.revision);
        visibility.push(observedAt - student.ackAt);
        const read = await ok(student.client.call('attempt&id=' + student.id));
        assert.equal(read.snapshot.contentHash, student.hash); assert.deepEqual(read.snapshot.project, student.project);
      }
    }
  });
  await phase('a second device resumes the exact snapshot, and a stale save is rejected without data loss', async () => {
    const first = students[0], otherDevice = f.client();
    await ok(otherDevice.login(first.user.username, f.password));
    const loaded = await ok(otherDevice.call('attempt&id=' + first.id));
    assert.equal(loaded.snapshot.contentHash, first.hash); assert.deepEqual(loaded.snapshot.project, first.project);
    const stale = await otherDevice.call('save-work', {attemptId: first.id, expectedRevision: 1, requestKey: randomUUID(), project: first.project});
    assert.equal(stale.status, 409);
    assert.equal((await ok(first.client.call('attempt&id=' + first.id))).snapshot.contentHash, first.hash);
  });
  let finalWaveStarted;
  await phase('30 simultaneous finalizations and repeated lost-response requests create exactly 30 immutable submissions', async () => {
    finalWaveStarted = performance.now();
    await Promise.all(students.map(async student => {
      student.finish = {attemptId: student.id, expectedRevision: student.revision, requestKey: randomUUID()};
      const result = await timed('finish', student.client.call('finish-attempt', student.finish));
      student.submission = result.submission;
      assert.equal(result.submission.contentHash, student.hash);
      assert.equal(result.submission.revision, student.revision);
    }));
    await Promise.all(students.map(async student => {
      const repeated = await ok(student.client.call('finish-attempt', student.finish));
      assert.equal(repeated.submission.id, student.submission.id);
    }));
    assert.equal(f.sql('SELECT COUNT(*) AS n FROM school_submissions')[0].n, 30);
    assert.equal(f.sql("SELECT COUNT(*) AS n FROM audit_events WHERE event='attempt.submitted'")[0].n, 30);
    const late = await students[0].client.call('save-work', {attemptId: students[0].id, expectedRevision: 4, requestKey: randomUUID(), project: students[0].project});
    assert.equal(late.status, 409); assert.equal(late.json.error.code, 'attempt_locked');
  });
  let workerJobs = 0, finalWaveMs;
  const completedJobs = new Set();
  await phase('two private workers independently execute all 30 final snapshots; points and hashes match the class export', async () => {
    const worker = () => new Promise((done, reject) => {
      const process = spawn(globalThis.process.execPath, [join(f.pkg, 'tools/grade-once.mjs')], {env: f.env, stdio: ['ignore', 'pipe', 'pipe']});
      let out = '', err = '';
      const deadline = setTimeout(() => {process.kill('SIGKILL'); reject(Error('Private worker timed out.'));}, 45000);
      process.stdout.on('data', bytes => {out += bytes; if (out.length > 1000000) process.kill('SIGKILL');});
      process.stderr.on('data', bytes => {err = (err + bytes).slice(-2000);});
      process.on('error', error => {clearTimeout(deadline); reject(error);});
      process.on('close', code => {clearTimeout(deadline); if (code !== 0) return reject(Error(err || 'Private worker failed.')); try {done(JSON.parse(out));} catch (error) {reject(error);}});
    });
    async function drain() {
      for (let n = 0; n < 35; n++) {
        const result = await worker();
        if (result.status === 'idle') return;
        assert.equal(result.status, 'evaluated', 'A private worker must return a real evaluated result.');
        assert(!completedJobs.has(result.jobId), 'Parallel workers must not deliver the same job twice.');
        completedJobs.add(result.jobId);
        workerJobs++;
      }
      throw Error('Queue did not drain within the bounded synthetic workload.');
    }
    await Promise.all([drain(), drain()]);
    finalWaveMs = performance.now() - finalWaveStarted;
    assert.equal(workerJobs, 30);
    assert.equal(f.sql('SELECT MAX(deliveries) AS n FROM grading_jobs')[0].n, 1);
    const current = await roster(), exported = await ok(teacher.client.call('export-achievements&classId=' + classroom.id));
    assert.equal(current.rows.length, 30); assert.equal(exported.rows.length, 30);
    for (const student of students) {
      const actual = await ok(student.client.call('attempt&id=' + student.id));
      assert.equal(actual.submission.id, student.submission.id);
      assert.equal(actual.submission.contentHash, student.hash);
      assert.equal(actual.submission.grading.status, 'evaluated');
      assert.equal(actual.submission.grading.points, 10);
      assert.equal(actual.submission.grading.report.snapshotHash, student.hash);
      const row = current.rows.find(row => row.student.id === student.user.id);
      const entry = exported.rows.find(row => row.student.id === student.user.id);
      assert.equal(row.lastSubmission.id, student.submission.id);
      assert.equal(row.lastSubmission.grading.points, 10);
      assert.equal(entry.submission.id, student.submission.id); assert.equal(entry.assessment.points, 10);
    }
  });
  assert.equal(verifiedPhases, 5, 'Do not publish a successful load report after a failed scenario.');
  assert.equal(samples.save.length, 90);
  // Metrics are evidence, not assertions about another server or real pupils.
  const queueTimes = f.sql("SELECT TIMESTAMPDIFF(MICROSECOND,j.created_at,j.finished_at)/1000 AS ms FROM grading_jobs j JOIN school_submissions s ON s.attempt_id=j.attempt_id AND s.revision=j.revision WHERE j.status='evaluated'").map(row => Number(row.ms));
  assert.equal(queueTimes.length, 30);
  const phpVersion = spawnSync(process.env.PHP_BIN || 'php', ['-r', 'echo PHP_VERSION;'], {encoding: 'utf8'});
  assert.equal(phpVersion.status, 0);
  const metrics = Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, latencySummary(values)]));
  const report = {
    format: 'labosv2-synthetic-class-load', version: 1, stage: '23I', releaseVersion: JSON.parse(readFileSync('package.json')).version,
    recordedAt: new Date().toISOString(), startedAt, authority: 'automated-synthetic-test', scope: 'development-loopback-PHP-CLI-MySQL',
    appBuild: JSON.parse(readFileSync(join(f.pkg, 'package-inventory.json'))).appBuild, sourceCommit: process.env.GITHUB_SHA ?? null,
    environment: {os: process.platform, architecture: process.arch, node: process.version, logicalCPUs: cpus().length, hostMemoryBytes: totalmem(),
      php: phpVersion.stdout, mysql: f.sql('SELECT VERSION() AS version')[0].version, phpWorkers: 4, gradingWorkers: 2},
    workload: {students: 30, teachers: 1, target: 'micropython', rubric: '23E-button-led@1', saveWaves: 3, teacherIntervalMs: 5000,
      finalSubmissions: 30, finalGradingJobs: workerJobs, workerStart: 'after sealing: queued final wave, not ordinary grading latency'},
    metrics, visibility: latencySummary(visibility), finalQueueResidence: latencySummary(queueTimes), finalWaveMs: Math.round(finalWaveMs),
    durationMs: Math.round(performance.now() - started),
    integrity: {distinctStudentAttempts: 30, sourceRoundTrips: 90, immutableSubmissions: 30, independentlyEvaluated: workerJobs, evaluatedPointsPerSubmission: 10, exportRows: 30},
    targets: {saveP95Ms: 2000, classReviewP95Ms: 2000, teacherVisibilityMs: 10000,
      saveTargetMet: metrics.save.p95Ms <= 2000, classReviewTargetMet: metrics.classReview.p95Ms <= 2000, teacherVisibilityTargetMet: Math.max(...visibility) <= 10000},
    limitations: ['Synthetic identities, loopback and PHP CLI; not school Apache/HTTPS/LAN or a real pupil pilot.',
      'One MicroPython rubric; the full supported matrix has separate regression tests.',
      'Queue residence includes a deliberately stopped worker until finalization; it is not the 15-second ordinary-work target.',
      'No Windows/iOS/Android browser, physical hardware or aggregate cgroup memory acceptance is inferred.'],
  };
  mkdirSync('docs/stage23i-evidence', {recursive: true});
  writeFileSync('docs/stage23i-evidence/load.json', JSON.stringify(report, null, 2) + '\n');
  t.diagnostic('LOAD_REPORT ' + JSON.stringify(report));
});
