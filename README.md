# Labosv2 · školski laboratorij

**0.13.2-beta.1 · etapa 23C · 15. studenoga 2026.**

Nastavak postojećeg ESP32 MicroPython / Arduino laboratorija za školski sustav s PHP-om i stvarnim MySQL-om. Polazište je [labos 0.12.9](https://github.com/zljix/labos/tree/3c4a281c10282d63b2742280f69aadbc08d7ae1e), uključujući posljednje dorade vodova.

[Web laboratorij](https://zljix.github.io/labosv2/) · [Školski račun](https://zljix.github.io/labosv2/school.html#account) · [Upute za instalaciju](school/README.md) · [Dokazi etape 23C](docs/stage23c-classes.md)

## Što je izvedeno u 23C

- Školske godine i razredi, nastavnikovo stvaranje vlastitog razreda i administratorska dodjela nastavnika.
- CSV uvoz učenika s prethodnim pregledom, provjerom identiteta postojećih računa i potvrdom povezivanja.
- Vremenski ograničen pozivni kod, registracija učenika i nastavničko prihvaćanje ili odbijanje članstva.
- Nepromjenjive inačice uputa, kriterija i početnih projekata za postojećih 67 URS varijanti i 268 ciljeva.
- Dodjela točne inačice razredu uz odabranu pločicu/jezik, opcionalni rok i upravljanje dostupnošću.
- Učenikov pregled vlastitih vježbi, kriterija i otvaranje zasebne lokalne kopije u simulatoru.

Računi, prijava, obvezna promjena privremene lozinke, ovlasti i revizijski zapisi iz 23B ostaju sačuvani. Učenik pristupa samo dostupnim dodjelama potvrđenih razreda; nastavnik samo svojim razredima. Nova rubrika ili nadogradnja kataloga ne mijenjaju ranije objavljene inačice. Planirani maksimum rubrike nije osvojeni ni službeni broj bodova.

## Sačuvani temelj 23A

- Paket za Apache s javnim `web/` korijenom, privatnom konfiguracijom i CLI inventurom.
- Stvarna provjera PHP/PDO/MySQL preduvjeta, InnoDB-a, utf8mb4 i ograničenih ovlasti.
- Odvojeno izvršavanje jednog MicroPython i jednog AVR tipkalo/LED zadatka, uz ponovno prevođenje novog Arduino izvora.
- Probna rubrika na temelju ponašanja sklopa, zanemarivanje klijentskih bodova i odbijanje zastarjelih programa.
- Školska statusna stranica, zasebna Pages putanja i automatska izgradnja školskog ZIP-a u Actions.
- Odvojena lokalna pohrana v2; izvorni projekti labosa prenose se izričitim ZIP/JSON uvozom.

**386/386 ciljanih testova**, **6/6 neovisnih compiler/runtime pokusa** i **4/4 skupne HTTPS provjere**; svih 191 web resursa provjereno je bajtno na Apacheu. Stari ZIP iz 22I ponovno se otvara i izvodi. [Točne inačice, granice i otvorene provjere](docs/stage23a-school.md).

Središnje spremanje projekata, službeni bodovi i zaključavanje još nisu dostupni. Probni rezultati zadržavaju oznaku `feasibility-only`. Slijedi 23D: središnje spremanje i nastavnički pregled rada. GitHub Pages služi web simulator i javni prikaz školskog izdanja; prijava zahtijeva školski PHP/MySQL poslužitelj.

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

Školski paket: `release/Labosv2_0.13.2_23C_Skolski.zip`. GitHub Actions objavljuje ga kao artefakt **Labosv2-23C-Skolski-paket**. Apache smije posluživati samo `web/` iz tog paketa. [Linux, Windows, privatna konfiguracija, migracije i početni administrator](school/README.md).

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
npm run test:routing
npm test
```

`npm run test:school-accounts` dodatno koristi stvarni PHP i praznu zasebnu MySQL bazu `labosv2_test_*` s ograničenim računom. Potrebne testne varijable i postupak opisani su u školskim uputama. Ista provjera pokreće se u Actionsu uz vlastiti MySQL servis; testna baza nikada nije školska evidencija.

Neovisna provjera traži Linux, Bubblewrap i dopuštene korisničke prostore. Za potpuno novi AVR izvor treba unaprijed pripremljeni zaključani alatni lanac; postupak je u školskim uputama. Nema nesigurnog zamjenskog izvođenja bez izolacije. Ukupni memorijski limit i javni servis provjere dolaze prije stvarnog učeničkog pilota.

Dosadašnjih 18 URS tema, 67 varijanti po cilju i 268 kombinacija ostaje u simulatoru. Probno bodovanje 23A ne znači da je svih 268 kombinacija službeno vrednovano. Izvorne LV1/LV2 i V1–V5 ostaju zasebne.

[Ranije razvojne etape i upute](docs/history-before-labosv2.md). MIT licencija za aplikaciju; licence vanjskih jezgri i biblioteka sačuvane su u projektu.
