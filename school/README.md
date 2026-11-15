# Labosv2 · školski paket · etapa 23B

Etapa 23A priprema postojeći laboratorij za školski Apache/PHP/MySQL smjer i dokazuje ponovno izvršavanje izvan učenikova preglednika. Polazište je `zljix/labos@3c4a281` (0.12.9), uključujući posljednju doradu vodova. Ovaj razvoj objavljuje se u `zljix/labosv2`.

**Dostupno:** simulator, postojeći projekti i izvozi, školski paket, PHP provjera preduvjeta, MySQL migracije, početni administrator, prijava/odjava, uloge, upravljanje računima i lozinkama te raniji ograničeni dokaz tipkala/LED-ice. **Središnja pohrana projekata, službeni bodovi i zaključavanje još nisu uključeni.** Slijede 23C–23F. Izvorni plan od 14. 11. 2026. zadržan je.

## Izgradnja

Node.js 24 LTS, `npm ci`, zatim:

```sh
npm run build:school
```

Nastaje `release/Labosv2_0.13.1_23B_Skolski.zip` i raspakirani `.build/school-package/`. Paket sadrži:

| Mapa | Namjena |
| --- | --- |
| `web/` | Jedini javni web-korijen: laboratorij, portal računa, resursi i PHP API. |
| `app/`, `migrations/` | Privatni PHP kod i verzionirane SQL migracije; nikada nisu web-korijen. |
| `config/` | Primjer privatne konfiguracije bez ugrađene lozinke. |
| `tools/` | CLI inventura te migracije i jednokratno stvaranje administratora. |
| `apache/` | Predložak HTTPS virtualnog poslužitelja. |
| `checker/` | Zaseban CLI dokaz izvršavanja; nema javne HTTP rute. |
| `package-inventory.json` | Veličina i SHA-256 svake datoteke isporuke. |

Za GitHub Pages koristi `npm run build:pages`. Zadana putanja je `/labosv2/`, a workflow preuzima ime repozitorija. GitHub Pages služi web simulator; školski PHP/MySQL pokreću se na školskom poslužitelju. Korijenski školski paket i Pages paket ne kopiraju se jedan preko drugoga.

## Preduvjeti za poslužitelj

Apache 2.4, podržani PHP 8.4 ili 8.5 s aktualnim zakrpama i proširenjima `pdo_mysql`, `json`, `session`; stvarni **MySQL 8.4 LTS**, InnoDB i utf8mb4. Točne instalirane zakrpe bilježi inventura. Node 24 i izolirani Linux servis trebaju samo računalu koje izvršava provjere, ne učeničkim uređajima.

XAMPP isporučuje MariaDB. Za ovaj projekt odabrana je zasebna instalacija stvarnog MySQL-a; oznaka MySQL u XAMPP upravljačkoj ploči nije dovoljan dokaz. Provjera odbija MariaDB. Ako se koristi XAMPP, Apache/PHP moraju također zadovoljiti odabrani profil; stariji ugrađeni PHP ne prihvaća se prešutno.

Prije uporabe zabilježi OS, CPU, RAM, slobodni disk, školski URL, LAN pristup, inačicu Apachea, PHP-a i MySQL-a. Inventura čita dio podataka automatski; Windows CPU/RAM i stvarni pristup iz učionice dopunjuju se nakon mjerenja. Rezultat razvojnog kontejnera nije potvrda školskog računala.

## Instalacija na Linuxu

1. Raspakiraj paket u `/srv/labosv2`. Apache smije posluživati samo `/srv/labosv2/web`.
2. U školskom DNS-u odredi vlastitu adresu, npr. `labos.skola.example`. Pripremi HTTPS certifikat kojem vjeruju učenički uređaji.
3. Prilagodi `apache/labosv2.conf.example`: adresu, putanje certifikata, zapisnika i stvarni PHP handler. Uključi `ssl`, `mime`, `headers`, `dir` i PHP-FPM ili mod_php. Na Debianu je `${APACHE_LOG_DIR}` dio distribucijske konfiguracije; na drugim sustavima zadaj stvarnu putanju.
4. Predložak dopušta `.htaccess` u `web/`. Alternativno prenesi njegove direktive u `<Directory>` i postavi `AllowOverride None`. Pokreni `apachectl configtest`, pa ponovno učitaj servis.
5. Otvori početnu stranicu s učeničkog računala. U gornjoj oznaci inačice otvori **Školsko izdanje** i pokreni provjeru uređaja.

