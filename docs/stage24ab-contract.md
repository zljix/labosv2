# Etape 24A–24B · ugovor provjere i ESP32-S3 C++

**0.14.0-beta.1 · 15. studenoga 2026.** Polazište je izdanje 23I, Git `6f03f78`. Nastavlja se plan bodovanja od 24A do 24P i postojeći PHP/MySQL sustav.

## Isporuka

Šest novih rubrika `24B-…@1` koristi provjeravač `24AB.1`. Svaka objavljuje upute, kriterije i najveće bodove, dopuštene alternative, izvršne profile, scenarije, rokove, tolerancije i granice resursa. Izvorni rad uključuje cijeli spremljeni projekt, sklop i njegove početne podatke. Hash zadatka veže ranije objavljene upute, rubriku i početne projekte.

Novi posao inačice 2 veže i broj posla, pokušaja i revizije, cilj, hash rubrike i ugovora te hash pobude. Izvršavanje i prihvat rezultata provjeravaju tu vezu. JSON redoslijed ključeva ne mijenja identitet; redoslijed polja u nizovima ostaje važan. Izmjena objavljenih uvjeta zahtijeva novi profil i novu objavu zadatka.

Stare rubrike `23E.1` i `23G.1` ostaju neizmijenjene i izvršive. Njihove postojeće dodjele, zaključane predaje, rezultati i nastavničke bilješke ostaju uz istu inačicu. Nova rubrika uključuje se izričitim nastavničkim odabirom pri objavi; nadogradnja ne mijenja stare dodjele. Nema nove SQL migracije.

| Obitelj | Nova rubrika | MicroPython S3 | S3 C++ | Uno | Nano |
| --- | --- | --- | --- | --- | --- |
| Tipkalo i LED | `24B-button-led@1` | 10 bodova | 10 bodova | 10 bodova | 10 bodova |
| Digitalni analogni prag | `24B-analog-threshold@1` | 10 bodova | 10 bodova | 10 bodova | 10 bodova |
| BMP280 I2C | `24B-bmp280@1` | 10 bodova | 10 bodova | 10 bodova | 10 bodova |
| LED 250/750 ms | `24B-led-timing@1` | 10 bodova | 10 bodova | 10 bodova | 10 bodova |
| LM35 | `24B-lm35@1` | 10 bodova | 10 bodova | 10 bodova | 10 bodova |
| BMP180 I2C | `24B-bmp180@1` | 10 bodova | 10 bodova | 10 bodova | 10 bodova |

To je **24 od 268 URS kombinacija**. Tri ranije podržana cilja dobivaju nove inačice bez povećavanja broja kombinacija; S3 C++ dodaje šest novih kombinacija. Preostale 244 ostaju bez službenih bodova. V1–V5 ostaju zasebne lokalne provjere. Puna ADC/PWM rubrika iz 24C nije zamijenjena digitalnim pragom.

## Izvršavanje S3 C++ izvora

Izvor se prevodi u zasebnoj Linux izolaciji s Clangom 19.1.7, Binaryenom 120, zaključanim funkcionalnim coreom i bibliotekama. Učenikov WASM ili stari `s3-build.json` ne bira službeni program. Bez uključenog prevoditelja dopušten je samo identičan izvor iz pouzdanog instaliranog kataloga. Novi izvor bez dostupnog prevoditelja ostaje `unsupported`, uz `points: null`.

Rezultat bilježi hash izvora, hash novog WASM-a, alatni lanac i identitet izvršenih alata. Sve pločice koriste točno spremljeni sklop. S3 WASM ostaje funkcionalni profil simulatora i nije firmware za fizički ESP32.

Identitet alata računa se izravnim čitanjem izvršnih datoteka pronađenih u dopuštenom PATH-u. Integracija prije cijelog skupa provjerava instalaciju u istom izoliranom procesu koji prevodi učenički izvor.

S3 izvođenje koristi deterministički virtualni sat. Pobude se mijenjaju na unaprijed određenim granicama; provjeravaju se stvarni GPIO/ADC/I2C rezultati i novi ispisi. Analogni S3 profil koristi 12 bita i zasićenje na 3,1 V, a AVR 10 bita i 5 V. S3 ADC ulaz sada se pojavljuje u opaženom GPIO stanju i kada ga program prvi put otvori samim `analogRead()`.

