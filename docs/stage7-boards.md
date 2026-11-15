# Etapa 7 — profili pločica i projektni format

Isporuka 0.4.0-alpha.1, 12. studenoga 2026. Nastavak postojeće privatne aplikacije iz 0.3.0-beta.1. Ovo nije AVR simulator, compiler ni završena etapa 8/9.

## Profil i format

`src/boards/profiles.ts` čuva postojeći S3 N16R8 te Uno R3 i Nano classic s ATmega328P. Svaki profil definira inačicu, logički napon, geometriju glavnih priključaka, njihov fizički/ispisani identitet, digitalne/analogne/PWM/I2C/SPI/UART mogućnosti, unutarnje aliases veze, ADC referencu i izvor. Uno/Nano imaju planirani 16 MHz AVR cilj i 2 KiB SRAM. To su metadata cilja, ne trenutačna emulacija memorije ili ciklusa.

Uno prikazuje 32 položaja glavnih headera, uključujući NC, IOREF i SDA/SCL aliases; ICSP headeri nisu zasebno nacrtani. Nano ima 30 glavnih priključaka i USB prema početku redova. A6/A7 imaju isključivo ADC. `requirePinUse` odbija digitalnu/PWM uporabu; provjera poznatih izlaznih pobuda na njima daje pogrešku. Konačna analiza poziva učenikova C++ programa ovisi o AVR integraciji, koja još ne postoji.

Format 3 dodaje `language`, `runtimeProfile`, `entryFile`, `nodeId` i `target.fqbn`, uz verzionirani `board`. Jedan čvor je `main`; drugi se ne prihvaća. Uno/Nano prihvaćaju samo `arduino-cpp` i `main.ino`, S3 samo postojeći MicroPython i `main.py`. `boardProfileId` svojstvo pločice u sklopu mora odgovarati projektnom cilju. Fiksni pokus jezgre ostaje samo S3. Nepoznate profile, firmware, jezike, runtime inačice, ciljeve i buduće formate parser odbija.

Formati 1/2 migriraju na kopiji u memoriji. Kôd, pomoćne datoteke, sklop, postavke, ID i revizija ostaju isti. IndexedDB ostaje ista baza; staru povijesnu snimku ne prepisuje samo čitanje. Sljedeće redovno spremanje pohranjuje validirani format 3 uz postojeću kontrolu konkurentne revizije. Izvoz novog formata nije namijenjen staroj aplikaciji formata 2.

## Promjena pločice i jezik

Promjena je zasebna izvedena kopija s novim ID-jem, nazivom i poviješću. Prije nje prikazuju se pločice, jezici, naponi, ADC i početne datoteke te točan popis vodiča koji će se odspojiti. Svi vodiči na staroj pločici odspajaju se u novoj kopiji; nema implicitnog preslikavanja D8 na GPIO8 niti automatskog preslikavanja Uno/Nano. Ostali vodiči i sve datoteke ostaju. Nova početna datoteka dobiva početni primjer samo ako već ne postoji. Python se ne pretvara u C++.

Položaj zamjenske pločice prilagođava se po njezinu desnom rubu kako širi Uno ne bi prekrio ostatak nacrta. Novi breadboard postavlja se desno od širine odabrane pločice. Nije uvedeno automatsko ožičavanje ili spajanje komponente samo zbog preklapanja crteža.

Projekt prima `.py`, `.ino`, `.c`, `.cpp`, `.h`, `.hpp` i postojeće tekstualne formate, uz postojeća ograničenja putanja/veličine i zabranu internih modula. C++ CodeMirror je `@codemirror/lang-cpp@6.0.3`. ZIP/JSON čuvaju sve izvore. Izvoz za Arduino IDE sprema `LabSketch/LabSketch.ino`; C/C++ podmape moraju biti u `src/`, a dodatne `.ino` datoteke u korijenu. Sukob naziva s glavnim sketchom odbija se. Izvoz nije dokaz prevođenja.

## Izvršni ugovor

`prepareRun` stvara jednu validiranu snimku izvora, datoteka i sklopa te provjerava dostupnost odabranog izvršnog profila. `RuntimeHandle` ima zaustavljanje i ulaz; postojeći identitet sesije odbacuje stare događaje. `startMicroPython` povezuje postojeći pravi WASM `Session`. Arduino profil nije implementiran i ne dobiva lažni rezultat: onemogućeni su Pokreni/Reset, a programska granica odbija i izravan poziv. `compileCircuit` dodatno ne šalje AVR sklop postojećem 3,3 V MicroPython modelu.

