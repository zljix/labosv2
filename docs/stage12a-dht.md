# Etapa 12A — DHT11/DHT22

Izdanje 0.5.1-beta.1, 12. studenoga 2026. Nastavlja etapu 11; format projekta ostaje 3, model sklopa 1. DHT modeli su eksperimentalni funkcionalni profili. Stabilna v1.0 i fizička potvrda opreme nisu proglašene.

## Odabrani profili

| Svojstvo | DHT11, stariji Aosong profil | DHT22 / AM2302 |
| --- | --- | --- |
| Napajanje prema odabranoj dokumentaciji | 3–5,5 V | 3,3–6 V |
| Okoliš modela | 0–50 °C, 20–90 %RH | −40–80 °C, 0–100 %RH |
| Kvantizacija | Cijeli °C i %RH | Desetinke; bit predznaka temperature |
| Start LOW | Najmanje 18 ms | Najmanje 1 ms |
| Stabilizacija modela nakon napajanja | 1 s | 2 s |
| Minimalni razmak početaka odgovora | 1 s | 2 s |

DHT11 ima više dokumentiranih izvedbi. Noviji Aosong priručnik navodi najmanje 3,5 V i više od 2 s; to se ne smije prešutno poistovjetiti sa starijim profilom. Odabir ovdje je izričit, a svojstva fizičkog školskog senzora ostaju nepotvrđena. Za oba modela postoje naponski izbori 3,3/5 V, bez proizvoljnog pretvornika razina: S3 primjeri napajaju senzor i pull-up s 3,3 V, Uno/Nano s 5 V.

Četiri priključka gledano sprijeda jesu VCC, DATA, NC, GND. NC je električki nepovezan; spajanje na njega ne zamjenjuje DATA ili GND. Za svaki senzor u primjeru je zaseban vanjski otpornik 4,7 kΩ DATA–VCC. Ovaj ograničeni profil prihvaća izričit otpornik od 1–10 kΩ; unutarnji pull-up sam nije dovoljan. To je pravilo modela, bez proračuna kapaciteta kabela i vremena porasta. DHT nije Dallas 1-Wire: svaki DHT ima zaseban DATA GPIO.

## Tok podataka i električni model

`public/dht-bus.mjs` promatra stvarnu mrežu i promjene smjera/razine GPIO-a. Valjan start stvara niz: 20 µs prije odgovora, 80 µs LOW i 80 µs HIGH, zatim 40 bitova MSB-first. Svaki bit počinje s 50 µs LOW; HIGH traje 27 µs za 0 ili 70 µs za 1. Slijedi završnih 50 µs LOW i otpuštanje DATA. Peti bajt je zbroj prethodnih četiriju modulo 256.

Senzor nikada aktivno ne pogoni HIGH. LOW je otporni ponor od 10 Ω prema GND u zajedničkom DC rješavaču. Vanjski otpornik daje HIGH. Prijenos se veže uz stvarne mreže, a ne nazive komponenti, nazive primjera ili analiziranje teksta programa. Okoliš se zahvaća pri početku odgovora: promjena klizača usred prijenosa ne prepravlja preostale bitove. Kratki start, prerano/prečesto očitanje, nevaljano napajanje/masa/pull-up ili dva DHT-a na DATA mreži ne daju valjan odgovor. Aktivni GPIO HIGH tijekom senzorskog LOW-a daje dijagnostiku sukoba.

Pokus `checksum` mijenja zadnji bit kontrolnog bajta prije izrade impulsa. Pokus `timeout` izostavlja odgovor. To su namjerno zadane pogreške, bez tvrdnje da su modelirani elektromagnetski šum ili fizikalni uzroci kvara.

Panel prikazuje poslane bajtove i broj započetih prijenosa. Time se ne dokazuje da ih je učenikov program prihvatio. Prihvaćanje i izračun temperature/vlage radi driver, a rezultat se vidi u konzoli. Poslani uzorak može imati namjerno nevaljan zbroj.

## Izvršne jezgre

MicroPython v1.29.0 WASM ponovno je izgrađen Emscriptenom 4.0.15. `machine.dht_readinto` u Python prilagodbi sastavlja start i dekodira 40 stvarno izmjerenih LOW/HIGH impulsa. Ne dobiva temperaturu, vlagu ni gotove bajtove od posebnog senzorskog API-ja. Neizmijenjeni `dht.py` iz micropython-lib provjerava checksum i pretvara sadržaj spremnika u vrijednosti.

Dodani su generički most za trajanja impulsa, `machine.time_pulse_us`, `disable_irq` i `enable_irq`. `time_pulse_us` razlikuje −2 (čeka početak) od −1 (čeka kraj); nevaljana električna razina daje pogrešku. Podržani izvor budućih bridova u ovoj etapi je DHT; to nije opća podrška za mjerenje svih PWM i drugih budućih protokola.

Kratki `sleep_us` sada napreduje virtualni sat bez milisekundnog zaokruživanja. U zaključanom odsječku vrijeme napreduje eksplicitnim čekanjem, prijelazom do sljedećeg brida te idealiziranim troškom 1 µs po čitanju pina ili vremenskog brojača. Time i petlja koja samo ispituje `ticks_us()` može završiti. Dulja čekanja i `sleep_ms`, uključujući nulu, i dalje omogućuju obradu poruka preko Asyncifyja. Ovo je funkcionalni virtualni sat, bez emulacije trajanja Xtensa instrukcija i stvarnih prekida. Promjena vremena provjerena je i regresijom ranijih I2C drivera/LCD-a.

