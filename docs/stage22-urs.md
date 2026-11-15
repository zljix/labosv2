# Etapa 22 — objedinjene URS vježbe i priprema pilota

Izdanje **0.12.0-beta.1**, 14. studenoga 2026. Ovo je dovršena tehnička priprema nastavne zbirke, matrice i pilota; nije potvrda stvarnog učeničkog pilota ni stabilna v1.0.

## Opseg zbirke

**Vježbe → URS zbirka** otvara 16 tema i 63 varijante. U svakoj su prije primjene objašnjeni novi pojmovi. Slijede napomena konkretnog primjera, stvarne veze trenutačnog sklopa, početni program, promjena, pokus pogreške, oporavak i pitanja. Programi i driveri potječu iz postojećih izvršivih primjera; ova etapa ih povezuje u nastavne radne listove. Novi početni primjeri ne nastaju prepoznavanjem teksta ili izravnim generiranjem izlaza sučelja.

| Cilj | Ponuđene varijante | Napomena |
| --- | ---: | --- |
| ESP32-S3 MicroPython | 63 | Stvarni WASM interpreter i postojeći modeli. |
| ESP32-S3 Arduino C++ | 25 | Funkcionalni WASM profil; nije Espressif core/Xtensa firmware. |
| Arduino Uno R3 | 63 | Stvarni priloženi AVR prijevodi. |
| Arduino Nano classic | 63 | Zaseban cilj/pinout, stvarni AVR prijevodi. |

Ukupno je **214 ponuđenih putova varijanta × cilj**, a ne 214 novih jedinstvenih programa ili potvrda fizičkih modula. Radio dopušta zaseban izbor cilja čvora B; ta dodatna kombinatorika nije dodana broju 214. Početni C++ primjeri već imaju prijevod; promijenjeni izvor zahtijeva postojeći lokalni prevoditelj.

| Tema | Sadržaj | Varijante |
| --- | --- | ---: |
| URS01 | GPIO, tipkalo, ADC/PWM | 3 |
| URS02 | AHT10 → OLED → servo i histereza | 1 |
| URS03 | BMP180/BMP280/AM2320 i meteorološka stanica | 4 |
| URS04 | LM35, NTC, TEMT6000, joystick, plamen/zvuk, više ulaza | 8 |
| URS05 | DHT11/DHT22, checksum i interval očitanja | 3 |
| URS06 | DS18B20 identiteti, razlučivost i CRC | 3 |
| URS07 | OLED32, LCD1602 i TM1637 | 4 |
| URS08 | KY-040 signali, dekoder i poskakivanje | 3 |
| URS09 | NEC impulsi, LED i predajnik | 3 |
| URS10 | Relej, zvuk, SG90 i L298N/DC pogoni | 7 |
| URS11 | A4988 koraci, mikrokoraci i upravljanje | 3 |
| URS12 | ST7735, BMP280 SPI i instrument | 4 |
| URS13 | ILI9341 i XPT2046 kalibracija/dodir | 6 |
| URS14 | DS1302, TM1637, FAT16 i CSV zapisivač | 6 |
| URS15 | MAX30102 registri, uzorci, frekvencija i FIFO | 4 |
| URS16 | Dva NRF24L01+ čvora | 1 |

Brojevi URS pripadaju aplikaciji. Postojeći školski LV1/LV2 i izvorni niz V1–V5 nisu prenumerirani. V1–V5 ostaju u zasebnom izborniku sa svojom automatskom provjerom. URS predlošci su potpuni vođeni uzorci koje učenik mijenja i objašnjava. Procijenjena trajanja nisu još potvrđena u učionici.

URS01 LED za Uno/Nano vraća struju preko stvarne mreže minus lište breadboarda 1–60; izvorni Arduino kod i njegov artefakt ostaju isti. MicroPython i S3 C++ zadržavaju postojeću topologiju primjera. To nije automatsko preslikavanje pinova različitih pločica.

## Radni list i predaja

Projekt dobiva `urs-vjezba.json` verzije 1 i `urs-upute.md`. Radni list ima poznatu temu/varijantu, ime/grupu, tri opažanja (početno, promjena, pogreška/oporavak) i odgovore. Nevaljani identifikatori, verzije, tipovi i prevelike vrijednosti odbijaju se pri čitanju radnog lista. Kod i sklop ostaju dostupni za pregled i kad radni list nije podržan.

