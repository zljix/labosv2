# Etapa 10B — BMP180, BMP280 i AM2320

**Isporuka: 0.4.2-beta.1 · 12. studenoga 2026.** Nastavak postojeće privatne aplikacije i formata projekta 3. Stabilna v1.0 još nije proglašena.

Tri nova senzora imaju grafičke prikaze, električne profile, žive ulaze, komunikacijske modele, upravljačke datoteke i primjere za **ESP32-S3/MicroPython te Arduino Uno R3 i Nano classic/Arduino C/C++**. Meteorološka stanica povezuje sva tri senzora i OLED na zajedničku I2C sabirnicu. Postojeći AHT10 zadržava zasebnu sabirnicu.

## Što sada radi

| Uređaj | Implementirani opseg |
| --- | --- |
| BMP180, 0x77 | Chip ID 0x55, 11 kalibracijskih koeficijenata, big-endian registri, naredbe temperature i tlaka, SCO/busy, sva četiri OSS čekanja i soft reset |
| BMP280, 0x76 ili 0x77 | Chip ID 0x58, zasebna little-endian kalibracija, 20-bitni ADC podaci, sleep/forced/normal način, oversampling i standby vrijeme, status početnog učitavanja, soft reset i konzistentno burst očitanje |
| AM2320, 0x5C | Početno čekanje, buđenje s očekivanim NACK-om, 100 kHz granica, naredba 03 za registre 0–3, čekanje odgovora, predznak temperature, CRC16 i prethodni uzorak s razmakom očitanja najmanje 2 s |
| I2C | Registarski pokazivač i repeated-start u MicroPython prijenosima, AVR TWI-ju i GPIO software I2C putu; readfrom_mem, readfrom_mem_into i writeto_mem |
| Mjerenja | Odvojeni temperatura/vlaga/tlak, hPa u prikazu i Pa u CSV-u; najviše 200 pročitanih uzoraka i 100 prijenosa |

BMP180 i BMP280 ne mjere vlagu. BMP280 ovdje nije BME280. Njegov četveropriključni I2C modul ima interno zadane CS/SDO postavke; ne predstavlja sve izvedbe breakout pločica. SPI i IIR filtar još nisu dio ove isporuke; nepodržana postavka daje dijagnostiku.

Modeli vraćaju kalibracijske koeficijente i sirove registre. Inverzni izračun modela određuje ADC riječ za zadani okoliš, a **učenikov driver čita bajtove i računa temperaturu i tlak**. OLED se mijenja tek nakon grafičkih I2C upisa programa. Ne prepoznaje se tekst izvora radi izravnog prepisivanja klizača u rezultat.

## Kako isprobati

1. U popisu **ARDUINO · UNO / NANO** otvori **Arduino · meteorološka stanica** i klikni **Pokreni**. Iz Nano projekta dobiva se Nano primjer; iz ESP32 projekta Uno primjer.
2. Promijeni BMP280 na 30 °C i 950 hPa. Provjeri serijski ispis, OLED i karticu **Mjerenja**. Tlak u programu/CSV-u iznosi približno 95000 Pa.
3. Promijeni AM2320 na −5 °C i 70 % RH. On vraća prethodni uzorak; pri kontinuiranom radu novi okoliš pojavit će se nakon sljedećeg mjernog ciklusa. To je modelirano ponašanje, a ne kvar klizača.
4. Pojedinačni primjeri BMP180, BMP280 i AM2320 uvode komponente prije stanice.
5. U **ESP32 · MICROPYTHON PRIMJERI** postoje ista tri pojedinačna primjera i **Meteorološka stanica · četiri I2C uređaja**. U projektu ostaje vidljiva datoteka `lab_i2c_sensors.py`, a u stanici i `ssd1306.py`.
6. Za promjene Arduino izvora preuzmi novi paket prevoditelja u prozoru **Prevedi**. Stari paket ne sadrži LabI2CSensors. Poznati primjeri imaju odgovarajući unaprijed prevedeni program i pokreću se bez lokalnog prevoditelja.

