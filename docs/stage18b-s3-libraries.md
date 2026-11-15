# Etapa 18B — S3 C++ biblioteke i izvoz za Espressif

Isporuka **0.8.1-beta.1**, 13. studenoga 2026. Postojeći ESP32-S3 N16R8 profil dobiva sedam novih primjera, ukupno 15. Novi ESP32 pinout nije dodan bez potvrđene izvedbe. Format ostaje schemaVersion 3 / modelVersion 1.

## Izvedba i granice

Pravi Clang 19.1.7 / Binaryen 120 prevodi izvor u WASM. Dodana je podrška za klasične Arduino biblioteke čiji su `.h/.cpp` u korijenu paketa: prethodni compiler je pretraživao samo `src/`. Neizmijenjeni zaključani DHT, OneWire i DallasTemperature sada se stvarno prevode; nisu zamijenjeni JavaScript funkcijama za vraćanje vrijednosti klizača.

Prilagodnik dodaje `Print.h`, bitovne makroe, funkcionalne timeout brojače i aktivni `assert.h`. Neuspjela tvrdnja prekida program kroz postojeću API pogrešku. Oznaka `ARDUINO=10819` uključuje suvremeni prenosivi put biblioteka; ne definira se `ARDUINO_ARCH_ESP32`, pa WASM ne pokušava pristupiti Xtensa registrima. OneWire koristi svoj postojeći generic fallback. Izvor njegovih registarskih ESP32 implementacija ostaje za zasebno fizičko prevođenje.

`digitalRead` i ostali host pozivi pomiču funkcionalni sat za 1 µs. `microsecondsToClockCycles` skalira polling timeout, nije taktna frekvencija fizičkog procesora. `noInterrupts` / `interrupts` dopuštaju prenosivim driverima oznake kritičnog odsječka; ovaj profil ne nudi asinkrone hardverske prekide. `attachInterrupt` ostaje stvarna pogreška prevođenja. `yield()` koristi isti vremenski budžet raspoređivača kao drugi host pozivi; ne otvara novi preglednički timer za svaki DS18B20 busy-bit. Prijenosi, bajtovi i čekanje senzora ostaju aktivni.

## Provjerene biblioteke

| Paket | Verzija | Deklarirani S3 C++ opseg |
| --- | --- | --- |
| Bounce2 | 2.72 | GPIO, millis i filtriranje tipkala; stvarni više-datotečni pokus |
| LabAHT10 | 1.0.0 | Wire, zasebna sabirnica i 80 ms pretvorbe |
| LabI2CSensors | 1.0.0 | BMP180/BMP280 kompenzacija te AM2320 i CRC16 |
| LabLCD1602 | 1.0.0 | PCF8574, HD44780 ASCII i CGRAM |
| DHT | 1.4.6 | DHT11/DHT22 GPIO impulsi, kontrolni zbroj, predmemorija i NaN |
| OneWire | 2.3.8 | GPIO reset/presence, Search/Match ROM, bitni slotovi i CRC8 |
| DallasTemperature | 4.0.6 | Više DS18B20, konfiguracija 9–12 bita, busy-bit i očitanje scratchpada |
| U8g2 | 2.37.1 | SSD1306 128×64, HW I2C, stranice 128 B, priloženi font 6×10 |
| U8g2_12832 | 2.37.1 | SSD1306 UNIVISION 128×32, HW I2C, zasebna geometrija i inicijalizacija |

U8g2 i U8g2_12832 međusobno se isključuju. To su ranije ograničeni, zaključani projektni paketi; nije deklarirana cijela izvorna U8g2 biblioteka, svi fontovi, drugi zasloni ili S3 software I2C. Nepovezani SDA ne može proizvesti upaljene piksele. AVR Servo ostaje nepodržan u S3; SG90 i postojeći hobi servo i dalje koriste LEDC impulse.

## Sedam novih primjera

| Primjer | Ključni pokus |
| --- | --- |
| DHT11 | GPIO4 i vanjski 4,7 kΩ na 3,3 V, start i 40 bitova |
| DHT22 | Desetinke, predznak, −12,3 °C / 67,8 %RH i živa promjena |
| DHT22 pogreške | Prisilni pokušaji 300 ms, najmanje 2 s, nevaljani zbroj / timeout i oporavak |
| Tri DS18B20 | GPIO4, tri ROM-a, 25 / −10,125 / 60 °C, izolirana CRC pogreška |
| DS18B20 9–12 bita | Stvarni Write Scratchpad; kvantizacija i čekanje pretvorbe |
| U8g2 128×64 | Wire GPIO8/9, stvarni font/brojač/okvir, zadnji red piksela |
| U8g2 128×32 | Multiplex 31, COM 0x02, 512 panel bajtova i donji rub |

