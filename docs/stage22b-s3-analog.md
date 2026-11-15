# Etapa 22B — S3 Arduino C++ analogni i jednostavni ulazi

**0.12.1-beta.1 · 14. studenoga 2026.** Nastavak iz izdanja 0.12.0-beta.1 i izvornog commita `818354ba4d7777e4edf3e05dcc5ca8347141fbf4`. Zatvoren je prvi dogovoreni skup preostalih S3 C++ primjera. Izdanje ostaje nastavna beta; fizička oprema, ciljni preglednici i stvarni učenički pilot nisu proglašeni provjerenima.

## Dostupni pokusi

U **Vježbe → URS zbirka → S3 · Arduino C++ → URS04** dostupno je svih osam varijanti. Isti pokusi nalaze se i u zasebnom izborniku **ESP32-S3 · ARDUINO C++**. Svaki otvara novi projekt s izvršivim izvornim programom, sklopom, vidljivim MIT helperom `lab_analog.h` i točno vezanim WASM prijevodom.

| Pokus | Spojevi | Što program radi |
| --- | --- | --- |
| LM35 | VCC=5 V, GND, OUT=GPIO1 | Čita ADC, računa napon i temperaturu iz 10 mV/°C. |
| TEMT6000 | VCC=3,3 V, GND, AO=GPIO1 | Čita ADC/napon i označava gornju ADC granicu. Ne ispisuje izmjerene lukse. |
| NTC | VCC=3,3 V, GND, AO=GPIO1 | Računa otpor djelila i temperaturu prema R25/Beta; granica ADC-a daje NaN. |
| KY-023 | VCC=3,3 V, GND, VRX/VRY=GPIO1/2, SW=GPIO5 | Dvije osi, mrtva zona, aktivno LOW tipkalo i oznake gornje ADC granice. |
| Plamen | VCC=3,3 V, GND, AO=GPIO1, DO=GPIO5 | Očitava stvarni analogni napon i aktivno LOW izlaz komparatora. |
| Tropriključni zvuk | VCC=3,3 V, GND, DO=GPIO5 | Očitava digitalni komparator; nema izmišljenog AO, dB ili mikrofona. |
| LM35 i NTC | OUT=GPIO1, AO=GPIO2, odvojeni 5/3,3 V | Neovisno uspoređuje dva mjerna načela. |
| Dva potenciometra i tipkala | Klizači GPIO1/2; tipkala GPIO5/6 prema GND | Četiri neovisna živa ulaza, uz programski pull-up tipkala. |

Svi sklopovi imaju zajedničku masu. Novi izvor i helper imaju hrvatske komentare i izričite konstante. Postojeći Python i AVR programi te školski LV1/LV2 ostaju sačuvani.

## Model i računanje

S3 primjer izričito postavlja 12-bitni ADC i 11 dB. Idealni profil iz postojeće jezgre ima **0–4095 za 0–3,1 V**. Program iz stvarnog ADC broja računa `U = raw * 3.1 / 4095`. Ne čita izravno temperaturu ili drugi klizač.

NTC i joystick napajaju se s **3,3 V**. To je druga veličina od 3,1 V ADC raspona. Za djelilo VCC → fiksnih 10 kΩ → AO → NTC → GND vrijedi `R = 10000 * U / (3.3 - U)`. Zatim slijedi Beta izraz s R25=10 kΩ, Beta=3950 K i T25=298,15 K. Promjena parametara sklopa traži i odgovarajuću promjenu konstanti programa. Na ADC 0 ili 4095 NTC ispisuje `nan` i poruku granice; to nije univerzalno prepoznavanje svih neispravnih spojeva.

Joystick normalizira napon prema 3,3 V i primjenjuje mrtvu zonu `|N| < 0.10`, približno ±5 % hoda oko sredine. Gornji hod može zasititi ADC; najveći normalizirani broj tada je približno 0,88. `SATX/SATY` označavaju gornji ADC kod, a ne rekonstruirani napon iznad raspona. TEMT6000 također ne rekonstruira više od 3,1 V i prikazuje `SAT=1` na toj granici.

Plamen i zvuk koriste postojeće izričite Lab komparatorske profile: prag 50 %, aktiviranje pri ≥52 %, otpuštanje pri ≤48 %, čuvanje stanja između. To nije tvrdnja da svaki kupljeni modul ima tu izvedbu. LM35 zadržava 5 V napajanje i na S3; osnovni profil pokriva 2–150 °C.

Izmjena programa ili `lab_analog.h` poništava priloženi prijevod dok se ne prevede novi točan izvor. Promjena sklopa koristi isti program kroz nove električne mreže. Header ulazi u projektni ZIP, izvoz sketcha i URS otisak sadržaja.

Nisu mijenjani MicroPython WASM, funkcionalni S3 core/ABI, Arduino biblioteke, analogni model ni 27 prethodnih S3 artefakata. Fizički S3 izvoz čuva izvor i header; ovaj paket ne daje novu potvrdu prevođenja na Espressif coreu niti fizičke kalibracije.

## Katalog i matrica

| Cilj | URS varijante | Razvojno provjerene stavke | Eksperimentalne | Otvorene |
| --- | ---: | ---: | ---: | ---: |
| S3 MicroPython | 63 | 16 | 21 | 2 |
| S3 Arduino C++ | 33 | 0 | 28 | 11 |
| Uno R3 | 63 | 0 | 37 | 2 |
| Nano classic | 63 | 0 | 37 | 2 |

