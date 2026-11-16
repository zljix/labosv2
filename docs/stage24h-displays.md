# Etapa 24H · zasloni i SPI uređaji

Izdanje **0.14.6-beta.1** dodaje osam rubrika `24H-…@1` i provjeravač `24H.1`: **32 nove kombinacije**, ukupno **176 od 268**, odnosno 44 varijante na MicroPythonu S3, S3 Arduino C++, Unu i Nanu. Ranije 43 verzije rubrika ostaju neizmijenjene. Uvodne V1–V5 zasad zadržavaju lokalnu provjeru.

[Završni prihvat 24H](https://github.com/zljix/labosv2/actions/runs/43937992501) potvrđuje sva četiri cilja, 96 neovisnih prijevoda i svih 32 zaključanih dodjela. [Zbirni rezultat](stage24h-evidence/acceptance-summary.json) navodi točan programski commit; isporučeni provjeravač bajtno odgovara prihvaćenoj izgradnji.

## Zadaci i bodovi

Svaka rubrika ima 3 boda za napajani komunikacijski put, 5 za osnovni dio i 2 za nastavak ili napredni dio. Upute i potpuni uvjeti objavljuju se prije početka rada; slobodni odgovori ostaju opisni.

| Varijanta | Osnovni dio · 5 bodova | Nastavak · 2 boda |
| --- | --- | --- |
| OLED 128×32 | Zadani tekst i brojač 0 u stvarno primljenim pikselima | Brojači 1 i 2 uz objavljeni razmak osvježavanja |
| LCD1602 | Pozdrav, vidljivi vlastiti CGRAM znak i brojač 0 | Brojači 1 i 2; drugi CGRAM slot je dopušten |
| TM1637 segmenti | Bitovi 0–7 redom, stvarni segmentni bajtovi i ACK | Drugi potpuni obilazak |
| TM1637 programsko vrijeme | 12:34 s upaljenom i ugašenom dvotočkom | Isti slijed za 12:35 i 12:36 |
| ST7735 grafika | Crveno/zeleno/plavo RGB565 polje i bijeli tekst | Žuti okvir te cijan i magenta dijagonala |
| ST7735 rotacija | Rotacije 0 i 1; stvarno preslikani fizički kutovi | Rotacije 2 i 3 te povrat na 0 |
| BMP280 SPI | Nova kompenzirana mjerenja i ispisi u dva okoliša | Novo mjerenje pri povratku na početni okoliš |
| BMP280 → ST7735 | Nova SPI mjerenja i odgovarajući TFT pikseli u dva okoliša | Novi uzorak i pikseli nakon povratka |

Konzolni tekst ne crta zaslon i gostov framebuffer nije dokaz prijenosa. OLED se čita iz primljenog SSD1306 GDDRAM-a, LCD iz DDRAM-a i CGRAM-a, TM iz segmentne memorije uz stvarni deveti ACK takt, a TFT iz primljenih RGB565 piksela. BMP280 mora dovršiti novu pretvorbu i poslati stvarne registre preko MISO-a; identifikacija ili stari uzorak nisu novo mjerenje.

## Objavljeni rasporedi i tolerancije

OLED zadržava postojeće različite primjere. MicroPython koristi ugrađeni framebuf 8×8: četiri retka, naslovi `OLED 128 x 32`, `URS laboratorij`, `Brojac: n`, `Redak 4`. Uno/Nano koriste U8g2 6×10, naslov, brojač i `Zadnji redak`. S3 C++ koristi U8g2, `ESP32-S3 U8g2`, `COUNT n` i desni okvir. Točni početci i osnovice nalaze se u rubrici. LCD na MicroPythonu i AVR-u prikazuje `Pozdrav, URS! ` i vlastiti znak u stupcu 14, a S3 C++ `S3 C++ LAB ` i znak u stupcu 11. Drugi redak je `Brojac: n` odnosno `COUNT n`.

Početni OLED/LCD prikaz mora stići do 1800 ms, brojevi se mijenjaju svakih 850–1500 ms i ostaju stabilni najmanje 200 ms. TM stanja imaju početke udaljene 400–650 ms i stabilnost najmanje 380 ms. TM bit 7 predstavlja samo dvotočku druge znamenke, a programsko vrijeme nije RTC. ST7735 grafika mora biti dovršena do 3500 ms i stabilna barem 200 ms. Rotacije imaju prvi dovršeni prikaz do 1800 ms, razmak dovršenih prikaza 800–2000 ms i stabilnost najmanje 700 ms; sam program nakon slanja čeka 900 ms.

Senzorski pokus ima −10 °C / 90000 Pa i 55 °C / 107000 Pa te povrat na prvi okoliš. Sjeme posla deterministički bira prvi od ta dva okoliša. Etape traju 3500 ms za BMP280 SPI odnosno 4500 ms za instrument. U svakoj trebaju najmanje dva nova, dovršena očitanja nakon prvih 100 ms, uz razmak do 1800 ms. Tolerancije su ±0,3 °C i ±150 Pa. TFT prikazuje jednu decimalu u °C i hPa; temperatura i tlak imaju crna polja (8,40,84,14) i (8,74,60,7), a prikaz ostaje stabilan barem 200 ms. Ispis instrumenta nije obvezan.

Vizualni elementi uspoređuju se samo u objavljenim područjima. `school/grader/display-oracles.json` zamrzava rasterske OLED uzorke postojećih fontova i tablicu TFT fonta 5×7. OLED uzorci potječu iz prijenosa izvornog primjera s brojevima 0,1,2; nisu učenički artefakti. Geometrija, fizička rotacija i TFT tekst zadaju se neovisnim koordinatnim maskama. SHA-256 vizualne specifikacije dio je svakog novog ugovora, a stvarni ugrađeni kod i podaci ulaze u otisak provjeravača. Slobodni dijelovi slike, oznake komponenti, redoslijed vodiča i raspored koda ne biraju rezultat.

## Napajanja, adrese i odabir uređaja

OLED je 0x3C i 128×32; LCD backpack je 0x27, do 100 kHz, VCC=5 V te LV=3,3 V na S3 ili 5 V na AVR-u. TM također razdvaja VCC=5 V od LV; uključeni idealni prilagodnik nije dodatni izvod golog fizičkog modula. TFT BL je 3,3 V, a napajanje i logika odgovaraju odabranom 3,3 V ili deklariranom 5 V carrieru. BMP280 i TFT dijele SCK/MOSI uz zasebne CS priključke. Pogrešna adresa, CS, prekinuti SCL/CLK/SCK, MISO, BL ili napajanje ne smiju proizvesti lažni dokaz.

Stop, popravak i ponovno pokretanje dopušteni su. Oporavak bez restarta nije skriveni uvjet. Mjerenje modela ne potvrđuje fizičku svjetlinu, električna vremena svih komercijalnih modula ili hardversku točnost ESP32.

## Izvršavanje i prihvat

`verification/school-displays.test.ts` izvodi tri ponavljanja svih 32 kombinacije, alternativna rješenja, drugi CGRAM slot i valjani GPIO, preuređene oznake, prekide komunikacije i napajanja, pogrešne adrese, oba redoslijeda okoliša i popravak. Za svaki funkcionalni kriterij postoji zaseban pogrešan izvor: pogrešan sadržaj dobiva 3/10, nepotpun nastavak 8/10, nevaljan spoj 0/10. C++ reference, alternative i oba pogrešna kriterija neovisno se prevode na S3/Uno/Nano, ukupno 96 prijevoda. Preskočen test nije dokaz kompilacije.

`verification/school-displays-api.test.mjs` provjerava pravi PHP/MySQL, svih 32 dodjele, stvarne poslove i bodove, odbijanje stranog ugovora, zaključavanje i očuvanje ranije predaje. Završni prihvat dodatno uključuje ranije senzore/aktuatore/koračni motor, račune, razrede, spremanje, sukobe, izvještaje, povrat kopije i 30 simuliranih učenika. Detaljni sintetski radovi ostaju u artefaktima provjera i školskom paketu; javni zapis sadrži zbirne rezultate.

Izvršavanje zadržava Linux izolaciju bez mreže i privatne konfiguracije, 65 s zidnog i 58 s CPU vremena, 90 s za prevođenje, 2048 MiB adresnog prostora i 1 MiB izlaza. Novi C++ izvor ponovno se prevodi zaključanim alatom; stari ili klijentski artefakt ne bira rezultat. Tehnički kvar i nepodržana provjera ostaju bez bodova.

## Nadogradnja i nastavak

Nema nove SQL migracije. Sačuvaj bazu, privatnu konfiguraciju i sesije; zamijeni kompletan javni i privatni paket, pokreni postojeći migrate i ponovno pokreni Linux provjeravače. Novu rubriku izričito odaberi pri objavi novog zadatka. Ranije dodjele, uvjeti i zaključane predaje ostaju sačuvani.

Slijedi **24I: meteorološka stanica i regulator**. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i ukupna memorijska granica ostaju zasebni uvjeti prihvata.