Senzori koriste izričite modele napajanja i pull-upa. DHT nije Dallas 1-Wire. DS18B20 koristi vanjsko trožično napajanje; parazitsko napajanje nije podržano. Redoslijed ROM pretrage nije poredak komponenti. +85 °C nakon uključenja nije novo mjerenje, a valjan CRC sam ne dokazuje svježinu. Primjeri zadržavaju izričit raniji tretman rubnih DallasTemperature vrijednosti −55/+85 °C.

## Kompatibilnost i izvoz

S3 core je `esp32-lab-s3-functional@1.1.0`. Stari S3 WASM rezultat odbija se zbog novog corea, zastavica i zaključanog sažetka; izvor i sklop ostaju dostupni. Potrebno je ponovno prevesti stari projekt ili otvoriti ažurirani pripremljeni primjer. Nema tihog pokretanja starog binarnog programa. AVR ugovor, sve zaključane vanjske biblioteke i MicroPython interpreter nisu namjerno mijenjani.

Arduino IDE ZIP sadrži točan izvor i headere. README navodi odabrane pakete i upućuje na `vendor/arduino` iz paketa prevoditelja; prilagođeni Lab i U8g2_12832 paketi nisu predstavljeni kao svi dostupni u Library Manageru.

`verification/s3-native.ts` izvlači izvorne ZIP-ove i zasebno ih prevodi stvarnim Arduino CLI 1.3.1 / Espressif coreom 3.3.12 za `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi`. Zapisuje verzije, izvorne sažetke te veličine i SHA-256 stvarnih ELF/BIN datoteka. WASM nije ulaz tog prevođenja niti se ELF/BIN izvršava u simulatoru. CLI prikaz globalnih varijabli nije mjerenje vršnog stoga, heapa, PSRAM-a ili ponašanja fizičke pločice.

Provjeren je razvojni Linux alatni lanac. Flashanje i fizički sklop, Windows/macOS S3 alati, Safari/iOS, Android, školsko računalo, učenički pilot i hladni offline rad privatne produkcijske domene ostaju zasebne provjere. Nema FreeRTOS-a, Wi-Fi-ja, BLE-a, DMA-a, proizvoljnog heapa ni procesorske ciklusne točnosti. WASM memorija 2 MiB ne predstavlja fizički ESP32 SRAM.

## Dokazi i nastavak

Automatski pokusi: `verification/s3-libraries.test.ts`, prošireni `verification/s3.test.ts`, zasebni native pokus i sedam Worker pokusa iz pakiranog `dist/` izlaza. Rezultati i konačni brojevi bilježe se u isporučnom izvješću i `stage18b-evidence/`. Početni neuspjeli test dijagnostike sačuvan je odvojeno: compiler je ispravno odbio ST7920, a test je očekivao drugačiju veličinu slova u imenu. Ispravljen je očekivani izraz, ne compilerova odluka.

U razvojnom Chromiumu/Linuxu opaženi su DHT22 25→−40 °C / 50→100 %RH i odbacivanje lošeg zbroja; tri DS18B20 daju zasebne ROM/temperature; U8g2 OLED 128×32 prikazuje tekst, brojač i okvir iz I2C bajtova. To nisu pokusi na fizičkoj pločici ili mobilnim preglednicima.

Sljedeća razvojna cjelina je **19A: RTC DS1302** — CE/I/O/SCLK protokol, kalendar, početno vrijeme i pravila baterijskog zadržavanja. Daljnje S3 kombinacije komponenti dobivaju status tek nakon vlastitog pokusa; sadašnji S3 katalog ne jamči podršku svih drivera iz MicroPython/AVR profila. Stabilna v1.0 još nije proglašena.

## Primarne podloge

- Službeni Espressif indeks verzija i provjerljivih preuzimanja: https://espressif.github.io/arduino-esp32/package_esp32_index.json
- Izvorni OneWire generic fallback: https://github.com/PaulStoffregen/OneWire/blob/master/util/OneWire_direct_gpio.h
- Stvarni projektni izvori i potpuni sažeci: `vendor/arduino/lock.json`, raniji provenance zapisi te `public/s3-core-lock.mjs`.
- Temeljna ograničenja: `stage18a-s3-cpp.md`; povijesni AVR/MicroPython protokoli: izvješća etapa 12A i 12B.
