# Novo izdanje: 0.15.0-beta.1 · 25A

Školski C++ prevoditelj za Uno, Nano i ESP32-S3, dostupan u repozitoriju **labos**. Upute: [STAGE25A_SKOLSKI_PREVODITELJ.md](../docs/STAGE25A_SKOLSKI_PREVODITELJ.md). Školsko prevođenje zahtijeva konfiguriranu PHP/MySQL instalaciju i Linux radni proces; GitHub Pages ostaje statički laboratorij.

# Pripremljeno izdanje · 0.14.15-beta.1 / 24Q

24Q donosi čitljivije panele, istraživačku kopiju, jasniji završetak rada i upute za svih 67 URS varijanti. Lokalna tehnička provjera, ciljani 24Q CI i stolni pregled su provedeni; prihvat stvarnih mobitela i učenički pilot ostaju otvoreni. [Opseg i provjere](../docs/STAGE24Q_PLAN_I_PROVJERA.md).

Izgradi `npm ci` i `npm run build:school`. Novi paket je `release/Labosv2_0.14.15_24Q_Skolski.zip`. Nema SQL migracije ni novih bodovnih pragova. Nove verzije školskih zadataka preuzimaju novi katalog; već objavljene upute/rubrike i zaključane predaje ostaju na svojoj inačici. Novi radni list ima `guideVersion: 2`, dok raniji čuva izvorna pitanja. Web beta 24Q je objavljena. Potpuni CI prihvat školskog paketa još traje; nemoj status web objave smatrati potvrdom završenog školskog prihvata. [Stanje pri objavi](../docs/stage24q-evidence/publication.json).

## Prethodno prihvaćena instalacija · 24P


