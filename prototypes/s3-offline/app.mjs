const el = id => document.getElementById(id);
const status = message => { el('status').textContent = message; };
const code = el('code');
const key = 'labos.s3.pilot.' + location.pathname.replace(/index\.html$/,'');
code.value = localStorage.getItem(key) ?? code.value;
let worker, timer;
function finish() {
  clearTimeout(timer);
  worker?.terminate();
  worker = null;
  el('stop').disabled = true;
  el('run').disabled = false;
}
function resetOutput() {
  el('led').classList.remove('on');
  el('time').textContent = '0';
  el('serial').textContent = '';
}
code.oninput = () => {
  finish();
  resetOutput();
  localStorage.setItem(key,code.value);
  status('Program je izmijenjen.');
};
el('prepare').onclick = async () => {
  el('prepare').disabled = true;
  status('Spremanje i provjera paketa…');
  try {
    const reg = await navigator.serviceWorker.register('./sw.js');
    const sw = reg.installing || reg.waiting || reg.active;
    await new Promise((resolve,reject) => {
      function check() {
        if (sw.state === 'activated') resolve();
        if (sw.state === 'redundant') reject(Error('Paket nije spremljen. Provjeri mrežu i slobodan prostor.'));
      }
      sw.addEventListener('statechange',check);
      check();
    });
    status('Paket je spremljen. Možeš isključiti mrežu.');
  } catch (error) { status(error.message); }
  finally { el('prepare').disabled = false; }
};
el('run').onclick = () => {
  resetOutput();
  status('Prevođenje…');
  el('stop').disabled = false;
  el('run').disabled = true;
  worker = new Worker('./worker.mjs',{type:'module'});
  worker.onerror = e => { status(e.message || 'Pogreška pri učitavanju prevoditelja.'); finish(); };
  worker.onmessage = ({data}) => {
    if (data.type === 'compiled') status('Simulacija · ' + data.size + ' B');
    if (data.type === 'console') el('serial').textContent += data.text;
    if (data.type === 'frame') {
      el('led').classList.toggle('on',data.light > 0);
      el('time').textContent = Math.round(data.time);
    }
    if (data.type === 'error' || data.type === 'done') { status(data.message || 'Simulacija dovršena.'); finish(); }
  };
  worker.postMessage(code.value);
  timer = setTimeout(() => { finish(); status('Isteklo je vrijeme izvođenja.'); },120000);
};
el('stop').onclick = () => { finish(); status('Prekinuto.'); };
