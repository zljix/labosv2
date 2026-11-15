## Putanje vodiča · 0.12.9-beta.1

Prikaz preuzima pristup iz izvornog `Fritzing Optimizer/lib/optimizer/router.mjs` i `custom.mjs`: A* najprije traži slobodne putanje, zauzeti kanali postaju prepreke, a neuspjeli raspored pokušava se drugim redoslijedom. Zaštita obuhvaća i slobodne rupice breadboarda. Izvorni priključci, električne mreže, položaji komponenti i ručni zavoji ostaju sačuvani.

Preostala križanja imaju mostić na ravnoj dionici ili stvarni prekid crte uz zavoj i bliska križanja. Odabirom vodiča ističu se oba njegova priključka, a ostali vodiči prigušuju. Nepronađena putanja prikazuje se isprekidano uz objašnjenje. „Uredi vodove” ponovno raspoređuje sve vodiče, uz Poništi.

Provjera: testovi raspoređivanja na ESP32-S3, Uno i Nano, slobodne rupice i zakrenuti BB60, ručne putanje, očuvanje električnih mreža, mostići i prekidi. Složen sklop s fiksnim položajima može zadržati križanja; pretraživanje je ograničeno i ne dokazuje globalni optimum. [Detalji dorade](docs/wiring-0.12.9.md).

# ESP32 MicroPython Lab

**0.12.8-beta.1 · dorada shema · 14. studenoga 2026.**

Interaktivni laboratorij na hrvatskom jeziku za ESP32-S3, Arduino Uno R3 i Nano classic, s MicroPython i Arduino C++ programiranjem. Repozitorij sadrži izvorni kod, testove, dokumentaciju, upravljačke programe, licence i već izgrađenu aplikaciju u `dist/`.

## Putanje vodiča · 0.12.8

Automatski vodiči dobivaju zasebne kanale, zaobilaze tijela komponenti i ostaju na izvornim priključcima. Preostala križanja imaju mostić; presjek crte ne stvara električni spoj. Breadboard ostaje dostupan za prepojke.

Za staru shemu s ručnim zavojima pritisni **Uredi vodove** iznad radne površine. Gumb zamjenjuje ručne putanje automatskima; izmjena se može poništiti strelicom **Poništi**. Ručne putanje inače ostaju sačuvane. Ako su komponente preblizu ili se preklapaju pa nema prolaza, prikazuje se poruka za razmicanje. **Prilagodi** obuhvaća i vanjske putanje vodiča.

Provjere: `npm run test:routing` provjerava odvojene dionice na sva tri profila pločice, ručne putanje, zakretanje/pomicanje, električnu topologiju, mostiće i blokirane prolaze.

## Web aplikacija na GitHub Pagesu

Web adresa: **https://zljix.github.io/labos/**. Za otvaranje web izdanja nisu potrebni Node.js ni lokalni poslužitelj. Projekti se spremaju u pregledniku; ZIP/JSON izvoz služi za prijenos i predaju.

GitHub Pages uključi u **Settings → Pages → Source: GitHub Actions**. Workflow `.github/workflows/pages.yml` gradi aplikaciju, provjerava sve resurse i offline rad na putanji repozitorija te objavljuje samo izgrađeni `dist/`. Pokreće se pri promjenama na `main` i ručno kroz Actions. Za lokalnu provjeru takve izgradnje koristi `npm run build:pages` i `npm run test:pages`. Obični `npm run build` zadržava korijenske putanje za lokalni poslužitelj. `LAB_BASE_PATH` omogućuje drugu putanju repozitorija.

MicroPython i priloženi prevedeni Arduino primjeri izvršavaju se u pregledniku. Izmijenjeni Arduino C++ program i dalje traži postojeći lokalni razvojni most. GitHub Pages ne pokreće PHP/MySQL: registracija, prijava i središnje bodovanje pripadaju zasebnom školskom poslužitelju.

Izgrađena aplikacija u `dist/` prati izdanje 0.12.9 za lokalno pokretanje. Pages za svaku objavu iznova gradi aktualni izvorni kod s putanjom `/labos/`.

## Brzo pokretanje gotove aplikacije

Potreban je **Node.js 22 ili noviji**. Preuzmi cijeli repozitorij kroz **Code → Download ZIP** i raspakiraj ga ili ga kloniraj:

```sh
git clone https://github.com/zljix/labos.git
cd labos
node start-local.mjs
```

Na Windowsu možeš dvokliknuti **Pokreni.cmd**. Otvori **http://127.0.0.1:4173/** i ostavi terminal otvoren. Zaustavljanje: Ctrl+C. Za gotovu aplikaciju nisu potrebni `npm install` ni vanjska mreža. Worker i WebAssembly zahtijevaju HTTP; otvaranje `dist/index.html` dvoklikom nije dovoljno.

## Razvoj

```sh
npm ci
npm run dev
```

`npm run build` provjerava TypeScript i izgrađuje `dist/`. `npm test` pokreće osnovne provjere; dodatne skupine opisane su niže. Novi ili promijenjeni C++ program treba prevesti razvojnim mostom prema [uputama](docs/arduino-bridge.txt).

Projekti učenika spremaju se u pregledniku i prenose ZIP/JSON izvozom. Ovo izdanje sadrži nastavnički **Pregled razreda** s ručnim bilješkama; registracija, prijava, MySQL i središnje automatsko bodovanje još nisu implementirani.

Objavljena je snimka izvornog projekta `4f99b5ad3b3134915051916315813c35e968990d`; gotova aplikacija ima oznaku izgradnje `11bf3173ac74417a`. Aplikacija ostaje nastavna beta. Kod je pod [MIT licencom](LICENSE); zadržane su licence i napomene o vanjskim bibliotekama.

---

## Aktualna isporuka — etapa 22I, 0.12.7-beta.1

**Pregled razreda** učitava do 30 URS ZIP/JSON predaja, pokazuje popunjenost i podudaranje programa/sklopa te omogućuje vlastite nastavničke bilješke. Predaja se za pokus otvara kao zaustavljena kopija. Izmjena bilješke vraća status na čekanje; odabrani rad ostaje otvoren i izvan aktivnog filtra. Uvezeni nastavnički zapis prikazuje se zasebno.

**JSON evidencije** čuva bilješke za nastavak uz ponovno učitavanje izvornih ZIP-ova, a **CSV** daje pregled svih zapisa neovisno o filtrima. Bilješka se vraća samo uz isti sadržaj izvora, sklopa, obaju čvorova, identiteta, odgovora i opažanja. Različita bilješka ne prepisuje se uvozom. **ZIP s bilješkom** prenosi povratnu informaciju uz isti sadržaj. Pregled se ne sprema automatski; prije zatvaranja sačuvaj JSON i izvorne predaje. Status je ručni zapis, bez automatske ocjene ili ovjere autorstva.

**359/359 ciljanih provjera**, bez preskakanja; među njima 26 novih provjera pregleda razreda. Proveden je pregled završnog statičkog dist-a u Chromeu/Linuxu, stvarno preuzimanje i provjera JSON/CSV/ZIP datoteka te pokretanje Uno kopije. Paket ima 188 provjerenih resursa. To nije ponovno izvođenje cijele prethodne regresije ili fizičkih compiler pokusa. [Opseg, upute, dokazi i granice](docs/stage22i-class-review.md). Pokretanje novih provjera: `npm run test:class-review`. Zbirka ostaje 18 tema / 67 varijanti po cilju / 268 kombinacija. Izdanje je nastavna beta; fizička oprema i stvarni učenički pilot traže zasebnu potvrdu.

