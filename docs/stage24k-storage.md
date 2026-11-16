# Etapa 24K · RTC i SD

Izdanje **0.14.9-beta.1**, provjeravač `24K.1`, dodaje šest rubrika i 24 kombinacije: **232 od 268**, odnosno 58 URS varijanti na četiri cilja. Preostalih 36 kombinacija ostaje bez službenih bodova. Svih 59 ranije objavljenih rubrika čuva isti sadržaj i identitet. Uvodne V1–V5 ostaju zasebne lokalne provjere.

Katalog ima šest URS varijanti u temi pohrane: `rtcRead`, `rtcMemory`, `rtcClock`, `sdInspect`, `sdFiles` i `sdLogger`. Primjeri `rtcSet` i `sdBlocks` ostaju dostupni u simulatoru, ali nisu dodatne URS varijante i ne povećavaju nazivnik matrice.

## Uvjeti i kriteriji

Svaka rubrika ima 10 bodova: 3 za dovršene prijenose svih potrebnih uređaja, 5 za osnovnu funkciju i 2 za nastavak. Nastavnik bira novu rubriku pri novoj objavi zadatka. Učenik čita točne uvjete prije rada. Provjerava se spremljena revizija, izvor i sklop; konzolni tekst ili učenički JSON rezultat ne mogu stvoriti bodove.

| Rubrika | Osnovna funkcija · 5 | Nastavak · 2 |
| --- | --- | --- |
| `24K-rtcRead@1` | Nova BCD čitanja i ispisi prije prekida | Gubitak komunikacije uz bateriju i nova očitanja nakon povratka |
| `24K-rtcMemory@1` | CH zaustavlja sat; inkrement i odbijeni zapis RAM-a uz WP | Ukinuta zaštita i nastavak sata bez gubitka RAM-a |
| `24K-rtcClock@1` | Novo RTC čitanje i stvarni segmenti sata/minuta | Četiri crtice tijekom prekida, povrat i obje parnosti dvotočke |
| `24K-sdInspect@1` | Dovršen boot sektor, broj sektora i potpis 55AA | Stvarno čitanje pri FAT16 montiranju ili popisu datoteka |
| `24K-sdFiles@1` | Stvarno dopisanih 28 bajtova uz očuvanje prefiksa | Novo čitanje nakon upisa, točna duljina i ispis sadržaja |
| `24K-sdLogger@1` | Prva dva stvarna CSV retka iz novih RTC čitanja | Najmanje četiri rastuća zapisa i prijelaz kalendara |

## Privatna izvršna kopija i početni mediji

Dopušteni su drugi algoritmi, nazivi, valjani GPIO i električno ekvivalentan raspored. DS1302 koristi trožično CE/I/O/SCLK sučelje, LSB prvi; nije I2C ili SPI uređaj. SD koristi stvarni SPI s CMD17/CMD24 i ograničenu SDSC v2 karticu 8 MiB/FAT16. TM1637 prima segmentne bajtove preko zasebnog protokola.

Privatna kopija RTC-a počinje na jednom od dva objavljena rubna kalendara: 28. 2. 2028. ili 31. 12. 2026. u 23:59:58. RAM[0] počinje s 41 ili 200. Baterija i glavno napajanje početno su uključeni. Time se traže stvarna BCD čitanja, prijelaz datuma i novi podatak umjesto fiksnog teksta. Početni spremljeni SD sektori ostaju iz učeničke snimke. Provjeravač ne prepisuje spremljeni projekt niti sprema svoje promjene na njegov medij.

RTC telemetrija bilježi završenu transakciju tek nakon spuštanja CE i sadrži samo cijele prenesene bajtove. Odvojeno bilježi prihvaćene i WP-om odbijene zapise; posljednjih 64 transakcije ograničava memoriju. SD čitanje računa se dovršenim tek kada su vraćena sva 512 podatkovna i oba CRC bajta; nepotpuno čitanje pri dizanju CS-a odbacuje se. Brojači dovršenih čitanja čuvaju dokaz inicijalizacije i kada više prijenosa popuni ograničeni dnevnik posljednjih 16 blokova. Sadržaj datoteke čita zaseban FAT16 preglednik iz stvarnih potvrđenih sektora.

Jednokratni Python programi za pregled i datoteku smiju uredno završiti. RTC i CSV petlje moraju nastaviti kroz cijeli scenarij. Nepodržan izvor, kvar infrastrukture i prekoračenje resursa ostavljaju bodove praznima.

## Pojedinačne specifikacije

### DS1302: novo čitanje, kalendar i baterija

Tri etape po 3200 ms: glavno napajanje uključeno, isključeno uz bateriju, ponovno uključeno. Svakih najviše 1400 ms ispiši RTC YYYY-M-D H:M:S DAY=d iz novog čitanja; najmanje dva različita vremena u napajanoj etapi. Ne zapisuj sat. Tijekom prekida ispisuj RTC ERROR, nakon povratka nastavi stvarni zadržani sat. Datum i dan moraju pratiti prijestupni dan ili novu godinu.

### DS1302: CH, zaštita pisanja i zadržani RAM

Pokus traje 6000 ms. Postavi CH=1 najmanje 950 ms, potvrdi RTC CH=1 i vrati CH=0. Pročitaj početni RAM[0], povećaj ga za jedan modulo 256, uključi WP i pokušaj zapisati 99. Zapis mora biti odbijen. Ispiši RTC RAM=n WP=1 za stvarni zadržani n. Zatim vrati WP=0 i nastavi čitanje kalendara; najmanje tri različite ispravne vremenske oznake.

