# ESP32 MicroPython Lab — etape 22D i 22E

**0.12.3-beta.1 · 14. studenoga 2026.** Nastavak izvora `7fe0e157dc3f0333d64d2dab97b816ec331edb0d` (0.12.2-beta.1). Paket završava S3 C++ protokolne primjere pa preostale deklarirane URS varijante. Izdanje ostaje nastavna beta.

## Isporučeno i kako otvoriti

**Vježbe → URS zbirka → S3 · Arduino C++** sada ima svih **63/63** varijanti u 16 tema, jednako ostalim trima ciljevima. Ukupno je **252 kombinacije varijanta × cilj**. Svaki početni program ima vlastiti izvor, stvarni sklop, upravljačke datoteke, točno vezani WASM prijevod i radni list. Broj u izborniku S3 primjera raste **48 → 67**; dodano je 19 programa i 18 prethodno nedostupnih URS putova (samostalni irNEC ostaje dodatni primjer izbornika).

| Etapa | Novi programi |
| --- | --- |
| 22D · IR NEC | irPulses, irNEC, irLED, irTransmit |
| 22D · SPI | tftGraphics, tftRotation, bmp280SPI, spiDashboard |
| 22E · mjerenje i pokazivači | bmp180, bmp280, am2320, ds18Errors, tmSegments, tmClock |
| 22E · veći TFT i dodir | iliGraphics, iliRotation, touchRaw, touchCalibration, touchRotation |

URS03 je 4/4, URS06 3/3, URS07 4/4, URS09 3/3, URS12 4/4 i URS13 6/6. Ostale teme zadržavaju potpunu raniju pokrivenost. Školske LV1/LV2 i broj 63 jedinstvene varijante nisu mijenjani.

## Programi i priključci

| Put | Točni priključci i uloga programa |
| --- | --- |
| IR RX / LED | VCC=3V3, GND, OUT=GPIO4; LED preko 680 Ω na GPIO7. Program mjeri aktivno LOW izlaz. Adresa 0: POWER69 samo novi okvir, PLUS70/MINUS21 i ponavljanja; PWM 0–100 %. |
| IR TX | VCC=3V3, GND, SIG=GPIO5. LEDC 38000 Hz i duty 85/255 stvaraju nositelj unutar NEC mark impulsa. Po dvije posebne repeat poruke, počeci približno svakih 110 ms. |
| SPI ST7735 / BMP280 | SCK12/MOSI11/MISO13, TFT CS10/DC9/RESET8, BMP280 CS7, VCC/logika/BL=3V3 i GND. CS postaje HIGH prije SPI.begin(12,13,11). Svaki uređaj ima zasebni CS. |
| I2C pojedinačni senzori | SDA8/SCL9, VCC=3V3 i GND. LabI2CSensors 1.0.0 čita registre/kalibraciju i računa °C, Pa ili %RH. AM2320 ima početno čekanje, CRC i prethodni uzorak. |
| DS18B20 | DQ4 uz vanjski 4,7 kΩ na VDD=3V3 i GND. OneWire 2.3.8 / DallasTemperature 4.0.6 pokazuju početni 85 °C, stari registar tijekom pretvorbe i novi nakon 750 ms. |
| TM1637 | CLK4/DIO5, VCC=5 V, LV=3V3, GND. Vidljivi lab_tm1637.h šalje segmente i čita ACK. MM:SS programsko brojilo razlikuje se od RTC-a. |
| ILI9341 / XPT2046 | SPI12/11/13, TFT CS10/DC9/RESET8, touch CS7 i opcionalni IRQ2; VCC/logika/BL=3V3 i GND. Program računa kalibraciju, logičku rotaciju i položaj iz sirovih X/Y/Z1/Z2. |

**lab_s3_nec.h** je novi vidljivi MIT izvor. Prima standardni NEC s 8-bitnom adresom/naredbom i inverznim bajtovima. Uzorkuje GPIO uz čekanje 25 µs između očitanja, traži početak u prozoru 12 ms, započeti okvir prati do kraja uz ukupnu granicu 100 ms. Pozivi API-ja u funkcionalnom satu dodaju vlastite korake; ukupni razmak uzoraka stoga je nešto dulji od samih 25 µs. To nije izmjerena fizička brzina procesora. Nevaljani inverz/vrijeme brišu povijest. Repeat se prihvaća do 150 ms od zadnjeg valjanog primitka. Nema novih skrivenih API-ja niti izravnog čitanja naredbe daljinskog iz modela.

