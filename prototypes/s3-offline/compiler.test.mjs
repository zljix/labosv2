import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {compileSketch} from './compiler.mjs';
import {createS3Engine} from '../../public/s3-engine.mjs';

test('two changed programs run on the real LED circuit; invalid source fails', async () => {
  const core = JSON.parse(await readFile('release/core.json'));
  const circuit = JSON.parse(await readFile('release/circuit.json'));
  for (const interval of [71, 113]) {
    const source = `void setup() { Serial.begin(9600); pinMode(4, OUTPUT); }
      void loop() { digitalWrite(4,HIGH); Serial.println("test-${interval}");
        delay(${interval}); digitalWrite(4,LOW); delay(${interval}); }`;
    const wasm = await compileSketch(source,core);
    const events = [];
    const engine = await createS3Engine(wasm,circuit,event => events.push(event),{fast:true});
    try { await engine.run(4); } finally { engine.stop(); }
    const frames = events.filter(e => e.type === 'simulation');
    assert(frames.some(e => e.leds.led1.brightness > 0));
    assert.equal(frames.at(-1).leds.led1.brightness,0);
    assert(Math.abs(frames.at(-1).timeMs - 8 * interval) < 2);
    assert.equal(events.filter(e => e.type === 'console').map(e => e.text).join('').trim().split(/\s+/).join(','), Array(4).fill('test-' + interval).join(','));
  }
  await assert.rejects(compileSketch('void setup(){oops;} void loop(){}',core), /main.ino:1:/);
});
