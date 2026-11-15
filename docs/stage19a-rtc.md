# Etapa 19A — DS1302 i odvojeno stanje RTC-a

**Isporuka 0.9.0-beta.1 · 13. studenoga 2026.** Nastavlja objavljenu 0.8.1-beta.1. Projektni format ostaje schemaVersion 3 / modelVersion 1, S3 funkcionalni core 1.1.0. Ugrađeni su DS1302, dva vidljiva vlastita MIT drivera 1.0.0 i četiri primjera za svaki od četiriju ciljnih parova: S3/MicroPython, Uno/Arduino, Nano/Arduino i S3/Arduino. Ukupno je 19 S3 i po 68 AVR pripremljenih programa.

## Komunikacijski model

DS1302 ima CE, I/O i SCLK, ne I2C adresu. `public/rtc-ds1302.mjs` promatra stvarne GPIO mreže i bridove. Naredbe i podatke prima LSB prvi na rastućem bridu; odgovor pogoni padajućim. Prvi izlazni bit slijedi posljednji rastući brid naredbe, pa driver mora otpustiti I/O prije njegova padajućeg brida. I/O je push-pull tijekom izlaza i visoke impedancije nakon CE=0 / na rastućem bridu čitanja. Aktivni su unutarnji 40 kΩ pull-downovi. Nema ACK-a.

Podržano je:

- Pojedinačno čitanje/pisanje registara 0x80–0x91, clock burst 0xBE/BF i RAM burst 0xFE/FF.
- BCD sekunde, minute, sati, datum, mjesec, korisnički numeriran dan 1–7 i godina 00–99. Nastavni kalendar obuhvaća 2000–2099; nakon 2099 vraća se u 2000 bez zasebnog stoljeća.
- 12 h/AM/PM i 24 h prikaz; polnoć, duljine mjeseci i prijestupne godine.
- CH zaustavlja brojanje. Zapis sekundi poništava dio sekunde. WP blokira sat, RAM i trickle registar; kontrolni registar može ga ukinuti. Zaštićeni clock burst ne može sam sebe otključati.
- Čitanje sata koristi snimku uzetu pri CE=1 pa prijelaz sekunde/polnoći ne miješa registre. Zapis sata primjenjuje se pri CE=0; nepotpuni clock burst odbacuje se. RAM burst primjenjuje primljene pune bajtove.
- Trideset i jedan odvojeni RAM bajt. Trickle registar je izvan clock bursta, početno 0x5C. Prepoznaje se uključena konfiguracija, ali punjenje nije simulirano; prikazuje se upozorenje za nepunjivu CR2032.

Naredbe s bitom 7=0 i prazna registarska područja ne mijenjaju stanje. Nevaljan BCD/datum zaustavlja modelno brojanje i označava nevaljan kalendar; ne normalizira se u izmišljeni valjan datum. To je deterministička nastavna obrada ulaza kojem podatkovni list inače ne definira ponašanje.

Profil konzervativno odbija uzastopne bridove SCLK razmaknute manje od 1 µs. Ne deklarira potpun AC timing checker: setup/hold, CE setup/hold, konačna izlazna kašnjenja, kapaciteti i analogni bridovi nisu modelirani. Priloženi driveri koriste pauze 10 µs i nisu dokaz maksimalne fizičke brzine.

## Električni profil i baterija

S3 primjeri: CE=GPIO6, I/O=GPIO7, SCLK=GPIO8, VCC=3V3 i GND zajednički. Uno/Nano: CE=D4, I/O=D5, SCLK=D6, VCC=5V i GND zajednički. To je izričit Lab modul s idealnom 3 V pričuvnom baterijom u svojstvima, ne univerzalni redoslijed izvoda fizičkog modula.

Baterija zadržava vrijeme i RAM, ali ne napaja pločicu i ne vraća napon na VCC mrežu. Prekidač **Glavno napajanje RTC-a** prekida primarni izvor samo u modulu. Serijska komunikacija tada nije dostupna, dok baterijsko brojanje traje. Bez oba izvora model označava gubitak, CH=1, nevaljan kalendar i RAM=0. Stvarni čip nakon takvog gubitka nema ovdje obećani deterministički sadržaj; brisanje je nastavna oznaka, ne model stvarnih slučajnih bitova.

Odspojeni VCC/GND, spojeni ili odspojeni signali i Nano A6/A7 ne stvaraju valjana očitanja. Provjera odbija 5 V RTC I/O na S3. Dinamički sukob GPIO izlaza s RTC push-pull izlazom daje dijagnostiku. Napajanje i mase proizlaze iz stvarnog netlista; nije dovoljno da postoji dio u katalogu.

## Pravila vremena, Run, Stop, Reset i spremanje

