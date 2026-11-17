# Dokazi 24P

[Završni CI prihvat](https://github.com/zljix/labosv2/actions/runs/44105942453) uspješno je završio sve obvezne poslove na izvoru `8f9af0defd0a8f02587a10a63288624560745a34`. [Sažetak](acceptance-summary.json) povezuje sve izvedene rezultate i instalacijski paket s provjeravačem `871963f61cce69f6db21f724372ed36f3536e2f71e97e2cab9a75ffe77faf36b`. Povijesni dokazi 24O zadržavaju svoj izvor.

- `input-reliability.json`: 32 sjemena, ispravni i pogrešni V2 algoritmi, ponovljivost i spojevi.
- `interactive-audit.json`: potvrđeni stari vremenski propusti, nove provjere tipkala/regulatora i negativni primjeri širih obitelji.
- `current-matrix.json`: 268 URS kombinacija i pet aktualnih uvodnih zadataka s očekivanim bodovima (tri izvorna C++ LED predloška: 8/10) s profilom, hashom snimke i provjeravača te statusom izvođenja.
- `legacy-matrix.json`: svih 79 prethodno objavljenih rubrika i njihovih izvornih referenci.
- `compiled-s3-cpp.json`, `compiled-uno.json`, `compiled-nano.json`: ukupno 15 svježih izoliranih prijevoda i izvršavanja ispravnih rješenja te vremenskih zamjena.
- `mysql-remediation.json`: stvarni PHP/MySQL tijek dugih Unicode identiteta, bodova, zaključavanja, dorade i oba radio čvora.

## Javna objava

[Labosv2 0.14.14-beta.1](https://zljix.github.io/labosv2/) objavljen je nakon uspješnog [GitHub Pages izvođenja](https://github.com/zljix/labosv2/actions/runs/44110987593).

- [publication.json](publication.json): svih 205 resursa javnog manifesta provjereno je prema stvarnim bajtovima i SHA-256 sažecima; ukupno 207 javnih datoteka s manifestom i service workerom.
- [installer-integrity.json](installer-integrity.json): provjereno je svih 957 inventarnih datoteka i 205 web resursa nepromijenjenog CI instalacijskog ZIP-a.
- [browser-smoke.json](browser-smoke.json): stvarna nadogradnja 24O → 24P u cloud Chromeu, očuvan spremljeni projekt, spreman offline paket i uspješno izvršavanje MicroPythona, GPIO-a, vremenske stanke i framebuf-a.

Stvarni školski pilot, Windows i stvarni Safari/iOS ostaju otvoreni. Nema tvrdnje da ih zamjenjuje cloud Chrome ili simulirani razred.
