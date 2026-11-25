export const examples = {
  button: {
    title: 'Tipkalo upravlja LED-icom',
    hint: 'Pokreni program pa pritisni virtualno tipkalo. Pull-up drži GPIO5 na 1; pritisak ga spaja na GND (0).',
    code: `# Pritisni pa otpusti tipkalo i prati kada se upali LED-ica.

from machine import Pin
from time import sleep_ms

led = Pin(4, Pin.OUT)

# Unutarnji otpornik drži otvoreni ulaz na 1. Pritiskom tipkala ulaz se
# spaja na masu pa program očitava 0.
tipkalo = Pin(5, Pin.IN, Pin.PULL_UP)

print("Pritisni tipkalo u laboratoriju.")
prethodno = None

while True:
    pritisnuto = tipkalo.value() == 0
    led.value(pritisnuto)

    # Zapamti prikazano stanje. Tako jedan dugi pritisak daje samo jednu
    # poruku o promjeni.
    if pritisnuto != prethodno:
        print("Tipkalo:", pritisnuto, "LED:", led.value())
        prethodno = pritisnuto
    sleep_ms(20)
`,
  },
  blink: {
    title: 'Treptanje i vrijeme',
    hint: 'Izmijeni 500 u 150 pa ponovno pokreni. GPIO4 predstavlja vanjsku LED-icu s otpornikom.',
    code: `# Usporedi trajanje svijetle i tamne faze LED-ice. Promijeni samo jedno
# čekanje pa ponovno pokreni program.

from machine import Pin
from time import sleep_ms, ticks_ms, ticks_diff

led = Pin(4, Pin.OUT)

# Zapamti početno vrijeme u milisekundama. Razlika dvaju očitanja sata
# pokazuje koliko je vremena proteklo.
pocetak = ticks_ms()

while True:
    # Izlaz ostaje uključen tijekom prvog čekanja i isključen tijekom
    # drugog. Zbroj tih vremena daje period treptanja.
    led.on()
    print(ticks_diff(ticks_ms(), pocetak), "ms | LED 1")
    sleep_ms(500)
    led.off()
    print(ticks_diff(ticks_ms(), pocetak), "ms | LED 0")
    sleep_ms(500)
`,
  },
  busy: {
    title: 'Prisilni prekid petlje',
    hint: 'Petlja namjerno nema čekanje. Pritisni Zaustavi pa pokreni drugi primjer.',
    code: `# Pokreni petlju bez čekanja, zatim je prekini tipkom Zaustavi.

print("Petlja bez cekanja. Pritisni Zaustavi.")

# Naredba pass ne obavlja radnju. Uvjet je uvijek istinit pa program sam ne
# dolazi do kraja.
while True:
    pass
`,
  },
  i2c: {
    title: 'I2C probni uređaj',
    hint: 'Uređaj 0x38 samo vraća zapisane bajtove. Zaustavi program, isključi napajanje ili zamijeni SDA/SCL i ponovi.',
    code: `# Pronađi probni uređaj na sabirnici I2C, pošalji mu poruku pa pročitaj isti
# broj bajtova.

from machine import Pin, I2C

i2c = I2C(0, sda=Pin(8), scl=Pin(9), freq=100000)
print("Pronadjene adrese:", [hex(a) for a in i2c.scan()])

# Adresa 0x38 odabire uređaj, a duljina poruke određuje koliko bajtova
# tražimo natrag. U ovom pokusu uređaj vraća prethodno zapisane bajtove.
podaci = b"ESP32 Lab"
print("Upisano bajtova:", i2c.writeto(0x38, podaci))
print("Procitano:", i2c.readfrom(0x38, len(podaci)))
`,
  },
  frame: {
    title: 'Izvorni framebuf',
    hint: 'Piksele crta izvorni MicroPython framebuf. Ovo je dokaz modula; upravljački program SSD1306 slijedi u etapi 4.',
    code: `# Nacrtaj okvir i tekst u memoriji, zatim pošalji cijelu sliku u simulirani
# prikaz.

import framebuf
import _lab

# Jedan piksel zauzima jedan bit. Za 128 × 64 piksela stoga treba 1024
# bajta.
memorija = bytearray(128 * 64 // 8)
zaslon = framebuf.FrameBuffer(memorija, 128, 64, framebuf.MONO_VLSB)
zaslon.fill(0)
zaslon.rect(0, 0, 128, 64, 1)
zaslon.text("ESP32 Lab", 12, 12, 1)
zaslon.text("MicroPython", 12, 28, 1)
zaslon.text("framebuf OK", 12, 44, 1)

# Tek ovdje pripremljeni pikseli postaju vidljivi u prozoru pokusa.
_lab.show(memorija)
print("framebuf:", len(memorija), "bajtova; piksel:", zaslon.pixel(0, 0))
`,
  },
};
