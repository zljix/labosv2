# Etapa 23D · automatsko spremanje i pregled rada

**0.13.3-beta.1 · 15. studenoga 2026.** Polazište je objavljena 23C, `zljix/labosv2@613a470c27712aa5ae6f8cb0bed997414e3d1046`. Nastavlja se postojeći plan školskog PHP/MySQL sustava. Izvorne URS, LV1/LV2 i V1–V5 numeracije ostaju sačuvane.

## Isporučeno

- Migracija `004_work_snapshots.sql`: učenički pokušaj vezan uz konkretnu dodjelu i nepromjenjive radne snimke s revizijom, hashom sadržaja i oznakom zahtjeva.
- Prvo otvaranje dodijeljene vježbe stvara početnu snimku. Ponovno otvaranje na istom ili drugom računalu vraća posljednju potvrđenu reviziju istog pokušaja.
- U simulatoru se sprema nakon 3 sekunde mirovanja, uz cilj od najviše 15 sekundi neprekinutog uređivanja. Potvrda čuva očekivanu reviziju, bez dodatnog koraka u uređivačevoj povijesti poništavanja.
- Vidljivo razlikovanje lokalnih izmjena, slanja, potvrđenog spremanja, pogreške i sukoba. Poslužiteljsko vrijeme prikazuje se za Europe/Zagreb. Lokalni oporavak i ZIP/JSON izvozi ostaju dostupni.
- Ponovljeni isti zahtjev vraća istu reviziju. Izgubljeni odgovor ne uzrokuje dupliranje; novije lokalne izmjene šalju se tek nakon rješavanja prethodnog zahtjeva.
- Svaka kartica pamti vlastitu baznu reviziju. Zastarjelo spremanje ne prepisuje noviji rad. Usporedba pokazuje izvore, odgovore i sklop obaju čvorova; izbor lokalne verzije ponovno provjerava upravo pregledanu reviziju.
- Skupni nastavnički pregled za odabrani razred i dodijeljenu vježbu, s osvježavanjem svakih 5 sekundi dok je kartica vidljiva, dobi podataka, statusom i revizijom. Obuhvaća i nezapočete radove. Stranice imaju do 200 učenika.
- Pregled točne snimke i povijesti, čitanje izvora i veza te JSON izvoz. Odabrani detalj ostaje fiksan dok nastavnik ne zatraži noviju snimku. Pokus otvara zasebnu lokalnu kopiju, bez povezivanja s učeničkim pokušajem.
- API ponovno provjerava prijavu, članstvo, ovlasti, dostupnost dodjele i vlasništvo. Nastavnik ne sprema učenikov pokušaj. Promjena prijavljenog računa ne prenosi lokalni rad drugom učeniku.
- Zamrznuti početni projekti sada čuvaju prazne objekte svojstava. Pri čitanju starih predložaka popravlja se poznati raniji prijenos `{}` u `[]`, bez promjene objavljenih uputa i rubrike.
- Korijenski školski ZIP, javno Pages izdanje, upute za nadogradnju s 23C i dopunjeni Actions s pet odvojenih testnih baza.

## Provjere

