# Provjera integriranog Arduino offline prototipa

Ovaj postupak namijenjen je nastavniku koji provjerava razvojnu izgradnju
Labosa s uključenim `LAB_OFFLINE_AVR=1`. To nije potvrda javne objave ili
podrške svim preglednicima. Tehnička priprema opisana je u [INTEGRATION.md](INTEGRATION.md).

## Priprema i kratka uputa

1. Otvori pripremljenu adresu prototipa u običnom profilu preglednika.
   Sačuvaj tu adresu: offline paket pripada istoj adresi i profilu.
2. U **Status i offline** pričekaj potvrdu da je cijeli paket aplikacije
   preuzet. To je zasebna provjera od Arduino prevoditelja.
3. Otvori samostalan Arduino Uno ili klasični Nano projekt. U **Prevedi**
   odaberi **Pripremi offline prevoditelj** i pričekaj poruku da je paket
   spremljen. Komprimirani alati i SDK zauzimaju 14,93 MiB; aplikacija i
   spremljeni radovi zauzimaju dodatni prostor.
4. U **Biblioteke i datoteke programa** označi potrebne biblioteke.
   Za DS18B20 prvo označi **OneWire**, zatim **DallasTemperature**.
   U8g2 i U8g2_12832 alternativni su paketi, prema visini zaslona.
5. Uredi `main.ino`, odaberi **Prevedi u pregledniku** pa
   **Pokreni offline rezultat**. Serijski ispis i sklop prate se u
   glavnom radnom okruženju. Dodatne `.c`, `.cpp`, `.h` i `.hpp` datoteke
   stavi u korijen projekta; funkciju deklariraj prije poziva.
6. Pričekaj oznaku spremljenog projekta. **Izvezi prototipni rezultat**
   sprema projekt i pripadajući rezultat; obični ZIP/JSON izvoz sprema
   standardni projekt. Kopiju s rezultatom uvoziš gumbom **Uvezi**.

Ako je izvor promijenjen, prethodni rezultat nije valjan za taj izvor.
Ako prevođenje prijavi pogrešku, ispravi je i ponovno prevedi. Sama
oznaka mrežne dostupnosti ne dokazuje da su oba paketa spremljena.

## Pilot na stvarnim uređajima

Prvi referentni uređaj je školsko računalo i5-6600 / 8 GB RAM-a.
Android, iPhone/Safari i ostali preglednici zasebni su kandidati za provjeru.
Snimka Chromiuma širine 390 px potvrđuje raspored, ne podršku fizičkom mobitelu.

Ne briši predmemoriju ni podatke između koraka. Zaseban novi profil koristi
samo za test prve instalacije. Postojeći profil s radovima zadrži za test
očuvanja projekata. Prije isključivanja mreže izvezi sigurnosnu kopiju rada.

| Korak | Radnja | Dokaz prolaza |
|---|---|---|
| Priprema | Pripremi oba paketa; prevedi i pokreni Uno projekt. | Potvrda oba paketa i očekivani serijski ispis. |
| Stvarna izolacija | Odspoji Ethernet i isključi Wi-Fi/mobilnu vezu na testnom uređaju. | Zabilježene isključene veze; nije samo odabran offline prikaz aplikacije. |
| Novi program | Tek sada promijeni poruku u `PILOT_OFFLINE_01` i interval LED-ice. | Novi tekst i novi interval nakon novog prevođenja. |
| Pogreška | Unesi sintaksnu pogrešku i prevedi. | Pogreška je prikazana; ni glavni Pokreni ne pokreće stari rezultat kao novi. |
| Oporavak | Ispravi izvor, prevedi i pokreni. | Novi rezultat radi bez ponovnog preuzimanja alata. |
| Ponovno pokretanje | Zatvori cijeli preglednik, pokreni isti profil i spremljenu adresu bez mreže. | Projekt i rezultat očuvani; promijeni poruku u `PILOT_RESTART_02`, prevedi i pokreni. |
| Nano | Ponovi novi izvor i restart na zasebnom Nano projektu. | Potvrđena pločica i poruka; rezultat Una nije upotrijebljen za Nano. |
| Biblioteke | Uvezi postojeću provjerenu AHT10/OLED/Servo vježbu; promijeni poruku offline. | Novi ispis i očekivani prikazi senzora, zaslona i serva. |
| Izvoz i uvoz | Izvezi prototipni rezultat i ponovno ga uvezi. | Uvezena zasebna kopija je zaustavljena; ručno pokretanje uspijeva. |
| Ostali radovi | Otvori ranije spremljene projekte. | Sadržaj, bilješke i sklopovi očuvani. |

Za svaki uređaj popuni zaseban zapis. Prazno polje ili neproveden korak nije prolaz.

| Podatak | Rezultat pilota |
|---|---|
| Datum, uređaj, CPU i RAM | Nije izmjereno |
| Operacijski sustav, preglednik i puna verzija | Nije izmjereno |
| Commit, adresa prototipa i identitet paketa | Nije zabilježeno |
| Profil: novi / postojeći; prethodna verzija aplikacije | Nije zabilježeno |
| Prvo preuzimanje oba paketa: vrijeme i prostor | Nije izmjereno |
| Prvo / ponovljeno prevođenje Una i Nanoa | Nije izmjereno |
| Prevođenje s bibliotekama | Nije izmjereno |
| Odziv uređivanja i prekida posla | Nije provjereno |
| Memorija: alat mjerenja i opaženi maksimum | Nije izmjereno |
| Offline, puni restart, izvoz/uvoz i očuvanje radova | Nije provjereno |
| Pogreške i priloženi dokazi | Nije provjereno |

Zabilježi način mjerenja memorije; zbroj RSS-a procesa nije isto što i
jedinstvena fizička memorija ni potrošnja samo prevoditelja. Za odluku o
pilotu koristi rezultate stvarnog školskog uređaja. Nemoj prenositi CI vremena
ili memorijska mjerenja na i5-6600, Android ili iPhone.

## Granice i nastavak

Potvrđeni pilot vrijedi samo za zabilježeni uređaj, preglednik i izgradnju.
Ovaj AVR prototip ne prevodi ESP32-S3, ne programira fizičku pločicu i ne
zamjenjuje školsko bodovanje. EEPROM se pri pokretanju vraća na 0xFF.
Prije javnog paketa treba dovršiti pripadajuće izvore i distribucijske
obavijesti opisane u [README.md](README.md). Buduće odredište objave
nadograđenog Labosa je `labosv2`; ovaj dokument ne mijenja javne grane.