## Prethodna isporuka — etapa 22H, 0.12.6-beta.1

Dodan je **samostalan automatski I2C pretvornik** s LV=3,3 V, HV=5 V, zajedničkom masom, dva open-drain kanala i četiri isključiva 10 kΩ pull-up otpornika. LOW se prenosi u oba smjera, HIGH domene ostaju odvojene. I2C usmjeravanje provjerava stvarni par SDA/SCL, napajanja, domene, pull-up, sukob i adresu prije ACK-a. Numerički model nema RC bridove, clock-stretching ili potvrđenu fizičku brzinu. Zasebni SN74LVC2T45/URS17 i dalje koristi GPIO i DIR.

**URS18** dodaje BMP280 i OLED128×32 kroz pretvornik za sva četiri cilja. Izvori, driveri i prevedeni programi jednaki su postojećim primjerima; mijenja se stvarni sklop. Zbirka ima **18 tema; 67 varijanti × 4 cilja = 268 kombinacija**. Matrica ima 40 stavki. Vodič, pilot, CSV i lokalni README dobivaju aktualne brojeve iz kataloga.

**1.308/1.308 jedinstvenih testova s uspješnim posljednjim rezultatom**, uključujući 8 offline i 13 pilot testova. Prvih šest compiler neuspjeha i 20 preskakanja riješeno je stvarnim ponavljanjem svih 26 s dostupnim alatnim lancem; ponovljeni testovi ne povećavaju broj. Završnih 8 Worker scenarija s promjenom, kvarom i oporavkom te dva dodatna software-I2C pokusa daju **26 stvarnih Worker pokretanja**. 69 S3 native izvoza ponovno je uspoređeno s ranijim compiler dokazima. [Model, nastavni slijed, provjere i granice](docs/stage22h-i2c-levels.md). Novi pokusi: `npm run test:i2c-levels`, `node --import tsx verification/i2c-levels-package.ts` i `node --import tsx verification/i2c-software-package.ts`. Izdanje ostaje nastavna beta.

## Prethodna isporuka — etapa 22G, 0.12.5-beta.1

Dodan je **samostalan SN74LVC2T45 GPIO pretvornik** s dva kanala, zajedničkim DIR-om i odvojenim A=3,3 V / B=5 V mrežama. Mjerenja prikazuju oba napona, smjer i neodređene ulaze; model provjerava napajanje, zajedničku masu, sukob izlaza i GPIO prenapon. To nije automatski I2C pretvornik niti vremenski model čipa.

**URS17** sadrži tipkalo i LED kroz drugu naponsku domenu na sva četiri cilja. Koristi točne postojeće blink/button programe i njihove artefakte, uz nove spojeve, vanjski pull-up i početni pull-down. Zbirka sada ima **17 tema; 65 varijanti × 4 cilja = 260 dostupnih kombinacija**. Brojevi i napomena editora prate katalog/odabranu varijantu.

Završni posljednji rezultati daju **1.260/1.260 jedinstvenih testova**, uz 8/8 pokusa završnih Workera i 8/8 offline provjera. Početnih 12 neuspjeha i njihove ponovne provjere čuvaju se zasebno. [Opseg, model, provjere i granice](docs/stage22g-levels.md). Novi pokusi: `npm run test:levels` i `node --import tsx verification/levels-package.ts`. Izvoz za fizički ESP32 zadržava 69 točnih ranijih compiler dokaza; njihovo podudaranje ponovno je provjereno. Nastavna beta, fizička oprema i učenički pilot ostaju zasebne provjere.

## Prethodna isporuka — etapa 22F, 0.12.4-beta.1

**69/69 točnih S3 C++ izvoza** prevedeno je stvarnim Arduino CLI 1.3.1 / Espressif coreom 3.3.12: svih 67 primjera izbornika i oba NRF24 programa. Početna cjelovita provjera otkrila je sukob globalnih `y0/y1` imena u kalibraciji dodira s Espressifovim `math.h`; ispravljeni izvoz ponovno je prošao. Zapis artefakta kalibracije obnovljen je, a svi optimizirani WASM programi ostali su bajtno jednaki. Ostalih 66 zapisa S3 artefakata, AVR/radio, MicroPython, core i zaključane biblioteke sačuvani su.

**Priprema i zapis pilota** sada nudi odvojene vrste opažanja, izvoz/uvoz nacrta, čitanje starijeg v2 zapisa i provjeru podataka prije dovršenog zapisa. Vodič preuzima aktualnu inačicu i URS brojeve iz kataloga: 63/63 na svakom cilju, ukupno 252 kombinacije. Školski/mobilni i oba offline postupka uvedeni su kao konkretni pokusi koje treba stvarno provesti.

Široka regresija ima **1.224/1.224 testa bez preskakanja**; 13 novih testova odnosi se na zapis pilota. U pregledniku su provjereni URS12 promjena, kvar, oporavak, predaja i ponovni uvoz te oporavak nacrta i zaštita nespremljenog obrasca. [Opseg, izvoz, dokazi i granice](docs/stage22f-native-pilot.md). `npm run s3:native` i `npm run s3:native:verify` odvojeni su od simulatorova WASM prevoditelja. Fizička pločica, školski/mobilni uređaji i samostalni učenik još traže stvarnu potvrdu; izdanje ostaje beta.

## Prethodna isporuka — etape 22D/22E, 0.12.3-beta.1

Dodano je **19 zasebnih izvršivih S3 C++ programa**. Etapa 22D dodaje IR NEC prijam, impulse, PWM LED i LEDC predajnik 38 kHz te BMP280 SPI, ST7735 grafiku/rotacije i zajednički instrument. Etapa 22E dopunjuje pojedinačne BMP180/BMP280/AM2320, DS18B20 svježinu/CRC, TM1637 segmente/programsko brojilo te ILI9341 i XPT2046 sirovi dodir, kalibraciju i rotacije.

**Svih 63 URS varijanti sada postoji na sva četiri cilja: 252 kombinacije u 16 tema.** S3 izbornik ima 67 programa. Svaki početni C++ program ima točan prijevod, izvore, upravljačke datoteke, sklop i izvoz; promijenjeni izvor traži novo prevođenje. Ranijih 48 S3 artefakata ostaje potpuno jednako. Matrica ima 39 stavki × četiri cilja; S3 C++ ima 37 eksperimentalnih i dvije otvorene stavke.

Vidljivi MIT `lab_s3_nec.h` uzorkuje GPIO4 uz čekanje 25 µs između očitanja; standardni NEC, inverzi i repeat do 150 ms. LEDC na GPIO5 daje 38 kHz, 85/255 duty. Blokirajući predajnik ne dekodira vlastito slanje. Vidljivi TFT driveri šalju RGB565 u blokovima 256 B; program računa BMP kompenzaciju i dodirnu kalibraciju. Funkcionalni S3 core i protokolni modeli ostaju isti.

**1 211/1 211 testova bez preskakanja**, uključujući 76 novih testova; dodatno 22 završna Worker pokusa i provjereni lokalni ZIP. [Opseg, provjere, granice i nastavak](docs/stage22de-s3-coverage.md). Nove provjere: `npm run test:s3-protocols`, `npm run test:s3-completion` i završni `verification/s3-protocols-package.ts`. Fizički SFM-20B, zasebni generički pretvornik razina, dodatni ESP32/CAM profili, ciljni uređaji i stvarni učenički pilot ostaju otvoreni; izdanje je nastavna beta.