| Skup | Rezultat | Dokaz |
| --- | --- | --- |
| Ciljana regresija, katalog i sinkronizacija | 356/356, bez preskakanja | `stage23d-evidence/regression.tap`: projekti, sklopovi, vodovi, lokalni pregled, URS, zamrznuti katalog i 13 scenarija sinkronizacije |
| Poslužiteljski rad 23D | 13/13 zapisa, 12 scenarija | `work.tap`: stvarni PHP/MySQL, konkurentni početak i spremanje, ponovljivost, povijest, prava i svih 268 ciljnih predložaka |
| React učenički i nastavnički tijek | 5/5 zapisa, četiri scenarija | `work_ui.tap`: stvarne komponente i stvarni API, prekid veze, usporedba, izbor, siguran tekstualni prikaz i uklanjanje privatnog popisa nakon odjave |
| Računi 23B | 16/16 zapisa, 15 scenarija | `accounts.tap`: migracije, prijava, sesije, ovlasti i opoziv |
| Razredi i dodjele 23C | 17/17 zapisa, 16 scenarija | `classes.tap`: uvoz, identiteti, kodovi, inačice i dostupnost |
| Portal 23C | 5/5 zapisa, četiri scenarija | `portal.tap`: stvarni moduli portala uz PHP/MySQL |
| Školski ZIP | 2/2 | `package.txt`: svaka datoteka odgovara inventaru; privatni kod i SQL ostaju izvan weba; API ne ulazi u offline predmemoriju |
| Pages | 8/8 | `pages.txt`: podputanja, resursi i offline opseg |
| Izgradnja i statičke provjere | Prolazi | TypeScript, Vite, sintaksa svih PHP datoteka, YAML i `git diff --check` |

Nadređene testne grupe nisu dodatni korisnički scenariji. Provjere 268 početnih kombinacija prolaze kroz više skupova i ne zbrajaju se u tvrdnju o 268 različitih rubrika. U API prolasku svih 268 vraćenih projekata ponovno se provjerava i stvarnim `parseProject` parserom simulatora.

Novi vremenski scenariji sinkronizacije koriste kontrolirani sat: dokazuju debounce, maksimalni interval pri neprekinutom unosu, izmjene tijekom slanja, izgubljenu potvrdu, zaštitu stare revizije, izričit izbor i uklanjanje kasne potvrde pri promjeni projekta. Ne predstavljaju mjerenje školskog opterećenja.

Integracijski pokusi izvedeni su na razvojnom Linuxu uz **PHP 8.4.24** i **MySQL Community Server 8.4.7**. Svaki skup imao je zasebnu praznu bazu i ograničeni sintetski račun. HTTP profil bio je izričiti loopback profil; taj rezultat nije potvrda školskog HTTPS/LAN pristupa. Privatna konfiguracija, sesije i vjerodajnice nisu u Gitu ili paketu.

React i portal provjereni su kroz jsdom sa stvarnim API-jem. Lokalni Chromium nije se mogao pokrenuti zbog zabrane njegova UNIX socketa u izvršnom okruženju. Zato se ne proglašava vizualna potvrda Chromea, Safarija, mobilnog rasporeda ili stvarnog školskog uređaja.

## Granice i nastavak

Ova etapa sprema i prikazuje rad; **ne dodjeljuje službene bodove i ne zaključava predaje**. Rezultat ima `points: null`, a sučelje kaže da bodovanje još nije uključeno. Nezapočeto i nepodržano nisu osvojena nula. Klijentski rezultat, uvezeno ime ili izmijenjena lokalna oznaka nemaju autoritet školskog identiteta i rubrike.

PHP provjerava strukturu, veličinu datoteka, cilj, topologiju čvorova i pripadnost pokušaju. Ne izvodi program i ne proglašava električnu ili funkcionalnu ispravnost. Puna provjera sklopa i ponašanja pripada bodovanju.

Ranije potvrđene snimke ostaju nepromjenjive. Stare revizije nisu automatski očišćene; politika čuvanja i arhiviranje pripadaju 23H. Pri prekidu veze nespremljene izmjene ostaju na izvornom uređaju ili u njegovu izvozu. Već preuzeta lokalna kopija ne briše se uklanjanjem članstva.

Slijede **23E: službeno bodovanje prvih triju vježbi**, zatim **23F: transakcijsko zaključavanje i dorada kroz novi povezani pokušaj**. Postojeći probni provjeravač 23A ostaje `feasibility-only`. Stvarni školski poslužitelj, 30 učenika, Windows, ciljni mobilni preglednici, povrat sigurnosne kopije i fizička oprema imaju zasebne otvorene provjere.

Instalacija, rad učenika/nastavnika i nadogradnja s 23C opisani su u [školskim uputama](../school/README.md).
