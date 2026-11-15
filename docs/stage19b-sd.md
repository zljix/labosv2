# Etapa 19B — microSD, SPI sektori i ograničeni FAT16

**Isporuka 0.9.1-beta.1 · 13. studenoga 2026.** Nastavlja 0.9.0-beta.1 i DS1302. Format ostaje schemaVersion 3 / modelVersion 1; MicroPython WASM, funkcionalni S3 core 1.1.0 i zaključane vanjske biblioteke nisu promijenjeni. Dodana su četiri primjera za MicroPython na S3, S3 C++ te Uno/Nano Arduino. Katalog ima 23 S3 i po 72 AVR prevedena programa.

## Slojevi i komunikacija

`public/sd-card.mjs` predstavlja ograničenu karticu SDSC v2 s 16 384 sektora po 512 bajtova (8 MiB). To nije SDHC: argument za sektor n jest n × 512, a OCR ima CCS=0. CSD v1 opisuje istu veličinu. Model prima bajtove kroz postojeći SPI put iz MicroPython SPI/SoftSPI, stvarnog AVR SPI registra ili S3 C++ funkcionalnog SPI-ja. Nema tumačenja izvornog programa, presretanja ispisa ili host funkcije koja programu vraća gotovu datoteku.

Podržani su početni taktovi uz CS HIGH, CMD0 i obvezni CRC7 za CMD0/CMD8, CMD8/R7, CMD55/ACMD41, CMD58/OCR, CMD9/CSD, sintetski CMD10/CID, CMD13 s osnovnim R2 odgovorom, CMD16=512, CMD17 i CMD24 te CMD59. Čitanje šalje token FE, podatke i CRC16. Zapis prima FE, točno 512 B i CRC; vraća data response i modelno busy od 1 ms. Potpuni prihvaćeni blok Lab model pohranjuje prije prikaza busy; fizički kvar tijekom internog programiranja nije modeliran. CRC16 zapisa i ostalih naredbi provjerava se nakon CMD59=1; CRC očitanja se uvijek generira i provjerava u priloženim driverima. Nevaljane adrese i nepodržane multi-block/erase naredbe vraćaju pogrešku, bez tihog prihvaćanja. CMD13 ne implementira cijelu statusnu mašinu; CID je sintetski, a CSD ovdje služi ugovoru kapaciteta.

SPI je mode 0, MSB prvi, inicijalizacija do 400 kHz i rad do 10 MHz. Bajtovni profil ne simulira analogne bridove, setup/hold, stvarnu propusnost, potrošnju ili trošenje flasha. Prva ACMD41 provjera ostaje idle, druga dovršava modelnu inicijalizaciju; to nije fizičko mjerenje trajanja inicijalizacije.

Električni put zahtijeva stvarne mreže napajanja, zajedničkog GND-a, SCK, MOSI, MISO i CS-a. Nedostajući MISO ne vraća valjane odgovore. Istodobni aktivni CS na istoj sabirnici daje dijagnostiku. Profili 3,3 V i 5 V predstavljaju izričite složene carriere s odgovarajućom prilagodbom; sama microSD kartica nije 5 V uređaj. Zaštita od pisanja jest svojstvo Lab medija, ne klizač na fizičkoj microSD kartici.

| Cilj | VCC i logika carriere | SCK | MOSI | MISO | CS |
| --- | --- | --- | --- | --- | --- |
| ESP32-S3 MicroPython / C++ | 3,3 V | GPIO12 | GPIO11 | GPIO13 | GPIO10 |
| Uno / Nano C++ | izričiti 5 V carrier | D13 | D11 | D12 | D10 |

## FAT16 i vidljivi driveri

Slika je superfloppy bez particijske tablice: boot sektor 0, dvije FAT kopije po 64 sektora (1–64, 65–128), 64 korijenska unosa u sektorima 129–132, podaci od 133. Klaster ima jedan sektor; 16 251 podatkovni klaster odgovara FAT16 rasponu. U slici su stvarni BPB, FAT lanci, kratka imena, duljina i sadržaj datoteke.

Kartica čuva razlike prema početnoj slici, najviše **256 izmijenjenih sektora**. Daljnji novi sektor daje odbijen zapis; prepisivanje već zabilježenog sektora ostaje moguće. To je javna granica nastavnog modela, odvojena od deklariranih 8 MiB adresnog prostora. Granica ne znači da svih 128 KiB pripada sadržaju: izmijenjeni FAT i korijenski sektori također je troše.

