import { loadMicroPython } from './runtime/micropython.mjs';
import { createHost } from './host.mjs';

let active = false;
let host;
let session = 0;
let consoleChunk = '';
let dropped = 0;
let flushScheduled = false;
const decoder = new TextDecoder();
function send(data) { postMessage({ ...data, session }); }
function flushConsole() {
  flushScheduled = false;
  if (consoleChunk) send({ type: 'console', text: consoleChunk });
  if (dropped) send({ type: 'console', text: `\n[Ogranicen ispis: preskoceno ${dropped} bajtova]\n` });
  consoleChunk = '';
  dropped = 0;
}
function stdout(bytes) {
  if (consoleChunk.length < 8192) consoleChunk += decoder.decode(bytes, { stream: true });
  else dropped += bytes.length;
  if (!flushScheduled) { flushScheduled = true; setTimeout(flushConsole, 50); }
}

self.onmessage = async ({ data }) => {
  if (data.type === 'input') { host?.input(data); return; }
  if (data.type !== 'run' || active) return;
  active = true;
  session = data.session;
  try {
    host = createHost(send, data.config);
    const mp = await loadMicroPython({
      heapsize: 4 * 1024 * 1024,
      pystack: 16384,
      stdout, stderr: stdout, linebuffer: false,
    });
    mp._module.labHost = host;
    mp.FS.writeFile('/machine.py', data.machine);
    const files = data.files ?? {};
    if (Object.keys(files).length > 64) throw new Error('Previše datoteka.');
    let total = 0;
    for (const [path, content] of Object.entries(files)) {
      if (!/^(?:[A-Za-z_][A-Za-z0-9_-]*\/)*[A-Za-z_][A-Za-z0-9_-]*\.(py|txt|md|json)$/.test(path) || path.length > 100 || path.split('/').some(p => ['machine.py','_lab.py','project.json'].includes(p.toLowerCase())) || typeof content !== 'string') throw new Error('Nedopuštena datoteka.');
      const size = new TextEncoder().encode(content).length;
      total += size;
      if (size > 131072 || total > 1048576) throw new Error('Projekt je prevelik.');
      const parts = path.split('/'); parts.pop(); let directory = '';
      for (const part of parts) { directory += '/' + part; if (!mp.FS.analyzePath(directory).exists) mp.FS.mkdir(directory); }
      mp.FS.writeFile('/' + path, content);
    }
    mp.FS.writeFile('/main.py', data.code);
    send({ type: 'ready' });
    host.flush();
    await mp.runPython("exec(compile(open('/main.py').read(), 'main.py', 'exec'))");
    host.flush();
    flushConsole();
    send({ type: 'done' });
  } catch (error) {
    host?.flush();
    flushConsole();
    send({ type: 'error', message: String(error?.message ?? error).slice(0, 8192) });
  }
};