[Tehnički CI prihvat 24P](https://github.com/zljix/labosv2/actions/runs/44105942453) uspješno je dovršen. Stvarni školski pilot ostaje otvoren. [Izmjene, četiri nove rubrike, uputa učeniku/nastavniku i postupak povrata](../docs/stage24p-remediation.md).

Iz jednog izvora izgradi `npm ci` i `npm run build:school`. Paket je `release/Labosv2_0.14.14_24P_Skolski.zip`. Apache poslužuje samo njegov `web/`; aplikacija, ključevi i konfiguracija ostaju privatni. Koristi postojeći Apache/PHP/MySQL profil i Linux provjeravač. Nema nove SQL migracije. Prije nadogradnje sačuvaj bazu, konfiguraciju, ključ i paket; testni oporavak obavi u zasebnoj praznoj bazi. Tehnički CI prihvat ne potvrđuje ciljnu uporabu na Windowsu ni stvarni Safari/iOS. Detaljne zajedničke instalacijske korake vidi niže u odjeljcima za pripremu poslužitelja.

Za novu dodjelu tipkala/regulatora izričito objavi novu 24P rubriku. Stare dodjele i zaključani radovi ostaju na starim profilima s poznatim ograničenjem vremenskih ulaza. Nakon rada pod novom rubrikom povrat zahtijeva provjeravač koji je razumije; ne prepisuj jednostavno stariji ZIP.

# Povijest izdanja

## 24O — uvodne MicroPython vježbe V1–V5

[Završni prihvat 24O](https://github.com/zljix/labosv2/actions/runs/44068540213) potvrđuje 56 ciljanih izvedbi, pet zaključanih uvodnih dodjela, ranije obitelji, pokus s 30 simuliranih učenika, izvještaje i povrat kopije. [Sažetak i otisak provjeravača](../docs/stage24o-evidence/acceptance-summary.json). Provjereno je svih 938 datoteka inventure i 205 web resursa; ZIP je neizmijenjen izlaz prihvaćenog CI-ja.

Izdanje **0.14.13-beta.1** dodaje pet zasebnih školskih zadataka, svaki do 10 bodova, s revizijama i zaključavanjem. Obuhvat ostaje **268/268 URS + 5/5 uvodnih**. Učenici dobivaju izvorne uvodne predloške s nedovršenim zadatkom. Lokalna provjera služi povratnoj informaciji; službeni bodovi nastaju iz točne spremljene snimke. [Uvjeti, provjere i nadogradnja](../docs/stage24o-introductory.md).

Nema nove SQL migracije. Nakon sigurnosne kopije sačuvaj konfiguraciju, ključ i sesije, zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni Linux provjeravače. Pri objavi nove inačice odaberi odgovarajuću V rubriku. Stare dodjele ostaju sačuvane. Slijedi 24P: potpuna regresija i stvarni školski pilot.

## 24N — digitalni i I2C pretvornici razina

[Završni prihvat 24N](https://github.com/zljix/labosv2/actions/runs/44052504254) potvrđuje 253 ciljane izvedbe, 48 neovisnih C++ prijevoda i 16 zaključanih novih dodjela. Potvrđeni su i ranije obitelji, 30 simuliranih učenika, izvještaji te povrat kopije. [Sažetak i izvorni provjereni paket](../docs/stage24n-evidence/acceptance-summary.json).

Izdanje **0.14.12-beta.1** dodaje četiri rubrike i završnih 16 kombinacija: **268/268**, odnosno svih 67 URS varijanti na sva četiri cilja. U ovoj povijesnoj etapi uvodne V1–V5 još su bile lokalne; njihove školske rubrike dodane su u 24O. Bodovi dolaze iz stvarnih odvojenih domena i DIR-a, novog BMP280 čitanja te primljenih OLED piksela. Postojeća trajanja primjera zadržana su i objavljena po cilju. [Uvjeti i nadogradnja](../docs/stage24n-levels.md).

Nema nove SQL migracije. Sačuvaj bazu, privatnu konfiguraciju, ključ i sesije; zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni Linux provjeravače. Nove rubrike izričito odaberi pri objavi nove inačice zadatka. Stare dodjele i zaključani bodovi ostaju uz svoje stare rubrike.

## 24M — NRF24L01+ i dva programa

Izdanje **0.14.11-beta.1** dodaje rubriku za radio par na četiri glavna cilja: **252/268 kombinacija**. Oba izvora, oba sklopa i dovršena RX čitanja ulaze u istu provjeru. Podržani su i svi mješoviti parovi. [Uvjeti i nadogradnja](../docs/stage24m-radio.md). Nema nove SQL migracije. Zamijeni kompletan paket i ponovno pokreni provjeravače nakon sigurnosne kopije i postojećeg migrate. Samo novi radio posao ima rezervaciju 300 s.

[Završni prihvat 24M](https://github.com/zljix/labosv2/actions/runs/44037558293) povezuje 60 ciljanih provjera, 24 zasebna C++ prijevoda i četiri zaključane školske dodjele. Prošle su ranije obitelji, pokus s 30 simuliranih učenika, izvještaji i povrat sigurnosne kopije. [Sažetak i podrijetlo](../docs/stage24m-evidence/acceptance-summary.json).

## 24L — MAX30102

[Završni prihvat 24L](https://github.com/zljix/labosv2/actions/runs/43981733195) povezuje 162 izvedbe, 48 neovisnih C++ prijevoda i 16 zaključanih dodjela s isporučenim provjeravačem. [Sažetak i podrijetlo](../docs/stage24l-evidence/acceptance-summary.json).

Izdanje **0.14.10-beta.1** dodaje četiri rubrike i 16 kombinacija, ukupno **248/268**. Registri, šestobajtni uzorci, promjene sintetskog kontakta/frekvencije i puni FIFO provjeravaju se iz stvarnih I2C prijenosa. [Uvjeti i provjere 24L](../docs/stage24l-optical.md). Nema nove SQL migracije. Sačuvaj bazu, privatnu konfiguraciju, ključ i sesije, zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni provjeravače.

## 24K — RTC i SD

[Potpuni prihvat 24K](https://github.com/zljix/labosv2/actions/runs/43968133436) potvrđuje 238 ciljanih izvedbi, 72 neovisna C++ prijevoda, 24 zaključane školske dodjele, ranije obitelji, izvještaje, povrat kopije i sintetski razred od 30 učenika. [Sažetak i otisak provjeravača](../docs/stage24k-evidence/acceptance-summary.json).

Izdanje **0.14.9-beta.1** dodaje šest rubrika i 24 kombinacije, ukupno **232/268**. Provjera koristi dovršene RTC bajtove, stvarne SD sektore i FAT16 datoteke te primljene TM1637 segmente. [Uvjeti i provjere 24K](../docs/stage24k-storage.md). Nema nove SQL migracije. Sačuvaj bazu i privatnu konfiguraciju, zamijeni kompletan paket, zadrži ključ i sesije, pokreni postojeći migrate i ponovno pokreni provjeravače.

## 24J — ILI9341 i dodir XPT2046

Izdanje **0.14.8-beta.1** dodaje šest rubrika i 24 kombinacije, ukupno **208/268**. Grafika, rotacije, sirova očitanja, izmjerena kalibracija i tipkalo provjeravaju se preko stvarnih SPI bajtova, fizičkih TFT piksela i struje LED-ice. [Uvjeti, kriteriji i provjere 24J](../docs/stage24j-touch.md). Nema nove SQL migracije. Sačuvaj bazu, privatnu konfiguraciju i sesije; zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni provjeravače. Stare dodjele i zaključane predaje ostaju sačuvane.

[Završni prihvat 24J](https://github.com/zljix/labosv2/actions/runs/43959526722) potvrđuje sva četiri cilja, 72 neovisna C++ prijevoda i 24 stvarne dodjele. [Sažetak i otisci](../docs/stage24j-evidence/acceptance-summary.json) povezuju provjere s isporučenim provjeravačem.

## 24I — meteorološka stanica i regulator

Izdanje **0.14.7-beta.1** dodaje dvije rubrike i osam kombinacija, ukupno **184/268**. Stanica provjerava tri neovisna nova očitanja i primljene OLED piksele; regulator dodaje oba smjera histereze, granične AHT10 uzorke i stvarne servo impulse. [Opseg, kriteriji i provjere 24I](../docs/stage24i-environment.md). Nema nove SQL migracije. Sačuvaj bazu, konfiguraciju i sesije; zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni provjeravače. Stare dodjele i zaključane predaje ostaju sačuvane.

Provjera OLED-a uspoređuje cijele brojeve, uključujući predznak i decimalni dio. Privatni red provjera nakon SQL deadlocka ograničeno ponavlja DB preuzimanje ili potpuno vraćenu transakciju rezultata; dva vala po 30 sintetičkih predaja prošla su bez udvostručavanja.

## 24H — zasloni i SPI uređaji

Izdanje **0.14.6-beta.1** dodaje osam rubrika i 32 kombinacije: ukupno **176/268**. OLED, LCD, TM1637, ST7735 i BMP280 SPI provjeravaju se iz stvarnih prijenosa i memorije uređaja. [Opseg, kriteriji i provjere 24H](../docs/stage24h-displays.md). Nema nove SQL migracije. Sačuvaj bazu, konfiguraciju i sesije; zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni provjeravače. Ranije predaje ostaju vezane uz svoje uvjete.

## 24G — A4988 i koračni motor

Izdanje **0.14.5-beta.1** dodaje tri rubrike i 12 kombinacija: ukupno **144/268**. [Opseg i provjere 24G](../docs/stage24g-steppers.md). ENABLE isključuje pobudu, translator broji dalje; RESET ne referencira osovinu. Upute za nadogradnju i kriteriji nalaze se u odjeljku 24G na kraju dokumenta. Nema nove SQL migracije.

## 24F — relej, zvuk, servo i DC motori

Izdanje 0.14.4-beta.1 dodaje sedam rubrika 24F-…@1 i 28 kombinacija (ukupno 132/268). Objavljene upute opisuju stvarne kontakte, impulse, tonove, potpisani prosječni napon, vremenski slijed i tolerancije. [Opseg i provjere 24F](../docs/stage24f-actuators.md).

Nema nove SQL migracije. Prije nadogradnje sačuvaj bazu i privatnu konfiguraciju. Zamijeni programski paket, zadrži sesije/konfiguraciju, pokreni postojeći migrate i ponovno pokreni Linux provjeravače. Ranije verzije rubrika i zaključane predaje ostaju izvršive uz stare uvjete. Nova objava izričito bira novu rubriku.

# Labosv2 · školski paket · etapa 24N

Prethodno izdanje 0.13.8-beta.1 pripremilo je školski pilot, obrazac opažanja i razvojni pokus 30 + 1; vidi [23I](../docs/stage23i-pilot.md). Etapa 23H dodala je postignuća, izvoze, komentare i korekcije, arhiviranje, čuvanje međurevizija te privatne kopije i povrat. Postupak i provjere su u [izvješću 23H](../docs/stage23h-reports-administration.md). [Raniji zapis integracije 23F](https://github.com/zljix/labosv2/actions/runs/43738711916) ostaje povijesni dokaz. Stvarni školski pilot ostaje zasebna provjera.

Etapa 23A priprema postojeći laboratorij za školski Apache/PHP/MySQL smjer i dokazuje ponovno izvršavanje izvan učenikova preglednika. Polazište je `zljix/labos@3c4a281` (0.12.9), uključujući posljednju doradu vodova. Ovaj razvoj objavljuje se u `zljix/labosv2`.

**Dostupno:** simulator, postojeći projekti i izvozi, školski paket, PHP provjera preduvjeta, MySQL migracije, početni administrator, prijava/odjava, uloge, upravljanje računima i lozinkama, razredi, CSV uvoz, pozivni kodovi, potvrda učenika i verzionirane dodjele vježbi te raniji ograničeni dokaz tipkala/LED-ice, poslužiteljski pokušaji, nepromjenjive radne revizije, automatsko spremanje, usporedba sukoba i nastavnički pregled rada. **Službeno bodovanje sada pokriva 268 od 268 kombinacija.** Etapa 24E dodaje šest rubrika enkodera i IR-a; [upute i provjere](../docs/stage24e-events.md). Završetak, zaključavanje, povijest i dopuštena dorada dostupni su u 23F. Izvorni plan od 14. 11. 2026. zadržan je.

## Izgradnja

Node.js 24 LTS, `npm ci`, zatim:

```sh
npm run build:school
```

Nastaje `release/Labosv2_0.14.12_24N_Skolski.zip` i raspakirani `.build/school-package/`. Paket sadrži:

| Mapa | Namjena |
| --- | --- |
| `web/` | Jedini javni web-korijen: laboratorij, portal računa, resursi i PHP API. |
| `catalog/` | Privatni školski katalog i 268 početnih predložaka; objava ih kopira u nepromjenjivu inačicu u bazi. |
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

U ovoj etapi administrator stvara račune i mijenja uloge/aktivnost. Nastavnik vidi i resetira lozinke samo učenicima svojih dodijeljenih razreda; zahtjev traži i nastavnikovu trenutačnu lozinku. Temeljne tablice razreda postoje radi te provjere ovlasti. **Upravljanje razredima, dodjela nastavnika, CSV uvoz i potvrda članstva sada su dostupni u portalu (23C).** Bez dodijeljenog razreda nastavnički je popis prazan; administrator može resetirati korisnikovu lozinku. Nema prešutnog prava na sve učenike škole.

Privremena lozinka mora se promijeniti prije korištenja upravljačkih funkcija. Lozinke imaju 12–72 bajta, obrađuju se `password_hash`/`password_verify` i nikada se ne vraćaju API-jem. Promjena/reset lozinke, deaktivacija i promjena uloge opozivaju ranije sesije preko `auth_version`. Obična odjava zatvara trenutačnu sesiju. Administrator ne može sam sebi ukinuti aktivnost ili administratorsku ulogu.

Sesije koriste HttpOnly i SameSite=Strict, HTTPS postavlja Secure, identifikator se obnavlja nakon prijave i promjene lozinke. Sesija traje do 30 minuta neaktivnosti ili najviše 8 sati. Izmjene zahtijevaju CSRF token i provjeru izvora. Ograničenje prijave čuva se u MySQL-u: do 8 pokušaja po korisničkom imenu i 120 po adresi u fiksnih 15 minuta, uključujući uspješne prijave. Nepoznat račun i pogrešna lozinka daju istu poruku. Revizijski zapis sadrži autora, cilj i vrstu promjene, bez lozinki ili sesijskih tokena.

Za isključivo lokalne razvojne pokuse postoji `app.allow_insecure_localhost=true` uz HTTP localhost/127.0.0.1; zahtjev mora stvarno doći s loopback adrese. Zadana školska postavka ostaje HTTPS. Proxy zaglavlja ne pretvaraju nešifrirani zahtjev u pouzdani HTTPS.

API računa i sesija nikada ne ulazi u offline predmemoriju. Nakon odjave privatni popisi nisu dostupni u sučelju. Postojeći lokalni projekti ne postaju automatski službeni radovi prijavljenog računa. Dodijeljene učeničke vježbe sada koriste poslužiteljski pokušaj (23D). Zasebni lokalni projekti ne postaju automatski službeni radovi.

## Razredi i dodjela vježbi (23C)

1. Nakon promjene privremene lozinke otvori **Razredi i dodijeljene vježbe**. Nastavnik može stvoriti razred i automatski mu pripada. Naziv je jedinstven unutar školske godine u formatu `2026/2027`. Administrator može stvoriti razred i dodijeliti mu aktivne nastavnike. Nastavnik vidi samo svoje razrede.
2. U razredu otvori **Uvezi popis učenika iz CSV-a**. Koristi UTF-8, zarez ili točku sa zarezom, do 100 učenika i 60 kB. Zaglavlje je `username;displayName;temporaryPassword`. Za nove račune unesi pojedinačne privremene lozinke od 12–72 bajta. Njihovu predaju organiziraj osobno. Učenici ih mijenjaju pri prvoj prijavi.
3. Za postojeći račun ime i prezime moraju točno odgovarati, a polje `temporaryPassword` mora biti prazno. Dopušteno je zaglavlje samo `username;displayName` ako nema novih računa. U **Pregledaj plan uvoza** provjeri identitet i svaku radnju te izričito potvrdi povezivanje postojećih računa. Uvoz ne mijenja njihovu lozinku ni ime. Pregled vrijedi 10 minuta i vezan je uz razred, nastavnika, sadržaj i stanje računa. Nakon promjene ponovi pregled; ne sprema se djelomičan uvoz. Izvorni CSV s lozinkama čuvaj privatno i nakon predaje ukloni prema školskoj politici.
4. Alternativno stvori **Pozivni kod**: 1–168 sati, 1–100 novih zahtjeva. Novi kod opoziva prethodni kod razreda i prikazuje se samo pri stvaranju; poslužitelj čuva samo HMAC. Postojeći učenik ga unosi nakon prijave. Novi učenik koristi registracijski obrazac i bira vlastitu lozinku. Registracija uvijek stvara samo učenika. Kod šalje zahtjev i **ne daje članstvo**: nastavnik provjerava identitet i potvrđuje ili odbija zahtjev. Do potvrde učenik ne vidi razredne vježbe. Opoziv/istek koda ne briše već zaprimljene zahtjeve.
5. U **Objavi inačicu zadatka i kriterija** odaberi stvarnu URS varijantu, pregledaj izvorne upute i po potrebi dodaj nastavničku uputu. Opcionalni planirani bodovni kriteriji unose se po retku kao `Opis | 3` (1–12 kriterija, svaki 1–100 bodova). Ako su prazni, ostaju opisni kriteriji bez bodovnog maksimuma. Rubrike nose oznaku `not-yet-enabled`: to su unaprijed vidljivi kriteriji, a ne službeni ili osvojeni bodovi.
6. Objavi pa u **Dodijeli objavljenu inačicu** odaberi razred, točnu inačicu, pločicu/jezik i opcionalan rok. Rok unosiš po vremenu svojeg uređaja; API sprema UTC i prikazuje Europe/Zagreb. U 23C je rok informativan i ne zaključava rad. Kasnije uključivanje/skrivanje mijenja samo dostupnost. Zadatak, cilj i rok postojeće dodjele ne mijenjaju se tim gumbom. Za drukčiju pripremu napravi novu dodjelu.
7. Učenik vidi samo dostupne vježbe svojih potvrđenih razreda. Prije otvaranja čita upute i kriterije. **Otvori / nastavi vježbu u laboratoriju** prvi put stvara školski pokušaj iz točne objavljene inačice, a poslije učitava posljednju potvrđenu reviziju. Program se ne pokreće. Svako otvaranje dobiva zasebnu lokalnu kopiju; stari lokalni projekt ostaje sačuvan. Izvor, sklop, upravljačke datoteke, početni mediji i oba radio čvora ostaju u snimci.

Katalog obuhvaća postojećih 18 tema, 67 varijanti i 268 kombinacija ciljeva. Broj predložaka ne označava 268 automatski bodovanih vježbi. Zadaci i rubrike objavljeni su kao nepromjenjive inačice, a odabrani početni projekti kopiraju se u bazu pri objavi. Nova objava i nadogradnja instaliranog kataloga ne mijenjaju prethodne dodjele. Upute i kriteriji prikazuju se kao tekst. Nastavnički popis objavljenih inačica zajednički je školskim nastavnicima; učenici pristupaju isključivo svojim dodjelama.

Pristup se provjerava za svaki API poziv. Uklanjanje učenika ili nastavnika iz razreda odmah ukida njegov budući pristup tom razredu kroz API. Ranije preuzeta lokalna kopija time se ne briše. Uklanjanje članstva ne briše račun, objavljene zadatke ni dodjele. Revizijski zapisi čuvaju autora i radnju bez pozivnog koda, tokena ili privremene lozinke.

## Spremanje i nastavak rada (23D)

Učenik se prijavljuje vlastitim računom, otvara dodijeljenu vježbu i radi u simulatoru. Lokalno spremanje i oporavak ostaju dostupni. Središnje spremanje šalje projekt nakon približno 3 sekunde bez izmjene ili najkasnije nakon 15 sekundi neprekinutog uređivanja. Svaka prihvaćena promjena stvara novu nepromjenjivu reviziju. Promjena pločice ili jezika nije dopuštena unutar iste dodjele; za druge pokuse otvori zasebnu lokalnu kopiju.

Iznad radnog područja učenik vidi stanje spremanja, broj posljednje potvrđene revizije i vrijeme Europe/Zagreb. **Spremljeno na školskom poslužitelju** odnosi se samo na potvrđeni sadržaj. Nakon novih izmjena prikazuje se da su još lokalne. Pri prekidu veze ne potvrđuje se spremanje; ZIP/JSON izvoz i lokalni oporavak ostaju dostupni. Povrat veze ponavlja isti neriješeni zahtjev, a eventualni sukob novije revizije i dalje zaustavlja prepisivanje.

Za nastavak na drugom računalu prijavi se i ponovno otvori istu dodijeljenu vježbu. Dobit ćeš posljednju potvrđenu snimku. Nesinkronizirane izmjene s prethodnog uređaja postoje samo u njegovoj lokalnoj kopiji ili izvezenoj datoteci.

### Dvije kartice ili uređaji

Svaka radna kopija pamti potvrđenu poslužiteljsku reviziju. Zastarjelo spremanje vraća sukob. **Pregledaj poslužiteljsku verziju** prikazuje lokalne i poslužiteljske izvore, odgovore i veze obaju čvorova. Nakon pregleda možeš:

- učitati prikazanu poslužiteljsku verziju; postojeća lokalna kopija ostaje u **Mojim projektima**;
- izričito spremiti svoju lokalnu verziju kao novu reviziju; ako se poslužitelj u međuvremenu opet promijenio, sustav ponovno zaustavlja spremanje;
- nastaviti u zasebnoj lokalnoj kopiji koja nije povezana s učeničkim pokušajem.

Nema tihog spajanja ni prisilnog prepisivanja. Ponovljena oznaka istog zahtjeva vraća istu potvrdu. Ako je drugi uređaj već spremio još noviji rad, prikazuje se sukob i nakon zakašnjele potvrde. Zamjena prijavljenog računa ne prenosi rad drugom učeniku.

### Nastavnički pregled

U portalu uz dodijeljenu vježbu odaberi **Pregled spremljenih radova**, ili u simulatoru **Pregled razreda → Školski pregled rada**. Odaberi razred i vježbu; dostupni su pretraživanje učenika i filtar statusa. Popis se skupno osvježava svakih 5 sekundi dok je kartica vidljiva. Prikazuje dob podataka, poslužiteljsko vrijeme, nezapočete radove i posljednje potvrđene revizije. Za veće razrede postoje stranice po 200 članova; pretraživanje i status filtriraju otvorenu stranicu.

**Pregledaj snimku** otvara točnu reviziju bez pokretanja koda. Odabrani detalj ostaje isti dok ne učitaš noviju snimku. Moguće je čitati posljednjih 100 revizija kroz izbor, preuzeti JSON i otvoriti zasebnu kopiju za pokus. API omogućuje i starije revizije paginiranjem povijesti. Nastavnički pokus ne mijenja učenikov rad. Raniji lokalni ZIP/JSON pregled i ručna evidencija ostaju u zasebnom odjeljku.

Bodovanje u 23D ima stanje **još nije uključeno**, s `points: null`. Nezapočeta vježba nije nula. Uvezeni broj bodova, ime ili rubrika ne mijenjaju identitet prijavljenog učenika ni objavljenu dodjelu. Službeno funkcionalno bodovanje i zaključavanje pripadaju 23E–23F.

### Nadogradnja s 23C

Sačuvaj bazu i privatnu konfiguraciju prije zamjene, privremeno zaustavi web pristup i zamijeni kompletan javni i privatni paket. Zadrži isti ključ, konfiguraciju i privatnu mapu sesija. Ponovi `php tools/console.php migrate /put/do/privatne/config.php`. Nova migracija je **004_work_snapshots.sql**; 001–003 ostaju neizmijenjene. Ponovljena migracija čuva račune, razrede, dodjele i radne revizije. Zamjena samog `web/` nije potpuna nadogradnja.

### Nadogradnja s 23B

Prije zamjene isporuke sačuvaj bazu i privatnu konfiguraciju prema školskoj politici. Zaustavi web pristup tijekom zamjene, zamijeni kompletan javni i privatni paket (uključujući `catalog/`), zadrži istu privatnu konfiguraciju, ključ i mapu sesija te ponovno pokreni `php tools/console.php migrate /put/do/privatne/config.php`. Nova migracija je `003_classes_tasks.sql`; 001 i 002 nisu izmijenjene. Ponovna migracija čuva račune, njihove lozinke i članstva. Uklanjanje novih tablica nije dio automatskog vraćanja.

## Provjera instalacije i nadogradnja

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

HTTPS provjeri na svakom ciljnom uređaju. `http://localhost` provjera ne dokazuje mrežni HTTPS pristup. Promjena domene ili protokola stvara drugi origin. Na istoj GitHub domeni putanje dijele origin, pa labosv2 izričito koristi zasebne nazive IndexedDB baze, oporavka i Arduino predmemorije. Postojeći rad prenesi ZIP/JSON izvozom; dosadašnji zapisi labosa ne mijenjaju se niti se automatski prenose. Dodijeljene učeničke vježbe sada se sinkroniziraju preko baze; zasebni lokalni projekti ostaju samo na uređaju.

## Završetak 23D i otvorene provjere

Novi dokazi nalaze se u `docs/stage23d-work.md`; prethodne etape ostaju povijesno zabilježene u svojim izvješćima. Bodovanje triju pilota isporučeno je u 23E, a završetak, zaključavanje i dopuštena dorada u 23F. Stvarni školski HTTPS/LAN profil, Windows/mobilni uređaji, cgroup ograničenje memorije, razred od 30 učenika i fizička oprema imaju zasebne provjere; ovaj paket ih ne proglašava potvrđenima.

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

## Razvojne provjere 23C

`npm run test:school-catalog` otvara i ponovno izvozi svih 268 zamrznutih početnih predložaka. `npm run test:school-classes` provjerava stvarni PHP/MySQL, uvoz, ovlasti, kodove, paralelno posljednje mjesto, inačice zadataka i dodjele. `npm run test:school-portal` izvršava stvarne module portala u DOM okruženju uz stvarni API: pripremu nastavnika, prvu prijavu učenika i potvrdu članstva. To nije vizualna potvrda ciljnog preglednika.

Svaki integracijski skup zahtijeva vlastitu praznu bazu naziva `labosv2_test_*` i iste testne varijable kao skup računa: `PHP_BIN` ako PHP nije u PATH-u, `LAB_TEST_DB_DSN`, `LAB_TEST_DB_USER`, `LAB_TEST_DB_PASSWORD`. Skupovi se ne pokreću nad istom popunjenom bazom niti nad školskim podacima. Actions priprema zasebne baze i jednokratne vjerodajnice.

## Razvojne provjere 23D

`npm run test:school-sync` provjerava ritam spremanja, prekid veze, ponovljivost i sukobe. `npm run test:school-work` koristi stvarni PHP/MySQL API, nepromjenjive snimke, ovlasti, konkurentno spremanje i svih 268 početnih ciljeva. `npm run test:school-work-ui` izvršava stvarne React komponente s tim API-jem: lokalne izmjene → potvrda → prekid mreže → oporavak → sukob → izbor → nastavnički pregled. DOM provjera nije vizualna potvrda ciljnog preglednika.

Svaki integracijski skup mora imati vlastitu praznu bazu `labosv2_test_*`. Koristi iste testne varijable kao 23B/23C. Actions priprema sedam zasebnih baza za račune, razrede, portal, rad, React tijek, bodovanje i predaje. Testne baze nikada nisu školska evidencija.


## 23E · automatsko bodovanje pilota

Izdanje **0.13.4-beta.1**, migracija **005_grading_jobs.sql**. Za nadogradnju s 23D sačuvaj privatnu konfiguraciju i sesije, zamijeni programski paket, zatim pokreni `php tools/console.php migrate /apsolutna/privatna/config.php`. Ponovna migracija čuva postojeće radove i rubrike. Prvo pripremi sigurnosnu kopiju školskih podataka.

U portalu pri objavi inačice zadatka odaberi **Način provjere**. Dostupni su `gpio/button`, `gpio/adc` i `weather/bmp280`. Odabir automatskog pilota zamrzava njegove upute i kriterije 3 + 5 + 2. Stare dodjele s opisnim ili ručno planiranim kriterijima ostaju takve. Za novu službenu provjeru objavi i dodijeli novu inačicu. Ne mijenjaj stare zapise baze ručno.

**Analogni pilot** izričito traži digitalni prag na polovici ADC raspona. Početni ADC/PWM program ostaje početna podloga i učenik ga mora izmijeniti. **BMP280 pilot** traži retke `T=<broj> P=<broj>` s temperaturom u °C i tlakom u Pa, novo I2C očitanje i interval do 2200 ms. Sve upute vide se prije otvaranja rada i u laboratoriju. Podržano bodovanje: S3 MicroPython, Uno i classic Nano. S3 C++ i ostale teme imaju prazne bodove.

### Privatni radnik na Linuxu

Provjeravač treba Node 24, Bubblewrap 0.12, `unshare`, `prlimit` i dopuštene Linux korisničke prostore. Instaliraj paket u privatni direktorij; samo `web/` je javno dostupan. Koristi ograničeni uslužni račun. PHP CLI broker obrađuje bazu, a izvođenje učeničkog koda odvija se u zasebnom procesu bez konfiguracije, vjerodajnica ili mrežnog pristupa.

Za novi Arduino izvor unaprijed pripremi zaključani CLI/core prema odjeljku 23A. U privatnom okruženju radnika postavi apsolutne `LAB_SCHOOL_CONFIG`, `LAB_ARDUINO_CLI` i `LAB_ARDUINO_DATA`; `LAB_GRADER_COMPILE=1` uključuje ponovno prevođenje. Nijedna od tih putanja ne ide u javnu stranicu ili Git. Ako lokalno prevođenje nije uključeno, dopušten je samo instalirani katalogski artefakt koji se točno podudara s izvorom; ostali programi imaju `unsupported` i prazne bodove.

Jedan prolaz, iz korijena raspakiranog školskog paketa:

```sh
node tools/grade-once.mjs
```

Naredba uzima najstariji posao, izvodi provjeru i privatnim CLI-jem potvrđuje rezultat. Ako nema posla, vraća `idle`. Za stalni servis koristi nadzor procesa ili ovu petlju u privatnom servisnom okruženju:

```sh
while true; do
  node tools/grade-once.mjs
  sleep 1
done
```

Jedan radnik znači jedno neovisno izvođenje odjednom. Ograničeni paralelni radnici koriste SQL zaključavanje i ne preuzimaju isti posao. Ne povećavaj broj prije mjerenja memorije i vremena na školskom poslužitelju. Svaki proces ima kernel limit od 2 GiB virtualnog adresnog prostora, uz odvojene Python/V8 heapove, ograničeni tmpfs, izlaz i vrijeme. Ovo ne zamjenjuje cgroup limit ukupne memorije servisa koji treba postaviti i izmjeriti prije razrednog pilota.

Radnik ne postoji na GitHub Pagesu. PHP/MySQL na Windowsu radi kao dosad; automatska izolirana provjera u ovom paketu zahtijeva Linux uz isti privatni PHP/MySQL pristup. Automatski prijenos poslova na zaseban udaljeni Linux servis nije isporučen.

### Bodovi, povijest i pogreške

Svaka snimka nosi vlastiti posao i rezultat. Otvaranje i spremanje automatski stavljaju podržanu snimku u red. Stari posao na čekanju zamjenjuje se novijim; stari već pokrenuti rezultat ostaje uz staru reviziju. Nova revizija nema stare osvojene bodove. Rubrika i identitet dolaze isključivo iz baze.

Učenik vidi **Moji bodovi**, kriterije i scenarije; nastavnik iste bodove vidi u skupnom pregledu te na detalju odabrane revizije. Trenutačno nespremljene lokalne izmjene nemaju poslužiteljske bodove. Kvar servisa, istek izvršavanja, čekanje i nepodržani program imaju `points: null`. Pogreška učeničkog programa prikazuje se zasebno i čuva stvarno potvrđene kriterije.

Radnik ima 180 sekundi za isporuku. Istekla isporuka se odbija, a sljedeći prolaz označava tehnički neuspjeh. Učenik nakon tehničke pogreške ili ograničenja može zatražiti **Provjeri spremljenu reviziju / ponovi**. Aktivna i već uspješno dovršena provjera ne udvostručuju se. Nakon prestanka radnika poslovi ostaju na čekanju do njegova ponovnog pokretanja. Pri punom redu spremanje rada nastavlja se, a provjeru treba zatražiti naknadno.

Bodovi su povratna informacija prema objavljenoj rubrici; nisu automatska školska ocjena niti dokaz autorstva. Završetak i zaključavanje predaje dostupni su u 23F. [Dokazi i ograničenja](../docs/stage23e-grading.md).


## 23F · završetak, zaključana predaja i dopuštena dorada

Izdanje **0.13.5-beta.1**, migracija **006_submissions.sql**. Za nadogradnju s 23E sačuvaj privatnu konfiguraciju i sesije, zamijeni programski paket i pokreni:

```sh
php tools/console.php migrate /apsolutna/privatna/konfiguracija.php
```

Učenik u laboratoriju odabire **Završi i zaključaj vježbu**. Sustav čeka potvrdu posljednjih izmjena, zatim prikazuje reviziju, bodove i neostvarene kriterije. **Potvrdi i zaključaj ovu reviziju** stvara nepromjenjivu predaju s poslužiteljskim brojem i vremenom. Dopušten je završetak s manje bodova ili dok provjera traje. Bez potvrde poslužitelja sučelje ne proglašava završetak. Ako se odgovor izgubi, ponovi isti zahtjev; predaja se ne udvostručuje.

Zaključani sadržaj ostaje za pregled. Lokalni pokus otvori u zasebnoj kopiji. Za službenu doradu nastavnik u **Pregled razreda → Školski pregled rada → Pregledaj snimku** upisuje razlog i odabire **Dopusti doradu kao novi pokušaj**. Učenik ponovno otvara dodijeljenu vježbu ili odabire **Provjeri dopuštenu doradu / otvori najnoviji pokušaj**. Stara predaja i bodovi ostaju sačuvani.

**Povijest pokušaja / osvježi** dostupna je učeniku i nastavniku. Pregled razreda prikazuje posljednji radni pokušaj i odvojeno posljednju zaključanu predaju. Nova otvorena dorada ne zamjenjuje prethodne službene bodove; nova zaključana predaja postaje aktualna kada je učenik potvrdi. Tehnička pogreška ili provjera koja još traje nema osvojenu nulu. Rok ostaje informativan i ne završava rad automatski.

Provjere: `npm run test:school-finish-ui`, `npm run test:school-sync`, `npm run test:school-submissions`, `npm run test:school-work-ui`. API integracija predaja koristi vlastitu praznu bazu `labosv2_test_submissions`, a React tijek svoju `labosv2_test_work_ui`.

[Detaljan postupak, model predaja i granice 23F](../docs/stage23f-submissions.md). Javna Pages adresa nema PHP/MySQL; prijavu i službenu evidenciju omogućuje školska instalacija.


## 23G · registar i proširenje bodovanja

Na `school-grading.html` dostupni su svi kriteriji pripreme i status svake od 268 URS kombinacija, uz pretragu te filtre po obitelji, cilju i podršci. CSV i JSON preuzimaju cijeli registar; ne sadrže učeničke rezultate. V1–V5 evidentirane su zasebno kao lokalne provjere.

Podržano je 18 kombinacija: šest rubrika na MicroPython S3, Uno i classic Nano. Uz tri rubrike iz 23E dodane su:

| Varijanta | Nova rubrika | Posebna uputa |
| --- | --- | --- |
| URS01 · `gpio/blink` | `23G-led-timing@1` | Prilagodi početnih 500/500 ms na 250/750 ms. Početni program može ostvariti 8/10; tražena trajanja donose preostala 2 boda. |
| URS04 · `analog/lm35` | `23G-lm35@1` | Napajanje 5 V, ADC, pretvorba 10 mV/°C i novi ispis `T=...`; najveći interval 400 ms. |
| URS03 · `weather/bmp180` | `23G-bmp180@1` | Nove pretvorbe i stvarni I2C prijenosi, `T=... P=...` u °C/Pa, najviše 2200 ms između očitanja. |

Svaka rubrika ima 10 mogućih bodova i objavljuje svoje kriterije. Pri odabiru zadatka portal prikazuje podršku po cilju. Odabir opisnih kriterija i dalje ne uključuje automatske bodove. Ostalih 250 kombinacija ostaje označeno bez službenog bodovanja; ESP32-S3 C++ još nema službeni izvršni adapter.

Za novi Arduino izvor potreban je lokalni izolirani prevoditelj. Bez njega dopušten je samo pouzdani kataloški artefakt s točno jednakim izvorom i ovisnostima. Izmijenjeni LED program za 10/10 zato zahtijeva prevoditelj. Izvorni 500/500 ms program ostaje koristan za provjeru 8/10.

Nadogradnja s 23F ne dodaje migraciju: sačuvaj privatnu konfiguraciju i sesije, zamijeni programski paket i pokreni postojeću naredbu `migrate`. Ponovno pokreni provjeravač iz novog paketa. Ranije objavljene rubrike zadržavaju `23E.1`, nove `23G.1`; ne mijenjaju se zaključane snimke ili ranije potvrđeni izvještaji. Pokretanje starih poslova nakon nadogradnje provjerava regresija.

Provjere: `test:school-coverage`, `test:school-grading-expanded` i `test:school-grading-api`, uz ranije račune, razrede, spremanje i predaje. Compiler scenarij traži `LAB_GRADING_COMPILER_TEST=1`, `LAB_ARDUINO_CLI` i `LAB_ARDUINO_DATA`; školski Actions postupak ih postavlja i provjerava šest novih Uno/Nano izvora. To ne zamjenjuje fizički školski pilot, provjeru Windowsa ni iOS/Safarija.

## 23H · izvještaji, korekcije, arhiva i sigurnosne kopije

Nadogradnja s 23G: sačuvaj privatnu konfiguraciju i sesije, zamijeni programski paket, pokreni postojeći `migrate` i ponovno pokreni provjeravač. Nova **007_reports_administration.sql** dodaje zapise pregleda, odabira predaje i arhive godine. Ranije migracije, rubrike i zaključane snimke ostaju sačuvane.

U laboratoriju otvori **Pregled razreda → Školski pregled rada → Postignuća i izvještaji / izvozi**. Odaberi razred pa učenika i/ili vježbu. Evidencija zadano koristi posljednju zaključanu predaju; otvorenu doradu prikazuje zasebno. Za drugi izbor otvori detalj zaključane predaje, upiši razlog i odaberi **Koristi ovu zaključanu predaju**. **Vrati posljednju zaključanu predaju** vraća zadani postupak i također ostavlja zapis.

**Preuzmi cijeli odabir CSV** obuhvaća sve odabrane zapise, ne samo vidljivih 100. Najviše je 5000 zapisa; veći izvještaj suzi filtrom. Izvorni automatski bodovi, nastavnički bodovi, podrijetlo i točna predaja/revizija vode se zasebno. Nezapočeto i nepotvrđeno ne postaje nula. CSV štiti tekst od formula.

**Preuzmi evidenciju i projekte ZIP** sadrži evidenciju i projektne ZIP-ove aktualne i odabrane zaključane revizije. Granice su 100 snimki i 30 MB izvornog JSON-a. Za veći razred odaberi jednu vježbu ili učenika. Radovi se čitaju kroz API i ne pokreću. Oba radio čvora, odgovori i početni mediji ostaju u izvornom formatu.

U detalju točne revizije ili u učeničkom prikazu bodova otvori **Komentari i povijest korekcija / osvježi**. Učenik čita vlastite zapise. Nastavnik dodaje komentar ili korigira ukupan rezultat unutar već objavljenog maksimuma, s najviše dvije decimale. Korekcija traži razlog i čuva autora, vrijeme i originalni rezultat; ne mijenja automatski izvještaj. **Vrati automatsko bodovanje** dodaje novi zapis. Ako je drugi nastavnik u međuvremenu dopunio pregled, najprije osvježi povijest. Stari zapisi ostaju sačuvani i kod novih pokušaja.

Administrator iz izvještaja arhivira cijelu odabranu školsku godinu uz razlog. Pregledi i izvozi ostaju dostupni, nove izmjene razreda i radova zaustavljaju se. Ponovno otvaranje godine ne otključava predaje. Dovršavanje ranije pokrenute provjere smije dodati rezultat njezine izvorne snimke.

### Politika čuvanja radnih revizija

U privatnoj konfiguraciji možeš zadati:

```php
'retention' => ['revision_days' => 90, 'keep_latest' => 10],
```

Politiku uskladi sa školskim rokovima čuvanja. Čišćenje obuhvaća samo arhivirane godine; trajno čuva prvu i zadnje revizije, sve zaključane snimke, komentirane/korigirane revizije te sve snimke s izvještajem ili nezavršenim poslom. Uklanja samo stare međukorake i njihove zamijenjene poslove bez izvještaja. Prije čišćenja izradi provjerenu privatnu kopiju.

```sh
php tools/console.php prune-revisions /srv/labosv2-private/config.php
php tools/console.php prune-revisions /srv/labosv2-private/config.php --apply
```

Prva naredba daje samo pregled i broj mogućih uklanjanja. Druga izvršava isti postupak pod zaključavanjem održavanja i ostavlja događaj u evidenciji. Uobičajen prikaz ne nudi brisanje zaključanih predaja.

### Sigurnosna kopija

Koristi novu datoteku izvan `web/` u privatnoj mapi s ograničenim pristupom. Kopija sadrži hashirane lozinke i učeničke podatke; čuvaj je na zaštićenom disku prema školskoj politici. Naredba ne prepisuje postojeću datoteku. Na Linuxu stvara datoteku s pravima 0600. Kopija obuhvaća sve aplikacijske tablice i sve sadašnje projektne resurse ugrađene u JSON. Može nastati tijekom rada; InnoDB snapshot određuje jednu dosljednu vremensku točku.

```sh
php tools/console.php backup /srv/labosv2-private/config.php /srv/labosv2-backups/kopija-2026-11-15.jsonl
```

Izlaz navodi broj zapisa i SHA-256. Privatni ključ aplikacije i konfiguraciju čuvaj zasebno, izvan repozitorija i javnog paketa. SHA-256 otkriva oštećenje; ne šifrira kopiju. U ovoj inačici nema vanjskih učeničkih datoteka izvan spremljenih projektnih dokumenata.

### Povrat u novu instalaciju

1. Pripremi novu praznu MySQL bazu i ograničeni račun. Raspakiraj istu inačicu programskog paketa. Ciljni web i radnik ostaju zaustavljeni.
2. U zasebnoj privatnoj konfiguraciji odaberi novu bazu, školsku adresu, **izvorni ključ aplikacije** i **novu praznu mapu sesija**. Ne inicijaliziraj novog administratora.
3. Pokreni migracije i povrat:

```sh
php tools/console.php migrate /srv/labosv2-private/povrat.php
php tools/console.php restore /srv/labosv2-private/povrat.php /srv/labosv2-backups/kopija-2026-11-15.jsonl
```

4. Provjeri izlaz, pokreni ciljni web i prijavi se postojećim računom. Usporedi zaključane predaje, hash snimki, bodove i nastavničke zapise s izvornom evidencijom. Tek potom uključi radnik i pristup učenika.

Povrat odbija nepraznu bazu, neodgovarajuće migracije ili ključ, postojeće sesije i oštećenu ili nepotpunu kopiju. Uvoz ostaje jedna transakcija, uz uključene strane ključeve. Raniji izvještaji se čuvaju; nezavršene isporuke provjeravača vraćaju se u red. Stare prijave ne prenose se i korisnici se ponovno prijavljuju. Nema automatskog prepisivanja žive školske baze. Windows koristi iste CLI naredbe uz stvarne lokalne putanje; ciljna Windows provjera ostaje zasebna stavka.

[Opseg, provjere i ograničenja 23H](../docs/stage23h-reports-administration.md). Stvarni školski pilot 23I zahtijeva školsku instalaciju i učeničke uređaje.


## 23I · priprema i mjerenje pilota

Nadogradnja s 23H ne dodaje migraciju. Sačuvaj privatnu konfiguraciju i sesije, zamijeni paket, ponovi postojeći migrate i ponovno pokreni provjeravač.

Na stranici **Školski račun → Školski pilot** otvori obrazac opažanja. Prati upute za mali pilot pa rad razreda; preuzmi JSON zapis za svaki cilj i okruženje. Prazna mjerenja ostaju prazna. Razvojni/sintetski pokus ima vlastitu oznaku i ne potvrđuje stvarni školski prihvat.

Razvojni izvor sadrži test:school-load. Koristi PHP CLI i zasebnu praznu MySQL bazu labosv2_test_* s ograničenim testnim računom, iste testne varijable kao ostale integracije te Linux izolaciju. Ne usmjerava se na školsku adresu ni evidenciju. Actions pokreće pokus za 30 sintetskih učenika, 90 spremanja i 30 neovisno ocijenjenih predaja; rezultat i obnovljeni ZIP čuva kao artefakte 23I.

Na stvarnom školskom Apacheu provedi i zasebnu provjeru točnih resursa i MIME tipova iz razvojnog izvora naredbom school:host, uz LAB_SCHOOL_URL s pouzdanim HTTPS certifikatom. Ta provjera ne zamjenjuje prijavu i školski pilot. [Postupak i granice 23I](../docs/stage23i-pilot.md).


## 24A–24B · zamrznuti uvjeti i ESP32-S3 C++

Izdanje 0.14.0-beta.1 dodaje šest rubrika `24B-…@1`, s provjeravačem `24AB.1`. Nastavnik ih izričito odabire pri novoj objavi zadatka. Postojeći zadaci s rubrikama 23E.1 i 23G.1, zaključane predaje i bodovi ostaju sačuvani. Nema nove SQL migracije.

Nadogradnja zamjenjuje programske datoteke, privatni katalog, `grading/` i `checker/`, uz čuvanje privatne konfiguracije i sesija. Ponovno pokreni radnike. Ne mijenjaj već objavljene redove u bazi.

S3 C++ koristi funkcionalni simulator, a WASM nije firmware za fizičku pločicu. Za novi izvor Linux radnik treba Clang 19.1.7 s odgovarajućim `wasm-ld` i Binaryen `wasm-opt` 120. Uključi `LAB_GRADER_COMPILE=1`; `LAB_WASM_CXX` i `LAB_WASM_OPT` mogu odabrati apsolutne putanje tih alata. Ako su u zasebnom instalacijskom prefiksu, `LAB_S3_TOOLCHAIN` označava zajedničku mapu koja se montira samo za čitanje; pretražuju se njezini `bin/` i `usr/bin/`. Inačice, zaključani core i biblioteke provjeravaju se prije prevođenja.

Bez prevoditelja prihvaća se samo identičan izvor iz instaliranog pouzdanog kataloga. Izmijenjeni izvor ostaje bez bodova uz objašnjenje. Učenikov `s3-build.json` nikad nije izvor službenog rezultata. Pogreška programa razlikuje se od nedostupnog alata i prekoračenja izvršnih ograničenja.

[Potpuni opseg, provjere i otvorene etape](../docs/stage24ab-contract.md). Stvarni školski pilot, Windows posrednik i skupno memorijsko ograničenje ostaju zasebni uvjeti prihvata.

## 24C Analogni ulazi i ADC PWM

Izdanje 0.14.2-beta.1 dodaje osam novih rubrika s provjeravačem 24C.1, ukupno 52/268 kombinacija. Nova ADC/PWM rubrika provjerava stvarni radni omjer kroz raspon, a prethodni digitalni prag ostaje zaseban. NTC, TEMT6000, joystick, plamen, zvuk, LM35/NTC i četiri neovisna ulaza koriste iste izolirane izvršne putove na MicroPythonu S3, S3 C++, Unu i Nanu.

Pri nadogradnji sačuvaj konfiguraciju, sesije i bazu, zamijeni paket, pokreni postojeći migrate i ponovno pokreni provjeravače. Nema nove SQL migracije. Ranije objavljene rubrike, bodovi i zaključane predaje ostaju neizmijenjeni. [Potpuni opseg i provjere](../docs/stage24c-analog.md). Sljedeća etapa je 24D.


## 24D Senzori, CRC i svježina

Izdanje 0.14.2-beta.1 pokriva 80/268 kombinacija. AM2320, DHT11/DHT22, pogreške DHT-a te DS18B20 ROM, razlučivost i pogreške imaju zasebne rubrike na sva četiri cilja. Učenik prije rada vidi rokove, jedinice i kriterije. Početni MicroPython pokus prečestog DHT čitanja treba prilagoditi intervalu senzora.

Nema nove SQL migracije. Sačuvaj konfiguraciju, sesije i bazu, pokreni postojeći migrate i ponovno pokreni provjeravače. Novi dulji senzorski scenariji imaju granice 65 s zidnog i 58 s CPU vremena uz postojeću 180-sekundnu isporuku. [Opseg, provjere i ograničenja](../docs/stage24d-sensors.md). Sljedeća etapa je 24E.

## 24E Enkoder i infracrveno upravljanje

Izdanje 0.14.3-beta.1 pokriva 104/268 kombinacija. Sirovi CLK/DT/SW, dekoder i poskakivanje te NEC impulsi, LED i TX/RX imaju zasebne rubrike na sva četiri cilja. Kriteriji i rokovi su vidljivi prije početka. Novi provjeravač koristi stvarne tragove bridova i električni izlaz; fizički položaj enkodera ne zamjenjuje programski brojač.

Nema nove SQL migracije. Sačuvaj konfiguraciju, sesije i bazu, pokreni postojeći migrate i ponovno pokreni provjeravače. Ranije rubrike i zaključane predaje ostaju neizmijenjene. Novi scenariji zadržavaju 65 s zidnog i 58 s CPU ograničenja. [Opseg i provjere](../docs/stage24e-events.md). Sljedeća etapa je 24F.


## 24G · A4988 i koračni motor

Izdanje 0.14.5-beta.1 uvodi tri rubrike `24G-…@1`, ukupno 144/268 podržanih kombinacija. Broje se valjani STEP impulsi, DIR, svih pet MS načina i stanje translatora. ENABLE HIGH isključuje pobudu motora, dok translator nastavlja brojiti; RESET nije referenciranje fizičke osovine. RESET/SLEEP ignoriraju zadane impulse, a buđenje mora završiti prije novih pogonskih koraka.

Upute prije rada objavljuju motor s 200 punih koraka/okret, napajanje 8–35 V (predložak 12 V), vremenske uvjete i kriterije 3 + 5 + 2 boda. Rubrike za broj koraka i mikrostep provjeravaju tri ciklusa; kontrolna rubrika jedan potpuni slijed s ENABLE, RESET i SLEEP. [Opseg i provjere](../docs/stage24g-steppers.md).

Nema nove SQL migracije. Sačuvaj privatnu konfiguraciju, sesije i bazu; zamijeni paket, pokreni postojeći migrate i ponovno pokreni provjeravače. Nastavnik novu rubriku izričito bira pri objavi zadatka. Sljedeća je etapa 24H.
