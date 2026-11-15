# Etapa 12B — DS18B20 / Dallas 1-Wire

Izdanje 0.5.2-beta.1. Nastavlja 12A u istom privatnom laboratoriju; format projekta ostaje 3, model sklopa 1. Ovo je eksperimentalni funkcionalni profil, bez nove tvrdnje o stabilnoj v1.0, fizičkoj opremi ili školskom pilotu.

## Spoj i opseg

DS18B20 TO-92, ravna prednja strana i izvodi prema dolje: **1 GND, 2 DQ, 3 VDD**. Profil koristi vanjski VDD 3–5,5 V. Primjeri daju 3,3 V i GPIO4 na ESP32-S3 te 5 V i D2 na Uno/Nano. Jedan izričit vanjski otpornik 4,7 kΩ DQ–VDD dovoljan je za tri pripremljena senzora na zajedničkoj mreži; funkcionalni profil prihvaća 1–10 kΩ. To nije RC proračun stvarne sabirnice. Unutarnji pull-up sam ne omogućuje ovaj profil. Parazitsko napajanje i strong pull-up nisu implementirani.

Svaki senzor ima pohranjen ROM od 8 bajtova: obitelj 0x28, šest serijskih bajtova i Dallas CRC-8. Novi identitet nastaje deterministički iz ID-a komponente, a ZIP/JSON, povijest i kopije zadržavaju ga. To je simulacijski identitet, bez tvrdnje da pripada stvarnom čipu. Uvoz traži valjan ROM i CRC; dvostruki ROM na istoj mreži blokira pokretanje. Različiti ROM-ovi smiju dijeliti DQ. DHT nema takvo adresiranje i ne smije dijeliti istu mrežu s ovim protokolom.

## Uređaj i podaci

`public/onewire-bus.mjs` obrađuje stvarne promjene GPIO smjera i razine na sastavljenim mrežama. Reset/presence i read/write slotovi prenose bitove **LSB-first**. Pri čitanju nule senzor povlači mrežu na LOW preko ponora 10 Ω; HIGH daje vanjski otpornik. GPIO koji u tom trenutku aktivno pogoni HIGH daje sukob. Strujni izvor ni rezultat mjerenja ne dodjeljuju se konzoli ili varijabli programa preko posebnog senzorskog API-ja.

Podržane naredbe:

| Naredba | Hex | Opseg modela |
| --- | --- | --- |
| Read ROM | 33 | ROM; na više odabranih uređaja wired AND |
| Match ROM | 55 | Odabir osam primljenih ROM bajtova |
| Skip ROM | CC | Svi prisutni uređaji |
| Search ROM / Alarm Search | F0 / EC | Bit, komplement i izbor grane; stvarni algoritam upravljačkog programa |
| Convert T | 44 | Okoliš se zahvaća na početku, završetak po razlučivosti, busy bit |
| Read Scratchpad | BE | Devet bajtova, zadnji je CRC-8 |
| Write Scratchpad | 4E | TH, TL i konfiguracija razlučivosti |
| Copy / Recall Scratchpad | 48 / B8 | Konfiguracija unutar sesije; Copy čeka 10 ms, Recall je funkcionalno trenutačan |
| Read Power Supply | B4 | Vanjsko napajanje daje 1 |

Reset ne prekida već pokrenutu pretvorbu na napajanom senzoru. Gubitak VDD prekida pretvorbu i nedovršeno kopiranje. Završeni Copy čuva tri EEPROM bajta kroz virtualno isključivanje/uključivanje unutar iste sesije; novo pokretanje simulacije vraća početni model. EEPROM nije dodatna trajna datoteka projekta. Nema modela trošenja memorije.

Početni temperaturni registar je `50 05`, odnosno +85 °C; nije zamijenjen klizačem okoliša. Pri 12 bita završeni rezultat ima korak 0,0625 °C, uz signed 16-bitni zapis. Podržani raspon okoliša je −55–125 °C. Ni korak ni broj decimala nisu tvrdnja o točnosti fizičkog senzora.

| Bita | Korak | Rok pretvorbe |
| ---: | ---: | ---: |
| 9 | 0,5 °C | 93,75 ms |
| 10 | 0,25 °C | 187,5 ms |
| 11 | 0,125 °C | 375 ms |
| 12 | 0,0625 °C | 750 ms |

Prije roka ostaje prethodni registar. Promjena okoliša tijekom pretvorbe vrijedi za sljedeću pretvorbu. Čitanje scratchpada zahvaća bajtove prijenosa, a CRC pokus mijenja njegov zadnji bajt prije slanja bitova. Pokus odspojenog DQ-a uklanja odgovor, ali ne glumi isključenje VDD. Panel prikazuje registar modela, ne potvrdu prihvaćanja u programu. CRC provjerava prijenos, a ne svježinu uzorka.

Alarm usporedba koristi cjelobrojne bitove dovršene temperature i signed TH/TL; Alarm Search uključuje samo uređaje s postavljenim alarmom. Nisu dodane zasebne nastavne vježbe niti promijenjena numeracija postojećih pet vježbi.

