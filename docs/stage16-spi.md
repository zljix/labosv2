# Etapa 16 — SPI, ST7735 128×128 i BMP280 SPI

Isporuka 0.7.0-beta.1, 13. studenoga 2026. Postojeći projekt, privatni pristup i format schemaVersion 3 / modelVersion 1 ostaju. Sljedeći razvojni paket: etapa 17A, ILI9341; potom 17B, XPT2046.

## Ugovor izvođenja

MicroPython v1.29.0 WASM dobio je izričite `_lab.spi_config` i `_lab.spi_exchange` primitive. Novi `machine.SPI`/`SoftSPI` API šalje stvarne programske bajtove, a CS/DC/RESET ostaju GPIO signali riješeni iz električnih mreža. Nema analize teksta programa, naziva varijabli, print poruka ni izravnog upisa slike iz sučelja. Native transfer je ograničen na 4096 B; blokove može slati korisnikov kod. SPI/SoftSPI su funkcionalni adapteri po bajtu, bez ESP32 procesorskih/periferijskih ciklusa ili software bit-bang izvođenja. SoftSPI nije tvrdnja o fizičkoj brzini. Podržani su write, read, readinto, write_readinto, init/deinit, 8 bita, MSB i mode 0/3. Eksplicitni sck/mosi pinovi obvezni su. MISO je opcionalan za write-only TFT.

AVR8js i dalje izvodi stvarno prevedene ATmega328P instrukcije. SPI registar pokreće transakciju, a raspored dovršetka koristi stvarni djelitelj i 16 MHz virtualni takt. CPOL i CPHA čitaju se iz SPCR-a zasebno. Host ne stvara prikaz pojedinih SCK/MOSI bridova: ovo je byte-level periferijska veza. Nano A6/A7 ne mogu biti digitalni SPI signali. Nijedan novi compiler/core ugovor ni vanjska biblioteka nisu dodani.

Uređaj prima transakciju samo ako je napajan, ima zajedničku referentnu masu, njegove SCK/MOSI mreže odgovaraju izabranim izlaznim pinovima i CS je LOW. MISO vraća podatke samo kad je spojen na ulaz. Otvorena ili pogrešna veza daje 0xFF; SPI nema I2C ACK. Istodobni odabir više uređaja na istoj sabirnici deterministički se odbija uz upozorenje; to je granica modela, ne tvrdnja da svaki takav fizički spoj nužno ima sukob MISO izlaza. Dva zaslona uz zasebne CS/DC/RESET imaju neovisno stanje.

## ST7735 profil

Izričito odabrani 1,44-inčni green-tab profil ima osam izvoda: VCC, GND, CS, RESET, DC, MOSI, SCK, BL. Početni profil je 3,3 V. Uno/Nano primjeri koriste složeni carrier na 5 V s regulatorom i SPI prilagodbom, uključujući odgovarajući prag logike. To ne tvrdi da svaki korisnikov fizički modul ima te sklopove. **BL je uvijek 3,3 V.** Fizički pinout mora se zasebno potvrditi.

Model podržava RGB565 s višim bajtom prvim; CASET/RASET/RAMWR, četiri dokumentirane MADCTL rotacije C8/A8/08/68, BGR, display ON/OFF, sleep, inversion, software reset i hardware RESET LOW ≥10 µs uz konzervativno čekanje 120 ms. Inicijalizacijski analogni power/gamma registri prihvaćaju se samo u deklariranim duljinama; njihov fizički učinak nije simuliran. Format RGB444/RGB666, ostali MADCTL načini, čitanje, scroll, 3-line/9-bit i paralelno sučelje izričito nisu podržani.

Vidljivo stanje je fizički orijentiranih 128×128 RGB565 piksela. Prijemni adresni prozor poštuje granice kontrolera 132×162, a ovaj ograničeni profil pohranjuje samo vidljivo područje. Stupčani pomak je 2; redni 3 za rotacije 0/1 i 1 za 2/3, uz zamjenu osi. Upis izvan vidljivog panela ne mijenja vidljive piksele. To nije puna simulacija skrivenog DDRAM-a kontrolera. Početna RAM slike deterministički je crna; fizički power-on sadržaj nije time potvrđen. Reset vraća registre i gasi prikaz, ne predstavlja korisnikovu naredbu za brisanje cijele slike.

