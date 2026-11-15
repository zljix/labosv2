# Etapa 23I · priprema i mjerenje školskog pilota

**0.13.8-beta.1 · 15. studenoga 2026.** Polazište je objavljena 23H, daef77b. Ovo izdanje dodaje ponovljiv razvojni pokus za 30 učenika i zapis stvarnog školskog pilota. Stanje izdanja ostaje beta. Stvarni školski prihvat nije proglašen dovršenim.

## Što je dodano

Na **Školski račun → Školski pilot** dostupan je obrazac school-pilot.html. Zasebno bilježi razvojni pokus, mali pilot i stvarni razred. Za odabrani cilj čuva okruženje, broj učenika, 14 provjera, mjerene vrijednosti i zaključak. Nije provjereno, prošlo, nije prošlo i blokirano ostaju različita stanja. Svaka zabilježena provjera traži opis postupka i rezultata.

JSON se preuzima i može ponovno uvesti. Prazan obrazac ostaje nacrt; prazna mjerenja ostaju null, a izmjerena nula ostaje 0. Uvezeni zaključci i oznake autoriteta ne zamjenjuju izvorna opažanja. Uvoz ne pokreće učenički program niti mijenja službenu evidenciju. Obrazac ne šalje sadržaj poslužitelju. Koristi oznake bez osobnih podataka; za drugu platformu ili cilj napravi zaseban zapis.

Usklađene su zastarjele oznake etape u simulatoru i PHP livenessu. HTTPS provjera ranije je još očekivala 23B i isključeno službeno bodovanje, što nije odgovaralo već objavljenom API-ju. Sada uspoređuje aktualni profil i značajke. Liveness i dalje potvrđuje samo odgovor PHP handlera; ne prikazuje DSN, dijagnostiku baze ni tvrdnju da su prijave spremne.

## Razvojni pokus 30 + 1

Naredba npm run test:school-load prihvaća samo zasebnu praznu bazu labosv2_test_*. Nema argument za školsku URL adresu i ne radi nad učeničkom evidencijom. Pokreće privremeni lokalni PHP s četiri radnika i koristi stvarne migracije, račune i API, bez zamjenske baze ili lažnih bodova.

Pokus stvara jednog nastavnika i 30 sintetskih učenika, provodi istodobnu prijavu i otvaranje pokušaja te tri vala po 30 spremanja. Tijekom spremanja nastavnik traži skupni pregled; nakon pet sekundi provjerava svih 30 potvrđenih revizija. Svaki izvor i hash ponovno se čita kroz ovlašteni API. Slijede drugo računalo, odbijanje zastarjele revizije, val 30 završetaka, ponovljeni zahtjevi izgubljenog odgovora i odbijanje kasnog spremanja.

Dva privatna provjeravača zatim neovisno izvode svih 30 završnih MicroPython tipkalo/LED snimki. Bodovi, hashovi i točna predaja uspoređuju se s nastavničkim pregledom i cjelovitim izvozom. Stari čekajući poslovi zamijenjeni su novijima, a završni val mora dati točno 30 izvještaja uz 30 zaključanih predaja.

Pokus mjeri API odgovore, opaženu vidljivost revizija, zadržavanje završnih poslova u redu i trajanje završnog vala. Percentili koriste najbliži viši rang: sortiraj uzorke i odaberi mjesto ⌈0,95 × N⌉. Provjeravači se namjerno pokreću nakon završetka; taj red uključuje čekanje zaustavljenog radnika i ne dokazuje cilj od 15 sekundi pri uobičajenom radu. Ciljevi vremena bilježe se kao ostvareni ili neostvareni u tom okruženju; točnost i integritet obvezni su za prolaz testa.

Rezultat nastaje u docs/stage23i-evidence/load.json. Actions čuva dokaz i obnovljeni školski paket. Isti pokus ponovi na izdvojenom testnom profilu školskog hardvera; razvojni rezultat nije mjerenje Apachea, mreže, browser uređivanja ili ukupne cgroup potrošnje.

