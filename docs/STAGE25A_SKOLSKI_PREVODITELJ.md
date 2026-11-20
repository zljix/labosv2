# Labos 0.15.0-beta.1 · 25A · školski C++ prevoditelj

Ovo izdanje razvija repozitorij **zljix/labos** iz podloge 24Q beta.2
(`e5e65297ef23a5cd18497f956f1d3a702add7afe`). Izvorni repozitorij labosv2 nije mijenjan.

## Učenik

Na školskoj HTTPS adresi prijavi se i otvori vježbu. U prozoru **Prevedi** odaberi
**Školski poslužitelj**. Dostupnost se provjerava zasebno za Uno, klasični Nano i
ESP32-S3 C++. Nakon izmjene izvora klikni **Prevedi program**, pričekaj stanje
**Spremno za pokretanje**, zatvori prozor i pokreni simulaciju. Na računalu učenika
nisu potrebni Node.js ni Arduino CLI. MicroPython se i dalje pokreće izravno.

Pogreška u C++ programu prikazuje datoteku, redak i stupac kada ih prevoditelj vraća.
Klik na poruku otvara izvor. U radijskom paru svaki čvor ima vlastiti zahtjev i cilj.
Promijenjeni izvor, biblioteke, pločica ili identitet čvora odbacuju stari rezultat.

Na **GitHub Pagesu** nema PHP-a, baze ni poslužiteljskog prevoditelja. Ondje rade
pripremljeni primjeri i lokalni prevoditelj, koji se izričito bira u istom prozoru.
ESP32-S3 rezultat jest funkcionalni WASM za simulator, a ne firmware za fizičku pločicu.

## Instalacija i uključivanje

1. Izradi i provjeri sigurnosnu kopiju baze i privatne konfiguracije. Nadogradnju
   najprije iskušaj u odvojenoj instalaciji; sačuvaj postojeći ključ i sesije.
2. Izgradi školski paket naredbom `npm ci` pa `npm run build:school`. Raspakiraj
   `release/Labos_0.15.0_25A_Skolski.zip`. Zamijeni kompletan paket, ne samo `web/`.
3. Pokreni `php tools/console.php migrate /srv/labos-private/config.php`.
   Nova je samo migracija **008_interactive_compile.sql**; 001–007 ostaju neizmijenjene.
4. Pripremi iste zaključane alate i Linux izolaciju koji se koriste za službeno
   bodovanje: Node.js 24, PHP 8.4/8.5, MySQL 8.4, user namespaces, bubblewrap s
   podrškom `--size`, `prlimit`; za AVR Arduino CLI 1.3.1, core 1.8.6 i zaključani
   avr-gcc; za S3 Clang 19.1.7, lld i Binaryen 120. Biblioteke su zaključane u paketu.
5. U privatnoj konfiguraciji dodaj `'interactive_compile' => ['enabled' => true]`.
   Bez te opcije servis ostaje isključen, a postojeće školske funkcije rade kao prije.
6. Radnom procesu postavi privatni `LAB_SCHOOL_CONFIG`, `LAB_ARDUINO_CLI` (apsolutna
   putanja), `LAB_ARDUINO_DATA` (zaključani data direktorij). Po potrebi postavi
   `LAB_WASM_CXX`, `LAB_WASM_OPT` i `LAB_S3_TOOLCHAIN` za administratorski odabrani
   direktorij alata. Taj direktorij mora sadržavati kompatibilne zaključane alate.
7. Iz korijena raspakiranog paketa pokreni `node tools/compiler-worker.mjs --probe`.
   Provjera stvarno prevodi izmijenjeni program u istoj izolaciji kao učenički zahtjevi.
   Nedostupan S3 ne blokira Uno/Nano. `--probe` samo provjerava: za obradu reda mora
   raditi `node tools/compiler-worker.mjs`.
