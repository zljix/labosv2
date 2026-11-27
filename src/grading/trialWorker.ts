import { RuntimeUnavailable } from './replay';
import { runTrial } from './runTrial';
import { runtimeAsset } from '../platform/assets';
self.onmessage = async ({ data }) => {
  try {
    const { trial, artifact, seed } = data;
    const resource = async (name: string) => {
      const response = await fetch(runtimeAsset(name));
      if (!response.ok) throw Error('Nije moguće učitati ' + name);
      return response.text();
    };
    const mp =
      trial.project.language === 'micropython'
        ? {
            load: (await import(/* @vite-ignore */ runtimeAsset('runtime/micropython.mjs'))).loadMicroPython,
            machine: await resource('machine.py')
          }
        : undefined;
    if (trial.key === 'urs-lv/LV16') {
      trial.project.files['main.py'] = await resource('zbirke/urs-lv/podrska/plc.py');
      trial.project.files['plc_st.py'] = await resource('zbirke/urs-lv/podrska/plc_st.py');
    }
    try {
      self.postMessage({ result: await runTrial(trial, artifact, seed, mp) });
    } catch (e) {
      if (e instanceof RuntimeUnavailable) throw e;
      self.postMessage({
        result: {
          passed: false,
          explanation: 'Program ili sklop prijavio je pogrešku tijekom pokusa. Pokreni ga i pregledaj izlaz.'
        }
      });
    }
  } catch (e) {
    self.postMessage({ error: (e as Error).message });
  }
};
