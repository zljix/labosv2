# Etapa 24D · senzori, valjanost i svježina očitanja

Izdanje **0.14.2-beta.1** dodaje sedam rubrika `24D-…@1`, provjeravač `24D.1` i **28 novih kombinacija**. Ukupno je podržano **80 od 268 kombinacija**, odnosno 20 varijanti na svakom od četiriju ciljeva: MicroPython S3, S3 Arduino C++, Uno i Nano. Uvodne V1–V5 ostaju lokalne provjere.

| Zadatak | Što se provjerava |
| --- | --- |
| weather/am2320 | Cijeli I2C odgovor, temperatura i vlaga te dopušteno kašnjenje prethodnog uzorka |
| dht/dht11 | Stvarni DATA prijenos, kontrolni zbroj i cjelobrojni profil |
| dht/dht22 | Desetinke, predznak, vlaga i novo očitanje nakon promjene |
| dht/dhtErrors | Nevaljan kontrolni zbroj, timeout i oporavak bez lažnog brojčanog podatka |
| onewire/ds18Multi | Tri ROM identiteta, odvojeni okoliši i promjena samo jednog senzora |
| onewire/ds18Resolution | Stvarna konfiguracija 9/10/11/12 bita, kvantizacija i dovršena pretvorba |
| onewire/ds18Errors | CRC pogreška, nedostajući presence, stari registar i oporavak |

## Upute i raspodjela bodova

Prije početka učenik dobiva zamrznute upute, jedinice, oznake ispisa, rokove i tolerancije. Tri boda pripadaju valjanom spoju i stvarnom senzorskom prijenosu, pet bodova trima osnovnim pobudama, a dva granicama i povratu ili prepoznavanju pogrešaka i oporavku. Prethodne rubrike i zaključane predaje ne mijenjaju se.

Za temperaturu i vlagu koristi se `T=<broj> RH=<broj>`. Tri DS18B20 moraju uz temperaturu dati `ROM=<16 heksadekadskih znakova>`. Redoslijed ROM pretrage nije identitet senzora. Kod promjene razlučivosti `BITA=<broj>` može biti na istom ili prethodnom retku. Dodatni dijagnostički tekst i nazivi varijabli slobodni su.

| Profil | Prvi novi podatak nakon promjene | Daljnji razmak | Tolerancija ispisa |
| --- | --- | --- | --- |
| AM2320 | 4600 ms | 2300 ms | ±0,15 °C / ±0,15 %RH |
| DHT11 / DHT22 | 2400 ms | 2300 ms | ±0,15 prema prenesenom podatku |
| DS18B20, više senzora / pogreške | 3200 ms | 3000 ms | ±0,065 °C prema registru |
| DS18B20, razlučivost | 4500 ms | 4500 ms | ±0,065 °C prema registru i stvarnom broju bitova |

Tolerancija koraka izvršavanja je 100 ms. DHT11 se uspoređuje sa zaokruženim cjelobrojnim podatkom. DS18B20 se uspoređuje s kvantiziranim registrom, a ne s izmišljenom fizičkom preciznošću. AM2320 smije vratiti prethodni uzorak tijekom početnog roka; nakon toga se traži novi podatak i potpuni I2C prijenos.

Početni MicroPython pokus `dhtErrors` namjerno pokušava svakih 300 ms. Učenik za pouzdano bodovano rješenje mijenja razmak na 2100 ms, uz zadržano hvatanje pogrešaka. Početni primjer i ostali nastavni materijali ostaju sačuvani. Dug niz prečestih pokušaja i uhvaćenih iznimki u postojećem WASM interpreteru može dosegnuti njegovu dubinu poziva; takav prekinuti oporavak ne dobiva puna dva boda. Provjerena rješenja poštuju interval senzora.