## Prethodna isporuka — etapa 22C, 0.12.2-beta.1

S3 Arduino C++ dobiva **13 novih izvršivih primjera**: četiri KY-040 pokusa, relej, aktivnu i pasivnu zujalicu, jedan/dva DC motora, kombinirani SG90/motor/ton te tri A4988 pokusa. **URS08** nudi 3/3, **URS10** 7/7 i **URS11** 3/3 varijanti. S3 C++ ukupno ima **45 URS varijanti / 48 primjera u izborniku**, a sva četiri cilja zajedno **234 puta varijanta × cilj**. Broj jedinstvenih URS varijanti ostaje 63 u 16 tema.

Vidljivi MIT `lab_encoder.h` dekodira stvarne GPIO kontakte i filtrira SW na 20 ms. Relej preklapa električne COM/NO/NC putove; aktivni modul ima modelni oscilator 2300 Hz. Pasivni ton, PWM motora i servo koriste neovisne LEDC izlaze. A4988 prima stvarne STEP impulse, pet mikrostep načina i različito obrađuje ENABLE/RESET/SLEEP. Pomoć za komponente prati odabrani jezik i pločicu. Promijenjeni izvor/header traži novo prevođenje; 35 ranijih S3 artefakata ostaje nepromijenjeno.

**573/573 programskih testova bez preskakanja**, uz zasebne pokuse zapakiranih Workera i lokalnog ZIP-a. [Opseg, rezultati i ograničenja](docs/stage22c-s3-controls.md). Provjere: `npm run test:s3-controls`, postojeća S3/URS/GPIO regresija i `node --import tsx verification/s3-controls-package.ts`.

Matrica S3 C++ sada ima 34 eksperimentalne i pet otvorenih stavki: IR NEC, BMP280 SPI, ST7735, generički pretvornik razina i točna SFM-20B izvedba. Preostale nepovezane URS varijante, fizička oprema, ciljni preglednici i stvarni učenički pilot ostaju otvoreni. Izdanje je nastavna beta.

## Prethodna dopuna — etapa 22B, 0.12.1-beta.1

S3 Arduino C++ dobiva osam stvarno prevedenih pokusa u **URS04** i u izborniku primjera: LM35, TEMT6000, NTC, KY-023, plamen AO/DO, zvuk DO, usporedba LM35/NTC i dva potenciometra s dva tipkala. Programi čitaju zajedničku električnu mrežu; novi vidljivi MIT `lab_analog.h` računa napon, NTC Beta i joystick s mrtvom zonom. Nema nove skrivene temperaturne API funkcije ili izravnog očitavanja klizača iz programa.

Linearni ADC profil koristi 12 bita, 11 dB i 3,1 V puni raspon. Napajanje NTC-a i joysticka je 3,3 V; LM35 ima 5 V. Kod razlikuje te veličine, prikazuje zasićenje i vraća NaN za NTC na ADC granici. Fizička kalibracija nije potvrđena. Promijenjeni izvor ili header treba ponovno prevesti; promjena sklopa koristi postojeći prijevod i nove električne uvjete.

URS zbirka sada ima **33 S3 C++ varijante / 222 ukupna puta**; ostala tri cilja zadržavaju po 63. Matrica za S3 C++ ima 28 eksperimentalnih i 11 otvorenih stavki; broj komponenti ostaje 39. Preostalih devet S3 komponentnih proširenja, generički pretvornik razina i točna SFM-20B izvedba ostaju otvoreni.

[Opseg, provjere i nastavak](docs/stage22b-s3-analog.md). Pokusi: `node --import tsx --test verification/s3-analog.test.ts`, `npm run test:urs`, postojeće S3 provjere, build/offline i `node --import tsx verification/s3-analog-package.ts`. Izvorni core, protokoli, AVR i MicroPython primjeri nisu mijenjani. Učenički pilot, fizička oprema i ciljni mobilni preglednici još se potvrđuju zasebno; izdanje ostaje beta.

## Prethodna isporuka — etapa 22, 0.12.0-beta.1

**Vježbe → URS zbirka** objedinjuje 16 tema i 63 varijante s pojmovima, stvarnim spojevima, izvršivim početnim programom, promjenom, pokusom pogreške i opažanjima. MicroPython, Uno i Nano nude po 63 varijante, S3 C++ 25; ukupno 214 putova varijanta × cilj. Početnih V1–V5 ostaje zasebno, s postojećom automatskom provjerom.

Radni list sprema odgovore, tri opažanja, pregled sadržaja i nastavnički zapis. **Preuzmi URS predaju ZIP** čuva izvore, drivere, sklop i oba čvora gdje postoje. Izmjena programa/sklopa čini pregled sadržaja zastarjelim, a promjena odgovora i nastavnički zapis. To je ručni zapis i provjera podudaranja sadržaja, bez automatske ocjene ili potvrde autorstva. Nastavnički prikaz nije prijavljena uloga.

Matrica ima 39 stavki × četiri cilja, poveznice na vježbe, opseg i izvor provjera te CSV izvoz. Prošireni obrazac pilota bilježi stvarni cilj, vježbu i okruženje; početni ishod je nepotvrđeni nacrt. SFM-20B, generički pretvornik razina, dio S3 C++ drivera, dodatne ESP32/CAM pločice, fizička oprema i učenički pilot ostaju izričito otvoreni. Stabilna v1.0 nije proglašena.

[Ugovori, nastavni slijed i granice](docs/stage22-urs.md). Provjere: `npm run test:urs`, široka regresija, `node --import tsx verification/urs-package.ts`, offline i lokalni paket. Upute i CSV nastaju deterministički pri buildu. Sljedeći razvojni paket zatvara preostale S3 C++ drivere/primjere, počevši analognim i jednostavnim GPIO ulazima; stvarni pilot prikuplja se zasebno.

## Prethodna isporuka — etapa 21, 0.11.0-beta.1

**Dva čvora** otvara dva stvarna programa i dva sklopa u jednom projektu. NRF24L01+ radi preko SPI registara i FIFO-a. Kanal, adresa, statička duljina, brzina i CRC profil određuju primitak; ACK/retry, gubici podataka i gubici potvrda vidljivi su u prometu i konzolama. Ponovljeni paket ne ulazi dvaput u RX FIFO.

Sva četiri cilja mogu biti odašiljač ili prijamnik: S3 MicroPython, S3 C++ funkcionalni WASM, Uno i Nano AVR. Vlastiti MIT `lab_nrf24.py` / `lab_nrf24.h` 1.0.0 ostaju uz izvor. Šest novih C++ TX/RX artefakata nalazi se odvojeno u radio-examples.json; ranijih 27 S3 i po 76 AVR primjera ostaju isti.

Jedan događajni sat upravlja objema jezgrama i paketnim medijem. AVR se izmjenjuje po atomarnim instrukcijama, S3 C++ po API pozivima, MicroPython na sleep pozivima. Pozitivni MicroPython sleep_us ovdje se zaokružuje na 1 ms; funkcionalni S3/MP SPI nema modelirano trajanje. To nije ciklusna emulacija ESP32 ni elektromagnetska simulacija. Dopušten je po jedan radio i osnovne GPIO komponente po čvoru.

