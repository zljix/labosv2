# Etapa 18A — Arduino C/C++ na funkcionalnom ESP32-S3 WASM profilu

Isporuka **0.8.0-beta.1**, 13. studenoga 2026. Ovo je prvi provedeni dio etape 18: stvarni C/C++ izvor prevodi se u WebAssembly, zatim program izvodi GPIO i komunikacijske pozive na postojećem modelu sklopa. Nije Espressif Arduino core, ESP-IDF, Xtensa emulacija ni firmware za flashanje. Profili ostalih ESP32 pločica nisu dodani bez utvrđene izvedbe.

## Izvršni i projektni ugovor

- Postojeći ESP32-S3 v1.1 N16R8 dobiva izbor MicroPython / Arduino C/C++. MicroPython zadržava svoj cilj `null`, profil i interpreter. Novi C++ profil je `arduino-s3-wasm` / 1; format ostaje schemaVersion 3 / modelVersion 1.
- C++ ciljno polje za **zasebni fizički izvoz** je `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi`. To nije tvrdnja da je izvoz preveden Espressif alatima. WASM rezultat čuva se u `s3-build.json`, odvojeno od AVR `avr-build.json`.
- Ulazni SHA-256 obuhvaća sve C/C++ izvore i headere, cilj, profil, verzije Clanga/Binaryena, prevoditeljske zastavice, jezični režim, zaključani vlastiti core i odabrane zaključane biblioteke. Promjena izvora ili biblioteke odbija raniji artefakt. Hash nije digitalni potpis ni potvrda autorstva.
- Artefakt nosi pravi WASM modul, njegov SHA-256, veličinu i metapodatke. Provjeravaju se ABI, dopušteni uvozi, obvezni izvozi, najviše 80 000 B programa te ograničena 2 MiB WASM memorija. To nije mjerenje memorije fizičkog ESP32. Dinamički heap, C++ standardna biblioteka, iznimke i niti nisu deklarirani.
- Worker ponovno provjerava artefakt i odvaja sesije. Stop terminira Worker, uključujući čistu beskonačnu C++ petlju. Zakašnjele poruke ne mogu promijeniti novu sesiju.
- Promjena jezika na istoj pločici stvara zasebnu kopiju i čuva sve vodiče te oba izvora. Promjena pločice zadržava ranije pravilo odspajanja priključaka stare pločice. Ne prevodi se automatski Python u C++.

## Stvarno prevođenje

`scripts/s3-compile.mjs` koristi **Clang 19.1.7**, WASM linker i **Binaryen 120 Asyncify**. `runtime/arduino-s3` je vlastiti MIT API sloj. Core i odabrane biblioteke provjeravaju se prema potpunom popisu datoteka i SHA-256 prije posla. Nema pretvaranja konzolnog teksta u simulaciju niti zamjene programa prepoznatim predloškom.

`main.ino` i dodatni `.ino` izvori obrađuju se pravim C++ parserom, uz eksplicitni `Arduino.h` i `#line` preslikavanje. Za funkcije dodaj deklaraciju prije uporabe; **Arduino IDE automatsko dodavanje prototipova nije izvedeno**. `.cpp` koristi C++17, `.c` C11; dodatne datoteke mogu biti u korijenu ili `src/`. Lokalni headeri, dijagnostika i više datoteka rade kroz postojeći editor i izvoz.

Provjereni razvojni alatni lanac je Debian Linux x64. Paket lokalnog mosta sadrži core, ugovore i izvor prevoditelja, uz ranije AVR biblioteke. Node.js 22+ pokreće most. **Pripremi.cmd priprema AVR alate; S3 alate treba zasebno instalirati i postaviti prema README.** Windows/macOS kombinacija S3 alata nije ovdje proglašena provjerenom. Novi izvor ne prevodi se na telefonu ili u pregledniku; pripremljeni artefakti mogu se ondje izvršavati ako preglednik podrži ostale potrebne mogućnosti.

Most i dalje sluša samo na 127.0.0.1, provjerava Host/Origin, kod veze, prozor i postMessage origin te obrađuje jedan posao. S3 koristi isti tok uvoza, predmemorije, dijagnostike i predaje, uz vlastitu provjeru alata. To je lokalni alat za vlastiti/pregledani izvor, bez OS sandboxa za javno prevođenje. Nema cloud compilera.

## API i vrijeme

| API | Deklarirani funkcionalni opseg |
| --- | --- |
| GPIO | pinMode, digitalRead/digitalWrite, INPUT/OUTPUT/PULLUP/PULLDOWN i otvoreni odvod; postojeće električne provjere i dostupni N16R8 GPIO-i |
| ADC | analogRead, analogReadMilliVolts, razlučivost 1–16 bita iz idealnog 12-bitnog uzorka i prigušenje po pinu; zasićenje prema profilu, bez eFuse kalibracije/šuma |
| PWM | analogWrite 8 bita, ledcAttach/Write/Detach po priključku; 1–14 bita, najviše osam izlaza; idealni radni omjer, bez hardverskog rasporeda timera i kvantizacije frekvencije |
| Vrijeme | millis, micros, delay, delayMicroseconds, yield i pulseIn; 32-bitno prelijevanje Arduino vremena, funkcionalni virtualni mikrosekundni sat |
| Serial | begin, available, read, peek, write, osnovni Print/println; UTF-8 izlaz, ograničeni redovi i ulaz; ne simulira USB/UART bitove ili električnu brzinu |
| Wire / Wire1 | dvije odvojene I2C sabirnice s eksplicitnim SDA/SCL; 1–400 kHz, 128 B spremnici, registri, repeated-start i pogreške perifernog modela |
| SPI | eksplicitni SCK/MISO/MOSI, SPISettings, byte/full-duplex transfer i writeBytes; stvarni CS/DC/reset i podatkovni bajtovi; izravno slanje blokova za TFT |
| Osnovni C/C++ | fiksni cijeli tipovi, ograničene string/memory i matematičke funkcije; bez jamstva cijelog libc/libstdc++ API-ja |

