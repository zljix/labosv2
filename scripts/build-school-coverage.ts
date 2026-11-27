import {readFileSync,writeFileSync} from 'node:fs';
import {gradingCoverage,gradingCoverageCSV} from '../school/grader/coverage';
const version=JSON.parse(readFileSync('package.json','utf8')).version;
const coverage=gradingCoverage(version);
writeFileSync('public/school-grading-support.json',JSON.stringify(coverage,null,2)+'\n');
writeFileSync('public/school-grading-support.csv',gradingCoverageCSV(coverage));
console.log(`Registar bodovanja: ${coverage.totals.supported}/${coverage.totals.combinations} izvedbi.`);
