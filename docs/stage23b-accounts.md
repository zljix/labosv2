# Etapa 23B · baza, prijava i korisničke uloge

**0.13.1-beta.1 · 15. studenoga 2026.** Polazište je završena etapa 23A u `zljix/labosv2`, commit `716d15f327c1d942b2909d59d5fda5a63c0c5744`. Postojeće URS teme, projekti, izvozi i dorade vodova zadržani su.

## Isporučeno

- MySQL migracije s inačicom i checksumom, zaključavanjem pri pokretanju i očuvanjem postojećih korisnika pri ponavljanju.
- Privatna CLI inicijalizacija jednog administratora. Nema zadane lozinke ili javne instalacijske rute; inicijalizacija se zatvara nakon stvaranja korisnika.
- Prijava i odjava, obnova identifikatora sesije, CSRF, provjera izvora zahtjeva i ograničavanje prijava koje ostaje u MySQL-u.
- Uloge učenik, nastavnik i administrator, stvaranje računa, obvezna promjena privremene lozinke, promjena vlastite lozinke i reset za dopuštenog korisnika.
- Opoziv starih sesija promjenom lozinke, aktivnosti ili uloge. Vlastita deaktivacija/demotiranje administratora nije dopušteno.
- Portal `school.html#account` s prijavom, vlastitim računom, popisom dopuštenih korisnika i administratorskim obrascima. Poveznica iz simulatora prikazuje ime prijavljenog korisnika kada školski API odgovori.
- Zapisi prijave, odjave, stvaranja računa, promjene ovlasti i lozinki, bez lozinki ili tokena u zapisu.
- Školski ZIP s PHP aplikacijom i migracijama izvan javnog `web/` korijena. Pakiranje uključuje samo primjer konfiguracije.

API uzima ulogu i identitet iz sesije i baze. Slanje drukčije uloge ili identiteta u zahtjevu ne daje dodatne ovlasti. Nastavnik ne dobiva pravo na sve učenike: pristup se provjerava kroz njegovo članstvo u razredu. Temeljne tablice razreda postoje radi te granice; njihovo upravljanje kroz sučelje ostaje etapa 23C. Nastavniku bez dodjele prikazuje se prazan popis. Administrator već može upravljati školskim računima.

## Provjere

| Skup | Rezultat | Opseg |
| --- | --- | --- |
| Stvarni PHP/MySQL računi | 15 scenarija, 16/16 testnih zapisa uključujući nadređenu grupu | Migracije, inicijalizacija, prijava, ovlasti, promjene/reset lozinki, sesije i paralelni zahtjevi |
| Ciljana regresija | 78/78, bez preskakanja | Projekti, sklopovi, vodovi, raniji pregled razreda i neovisno MicroPython/AVR izvršavanje |
| Školski paket | 2/2 | Svaka datoteka ZIP-a odgovara inventaru; privatni API ne ulazi u offline predmemoriju |
| Pages | 8/8 | Podputanja `/labosv2/`, uključujući poveznice školskog portala, resurse i offline opseg |
| Izgradnja | Prolazi | TypeScript i Vite te školski izvršni adapteri |
| Preglednik | Referentni MicroPython pokus prolazi | Chrome: WASM, Worker i izvršavanje referentnog programa sa školske stranice |

Zapisi računa i ciljane regresije su u `stage23b-evidence/accounts.tap` i `regression.tap`. Skupovi se ne zbrajaju kao da su svi pojedinačni testni zapisi međusobno različiti; nadređena grupa računa nije zaseban korisnički scenarij.

API testovi pokreću stvarni PHP 8.4.24, PDO MySQL i MySQL Community Server 8.4.7 u zasebnoj praznoj razvojnoj bazi, s računom ograničenim na tu bazu. Korisnici i lozinke su sintetski, a konfiguracija i sesije ostaju u privatnoj privremenoj mapi koja se nakon testa uklanja. Razvojne zakrpe nisu preporuka da školska instalacija ostane na njima: treba koristiti aktualne zakrpe dogovorenih grana.

HTTP integracija u ovoj etapi provjerena je na izričitom loopback razvojnom profilu. Parametri Secure/HttpOnly/SameSite i istek sesija zasebno su provjereni. Time se ne tvrdi da je nova prijava prošla stvarni školski HTTPS, Windows ili mobilni preglednik. Raniji stvarni Apache/HTTPS dokaz etape 23A ostaje povijesni dokaz isporuke, a nije nova provjera prijave.

Negativni scenariji potvrđuju da učenik ne može čitati tuđi profil, popis računa ili mijenjati ovlasti; nastavnik ne može resetirati učenika izvan svojeg razreda. Promijenjena migracija odbija se, nepoznat korisnik i pogrešna lozinka daju istu poruku, a deset paralelnih pogrešnih prijava za isti novi račun daju osam odbijenih pokušaja i dva ograničena zahtjeva. Reset i promjena lozinke gase prethodne prijave. Ponovna migracija čuva postojeće hashove lozinki.

## Dostupnost i nastavak

GitHub Pages objavljuje simulator i javni prikaz školskog izdanja. Prijava se izvršava na školskom PHP/MySQL poslužitelju; Pages nema PHP. Statičko izdanje zato prikazuje objašnjenje i zadržava simulator i izvoze.

Prijavljeni račun još nije vezan uz lokalne projekte. Središnje automatsko spremanje, nastavnički pregled rada preko API-ja, službeno bodovanje i zaključavanje pripadaju etapama 23D–23F. Raniji lokalni Pregled razreda i probna rubrika 23A ostaju odvojeni od službene evidencije.

Slijedi **23C: školska godina, razredi, dodjele nastavnika, CSV uvoz učenika, pozivni kodovi i verzionirane dodijeljene vježbe**. Stvarni školski LAN/HTTPS pilot i opterećenje razreda i dalje su otvorene provjere.

Instalacija, migracije, prvi administrator, ovlasti i nadogradnja: [školske upute](../school/README.md). Izvorni plan dorada od 14. studenoga zadržan je.