Tri nova vlastita MIT izvora verzije 1.0.0 ostaju vidljiva u projektu:

- `lab_sdcard.py`: inicijalizacija, CSD, pojedinačni sektori, CRC i block-device readblocks/writeblocks/ioctl.
- `lab_fat16.py`: ograničeni Python VFS za **stvarne os.mount(), open(), os.listdir(), os.stat() i os.umount() pozive**. Postojeći WASM nema nativni VfsFat; nije dodana lažna os.VfsFat zamjena niti je Emscriptenova datoteka proglašena SD karticom.
- `lab_sd.h`: C++ LabSD s jednim 512 B međuspremnikom, provjerom FAT kopija i lanaca, mount/append/printFile/fileSize i sirovim sektorima. To nije proizvoljna SD.h, SdFat ili ESP32 SD_MMC podrška.

Datotečni opseg obuhvaća korijen, kratka imena 8.3, do 64 unosa i do 64 KiB po datoteci. Python podržava r/w/a, binarni/tekstualni način, with/close/flush, read/readline, iteraciju, seek unutar datoteke i UTF-8. Pri pisanju drži ograničeni sadržaj otvorene datoteke u programskom RAM-u; sektori se zapisuju na flush/close. C++ dopisuje kroz sektorski međuspremnik. Nema mapa, dugih imena, uklanjanja/preimenovanja, općeg statvfs-a, FAT32, exFAT-a ili automatskog formatiranja. FAT datum je izričiti početni datum profila; RTC vrijeme logger zapisuje u sadržaj CSV-a.

## Nastavni slijed i spremanje

| Primjer | Dokaz u programu |
| --- | --- |
| Inicijalizacija i boot sektor | CSD kapacitet, CMD17, potpis 55 AA i montiranje postojeće slike |
| Sirovi blok | CMD24 i neovisno CMD17 očitanje svih 512 bajtova zadnjeg sektora; nije datoteka i namijenjeno je praznoj pokusnoj kartici |
| FAT16 datoteka | Stvaranje/dopisivanje LAB.TXT, ponovno čitanje i rast duljine pri Resetu MCU-a |
| DS1302 → microSD | RTC CE/I/O/SCLK ostaje odvojen; LOG.CSV s brojem uzorka i vremenom, zatvaranje zapisa između uzoraka |

Pojmovi sektor, klaster, FAT, korijenski unos i CSV uvedeni su u uputama prije njihove primjene. Povijesne URS vježbe nisu prenumerirane. Interval uključuje sleep/delay(1000) i obradu SPI-ja; nije obećanje točne frekvencije uzorkovanja.

Stop zamrzava zadnji primljeni okvir. Run/Reset istog aktivnog projekta čuva medij zasebno od MCU RAM-a. Promjena projekta, topologije ili početnih SD svojstava otvara novu domenu iz spremljenog ili praznog stanja. **Sačuvaj karticu u projekt** nakon Stop izričito zapisuje snimku u svojstva; zatim vrijede standardno spremanje i JSON/ZIP izvoz/uvoz. Za nastavak RTC kalendara nakon ponovnog otvaranja zasebno sačuvaj i RTC snimku.

Iz UI-ja se nakon Stop preuzimaju datoteke, cijela 8 MiB .img slika i CSV komunikacijskih događaja. Uvoz .img prihvaća točno istu Lab geometriju i granicu snimke. Prazna kartica vraća se zasebnom radnjom u svojstvima. Vađenje/povratak traži novu inicijalizaciju; nepotpun blok se odbacuje, već potvrđeni ostaju. FAT operacije nisu transakcija i prekid usred njih može ostaviti nesklad kopija ili lanca. Otvoreni programski međuspremnik nije sadržaj kartice dok nije zapisan. Snimka je zadnji primljeni okvir, bez jamstva posljednje još nepotvrđene instrukcije.

## Provjere i dokazi

Ciljani `verification/sd.test.ts` ima **60/60 prolaznih slučajeva**, bez preskakanja: protokol i CRC, granice i prekidi zapisa, budžet snimke, pogrešni spojevi, JSON/ZIP, stvarni MicroPython VFS, UTF-8, klasteri, zaštita, osam AVR i četiri S3 C++ programa te prijenos iste slike Python → C++ → Python.

