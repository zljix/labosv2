import { useEffect, useRef, useState } from 'react';
import { Session } from '../../public/session.mjs';
import { APP_BUILD, APP_VERSION, runtimeAsset, appAsset } from './assets';
import { download } from '../project/archive';
import type { useOffline } from './offline';
import './platform.css';

type Offline = ReturnType<typeof useOffline>;
export default function SystemPanel({ offline, busy, saveStatus, update }: { offline: Offline; busy: boolean; saveStatus: string; update: () => Promise<void> }) {
  const [persistent, setPersistent] = useState<boolean>(), [storage, setStorage] = useState(''), [test, setTest] = useState('Nije pokrenuta.'), [testing, setTesting] = useState(false);
  const session = useRef<Session | undefined>(undefined), generation = useRef(0);
  const [updateError, setUpdateError] = useState('');
  const refreshStorage = async () => {
    try {
      setPersistent(await navigator.storage?.persisted?.());
      const result = await navigator.storage?.estimate?.();
      if (result?.quota) setStorage(`${((result.usage ?? 0) / 1048576).toFixed(1)} MiB zauzeto od približno ${(result.quota / 1048576).toFixed(0)} MiB dopušteno`);
    } catch { setStorage('Procjena prostora nije dostupna.'); }
  };
  useEffect(() => { void refreshStorage(); return () => { ++generation.current; void session.current?.stop(); }; }, []);
  async function smoke() {
    const ticket = ++generation.current;
    setTesting(true); setTest('Provjera stvarnog MicroPythona…');
    let current: Session | undefined;
    try {
      const response = await fetch(runtimeAsset('machine.py'), { cache: 'no-store' });
      if (!response.ok) throw Error('MicroPython prilagodba nije dostupna.');
      const machine = await response.text();
      if (ticket !== generation.current) return;
      current = new Session(() => new Worker(runtimeAsset('worker.mjs'), { type: 'module' }), machine, `from machine import Pin\nfrom time import sleep_ms\nimport framebuf\np = Pin(4, Pin.OUT)\np.value(1)\nsleep_ms(30)\nassert p.value() == 1\nf = framebuf.FrameBuffer(bytearray(8), 8, 8, framebuf.MONO_VLSB)\nf.pixel(1, 1, 1)\nassert f.pixel(1, 1) == 1\nprint('LAB_RUNTIME_OK')\n`, {});
      session.current = current;
      await current.wait((s: Session) => s.status === 'done' || s.status === 'error', 12000);
      if (current.status !== 'done' || !current.text.includes('LAB_RUNTIME_OK')) throw Error(current.text || 'Izvršavanje nije dovršeno.');
      if (ticket === generation.current) setTest('Prolazi: Worker, MicroPython WASM, GPIO, vremenska stanka i framebuf.');
    } catch (error) { if (ticket === generation.current) setTest('Nije prošla: ' + (error as Error).message); }
    finally { await current?.stop(); if (ticket === generation.current) setTesting(false); }
  }
  const capabilities = [
    ['Sigurni kontekst', isSecureContext], ['WebAssembly', typeof WebAssembly !== 'undefined'],
    ['Web Worker', typeof Worker !== 'undefined'], ['IndexedDB API', typeof indexedDB !== 'undefined'],
    ['SHA-256 API', !!globalThis.crypto?.subtle], ['Service Worker API', 'serviceWorker' in navigator],
  ] as const;
  const label = offline.phase === 'ready' ? 'Paket spreman za offline rad' : offline.phase === 'preparing' ? 'Priprema offline paketa' : offline.phase === 'development' ? 'Razvojni pregled' : 'Offline rad nije spreman';
  return <div className="system-panel">
    <p className="system-version">v{APP_VERSION} · {APP_BUILD === 'development' ? 'razvoj' : APP_BUILD}</p>
    <section><h3>{label}</h3><p role="status">{offline.message}</p><p>Veza prema pregledniku: <b>{offline.online ? 'mreža dostupna' : 'bez mreže'}</b>. Stanje veze samo po sebi ne potvrđuje dostupnost poslužitelja.</p>
      {offline.package?.ready && <p>{offline.package.count} datoteka · {(offline.package.bytes / 1048576).toFixed(1)} MiB · paket {offline.package.version}</p>}
      <div className="system-actions"><button onClick={() => void offline.refresh()} disabled={offline.checking || APP_BUILD === 'development'}>{offline.checking ? 'Provjera…' : 'Provjeri novu verziju / ponovi preuzimanje'}</button></div>
      {offline.update && <div className="system-update"><p>Nova verzija je preuzeta. Zatvori druge kartice laboratorija i zaustavi izvođenje. Ažuriranje najprije sprema projekt; ako spremanje ne uspije, stranica ostaje otvorena.</p><button className="primary" onClick={() => { setUpdateError(''); void update().catch(error => setUpdateError((error as Error).message)); }} disabled={busy || testing}>Spremi i otvori novu verziju</button>{updateError && <p role="alert">{updateError}</p>}</div>}
      <p>Prvo otvaranje i preuzimanje nove verzije traže mrežu. Tek kada paket bude spreman, na ovom uređaju možeš offline ponovno otvoriti laboratorij, uređivati, simulirati i izvoziti projekte. Projekti se čuvaju u ovom pregledniku. Privatna objava može dodatno tražiti prijavu; javni GitHub Pages laboratorij ne traži prijavu.</p>
      <p>Za dodavanje aplikacije koristi izbornik preglednika „Instaliraj aplikaciju” ili „Dodaj na početni zaslon”, ako je dostupan.</p>
    </section>
    <section><h3>Projekti na ovom uređaju</h3><p>Stanje projekta: <b>{saveStatus}</b>. Projekti su odvojeni od paketa aplikacije. Nadogradnja ne briše lokalne projekte ni povijest.</p><p>{storage}</p><p>{persistent === true ? 'Preglednik je odobrio trajnu pohranu.' : persistent === false ? 'Pohrana je privremena prema pravilima preglednika.' : 'Status trajne pohrane nije dostupan.'} Brisanje podataka stranice ili privatni način rada mogu ukloniti projekte. ZIP je prenosiva sigurnosna kopija.</p><button disabled={!navigator.storage?.persist || persistent === true} onClick={() => void (async () => { try { const granted = await navigator.storage.persist(); setPersistent(granted); setStorage(granted ? 'Trajna pohrana je odobrena.' : 'Preglednik nije odobrio trajnu pohranu. Sačuvaj ZIP kopiju.'); } catch { setStorage('Zahtjev za trajnu pohranu nije uspio.'); } })()}>Zatraži trajnu pohranu</button></section>
    <section><h3>Provjera ovog preglednika</h3><p>Prisutnost API-ja nije potvrda da simulator radi. Pokreni zasebnu kratku provjeru; ona ne koristi učenikov program niti mijenja projekt.</p><dl className="system-capabilities">{capabilities.map(([name, supported]) => <div key={name}><dt>{name}</dt><dd>{supported ? 'Dostupan' : 'Nedostaje'}</dd></div>)}</dl><button disabled={busy || testing} onClick={() => void smoke()}>{testing ? 'Provjera u tijeku…' : 'Provjeri izvršavanje MicroPythona'}</button><p role="status">{test}</p><button disabled={testing} onClick={() => download('ESP32_Lab_provjera_preglednika.json', JSON.stringify({ version: APP_VERSION, build: APP_BUILD, recordedAt: new Date().toISOString(), browser: navigator.userAgent, capabilities: Object.fromEntries(capabilities), runtimeTest: test, offline: offline.package ?? null, studentPilot: 'Nije potvrđen ovim zapisom.' }, null, 2), 'application/json')}>Preuzmi zapis ove provjere</button></section>
    <section><h3>Opseg nastavne bete</h3><p>Referentni profil je ESP32-S3-DevKitC-1 v1.1 N16R8. ESP32 funkcionalni modeli nisu emulacija procesora. Uno/Nano imaju AVR8js za stvarni prevedeni program, GPIO/ADC/PWM, timere, vanjske prekide i UART. Arduino izvor prevodi se lokalnim razvojnim mostom; AHT10, OLED SSD1306 (HW/SW I2C) i idealizirani servo rade kroz stvarni C++ upravljački kod. DHT11/DHT22 i DS18B20 koriste GPIO vremenske protokole; DS18B20 ima ROM pretragu, CRC i više senzora na DQ uz vanjsko napajanje. DS1302 koristi trožični GPIO, kalendar, CH/WP i 31 B RAM-a; Reset čuva zadnju primljenu snimku, a trajno stanje sprema se izričito. Mreža, MicroPython prekidi i prijenos na fizičku pločicu nisu podržani. Stvarni učenički pilot i školsko računalo još treba potvrditi.</p><a href={appAsset('guide.html')} target="_blank" rel="noreferrer">Upute, oporavak i matrica provjera ↗</a></section>
  </div>;
}
