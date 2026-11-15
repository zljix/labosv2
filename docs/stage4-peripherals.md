# Etapa 4 — senzor, zaslon i aktuator

Isporuka v0.1.4 nastavlja etapu 3 bez promjene schemaVersion 2 / modelVersion 1. v0.2 ostaje naziv nastavne bete nakon etape 5. Referentna pločica ostaje ESP32-S3-DevKitC-1 v1.1 N16R8; ne potvrđuje se korisnikov fizički model pločice.

## Jedan projekt i vidljive datoteke

Primjer **AHT10 → OLED → servo** otvara novi projekt s main.py, aht10.py, ssd1306.py i servo.py. AHT10 upravljački kôd šalje stvarne bajtove inicijalizacije i mjerenja, provjerava status i dekodira dva 20-bitna polja. SSD1306 je neizmijenjen, lokalno uključen upravljački program iz micropython-lib; koristi pravi framebuf te writeto/writevto. Servo upravljačka klasa pretvara kut u PWM duty_ns. Program nema prečac koji izravno čita kontrole ili crta gotov tekst zaslona.

| Veza | GPIO / napajanje | Kod |
| --- | --- | --- |
| AHT10 SDA / SCL | GPIO8 / GPIO9 | I2C(0), 100000 Hz, 0x38 |
| OLED SDA / SCL | GPIO10 / GPIO11 | I2C(1), 400000 Hz, 0x3C |
| Oba I2C modula VCC / GND | 3V3 / zajednička masa | Model modula 3,3 V |
| Servo SIG / V+ / GND | GPIO4 / 5V / zajednička masa | PWM 50 Hz, 500–2500 µs |

Engleski ASAIR AHT10 priručnik navodi da se AHT10 ne dijeli s drugim I2C uređajima (PDF str. 8/13). Zbog te napomene odabran je konzervativni profil s odvojenim sabirnicama. To je izričito pravilo ovog profila; nije dokaz o ponašanju svake fizičke inačice modula. Statička provjera odbija AHT10 i drugi uređaj na istim SDA/SCL mrežama. Drugi GPIO-i rade kada se odgovarajuće promijene vodiči i kôd.

## Podržani I2C API

- `I2C(id, *, scl, sda, freq=400000, timeout=50000)`, id 0 ili 1; dva različita izložena GPIO-a, frekvencija 1–400000 Hz.
- `init` s izričitim pinovima, `deinit`, `scan`, `writeto`, `writevto`, `readfrom`, `readfrom_into`.
- 7-bitne adrese; scan obuhvaća 0x08–0x77. Najviše 4096 bajtova po prijenosu. writevto spaja buffer objekte u jedan prijenos i vraća broj potvrđenih podatkovnih bajtova. readfrom_into koristi izvorni zapisivi buffer, uključujući izrezani memoryview i više-bajtni array.
- Dva objekta istog hardverskog id-a dijele konfiguraciju; ponovni init mijenja tu sabirnicu. Dvije sabirnice ne mogu prisvajati iste GPIO-e. Novi Worker briše konfiguraciju.
- Prijenosi zahtijevaju STOP. `stop=False` i nepodržane naredbe modela daju `NotImplementedError`, uz opis u provjeri spojeva. Memorijske metode, SoftI2C primitive i SPI nisu implementirani.
- Nema bitne emulacije, arbitraže, clock stretchinga, RC vremena porasta ni stvarne brzine prijenosa. freq i timeout su provjerene postavke; ne određuju trajanje prijenosa u ovom modelu.

SDA/SCL uređaja uspoređuju se s mrežama odabranih GPIO-a. Zamijenjene/odspojene linije, pogrešna adresa, nedostajuća masa ili nevaljan napon uklanjaju ACK. `scan()` tada izostavlja uređaj; konkretno čitanje/upis daje `OSError(19)` i označene priključke u provjeri spojeva. Nepodržan sadržaj daje posebnu pogrešku modela, a ne proizvoljan broj. Aktivni OUT/PWM izvor na liniji sabirnice također se odbija.

Moduli imaju uključene pull-up otpornike od 4,7 kΩ na VCC; mogu se isključiti u svojstvima i zamijeniti vanjskim otpornicima. To su deklarirana svojstva virtualnih modula, ne tvrdnja da svaki kupljeni modul ima isti sklop. DC rješavač uključuje te otpornike. Modul se smatra napajanim uz masu blizu 0 V i 2,7–3,6 V između VCC i GND; odabrani profil koristi 3,3 V. Izravni spoj VCC modula na 5 V statička je pogreška.

Promjena napajanja iz programa uklanja ACK i vraća uređaj u početno stanje: AHT10 gubi kalibracijski bit i nedovršeno mjerenje, OLED gubi sadržaj GDDRAM-a i postavke prikaza. Model zanemaruje parazitsko napajanje i prijelazne pojave.

## AHT10

Model prihvaća E1 08 00 (kalibracijska inicijalizacija), AC 33 00 (mjerenje), BA (soft reset) i 71 (status). Status ima bit 7 za busy i bit 3 za kalibraciju. Početna spremnost modela traje 20 ms, inicijalizacija 10 ms, pretvorba 80 ms. To su fiksni modeli vremena, ne jamstvo stvarnog senzora. Upravljačka datoteka ograničeno provjerava busy umjesto da pretpostavi savršeno precizno čekanje preglednika.