Ukupno **656 jedinstvenih Node slučajeva ima zabilježen prolazan završni rezultat**. Širi pokus završio je s 649 prolaznih, jednim zastarjelim očekivanjem da je SD još planiran i šest preskočenih provjera koje traže izričitu konfiguraciju S3 prevoditelja. Nakon usklađivanja matrice prolazi svih 9 njezinih provjera; svih 6 prevoditeljskih slučajeva prolazi zasebno uz izričite alate. Ne proglašava se jedno neprekinuto izvođenje 656/656 i ponovljeni slučajevi se ne zbrajaju kao novi. Dva ranija skupna pokušaja prekinuta su nakon dovršenih Arduino slučajeva zbog otvorenih izvršnih resursa; završni širi pokus koristi `--test-isolation=none --test-force-exit`. Izvorni zapisi ostaju odvojeni.

Prolazi i 11 ranijih pokusa pakiranih Workera (6 RTC i 5 zaključanih S3 biblioteka), odvojeno od šest novih SD pokusa. Regresijski dokazi starih cjelina kopirani su u ovu isporuku, a njihovi povijesni zapisi nisu prepisani.

Šest pokusa koristi baš pakirane Workere i release-relative uvoze: MicroPython datoteka/logger, S3 C++ datoteka/logger i AVR logger na Unu/Nanu. Svi prolaze; prisilni prekid ostao je ispod 500 ms. Četiri točna Arduino IDE izvoza dodatno prolaze stvarni Arduino CLI 1.3.1 / esp32:esp32@3.3.12. To je potvrda prevođenja, ne izvođenja na pločici.

Neizmijenjeno je svih 136 ranijih AVR i 19 ranijih S3 artefakata te 154 provjerene datoteke corea, runtimea i zaključanih biblioteka. Lokalni ZIP ima 4 358 535 B, SHA-256 `40f1aebca02a42728aa5ccc9b45a72901de9572beb4863bfbceae95102530258`, izgradnju `280c8e9babc8bf94`. Raspakiravanje i stvarni lokalni HTTP potvrdili su svih 160 resursa / 12 456 532 B, sažetke i oba WASM MIME tipa. To nije novi hladni offline preglednički pokus.

U razvojnom Chromeu opaženi su rast LAB.TXT 28→56 B nakon Reseta te 84 B nakon izričite snimke, ponovnog učitavanja i Run. S3 C++ logger zapisuje kalendar, zaštita vraća write rejected, a uklanjanje zaštite i Reset nastavljaju na istoj kartici i zadržanom RTC vremenu. Završni CSV imao je 1283 B. Privatna produkcijska domena, iOS/Safari i Android nisu time provjereni.

Početni pokusi otkrili su nepodržani str.ljust u ovom MicroPython buildu i pogrešnu pretpostavku da funkcionalni S3 core definira ARDUINO_ARCH_ESP32. Oba su popravljena u vidljivim izvorima/primjerima. Početna provjera ZIP-a pozvala je importer bez obveznog imena datoteke; poziv testa je ispravljen. Node provjera pakiranog AVR-a zahtijevala je prethodno definirani globalni onmessage, što preglednik već ima. Zapisi početnih i završnih pokusa odvojeni su; ponavljanja se ne broje kao novi slučajevi.

## Granice i nastavak

Fizička kartica/carrier, školsko računalo, Windows/macOS alati, učenici i ciljni mobilni preglednici ostaju otvorene provjere. Stabilna v1.0 nije proglašena. Sljedeća razvojna cjelina je etapa 20, MAX30102: I2C registri/FIFO i sintetski optički uzorci s jasno odvojenim ograničenjima simulacije.

## Podloge

- [SD Association Physical Layer Simplified Specification 7.10](https://www.sdcard.org/cms/wp-content/themes/sdcard-org/dl.php?f=Part1_Physical_Layer_Simplified_Specification_Ver7.10.pdf): SPI, SDSC adresiranje, naredbe i kontrolni zbrojevi.
- [Microsoft FAT Specification 1.03, autorski dokument u preslici PCjs](https://www.pcjs.org/documents/papers/microsoft/MS_FAT_OVERVIEW_103-2000-12-06.pdf): BPB, korijenski unosi, FAT16 i klasifikacija po broju klastera.
- [MicroPython VFS dokumentacija](https://docs.micropython.org/en/latest/library/vfs.html): ugovor montiranja i blokovnih uređaja; stvarna dostupnost provjerena je u našem zaključanom buildu, ne pretpostavljena iz latest dokumentacije.

Podloge određuju protokole i formate, dok opseg i granice Lab modela određuje ovaj projekt. Funkcionalnost aplikacije dokazuju izvršni pokusi u `stage19b-evidence/`.
