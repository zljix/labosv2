# Prototip 04 — glavni Labos potvrđen bez mreže

Provjera završena 20. studenoga 2026. u 01:32 (Europe/Zagreb).
Testirani commit: `a9851df72c3011179f35695bcc3ad588aad0f783` na grani
`prototype/arduino-offline-avr`, repozitorij `zljix/labos`.
Stablo izvornog koda: `b3bdf49d89f616e0a50be2cfb280ad9154b2e852`;
identično lokalnom kodu prije dokumentacijskih izmjena ovog izvještaja.

[GitHub Actions 44645351464](https://github.com/zljix/labos/actions/runs/44645351464),
posao `135986391785`: **success**, svi koraci prošli. Dokumentacijski commit
koji sprema ovaj izvještaj nije zasebno testirana izvršna verzija.

## Rezultati

| Provjera | Rezultat |
|---|---|
| Ponovljiva izgradnja jezgri, SDK-a i biblioteka | Manifesti i SHA-256 jednaki zaključanim vrijednostima |
| Prevoditelj, Worker, paket, mrežna izolacija, projektna poveznica i biblioteke | 47/47 testova |
| Integracija: identitet, zastarjeli/oštećeni rezultat, prekid, timeout, uvoz, podputanja i izbor prevoditelja | 8/8 testova |
| Sučelje prevoditelja i vidljivost pogrešne kombinacije biblioteka | 2/2 testa |
| TypeScript i integrirani produkcijski build na `/avr-integrated/` | Prošlo |
| Samostalni prototip: novi Uno/Nano C/C++ izvori i biblioteke bez mreže, puni restart | Prošlo |
| Glavno sučelje: uvoz, priprema prevoditelja, prevođenje i živi AVR simulator | Prošlo |
| Izmjena izvora tek nakon prekida mreže | Nova jedinstvena poruka, uspješno prevođenje i upaljena D13 |
| Sintaksna pogreška i glavni gumb Pokreni | Stari rezultat ne pokreće se kao novi |
| Izvoz prototipnog rezultata i povratni uvoz | Validacija i ručno pokretanje uspješni |
| Potpuni restart glavnog Labosa bez mreže | Projekt i rezultat očuvani; dodatno izmijenjeni izvor preveden i izvršen |
| Raspored na 390 px i desktopu | Nema vodoravnog prelijevanja; snimke pregledane |
| Nepovezani localStorage i CacheStorage zapisi | Očuvani; profil i predmemorija nisu brisani između faza |

Ukupno **57 testova**, bez pogrešaka i bez preskakanja, uz dvije zasebne
browser matrice. Glavna browser matrica koristi Uno Blink projekt. Nano,
zasebne C/C++ datoteke i kombinacija AHT10/OLED/Servo prošli su samostalnu
browser matricu; to nije tvrdnja da je svaka biblioteka isprobana kroz sve
kontrole glavnog sučelja. Matrica 14 vježbi × Uno/Nano ostaje provjerena
na stvarnim Labos sklopovima u testnom runtimeu.

## Dokaz stvarne izolacije

Chromium `151.0.7922.34` na Ubuntu 22.04 CI hostu.
Glavna priprema: `net:[4026531840]`; izolirana faza: `net:[4026532257]`.
U izoliranoj fazi postoji samo isključeno sučelje `lo`, bez HTTP poslužitelja.
Navigacija glavne aplikacije provjerena je kao odgovor service workera.
Novi program nastaje nakon ulaska u izolaciju, a ponovno se mijenja i
prevodi nakon još jednog potpunog restarta istog profila.

- [Glavno sučelje — priprema](evidence-06/integrated-prepare.json)
- [Glavno sučelje — izolacija i restart](evidence-06/integrated-isolated.json)
- [Samostalni prototip — priprema](evidence-06/isolated-prepare.json)
- [Samostalni prototip — izolacija i restart](evidence-06/isolated-isolated.json)

Sva četiri izvještaja imaju `success: true` i prazan popis pogrešaka stranice.
CI koristi namjenski profil s `--no-sandbox`; dokaz potvrđuje OS mrežnu
izolaciju, a ne Chromiumov vlastiti sandbox.

[CI artefakt sa snimkama](https://github.com/zljix/labos/actions/runs/44645351464/artifacts/14589190998)
ima 1.004.463 B, rok čuvanja do 20. prosinca 2026. Preuzet je, raspakiran i
provjeren prema SHA-256:
`efdc803261ccb0cda794e97b5c983d6d25362ce805e4ba62309131c956d6c75e`.
Snimke prikazuju pomaknuti sadržaj dijaloga biblioteka; gornje kontrole nisu
na snimci. Njihovo aktiviranje potvrđuje test. To nije test fizičkog mobitela.

## Stanje nastavka

Integracija i osnovni puni offline postupak glavnog Labosa sada su potvrđeni.
Ispravci prihvata uključuju točan odabir konzole, čekanje spremanja/uvoza,
prelamanje mobilnih kontrola i vidljivu poruku o ovisnostima biblioteka.
Paket alata i SDK-a ostaje 15.656.278 B (14,93 MiB), s identitetom
`e5ca9eb29a44c68fcbebe6160d339edc12a13b77d013af8c4c5573c9f2315924`.

Pripremljena je [uputa i obrazac pilota](PILOT.md). Preostaju stvarna mjerenja
na i5-6600/8 GB, zasebne provjere fizičkih mobitela i distribucijski izvori/
obavijesti. ESP32-S3 offline C++ zasebna je sljedeća razvojna faza.
Nije objavljena javna beta; `main` i `labosv2` nisu mijenjani ovim korakom.
