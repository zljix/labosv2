import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {unzipSync, strFromU8} from 'fflate';
import vm from 'node:vm';

test('school ZIP verifies every inventory entry and keeps app, SQL and configuration out of web/', () => {
  const {version,labosRelease:{stage}} = JSON.parse(readFileSync('package.json'));
  const archive = unzipSync(readFileSync('release/Labos_' + version.split('-')[0] + '_'+stage+'_Skolski.zip'));
  const inventory = JSON.parse(strFromU8(archive['package-inventory.json']));
  assert.equal(inventory.stage, stage); assert.equal(inventory.version, version);
  assert.equal(Object.keys(archive).length, inventory.files.length + 1);
  for (const file of inventory.files) {
    assert.equal(archive[file.path].byteLength, file.bytes, file.path);
    assert.equal(createHash('sha256').update(archive[file.path]).digest('hex'), file.sha256, file.path);
  }
  for (const path of ['app/bootstrap.php', 'migrations/001_accounts.sql', 'migrations/002_class_access.sql', 'tools/console.php', 'web/api/index.php', 'web/school-account.mjs', 'web/school-classes.mjs', 'migrations/003_classes_tasks.sql', 'catalog/catalog.json']) assert(archive[path], path);
  assert.deepEqual(Object.keys(archive).filter(path => path.startsWith('config/')), ['config/config.example.php']);
  assert(archive['checker/.build/school-grader/radio-child.mjs']);
  for(const path of ['migrations/008_interactive_compile.sql','app/compilation.php','tools/compilation.php','tools/compiler-worker.mjs','checker/.build/school-grader/runner.mjs','apache/labos-compiler.service.example','docs/STAGE25A_SKOLSKI_PREVODITELJ.md'])assert(archive[path],path);
  assert(archive['checker/public/radio-examples.json']);
  assert(archive['docs/stage24m-radio.md']);
  assert(archive['docs/STAGE24Q_PLAN_I_PROVJERA.md']);
  assert(archive['docs/stage24q-evidence/local-summary.json']);
  assert(archive['docs/stage24o-introductory.md']);
  assert(archive['docs/stage24o-evidence/README.md']);
  assert(archive['docs/stage24n-levels.md']);
  assert(archive['docs/stage24n-evidence/README.md']);
  const levelRegistry=JSON.parse(strFromU8(archive['grading/profiles.json']));
  assert.equal(levelRegistry.profiles.filter(p=>p.id.startsWith('24N-')).length,4);
  assert.equal(JSON.parse(strFromU8(archive['profile.json'])).grading.coverage.supported,268);
  const radioRegistry=JSON.parse(strFromU8(archive['grading/profiles.json']));
  assert.equal(radioRegistry.profiles.filter(p=>p.id.startsWith('24M-')).length,1);
  assert.equal(JSON.parse(strFromU8(archive['profile.json'])).grading.radioLeaseSeconds,300);
  for(const path of ['checker/scripts/s3-compile.mjs','checker/runtime/arduino-s3/core.cpp','checker/school/grader/s3-compile-child.mjs','docs/stage24ab-contract.md'])assert(archive[path],path);
  for(const path of ['docs/stage24c-analog.md','docs/stage24c-evidence/README.md'])assert(archive[path],path);
  assert(archive['docs/stage24i-environment.md']);assert(archive['docs/stage24i-evidence/README.md']);
  assert(archive['docs/stage24h-displays.md']);assert(archive['docs/stage24h-evidence/README.md']);
  const profiles=JSON.parse(strFromU8(archive['grading/profiles.json']));assert.equal(profiles.profiles.filter(p=>p.id.startsWith('24H-')).length,8);
  assert(archive['docs/stage24g-steppers.md']);assert(archive['docs/stage24g-evidence/README.md']);
  assert(archive['docs/stage24d-sensors.md']);assert(archive['docs/stage24d-evidence/README.md']);
  assert(archive['web/school-pilot.html']);assert(archive['web/school-pilot-record.mjs']);assert(archive['docs/stage23i-pilot.md']);
  assert(archive['web/school-grading.html']);assert(archive['web/school-grading-support.json']);assert(archive['web/school-grading-support.csv']);assert(archive['docs/stage23g-grading-matrix.md']);
  assert(archive['migrations/006_submissions.sql']);assert(archive['app/submissions.php']);assert(archive['docs/stage23f-submissions.md']);
  for(const path of ['migrations/007_reports_administration.sql','app/reports.php','app/administration.php','docs/stage23h-reports-administration.md'])assert(archive[path],path);
  // web/app/<build>/ holds the existing public simulator runtime.
  assert(!Object.keys(archive).some(path => /^web\/(config|migrations|tools)\//.test(path) || /^web\/app\/.*\.php$/.test(path)));
});

test('installed app worker never intercepts private school API or POST requests', () => {
  const handlers = {};
  vm.runInNewContext(readFileSync('dist/sw.js', 'utf8'), {self: {location: {origin: 'https://school.example'}, addEventListener: (name, fn) => handlers[name] = fn}, URL, Set});
  const manifest = JSON.parse(readFileSync('dist/offline-package.json'));
  assert(!manifest.files.some(file => file.url.includes('/api/')));
  for (const [method, path] of [['GET', 'api/health.php'], ['GET', 'api/index.php?action=session'], ['POST', 'api/index.php?action=login']]) {
    let intercepted = false;
    handlers.fetch({request: {method, url: 'https://school.example' + manifest.base + path}, respondWith: () => {intercepted = true;}});
    assert.equal(intercepted, false, method + ' ' + path);
  }
});
