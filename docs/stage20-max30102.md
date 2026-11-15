# MAX30102 model, driveri i nastavni slijed

Isporuka 0.10.0-beta.1, 14. studenoga 2026. Dodaje registar i FIFO model optičkog senzora u postojeći električni i izvršni put. MicroPython, stvarno prevedeni AVR i funkcionalni S3 C++ dobivaju iste I2C podatke. Parametri su sintetski izvor; program sam računa frekvenciju. Nema prepoznavanja izvornog teksta, presretanja ispisa, gotovog BPM odgovora ili izračuna SpO2.

## Električni profil

Četveroizvodni Lab carrier ima VCC, GND, SDA i SCL. Uključuje interno napajanje čipa na 1,8 V, LED napajanje i dvosmjernu prilagodbu prema odabranom 3,3 V ili 5 V profilu. To nije opis proizvoljne kupljene pločice. Ugrađeni pull-up otpornici su 4,7 kΩ; mogu se isključiti u svojstvima radi pokusa. I2C adresa je stalna 0x57, do 400 kHz. Dva MAX30102 na istoj sabirnici daju sukob adrese; AHT10 zadržava zasebnu sabirnicu.

| Pločica | VCC | SDA | SCL |
| --- | --- | --- | --- |
| ESP32-S3 MicroPython ili C++ | 3V3 | GPIO8 | GPIO9 |
| Uno R3 ili klasični Nano | 5 V carrier | A4 | A5 |

ACK traži stvarne mreže napajanja, zajedničku masu, SDA/SCL i valjane razine. Nedostajući priključak, zamjena linija, pogrešna adresa, nedostatak pull-upova ili druga naponska domena ne stvaraju valjano očitanje.

## Registarski i FIFO ugovor

| Registar | Model |
| --- | --- |
| 0x00 / 0x01 | PWR_RDY, PPG_RDY i A_FULL; čitanje briše odgovarajući status. Nema fizičkog INT izvoda. |
| 0x02 / 0x03 | Pohrana podržanih enable bitova prvog registra; drugi prihvaća samo 0. Bez INT signala ili temperature. |
| 0x04–0x06 | Petobitni WR, saturirajući overflow do 31 i RD. Zapisi omogućuju čišćenje i ponovno čitanje prethodnog bankovnog uzorka. |
| 0x07 | FIFO_DATA, ne povećava I2C adresu u burst čitanju. Tri bajta RED-a ili šest RED+IR. |
| 0x08 | Usrednjavanje 1, 2, 4, 8, 16, 32 (kodovi 6/7 također 32); prag A_FULL. Rollover=1 se odbija. |
| 0x09 | Idle 0, RED 2, RED+IR 3, SHDN i RESET. Reset se modelno dovršava nakon 1 ms virtualnog vremena. |
| 0x0A | ADC raspon, frekvencija uzorkovanja i 15–18-bitna rezolucija. Nevaljane kombinacije tablica 11/12 odbijaju se. |
| 0x0C / 0x0D | Relativna pobuda kanala prema LED_PA; 0 gasi pripadni sintetski kanal. |
| 0xFE / 0xFF | Izričito sintetski REV_ID=3 i PART_ID=0x15. Nakon 0xFF adresa ostaje 0xFF. |

FIFO sadrži do 32 uzorka. Pri prvom bajtu uzorka RD napreduje, a overflow se briše; kopija uzorka ostaje zaključana za ostatak tog prijenosa. Nedovršeno čitanje ne stvara UI očitanje. Za cijeli uzorak koristi isti I2C read, 3 ili 6 bajtova. Pisanje RD može ponovno odabrati sadržaj banke. Donji neiskorišteni bitovi kraćih ADC rezolucija su nula, a najviši podatkovni bit ostaje na poziciji 17.

Kad je FIFO pun, novi prosječni uzorci se odbacuju. Modelni ukupni broj gubitaka odvojen je od petobitnog registarskog overflowa. Pun FIFO i prazan FIFO mogu imati WR=RD; vidljivi driver uz pokazivače provjerava A_FULL i overflow. Njegov available() ugovor pretpostavlja vlastitu konfiguraciju A_FULL praga 0 i zaustavljanje na punom FIFO-u. Pri promjeni te politike učenik treba prilagoditi i driver.

Usrednjavanje računa stvarni prosjek susjednih sirovih uzoraka zasebno po kanalu, a zatim decimira. Primjer 100/4 daje 25 FIFO uzoraka/s. Očitanja ne generiraju nove uzorke: njihovo vrijeme određuje virtualni sat. Dugo čekanje uz pun FIFO koristi ograničen izračun gubitaka, bez petlje po milijunima odbačenih uzoraka. Shutdown čuva već postojeći FIFO, zaustavlja akviziciju i pri povratku počinje novi razmak uzorkovanja.