Postojeći projekti ostaju format 3. Projekt s drugim čvorom koristi format 4; peer se čuva zajedno s vlastitim izvorima, sklopom i prevedenim rezultatom, uključujući JSON/ZIP, autosave i povijest. Stop zadržava zadnji prikaz i do 256 radijskih događaja; Run/Reset ih brišu. Fizički Arduino izvor izvozi se zasebno po čvoru.

[Specifikacija i granice](docs/stage21-radio.md). Provjere: `npm run test:radio`, build, regresija i završni paketni Worker pokusi. MicroPython WASM i S3 core ostaju neizmijenjeni; JS prilagodba dobila je izričiti opcionalni scheduler hook i neovisno ES module proxy stanje za svaki MP čvor. Stabilna v1.0 i fizički/učenički pilot nisu proglašeni. Sljedeća cjelina je etapa 22: objedinjene URS vježbe i završna matrica.

## Prethodna isporuka — etapa 20, 0.10.0-beta.1

MAX30102 proširuje isti laboratorij registarskim I2C modelom na 0x57, RED/IR uzorcima i FIFO-om od 32 uzorka. Četiri primjera za MicroPython, Uno/Nano Arduino i S3 C++ uvode registre, sirove uzorke, procjenu frekvencije u programu i oporavak nakon punog FIFO-a. Ukupno 27 S3 i po 76 AVR primjera ima unaprijed prevedene programe.

Vidljivi vlastiti MIT driveri `lab_max30102.py` i `lab_max30102.h` čitaju stvarne I2C bajtove. Izvorni program računa frekvenciju iz broja uzoraka između prijelaza. Model ne vraća gotov BPM ili SpO2. U Živim ulazima mijenjaj zadanu frekvenciju, amplitudu, srednju razinu, sintetski šum i kontakt. U Mjerenjima su graf pročitanih RED/IR podataka, FIFO/overflow i CSV posljednjih 128 dovršeno pročitanih uzoraka.

Profil je izričiti četveroizvodni polling carrier s regulatorom i prilagodbom za 3,3 ili 5 V; sam čip koristi zasebne naponske domene. Podržani su mode 2/3, 15–18 bita, valjane frekvencije i usrednjavanje 1–32. FIFO staje kad je pun; rollover, multi-LED, temperatura čipa i fizički INT nisu uključeni. Nepodržani zahtjevi vraćaju pogrešku. Stop čuva prikaz; Run/Reset resetiraju senzor. Projekt čuva početne parametre i izvor, bez snimke FIFO-a.

[Specifikacija i nastavni slijed](docs/stage20-max30102.md). Provjere: `npm run test:optical`, `node --import tsx verification/optical-package.mjs`, standardni build i lokalni paket. Format projekta 3/1, MicroPython WASM, funkcionalni S3 core i zaključane biblioteke ostaju isti. Stabilna v1.0, fizički senzori, učionica i ciljni mobilni preglednici ostaju zasebne provjere. Sljedeća cjelina je etapa 21: NRF24L01+ i dva čvora sa zajedničkim virtualnim vremenom.

## Prethodna isporuka — etapa 19B, 0.9.1-beta.1

microSD sada izvodi SDSC SPI inicijalizaciju i stvarne prijenose 512 B sektora, ograničeni FAT16 i DS1302 → CSV zapisivač. Četiri primjera rade na S3 MicroPythonu, S3 C++ te Uno/Nano Arduinu. Prevedeno je 23 S3 i po 72 AVR programa; raniji artefakti ostali su jednaki.

Vidljivi vlastiti MIT izvori `lab_sdcard.py`, `lab_fat16.py` i `lab_sd.h` ostaju u projektu. Python koristi os.mount/open kroz ograničeni VFS; postojeći WASM nema nativni VfsFat. C++ koristi LabSD, bez opće SD.h/SD_MMC tvrdnje. Profil: SDSC v2 8 MiB, bajtovne adrese, 512 B sektori, do 256 izmijenjenih sektora u snimci; korijen 8.3 do 64 unosa i datoteka do 64 KiB. Nema FAT32/exFAT, mapa ili SDHC-a.

Reset MCU-a čuva medij u aktivnoj sesiji. Za prijenos: Zaustavi → Sačuvaj karticu u projekt → izvoz JSON/ZIP. Iz UI-ja se zasebno preuzimaju datoteke i .img slika. Za nastavak RTC kalendara nakon ponovnog otvaranja zasebno sačuvaj RTC snimku. Nepotpun blok pri vađenju propada; nema transakcijskog jamstva za FAT operacije.

Specifikacija i granice: [docs/stage19b-sd.md](docs/stage19b-sd.md). Provjere: `npm run test:sd`, `node --import tsx verification/sd-package.mjs`, standardni build te lokalni paket. Paket se izrađuje `node scripts/package-local.mjs /apsolutni/izlaz.zip`; pokretanje traži Node.js 22+. Format projekta 3/1, funkcionalni S3 core i postojeći MicroPython ostaju isti. Sljedeća cjelina je etapa 20 (MAX30102). Fizička oprema, školsko računalo, učenici, Windows/macOS i ciljni mobilni preglednici ostaju zasebne provjere. Stabilna v1.0 nije proglašena.

## Prethodna isporuka — etapa 19A, 0.9.0-beta.1

RTC **DS1302** ima stvarni CE/I/O/SCLK model: BCD kalendar, 12/24 h, CH/WP, clock/RAM burst i 31 B RAM-a. Četiri vidljiva programska primjera postoje za MicroPython, Uno/Nano Arduino i S3 C++. S3 ima 19 pripremljenih WASM primjera, Uno/Nano po 68.

Reset MCU-a zadržava zadnju primljenu RTC snimku u otvorenoj sesiji. Stop zamrzava virtualno vrijeme. Izričita **Sačuvaj snimku RTC-a** zapisuje registre, dio sekunde i RAM u projekt za ponovno otvaranje i ZIP/JSON izvoz. Baterija zadržava sat kad se isključi glavno napajanje RTC-a; bez oba izvora kalendar postaje nevaljan. Vrijeme računala preuzima se samo na izričit klik. [Opseg, izvori i provjere etape 19A](docs/stage19a-rtc.md).

Format projekta ostaje 3/1; raniji AVR i S3 artefakti, zaključane biblioteke te MicroPython runtime nisu izmijenjeni. Novi DS1302 izvor treba aktualni model/isporuku. `npm run test:rtc` provjerava uređaj, stvarne drivere, sve ciljeve i stanje. Sljedeća razvojna cjelina je 19B: microSD, SPI blokovi, ograničen FAT/VFS i CSV zapisivač. Fizička oprema, školsko računalo, mobilni preglednici i stabilna v1.0 ostaju otvoreni.

## Prethodna isporuka — etapa 18B, 0.8.1-beta.1

ESP32-S3 Arduino C/C++ sada ima **15 stvarno prevedenih WASM primjera**. Dodani su DHT11/DHT22, nevaljani podaci i oporavak, tri DS18B20 na jednom GPIO-u, 9–12-bitna pretvorba te U8g2 OLED 128×64 i 128×32. Devet zaključanih paketa biblioteka čita stvarne GPIO/I2C/SPI prijenose u zajedničkim modelima. [Opseg i provjere etape 18B](docs/stage18b-s3-libraries.md). [Temeljni izvršni ugovor 18A](docs/stage18a-s3-cpp.md) ostaje povijesni opis prethodne isporuke.

Format projekta ostaje 3/1. MicroPython i svi raniji AVR artefakti ostaju neizmijenjeni. S3 core je 1.1.0: stari S3 WASM rezultat treba ponovno prevesti ili otvoriti ažurirani pripremljeni primjer. Izvor i sklop starog projekta ostaju dostupni. U simulator se ne učitava firmware za fizičku pločicu.