Posluživanje iz korijena vlastite adrese je zadani školski profil. Za namjernu podputanju izgradi s `LAB_BASE_PATH=/odabrana-putanja/`; ta se isporuka provjerava zasebno i ne koristi se kao korijenski paket.

## Instalacija na Windowsu / Apacheu

1. Raspakiraj u vlastitu mapu, npr. `C:/Labosv2`. DocumentRoot postavi na `C:/Labosv2/web`, a ne na cijeli repozitorij.
2. U Apache virtualnom poslužitelju prilagodi putanje i certifikat; Windows putanje piši s `/`. Za zapisnike zadaj stvarnu mapu umjesto `${APACHE_LOG_DIR}`. Koristi odgovarajući Windows PHP handler za 8.4/8.5.
3. Omogući iste MIME i `.htaccess` direktive. Pokreni `httpd.exe -t`, ponovno pokreni Apache i provjeri s drugog računala u učionici.
4. Instaliraj stvarni MySQL 8.4 i provedi donju inventuru. Ovaj paket ne mijenja postojeće XAMPP baze ni njihove servise.

Windows web profil je pripremljen, ali nije proglašen provjerenim dok se ne izvede na Windows računalu. Izolirani provjeravač u ovoj etapi radi samo na Linuxu; Windows školski web kasnije ga može koristiti kao zaseban servis.

## Privatna konfiguracija i inventura

Kopiraj `config/config.example.php` izvan javnog web-korijena, npr. `/srv/labosv2-private/config.php`, i upiši DSN i ograničeni aplikacijski račun. Lozinku zadaj kroz `LAB_DB_PASSWORD` ili u privatnoj, pristupom zaštićenoj konfiguraciji. Konfiguracija se ne stavlja u Git ni u `web/`.

Administrator baze priprema praznu bazu `labosv2` s utf8mb4 i korisnika koji ima ovlasti samo nad tom bazom. Aplikacija ne koristi root ni globalne administracijske ovlasti. Migracijski račun treba CREATE i potrebna prava nad tom bazom; inventura ne stvara niti briše tablice. PHP API dodatno odbija root i globalne administracijske ovlasti.

```sh
php tools/preflight.php /srv/labosv2-private/config.php
```

Izlaz je JSON; kod 0 znači da su navedeni preduvjeti potvrđeni, a 2 da nešto nedostaje. Pregledava stvarni poslužitelj preko PDO-a, razlikuje MariaDB, provjerava InnoDB, utf8mb4 i ovlasti. Ne ispisuje lozinku, DSN ni cijeli popis ovlasti. **Preflight mora ostati izvan web-korijena.** Njegov zapis može sadržavati tehnički inventar, pa ga čuvaj privatno. `api/health.php` daje samo stanje pripreme aplikacije; njegov uspjeh nije dokaz veze s bazom.

## Aktivacija računa i migracije 23B

1. U privatnoj konfiguraciji popuni `app.origin` točnom HTTPS adresom instalacije. Za namjernu podputanju uključi i nju. Adresa određuje zaštitu zahtjeva i putanju kolačića.
2. Generiraj privatni ključ naredbom `php tools/console.php key` i spremi ga u `app.key` ili u varijablu `LAB_APP_KEY`. Ne mijenjaj ga pri svakoj izgradnji. Ključ i lozinka baze ne idu u Git.
3. Izvan `web/` stvori mapu sesija, npr. `/srv/labosv2-private/sessions`. Dopusti upis samo računu pod kojim PHP radi i postavi `app.session_directory`. Na Linuxu primjer je vlasništvo PHP računa i prava 0700; na Windowsu dodijeli odgovarajući privatni ACL.
4. U PHP/Apache okruženju postavi `LAB_SCHOOL_CONFIG` na apsolutnu putanju privatne konfiguracije. Za mod_php možeš u virtualni poslužitelj dodati `SetEnv LAB_SCHOOL_CONFIG /srv/labosv2-private/config.php`; za FPM zadaj `env[LAB_SCHOOL_CONFIG] = /srv/labosv2-private/config.php` u odgovarajućem poolu i ponovno učitaj servis. CLI putanju prima izravno.
5. Primijeni migracije:

```sh
php tools/console.php migrate /srv/labosv2-private/config.php
```

Migracije ne brišu podatke. Svaka ima checksum; promjena već primijenjenog SQL-a odbija se. Zaključavanje baze sprječava dvije istodobne migracije. MySQL DDL implicitno potvrđuje transakcije, pa početne migracije koriste ponovljive `CREATE TABLE IF NOT EXISTS` naredbe i zapisuju uspjeh tek nakon svih naredbi. Prekinuta početna migracija može se ponoviti. Nema automatskog destruktivnog vraćanja.

6. U privatnoj privremenoj JSON datoteci pripremi svoj prvi račun:

```json
{"username":"admin.skola","displayName":"Administrator škole","password":"<tvoja nova osobna lozinka>"}
```

Privremenu datoteku zaštiti kao konfiguraciju i proslijedi kroz standardni ulaz, bez lozinke u argumentima naredbe:

```sh
php tools/console.php init-admin /srv/labosv2-private/config.php < /srv/labosv2-private/privatni-admin.json
```

Na Windowsu preusmjeravanje `<` pokreni u CMD-u uz vlastite putanje. Nakon uspjeha ukloni privremenu datoteku. Ne postoji zadana lozinka ni javna instalacijska ruta. Drugo pokretanje inicijalizacije nakon stvaranja korisnika odbija se; postojeći administrator stvara ostale račune u portalu.

7. Otvori **Školski račun** u laboratoriju ili `school.html`. Prijavi se prvim računom. Dodaj nastavnika i učenika, osobno im predaj privremene lozinke i provjeri prvu prijavu.

U ovoj etapi administrator stvara račune i mijenja uloge/aktivnost. Nastavnik vidi i resetira lozinke samo učenicima svojih dodijeljenih razreda; zahtjev traži i nastavnikovu trenutačnu lozinku. Temeljne tablice razreda postoje radi te provjere ovlasti. **Upravljanje razredima, dodjela nastavnika i članstva kroz sučelje dolaze u 23C.** Bez dodijeljenog razreda nastavnički je popis prazan; administrator može resetirati korisnikovu lozinku. Nema prešutnog prava na sve učenike škole.

Privremena lozinka mora se promijeniti prije korištenja upravljačkih funkcija. Lozinke imaju 12–72 bajta, obrađuju se `password_hash`/`password_verify` i nikada se ne vraćaju API-jem. Promjena/reset lozinke, deaktivacija i promjena uloge opozivaju ranije sesije preko `auth_version`. Obična odjava zatvara trenutačnu sesiju. Administrator ne može sam sebi ukinuti aktivnost ili administratorsku ulogu.

Sesije koriste HttpOnly i SameSite=Strict, HTTPS postavlja Secure, identifikator se obnavlja nakon prijave i promjene lozinke. Sesija traje do 30 minuta neaktivnosti ili najviše 8 sati. Izmjene zahtijevaju CSRF token i provjeru izvora. Ograničenje prijave čuva se u MySQL-u: do 8 pokušaja po korisničkom imenu i 120 po adresi u fiksnih 15 minuta, uključujući uspješne prijave. Nepoznat račun i pogrešna lozinka daju istu poruku. Revizijski zapis sadrži autora, cilj i vrstu promjene, bez lozinki ili sesijskih tokena.

Za isključivo lokalne razvojne pokuse postoji `app.allow_insecure_localhost=true` uz HTTP localhost/127.0.0.1; zahtjev mora stvarno doći s loopback adrese. Zadana školska postavka ostaje HTTPS. Proxy zaglavlja ne pretvaraju nešifrirani zahtjev u pouzdani HTTPS.

