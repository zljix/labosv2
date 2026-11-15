import { useEffect, useState } from 'react';
import { APP_BUILD, APP_BASE, appAsset } from './assets';

export interface PackageStatus { ready: boolean; build: string; version: string; count: number; bytes: number }
export interface OfflineState {
  phase: 'development' | 'unavailable' | 'preparing' | 'ready' | 'error';
  message: string; online: boolean; update: boolean; checking: boolean;
  package?: PackageStatus;
}
export function workerMessage<T>(worker: ServiceWorker, type: string, timeout = 6000): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(Error('Offline služba ne odgovara. Ponovno otvori aplikaciju uz mrežu.')); }, timeout);
    channel.port1.onmessage = ({ data }) => {
      clearTimeout(timer); channel.port1.close();
      if (data?.error) reject(Error(data.error)); else resolve(data as T);
    };
    worker.postMessage({ type }, [channel.port2]);
  });
}
let registration: ServiceWorkerRegistration | undefined;
let reloadRequested = false;
let snapshot: OfflineState = { phase: APP_BUILD === 'development' ? 'development' : 'preparing', message: '', online: true, update: false, checking: false };
const listeners = new Set<() => void>();
const publish = (patch: Partial<OfflineState>) => { snapshot = { ...snapshot, ...patch }; for (const listener of listeners) listener(); };
let started = false;
async function inspect() {
  if (!registration?.active) return;
  try {
    const result = await workerMessage<PackageStatus>(registration.active, 'LAB_STATUS');
    // A waiting update may have a different package, while this page still
    // belongs to the active release. Never label the wrong release as ready.
    publish({ package: result, phase: result.ready && result.build === APP_BUILD ? 'ready' : 'error', message: result.build !== APP_BUILD ? 'Otvorena stranica i offline paket imaju različite verzije. Zatvori druge kartice i ponovno otvori laboratorij uz mrežu.' : result.ready ? 'Cijeli paket aplikacije i interpreter su preuzeti.' : 'Offline paket nije potpun. Ponovno otvori aplikaciju uz mrežu.' });
  } catch (error) { publish({ phase: 'error', message: (error as Error).message }); }
}
async function start() {
  if (started) return;
  started = true;
  publish({ online: navigator.onLine });
  window.addEventListener('online', () => publish({ online: true }));
  window.addEventListener('offline', () => publish({ online: false }));
  if (APP_BUILD === 'development') { publish({ phase: 'development', message: 'Offline paket se provjerava u izgrađenoj aplikaciji.' }); return; }
  if (!isSecureContext || !('serviceWorker' in navigator) || !('caches' in window)) {
    publish({ phase: 'unavailable', message: 'Ovaj preglednik ili način rada ne dopušta offline paket. Projekt možeš izvesti kao ZIP.' }); return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadRequested) { reloadRequested = false; location.reload(); }
    else void inspect();
  });
  try {
    registration = await navigator.serviceWorker.register(appAsset('sw.js'), { scope: APP_BASE, updateViaCache: 'none' });
    const watch = () => {
      const installing = registration?.installing;
      if (!installing) return;
      if (!registration?.active) publish({ phase: 'preparing', message: 'Preuzimanje i provjera offline paketa…' });
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') publish({ update: !!registration?.waiting && !!registration?.active });
        if (installing.state === 'activated') void inspect();
        if (installing.state === 'redundant') {
          if (!registration?.active) publish({ phase: 'error', message: 'Offline paket nije preuzet u cijelosti. Provjeri vezu i ponovi preuzimanje.' });
          else publish({ message: 'Nova verzija nije pripremljena. Trenutačni paket ostaje dostupan.' });
        }
      });
    };
    registration.addEventListener('updatefound', watch);
    watch();
    publish({ update: !!registration.waiting && !!registration.active });
    if (registration.active) await inspect();
  } catch (error) { publish({ phase: 'error', message: 'Offline rad nije pripremljen. ' + (error as Error).message }); }
}
export function useOffline() {
  const [state, setState] = useState(snapshot);
  useEffect(() => {
    const update = () => setState(snapshot);
    listeners.add(update); void start(); update();
    return () => { listeners.delete(update); };
  }, []);
  return { ...state, refresh: async () => {
    if (snapshot.checking) return;
    publish({ checking: true });
    try {
      if (!registration) { started = false; await start(); }
      else {
        await registration.update(); publish({ update: !!registration.waiting });
        if (snapshot.phase === 'error' && registration.active && !registration.waiting && !registration.installing) {
          publish({ message: 'Ponovno preuzimanje i provjera cijelog paketa…' });
          await workerMessage(registration.active, 'LAB_REPAIR', 60000);
        }
        await inspect();
      }
    } catch { publish({ message: 'Provjera nove verzije nije uspjela. Za preuzimanje je potrebna mrežna veza.' }); }
    finally { publish({ checking: false }); }
  }, activate: async () => {
    if (!registration?.waiting) throw Error('Nova verzija još nije potpuno preuzeta.');
    reloadRequested = true;
    try { await workerMessage(registration.waiting, 'LAB_ACTIVATE'); }
    catch (error) { reloadRequested = false; throw error; }
  } };
}
