# Etapa 14 — aktuatori i DC pogon

Isporuka **0.6.0-beta.1**, 13. studenoga 2026. Projekt ostaje schemaVersion 3 / modelVersion 1. Postojeći idealizirani servo i stari projekti ostaju zasebni od SG90 profila. Stabilna v1.0 nije proglašena.

## Proširenje

Sedam novih komponenti: idealni DC izvor 5–12 V, kalibrirani SG90, relej s prilagodbom ulaza, generička aktivna zujalica, pasivni piezo s pogonom, L298N modul i funkcionalni DC motor tipa 130. Sedam primjera postoji za ESP32-S3/MicroPython te Uno R3 i Nano classic/Arduino C/C++. Primjeri su komentirani, izvorni kod vidljiv i izvozi se s projektom. Servo 1.2.2 već je dio zaključanog prevoditeljskog paketa; nije dodana nova vanjska biblioteka.

Modeli ne čitaju program, nazive varijabli ni ispisanu ciljnu vrijednost. Izlaz nastaje iz sastavljenih mreža, GPIO stanja, stvarnih AVR impulsa ili funkcionalnog MicroPython PWM-a. Relej mijenja električnu topologiju: COM se veže na NO ili NC, pa struja LED-a u kontaktnom krugu stvarno ovisi o kontaktima. Kontaktni krug može imati odvojenu masu od upravljačke strane.

## Profili i granice

| Komponenta | Funkcionalni ugovor |
| --- | --- |
| DC izvor | Idealan izvor 5–12 V, bez strujnog ograničenja, unutarnjeg otpora ili dinamike baterije. Minus je referenca vlastitog izvora; modeli pogona dodatno zahtijevaju eksplicitnu žičanu zajedničku masu s pločicom. Nije model MB102 regulatora ili USB napajanja. |
| SG90 | V+=5 V, zajednički GND, 50 Hz. Modelni raspon 1000–2000 µs daje 0–180°, podesiv unutar 500–2500 µs. Program i model moraju imati iste granice. Bez momenta/opterećenja/inercije. Fizički raspon pojedinog SG90 nije zajamčen. Stari idealni servo zadržava 500–2500 µs. |
| Relej | Složeni Lab profil VCC=5 V, LV=3,3/5 V, IN, GND, COM/NO/NC. LV pripada idealnom prilagodniku, nije univerzalni izvod fizičkog modula. LOW/HIGH svojstvo; otpornik 10 kΩ drži neaktivno stanje otvorenog IN. Pragovi 0,3/0,7 LV. Bez napajanja i pobude COM–NC. Idealni kontakti bez poskakivanja, kašnjenja i strujne granice. Niskonaponski nastavni primjeri. |
| Aktivna zujalica | Generički Lab modul VCC=5 V, GND, SIG s pogonom, aktivan HIGH od 2,3 V. Vlastiti modelni oscilator 2300 Hz; DC HIGH daje ton. To nije potvrda izvedbe SFM-20B iz kompleta. |
| Pasivni piezo | Lab modul s idealnim pogonom: VCC=5 V, GND, SIG. Signal 100–10000 Hz i nenulti/nepuni radni omjer daje ton; DC ne daje trajni ton. To nije goli zvučnik na GPIO-u. Bez akustičke snage, impedancije i frekvencijskog odziva. |
| L298N | Dva mosta, VS=5–12 V, VSS=5 V, GND zajednički. Regulator 5V-EN isključen i VSS je ulaz. Profil uključuje idealizirane zaštitne diode; ne simulira njihove tranzijente. ENA/ENB jumperi izravno spajaju EN na VSS, zato se moraju ukloniti za GPIO/PWM. TTL LOW≤1,5 V, HIGH≥2,3 V. EN LOW daje Hi-Z; EN HIGH i jednaki IN daju kočenje. Stalni podesivi ukupni pad 0–4 V, zadano 2 V. To nije strujno ovisna karakteristika stvarnog L298. |
| Motor 130 | Dva izvoda, predznak srednjeg diferencijalnog napona određuje smjer; relativni pokazatelj = 100 × |srednji napon| / nazivni parametar, zasićen na 100 %. Zadano 6 V. Nije RPM, stvarna mehanička brzina, struja zastoja ili potvrda bilo kojeg motora formata 130. Nema inercije, momenta, induktiviteta ni termike. |

Kod MicroPython PWM-a motor se vrednuje po fazama radnog omjera; Hi-Z dio EN ciklusa doprinosi nuli naponskom pokazatelju. AVR motor koristi vremensku integraciju stvarnih GPIO promjena u okviru mjerenja. Potpuno odspojen motor nema valjan diferencijalni napon. Prikaz kočenja i slobodnog zaustavljanja razlikuje električki način, ali oba bez mehanike daju nultu relativnu brzinu. Ne prikazuje se usporavanje iz inercije.

Provjere odbijaju izravni GPIO motor, previsok vanjski izvor na GPIO-u, spoj izlaza mosta na aktivni izvor, kratki spoj izlaza istog mosta i postavljen EN jumper uz GPIO. Relej može tijekom rada stvoriti sukob izvora preko kontakta; runtime ga dijagnosticira. Nevaljano napajanje ili izostanak zajedničke mase onemogućava pogon. Ovo nije potpuna električka certifikacija ili SPICE.

## Primjeri i priključci

