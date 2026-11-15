# Etapa 17B — XPT2046 uz ILI9341

Isporuka **0.7.2-beta.1**, 13. studenoga 2026. Nastavlja etapu 17A u istoj privatnoj aplikaciji. Format ostaje schemaVersion 3 / modelVersion 1. Arduino C/C++ za ESP32-S3 ostaje sljedeća etapa 18.

## Model i SPI ugovor

`xpt2046` je zasebna komponenta, ne skriveni dio ILI9341. Ima VCC, GND, SCK/DCLK, MOSI/DIN, MISO/DOUT, CS i opcionalni IRQ/PENIRQ. TFT zadržava vlastiti CS/DC/RESET i write-only profil. Oba dijele SCK/MOSI; MISO pripada dodirnom kontroleru. CS-ovi se postavljaju HIGH prije pokretanja sabirnice. Više aktivnih CS-ova na istoj spojenoj sabirnici odbija se uz dijagnostiku.

Funkcionalni model prima stvarne SPI bajtove i vraća 12-bitne diferencijalne kanale: X=D0/D1, Y=90/91, Z1=B0/B1, Z2=C0/C1. Podržan je mode 0, MSB prvi, do 2 MHz. Vidljivi Lab driveri koriste 1 MHz i 24 takta: naredba + dva rezultatna bajta, s jednim početnim null bitom i tri završne nule. Podržano je i byte-aligned 16-clock preklapanje: novi kontrolni bajt može se poslati dok se prima završni bajt prethodnog rezultata. Rastući CS odbacuje nedovršene rezultatne bajtove. Ne modeliraju se proizvoljne 15-clock/bitne granice.

PD=00 vraća uređaj u power-down nakon pretvorbe i omogućuje PENIRQ; PD=01 zadržava ADC i onemogućuje PENIRQ. U profilu je IRQ otvoreni odvod s 10 kΩ pull-upom, aktivan LOW pri dodiru uz PD=00. Nema analognog prikaza potrošnje niti modela unutarnjih tranzijenata reference. Kratki prijelazi/zabrana PENIRQ unutar same ADC pretvorbe nisu vremenski modelirani; provjerava se funkcionalno stanje nakon prijenosa. GPIO koji aktivno vozi IRQ na HIGH pri njegovu LOW stanju daje dijagnostiku konflikta. Polling očitanje radi i bez IRQ vodiča; primjeri čitaju IRQ kao običan digitalni ulaz, ne proglašavaju testiranom svaku vanjsku interrupt biblioteku.

Napajanje, zajednička masa i spojene SPI mreže određuju rezultat. Nepovezan MISO vraća FF uz dijagnostiku. Vidljivi driveri odbacuju rezultat izvan 12-bitnog raspona i nevaljane Z parove kako otvorena MISO veza ne bi postala dodir. CS HIGH, nedostajući SCK/MOSI/CS ili napajanje ne proizvode valjanu pretvorbu. Nepodržana SPI konfiguracija i ADC naredbe odbijaju se izričito.

## Sintetski panel, kalibracija i rotacija

Virtualni otporni sloj ima fizičku površinu 240×320. U ovom izričitom Lab profilu krajevi su X 200–3900 i Y 250–3850, linearno i deterministički. To nisu univerzalne konstante fizičkih modula. Bez dodira model daje X=Y=Z1=0 i Z2=4095; fizički nepobudeni panel može dati neodređene položajne rezultate.

Relativni pritisak 0–100 % određuje sintetske Z1=20p i Z2=4095−15p uz zaokruživanje. Pokazatelj Z=Z1+4095−Z2 je bezdimenzijski i nije sila u N, tlak u Pa ni procjena kontaktnog otpora bez poznatog panela. Stanje fizičkog dodira i programski prag zasebni su: slab pritisak može aktivirati IRQ, a ostati ispod programskog Z praga. Nema šuma, otporne dinamike, više dodira, kapacitivnog dodira, temperature, VBAT/AUX kanala ili 8-bitnih pretvorbi.

