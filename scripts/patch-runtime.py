"""Apply the small, deterministic patch to the pinned MicroPython release."""
import pathlib
import shutil
import sys

source = pathlib.Path(sys.argv[1])
root = pathlib.Path(__file__).resolve().parent.parent
port = source / 'ports/webassembly'

def replace(path, before, after):
    body = path.read_text()
    if after in body:
        return
    if body.count(before) != 1:
        raise RuntimeError(f'Patch context mismatch: {path.name}')
    path.write_text(body.replace(before, after))

replace(port / 'mphalport.c', '#include <unistd.h>', '#include <unistd.h>\n#include <emscripten.h>')
if 'lab_delay_us' not in (port / 'mphalport.c').read_text():
    replace(port / 'mphalport.c', '    uint32_t start = mp_hal_ticks_ms();\n    while (mp_hal_ticks_ms() - start < ms) {\n    }', '    // Asyncify unwinds the C/WASM stack so Worker messages can be processed.\n    // Even sleep_ms(0) yields. No source-to-source Python rewrite is used.\n    emscripten_sleep(ms);')
    replace(port / 'mphalport.c', '    uint32_t start = mp_hal_ticks_us();\n    while (mp_hal_ticks_us() - start < us) {\n    }', '    // Stage 0 has millisecond granularity; round positive waits up.\n    emscripten_sleep(us / 1000 + (us % 1000 != 0));')
# Stage 12A: precise functional microsecond waits and pulse measurement.
replace(port / 'mphalport.c', '#include "library.h"', '#include "library.h"\nEM_JS(int, lab_delay_us, (int us), { return Module.labHost?.delayUs?.(us) ? 1 : 0; });\nEM_JS(void, lab_wait_ms, (int ms), { Module.labHost?.waitMs?.(ms); });\nEM_JS(double, lab_ticks_us, (), { return Module.labHost?.ticksUs?.() ?? performance.now() * 1000; });')
replace(port / 'mphalport.c', '    emscripten_sleep(ms);', '    lab_wait_ms(ms);\n    emscripten_sleep(ms);')
replace(port / 'mphalport.c', '    // Stage 0 has millisecond granularity; round positive waits up.\n    emscripten_sleep(us / 1000 + (us % 1000 != 0));', '    // Sub-millisecond waits advance the virtual GPIO clock without host jitter.\n    if (!lab_delay_us(us)) emscripten_sleep(us / 1000 + (us % 1000 != 0));')
replace(port / 'mphalport.c', '    return mp_js_ticks_ms() * 1000;', '    return (uint32_t)lab_ticks_us();')
replace(port / 'mphalport.c', '    return mp_js_ticks_ms();', '    return (uint32_t)(lab_ticks_us() / 1000);')
replace(port / 'api.js', '        runPython(code) {', '        async runPython(code) {')
replace(port / 'api.js', '''            Module.ccall(
                "mp_js_do_exec",''', '''            await Module.ccall(
                "mp_js_do_exec",''')
replace(port / 'api.js', '''                [buf, len, value],
            );
            Module._free(buf);
            return proxy_convert_mp_to_js_obj_jsside_with_free(value);''', '''                [buf, len, value],
                { async: true },
            );
            Module._free(buf);
            return proxy_convert_mp_to_js_obj_jsside_with_free(value);''')
replace(port / 'Makefile', '\tlexer_dedent.c \\', '\tmodlab.c \\\n\tlexer_dedent.c \\')
# Upstream linebuffer:false avoids an unbounded native line buffer on print storms.
shutil.copy(root / 'runtime/modlab.c', port / 'modlab.c')
shutil.copytree(root / 'runtime/variant', port / 'variants/lab', dirs_exist_ok=True)
