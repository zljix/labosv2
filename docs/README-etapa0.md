# ESP32 MicroPython Lab · etapa 0

Tehnički prototip funkcionalne simulacije. Izvršava **stvarni MicroPython 1.29.0 preveden u WebAssembly**. Korisnikov Python izvor ne prevodi se niti prepravlja u JavaScript. Ovo nije emulator ESP32 procesora.

## Pokretanje

Posluži direktorij `dist/` preko HTTP-a ili HTTPS-a, npr. `python3 -m http.server 8080 --directory dist`. Otvori prikazanu adresu. `file://` nije podržan jer preglednik mora učitati ES module, Worker i WASM. Nisu potrebni npm paketi ni pristup CDN-u.

U upravljanom razvojnom okruženju koristi se `sites-preview start /workspace/sites/esp32-micropython-lab`.

1. Odaberi primjer i pritisni **Pokreni**.
2. U primjeru 01 pritiskom virtualnog tipkala mijenja se GPIO5. GPIO4 prati Python program.
3. **Zaustavi** prekida cijeli Worker; **Resetiraj** pokreće sadašnji kod u novom Workeru i otpušta tipkalo.
4. I2C napajanje i zamjena SDA/SCL postavljaju se dok program miruje.
5. **Pokreni 10 provjera** izvršava integracijske testove u stvarnom pregledniku i omogućuje preuzimanje izmjerenog JSON zapisnika.

Promjene editora vrijede pri sljedećem pokretanju. Spremanje projekta, više datoteka i CodeMirror/React sučelje pripadaju etapi 1; editor prototipa namjerno je običan `textarea`.

## Ponovljiva izgradnja interpretera

Potreban je Linux x86_64 s Bashom, Pythonom 3, `curl`, `make`, `gcc`, `tar` i pristupom službenim izvornim arhivama. Skripta preuzima točno određene inačice MicroPythona i Emscriptena; provjerava SHA-256 arhiva, primjenjuje dokumentiranu prilagodbu i provodi čistu izgradnju. SDK zahtijeva približno 2 GB prostora.

```bash
bash scripts/build-runtime.sh
node verification/run.mjs
```

Opcionalno postavi `LAB_BUILD_DIR` za izdvojeni direktorij preuzimanja i `LAB_BUILD_JOBS` za broj paralelnih prevoditeljskih poslova. Ne koristi neprovjereni postojeći izvorni direktorij; za neovisnu izgradnju odaberi novi prazan `LAB_BUILD_DIR`.

Zaključano: MicroPython **v1.29.0**, Emscripten **4.0.15**, vlastita varijanta `lab`, `SOURCE_DATE_EPOCH=1794441600`. Izvorne arhive i njihovi hashovi navedeni su u skripti. Otisci izlaza su u `runtime/SHA256SUMS`. Nisu potrebni Git podmoduli: zamrznuti asyncio paketi isključeni su iz ove male inačice.

## Izvedba

- `runtime/modlab.c`: uski izvorni most prema virtualnim pinovima, I2C echo uređaju i framebufferu; provjerava GPIO i veličine prijenosa.
- `scripts/patch-runtime.py`: mijenja aktivno čekanje u `emscripten_sleep` te poziv `runPython` u asinkroni Emscripten `ccall`. Python funkcije `sleep*` ostaju sinkrone iz učenikove perspektive.
- `dist/machine.py`: izričito ograničena prilagodba `Pin` i `I2C`, odvojena od izvornog ESP32 porta.
- `dist/worker.mjs`: interpreter i modeli dijele jedan Worker; tijekom čekanja Worker obrađuje ulaze.
- `dist/session.mjs`: novi identitet i novi Worker za svako pokretanje, ignoriranje poruka prekinute sesije.
- `dist/host.mjs`: fiksni ispitni sklop i ograničen tok grafičkih promjena.
- `dist/suite.mjs`: ista integracijska provjera za preglednik i Node Worker.
- `boards/`: precizan referentni profil, s izričitom napomenom da korisnikov hardver nije potvrđen.

JSPI, SharedArrayBuffer, COOP/COEP i prepisivanje Python petlji nisu potrebni. Petlja bez čekanja ostaje zauzeta unutar svojeg Workera; prekida se vanjskim `terminate()`.

## Podržani dio API-ja

| Dio | Podrška etape 0 |
| --- | --- |
| GPIO | Samo 4, 5, 8 i 9; `Pin`, `IN`, `OUT`, `PULL_UP`, `PULL_DOWN`, `init`, `value`, `on`, `off`, poziv objekta pina. |
| Vrijeme | Izvorni `time.sleep`, `sleep_ms`, `sleep_us`, `ticks_ms`, `ticks_diff`; čekanje zaokruženo na milisekunde, podložno raspoređivanju preglednika. |
| I2C | `I2C(0/1)`, `scan`, `writeto`, `readfrom`, `readfrom_into`; do 4096 bajtova; nema repeated-starta, registarskog API-ja ni modela električnog vala. |
| Probni I2C uređaj | Echo na 0x38, SDA=8, SCL=9; ne odgovara bez napajanja ili s pogrešnim spojem. Ne oponaša AHT10. |
| `framebuf` | Izvorni modul iz MicroPythona; primjer koristi `MONO_VLSB`, tekst i pravokutnik, te probni `_lab.show` za prijenos 1024 bajta na preglednik. |
| Ostalo | ADC, PWM, IRQ, timeri, mreža, SPI, SSD1306 i servo nisu implementirani. Nepostojeće API-je treba prijaviti pogreškom. |

Za razliku od stvarnog porta, pisanje kroz ulazni `Pin` daje `ValueError`. Ulaz bez izvora ili pull otpornika daje objašnjenu pogrešku. Model nema izračun struje LED-ice ili stvarne električne mreže; to slijedi u etapi 2.

## Resursi i granice

WASM memorija je fiksnih 32 MiB, Python heap 4 MiB. To nisu memorijske vrijednosti emuliranog N16R8 modula. Konzola Workera zadržava do približno 8 KiB između predaja, UI do 24 000 znakova, sesija najviše 400 događaja. Poruke pinova ograničene su na približno 60/s. Nema automatskog vremenskog limita trajanja korisnikove petlje; Stop je dostupan u glavnoj dretvi.

Javni Python moduli `js` i `jsffi` isključeni su pri izgradnji. Python koristi samo Emscriptenov privremeni datotečni sustav i vlastiti uski most. Ovo je dokaz arhitekture, a ne dovršen sigurnosni pregled za javno prihvaćanje nepouzdanih projekata.

## Provjere i nastavak

`docs/results-node.json` i `docs/results-chromium.json` sadrže izmjerene rezultate. Točan opseg preglednika i preostale stavke dokumentirani su na `dist/report.html`.

Jezgra je potvrđena u dostupnom Chromiumu na Linuxu. Safari/iOS, Firefox, Edge i školsko računalo još traže stvarnu provjeru; automatska provjera je dostupna na stranici. Prije konačnog fizičkog pinouta potreban je točan model i revizija korisnikove pločice.

Sljedeća predviđena etapa je 1: React/TypeScript projekt, CodeMirror, format projekta, IndexedDB i uvoz/izvoz. Početni plan i raspored daljnjih komponenti ostaju na snazi.

## Licence

Vlastiti kôd: MIT (`LICENSE`). MicroPython: MIT. Emscripten: MIT / Illinois NCSA. Uključene obavijesti musl i LLVM compiler-rt nalaze se u `dist/licenses/`. Nisu preuzimani grafički prikazi pločica ili dijelovi tuđih simulatora; shematski prikaz u sučelju izveden je vlastitim CSS-om.
