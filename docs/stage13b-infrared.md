# Etapa 13B — NEC daljinski, prijamnik i modulirani predajnik

Izdanje **0.5.4-beta.1 · 13. studenoga 2026.** Format projekta ostaje 3, model sklopa 1. Nastavlja postojeću privatnu aplikaciju; pet nastavnih vježbi zadržava numeraciju. Stabilna v1.0 nije proglašena.

## Električni i optički ugovor

Tri nove komponente imaju izričite Lab profile. Nisu univerzalni pinout svih fizičkih modula.

| Komponenta | Profil |
| --- | --- |
| IR prijamnik | VCC, GND, OUT; profil napajanja 3,3 ili 5 V; 30 kΩ OUT–VCC i aktivni LOW sink 10 Ω dok traje primljeni impuls |
| NEC daljinski | Virtualna interna baterija, bez električnih izvoda; adresa/naredba 0–255, kratki pritisak ili do 2 s s posebnim ponavljanjem |
| IR predajnik | VCC, GND, SIG; izričit modul s ugrađenim tranzistorskim pogonom i ograničenjem struje; funkcionalni ulaz 34–42 kHz i radni omjer 15–50 % |

ESP32 primjer koristi napajanje 3,3 V, OUT=GPIO4, predajnik SIG=GPIO5 i LED=GPIO7 preko 680 Ω. Uno/Nano koristi 5 V, OUT=D2/INT0, SIG=D3/OC2B i LED=D9 preko 680 Ω. Napajanje 5 V na prijamničkom OUT pull-upu blokira ESP32 projekt. Nepostojeći digitalni ulaz (Nano A6/A7), odspojen signal i masa imaju dijagnostiku. Pogon GPIO HIGH protiv aktivnog LOW prijamnika prijavljuje sukob.

**Optička skupina 1–16** određuje idealnu virtualnu putanju među uređajima. Nije NEC adresa, radijski kanal ni frekvencija nositelja. Zapreka prijamnika prekida putanju; razmak i kut nacrtanih komponenti ne određuju fizički domet. Više prijamnika može primiti isti optički signal. Istodobne emisije zbrajaju se logičkim OR-om optičkih impulsa, bez fizičkog zbrajanja intenziteta. U ovom izdanju postoji jedan izvršni čvor/program.

## NEC vremenski niz

| Dio | Trajanje / oblik |
| --- | --- |
| Uvod | Impuls 9000 µs pa razmak 4500 µs |
| Podaci | Adresa, inverz adrese, naredba, inverz naredbe; svaki bajt 8 bita, LSB prvi |
| Bit 0 | Impuls 562,5 µs pa razmak 562,5 µs |
| Bit 1 | Impuls 562,5 µs pa razmak 1687,5 µs |
| Kraj | Završni impuls 562,5 µs |
| Posebni repeat | Impuls 9000 µs, razmak 2250 µs, završni impuls 562,5 µs; bez novih podataka |
| Dugi pritisak | Prvi puni okvir, ponavljanja svakih 110000 µs od početka; do 18 ponavljanja za 2 s |

Daljinski zakazuje početak 10 ms nakon ulazne radnje. Novi pritisak dodaje se nakon prethodnog niza uz najmanje 40 ms mirovanja. Red je ograničen; završeni trag čuva posljednja 512 brida po komponenti. Izvorne postavke projekta ne mijenjaju se živim upravljanjem. Stop čuva posljednji dostavljeni trag, novo pokretanje stvara nove instance i briše događaje.

Podržan je **standardni NEC s 8-bitnom adresom i 8-bitnom naredbom**. Extended NEC, NEC2, ONKYO i drugi protokoli nisu deklarirani. Pokusi pogreške mijenjaju inverzni bajt naredbe ili skraćuju uvod na 3 ms; ne ubacuju gotovu pogrešku u dekoder. Učenikov program odlučuje prihvatiti ili odbaciti primljene impulse.

## Stvarni upravljački programi

**MicroPython — lab_ir.py:** `NECReceiver.read()` mjeri OUT kroz `machine.time_pulse_us`, sastavlja bitove i provjerava oba para inverznih bajtova. Čeka početak u ograničenom prozoru od 12 ms virtualnog vremena, a između poziva primjer koristi `sleep_ms(1)` i prepušta izvođenje Workeru. Za MicroPython projekte s IR prijamnikom koristi se zaseban softverski sat: eksplicitni sleep pomiče vrijeme, ali proizvoljna stanka preglednika između API poziva ne preskače optički niz. GPIO očitanja i ticks pomiču ga za 1 µs po pozivu; to nije brojanje procesorskih instrukcija. Tijekom mjerenja zaključava funkcionalni mikrosekundni sat postojećim `disable_irq`/`enable_irq` adapterom. To ne dodaje ESP32 hardverske IRQ-ove niti Xtensa emulaciju. Prespor poziv može propustiti cijeli okvir.

Valjan rezultat je `(adresa, naredba, repeat)`. Nevaljan okvir podiže ValueError i briše prethodni kontekst. Poseban repeat prihvaća se samo uz prethodno valjan okvir ili repeat star najviše 150 ms. Sam repeat nema novu naredbu. Vrijednosti se nikada ne dodjeljuju programu iz modeliranog daljinskog.

