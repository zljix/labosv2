# Etapa 15 — A4988 i parametrizirani bipolarni motor

Isporuka **0.6.1-beta.1**, 13. studenoga 2026. Projektni format ostaje schemaVersion 3 / modelVersion 1. Stabilna v1.0 nije proglašena.

## Sklop i profil

Katalog sadrži A4988 Lab carrier sa 16 označenih izvoda te motor s dvije odvojene zavojnice A+/A− i B+/B−. GND i PGND carrier profila spojeni su interno. VDD je 3–5,5 V; primjer koristi 3,3 V za S3 i 5 V za Uno/Nano. VMOT je 8–35 V prema specifikaciji A4988; postojeći idealni Lab izvor dopušta 5–12 V pa svi primjeri koriste 12 V. Motor ne dobiva napajanje iz GPIO-a.

Profil pretpostavlja lokalno odvajanje napajanja i 100 µF uz VMOT unutar carrier sklopa. Kondenzatori se ne računaju dinamički. Nema simulacije VREF, Rsense, regulacije stvarne struje, zaštita od pregrijavanja/preopterećenja, LC prenapona, induktiviteta, momenta, inercije, ubrzavanja ni gubitka koraka zbog tereta ili brzine. Za fizički motor treba utvrditi struju i parametre te postaviti odgovarajući limit prema točnoj izvedbi carrier pločice. Fizička dostupnost i tip motora nisu potvrđeni.

## Signali i mjerljivi rezultat

Svaki stvarni digitalni GPIO prijelaz dolazi kroz postojeći električni model mreže. A4988 prati STEP, DIR, ENABLE, RESET, SLEEP i MS1/2/3, a motor prati topologiju njegovih izlaznih parova. Ne čitaju se tekst programa, imena varijabli ni sadržaj konzole. AVR put izvršava prevedene ATmega328P instrukcije; MicroPython put izvršava stvarni WASM interpreter i funkcionalni Pin API.

| MS1 | MS2 | MS3 | Mikrostep |
| --- | --- | --- | --- |
| 0 | 0 | 0 | puni korak |
| 1 | 0 | 0 | 1/2 |
| 0 | 1 | 0 | 1/4 |
| 1 | 1 | 0 | 1/8 |
| 1 | 1 | 1 | 1/16 |

MS1/MS3 imaju 100 kΩ, MS2 50 kΩ prema GND. STEP, DIR, ENABLE, RESET i SLEEP zahtijevaju definirani vanjski spoj. Nisu im izmišljeni univerzalni pull-up/pull-down otpornici. Logički LOW je do 0,3 × VDD, HIGH od 0,7 × VDD; ulazni maksimum prati zasebnu 5,5 V granicu. Zato se S3 primjeri napajaju s VDD=3,3 V: 3,3 V nije zajamčeni HIGH za VDD=5 V.

Translator koristi cijeli broj jedinica 1/16 punog koraka. 50 punih koraka ili 800 šesnaestinskih impulsa daje 90° za parametar 200 koraka/okret. Motor može imati 4–10000 punih koraka/okret, u višekratnicima četiri; zadano 200 znači 1,8°. To je parametar, nije zaključak iz naziva NEMA ili izgleda kućišta. Dopušteni su oba smjera, zamjena polariteta jedne ili obiju zavojnica i zamjena faza, uz odgovarajući predznak. Križanje parova, kratki spoj izlaza, motor na GPIO-u, Nano A6/A7 i pogonski napon na GPIO-u odbijaju se.

**ENABLE HIGH isključuje izlaze, ali ne zaustavlja translator.** Prikazuju se zasebno ukupan broj valjanih STEP impulsa, translator i idealni zbroj koraka koji su imali pobudu motora. Nakon impulsa bez pobude model ne proglašava položaj osovine poznatim. RESET LOW postavlja električni Home i ignorira STEP. SLEEP LOW isključuje pogon i ignorira STEP; buđenje vraća električni Home uz obvezno čekanje 1 ms. Električni Home nije mehaničko referenciranje i ne postavlja automatski kut osovine na 0°.

Fazni prikaz A/B daje bezdimenzijske idealne sinusne/kosinusne ciljeve u rasponu −1 do +1, s Home kutom 45°. To nisu izmjerene struje ili naponi. Izlazne mreže nisu naponom pobuđeni SPICE mostovi; generički voltmetar na njima ne dokazuje fazni napon. Pozicija je idealan inkrementalni prikaz pravilno spojenog, neopterećenog motora, a ne mehanički proračun povratka u najbližu stabilnu poziciju nakon ENABLE/RESET/SLEEP.

## Vremenski ugovor i granice

STEP HIGH i LOW moraju trajati najmanje 1 µs; DIR, MS i RESET imaju 0,2 µs setup/hold. Rastući brid je kandidat, a prihvat se potvrđuje nakon najmanje 1 µs HIGH; zato prekratak impuls ne pomiče model. Stalni HIGH i ponovljeni prikaz istog okvira ne stvaraju nove korake. RESET/SLEEP LOW su normalno ignorirani događaji, odvojeni od pogrešnih vremenskih impulsa.

