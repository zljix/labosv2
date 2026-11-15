import { Session } from './session.mjs';
import { examples } from './examples.mjs';

const assert = (ok, message) => { if (!ok) throw new Error(message); };
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function runSuite(factory, machine, progress = () => {}) {
  const results = [];
  const sessions = new Set();
  const open = (code, config) => {
    const s = new Session(factory, machine, code, config);
    sessions.add(s);
    return s;
  };
  const done = async (code, config) => {
    const s = open(code, config);
    await s.wait(s => ['done', 'error'].includes(s.status));
    assert(s.status === 'done', s.events.find(e => e.type === 'error')?.message ?? s.text);
    return s;
  };
  async function check(id, title, fn) {
    progress({ id, title, status: 'running' });
    const started = performance.now();
    let result;
    try {
      const detail = await fn();
      result = { id, title, status: 'pass', durationMs: +(performance.now() - started).toFixed(1), detail };
    } catch (error) {
      result = { id, title, status: 'fail', durationMs: +(performance.now() - started).toFixed(1), detail: String(error.message ?? error) };
    } finally {
      for (const s of sessions) await s.stop();
      sessions.clear();
    }
    results.push(result);
    progress(result);
  }
  await check('runtime', 'Stvarni MicroPython i ograničen JS pristup', async () => {
    const s = await done(`import sys, framebuf\nprint(sys.implementation.name)\nprint(sys.version)\ntry:\n import js\n raise AssertionError('js mora biti iskljucen')\nexcept ImportError:\n pass\ntry:\n import jsffi\n raise AssertionError('jsffi mora biti iskljucen')\nexcept ImportError:\n pass\nprint('JS_DISABLED')\n`);
    assert(s.text.includes('micropython') && s.text.includes('JS_DISABLED'), s.text);
    return s.text.trim();
  });
  await check('time', 'GPIO izlaz i uobičajeno čekanje', async () => {
    const s = await done(`from machine import Pin\nfrom time import sleep_ms, ticks_ms, ticks_diff, sleep, sleep_us\np = Pin(4, Pin.OUT)\nt = ticks_ms()\nfor i in range(3):\n p.on()\n sleep_ms(30)\n p.off()\n sleep_ms(30)\nsleep(0.01)\nsleep_us(1000)\nassert ticks_diff(ticks_ms(), t) >= 180\nprint('TIME_OK', ticks_diff(ticks_ms(), t))\n`);
    assert(s.events.some(e => e.type === 'pins' && e.pins[4] === 1), 'Nema visokog izlaza');
    assert(s.events.some(e => e.type === 'pins' && e.pins[4] === 0), 'Nema niskog izlaza');
    return s.text.trim();
  });
  await check('input', 'Tipkalo u aktivnoj Python petlji', async () => {
    const s = open(examples.button.code);
    await s.wait(s => s.events.some(e => e.type === 'pins' && e.pins[4] === 0));
    const t = performance.now();
    s.input({ button: true });
    await s.wait(s => s.events.some(e => e.type === 'pins' && e.pins[4] === 1));
    const inputMs = +(performance.now() - t).toFixed(1);
    const index = s.events.length;
    s.input({ button: false });
    await s.wait(s => s.events.slice(index).some(e => e.type === 'pins' && e.pins[4] === 0));
    return { pressToOutputMs: inputMs, released: true };
  });
  await check('stop', 'Stop bez čekanja i novo pokretanje', async () => {
    const latencies = [];
    const restarted = [];
    for (let i = 0; i < 3; i++) {
      const s = open('while True:\n pass\n');
      await s.wait(s => s.status === 'running');
      await pause(40);
      const stopStarted = performance.now();
      const ms = await s.stop();
      latencies.push(+ms.toFixed(2));
      assert(ms < 500, `Stop traje ${ms} ms`);
      const fresh = await done('from machine import Pin\nPin(4, Pin.OUT).on()\nprint("RESTART_OK")');
      restarted.push(+(performance.now() - stopStarted).toFixed(1));
      assert(fresh.text.includes('RESTART_OK'), 'Novi program nije pokrenut');
      await fresh.stop();
    }
    return { stopAwaitMs: latencies, stopToNewProgramCompletedMs: restarted, freshRuns: 3, note: 'Browser terminate() has no completion acknowledgement; stopAwaitMs measures the command, not physical thread destruction.' };
  });
  await check('i2c', 'I2C transakcije i pogrešna adresa', async () => {
    const s = await done(`from machine import Pin, I2C\ni = I2C(0, sda=Pin(8), scl=Pin(9))\nassert i.scan() == [0x38]\nassert i.writeto(0x38, b'LAB') == 3\nassert i.readfrom(0x38, 3) == b'LAB'\nb = bytearray(3)\ni.readfrom_into(0x38, b)\nassert b == b'LAB'\ntry:\n i.writeto(0x39, b'x')\n raise AssertionError('Nema NACK-a')\nexcept OSError as e:\n assert e.args[0] == 19\nprint('I2C_OK')`);
    assert(s.events.some(e => e.type === 'i2c' && e.bytes.join(',') === '76,65,66'), 'Nema stvarnog prijenosa');
    return 'scan, writeto, readfrom, readfrom_into, NACK na 0x39';
  });
  await check('wiring', 'I2C napajanje i zamijenjeni SDA/SCL', async () => {
    const code = `from machine import Pin, I2C\ni = I2C(0, sda=Pin(8), scl=Pin(9))\nassert i.scan() == []\ntry:\n i.writeto(0x38, b'x')\n raise AssertionError('Uredjaj ne smije odgovarati')\nexcept OSError:\n pass\nprint('DISCONNECTED_OK')`;
    await done(code, { powered: false });
    await done(code, { swapped: true });
    await done(`from machine import Pin, I2C\nassert I2C(0, sda=Pin(9), scl=Pin(8)).scan() == []`);
    return '3 negativna slučaja prolaze; echo uređaj nije model AHT10';
  });
  await check('framebuf', 'Izvorni framebuf i izlaz piksela', async () => {
    const s = await done(examples.frame.code);
    const f = s.events.find(e => e.type === 'frame');
    assert(f?.bytes.length === 1024 && (f.bytes[0] & 1) === 1, 'Netočan framebuffer');
    assert(f.bytes.some((v, i) => i > 128 && i < 800 && v > 0), 'Nema sadržaja zaslona');
    return '1024 bajta, 128 × 64, MONO_VLSB, tekst i rub';
  });
  await check('gc', 'Garbage collector tijekom izvođenja', async () => {
    const s = await done(`import gc\nfrom time import sleep_ms\nkeep = [123, 'sacuvano']\nfor i in range(100):\n a = [bytearray(512) for j in range(20)]\n gc.collect()\n sleep_ms(0)\n assert keep == [123, 'sacuvano']\nassert len(a) == 20\nprint('GC_OK', gc.mem_free())`);
    assert(s.text.includes('GC_OK'), s.text);
    return s.text.trim();
  });
  await check('errors', 'Python pogreške i novi čisti kontekst', async () => {
    for (const [code, name] of [["raise ValueError('pokusna pogreska')", 'ValueError'], ['while True print(1)', 'SyntaxError']]) {
      const s = open(code);
      await s.wait(s => ['error', 'done'].includes(s.status));
      assert(s.status === 'error' && s.events.some(e => e.message?.includes(name)), `Nedostaje ${name}`);
    }
    await done("assert 'led' not in globals()\nfrom machine import Pin\np = Pin(4, Pin.OUT)\nassert p.value() == 0\np.init(Pin.IN, Pin.PULL_UP)\nassert p.value() == 1\ntry:\n Pin(35)\n raise AssertionError('Nepodrzan GPIO')\nexcept ValueError:\n pass\nprint('CLEAN_OK')");
    return 'ValueError, SyntaxError, izolacija novog pokretanja';
  });
  await check('console', 'Ograničen ispis i odziv glavne dretve', async () => {
    const s = await done("for i in range(30000):\n print('x', end='')\nprint()\nfrom machine import Pin\np = Pin(4, Pin.OUT)\nfor i in range(10000):\n p.init(Pin.IN)\n p.init(Pin.OUT)", {});
    assert(s.text.length < 20000, `Ispis nije ograničen: ${s.text.length}`);
    assert(s.text.includes('Ogranicen ispis'), 'Nema oznake ograničenja');
    const pinMessages = s.events.filter(e => e.type === 'pins').length;
    assert(pinMessages < 200, `Previše poruka pinova: ${pinMessages}`);
    return { consoleCharacters: s.text.length, consoleMessages: s.events.filter(e => e.type === 'console').length, pinMessages };
  });
  return { schemaVersion: 1, generatedAt: new Date().toISOString(), runtime: 'MicroPython v1.29.0 + lab Asyncify patch', results, passed: results.filter(r => r.status === 'pass').length, total: results.length };
}
