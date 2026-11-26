# Početni programi za URS laboratorijske vježbe

Ovo su početni programi, a ne gotova rješenja podzadataka P1–P3. Program i upute moraju imati isti broj vježbe iz ovoga izdanja.

## Arduino Nano

1. Raspakirajte ZIP prije otvaranja programa. Svaka `.ino` datoteka ostaje u svojoj istoimenoj mapi.
2. U Arduino IDE-u odaberite **Arduino AVR Boards → Arduino Nano**, zatim **ATmega328P** ili **ATmega328P (Old Bootloader)** prema stvarnoj pločici. Odaberite njezin serijski priključak.
3. Instalirajte knjižnice iz tablice. Ovisnosti koje Library Manager ponudi također instalirajte.
4. Za LV5 dodajte `Knjiznice/AHTxx_1.2.0.zip` preko **Sketch → Include Library → Add .ZIP Library**. Knjižnica se može prikazati pod nazivom **AHT1x/AHT2x**; program uključuje `AHTxx.h`.
5. Najprije pokrenite Verify. Upload i spajanje napajanja izvedite redoslijedom iz Word upute. Serijski monitor u svim programima koji ga koriste radi na **9600 baud**.

Serijski monitor služi prikazu. Programi LV3–LV15B ne primaju tekstne naredbe iz monitora. LV10 zahtijeva da učenik najprije očita kodove svojega IR daljinskog, upiše ih u konstante i tek zatim postavi `KODOVI_SPREMNI = true`.

## Inačice preuzete iz izdanja v6

Popis odgovara prethodno provjerenom paketu v6. Za preglednije zapisane programe v7 potrebno je ponovno pokrenuti Arduino Verify; opseg provedene usporedbe opisan je u `Provjera_prijevoda.md`.

| Knjižnica ili paket | Inačica | Primjena |
|---|---|---|
| Arduino AVR Boards | 1.8.8 | Klasični Nano, ATmega328P |
| OneWire | 2.3.8 | LV3, LV5, LV13 |
| DallasTemperature | 4.0.6 | LV3, LV5, LV13 |
| DHT sensor library | 1.4.7 | LV4, LV5 |
| Adafruit Unified Sensor | 1.1.15 | Ovisnost DHT knjižnice |
| AHT1x/AHT2x odnosno AHTxx | 1.2.0 | LV5; priložen ZIP |
| Servo | 1.3.0 | LV6 |
| Adafruit GFX Library | 1.12.6 | LV2, LV7, LV8 |
| Adafruit BusIO | 1.17.4 | Ovisnost Adafruit knjižnica |
| Adafruit SSD1306 | 2.5.17 | LV2, LV8 |
| Adafruit ST7735 and ST7789 Library | 1.11.0 | LV7 |
| Adafruit BMP085 Library | 1.2.4 | LV8; podržava BMP180 |
| IRremote | 4.7.1 | LV10; API s `IRremote.hpp` |
| TM1637, Avishay Orpaz | 1.2.0 | LV12 |

`Wire`, `SPI` i `util/atomic.h` dolaze s Arduino AVR paketom. Ne instaliraju se kao zasebne nasumično odabrane knjižnice. `Wire.setWireTimeout()` zahtijeva odgovarajuću inačicu AVR paketa.

## Povezivanje s vježbama

| LV | Početni program |
|---|---|
| 1 | Nano, LED i serijski ispis |
| 2 | OLED pokaznik |
| 3 | LM35 i DS18B20 |
| 4 | DHT11 i DHT22 |
| 5 | Svih pet temperaturnih senzora i tri mjerenja RH |
| 6 | SG90 servo i potenciometar |
| 7 | Relej, TFT i tipka |
| 8 | BMP180, OLED i model razine |
| 9 | TEMT6000 i model rasvjete |
| 10 | IR daljinski i relej |
| 11 | Dvopoložajna regulacija modela razine |
| 12 | Sekvencija i TM1637 odbrojavanje |
| 13 | DS18B20 i logika regulacije temperature |
| 14 | L298N, PWM i STOP prekid |
| 15 | 28BYJ-48 5 V s ULN2003 |
| 15B | NEMA 17 s A4988 |
| 16 | PLC ST program u simulatoru CODESYS |

U LV5 senzori imaju stalne pinove: LM35 A0, DS18B20 D2, DHT11 D4, DHT22 D5 te AHT10 preko prilagođene I2C sabirnice A4/A5. Ne uklanja se nijedan od pet senzora. Nevaljano očitanje prikazuje se kao ERR; to nije nula.

Za LV15 i LV15B ne instalira se dodatna stepper knjižnica. ULN2003 koristi slijed četiriju izlaza, a A4988 STEP/DIR. Njihovi programi nisu međusobno zamjenjivi. Završni korak zadržava pobudu tijekom jednog zadanog intervala prije gašenja pogona.

## LV16 u CODESYS-u

Nastavnik unaprijed priprema standardni projekt, program `PLC_PRG` u jeziku ST i njegov poziv iz cikličkog zadatka.

- `LV16_PLC/LV16_deklaracije.txt` zalijepite u gornje polje deklaracija `PLC_PRG`.
- `LV16_PLC/LV16_program.st` zalijepite u donje polje implementacije.
- Pokrenite **Build**, zatim **Online → Simulation**, **Login** i **Start**.
- Ulaze mijenjajte pomoću pripremljenih vrijednosti i **Write Values**. Izlaz Motor mijenja program; nemojte ga forsirati.
- Prođite svih osam promjena iz tablice u Word dokumentu. Povratak dopuštenja uz držani START ne smije pokrenuti izlaz.

Datoteka `.st` sadrži samo tijelo programa za navedeno polje; nije samostalni CODESYS projekt niti PLCopen XML za uvoz.

## Rješavanje i predaja podzadataka

Podzadatci su označeni **P1 – Lakši**, **P2 – Srednji** i **P3 – Napredni**. Nakon provjere svakog rješenja kopirajte cijeli program iz uređivača i zalijepite ga kao tekst na označeno mjesto odmah iza pripadajućeg podzadatka u Word dokumentu. Sačuvajte prijelome redaka i uvlačenje koda.

Predaje se popunjeni Word dokument s trima riješenim programima, rezultatima i odgovorima. Ne predaju se zasebne `.ino` datoteke. Za LV16 uz svaki podzadatak zalijepite deklaracije i ST tijelo odgovarajućeg programa; ne predaju se zasebni izvozi programa ni projekt simulatora. Priložene datoteke ostaju početni materijal za rad u programskom okruženju.

## Granice provjere

Za v7 provedena je usporedba staroga i novoga koda s modeliranim ulazima i vremenom, ali nije proveden novi Arduino AVR prijevod. Rezultati i granice provjere nalaze se u `Provjera_prijevoda.md`. Nastavnik prije sata provodi Verify/Upload, fizičku provjeru i pokretanje CODESYS simulacije. Ni uspješan prijevod sam po sebi ne potvrđuje stvarni raspored priključaka modula, napajanje, strujno ograničenje ni mehaničko ponašanje.