Okoliš je –40 do 85 °C i 0–100 % RH. Uzorak se zaključava pri naredbi mjerenja; promjena klizača ne mijenja uzorak koji je već u pretvorbi. Čitanje 1 bajta vraća status; 6 bajtova vraća status i pakirana 20-bitna polja. Nema CRC-a AHT20. Na 100 % RH 20-bitno polje zasićuje na 1048575 (malo ispod matematičkih 100 %). Nema šuma, tvorničke pogreške, termičkog kašnjenja ni samogrijanja.

## SSD1306

Model je I2C 128 × 64, 1024 bajta GDDRAM-a, adresiranje horizontalno/vertikalno/po stranicama. Obrađuje kontrolne bajtove Co i D/C#, nastavak naredbi kroz više transakcija, prozor stupaca/stranica, početni stupac/stranicu, display on/off, invert, entire on, segment remap, COM smjer, start line, display offset i contrast. Init naredbe za analogni timing, charge pump, IREF i COM konfiguraciju prihvaćaju se radi upravljačkog programa; njihova električna dinamika nije modelirana. Multiplex modela ostaje 64.

Podržane adrese su 0x3C i 0x3D. Dva OLED-a s različitim adresama na istoj sabirnici imaju odvojenu memoriju. Dvostruka adresa statički se odbija. Scroll, blink, zoom i čitanje GDDRAM-a nisu podržani. Nepoznata naredba daje pogrešku. Prikaz pločice i povećani monitor koriste iste stvarne piksele; tekst se rasterizira izvornim framebuf modulom u MicroPythonu.

Fizička orijentacija prikaza definirana je tako da uobičajeni init A1/C8 prikazuje framebuf uspravno. A0/C0 mijenja osi. Kontrast mijenja relativnu vidljivost, bez fotometrijske kalibracije.

## Servo

Zadani položaj proizlazi iz PWM izvora na mreži SIG, uz 4,5–5,5 V na V+ i zajedničku masu. Model prihvaća 50 Hz i 500–2500 µs, linearno 0–180°, s tolerancijom 1 µs zbog postojeće duty_u16 kvantizacije. Za 500 µs prikaz zato može biti 499,9 µs. Nema valjanog kuta bez PWM-a, pri deinit, pogrešnoj frekvenciji, izvan raspona impulsa ili bez napajanja. Stanje objašnjava razlog.

Nema momenta, brzine zakretanja, opterećenja, mehaničkih sudara, zastoja, struje motora, pada napona ili oštećenja. Signal treba biti na istoj mreži vodiča/breadboarda kao PWM izvor; ne emulira se ručno stvaranje impulsa promjenama Pin.value. Stvarni raspon serva i napajanje treba provjeriti za odabrani hardver. Primjer napajanja u virtualnom sklopu nije proračun fizičkog pogona.

## Kontrole i mjerenja

U zaustavljenom stanju klizači spremaju početni okoliš; tijekom rada mijenjaju samo sesiju. Run/Reset pokreću spremljenu snimku datoteka i topologije s početnim okolišem. Primjer očitava oko svake 2 s: otvara na 28 °C, zatvara na 26 °C, između pamti prethodno stanje (histereza).

Svako dovršeno šestobajtno očitanje novog AHT10 uzorka ulazi u zapis (maks. 200). Ponovno čitanje istog uzorka ne dodaje duplikat. Kartica Mjerenja prikazuje zadnjih 20; CSV izvozi sva zadržana očitanja s vremenom, id-em senzora, rednim brojem i numeričkim vrijednostima. CSV koristi UTF-8 BOM, zarez kao razdjelnik i decimalnu točku. Zaustavi zadržava posljednju snimku za pregled/izvoz. Run, Reset, promjena sklopa i otvaranje drugog projekta brišu snimku. Zapis mjerenja nije dio spremljenog projekta; CSV treba preuzeti zasebno prije novog pokretanja ili zatvaranja.

I2C zapis čuva 100 zadnjih prijenosa; prikazuje prvih 16 bajtova, duljinu, adresu, sabirnicu i ACK/pogrešku. Scan se ne zapisuje. Bounded buffers i ograničavanje frekvencije prikaza zadržani su iz prethodnih etapa.

## Izvori i provenijencija

- MicroPython 1.29.0 I2C: https://docs.micropython.org/en/v1.29.0/library/machine.I2C.html
- Aosong/ASAIR AHT10 V1.1: https://www.aosong.com/userfiles/files/media/aht10%E8%A7%84%E6%A0%BC%E4%B9%A6v1_1%EF%BC%8820191015%EF%BC%89.pdf
- ASAIR engleski priručnik (preslika): https://arduino.ua/files/AOSONG_AHT10_EN.PDF
- Solomon Systech SSD1306 Rev.1.5 (preslika kod proizvođača modula): https://www.olimex.com/Products/Modules/LCD/MOD-OLED-128x64/resources/SSD1306.pdf
- SSD1306 upravljački izvor: micropython/micropython-lib, commit a08087249fda8a7994f7c54ccaad29fb9fcc448a; putanja micropython/drivers/display/ssd1306/ssd1306.py. Lokalna kopija uspoređena je s tom točnom izvornom verzijom.

`runtime/build-provenance.json`, `runtime/SHA256SUMS` i `docs/reproducibility-stage4.json` bilježe C most, alate i izlaze dviju čistih izgradnji u istom okruženju. `public/drivers/provenance.json` bilježi hash upravljačkih datoteka. Stari dokazi i provenijencija prethodnih etapa ostaju odvojeni.

Provjere Chromiuma/Linuxa i Node Workera ne predstavljaju potvrdu Safari/iOS-a, Firefoxa, Edgea, školskog računala ili fizičke pločice. Offline/PWA i nastavničko vrednovanje nisu dio ove etape.