## Izvršavanje i dvije opažene granice

MicroPython koristi neizmijenjene `onewire.py` i `ds18x20.py` iz zaključanog micropython-lib commita. Vidljivi `_onewire.py` transport stvara standardne slotove pozivima `Pin.OPEN_DRAIN`, čekanjem i čitanjem zajedničke mreže. ROM pretraga, CRC i račun temperature ostaju u stvarno izvršenom Python kodu. Interpreter WASM i njegov loader nisu ponovno izgrađeni niti mijenjani; prethodna mikrosekundna infrastruktura već je dovoljna.

AVR koristi stvarne ATmega328P instrukcije i neizmijenjene OneWire 2.3.8 / DallasTemperature 4.0.6. Mikrosekundni sat sada prima `cycles/16` izravno, umjesto dvostruke pretvorbe ciklusi→ms→µs. Prethodni put povremeno je stavljao CPU točno na zakazani brid, ali decimalno nekoliko najmanjih znamenaka prije njega; rješavač bi zadržao pogrešnu razinu do sljedećeg brida. Referentni program koji čita sva tri senzora provjerava tu ispravku.

Master prema specifikaciji zadaje reset LOW najmanje 480 µs. Zaključani AVR core/OneWire slijed na registarskoj granici može dati 479,25 µs. Funkcionalni prijamnik prihvaća 1 µs tolerancije, odnosno prepoznaje reset od 479 µs. Kraći obični slotovi nisu reset. Ovo je deklarirana politika simulatora, bez tvrdnje o fizičkom pragu svakog DS18B20.

DallasTemperature 4.0.6 softverski odbacuje −55 °C te zapis +85 °C s bajtom 6 jednakim 0x0C. `getTempC()` ih svodi na oznaku −127, iako scratchpad CRC može biti valjan. Pripremljeni program izričito obrađuje te dvije vrijednosti: ponovno čita scratchpad, provjerava CRC-8 pa računa signed riječ / 16. Taj ispis označuje kao **sirovi registar; provjeri čekanje**. Ne prihvaća svaki −127 kao temperaturu niti zaobilazi CRC. Primjer pogrešaka čitanje prije završetka označuje kao stari registar. Uobičajeni programi i dalje moraju dovršiti pretvorbu; ni fallback ne dokazuje svježinu.

## Primjeri, prevoditelj i provjera

Četiri primjera po izvršnoj kombinaciji: jedan senzor; tri senzora na DQ; 9–12 bita; početnih 85 °C, prerano čitanje i pogreške. Početni okoliši triju senzora jesu 25, −10,125 i 60 °C. Pretraga ne obećava redoslijed; ispisuje se ROM uz svaki rezultat.

Osam novih prijevoda proširuje katalog na 60 artefakata, 30 po pločici. Stari izvori i hashovi biblioteka ostaju nepromijenjeni. Novi lokalni compiler paket uključuje zaključane izvore, hashove i licencijske obavijesti za obje biblioteke. DallasTemperature u odabiru traži i OneWire. Novo prevođenje vlastitog izvora i dalje koristi postojeći lokalni most.

Automatska provjera i sažetak rezultata pohranjuju se u `docs/stage12b-evidence/`. Namjenske provjere pokrivaju poznate CRC/temperaturne riječi, ROM, elektriku, pretvorbe, latch, razlučivost, više senzora, Alarm Search, EEPROM, gubitak napajanja, upstream MicroPython, stvarni Uno/Nano, produkcijski Worker i Stop/Reset. Prethodne skupine provjeravaju se zasebno; ponavljanja nisu novi testovi.

Preglednički pregled odnosi se na razvojni Chromium/Linux. Safari/iOS, Android, školsko računalo, privatna produkcijska domena pri hladnom offline otvaranju, fizički senzori i učenici nisu time potvrđeni. Model ne računa RC porast, toleranciju, šum, toplinsku tromost ni kondenzaciju.

## Izvori

- [Analog Devices/Maxim DS18B20, rev. 6](https://www.analog.com/media/en/technical-documentation/data-sheets/DS18B20.pdf)
- [MicroPython onewire.py, zaključani commit](https://github.com/micropython/micropython-lib/blob/a08087249fda8a7994f7c54ccaad29fb9fcc448a/micropython/drivers/bus/onewire/onewire.py)
- [MicroPython ds18x20.py, zaključani commit](https://github.com/micropython/micropython-lib/blob/a08087249fda8a7994f7c54ccaad29fb9fcc448a/micropython/drivers/sensor/ds18x20/ds18x20.py)
- [OneWire 2.3.8](https://github.com/PaulStoffregen/OneWire/tree/v2.3.8)
- [DallasTemperature 4.0.6](https://github.com/milesburton/Arduino-Temperature-Control-Library/tree/v4.0.6)

Dokumentacija podupire protokol i odabrane upravljačke programe; pravila funkcionalnog modela, pojednostavljenja i opažene provjere pripadaju ovom projektu. Sljedeća je etapa 13A — KY-040 enkoder.