**Zabilježi pregled sadržaja** nakon Stop sprema vrijeme i SHA-256 odabranog programa, upravljačkih datoteka, pločice, izvršnog profila, sklopa, priloženog prijevoda i obaju čvorova. Sačuvane SD/RTC snimke ulaze kao dio svojstava sklopa. Naziv projekta, editor i odgovori ne mijenjaju taj otisak. Opažanja su korisnički unos; ova radnja ne izvršava automatski pokus.

**Preuzmi URS predaju ZIP** zahtijeva ime/grupu, sve odgovore, sva tri opažanja i aktualan otisak. Neuspjeli pokus dopušten je uz opis. Izvoz regenerira upute i `urs-predaja.md` iz poznatog kataloga, ne vjeruje uvezenim tvrdnjama u tim dokumentima. ZIP sadrži izvorne datoteke, drivere, sklop, radni list i peer čvor gdje postoji. Uvoz stvara zaustavljenu kopiju. Format projekta ostaje 3 za jednu pločicu odnosno 4 za dva čvora.

URS dokumenti nisu skriveni ulazi u MicroPython izvođenje. Hash nije digitalni potpis ni zaštita od krivotvorenja. Nastavnik ponavlja stvarne pokuse i uspoređuje kod, sklop i opažanja.

## Nastavnički prikaz

Odabir **Nastavnikov pregled** prikazuje kriterije i polje opažanja. Može spremiti korisničku oznaku *potrebna dorada* ili *pregledano*. Nema nove prijave, autentifikacije uloge, automatske ocjene ili ovjeravanja identiteta.

Nastavnički zapis vezan je uz dodatni otisak koji uključuje učenikove odgovore i opažanja. Promjena bilo kojeg od njih, programa, sklopa ili drugog čvora označava zapis zastarjelim. Ručni unos nastavničkog zapisa ne pretvara korisnička opažanja u potvrdu izvršavanja.

## Matrica i otvoreni zadaci

Matrica sadrži **39 kataloških stavki × četiri cilja = 156 polja**. Svako ima status, driver, opseg/granice, povezane URS teme i putanju izvornih provjera. CSV je reproducibilno generiran iz istih podataka kao sučelje, s UTF-8 BOM-om, navodnicima i točkom sa zarezom za tablični uvoz.

| Cilj | Razvojno provjereno | Eksperimentalno | Planirano/otvoreno |
| --- | ---: | ---: | ---: |
| S3 MicroPython | 16 | 21 | 2 |
| S3 Arduino C++ | 0 | 22 | 17 |
| Uno | 0 | 37 | 2 |
| Nano | 0 | 37 | 2 |

Statusi opisuju deklarirani funkcionalni opseg postojećeg modela. Putanja testa služi ponovljivosti; sama po sebi nije tvrdnja da je svaka moguća kombinacija modula ili fizička pločica ispitana.

Zaseban generički pretvornik logičkih razina i točna SFM-20B izvedba ostaju otvoreni na svim ciljevima. Prilagodba unutar izričitih carrier modula zasebno je dokumentirana. S3 C++ ima još 15 otvorenih komponentnih stavki uz te dvije: LM35, TEMT6000, NTC, KY-023, plamen, zvuk, KY-040, IR, relej, aktivna zujalica, pasivni zvuk, DC/L298N, A4988, BMP280 SPI i ST7735. Dostupnost osnovnog GPIO API-ja nije proglašena provjerom svih tih drivera i primjera.

Zajednički idealan DC izvor pojašnjen je kao eksperimentalni profil na sva četiri cilja; S3 SG90 primjer ga već stvarno koristi. Nisu dodani strujni, toplinski ili mehanički modeli. ESP32 DevKitC V4 i CAM nemaju nove profile; točna izvedba ostaje preduvjet proširenja.

## Pilot i pristupačnost

`pilot.html` bilježi inačicu stvarno otvorene aplikacije, vježbu/varijantu, oba cilja, računalo/OS, preglednik, način unosa, trajanje, pruženu pomoć, pogreške, oporavak, Stop, predaju, nastavničko ponavljanje i hladni offline pokus. Odabir u obrascu bilježi provedeni pokus; ne omogućuje inače nepodržanu varijantu.