S3 nema asinkroni attachInterrupt: dekoder koristi polling, a blokirajući predajnik ne prima istodobno vlastito slanje. TX primjer pokazuje stvarni trag uparenog OUT-a u Mjerenjima. Spor pozivatelj može izgubiti cijeli okvir. irPulses ispisuje izmjereni uvod te posljednji bitni mark/space; ne obećava ispis svih impulsa.

ST7735 zadržava postojeći izričiti Lab 128×128 green-tab profil s njegovim pomacima i četiri rotacije. To nije univerzalna kalibracija fizičkih panela. TFT driver prilagođen S3-u šalje blokove od 256 B preko SPI.writeBytes; nema punog framebuffera. ILI9341 koristi 240×320 ili 320×240 bez ST7735 pomaka. BMP280 računa iz kalibracijskih i sirovih registara; odspojeni MISO vraća 0xFF i ne daje uspješnu inicijalizaciju.

Novi primjeri izvoze točne .ino/.h datoteke. Promjena programa ili headera poništava stari prijevod. Promjena sklopa zadržava isti prijevod i nove električne uvjete. **Svih 48 ranijih S3 artefakata potpuno je jednako.** MicroPython WASM, funkcionalni S3 core/ABI, protokolni i električni modeli, AVR artefakti i zaključane biblioteke nisu izmijenjeni.

## Dokazi

**1 211/1 211 različitih programskih testova prošlo je u završnoj širokoj regresiji, bez preskakanja ili preostale pogreške.** Zapis je `docs/stage22d-evidence/full-regression-final.tap`. Osam zasebnih provjera offline mehanizma također prolazi. AVR compiler pokusi izvedeni su s dostupnim zaključanim CLI/core/GCC alatima, nisu preskočeni.

Novih **76 testova** čine 47 protokolnih i 29 dovršetka zbirke. Uključuju izvor/sklop/prijevod i projektni/sketch ZIP za svaki primjer, stvarne žive ulaze, CRC/svježinu, kalibraciju i rotacije, neispravne vodiče, napajanje, BL, CS i SPI način, odbijanje starog artefakta i stvarni compiler za izmijenjeni izvor/nedostajući header. Broj ponovnih izvođenja ne povećava broj jedinstvenih testova.

Završnih **22 pokusa zapakiranog Workera** izvršava svih 19 novih programa, odspojeni IR OUT, odspojeni BMP MISO i odbijanje izmijenjenog NEC headera. Točan build, konzole, sažeci piksela i mjerena vremena prisilnog Stop-a nalaze se u `docs/stage22d-evidence/packaged-s3-protocols.json`. Prisilni prekid mjeri se u Node/Linuxu; opaženo je 1.73–21.66 ms uz granicu 500 ms. To nije mjerenje ciljnog školskog računala ili mobilnog preglednika. Puni RGB565 dokazi sažeti su brojem, uzorcima i SHA-256; provjere prije sažimanja uspoređuju stvarne piksele.

Početna široka regresija otkrila je vremenski ovisnu pogrešku postojećeg testa enkodera: console poruka mogla je prethoditi završnom simulation okviru. U testnom je pokretaču završni snapshot odgođen dok se dostava console poruke ne vrati, pa tek onda slijedi Stop. Isti postupak koristi novi IR testni pokretač. Nije promijenjen program, artefakt ili fizički model radi zadovoljavanja očekivanja. Početni i završni zapisi čuvaju se zasebno.

U razvojnom Chromeu/Linuxu stvarno su potvrđeni potpuni URS brojevi, IR POWER/PLUS i dugi pritisak do 100 %, te BMP280 instrument od 24 °C/101325 Pa do **−40 °C/30000 Pa** kroz žive klizače. TFT je prikazao promijenjene podatke; Stop je sačuvao konzolu i piksele. Nakon Stop-a klizači ponovno predstavljaju spremljene početne vrijednosti, a posljednji okvir ostaje sačuvan.

Otvoren je pravi URS13 projekt kalibracije sa šest datoteka, radnim listom i novim pojmovima. Gumb **Sklop i editor** otvara žive kontrole. Pomoću tipkovničkih klizača i pritiska/otpuštanja snimljeni su (20,20) i (219,299); program je ispisao **CAL READY 201 3899 251 3849**, a sljedeći pritisak **CAL POINT 219 299**. Ovo nije učenički pilot niti zasebna produkcijska preglednička provjera.

