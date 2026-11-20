# Prototip 01 — arhivirani rezultati

Aktualno stanje: [prototip 02](EVIDENCE-02.md). Ovaj dokument čuva
ranije provedene provjere i tadašnja otvorena pitanja.

Status: prevođenje i simulacija potvrđeni u testnom runtimeu i stvarnom
pregledniku uz ugašen poslužitelj, uključujući ponovno pokretanje browsera.
Potpuno isključena mreža ostaje otvorena. Ovo još nije beta za učenike.
Polazište: Labos 0.15.7-beta.1 (`b5bc95895b4d725dc2a6717ea1f33a3c7144f1b1`).
Buduće odredište objave nadograđenog Labosa je **labosv2**.

## Prošlo

| Provjera | Rezultat |
|---|---|
| Stvarni WASM GCC/binutils → AVR HEX | Uno i Nano |
| Blink i Serial u postojećem Labos AVREngine | Obje pločice; GPIO D13 i LED na D9 |
| Funkcija iz helper.cpp + helper.h | Obje pločice; `REZULTAT=42` |
| Zasebna C datoteka (cc1, ne C++ zamjena) | Obje pločice; `42` |
| Novi izvor uz zabranjen fetch u Node testu | Novi HEX, `UNIQUE_7391`, odgoda 73 ms |
| Sintaksna greška | Prijavljena `main.ino:2` |
| Nedefinirana funkcija pri povezivanju | Odbijena izgradnja |
| Promijenjen izvor, pločica/profil, oštećen HEX | Rezultat odbijen |
| Stvarni izgrađeni browser Worker u VM adapteru | Prevođenje + simulacija, bez mrežnog fetch-a |
| Oštećeni JavaScript u adapteru predmemorije | Odbijen prije izvršavanja |
| Postojeći testovi projekta/sklopa | 29/29 |
| Postojeći AVR testovi | 15/15 nakon lokalne izgradnje aplikacije |
| TypeScript + produkcijska izgradnja Labosa | Prošlo; postojeće upozorenje o velikim JS dijelovima |
| Novi testovi prototipa | 4/4 + 2/2 Worker adapter + 2/2 upravljanje paketom |
| Stvarni browser, Uno/Nano C i C++ | Prevedeno i izvršeno uz ugašen preview poslužitelj |
| Novi browser izvor, interval 73 ms | Nova poruka i HEX, 16 promjena D13 u 1,2 s |
| Browser pogreška i ručni prekid | Nema pokretanja prethodnog programa |
| Promjena tijekom browser prevođenja | Posao prekinut, pokretanje onemogućeno |
| Zatvorena pa otvorena nova kartica | Izmijenjeni izvor i komprimirani paket očuvani; novo prevođenje uspijeva |
| Izlazak iz Chromiuma i ponovno pokretanje | Izvor, Nano odabir i paket očuvani; novi program 61 ms preveden i izvršen uz ugašen poslužitelj |
| Oporavak nakon stvarnog `Quota exceeded` | Nastavak komprimiranjem bez brisanja predmemorije |

Prvi pokušaj postojećeg AVR testa produkcijskog paketa koristio je preuzeti
Pages `dist` s prefiksom `/labos/`, a test traži korijenski `/assets/`.
Nakon standardnog lokalnog builda svih 15 testova prolazi. Izvedeni `dist`
i datoteka starog mjerenja vraćeni su na početno stanje; nisu dio prototipa.

## Izmjerena vrijednost, bez ekstrapolacije na školsko računalo

Raspakirani alati i SDK: **63.419.317 B (60,48 MiB)**. Nova distribucija i
predmemorija čuvaju gzip podatke, ukupno približno **17 MiB**, bez shell
aplikacije i licencnih dokumenata. Točne duljine su u `packed-manifest.json`.
U browseru je ukupno zauzeće ove adrese nakon nastavka pripreme iznosilo
20,0 MiB (uključuje postojeće verzije shell aplikacije), prije toga djelomični
nekomprimirani paket zauzimao je 39,8 MiB i prijavio `Quota exceeded`.
Nijedna predmemorija nije obrisana. Postojeći vlastiti zapisi provjereni su
i zamijenjeni komprimiranim sadržajem na istom ključu.

