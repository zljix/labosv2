# Etapa 24I · meteorološka stanica i regulator

Izdanje **0.14.7-beta.1**, provjeravač `24I.1`, dodaje dvije rubrike i osam kombinacija: **184 od 268**, odnosno 46 URS varijanti na MicroPythonu S3, S3 C++, Unu i Nanu. Ranija 51 rubrika ostaje neizmijenjena. Uvodne V1–V5 ostaju zasebne lokalne provjere.

## Učenik prije rada vidi uvjete i bodove

Svaka nova rubrika ima 10 bodova. Upute, temperaturni slijed, granice, razmaci, tolerancije i raspored bodovanih polja objavljuju se s nepromjenjivom inačicom zadatka.

| Rubrika | 3 boda | 5 bodova | 2 boda |
| --- | --- | --- | --- |
| `24I-regulator@1` | Napajani put, dovršeno AHT10 čitanje, upis OLED-a i stvarni servo impuls | Šest osnovnih promjena: svježi T/RH, primljeni pikseli i servo uz histerezu | Granični uzorci, oba smjera i završni povrat |
| `24I-weather@1` | Neovisna čitanja triju senzora i upis napajanog OLED-a | Sva nova mjerenja i pripadni ispisi kroz šest okoliša | Odgovarajuće vrijednosti u primljenim OLED pikselima kroz cijeli pokus |

Konzolni ispis ne crta zaslon, a framebuffer unutar programa nije dokaz da su pikseli stigli do kontrolera. Ponovno čitanje istog uzorka ne povećava broj novih očitanja. Službeni rezultat računa se iz točne spremljene snimke, objavljenog ugovora i izoliranog izvođenja.

## Regulator: novo mjerenje i prethodno stanje

Svaka etapa traje 3000 ms. Osnovni slijed 24, 29, 27, 25, 27, 29 °C daje kutove 0, 90, 90, 0, 0, 90°. Nastavak je 25,9998; 27,9998; 28; 26; 25,9998; 26,0002; 28,0002; 24 °C. On potvrđuje otvaranje i zatvaranje s obiju strana granica. RH se izmjenjuje između 35 i 65 %, a sjeme bira početni redoslijed.

Otvaranje je na dekodirano T ≥ 28 °C, zatvaranje na T ≤ 26 °C. Između pragova zadržava se prethodno stanje. AHT10 kodira temperaturu kao `round((T+50)·2^20/200)`. Nominalnih 26 °C zato se dekodira kao približno 26,000023 °C. U tom uzorku prethodno otvoren regulator ostaje otvoren; susjedni niži uzorak ga zatvara. Usporedba se provodi prije zaokruživanja na jednu decimalu za zaslon. Ne mijenjamo postojeće upravljačke programe radi te razlike.

U svakoj etapi treba najmanje jedno novo dovršeno čitanje, prvo do 2300 ms, daljnji razmak najviše 2400 ms. Nakon 2300 ms servo mora zadržati očekivani kut unutar ±2° uz 50 ±2 Hz. OLED mora prikazati novi T i RH stabilno najmanje 100 ms. Temperature imaju toleranciju ±0,3 °C, RH ±0,2 postotna boda.

## Stanica: svaki senzor ima svoj okoliš

BMP180, BMP280 i AM2320 ne dijele jednu skrivenu mjernu vrijednost. Šest etapa po 8000 ms čine početni okoliš, promjena samo AM2320, samo BMP180, samo BMP280, drugi okoliš i povrat. Sjeme može zamijeniti okoliše A i B.

| Senzor | Okoliš A | Okoliš B |
| --- | --- | --- |
| BMP180 | 12 °C; 93000 Pa | 42 °C; 107000 Pa |
| BMP280 | 32 °C; 104000 Pa | 8 °C; 88000 Pa |
| AM2320 | 22 °C; 35 % RH | 36 °C; 75 % RH |

Svaki senzor daje najmanje dva nova uzorka po etapi. Prvi odgovarajući uzorak mora stići do 5500 ms, a daljnji razmak iznosi najviše 3000 ms. AM2320 smije tijekom početnog roka vratiti prethodni uzorak. Mjerenja i ispisi povezuju se po identitetu i vremenu stvarnog čitanja. Tolerancije su ±0,3 °C, ±150 Pa i ±0,2 postotna boda RH.

Ispis nosi identitet `BMP180`, `BMP280` ili `AM2320`, zatim T/P odnosno T/RH. Prihvaćaju se imenovana polja `T=`, `P=`, `RH=` i pozicijski format postojećeg S3 primjera. Tlak u ispisu je u Pa, na zaslonu u hPa. Jedan BMP senzor ne zamjenjuje drugi.

## OLED i dopuštena rješenja

Zadržani su postojeći sadržaji po cilju. MicroPython koristi framebuf 8×8; AVR U8g2 6×10; S3 C++ mali LabOLED 5×7. Brojke imaju jednu decimalu i smiju se pomaknuti unutar objavljenih vodoravnih pojaseva. Slobodni tekst, geometrija i raspored koda ne određuju rezultat.

