# Labos 0.15.1-beta.1 · 25B — radni prostor

Polazište: `8ef91fdc9e6d05e8922f4ef407bf0892560b6b0a`, plan grafičkog uređenja od 18. 11. 2026. Izmjene pripadaju isključivo repozitoriju zljix/labos.

## Izvedeno

- Sklop i kôd čine glavnu radnu površinu. Razdjelnik radi pokazivačem i strelicama (30–70 %, Home/End). Oba se područja mogu zasebno proširiti.
- Datoteke su sklopive i razdvojene na program/upute te pomoćne zapise. Editor prikazuje otvorene datoteke. Promjena prikaza ne premontira sklop ni editor.
- Upute su zaseban panel uz sklop i kôd; pri manjoj širini otvaraju se preko radnog područja, a na mobitelu zasebno. Navigacija vodi do postojećih koraka, bez izmišljanja postotka naučenosti ili zaključavanja odjeljaka.
- Izlaz je početno sklopljen, otvara se pokretanjem ili novom pogreškom. Moguće ga je sklopiti i podesiti po visini (pokazivač/strelice/Home/End). Status izvođenja uvijek vodi u izlaz.
- Katalog je širi, s temama u dva stupca kada širina dopušta. Tema → varijanta → cilj/oprema/način provjere → nova kopija. Odabir druge pločice poništava prethodni pregled, ne otvara projekt sam od sebe. Sačuvane su sve postojeće varijante i uvodne vježbe.
- Nastavnički pregledi dostupni su iz izbornika Nastavnik. Javni nastavnički uzorci i ranija prava pristupa ostaju isti.
- Moj rad razlikuje lokalni izvoz od službene predaje. Školski sažetak zadržava poruku spremanja, reviziju i bodove. Pogreška spremanja, sukob i zaključavanje automatski prikazuju detalje i dostupne radnje oporavka. Potvrda točne revizije i poslužiteljska provjera ovlasti nisu mijenjane.
- Raspored je izdvojen u `src/app/workspace.css`; uklonjena su stara pravila rasporeda iz stilova pojedinačnih komponenti. Povećane su male oznake sučelja; novi projekti počinju s editorom od 16 px. Postojeće postavke ostaju očuvane.
- Školska naslovnica i oznaka izdanja usklađuju se iz package.json pri izgradnji. Nije mijenjan format učeničkih projekata ni identifikator školskog API-ja.

## Provedene provjere

- TypeScript i produkcijska izgradnja; zasebna izgradnja za `/labos/`.
- Projekti, električni spojevi, pet početnih vježbi s WASM izvršavanjem, URS zbirka, školska sinkronizacija, nastavne upute i ugovor prevoditelja: 349 testova. Prvih 15 testova sinkronizacije trebalo je generirani školski katalog; nakon pripreme svih 15 prolazi.
- Tipkovničke kontrole sklopa i spremanje snimki SD/RTC: 3 testa.
- Završni sažetak predaje, bodovanje i prikazi ranijih rezultata: 5 testova. Sažetak predaje ponovljen je nakon generiranja kataloga i prolazi.
- Novi UI testovi: pregled varijante bez otvaranja projekta, promjena cilja, očuvanje potvrđenih bodova/revizije u sažetku, vidljiva pogreška spremanja i zaključana predaja: 2 testa. Pokretanje: `npm run test:workspace`.
- Raspoređivanje vodiča: 13 testova. Pages resursi i postojeće provjere pilotnog paketa: 14 testova.
- Završna izgradnja samostalnog paketa i offline provjera: 8 testova. Ukupno je prošlo 394 ciljane lokalne provjere.
- Ručno u pregledniku: obje teme, katalog i novi MicroPython projekt, upis odgovora, skrivanje/otvaranje uputa uz očuvan odgovor i viewBox sklopa, pomicanje razdjelnika tipkovnicom, namjerna ValueError i uspješno ponovno pokretanje nakon ispravka, otvaranje pripremljenog Uno C++ primjera.
- Prikazi u okvirima 390 × 844, 768 × 1024, 1024 × 768, 1280 × 720 i 1366 × 768: nema vodoravnog prelijevanja cijelog dokumenta. Na mobitelu provjeren prijelaz Upute → Kôd s vidljivim sačuvanim odgovorom.

## Javna objava

Izvorni commit izdanja: `7c9ce3354b99c519d0e9d0077f0543b52734ce4e`. [GitHub Pages izgradnja i objava](https://github.com/zljix/labos/actions/runs/44313317368) završile su uspješno.

Na [javnoj aplikaciji](https://zljix.github.io/labos/) potvrđena je oznaka `0.15.1-beta.1`. Provjeren je i prijelaz sa spremljene verzije `0.15.0-beta.1`: Status aplikacije → Provjeri novu verziju → Spremi i otvori novu verziju. Postojeći projekt ostao je sačuvan; njegovo MicroPython izvođenje, promjena tipkala i odziv LED-ice provjereni su nakon nadogradnje. Ne treba brisati podatke stranice.

[Cjelovita školska regresijska provjera](https://github.com/zljix/labos/actions/runs/44313317331) pokrenuta je za isti izvorni commit. Naknadno je 18. 11. 2026. potvrđen završetak sa statusom **success**. Time je zatvorena otvorena CI provjera prethodnog izdanja; to nije dokaz učeničkog pilota. Prethodno potpuno izvođenje tog postupka trajalo je oko 62 minute. Postupak uključuje PHP/MySQL, neovisno C++ prevođenje, bodovanje, predaju i pakiranje školskog izdanja.

## Granice prihvata

Ovo je tehnička beta dorada. Nije provedena nova end-to-end školska instalacija s pravim PHP/MySQL poslužiteljem u ovom radnom okruženju, stvarni dodir na iOS/Android uređaju, projektor ni učenički pilot. Izvedene UI provjere školskog sažetka koriste simulirane API odgovore; ne zamjenjuju školsku regresiju. Nije dovršeno formalno mjerenje kontrasta svih kontrola ni provjera cijelog tijeka pri 200 % uvećanju. Te točke iz izvornog plana ostaju otvorene.
