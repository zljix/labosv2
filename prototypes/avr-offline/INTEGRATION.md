# Prototip 04 — prevoditelj u glavnom Labos sučelju

Razvojna grana: `prototype/arduino-offline-avr` u `zljix/labos`.
Integracija je uključena samo izgradnjom s `LAB_OFFLINE_AVR=1`.
`main`, javni Pages paket i `labosv2` ne objavljuju se ovim korakom.

## Izgradnja i rad

```sh
npm ci
npm run prototype:avr:build
# Za instalaciju na podputanji postavi i LAB_BASE_PATH=/naziv/.
npm run prototype:avr:integrated
```

Izlaz je razvojni `dist/`. Distribucijski uvjeti iz README i dalje vrijede;
izgradnja nije odobrenje javne distribucije upstream binarnih alata.

U normalnom Labos editoru otvori samostalan Uno/Nano Arduino projekt.
U prozoru **Prevedi** pripremi offline prevoditelj (14,93 MiB). Aplikacija
zasebno priprema svoj standardni offline paket, čiji status provjeri kroz
**Status i offline**. Oba paketa moraju biti spremljena prije prekida mreže.
Alati nisu ponovno uključeni u aplikacijsku predmemoriju: nalaze se u
zasebnoj postojećoj predmemoriji prototipa. Putanje su usklađene i pod
podputanjom aplikacije, a klasični Worker dolazi iz aplikacijskog paketa.

**Prevedi u pregledniku** prevodi aktualne datoteke i odabrane biblioteke.
**Pokreni offline rezultat**, glavni **Pokreni** i **Resetiraj program** koriste
isti provjereni rezultat i postojeći živi AVR simulator. Sklop, serijski
ispis, serijski unos i interaktivni ulazi ostaju u glavnom radnom okruženju.
EEPROM prototipa ima 1024 B i resetira se na 0xFF pri svakom pokretanju.

## Identitet, prekid i spremanje

- Zaseban format `labos-avr-prototype-build` v2 ostaje nepromijenjen.
- Provjeravaju se izvor, pločica, zaključane biblioteke, identitet paketa i HEX.
- Pokretanje prevođenja odmah poništava prethodni odabrani offline rezultat.
  Pogreška ili prekid ne smiju pokrenuti stari HEX niti automatski prijeći
  na postojeći CLI rezultat. Promjena izvora poništava valjanost rezultata.
- Promjena izvora/biblioteka tijekom posla ili zatvaranje prozora prekida Worker.
  Svaki posao ima ograničenje 60 sekundi; kasni odgovor ne može biti prihvaćen.
- Rezultat se čuva odvojeno po projektu. Ne piše se u `avr-build.json` i
  ne mijenja projekt ili njegovu reviziju. Pri svakom pokretanju ponovno
  se provjerava. Ako spremište nije dostupno, sučelje to izričito navodi.
- Izvoz **Izvezi prototipni rezultat** uključuje projekt i rezultat. Uvozi se
  normalnim gumbom **Uvezi** kao zasebna zaustavljena kopija, nakon provjere.
  Standardni ZIP/JSON izvoz ostaje standardni projekt bez prototipnog rezultata.
- Uspješno korištenje školskog/lokalnog prevoditelja vraća projekt na njegov
  postojeći način pokretanja. Školski vezani radovi, službena predaja i
  bodovanje nisu uključeni u prototipni izvršni put.

## Opseg i provjera

Podržane su datoteke u korijenu, jedan main.ino i zaključane biblioteke iz
LIBRARIES.md. Poddirektoriji, dva radijska čvora i ESP32-S3 ostaju izvan
ovog offline prototipa. Funkcije trebaju deklaraciju prije uporabe.

`verification/offline-avr.test.ts` provjerava granice integracije stvarnim
WASM rezultatom te prekid, timeout, nevaljani i zastarjeli rezultat, školske
projekte, podputanju i povratni uvoz. Ranija matrica biblioteka ostaje aktivna.

CI prvo ponavlja postojeći samostalni prototip, zatim gradi cijeli Labos na
`/avr-integrated/`. `integrated-browser-test.mjs` koristi normalni editor,
uvoz, dijalog i konzolu, zaseban trajni profil te potpuni restart u odvojenom
Linux mrežnom prostoru sa samo isključenim loopback sučeljem. Ne briše
predmemorije ni profile između faza. Izvještaji i snimke su CI artefakti.
Provjera commita `a9851df` uspješno je završena, uključujući puni restart
glavne aplikacije bez mreže. Dokazi i točan opseg: [EVIDENCE-06.md](EVIDENCE-06.md).
Sama prisutnost skripte nije potvrda prolaza buduće izmijenjene verzije.

Školski i5-6600, fizički mobiteli i Safari/iOS zahtijevaju zaseban pilot.
Uputa za pripremu, provjera na uređaju i obrazac mjerenja:
[PILOT.md](PILOT.md).
