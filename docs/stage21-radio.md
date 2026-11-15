# Etapa 21 — NRF24L01+ i dva programska čvora

Izdanje **0.11.0-beta.1**, 14. studenoga 2026. Razvojna funkcionalna beta.

## Ishod i ulaz u pokus

Gumb **Dva čvora** otvara radijsku mrežu unutar postojećeg laboratorija. **Novi par čvorova** stvara zaseban spremljeni projekt s odašiljačem A i prijamnikom B. Prethodni projekt ostaje u popisu Projekti. Svaki čvor ima vlastitu pločicu, jezik, tekstualne izvore, sklop, izvođeni program, GPIO stanje, FIFO i konzolu. Oba pripadaju jednoj simulacijskoj sesiji i dijele jedan događajni sat.

Četiri odredišta mogu biti obje uloge: ESP32-S3 MicroPython, S3 funkcionalni Arduino C++ WASM, Uno R3 te Nano classic AVR. Primjeri šalju deset numeriranih paketa od osam bajtova. Šest novih unaprijed prevedenih C++ TX/RX programa čuva se u `public/radio-examples.json`. Raniji katalozi AVR/S3 nisu ponovno prepisani.

## Pojmovi prije praktične primjene

- **SPI** je žična veza programa s radijem na njegovoj pločici. MOSI nosi naredbe i podatke prema radiju, MISO vraća registre i primljene podatke, SCK taktira prijenos, CS odabire uređaj.
- **CE** zasebno upravlja prijamom i pokretanjem slanja radija. Nije CS.
- **Paket** je uređeni niz bajtova. Njegovi kanal, odredišna adresa, brzina, CRC profil i statička duljina trebaju odgovarati na prijamniku.
- **FIFO** je spremnik u kojem prvi spremljeni paket izlazi prvi. Radio ima po tri mjesta za TX i RX.
- **ACK** potvrđuje primitak u radiju. Sam ACK ne dokazuje da je prijamni program već pročitao ili obradio podatak.
- **Retry** je ponavljanje istog paketa nakon izostanka ACK-a. **MAX_RT** označava iscrpljene pokušaje. Radio zadržava neuspjeli TX payload dok ga program ne isprazni.

## Električni Lab profil

| Radijski izvod | S3 | Uno / Nano |
| --- | --- | --- |
| VCC | 3V3 carrier | izričiti 5 V carrier |
| GND | GND | GND |
| SCK | GPIO12 | D13 |
| MOSI | GPIO11 | D11 |
| MISO | GPIO13 | D12 |
| CS | GPIO10 | D10 |
| CE | GPIO4 | D7 |

Ovo je točno imenovani **Lab carrier**, s regulatorom i obostranom prilagodbom logike u 5 V izvedbi. Nije tvrdnja da generički NRF24 adapter ili goli čip podnosi 5 V na napajanju. Prije fizičkog izvoza treba utvrditi točnu plus izvedbu i adapter. Nema fizičkog IRQ izvoda; driver provjerava STATUS pollingom.

Napajanje, zajednička masa, CS, CE, mreže SCK/MOSI/MISO, digitalni smjerovi, SPI mode 0, MSB prvi i granica 10 MHz djeluju na prijenos. Odspojeni MISO daje 0xFF. Nevaljani izvodi, zamijenjene linije i neusklađene naponske domene ne daju izmišljeno uspješno očitanje. Sučelje sklopa u ovom pokusu nudi radio, pločicu, breadboard, otpornike, LED, tipkalo i potenciometar. Uvoženi sklop s drugim modulima ili drugim brojem radija odbija se jasnom porukom prije izvođenja.

## Registarski i paketni ugovor

`public/nrf24.mjs` provodi SPI bajtove, ne prepoznaje tekst izvora ni ispis. Podržani su čitanje i pisanje deklariranih registara, R_RX_PAYLOAD, W_TX_PAYLOAD, FLUSH_TX, FLUSH_RX i NOP. STATUS ima write-one-clear zastavice RX_DR, TX_DS i MAX_RT; FIFO_STATUS prikazuje zauzeće, OBSERVE_TX ARC/PLOS. RX cijevi 2–5 dijele više adresne bajtove cijevi 1.