### DS1302 → TM1637: stvarni sati, minute i dvotočka

Tri etape po 3200 ms kao pri čitanju RTC-a. Očitavaj najviše svakih 1400 ms; TM1637 prikazuje HHMM s vodećom nulom, segmentima 0–9 i dvotočkom uključenom u neparnoj sekundi. Dopušteno je najviše 500 ms kašnjenja osvježavanja na prijelazu minute. Ispis RTC YYYY-M-D H:M:S DAY=d ili RTC DISPLAY=H:M:S mora pratiti stvarno čitanje. Za vrijeme gubitka komunikacije prikaži četiri crtice 0x40 i RTC ERROR. Nakon povratka obnovi prikaz; obje parnosti dvotočke moraju biti primljene.

### microSD: cijeli boot sektor i FAT16

U najviše 4000 ms inicijaliziraj SDSC, preko CMD17 primi svih 512 bajtova i oba CRC bajta sektora 0. Ispiši SD SECTORS=16384 SIGNATURE=55AA. Montiraj ograničeni FAT16; Python ispisuje SD FILES i čita korijenski direktorij, C++ ispisuje SD FAT16 MOUNT=1 nakon ponovnog čitanja boot sektora. Ne formatiraj karticu. Jednokratni program smije završiti.

### microSD: dopisivanje i ponovno čitanje FAT16

U najviše 4000 ms montiraj postojeću karticu i u LAB.TXT točno jednom dopiši Pozdrav iz FAT16 preko SPI! i LF (28 bajtova). Sačuvaj postojeći prefiks, uključujući prijelaz preko 512 bajtova. Zatvori zapis, ponovno pročitaj stvarne podatkovne sektore i ispiši SD FILE BYTES=n te sadržaj datoteke. Nema automatskog formatiranja. Jednokratni program smije završiti.

### DS1302 → microSD: provjereni CSV zapisi

Pokus traje 6000 ms. Sačuvaj postojeći LOG.CSV; na praznoj kartici stvori zaglavlje uzorak,vrijeme i LF. Dopisuj retke n,YYYY-MM-DD HH:MM:SS i LF, s uzorkom od 0 i povećanjem za jedan. Svaka oznaka mora biti dobivena dovršenim novim RTC čitanjem; datoteku zatvori nakon svakog retka. Prva dva ispravna retka čine osnovni kriterij, najmanje četiri strogo rastuća vremena i svi novi retci nastavak. Provjerava se sadržaj FAT16 sektora, a ne samo SD CSV ispis.

## Provjere i nadogradnja

`verification/school-storage.test.ts` provjerava tri neovisna ponavljanja svih 24 kombinacija, dva odvojena prekida vodova i popravak, drugo kalendarsko/RAM sjeme, alternativne algoritme i izmijenjeni raspored. Za svaki kriterij postoje neovisno pogrešna rješenja s očekivanih 3/10 i 8/10. C++ reference, alternative i oba pogrešna rješenja zasebno se prevode na S3 C++, Unu i Nanu: ukupno 72 prijevoda. Sva četiri cilja dodatno čuvaju spremljenih 510 bajtova datoteke pri dopisivanju do 538 bajtova preko granice sektora.

`verification/school-storage-api.test.mjs` provjerava objavu svih 24 kombinacije kroz pravi PHP/MySQL, ugovor, autentične rezultate, odbijanje rezultata stranog ugovora, zaključavanje i čuvanje ranije zaključane predaje. Potpuni prihvat uključuje ranije obitelji, račune, razrede, spremanje, izvještaje, korekcije, arhiviranje, povrat kopije i sintetski razred od 30 učenika. Dokaz završnog prihvata i stvarni broj izvedbi bilježe se nakon izvršavanja u `stage24k-evidence/`.

Nema nove SQL migracije. Prije nadogradnje sačuvaj bazu i privatnu konfiguraciju. Zamijeni kompletan paket, zadrži ključ i sesije, pokreni postojeći `migrate` i ponovno pokreni Linux provjeravače. Stare dodjele i zaključane predaje ostaju vezane uz svoje prvotne ugovore. Nova rubrika uključuje se izričitim odabirom pri objavi.

Ograničenja ostaju 65 s zidnog i 58 s CPU vremena, 90 s prevođenja, 2048 MiB adresnog prostora i 1 MiB izlaza. GitHub Pages služi simulator i prikaz podrške; školska prijava i službeno bodovanje zahtijevaju PHP/MySQL i privatni Linux provjeravač.

Sljedeća predviđena etapa 24L obuhvaća optički MAX30102. Preostale sabirničke, radio i električne razine još nisu pokrivene svim rubrikama. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i skupno cgroup ograničenje memorije ostaju zasebni završni uvjeti.

## Završni prihvat

[Potpuni prihvat](https://github.com/zljix/labosv2/actions/runs/43968133436) uspješno je dovršen za MicroPython, S3 C++, Uno i Nano. Potvrđuje 238 ciljanih izvedbi, 72 neovisna prijevoda i 24 zaključane dodjele uz ranije obitelji i školske administrativne provjere. [Sažetak](stage24k-evidence/acceptance-summary.json) veže rezultate uz isti provjeravač u instalacijskom paketu. Svih 903 datoteka iz CI inventure provjereno je po veličini i SHA-256; isporučeni ZIP ostaje bajtno jednak potvrđenom CI paketu.
