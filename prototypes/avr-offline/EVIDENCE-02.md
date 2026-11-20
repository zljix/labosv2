# Prototip 02 — Uno/Nano jezgre, paket i provjera

> Povijesni zapis druge etape. Naknadna potpuna mrežna izolacija i restart
> preglednika potvrđeni su u [EVIDENCE-03.md](EVIDENCE-03.md). Otvorene stavke
> pri dnu ovog zapisa prikazuju stanje prije te provjere.

Rad je nastavljen s grane `prototype/arduino-offline-avr`, commit `2ced187`.
Glavna aplikacija i `labosv2` nisu promijenjeni. Ovo je provjeren prototip,
ne izdanje za učenike. Buduće odredište nadograđenog Labosa ostaje `labosv2`.

## Izvedeno

- Arduino AVR 1.8.8 izvor provjeren je prema SHA-256 izvornog upstream SDK-a.
- Svaka jezgra izgrađena je zasebno istim WASM C/C++ alatima i asemblerom
  kojima se prevode skice; GNU ar pri razvojnoj izgradnji pakira objekte.
- Uno koristi `standard` / `ARDUINO_AVR_UNO`; Nano `eightanaloginputs` /
  `ARDUINO_AVR_NANO`. Sve naredbe su u `core-build-manifest.json`.
- Dobivene jezgre imaju isti binarni sadržaj (101.464 B po arhivi). To je
  izmjeren rezultat zasebnih izgradnji. Razlike pin-varijanti potvrđene su
  prevođenjem i izvođenjem skica s 6 odnosno 8 analognih ulaza.
- SDK više ne sadrži prekompilirane tuđe jezgre, AVR6/AVR25 biblioteke,
  dodatne Arduino biblioteke ni nepotrebne varijante. Licencni materijali
  zadržani su, uključujući širi izvorni popis komponenti radi podrijetla.
- Ispravljene su opcije za GCC prekide (`-mgcc-isr`) i C++ bez RTTI-ja.
- Format rezultata v2 veže izvor i pločicu uz identitet konkretnog paketa.
- SDK ima ključ prema SHA-256 sadržaja. Isti alati ponovno se koriste pri
  nadogradnji; prethodni SDK i nepovezani podaci ostaju očuvani.

## Rezultati provjera

| Provjera | Rezultat |
|---|---|
| Node: C/C++, Uno/Nano, Blink/Serial, više datoteka | Prošlo |
| Pin-varijante i korisnički TIMER1 prekid | Obje pločice; prekid se izvršava |
| Prekoračenje statičkog SRAM-a / Flash-a | Odbijen rezultat |
| Novi izvor uz zabranjen fetch | Novi HEX i očekivani ispis |
| Sintaksna i linkerska pogreška | Odbijene; izvorna lokacija očuvana |
| Izvor, pločica, paket i HEX identitet | Promijenjeni rezultat odbijen |
| Stvarni browser Worker u Node VM adapteru | Prošlo; fetch zabranjen |
| Oštećen spremljeni JS i gzip / prekoračenje duljine | Odbijeni |
| Nastavak djelomične pripreme pod testnom kvotom 50 MiB | Prošlo; bez brisanja |
| Prekinuto preuzimanje novog SDK-a | Stari SDK očuvan; nastavak preuzima samo novi SDK |
| Postojeći projekt/sklop/IndexedDB testovi | 29/29 |
| Nove i postojeće provjere prototipa | 6 compiler + 2 Worker + 3 paket = 11/11 |
| Potpuna ponovljena izgradnja obiju jezgri | Identičan manifest i svi sažeci paketa |

Ponovljivost je provjerena u istom Node/Linux okruženju; nije potvrda
ponovljivosti na drugim hostovima ni ponovna izgradnja GCC-a/binutilsa.
Datoteka `reproducibility-evidence.json` bilježi konkretni paket.

## Stvarni preglednik, bez čišćenja predmemorije

Na istoj adresi i postojećem profilu prototip 01 prvo se otvorio iz svojeg
service workera. Nakon uobičajenog ponovnog učitavanja otvoren je prototip 02.
Nano odabir i izvor `NAKON_RESTARTA_6193` ostali su očuvani. Priprema novog
SDK-a uspjela je; ukupno zauzeće adrese bilo je 22,7 MiB i uključuje stare
pakete i shell verzije. Nije brisana nijedna predmemorija.

