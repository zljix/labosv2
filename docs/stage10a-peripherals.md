# Etapa 10A — AHT10, SSD1306 i servo na Arduinu

Isporuka **0.4.1-beta.1**, 12. studenoga 2026. Nastavlja postojeći privatni Site i format projekta 3. Ovo nije proglašenje stabilne v1.0.

## Izvršavanje i protokoli

- AVR hardverski TWI događaji povezuju se sa zajedničkim modelima AHT10 i SSD1306. Adresa, svaki bajt, ACK/NACK i STOP proizlaze iz registara stvarnog prevedenog programa. Završetak TWI operacije čeka virtualno vrijeme za pripadni broj bitova i postavljeni takt; podržano je do 400 kHz. Repeated-start razdvaja završenu prethodnu poruku, ali registarski modeli novih senzora i opći memorijski I2C API ostaju zadatak 10B.
- Software I2C promatra stvarne GPIO bridove na mrežama iz sklopa: START/STOP, osam bitova, deveti ACK i master ACK/NACK pri čitanju. Slave odgovara povlačenjem SDA na masu kroz isti električni model. Nema analiziranja teksta programa ni izravnog prepisivanja klizača u OLED ili servo.
- AHT10 koristi virtualno AVR vrijeme za početno čekanje, kalibraciju, zauzetost i 80 ms pretvorbe. C++ driver čita status i šest stvarnih bajtova te dekodira 20-bitnu temperaturu i vlagu. Promjena okoliša tijekom pretvorbe vrijedi za sljedeći uzorak.
- SSD1306 obrađuje kontrolne bajtove, naredbe i podatke, uključujući U8g2 stranicu od 128 B. Sadržaj slike nastaje iz prijenosa programa. Potvrđeni su programski i hardverski I2C put.
- Servo biblioteka koristi stvarni AVR Timer1 i GPIO impulse. Model mjeri širinu i period bridova, uz približno 50 Hz i raspon 500–2500 µs. Nestanak niza impulsa poništava položaj; ne pretvara se proizvoljan digitalni izlaz u valjan servo položaj. Impulsi se ne pretvaraju u sintetički PWM koji bi zaobišao program.

Jedan master, bez arbitraže i clock stretchinga. To nije analogni SPICE ni potpuna električna/taktna emulacija I2C linija. Software put početno pronalazi parove GPIO-a po izravno prevedenim mrežama uređaja; preklapanje slike komponenti nema električki učinak. SPI ostaje bez spojenog uređaja (0xFF).

## Naponski profili i kompatibilnost

Postojeći modul 3,3 V ostaje zadani profil. Ne mijenja se značenje ranijih MicroPython projekata. Novo opcionalno svojstvo `moduleVoltage: 5` izričito opisuje modul s regulatorom **i prilagodbom I2C razina** na vanjskim pinovima od 5 V. To nije dokaz da svaki fizički modul s regulatorom ima takvu prilagodbu niti da je goli AHT10 kompatibilan s 5 V.

Odabir je vidljiv u Svojstvima, opisu komponente i novim primjerima te preživljava JSON/ZIP. Neusklađeni profil i napajanje ne dobivaju valjano očitanje. AHT10 zadržava konzervativno pravilo zasebne sabirnice. VCC ne može biti prividno napajan samo strujom kroz ulazne pull-up otpornike. Ranija programska kontrola napajanja eksplicitnim GPIO izlazom ostaje sačuvana u idealiziranom modelu malog opterećenja.

| Komponenta u regulatoru | Spojevi na Uno/Nano |
| --- | --- |
| AHT10, profil modula s prilagodbom na 5 V | VCC 5 V, GND, SDA A4, SCL A5; 0x38 |
| SSD1306 128 × 64, isti naponski profil | VCC 5 V, GND, SDA D6, SCL D7; 0x3C |
| Idealizirani hobi servo | V+ 5 V, GND, SIG D9; `attach(9, 500, 2500)` |