Profil prihvaća 3–5 adresnih bajtova, kanal 0–125, 250 kbit/s, 1 Mbit/s i 2 Mbit/s, statički payload 1–32 B i CRC profil 0/1/2 B. Auto-ACK prisiljava CRC. Računa se podudaranje formata; nema bitne simulacije CRC polinoma ili sintetskih RF bitnih pogrešaka. Primjeri postavljaju 1 Mbit/s, pet adresnih bajtova, CRC16, osam podatkovnih bajtova i cijev 0. TX_ADDR = RX_ADDR_P0 odašiljača uvjet je auto-ACK-a.

Model čeka 1,5 ms nakon PWR_UP. Prijam ima 130 µs pripreme; CE za početak TX-a treba ostati HIGH najmanje 10 µs. Prvi TX dobiva 130 µs pripreme. Trajanje paketa računa se iz preambule, adrese, kontrolnih bitova, payloada, CRC duljine i brzine. ACK ima 130 µs preokreta i trajanje praznog paketa. Modelni minimalni prozor čekanja ACK-a je 250 µs, ili dulji ako to treba ACK format. ARD je razmak od kraja podatkovnog paketa do idućeg slanja; koristi se veća vrijednost ARD/prozor. ARC daje do 15 ponavljanja. Primjeri imaju ARD=500 µs, ARC=3.

Isti paket izgubljenog ACK-a koristi isti identitet pri ponavljanju i može dobiti novu potvrdu bez drugog RX unosa. Novi payload dobiva novi identitet, i kad ima iste bajtove. To je izričita idealizacija identiteta transakcije; ne simulira se fizički dvobitni PID/CRC detektor. Nov paket uz pun RX FIFO nije potvrđen. Pad napajanja odašiljača prekida transakciju; gubitak prijamnika tijekom ACK preokreta ne daje lažnu potvrdu.

Dinamički payload, ACK payload, posebna NO_ACK naredba, REUSE i ACTIVATE nisu implementirani i eksplicitno su odbijeni. Testiranje RPD-a i RF snage nije deklarirano. Nema antene, dometa, propagacije, smetnji, analognog napajanja ni laboratorijske potvrde fizičke opreme. Dva odašiljača koja nisu u RX načinu ne primaju jedan drugoga; nema modela RF sudara ili capture efekta.

## Jedan sat, različite izvršne granice

| Izvršni profil | Kako ustupa izvođenje |
| --- | --- |
| Uno/Nano AVR | Raspoređivač bira čvor s najmanjim brojem ciklusa. Izvodi jednu atomarnu AVR instrukciju i servisira dospjele događaje; SPI koristi stvarne AVR registre i cikluse. |
| S3 C++ | Stvarni WASM/Asyncify ustupa na svakom uvezenom API pozivu i na internom predahu petlje. API troši 1 µs funkcionalnog vremena, delay zadaje dulje čekanje. Nema Xtensa ciklusne točnosti. |
| S3 MicroPython | Stvarni interpreter izvodi program do sleep poziva. sleep_ms(0) barem jednom ustupa; pozitivni sleep_us zaokružuje se na milisekundu. Čisto računanje i SPI bez sleep-a ne troše modelirano vrijeme. |

MP/S3 SPI u mrežnoj sesiji prenosi funkcionalne bajtove bez modeliranog trajanja. Paketno vrijeme i svi sleep/ACK/retry događaji koriste isti monotoni sat. MicroPython petlja bez sleep-a može zadržati oba programa; gumb Stop prekida Worker. Ne tvrdi se pošteno preotimanje proizvoljnog Python programa niti jednake vremenske rezolucije svih jezgara.

MicroPython WASM nije ponovno građen. JS prilagodba ima opcionalni `scheduleSleep` koji se koristi samo u ovoj sesiji. Proxy stanje sada je vezano uz ES modul; svaki MP čvor uvozi vlastitu instancu modula. Time dva Python interpreter objekta više ne dijele upstream globalni Module/proxy put. Izvorni fallback ostaje za običnu jednu pločicu. Deterministički postupak u `scripts/patch-radio-runtime.py` uključen je u postojeći build; provenijencija jasno razlikuje promjenu JS-a od gradnje WASM-a.

## Upravljački izvori i zadaci