Provjere: `npm run test:s3` (pravi compiler pokusi traže LAB_WASM_CXX/LAB_WASM_OPT), `npm run s3:examples`, `npm run build`. Zasebni `verification/s3-native.ts` prevodi izvorni ZIP za Arduino IDE pomoću Arduino CLI 1.3.1 i službenog esp32:esp32@3.3.12; postavi LAB_ESP32_CONFIG na njegov zasebni profil. To nije izvođenje na fizičkoj opremi. Lokalni paket iz gotovog dist-a izrađuje `node scripts/package-local.mjs /apsolutni/izlaz.zip`. Windows/macOS alatni lanac, fizička oprema, školsko računalo i ciljni mobilni preglednici ostaju zasebne provjere. Nakon ove povijesne isporuke slijedila je etapa 19A (DS1302), a zatim 19B (microSD).

## Prethodna isporuka — etapa 17B, 0.7.2-beta.1

**XPT2046** dodaje stvarne 12-bitne SPI X/Y/Z1/Z2 pretvorbe, odvojeni CS i opcionalni aktivno LOW PENIRQ. Program kalibrira i rotira koordinate te određuje je li dodir pogodio tipkalo. Četiri komentirana primjera za MicroPython i Arduino Uno/Nano obuhvaćaju sirova očitanja, kalibraciju u dvije točke, LED tipkalo i četiri rotacije. Miš/prst imaju pritisak, povlačenje, otpuštanje i otkazivanje; klizači i gumb omogućuju tipkovnički unos. [Opseg, granice i izvori](docs/stage17b-touch.md). Fizička oprema, ciljni mobilni preglednici i stabilna v1.0 nisu potvrđeni. Sljedeća razvojna cjelina je etapa 18, Arduino C/C++ na ESP32-S3.

# ESP32 MicroPython Lab — URS, MicroPython i Arduino C++

Web laboratorij na hrvatskom jeziku. Učenik sastavlja sklop, piše stvarni MicroPython i prati GPIO/ADC/PWM, LED, tipkalo, potenciometar, AHT10, BMP180, BMP280, AM2320, SSD1306 OLED 128×64/128×32, LCD1602/PCF8574, LM35, TEMT6000, NTC, KY-023, Lab plamen/zvuk, DHT11/DHT22, DS18B20, KY-040, IR NEC, TM1637, hobi servo, SG90, relej, zujalice, DC/L298N i A4988 koračni pogon, SPI TFT ST7735/ILI9341 te zaseban BMP280 SPI, XPT2046 dodir i MAX30102 optički FIFO. React, TypeScript, Vite i CodeMirror; MicroPython 1.29.0 WebAssembly u zasebnom Workeru.


## Nastavne vježbe i predaja

Gumb **Vježbe** otvara pet postupnih vježbi: LED/vrijeme, tipkalo, ADC/PWM, AHT10/OLED i regulator s histerezom. Svaka otvara novi projekt s početnim kodom, objašnjenjima, vođenim primjerom, zadatkom i pitanjima za opažanja. V1 treba dopuniti jednim vodičem; druge vježbe polaze od pripremljenog sklopa i nepotpunog koda.

Na kartici **Vježba** odaberi **Provjeri rad**. Provjera izvršava stvarni MicroPython u zasebnoj sesiji, mijenja ulaze i opaža LED, numeričke OLED piksele i servo. Prihvaća različite nazive varijabli, GPIO-e i strukture programa. Ispuni ime/razred i opažanja te preuzmi ZIP za predaju. Nastavnik ga uvozi kroz **Pregled predaje** i izričito ponavlja ugrađenu provjeru; lokalni hash/zapis nisu ovjerena ocjena ni dokaz autorstva.

[Ugovor i granice etape 5](docs/stage5-lessons.md) opisuje scenarije i datoteke. Nastavnički uzorci dostupni su u katalogu, a `/pilot.html` daje prazan obrazac za stvarni pilot. **Stvarni učenički pilot i školsko računalo još nisu potvrđeni.** U etapi 6 ponovljeno je svih 87 programskih skupina i dodano 8 offline provjera (95/95). Cijeli preglednički tok V1 → ZIP → uvoz → nova provjera 4/4 potvrđen je u Chromiumu/Linuxu, uz ugašen poslužitelj. Etapa 5 zato još nema potvrđen cijeli kriterij pilota.

## Offline i sigurno ažuriranje

Otvori **Status i offline** i pričekaj potvrdu cijelog paketa (veličina aktualnog paketa prikazana je u statusu). On uključuje i prvi, još neotvoren editor, interpreter, upravljačke datoteke, vodič i obrazac pilota. Preuzimanje provjerava SHA-256 svakog resursa; neuspjela ili djelomična instalacija ne zamjenjuje aktivnu verziju. Datoteke projekta ostaju u IndexedDB-u, odvojene od paketa. Cache ne presreće prijavu, API-je, POST zahtjeve ili proizvoljne datoteke projekta.

Nova verzija čeka korisnikov odabir. Zaustavi izvođenje, zatvori druge kartice i klikni **Spremi i otvori novu verziju**. Tek uspješno spremanje dopušta aktivaciju i ponovno otvaranje. Više otvorenih kartica zaustavlja prisilnu aktivaciju. Verzije runtime resursa imaju zasebne URL-ove; stari paketi zadržavaju se radi ranijih stranica, pa zauzeće raste po nadogradnji. Ne brišu se projekti ni povijest.

Chromium/Linux potvrđen je nakon zaustavljanja cijelog preview poslužitelja: ponovno otvaranje, editor, primjer AHT10/OLED/servo, V1 i predaja. To ne potvrđuje offline hladno pokretanje na privatnoj produkcijskoj domeni niti pravila pojedinog školskog preglednika. Prvo preuzimanje i prijava zahtijevaju mrežu. [Etapa 6](docs/stage6-stabilization.md) i `/guide.html` opisuju točan opseg i oporavak. `Status i offline` sadrži zasebnu kratku WASM provjeru, procjenu prostora i zahtjev za trajnu pohranu.

## Isprobavanje postojeće periferije

Odaberi **AHT10 → OLED → servo**, zatim Pokreni. Pomakni temperaturu iznad 28 °C i prati OLED i servo; ispod 26 °C servo se vraća. Između dvaju pragova zadržava prethodno stanje. Očitanje je oko svake 2 sekunde. Promjena vlage mijenja broj i grafičku traku zaslona. Kôd i tri upravljačke datoteke vidljivi su u projektu, uključuju se u ZIP i mogu se uređivati.

AHT10 koristi I2C0 na GPIO8/9, OLED I2C1 na GPIO10/11. Moduli koriste 3,3 V i uključene pull-up otpornike od 4,7 kΩ; servo 50 Hz i 500–2500 µs, uz virtualno napajanje 5 V i zajedničku masu. Topologija, adresa, napajanje i stvarni bajtovi programa određuju rezultat. Izmjena vodiča ili koda mijenja ponašanje; nema skrivenog fiksnog I2C sklopa u tom primjeru.

Tri primjera Osnovnog simulatora iz etape 3 i pet fiksnih Pokusa jezgre ostaju dostupni. Kartica Mjerenja sadrži GPIO, LED, AHT10, servo, zapis očitanja i I2C prijenosa. Zaustavi čuva posljednju snimku i CSV izvoz; novo pokretanje, Reset i promjena sklopa brišu zapis. Mjerenja nisu trajno uključena u projekt: za njih preuzmi CSV.

