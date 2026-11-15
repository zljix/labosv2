# Etapa 13C — TM1637

Isporuka **0.5.5-beta.1**, 13. studenoga 2026. Format projekta ostaje schemaVersion 3, model sklopa 1. Stabilna v1.0 nije proglašena.

## Implementirano ponašanje

TM1637 je zajednički funkcionalni model za ESP32-S3/MicroPython i stvarno prevedene Uno R3/Nano classic AVR programe. Model dobiva isključivo promjene električnih CLK/DIO mreža. Ne čita tekst programa, varijable ni broj namijenjen prikazu. Python `number()` i C++ `number()` sami računaju segmentne bajtove i šalju ih kroz GPIO; model slaže primljene bitove.

Podržani su START/STOP, LSB-first bajtovi, deveti ACK takt, 0x40 automatski i 0x44 fiksni upis, adrese C0–C5 te upravljanje 0x80–0x8F. Četiri vidljive znamenke koriste C0–C3. C4/C5 postoje u modelu memorije, ali nisu ožičene na ovaj pokaznik. Izvan C5 nema preslikavanja na C0. Ranije dovršeni bajtovi ostaju na snazi kad STOP prekine sljedeći bajt. Model upozorava na čitanje tipkovnice 0x42; ono nije implementirano.

Bitovi 0–6 pojedine znamenke upravljaju segmentima a–g. Bit 7 druge znamenke pali središnju dvotočku. Ostali decimalni zarezi nisu spojeni u odabranom satnom modulu. Osam svjetlina koristi omjere 1, 2, 4, 10, 11, 12, 13 i 14 / 16. Svjetlina 0 nije OFF. OFF zadržava memoriju; clear upisuje nule; nestanak napajanja u modelu resetira memoriju i ON stanje.

## Električni profil i granice

Komponenta je izričito **TM1637 satni modul + idealni dvosmjerni prilagodnik**, prema ranije uspostavljenom pristupu složenog LCD1602 profila. Peti priključak LV pripada prilagodniku, nije izmišljeni izvod golog četveropinskog modula. Ne tvrdi se da je svaki fizički modul kompatibilan s 3,3 V napajanjem.

| Priključak složenog profila | ESP32-S3 | Uno R3 / Nano classic |
| --- | --- | --- |
| VCC | 5 V | 5 V |
| GND | Zajednička masa | Zajednička masa |
| LV | 3,3 V, idealna prilagodba prema čipu | 5 V, izravna logička strana |
| CLK | GPIO4 | D2 |
| DIO | GPIO5 | D3 |

CLK i DIO imaju zasebne otpore 10 kΩ prema LV, ugrađene u složeni profil. To su otpori u DC rješavaču, ne kruti izvori HIGH. ACK se dodaje kao LOW otvorenog odvoda. Aktivni GPIO HIGH protiv njega daje pogrešku. Provjeravaju se VCC/LV, zajednička masa, zasebne signalne mreže, digitalna sposobnost pina, previsoka razina na ESP32 i moduli na istom CLK/DIO paru. TM1637 nema I2C adresiranje pa moduli na istom paru nisu neovisno adresabilni.

Modelni pragovi napajanja VCC 4,5–5,5 V i LV ±0,2 V te LOW/HIGH 0,3/0,7 LV pripadaju deklariranom funkcionalnom profilu. Odziv prevodnika razina i ACK LOW rješava se idealno; ne modeliraju se RC vrijeme porasta, struja segmenata, potrošnja, smetnje ni fotometrija. Primjeri koriste 20 µs programske stanke. Model odbacuje prekratke impulse ispod 0,4 µs, period CLK ispod 2 µs i DIO setup ispod 0,1 µs. To nije potpuna analogna provjera svih vremenskih tolerancija čipa.

## Upravljački izvori i primjeri

