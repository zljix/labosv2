import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {assertSchoolLiveness} from './school-host-checks.mjs';

const origin = process.env.LAB_SCHOOL_URL;
if (!origin || new URL(origin).protocol !== 'https:') throw Error('Zadaj LAB_SCHOOL_URL=https://... s pouzdanim certifikatom.');
const base = new URL(origin.endsWith('/') ? origin : origin + '/');
const profile = JSON.parse(await readFile('school/profile.json', 'utf8'));
const checks = [];
async function check(name, fn) { try { await fn(); checks.push({name, status: 'pass'}); } catch (error) { checks.push({name, status: 'fail', message: error.message}); } }
const assert = (value, message) => { if (!value) throw Error(message); };
const manifest = await (await fetch(new URL('offline-package.json', base))).json();
await check('HTTPS and release identity', async () => {
  assert(manifest.base === '/', 'Potrebna je korijenska školska izgradnja.');
  const packageManifest = JSON.parse(await readFile(resolve('.build/school-package/package-inventory.json'), 'utf8'));
  assert(manifest.build === packageManifest.appBuild, 'Poslužuje se druga izgradnja.');
});
await check('Every application resource has exact bytes and usable MIME', async () => {
  for (const entry of manifest.files) {
    const response = await fetch(new URL(entry.url.slice(1), base)), bytes = Buffer.from(await response.arrayBuffer());
    assert(response.ok, entry.url + ': ' + response.status);
    assert(createHash('sha256').update(bytes).digest('hex') === entry.sha256, 'SHA-256: ' + entry.url);
    const type = response.headers.get('content-type') ?? '';
    if (entry.url.endsWith('.wasm')) assert(type.split(';')[0] === 'application/wasm', 'WASM MIME: ' + entry.url);
    if (/\.(mjs|js)$/.test(entry.url)) assert(/(?:text|application)\/javascript/.test(type), 'JavaScript MIME: ' + entry.url);
  }
});
await check('PHP liveness has a bounded response and no cached school state', async () => {
  const response = await fetch(new URL('api/health.php', base)), data = await response.json();
  assertSchoolLiveness(data, profile);
  assert(response.headers.get('cache-control') === 'no-store', 'API se ne smije predmemorirati.');
  const head = await fetch(new URL('api/health.php', base), {method: 'HEAD'});
  assert(head.ok && (await head.text()) === '', 'Neispravan HEAD odgovor.');
  assert((await fetch(new URL('api/health.php', base), {method: 'POST'})).status === 405, 'Nepodržana metoda nije odbijena.');
});
await check('Private configuration, tools and checker are outside the web root', async () => {
  for (const path of ['config/config.example.php', 'tools/preflight.php', 'checker/.build/school-grader/index.mjs', '.htaccess', 'package-inventory.json']) {
    assert([403, 404].includes((await fetch(new URL(path, base))).status), 'Javno dostupno: ' + path);
  }
});
const report = {stage: profile.stage, generatedAt: new Date().toISOString(), scope: 'HTTPS Apache/PHP delivery, exact resource bytes and private-path isolation; no database readiness or student pilot.', version: manifest.version,
  appBuild: manifest.build, resources: manifest.files.length, checks, passed: checks.filter(item => item.status === 'pass').length, total: checks.length};
await mkdir('docs/stage23i-evidence', {recursive: true});
await writeFile('docs/stage23i-evidence/https-host.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.passed !== report.total) process.exitCode = 1;
