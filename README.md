# Labosv2 · školski laboratorij

**0.13.1-beta.1 · etapa 23B · 15. studenoga 2026.**

Nastavak postojećeg ESP32 MicroPython / Arduino laboratorija za školski sustav s PHP-om i stvarnim MySQL-om. Polazište je [labos 0.12.9](https://github.com/zljix/labos/tree/3c4a281c10282d63b2742280f69aadbc08d7ae1e), uključujući posljednje dorade vodova.

[Web laboratorij](https://zljix.github.io/labosv2/) · [Školski račun](https://zljix.github.io/labosv2/school.html#account) · [Upute za instalaciju](school/README.md) · [Dokazi etape 23B](docs/stage23b-accounts.md)

## Što je izvedeno u 23B

- Verzionirane MySQL migracije s provjerom izmjena, ponovljivim pokretanjem i zaključavanjem.
- Jednokratna privatna aktivacija administratora bez zadane lozinke ili web instalacijskog računa.
- Prijava/odjava, uloge učenik/nastavnik/administrator, stvaranje i deaktivacija računa.
- Obvezna promjena privremene lozinke, vlastita promjena i nastavnički reset za učenike dodijeljenog razreda.
- Opoziv sesija nakon promjene lozinke, uloge ili aktivnosti; CSRF i trajno ograničenje pokušaja prijave.
- Portal računa i poveznica iz simulatora; zapis promjena bez lozinki i tokena.

Nastavnik bez dodijeljenog razreda nema pristup svim školskim učenicima. Temeljne tablice članstva sada postoje radi provjere prava; upravljanje razredima i dodjele kroz sučelje dolaze u 23C. Prijavljeni račun u ovoj etapi još nije povezan s lokalnim projektima.

## Sačuvani temelj 23A

- Paket za Apache s javnim `web/` korijenom, privatnom konfiguracijom i CLI inventurom.
- Stvarna provjera PHP/PDO/MySQL preduvjeta, InnoDB-a, utf8mb4 i ograničenih ovlasti.
- Odvojeno izvršavanje jednog MicroPython i jednog AVR tipkalo/LED zadatka, uz ponovno prevođenje novog Arduino izvora.
- Probna rubrika na temelju ponašanja sklopa, zanemarivanje klijentskih bodova i odbijanje zastarjelih programa.
- Školska statusna stranica, zasebna Pages putanja i automatska izgradnja školskog ZIP-a u Actions.
- Odvojena lokalna pohrana v2; izvorni projekti labosa prenose se izričitim ZIP/JSON uvozom.

**386/386 ciljanih testova**, **6/6 neovisnih compiler/runtime pokusa** i **4/4 skupne HTTPS provjere**; svih 191 web resursa provjereno je bajtno na Apacheu. Stari ZIP iz 22I ponovno se otvara i izvodi. [Točne inačice, granice i otvorene provjere](docs/stage23a-school.md).

Središnje spremanje projekata, službeni bodovi i zaključavanje još nisu dostupni. Probni rezultati zadržavaju oznaku `feasibility-only`. Slijedi 23C: razredi i dodijeljene vježbe. GitHub Pages služi web simulator i javni prikaz školskog izdanja; prijava zahtijeva školski PHP/MySQL poslužitelj.

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

Školski paket: `release/Labosv2_0.13.1_23B_Skolski.zip`. GitHub Actions objavljuje ga kao artefakt **Labosv2-23B-Skolski-paket**. Apache smije posluživati samo `web/` iz tog paketa. [Linux, Windows, privatna konfiguracija, migracije i početni administrator](school/README.md).

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
npm run test:routing
npm test
```

`npm run test:school-accounts` dodatno koristi stvarni PHP i praznu zasebnu MySQL bazu `labosv2_test_*` s ograničenim računom. Potrebne testne varijable i postupak opisani su u školskim uputama. Ista provjera pokreće se u Actionsu uz vlastiti MySQL servis; testna baza nikada nije školska evidencija.

Neovisna provjera traži Linux, Bubblewrap i dopuštene korisničke prostore. Za potpuno novi AVR izvor treba unaprijed pripremljeni zaključani alatni lanac; postupak je u školskim uputama. Nema nesigurnog zamjenskog izvođenja bez izolacije. Ukupni memorijski limit i javni servis provjere dolaze prije stvarnog učeničkog pilota.

Dosadašnjih 18 URS tema, 67 varijanti po cilju i 268 kombinacija ostaje u simulatoru. Probno bodovanje 23A ne znači da je svih 268 kombinacija službeno vrednovano. Izvorne LV1/LV2 i V1–V5 ostaju zasebne.

[Ranije razvojne etape i upute](docs/history-before-labosv2.md). MIT licencija za aplikaciju; licence vanjskih jezgri i biblioteka sačuvane su u projektu.
