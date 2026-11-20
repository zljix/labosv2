import {writeFile} from 'node:fs/promises';
import {compileProject} from '/app/scripts/avr-compile.mjs';
let raw = '';
for await (const chunk of process.stdin) { raw += chunk; if (Buffer.byteLength(raw) > 2097152) throw Error('Projekt je prevelik.'); }
await writeFile('/tmp/arduino-cli.yaml', 'directories:\n  data: /toolchain\n  user: /tmp/user\n  downloads: /tmp/downloads\n');
try {
  const artifact = await compileProject(JSON.parse(raw), {cli: '/runtime/arduino-cli', config: '/tmp/arduino-cli.yaml'});
  process.stdout.write(JSON.stringify({status: 'compiled', artifact}));
} catch (error) {
  const infrastructure = /Error initializing instance|not found|ENOENT|EACCES|Potreban je Arduino|Prvo instaliraj|Neodgovarajući AVR/.test(error.message);
  process.stdout.write(JSON.stringify({status: error.name === 'CompileError' && !infrastructure ? 'compile_error' : 'technical_error', message: infrastructure ? 'Prevoditelj nije dostupan.' : error.message, diagnostics: infrastructure ? [] : (error.diagnostics??[])}));
}