## Objavljene granice

Nove tipkalo/prag rubrike provjeravaju reakciju do 50 ms, uz 4 ms tolerancije koraka, i održavanje očekivanog izlaza do sljedeće pobude. LED traži najmanje tri potpuna ciklusa 250/750 ms uz ±24 ms. LM35 prati tri temperature i povrat na prvu, unutar ±0,6 °C i intervala 400 ms uz 24 ms tolerancije. BMP180 i BMP280 traže nova I2C mjerenja i odgovarajuće nove ispise u °C/Pa; interval je 2200 ms uz 100 ms tolerancije, odstupanja ±0,3 °C i ±150 Pa.

Izvođenje ima granicu od 20 s zidnog vremena, prevođenje 90 s, izlaz 1 MiB i pojedinačni adresni prostor 2 GiB. V8 ima heap 96 MiB, MicroPython heap 4 MiB, S3 WASM memoriju 2 MiB. Granica procesa nije dokaz skupnog memorijskog ograničenja servisa. Tehnički kvar, nepodržan profil i prekoračenje ograničenja ostavljaju bodove praznima; pogreška učeničkog programa ima zaseban status i kriterije.

## Dokazi i provjere

`verification/school-contract.test.ts` izvršava stvarne programe u izolaciji: svih šest MicroPython rubrika, ponovljivost, druga ispravna rješenja i ekvivalentan raspored, pogrešne sklopove i programe, točan prag i trajanja, sporu reakciju, izmjenu uvjeta i identiteta, lažni artefakt te granicu izvođenja. Uključeni compiler skupovi provjeravaju svih šest S3 rubrika i svih dvanaest Uno/Nano kombinacija s novim referentnim i alternativnim izvorima.

`verification/school-contract-api.test.mjs` provjerava stvarni PHP/MySQL: novu zamrznutu rubriku, S3 posao, odbijanje tuđeg posla, revizije, cilja, pobude ili kriterija, zaključavanje i očuvanje starih zadataka. Postojeća regresija pokriva red, zakašnjele rezultate, spremanje, dorade, izvještaje, korekcije, arhivu i povrat kopije. Neobrađeni razvojni dokazi nalaze se u `stage24ab-evidence/`; GitHub integracija bilježi zaseban rezultat.

| Lokalni skup | Rezultat |
| --- | --- |
| Ugovori, izolirano izvođenje i svi novi S3/Uno/Nano prijevodi | 9/9, bez preskoka |
| Projekti, sklopovi, vodovi, školski prikaz, sinkronizacija, završetak i izvještaji | 76/76 |
| S3 analogni profil i stvarno prevođenje promijenjenog izvora | 54/54 |
| Isti Ubuntu S3 alati, relativne putanje i neovisni prijevodi svih šest rubrika | 3/3 |
| Obrazac pilota, mjere i liveness | 6/6 |
| Školski ZIP i korijenski offline paket | 10/10 |

Lokalno okruženje nema PHP/MySQL instalaciju. Taj integracijski dokaz izvodi zaseban GitHub postupak; lokalni rezultat ga ne zamjenjuje.

## Instalacija i nastavak plana

U školskom paketu zamijeni programske datoteke, privatni katalog, `grading/` i `checker/`, sačuvaj privatnu konfiguraciju i sesije te ponovno pokreni radnike. Upute za S3 alate i varijable okruženja nalaze se u školskom README-u. Javna GitHub Pages objava i dalje služi simulator; prijava, MySQL i službeno bodovanje rade na školskom poslužitelju.

Sljedeća je 24C: nova ADC/PWM rubrika, NTC, TEMT6000, joystick, plamen, zvuk, usporedba LM35/NTC i dva analogna ulaza s tipkalima. Daljnje etape ostaju prema planu. Stvarni školski pilot, Windows veza prema Linux radniku, ciljni mobilni preglednici i skupna memorijska granica ostaju otvoreni školski uvjeti prihvata.