## Projekti

Lokalni projekti, više Python, Arduino C/C++ i tekstualnih datoteka, autosave, povijest, zaštita od sukoba kartica i ZIP/JSON uvoz/izvoz zadržani su. Uvoz otvara kopiju i ne pokreće program. Format običnog projekta je schemaVersion 3 / modelVersion 1; mrežni projekt s dva čvora koristi schemaVersion 4; formati 1/2 migriraju kao ESP32-S3/MicroPython, bez izmjene koda i sklopa. Nepoznate novije inačice odbijaju se. Ulazi promijenjeni tijekom rada privremeni su; početne vrijednosti uređuju se u zaustavljenom stanju. Promjena sklopa zaustavlja program; promjena koda vrijedi pri novom pokretanju.

## Etapa 7 — pločice, jezici i projektni format

Izdanje **0.4.0-alpha.1** dodaje profile Uno R3 i Nano classic (ATmega328P), izbor pločice/jezika, usporedbu naponskih domena i izvedene kopije. Arduino projekti dobivaju `main.ino` i C/C++ CodeMirror; sve ranije izvorne datoteke ostaju sačuvane. Vodiči na staroj pločici odspajaju se u kopiji, uz prethodan pregled. Uno/Nano imaju AVR8js 0.21.0 Worker za stvarni HEX iz Arduino CLI-ja 1.3.1, AVR corea 1.8.6 i GCC-ja 7.3.0-atmel3.6.1-arduino7. Pokreni/Reset provjeravaju SHA-256 svih C/C++ ulaza, cilja i zaključanih alata te integritet HEX-a. Prevođenje novog izvora ide kroz lokalni razvojni most; internetski compiler još nije povezan. Postojeći MicroPython ostaje stvarno izvršavanje, preko zajedničkog ugovora snimke/sesije.

Katalog i matrica podrške prikazuju postojeće i planirane komponente po pločici/jeziku. Modeli AHT10/OLED ostaju 3,3 V; upozorenje na 5 V domenu ne pretvara ih u novu izvedbu modula. Novi radni breadboard 1–60 ima prekid lišta 30/31; stari 1–30 i njegovi primjeri zadržani su. Nano A6/A7 imaju samo ADC mogućnost. Arduino IDE izvoz daje mapu `LabSketch/LabSketch.ino`; nije dokaz prevođenja. Cjeloviti ZIP projekta čuva sklop i ostale datoteke.

Etapa 8 dodaje GPIO/ADC/PWM, tri timera, vanjske prekide, UART ulaz/izlaz te prototip TWI/SPI transporta bez modela uređaja. Tri primjera imaju zasebne stvarno prevedene rezultate za Uno i Nano. Uputu i most preuzmi kroz Prevedi. Etapa 9 dodaje povezani lokalni prevoditelj, zaključanu Bounce2 2.72, dijagnostiku s otvaranjem retka, predmemoriju i Arduino predaju. [Ugovor etape 8](docs/stage8-avr.md) navodi granice i dokaze. [Ugovor etape 7](docs/stage7-boards.md) opisuje migraciju i granice.

## Etapa 9 — Arduino radno okruženje

U **Prevedi** preuzmi ZIP, jednom pripremi CLI/core te pokreni `Pokreni.cmd` (Linux/macOS: `node scripts/avr-serve.mjs`). U aplikaciju zalijepi ispisanu vezu i odaberi **Poveži prevoditelj**; lokalna kartica ostaje otvorena. **Prevedi program** šalje snimku i vraća stvarni rezultat u projekt, uz provjeru da izvor nije promijenjen. Cloud compiler nije uključen. Ručni JSON put ostaje dostupan.

U dijalogu se bira **Bounce2 2.72**, s vendoriziranim MIT izvorom i zaključanim hashom. Biblioteka je stvarno prevedena i provjerena s GPIO/timerima na Uno/Nano; idealni model tipkala ne dodaje mehaničko poskakivanje. Core `Wire`/`SPI` ne podrazumijevaju nove periferne uređaje. Više datoteka ide u korijen ili `src/`. Poruke prevoditelja vode u datoteku i redak; puni zapis ostaje dostupan.

Predmemorija čuva najviše šest rezultata u pregledniku i 12 u memoriji prevoditelja. Svaki se ponovno veže uz izvor, cilj i biblioteke. **Predaja Arduino projekta** izvozi pregledljiv ZIP s imenom, razredom, opažanjima, kodom, sklopom i valjanim artefaktom; serijski zapis dodaje se samo ako pripada aktualnoj reviziji. Uvoz je zaustavljena kopija. [Ugovor etape 9](docs/stage9-arduino.md) odvaja implementaciju, Node pokuse i stvarna preglednička opažanja.

## Razvoj i provjere

- `npm ci`; `npm run dev`; `npm run build` za TypeScript i produkcijski dist.
- `npm test`: format, arhiva, pohrana, konkurentni upisi i mreže sklopa.
- `npm run test:boards`: profili, migracija 1/2/3, stara IndexedDB snimka, A6/A7, naponi, kopije, 1–60, arhive i izvršne zabrane.
- `npm run test:analog`: osam novih primjera na trima pločicama, stvarni ADC, živi ulazi, pragovi, električni kvarovi, interna AVR referenca i produkcijski Worker.
- `npm run test:simulation`: integrirani osnovni simulator.
- `npm run test:peripherals`: protokolni modeli, stvarni WASM upravljački programi, živi okoliš, OLED pikseli, PWM servo, greške/oporavak, napajanje, buffer API i granice zapisa.
- `npm run test:runtime`: naslijeđena jezgra i projektne datoteke.
- `npm run test:lessons`: 20 provjera nastavnog sloja, s pravim WASM rješenjima i negativnim slučajevima.
- `npm run test:offline`: cjelovit paket, provjera integriteta, neuspjela instalacija, kvota/oporavak, kontrolirano ažuriranje i izvršavanje verzionirane kopije Workera.
- `npm run test:ili9341`: 16-bitni prozori i geometrija 240×320/320×240, puni 76800-pikselni upis, djelomično osvježavanje, tri pločice, stvarni driveri i pakirani Worker.
- `npm run test:spi`: RGB565, rotacije, reset, CS/DC/BL, SPI registarski BMP280, oba jezika i tri pločice.
- `npm run test:avr`: stvarni strojni programi, živi ulazi, Nano A6, UART, timeri, prekidi, TWI/SPI, vezanje izvora i prisilni Stop/Reset.
- `npm run test:arduino`: ugovor biblioteka, cache, predaja, dijagnostika i loopback integracija. Za stvarne compiler testove postavi `LAB_ARDUINO_CLI` i `LAB_ARDUINO_CONFIG`; bez toga četiri stvarna compiler pokusa jasno su preskočena.
- `npm run avr:compile -- projekt.json rezultat.avr.json`: lokalni razvojni most; prethodno pročitaj `docs/arduino-bridge.txt`.
- Svi Worker i offline testovi zahtijevaju svjež `dist/`.
- `bash scripts/build-runtime.sh`: čista izgradnja zaključanog MicroPythona i Emscriptena. `scripts/write-evidence.py` zapisuje provenijenciju nakon stvarne usporedbe dviju izgradnji.

Aplikaciju posluži preko HTTP(S). U upravljanom okruženju pregledničku provjeru pokreni `sites-preview start` s apsolutnom putanjom checkouta.

