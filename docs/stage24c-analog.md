# Etapa 24C Analogni ulazi i ADC PWM

Izdanje 0.14.1-beta.1 dodaje osam rubrika `24C-…@1` s provjeravačem `24C.1`. Sedam novih analognih varijanti donosi 28 novih kombinacija. Nova rubrika za puni ADC/PWM zadatak dopunjuje četiri već podržana retka `gpio/adc`. Ukupno je podržano **52 od 268 kombinacija**, odnosno 13 varijanti na svakom od četiriju ciljeva. Uvodne V1–V5 zadržavaju lokalnu provjeru.

| Zadatak | Rubrika | Ponašanje koje se provjerava |
| --- | --- | --- |
| gpio/adc | 24C-adc-pwm@1 | Stvarni PWM prati ADC kroz raspon i povrat |
| analog/ntc | 24C-ntc@1 | Sirovi ADC i temperatura iz NTC djelila |
| analog/temt6000 | 24C-temt6000@1 | Sirovi ADC i napon, uključujući zasićenje |
| analog/ky023 | 24C-ky023@1 | Neovisne osi, normalizacija, mrtva zona i tipkalo |
| analog/flame | 24C-flame@1 | Analogni izlaz i digitalna histereza |
| analog/sound | 24C-sound@1 | Aktivno nizak digitalni izlaz i histereza |
| analog/analogCompare | 24C-analogCompare@1 | Neovisna temperatura LM35 i NTC |
| analog/dualInputs | 24C-dualInputs@1 | Dva neovisna ADC ulaza i dva tipkala |

## Upute i bodovi

Svaka rubrika prije početka prikazuje očekivano ponašanje, oznake ispisa, jedinice, raspone, rokove i tolerancije. Tri boda pripadaju valjanim napajanjima, masi i signalnim putovima, pet bodova trima osnovnim pobudama, a dva granicama raspona i povratu. Ispisi različitih vrijednosti moraju biti na istom retku prema objavljenim oznakama. Proizvoljan dodatni tekst i drukčiji nazivi varijabli ne mijenjaju rezultat.

Svaka pobuda traje 1000 ms. Novo točno očitanje ili PWM reakcija moraju se pojaviti unutar 400 ms uz 24 ms tolerancije. Očitanja se nastavljaju u istom roku kroz svaku pobudu. PWM ostaje unutar dopuštenog odstupanja 0,04 nakon roka. Digitalni prag iz ranije rubrike nije rješenje punog PWM zadatka.

Uno i Nano koriste 10-bitni ADC uz referencu 5 V, a oba S3 cilja 12-bitni profil 11 dB sa zasićenjem na 3,1 V. Za sirovi ispis na S3 koristi se 0–4095; `read_u16()` može se odgovarajuće preslikati. Tolerancija ADC-a je dva koraka na AVR-u i tri na S3. Temperatura dopušta ±0,6 °C, napon ±0,008 V, normalizacija joysticka ±0,025. Na točnoj granici mrtve zone 45/55 % prihvaća se nula ili pripadnih −0,10/+0,10 jer jedan korak kvantizacije može promijeniti stranu stroge granice.

TEMT6000 ispisuje ADC-om izmjereni napon s njegovim zasićenjem. Sintetska pobuda u luksima nije rezultat kalibriranog mjerenja. Zvuk nema analogni izlaz ni mjerenje dB. Plamen i zvuk provjeravaju granice `prag+2` i `prag−2`, a zatim sredinu iz obaju smjerova. LM35 zadržava napajanje 5 V na svim pločicama.

Redoslijed osnovnih pobuda, smjer prolaska kroz histerezu i redoslijed krajeva raspona ovise o pobudi posla. To sprječava da isti unaprijed vremenski raspoređen niz digitalnih ispisa potvrdi različite ulazne scenarije. Završna pobuda vraća prvu vrijednost.

Nakon dopuštenog roka svi potpuni retci mjerenja moraju odgovarati trenutačnom ulazu. Naizmjeničan ispis `DO=0` i `DO=1` ne potvrđuje mjerenje samo zato što jedan od redaka slučajno odgovara pobudi. Ostali dijagnostički retci bez oznaka mjerenja ostaju dopušteni.

## Neovisna provjera

Provjeravač izvodi spremljeni izvor u postojećoj Linux izolaciji, uz izvorom vezane artefakte. Nasumične pobude proizlaze iz privatne pobude posla. Mjere se mrežni naponi, napajanje uređaja, ulazni načini GPIO-a, svježi retci izlaza i stvarni radni omjer na putu prema LED-ici. PWM na nepovezanom priključku ne potvrđuje LED izlaz. Rezultat zadržava hash snimke i ugovora te vezu s poslom, pokušajem i revizijom.

`verification/school-analog.test.ts` obuhvaća svih 32 novih rubrika/ciljeva, tri ponovljena izvođenja, druga ispravna rješenja, promjenu GPIO-a, ekvivalentne rasporede, pogrešne izvore, loše spojeve, kasna očitanja i izmijenjene ugovore. Skupovi za nove C++ izvore uključuju izolirano prevođenje referentnog, alternativnog i pogrešnog izvora na S3, Unu i Nanu. Bez dostupnog prevoditelja ti skupovi ostaju izričito preskočeni; pouzdani postojeći katalog ne zamjenjuje njihov dokaz.

`verification/school-analog-api.test.mjs` provjerava stvarni PHP/MySQL: objavu svih osam rubrika, rad i bodove, odbijanje rezultata tuđeg ugovora, zaključavanje i očuvanje ranije digitalne rubrike. Sirovi rezultati spremaju se u `stage24c-evidence/`. GitHub integracija zasebno potvrđuje izvršene skupove za prevoditelje i bazu.

## Nadogradnja

Nema nove SQL migracije. Sačuvaj privatnu konfiguraciju, sesije i bazu, zamijeni programski paket, pokreni postojeću naredbu `migrate` i ponovno pokreni provjeravače iz novog paketa. Ranije objavljene rubrike, bodovi i zaključane predaje ostaju vezani uz iste uvjete. Nastavnik novu rubriku izričito odabire pri novoj objavi. Stari digitalni prag ostaje dostupan pod vlastitim identitetom.

## Sljedeći korak

Sljedeća razvojna etapa je **24D**: AM2320, DHT11/DHT22 i njihove pogreške, zatim tri DS18B20 varijante. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i skupna memorijska granica ostaju zasebni uvjeti prihvata. Ovo izdanje potvrđuje funkcionalni simulator i poslužiteljske provjere, bez tvrdnje o završenom školskom pilotu ili fizičkom ESP32 hardveru.
