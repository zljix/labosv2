# Etapa 24P · dorada pouzdanosti i povratne informacije

Polazište: izdanje 0.14.13-beta.1, 79 objavljenih profila, 268 URS kombinacija i pet uvodnih zadataka. Nova razvojna inačica je 0.14.14-beta.1. Dokazi tehničkog prihvata i stvarne nastave vode se odvojeno. Ovaj dokument nije tvrdnja da je proveden školski pilot.

## 24P1 · ovisnost izlaza o ulazu

V2 koristi poslužiteljsko sjeme za početno stanje i trajanja devet etapa, uključujući dva dulja držanja i ponovljene iste razine. Provjerava se stvarni strujni izlaz, odaziv i stabilnost nakon roka. Ne provjeravaju se nazivi varijabli ni tekst izvornog programa. Školski V2 zadržava odaziv 300 ms +24 ms. URS tipkalo zadržava vlastiti rok 50 ms +4 ms.

Neovisni pregled potvrdio je isti vremenski propust u URS tipkalu te regulatorima V5 i URS: stara vremenska zamjena izlaza postiže 10/10. Zato se objavljuju četiri zasebne nove rubrike:

| Nova rubrika | Prethodna rubrika | Promjena |
| --- | --- | --- |
| 24P-v2-button@2 | 24O-v2-button@1 | Promjenjiva početna razina i trajanja, duga držanja. |
| 24P-button-led@2 | 24B-button-led@1 | Iste pobude uz zadržan stroži URS odaziv i četiri cilja. |
| 24P-v5-regulator@2 | 24O-v5-regulator@1 | Promjenjiv temperaturni slijed i provjera histereze. |
| 24P-regulator@2 | 24I-regulator@1 | Promjenjiv temperaturni slijed uz postojeće URS uvjete prikaza i odaziva. |

Svih 79 prethodnih profila ostaje strukturno identično snimci `verification/fixtures/24o-grading-profiles.json`. Prethodna dodjela, snimka, rezultat i zaključana predaja ostaju na izvornoj rubrici. Novi izbor u katalogu ne mijenja stare dodjele. Ograničenje stare provjere prikazuje se uz rezultat; nastavnički komentar ili obrazložena korekcija ostavljaju postojeću povijest.

Novi URS regulator izvodi svih 14 pobuda u etapama po 2500 ms (ukupno 35000 ms). Rok odaziva ostaje 2300 ms, stabilan OLED prikaz najmanje 100 ms i iste granice izolacije. Prvi CI prihvat prekinuo je Uno/Nano reference s duljim scenarijem; skraćivanje zadržava sve pobude i oba smjera histereze. Stari URS profil zadržava svojih 3000 ms, a V5 svojih 6000 ms.

V2 regresija koristi 32 unaprijed zabilježena sjemena, tri neovisna ispravna rješenja (uključujući period očitanja 300 ms i drugi GPIO), vremenski program iz recenzije, stalni izlaz, obrnutu logiku, zadržavanje prvog pritiska i prestanak praćenja. Provjeravaju se prekid signala, masa, oporavak i ponovljivost. Agregiranje opažanja ne odbacuje rani odaziv zbog vrlo brzog učeničkog očitanja.

Širi pregled obuhvaća ADC/PWM, senzore, enkoder, IR, dodir, regulatore i radio. Ciljane negativne primjere prati `verification/school-input-audit.test.ts`. To je provjera konkretnih pogrešnih algoritama, ne dokaz da nije moguće napisati nijedan drugi pogrešan program.

## 24P2 · prikaz opažanja

Prilagodnik koristi točan identitet objavljene rubrike. V1 prikazuje bridove i trajanja bez izmišljanja statusa `passed`. V3 razdvaja položaj potenciometra u postotcima i radni omjer PWM-a. V4/V5 prikazuju °C, % RH i kut. Stari razlomljeni položaji ostaju vezani uz stare sheme. Nepoznata shema ima neutralan opis. Izvještaji i bodovi samo se čitaju; ne prepisuju se.

Jedan prikaz koriste učenik, nastavnički detalj i završni sažetak. Sirovi projektni i JSON izvozi zadržavaju izvorni izvještaj. CSV bodovni izvještaj zadržava bodove i nastavničku korekciju; ne uvodi pretvorbu jedinica. Regresija čita stvarne izvještaje svih 19 obitelji, uključujući 24O instalacijske dokaze.

## 24P3 · identitet i radni listovi

Jedinstveni maksimum je 120 Unicode kodnih točaka za ime i 80 za razred. JavaScript koristi isto brojanje kao PHP-ov UTF-8 izraz; znak izvan osnovne ravnine broji se jednom. Uvodni, URS i Arduino zapisi više ne skraćuju dopuštene identitete. Predug ručni unos ostaje vidljiv s porukom i ne sprema se kao skraćena vrijednost. Pri novom školskom radu puni identitet ulazi i u oba radio čvora. Postojeće zaključane snimke ne mijenjaju se.