## Stvarni školski pilot

1. Instaliraj paket na odvojeni školski testni profil i sačuvaj privatnu kopiju. Ponovi migracije; 23I ne dodaje novu SQL migraciju. Provjeri inventuru, stvarni MySQL, HTTPS i certifikat s učeničkog računala. Pokreni postojeću provjeru WASM-a i radnika na stranici Školski račun.
2. Provjeri povrat kopije u novu praznu instalaciju. Usporedi prijavu postojećim računom, hashove, zaključane predaje, izvorne i nastavničke bodove, oba radio čvora i početne medije.
3. Na Linux servisu postavi i izmjeri ukupno memorijsko ograničenje. Dosadašnji limit adresnog prostora pojedinog procesa nije zamjena za cgroup limit cijelog servisa. Odaberi broj radnika tek nakon mjerenja završnog vala.
4. Pripremi razred i tri pilot-vježbe s postojećim objavljenim rubrikama: tipkalo → LED, analogni prag → LED i BMP280 I2C. Provjeri da je odabrani cilj podržan. Za novi Arduino izvor uključi već pripremljeni izolirani lokalni prevoditelj.
5. Provedi mali pilot s nekoliko učenika: prijava, spremanje, praćenje nastavnika, prekid veze, nastavak na drugom računalu, sukob kartica, bodovi, zaključavanje i jedna dorada. Za svaku prepreku zapiši korake i stvarni rezultat.
6. Nakon uklanjanja prepreka ponovi s razredom do 30 učenika i jednim nastavnikom. Mjeri spremanje i pregled zasebno od bodovanja; ponovi i zajednički val završetaka.
7. Posebno provjeri Windows te ciljane mobilne uređaje i preglednike. Sužen Chromium prikaz potvrđuje samo raspored te izgradnje; ne potvrđuje Safari/iOS ili Chrome/Android.

| Mjera | Cilj prvog školskog profila |
| --- | --- |
| Spremanje, 95. percentil | do 2000 ms |
| Skupni pregled, 95. percentil | do 2000 ms |
| Vidljivost potvrđene revizije nastavniku | do 10000 ms |
| Potvrda bodova pri uobičajenom radu | cilj do 15000 ms |
| Završni val od 30 predaja | izmjeriti zasebno i odrediti kapacitet |

Za konačni prihvat potreban je cjelovit tok bez gubitka rada i pogrešnog vezivanja rezultata. Ako neki cilj nije ostvaren, zadrži dokaz, ukloni uzrok i ponovi tu provjeru. Ne pretvaraj tehničku pogrešku u osvojenu nulu.

## Podrška i granice

Službeno bodovanje zadržava šest rubrika / **18 od 268 kombinacija**. Ostalih 250, V1–V5, ESP32-S3 C++ službeni adapter i fizički hardver ovim izdanjem ne dobivaju novu potvrdu. PHP/MySQL radi na školskom poslužitelju; javni GitHub Pages ima simulator, registar i obrazac. Izolirani provjeravač i dalje traži Linux; udaljeni Windows–Linux broker nije dodan.

## Provjere i stanje

Lokalno je prošlo 83 ciljanih provjera projekata, sklopova, vodova, sinkronizacije, završetka, izvještaja i zapisa pilota, te 2 provjere školskog ZIP-a. Pages prolazi 8/8, a korijenski offline paket 8/8. Početno je korijenski offline test pogrešno pokrenut nad Pages podputanjom i prijavio 6 nedostajućih korijenskih putanja; taj je zapis sačuvan u pages-offline.txt. Nakon vraćanja odgovarajuće korijenske izgradnje cijeli offline skup prolazi u offline-root.txt. TypeScript i obje izgradnje prolaze.

Lokalni Chrome nije se pokrenuo zbog zabrane potrebnog Unix socketa. Novi obrazac provjeren je stvarnim modulima u JSDOM-u; to nije vizualni pregled preglednika. Lokalno nisu instalirani PHP/MySQL: stvarni pokus 30 + 1 i ranije integracije pokreću se u Actionsu. Rezultat ponovljene integracije nalazi se u završnom odjeljku. Stvarni školski prihvat ostaje otvoren.


