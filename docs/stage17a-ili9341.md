# Etapa 17A — ILI9341 240×320

Isporuka **0.7.1-beta.1**, 13. studenoga 2026. Nastavlja etapu 16 u postojećoj privatnoj aplikaciji. Format ostaje schemaVersion 3 / modelVersion 1. XPT2046 ostaje zasebna etapa 17B; ova isporuka ne uključuje dodir.

## Funkcionalni ugovor

Novi `ili9341` profil ima vlastiti model, `public/ili9341.mjs`, i fizički orijentiranu memoriju od 240×320 RGB565 piksela. Nije povećani ST7735: nema green-tab pomaka, koristi 16-bitne CASET/PASET adrese i COLMOD=0x55. Logičke dimenzije ovise o MADCTL rotaciji: 48/88 daju 240×320, 28/E8 daju 320×240. BGR bit mijenja tumačenje crvenog/plavog kanala. Prikaz fizičkog panela ostaje uspravan; rotacija mijenja adresiranje i položaj sadržaja.

RAMWR prima viši pa niži bajt boje, zadržava nepotpuni piksel između blokova i obilazi redove zadanog prozora. Sljedeća naredba prekida nepotpuni piksel. Djelomično osvježavanje znači upis manjeg prozora memorije; nije implementacija partial display moda kontrolera. Ostatak RAM-a ostaje neizmijenjen. Promijeni li se rotacija, driver prije sljedećeg upisa postavlja odgovarajući prozor.

Display ON/OFF, sleep, inversion i HW/SW reset koriste zajedničku električnu SPI infrastrukturu. Konzervativni profil čeka 120 ms nakon napajanja/resetiranja i sleep izlaza. RESET LOW treba najmanje 10 µs. Ti uvjeti profila nisu tvrdnja da svaka naredba stvarnog čipa zahtijeva isto čekanje. Novi model ne mijenja izvedbu ST7735 ni BMP280.

Početna RAM slika je deterministički crna. U sesiji reset, display OFF i sleep ne brišu sadržaj RAM-a; nakon ponovne inicijalizacije može se ponovno prikazati. Prekid napajanja gasi model i vraća registre, ali analogni gubitak zadržanog sadržaja nije modeliran. Novo pokretanje stvara novu memoriju. Nema tvrdnje o slučajnom power-on sadržaju fizičkog panela.

Zaslon prima samo stvarne programske SPI bajtove. Rasterizacija teksta i geometrije pripada vidljivim upravljačkim datotekama `lab_ili9341.py` i `lab_ili9341.h` 1.0.0, s vlastitim MIT fontom 5×7. Podržana su velika ASCII slova, znamenke i odabrana interpunkcija, uz pretvorbu malih slova u velika. Nisu dodane niti proglašene podržanima Adafruit GFX/ILI9341 i TFT_eSPI biblioteke.

MicroPython koristi postojeći WASM i machine.SPI/SoftSPI adapter. Native granica pojedinačnog prijenosa ostaje 4096 B; driver šalje kratke retke, najviše 640 B. AVR koristi stvarno prevedene instrukcije i SPI registre u postojećoj jezgri ATmega328P pri 16 MHz. Arduino driver ima **32-bitni brojač piksela**, pa puni upis svih **76 800 piksela** ne prelijeva 16-bitni brojač. Puni RGB565 framebuffer od **153 600 B** nije alociran u 2 KB SRAM-a Uno/Nano mikroupravljača. Model zaslona ima vlastitu memoriju izvan MCU SRAM-a.

## Sklop i korisnički prikaz

Profil je izričit nastavni write-only carrier s osam izvoda: VCC, GND, CS, RESET, DC, MOSI, SCK i BL. Ne predstavlja pinout svakog kupljenog modula; na fizičkim pločicama mogu postojati dodatni SDO, touch i SD izvodi. Dodirni kontroler i kartica nisu dio ove komponente.

| Signal | ESP32-S3 / MicroPython | Uno R3 / Nano classic / Arduino |
| --- | --- | --- |
| SCK / MOSI / MISO senzora | GPIO12 / 11 / 13 | D13 / D11 / D12 |
| TFT CS / DC / RESET | GPIO10 / 9 / 8 | D10 / D9 / D8 |
| BMP280 CS | GPIO7 | D7 |
| VCC i SPI logika | 3,3 V carrier | izričit 5 V carrier s regulatorom i prilagodbom |
| BL | **3V3** | **3V3** |
| GND | zajednička masa | zajednička masa |