AVR core, compiler, zaključane biblioteke, artefakt/hash, UART unos i AVR protokoli pripadaju etapi 8/9. Polje FQBN sada opisuje cilj; ne dokazuje instalaciju alatnog lanca. Nijedna uvezena binarna tvrdnja nema put do izvršavanja. ESP32 C++ ostaje planiran kasnije. Native firmware, prijenos na fizičku pločicu i USB protokol nisu implementirani.

## Elektrika i katalog

Mreže se i dalje izvode samo iz veza i unutarnjih spojeva profila. Aliases A4/SDA i A5/SCL ne stvaraju lažno upozorenje o dvama različitim GPIO-ima. Izravni 5 V na S3 GPIO ostaje pogreška; za Uno/Nano to nije samo po sebi prenapon. Kratki spojevi i poznati suprotni izlazi i dalje se otkrivaju. Postojeći AHT10 i OLED ostaju odabrani 3,3 V moduli: njihovo napajanje s 5 V je pogreška, a veza signala prema 5 V logici daje upozorenje o potrebnom odgovarajućem modulu/pretvorniku. Struje, potrošnja i puna analogna fizika nisu izračunate ovom etapom.

Novi radni breadboard 1–60 ima 14 kontakata po stupcu i prekid četiriju lišta 30/31. To nije deklaracija da fizički MB-102 ima tu geometriju. Stari model 1–30 zadržava prekid 15/16 i postojeće primjere. Identitet modela ostaje `modelVersion:1`, s opcijskim validiranim `breadboardColumns` svojstvom; izostanak znači stari 30-stupčani profil.

`src/boards/support.ts` drži pregled planiranog URS kataloga i status po pločici/jeziku, uz navedeni driver ili granicu profila. Planirani uređaji nisu aktivni gumbi dodavanja. Biblioteke koje još nisu odabrane ne proglašavaju se podržanima. Breadboard topologija na Arduinu označena je eksperimentalno uz izričitu nedostupnost programskog izvođenja. Pet starih vježbi ostaje MicroPython sadržaj; izvedena Arduino kopija zadržava njihove tekstove, ali ih ne predstavlja kao aktivnu AVR provjeru.

## Offline i provjere

Postojeći offline/update mehanizam ostaje. Paket uključuje i C++ editor. Sadržajni identitet paketa sada uključuje direktorij `boards`, kako promjena izvornog profila ne bi ostala izvan izračuna. Novi C++ kôd može se uređivati i izvoziti; offline compiler nije obećan. Runtime, C most i modeli periferije nisu ponovno izgrađeni niti mijenjani.

`verification/boards.test.ts` pokriva migraciju i njezinu nemutabilnost, staru sirovu IndexedDB snimku, nevaljane ciljeve, pinove i aliases, naponske domene, izvedene kopije, breadboard 1–60, arhive/IDE izvoz i odbijanje AVR izvršavanja. Postojeće provjere projekta i vježbi ažurirane su samo ondje gdje su izričito očekivale stari broj formata 2; budući format sada je 4.

Pregledničke provjere ove etape provedene su u Chromiumu/Linuxu, u lokalnom razvojnome pregledu. Stari projekt prethodne etape stvarno je migriran, izveden i ponovno provjeren 4/4. Promjena S3→Nano sačuvala je izvore, dobila `main.ino` i odspojila samo tri vodiča na pločici. Opažena je isključivo ADC namjena A6. Novi Uno dobio je C++ editor; izmjena, breadboard 1–60, upozorenje na kratki spoj, poništenje i ponovno otvaranje spremljeni su. Matrica je razlikovala planirani Arduino AHT10 od provjerenog MicroPython modela. Stvarno preuzet Arduino IDE ZIP sadrži izvor iz editora i odgovarajući FQBN. To nije izvedeno Arduino prevođenje niti simulacija.

Safari/iOS, mobilni dodir, školsko računalo, fizičke pločice, novi hladni offline pokus i završni pregled privatne produkcijske domene nisu zasebno ispitani ovom etapom. Stvarni učenički pilot ostaje otvoren. Povijesne dokaze etape 6 ne predstavljamo kao novo pregledničko izvođenje.

## Primarni izvori

- Arduino Uno R3: https://docs.arduino.cc/hardware/uno-rev3/ i https://content.arduino.cc/assets/A000066-full-pinout.pdf
- Arduino Nano classic: https://docs.arduino.cc/hardware/nano/ i https://www.arduino.cc/en/uploads/Main/ArduinoNanoManual23.pdf
- Arduino digitalWrite i ograničenja analognih pinova: https://docs.arduino.cc/language-reference/en/functions/digital-io/digitalwrite/
- Postojeći S3 profil i njegova provenijencija: `boards/esp32-s3-devkitc-1-v1.1-n16r8.json`.

Izvori dokumentiraju pločice i pinove; nisu dokaz da ih aplikacija već izvršava. Sljedeći ovisni paket je stvarni AVR dokaz etape 8.