Novi Arduino primjeri uvode AHT10, zatim OLED, servo i objedinjeni regulator. Postojeća tri osnovna primjera ostaju prva; ukupno je sedam primjera po pločici i 14 točno vezanih AVR rezultata. Sva četiri nova primjera mogu se pokrenuti bez lokalnog prevoditelja; promjena izvora traži novo stvarno prevođenje.

## Zaključane biblioteke i paket prevoditelja

| Biblioteka | Inačica i opseg | Licencija |
| --- | --- | --- |
| Bounce2 | 2.72; raniji GPIO/millis profil | MIT |
| LabAHT10 | 1.0.0; otvoreni projektni C++ driver za stvarni Wire protokol, točne 20-bitne pretvorbe, polling i timeout | MIT |
| U8g2 | 2.37.1; neizmijenjeni podskup službene grafičke jezgre, Arduino prijenosa i SSD1306 128×64 drivera; jedan font 6×10 | BSD-2-Clause; font public domain |
| Servo | 1.2.2; neizmijenjeni AVR izvor i zajednički header | LGPL-2.1-or-later |

Podrijetlo i Git blob identiteti nalaze se u `vendor/arduino/stage10-provenance.json`. Font ima samo dodan `#include "u8g2.h"` radi zasebnog prevođenja; podaci i izvorno zaglavlje ostaju. Puni paket svih U8g2 zaslona/fontova nije isporučen. Nepodržani konstruktori/fontovi ne smiju se predstavljati kao provjereni zbog same prisutnosti U8g2 imena.

Prevoditelj provjerava digest zaključanog popisa, hash svake datoteke i **točan popis datoteka**. Dodatna `.cpp` datoteka i simboličke poveznice odbijaju se. Pripremljeni ZIP uključuje sve odabrane izvore i licencije, bez binarnih Arduino CLI/core/GCC alata i bez npm instalacije. Za nove biblioteke treba novi paket etape 10A; stari paket ne prevodi novi regulator. Prazan manifest biblioteka zadržava hash osnovnih primjera.

## SRAM i Timer1

| Novi primjer | Flash | Statički SRAM |
| --- | ---: | ---: |
| AHT10 / Wire | 6476 B | 416 B |
| OLED / U8g2 software I2C | 10544 B | 579 B |
| Servo | 3114 B | 229 B |
| Regulator | 16232 B | 911 B |

Rezultati su jednaki za zaključane Uno i Nano ciljeve. `_1_` sprema jednu stranicu od 128 B; puna slika zahtijeva 1024 B samo za framebuffer. Izvor se stvarno prevodi Arduino CLI-jem 1.3.1, AVR coreom 1.8.6 i pripadnim AVR GCC-jem.

Simulator za svaku instrukciju prati najniži SP i prekida spuštanje stoga u statičke podatke. U referentnom regulatoru opažen je najmanji razmak **972 B** do statičkih podataka. To nije procjena slobodnog SRAM-a za proizvoljan program: dinamički heap, malloc i sudar stack/heap nisu zasebno praćeni. Statička veličina i SP zapis nisu dokaz autorstva ili nekrivotvorivosti uvezenog artefakta.

Servo zauzima Timer1. Poseban stvarno preveden program istodobno koristi Servo na D6 i analogWrite na D9: servo zadržava impulse, a LED ne dobiva očekivani PWM. Simulator ne prikazuje dva idealizirana neovisna izlaza. Ograničenje D9/D10 objašnjeno je u primjeru i pomoći.

## Provjere

| Skup | Prolazi |
| --- | ---: |
| Projekti, arhive, pohrana i topologija | 26/26 |
| Pločice i migracija | 9/9 |
| Osnovni MicroPython simulator | 12/12 |
| Postojeći MicroPython uređaji i stvarni driveri | 16/16 |
| MicroPython jezgra | 10/10 |
| Projektne datoteke i zaštita internih modula | 3/3 |
| Pet vježbi i predaja | 20/20 |
| Offline paket | 8/8 |
| Raniji AVR ugovor, jezgra i Worker | 15/15 |
| Arduino radno okruženje i stvarni compiler | 12/12 |
| Nova AVR periferija i zaključavanje izvora | 11/11 |
| Novi produkcijski Nano Worker | 1/1 |
| **Ukupno jedinstvenih provjera** | **143/143** |