| Cilj i zadatak | Bodovani pojasevi |
| --- | --- |
| MicroPython regulator | T: y=0..7; RH: y=14..21 |
| AVR regulator | T: y=0..13; RH: y=14..27 |
| S3 C++ regulator | T: y=0..7; RH: y=16..23 |
| MicroPython stanica | BMP180 hPa: y=0..7; BMP280 hPa: y=14..21; AM2320 T: y=28..35; RH: y=42..49 |
| AVR stanica | BMP180 hPa: y=0..13; BMP280 hPa: y=14..27; AM2320 T: y=28..41; RH: y=42..55 |
| S3 C++ stanica | BMP280 T: y=0..7; BMP280 hPa: y=16..23; sva tri senzora ostaju obvezna u mjerenjima i ispisu |

`school/grader/environment-fonts.json` sadrži rastere znamenaka iz navedenih fontova. SHA-256 datoteke zamrznut je u ugovoru. Provjeravaju se i uključeni i isključeni pikseli cijelih brojčanih ćelija. U8g2 raster dobiven je izvornim rendererom priložene biblioteke, a ne učenikovim programom. Električno ekvivalentan raspored, druge oznake, redoslijed komponenti, drugi algoritam i valjani GPIO dopušteni su.

## Izvršne provjere i nadogradnja

`verification/school-environment.test.ts` provjerava tri ponavljanja svih osam kombinacija, alternativne algoritme, preuređene komponente, pogreške svakog komunikacijskog puta, adresu, popravak i promijenjeni redoslijed okoliša. Svaki funkcionalni kriterij ima vlastito pogrešno rješenje: 3/10 za pogrešnu osnovnu funkciju, 8/10 za pogrešan nastavak ili OLED te 0/10 za nevaljan spoj. Za S3 C++, Uno i Nano zasebno se prevode referentno, alternativno i oba pogrešna rješenja: ukupno 24 prijevoda.

`verification/school-environment-api.test.mjs` provjerava svih osam dodjela, stvarne bodove, odbijanje stranog ugovora, zaključavanje i očuvanje ranije zaključane predaje kroz pravi PHP/MySQL. Zaseban prihvat uključuje ranije obitelji, račune, razrede, spremanje, izvještaje, povrat kopije i 30 simuliranih učenika. Detaljni sintetski dokazi nastaju izvođenjem i čuvaju se u artefaktima prihvata; javni sažetak navodi stvarno potvrđeni opseg.

Ponovno otpuštanje već otpuštenog I2C slave izlaza više ne traži novo rješavanje iste električne mreže. Time se skraćuje izvođenje mješovite hardverske i softverske I2C sabirnice; stvarni bridovi i prijenosi ostaju opažani.


Konačni prihvat provjerava cijela brojčana polja: 24,0 unutar pogrešnog 124,0 ne vrijedi, kao ni dodatna završna znamenka, decimalna točka ili pogrešan predznak. Provjeravaju se sva tri fonta i stvarni pogrešni OLED prijenosi. Ispravna alternativna rješenja ostaju prihvaćena.

Neovisni prijevodi i konačni paket imaju zasebne otiske izvora. `native/` čuva sva četiri izvorna izvršna dokaza, a `boundary-validation.json` potvrđuje da prevoditelji, runtimeovi, driveri i rubrike nisu promijenjeni. Konačna izmjena provjeravača odnosi se samo na granice brojčanih polja; svih osam službenih dodjela ponovno je izvršeno kroz PHP/MySQL s isporučenim provjeravačem.

Privatni SQL red uklanja istekle poslove po primarnom ključu. Nakon deadlocka ograničeno ponavlja DB preuzimanje posla ili potpuno vraćenu transakciju potvrde rezultata. Opće transakcije i povrat datoteka ne ponavljaju se automatski. Kontrolirani SQL kvar potvrđuje da ne ostaju djelomični ili dvostruki upisi; trajna pogreška ne ponavlja se. Dva odvojena vala po 30 sintetičkih učenika potvrđuju 60 jedinstvenih predaja i rezultata uz dva provjeravača.

[Završni prihvat](https://github.com/zljix/labosv2/actions/runs/43949417346) i [sažetak s otiscima](stage24i-evidence/acceptance-summary.json) navode točan opseg. Školski paket zadržava iste programske bajtove kao potvrđeno izvršavanje.

Nema nove SQL migracije. Sačuvaj bazu, privatnu konfiguraciju i sesije; zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni Linux provjeravače. Novu rubriku izričito odaberi pri objavi novog zadatka. Stare dodjele, njihove upute i zaključane predaje ostaju sačuvane.

Izolacija i ograničenja ostaju 65 s zidnog i 58 s CPU vremena, 90 s prevođenja, 2048 MiB adresnog prostora i 1 MiB izlaza. Stari ili učenikov artefakt ne bira rezultat. Tehnički kvar ili nepodržana provjera ostaju bez bodova.

Slijedi **24J: ILI9341 i dodir**. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i ukupno memorijsko ograničenje ostaju zasebni završni uvjeti. Modelirani kut ne potvrđuje moment ili struju fizičkog motora.
