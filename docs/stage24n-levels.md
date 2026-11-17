# Etapa 24N · digitalni i I2C pretvornici razina

Izdanje **0.14.12-beta.1**, provjeravač `24N.1`, dodaje četiri rubrike za postojeće URS17 i URS18. Službena matrica pokriva **268/268 kombinacija**: 67 varijanti na MicroPython S3, S3 C++, Unu i Nanu. Svih 70 prethodno objavljenih rubrika zadržava identitet i sadržaj. Uvodne V1–V5 imaju zasebne lokalne provjere. Pokrivenost kataloga nije potvrda stvarne opreme ili dovršenog školskog pilota.

## Uvjeti i kriteriji

| Rubrika | 3 boda | 5 bodova | 2 boda |
| --- | --- | --- | --- |
| `24N-levelInput@1` | Napajani SN74LVC2T45, valjan DIR i podatkovni put tipkala do konfiguriranog ulaza pločice | LED ispravno prati prva tri stanja tipkala | Četiri dodatne promjene i pravodoban povrat |
| `24N-levelOutput@1` | Stvarni izlaz pretvornika pogoni udaljenu LED kroz serijski otpornik | Najmanje tri potpuna ciklusa stvarne struje LED-ice | Objavljena trajanja prema cilju uz ±24 ms |
| `24N-i2cBmp280@1` | Napajani pretvornik, odvojene domene i novo potpuno BMP280 čitanje | Nove temperature i tlakovi te odgovarajući ispisi u dvije etape | Povrat početnog okoliša uz nova čitanja i ispise |
| `24N-i2cOled32@1` | Napajani pretvornik i potvrđeni prijenos do udaljenog OLED-a | Stalni tekst i brojač 0 u primljenoj memoriji | Stabilni daljnji prikazi 1 i 2 |

Nastavnik novu rubriku izričito odabire pri objavi inačice zadatka. Učenik prije rada vidi cijele uvjete i raspodjelu bodova. Zamrznuti izvršni ugovor određuje vremena, tolerancije, raspone pobuda i ograničenja. Postojeće dodjele ne dobivaju novu rubriku prešutno.

SN74LVC2T45 ima A=3,3 V i B=5 V, zajednički DIR i definirana oba ulaza. HIGH na DIR odabire A → B, LOW B → A. Kod tipkala udaljeni ulaz ima vanjski 10 kΩ pull-up; unutarnji pull-up prijamnika ne zamjenjuje ga. S3 prima B → A, Uno/Nano A → B. Sedam izmjeničnih stanja počinje privatno odabranim stanjem; jednaka trajanja etape od 233, 277 ili 319 ms bira poslužiteljsko sjeme. Reakcija je najkasnije 50 ms uz 4 ms tolerancije, nakon čega LED mora ostati ispravna do iduće promjene.

LED varijanta zadržava različita postojeća trajanja primjera: MicroPython 500/500 ms, S3 C++ 300/300 ms, Uno/Nano 200/200 ms. Ulazni početni pull-down je 100 kΩ. S3 šalje A → B, AVR B → A. Mjere se potpuni ON/OFF intervali stvarne struje; početno nepotpuno isključenje prije prvog ON-a ne broji se. Provjera traje 4250 ms virtualnog vremena.

Automatski I2C Lab carrier ima LV=3,3 V, HV=5 V i zajedničku masu, dva uparena kanala i zasebne pull-up otpornike na obje strane. Nema DIR-a. S3 je na LV strani, a udaljeni uređaj na deklariranom 5 V carrieru. Uno/Nano su na HV strani, uređaj je izvorni modul s 3,3 V. Obje signalne mreže moraju proći kroz isti pretvornik. Odvojene mreže na HIGH i napon vraćen kroz otpornike sami ne dokazuju prijenos ili valjano napajanje.

BMP280 ima tri etape po 6000 ms. Početni okoliš: temperatura −15 do 25 °C i tlak 85000–91500 Pa; promijenjeni: 45–70 °C i 101000–107500 Pa; zatim povrat početnog. Vrijednosti bira privatno sjeme. U svakoj etapi treba najmanje dva nova potpuna čitanja i ispis `T=<broj> P=<broj>`; dopušteni su °C i Pa. Najveći interval, uključujući početak i kraj etape, je 2300 ms. Prvih 100 ms služi smirivanju. Tolerancije su 0,3 °C i 150 Pa. Povijest senzora, lažni ispis ili nepotpuni registar ne daju novo mjerenje.

OLED 128×32 na 0x3C zadržava ranije fontove i rasporede po cilju. MicroPython: framebuf 8×8, `OLED 128 x 32` na (0,0), `URS laboratorij` na (0,8), `Brojac: n` na (0,16), `Redak 4` na (0,24). Uno/Nano: U8g2 6×10, isti naslov s osnovicom (0,8), brojač na (0,18), `Zadnji redak` na (0,30). S3 C++: U8g2 6×10, `ESP32-S3 U8g2` na (0,10), `COUNT n` na (0,24), okvir (100,0,28,32). Prvi prikaz je do 1800 ms; razmak početaka brojeva 850–1500 ms; stabilnost najmanje 200 ms. Lokalni framebuffer bez I2C slanja ne ispunjava kriterij. Slobodni dijelovi slike i konzola ne boduju se.