AVR put koristi ATmega328P registre, stvarne instrukcije i 16 MHz cikluse. Sljedeći DATA brid zakazuje se kroz CPU događaj; mijenja napon mreže i ulazni PIN registar. Neizmijenjeni Adafruit DHT 1.4.6 `DHT.cpp`/`DHT.h` čita taj registar i broji petlje, provjerava checksum te računa temperaturu/vlagu. S3/MicroPython i AVR dijele uređaj i električni model.

Biblioteka DHT ima vlastitu 2 s predmemoriju za oba senzora. Poziv unutar tog vremena obično vraća stari rezultat bez novog prijenosa. `read(true)` / `readHumidity(true)` zaobilazi predmemoriju; prerani fizički pokus tada može završiti kao neuspješan. Pogreška daje `NaN`, a primjeri je jasno odvajaju od valjanog mjerenja. Pripremljeni su samo DHT.cpp/DHT.h; DHT_U i Unified Sensor API nisu uključeni.

## Primjeri i pohrana

Četiri primjera postoje za S3/MicroPython te Uno i Nano/Arduino: DHT11, DHT22 s negativnom temperaturom, namjerno prečesto čitanje i usporedba DHT11/DHT22 na zasebnim GPIO pinovima. Pojedinačni primjeri uvode pinout, pull-up, čekanje, kontrolni zbroj i obradu pogreške prije usporedbe. S3 koristi GPIO4/5, Uno/Nano D2/D3. NC je slobodan. Primjeri imaju početne i žive ulaze, crtanje senzora, svojstva i pomoć za spajanje.

Osam novih stvarnih Arduino prijevoda povećava katalog s 44 na 52 artefakta (26 po pločici). Stari zaključani paketi biblioteka i hashovi nisu mijenjani. Novi lokalni compiler paket uključuje DHT, izvor i licenciju; izvoz i offline paket nose odgovarajuće vidljive izvore i provjerene artefakte. Novo prevođenje vlastitog Arduino izvora i dalje koristi lokalni most, bez novog cloud ili offline compilera.

## Provjera

Jedinstvena matrica sadrži 205 prethodnih i 25 novih provjera. Prvi regresijski prolaz otkrio je zastarjeli očekivani status DHT-a u testu kataloga i osjetljivost starog testa na redoslijed biblioteka. Status je ažuriran na eksperimentalno, a DHT je dodan na kraj kataloga kako bi se očuvao raniji redoslijed. Jedna compiler provjera iz početnog prolaza bez varijabli okruženja naknadno je stvarno izvedena s postojećim zaključanim alatima. Ne računaju se ponavljanja kao nove provjere; konačni zapis nema neizvedenih compiler slučajeva.

Provjere obuhvaćaju poznate bajtove i vremena, napone, neovisne senzore, latching, startup/throttle, pogrešne pinove/pull-up/napajanje, unmodified drivere u objema jezgrama, oba AVR cilja, predmemoriju nasuprot forsiranju, negativne i žive ulaze, ZIP/JSON, integritet artefakta, produkcijski Worker te Stop/Reset. Završni rezultati i ograničenja nalaze se u `docs/stage12a-evidence/` i pripadnom izvješću.

Ponovljene čiste izgradnje WASM-a dale su identične izlazne bajtove u istom Linux okruženju. To nije neovisna provjera na drugom računalu. Preglednički pokus je Chromium/Linux na razvojnoj adresi. Safari/iOS, Android, školsko računalo, hladno offline otvaranje privatne produkcijske domene i fizički senzori ostaju bez nove potvrde. Model ne simulira toleranciju senzora, šum, kondenzaciju, tromost niti RC vrijeme porasta.

## Završna dorada rasporeda

Rastući katalog primjera više ne određuje visinu cijelog radnog područja. Na desktopu su redovi ograničeni, bočni popis i laboratorij imaju vlastito pomicanje, a kod i konzola ostaju blizu. U opaženom Chromium prikazu 1363×936 dokument je visok 956 px, umjesto više tisuća piksela; konzola počinje na približno 731 px. Postojeće mobilne kartice ostaju; mobilni uređaj nije testiran. Nakon CSS izmjene ponovljene su izgradnja i offline provjere.

## Izvori

- Aosong, stariji DHT11 profil: https://cdn-shop.adafruit.com/datasheets/DHT11-chinese.pdf
- Aosong, druga dokumentirana izvedba DHT11: https://media.digikey.com/pdf/Data%20Sheets/Adafruit%20PDFs/DHT11_ProdManual.pdf
- Aosong DHT22/AM2302, primarna preslika podatkovnog lista: https://datacapturecontrol.com/docs/datasheets/dht22-am2302-datasheet.pdf
- DHT22/AM2302 priručnik: https://cdn-shop.adafruit.com/datasheets/Digital%20humidity%20and%20temperature%20sensor%20AM2302.pdf
- MicroPython dht.py: https://github.com/micropython/micropython-lib/blob/a08087249fda8a7994f7c54ccaad29fb9fcc448a/micropython/drivers/sensor/dht/dht.py
- Adafruit DHT 1.4.6: https://github.com/adafruit/DHT-sensor-library/tree/1.4.6
- MicroPython API za impulse: https://micropython.org/resources/docs/en/latest/library/machine.html

Sljedeća ovisna etapa je 12B — DS18B20 / Dallas 1-Wire: reset/presence, ROM identiteti, pretvorba, scratchpad i CRC, više senzora uz izričit vanjski pull-up.
