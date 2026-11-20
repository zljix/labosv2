# Potpuna mrežna izolacija — uspješna CI provjera

Provjera je dovršena 20. studenoga 2026. u 00:14 po vremenu Europe/Zagreb.
Ovo potvrđuje rad izoliranog prototipa, ne integraciju u glavni Labos.

## Podrijetlo dokaza

- Testirani commit: `475416c93db67e12db909112fb27dd59faa7a0d4`.
- Grana: `prototype/arduino-offline-avr`, repozitorij `zljix/labos`.
- [GitHub Actions run 44635627325](https://github.com/zljix/labos/actions/runs/44635627325), job `135953250339`: **success**, svi koraci prošli.
- Chromium: `151.0.7922.34`, Ubuntu 22.04 CI host.
- Paket SHA-256: `432c0f5357f4909a814c6d58d9bb8989a8173d0039379172c71457bf38e353d1`.
- [Artefakt s izvještajima i slikama](https://github.com/zljix/labos/actions/runs/44635627325/artifacts/14583922299): `AVR-offline-proof-475416c93db67e12db909112fb27dd59faa7a0d4`, 313258 B.
- SHA-256 artefakta prema Actions metapodacima: `dae11e592b7f37ba11e9d129efeb70bd3df9618b4439baa0f5442a4d1e715c66`.

Artefakt ima rok čuvanja 30 dana. JSON izvještaji iz zapisnika istog posla
trajno su spremljeni uz izvorni kod: [prepare.json](evidence-03/prepare.json)
i [isolated.json](evidence-03/isolated.json). Oba imaju `success: true`, isti
identitet paketa i prazan popis pogrešaka. Dokumentacijski commit koji
sprema ove dokaze nije commit na kojem su testovi izvršeni.

## Rezultati

| Provjera | Rezultat |
|---|---|
| Jezgre, Worker, paket i validacija mrežne izolacije | 13/13 testova |
| Zaseban mrežni prostor procesa | Priprema `net:[4026531840]`; izolacija `net:[4026532199]` |
| Dostupna mrežna sučelja u izolaciji | Samo `lo`, isključen; HTTP poslužitelj nije pokrenut |
| Potpuno zatvoren i ponovno pokrenut Chromium, isti profil | Aplikacija učitana iz service workera; izvor i paket očuvani |
| Novi Blink i promijenjene zasebne C++ i C datoteke | Uno i Nano prevedeni i izvršeni u simulatoru bez mreže |
| Sintaksna pogreška | Stari HEX odbijen |
| Prekid prevođenja | Sljedeće novo prevođenje uspješno |
| Drugi potpuni restart preglednika u izolaciji | Još jedan novi izvor preveden i izvršen |
| Nepovezani CacheStorage i localStorage zapisi | Očuvani; profil nije čišćen |
| Prikaz na 390 px | Bez vodoravnog prelijevanja; nije test fizičkog mobitela |

Novi izvori nastaju tek nakon ulaska u mrežnu izolaciju, s jedinstvenom
oznakom `5e74ea12264c4012a9904a1285c339b9`. Zabilježeno je osam uspješnih
prevođenja u izolaciji, od 1041 do 2189 ms, uz provjere novog HEX-a i
očekivanog simuliranog ponašanja. To su mali testni programi na CI hostu;
trajanja ne predstavljaju sve vježbe ni školska računala.

Izolacija se temelji na Linux mrežnom namespaceu za preglednik i njegove
potomke, uz dodatni Playwright offline način. Nije izvedena samo gašenjem
poslužitelja ili promjenom `navigator.onLine`. Postupak je u
[ISOLATED-TEST.md](ISOLATED-TEST.md), a izvršivi test u
[isolated-browser-test.mjs](isolated-browser-test.mjs).

## Memorija i granice

Najveći uzorkovani zbroj RSS-a potomaka testnog procesa bio je 1395008 KiB
(oko 1,33 GiB), iz 124 uzorka svakih 200 ms. Zbroj može višestruko brojiti
dijeljene stranice i ne uključuje Node testni host. To nije točna jedinstvena
fizička memorija, mjerenje samo Workera ni zajamčena gornja granica potrošnje.
Ne dokazuje prihvatljivu potrošnju na i5-6600/8 GB ili fizičkom mobitelu.

CI počinje na svježem hostu; profil se zatim čuva između svih faza. Ranija
provjera nadogradnje prototipa 01 na 02 ostaje zaseban dokaz u EVIDENCE-02.md.
Chromium u namjenskom CI profilu koristi `--no-sandbox`; ova provjera ne
potvrđuje rad njegova vlastitog sandboxa.

## Preostali rad

1. Razjasniti uvjete redistribucije upstream recepta i dovršiti pripadajući
   komplet izvora/obavijesti za konkretno javno izdanje. Pregledani upstream
   commit nema LICENSE datoteku; vlastita izgradnja Arduino jezgri ne
   predstavlja ponovnu izgradnju GCC-a/binutilsa ili zatvorenu provjeru licenci.
2. Izmjeriti trajanja i memoriju na školskom računalu i fizičkim mobitelima.
3. Integrirati kontrolirane pakete i novi ugovor rezultata u aktualni Labos,
   provjeriti biblioteke i stvarne vježbe, zatim pripremiti objavu na `labosv2`.

Potpuna mrežna izolacija i restart preglednika više nisu otvorene stavke
za ovaj Linux/Chromium prototip. Glavna aplikacija i `labosv2` nisu mijenjani.