Virtualno vrijeme napreduje s deklariranim čekanjem, API pozivima i komunikacijskim prijenosima. Asyncify čuva C++ stog i lokalne varijable kroz čekanje, omogućujući živi ulaz tijekom `setup()` ili `loop()`. Host pozivi povremeno propuštaju red poruka. Čista računska petlja bez API-ja nema procesorski vremenski model; Stop je prekida terminacijom Workera. Ne deklariraju se FreeRTOS, Wi-Fi, BLE, hardverski prekidi, DMA ili proizvoljne ESP-specifične biblioteke.

`analogWrite` je namijenjen vlastitom 8-bitnom izlazu; poziv na već pridruženi LEDC izlaz druge razlučivosti odbija se. Za servo izričito koristi `ledcAttach` i `ledcWrite`. Numerički PWM i ADC rezultati pripadaju funkcionalnom modelu, a ne mjerenju takta ili hardverske kalibracije.

## Biblioteke i primjeri

Odabir biblioteka za S3 ograničen je na **Bounce2 2.72, LabAHT10 1.0.0, LabI2CSensors 1.0.0 i LabLCD1602 1.0.0**. Koristi se njihov stvarni zaključani C++ izvor. AVR Servo, OneWire/DallasTemperature, DHT, U8g2 i vanjske ESP biblioteke još nisu deklarirane za S3 C++. WiFi.h i stari kanalni `ledcSetup` odbijaju se dijagnostikom prevoditelja. Dostupnost komponente u katalogu nije automatska potvrda svake kombinacije jezika i drivera.

| Pripremljeni primjer | Provjeravana veza |
| --- | --- |
| Treptanje | GPIO4, serijski ispis i millis/delay |
| Tipkalo/Serial | GPIO5 PULLUP → program → GPIO4; serijski 1/0/b |
| ADC/PWM | potenciometar GPIO1 → 12-bitni uzorak → GPIO4 radni omjer |
| AHT10/OLED/servo | Wire GPIO8/9; Wire1 GPIO10/11; stvarni uzorak → numerički pikseli i GPIO4 50 Hz |
| BMP180/BMP280/AM2320 | I2C registri, kompenzacija, AM2320 buđenje/CRC i OLED prikaz |
| SG90 | zaseban 5 V izvor, zajednička masa; GPIO6 1000–2000 µs |
| LCD1602 | PCF8574 bajtovi, tekst i vlastiti CGRAM znak |
| ILI9341/XPT2046 | SPI12/13/11; odvojeni CS; ADC → kalibracija/hit-test → LED GPIO4 i TFT pikseli |

OLED koristi vidljivi mali `lab_oled.h`, 128×64 i ograničen font; nije zamjena za U8g2. ILI9341 S3 inačica vidljivog drivera šalje blokove od 128 RGB565 piksela kroz SPI.writeBytes; nema punog framebuffera ni izravnog upisa slike iz sučelja. AVR driveri i svih ranijih 128 prevedenih AVR primjera ostaju odvojeni.

## Provjere i preostali dio etape 18

Novi testovi u `verification/s3.test.ts` obuhvaćaju stvarne programe, živi ulaz, komunikacijske pogreške, izvoze/predaju, sesije i pravi lokalni Clang alatni lanac. Završni broj i rezultati regresije bilježe se u isporučnom izvješću i `stage18a-evidence/`, uz zasebne logove. Ponovljeni pokusi nisu novi jedinstveni testovi.

U razvojnom Chromiumu/Linuxu opaženi su novi prazni S3 C++ projekt i izbor jezika, opseg lokalnog prevođenja, AHT10 promjena 24→85 °C s prelaskom serva 0→90°, dodir s ispisom `TOUCH LED=1 X=120 Y=160` te zadržani TFT/konzola nakon Stop. Preglednik tijekom razvoja ponovno je otvoren nakon promjena modula; opisana opažanja odnose se na konačni pokus, a ne na privremeno stanje tijekom hot-reloada. Integrirana kartica lokalnog compilera, fizička pločica, školsko računalo, Safari/iOS, Android i hladno offline otvaranje privatne domene ostaju nepotvrđeni.

**18B slijedi unutar etape 18:** proširiti S3 biblioteku/komponentnu matricu prema stvarnim pokusima, provjeriti izvoz zasebnim Espressif toolchainom i dodavati druge ESP32 pločice samo uz potvrđen pinout/profil. Ova isporuka ne proglašava cijelu etapu 18 dovršenom ni stabilnu v1.0. Etapa 19 ostaje sljedeća cjelina nakon toga.

## Primarni izvori

- LLVM WASM backend i freestanding cilj: https://github.com/llvm/llvm-project/blob/main/llvm/lib/Target/WebAssembly/README.txt
- Binaryen Asyncify API: https://github.com/WebAssembly/binaryen/blob/main/src/passes/Asyncify.cpp
- Espressif ADC API: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/adc.html
- Espressif LEDC API: https://docs.espressif.com/projects/arduino-esp32/en/latest/api/ledc.html
- Debian Clang 19.1.7 paket: https://packages.debian.org/en/trixie/amd64/clang-19/download
- Zaključani postojeći izvori biblioteka: `vendor/arduino/lock.json` i pripadni provenance zapisi.

Izvori dokumentiraju alate i javne API-je. Vlastiti funkcionalni API sloj, izbor podrške i ograničenja odluke su ovog projekta; nije preuzet niti proglašen cijeli Espressif core.