Promjena mikrostep načina podržana je na zajedničkom položaju obaju načina ili nakon električnog reseta. Promjena izvan takvog položaja jasno se odbija; to nije tvrdnja da fizički A4988 odbija takav impuls. Kombinacije MS s MS3=1 osim 111 nisu deklarirane i odbijaju se. Funkcionalni MicroPython PWM na STEP nije podržan i daje izričito upozorenje; treba generirati digitalne Pin impulse. AVR timer izlazi koji stvaraju stvarne GPIO bridove prolaze zajedničkim putom, ali nove biblioteke poput AccelStepper nisu deklarirane niti dodane lokalnom prevoditelju.

MicroPython trajanja nisu dokaz frekvencijske ili brzinske točnosti ESP32. Broj digitalnih impulsa provjerava se odvojeno od realne brzine izvršavanja u pregledniku. AVR koristi 16 MHz virtualne procesorske cikluse. Fizički čip izvan zajamčenih vremena može imati nedefinirano ponašanje; model takve ulaze deterministički odbija.

## Primjeri, izvozi i stanje sesije

Tri komentirana primjera dostupna su za S3/MicroPython te Uno i Nano/Arduino C/C++:

1. **Koraci i smjer:** 50 impulsa naprijed → 90°, zatim 50 natrag → 0°.
2. **Pet mikrostep načina:** 10 × faktor impulsa → 18° pri 200 koraka/okret, zatim povratak; promjene načina na zajedničkom Home položaju.
3. **ENABLE, RESET i SLEEP:** 10 pogonskih koraka, 10 bez pobude, električni reset, ignorirani koraci u snu i 5 nakon buđenja. Translator završava na pet koraka; idealni zbroj pogonskih koraka ostaje 15, a položaj osovine nije potvrđen.

Programi upravljaju STEP/DIR bez dodatne vanjske biblioteke i bez prekonfiguriranja timera. Arduino delay() i dalje koristi core Timer0. Referentni motori u primjerima imaju 200 koraka/okret; za drugi parametar treba ponovno izračunati broj impulsa i poruke ispisa. Ranije nastavne vježbe zadržavaju brojeve; novi primjeri ne prepisuju URS LV dokumente.

U mjerenjima su kut, translator, mikrostep, fazni ciljevi, valjani/ignorirani/odbijeni bridovi i posljednjih 128 događaja po driveru. **Stop čuva posljednju snimku**, ne nastavlja fizikalno držanje motora. Novi Run ili Reset aplikacije stvara novu idealnu sesiju od 0° i briše zapis; to nije hardversko referenciranje. CSV sadrži stabilni ID drivera, vrijeme_us, operaciju i vrijednost, UTF-8 BOM i pravilno navodnike. Čuva se ograničeni događajni trag, ne potpuni log svih GPIO bridova. Sklop i parametri preživljavaju JSON/ZIP i Arduino IDE izvoz; stanje tijekom simulacije nije spremljeno kao stvarno stanje fizičkog motora.

## Dodatna stabilizacija AM2320

Driver lab_i2c_sensors.py 1.0.2 mjeri stvarno proteklo vrijeme pri početnom čekanju, buđenju i čekanju odgovora AM2320. Rani povrat pregledničkog sleep poziva ne skraćuje obvezno čekanje. Ne mijenjaju se modelna vremena, ACK, CRC ni razmak očitanja. Deterministički WASM pokus s povratkom 500 µs prerano pada na starom driveru s ENODEV i prolazi s novim. Zadržana je provjera nevaljanog CRC-a i odspojenog uređaja. Ostali programski izvori i zaključane Arduino biblioteke ostaju nepromijenjeni.

## Provjere

408 jedinstvenih prolaznih provjera: 349 ranijih Node slučajeva, 37 koračnog pogona, jedan novi AM2320 regresijski slučaj, 8 offline te 13 provjera jezgre/datoteka. Ukupno je 104 prevedena AVR artefakta, po 52 za Uno i Nano; ranijih 98 potpuno je jednako. Konačni Nano Worker i svih šest novih stvarnih AVR programa provjereni su s aktualnim izvorima.

Početna široka regresija imala je dvije pogreške: zastarjelo očekivanje da je A4988 još planiran i rani AM2320 prijenos. Nakon ispravaka ciljane skupine prolaze. Brojevi su deduplicirani kroz široku regresiju i ciljane ponovljene provjere; ne predstavljaju tvrdnju da je prvi široki pokušaj prošao bez pogreške. Dokazi i ograničenja nalaze se u stage15-evidence/validation.json.

## Izvori

- [Allegro A4988, 4988-DS Rev. 8, 5. 4. 2022.](https://www.allegromicro.com/-/media/files/datasheets/a4988-datasheet.pdf): naponi, ulazni pragovi, MS tablica/pull-down, STEP timing, ENABLE, RESET, SLEEP i strujna regulacija.
- [Pololu A4988 Stepper Motor Driver Carrier #1182](https://www.pololu.com/product/1182): izvedba carrier pločice, priključci, napajanje, lokalni kondenzator i postavljanje strujnog limita.

Izričiti Lab izbori: integrirani 100 µF carrier profil, izostanak strujne/termičke dinamike, odvojeni translator i idealni inkrementalni motor, determinističko odbijanje prekratkih impulsa i nezajedničke promjene mikrostepa. Nisu predstavljeni kao potvrđena svojstva fizičkog kompleta.
