import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { RuntimeUnavailable } from '../../src/grading/replay';
import { runTrial } from '../../src/grading/runTrial';
import { parseProject } from '../../src/project/model';

let raw = '';
for await (const chunk of process.stdin) {
  raw += chunk;
  if (Buffer.byteLength(raw) > 4194304) throw Error('Prevelik pokus.');
}
const { trial, artifact, seed } = JSON.parse(raw);
trial.project = parseProject(trial.project);
const root = process.env.LAB_GRADER_PUBLIC!;
const mp =
  trial.project.language === 'micropython'
    ? {
        load: (await import(pathToFileURL(root + '/runtime/micropython.mjs').href)).loadMicroPython,
        machine: await readFile(root + '/machine.py', 'utf8')
      }
    : undefined;
if (trial.key === 'urs-lv/LV16') {
  for (const [name, path] of [
    ['main.py', 'plc.py'],
    ['plc_st.py', 'plc_st.py']
  ])
    trial.project.files[name] = await readFile(root + '/zbirke/urs-lv/podrska/' + path, 'utf8');
}
try {
  process.stdout.write(JSON.stringify(await runTrial(trial, artifact, seed, mp)));
} catch (e) {
  if (e instanceof RuntimeUnavailable) throw e;
  process.stdout.write(
    JSON.stringify({
      passed: false,
      explanation: 'Program ili sklop prijavio je pogrešku tijekom pokusa. Provjeri ga u simulatoru.'
    })
  );
}
process.exit(0);