API računa i sesija nikada ne ulazi u offline predmemoriju. Nakon odjave privatni popisi nisu dostupni u sučelju. Lokalni simulator i njegovi već postojeći projekti još nisu povezani s prijavljenim računom; taj prijelaz pripada 23D.

### Provjera instalacije i nadogradnja

Prije nadogradnje sačuvaj bazu i privatnu konfiguraciju prema školskoj proceduri. Zamijeni programske datoteke i ponovi `migrate`; sačuvaj istu konfiguraciju, ključ i privatnu mapu sesija. Paket uključuje samo `config.example.php`, nikada lokalni `config.php`.

Regresiju računa pokreći isključivo na zasebnoj praznoj bazi `labosv2_test_*` s ograničenim testnim korisnikom. Postavi `LAB_TEST_DB_DSN`, `LAB_TEST_DB_USER`, `LAB_TEST_DB_PASSWORD` i po potrebi `PHP_BIN`, pa `npm run test:school-accounts` nakon `npm run build:school`. Test stvara sintetske račune, izvodi stvarni PHP HTTP API i PDO, provjerava migracije, ovlasti, sesije, CSRF, reset, deaktivaciju i paralelno ograničavanje prijava. Nikada mu ne zadaj školsku bazu. GitHub Actions pokreće isti scenarij uz zaseban MySQL 8.4 servis.

## Neovisni dokaz provjere programa

Dokaz 23A ispituje **jedno tipkalo i jednu LED-icu**. Ne predstavlja gotovu rubriku za sve URS vježbe. Zadržava postojeće modele sklopova i stvarnu MicroPython WASM jezgru odnosno AVR8js. U oba profila daje pritiske i otpuštanja u pet koraka te čita struju LED-ice. Tekst ispisa, broj popunjenih odgovora ili naziv naredbe nisu dokaz ponašanja.

| Kriterij probne rubrike `23A-button-led@1` | Bodovi |
| --- | ---: |
| Početno otpušteno tipkalo: ugašena LED | 2 |
| Prvi pritisak i otpuštanje ispravno mijenjaju LED | 5 |
| Ponovljeni pritisak i otpuštanje | 3 |

Svaki korak traje 200 ms virtualnog vremena, a odziv se očitava na kraju koraka. AVR napreduje ciklusima 16 MHz; MicroPython napreduje deklariranim spavanjem, uz najmanji korak 1 ms. U toj probnoj izvedbi `ticks_ms` i `ticks_us` slijede virtualni sat. Program koji se ne odrekne izvođenja ima zasebno vremensko ograničenje, bez izmišljenih bodova. Veće odgode i drugačije vremenski zahtjevne vježbe traže zaseban izvršni profil u 23E.

Probni rezultat sadrži hash cijele parsirane snimke, reviziju, cilj, rubriku, dokaze po kriteriju i hash izvora/HEX-a gdje postoji. **Autoritet je `feasibility-only`**; ne postoji školski korisnik ni službena evidencija. Hash povezuje sadržaj, a ne dokazuje autorstvo.

Linux mora imati `unshare` i Bubblewrap (`bwrap`) najmanje 0.8; provjerena inačica je 0.12.0 te dopuštene korisničke i mrežne prostore. Provjeravač radi bez mreže, s praznim okruženjem, javnim runtime resursima i ulazima samo za čitanje. Ne dobiva privatnu PHP konfiguraciju ni bazu. V8 heap je ograničen na 96 MiB, MicroPython na 4 MiB, privremena mapa na 128 MiB, izlaz na 1 MiB, a izvršavanje na 10 s. Ukupna nativna/WASM memorija još nema cgroup ograničenje; prije prijma proizvoljnih učeničkih programa to treba dodati. Nema nesigurnog zamjenskog izvođenja ako izolacija nije dostupna.

U izvornom repozitoriju:

```sh
npm run build:school-grader
node .build/school-grader/index.mjs projekt.json
```

U raspakiranom školskom paketu:

```sh
node checker/.build/school-grader/index.mjs projekt.json
```