Katalog, sastavljanje, provjera spojeva, help, matrica podrške i izdvojeni TFT monitor uključuju novu komponentu. Canvas ima stvarnih 240×320 piksela i omjer 3:4. ST7735 ostaje 128×128. Broj bajtova/piksela, geometrija, prozor, MADCTL, BL i SPI CSV koriste postojeća Mjerenja. Stop čuva sliku i zapis; Run/Reset počinju novu sesiju.

Napajanje, zajednička masa, odabrane SCK/MOSI mreže, CS/DC/RESET i BL utječu na rezultat. Nedostajući BL zatamnjuje sliku bez zaustavljanja upisa u RAM. BL=5 V, nepodudaran carrier, kratko spojeni signali i Nano A6/A7 dijagnosticiraju se. ILI9341 i ST7735 mogu dijeliti SCK/MOSI uz vlastite CS/DC/RESET signale i neovisnu memoriju. Više istodobnih aktivnih CS-a odbija se kao deklarirana granica zajedničkog modela.

## Četiri vođena primjera

1. `iliGraphics`: boje, tekst, pravokutnik, dijagonale i piksel (239,319). Promjena crvene RGB565 konstante mijenja traku, bez oslanjanja na print poruku.
2. `iliRotation`: četiri MADCTL rotacije, promjenjive logičke dimenzije i crvena oznaka logičkog početka koordinata.
3. `iliPartial`: puni zaslon crta se jednom; u petlji se mijenja samo prozor 180×70. Naslov i okvir ostaju. Pokus s preuskim brisanjem objašnjava ostatke ranijih piksela.
4. `iliDashboard`: BMP280 i ILI9341 dijele SPI uz zasebne CS-ove. Program iz registara računa temperaturu/tlak i šalje prikaz. Živa promjena okoliša mijenja sljedeći uzorak.

Svi primjeri imaju MicroPython te Uno/Nano Arduino C/C++ inačice. JSON/ZIP čuvaju upravljačke izvore; Arduino IDE izvoz čuva `.ino` i `.h` datoteke. Ranijih 112 AVR artefakata ostaje potpuno jednako; dodano je osam novih, ukupno 120. Compiler/core i zaključane vanjske biblioteke ostaju isti. WASM/loader nisu promijenjeni.

## Granice i nastavak

Ovo je funkcionalni write-only 4-wire SPI model: 8 bita, MSB, mode 0/3 i do 10 MHz. Nema čitanja identiteta/RAM-a preko TFT SDO-a, RGB444/RGB666, scrolla, partial display moda, TE sinkronizacije, proizvoljnih MADCTL zrcaljenja, 3-line/9-bitnog ili paralelnog sučelja. Deklarirani analogni power/gamma parametri prihvaćaju se bez analogne simulacije. Nije emulacija ESP32 perifernih ciklusa, struje pozadinskog svjetla ni fizičkog panela.

Razvojne provjere u Chromiumu/Linuxu i Node/WASM/AVR testovi nisu potvrda fizičke opreme, školskog računala, učeničkog pilota, Safari/iOS ili Android preglednika. Hladno offline otvaranje privatne produkcijske domene ostaje zaseban uvjet. Stabilna v1.0 nije proglašena.

Slijedi etapa **17B — XPT2046**: odvojeni CS, sirove koordinate/pritisak, programska kalibracija i zaslonsko tipkalo koje upravlja sklopom.

## Primarni izvori, provjereni 13. studenoga 2026.

- [ILITEK ILI9341, V1.11, preko Adafruit](https://cdn-shop.adafruit.com/datasheets/ILI9341.pdf): str. 110–114 CASET/PASET/RAMWR, 127–128 MADCTL, 134 COLMOD; funkcionalni model namjerno pokriva deklarirani podskup.
- [Adafruit ILI9341 izvor](https://github.com/adafruit/Adafruit_ILI9341/blob/master/Adafruit_ILI9341.cpp): neovisna provjera četiriju rotacijskih vrijednosti; biblioteka nije preuzeta ni dodana u podržani ugovor.

Carrier, prikaz fizičke orijentacije, deterministička početna RAM slika, konzervativno čekanje, ograničen font i opseg testova projektne su odluke, a ne univerzalna svojstva svih modula.
