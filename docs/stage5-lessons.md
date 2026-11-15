# Nastavne vježbe, predaja i nastavnikov pregled · v0.2.0

Datum: 12. studenoga 2026.

## Status isporuke

Razvojni dio etape 5 je implementiran i prolazi provjere. **Stvarni pilot s učenikom koji nije sudjelovao u razvoju i školskim računalom nije proveden.** Kriterij završetka cijele etape 5 zato još nije potvrđen. Ovo je nastavna beta; status v1.0 i offline podrška nisu proglašeni.

## Pet postupnih vježbi

| Vježba | Početni zadatak | Provjera ponašanja |
| --- | --- | --- |
| V1 · LED i vrijeme | Spojiti nedostajući vodič e8 → LED A; izmijeniti 500/500 na 250/750 ms. | Tri potpuna ciklusa; uključenje 180–380 ms i isključenje 650–1000 ms. |
| V2 · Tipkalo | Dopuniti izlaz prema aktivno niskom ulazu PULL_UP. | Otpušteno → pritisnuto → otpušteno → pritisnuto → otpušteno; LED 0/1/0/1/0. Promatra se nakon 300 ms. |
| V3 · ADC/PWM | Očitanje read_u16 prenijeti u radni omjer. | Klizač 0/25/50/100 %. PWM mora postojati; krajevi ugašeno/uključeno, međupoložaji oko 27/53 % najveće LED svjetline. |
| V4 · AHT10/OLED | Dopuniti prikaz relativne vlage uz temperaturu. | Okoliš 20/40 → 34/40 → 34/70 → 20/40 (°C/% RH). Za svaki korak novo mjerenje i obje brojke u stvarnim OLED pikselima. |
| V5 · Regulator | Jedan prag 28 °C zamijeniti pragovima 28/26 °C uz memoriju stanja. | 24 → 29 → 27 → 25 → 27 → 29 °C; servo 0 → 90 → 90 → 0 → 0 → 90°, uz mjerenje i OLED prikaz. |

Svaka vježba ima cilj, predznanje, objašnjenje triju novih pojmova, referentne veze, vođeni primjer, samostalni rad, pomoć, funkcionalnu provjeru i pitanja za opažanja. Nastavnički uzorci otvaraju zaseban riješeni projekt. Dostupni su i učeniku u ovoj lokalnoj beti, bez odvojenih uloga.

U Svojstvima odabrane komponente dodana je pomoć za spajanje i programiranje: što je električna veza, što programska naredba i koje datoteke trebaju. Dosadašnji katalog i dijagnostika ostaju dostupni.

## Ugovor provjere

Provjera koristi vlastiti Worker sa stvarnim MicroPython WASM interpreterom i jednom kopijom trenutačnog projekta. Ne traži jednakost izvornog koda ili naziva varijabli. Drugi podržani GPIO, drukčiji identifikatori komponenti, funkcije i struktura koda mogu proći ako daju očekivano ponašanje. Za vježbe je potreban po jedan ciljni LED, tipkalo, potenciometar, senzor, zaslon ili servo kako je primjenjivo.

Ne uspoređuje se tekst iz konzole umjesto izlaza sklopa. OLED provjera pretražuje stvarni framebuffer za brojke s jednim decimalnim mjestom iz standardnog `framebuf.text()` fonta, na proizvoljnom položaju. To je izričit zahtjev zadatka V4/V5; prilagođeni font ili drukčije zaokruživanje nisu obuhvaćeni tom provjerom. Histereza se ispituje povratkom u isto područje iz obaju smjerova. Granice točno na 26/28 °C nisu dodatno klasificirane zbog kvantizacije očitanja.

Senzorski scenariji čekaju najviše 3400 ms po koraku. Provjera zaključuje tek nakon novog mjerenja za zadani okoliš; ranija slika ili raniji uzorak nisu dovoljni. Servo ima toleranciju položaja manju od 2°. Vremenski pragovi su praktične granice funkcionalne provjere u pregledniku, ne jamstvo izvođenja u stvarnom vremenu. Usporeno ili pozadinsko izvođenje može zahtijevati ponavljanje provjere.

Početne vrijednosti za probnu sesiju su tipkalo otpušteno, potenciometar 0 %, AHT10 24 °C / 50 % RH. Spremljeni početni okoliš i nacrt izvornog projekta ostaju sačuvani. Redovito Pokreni/Reset ne radi paralelno s provjerom. Prekini provjeru zaustavlja Worker; promjena koda/sklopa ili projekta prekida staru provjeru i ne sprema njezin zakašnjeli rezultat.

Automatska provjera nije ocjena obrazloženja, autorstva ili svih mogućih programa/ulaza. Nastavnik pregledava i sklop, kôd, opis opažanja te prema potrebi provodi dodatni pokus.

## Format, pohrana i predaja

Format ostaje `schemaVersion: 2`, sklop `modelVersion: 1`. Prethodni projekti ostaju podržani. Sve obrazovne datoteke koriste postojeći manifest/arhivu i postojeće lokalno spremanje.