Kalibraciju i hit-test izvodi učenikov program iz SPI rezultata, a ne prikaz, naziv primjera ili konzolna poruka. `lab_xpt2046.py` i `lab_xpt2046.h` 1.0.0 originalni su MIT izvori vidljivi u projektu i izvozu. Prvo mapiraju sirove rubove na fizičke piksele, zatim primjenjuju inverznu MADCTL rotaciju:

| Rotacija TFT-a | Logička točka iz fizičke (x,y) | Logička geometrija |
| --- | --- | --- |
| 0 / 48 | (x,y) | 240×320 |
| 1 / 28 | (y,239−x) | 320×240 |
| 2 / 88 | (239−x,319−y) | 240×320 |
| 3 / E8 | (319−y,x) | 320×240 |

Driveri dopuštaju obrnute kalibracijske rubove, ograničavaju koordinate i odbijaju nulti raspon/nevaljanu rotaciju. C++ koristi 32-bitni međurezultat pri skaliranju i ekstrapolaciji; Arduino ne alocira TFT framebuffer. Različito zaokruživanje Python/C++ može dati razliku od jednog piksela u unutrašnjosti; rubovi i rotacije imaju isti ugovor.

## Primjeri i uporabni tok

1. **Sirovi X/Y i pritisak:** promijeni položaj, relativni pritisak i stanje; usporedi stvarno očitane kanale i IRQ u konzoli.
2. **Kalibracija u dvije točke:** program crta križiće (20,20) i (219,299), čeka pritisak i otpuštanje svake točke, iz dvaju sirovih uzoraka ekstrapolira krajeve i ispisuje konstante. Treća točka koristi izračunatu kalibraciju. Ponovljene ili prebliske točke završavaju razumljivom pogreškom. Dvije točke pretpostavljaju poravnate osi i ne ispravljaju smicanje ili proizvoljnu zamjenu osi fizičkog modula. Nova sesija ponovno kalibrira.
3. **Dodirno tipkalo upravlja LED-icom:** programski pravokutnik [30,210)×[120,200) preklapa vanjsku LED samo pri novom dodiru koji počinje unutar njega. Držanje, povlačenje izvan/unutra te novi dodir izvan pravokutnika ne preklapaju izlaz. Pogrešna kalibracija ili neusklađena rotacija mijenjaju odziv. Boju i tekst tipkala mijenja isti program kroz SPI.
4. **Dodir i četiri rotacije:** svaki novi dodir ispisuje položaj za aktualnu rotaciju i nakon crtanja bira sljedeću. Fizički prikaz ostaje uspravan, a logičke dimenzije se izmjenjuju.

Primjeri postoje za ESP32-S3/MicroPython i za Uno R3/Nano classic/Arduino C/C++. Numeracija aplikacijskih primjera ne mijenja postojeće URS LV dokumente. Arduino primjeri koriste vidljive `.h` datoteke, bez promjene compiler/core ugovora ili dodavanja vanjskih grafičkih/touch biblioteka. Postojećih 120 prevedenih AVR artefakata ostaje bajtno jednako; dodano je osam, ukupno 128.

## Spojevi i sučelje

| Signal | ESP32-S3 | Uno R3 / Nano classic |
| --- | --- | --- |
| SCK / MOSI / MISO | GPIO12 / 11 / 13 | D13 / D11 / D12 |
| TFT CS / DC / RESET | GPIO10 / 9 / 8 | D10 / D9 / D8 |
| XPT CS / opcionalni IRQ | GPIO7 / GPIO2 | D7 / D2 |
| Vanjska LED kroz 680 Ω | GPIO4 | D6 |
| VCC i logika profila | 3,3 V | izričit 5 V carrier s regulatorom i obostranom SPI/IRQ prilagodbom, VCC na 5V priključak |
| TFT BL | 3V3 | 3V3 |

Carrier je nastavna sastavljena izvedba; ne pretpostavlja 5 V kompatibilnost svakog TFT/touch modula. U stvarnosti zasebno provjeri module, DOUT/IRQ razine i pinout. DOUT se u simulatoru prenosi funkcionalno po SPI bajtu, ne kao nacrtani valni oblik na MISO mreži.

