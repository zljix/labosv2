# Etapa 24F · relej, zvuk, servo i DC motori

Izdanje **0.14.4-beta.1** dodaje sedam rubrika `24F-…@1` i provjeravač `24F.1`: **28 novih kombinacija**, ukupno **132 od 268**, odnosno 33 URS varijante na MicroPythonu S3, S3 Arduino C++, Unu i Nanu. Ranije 33 verzije rubrika ostaju neizmijenjene i izvršive; uvodne V1–V5 zadržavaju lokalnu provjeru.

## Objavljeni zadaci

| Varijanta | Stvarni izlaz i vremenski slijed jednog ciklusa |
| --- | --- |
| Relej COM/NO/NC | COM-NO i pripadna LED 700 ms; COM-NC i druga LED 700 ms. Provjeravaju se kontakt, struja obiju grana i upravljački put. Energetska masa smije ostati odvojena. |
| Aktivna zujalica | DC HIGH 500 ms, LOW 500 ms; ugrađeni modelni oscilator 2300 Hz. |
| Pasivni piezo | 440, 880 i 1320 Hz po 400 ms uz 100 ms tišine iza svakog tona; još 500 ms tišine nakon trećega. |
| SG90 impuls i kut | 0, 90 i 180° po 600 ms; stvarnih 50 Hz i impulsi 1000, 1500 i 2000 µs. |
| L298N jedan motor | Naprijed 25/50/100 % po 500 ms, slobodno 300 ms, natrag 50 % 600 ms i kočenje 500 ms. |
| Dva L298N kanala | A naprijed 50 % i B natrag 75 % istodobno 800 ms; potom A naprijed 100 % i B slobodno 800 ms. |
| Servo, motor i ton | SG90 45/135° po 600 ms uz istodoban motor naprijed 50 % i pasivni ton 880 Hz. |

Tri boda pripadaju valjanom upravljačkom i energetskom putu svih zadanih aktuatora, pet prvom punom slijedu stvarnih izlaza, a dva još dvama potpunim ciklusima. Program koji samo ispisuje očekivane vrijednosti ne može ostvariti funkcionalne bodove. Ispis nije obvezan. Nazivi, redoslijed komponenti i raspored vodiča ne određuju rezultat; električno ekvivalentan raspored i drugi valjani GPIO prihvaćaju se.

## Tolerancije i energetski krug

Upute i zamrznuti ugovor unaprijed objavljuju početak do 250 ms, tri ciklusa, trajanje svake faze ±80 ms i smirivanje uz prijelaz do 60 ms. Za ton vrijedi ±2,5 % (najmanje ±4 Hz) i duty strogo između 15 i 85 %; za servo ±1 Hz, ±20 µs i ±4°. Prosječni napon motora ima toleranciju ±0,18 V. Kratki prozori integracije stvarnog AVR PWM-a uz promjenu EN-a ili smjera prihvaćaju se samo unutar vremena smirivanja uz prijelaz.

Spremljeni L298N model koristi VS=6 V, VSS=5 V, pad mosta 2 V, motore nazivnog napona 6 V, oba uklonjena EN jumpera i zajedničku masu. Privatna deterministička kopija bira VS=5,6, 6,0 ili 6,8 V. Program zadržava isti duty, a promatrač očekuje stvarni potpisani prosjek `(VS − 2 V) × duty`. Time se energetski put provjerava zasebno od programske odluke. Slučajno odabrani napon pripada istom poslu i ponavljanje istog sjemena daje isti rezultat.

EN LOW mora dati Hi-Z/slobodno stanje. Kočenje traži jednake IN ulaze uz EN HIGH i približno 0 V. Ta stanja nisu međusobno zamjenjiva. Pozitivan i negativan prosjek mjere se na stvarnim M+/M− priključcima; relativni pokazatelj nije RPM. Zasebni testovi prekidaju signal ili napajanje u odvojenim kopijama. Nakon Stop, popravka i restarta prihvaća se novi uredan rad; ne uvodi se skriveni uvjet oporavka bez restarta.

SG90 zadržava zasebni izvor 5 V, zajedničku masu i modelnu kalibraciju 1000–2000 µs. Vraćeni kut mora odgovarati stvarnom impulsu. Promjena teksta, varijable kuta ili kalibracije modela ne može nadomjestiti traženi izlaz.

## Timeri i ciljevi

Uno i Nano koriste stvarni AVR program: Servo zauzima Timer1, a tone Timer2. Valjana zajednička izvedba koristi Servo na D8, motor PWM na D5/Timer0 i tone na D4/Timer2. Negativne neovisne kompilacije pomiču motor PWM na D9 ili D3 i provjeravaju posljedicu na stvarnom izlazu. Broj timera sam po sebi ne dodjeljuje niti oduzima bodove. S3 C++ koristi zasebne LEDC izlaze, a MicroPython zasebne PWM objekte; AVR ograničenja ne prenose se na njih.

## Izvršavanje i provjere

Produkcijski provjeravač izvršava spremljeni izvor u postojećoj Linux izolaciji. Novi C++ izvor ponovno se prevodi zaključanim alatom; klijentski artefakt, klijentski bodovi i konzolna tvrdnja ne određuju rezultat. Zadržavaju se 65 s zidnog i 58 s CPU vremena za izvršavanje, 90 s za prevođenje, 2048 MiB virtualnog adresnog prostora i 1 MiB izlaza. Nepodržan ili tehnički neuspješan posao ostaje bez bodova.

`verification/school-actuators.test.ts` pokriva sva 28 para rubrika/cilj, tri ponavljanja istog scenarija, oba kraja privatnog energetskog raspona, alternativna rješenja bez ispisa, promijenjene oznake i raspored, namjerno pogrešne izvore, samo prvi valjani ciklus, odvojene signalne i energetske prekide te nepromjenjivost ugovora. Neovisna kompilacija provjerava C++ referencu, alternativu i pogrešan izvor na S3/Uno/Nano; zasebno se prevode sukobi timera. Preskočeni test nije dokaz izvedene kompilacije.

`verification/school-actuators-api.test.mjs` koristi pravi PHP/MySQL za objavu svih sedam rubrika, stvarne poslove i bodove, odbijanje stranog ugovora, zaključavanje i očuvanje ranijeg digitalnog zadatka. Postojeće provjere korisnika, revizija, zaključavanja, izvještaja, povrata kopije i 30 simuliranih učenika ostaju uključene u školski workflow. Izvršni dokazi pripadaju točno navedenoj programskoj snimci u Actionsu.

Lokalni razvojni pokusi koriste poznate referentne projekte. Ne proglašavaju dostupnost Linux izolacije na Windowsu; produkcijski provjeravač nema zamjensko neizolirano izvođenje. Preimenovan je prikaz izvještaja u `SchoolReportsView.tsx` kako na Windowsu resolver ne bi zamijenio komponentu s podatkovnim modulom `schoolReports.ts`.

## Nadogradnja i nastavak

Nema nove SQL migracije. Sačuvaj privatnu konfiguraciju, sesije i bazu; zamijeni programski paket, pokreni postojeći `migrate` i ponovno pokreni provjeravače. Nastavnik pri novoj objavi izričito bira novu rubriku. Prethodne predaje i njihovi uvjeti ostaju sačuvani.

Slijedi **24G: koračni motor**. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i ukupna memorijska granica ostaju zasebni uvjeti prihvata. Model aktuatora ne potvrđuje fizički moment, mehaničku dinamiku, struju zavojnice ni stvarni RPM.