## Matrica i granice

| Cilj | URS varijante | Razvojno provjerene stavke | Eksperimentalne | Otvorene |
| --- | ---: | ---: | ---: | ---: |
| S3 MicroPython | 63 | 16 | 21 | 2 |
| S3 Arduino C++ | 63 | 0 | 37 | 2 |
| Uno R3 | 63 | 0 | 37 | 2 |
| Nano classic | 63 | 0 | 37 | 2 |

Matrica ima 39 stavki × četiri cilja = 156 polja. Pomoć, URS sučelje i generirani CSV opisuju aktualnu pokrivenost. Eksperimentalno označava deklarirani funkcionalni model i razvojne dokaze; nije fizička potvrda.

Otvoreni ostaju **samostalni generički pretvornik razina i točna SFM-20B izvedba**. Idealna prilagodba unutar izričitih carrier modula ne zatvara prvi zadatak. Generičke aktivna/pasivna zujalica ne potvrđuju SFM-20B. DevKitC V4 i CAM trebaju točan zaseban profil i rezervirane priključke; ne kopira se S3 pinout.

Nema opće IRremote kompatibilnosti, Extended NEC/NEC2, AGC-a ili fizičkog dometa. SPI BMP280 nema IIR/3-wire; TFT nema proizvoljne grafičke biblioteke, fizičku gamma dinamiku ili univerzalne pomake. Z dodira nije sila. Fizičko prevođenje novih izvoza s pravim Espressif coreom, fizički moduli, Windows/macOS, ciljni iOS/Safari/Android, hladno offline pregledničko otvaranje i samostalan rad stvarnog učenika nisu potvrđeni ovom isporukom. **Stabilna puna URS v1.0 čeka te dokaze i preostale deklarirane profile.**

## Lokalno pokretanje i nastavak

Raspakiraj **ESP32_MicroPython_Lab_0.12.3_Lokalno.zip** u zasebnu mapu. Potreban je Node.js 22+. Windows: **Pokreni.cmd**; Linux/macOS: `node start-local.mjs`. Otvori **http://127.0.0.1:4173/** i ostavi terminal otvoren. Promijenjeni C++ koristi postojeći lokalni prevoditelj; za ovu lokalnu aplikaciju postavi `LAB_ARDUINO_SITE=http://127.0.0.1:4173`.

Izgradnja **c2fe5d841263793d**. Raspakirani ZIP poslužen je stvarnim loopback HTTP-om: **176 resursa / 15 133 659 B**; svi hashovi/veličine i dva WASM MIME odgovora potvrđeni. ZIP: **5 136 814 B**, SHA-256 `ceee96440b6e1b54957db8ae47a1a3e65267e3b47c6e70e33045c8e3051d7afe`. Ovo nije hladni offline preglednički pokus.

**Sljedeći paket 22F:** provjera izvoza novododanih programa na stvarnom Espressif coreu, provjera nastavnog toka i priprema ciljnih školskih/mobilnih/offline pokusa. Točne SFM-20B, pretvornik razina, DevKitC V4 i CAM izvedbe ovise o potvrđenim profilima; fizička opažanja i stvarni pilot ne zamjenjuju se razvojnim testovima.

## Tehničke podloge

- [Espressif Arduino LEDC API](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html) — provjereni pin-based API oblik; funkcionalni core nije Espressif core.
- [Bosch BMP280 datasheet, rev. 1.26](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf) — SPI i kompenzacijski postupak; koristi se postojeći ograničeni model.
- [Adafruit ST7735 izvor](https://github.com/adafruit/Adafruit-ST7735-Library/blob/master/Adafruit_ST7735.cpp) — usporedna podloga za različite geometrije/panele; ovdje se izvodi vlastiti vidljivi Lab driver.
- Postojeće specifikacije `stage13b-infrared.md`, `stage16-spi.md`, `stage17a-ili9341.md`, `stage17b-touch.md`, `stage18b-s3-libraries.md`, `stage22-urs.md` i `stage22c-s3-controls.md`.

Web podloge provjerene su 14. studenoga 2026. Tvrdnje o izvedenom ponašanju temelje se na projektu i navedenim pokusima, a ne na svojstvima vanjske biblioteke ili fizičkog modula.