Katalog, svojstva, help i matrica podrške prikazuju novi profil. Odabir „Dodirni sloj uz zaslon” povezuje prikaz istoga fizičkog panela; to ne spaja električne mreže i ne kalibrira program. Nepostojeća/uklonjena pridružena slika prikazuje samostalan panel bez utjecaja na električni model. Više XPT komponenti imaju neovisne ulaze i stanje.

Prikaz DODIR podržava pritisak, povlačenje, otpuštanje, pointer capture, cancel i lost capture. Klizači X/Y/pritisak i gumb zadržanog dodira omogućuju rad tipkovnicom. Pokretanje radi iz spremljene snimke, a ulazi tijekom izvođenja ostaju stanje sesije. Vrlo kratak dodir spor polling program može propustiti; držanje do odziva i gumb zadržanog dodira daju jasan nastavni pokus.

Mjerenja prikazuju broj pretvorbi, posljednji stvarno pretvoreni kanal, IRQ i SPI bajtove/CSV. Trenutačna pobuda i posljednje programsko očitanje jasno su razlikovani. Stop zadržava sliku i trag; Run/Reset stvaraju novu sesiju. JSON/ZIP čuvaju ulaze, odabir panela i izvore; Arduino IDE izvoz sadrži potrebne `.ino`/`.h` datoteke. Offline manifest uključuje novi model i upravljačke datoteke.

## Provjere i granice dokaza

Automatske provjere obuhvaćaju sirove kanale, 12-bitno pakiranje, preklapanje/split prijenose, PD/IRQ, otpuštanje, pogrešno napajanje i signale, MISO/CS pogreške, nepodržane naredbe, kalibraciju i četiri rotacije, punu JSON/ZIP/IDE putanju, stvarni MicroPython, svih osam AVR programa i pakirani Nano Worker s prisilnim Stopom do 500 ms. Evidencija se čuva u `docs/stage17b-evidence/`. Ukupan broj i završni ishodi nalaze se u `validation-summary.json` te izvješću isporuke; ponovljena izvođenja nisu dodatne jedinstvene provjere.

U razvojnom Chromiumu/Linuxu opaženi su Uno primjer, zadržani dodir tipkovničkim gumbom i pritisak mišem na fizičkoj površini, uključivanje/isključivanje, logičke koordinate, IRQ otpuštanja i zadržavanje konzole/slike nakon Stop. Nisu provedeni fizički modul, školsko računalo, učenički pilot, stvarni Safari/iOS ili Android uređaji ni hladno offline otvaranje privatne produkcijske domene. Uspješna objava zasebno potvrđuje isporuku; nije isti dokaz kao pokus kroz produkcijsku prijavu. Stabilna v1.0 nije proglašena.

## Primarni izvori, provjereni 13. studenoga 2026.

- [XPTEK XPT2046 datasheet, preko Waveshare](https://files.waveshare.com/upload/9/98/XPT2046-EN.pdf), str. 15, 20–29: diferencijalni kanali, Z1/Z2, kontrolni bajt, 12-bitni format, PENIRQ i 16/24-clock prijenosi. Dokument sadrži različite naponske navode; zato ovaj projekt deklarira vlastite carrier profile i ne izvodi univerzalnu 5 V kompatibilnost modula iz apsolutnih granica čipa.
- [Paul Stoffregen XPT2046_Touchscreen izvor](https://github.com/PaulStoffregen/XPT2046_Touchscreen/blob/master/XPT2046_Touchscreen.cpp): neovisna usporedba preklopljenih Z1/Z2 prijenosa, 2 MHz/mode 0 i bezdimenzijskog pokazatelja pritiska. Biblioteka nije uključena niti proglašena podržanom; njezina imena osi/rotacija ovise o driver konvenciji.
- [Ugovor etape 17A](stage17a-ili9341.md): fizička geometrija ILI9341 i MADCTL rotacije.

Sintetski krajevi panela, karakteristika relativnog pritiska, deterministički rezultati bez dodira, vezivanje prikaza i dvotočkasti čarobnjak projektne su odluke.
