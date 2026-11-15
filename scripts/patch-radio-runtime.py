"""Deterministic optional JS scheduler hook; no WASM/source transformation."""
from pathlib import Path
p=Path(__file__).resolve().parent.parent/'public/runtime/micropython.mjs'
before='var _emscripten_sleep = (ms) => Asyncify.handleSleep((wakeUp) => safeSetTimeout(wakeUp, ms));'
after='var _emscripten_sleep = (ms) => Asyncify.handleSleep((wakeUp) => Module.labHost?.scheduleSleep ? Module.labHost.scheduleSleep(wakeUp, ms) : safeSetTimeout(wakeUp, ms));'
s=p.read_text()
if after not in s:
    if s.count(before)!=1: raise RuntimeError('MicroPython sleep hook context mismatch')
    p.write_text(s.replace(before,after))

s=p.read_text()
marker='// Lab: proxy state is scoped to this ES module instance, never shared between nodes.\nlet Module;\n'
if not s.startswith(marker):
    if s.count('    let Module = {};')!=1: raise RuntimeError('MicroPython proxy scope context mismatch')
    p.write_text(marker+s.replace('    let Module = {};','    Module = {};',1))