**Arduino — lab_nec.h:** izvor je vidljiva datoteka projekta, uključena u JSON/ZIP i Arduino IDE izvoz. Stvarni AVR program koristi INT0 CHANGE i `micros()` za mjerenje bridova. Prijam ne zauzima timer. Jedan prijamni pretinac čuva posljednji nepročitani rezultat; `overruns` broji prepisivanje ako program ne čita dovoljno često. `received` broji prihvaćene okvire; sporo čitanje ne stvara skriven red poruka. Provjeravaju se vremenski rasponi, inverzni bajtovi, zastarjela i izolirana ponavljanja.

Oba dekodera i model vlastiti su MIT izvori. **Arduino-IRremote nije integriran niti se obećava kompatibilnost svih njegovih API-ja.** Njegova dokumentacija služi provjeri NEC protokola. Ne uvodi se nova vanjska Arduino biblioteka ni izmjena zaključanog kompilacijskog ugovora.

## Nositelj i predajnik

Python `NECTransmitter.send(adresa, naredba, repeats=0)` uključuje/isključuje PWM od 38 kHz i jednog trećeg radnog omjera oko NEC impulsa. Podržava 0–18 posebnih ponavljanja, razmaknutih po 110 ms. Blokirajući Python primjer pokazuje prijamnički OUT trag; **ne tvrdi da isti Python program istodobno prima i dekodira vlastiti blokirajući prijenos**. Zasebni programi/čvorovi slijede u etapi 21.

Arduino `LabNECSender` stvarno postavlja Timer2 fast PWM na D3: prescaler 8, TOP=OCR2A=51, OCR2B=17, frekvencija približno 38,46 kHz. Prijamnik dobiva stvarne izlazne bridove; model potvrđuje razmak i trajanje nositelja, a ovojnicu otpušta 80 µs nakon posljednjeg potvrđenog impulsa. To je idealizirani demodulator, ne Vishay AGC model. Stalni HIGH, 1 kHz i nevaljan radni omjer ne daju prijam. Primjer istodobno dekodira preko INT0.

`send(adresa,naredba,repeats)` i `repeat()` omogućuju dodatne pokuse. Slanje zauzima **Timer2, tone() i PWM D3/D11**. Prijam sam koristi INT0; LED PWM D9 ostaje Timer1. Nisu obećane sve kombinacije s drugim budućim bibliotekama i pogonima.

## Primjeri i dokazi

Četiri primjera postoje za ESP32-S3/MicroPython i za Uno/Nano Arduino C/C++:

1. Vremenski niz: Python ispisuje cijeli izmjereni niz, Arduino uvod i posljednja bitna trajanja.
2. NEC adresa/naredba/repeat i pokusi nevaljanog prijenosa.
3. LED: adresa 0, POWER=69 mijenja stanje samo za novi okvir, PLUS=70 i MINUS=21 mijenjaju PWM za 10 %, uključujući repeat.
4. Predajnik s uparenim prijamnikom: Python OUT trag, Arduino stvarni Timer2/INT0 loopback.

Mjerenja nude CSV s komponentom, vrstom, vremenom brida, razinom i trajanjem. RX trag predstavlja modelirani demodulirani izlaz, TX/daljinski optičku ovojnicu; pojedinačne oscilacije 38 kHz nisu dio tog CSV-a. To nisu potvrđena programska očitanja. Programski dekodirani rezultat nalazi se u konzoli.

Broj i rezultati stvarno izvedenih provjera navedeni su u konačnom sažetku `docs/stage13b-evidence/validation.json`. Povijesni dokazi ranijih etapa čuvaju se, a nove regresijske snimke spremaju uz ovu etapu. Ponavljanja nisu nove jedinstvene provjere.

## Ograničenja i izvori

Model nema optičku snagu, udaljenost, refleksije, AGC, šum, fizičke RC prijelaze ni potvrdu stvarnog modula. Funkcionalni virtualni mikrosekundni sat ne jamči jednaku brzinu stvarnog vremena na svim uređajima. Safari/iOS, Android, školsko računalo, hladno offline otvaranje privatne produkcijske domene, fizička oprema i učenički pilot ostaju zasebne nepotvrđene provjere.

- [Arduino-IRremote: NEC vremenske konstante](https://arduino-irremote.github.io/Arduino-IRremote/TinyIR_8h_source.html): struktura i redoslijed, približne NEC jedinice, period 110 ms. Ovaj model izričito koristi 562,5/1687,5 µs i 9000/4500 µs; to su njegove nominalne vrijednosti unutar očekivanih raspona dekodera.
- [Arduino-IRremote: opis biblioteke i NEC/NEC2](https://github.com/Arduino-IRremote/Arduino-IRremote): razlika posebnog ponavljanja i ponovnog punog okvira, TinyReceiver prekidi, ograničenja timera.
- [Vishay TSOP382/TSOP384 datasheet](https://www.vishay.com/docs/82491/tsop382.pdf): prijamnik daje demodulirani izlaz. Lab modul i njegovi izvodi, 30 kΩ/10 Ω te optičke skupine projektni su ugovor; ne potvrđuju točnu izvedbu fizičkog korisnikova modula.

Sljedeći paket prema planu je **13C — TM1637**, s CLK/DIO protokolom, segmentima i svjetlinom. Nije dio ove isporuke.