Prvi CI pokus 43753811575 zaustavio je novi testni adapter: odgovor spremanja čitao je izravno umjesto iz json.saved. API je potvrdio spremanje, a test nije preuzeo reviziju i hash. Adapter je usklađen s postojećim API-jem, ovisni scenariji sada staju nakon prve pogreške, a ponovna integracija koristi novu praznu testnu bazu. Neuspjeli zapis ostaje u initial-ci-failure.txt i ne pribraja se prolaznim rezultatima.


Drugi pokus 43754558932 potvrdio je svih 90 spremanja i 30 zaključanih predaja, ali se zaustavio pri dva istodobna privatna preuzimanja reda. Čišćenje isteklih isporuka odvojeno je od rezervacije posla kako ne bi zadržavalo rasponske lokote statusnog indeksa. Samo rezervacija dobiva do četiri pokušaja nakon MySQL deadlocka, uz rollback i kratko čekanje; ostale transakcije, posebno povrat datoteka, ne mijenjaju se. Privatni CLI dijagnosticira samo SQLSTATE i broj pogreške, bez SQL-a ili vjerodajnica. Pokus sada dodatno traži jedinstvene poslove i točno jednu isporuku po poslu.


## Potvrđena integracija i stanje objave

[Cijela integracija 43755386091](https://github.com/zljix/labosv2/actions/runs/43755386091) prošla je za izvor 85732a3e421dcc4cdcb66fbc0ac68001fc9dd3fd. Pokus 30 + 1 potvrđuje 90 ponovnih čitanja izvora, 30 zaključanih predaja, 30 neovisnih rezultata po 10/10 za referentno rješenje, 30 redaka izvoza i jednu isporuku po poslu uz dva radnika. Točna snimka, hash i bodovi odgovaraju evidenciji. Puna prethodna PHP/MySQL regresija, neovisni Arduino prijevodi, povrat kopije i završni paket također prolaze.

| Razvojna mjera | Izmjereno |
| --- | --- |
| Spremanje · 95. percentil · 90 uzoraka | 194,82 ms |
| Skupni pregled · 95. percentil · 7 uzoraka | 18,39 ms |
| Najkasnija opažena vidljivost revizije | 5200,37 ms |
| Završni val do svih bodova · 30 predaja | 7124 ms |

Okruženje: Linux x64, 4 logičke jezgre, približno 16 GB RAM-a, Node 24.22.2, PHP 8.4.27 i MySQL 8.4.7; četiri PHP radnika i dva provjeravača. Radi se o loopback/PHP CLI pokusu jedne MicroPython rubrike. Vrijeme završnog reda ne dokazuje 15-sekundni cilj pri uobičajenom radu jer se provjeravači namjerno uključuju tek nakon zaključavanja. Izvorni rezultat je u stage23i-evidence/load.json; njegova oznaka web izgradnje ee6949041741a9a2 odgovara isporučenom paketu.

[PR #7](https://github.com/zljix/labosv2/pull/7) spojen je u main nakon korisnikove izričite potvrde objave, kao 99154ff61998aebe1cab753a5da31a10dee682aa. [GitHub Pages objava 43756843635](https://github.com/zljix/labosv2/actions/runs/43756843635) uspješno je završila. Javna aplikacija prikazuje 0.13.8-beta.1 · 23I, a obrazac pilota učitava svih 14 provjera. Četiri aktualna web resursa provjerena su preko HTTPS-a prema SHA-256 iz objavljenog manifesta. Obrazac je slikovno pregledan u cloud Chromeu na stolnom prikazu; to ne potvrđuje ciljne mobilne preglednike. ZIP sadrži novu aplikaciju, privatni API, korekciju reda, upute i izvedene dokaze. Prijave, središnje spremanje i službeno bodovanje i dalje zahtijevaju školsku PHP/MySQL instalaciju. Stvarni školski pilot ostaje otvoren.
