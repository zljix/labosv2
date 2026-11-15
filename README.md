# Labosv2 · školski laboratorij

**0.13.5-beta.1 · etapa 23F · 15. studenoga 2026.**

PHP/MySQL integracija i cjelovit React tijek prošli su u [GitHub Actionsu](https://github.com/zljix/labosv2/actions/runs/43738711916).

Nastavak postojećeg ESP32 MicroPython / Arduino laboratorija za školski sustav s PHP-om i stvarnim MySQL-om. Polazište je [labos 0.12.9](https://github.com/zljix/labos/tree/3c4a281c10282d63b2742280f69aadbc08d7ae1e), uključujući posljednje dorade vodova.

[Web laboratorij](https://zljix.github.io/labosv2/) · [Školski račun](https://zljix.github.io/labosv2/school.html#account) · [Upute za instalaciju](school/README.md) · [Bodovanje i dokazi 23E](docs/stage23e-grading.md)

## Novo u 23F

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

Središnje spremanje dodijeljenih vježbi i nastavnički pregled sada su dostupni na školskom poslužitelju. Službeni bodovi za tri izričito odabrana pilota dostupni su u 23E; zaključavanje i dopuštena dorada dostupni su u 23F. Probni rezultati 23A zadržavaju oznaku `feasibility-only`. GitHub Pages služi web simulator i javni prikaz školskog izdanja; prijava zahtijeva školski PHP/MySQL poslužitelj.

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

Školski paket: `release/Labosv2_0.13.5_23F_Skolski.zip`. GitHub Actions objavljuje ga kao artefakt **Labosv2-23F-Skolski-paket**. Apache smije posluživati samo `web/` iz tog paketa. [Linux, Windows, privatna konfiguracija, migracije i početni administrator](school/README.md).

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
npm run test:school-sync
npm run test:school-finish-ui
npm run test:school-submissions
npm run test:routing
npm test
```

`npm run test:school-accounts` dodatno koristi stvarni PHP i praznu zasebnu MySQL bazu `labosv2_test_*` s ograničenim računom. Potrebne testne varijable i postupak opisani su u školskim uputama. `test:school-work` i `test:school-work-ui` provjeravaju i API te stvarne React komponente uz zasebne prazne baze. Iste provjere pokreću se u Actionsu uz vlastiti MySQL servis; testna baza nikada nije školska evidencija.

Neovisna provjera traži Linux, Bubblewrap i dopuštene korisničke prostore. Za potpuno novi AVR izvor treba unaprijed pripremljeni zaključani alatni lanac; postupak je u školskim uputama. Nema nesigurnog zamjenskog izvođenja bez izolacije. Privatni radnik 23E koristi ograničenje virtualnog adresnog prostora po procesu. Ukupni cgroup limit i školsko opterećenje ostaju provjere prije stvarnog učeničkog pilota.

Dosadašnjih 18 URS tema, 67 varijanti po cilju i 268 kombinacija ostaje u simulatoru. Probno bodovanje 23A ne znači da je svih 268 kombinacija službeno vrednovano. Izvorne LV1/LV2 i V1–V5 ostaju zasebne.

[Ranije razvojne etape i upute](docs/history-before-labosv2.md). MIT licencija za aplikaciju; licence vanjskih jezgri i biblioteka sačuvane su u projektu.