8. Prilagodi `apache/labos-compiler.service.example` stvarnim putanjama, računu i
   privatnoj datoteci okruženja. Uključi jednu instancu servisa. Provjeri sva tri
   cilja kroz prijavljeni preglednik. Nastavnik u prozoru Prevedi vidi stanje reda,
   bez izvora drugih učenika.

## Izolacija, red i podaci

PHP prihvaća podatke kroz postojeću prijavu, CSRF i ovlasti. U red se spremaju samo
C++ izvori, biblioteke, cilj i identitet čvora; osobne bilješke i rezultati bodovanja
nisu ulaz prevoditelja. Zahtjev dodijeljene vježbe provjerava vlasnika, pristup i
zaključavanje. Nastavnička proba i slobodni projekt osobni su pokusi.

Najviše su dva aktivna zahtjeva po računu, 12 novih u minuti i 30 ukupno u redu.
Početni profil obrađuje jedan interaktivni posao istodobno, redom pristizanja.
Službeno bodovanje ima svoj postojeći radni proces. Odvojena systemd ograničenja
interaktivnog procesa (2 GiB, jedan CPU) treba prilagoditi tek prema mjerenju hosta.
Učenikov prijevod nikada ne određuje službene bodove.

Ponovljeni zahtjev s istom oznakom i istim ulazom vraća isti posao. Izgubljeni mrežni
odgovor ne stvara drugi posao. Prevođenje ima 90 s zidnog vremena, 120 s najma,
ograničene izlaze, datoteke i memoriju te nema mrežu ni privatnu konfiguraciju.
Otkazivanje odbacuje rezultat i radni proces prekida izvođenje nakon provjere
statusa (uobičajeno unutar sekunde). Bez veze ostaju vremenska ograničenja.
Zaustavljeni proces završava posao kao tehničku pogrešku nakon isteka najma;
neobrađeni zahtjev istječe nakon 10 minuta. Nema nesigurnog zamjenskog izvođenja.

Privremeni prijevod učitava se u kopiju za simulaciju. Ne mijenja školsku reviziju,
ne pokreće bodovanje i ne mijenja zaključanu predaju. Predmemorija je vezana uz
izvor, sve biblioteke, pločicu i zaključane verzije alata. Izvorne izmjene nastavljaju
se spremati uobičajenim školskim postupkom. ZIP iz prozora Prevedi može uključiti
važeći rezultat i nakon privremenog školskog prijevoda.

Izvori i rezultati u redu čuvaju se najviše jedan dan nakon završetka. Nakon toga
ostaje oznaka isteka, koja se briše nakon sedam dana. Čišćenje izvršava radni proces
i čitanje statusa; administrator ga može pokrenuti naredbom
`php tools/compilation.php cleanup /srv/labos-private/config.php`.

## Isključivanje i povrat

Postavi `interactive_compile.enabled=false` i zaustavi samo servis prevođenja.
Postojeći radovi, bodovanje i lokalni most ostaju dostupni. Nemoj brisati tablice
radi povrata aplikacije. Ako je potreban puni povrat, vrati provjerenu kopiju
programa i baze u odvojenom terminu prema školskoj proceduri.

## Opseg prihvata

Izdanje je **tehnički pregled**, ne potvrda učioničkog pilota. Automatizirani prihvat
obuhvaća klijentski oporavak, dijagnostiku, odbacivanje pogrešnog čvora, privremeni
prijevod bez nove radne revizije, stvarni PHP/MySQL red, ovlasti, otkazivanje,
istek najma, ograničenja i čišćenje. Zasebni Linux CI poslovi prevode nove programe
za sva tri cilja, ponavljaju prijevod, provjeravaju sintaksnu pogrešku i izvršavanje.

Prije cijelog razreda preostaje pilot na stvarnom školskom poslužitelju: čist Windows
klijent bez alata, 3–5 učenika, stvarni prekid mreže, opterećenje 1/5/30 zahtjeva
uz istodobno službeno bodovanje i predaju te mjerenje ukupnog RAM-a i čekanja.
Ti rezultati nisu zamijenjeni razvojnim testovima niti unaprijed proglašeni uspješnima.