U testu adaptera s granicom 50 MiB uspješno je nastavljena djelomična priprema:
38.528.794 B → 17.820.519 B, jedina preuzeta datoteka `sdk.bin.gz`, nula
brisanja. Ta granica je scenarij testa, ne tvrdnja o stvarnoj kvoti browsera.
SDK i dalje sadrži neke nepotrebne pločice/biblioteke; izdvajanje samo
Uno/Nano sadržaja je zaseban korak.

U Node v24.22.3/Linux šest programa prevedeno je za **589–1229 ms** po
programu u tom pokretanju. U stvarnom browseru opaženo je 966–2067 ms za
prikazana prevođenja; to isključuje provjeru/raspakiravanje paketa prije samog
prevoditelja. Prvo preuzimanje nije vremenski izmjereno. Podaci i serijski
ispisi nalaze se u `node-evidence.json` i `browser-evidence.json`.

Primjer Blink koristi 2766 B Flash-a i 216 B statičkog SRAM-a. Izmijenjeni
interval 73 ms daje prvi `OFF 72`, zatim `ON 146`, u skladu s rezolucijom
Arduino millis()/delay(). Potrošnja memorije browsera i vršna potrošnja
Worker procesa **nisu izmjerene**. Nema tvrdnje o i5-6600, iPhoneu ili Androidu.

## Nije još potvrđeno

- Potpuno isključena mreža uz promjenu izvora i ponovno pokretanje preglednika.
- Prekinuto ažuriranje između različitih verzija alata, fizički mobiteli i školsko računalo.
- Očuvanje zasebnih postojećih učeničkih projekata tijekom buduće integracije
  u glavnu aplikaciju; ovaj prototip koristi vlastito spremište.

`browser-test.mjs` je automatizirana puna matrica, ali ta skripta nije
označena uspješnom: lokalno pokretanje Chromiuma blokira Unix socket politika.
Nakon korisnikova odobrenja otvoren je podržani pregled na
`http://127.0.0.1:4173/` i ručno su provedeni gore zabilježeni browser koraci.
Za mrežni offline prekidač pokušano je otvaranje DevTools, no browser je
prikazao organizacijsku zabranu. Ona nije zaobiđena. Umjesto tvrdnje o
mrežnoj izolaciji zabilježen je uži, provedeni test: preview poslužitelj
zaustavljen je naredbom `sites-preview stop`, a pripremljena aplikacija,
novi izvori i ponovno otvaranje kartice radili su iz pohranjenih podataka.
Mrežni status browsera ostao je uključen; drugi mrežni resursi nisu blokirani.

Dodatna provjera 19. 11. 2026.: iz Chromiumova izbornika odabran je **Exit**;
popis prozora zatim je bio prazan. Pokretanje kroz desktop aplikaciju otvorilo
je preglednik bez dostupne spremljene aplikacije; taj pokušaj nije dokaz gubitka
predmemorije izvornog testnog profila. Ponovno otvaranje kroz podržani upravljani
preglednik vratilo je spremljeni Nano izvor `NANO_PONOVNO_7391`, odabir pločice
i provjeren paket. Poslužitelj je cijelo vrijeme bio zaustavljen.
Tek nakon ponovnog pokretanja izvor je promijenjen u `NAKON_RESTARTA_6193`
s intervalom 61 ms. Novo prevođenje trajalo je 1072 ms: Flash 2742 B,
statički SRAM 216 B; simulacija je prikazala novu poruku i 19 promjena D13
u 1,2 s. Detalji i HEX hash su u polju `restart` datoteke
`browser-evidence.json`. Predmemorija nije brisana. To potvrđuje ponovno
pokretanje uz nedostupan poslužitelj, ali ne i punu mrežnu izolaciju.

## Sljedeći korak

1. Dovršiti punu mrežnu izolaciju, uključujući restart browsera bez mreže,
   u dopuštenom testnom okruženju.
2. Izgraditi i zaključati zasebne Uno i Nano jezgre: kandidat sada ima zajedničku
   Nano jezgru, dok se skice prevode zasebnim makroima i pin-varijantama.
3. Provjeriti podrijetlo/reprodukciju i izvore za vlastiti distributivni paket.
4. Nakon dokaza izvedivosti integrirati u aktualni Labos s novom verzijom
   ugovora rezultata i kontroliranim upravljanjem paketima; objava ide na labosv2.

Za nastavak nisu potrebni izmjene glavne grane ni brisanje predmemorije.