| Datoteka | Svrha |
| --- | --- |
| `vjezba.json` | Poznati identifikator/revizija vježbe, ime i prezime, razred/grupa te odgovori; ograničene duljine i broj odgovora. |
| `upute.md` | Čitljive upute u paketu. Prilikom predaje generiraju se iz ugrađene poznate vježbe. |
| `scenarij.json` | Opisni zapis scenarija i kriterija; ne određuje izvršne provjere. |
| `provjera.json` | Lokalni zapis provjere, očekivano/opaženo, vrijeme, inačica provjere, do 6000 znakova konzole i SHA-256 relevantnog sadržaja. |
| `predaja.md` | Pri izvozu sastavljen čitljiv pregled učenika, odgovora i provjere. |
| `main.py`, upravljački i korisnički moduli/podaci | Stvarni kôd i podaci programa. |

Obrazovne datoteke su vidljive i arhiviraju se, ali se **u poznatoj nastavnoj vježbi ne montiraju MicroPython programu**. Zato izmjena imena ili odgovora ne može postati skriveni ulaz programa niti zahtijevati ponovnu funkcionalnu provjeru. Obične korisničke tekstualne datoteke i dalje su dostupne programu i uključene su u fingerprint. Obični projekti bez prepoznate vježbe zadržavaju dotadašnje ponašanje datoteka.

Hash uključuje identitet i reviziju vježbe, profil pločice, cijeli sklop i sortirane programske datoteke. Ne uključuje ime projekta, editor, odgovore i opisne/zapisne datoteke koje se ne montiraju programu. Zbog konzervativne snimke sklopa i pomicanje komponente traži novu provjeru. Hash je veza sadržaja i zapisa, **nije potpis niti dokaz da zapis nije krivotvoren**.

Za „Preuzmi ZIP za predaju” traži se ime, razred/grupa, odgovori na sva pitanja i zapis provjere za trenutačni sadržaj. Dopuštena je predaja s neuspjelim provjerama. Učenik sam predaje ZIP dogovorenim putem; nema mrežnog slanja, razreda, računa ni središnje evidencije ocjena.

Nastavnik odabire Pregled predaje / Uvezi predaju. ZIP ili JSON otvara se kao zasebna zaustavljena kopija. Odabirom „Ponovi provjeru na ovom računalu” pokreće se aplikacijski scenarij poznate revizije i nastaje novi lokalni zapis. Uvezeni scenarij ili ranija tvrdnja da sve prolazi ne može odrediti stvarni ishod ponavljanja.

## Stvarno izvedene provjere

- Projekt/arhiva/IndexedDB/topologija: 26/26.
- Osnovni simulator: 12/12.
- Periferija i 205 dovršenih AHT10 pretvorbi: 16/16.
- Naslijeđena jezgra: 10/10; projektne datoteke: 3/3.
- Nastavni sloj: 20/20, uključujući pet stvarnih WASM uzoraka, alternativni kod/GPIO/identifikatore, negativne slučajeve, ZIP predaju, zastarjelost, neovjerene rezultate, izolaciju dokumentacije i prekid petlje bez čekanja.

Ukupno 87/87 programskih skupina; nije broj svih pojedinačnih tvrdnji. Zapisnici `results-stage5-*` i `stage5-reference-results.json` čuvaju rezultate.

Preglednik Chromium/Linux: potvrđeni su otvaranje ranijeg projekta, katalog pet vježbi, otvaranje V1, prikaz novih pojmova i početnog koda te početak zasebne provjere s onemogućenim redovitim Run/Reset. Nakon toga veza s preglednikom se prekinula; završni rezultat u sučelju, cijeli tok ZIP preuzimanja/ponovnog uvoza te izmijenjeni raspored s unutarnjim pomicanjem **nisu završno pregledani u ovoj etapi**. Programska ZIP provjera prolazi. To nije prijavljeno kao uspješan cjelovit preglednički ili učenički pilot.

Safari/iOS, Firefox, Edge, školsko računalo i fizički ESP32 nisu ispitani u ovoj etapi. WASM interpreter, C most i firmware/profil nisu mijenjani.

## Pilot i nastavak

`/pilot.html` daje prazan obrazac s oznakom sudionika bez imena, stvarnim računalom/preglednikom, trajanjem, opaženim koracima, pruženom pomoći, poteškoćama i zaključkom. Izvoz JSON-a ili ispis čuva uneseni zapis; nema automatske tvrdnje da je pilot proveden niti slanja podataka.

Za potvrdu etape 5 treba stvarni učenik samostalno proći vježbu i predaju te nastavnik otvoriti paket u drugoj sesiji i ponoviti provjeru. Nakon zabilježenih nalaza slijede potrebni ispravci. Etapa 6 obuhvaća offline/PWA, kontrolirano ažuriranje, pristupačnost i konačnu matricu preglednika. Fizičku korisnikovu pločicu i dalje treba potvrditi prije prijenosa na hardver.
