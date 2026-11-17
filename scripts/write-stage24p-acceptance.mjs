import {readFileSync,writeFileSync} from 'node:fs';
const read=name=>JSON.parse(readFileSync('docs/stage24p-evidence/'+name+'.json','utf8'));
const inputs=read('input-reliability'),audit=read('interactive-audit'),matrix=read('current-matrix'),legacy=read('legacy-matrix'),api=read('mysql-remediation');
const compiled=['s3-cpp','uno','nano'].map(target=>read('compiled-'+target));
const sets=[inputs,audit,matrix,legacy,api,...compiled],source=process.env.GITHUB_SHA;
if(!source||sets.some(s=>s.sourceCommit!==source))throw Error('Dokazi nisu iz istog CI izvora.');
const hashes=new Set([
 ...inputs.results.map(r=>r.result.checkerHash),...audit.results.map(r=>r.result.checkerHash),
 ...matrix.results.map(r=>r.checkerHash),...legacy.results.map(r=>r.checkerHash),...api.results.map(r=>r.report.checkerHash),
 ...compiled.flatMap(c=>c.results.map(r=>r.result.checkerHash)),
]);
if(hashes.size!==1||!/^[a-f0-9]{64}$/.test([...hashes][0]))throw Error('Dokazi koriste različite provjeravače.');
if(matrix.results.length!==273||legacy.results.length!==79||matrix.results.some(r=>r.points!==r.expectedPoints)||legacy.results.some(r=>r.points!==10))throw Error('Matrica nije potpuna.');
for(const c of compiled){
 if(c.results.length!==5||c.results.some(r=>r.result.status!=='evaluated'||r.result.provenance?.method!=='isolated-source-compilation'||r.result.points!==(r.label==='independent-correct-source'?10:3)))throw Error('Nedostaje neovisno C++ prevođenje '+c.target);
}
for(const label of ['reference','function-300ms','alternative-GPIO-250ms','timer-650ms']){
 const rows=inputs.results.filter(r=>r.label===label);
 if(rows.length!==32||new Set(rows.map(r=>r.seed)).size!==32)throw Error('Nedostaju 32 sjemena '+label);
 if(rows.some(r=>label==='timer-650ms'?r.result.criteria.slice(1).some(c=>c.points!==0):r.result.points!==10))throw Error('Pogrešan ishod '+label);
}
const release=JSON.parse(readFileSync('school/release.json','utf8'));
const summary={format:'labosv2-24p-technical-acceptance',version:1,release,sourceCommit:source,checkerHash:[...hashes][0],
 coverage:{urs:268,introductory:5,legacyProfiles:79},inputExecutions:inputs.results.length,auditExecutions:audit.results.length,
 isolatedCppCompilations:compiled.reduce((n,c)=>n+c.results.length,0),
 unicodeApi:api.results.length===1&&api.results[0].locked&&api.results[0].radioNodesChecked===2,
 realSchoolPilot:'pending',windowsWebProfile:'pending-target-validation',safariIOS:'pending-target-validation',
 runURL:process.env.GITHUB_SERVER_URL+'/'+process.env.GITHUB_REPOSITORY+'/actions/runs/'+process.env.GITHUB_RUN_ID};
if(!summary.unicodeApi)throw Error('PHP/MySQL prihvat nije potpun.');
writeFileSync('docs/stage24p-evidence/acceptance-summary.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
