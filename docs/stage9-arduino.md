# Etapa 9 — Arduino radno okruženje

Isporuka 0.4.0-beta.1, 12. studenoga 2026. Nastavlja isti privatni Site, format projekta 3 i isti AVR izvršni opseg. Nije stabilna v1.0.

## Što se mijenja

- Lokalni prevoditelj u paketu preuzima se kroz Prevedi. Jednokratna priprema ostaje Node.js 22+, Arduino CLI 1.3.1 i AVR core 1.8.6; Windows dobiva Pripremi.cmd/Pokreni.cmd, ostali sustavi dokumentirane Node naredbe.
- Aplikacija otvara karticu lokalnog prevoditelja i razmjenjuje poruke. Kartica radi HTTP zahtjeve prema vlastitom loopback originu. To izbjegava HTTPS → HTTP fetch u glavnoj aplikaciji; nije isporučen cloud compiler.
- Servis sluša samo na 127.0.0.1; provjerava Host, HTTP Origin, slučajni 256-bitni kod, točan origin i identitet prozora za postMessage. Kod je fragment veze i ostaje u memoriji, izvan projekta i pohrane preglednika. Poslovi se obrađuju pojedinačno. Imaju ograničenje izvora/izlaza, execFile timeout, otkazivanje i čišćenje privremene mape.
- Ovo nije OS sandbox za javno dostupno prevođenje. Prevodi vlastiti ili pouzdan pregledani izvor; paket se ne smije izlagati LAN-u/internetu. Nema izvršavanja projektnih shell naredbi, proizvoljnih build opcija ili instalacije ovisnosti tijekom posla.
- C++ datoteke se dodaju u korijen ili src/; .ino samo u korijen. Provjera putanja nastupa i u editoru i u zajedničkom ugovoru. Arduino IDE izvoz čuva izvore i navodi potrebne zaključane biblioteke.
- Dijagnostika sadrži izvornu datoteku, redak, stupac, kategoriju i poruku. Klik na dostupni izvor otvara i pomiče CodeMirror na taj redak. Poruke iz corea/biblioteka ostaju u cijelom zapisu. Privremene i alatne apsolutne putanje normaliziraju se.

## Biblioteke i kompatibilnost

Početna dodatna biblioteka je **Bounce2 2.72**, iz službenog repozitorija Thomas O Fredericks, MIT. U paketu su library.properties, src/Bounce2.h, src/Bounce2.cpp i LICENSE; blob identiteti zabilježeni su u provenance.json. Njihovi SHA-256 hashovi i sažetak paketa u vendor/arduino/lock.json provjeravaju se prije prevođenja. U simulatoru se koristi stvarni prevedeni kod biblioteke i AVR GPIO/millis. Tipkalo je idealno; fizičko poskakivanje kontakata nije dodano.

Odabir se čuva u arduino-libraries.json. Nepoznata biblioteka, pogrešna inačica ili duplikat se odbijaju. Odabrane inačice i digest ulaze u toolchain i ulazni hash. Za projekt bez dodatnih biblioteka buildInput ostaje identičan etapi 8, pa svih šest prethodnih primjera ostaju valjani. Prazan manifest nema učinak na hash. Promjena biblioteke poništava odgovaranje artefakta.

CLI compile dobiva praznu privremenu korisničku mapu te eksplicitne --library putanje samo odabranih paketa. Druge instalirane korisničke biblioteke nisu implicitno dopuštene. Wire/SPI iz corea zadržavaju raniji transport; ne proglašava se podrška senzora/zaslona/serva. Etapa 10 gradi te modele s konkretnim bibliotekama.

## Rezultat, cache i zakašnjele poruke

Svi C/C++ izvori, cilj, profil i zaključani alati/biblioteke određuju SHA-256 ulaza. Intel HEX i metapodaci ponovno se provjeravaju prije primjene i svake sesije. Rezultat se neće primijeniti ako se promijeni projekt, kôd, cilj ili biblioteke dok traje asinkroni zahtjev. Otkazani zahtjevi i poruke pogrešnog ID-a/prozora/origina ne mogu zamijeniti projekt.

Najviše šest artefakata čuva se u predmemoriji preglednika, 12 u memoriji lokalnog servisa. Čitanje iz cachea ponovno poziva validateArtifact. Neuspjelo zapisivanje u cache ne poništava uspješno prevođenje ili uvoz. Gumb za čišćenje cachea ne briše projekte ni povijest. Postojeći avr-build.json ostaje uz projekt i njegove ZIP/JSON izvoze.

Novi izvor bez lokalnog prevoditelja ne može se prevesti. Pripremljeni lokalni paket ne traži mrežu pri prevođenju. Valjan raniji artefakt može se simulirati iz offline paketa aplikacije. Nema tvrdnje da se novi C++ izvor prevodi na telefonu ili unutar preglednika.

## Predaja i ponovno otvaranje

