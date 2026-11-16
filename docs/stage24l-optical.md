# Etapa 24L · MAX30102 i sintetski optički signal

Izdanje **0.14.10-beta.1**, provjeravač `24L.1`, dodaje četiri rubrike i 16 kombinacija: **248 od 268**, odnosno 62 URS varijante na četiri cilja. Preostalih 20 kombinacija (radio i dvije obitelji pretvornika naponskih razina) još nema službene bodove. Svih 65 prethodnih rubrika čuva identičan sadržaj i identitet; V1–V5 ostaju zasebne lokalne provjere.

Signal je sintetski i služi nastavi registara, FIFO-a i obrade periodičkog signala. Nema medicinskog mjerenja ni izračuna SpO2. Novi bodovi nastaju neovisnim izvođenjem spremljenog programa i sklopa, iz stvarnih I2C prijenosa i šestobajtnih RED/IR očitanja.

## Uvjeti i kriteriji

Svaka rubrika ima 10 bodova: 3 za napajani I2C put, pročitani identitet i konfiguraciju; 5 za osnovnu funkciju; 2 za nastavak. Nastavnik izričito bira novu rubriku pri novoj objavi zadatka. Učenik unaprijed vidi ove uvjete i kriterije. Stari zadaci, rezultati i zaključane predaje ostaju vezani uz svoje ugovore.

| Rubrika | Osnovna funkcija · 5 | Nastavak · 2 |
| --- | --- | --- |
| `24L-opticalRegisters@1` | Pročitani identitet, reset i stvarna RED+IR konfiguracija s točnim ispisom | Shutdown najmanje 450 ms, bez novih uzoraka i s potvrđenim praznim FIFO-om |
| `24L-opticalRaw@1` | Novi šestobajtni uzorci, točni RED/IR brojevi i brojač u prvoj etapi | Nastavak novih očitanja pri gubitku i povratku sintetskog kontakta |
| `24L-opticalFrequency@1` | Vlastita točna procjena prve frekvencije iz novih FIFO uzoraka | Točne procjene nakon dviju neovisnih promjena frekvencije |
| `24L-opticalOverflow@1` | Stvarno pun FIFO, jednaki pokazivači i točan pozitivan broj gubitaka | Najmanje tri pražnjenja 32 cijela uzorka, čišćenje i novi ciklus |

## Izvršavanje i dokazi

MAX30102 koristi I2C adresu 0x57, polling i ograničeni četveroizvodni Lab carrier. S3 koristi 3V3 i GPIO8/9, Uno/Nano 5 V carrier s prilagodbom te A4/A5. Dopušteni su drugi algoritmi, nazivi, valjani S3 GPIO i električno ekvivalentan raspored. FIFO ima 32 mjesta; jedan dovršeni RED+IR uzorak ima šest bajtova. ADC brojevi nemaju kalibriranu optičku jedinicu.

Provjeravač u privatnoj izvršnoj kopiji odabire nove frekvencije iz tri objavljena raspona. Promjene kontakta i izvora utječu na buduće uzorke; već spremljeni FIFO ostaje nepromijenjen. Učenička snimka se ne prepisuje. Brojači, registri, dovršeni uzorci i prihvaćeni zapisi čine dokaz; konzolni tekst ili učenički JSON sami ne mogu stvoriti bodove. C++ se prevodi izolirano ili mora točno odgovarati pouzdanom katalogu.

Ograničeni dnevnik čuva najviše 64 značajna dovršena prijenosa i 192 bajta po prijenosu. Rutinska prazna statusna/pokazivačka čitanja izostavljaju se kako 32 očitanja ne bi istisnula dokaz punog FIFO-a. Neuspjeli prijenosi ne ulaze u dnevnik. Povijest očitanja i dalje čuva posljednjih 128 cijelih uzoraka, a provjeravač skuplja dokaze tijekom cijelog scenarija. Softverski reset ne briše dokaz prethodnih prijenosa. Svježina novog FIFO ciklusa počinje stvarnim čišćenjem, ne završetkom serijskog ispisa; tolerancija opažanja iznosi 25 ms.

## Pojedinačne specifikacije

### MAX30102: registri, identitet i shutdown

U najviše 2000 ms stvarno pročitaj PART_ID=0x15, resetiraj uređaj, postavi RED+IR (mode=3), 100 sirovih uzoraka/s, average=1, 18 bita, LED_PA=31 na oba kanala. Pročitaj mode i ADC konfiguraciju te ispiši MAX ID=0x15 i MAX MODE=3 CONFIG=0x27. Zatim uključi shutdown, isprazni FIFO, čekaj najmanje 500 ms i iz novog čitanja ispiši MAX SHUTDOWN FIFO=0. Dok čekaš, novi uzorci ne smiju nastajati. Jednokratni program smije završiti.

### MAX30102: dovršeni RED/IR uzorci i promjena kontakta

Tri etape po 2200 ms mijenjaju sintetski signal: kontakt uključen, isključen i ponovno uključen. Postavi RED+IR, 100 uzoraka/s, average=1, 18 bita i LED_PA=31. Svaki uzorak pročitaj u jednom dovršenom prijenosu šest bajtova. Od prvog pročitanog uzorka broji n=1,2,..., bez ponovnog brojanja starih FIFO podataka. Za svaki deseti ispiši RAW N=n RED=r IR=i s točnim pročitanim cijelim brojevima. U svakoj etapi treba najmanje 6 točnih izvještaja i 100 dovršenih uzoraka; razmak izvještaja najviše 350 ms, ispis najviše 150 ms nakon čitanja. Nakon početnih 200 ms mora postojati kontinuirani niz izvještaja. Model bez kontakta daje RED=425 i IR=500; stari FIFO ostaje do čitanja. Prvi interval nosi osnovni kriterij, druga dva nastavak.

