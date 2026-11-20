# Stvarni Labos projekti — potvrđen rad bez mreže

Provjera je dovršena 20. studenoga 2026. u 00:25 (Europe/Zagreb).
Testirani commit: `e7cbdc82c115552e93130310e25a683f95571750`, grana
`prototype/arduino-offline-avr`. Dokumentacijski commit koji sprema ovaj
izvještaj nije zasebno testirani izvršni kod.

[GitHub Actions 44637272400](https://github.com/zljix/labos/actions/runs/44637272400),
job `135958883611`: **success**. Svih 16 testova prototipa prošlo je, bez
preskakanja: 6 prevoditelj, 2 Worker, 3 paket, 2 provjera mrežnog prostora
i 3 projektna poveznica. Prošla je i završna provjera u stvarnom Chromiumu.

## Što je potvrđeno

| Provjera | Rezultat |
|---|---|
| Uno i Nano projekti, stvarni WASM C/C++ alati | Prevedeni i izvršeni na vlastitom sklopu |
| Spojena naspram odspojene LED-ice, ista skica | Spojena provodi struju; odspojena 0 mA |
| Izmijenjen izvor, paket ili HEX | Neodgovarajući/oštećeni rezultat odbijen |
| S3, MicroPython, biblioteke, dodatni `.ino`, `src/`, dva čvora | Jasno odbijeni, izvorni projekt ne mijenja se |
| Uvoz stvarnog projekta u izoliranom pregledniku | Bez automatskog pokretanja; pločica i primjeri zaključani |
| Izmjena i prevođenje nakon prekida mreže | Novi rezultat i očekivani serijski ispis; LED 4,64 mA |
| Standardni JSON izvoz | Očuvani sklop, bilješke i stari rezultat; izvor ažuriran |
| Prototipni izvoz i ponovni uvoz | Rezultat provjeren i spreman za ručno pokretanje |
| Neuspješan uvoz preko sučelja | Trenutačni projekt i rezultat ostali nepromijenjeni |
| Potpuni restart preglednika bez mreže | Cijeli projekt očuvan; ponovno izmijenjen izvor preveden i izvršen |
| Desktop i prikaz na 390 px | Snimke pregledane; bez vodoravnog prelijevanja |

Prošla je i ranija baterija mrežno izoliranih provjera: Uno/Nano Blink,
zasebne C/C++ datoteke, pogreška koja odbacuje stari HEX, prekid i nastavak,
očuvanje nepovezanih spremišta. Ukupno je zabilježeno 10 uspješnih prevođenja
u izoliranoj fazi. Predmemorija i profil nisu čišćeni između faza.

Lokalna regresijska provjera `verification/project.test.ts`,
`verification/circuit.test.ts` i `verification/arduino.test.ts`:
37 prolaza, 0 pogrešaka, 4 preskočena opcionalna testa Arduino CLI-ja.
Preskočeni testovi nisu uračunati u prolaze. Zapis je
[regression.txt](evidence-04/regression.txt).

## Sačuvani dokazi

- [prepare.json](evidence-04/prepare.json) i [isolated.json](evidence-04/isolated.json)
  izdvojeni su iz zapisnika istog CI posla. Oba imaju `success: true`.
- Chromium `151.0.7922.34`, Linux mrežni prostor `net:[4026532300]`, samo
  isključeno sučelje `lo`, bez HTTP poslužitelja u izoliranoj fazi.
- Identitet paketa ostaje `432c0f5357f4909a814c6d58d9bb8989a8173d0039379172c71457bf38e353d1`.
- [Actions artefakt 14583919142](https://github.com/zljix/labos/actions/runs/44637272400/artifacts/14583919142)
  sadrži izvještaje i snimke, 333211 B; rok čuvanja 30 dana.
- ZIP je preuzet i SHA-256 lokalno potvrđen:
  `4e88850984456a22d1513fec6460621fd63205a45ecb9d2eb34ecd1614a504c2`.

Najveći uzorkovani zbroj RSS-a potomaka testnog procesa iznosio je
1357416 KiB (oko 1,29 GiB), 90 uzoraka u razmacima od 200 ms. To može
višestruko brojiti dijeljene stranice, isključuje Node host i nije stroga
gornja granica ni jedinstvena fizička memorija. Prikaz na 390 px nije
test fizičkog mobitela. CI profil koristi `--no-sandbox`; ova provjera
potvrđuje zasebnu OS mrežnu izolaciju, ne Chromiumov vlastiti sandbox.

## Stanje nastavka

Projektna poveznica u prototipu dovršena je i provjerena. Ne prepisuje
`avr-build.json`, ne mijenja postojeći Arduino CLI ugovor i ne uvodi
prototipne rezultate u školsko bodovanje. U standardnom Labosu izmijenjeni
izvor i dalje treba prevesti podržanim prevoditeljem.

Slijede podrška bibliotekama i stvarnim vježbama te integracija u glavno
sučelje s izričitim odabirom paketa i ugovorom rezultata. Prije javne objave
ostaju uvjeti distribucije upstream alata i mjerenja na školskom računalu
i fizičkim mobitelima. `labosv2` nije mijenjan.
