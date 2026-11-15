# Etapa 11 — analogni i jednostavni ulazi

Izdanje 0.5.0-beta.1, 12. studenoga 2026. Nastavak istog projekta i formata schemaVersion 3 / modelVersion 1. Nova etapa ne mijenja ranije pohranjene projekte ni zaključane biblioteke.

## Ugovor profila

| Komponenta | Izvodi / početno napajanje | Funkcionalni model |
| --- | --- | --- |
| LM35 | VCC=5 V, GND, OUT | Osnovni single-supply spoj 2–150 °C, 10 mV/°C; 25 °C → 0,25 V. Napajanje 3,3 V nije valjano. Idealna izlazna impedancija 0,1 Ω odluka je modela. |
| TEMT6000 | VCC=3,3 V na S3 ili 5 V na AVR-u, GND, AO | Nominalno 0,5 µA/lx, 10 kΩ opterećenja i deklarirana rezerva zasićenja 0,1 V. Ulaz osvjetljenja 0–2000 lx je pobuda nominalnog modela. Nema automatske kalibrirane pretvorbe ADC-a u lukse. |
| NTC djelilo | VCC → Rfixed → AO → NTC → GND | R25=10 kΩ, Beta=3950 K, Rfixed=10 kΩ, −20 do 100 °C. Svojstva dopuštaju promjenu triju parametara. To je definirani projektni sklop, ne tvrdnja da svi fizički moduli imaju te konstante. |
| KY-023 | VCC, GND, VRX, VRY, SW | Dvije neovisne staze 10 kΩ, 0–100 %, središte 50 %. SW je pasivni kontakt prema GND; potreban programski pull-up. Mehaničko poskakivanje i nelinearnost nisu modelirani. |
| Lab plamen AO/DO | VCC, GND, AO, DO | Relativna IR pobuda 0–100 %, AO=VCC×(1−pobuda/100), Thevenin 1 kΩ. DO: otvoreni kolektor, aktivan LOW, ugrađeni pull-up 10 kΩ i zatvoreni put 10 Ω. |
| Lab zvuk DO | VCC, GND, DO — točno tri izvoda | Sintetska relativna pobuda, digitalni prag; električni DO kao gore. Nema AO ni mjerenja dB, audio valnog oblika ili pristupa mikrofonu računala. |

Za plamen/zvuk početni prag je 50 %, aktivacija na prag+2 postotna boda, deaktivacija na prag−2; između se čuva prethodno stanje. Nova sesija počinje neaktivno, osim ako početna pobuda aktivira izlaz. Izostanak napajanja poništava stanje komparatora. Oba su **izričita Lab profila**: izlazna polarnost, točan pinout i otpornici fizičkih modula nisu utvrđeni prema fotografiji ni nazivu kompleta.

Naponski profili 3,3/5 V biraju se u svojstvima. LM35 ostaje na 5 V. Izlazi modula od 5 V prema S3 blokiraju se prije pokretanja; nije dodan skriveni pretvornik napona. LM35 ima u deklariranom području najviše 1,5 V na izlazu i zato može izravno prema S3 ADC-u uz zajedničku masu.

## Električna i programska povezanost

`compileCircuit` šalje stvarne indekse mreža i parametre uređaja. `analog-inputs.mjs` dodaje otporne grane/izvore u postojeći DC rješavač. Dodatni otpornik zaista opterećuje izlaz. Živi ulazi mijenjaju model uređaja; ne upisuju tekst u konzolu i ne mijenjaju izvorni projekt. Početna stanja u zaustavljenom projektu spremaju se kroz uobičajeni ZIP/JSON i IndexedDB tok.

S3 MicroPython zadržava idealni 12-bitni ADC i odabrano prigušenje; ATTN_11DB zasićuje na 3,1 V. `read_uv` proizlazi iz kvantiziranog očitanja. AVR8js ostaje 10-bitni ADC s odabirom reference preko stvarnog ADMUX registra. Provjereni su DEFAULT/AVCC=5 V i INTERNAL=1,1 V; vanjski AREF ostaje fiksni model od 5 V, bez proizvoljnog vanjskog naponskog izvora. Referenca ADC-a ne mijenja napajanje senzora.

Nepovezani S3 ADC daje Python pogrešku. AVR jezgra na nepobuđenom ulazu može vratiti 0; nova dijagnostika `adc-floating` jasno označava da nije valjano mjerenje. Pozadinsko osvježavanje ne dodaje takva upozorenja za nekorištene kanale; označava se stvarno programsko ADC čitanje. Pogrešan ADC pin, napajanje, masa, otvoreni signal ili GPIO koji pogrešno pogoni ulaz imaju zasebne poruke.

## Primjeri i metodički slijed

Šest pojedinačnih primjera uvodi po jedan model, pinove i očitanje. Zatim slijedi LM35/NTC usporedba te dva potenciometra 1 kΩ s dva tipkala. Svaki postoji za ESP32-S3/MicroPython, Uno R3/Arduino i Nano classic/Arduino. Arduino primjeri ne koriste dodatne biblioteke; `log`/`fabs` dolaze iz dostupne matematičke podrške. Ukupno je 22 pripremljena programa po AVR pločici, odnosno 44 artefakta.

