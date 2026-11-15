import {spawnSync} from 'node:child_process';
for (const args of [['--import', 'tsx', 'scripts/build-school-catalog.ts'], ['scripts/build-school-grader.mjs'], [process.env.npm_execpath, 'run', 'build'], ['scripts/package-school.mjs']]) {
  const result = spawnSync(process.execPath, args, {stdio: 'inherit', env: {...process.env, LAB_BASE_PATH: '/'}});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
