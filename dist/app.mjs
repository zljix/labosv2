import { Session } from './session.mjs';
import { runSuite } from './suite.mjs';
import { examples } from './examples.mjs';

const $ = s => document.querySelector(s);
const code = $('#code');
let current;
let button = false;
let testing = false;
let machine;
let report;
let launch = 0;
const factory = () => new Worker(new URL('./worker.mjs', import.meta.url), { type: 'module' });

function status(text, kind = '') { $('#status').textContent = text; $('#status').className = `status ${kind}`; }
function setBusy(busy) {
  $('#run').disabled = busy;
  $('#stop').disabled = !busy;
  $('#powered').disabled = busy;
  $('#swapped').disabled = busy;
  $('#check').disabled = busy;
}
function lines() {
  const n = code.value.split('\n').length;
  $('#line-numbers').textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
  $('#line-count').textContent = `${n} redaka`;
}
function selectExample(id) {
  code.value = examples[id].code;
  $('#hint').textContent = examples[id].hint;
  for (const el of document.querySelectorAll('[data-example]')) {
    el.classList.toggle('active', el.dataset.example === id);
    el.setAttribute('aria-current', el.dataset.example === id ? 'true' : 'false');
  }
  lines();
}
function append(text) {
  const consoleEl = $('#console');
  if (consoleEl.querySelector('.console-placeholder')) consoleEl.textContent = '';
  consoleEl.textContent = (consoleEl.textContent + text).slice(-24000);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}
function pins(value) {
  const v = value ? 1 : 0;
  $('#led').classList.toggle('on', !!v);
  $('#led').setAttribute('aria-label', v ? 'LED uključena' : 'LED isključena');
  $('#output-value').replaceChildren(document.createTextNode(`${v} `), Object.assign(document.createElement('span'), { textContent: v ? 'HIGH' : 'LOW' }));
}
function buttonState(value) {
  button = value;
  $('#button-input').setAttribute('aria-pressed', String(value));
  $('#button-label').textContent = value ? 'Otpusti tipkalo' : 'Pritisni tipkalo';
  $('#input-value').replaceChildren(document.createTextNode(value ? '0 ' : '1 '), Object.assign(document.createElement('span'), { textContent: value ? 'GND' : 'PULL-UP' }));
  current?.input({ button });
}
function frame(bytes) {
  const ctx = $('#display').getContext('2d');
  const img = ctx.createImageData(128, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 128; x++) {
    const on = bytes?.[x + (y >> 3) * 128] & (1 << (y & 7));
    const i = (y * 128 + x) * 4;
    img.data[i] = on ? 208 : 21;
    img.data[i+1] = on ? 235 : 39;
    img.data[i+2] = on ? 178 : 37;
    img.data[i+3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
async function run() {
  const request = ++launch;
  await current?.stop();
  current = undefined;
  pins(0);
  frame();
  $('#console').textContent = '';
  setBusy(true);
  status('Učitavanje…');
  try {
    machine ??= await fetch('./machine.py').then(r => { if (!r.ok) throw Error('Ne mogu učitati machine.py'); return r.text(); });
    if (request !== launch) return;
    current = new Session(factory, machine, code.value, { button, powered: $('#powered').checked, swapped: $('#swapped').checked }, event => {
      if (request !== launch) return;
      if (event.type === 'ready') status('Izvodi se', 'running');
      if (event.type === 'console') append(event.text);
      if (event.type === 'pins') pins(event.pins[4]);
      if (event.type === 'frame') frame(event.bytes);
      if (event.type === 'i2c') append(`[I2C 0x38] ${event.bytes.length} bajtova\n`);
      if (event.type === 'done') { status('Dovršeno'); setBusy(false); }
      if (event.type === 'error') { status('Pogreška', 'error'); append(event.message + '\n'); setBusy(false); }
    });
  } catch (e) { append(String(e.message) + '\n'); status('Pogreška', 'error'); setBusy(false); }
}
async function stop() {
  ++launch;
  const ms = await current?.stop();
  current = undefined;
  setBusy(false);
  status('Zaustavljeno');
  if (ms !== undefined) append(`\n[Stop: Worker prekinut; naredba ${ms.toFixed(1)} ms]\n`);
}
function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('#examples').addEventListener('click', event => { const b = event.target.closest('[data-example]'); if (b) selectExample(b.dataset.example); });
$('#run').onclick = run;
$('#stop').onclick = stop;
$('#reset').onclick = async () => { buttonState(false); await run(); };
$('#button-input').onclick = () => buttonState(!button);
$('#clear-console').onclick = () => { $('#console').textContent = ''; };
$('#download-code').onclick = () => download('main.py', code.value, 'text/x-python');
$('#download-report').onclick = () => download('ESP32_Lab_Etapa0_rezultati.json', JSON.stringify(report, null, 2), 'application/json');
code.oninput = lines;
code.onscroll = () => { $('#line-numbers').scrollTop = code.scrollTop; };
code.onkeydown = event => {
  if (event.key === 'Tab') { event.preventDefault(); code.setRangeText('    ', code.selectionStart, code.selectionEnd, 'end'); lines(); }
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); if (!testing) run(); }
};
$('#check').onclick = async () => {
  if (testing) return;
  testing = true;
  await stop();
  $('#run').disabled = $('#reset').disabled = $('#check').disabled = true;
  $('#download-report').classList.add('hidden');
  status('Provjera…');
  const container = $('#checks-content');
  container.textContent = '';
  try {
    machine ??= await fetch('./machine.py').then(r => r.text());
    report = await runSuite(factory, machine, result => {
      let row = document.getElementById('check-' + result.id);
      if (!row) {
        row = Object.assign(document.createElement('div'), { id: 'check-' + result.id });
        row.append(Object.assign(document.createElement('span'), { className: 'result-mark' }), document.createElement('span'), document.createElement('small'));
        container.append(row);
      }
      row.className = `check-result ${result.status}`;
      row.children[0].textContent = result.status === 'pass' ? '✓' : result.status === 'fail' ? '×' : '…';
      row.children[1].textContent = result.title;
      row.children[2].textContent = result.status === 'running' ? 'radi' : result.status === 'pass' ? 'OK' : 'GREŠKA';
      row.title = typeof result.detail === 'string' ? result.detail : JSON.stringify(result.detail ?? '');
    });
    report.userAgent = navigator.userAgent;
    report.support = { webAssembly: !!globalThis.WebAssembly, worker: !!globalThis.Worker, jspiRequired: false, sharedArrayBufferRequired: false, crossOriginIsolated: globalThis.crossOriginIsolated };
    const summary = Object.assign(document.createElement('div'), { className: 'check-summary', textContent: `${report.passed}/${report.total} provjera prolazi u ovom pregledniku.` });
    container.prepend(summary);
    $('#download-report').classList.remove('hidden');
    status(report.passed === report.total ? 'Provjere prolaze' : 'Provjera nije prošla', report.passed === report.total ? '' : 'error');
    // Inspection/export surface uses only results actually measured in this tab.
    window.labVerification = report;
  } catch (e) { container.textContent = String(e.message); status('Pogreška', 'error'); }
  finally { testing = false; $('#run').disabled = $('#reset').disabled = $('#check').disabled = false; }
};
selectExample('button');
frame();
