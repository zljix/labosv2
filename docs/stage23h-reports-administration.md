# Etapa 23H · postignuća i administracija

**0.13.7-beta.1 · 15. studenoga 2026.** Polazište je objavljena 23G, `dddf24c72f49eb9800bf03b034f3d86cd6eb2fe9`. Nastavlja se izvorni plan školskog PHP/MySQL sustava.

## Pregled postignuća i izvozi

U **Pregledu razreda → Školski pregled rada → Postignuća i izvještaji / izvozi** nastavnik bira razred, učenika i dodjelu. Pregled uključuje i učenike bez započetog rada. Prikaz ima stranice od 100 zapisa; CSV dohvaća cijeli odabrani opseg u jednoj dosljednoj transakciji, najviše 5000 zapisa. Veći opseg treba suziti po učeniku ili vježbi.

Evidencija zadano koristi posljednju zaključanu predaju. Aktualni otvoreni rad ili dorada prikazani su zasebno. Nastavnik u detalju zaključane predaje može uz razlog odabrati drugu predaju toga učenika i dodjele ili vratiti zadani izbor. Odabir je vezan uz korisnički identitet, autora, vrijeme i revizijsku evidenciju. Broj bodova za nepotvrđeno, nezapočeto i nepodržano ostaje prazan; stvarna nula ostaje 0.

CSV sadrži identitet računa, razred i godinu, zadatak i inačicu, cilj, aktualni pokušaj, odabranu predaju/reviziju, automatske i konačne bodove, njihov izvor, razlog i autora korekcije te UTC vremena. Tekst koji bi mogao biti formula dobiva zaštitni apostrof. Uvezeni projektni naziv nije korisnički identitet.

Projektni ZIP uključuje evidenciju CSV/JSON, indeks snimki s hashom i izvorne projektne ZIP-ove aktualnih i vrednovanih revizija. Svaki se dohvaća ovlaštenim API-jem; ne pokreće se učenički program. Postojeći format čuva program, sklop, odgovore, oba radio čvora i početne medije. Granica je 100 snimki i 30 MB izvornog JSON-a po izvozu; kod većeg opsega odaberi učenika ili vježbu. Nazivi datoteka koriste poslužiteljske brojeve umjesto korisničkog teksta.

## Komentari i korekcije

**Komentari i povijest korekcija / osvježi** otvara zapise točne radne revizije. Nastavnik može dodati komentar, korigirati ukupan broj bodova unutar već objavljenog maksimuma, s najviše dvije decimale, ili vratiti automatsko bodovanje. Zadaci bez bodovnog maksimuma ne dobivaju izmišljenu bodovnu ljestvicu.

Svaki zapis čuva autora, vrijeme, razlog, prethodni zapis i izvorno stanje automatske provjere. Nema prepisivanja ni brisanja tih zapisa. Korekcija ne mijenja rezultat provjeravača, kriterije ili zaključanu snimku. Zakašnjeli automatski rezultat ostaje čitljiv i ne uklanja nastavničku korekciju. Nova revizija ili pokušaj ne nasljeđuje stare korekcije. Učenik može čitati vlastite zapise. Dva nastavnika ne prepisuju istodobni pregled: zastarjelo stanje dobiva sukob i zahtijeva osvježavanje. Ponovljeni isti zahtjev ne stvara duplikat.

## Arhiviranje i čuvanje

Administrator iz izvještaja arhivira cijelu školsku godinu uz razlog. Pregledi, prijave i izvozi ostaju dostupni. Zaustavljaju se nove dodjele, članstva, pozivni kodovi, pokušaji, spremanja, zaključavanja, dorade i nastavničke izmjene u toj godini. Otvoreni učenički lokalni rad ostaje dostupan za izvoz. Ponovno otvaranje godine ne otključava ranije predaje. Već pokrenuti privatni provjeravač smije dovršiti rezultat iste snimke.

Čišćenje je privatna CLI naredba s pregledom kao zadanom radnjom. Politika u privatnoj konfiguraciji određuje `retention.revision_days` (zadano 90) i `retention.keep_latest` (zadano 10). Obrađuju se samo arhivirane godine. Uvijek ostaju prva i posljednje revizije pokušaja, zaključane snimke, snimke s komentarom/korekcijom i sve snimke s izvještajem provjeravača ili poslom koji još može dati rezultat. Izbrisati se mogu samo stari međukoraci te njihovi zamijenjeni poslovi bez izvještaja. Očuvani izvještaji namjerno mogu ograničiti količinu oslobođenog prostora.

## Privatna sigurnosna kopija i povrat