U fazi pogreške program mora izričito označiti nevaljan podatak. Brojčani `T=0`, stari podatak ili izmjenični lažni ispisi ne zamjenjuju pogrešku. Nakon vraćanja urednog prijenosa mora se pojaviti novo mjerenje. Početnih 85 °C i očitanje tijekom pretvorbe smiju se prikazati kao `POCETNI REGISTAR`, `STARI REGISTAR` ili `PRIJE DOVRSETKA`; ti retci nisu dokaz novog mjerenja. Stvarno izmjerenih 85 °C nakon dovršene pretvorbe ostaje valjan podatak.

## Neovisno izvršavanje

Privatna pobuda posla određuje okoliše. Provjeravač izvodi spremljeni izvor u Linux izolaciji i ne prihvaća učenikov rezultat ni binarni artefakt kao dokaz. Za 1-Wire promatra se dovršeno čitanje svih 72 bita scratchpada, CRC, broj uzorka, vrijeme dovršetka pretvorbe i stvarna konfiguracija. Samo pokretanje pretvorbe ili čitanje početnog registra ne potvrđuje svježinu. DHT zahtijeva stvarni 40-bitni prijenos i odgovarajući novi ispis. AM2320 koristi postojeći zapis dovršenih I2C očitanja.

Pulsni protokoli napreduju u mikrosekundama i između poziva `sleep_ms`. Novi scenariji i oznake vremena uzimaju to napredovanje u obzir. Povijesni scenariji ranijih rubrika zadržavaju svoj izvršni put. Senzorsko promatranje uzorkuje najviše svakih 20 ms, unutar objavljene tolerancije, a protokol se i dalje izvršava punom razlučivošću.

AVR vanjske ulaze uzorkuje zajedno u istom ciklusu, uz jednu provjeru električkog stanja. U pasivnom sklopu koji sadrži samo DS18B20 i otpornike nepromijenjeno stanje napajanja ne rješava se ponovno za svaki DQ impuls. Promjena napojnog GPIO-a poništava tu pohranu, a složeniji sklopovi koriste opći postupak. Time se zadržavaju stvarni impulsi i granice napajanja uz kraće izvođenje.

Najdulje izvođenje novih senzorskih poslova ograničeno je na 65 s zidnog i 58 s CPU vremena. Prevođenje zadržava granicu 90 s, pa oba dijela stanu unutar postojeće 180-sekundne isporuke. Dulji virtualni scenariji i AVR simulacija mogu trajati dulje od razvojnog cilja 15 s; to nije proglašeno završenim školskim mjerenjem opterećenja. Memorijska i izlazna ograničenja te mrežna izolacija ostaju uključeni.

`verification/school-sensors.test.ts` provjerava sva 28 para rubrika/cilj, ponovljiva izvođenja, alternativne izvore i rasporede, druge pobude, promjene GPIO-a, loše spojeve, pogrešne ispise, parcijalne bodove, lažne ugovore, prekratko čekanje i lažne oznake razlučivosti. Izolirano prevođenje novih C++ izvora provjerava se zasebno za S3, Uno i Nano. Bez dostupnih alata ti su testovi označeni kao preskočeni i ne smatraju se dokazom prevođenja.

`verification/school-sensors-api.test.mjs` koristi stvarni PHP/MySQL: objava svih sedam rubrika, učenička dorada revizije, dodjela stvarnih bodova, odbijanje stranog ugovora, zaključavanje i očuvanje ranije predaje. CI pokreće i sve postojeće školske integracijske skupove. Dokazi su u `stage24d-evidence/` i GitHub Actions zapisu odgovarajuće izvorne snimke.

## Nadogradnja

Nema nove SQL migracije. Sačuvaj privatnu konfiguraciju, sesije i bazu, zamijeni programski paket, pokreni postojeći `migrate` i ponovno pokreni provjeravače. Nastavnik novu rubriku izričito odabire pri novoj objavi. Stare rubrike, bodovi i zaključane predaje ostaju vezani uz prethodno objavljene uvjete.

Sljedeća razvojna etapa je **24E** prema postojećem planu. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i skupno memorijsko ograničenje ostaju zasebni uvjeti prihvata. Ova etapa potvrđuje funkcionalni simulator i školske provjere; fizička oprema nije dio tog dokaza.
