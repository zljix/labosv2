# Etapa 23A · školski paket i dokaz izvedivosti

Izdanje **0.13.0-beta.1**, 15. studenoga 2026. Objave školskih dorada koriste **zljix/labosv2**. Polazište je aktualni labos **3c4a281c10282d63b2742280f69aadbc08d7ae1e / 0.12.9-beta.1**. Uključene su posljednje dorade vodova; izvorni labos ostaje zaseban projekt.

## Rezultat

Pripremljen je paket s jedinim javnim korijenom `web/`, odvojenom privatnom konfiguracijom, CLI inventurom, Apache HTTPS predloškom, provjerenim MIME postavkama, izdvojenim provjeravačem i inventarom SHA-256 datoteka. Verzija, školska stranica i GitHub Pages izgradnja koriste labosv2. IndexedDB, oporavak i Arduino predmemorija imaju zasebne v2 nazive: izvorni radovi labosa ne čitaju se niti prepisuju pri automatskom spremanju. Prijenos je izričit ZIP/JSON uvoz. Školska stranica provjerava postojeći MicroPython WASM i Worker na uređaju.

Pregledana je stvarna struktura `src/project/model.ts`, `src/project/archive.ts`, `src/circuit/compile.ts`, `src/runtime/avrEngine.ts`, `public/worker.mjs`, `public/session.mjs`, `public/machine.py`, compiler ugovor i `scripts/avr-compile.mjs`. Nema obvezne ovisnosti runtimea o prijašnjem hostingu: potrebni su vlastiti HTTP(S) resursi, ispravne putanje i postojeći lokalni compiler most za novi korisnički C++ izvor. Trenutačni runtime ne koristi SharedArrayBuffer/Atomics. Postojeći upareni prozor mosta razlog je da se COOP/COEP ne dodaju bez potrebe.

## Dokazi iz ove etape

| Provjera | Stvarni rezultat | Dokaz |
| --- | --- | --- |
| Ciljana regresija | **386/386**, bez preskakanja | `stage23a-evidence/regression.tap` |
| Neovisna provjera programa | **6/6**: dva MicroPython točna izvora, MicroPython pogreška ponašanja, katalogski AVR, novi točan AVR izvor, novi pogrešan AVR izvor | `stage23a-evidence/grading.json` i šest snimki projekta |
| Ispravni programi | **10/10** | Izmjerena LED struja kroz pet promjena ulaza |
| Trajno ugašena LED | **2/10**, ne prolazi kriterije reakcije | Lažni tekst bodova/LED stanja ne utječe na rezultat |
| HTTPS Apache/PHP isporuka | **4/4** skupne provjere, svih **191** resursa bajtno provjereno | `stage23a-evidence/https-host.json` |
| Stvarni MySQL preko PDO-a | MySQL **8.4.7**, InnoDB DEFAULT, utf8mb4, ograničen aplikacijski račun; sve navedene provjere prolaze | `stage23a-evidence/preflight.json` |
| Negativna inventura | root račun odbijen; nedostatna konfiguracija odbijena; izlazni kod 2 | `preflight-root-rejected.json`, `preflight-missing-config.json` |
| Stari projekt | Stvarni `stage22i-evidence/browser-reviewed.zip` ponovno uvezen, ZIP sadržaj očuvan i izvorni AVR program stvarno izveden | Jedan od 386 regresijskih testova |
| Izolacija | Nema mreže, host datoteka, naslijeđene lozinke ili podprocesa runtimea; beskonačna petlja prekinuta; nema zamjenskog izvođenja bez izolacije | Deset školskih testova uključeno je u ukupan broj 386 |

Brojevi se ne zbrajaju kao da predstavljaju nepovezane jedinstvene testove. Deset školskih testova već je u broju 386. Tri provjere odvajanja stare i nove pohrane također su uključene u broj 386. Šest dokaza prevoditelja i četiri skupne HTTPS provjere navode se zasebno zbog drukčijeg opsega. Ovo nije nova cjelovita regresija svih prethodnih senzora, fizički pokus ni učenički pilot.

## Stvarno ispitano okruženje

Linux x86_64 / Debian 13 u razvojnom kontejneru, Node **24.22.1**, Apache **2.4.69**, PHP **8.4.27**, MySQL Community Server **8.4.7**, Arduino CLI **1.3.1**, AVR core **1.8.6**, AVR GCC **7.3.0-atmel3.6.1-arduino7**. Poslužitelji nisu zamijenjeni simuliranim HTTP/PDO objektima. Testni HTTPS koristi vlastiti privremeni certifikat, koji Node test izričito smatra pouzdanim; time nije potvrđen školski DNS/certifikat na učeničkim uređajima.

