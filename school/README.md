# Labosv2 · školski paket · etapa 23A

Etapa 23A priprema postojeći laboratorij za školski Apache/PHP/MySQL smjer i dokazuje ponovno izvršavanje izvan učenikova preglednika. Polazište je `zljix/labos@3c4a281` (0.12.9), uključujući posljednju doradu vodova. Ovaj razvoj objavljuje se u `zljix/labosv2`.

**Dostupno:** simulator, postojeći projekti i izvozi, školski statički paket, PHP provjera preduvjeta, primjer Apache postavki te ograničeni dokaz provjere tipkala/LED-ice za MicroPython i AVR. **Prijava, središnja pohrana i službeno bodovanje još nisu uključeni.** Njihove etape ostaju 23B–23F. Izvorni plan od 14. 11. 2026. nije zamijenjen novim opsegom.

## Izgradnja

Node.js 24 LTS, `npm ci`, zatim:

```sh
npm run build:school
```

Nastaje `release/Labosv2_0.13.0_23A_Skolski.zip` i raspakirani `.build/school-package/`. Paket sadrži:

| Mapa | Namjena |
| --- | --- |
| `web/` | Jedini javni web-korijen: izgrađeni laboratorij, resursi i `api/health.php`. |
| `config/` | Primjer privatne konfiguracije bez ugrađene lozinke. |
| `tools/` | CLI inventura PHP-a, računala i stvarne veze s MySQL-om. |
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

Administrator baze priprema praznu bazu `labosv2` s utf8mb4 i korisnika koji ima ovlasti samo nad tom bazom. Aplikacija ne koristi root ni globalne administracijske ovlasti. SQL migracije i stvaranje prvog administratora pripadaju etapi 23B; inventura ne stvara niti briše tablice.

```sh
php tools/preflight.php /srv/labosv2-private/config.php
```

Izlaz je JSON; kod 0 znači da su navedeni preduvjeti potvrđeni, a 2 da nešto nedostaje. Pregledava stvarni poslužitelj preko PDO-a, razlikuje MariaDB, provjerava InnoDB, utf8mb4 i ovlasti. Ne ispisuje lozinku, DSN ni cijeli popis ovlasti. **Preflight mora ostati izvan web-korijena.** Njegov zapis može sadržavati tehnički inventar, pa ga čuvaj privatno. `api/health.php` daje samo stanje pripreme aplikacije; njegov uspjeh nije dokaz veze s bazom.

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

HTTPS provjeri na svakom ciljnom uređaju. `http://localhost` provjera ne dokazuje mrežni HTTPS pristup. Pri promjeni adrese ili prelasku iz `/labos/` u `/labosv2/` preglednik dobiva zasebnu pohranu; postojeći rad prenesi ZIP/JSON izvozom. Podatci se još ne sinkroniziraju preko baze.

## Završetak 23A i otvorene provjere

Dokazi i stvarno ispitane inačice nalaze se u `docs/stage23a-school.md` i `docs/stage23a-evidence/`. Nakon ove etape slijedi 23B: migracije, administrator, prijava/odjava, lozinke i uloge. Stvarni školski HTTPS/LAN profil, Windows/mobilni uređaji, cgroup ograničenje memorije, razred od 30 učenika i fizička oprema imaju zasebne provjere; ovaj paket ih ne proglašava potvrđenima.

## Tehnički izvori

- [PHP: podržane grane](https://www.php.net/supported-versions.php)
- [MySQL 8.4: LTS model](https://dev.mysql.com/doc/refman/8.4/en/mysql-releases.html)
- [XAMPP i MariaDB](https://www.apachefriends.org/faq_windows.html)
- [Apache: MIME tipovi](https://httpd.apache.org/docs/2.4/mod/mod_mime.html)
- [Izolacija izvora u pregledniku](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)
- [Node: granice modela dozvola](https://nodejs.org/docs/latest-v24.x/api/permissions.html)

Izbor izvršnog profila, rubrika i granice dokaza projektne su odluke. Dokumentacija ne potvrđuje da je školska instalacija već izvedena.
