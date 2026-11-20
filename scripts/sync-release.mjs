import {readFileSync,writeFileSync} from 'node:fs';
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const release={version:pkg.version,...pkg.labosRelease};
if(!/^\d+\.\d+\.\d+-beta\.\d+$/.test(release.version)||!/^\d{2}[A-Z]{1,2}\d*$/.test(release.stage))throw Error('Nevaljana oznaka izdanja.');
writeFileSync('school/release.json',JSON.stringify(release,null,2)+'\n');
const profile=JSON.parse(readFileSync('school/profile.json','utf8'));profile.stage=release.stage;profile.sourceVersion=release.version;
const registry=JSON.parse(readFileSync('school/grader/profiles.json','utf8'));
profile.grading.profiles=registry.profiles.map(p=>p.id);
profile.grading.compatibleCheckerVersions=[...new Set(registry.profiles.map(p=>p.checkerVersion??registry.checkerVersion))];
delete profile.grading.checkerVersion;
profile.grading.checkerVersionPolicy='per-published-rubric';
writeFileSync('school/profile.json',JSON.stringify(profile,null,2)+'\n');

const escapeHtml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const portal=readFileSync('public/school.html','utf8');
if(!portal.includes('data-labos-release'))throw Error('Nedostaje oznaka izdanja na školskoj stranici.');
writeFileSync('public/school.html',portal.replace(/(<span class="stage" data-labos-release>)[^<]*(<\/span>)/,(_,a,b)=>a+'v'+escapeHtml(release.version)+' · '+escapeHtml(release.title)+b));