MySQL test koristi praznu sintetsku bazu i namjenski ograničen račun. Izvještaji ne sadržavaju vjerodajnice. Točna stanja okruženja i vrijeme čuva CLI inventura. Starija MySQL zakrpa služi razvojnome dokazu; školska instalacija treba aktualnu sigurnosnu zakrpu odabrane LTS grane.

## Kako neovisna provjera radi

Provjeravač prima parsirani projekt, povezuje hash snimke s revizijom, rubrikom i hashom provjeravača/runtimea te izvodi program odvojeno od učenikova sučelja. MicroPython koristi postojeću WASM jezgru, AVR koristi postojeći AVR8js nad stvarnim HEX-om. Sklop prolazi postojeću provjeru prije pokusa. Nema uspoređivanja izvornog teksta s jednim predloškom.

Za AVR se poslani učenikov artefakt ignorira. Katalogski put zahtijeva potpuno jednak hash izvora, cilja i biblioteka iz pouzdanog paketa. Izmijenjeni izvor bez compiler puta vraća `unsupported` i `points: null`. `--compile` ponovno prevodi izvor unutar zasebnog izoliranog procesa; novi točan i novi pogrešan izvor stvarno su prevedeni u ovoj etapi. Pomoćni CLI alati evidentirani su u `cli-helper-tools.json`.

Rezultati imaju autoritet **`feasibility-only`**. Tehnička nedostupnost i ograničenje izvođenja imaju zaseban status i `points: null`. Sintaksna pogreška je pogreška programa. Probna rubrika 2+5+3 bodova odnosi se samo na tipkalo i LED, a ne na sve URS teme; namjerno ne mijenja kasniji plan triju pilot-vježbi iz 23E.

Linux user/network/mount/PID izolacija ima ulaze samo za čitanje, prazno okruženje i praznu mrežu. Runtime nema bazu ni privatnu školsku konfiguraciju. Postoje ograničenja vremena, izlaza, V8 i MicroPython heapa te privremenog prostora. **Ukupnu nativnu/WASM memoriju još treba ograničiti cgroupom ili ekvivalentom prije javnog servisa.** CLI dokaz nije izložen kroz PHP. Windows put za provjeravač vraća nedostupnost, bez nesigurnog zaobilaznog puta.

## Čista izgradnja i paket

Čista izgradnja dodatno je provjerena bez ranije generiranog direktorija provjeravača. Testovi sada uvoze izvor, a školska izgradnja prvo priprema izvršne adaptere. Deset ponovljenih školskih testova prolazi; ponavljanje se ne dodaje broju 386. Pages putanja `/labosv2/` prošla je svojih osam provjera resursa i offline opsega.

Raspakirani školski paket sadrži 447 datoteka obuhvaćenih inventarom. Njihove veličine i hashovi provjereni su u ZIP-u, a MicroPython i AVR provjera rade i iz paketa. Izolacija zahtijeva Bubblewrap najmanje 0.8; razvoj i CI zaključani su na 0.12.0, jer Ubuntu 22.04 paket 0.6.1 nema traženo ograničenje privremenog prostora. Ograničenje nije uklonjeno radi prolaza provjere.

## Granica prihvata i nastavak

Razvojni kriterij 23A potvrđen je za navedeni Linux profil: stari se projekt otvara, reference se izvršavaju, Apache/PHP/MySQL su stvarno pokrenuti i neovisni MicroPython/AVR pokusi daju očekivane rezultate. Paket i upute spremni su za provjeru na školskom poslužitelju.

Otvorene su stvarna školska instalacija i HTTPS povjerenje iz učionice, Windows, ciljani mobilni preglednici, hladni offline pilot, ukupan memorijski limit i opterećenje razreda. Javno izdanje dodatno je pregledano u Chromeu: izgradnja `236ffd9db4f8f63c`, uspješna MicroPython WASM/Worker provjera, pokretanje tipkalo/LED primjera, odziv LED-ice 0 → 88 → 0 posto pri pritisku i otpuštanju te uspješan Stop. Zapis je u `stage23a-evidence/browser-public.json`. Time nije potvrđen školski LAN ili mobilni preglednik.

Sljedeća etapa je **23B**: verzionirane MySQL migracije, stvaranje prvog administratora, prijava/odjava, lozinke i uloge. Postojeći lokalni identitet iz uvezene predaje ne postaje prijavljeni školski korisnik. Predaje, revizije i radni modeli ostaju odvojeni od buduće službene evidencije; još nema registracije, sinkronizacije ili zaključavanja.

Instalacijski postupak, profil i službeni tehnički izvori: [school/README.md](../school/README.md). Ranija dokumentacija sačuvana je u [history-before-labosv2.md](history-before-labosv2.md).