## Izvršavanje i provjere

Provjeravač pronalazi stvarne električne mreže, bez oslanjanja na nazive, položaje ili redoslijed komponenata. GPIO primjer može upotrijebiti i drugi podatkovni kanal uz prilagođene spojeve. I2C put mora povezati lokalne GPIO s udaljenim uređajem preko obaju kanala; rezervni pretvornik pored izravnog spoja ne prolazi. Napajanje, DIR, logičke razine, stvarna struja, dovršena mjerenja, potvrđeni prijenosi i primljena OLED memorija dolaze iz privatnog izvršavanja spremljene snimke.

Svaki cilj ima tri ponavljanja četiriju referentnih programa, prekide svih napajanja, mase, DIR-a i podatkovnih putova te popravak s drugim sjemenom. Neovisno se provjeravaju druga rješenja, drugi GPIO, kanal 2, novi identiteti i redoslijed te pogrešni osnovni i napredni kriteriji s očekivanjima 3/10 i 8/10. Sva tri C++ cilja zasebno prevode referencu, alternativu i oba pogrešna programa za sve četiri rubrike: ukupno 48 prijevoda.

PHP/MySQL prihvat obuhvaća 16 dodjela, stvarne ugovore i bodove, zaštitu od tuđeg rezultata, zaključavanje i očuvanje stare zaključane predaje. Regresija provjerava prethodne obitelji, račune, razrede, spremanje, izvještaje, povrat kopije i 30 simuliranih učenika. Dokazi se povezuju s jednim otiskom isporučenog provjeravača u `stage24n-evidence/`.

Novo izvršavanje zadržava 65 s zidnog i 58 s CPU vremena, 2048 MiB adresnog prostora i 1 MiB izlaza. Novi jednočvorni poslovi imaju postojeću rezervaciju od 180 s; radijski `24M.1` zadržava 300 s. Izolacija ostaje obvezna. Nedostupan servis ili prekoračeno ograničenje ostavljaju prazne bodove.

## Nadogradnja i granice

Sačuvaj bazu, privatnu konfiguraciju, ključ i sesije. Zamijeni kompletan paket, pokreni postojeći migrate i ponovno pokreni Linux provjeravače. Nema nove SQL migracije. GitHub Pages prikazuje simulator i matricu; školska prijava, pohrana, službeni bodovi i nastavnički pregled traže PHP/MySQL instalaciju.

Modeli pretvornika ostaju funkcionalni DC/GPIO i I2C profili iz etapa 22G/22H. Ovo bodovanje ne dodaje fizičku RC krivulju, najveću frekvenciju, toplinu, hot-swap, clock-stretching ili certifikaciju kupljenog modula. Stvarni školski pilot, Windows veza s Linux provjeravačem, ciljni mobilni preglednici i skupno cgroup ograničenje memorije ostaju zasebni uvjeti prihvata. Izdanje ostaje nastavna beta.

## Rezultati prihvata

[Završni prihvat 24N](https://github.com/zljix/labosv2/actions/runs/44052504254) potvrđuje **253 ciljane izvedbe, 48 neovisnih C++ prijevoda i 16 zaključanih školskih dodjela** na izvoru `59c0f3e33657a2061308dd936de4685f1493fef6`. Tri ponavljanja koriste istu nepromjenjivu snimku i uspoređuju potpune rezultate. Alternativni algoritmi, drugi GPIO, kanal 2, preuređeni sklopovi i oba neovisno pogrešna kriterija imaju očekivane bodove. Dodatni GPIO koji zasebno napaja LED ne može ostvariti bodove samo slabom otpornom vezom prema napajanom pretvorniku.

Sve ranije obitelji, pokus s 30 simuliranih učenika, računi, razredi, istodobno spremanje, predaje, izvještaji, arhiva i povrat kopije prošli su prihvat. Isporučeni provjeravač ima isti otisak kao sva četiri ciljna prihvata i svih 16 stvarnih školskih rezultata. [Sažetak](stage24n-evidence/acceptance-summary.json), [nativni prijevodi](stage24n-evidence/ci-native-summary.json) i [izvornost paketa](stage24n-evidence/installer-integrity.json).

Zasebno prolaze 32 pokretanja zapakiranih Workera: osam GPIO pokusa i osam I2C scenarija s promjenom podataka, prekidom HV-a i oporavkom. Prošlo je i osam provjera korijenskog offline paketa, osam provjera Pages podputanje te svih 60 testova modela pretvornika. Svih 205 web resursa bajtno odgovara prihvaćenom CI paketu; [lokalni zapis](stage24n-evidence/local-package-verification.json). Time nije proglašen stvarni učenički ili hardverski pilot.
