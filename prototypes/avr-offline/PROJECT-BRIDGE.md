# Uvoz Labos projekta u offline prototip

Status: implementirano i provjereno u mrežno izoliranom Chromiumu.
Točan commit, rezultati i ograničenja: [EVIDENCE-04.md](EVIDENCE-04.md).

Ova razvojna etapa povezuje prototip s postojećim formatom projekta i
stvarnim sklopom. Glavna aplikacija, Arduino CLI ugovor i `labosv2` ostaju
nepromijenjeni. Ovo nije dovršena integracija u glavno sučelje Labosa.

## Postupak

1. U Labosu preuzmi Arduino Uno/Nano projekt JSON.
2. U prototipu odaberi **Uvezi projekt JSON**. Učitavaju se izvorne datoteke,
   a sklop, bilješke i ostale datoteke čuvaju se zajedno s njima.
3. Promijeni izvor, odaberi **Prevedi offline**, zatim **Pokreni simulaciju**.
   Koristi se uvezeni sklop; graf prikazuje samo D13, a struje LED-ica i
   poruke sklopa prikazuju se uz podatke projekta.
4. **Preuzmi projekt JSON** vraća standardni Labos projekt s izmijenjenim
   izvorom. **Preuzmi rezultat prototipa** sprema projekt i prototipni HEX
   u zasebnom formatu koji se ponovno otvara ovdje, bez automatskog pokretanja.

Uvezeni projekt sprema se u postojeći namjenski zapis prototipa, zajedno s
izvorima. Nakon zatvaranja preglednika vraća se projekt, a za nastavak treba
ponovno prevesti program ili uvesti spremljeni rezultat. Ostale predmemorije
i projekti ne brišu se. Stariji zapis prototipa koji sadrži samo izvore i
pločicu i dalje se može učitati.

Pločica i primjeri zaključani su dok je projekt uvezen, da se sklop ne bi
neprimjetno promijenio. **Izdvoji samo izvor** odvaja trenutne izvore od
projekta za daljnje samostalno isprobavanje; prije toga preuzmi projekt ako
želiš zadržati cjelovitu radnu kopiju. Izvorna datoteka odabrana pri uvozu
ne mijenja se.

## Identitet rezultata i granice

- Projekt prolazi stvarni `parseProject` i postojeću provjeru Arduino
  putanja i popisa biblioteka, zatim uža ograničenja prototipa.
- Novi omot je `labos-avr-offline-project`, inačica 1; rezultat unutar njega
  ostaje `labos-avr-prototype-build`, inačica 2, vezan uz paket, pločicu i
  sve izvorne datoteke. To nije Arduino CLI rezultat niti dokaz autorstva.
- `avr-build.json` i datoteke predaje ostaju nepromijenjene. Ako se izvor
  promijeni, stari rezultati više ne odgovaraju izvoru. Glavni Labos i dalje
  zahtijeva prevođenje svojim podržanim prevoditeljem; ovaj prototip ne
  daje pravo na automatske školske bodove.
- Nepodržani projekti odbijaju se prije zamjene trenutačnog rada: S3,
  MicroPython, dva čvora, biblioteke izvan zaključanog popisa, više `.ino` datoteka, `src/`
  putanje ili prekoračena ograničenja. JSON uvoz ograničen je na 2 MiB;
  vrijede i izvorna ograničenja Labos projekta te 32 izvora / 256 KiB prototipa.
- Simulacija je ograničena na odabranih 1,2, 3 ili 5 s bez upravljanja ulazima tijekom izvođenja.
  Projekti s isključenim ili zamijenjenim napajanjem odbijaju simulaciju.
  Prihvat formata projekta nije potvrda rada svih periferija ili vježbi.

## Provjera

```sh
npm run prototype:avr:build
node --import tsx --test prototypes/avr-offline/project-bridge.test.ts
```

Tri testne cjeline provjeravaju stvarno Uno/Nano prevođenje i sklop,
odbacivanje nepodržanih ulaza te povratni izvoz i granice formata. Provjera
sklopa uspoređuje istu skicu sa spojenom i odspojenom LED-icom. Provjerava
se i odbacivanje izmijenjenog izvora, paketa ili oštećenog HEX-a.

CI postupak iz `ISOLATED-TEST.md` dodatno izvodi uvoz, izmjenu izvora,
prevođenje, simulaciju sklopa, oba preuzimanja, ponovni uvoz i potpuno
ponovno pokretanje Chromiuma unutar mrežne izolacije. Izvorni testni projekt
generira Node test prije browser faze. Rezultat CI provjere mora biti
potvrđen zapisnikom za točan commit; sama skripta nije dokaz uspjeha.

Otvoreni ostaju uvjeti distribucije upstream alata, mjerenja na školskom
računalu i fizičkim mobitelima te integracija u glavno sučelje. Podršku bibliotekama opisuje [LIBRARIES.md](LIBRARIES.md).

Prototip 03 preuzima odabir biblioteka iz `arduino-libraries.json`. Izmjena
odabira u sučelju odbacuje stari rezultat i u standardnom izvozu ažurira
samo taj manifest, izvore i metapodatke revizije. Neizmijenjeni manifest
ostaje byte-for-byte očuvan. Ovisnost DallasTemperature → OneWire i
međusobno isključivi U8g2 paketi provjeravaju se prije izgradnje.