Preview poslužitelj zatim je zaustavljen. Novi Uno program nastao je tek
nakon toga. Nakon zatvaranja i ponovnog otvaranja kartice očuvani su Uno
izvor, pločica i paket; potom je napisan i preveden novi Nano program.

| Program | Prevođenje | Flash | Statički SRAM | Promjene D13 / 1,2 s |
|---|---:|---:|---:|---:|
| Očuvani Nano, interval 61 ms | 1043 ms | 2742 B | 216 B | 19 |
| Novi Uno, interval 83 ms | 928 ms | 2378 B | 204 B | 14 |
| Novi Nano, interval 97 ms | 1055 ms | 2380 B | 206 B | 12 |

Ispisi su bili `NAKON_RESTARTA_6193`, `UNO_JEZGRA_02_83` i
`NANO_JEZGRA_02_97`. Novi Uno/Nano programi sadrže `static_assert` za 6/8
analognih ulaza. HEX sažeci su u `browser-evidence-02.json`.

Mrežni status browsera ostao je uključen. Ovo potvrđuje rad uz nedostupan
poslužitelj, **ne potpunu mrežnu izolaciju**. Zatvaranje kartice nije izlazak
iz cijelog browser procesa. Raniji restart prototipa 01 vodi se odvojeno.
Organizacijska zabrana DevToolsa iz ranije provjere nije zaobilažena.

## Veličina i memorija

SDK je smanjen s 24.890.531 B na vrijednost zaključanu u
`runtime-manifest.json` (približno 7,2 MiB). Cijeli komprimirani izvršni paket
ima približno 14,1 MiB, naspram prethodnih 17 MiB. To ne uključuje shell,
licencnu arhivu ni arhivu Arduino izvora koje build također priprema.

U zasebnom Node procesu za Nano primjer s dvije C++ jedinice izmjereno je:

- C++ WASM linearna memorija nakon alata: 64 MiB.
- Asembler/linker/objcopy: približno 16,2–16,4 MiB po instanci.
- Maksimalni RSS cijelog Node procesa: 479.040 KiB (oko 468 MiB).
- Prevođenje tog primjera: 1627 ms.

To su uzorci linearne memorije na završetku alata i maksimalni RSS testnog
Node procesa, ne vršna potrošnja Worker procesa u browseru. Podaci su u
`memory-evidence-02.json`; ne ekstrapoliraju se na školski i5-6600 ili mobitele.
Stog i dinamička SRAM potrošnja AVR programa nisu uključeni u statički SRAM.

## Izvori i licence

`prototype:avr:sources` preuzeo je i provjerio svih 19 arhiva iz upstream
popisa, ukupno 173.553.201 B. Izvorni `build.sh` i Dockerfile preuzeti su s
točnog commita, uz SHA-256; Dockerfile zaključava Emscripten sliku digestom.
Dokaz je `sources-evidence-02.json`, a izvorni popis `upstream-sources.txt`.
`NOTICE.json` i `licenses.tar.gz` sada imaju zasebne zaključane sažetke.

Ovo je tehnička priprema izvora. GCC/binutils nisu ponovno izgrađeni iz
izvora u ovom okruženju. Pregledani upstream repozitorij nema korijensku
LICENSE datoteku za sam recept; uvjete njegove redistribucije još treba
razjasniti. Grana stoga čuva samo URL-ove/sažetke recepta i vlastiti skript
za lokalno preuzimanje. Javno izdanje još nema zatvorenu provjeru distribucije.

## Točka nastavka

1. Potpuna mrežna izolacija i restart browsera u dopuštenom testnom okruženju.
2. Potvrda uvjeta distribucije recepta i pripadajućeg kompleta izvora.
3. Vršna potrošnja browsera te mjerenja na školskom računalu i mobitelima.
4. Integracija u aktualni Labos s kontroliranim paketima i novim ugovorom
   rezultata, zatim podrška bibliotekama/vježbama i objava na `labosv2`.

Prve dvije provjere ostaju stvarne granice prihvata; ovaj zapis ih ne označava
uspješnima. Razvojni izvor i svi rezultati spremljeni su na grani prototipa.