- LM35: OUT=GPIO1/A0; promijeni 25 → 50 °C i usporedi U i T.
- TEMT6000: AO=GPIO1/A0; promijeni 100 → 20 lx nominalne pobude. Učenikov izlaz ostaje ADC i napon.
- NTC: AO=GPIO1/A0; program računa otpor i Beta inverziju. Parametri programa moraju odgovarati svojstvima sklopa.
- Joystick: VRX=GPIO1/A0, VRY=GPIO2/A1, SW=GPIO5/D2 uz pull-up. Mrtvu zonu ±10 % primjenjuje izvorni program, model ne mijenja hod osi.
- Plamen: AO=GPIO1/A0, DO=GPIO5/D2; isprobaj 48 → 50 → 52 → 50 → 48 %.
- Zvuk: DO=GPIO5/D2; usporedi digitalno stanje ispod i iznad praga. Ne dodavati AO u program za ovaj profil.
- Usporedba: LM35 i NTC neovisno postavi na istu temperaturu. Izlazni naponi su različiti, izračunata temperatura usporediva unutar kvantizacije.
- Dvostruki ulazi: dva potenciometra i dva tipkala provjeravaju neovisnost više primjeraka.

Novi izvor i dalje se prevodi lokalnim Arduino mostom; cloud/offline compiler nije dodan. Postojeći most i zaključani paketi nisu mijenjani jer nisu dodane biblioteke. Gotovi primjeri ne zahtijevaju povezani compiler.

## Razvojni preglednik i granice potvrde

Razvojna stranica s već instaliranom starom offline aplikacijom u početku je prikazala 0.3.0. Svježi dokument s query parametrom pokazao je aktualni UI, ali prvi MicroPython pokus zahvatio je staru javnu kopiju runtimea. To je reproducirana razvojna kolizija predmemorije. Sada Vite izlaže javne runtime resurse pod `/app/development/`, uključujući relativne uvoze modula; razvojni `runtimeAsset` koristi isti prostor. Produkcijske putanje `/app/<hash>/` ostaju nepromijenjene.

Nakon popravka Chromium/Linux izvršio je stvarni MicroPython primjer: početno LM35=24,98 °C i NTC=24,99 °C, nakon oba klizača na 50: LM35=49,96 °C, NTC=50,00 °C. Arduino Uno primjer opažen je na 25 °C i promijenjeni stvarni naponi 0,500 V / 1,320 V pri 50 °C; završne serijske vrijednosti usporedbe potvrđene su u automatskim AVR pokusima. Stop je opažen kroz onemogućeni gumb nakon zaustavljanja.

To je razvojni desktop preglednik, ne Safari/iOS, školsko računalo, hladno offline otvaranje privatne produkcije ili fizički pilot. Promjena razvojnog prostora ne proglašava produkcijski update tok ponovno potvrđenim. Nema SPICE-a, tolerancija, kalibracije stvarnog senzora, modela šuma, toplinske tromosti ili mjerila zvuka/požara.

## Popravak otkriven regresijom

Regresijski rubni pokus BMP180 ponekad je pročitao stari ili nulti podatkovni registar nakon nominalnog `sleep_ms(5)`. Izravni trag I2C-a pokazao je da status pretvorbe još nije bio dovršen; nije riječ o izmijenjenoj kalibraciji. Projektni MicroPython driver `lab_i2c_sensors.py` 1.0.1 zato nakon čekanja provjerava SCO u registru 0xF4, bit 5, s ograničenjem čekanja od 100 ms. Zaseban pokus prisiljava busy odgovore i zaglavljenu pretvorbu. Arduino driver, njegovi hashovi i postojeći C++ artefakti ostaju isti. Ranije spremljene vlastite kopije .py drivera ne prepisuju se automatski.

## Ponovljive provjere

`npm run build`, zatim `npm run test:analog`. Za uključenu stvarnu kompilaciju postaviti `LAB_ARDUINO_CLI` i `LAB_ARDUINO_CONFIG` na zaključani CLI/core prema postojećim uputama. `npm run avr:examples` prevodi samo primjere čiji se točan izvor/cilj/hash razlikuje od postojećeg provjerenog artefakta. Rezultati nove etape su u `docs/stage11-evidence/`; regresije su sažete u njezinoj završnoj provjeri.

## Primarni izvori

- Texas Instruments, LM35: https://www.ti.com/lit/ds/symlink/lm35.pdf — 10 mV/°C, napajanje i osnovni spoj za pozitivne temperature.
- Vishay, TEMT6000X01: https://www.vishay.com/docs/81579/temt6000.pdf — fotostruja pri zadanom osvjetljenju; nominalni model ne uklanja tolerancije.
- SparkFun, TEMT6000 breakout: https://learn.sparkfun.com/tutorials/temt6000-ambient-light-sensor-hookup-guide/hardware-ov — VCC/GND/SIG, 3,3/5 V i očitanje napona. Izvorni izvod dohvaćen pretraživanjem; izravno otvaranje vratilo je 403.
- Vishay, NTCLE100E3: https://www.vishay.com/docs/29049/ntcle100.pdf — R25/Beta ovise o izvedbi. Zadani R25=10k/B3950 je projektni profil, nije tvrdnja da ta stranica dokumentira školsku sondu.
- Joy-IT, KY-023: https://sensorkit.joy-it.net/en/sensors/ky-023 — dvije analogne osi, zaseban kontakt SW i pull-up.

Svojstva konkretnih Lab komparatora i pojednostavljenja DC modela projektne su odluke, a ne izmjerene specifikacije neidentificiranih školskih modula.

- Bosch BMP180 izvorni podatkovni list, SCO status: https://cdn-shop.adafruit.com/datasheets/BST-BMP180-DS000-09.pdf — bit ostaje 1 tijekom pretvorbe, a 0 označava dovršen podatkovni registar.