Pozadinsko svjetlo ne generira piksele: bez BL prikaz je taman i kada broj zapisanih piksela raste. Zaslon dobiva tekst kao piksele rasterizirane u vidljivom driveru. Originalni MIT driveri `lab_st7735.py` i `lab_st7735.h` imaju fill, pixel, pravokutnik, liniju i mali vlastiti font 5×7 (velika ASCII slova, znamenke i `.:-/%?`; mala slova pretvaraju se u velika). Ne proglašava se opća podrška za Adafruit GFX/ST7735. Arduino driver izravno šalje piksele, bez 32768 B punog framebuffera.

## BMP280 SPI profil

Novi `bmp280_spi` zaseban je šestopriključni profil: VCC/GND/SCK/MOSI/MISO/CS. Raniji četveropriključni I2C projekti ostaju. 4-wire SPI koristi bit 7 kao read/write, automatsko povećanje adrese samo pri čitanju te parove adresa/podatak pri pisanju. Podržani su mode 0/3, do 10 MHz, chip ID 0x58, kalibracijski koeficijenti, status, forced/sleep/normal i postojeći vremenski model pretvorbe. IIR i 3-wire nisu modelirani.

Oba protokola koriste isti Bosch registarski model; sučelja imaju neovisne fizičke profile. `lab_bmp280_spi.py` šalje SPI registre kroz vidljivi transport do postojećeg Python algoritma kompenzacije. `lab_bmp280_spi.h` ima vlastiti SPI transport i postojeći Bosch integer izračun. Model daje sirove ADC riječi usklađene sa zadanim okolišem; driver čita koeficijente i računa temperaturu/tlak. Mjerenja nisu unesena preko print poruke. Živi klizači mijenjaju iduću pretvorbu; model ne mjeri vlagu.

## Primjeri i podaci

Četiri primjera: `tftGraphics`, `tftRotation`, `bmp280SPI`, `spiDashboard`, za sve tri pločice. ESP32: SCK12, MOSI11, MISO13; Uno/Nano: D13/D11/D12. TFT: CS10/DC9/RESET8; BMP280 CS7. Napajanje prema carrier profilu, BL=3V3. Na zajedničkoj sabirnici neaktivni CS prvo se postavlja HIGH.

Mjerenja prikazuju broj bajtova i broj piksela, MADCTL, prozor, stanje prikaza/BL i posljednjih 100 SPI događaja. Zapis bilježi naredbe i prvi podatak skupnog TFT bloka te BMP280 bajtove; nije potpuni GPIO logic-analyzer zapis. CSV ima UTF-8 BOM, pet stupaca i zadržane događaje. Stop čuva snimku i zapis; novi Run/Reset stvara novu sesiju. JSON/ZIP i Arduino IDE izvoz uključuju vidljive upravljačke izvore.

## Granice potvrde

Automatske i razvojne pregledničke provjere ne potvrđuju fizičke module, školsko računalo, iOS/Safari, Android, učenički pilot ili hladno offline otvaranje privatne produkcijske domene. Raniji uvjeti stabilne v1.0 ostaju otvoreni. Nema nove tvrdnje o fizičkoj 5 V kompatibilnosti korisnikove konkretne opreme. Ovo je funkcionalna beta isporuka.

## Primarni izvori, provjereni 13. studenoga 2026.

- Sitronix ST7735S V1.5 (2015), proizvođačev datasheet preko Newhaven Display: https://support.newhavendisplay.com/hc/en-us/article_attachments/26975392281367 — serijsko sučelje, registri, RGB565, reset.
- Adafruit, izvor panela i rotacija: https://github.com/adafruit/Adafruit-ST7735-Library/blob/master/Adafruit_ST7735.cpp — INITR_144GREENTAB i pomaci; služi provjeri profila, nije uvezena biblioteka.
- Bosch BMP280, BST-BMP280-DS001-26, rev. 1.26 (10/2021): https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf — SPI, adrese, koeficijenti i pretvorba.
- MicroPython API: https://docs.micropython.org/en/latest/library/machine.SPI.html — javni SPI/SoftSPI oblik API-ja; ova implementacija deklarira ograničeni podskup.

Green-tab izbor, složeni carrieri, konzervativno čekanje, pohrana vidljive RAM slike, granica 4096 B, ograničen font i odbijanje više odabranih CS projektne su odluke. Nisu predstavljene kao univerzalna fizička svojstva.
