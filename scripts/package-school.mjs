import {readFileSync, readdirSync, writeFileSync, mkdirSync, cpSync, rmSync} from 'node:fs';
import {resolve, relative, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {zipSync, strToU8} from 'fflate';

const root = process.cwd(), version = JSON.parse(readFileSync('package.json', 'utf8')).version;
const manifest = JSON.parse(readFileSync('dist/offline-package.json', 'utf8'));
if (manifest.base !== '/' || manifest.version !== version) throw Error('Školski paket zahtijeva aktualnu korijensku izgradnju (npm run build).');
for (const entry of manifest.files) {
  const bytes = readFileSync(resolve(root, 'dist', entry.url.slice(1)));
  if (bytes.length !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Resurs se ne podudara: ' + entry.url);
}
const target = resolve('.build/school-package');
rmSync(target, {recursive: true, force: true}); mkdirSync(target, {recursive: true});
function copy(from, to) { mkdirSync(dirname(resolve(target, to)), {recursive: true}); cpSync(from, resolve(target, to), {recursive: true}); }
copy('dist', 'web'); copy('school/api', 'web/api'); copy('school/apache/web.htaccess', 'web/.htaccess');
copy('school/config/config.example.php', 'config/config.example.php'); copy('school/bin', 'tools'); copy('school/apache/labosv2.conf.example', 'apache/labosv2.conf.example');
copy('school/app', 'app'); copy('school/migrations', 'migrations');
copy('school/README.md', 'README.md'); copy('school/profile.json', 'profile.json'); copy('LICENSE', 'LICENSE');
copy('.build/school-grader', 'checker/.build/school-grader'); copy('public', 'checker/public');
copy('scripts/avr-compile.mjs', 'checker/scripts/avr-compile.mjs'); copy('school/grader/compile-child.mjs', 'checker/school/grader/compile-child.mjs');
copy('vendor/arduino', 'checker/vendor/arduino');
const entries = {};
function walk(directory) { for (const item of readdirSync(directory, {withFileTypes: true})) {
  const path = resolve(directory, item.name);
  if (item.isDirectory()) walk(path); else entries[relative(target, path).replaceAll('\\', '/')] = new Uint8Array(readFileSync(path));
} }
walk(target);
const inventory = {version, stage: '23B', appBuild: manifest.build, files: Object.entries(entries).map(([path, bytes]) => ({path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}))};
entries['package-inventory.json'] = strToU8(JSON.stringify(inventory, null, 2) + '\n');
writeFileSync(resolve(target, 'package-inventory.json'), entries['package-inventory.json']);
mkdirSync('release', {recursive: true});
const output = resolve('release', 'Labosv2_' + version.split('-')[0] + '_23B_Skolski.zip');
writeFileSync(output, zipSync(entries, {level: 6}));
console.log(output);