Kopija je JSONL iz dosljedne InnoDB snimke svih aplikacijskih tablica, uz verzije i checksum migracija, kontrolni zbroj te broj zapisa. Svi sadašnji projektni resursi ugrađeni su u spremljene projektne ili zadatkovne JSON dokumente. Kopija ne izvršava SQL iz ulazne datoteke, ne koristi `eval`, ne gasi strane ključeve i ne uključuje privatnu konfiguraciju. Lozinke ostaju hashirane kao u bazi. Datoteka sadrži privatne školske podatke i mora ostati izvan `web/`, na zaštićenom disku; na Linuxu nastaje s pravima 0600. SHA-256 otkriva oštećenje; nije šifriranje ni dokaz autorstva kopije.

Povrat je dopušten samo u novu praznu migriranu bazu iste inačice, s izvornim privatnim ključem aplikacije i novom praznom mapom sesija. Oštećenje, prekinut zapis, pogrešna struktura, neodgovarajući ključ ili neprazna baza odbijaju se. Uvoz je jedna transakcija. Izvorni računi, predaje, izvještaji, odluke i snimke ostaju očuvani; stare sesije ne prenose se, a zatečene isporuke provjeravača vraćaju se u red. Privatnu konfiguraciju i izvorni ključ čuvaj zasebno od javnog programskog paketa. Ciljni web i radnik ostaju zaustavljeni do završetka povrata i provjere prijave.

Migracije, kopiranje i povrat dijele zaključavanje održavanja kako se shema ne bi mijenjala tijekom kopije. Kopija može nastati uz učenički rad; poslužiteljski snapshot određuje dosljednu vremensku točku. Ponovno izvođenje migracije 007 ne mijenja ranije korisnike ni zapise.

## Instalacija i provjere

Nadogradnja s 23G zahtijeva novu ponovljivu migraciju **007_reports_administration.sql**. Sačuvaj privatnu konfiguraciju i sesije, zamijeni paket, pokreni `migrate` i ponovno pokreni radnik. Automatske rubrike i njihov opseg ostaju **18/268 kombinacija**, s ranijim inačicama `23E.1` i `23G.1`.

Naredbe za kopije, povrat i politiku čuvanja opisane su u [školskim uputama](../school/README.md#23h--izvještaji-korekcije-arhiva-i-sigurnosne-kopije). Zapisi provjera ove etape nalaze se u `stage23h-evidence/`. Lokalno su provedene sljedeće provjere:

| Provjera | Rezultat |
| --- | --- |
| Projekti, sklopovi, vodovi, URS, katalog, sinkronizacija i React tijek, uključujući CSV/ZIP i nove komponente | 351/351 |
| Stvarni PHP 8.4.27 i MySQL 8.4.7: računi, razredi, portal, spremanje, React/PHP tijek, red bodovanja i predaje | 76/76 |
| Novi PHP/MySQL scenariji postignuća, korekcija, odabira predaje, 104 zapisa/paginacije, arhive, čišćenja i povrata | 8/8 |
| Školski ZIP i svaki SHA-256 inventara; privatni API izvan predmemorije | 2/2 |
| GitHub Pages podputanja i offline paket | 8/8 |
| PHP sintaksa svih 17 datoteka i TypeScript | prolaz |

Novi povratni scenarij stvarno obnavlja prijavu postojećim računom, zaključane hashove, izvorne i korigirane rezultate, povijest komentara, početne SD medije i oba radio čvora. Oštećena kopija odbija se bez djelomičnog uvoza. U početnoj regresiji računa test je još očekivao šest migracija; očekivanje je usklađeno sa sedmom. Ista regresija otkrila je preširoko povećanje ograničenja zahtjeva: stari putovi vraćeni su na 8 KiB, samo novi zapis pregleda ima 16 KiB. Cijela skupina računa ponovno prolazi 16/16; početni zapis ostaje sačuvan i ne pribraja se konačnim rezultatima.

Pokušaj slikovnog Chrome pregleda lokalno se nije pokrenuo jer okruženje ne dopušta potreban Unix socket. Stvarne React komponente provjerene su u JSDOM-u, uključujući siguran tekst, null/0 i opoziv pristupa; to nije tvrdnja o vizualnoj provjeri ciljnog preglednika.

Stvarni školski pilot 23I, opterećenje učionice, Windows i ciljni mobilni preglednici ostaju zasebne provjere. Ova etapa ne proglašava stabilnu v1.0 niti službeno bodovanje svih 268 kombinacija.

## Potvrđena integracija i objava

[GitHub integracija 43746530924](https://github.com/zljix/labosv2/actions/runs/43746530924) prošla je za izvor `cc1c19d42acdbc4bae10100422cb3666b98bad44`, uključujući neovisne Arduino prijevode i stvarne PHP/MySQL scenarije izvještaja, korekcija, arhive, čuvanja i povrata. Izdanje je spojeno kroz [PR #6](https://github.com/zljix/labosv2/pull/6) kao `e9cfed2394a7f10d6056502909fcab3cadab4800`. [GitHub Pages objava 43747011717](https://github.com/zljix/labosv2/actions/runs/43747011717) završila je uspješno. Naknadno su dopunjeni samo ovaj zapis i status provjera. Stvarni školski pilot ostaje zasebna provjera.
