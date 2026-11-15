// ESP32 MicroPython Lab stage 0; fixed, collectable heap and no public JS bridge.
#define MICROPY_VARIANT_ENABLE_JS_HOOK (0)
#define MICROPY_PY_FRAMEBUF (1)
#define MICROPY_PY_JS (0)
#define MICROPY_PY_JSFFI (0)
