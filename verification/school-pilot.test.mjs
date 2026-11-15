import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {schoolPilotChecks, schoolPilotSummary, createSchoolPilotRecord, importSchoolPilotRecord} from '../public/school-pilot-record.mjs';
import {mountSchoolPilot} from '../public/school-pilot-form.mjs';
import {assertSchoolLiveness} from '../scripts/school-host-checks.mjs';
import {latencySummary} from './school-load-metrics.mjs';

const blank = () => ({scope: 'development', students: 0, target: 'micropython', checks: {}, metrics: {}});
const observed = () => ({...blank(), date: '2026-11-15', releaseVersion: '0.13.8-beta.1', installation: 'Testna instalacija A',
  server: 'Linux, PHP/MySQL, 2 radnika', devices: 'Linux PC', browsers: 'Chromium', method: '90 spremanja; loopback; 30 sintetskih sesija',
  conclusion: 'Zabilježena je samo razvojna provjera.', checks: Object.fromEntries(schoolPilotChecks.map(([id]) => [id, {status: 'pass', notes: 'Proveden postupak i uspoređen rezultat.'}]))});

test('a blank school pilot remains a draft and missing measurements never become zero', () => {
  const record = createSchoolPilotRecord(blank(), '0.13.8-beta.1');
  assert.equal(record.classification, 'draft'); assert.equal(record.summary.untested, 14);
  assert.equal(record.summary.allObservedPassed, false);
  assert(record.summary.metrics.every(value => value.valueMs === null && value.meetsTarget === null));
  const zero = createSchoolPilotRecord({...blank(), method: 'Jedan stvarno izmjeren uzorak', metrics: {saveP95Ms: 0}}, 'v');
  assert.equal(zero.summary.metrics[0].valueMs, 0); assert.equal(zero.summary.metrics[0].meetsTarget, true);
});
test('even an all-pass development record retains its scope and observer authority', () => {
  const record = createSchoolPilotRecord(observed(), 'v');
  assert.equal(record.classification, 'observation'); assert.equal(record.summary.scope, 'development');
  assert.equal(record.summary.allObservedPassed, true); assert.equal(record.authority, 'observer-entered');
  const fake = {...record, authority: 'school-certified', classification: 'accepted', summary: {allObservedPassed: true}};
  fake.observations.checks.login = {status: 'blocked', notes: 'Školski poslužitelj nije dostupan.'};
  const restored = importSchoolPilotRecord(JSON.stringify(fake));
  assert.equal(schoolPilotSummary(restored).blocked, 1); assert.equal(schoolPilotSummary(restored).allObservedPassed, false);
});
test('school observations require real participant counts, environment and evidence; invalid imports fail before replacing data', () => {
  for (const data of [
    {...observed(), date: '2026-02-30'}, {...observed(), scope: 'school-class', students: 0},
    {...observed(), students: 1.2}, {...observed(), method: ''},
    {...observed(), checks: {login: {status: 'pass', notes: ' '}}},
    {...observed(), checks: {injected: {status: 'pass', notes: 'fake'}}},
    {...observed(), metrics: {saveP95Ms: -1}}, {...observed(), metrics: {saveP95Ms: '1'}},
  ]) assert.throws(() => createSchoolPilotRecord(data, 'v'));
  for (const text of ['{}', 'broken', 'x'.repeat(131073)]) assert.throws(() => importSchoolPilotRecord(text));
  const large = observed(); large.conclusion = '測'.repeat(6000);
  for (const check of Object.values(large.checks)) check.notes = '測'.repeat(3000);
  assert.throws(() => createSchoolPilotRecord(large, 'v'), /128 KiB/);
});
test('actual pilot form exports a draft, preserves text on invalid export and imports observations as safe editable text', async () => {
  const dom = new JSDOM(readFileSync('public/school-pilot.html', 'utf8'), {url: 'https://school.example/school-pilot.html'});
  const doc = dom.window.document, exported = [];
  mountSchoolPilot(doc, {manifest: Promise.resolve({version: '0.13.8-beta.1'}), download: (record, filename) => exported.push({record, filename})});
  await Promise.resolve();
  const form = doc.querySelector('#pilot-form'), field = name => form.elements.namedItem(name);
  const submit = () => form.dispatchEvent(new dom.window.Event('submit', {cancelable: true}));
  submit(); assert.equal(exported.length, 1); assert.equal(exported[0].record.classification, 'draft');
  field('check-login').value = 'pass'; field('notes-login').value = 'Provjereno';
  submit(); assert.equal(exported.length, 1); assert.match(doc.querySelector('#status').textContent, /popuni/);
  assert.equal(field('notes-login').value, 'Provjereno');
  const record = createSchoolPilotRecord(observed(), 'older');
  record.observations.checks.login.notes = '<img src=x onerror=alert(1)> Opažanje';
  const file = {size: 10000, text: async () => JSON.stringify(record)}, input = doc.querySelector('#record-file');
  Object.defineProperty(input, 'files', {configurable: true, value: [file]});
  input.dispatchEvent(new dom.window.Event('change'));
  await new Promise(done => setImmediate(done));
  assert.equal(field('notes-login').value, record.observations.checks.login.notes); assert.equal(doc.querySelector('img'), null);
  submit(); assert.equal(exported.length, 2); assert.equal(exported[1].record.observations.releaseVersion, '0.13.8-beta.1');
  Object.defineProperty(input, 'files', {value: [{size: 3, text: async () => '{}'}]});
  input.dispatchEvent(new dom.window.Event('change')); await new Promise(done => setImmediate(done));
  assert.equal(field('notes-login').value, record.observations.checks.login.notes);
  doc.querySelector('#draft').click(); assert.equal(exported.at(-1).record.classification, 'draft');
  assert.equal(field('notes-login').value, record.observations.checks.login.notes);
  dom.window.close();
});
test('current PHP liveness capabilities match the profile; stale 23B expectations and readiness claims fail', () => {
  const profile = JSON.parse(readFileSync('school/profile.json'));
  const current = {application: 'labosv2', stage: profile.stage, status: 'alive', features: profile.features};
  assert.doesNotThrow(() => assertSchoolLiveness(current, profile));
  assert.throws(() => assertSchoolLiveness({...current, stage: '23B'}, profile));
  assert.throws(() => assertSchoolLiveness({...current, features: {...current.features, officialGrading: false}}, profile));
  assert.throws(() => assertSchoolLiveness({...current, ready: true}, profile));
});
test('nearest-rank latency percentiles preserve zero, do not mutate samples and distinguish missing evidence', () => {
  const values = [100, 0, ...Array.from({length: 18}, (_, i) => i + 1)], copy = [...values];
  assert.deepEqual(latencySummary(values), {samples: 20, p50Ms: 9, p95Ms: 18, maxMs: 100});
  assert.deepEqual(values, copy);
  assert.deepEqual(latencySummary([]), {samples: 0, p50Ms: null, p95Ms: null, maxMs: null});
  for (const invalid of [[NaN], [Infinity], [-1], ['2']]) assert.throws(() => latencySummary(invalid));
});