| Radnja | Ponašanje |
| --- | --- |
| Novi RTC | Izričit početni kalendar 2026-01-01 12:00:00, RAM=0; nema automatskog čitanja datuma računala |
| Postavi prema vremenu računala | Jednokratno preuzima lokalne kalendarske sastavnice na izričit klik; nema NTP-a, vremenske zone ili automatskog DST-a |
| Tijekom izvođenja | Sat slijedi virtualno vrijeme izvršnog sustava; AVR cikluse, S3 C++ funkcionalni µs sat ili postojeći MicroPython sat |
| Stop | Zamrzava zadnju primljenu simulacijsku snimku u otvorenoj aktivnoj sesiji; ne sprema je automatski u projekt |
| Run / Reset MCU-a | Novo MCU okruženje dobiva zadržanu snimku istog aktivnog projekta, RTC postavki i topologije; zadržava se i položaj živog primarnog prekidača |
| Promjena projekta/topologije/početnih RTC svojstava | Izolira novu aktivnu RTC domenu; koristi njezinu spremljenu snimku ili početno stanje. Za prijenos rada prvo izričito sačuvaj snimku |
| Sačuvaj snimku RTC-a | Nakon Stop zapisuje registre, RAM, trickle, dio sekunde i valjanost u `properties.rtcState`; zatim projekt koristi redovno spremanje i ZIP/JSON izvoz |
| Ponovno otvaranje / zatvorena stranica | Vraća spremljeno stanje, bez pribrajanja vremena dok je stranica bila zatvorena |

Zadržava se **zadnji primljeni okvir**, ne jamči se hardverski atomarna snimka posljednje još nepotvrđene GPIO instrukcije. Time su RTC domena i MCU RAM razdvojeni bez prikrivenog usklađivanja sata s računalom. Konzolni ispis i tragovi nove sesije počinju iznova. Program koji u `setup()` namjerno postavlja sat i dalje ga prepisuje pri svakom Resetu; to je jasno navedeno u primjeru.

## Vidljivi upravljački izvori i nastavni slijed

`lab_ds1302.py` i `lab_ds1302.h` izvode GPIO komunikaciju, provjeravaju BCD/kalendar i nude čitanje, postavljanje, CH/WP i RAM. Ne postoji host poziv koji vraća gotov datum programu. C++ driver pri otpuštanju I/O također čisti izlaznu/pull zastavicu, pa prekid primarnog napajanja daje nevaljano očitanje umjesto neodređene digitalne razine.

| Primjer | Što učenik vidi/provjerava |
| --- | --- |
| Čitanje i baterija | Čita početni sat, isključuje i vraća glavno napajanje; uz bateriju vrijeme nastavlja |
| Postavljanje i prijestupna godina | Namjerno jednom po pokretanju zapisuje 2028-02-28 23:59:58, zatim prelazi na 29. veljače |
| CH, zaštita i RAM | Zaustavlja sat, pokreće ga, povećava RAM[0], zatim pokazuje da WP odbija zapis 99 |
| DS1302 → TM1637 | Stvarni RTC podaci pretvaraju se u HH:MM segmente; TM1637 ima drugi GPIO protokol i dvotočku prema sekundi |

Za TM1637 ostaju odvojeni CLK/DIO: GPIO4/5 na S3, D2/3 na AVR-u; VCC=5 V i LV prema pločici. Novi S3 C++ dokaz vrijedi za vidljivi `lab_tm1637.h` u ovom lancu. Nije deklarirana svaka vanjska TM1637 biblioteka.

U katalogu postoji grafički modul, svojstva početnog kalendara/baterije/napajanja, živi prekidač, vrijeme i CH/WP/RAM[0]. Mjerenja prikazuju registre, svih 31 B RAM-a i posljednjih 128 komunikacijskih događaja te nude CSV. Upute uvode tri signala i BCD prije zadatka. Povijesne URS vježbe nisu prenumerirane niti mijenjane.

## Dokazi i granice provjere

Ciljani `verification/rtc.test.ts` ima **42 prolazna slučaja**: protokol, kalendarske rubove, CH/WP/RAM, snimku, prekide napajanja, pogrešne spojeve, uvoz/izvoz, osam stvarnih AVR programa, četiri S3 WASM programa i stvarni MicroPython. `verification/rtc-package.mjs` zasebno provjerava **šest točno pakiranih Workera**. Rezultati i ostale završne regresije su u `docs/stage19a-evidence/`; ponovljeno izvođenje istog slučaja ne broji se kao nova provjera.