| Primjer | ESP32-S3 | Uno / Nano |
| --- | --- | --- |
| SG90 · kalibracija i impuls | SIG GPIO6 | SIG D8, Servo 1.2.2 |
| Relej · COM, NO i NC | IN GPIO6, LV 3V3 | IN D7, LV 5 V |
| Aktivna zujalica | SIG GPIO7 | SIG D4, digitalWrite |
| Pasivni piezo · frekvencija i trajanje | PWM GPIO7 | SIG D4, tone/noTone |
| DC motor · smjer, PWM i kočenje | ENA GPIO4, IN1/2 GPIO8/9 | ENA D5, IN1/2 D7/12 |
| L298N · dva neovisna motora | ENB GPIO5, IN3/4 GPIO10/11 | ENB D6, IN3/4 D10/11 |
| Servo + motor + ton | PWM GPIO6/4/7 | Servo D8/Timer1, motor D5/Timer0, piezo D4/Timer2 |

Servo ima zaseban izvor 5 V. Primjeri L298N koriste zasebni VS=6 V, VSS=5 V, zajedničku masu i oba uklonjena EN jumpera. Pad 2 V daje približno 4 V na motoru pri punom PWM-u, oko 2 V pri 50 %. Drugi most može raditi u drugom smjeru i s drugim radnim omjerom. U primjeru releja COM preklapa zaseban 5 V krug s dva LED-a i otpornicima 680 Ω.

## Timeri i zvuk

| AVR resurs | Korištenje i sukob |
| --- | --- |
| Timer0 | millis/delay i PWM D5/D6. Primjeri ne mijenjaju konfiguraciju corea. |
| Timer1 | Servo 1.2.2; analogWrite D9/D10 dijeli isti timer. Servo SIG može biti obični digitalni pin, ovdje D8. |
| Timer2 | tone/noTone, PWM D3/D11 i postojeći IR nositelj na D3. Nisu neovisne istodobne funkcije. |
| INT0 / polling NEC | Postojeći IR prijam ne zauzima Timer2; ipak može propustiti signal ako program/biblioteka onemogući prekide ili ne čita dovoljno često. |

Runtime prati stvarne registre i impulse te ne dodjeljuje timer automatski drugom pinu. MicroPython PWM je funkcionalan model; raspodjela ESP32 LEDC timera nije simulirana. Frekvencija pasivnog tona na AVR-u proizlazi iz uhvaćenih bridova, a ne iz argumenta funkcije tone.

Web Audio se aktivira samo gumbom **Uključi slušanje**. Vizualni ton je dostupan bez zvuka. Stop/odlazak iz komponente zaustavlja oscilatore; rezultat ostaje zadnja snimka mjerenja. Slušanje nije preduvjet automatske provjere. Zvučnik i akustička reprodukcija stvarnog uređaja nisu fizički provjereni.

## Mjerenja i izvoz

Mjerenja sadrže motorni predznak, srednji napon i relativni pokazatelj, trenutačni način mosta, relejno stanje i frekvenciju tona. Zapis zadržava posljednjih 128 kontaktnih događaja i uzoraka prikaza; nije puni zapis svakog brida. CSV ima UTF-8 BOM i četiri stupca: vrijeme_us, komponenta, operacija, vrijednost. Komponenta uključuje oznaku i stabilni ID kako bi se razlikovale i jednake korisničke oznake. Stop čuva rezultate. Novi Run/Reset stvara novu sesiju i novi zapis. Uvoz/izvoz JSON/ZIP zadržava profile i kôd; Arduino izvoz čuva sketch i zaključani odabir Servo biblioteke.

## Provjera i otvoreno

`verification/actuators.test.ts` obuhvaća parser, sve primjere/projekte, stvarne relejne mreže, napajanje, oba mosta, PWM i integraciju, SG90, zujalice, vremenske sukobe i stvarne MicroPython/AVR programe. Novi dokazi pohranjuju se u `docs/stage14-evidence/`; stari dokazi ostaju povijesni. `validation.json` navodi konačan broj jedinstvenih slučajeva i stvarno izvršene provjere.

Školsko računalo, učenički pilot, Safari/iOS, Android, hladno offline otvaranje privatne produkcijske domene i fizička oprema ostaju zasebno nepotvrđeni. Stabilna v1.0 nije proglašena. Sljedeća planirana etapa je 15: A4988 i parametrizirani bipolarni koračni motor.

## Izvori

- [ST L298, DS0218 Rev 5](https://www.st.com/resource/en/datasheet/l298.pdf): odvojeni VS/VSS, TTL pragovi, enable, kočenje/slobodno zaustavljanje i ovisnost pada o struji. Model namjerno koristi uži VS profil i izričit stalni pad.
- [Arduino Servo 1.2.2, uključeni zaključani izvor](../vendor/arduino/Servo/src/avr/Servo.cpp) i [Servo.h](../vendor/arduino/Servo/src/Servo.h): Timer1, attach/min/max i impulsi. Ne mijenja se vendor kod.
- [Arduino AVR core 1.8.6 Tone.cpp](https://github.com/arduino/ArduinoCore-avr/blob/1.8.6/cores/arduino/Tone.cpp) i [Arduino tone dokumentacija](https://docs.arduino.cc/language-reference/en/functions/advanced-io/tone/): Timer2 i PWM D3/D11. Zaključani lokalni core korišten je za prevođenje provjera.
- [TowerPro SG90 Digital](https://towerpro.com.tw/product/sg90-7/): proizvođač navodi 4,8 V i postoje različite izvedbe. Stranica ne opravdava univerzalni točan hod za 1000–2000 µs; kalibracija u ovom projektu izričit je funkcionalni parametar.

Generičke zujalice, 2300 Hz oscilator, LV prilagodnik releja, idealni izvori, modelni napon motora 130 i stalni pad L298N projektne su odluke; nisu proglašeni potvrđenim svojstvima korisnikove fizičke opreme.
