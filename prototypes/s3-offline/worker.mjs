import {createS3Engine} from '../../public/s3-engine.mjs';
self.onmessage = async ({data}) => {
  try {
    const {compileSketch} = await import("./compiler.mjs");
    const core = await (await fetch('./core.json')).json();
    const circuit = await (await fetch('./circuit.json')).json();
    const wasm = await compileSketch(data, core);
    postMessage({type: 'compiled', size: wasm.length});
    const engine = await createS3Engine(wasm,circuit, event => {
      if (event.type === 'simulation') postMessage({type:'frame', time:event.timeMs, light:event.leds.led1.brightness});
      if (event.type === 'console') postMessage(event);
    });
    try { await engine.run(4); } finally { engine.stop(); }
    postMessage({type:'done'});
  } catch (error) { postMessage({type:'error', message:String(error.message || error)}); }
};