Arduino predaja traži ime, razred/grupu, opažanje i valjan artefakt za aktualni izvor. Izvoz je puna zaustavljena projektna kopija s arduino-predaja.json, arduino-predaja.md i arduino-konzola.txt. Serijski tekst prilaže se samo za aktualnu projektnu reviziju; nije nezavisna potvrda izvršavanja. Opažanja ne nose automatsku ocjenu.

Uvoz ZIP-a vraća izvor, sklop, biblioteke, artefakt i podatke predaje. Ne pokreće program. Nastavnik mora pregledati i izričito pokrenuti sadržaj. SHA-256 veže zapis i sadržaj, ali nije digitalni potpis, jamstvo autorstva ili nekrivotvoriva potvrda prevoditelja.

## Izvedene provjere

131/131 programskih skupina: projekti/sklop 26, pločice 9, simulacija 12, periferija 16, naslijeđena jezgra 10, projektne datoteke 3, vježbe 20, offline 8, AVR 15 i novi Arduino sloj 12. Stvarne compiler provjere izvođene su s postavljenim LAB_ARDUINO_CLI i LAB_ARDUINO_CONFIG: nisu preskočene. Bez tih varijabli četiri compiler provjere u test:arduino izričito se preskaču. TypeScript i produkcijska izgradnja prolaze.

Nova dva višedatotečna programa, započeta iz newProject za Uno/Nano, stvarno se prevode s Bounce2, lokalnim headerom i src/pomoc.cpp. Svaki ispisuje ETAPA9, a stvarni pritisak modela tipkala mijenja D13 kroz prevedenu biblioteku. Flash 2374 B, statički SRAM 222 B u oba opažena programa. Stvarni compiler odbija neodabranu biblioteku i prijavljuje src/pomoc.cpp:2 za namjernu pogrešku.

Stvarna loopback HTTP integracija provjerava 401 bez koda, 403 za strani Origin, uspješno prevođenje, cache istog ulaza i novo prevođenje nakon izmjene izvora. Posebna provjera kontrolira paralelni zahtjev i pogrešne putanje. Izgrađeni AVR Worker zasebno izvodi Uno/Nano primjer; verzionirani MicroPython Worker zasebno izvršava svoj program.

## Opaženo u Chromiumu/Linuxu

1. Nova inačica otvorena je uz postojeće projekte formata 3. Stara offline snimka prvotno je poslužila raniju aplikaciju; razvojni pregled otvoren je mrežnim query URL-om, bez brisanja projekata.
2. U sučelju je napravljen prazan Uno projekt, napisan novi main.ino, izvezen JSON i preveden stvarnim CLI-jem. Rezultat je uvezen stvarnim biračem datoteke: 1974 B Flash, 210 B statički SRAM. Program je ispisao UNO ETAPA9 IZ PRAZNOG i mijenjao D13.
3. Ispunjena je predaja, stvarno preuzet ZIP, ponovno uvezen i otvoren kao zaustavljena kopija. Ime, razred, opažanje, kod i valjani rezultat bili su sačuvani. Preuzeti ZIP dodatno je parsiran programskom provjerom.
4. Izbor Bounce2 odbio je stari rezultat; povratak na prazan izbor vratio je kompatibilnost. Izmjena koda i Pokreni otvorili su Prevedi s porukom da stari program nije pokrenut.
5. Nova inačica s neiskorištenom varijablom prevedena je (1976 B Flash / 212 B SRAM) i uvezena. Stvarna poruka main.ino:2:7 otvorila je redak 2, stupac 7. Novi program je zatim pokrenut.

**Nije potvrđeno:** cloud preglednik nije dopustio pristup loopback kartici prevoditelja na portu 8765. Nije pokušano zaobilaženje tog ograničenja. Integrirani popup → prevoditelj → aplikacija put stoga nije proglašen preglednički potvrđenim. HTTP integracijski test i ručni preglednički put zasebni su dokazi. Produkcijska domena zadržava privatnu prijavu; njezin završni pregled iza prijave nije ponovljen. Safari/iOS, Windows/macOS pokretanje paketa, školsko računalo, fizički Uno/Nano i stvarni učenički pilot ostaju neprovjereni.

Dokazi i granice su u stage9-evidence/. Broj prolaznih skupina nije broj učenika niti potvrda svih preglednika. Offline tests koriste CacheStorage/fetch zamjene, ne novi hladni offline pokus privatne domene.

## Sljedeći razvojni paket

Etapa 10A: stvarni TWI/I2C, software I2C, AHT10 + OLED + servo na Uno/Nano. SRAM, Timer1 sukobi i konzervativni AHT10 profil ostaju izričiti projektni zahtjevi iz plana v2; ne dodaju se ikone bez komunikacijskog modela.

## Primarni tehnički izvori

- Arduino CLI 1.3 compile, --library i --libraries: https://arduino.github.io/arduino-cli/1.3/commands/arduino-cli_compile/
- Bounce2 izvor i API: https://github.com/thomasfredericks/Bounce2
- Izvor licence i svojstava u vendor/arduino/Bounce2 i provenance.json.
