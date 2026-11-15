# Etapa 8 — stvarni Arduino AVR program

Isporuka `0.4.0-alpha.2`, 12. studenoga 2026. Nastavlja postojeći Site i format projekta 3. MicroPython ostaje zaseban backend; Arduino izvor ne interpretira se ni prepisuje u JavaScript.

## Alatni lanac i razvojni most

Zaključano: Arduino CLI 1.3.1, `arduino:avr@1.8.6`, AVR GCC `7.3.0-atmel3.6.1-arduino7`, AVR8js 0.21.0. Uno: `arduino:avr:uno`; Nano classic: `arduino:avr:nano:cpu=atmega328`. Oba profila su ATmega328P, 16 MHz, 5 V, 2 KiB SRAM. Klasični Nano ne znači Nano Every ili Nano ESP32.

Statički Site nema izvršiv Arduino CLI. Isporuka koristi **lokalni razvojni most**, ne dovršen cloud compiler. `scripts/avr-setup.mjs` priprema zasebnu konfiguraciju, a `scripts/avr-compile.mjs` prima izvezeni JSON projekt i zapisuje `rezultat.avr.json`. ZIP mosta preuzima se u dijalogu Prevedi. Nema HTTP slušanja, proizvoljnih naredbi, per-job instalacije biblioteka ni skripti učenikova projekta. Procesi se pozivaju bez shell interpolacije; prevođenje ima vremensko i izlazno ograničenje. Ovo nije sigurnosno izoliran javni servis i ne smije se kao takav objaviti.

Provjeravaju se instalirani CLI/core/GCC i odsutnost dodatnih biblioteka. U ovom profilu Wire i SPI dolaze s coreom. Dopuštene su izvorne `.ino`, `.c`, `.cpp`, `.h`, `.hpp` datoteke u korijenu ili podržanom `src/` stablu; `.ino` samo u korijenu. Glavni `main.ino` postaje `LabSketch.ino` u privremenoj mapi. Posao se uklanja i nakon neuspjeha. Pogreške prevoditelja zadržavaju izvor i redak. Flash se ograničava po ciljnom bootloader profilu, statički SRAM na 2048 B; dinamički stack/heap nije zasebno zaštićen.

## Rezultat i svježa snimka

`public/avr-contract.mjs` zajednički je ugovor prevoditelja i aplikacije. SHA-256 obuhvaća sortirane C/C++ izvore, početnu datoteku, pločicu, inačicu profila, FQBN i zaključane alate/biblioteke. Skup veza nije kompilacijski ulaz: koristi se svježe validiran sklop pri svakom pokretanju. Promjena koda ili cilja odbija raniji rezultat; bilješke i tema ne traže prevođenje.

Rezultat sadrži Intel HEX, SHA-256 HEX-a, ulazni hash, cilj, alate, Flash i statički SRAM. Strogi HEX parser provjerava kontrolne zbrojeve, raspon, preklapanja, početak i EOF. Nepodržani zapisi se odbijaju. Generirani ELF koristi se lokalno za veličinu SRAM-a; proizvoljni ELF/HEX bez omotnice ne uvozi se.

`avr-build.json` čuva se uz projekt, povijest, ZIP i JSON. Prije svake sesije ponovno se provjerava vezanje. Uvoz također provjerava da se izvor nije promijenio tijekom asinkrone provjere. Hash nije digitalni potpis: namjerno krivotvoreni metapodaci nisu dokaz prevođenja ili autorstva. Nepoznat uvezeni rezultat sam po sebi nije ocjena ni potvrda izvornog programa.

## Izvršavanje i električni model

`AVREngine` izvodi AVR instrukcije i periferijske registre, uz stvarne Timer0/1/2, ADC, UART, TWI i SPI modele AVR8js-a. SRAM CPU-a ograničen je na 2048 B plus prostor registara/I/O-a. GPIO portovi i analogni kanali povezuju se s postojećim mrežama sklopa; D8 je PB0, ne ESP32 GPIO8. A6/A7 postoje samo kao Nano ADC kanali.