Zbirka ima **222 ponuđena puta varijanta × cilj** i 63 jedinstvene varijante u 16 tema. Zaseban izbornik S3 primjera sada ima 35 programa. Radio čvor B može imati drugi cilj; dodatne kombinacije čvorova nisu dodane broju 222. Matrica ostaje 39 stavki × četiri cilja = 156 polja; CSV i sučelje nastaju iz istih podataka.

## Izvedene provjere

**381 različit programski test prošao je bez preskakanja:** 62 nova S3 analogna slučaja, 61 postojeći S3 slučaj, 227 URS slučajeva, 23 postojeća analogna slučaja na MicroPythonu/AVR-u i osam offline slučajeva. Ponovljeni pokusi ne dodaju se broju jedinstvenih slučajeva.

Novi testovi izvršavaju stvarno prevedene programe, uključujući LM35 2–150 °C, NTC −20–100 °C, TEMT6000 od nule do zasićenja, joystick, komparatorsku histerezu i neovisne ulaze. Provjeravaju nestalo napajanje/masu, odspojen signal, prevelik napon, izostanak valjanog očitanja, ponovni ispravan pokus, JSON/ZIP, točne izvozne datoteke i odbijanje starog artefakta nakon izmjene sketcha/headera. Stvarni compiler preveo je i izmijenjenu učeničku formulu te odbio izostavljeni header.

Početna provjera pogrešno je očekivala potpuno praznu konzolu pri odspojenom DO senzora zvuka. Program prije `digitalRead()` legitimno ispiše prefiks; nema valjanog brojčanog očitanja. Ispravljena je provjera tako da odbija lažne brojčane podatke i zahtijeva stvarnu runtime pogrešku. To nije bila promjena modela. Početni i završni zapis čuvaju se odvojeno.

Zasebni pokusi izvode **završne zapakirane Workere** za svih osam novih primjera, mijenjaju ulaze tijekom rada i provjeravaju izračunate rezultate. Deveti pokus potvrđuje stvarnu pogrešku odspojenog LM35 signala. Ponovljen je i postojeći URS AHT10/OLED/servo slijed na sva četiri cilja. Mjerenja prisilnog prekida vrijede samo za razvojni Node/Linux; nisu potvrda ciljnih školskih ili mobilnih uređaja.

U razvojnom Chromeu opaženi su URS04 8/8 za S3 C++, stvarno otvaranje radnog lista i promjena LM35/NTC iz početnih približno 24,98/24,99 °C u 149,97/100,03 °C na zadanim 150/100 °C. TEMT6000 je pri pobudi 100 → 2000 lx promijenio ispis `ADC=660 U=0.500 SAT=0` u `ADC=4095 U=3.100 SAT=1`; mrežni model tada ima 3,2 V. Preglednički pokus izveden je prije naknadnog prijevoda komentara na hrvatski, uz iste formule i kontrole; završni Worker pokusi koriste konačnu izgradnju.

Izvori: `src/runtime/s3AnalogExamples.ts`, `src/runtime/s3Examples.ts`, `src/lessons/ursCatalog.ts`, `src/boards/support.ts` i `supportReport.ts`. Provjere i rezultati su u `verification/s3-analog.test.ts`, `verification/s3-analog-package.ts` i `docs/stage22b-evidence/`. Starije datoteke dokaza koje regresija ponovno zapisuje vraćaju se na povijesno stanje; nova opažanja čuvaju se pod ovom etapom.

## Lokalni paket i ograničenja

Izgradnja **2c8d46b0f0083eb1**. Raspakirani lokalni ZIP poslužen je stvarnim loopback HTTP-om: **174 resursa / 13 954 773 B**, uz potvrđene sve sažetke/veličine i dva WASM MIME odgovora. ZIP ima **4 789 884 B**, SHA-256 `3a1ca519e635350327a64574441f0b7f5a7c87a553009ea12aab4a3489aefae1`.

Raspakiraj `ESP32_MicroPython_Lab_0.12.1_Lokalno.zip` u zasebnu mapu. Node.js 22+: Windows `Pokreni.cmd`, Linux/macOS `node start-local.mjs`, zatim `http://127.0.0.1:4173/`. Promijenjeni C++ treba postojeći lokalni compiler; postavi `LAB_ARDUINO_SITE=http://127.0.0.1:4173` za taj lokalni origin. Stvarno hladno offline otvaranje u ciljnom pregledniku, Windows/macOS, iOS/Safari/Android, fizički moduli i samostalan učenički pilot ostaju otvoreni.

## Nastavak

Sljedeći paket je **22C — preostali S3 GPIO upravljački primjeri**, počevši KY-040, relejem i aktivnom zujalicom. Preostaje devet komponentnih stavki: KY-040, NEC IR, relej, aktivna zujalica, pasivni zvuk, DC/L298N, A4988, BMP280 SPI i ST7735. Zaseban generički pretvornik razina i točna SFM-20B izvedba ostaju otvoreni na svim ciljevima. Dodatne ESP32 DevKitC V4 i CAM izvedbe zahtijevaju potvrđen zaseban profil. Puni stabilni URS v1.0 čeka zatvoren dogovoreni opseg i stvarni pilot.