TypeScript i produkcijska izgradnja prolaze. Stvarne compiler provjere nisu preskočene. Dodatno su stvarno prevedene tri reference: U8g2 hardverski OLED, GPIO software-I2C čitanje AHT10 s devetim ACK i točnim nizom `8,128,0,5,235,133`, te Servo/Timer1 sukob. Namjerne pogreške uključuju odspojeni VCC/GND/SDA/SCL, pull-up, pogrešnu adresu, zamijenjene linije, neusklađene naponske profile, dijeljenje AHT10 sabirnice i nestanak servo signala.

Oba integrirana programa prolaze slijed 24 → 30 → 27 → 25 °C uz promjenu vlage, stvarne piksele i položaje 0 → 90 → 90 → 0°. Produkcijski Nano Worker prihvaća živi ulaz; opaženi poziv prekida Node Workera oko 3,3 ms ne predstavlja mjerenje školskog računala. Vremenske brojke i JSON dokazi nalaze se u `stage10a-evidence/`.

## Preglednik i preostale granice

Chromium/Linux razvojni pregled otvoren je mrežnim query URL-om jer je običnu razvojnu adresu prvotno preuzela starija spremljena offline inačica. Projekti nisu obrisani. U sučelju je na Unu pokrenut primjer s valjanim artefaktom: promjene 30 → 27 → 25 °C dale su 90 → 90 → 0°, uz odgovarajući OLED tekst. Stop zaustavlja program i čuva posljednji prikaz; početni klizači nakon Stop ponovno prikazuju spremljene početne vrijednosti. To je razlika između početnih ulaza i posljednjih rezultata, ne novo očitanje nakon Stop.

Na Nanu je u sučelju otvoren novi Nano projekt pa odabran regulator. Prikazan je točan FQBN `arduino:avr:nano:cpu=atmega328`; program je pri 30 °C prikazao OLED 30,0 °C / Servo 90 i izmjeren položaj približno 90°. U dijalogu Prevedi potvrđeni su valjan artefakt, 911/2048 B statičkog SRAM-a i odabrani LabAHT10/U8g2/Servo. Oba preglednička programa zaustavljena su prije završetka provjere.

Objavljena privatna domena i dalje zahtijeva prijavu. Novi C++ izvor i dalje se prevodi lokalno na računalu. Integrirani popup → lokalni prevoditelj → aplikacija put, Windows/macOS paket, fizički hardver, Safari/iOS, školsko računalo i učenički pilot ostaju bez nove završne potvrde. Offline testovi koriste kontrolirane CacheStorage/fetch zamjene; nisu novi hladni offline test privatne produkcijske domene. Mobilni raspored u ovom paketu nije zasebno ispitan.

Sljedeći paket je **etapa 10B: BMP180, BMP280 i AM2320**, s njihovim stvarnim registrima, kalibracijskim koeficijentima, repeated-start slijedom i odabranim driverima. OLED 128×32 i LCD1602 ostaju 10C.

## Primarni izvori

- U8g2 službeni izvor: https://github.com/olikraus/U8g2_Arduino/tree/b3a40de8822187c941b40cbbaaa77604a7ab90c7
- U8g2 konstruktori i režimi spremnika: https://github.com/olikraus/u8g2/wiki/u8g2setupcpp
- Servo 1.2.2 službeni izvor: https://github.com/arduino-libraries/Servo/tree/1.2.2
- ASAIR AHT10 protokol, potvrđen i u otvorenom driveru ESPHome: https://github.com/esphome/esphome/blob/dev/esphome/components/aht10/aht10.cpp
- Arduino CLI 1.3 compile: https://arduino.github.io/arduino-cli/1.3/commands/arduino-cli_compile/

Izvori opisuju izvorne biblioteke i protokol. Rad naše aplikacije potvrđuju ovdje navedeni razvojni dokazi u deklariranom opsegu.
