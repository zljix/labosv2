# Odluke etape 0 · 12. studenoga 2026.

## 001 — Referentna pločica, a ne nepotvrđeni fizički hardver

Za razvoj je odabran Espressif ESP32-S3-DevKitC-1-N16R8 v1.1, ESP32-S3-WROOM-1-N16R8, 16 MiB Flash / 8 MiB octal PSRAM, dvije letvice po 22 položaja. Službeni raspored spremljen je kao profil. Oznaka „ESP32-S6” iz početnog zahtjeva nije pretvorena u izmišljenu pločicu. Korisnikova pločica možda nije isti proizvod i mora se potvrditi prije zaključavanja fizičkog prikaza.

Vanjska LED je na GPIO4, tipkalo na GPIO5, probni I2C na GPIO8/9. Ugrađena adresabilna LED v1.1 je GPIO38 i nije obična LED na GPIO4. GPIO35–37 N16R8 varijante nisu raspoloživi za vanjsku upotrebu. U ovoj etapi prihvaćaju se samo četiri navedena GPIO-a.

Izvor: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html

## 002 — Stabilni MicroPython i Asyncify

Osnova je službeni v1.29.0, a ne promjenjiva razvojna grana. Standardni WASM port ima aktivno čekanje u `mp_hal_delay_ms/us`; time Worker ne prima poruke tijekom običnog Python programa. Prilagodba zamjenjuje taj dio `emscripten_sleep` pozivom, a izvršni API čeka asinkroni `ccall` do povratka C stoga. Kôd učenika ostaje običan sinkroni Python.

Razvojni `browser`/JSPI pristup nije izabran kao uvjet. Asyncify ne traži JSPI ni dijeljenu memoriju; GC skeniranje stoga također radi unutar istog asinkronog poziva i posebno je ispitano. Cijena je veći WASM, trošak odmotavanja stoga i milisekundska vremenska preciznost. Oba su primjerena ovom dokazu izvedivosti.

Izvor: https://github.com/micropython/micropython/tree/v1.29.0/ports/webassembly

## 003 — Stop prekida kontekst, Reset stvara novi

Kooperativna obustava ne može sama prekinuti `while True: pass`. Glavna dretva zato poziva `Worker.terminate()` i odbacuje cijeli interpreter. Run i Reset stvaraju novi Worker, čisti heap i zaseban identitet. Poruke stare sesije se ignoriraju. Python `finally` pri prisilnom prekidu nije zajamčen i ne koristi se za čišćenje simulatora.

Preglednikov `terminate()` ne vraća potvrdu uništenja dretve. Izmjerene vrijednosti `stopAwaitMs` u pregledniku označavaju trošak naredbe, dok zasebna mjera `stopToNewProgramCompletedMs` i izvršen novi program potvrđuju oporavak. Node Worker vraća Promise koji se čeka. Ove mjere nisu mjerenje opterećenja ili latencije školskog računala.

## 004 — Dokaz I2C puta odvojen od modela senzora

`machine.I2C` → izvorni `_lab` → JS model radi stvarne transakcije s bajtovima na probnom echo uređaju 0x38. Provjeravaju se SDA/SCL, napajanje i adresa; uređaj bez uvjeta ne odgovara. Ovaj dokaz ne potvrđuje spremnost AHT10 biblioteke ni SSD1306 naredbi. Njihovi protokoli ostaju u etapi 4.

Izvorni `framebuf` ugrađen je u WASM, a njegov memorijski izlaz prikazuje se preko dijagnostičkog mosta. To potvrđuje dostupnost modula i prijenos stvarnih piksela, ne zamjenjuje OLED upravljački program.

## 005 — Mali prototip, odvojena produktna aplikacija

Etapa 0 ima samostalno HTML/JS sučelje radi lakše provjere jezgre i statičkog posluživanja. React/TypeScript i CodeMirror iz početnog plana ostaju za etapu 1. Ova odluka ne uvodi novo produkcijsko sučelje niti tvrdi da su format projekta, autosave ili uvoz/izvoz već gotovi.

## 006 — Smanjen most i ograničeni resursi

Nisu izloženi Python moduli `js` i `jsffi`. Izvorni most prima samo ograničene operacije i veličine međuspremnika. Memorija, konzola i zapis događaja imaju ograničenja. Za javno dijeljenje i račune treba dodatno ispitati granicu izvršavanja, Worker CSP, uvoz paketa i scenarije iscrpljivanja resursa; to nije uvjet privatnog dokaza jezgre.

## 007 — Stvarna matrica umjesto pretpostavljene podrške

Jedini preglednik raspoloživ za ovu provjeru je Chrome/Chromium 156 na Linuxu. Deset skupina integracijskih provjera mora prolaziti; preglednici koji nisu izvršili provjere vode se kao „nije ispitano”. Odabir Asyncifyja je odluka o izvedbi, a ne dokaz da svaki preglednik radi.

## 008 — Etapa 3: ista topologija za editor i interpreter

v0.1 kompilira mreže iz istog modula kao editor, a modele izvodi u Workeru uz stvarni MicroPython. Proširen je ograničeni C most za izložene pinove, ADC i PWM; Asyncify nije zamijenjen niti je mijenjan učenikov izvorni kod. Digitalni izvori, otpornici, potenciometri, tipkala i LED imaju deklarirani funkcionalni DC model. Početni izlazni `value` primjenjuje se atomarno s načinom rada, čime inicijalizacija istih visokih izlaza ne stvara lažni sukob.

Privremeni ulazi pokretanja odvojeni su od trajnih početnih svojstava projekta. Reset vraća početne vrijednosti. Izmjene sklopa i vraćanje povijesti zaustavljaju sesiju; izmjene izvora primjenjuju se pri novom pokretanju. Arhivski echo i framebuf pokusi ostaju zasebno označeni. Novi projekti i postojeći izvozi ne traže promjenu formata 2.

ADC i PWM ograničenja te idealizacije precizno su zapisani u stage3-simulator.md. Ponavljanje izgradnje ima zaseban reproducibility-stage3.json; arhivski rezultati etape 0 ne predstavljaju se kao novo mjerenje.
