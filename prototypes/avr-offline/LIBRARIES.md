# Zaključane biblioteke u offline prototipu 03

Prototip koristi postojeće izvore iz `vendor/arduino`, provjerene prema
svakoj putanji i SHA-256 iz `lock.json`. Ne preuzima dodatne biblioteke
tijekom rada u pregledniku. Wire, SPI i EEPROM dolaze iz već zaključane
Arduino AVR jezgre 1.8.8.

| Biblioteka | Inačica | Primjena |
|---|---|---|
| Bounce2 | 2.72 | Filtriranje tipkala |
| LabAHT10 | 1.0.0 | AHT10 preko Wire |
| U8g2 | 2.37.1 | Zaključani SSD1306 128×64 podskup i font 6×10 |
| Servo | 1.2.2 | AVR Timer1 i servo impulsi |
| LabI2CSensors | 1.0.0 | BMP180/BMP280/AM2320 |
| U8g2_12832 | 2.37.1 | Alternativni OLED 128×32 paket |
| LabLCD1602 | 1.0.0 | LCD1602 preko PCF8574 |
| DHT | 1.4.6 | DHT11/DHT22, bez Unified Sensor API-ja |
| OneWire | 2.3.8 | 1-Wire sabirnica |
| DallasTemperature | 4.0.6 | DS18B20; zahtijeva OneWire |

## Rad učenika u samostalnom prototipu

Uvezi postojeći Uno/Nano projekt: odabir se prenosi iz
`arduino-libraries.json`. Za samostalan izvor označi potrebne biblioteke.
Promjena izbora prekida aktivan posao i odbacuje stari HEX. U8g2 i
U8g2_12832 ne mogu biti istodobno uključeni. Odabir DallasTemperature
uključuje OneWire; isključivanje OneWire isključuje i DallasTemperature.

Odaberi trajanje simulacije. Početnih 1,2 s dovoljno je za Blink;
DHT22 primjer najprije čeka 2,1 s i zato treba barem 3 s. Najviše je
5 s simuliranog vremena po pokretanju. Još nema interaktivne promjene
ulaza tijekom izvođenja. Rezultat prikazuje serijski ispis, stanje
servo motora i tekst LCD-a odnosno broj popunjenih bajtova OLED slike.
Graf i dalje prikazuje samo D13.

## Integracija u glavno sučelje (prototip 04)

Glavni Labos koristi svoj odjeljak **Biblioteke i datoteke programa**.
Ondje prvo označi OneWire, zatim DallasTemperature; nepotpun odabir
prikazuje poruku i ne mijenja projekt. Prije uklanjanja OneWire ukloni
DallasTemperature. Pravilo automatskog uključivanja ovisnosti iz prethodnog
odjeljka odnosi se samo na samostalnu stranicu prototipa.

Integracija koristi živi simulator glavne aplikacije, s interaktivnim
ulazima i uobičajenim prikazom sklopa. Odabir trajanja 1,2 / 3 / 5 s i
završni broj popunjenih bajtova OLED-a odnose se na samostalni prototip.
Priprema oba offline paketa i rad u glavnom sučelju opisani su u
[INTEGRATION.md](INTEGRATION.md), a provjera na uređajima u [PILOT.md](PILOT.md).

## Izgradnja i identitet

Svaka biblioteka izgrađuje se zasebno za Uno i Nano istim WASM GCC 15.2
alatima kao jezgra. Izvor učenika i dalje se prevodi nakon svake promjene;
unaprijed pripremljene arhive sadrže samo biblioteku, nikad gotovu vježbu.
Linker uključuje odabrane arhive i uklanja neupotrijebljene sekcije.
EEPROM je biblioteka zaglavlja. Prototip simulira 1024 B EEPROM-a,
početno 0xFF pri svakom novom pokretanju. Zapis se ne prenosi između
odvojenih simulacija ili restarta preglednika. Preglednik dobiva zaglavlja i arhive,
a izvori i izvorne licence dostupni su u `toolchain/labos-library-sources.tar.gz`.

`library-build-manifest.json` sadrži naredbe i SHA-256 arhiva za svaku
pločicu. Novi SDK ima ključ po sadržaju. Postojeći alati ponovno se koriste,
a prethodni SDK, projekti i nepovezane predmemorije ostaju spremljeni.
Novi identitet paketa i normalizirani odabir (ime, inačica, sažetak izvora)
ulaze u identitet rezultata. Stari rezultat prototipa mora se ponovno prevesti.

Format rezultata ostaje `labos-avr-prototype-build` v2. To ne mijenja
Arduino CLI ugovor, `avr-build.json`, službeno bodovanje ili glavnu aplikaciju.
Ne prihvaćaju se proizvoljne instalacije, mrežne biblioteke ili druge inačice.
U8g2 je postojeći ograničeni Labos paket, a ne cijela upstream kolekcija zaslona.

## Provjere

```sh
npm run prototype:avr:build
npm run prototype:avr:libraries
npm run prototype:avr:test
npm run prototype:avr:worker
npm run prototype:avr:package
node --import tsx --test prototypes/avr-offline/project-bridge.test.ts
```

Matrica provjerava stvarne vježbe i sklopove na obje pločice. Posebno
provjerava pogrešne inačice/sažetke, nedostajuću ovisnost, sukob U8g2
paketa, odbacivanje starog rezultata i povratni izvoz projekta.
CI dodatno prevodi kombinaciju AHT10 + OLED + Servo s novim izvorom
unutar zasebnog mrežnog prostora, uključujući puni restart Chromiuma.
Rezultati ove etape bilježe se zasebno; sama prisutnost testa nije dokaz
prolaza. Školsko računalo i fizički mobiteli zahtijevaju zasebna mjerenja.
