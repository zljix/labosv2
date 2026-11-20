import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync,realpathSync} from 'node:fs';

// Explicitly Linux-only: absence/failure is an infrastructure error, never a
// request to execute untrusted input on the host as a fallback.
/** @param {string} root @param {string} entry @param {{compiler?: boolean, s3Compiler?: boolean, toolchainRoot?: string, cli?: string, data?: string, bounded?: boolean, cpuSeconds?: number}} [options] */
export function sandboxCommand(root, entry, {compiler = false, s3Compiler = false, toolchainRoot, cli, data, bounded = false, cpuSeconds = 18} = {}) {
  if(!Number.isInteger(cpuSeconds)||cpuSeconds<1||cpuSeconds>58)throw Error('Nevaljano CPU ograničenje provjeravača.');
  if (process.platform !== 'linux') throw Error('Izolirana provjera 23A zasad traži Linux; nema nesigurnog zamjenskog izvođenja.');
  const node = realpathSync(process.execPath);
  const args = ['--user', '--map-root-user', '--net', 'bwrap', '--unshare-pid', '--unshare-ipc', '--unshare-uts', '--die-with-parent', '--new-session',
    '--ro-bind', '/usr', '/usr', '--ro-bind', '/lib', '/lib'];
  if (existsSync('/lib64')) args.push('--ro-bind', '/lib64', '/lib64');
  args.push('--dir', '/runtime', '--ro-bind', node, '/runtime/node', '--symlink', 'usr/bin', '/bin', '--proc', '/proc', '--dev', '/dev', '--size', '134217728', '--tmpfs', '/tmp',
    '--dir', '/app', '--ro-bind', resolve(root, 'public'), '/app/public', '--ro-bind', resolve(entry), '/app/child.mjs',
    '--chdir', '/app', '--clearenv', '--setenv', 'PATH', '/runtime:/usr/bin:/bin', '--setenv', 'LANG', 'C.UTF-8', '--setenv', 'HOME', '/tmp',
    '--setenv', 'LAB_GRADER_PUBLIC', '/app/public');
  if (compiler) {
    if (!cli || !data) throw Error('Za neovisno prevođenje zadaj lokalni Arduino CLI i zaključani data direktorij.');
    args.push('--ro-bind', realpathSync(cli), '/runtime/arduino-cli', '--ro-bind', resolve(data), '/toolchain',
      '--ro-bind', resolve(root, 'scripts/avr-compile.mjs'), '/app/scripts/avr-compile.mjs',
      '--ro-bind', resolve(root, 'vendor/arduino'), '/app/vendor/arduino');
  }
  if(s3Compiler){
    args.push('--ro-bind',resolve(root,'scripts/s3-compile.mjs'),'/app/scripts/s3-compile.mjs',
      '--ro-bind',resolve(root,'scripts/avr-compile.mjs'),'/app/scripts/avr-compile.mjs',
      '--ro-bind',resolve(root,'runtime/arduino-s3'),'/app/runtime/arduino-s3',
      '--ro-bind',resolve(root,'vendor/arduino'),'/app/vendor/arduino',
      '--setenv','BINARYEN_CORES','1');
    // Optional, administrator-selected installation prefix for the same pinned
    // tools. No user-supplied build flags or source paths select this mount.
    if(toolchainRoot)args.push('--ro-bind',resolve(toolchainRoot),resolve(toolchainRoot),
      '--setenv','PATH','/runtime:'+resolve(toolchainRoot,'bin')+':'+resolve(toolchainRoot,'usr/bin')+':/usr/bin:/bin');
  }
  args.push('--', '/runtime/node', '--max-old-space-size=96', '--disable-proto=throw');
  if (bounded) args.push('--disable-wasm-trap-handler');
  if (!compiler&&!s3Compiler) args.push('--permission', '--allow-fs-read=/app');
  args.push('/app/child.mjs');
  // A kernel-enforced virtual-address limit complements the V8/Python heaps,
  // bounded tmpfs, output and wall-time caps. Children inherit the limits.
  return bounded ? {command: 'prlimit', args: ['--as=2147483648', '--cpu='+(compiler||s3Compiler?85:cpuSeconds), '--fsize=33554432', '--', 'unshare', ...args]} : {command: 'unshare', args};
}

export function runSandbox(command, payload, timeoutMs = 10000, signal) {
  return new Promise((accept, reject) => {
    if(signal?.aborted){reject(Error('Prevođenje je otkazano.'));return;}
    const child = spawn(command.command, command.args, {stdio: ['pipe', 'pipe', 'pipe'], env: {PATH: process.env.PATH}, detached: true});
    let stdout = '', stderr = '', bytes = 0, settled = false;
    const stop = () => { try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); } };
    const finish = (error, value) => { if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort); error ? reject(error) : accept(value); };
    const abort=()=>{stop();finish(Error('Prevođenje je otkazano.'));};
    signal?.addEventListener('abort',abort,{once:true});
    const timer = setTimeout(() => { stop(); const error = Error('Isteklo je ograničenje izvođenja.'); error.code = 'EXECUTION_LIMIT'; finish(error); }, timeoutMs);
    for (const [stream, name] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) stream.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > 1048576) { stop(); const error = Error('Prekoračeno je ograničenje izlaza.'); error.code = 'OUTPUT_LIMIT'; finish(error); return; }
      if (name === 'stdout') stdout += chunk.toString(); else stderr += chunk.toString();
    });
    child.on('error', error => finish(error));
    child.on('close', (code,signal) => {
      if(signal==='SIGXCPU'){const error=Error('Prekoračeno je CPU ograničenje izvođenja.');error.code='EXECUTION_LIMIT';finish(error);return;}
      if (code !== 0) { finish(Error('Izolirani proces nije uspio: ' + stderr.slice(-1800))); return; }
      try { finish(null, JSON.parse(stdout)); } catch { finish(Error('Neispravan odgovor izoliranog procesa.')); }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(payload));
  });
}