Lokalne granice, povrat kroz JSON/ZIP i stvarni PHP/MySQL tijek imaju odvojene testove. Nema nove SQL migracije: postojeći stupci već podržavaju 120/80 znakova.

## 24P4–24P5 · značenje lokalne provjere i nastavnog vrednovanja

Lokalna provjera ostaje pomoćna procjena sa svojim širim rasponima i scenarijima. Ne potvrđuje uži službeni kriterij. U školskom pokušaju izravni odgovor poslužitelja daje rubriku točne dodjele; aktualni globalni katalog ne zamjenjuje stariju rubriku. Rezultat navodi spremljenu reviziju, a lokalne izmjene zadržavaju upozorenje da još nemaju potvrđene bodove. Tehnička pogreška ostavlja bodove nedodijeljenima.

Funkcionalni bodovi odvojeni su od nastavničkog pregleda razumijevanja i samostalnosti. Javna rješenja služe vježbanju. Novi sumativni funkcionalni zahtjev treba vlastitu objavljenu rubriku; tekstna napomena ne mijenja provjeravač. Početnih 8/10 u V4 jasno pripada funkcionalnosti pripremljenog predloška. V1 uvodi frekvenciju `f = 1/T`, sekunde i Hz prije pitanja.

## 24P6–24P8 · granice prihvata

Puna izvršna matrica obuhvaća 268 URS kombinacija i pet aktualnih uvodnih primjera s unaprijed navedenim očekivanim bodovima. Tri izvorna C++ LED predloška koriste 500/500 ms i očekivano dobivaju 8/10; ne predstavljaju dovršeno rješenje. Ispravljeni C++ izvor 250/750 ms treba zaseban izolirani prijevod. Ciljana regresija dodatno izvršava stare rubrike i ranije školske tokove. CI provjerava PHP/MySQL, pristup, revizije, zaključavanje, korekcije, arhivu, povrat kopije i sintetski razred od 30 učenika. Preskočen test ne označava se prolazom. Lokalna okolina nema PHP/MySQL ni izolirane C++ prevoditelje; te provjere moraju dati vlastiti CI dokaz.

Oznake verzije, etape i opisa dolaze iz `package.json`; iz njih nastaju sučelje, API, profil i inventar paketa. Povijesni prihvati ostaju odvojeni od aktualnih uputa. GitHub Pages i školski PHP/MySQL paket imaju odvojene provjere. Razvojna grana i paket za pregled nisu završni školski prihvat.

CI izvršava četiri cilja na zasebnim izvršiteljima, s jednim poslom provjeravača po izvršitelju. Skup od 273 ishoda ostaje potpun; spajanje provjerava točan skup kombinacija, isti izvor i otisak provjeravača te očekivane bodove. Školski PHP/MySQL tokovi rade odvojeno, a završni paket nastaje tek nakon uspjeha svih dijelova. Granice pojedinačnog izvođenja i svih 79 starih ugovora ostaju iste.

**24P8 ostaje otvoren:** mali pilot (3–5 učenika), puni nastavni blok s razredom, stvarni školski LAN/HTTPS, resursi provjeravača, Windows i stvarni Safari/iOS trebaju opažanja na tim uređajima. Nije dopušteno zaključiti stvarnu nastavnu uporabu iz sintetskog CI prolaza.

## Uporaba i povrat

Učenik: prati potvrdu spremanja i broj revizije; službene bodove čitaj uz tu reviziju; prije završetka pregledaj sažetak pa zaključaj. Pri prekidu veze sačuvaj lokalni rad i ZIP/JSON, zatim ponovi spremanje bez otvaranja novog pokušaja.

Nastavnik: za novu inačicu tipkala ili regulatora izričito odaberi novu 24P rubriku. Staru predaju pregledaj uz njezino ograničenje, obrazloži korekciju ili dopusti doradu. Ne mijenjaj stare bodove bez zapisa. Razumijevanje zabilježi zasebnim komentarom i demonstracijom.

Administrator: prije nadogradnje sačuvaj bazu, privatnu konfiguraciju, ključ i puni prethodni paket. Zamjenu i oporavak prvo provjeri na praznoj testnoj bazi. Ako nastanu predaje s novom 24P rubrikom, stari 24O provjeravač ih ne razumije; nemoj jednostavno prepisati stariji ZIP preko novih podataka. Zaustavi nove provjere, sačuvaj novonastali rad i primijeni provjeren popravak ili usklađeni postupak oporavka.