## Sintetski izvor

Nominalni IR je DC + A × (sin φ + 0,2 sin 2φ), uz ponovljivu sintetsku smetnju. RED koristi 0,85 DC i 0,7 A. Faza se povećava za 2π × zadana frekvencija / 60 / sirova brzina. Promjena živog ulaza najprije dovršava prethodne uzorke, zadržava fazu i mijenja tek buduće podatke. LED_PA=31 i ADC raspon 4096 nA daju nominalni profil; drugi rasponi i pobude skaliraju ADC brojeve. Podaci se ograničavaju na 18-bitni raspon i kvantiziraju prema rezoluciji. Bez kontakta nominalni RED/IR su 425/500; to je projektni pokus, ne fiziološki prediktor.

Postavke: frekvencija 40–180/min, amplituda 0–30000, srednja IR razina 1000–160000, sintetski šum 0–10000 i kontakt. ADC brojevi nemaju kalibriranu optičku jedinicu. Model ne opisuje ljudsko tijelo, oksigenaciju, strujnu ili toplinsku dinamiku, ALC overflow ni stvarnu ambijentalnu svjetlost.

## Vidljivi programi i nastava

Vlastiti MIT izvori `lab_max30102.py` i `lab_max30102.h` verzije 1.0.0 ostaju u projektu i izvozu. Koriste `machine.I2C` odnosno `Wire`; C++ ima šestobajtni međuspremnik, bez velikog AVR niza ili nove zaključane vanjske biblioteke. Za nepodržane registre/načine model vraća pogrešku; nema prešutnog uspjeha.

1. **Registri i identitet:** uvodi registre, identitet, konfiguraciju i shutdown. Naziv dvokanalnog moda u datasheetu nije izračun SpO2.
2. **Sirovi RED/IR:** uvodi FIFO, kružne pokazivače, tri bajta po kanalu i sastavljanje 18-bitnih brojeva. Svaki deseti uzorak ide u konzolu.
3. **Frekvencija iz uzoraka:** program uklanja sporu srednju vrijednost, prati omotnicu i prijelaze s histerezom. Pri 100 FIFO uzoraka/s vrijedi frekvencija/min = 6000 / razmak prijelaza u uzorcima. Početna 2 s zagrijavanja i dva prijelaza prethode procjeni. Gubitak uzoraka resetira detektor. Promjena konfiguracije usrednjavanja ili brzine traži promjenu pretpostavke 100 u algoritmu.
4. **Pun FIFO i gubici:** čekanje 700 ms pri 100/s namjerno gubi podatke. Program ispisuje broj i overflow, čita spremljene podatke, briše FIFO i nastavlja. Promjena average=4 smanjuje izlaznu brzinu, pa isto čekanje ne puni FIFO.

Graf i CSV sadrže samo posljednjih 128 cijelih uzoraka koje je program pročitao. Razlikuju vrijeme nastanka od vremena čitanja. To nije potpuna snimka svih generiranih podataka. Stop zamrzava zadnji okvir; Run/Reset stvaraju novi uređaj, bez baterijskog zadržavanja. Projekt sprema početne parametre i izvor; FIFO nije dio projektne snimke. Ranije URS vježbe i schemaVersion 3 / modelVersion 1 ostaju isti.

## Granice i provjere

Rollover, multi-LED, temperatura čipa i fizički INT nisu uključeni. Nije deklarirana podrška proizvoljnim SparkFun/DFRobot/MAX30105 bibliotekama. Detektor služi nastavi periodičkih signala; smetnje ili promjene kontakta mogu dati prijelazne i pogrešne rezultate. Stabilna v1.0, medicinsko mjerenje, fizička pločica, školski pilot i ciljni mobilni preglednici nisu proglašeni.

Izvršne provjere su `verification/max30102.test.ts`, pakirani Workeri `verification/optical-package.mjs` i dokazi u `docs/stage20-evidence/`. Svježe rezultate i granice provjera sadrži izvješće isporuke. Povijesni dokazi ranijih isporuka ostaju povijesni.

## Primarni izvori

- [Analog Devices MAX30102 datasheet, Rev. 1](https://www.analog.com/media/en/technical-documentation/data-sheets/max30102.pdf): naponske domene, registarska mapa, FIFO i lijevo poravnanje te tablice brzine/širine impulsa.
- [Analog Devices: averaging i efektivna brzina](https://ez.analog.com/optical_sensing/a/documents/DO19535/if-i-enable-sample-averaging-in-max30101-max30102-and-keep-the-sampling-rate-setting-to-be-the-same-does-the-effective-sampling-rate-go-down): podjela izlazne brzine brojem usrednjenih uzoraka.

Izvori određuju uređaj i protokol. Sintetski val, modelno trajanje reseta, odsutnost kontakta, prazan read=0 i granice polling profila izričite su projektne odluke.
