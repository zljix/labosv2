# Etapa 24G · A4988 i koračni motor

Izdanje **0.14.5-beta.1** dodaje tri rubrike `24G-…@1` i provjeravač `24G.1`: **12 novih kombinacija**, ukupno **144 od 268**, odnosno 36 varijanti na MicroPythonu S3, S3 Arduino C++, Unu i Nanu. Ranijih 40 verzija rubrika ostaje neizmijenjeno; uvodne V1–V5 zadržavaju lokalnu provjeru.

## Objavljeni zadaci i bodovi

| Varijanta | 5 bodova za prvi slijed | Još 2 boda |
| --- | --- | --- |
| Broj koraka | 50 punih koraka naprijed (+90°), 600 ms stanke, 50 natrag (0°), 600 ms stanke | Još dva jednaka ciklusa |
| Mikrokoraci | Svih pet načina 1, 1/2, 1/4, 1/8, 1/16; u svakom 10 × faktor impulsa naprijed (+18°) i natrag (0°), uz stanke 400 ms | Još dva potpuna obilaska svih pet načina |
| ENABLE, RESET i SLEEP | 10 pogonskih impulsa (+18°), 700 ms stanke, ENABLE HIGH i još 10; translator je na 20 punih koraka, pogonski zbroj ostaje 18°, mostovi su isključeni | RESET LOW i 3 ignorirana impulsa, stanka 700 ms; SLEEP LOW i 3 ignorirana impulsa, stanka 700 ms; buđenje 2 ms, ENABLE LOW i 5 koraka; translator=5, idealni pogonski zbroj 27°, osovina nije referencirana |

Prva tri boda uvijek potvrđuju stvarni upravljački i energetski put te dvije odvojene zavojnice. Kriteriji se objavljuju prije rada. Otvoreni odgovori ostaju opisni; ispis nije obvezan. Drugi algoritam, oznake, raspored i valjani GPIO prihvaćaju se uz isti izlaz. Broj impulsa i MS način čitaju se iz stvarnog modela, a kut iz pogonskih koraka motora s **200 punih koraka/okret**. Izmjena samog ispisa ne mijenja bodove.

## Uvjeti i razlika translatora od osovine

[Proizvođački podatkovni list A4988](https://www.allegromicro.com/-/media/files/datasheets/a4988-datasheet.pdf) potvrđuje da ENABLE upravlja mostovima, dok STEP/DIR/MS i translator ostaju aktivni. RESET LOW vraća električni Home i ignorira STEP. Zbog toga opću rečenicu plana o isključenom pogonu tumačimo odvojeno za translator i pobudu motora; ne uvodimo pogrešno zaustavljanje brojača pri ENABLE HIGH.

Modelni MS1/MS2/MS3 slijed jest 000, 100, 010, 110, 111. Način se mijenja na zajedničkom položaju. HIGH i LOW impulsa imaju minimum 1 µs, DIR/MS setup i hold 0,2 µs, a buđenje minimum 1 ms. Rubrika traži razmak prihvaćenih impulsa **4,01 ms ±0,6 ms**, početak do 250 ms, stanke ±80 ms uz dodatnu 1 ms toleranciju promatranja i kut ±0,001°. Prozor izvođenja iznosi 6,2 s za broj koraka, 24 s za mikrostep i 4,2 s za upravljanje. Obuhvaća sva tri ciklusa i kada su razmaci impulsa i stanke na sporijoj granici tolerancije. Predlošci koriste HIGH 10 µs, LOW 4 ms i buđenje 2 ms. Funkcionalni PWM na STEP nije podržan u ovom profilu.

VDD je 3,3 V na S3 odnosno 5 V na AVR-u; VMOT je zaseban izvor s valjanim rasponom 8–35 V, predložak 12 V, uz zajedničku masu. Privatna deterministička kopija provjerava VMOT=8, 12 ili 35 V. To su granice funkcionalnog modela. Nema kriterija struje zavojnice, momenta, ubrzanja ili proklizavanja. Električni Home ne znači nultu fizičku osovinu; nakon koraka bez pobude položaj je nepoznat i `angle` ostaje prazan, dok `idealAngle` čuva idealni pogonski zbroj.

## Izvršavanje i provjere

Produkcijski provjeravač ostaje u Linux izolaciji, izvršava točno spremljeni izvor i ponovno prevodi promijenjeni C++ zaključanim alatom. Učenikov artefakt i tvrdnja o bodovima ne biraju rezultat. Posao zadržava hash snimke, ugovora, rubrike, pokušaja i revizije. Ograničenja su 65 s zidnog i 58 s CPU vremena, 90 s za prevođenje, 2048 MiB adresnog prostora i 1 MiB izlaza. Tehnički kvar i nepodržani posao ostaju bez bodova.

`verification/school-steppers.test.ts` provjerava tri ponovljena izvođenja svih 12 kombinacija, električno ekvivalentne alternative bez ispisa, drugi STEP GPIO, oba kraja napajanja te zasebne prekide STEP-a, VMOT-a i zavojnice. Pogrešan broj koraka daje 3/10, samo prvi potpuni ciklus odnosno neispravan RESET daje 8/10, a nevaljan spoj 0/10. Tri C++ cilja neovisno prevode referencu, alternativu i pogrešan izvor za oba funkcionalna kriterija: ukupno 36 prijevoda. Za kvarove su dopušteni Stop, popravak i novo pokretanje; ne traži se skriveni oporavak bez restarta.

`verification/school-steppers-api.test.mjs` provjerava pravi PHP/MySQL, svih 12 dodjela, neovisne bodove, odbijanje stranog ugovora, zaključavanje i očuvanje starije predaje. Postojeće provjere spremanja, izvještaja i 30 simuliranih učenika ostaju uključene. Izvršni dokazi nalaze se uz ovu etapu i u GitHub Actionsu; lokalna provjera poznatog izvora nije potvrda produkcijske izolacije.

## Nadogradnja i nastavak

Nema nove SQL migracije. Sačuvaj privatnu konfiguraciju, sesije i bazu; zamijeni paket, pokreni postojeći migrate i ponovno pokreni provjeravače. Nova rubrika bira se izričito pri novoj objavi. Prethodni zadaci, ugovori i zaključane predaje ostaju sačuvani.

Slijedi **24H: zasloni i SPI uređaji**. Stvarni školski pilot, Windows veza prema Linux provjeravaču, ciljni mobilni preglednici i ukupna memorijska granica ostaju zasebni uvjeti prihvata.


## Izvedeni prihvat

[GitHub Actions 43925558604](https://github.com/zljix/labosv2/actions/runs/43925558604) potvrdio je sva četiri cilja i 36 neovisnih C++ prijevoda. Izvršena su 153 zabilježena pokusa, svih 12 PHP/MySQL dodjela zaključano je s 10/10 bodova, a starija predaja ostala je sačuvana. Prošli su spremanje, izvještaji, povrat kopije i pokus s 30 simuliranih učenika. Provjereno je svih 880 datoteka iz inventure paketa i svih 205 web resursa offline manifesta. Programske datoteke provjeravača bajtno odgovaraju prihvaćenoj izgradnji.