Vlastiti MIT izvori `lab_nrf24.py` i `lab_nrf24.h`, verzija 1.0.0, ostaju vidljivi i izvozivi. Izričito koriste statičkih osam bajtova, cijev 0 i polling. Nisu zamjena za sve mogućnosti upstream biblioteke RF24. Korisnik može uređivati glavni izvor i driver; C++ nakon promjene traži novo prevođenje, uz postojeći ugovor hashiranja izvora i alata.

1. Pokreni oba čvora i usporedi TX/ACK s RX brojevima 1–10.
2. U programu B promijeni samo kanal 76→77. Za C++ ponovno prevedi. Objasni MAX_RT bez RX podataka.
3. Vrati kanal pa promijeni samo adresu URS01→URS02. Ponovi opažanje.
4. Vrati adresu, postavi gubitak jednog ACK-a prije novog pokretanja i provjeri 11 pokušaja, deset ACK uspjeha te deset pročitanih brojeva, bez duplikata.
5. Izgubi jedan podatkovni paket pa usporedi promet s prethodnim pokusom.
6. U driveru isključi auto-ACK. Uspjeh TX-a tada se mora tumačiti odvojeno od RX konzole.

## Spremanje i granice sesije

Stari projekti ostaju `schemaVersion:3`; novi par koristi format 4. Glavni projekt i `radio.peer` imaju odvojene identifikatore i izvore. Ugniježđene mreže i nepoznate verzije odbijaju se. Zajednički izvorni limit ostaje 1 MiB, po datoteci 128 KiB, do 64 datoteke po čvoru. Peer je potpuno validiran. ZIP manifest sadrži peer sadržaj; proširena granica manifesta pokriva i JSON escaping velikog peer izvora.

Autosave, povijest i JSON/ZIP čuvaju oba čvora. Ne spremaju živi sat, registre i FIFO-e, promet ni potrošene gubitke. Stop zadržava zadnje pristigle okvire i promet; Run/Reset stvaraju novu mrežu. Zatvaranje prozora prekida oba programa. Glavni Pokreni/Reset vodi u Dva čvora, a niži izvršni adapter odbija slučajno pokretanje samo polovice mrežnog projekta.

Promet ima najviše 256 posljednjih događaja, svih 256 je dostupno kroz pomičnu tablicu i CSV. To nije neograničen paketni snimač. Konzole su zasebno ograničene. C++ izvor za Arduino IDE izvozi se zasebno po odabranom čvoru; oba sklopa i svi podaci ostaju u izvoznoj datoteci cijelog projekta.

## Provjere i podloga

`verification/radio.test.ts` pokriva model, električne pogreške, sve kombinacije 4×4, stvarni MicroPython, stvarne AVR HEX/WASM programe, negativne pokuse i ZIP/JSON. `verification/radio-package.mjs` pokreće baš završni izgrađeni Worker i release-relative interpreter, uz izgubljeni prvi ACK i mjerenje prisilnog prekida.

Brojevi i ograničenja pojedinog izvođenja nalaze se u `docs/stage21-evidence/`. Početni neuspjesi zadržani su odvojeno: pogrešno imenovani S3 izvodi, dijeljeni globalni proxy, izgubljena povratna vrijednost Asyncify poziva i predah S3 petlje izvan virtualnog raspoređivača pronađeni su izvršnim testovima i ispravljeni. Prvi široki pokus imao je staru testnu tvrdnju da je NRF planiran i preskočene compiler slučajeve; taj zapis nije završna potvrda.

Primarna tehnička podloga: [Nordic nRF24L01+ Product Specification v1.0](https://docs-be.nordicsemi.com/bundle/nRF24L01P_PS_v1.0/raw/resource/enus/nRF24L01P_PS_v1.0.pdf), odjeljci 6–9 i Appendix A. [RF24 Class Reference](https://rf24.readthedocs.io/en/latest/classRF24.html) služi za usporedbu pojmova ACK/slanje; ova isporuka ne deklarira podršku cijeloj toj biblioteci. Lab profil, driveri i raspoređivač odluke su ovog projekta, a njihovu izvedbu podupiru lokalni pokusi.

Sljedeći planirani zahvat je etapa 22: objedinjene URS vježbe, pregled matrice svih kataloških kombinacija i završni pilot. Stabilna v1.0, fizički uređaji, školsko računalo i ciljni mobilni preglednici ostaju otvorene provjere.
