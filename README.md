# Labosv2 · školski laboratorij

**0.14.4-beta.1 · etapa 24F · relej, zvuk, servo i DC motori · 16. studenoga 2026.**

Prethodna 23F PHP/MySQL integracija prošla je u [GitHub Actionsu](https://github.com/zljix/labosv2/actions/runs/43738711916). Provjere izvještaja i administracije vode se zasebno u [izvješću 23H](docs/stage23h-reports-administration.md).

Nastavak postojećeg ESP32 MicroPython / Arduino laboratorija za školski sustav s PHP-om i stvarnim MySQL-om. Polazište je [labos 0.12.9](https://github.com/zljix/labos/tree/3c4a281c10282d63b2742280f69aadbc08d7ae1e), uključujući posljednje dorade vodova.

[Web laboratorij](https://zljix.github.io/labosv2/) · [Školski račun](https://zljix.github.io/labosv2/school.html#account) · [Upute za instalaciju](school/README.md) · [Bodovanje i dokazi 23E](docs/stage23e-grading.md)

## Novo u 24F

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

Središnje spremanje dodijeljenih vježbi i nastavnički pregled sada su dostupni na školskom poslužitelju. Službeni bodovi dostupni su za 33 URS varijante na sva četiri cilja (132 kombinacije); zaključavanje i dopuštena dorada dostupni su u 23F. Probni rezultati 23A zadržavaju oznaku `feasibility-only`. GitHub Pages služi web simulator i javni prikaz školskog izdanja; prijava zahtijeva školski PHP/MySQL poslužitelj.

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

Školski paket: `release/Labosv2_0.14.4_24F_Skolski.zip`. GitHub Actions objavljuje ga kao artefakt **Labosv2-24F-Skolski-paket**. Apache smije posluživati samo `web/` iz tog paketa. [Linux, Windows, privatna konfiguracija, migracije i početni administrator](school/README.md).

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
