# Etapa 23F · zaključane predaje i dopuštena dorada

**0.13.5-beta.1 · 15. studenoga 2026.** Polazište: objavljena 23E, `f6ede55c0170989e555bf1aac6393812836bc4c1`. Nastavlja se postojeći PHP/MySQL sustav i tri službeno podržana pilota; rubrike i ciljevi bodovanja nisu prošireni ovom etapom.

## Učenikov završetak

Gumb **Završi i zaključaj vježbu** najprije dovršava spremanje. Ako autosave već traje, čeka njegov odgovor pa sprema noviju lokalnu izmjenu. Izgubljena potvrda spremanja zadržava isti zahtjev; sukob, prekid veze ili promjena računa zaustavljaju završetak.

Završni sažetak prikazuje identitet iz računa, razred, inačicu uputa, pokušaj, točnu spremljenu reviziju, potvrđene bodove i neostvarene kriterije. Učenik može završiti i bez svih bodova. Čekanje, tehnička pogreška i nepodržana provjera ne postaju nula. Posljednja potvrda šalje samo pokušaj, reviziju i oznaku zahtjeva; klijentski bodovi i identitet ne ulaze u odluku.

MySQL transakcija zaključava račun, razred i pokušaj istim redoslijedom kao spremanje. Provjerava ovlasti i aktualnu reviziju, zapisuje jedinu predaju uz točnu nepromjenjivu snimku te zaključava pokušaj. Jedinstveni ključ po pokušaju i transakcijska provjera osiguravaju da dva završetka iste revizije vraćaju jednu predaju. Kasni novi autosave odbija se; ponavljanje ranije potvrđenog autosavea može vratiti staru potvrdu bez izmjene sadržaja.

Predaja sadrži vezu na snimku, hash sadržaja, inačicu zadatka i hash zamrznutih uputa/rubrike/predloška. Sama snimka čuva izvorne datoteke, sklop, odgovore, početne medije i drugi radijski čvor gdje postoje. Broj i vrijeme predaje određuje poslužitelj; prikaz koristi Europe/Zagreb. Gubitak HTTP odgovora ne znači da je transakcija poništena: sučelje kaže da potvrda još nije stigla i omogućuje ponavljanje istog zahtjeva.

Nakon potvrde učenik vidi sadržaj zaključane predaje i bodove vezane uz njezinu reviziju. Uređivanje toga školskog pokušaja je zatvoreno. Za slobodan pokus postoji zasebna lokalna kopija; ona nema pravo mijenjati predaju. Ponovno otvaranje dodijeljene vježbe vraća zaključani pokušaj dok nastavnik ne dopusti novi.

## Bodovi nakon zaključavanja

Zaključavanje sadržaja ne čeka provjeravač. Posao i rezultat ostaju vezani uz istu snimku i objavljenu rubriku. Rezultat koji stigne nakon završetka ili nakon otvaranja dorade ostaje na izvornoj reviziji. Tehnički neuspjelu provjeru moguće je ponovno zatražiti i za zaključani sadržaj, uz očuvanje ranijih izvještaja.

## Nastavnikova dorada i pregled

U **Školskom pregledu rada** nastavnik otvara zaključanu predaju, upisuje razlog i odabire **Dopusti doradu kao novi pokušaj**. Poslužitelj ponovno provjerava nastavničku pripadnost razredu. Stvara novi numerirani pokušaj iz prethodne snimke, s novim identitetom projekta i vlastitom prvom revizijom. Izvorna predaja, njezine snimke i izvještaji ostaju zaključani. Veza čuva razlog, nastavnika i vrijeme; događaj se zapisuje i u revizijsku evidenciju.

Ponovljeni isti zahtjev za doradu vraća isti novi pokušaj. Drugi zahtjev za već otvorenu doradu odbija se. Učenik ga otvara kroz dodijeljenu vježbu ili **Provjeri dopuštenu doradu / otvori najnoviji pokušaj**.

Pregled razreda prikazuje posljednji radni pokušaj, broj pokušaja, status **Dorada dopuštena**, radne bodove i odvojeno **posljednju zaključanu predaju** s njezinim bodovima. Otvorena dorada ne briše prethodni službeni rezultat. Nakon završetka dorade posljednja zaključana predaja postaje nova aktualna predaja. Učenik i nastavnik mogu pregledati povezanu povijest, uključujući razlog dorade i povijesne bodove. Povijest i revizije imaju odvojeno straničenje.

## Instalacija i provjere

Nadogradnja s 23E: sačuvaj privatnu konfiguraciju i sesije, zamijeni programski paket pa pokreni postojeću naredbu `migrate`. Nova migracija **006_submissions.sql** stvara dvije tablice; ranije migracije ostaju neizmijenjene. Ponovljena migracija ne uklanja korisnike, revizije, izvještaje ni predaje.

- `test:school-submissions`: stvarni PHP/MySQL, ovlasti, maksimalna duljina ključa, dva paralelna završetka, kasni autosave, sukob završetka i spremanja, izgubljeni odgovor, dopuštena dorada, povijesni i zakašnjeli bodovi te ponovljena migracija.
- `test:school-finish-ui` i `test:school-sync`: React sažetak, blokiranje završetka bez spremljene revizije, promjena rada nakon sažetka, ponavljanje istog završetka i dovršavanje autosavea koji već traje.
- `test:school-work-ui`: stvarne React komponente uz PHP/MySQL, od izmjene preko sažetka i zaključavanja do nastavnikova dopuštanja dorade i učenikova nastavka.
- Regresija računa, razreda, portala, reda provjera, kataloga 268 početnih kombinacija, projekata, vodova, paketa i Pages putanje ostaje u razvojnom postupku.

Zapisi lokalnih provjera nalaze se u `stage23f-evidence/`. Stvarna PHP/MySQL integracija i cijeli React tijek prošli su u [Actions postupku 43738711916](https://github.com/zljix/labosv2/actions/runs/43738711916). Testovi koriste zasebne prazne baze, bez stvarnih učeničkih podataka.

Lokalno su prošle 88/88 provjera regresije, 22/22 provjere klijenta i paketa (dijelom isti skupovi), 8/8 Pages provjera, 2/2 završne provjere školskog ZIP-a i sintaksna provjera svih 15 PHP datoteka uz PHP 8.4.27. Stvarna integracija uz MySQL 8.4.7 i PHP 8.4 prošla je u Actionsu prije spajanja izdanja, uključujući paralelni završetak/spremanje, povezanu doradu, zakašnjele rezultate i stvarni React tijek. To nije vizualna potvrda Safarija/iOS-a ili fizičkog školskog poslužitelja.

## Granice

Ovom etapom povezan je cijeli programski tijek triju pilota: prijava, dodjela, spremanje, bodovanje, završetak, zaključana predaja, pregled i dopuštena dorada. To ne potvrđuje školski pilot s 30 učenika. Službeno bodovanje preostalih kombinacija, izvještaji i sigurnosne kopije pripadaju 23G–23I. PHP/MySQL i dalje zahtijevaju školski poslužitelj; GitHub Pages prikazuje simulator i javne upute.

Za osnovu transakcijskog postupka ponovno je provjerena [službena dokumentacija MySQL 8.4 o locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html). Točnost aplikacijskog tijeka provjeravaju integracijski pokusi, a ne sama dokumentacija.
