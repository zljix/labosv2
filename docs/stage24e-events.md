# Etapa 24E · enkoder i infracrveno upravljanje

Izdanje **0.14.3-beta.1** dodaje šest rubrika `24E-…@1`, provjeravač `24E.1` i **24 nove kombinacije**. Ukupno je podržano **104 od 268 kombinacija**, odnosno 26 varijanti na MicroPythonu S3, S3 Arduino C++, Unu i Nanu. Uvodne V1–V5 imaju dosadašnju lokalnu provjeru. Ranije verzije rubrika i zaključane predaje ostaju sačuvane.

| Rubrika | Funkcionalni dokaz |
| --- | --- |
| encoder/encoderRaw | Novi CLK/DT/SW ispisi prate svaki fizički kontakt u oba smjera, uključujući pritisak i otpuštanje SW |
| encoder/ky040 | Četiri Gray brida daju jedan programski korak; SW resetira brojač, a fizički položaj ostaje isti |
| encoder/encoderBounce | Deterministički povratni prijelazi ne stvaraju dodatne neto korake |
| ir/irPulses | Stvarni OUT omotač, ispravna adresa/naredba, izmjerena trajanja, repeat, odbijanje pogrešaka i povrat prijama |
| ir/irLED | Stvarni PWM i struja LED-ice: POWER, PLUS/MINUS, repeat, granice 0/100 %, druga adresa, pogrešan okvir i blokirana putanja |
| ir/irTransmit | Stvarni nositelj stvara valjane izmjenične NEC okvire na uparenom prijamniku; TX nastavlja tijekom blokade RX-a |

## Upute i bodovanje

Svaka nova rubrika prije rada objavljuje upute, dopuštena rješenja, vrijeme, jedinice, tolerancije i kriterije. Tri boda pripadaju valjanom električnom putu i stvarnom tragu bridova, pet osnovnom odzivu, a dva rubnim slučajevima i oporavku. Svaki kriterij ima namjerno pogrešan rad koji gubi pripadne bodove. Otvoreni odgovori ostaju opisna povratna informacija.

| Profil | Pobuda i vrijeme | Objavljeni izlaz |
| --- | --- | --- |
| Sirovi enkoder | 100 ms između bridova; šest faza po 2000 ms; odziv 80 ms uz 10 ms odstupanja | `RAW CLK=… DT=… SW=…` |
| Dekoder i poskakivanje | 20 ms između bridova; šest faza po 2000 ms; odziv 80 ms; SW se prihvaća nakon 20 ms | `ENC P=…`, `ENC RESET P=0` |
| IR impulsi | Sedam faza po 700 ms; pritisak nakon 40 ms; novi ispis do 180 ms nakon okvira | `NEC A=… C=… R=…` i izmjerena trajanja |
| IR LED | Četrnaest faza po 700 ms; izlaz stabilan od 650 ms; dugi pritisci 220/440/550 ms | Mjerodavni su stvarni PWM i struja, bez obveznog konzolnog ispisa |
| IR TX/RX | Tri faze po 2500 ms: prijam, blokada, obnova | Najmanje dva potpuna izmjenična okvira 69/70 na OUT u svakoj neblokiranoj fazi |

Brojač enkodera počinje od nule neovisno o početnom mehaničkom položaju. Provjera bira različite pozitivne i negativne pomake privatnom pobudom posla. Poskakivanje je deterministički niz novi/stari/novi/stari/novi na 0/200/400/600/800 µs. Ne predstavlja proizvoljan fizički šum. Spori polling može propustiti bridove; takav rad gubi funkcionalne bodove unutar objavljenog profila.

NEC koristi 8-bitnu adresu i naredbu, oba inverzna bajta i LSB redoslijed. Repeat dolazi svakih 110 ms i ne sadrži novu naredbu. Python ispisuje `IR PULSES […]`; C++ može ispisati `PULSE LEADER=… MARK=… SPACE=…`. Za impulse vrijedi ±150 µs. Ako polling prijamnik započne tijekom uvodnog LOW, dopušten je izmjereni preostali dio 6500–9000 µs prema vidljivom driveru; ostali impulsi moraju odgovarati cijelom fizičkom okviru. Kod C++ repeat ispisa posljednji bitni razmak smije ostati iz prethodnog punog okvira.

Za LED se provjerava PWM uz toleranciju ±0,025 i struja kroz stvarni spoj. POWER se pri držanju smije primijeniti samo jednom. PLUS/MINUS se primjenjuje i na repeat. Ispituje se prelazak preko obje granice, filtriranje druge adrese, pogrešan inverz/vrijeme, blokada i nova naredba nakon obnove. Konzolna tvrdnja `LED=…` ne određuje rezultat.

Za TX se ne zahtijeva istodobno programsko dekodiranje vlastitog slanja: blokirajući Python/S3 primjer to ne radi. Neovisni promatrač dekodira stvarni prijamnikov OUT i provjerava inverze te izmjenjivanje naredbi. Model stvara TX omotač tek nakon valjanog 34–42 kHz nositelja i radnog omjera 15–50 %. Dodatni ispravni repeat okviri su dopušteni. Blokada se primjenjuje samo u privatnoj simulacijskoj kopiji prijamnika; izvori i spremljeni projekt ostaju isti.

## Izvođenje i prihvat

Spremljeni izvor izvodi se u postojećoj Linux izolaciji. Novi C++ izvor ponovno se prevodi zaključanim alatom; učenički artefakt i klijentski bodovi ne određuju rezultat. Vrijede postojeća ograničenja: 65 s zidnog i 58 s CPU vremena za izvršavanje, 90 s za prevođenje, 2048 MiB virtualnog adresnog prostora i 1 MiB izlaza. Nepodržano ili tehnički neuspjelo izvršavanje ostaje bez dodijeljenih bodova.

`verification/school-events.test.ts` provjerava sva 24 para rubrika/cilj, po tri ponavljanja istog scenarija, alternativne izvore i električno ekvivalentne rasporede, druge privatne pobude, svaki kriterij s pogrešnim radom, sporo očitanje, zamijenjene faze, optičke skupine i izmijenjene ugovore. C++ referenca, alternativa i pogrešno rješenje zasebno se prevode za S3, Uno i Nano: ukupno 54 nova prijevoda. Preskočeni test nije dokaz prevođenja.

`verification/school-events-api.test.mjs` koristi pravi PHP/MySQL: objava svih šest novih rubrika, stvarni poslovi i rezultati, odbijanje stranog ugovora, zaključavanje i očuvanje ranije zaključanog analognog zadatka. Školska integracija zadržava postojeće provjere korisnika, razreda, revizija, izvještaja, sigurnosne kopije i povrata. Izvršni dokazi pripadaju točno navedenoj snimci izvora u GitHub Actionsu.

## Nadogradnja i nastavak

Nema nove SQL migracije. Sačuvaj privatnu konfiguraciju, sesije i bazu, zamijeni programski paket, pokreni postojeći `migrate` i ponovno pokreni provjeravače. Nastavnik pri novoj objavi izričito odabire novu rubriku; prethodne predaje ostaju vezane uz svoje uvjete.

Sljedeća etapa je **24F: relej, zvuk, servo i DC pogoni**. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i skupna memorijska granica ostaju zasebni uvjeti prihvata. Dokazi ove etape odnose se na funkcionalni simulator i školske provjere, bez potvrde fizičke opreme.