`lab_tm1637.py` i vidljivi projektni `lab_tm1637.h` vlastiti su MIT izvori. Nema nove vanjske biblioteke niti obećanja kompatibilnosti s proizvoljnim `TM1637Display` API-jima. Oba izvora provjeravaju ACK; Python javlja OSError, C++ vraća false. Izvor ostaje dio JSON/ZIP projekta; header ulazi u Arduino IDE izvoz. C++ koristi GPIO i delayMicroseconds bez zauzimanja dodatnog timera.

Četiri primjera postoje za sve tri izvršne kombinacije:

1. **Segmenti i CLK/DIO:** bitovi a–g i dvotočka, usporedba s bajtovnim zapisom.
2. **Brojač:** početna vrijednost −3, negativni brojevi i uklanjanje vodećih nula. Driver prihvaća −999 do 9999.
3. **Minute i sekunde:** demonstracijsko brojilo od 12:34, vodeće nule i promjena dvotočke. Nije RTC ni stvarno vrijeme.
4. **Svjetlina i gašenje:** svih osam razina, zatim OFF uz sačuvanu memoriju.

Mali pokaznik prikazan je iznad sklopa i na samoj komponenti. Mjerenja prikazuju memoriju, broj primljenih bajtova, pogreške te posljednjih 128 START/byte/write/ACK/STOP/power događaja po modulu. CSV ima stupce komponenta, vrijeme_us, operacija i vrijednost. Nije puni osciloskopski trag svakog CLK/DIO brida. Stop čuva rezultate; novi Run resetira zapis.

| Arduino primjer | Flash | Statički SRAM |
| --- | ---: | ---: |
| Segmenti | 2714 B | 190 B |
| Brojač | 3086 B | 202 B |
| Minute/sekunde | 3276 B | 202 B |
| Svjetlina | 2958 B | 200 B |

Osam novih prevedenih artefakata podiže ukupan broj na 84, po 42 za Uno i Nano. Sva 76 ranija artefakta ostaju bajtovno jednaka. Compiler ugovor, MicroPython WASM, loader i machine.py nisu promijenjeni.

## Provjera

**336/336 jedinstvenih provjera prolazi:** 288 ranijih Node slučajeva, 27 TM1637 slučajeva, 10 provjera jezgre, 3 provjere projektnih datoteka u runtimeu i 8 offline provjera. Završni paket zasebno prolazi 35/35 TM1637/offline slučajeva. U početnoj zajedničkoj seriji jedna stara tvrdnja očekivala je TM1637 kao planiran; prilagođena je novoj isporuci i cijeli taj skup prolazi 9/9. Dodatne ponovljene provjere nisu dvaput ubrojene.

Stvarno izvedene provjere i granice nalaze se u `docs/stage13c-evidence/validation.json`. Povijesne rezultate ranijih etapa treba zadržati; nove regresijske snimke spremaju se u ovu etapu. Ponavljanje iste provjere ne povećava broj jedinstvenih provjera.

Preglednik Chromium/Linux: Python programsko brojilo prikazuje vrijeme i dvotočku; AVR Uno primjer također prikazuje brojilo; primjer svjetline ispisuje 0–7 i OFF. Stop zadržava prikaz i zapis. CSV je stvarno preuzet i pregledan: UTF-8 BOM, četiri stupca i 128 događaja. To nije potvrda Safari/iOS, Androida ni fizičkog TM1637 sklopa.

Nisu potvrđeni ciljno školsko računalo, učenički pilot i hladno offline otvaranje privatne produkcijske domene. Naslijeđene nastavne vježbe zadržavaju svoje brojeve. Sljedeća razvojna etapa prema planu je **14 — aktuatori i pogonski sklopovi**.

## Izvor protokola

[Titan Micro Electronics TM1637 datasheet V2.4, preslika kod M5Stacka](https://m5stack.oss-cn-shenzhen.aliyuncs.com/resource/docs/datasheet/unit/digi_clock/TM1637.pdf): komunikacija i ACK str. 3, naredbe str. 4–5, priključci/pull-up str. 8, električni i vremenski podaci str. 9–10. Četveroznamenkasta geometrija, ožičenje dvotočke, idealni prilagodnik, broj događaja i API vlastitih drivera izričite su odluke ovog projekta.