| Zajednička sabirnica stanice | ESP32-S3 | Uno / Nano |
| --- | --- | --- |
| Napajanje I2C modula | 3V3, GND | 5 V, GND; izričit profil modula s regulatorom i prilagodbom logičkih razina |
| SDA / SCL | GPIO8 / GPIO9 | A4 / A5 |
| Adrese | BMP180 0x77, BMP280 0x76, AM2320 0x5C, OLED 0x3C | Iste adrese |
| Osnovni takt | 100 kHz | AM2320 driver postavlja 100 kHz prije očitanja |

Profil na 5 V nije tvrdnja da je svaki fizički modul s regulatorom siguran za sve 5 V signale. Postojeći 3,3 V profili i projekti ostaju sa svojim izvornim značenjem. Pogrešna naponska domena, odsutno napajanje ili masa, zamijenjene linije, izostanak pull-upa i sukob adresa ne daju valjan rezultat.

## Upravljačke datoteke, memorija i primjeri

**LabI2CSensors 1.0.0** nova je izvorna MIT projektna biblioteka s klasama LabBMP180, LabBMP280 i LabAM2320. Koristi pravi Wire, kalibracijske registre, repeated-start, čekanja pretvorbe i CRC. Nema poziva specifičnih za simulator. MicroPython driver 1.0.0 koristi iste dokumentirane protokole. To nije tvrdnja o provjerenosti svih drugih biblioteka za ove senzore.

Izvori i licencija uključeni su u paket lokalnog prevoditelja; SHA-256 i točan popis datoteka provjeravaju se pri prevođenju. Ranije zaključane biblioteke Bounce2, LabAHT10, U8g2 i Servo ostaju dostupne. Za izvor i kalibracijske reference postoji `vendor/arduino/stage10b-provenance.json`; Python driver je dodan u postojeći manifest podrijetla.

| Novi Arduino primjer | Flash | Statički SRAM |
| --- | ---: | ---: |
| BMP180 | 7424 B | 461 B |
| BMP280 | 8974 B | 466 B |
| AM2320 | 6294 B | 416 B |
| Meteorološka stanica | 19214 B | 944 B |

Rezultati vrijede za zaključane Uno i Nano ciljeve. U8g2 koristi stranicu od 128 B. Najmanji opaženi razmak stoga do statičkih podataka u stanici bio je **870 B**; dinamički heap nije zasebno praćen pa to nije opća procjena slobodnog RAM-a. Četiri nova primjera po Arduinu povećavaju skup na **22 prevedena primjera ukupno**; četiri nova ESP32 primjera koriste stvarni MicroPython WASM.

Integracijski pokus otkrio je da U8g2 mijenja takt hardverske sabirnice. LabAM2320 zato prije svakog čitanja izričito vraća 100 kHz; simulator ne zanemaruje njegovo ograničenje radi prividno uspješnog primjera. MicroPython OLED natpisi stanu u 128 piksela i pri tlaku 1100,0 hPa.

## Automatske provjere

| Skup | Prolazi |
| --- | ---: |
| Projekti, arhive, pohrana i topologija | 26/26 |
| Pločice i migracija | 9/9 |
| Osnovni simulator | 12/12 |
| Postojeći MicroPython uređaji i driveri | 16/16 |
| MicroPython jezgra i projektne datoteke | 13/13 |
| Pet vježbi i predaja | 20/20 |
| Offline paket | 8/8 |
| Osnovni AVR ugovor, jezgra i Worker | 15/15 |
| Arduino okruženje i stvarni compiler | 12/12 |
| Prethodna AVR periferija i produkcijski Worker | 12/12 |
| Novi senzori, registri, driveri i Worker | 17/17 |
| **Ukupno jedinstvenih provjera** | **160/160** |

Nakon posljednje dorade OLED natpisa dodatno su ponovljene dvije relevantne provjere završnog paketa; nisu ponovno ubrojene u 160. Prolaze TypeScript, produkcijska izgradnja i provjera razlika. Stvarne compiler provjere nisu preskočene.

