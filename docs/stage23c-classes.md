# Etapa 23C · razredi i dodijeljene vježbe

**0.13.2-beta.1 · 15. studenoga 2026.** Polazište je objavljena etapa 23B, `zljix/labosv2@26cdf30f7a74b58dc37d67233da6bbbc03a96d52`. Izvorni plan školskog sustava i postojeće URS/LV numeracije ostaju sačuvani.

## Isporuka

- Školske godine i jedinstveni razredi po godini. Nastavnik stvara vlastiti razred; administrator dodjeljuje nastavnike.
- Pregled članova, uklanjanje članstva bez brisanja računa i neposredna provjera prava svakog API poziva.
- CSV uvoz do 100 učenika i 60 kB: UTF-8/BOM, zarez ili točka sa zarezom, pregled radnji i izričita potvrda postojećih identiteta. Uvoz ne resetira postojeće lozinke. Pregled je HMAC-om vezan uz podatke, identitete, razred i nastavnika te istječe nakon 10 minuta. Sve se promjene potvrđuju u jednoj transakciji.
- Pozivni kod s istekom, ograničenjem uporabe i opozivom, spremljen kao HMAC. Registracija stvara samo učenika; nastavnik zasebno provjerava identitet i prihvaća članstvo. Neodobren učenik nema pristup razrednim dodjelama.
- Privatni katalog iz postojećeg URS izvora: 18 tema, 67 varijanti i 268 početnih projekata za četiri cilja. Izvedene kopije zadržavaju kod, stvarne veze, upravljačke datoteke, prijevode, početne medije i oba čvora kada postoje.
- Objavljene inačice uputa, opisnih ili planiranih bodovnih kriterija i svih pripadnih početnih projekata kopiraju se u MySQL. Naknadna izmjena kataloga ili nova rubrika ne mijenjaju staru inačicu.
- Dodjela točne inačice razredu, pločici/jeziku i opcionalnom roku, uz zasebno upravljanje dostupnošću. UTC pohrana i prikaz Europe/Zagreb; rok u 23C ne zaključava rad.
- Učenikov pregled dostupnih dodjela i kriterija prije rada. Otvaranje u laboratoriju stvara novu lokalnu kopiju i ne pokreće program. Školske upute i kriteriji ostaju dostupni u simulatoru. Uvezeni neispravan lokalni zapis nije autoritet i ne ruši simulator.
- Dopunjeni školski paket, nova migracija `003_classes_tasks.sql`, upute za nadogradnju i provjere u Actionsu i za pull requestove.

## Provjere

| Skup | Rezultat | Značenje |
| --- | --- | --- |
| Regresija računa 23B | 16/16 zapisa, 15 scenarija | Stvarni PHP/MySQL, migracije, sesije i ovlasti |
| Razredi i zadaci 23C | 17/17 zapisa, 16 scenarija | CSV, identiteti, prava, kodovi, konkurentno posljednje mjesto, tri pilot-dodjele, nepromjenjive inačice |
| Korisnički tijek portala | 5/5 zapisa, četiri scenarija | Stvarni moduli, DOM i stvarni API: nastavnik → razred → uvoz → dodjela; učenik → promjena lozinke; registracija → potvrda članstva |
| Zamrznuti katalog | 2/2 testa | Jedan prolazi svih 268 predložaka: novi lokalni ID, točan cilj, neizmijenjeni izvori/sklop/oba čvora i ZIP ponovno otvaranje; drugi provjerava neispravne lokalne oznake |
| Ciljana regresija simulatora | 341/341, bez preskakanja | Projekti, sklopovi, vodovi, raniji lokalni pregled razreda i svih 268 URS kombinacija |
| Školski paket | 2/2 | Svaka datoteka odgovara inventaru, privatni katalog i SQL ostaju izvan weba; API nije u offline predmemoriji |
| Pages | 8/8 | Podputanja, resursi, offline opseg i poveznice portala |
| Izgradnja i statička provjera | Prolazi | TypeScript, Vite, PHP sintaksa, YAML i shell sintaksa workflowa |

Zapisi stvarnih API i DOM provjera su u `stage23c-evidence/accounts.tap`, `classes.tap` i `portal.tap`. Nadređene testne grupe nisu dodatni korisnički scenariji. Kataloški prolazak i URS regresija dijelom se preklapaju i ne zbrajaju se u tvrdnju o različitim provjerama. Nova potpuna regresija svih povijesnih izvršnih pokusa nije provedena.

Provjereno je u razvojnom Linux okruženju uz PHP 8.4.24 i stvarni MySQL Community Server 8.4.7, s tri odvojene prazne baze i ograničenim sintetskim računom. Integracijski API koristi izričit loopback profil. Privatna konfiguracija, sesije i lozinke nisu uključene u paket ili Git. Korištene zakrpe evidentiraju razvojni pokus, a ne preporuku za ostanak na staroj zakrpi.

UI scenariji izvršavaju stvarne module portala kroz jsdom uz stvarni PHP/MySQL API. Dokazuju događaje, stanja, obrasce, uloge i tekstualno prikazivanje unosa; nisu vizualni pokus Chromea, Safarija, mobilnog uređaja ili školske mreže. Lokalno pokretanje preglednika bilo je ograničeno okruženjem, pa se ne proglašava provedenim. Stvarni LAN/HTTPS, Windows, ciljni mobiteli i razredni pilot ostaju odvojene otvorene provjere.

## Granice i sljedeći posao

Etapa 23C ne uključuje središnje radne pokušaje, automatsko spremanje u bazu, nastavničko praćenje rada uživo, službeno bodovanje ni zaključavanje. Broj 268 označava dostupne početne kombinacije, a ne 268 provjerenih rubrika. Planirani bodovi rubrike jasno su odvojeni od osvojenih bodova. Postojeći dokaz 23A ostaje `feasibility-only`.

Odabrane pilot-varijante za dodjelu su postojeće **URS01 / Tipkalo (`gpio/button`)**, **URS01 / ADC i PWM (`gpio/adc`)** i **URS03 / BMP280 I2C (`weather/bmp280`)**. Druga varijanta sada otvara izvorni ADC/PWM primjer; pretvorba u zadatak analognog praga i funkcionalna rubrika pripadaju 23E i ne tvrde se implementiranima.

Slijedi **23D: poslužiteljski pokušaji i nepromjenjive radne revizije, autosave, povrat na drugom računalu, sukobi dviju kartica, status veze te skupni nastavnički pregled posljednje spremljene snimke**. Potom slijede 23E i 23F. Bez mreže učenik u ovoj isporuci radi na lokalnoj kopiji i prenosi je ZIP/JSON izvozom.

Instalacija, ovlasti, potpuni korisnički postupak i nadogradnja s 23B: [školske upute](../school/README.md).
