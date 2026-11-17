# Labosv2 · školski laboratorij

**0.14.15-beta.1 · etapa 24Q · sučelje i upute po varijanti · pripremljeno za pregled.**

Čitljiviji školski paneli, sklop ispred ulaznih kontrola, pretraživ katalog, istraživačka kopija i završne upute prema načinu rada. Svih 67 URS varijanti ima vlastite upute uz očuvanje ranijih odgovora. [Provedene dorade, provjere i preostali vizualni prihvat/pilot](docs/STAGE24Q_PLAN_I_PROVJERA.md). Nova verzija još nije javno objavljena.

**Tehnički prihvat 24P:** [Završne provjere i paket](https://github.com/zljix/labosv2/actions/runs/44105942453) potvrđuju svih 273 očekivanih ishoda, 79 nepromijenjenih prethodnih rubrika i 15 novih izoliranih C++ prijevoda za S3, Uno i Nano. Prošli su PHP/MySQL tokovi dugih Unicode identiteta, zaključavanja i dorade, oba radio čvora, ranije obitelji, pokus s 30 simuliranih učenika, izvještaji i povrat sigurnosne kopije. [Sažetak i otisak provjeravača](docs/stage24p-evidence/acceptance-summary.json). Stvarni školski pilot ostaje otvoren.

## Povijest prihvata

**Prihvat 24O:** [Završne provjere i paket](https://github.com/zljix/labosv2/actions/runs/44068540213) prošli su svih 53 koraka. Potvrđeno je 56 ciljanih izvedbi, 15 ponovljenih referentnih izvedbi, pet zasebnih zaključanih V dodjela te očuvanje svih 74 prethodnih rubrika. Prošle su ranije obitelji, 30 simuliranih učenika, izvještaji i povrat sigurnosne kopije. [Sažetak](docs/stage24o-evidence/acceptance-summary.json) i [izvornost instalacijskog paketa](docs/stage24o-evidence/installer-integrity.json).

**Prihvat 24N:** [Završne provjere i paket](https://github.com/zljix/labosv2/actions/runs/44052504254) potvrđuju 253 ciljane izvedbe, 48 neovisnih C++ prijevoda i 16 zaključanih školskih dodjela. Prošli su svi ciljevi, ranije obitelji, 30 simuliranih učenika, izvještaji i povrat kopije. [Sažetak](docs/stage24n-evidence/acceptance-summary.json) i [izvornost instalacijskog paketa](docs/stage24n-evidence/installer-integrity.json).

**Prihvat 24M:** [Završne provjere i paket](https://github.com/zljix/labosv2/actions/runs/44037558293) povezuju 60 ciljanih provjera, 24 zasebna C++ prijevoda obaju čvorova i četiri zaključane radijske dodjele s isporučenim provjeravačem. Potvrđeni su svih 16 mješovitih parova, ranije obitelji, 30 simuliranih učenika, izvještaji i povrat kopije. [Sažetak i otisak provjeravača](docs/stage24m-evidence/acceptance-summary.json).

**Prihvat 24L:** [Završni prihvat i paket](https://github.com/zljix/labosv2/actions/runs/43981733195) potvrđuju 162 ciljane izvedbe, 48 neovisnih C++ prijevoda i 16 zaključanih MAX30102 dodjela. Ranije obitelji, računi, izvještaji, povrat kopije i pokus s 30 simuliranih učenika potvrđeni su na bajtno istom programu i provjeravaču. [Sažetak i podrijetlo dokaza](docs/stage24l-evidence/acceptance-summary.json).

**Prihvat 24K:** [Završne provjere](https://github.com/zljix/labosv2/actions/runs/43968133436) potvrđuju sva četiri cilja, 238 ciljanih izvedbi, 72 neovisna C++ prijevoda i 24 zaključane RTC/SD dodjele kroz pravi PHP/MySQL. Prošli su ranije obitelji, pokus s 30 učenika, izvještaji i povrat sigurnosne kopije. [Sažetak dokaza](docs/stage24k-evidence/acceptance-summary.json) povezuje rezultate s isporučenim provjeravačem.

**Prihvat 24J:** [Završne provjere](https://github.com/zljix/labosv2/actions/runs/43959526722) potvrđuju sva četiri cilja, 234 ciljane izvedbe, 72 neovisna C++ prijevoda i 24 stvarne školske dodjele, zaključavanje te očuvanje ranijih predaja. Isti provjeravač isporučen je u školskom paketu. [Sažetak dokaza](docs/stage24j-evidence/acceptance-summary.json).

**Prihvat 24I:** [Završne provjere](https://github.com/zljix/labosv2/actions/runs/43949417346) povezuju sva četiri cilja i 24 neovisna C++ prijevoda s konačnim provjeravačem: osam službenih dodjela, ispravne cijele OLED brojke, dva vala po 30 predaja bez dvostrukih rezultata, izvještaji i povrat sigurnosne kopije. [Sažetak dokaza](docs/stage24i-evidence/acceptance-summary.json).

**Prihvat 24H:** [GitHub Actions](https://github.com/zljix/labosv2/actions/runs/43937992501) potvrđuje sva četiri cilja, 96 neovisnih C++ prijevoda, 32 zaključane dodjele, PHP/MySQL, izvještaje, povrat kopije i pokus s 30 simuliranih učenika. Programske datoteke provjeravača bajtno odgovaraju prihvaćenoj izgradnji.

[Završni prihvat 24G](https://github.com/zljix/labosv2/actions/runs/43925558604) potvrđuje sva četiri cilja, 36 neovisnih C++ prijevoda, 12 zaključanih dodjela, pravi PHP/MySQL, izvještaje, povrat kopije i pokus s 30 simuliranih učenika. Provjereno je svih 880 datoteka iz inventure paketa; programski izvor odgovara prihvatu.

Prethodna 23F PHP/MySQL integracija prošla je u [GitHub Actionsu](https://github.com/zljix/labosv2/actions/runs/43738711916). Provjere izvještaja i administracije vode se zasebno u [izvješću 23H](docs/stage23h-reports-administration.md).

Nastavak postojećeg ESP32 MicroPython / Arduino laboratorija za školski sustav s PHP-om i stvarnim MySQL-om. Polazište je [labos 0.12.9](https://github.com/zljix/labos/tree/3c4a281c10282d63b2742280f69aadbc08d7ae1e), uključujući posljednje dorade vodova.

[Web laboratorij](https://zljix.github.io/labosv2/) · [Školski račun](https://zljix.github.io/labosv2/school.html#account) · [Upute za instalaciju](school/README.md) · [Bodovanje i dokazi 23E](docs/stage23e-grading.md)

[Neovisni prihvat 24F](https://github.com/zljix/labosv2/actions/runs/43915429891) potvrđuje sva četiri cilja i 67 novih prijevoda. [Školski prihvat 24F](https://github.com/zljix/labosv2/actions/runs/43916966742) potvrđuje identičan programski izvor, PHP/MySQL, bodove, zaključavanje, 30 simuliranih učenika, izvještaje i paket.

## Sačuvano iz 24O

- Pet zasebnih uvodnih MicroPython zadataka V1–V5 sa službenim bodovima 3 + 5 + 2, revizijama i zaključanom predajom.
- **268/268 URS kombinacija + 5/5 uvodnih zadataka**, s odvojenim evidencijama i izvornim početnim projektima za učenika.
- Vlastiti odaziv V2 od 300 ms; puni ADC/PWM; svježi AHT10, stvarni OLED 128×64 sa slobodnim rasporedom redaka te oba smjera histereze.
- [Uvjeti, opseg i nadogradnja](docs/stage24o-introductory.md). Nema nove SQL migracije. Tehnička regresija 24P je dovršena; stvarni školski pilot ostaje otvoren.

## Sačuvano iz 24N

- Četiri nove rubrike: tipkalo i LED kroz SN74LVC2T45 te BMP280 i OLED128×32 kroz automatski I2C pretvornik.
- **268/268 kombinacija**: svih 67 postojećih URS varijanti na MicroPythonu, S3 C++, Unu i Nanu ima verzioniranu službenu provjeru. U 24N uvodne V1–V5 još su bile zasebne lokalne provjere; 24O dodaje njihove školske rubrike.
- Stvarne odvojene naponske domene, DIR, valjan podatkovni kanal, novi senzorski prijenosi i primljena OLED memorija određuju bodove 3 + 5 + 2.
- Postojeći programi i njihova vremena ostaju sačuvani. [Uvjeti, opseg i nadogradnja](docs/stage24n-levels.md). Nema nove SQL migracije.

## Sačuvano iz 24M

- Službeno bodovanje stvarnog TX/RX para: oba izvora i sklopa, SPI, radio ACK/retry i dovršeno RX čitanje.
- **252/268 kombinacija**: 63 URS varijante na četiri glavna cilja; drugi čvor može biti bilo koji od sva četiri cilja.
- Normalna veza, izgubljeni ACK i podatkovni pokušaji, blokada/MAX_RT te obnovljeni pokus. Kriteriji 3 + 5 + 2 boda.
- [Uvjeti, opseg i nadogradnja](docs/stage24m-radio.md). Nema nove SQL migracije; radio posao ima rezervaciju od 300 s za prevođenje oba čvora.

## Sačuvano iz 24L

- Četiri rubrike za registre i shutdown, sirove RED/IR uzorke, frekvenciju sintetskog signala te pun FIFO i oporavak.
- **248/268 kombinacija**, odnosno 62 URS varijante na sva četiri cilja; svih 65 ranijih rubrika ostaje neizmijenjeno.
- Stvarni I2C prijenosi i novi šestobajtni uzorci; promjene kontakta i frekvencije te provjerena pražnjenja FIFO-a. Nema medicinskog mjerenja.
- [Točni uvjeti, provjere i nadogradnja](docs/stage24l-optical.md). Nema nove SQL migracije.

## Sačuvano iz 24K

- Šest rubrika za RTC čitanje/bateriju, CH/WP/RAM, TM1637 sat, SD boot sektor, FAT16 dopisivanje i RTC CSV zapisivač.
- **232/268 kombinacija**, odnosno 58 URS varijanti na sva četiri cilja; svih 59 ranijih rubrika ostaje neizmijenjeno.
- Bodovi iz dovršenih RTC bajtova, stvarnih SPI sektora, sadržaja datoteka i primljenih segmenata; provjera čuva početne SD podatke i prijelaz preko 512 bajtova.
- [Točni uvjeti i nadogradnja](docs/stage24k-storage.md). Nema nove SQL migracije.

## Sačuvano iz 24J

- Šest rubrika i 24 nove kombinacije: **208/268**, odnosno 52 URS varijante na sva četiri cilja.
- ILI9341 grafika i četiri rotacije; XPT2046 sirovi kanali, izmjerena kalibracija, dodirno tipkalo i rotacije dodira.
- Stvarni SPI povratni bajtovi, primljeni fizički TFT pikseli i struja LED-ice; zasebni negativni pokusi za svaki kriterij.
- [Točni uvjeti, provjere i nadogradnja](docs/stage24j-touch.md). Nema nove SQL migracije.

## Novo u 24I

- Dvije rubrike za regulator AHT10 → OLED → servo i meteorološku stanicu BMP180/BMP280/AM2320/OLED.
- **184/268 podržanih kombinacija**: 46 URS varijanti na sva četiri cilja.
- Nova dovršena očitanja, neovisne promjene senzora, stvarni OLED pikseli i servo impulsi; oba smjera histereze i granični AHT10 uzorci.
- Kriteriji 3 + 5 + 2, rokovi, fontovi i tolerancije vidljivi su prije rada. Ranija 51 rubrika ostaje neizmijenjena.
- [Opseg, provjere i nadogradnja](docs/stage24i-environment.md). Nema nove SQL migracije. Slijedi 24J: ILI9341 i dodir.

## Sačuvano iz 24H

- Osam novih rubrika za OLED 128×32, LCD1602, TM1637 segmente i programsko vrijeme, ST7735 grafiku/rotaciju te BMP280 SPI i instrument.
- **176/268 podržanih kombinacija**: 44 varijante na sva četiri cilja.
- Bodovi slijede primljene piksele, DDRAM/CGRAM znakove, segmentne bajtove/ACK i nova dovršena SPI mjerenja. Instrument prati promjenu okoliša i povrat.
- Postojeći rasporedi teksta zadržani su po cilju, kriteriji 3 + 5 + 2 i tolerancije vidljivi su prije rada; ranije 43 rubrike ostaju neizmijenjene.
- [Opseg, provjere i nadogradnja](docs/stage24h-displays.md). Nema nove SQL migracije. Slijedi 24I: meteorološka stanica i regulator.

## Sačuvano iz 24G

- Tri nove rubrike: broj koraka i smjer, svih pet mikrostep načina te ENABLE/RESET/SLEEP.
- **144/268 podržanih kombinacija**: 36 varijanti na sva četiri cilja.
- Bodovi proizlaze iz valjanih STEP bridova, MS pinova, translatora, pobude i idealnog pomaka motora. ENABLE isključuje mostove dok translator ostaje aktivan; RESET ne referencira osovinu.
- Kriteriji 3 + 5 + 2 boda, rokovi, stanke i tolerancije vidljivi su prije rada. Ranijih 40 rubrika i zaključane predaje ostaju sačuvani.
- [Opseg, dokazi i nadogradnja](docs/stage24g-steppers.md). Nema nove SQL migracije. Sljedeća je etapa 24H.

## Sačuvano iz 24F

- Sedam novih rubrika za relej, aktivnu i pasivnu zujalicu, SG90, jedan i dva L298N kanala te istodobni servo/motor/ton.
- **132/268 podržanih kombinacija**: 33 varijante na sva četiri cilja.
- Stvarni kontakti i struja, ton i tišina, servo impulsi, potpisani prosječni napon, PWM te odvojeno kočenje i slobodno zaustavljanje.
- Tri ciklusa uz objavljene tolerancije; privatna promjena energetskog napona i stvarni sukobi AVR timera. Kriteriji 3 + 5 + 2 boda vidljivi su prije rada.
- [Opseg, dokazi i nadogradnja](docs/stage24f-actuators.md). Nema nove SQL migracije. Sljedeća je etapa 24G.

## Sačuvano iz 24E

- Šest novih rubrika: sirovi CLK/DT/SW, dekoder i brojač, poskakivanje, NEC impulsi, IR → LED i stvarni TX/RX put.
- **104/268 podržanih kombinacija**: 26 varijanti na sva četiri cilja.
- Odvojeni fizički položaj i programski brojač; stvarni PWM, kratki/dugi pritisak, repeat, 0/100 %, pogrešan okvir i obnova optičke putanje.
- Upute, rokovi, tolerancije i kriteriji 3 + 5 + 2 boda vidljivi su prije rada. Ranije rubrike i zaključane predaje ostaju sačuvane.
- [Opseg, dokazi i nadogradnja](docs/stage24e-events.md). Nema nove SQL migracije. Sljedeća je etapa 24F.

## Sačuvano iz 24D

- Sedam novih rubrika za AM2320, DHT11/DHT22, pogreške DHT-a te tri DS18B20 varijante.
- **80/268 podržanih kombinacija**, odnosno 20 varijanti na sva četiri cilja.
- Stvarni prijenosi, ROM identiteti, dovršene pretvorbe, razlučivost 9–12 bita, CRC, pogreške i oporavak.
- Upute, jedinice, rokovi, tolerancije i raspodjela 3 + 5 + 2 boda vidljivi su prije rada.
- [Opseg, provjere, ograničenja i nadogradnja](docs/stage24d-sensors.md). Nema nove SQL migracije. Sljedeća etapa je 24E.

## Sačuvano iz 24C

Osam rubrika za puni ADC/PWM, NTC, TEMT6000, joystick, plamen, zvuk, LM35/NTC i dva potenciometra s tipkalima ostaje neizmijenjeno. Digitalni prag i puni PWM imaju zasebne identitete. [Opseg i provjere 24C](docs/stage24c-analog.md).

## Sačuvano iz 24A–24B

- Šest novih rubrika zamrzava upute, kriterije, scenarije, rokove, tolerancije, izvršne profile i ograničenja. Rezultat pripada točnom poslu, pokušaju, reviziji i uvjetima.
- ESP32-S3 C++ izvodi spremljeni izvor kroz izolirani Clang 19.1.7 / Binaryen 120 i funkcionalni WASM profil. Ulazni učenikov artefakt ne određuje bodove.
- **24/268 podržanih kombinacija**, šest obitelji na sva četiri cilja. Stare rubrike i predaje ostaju sačuvane; uvodne V1–V5 i dalje imaju samo lokalnu provjeru.
- [Opseg, dokazi, instalacija i ograničenja](docs/stage24ab-contract.md).

## Sačuvano iz 23I

- [Obrazac školskog pilota](https://zljix.github.io/labosv2/school-pilot.html): 14 provjera, mjerenja, JSON izvoz i siguran nastavak zapisa.
- Razvojni pokus s 30 učenika i jednim nastavnikom: tri vala po 30 spremanja, pregled svakih 5 s, drugo računalo, zastarjela revizija i 30 zaključanih predaja.
- Dva privatna provjeravača neovisno izvršavaju završne snimke; bodovi, izvori i hashovi uspoređuju se s nastavničkim pregledom i izvozom.
- Usklađene oznake izdanja i ispravljena HTTPS provjera koja je još očekivala 23B.
- [Postupak, mjere i otvoreni školski prihvat](docs/stage23i-pilot.md). Razvojni rezultat ne proglašava stvarni školski pilot dovršenim.

## Sačuvano iz 23H

- Postignuća po razredu, učeniku i dodjeli: zaseban aktualni rad i zaključana predaja za evidenciju.
- Cijeli odabir u CSV-u te projektni ZIP-ovi s izvorima, sklopovima, oba radio čvora i početnim medijima.
- Komentari i nastavničke korekcije uz točnu reviziju, razlog, autora i vrijeme; automatski rezultat ostaje čitljiv.
- Zabilježeni izbor druge zaključane predaje i povrat na posljednju predaju.
- Arhiviranje školske godine, konfigurabilno CLI čuvanje međurevizija, privatne dosljedne kopije i transakcijski povrat u praznu bazu.
- Migracija 007; [postupak, granice i provjere 23H](docs/stage23h-reports-administration.md).

## Sačuvano iz 23G

- [Pregled podrške bodovanja](https://zljix.github.io/labosv2/school-grading.html) s pretragom i filtrima po obitelji, cilju i statusu te CSV/JSON registrom svih **268 kombinacija**.
- **18 podržanih kombinacija**: šest rubrika na MicroPython S3, Uno i Nano. Dodane su LED 250/750 ms, LM35 i BMP180; ranije tri rubrike ostaju sačuvane.
- Preostalih **250 kombinacija** ima jasno objašnjenje nepodržanog službenog bodovanja i pripremne kriterije. V1–V5 vode se zasebno s lokalnim provjerama.
- Katalog pri objavi prikazuje podršku za svaki cilj. Dodijeljena vježba pokazuje je li službena provjera stvarno uključena.
- Postojeće inačice rubrika `23E.1` ostaju izvršive; nove koriste `23G.1`. Nema nove migracije ni prepisivanja ranijih predaja.
- [Opseg, postupak nadogradnje i provjere 23G](docs/stage23g-grading-matrix.md).

## Sačuvano iz 23F

- **Završi i zaključaj vježbu** dovršava autosave i prikazuje završni sažetak točne revizije, bodove i neostvarene kriterije.
- Jedna transakcijska predaja po pokušaju; dva klika ili izgubljeni odgovor ne stvaraju duplikate. Kasno spremanje ne mijenja zaključanu snimku.
- Bodovanje može završiti nakon zaključavanja. Rezultat ostaje uz izvorni rad i ne prelazi na novu doradu.
- Nastavnik uz razlog dopušta **novi povezani pokušaj**. Prethodna predaja i njezini bodovi ostaju sačuvani.
- Učenik i nastavnik pregledavaju povijest pokušaja. Pregled razreda odvojeno prikazuje aktualni rad i posljednju zaključanu predaju.
- Migracija 006 i paket za nadogradnju s 23E. [Postupak, provjere i granice 23F](docs/stage23f-submissions.md).

## Sačuvano iz 23E

- Tri izričito odabrane automatske rubrike: **tipkalo → LED**, **analogni prag → LED** i **BMP280 I2C**; MicroPython S3 te Uno/Nano C++.
- Neovisno izvođenje spremljene snimke, red poslova i potvrđeni bodovi po kriteriju. Novi Arduino izvor prevodi se u izoliranom lokalnom alatu.
- Učenik vidi bodove uz točnu reviziju; nastavnik ih vidi u pregledu razreda i povijesti snimki. Zakašnjeli rezultat ne mijenja bodove novijeg rada.
- Tehnička pogreška, čekanje i nepodržana provjera čuvaju prazne bodove. Stare opisne rubrike ne mijenjaju se.
- Analogni pilot ima zasebne upute za digitalni prag; početni PWM program treba prilagoditi. Zaključavanje i dopuštena dorada dostupni su u 23F.

[Upute za uključivanje provjeravača](school/README.md#23e--automatsko-bodovanje-pilota) · [Podrška, dokazi i granice 23E](docs/stage23e-grading.md)

## Što je izvedeno u 23D

- Učenik otvara ili nastavlja isti poslužiteljski pokušaj dodijeljene vježbe. Drugo računalo dobiva posljednju potvrđenu snimku.
- Automatsko spremanje nakon 3 sekunde mirovanja i najkasnije nakon 15 sekundi neprekinutog uređivanja. Status jasno razlikuje lokalne izmjene, slanje i potvrđenu reviziju.
- Nepromjenjive radne revizije čuvaju izvor, sklop, odgovore, početne medije i oba radio čvora. Ponovljeni isti zahtjev ne stvara novu reviziju.
- Dvije kartice ili uređaji ne prepisuju noviju reviziju. Sukob otvara usporedbu; učenik izričito odabire poslužiteljsku ili svoju lokalnu verziju. Ranije snimke ostaju dostupne.
- **Pregled razreda → Školski pregled rada** dohvaća učenike i stanja odabrane vježbe svakih 5 sekundi, uključujući nezapočete radove, vrijeme spremanja i reviziju.
- Nastavnik čita izvore, odgovore, veze i povijest bez pokretanja koda. Za pokus otvara zasebnu lokalnu kopiju koja ne može promijeniti učenički pokušaj.
- Migracija 004 i paket za nadogradnju s 23C. Popravljen je i prijenos praznih objekata svojstava u starijim zamrznutim predlošcima.

Prijava, uloge, razredi, CSV uvoz, pozivni kodovi i nepromjenjive inačice zadataka iz 23B/23C ostaju dostupni. Prava se ponovno provjeravaju svakim zahtjevom. Objavljeni planirani maksimum rubrike nije osvojeni broj bodova.

## Sačuvani temelj 23A

- Paket za Apache s javnim `web/` korijenom, privatnom konfiguracijom i CLI inventurom.
- Stvarna provjera PHP/PDO/MySQL preduvjeta, InnoDB-a, utf8mb4 i ograničenih ovlasti.
- Odvojeno izvršavanje jednog MicroPython i jednog AVR tipkalo/LED zadatka, uz ponovno prevođenje novog Arduino izvora.
- Probna rubrika na temelju ponašanja sklopa, zanemarivanje klijentskih bodova i odbijanje zastarjelih programa.
- Školska statusna stranica, zasebna Pages putanja i automatska izgradnja školskog ZIP-a u Actions.
- Odvojena lokalna pohrana v2; izvorni projekti labosa prenose se izričitim ZIP/JSON uvozom.

**386/386 ciljanih testova**, **6/6 neovisnih compiler/runtime pokusa** i **4/4 skupne HTTPS provjere**; svih 191 web resursa provjereno je bajtno na Apacheu. Stari ZIP iz 22I ponovno se otvara i izvodi. [Točne inačice, granice i otvorene provjere](docs/stage23a-school.md).

Središnje spremanje dodijeljenih vježbi i nastavnički pregled sada su dostupni na školskom poslužitelju. Službeni bodovi dostupni su za svih 67 URS varijanti na sva četiri cilja (268 kombinacija); zaključavanje i dopuštena dorada dostupni su u 23F. Probni rezultati 23A zadržavaju oznaku `feasibility-only`. GitHub Pages služi web simulator i javni prikaz školskog izdanja; prijava zahtijeva školski PHP/MySQL poslužitelj.

## Pokretanje i izgradnja

Gotova korijenska aplikacija u `dist/` pokreće se uz Node.js 22+:

```sh
node start-local.mjs
```

Otvori http://127.0.0.1:4173/. Windows: `Pokreni.cmd`. Učenički projekti spremaju se u pregledniku; pri prelasku s labos na labosv2 prenesi rad ZIP/JSON izvozom.

Za razvoj i školski paket koristi Node.js 24 LTS:

```sh
npm ci
npm run build:school
```

Školski paket: `release/Labosv2_0.14.14_24P_Skolski.zip`. GitHub Actions objavljuje ga kao artefakt **Labosv2-24P-Paket-za-pregled**. Apache smije posluživati samo `web/` iz tog paketa. [Linux, Windows, privatna konfiguracija, migracije i početni administrator](school/README.md).

```sh
npm run build:pages
npm run test:pages
```

Pages izgradnja koristi `/labosv2/`; obična i školska izgradnja koriste `/`. Za Pages u postavkama repozitorija odaberi **Settings → Pages → Source: GitHub Actions**. PHP se ne izvršava na Pagesu.

## Provjere i nastavak razvoja

```sh
npm run build:school-grader
npm run test:school
npm run test:school-package
npm run test:school-catalog
npm run test:school-events
npm run test:school-events-api
npm run test:school-levels
npm run test:school-levels-api
npm run test:school-sensors
npm run test:school-sensors-api
npm run test:school-coverage
npm run test:school-grading-expanded
npm run test:school-sync
npm run test:school-finish-ui
npm run test:school-submissions
npm run test:school-reports
npm run test:school-reports-api
npm run test:routing
npm test
```

`npm run test:school-accounts` dodatno koristi stvarni PHP i praznu zasebnu MySQL bazu `labosv2_test_*` s ograničenim računom. Potrebne testne varijable i postupak opisani su u školskim uputama. `test:school-work` i `test:school-work-ui` provjeravaju i API te stvarne React komponente uz zasebne prazne baze. Iste provjere pokreću se u Actionsu uz vlastiti MySQL servis; testna baza nikada nije školska evidencija.

Neovisna provjera traži Linux, Bubblewrap i dopuštene korisničke prostore. Za potpuno novi AVR izvor treba unaprijed pripremljeni zaključani alatni lanac; postupak je u školskim uputama. Nema nesigurnog zamjenskog izvođenja bez izolacije. Privatni radnik 23E koristi ograničenje virtualnog adresnog prostora po procesu. Ukupni cgroup limit i školsko opterećenje ostaju provjere prije stvarnog učeničkog pilota.

Dosadašnjih 18 URS tema, 67 varijanti po cilju i 268 kombinacija ostaje u simulatoru. Probno bodovanje 23A ne znači da je svih 268 kombinacija službeno vrednovano. Izvorne LV1/LV2 i V1–V5 ostaju zasebne.

[Ranije razvojne etape i upute](docs/history-before-labosv2.md). MIT licencija za aplikaciju; licence vanjskih jezgri i biblioteka sačuvane su u projektu.
