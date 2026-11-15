export const examples = {
  button: {
    title: 'Tipkalo upravlja LED-icom',
    hint: 'Pokreni program pa pritisni virtualno tipkalo. Pull-up drži GPIO5 na 1; pritisak ga spaja na GND (0).',
    code: `from machine import Pin\nfrom time import sleep_ms\n\nled = Pin(4, Pin.OUT)\ntipkalo = Pin(5, Pin.IN, Pin.PULL_UP)\n\nprint("Pritisni tipkalo u laboratoriju.")\nprethodno = None\nwhile True:\n    pritisnuto = tipkalo.value() == 0\n    led.value(pritisnuto)\n    if pritisnuto != prethodno:\n        print("Tipkalo:", pritisnuto, "LED:", led.value())\n        prethodno = pritisnuto\n    sleep_ms(20)\n`,
  },
  blink: {
    title: 'Treptanje i vrijeme',
    hint: 'Izmijeni 500 u 150 pa ponovno pokreni. GPIO4 predstavlja vanjsku LED-icu s otpornikom.',
    code: `from machine import Pin\nfrom time import sleep_ms, ticks_ms, ticks_diff\n\nled = Pin(4, Pin.OUT)\npocetak = ticks_ms()\nwhile True:\n    led.on()\n    print(ticks_diff(ticks_ms(), pocetak), "ms | LED 1")\n    sleep_ms(500)\n    led.off()\n    print(ticks_diff(ticks_ms(), pocetak), "ms | LED 0")\n    sleep_ms(500)\n`,
  },
  busy: {
    title: 'Prisilni prekid petlje',
    hint: 'Petlja namjerno nema čekanje. Pritisni Zaustavi pa pokreni drugi primjer.',
    code: `print("Petlja bez cekanja. Pritisni Zaustavi.")\nwhile True:\n    pass\n`,
  },
  i2c: {
    title: 'I2C probni uređaj',
    hint: 'Uređaj 0x38 samo vraća zapisane bajtove. Zaustavi program, isključi napajanje ili zamijeni SDA/SCL i ponovi.',
    code: `from machine import Pin, I2C\n\ni2c = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)\nprint("Pronadjene adrese:", [hex(a) for a in i2c.scan()])\npodaci = b"ESP32 Lab"\nprint("Upisano bajtova:", i2c.writeto(0x38, podaci))\nprint("Procitano:", i2c.readfrom(0x38, len(podaci)))\n`,
  },
  frame: {
    title: 'Izvorni framebuf',
    hint: 'Piksele crta izvorni MicroPython framebuf. Ovo je dokaz modula; upravljački program SSD1306 slijedi u etapi 4.',
    code: `import framebuf\nimport _lab\n\nmemorija = bytearray(128 * 64 // 8)\nzaslon = framebuf.FrameBuffer(memorija, 128, 64, framebuf.MONO_VLSB)\nzaslon.fill(0)\nzaslon.rect(0, 0, 128, 64, 1)\nzaslon.text("ESP32 Lab", 12, 12, 1)\nzaslon.text("MicroPython", 12, 28, 1)\nzaslon.text("framebuf OK", 12, 44, 1)\n_lab.show(memorija)\nprint("framebuf:", len(memorija), "bajtova; piksel:", zaslon.pixel(0, 0))\n`,
  },
};