## Struktura i granice

`src/app` — sučelje; `src/project` — format/ZIP/IndexedDB; `src/circuit` — komponente, editor, mreže i kompilacija; `src/runtime` — sesije; `public/circuit-host.mjs` — DC model; `public/i2c-host.mjs` — mrežno usmjeravanje I2C; `public/peripherals.mjs` — AHT10 i SSD1306; `public/drivers` — vidljive Python knjižnice primjera; `runtime` — C most/build/provenijencija; `verification` i `docs` — provjere i ugovor.

[Ugovor periferije](docs/stage4-peripherals.md) točno navodi podržane naredbe, idealizacije, logove i granice. [Ugovor etape 3](docs/stage3-simulator.md) ostaje arhivska osnova za GPIO/ADC/PWM. Referentni profil je ESP32-S3-DevKitC-1 v1.1 N16R8; fizička korisnikova pločica nije potvrđena. ESP32 funkcionalni modeli nisu emulacija procesora. AVR8js emulira ATmega328P instrukcije; vanjski električni model nije SPICE. Servo nema moment ni dinamiku, AHT10 nema šum/samogrijanje, MicroPython I2C je transakcijski model; AVR TWI i software I2C koriste virtualno vrijeme i bridove; repeated-start je podržan, OLED nema scroll/blink/zoom. Mreža i MicroPython prekidi nisu podržani. AVR vanjski prekidi i registri timera imaju zasebne razvojne provjere.

Safari/iOS, Firefox, Edge, školsko računalo i fizički hardver nisu zasebno ispitani. Offline paket i manifest aplikacije uvedeni su u etapi 6. Nastavne vježbe i predaja implementirane su u etapi 5; stvarni pilot ostaje otvoren. Osnovna inačica 0.3 ostaje beta dok se ne potvrde stvarni pilot i ciljna oprema. Proširenje 0.4 je razvojna beta: Arduino prevođenje koristi lokalni prevoditelj, a podržana AVR periferija opisana je ugovorima etapa 10A i 10B. Povezivanje lokalne kartice iz udaljenog cloud preglednika nije potvrđeno; stvarna HTTP integracija i ručni preglednički put imaju odvojene dokaze u etapi 9.

Vlastiti kôd: MIT. Licence ovisnosti, interpretera i upravljačkog programa nalaze se u public/licenses. Starije etape i dokazi zadržani su u docs.

## Etapa 10A — AVR mjerni lanac

AHT10 preko Wire/TWI, OLED SSD1306 128×64 preko hardware ili software I2C te stvarni Servo 1.2.2 Timer1 impulsi rade iz prevedenog C++ koda. Četiri nova primjera za Uno/Nano sadrže odgovarajući artefakt; broj pripremljenih primjera u etapi 10A bio je sedam po pločici. Novi moduli imaju izričit profil 5 V s regulatorom i prilagodbom I2C razina. Stari profil 3,3 V i zasebna AHT10 sabirnica ostaju.

`npm run test:avr-peripherals` provjerava protokole, stvarne biblioteke, žive ulaze, histerezu, pogrešne spojeve i SRAM. `scripts/build-stage10a-fixtures.ts` stvara dodatne reference za HW OLED, GPIO I2C čitanje i Timer1 sukob. Paket prevoditelja sada uključuje LabAHT10, odabrani izvorni U8g2 podskup/font i AVR Servo izvor. [Ugovor i granice etape 10A](docs/stage10a-peripherals.md).

## Etapa 10B — tri dodatna senzora i meteorološka stanica

BMP180, BMP280 i AM2320 dostupni su na ESP32/MicroPythonu i Uno/Nano Arduinu. Novi `lab_i2c_sensors.py` i MIT biblioteka LabI2CSensors 1.0.0 koriste kalibracijske registre, repeated-start, čekanja i CRC16. BMP senzori mjere temperaturu/tlak, AM2320 temperaturu/vlagu; svi primjeri imaju žive ulaze i mjerenja/CSV. AM2320 vraća prethodni uzorak i traži barem 2 s između očitanja. BMP280 sada ima zaseban 4-wire SPI profil iz etape 16; IIR filtar nije modeliran.

Četiri nova primjera po Arduinu povećavaju skup na 22 unaprijed prevedena primjera. Meteorološka stanica povezuje BMP180 0x77, BMP280 0x76, AM2320 0x5C i OLED 0x3C na istoj sabirnici. Za novi Arduino izvor preuzmi aktualni paket prevoditelja. `npm run test:environment` provjerava 17 novih skupina; svi postojeći i novi skupovi zajedno prolaze 160/160. [Ugovor, opažanja i granice etape 10B](docs/stage10b-peripherals.md).


## Etapa 10C — dva zaslona

OLED 0,91 inča je zaseban `ssd1306_32` profil: 128×32, 512 vidljivih bajtova, multiplex 31 i COM 0x02. Kontroler i dalje ima 1024 B GDDRAM-a. Standardni MicroPython `ssd1306.py` ostaje neizmijenjen. Arduino koristi zaseban zaključani paket **U8g2_12832 2.37.1**, s upstream UNIVISION driverom i stranicom od 128 B; stari U8g2 podskup i svi njegovi hashovi ostaju isti, pa raniji prevedeni projekti vrijede. Ne odabirati oba paketa u jednom sketchu.

LCD1602 profil sadrži HD44780, PCF8574 i idealizirani dvosmjerni I2C pretvornik. VCC napaja LCD/PCF na 5 V. Zasebni LV napaja pull-up otpornike strane pločice: 3V3 za ESP32, 5V za Uno/Nano izravni spoj. To je izričit složeni profil s pet priključaka, a ne tvrdnja da standardni četveropriključni backpack radi izravno sa svakim ESP32. Mapiranje je P0=RS, P1=R/W, P2=E, P3=pozadinsko svjetlo HIGH, P4–P7=D4–D7. PCF8574 (ne A) adrese 0x20–0x27, do 100 kHz.

LCD model prima stvarne polubajtove na E bridovima, podržava 4-bitnu inicijalizaciju, DDRAM (2×40, 16 vidljivih znakova po retku), CGRAM (8×8 redaka), adresni brojač, pomak prikaza, cursor/blink, display on/off, busy flag i čitanje preko kvazidvosmjernog porta. Nema registarskog pokazivača PCF8574. Nominalna vremena su 37 µs / 1,52 ms; prerani upis daje dijagnostiku. Emulirani CGROM ograničen je na ASCII 32–126 i puni blok; glifovi proširenog ROM-a, analogni kontrast i odziv tekućih kristala nisu modelirani. ASCII font preglednika je funkcionalni prikaz, ne vjerna kopija točaka svih fizičkih CGROM inačica.

Izvorne projektne MIT biblioteke `lcd1602.py` i **LabLCD1602 1.0.0** koriste stvarni I2C/Wire, bez posebnih poziva simulatora. Tri primjera po platformi uvode OLED32, LCD tekst/vlastiti znak i BMP280→LCD. Primjer C++ LCD-a prima `b` za svjetlo i `d` za prikaz u serijskom monitoru. Novi toolkit je u `public/arduino-development-bridge.zip`.

Provjera: `npm run test:displays`; sirovi i produkcijski Worker pokusi nalaze se u `docs/stage10c-evidence/`. U pregledničkom pokusu nije dobiven aktualan razvojni UI (stara offline inačica); vizualni prikaz i ciljni preglednici ostaju bez nove potvrde. Fizička oprema nije provjerena. Sljedeća etapa toga izdanja bila je 11: analogni i jednostavni ulazi.