Početni ishod je *još nije proveden / nacrt*. Izvoz takvog zapisa ostaje jasno označen nacrtom. Podaci se ne šalju poslužitelju ni automatski ne spremaju. Razvojni UI pokus obrasca nije pilot učenika. Pravi pilot mora uključiti učenika koji nije sudjelovao u razvoju i ciljnu školsku opremu.

Nove kontrole imaju oznake, nativne select/details elemente, vidljiv fokus i prilagodbu uskom prikazu. U razvojnom Chromeu provjereni su tipkovnički Tab do summary elementa, Enter otvaranje teme i Escape zatvaranje dijaloga. To nije potvrda čitača zaslona, ciljnog mobitela ili WCAG sukladnosti.

## Ponovljive provjere

- `npm run build` generira CSV/pilot, provjerava TypeScript i gradi aplikaciju.
- `npm run test:urs` provjerava sve ponuđene putove, izvore/drivere, stvarne električne mreže, točno vezane C++ artefakte, JSON/ZIP, odbijanje nepodržanih putova i ispravnost radnih listova. Provjerava vezanje obaju čvorova, promjenu spremljenog medija, zastarjelost i regeneriranje opisnih dokumenata.
- `node --import tsx verification/urs-package.ts` izvršava novim katalogom stvoreni AHT10/OLED/servo projekt na točnim zapakiranim Workerima sva četiri cilja. Programi prolaze slijed 24 → 29 → 27 → 25 → 27 °C uz očekivane kutove 0 → 90 → 90 → 0 → 0°; prati se i primitak piksela, a ne samo konzola. Mjerenje Stop-a vrijedi za razvojni Linux.
- Cjelovita regresija i ponovljene offline/lokalne provjere bilježe se u `stage22-evidence/`; brojevi konkretne isporuke navode se u završnom izvješću. Ponavljanja se ne dodaju broju jedinstvenih testova.

`browser-review.json` razlikuje stvarna UI opažanja od automatskih pokusa. Sadrži razvojnu provjeru četiriju izvršnih ciljeva, preuzimanje/ponovni uvoz URS paketa, zastarijevanje nastavničkog zapisa, Nano → MicroPython radio s gubitkom ACK-a, stvarno preuzeti promet CSV i CSV matrice te izvoz jasno nepotvrđenog nacrta pilota.

## Rezultati završne izgradnje

Izgradnja `c66c7ff942520b4b` ima **950 različitih testnih slučajeva s prolaznom završnom potvrdom**, bez preskakanja: 942 TypeScript slučaja, među kojima 219 URS slučajeva, i osam offline slučajeva. Početni široki pokus prošao je 938/942; četiri stvarna S3 compiler pokusa zapela su jer razvojni PATH nije sadržavao `wasm-ld-19`. Nakon dodavanja privremene putanje do već instaliranog zaključanog linkera prošla su sva 61 slučaja dviju pogođenih S3 zbirki. Ti se ponovljeni slučajevi ne dodaju broju 950. Izvor compiler ugovora nije mijenjan. Početni rezultati i ponovljeni dokaz sačuvani su odvojeno.

Završni zapakirani URS regulator prošao je na sva četiri cilja, uključujući stvarne promjene temperature, histerezu i primljene piksele. Prisilni prekid Workera izmjeren je na **3,59–12,24 ms** u ovom razvojnom Linuxu; nije tvrdnja o ciljnim učeničkim uređajima.

Lokalni ZIP raspakiran je i poslužen stvarnim loopback HTTP-om. Potvrđeni su **174 resursa / 13 733 426 B**, svi sažeci i veličine te dva `application/wasm` MIME odgovora. ZIP ima **4 740 922 B**, SHA-256 `7fd3dffaf52170029fa70c8b30e6edc10d9609cb43658d71206a551e5441cad3`. To nije hladno offline otvaranje u stvarnom pregledniku. Povijesne datoteke dokaza koje su stare provjere ponovno zapisale vraćene su na izvorni commit; ova isporuka ima vlastitu mapu dokaza.

## Nastavak

Tehnički katalog, predaja i matrica spremni su za stvarni pilot. Sljedeći razvojni paket treba zatvoriti preostale S3 C++ drivere/primjere po malim provjerljivim skupinama, počevši analognim i jednostavnim GPIO modulima. Istodobno se prikuplja stvarni učenički pilot i provjerava točna fizička oprema. Stabilna puna URS inačica ne proglašava se samo na temelju broja testova.
