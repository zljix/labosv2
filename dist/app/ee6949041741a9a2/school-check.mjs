import {Session} from './session.mjs';
void import('./school-account.mjs');
const runtime = document.querySelector('#runtime'), server = document.querySelector('#server'), button = document.querySelector('#check');
try {
  const response = await fetch('./api/health.php', {cache: 'no-store'});
  const state = response.ok ? await response.json() : null;
  server.textContent = state?.application === 'labosv2' ? 'Školski PHP poslužitelj odgovara. Dostupnost prijave provjerava se u odjeljku Školski račun.' : 'Statičko web izdanje. Školske prijave traže zasebnu školsku instalaciju.';
} catch { server.textContent = 'Školski API nije potvrđen. Simulator i projektni izvozi dostupni su zasebno.'; }
button.addEventListener('click', async () => {
  button.disabled = true; runtime.textContent = 'Učitavam MicroPython i pokrećem radnik…'; let session;
  try {
    if (!isSecureContext) throw Error('Za školski rad upotrijebi HTTPS ili localhost.');
    const response = await fetch('./machine.py'); if (!response.ok) throw Error('Nedostaje prilagodba MicroPythona.');
    session = new Session(() => new Worker(new URL('./worker.mjs', import.meta.url), {type: 'module'}), await response.text(), 'from machine import Pin\nfrom time import sleep_ms\np=Pin(4, Pin.OUT)\np.on()\nsleep_ms(10)\nassert p.value()==1\np.off()\nassert p.value()==0\nprint("SCHOOL_RUNTIME_OK")\n');
    await session.wait(value => ['done', 'error'].includes(value.status), 10000);
    if (session.status !== 'done' || !session.text.includes('SCHOOL_RUNTIME_OK')) throw Error('Referentni program nije prošao.');
    runtime.textContent = 'Uspješno: WebAssembly, radnik i referentni MicroPython program rade na ovom uređaju.';
  } catch (error) { runtime.textContent = 'Provjera nije prošla: ' + error.message; }
  finally { await session?.stop(); button.disabled = false; }
});