Novi dokazi uključuju Boschov BMP180 referentni primjer UT=27898, UP=23843 → 15 °C i 69964 Pa; BMP280 ADC 519888/415148; granice −40/85 °C i 30000/110000 Pa kroz pravi Python driver; sve BMP180 OSS pretvorbe; BMP280 normal/standby i zaštitu burst očitanja; poznati AM2320 CRC vektor, negativnu temperaturu, namjerno oštećen CRC i prethodni/novi uzorak. Izmjena kalibracijskog koeficijenta u driveru mijenja njegov rezultat.

Stvarno prevedeni GPIO I2C master na D6/D7 čita BMP280 chip ID i šest kalibracijskih bajtova uz repeated-start i pravi deveti ACK. Objedinjeni C++ program potvrđen je na Uno i Nano modelu. Produkcijski Nano Worker prihvaća promjenu tlaka i temperature; opaženi prisilni prekid oko 3 ms vrijedi za Node/Linux pokus, ne za školsko računalo. Detalji su u `docs/stage10b-evidence/`.

## Opaženo u pregledniku

Chromium/Linux razvojni pregled potvrđuje Nano stanicu: BMP280 24 → 30 °C i 1013,25 → 950 hPa mijenja serijski ispis i stvarne OLED piksele; AM2320 24 → −5 °C i 50 → 70 % RH najprije vraća prethodni pa novi uzorak. Kartica Mjerenja prikazuje tlak, prazno polje vlage za BMP senzore te 944 B statičkog SRAM-a i opaženi razmak stoga 870 B. Program je zaustavljen nakon pokusa.

Razvojni MicroPython pregled prvotno je dohvaćao stari neadresirani `machine.py` iz ranije offline inačice. Bez brisanja projekata otvoren je zaseban pregled stvarnog izgrađenog paketa s adresiranim resursima. U njemu je ESP32 stanica uspješno izvršena; promjena BMP280 30 → 32 °C / 950 → 970 hPa i AM2320 −5 → 10 °C / 70 → 60 % RH dala je odgovarajući novi ispis i OLED. Završni primjer ponovno je otvoren radi provjere širine OLED natpisa.

Ovo ne potvrđuje fizičku opremu, Safari/iOS, školsko računalo ni stvarni učenički pilot. Offline automatske provjere koriste kontrolirane CacheStorage/fetch zamjene; hladno ponovno otvaranje privatne produkcijske domene bez mreže nije novim pokusom potvrđeno. Lokalni compiler na Windowsu/macOS-u, integrirani popup put i prijenos na fizičku pločicu ostaju bez nove završne potvrde. Novo C++ prevođenje na telefonu i cloud compiler nisu isporučeni.

## Deklarirane granice i nastavak

Jedan I2C master, bez arbitraže i clock stretchinga; bez šuma senzora, stvarne promjenjivosti kalibracije i analogne dinamike. BMP280 oversampling mijenja vrijeme, ali ne simulira šum i njegov statistički učinak; IIR se izričito odbija. AM2320 podržava I2C očitanje mjernih registara 0–3, bez jednovodičnog načina i korisničkih registara. Transakcijski MicroPython put ne oponaša svaki pojedinačni brid. CRC i hashovi nisu dokaz autorstva rada.

**Sljedeći razvojni paket: etapa 10C — zasebna geometrija OLED-a 128 × 32 i LCD1602/PCF8574**, uz odabrane biblioteke, profile i provjere.

## Primarni izvori

- Bosch BMP180, podatkovni list i referentna kompenzacija: https://cdn-shop.adafruit.com/datasheets/BST-BMP180-DS000-09.pdf
- Bosch BMP280, registri, kompenzacija i shadowing: https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf
- AOSONG AM2320, proizvodni priručnik: https://cdn-shop.adafruit.com/product-files/3721/AM2320.pdf
- Plan razvoja v2: https://chatgpt.com/library?file_id=libfile_7e0755ae66cc819194f32773c28eb3a3&account_id=personal
- Izvješće 10A: https://chatgpt.com/library?file_id=libfile_3738b0e73fb481919280182b52eabd20&account_id=personal

Dokumentacija proizvođača podupire protokol i referentne izračune. Rad naše aplikacije potvrđuju navedeni razvojni pokusi, u izričito navedenom opsegu.
