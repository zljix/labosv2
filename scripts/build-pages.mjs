import { spawnSync } from 'node:child_process';

// Runs on Windows, macOS and Linux. Hosting under another repository name can
// override LAB_BASE_PATH; the ordinary build keeps the root/local URLs.
const result = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, LAB_BASE_PATH: process.env.LAB_BASE_PATH ?? '/labos/' },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