**592 jedinstvena Node slučaja imaju zabilježen prolazan završni rezultat**, uključujući osam offline provjera i 42 RTC slučaja. Skupni pokus imao je 590 prolaznih i 2 neuspješna, bez preskakanja. Nakon usklađivanja zastarjelog očekivanja matrice devet provjera prolazi, a povremeni slijedni odziv tipkala prolazi u neizmijenjenom zasebnom pokusu. Jedno neprekinuto izvođenje 592/592 nije proglašeno. Prolaze i 10 osnovnih runtime pokusa, tri pokusa projektnih datoteka te ukupno 13 pokusa pakiranih Workera (šest novih i sedam ranijih S3 lanaca). Lokalni ZIP provjeren je kroz HTTP za svih 152 resursa / 11 737 486 B, sa sažecima i dva WASM MIME tipa.

**4/4 novih izvornih izvoza za Arduino IDE** uspješno su prevedena Arduino CLI-jem 1.3.1 i službenim `esp32:esp32@3.3.12`, `esp32:esp32:esp32s3:FlashSize=16M,PSRAM=opi`. U `native/results.json` su hashovi točnog izvoznog ZIP-a/izvora te stvarnih ELF/BIN rezultata. To je potvrda prevođenja, ne flashanje ni izvođenje na fizičkoj pločici.

U razvojnom Chromeu opaženi su RAM[0] 1→2 pri Resetu, zatim 3 nakon spremanja/ponovnog otvaranja i novog pokretanja, prekid/oporavak komunikacije uz bateriju te RTC → TM1637 prikaz 12:00 s dvotočkom. To nije provjera privatne produkcijske domene iza prijave, Safari/iOS-a ili Androida.

Svih **128 ranijih AVR i 15 ranijih S3 artefakata** ostalo je jednako. Dodatno je provjereno **145 neizmijenjenih datoteka** runtimea, corea, ugovora i zaključanih biblioteka. Nema nove migracije ni zahtjeva ponovnog prevođenja starih programa.

Prvi modelni pokus imao je dva neuspjeha očekivanja testa za nepovezani GND/I/O: runtime je ispravno vratio neodređeni ulaz umjesto bajta. Provjera sada prihvaća eksplicitnu električnu pogrešku kao dokaz izostanka valjanog očitanja. Prvi MicroPython pokus pokrenut je prije uspješne nove izgradnje i koristio je stariji dist bez RTC-a; kasniji završni pokus provjerava novu izgradnju. Oba početna zapisa ostaju sačuvana. Preglednički pokus napajanja pronašao je i stvarnu C++ I/O release pogrešku; popravljeni izvor ima zaseban prolazan pokus oporavka.

Regresijska matrica imala je zastarjelo očekivanje da je RTC još planiran. Provjera je usklađena s implementiranim DS1302 i zadržava microSD kao buduću stavku; zasebnih devet provjera matrice prolazi. U testu prekida beskonačne MicroPython petlje samo prekidanje je prošlo. Sljedeći pokus tipkala nije u skupnom pokušaju upalio LED unutar 300 ms; ista cjelina zatim prolazi zasebno bez izmjene koda. Uzrok povremenog neuspjeha odziva nije konačno dokazan i granice vremena nisu prešutno promijenjene.

Model ne obuhvaća kristal, drift, temperaturu oscilatora, punjenje, kapacitet baterije, stvarnu potrošnju ili puni analogni AC timing. Fizički modul, Windows/macOS alatni lanac, školsko računalo, učenički pilot i ciljni mobilni preglednici ostaju otvoreni. Stabilna v1.0 nije proglašena.

## Podloga i nastavak

- [Analog Devices DS1302 podatkovni list, rev. 3/15](https://www.analog.com/media/en/technical-documentation/data-sheets/DS1302.pdf): sučelje i registri, str. 4–9; električni/vremenski parametri, str. 10–12. Ovo je podloga čipa, ne potvrda fizičkog Lab modula ili simulatora.
- [Arduino CLI compile](https://arduino.github.io/arduino-cli/latest/commands/arduino-cli_compile/) i [Espressif paketni indeks](https://espressif.github.io/arduino-esp32/package_esp32_index.json): alati izvornog prevođenja.
- [Prethodna isporuka 18B](stage18b-s3-libraries.md) i [razvojni plan v2](https://chatgpt.com/library?file_id=libfile_7e0755ae66cc819194f32773c28eb3a3&account_id=personal).

Sljedeća cjelina je **19B: microSD**. Prvo SPI naredbe kartice i blokovni uređaj, zatim ograničen disk i potvrđen FAT/VFS put u MicroPythonu/Arduinu. RTC + SD primjer zapisivat će CSV kroz stvarni driver; datoteka u IndexedDB-u sama nije SD protokol. Ova isporuka ne proglašava microSD dovršenim.