Zajednički DC solver parametriziran je za 5 V, uz postojeću zadanu 3,3 V izvedbu. Kontakti tipkala, napajanje, serijski otpornici i potenciometar određuju stvarno pročitane ulaze i LED struju. Izlazni sukob prekida rad. Za AVR LED se integrira struja između stvarnih bridova u virtualnim ciklusima; PWM nije dobiven čitanjem učenikove funkcije `analogWrite`. Ugrađena LED L prikazuje stanje D13. Primjeri koriste 680 Ω kako bi 5 V LED struja ostala u čitljivom rasponu postojeće skale svjetline prema 5 mA.

Worker radi u paketima od 64 000 ciklusa i prepušta izvođenje između njih; prikaz se objavljuje približno svakih 33 ms zidnog vremena. Virtualno vrijeme slijedi cikluse, bez jamstva stvarne brzine. ADC je 10-bitni, s 5 V AVCC i modelom unutarnje reference. Nepobuđeni ADC deterministički daje 0 V; šum, promjenjiva vanjska AREF i analogna fizika nisu dodani.

UART TX dekodira UTF-8 i čuva nedovršene višebajtne znakove između okvira. RX ulaz je red bajtova kroz stvarnu periferiju i njezinu brzinu, uz 256 bajtova na čekanju. Predug ulaz daje pogrešku. Serial Monitor nudi bez završetka, LF i CR+LF.

TWI/SPI su **prototip transporta**, bez modela spojenih uređaja: TWI adresa daje NACK, SPI završava nakon zadanih ciklusa i vraća 0xFF. Registarski događaji vidljivi su u zapisu mjerenja. Nije proglašena podrška Arduino AHT10/OLED/Servo bibliotekama. Takve komponente u AVR sklopu blokiraju pokretanje uz objašnjenje.

Stop odmah označava sesiju završenom i terminira Worker; zakašnjele poruke se odbacuju. Reset stvara novi CPU, RAM, registre, timer, UART redove i model početnog sklopa. Identitet pokretanja štiti i fazu asinkrone provjere rezultata. Izmjene koda tijekom rada primjenjuju se pri novom pokretanju; promjena sklopa zaustavlja rad.

## Dokazi

- Šest primjeraka za Uno/Nano stvarno su prevedeni službenim alatnim lancem: treptanje/millis, tipkalo/UART, ADC/PWM. Izvori su u `arduinoExamples.ts`, rezultati u `public/avr-examples.json`.
- Razvojne strojne provjere: vezanje i ZIP, nevaljan HEX, živi ulazi, Nano A6, UART RX, UTF-8 TX, svi PWM pinovi i sva tri timera, vanjski prekid FALLING, Wire NACK, SPI idle byte, izlazni sukob, prekid busy Workera i čisti Reset.
- Dodatno su prevedene dvije nove inačice s pomoćnim headerom za različite ciljeve i provjerena dijagnostika nevaljanog izvora. Dokazi su u `stage8-evidence/compiler-checks.json`.
- `stage8-evidence/` sadrži razvojne zapise, odvojene od stvarnog školskog pilota. Browser opažanja imaju zaseban zapis i nisu zaključena iz Node provjera.
- Produkcijski paket i njegov izgrađeni AVR Worker provjeravaju se zasebno; offline CacheStorage/fetch provjere ne zamjenjuju hladni offline pokus privatne produkcijske domene.

## Preostalo

Etapa 9 dovršava učenički put prevođenja i knjižnica, kvalitetniju dijagnostiku/cache te cjeloviti rad od praznog Arduino projekta do predaje. Izbor načina hostanja kompajlera ostaje konkretna tehnička stavka; nije sakriven iza gumba Prevedi. Kasnije etape dodaju modele senzora, zaslona i pogona prema planu v2.

Nisu provedeni stvarni učenički pilot, provjera školskog računala, Safari/iOS, fizički Uno/Nano ni Arduino upload. Izvoz sketcha i simulacija nisu hardverski pokus.

## Primarni izvori

- AVR8js: https://github.com/wokwi/avr8js (MIT; korištena zaključana npm inačica 0.21.0).
- Arduino CLI compile: https://docs.arduino.cc/arduino-cli/commands-reference/arduino-cli_compile/
- Arduino AVR core: https://github.com/arduino/ArduinoCore-avr/tree/1.8.6
- Uno/Nano pinout izvori ostaju u `src/boards/profiles.ts`.