## Etapa 11 — analogni i jednostavni ulazi

LM35, TEMT6000, parametrizirani NTC, KY-023 i definirani Lab profili plamena/zvuka daju stvarne napone zajedničkoj DC mreži. MicroPython ADC ili AVR analogRead čita te napone; klizači ne upisuju gotov rezultat u konzolu. Plamen ima AO/DO, zvuk točno tri priključka VCC/GND/DO. Pomoć, svojstva, početni i živi ulazi, provjera napona/ADC pina te očuvanje u ZIP-u dostupni su za svaki profil.

Osam primjera po platformi uključuje šest pojedinačnih komponenti, usporedbu LM35/NTC te dva potenciometra 1 kΩ i dva tipkala. Uno i Nano imaju ukupno 44 valjana unaprijed prevedena artefakta; novi izvor koristi postojeći lokalni compiler i ne zahtijeva novu senzorsku biblioteku. S3 koristi 12-bitni ADC s deklariranim prigušenjem i zasićenjem 3,1 V; AVR 10-bitni ADC i stvarni izbor reference (DEFAULT 5 V ili INTERNAL 1,1 V). Referenca nije napajanje senzora.

Razvojni runtime sada se učitava kroz `/app/development/` i Vite middleware. Time stari offline Service Worker više ne zamjenjuje nove javne module prilikom razvoja. Prvi ulaz razvojnog UI-ja pri postojećoj staroj offline instalaciji i dalje može zahtijevati svježi dokument (npr. query); to nije dokaz popravljenog produkcijskog update toka. Produkcijski runtime zadržava sadržajno adresirane putanje.

Regresija je otkrila povremeno prerano očitanje BMP180; MicroPython projektni driver 1.0.1 provjerava SCO bit i ima timeout. Ranije vlastite kopije drivera u spremljenim projektima ostaju sačuvane.

[Profili, primjeri, izvori i granice](docs/stage11-inputs.md). Stabilna v1.0 i fizička potvrda opreme nisu proglašene. Sljedeći razvojni paket je 12A: DHT11/DHT22 i vremenski protokol; zatim 12B: DS18B20 / 1-Wire.

## Etapa 12A — DHT11 i DHT22

Izdanje **0.5.1-beta.1** dodaje dva odvojena DHT profila, stvarni niz od 40 GPIO bitova i kontrolni zbroj, početno čekanje, ograničenje učestalosti te namjerne checksum/timeout pokuse. NC ostaje slobodan, svaki senzor ima zaseban DATA GPIO i vanjski pull-up. Stariji DHT11 profil izričito je označen zbog razlika među dokumentiranim izvedbama.

MicroPython dobiva funkcionalni virtualni mikrosekundni sat i `machine.time_pulse_us` / `dht_readinto`; neizmijenjeni `dht.py` dekodira vrijednosti i provjerava checksum. AVR koristi 16 MHz cikluse, ulazne registre i neizmijenjeni Adafruit DHT 1.4.6. Nova četiri primjera po platformi daju osam novih stvarnih Arduino prijevoda: ukupno **52** (26 po pločici). Biblioteka DHT ima vlastitu 2 s predmemoriju; primjer pogrešaka je namjerno zaobilazi. Prevođenje vlastitog novog izvora i dalje zahtijeva postojeći lokalni most.

[Profili, izvori, granice vremena i pokusi](docs/stage12a-dht.md). `npm run test:dht` provjerava novi opseg. U prilagođenom vremenskom odsječku nema emulacije trajanja Xtensa instrukcija, tolerancija/šuma senzora niti RC kabela. Nova fizička potvrda i stabilna v1.0 nisu proglašene. DS18B20 / Dallas 1-Wire dodan je u etapi 12B.

Završni vizualni pregled etape 12A uključuje ograničenje desktop radnog područja i samostalno pomicanje bočnog kataloga/laboratorija. Dug popis primjera više ne rasteže editor i konzolu na nekoliko tisuća piksela.


## Etapa 12B — DS18B20 / Dallas 1-Wire

Nastavak 12A dodaje vanjski napajani DS18B20 TO-92, zajednički DQ s jednim vanjskim pull-upom, jedinstvene ROM identitete i CRC-8. Standardni GPIO slotovi provode reset/presence, Read/Match/Skip/Search ROM, Alarm Search, Convert T, Read/Write/Copy/Recall Scratchpad i Read Power Supply. Početnih +85 °C ostaje do dovršene pretvorbe; 9–12 bita mijenja kvantizaciju i rok pretvorbe. Model latched okoliša ne mijenja već pokrenuto mjerenje.

Četiri primjera postoje za ESP32-S3/MicroPython, Uno i Nano: jedan senzor, tri senzora na DQ, razlučivost i pogreške/svježina. MicroPython izvršava neizmijenjene `onewire.py` i `ds18x20.py` uz vidljivi GPIO transport `_onewire.py`; `Pin.OPEN_DRAIN` povlači LOW ili otpušta mrežu. WASM interpreter nije ponovno mijenjan ni izgrađen.

Arduino koristi neizmijenjene OneWire 2.3.8 i DallasTemperature 4.0.6. Pripremljenih je **60** valjanih artefakata (30 po pločici). DallasTemperature 4.0.6 odbacuje −55 °C i registar +85 °C/0C; primjer za te vrijednosti ponavlja stvarno čitanje i CRC, računa iz sirovog signed 16-bitnog registra i označava taj put u konzoli. CRC i dalje ne potvrđuje vrijeme mjerenja.

AVR sat ide izravno iz ciklusa u µs, bez numeričkog gubitka pri prolasku kroz milisekunde. Funkcionalni reset prijamnik ima izričitu toleranciju od 1 µs zbog opaženog 479,25 µs impulsa zaključanog AVR drivera/corea; preporuka za master ostaje ≥480 µs. To nije tvrdnja o fizičkom pragu senzora.

`npm run test:onewire` provjerava protokol, upstream drivere, stvarni AVR, produkcijski Worker, live ulaze, Stop/Reset, CRC, ROM, pohranu i granice. [Opseg i izvori](docs/stage12b-onewire.md). Parazitsko napajanje i RC/šum kabela nisu modelirani. Format projekta ostaje 3, pristup aplikaciji ostaje privatan. Sljedeća je etapa 13A — KY-040 enkoder.

## Etapa 13A — KY-040 enkoder

Pasivni kontakti CLK/DT stvaraju kvadraturni niz i imaju pull-up 10 kΩ; SW koristi programski pull-up. Ugovor: CW 11→01→00→10→11, četiri brida po zadržnom koraku. Mehanički položaj i brojač programa prikazani su odvojeno. Četiri primjera za S3/MicroPython te Uno/Nano pokrivaju sirove signale, Gray dekoder, reset, sintetsko poskakivanje i PWM svjetlinu. Vidljivi `lab_encoder.py` i C++ dekoder čitaju stvarne GPIO signale; spori polling može izgubiti korake.

`npm run test:encoders` provjerava 23 skupine, uključujući stvarno prevedene INT0/INT1 pokuse. Osam novih prijevoda povećava katalog na 68 artefakata. Trag kontakata (128 po uređaju) ima CSV izvoz. MicroPython IRQ nije uveden. [Ugovor i granice etape 13A](docs/stage13a-encoder.md) opisuje precizni električni i vremenski profil.