### MAX30102: frekvencija iz stvarno pročitanih uzoraka

Tri etape po 10000 ms zadaju poslužiteljski odabrane cijele frekvencije iz raspona 52–78, 114–144 i 84–102 u minuti; amplituda je 5100 ili 7300, IR sredina 67000–94400, šum 0. To je sintetski signal. Postavi RED+IR, 100 uzoraka/s, average=1, 18 bita i LED_PA=31. Program sam računa frekvenciju iz novih šestobajtnih uzoraka, primjerice uklanjanjem sredine i histerezom. Ispisuj FREQ=f bpm (sintetski). Prvih 4000 ms svake etape služi stabilizaciji. Zatim najmanje 3 procjene moraju biti unutar većeg od 5/min ili 7 % zadane frekvencije, uz najmanje 500 novih uzoraka po etapi i bez gubitaka FIFO-a. Procjena mora imati novo čitanje u prethodnih 150 ms. Prva etapa nosi osnovni kriterij; sljedeće dvije potvrđuju promjenu signala. Nema gotovog BPM registra ni medicinskog rezultata.

### MAX30102: pun FIFO, gubitak i stvarni oporavak

Pokus traje 3200 ms. Postavi RED+IR, 100 uzoraka/s, average=1, 18 bita, LED_PA=31, bez rollovera. Ponavljaj čekanje 700 ms bez čitanja; stvarno pročitaj pokazivače i overflow te ispiši FIFO COUNT=n OVF=k. Puni FIFO ima 32 uzorka, jednaka WR/RD pokazivača i pozitivan overflow (najviše 31). Najmanje dva točna izvještaja potvrđuju osnovni kriterij. Za nastavak najmanje tri puta dovršeno pročitaj sva 32 RED+IR uzorka, očisti WR/OVF/RD jednim upisom tri nule od registra 0x04 i ispiši FIFO RECOVERED. Sljedeći ciklus mora sadržavati novonastale uzorke; ponovno čitanje stare banke nije oporavak. Tolerancija vremena opažanja je 25 ms.

## Provjere, nadogradnja i ograničenja

`verification/school-optical.test.ts` provjerava tri neovisna ponavljanja svih 16 kombinacija, otvorene SDA i SCL putove, popravak, drugo sjeme izvora i očuvanje snimke. Alternativna rješenja mijenjaju algoritam, nazive i raspored te S3 GPIO. Namjerno pogrešno osnovno i napredno rješenje zasebno dobivaju 3/10 i 8/10. Na svakom od tri C++ cilja zasebno se prevode referenca, alternativa i oba pogrešna rješenja za sve četiri rubrike: ukupno 48 neovisnih prijevoda. Posebno se odbijaju izvršni lažni izvještaji, nepotpuni FIFO uzorci, promijenjeni ugovori i stare binarne datoteke.

`verification/school-optical-api.test.mjs` objavljuje svih 16 kombinacija preko pravog PHP/MySQL API-ja, pohranjuje autentične bodove, odbija rezultat drugog ugovora, zaključava rad i čuva ranije zaključanu predaju. Potpuni prihvat uključuje ranije senzorske, zaslonske, RTC/SD i druge obitelji, račune, razrede, spremanje, zaključavanje, izvještaje, korekcije, sigurnosnu kopiju/povrat i sintetski razred od 30 učenika. Izvedeni dokazi i njihov otisak nalaze se u `stage24l-evidence/` i u prihvaćenom školskom paketu.

Nema nove SQL migracije. Prije nadogradnje sačuvaj bazu i privatnu konfiguraciju, zamijeni kompletan paket, zadrži ključ i sesije, pokreni postojeći `migrate` i ponovno pokreni Linux provjeravače. Ranije dodjele i zaključane predaje zadržavaju prvotne uvjete i bodove.

Ostaju granice 65 s zidnog i 58 s CPU vremena, 90 s prevođenja, 2048 MiB adresnog prostora i 1 MiB izlaza. GitHub Pages služi simulator i prikaz podrške; školska prijava i službeno bodovanje traže PHP/MySQL i privatni Linux provjeravač. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i skupno cgroup ograničenje memorije ostaju zasebni završni uvjeti.

Sljedeća predviđena etapa 24M obuhvaća radio TX/RX par. Zatim ostaju digitalni i I2C pretvornici naponskih razina.

## Izvedeni prihvat

[Završni prihvat i instalacijski paket](https://github.com/zljix/labosv2/actions/runs/43981733195) potvrđuju 162 ciljane izvedbe, 48 neovisnih C++ prijevoda i 16 zaključanih dodjela. Svih 911 inventurnih datoteka isporučenog ZIP-a provjereno je po duljini i SHA-256 otisku. Usporedba root web manifesta i provjeravača potvrđuje iste isporučene bajtove.

Nativno izvršavanje i potpuni funkcionalni koraci izvedeni su na izvoru `29f3e134927a606146bedf981f279a83c4bccaf2`. Završni prihvat na `3872d0ece3562aebd736e6f2c761a266a47d5fdb` ispravlja samo mapu API dokaza, izričito potvrđuje neizmijenjeni aplikacijski izvor, ponovno izvršava svih 16 optičkih dodjela i povezuje ih s istim otiskom provjeravača. [Sažetak](stage24l-evidence/acceptance-summary.json) i [potvrda funkcionalnih koraka](stage24l-evidence/regression-receipt.json) čuvaju oba izvora i izvorne poveznice.

Dodatno je osam stvarnih pokusa frekvencije i FIFO-a prošlo iz sadržajno adresiranih web Workera na sva četiri cilja. Nije riječ o potvrdi fizičkih senzora ili ciljnog mobilnog preglednika.