Za MicroPython se uvijek izvršava izvor. Za AVR se klijentski `avr-build.json` ignorira. Bez `--compile` prihvaća se samo točan hash izvora/cilja/biblioteka iz pouzdanog, priloženog kataloga; promijenjeni izvor vraća `unsupported` i `points: null`. Time stari program ne može dobiti bodove za novi izvor.

Za **novi Arduino izvor** pripremi unaprijed Arduino CLI **1.3.1**, `arduino:avr@1.8.6`, AVR GCC **7.3.0-atmel3.6.1-arduino7** i CLI pomoćne alate. Priložene biblioteke zaključane su vlastitim manifestom. Prva priprema `node scripts/avr-setup.mjs` iz razvojnog mosta traži internet; sam izolirani compiler nema mrežu i ništa ne preuzima. Potom zadaj apsolutne putanje `LAB_ARDUINO_CLI` i `LAB_ARDUINO_DATA` na pripremljeni CLI i `avr-env/data`:

```sh
node .build/school-grader/index.mjs projekt.json --compile
```

Svaki takav zahtjev ponovno prevodi aktualni izvor u zasebnom izoliranom procesu i provjerava rezultat prije izvođenja. Prazna privremena mapa je jedino mjesto upisa. Nedostupan alatni lanac ili izolacija vraćaju tehničku pogrešku s `points: null`; compiler pogreška u izvoru ima zaseban status. Ovo je lokalni dokaz, bez javnog compiler endpointa.

Regresija: `npm run test:school`. Cjelovit dokaz s dva nova AVR izvora: `npm run school:proof` nakon pripreme navedenih varijabli.

## MIME, radnici, HTTPS i lokalni podaci

`.wasm` mora imati `application/wasm`; `.mjs`/`.js` JavaScript MIME. Resursi i radnici koriste vlastitu adresu i relativne putanje. Trenutačne jezgre ne koriste SharedArrayBuffer ni Atomics; COOP/COEP zato nisu uvjet ovog profila i ne uključuju se naslijepo, jer treba očuvati upareni prozor lokalnog compiler mosta.

HTTPS provjeri na svakom ciljnom uređaju. `http://localhost` provjera ne dokazuje mrežni HTTPS pristup. Promjena domene ili protokola stvara drugi origin. Na istoj GitHub domeni putanje dijele origin, pa labosv2 izričito koristi zasebne nazive IndexedDB baze, oporavka i Arduino predmemorije. Postojeći rad prenesi ZIP/JSON izvozom; dosadašnji zapisi labosa ne mijenjaju se niti se automatski prenose. Podatci se još ne sinkroniziraju preko baze.

## Završetak 23B i otvorene provjere

Novi dokazi nalaze se u `docs/stage23b-accounts.md`; raniji izvršni pokusi ostaju u `docs/stage23a-school.md`. Slijedi 23C: upravljanje razredima i verzioniranim dodijeljenim vježbama. Stvarni školski HTTPS/LAN profil, Windows/mobilni uređaji, cgroup ograničenje memorije, razred od 30 učenika i fizička oprema imaju zasebne provjere; ovaj paket ih ne proglašava potvrđenima.

## Tehnički izvori

- [PHP: podržane grane](https://www.php.net/supported-versions.php)
- [PHP: zaštita sesija](https://www.php.net/manual/en/session.security.ini.php)
- [PHP: hashiranje lozinki](https://www.php.net/manual/en/function.password-hash.php)
- [MySQL 8.4: implicitno potvrđivanje DDL-a](https://dev.mysql.com/doc/refman/8.4/en/implicit-commit.html)
- [MySQL 8.4: LTS model](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html)
- [XAMPP i MariaDB](https://www.apachefriends.org/faq_windows.html)
- [Apache: MIME tipovi](https://httpd.apache.org/docs/2.4/mod/mod_mime.html)
- [Izolacija izvora u pregledniku](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
- [Node: granice modela dozvola](https://nodejs.org/docs/latest-v24.x/api/permissions.html)

Izbor izvršnog profila, rubrika i granice dokaza projektne su odluke. Dokumentacija ne potvrđuje da je školska instalacija već izvedena.
