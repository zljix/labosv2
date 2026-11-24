# Labos · ESP32-S3 C++ offline

Prototip prevodi jednu datoteku main.ino i izvodi četiri prolaza kroz loop() na postojećem Labosovu modelu spoja GPIO4 → 330 Ω → LED → GND. Prevođenje i simulacija rade u radnom procesu preglednika. Primjer koristi funkcionalnu S3 jezgru Labosa, YoWASP Clang/LLD 21.1.4-3 i Binaryen 120 s Asyncifyjem. Rezultat je modul za simulator.

## Pokretanje pripremljenog paketa

Najbrže pokretanje na Windowsu s Pythonom 3: raspakiraj ZIP i pokreni **py pokreni.py** iz raspakirane mape. Skripta otvara prototip u zadanom pregledniku.

Za ručno pokretanje otvori terminal u mapi u kojoj je README.md i pokreni lokalni HTTP poslužitelj. Na Windowsu s instaliranim Pythonom 3:

    py -m http.server 8765 --bind 127.0.0.1 --directory release

Na Linuxu zamijeni py s python3. U Chromium pregledniku otvori http://127.0.0.1:8765/ i pritisni **Spremi za offline rad**. Nakon potvrde možeš zatvoriti preglednik, ugasiti poslužitelj i ponovno otvoriti istu adresu u istom profilu. Promijeni vrijednost delay i tekst u Serial.println pa pritisni **Prevedi i pokreni**. Izvor se sprema u tom profilu. Dostupan je gumb za prekid.

## Razvoj i provjera

Izvor u mapi prototypes/s3-offline nadovezuje se na zljix/labosv2, reviziju 6311b24275da6c29b6de0834398022009b524df4. Za ponovnu izgradnju iz te mape pokreni npm ci i npm test. Za provjeru u pregledniku instaliraj Python Playwright i pokreni python acceptance.py. Po potrebi zadaj izvršnu datoteku Chromium preglednika varijablom CHROMIUM_PATH.

Samostalni prototip služi za kratku provjeru LED-ice. Glavni uređivač koristi isti prevoditelj za učeničke projekte.

## Integracija s glavnim uređivačem

Za probnu integriranu verziju pripremi ovisnosti u korijenu repozitorija i u prototypes/s3-offline (npm ci). Izgradi alate naredbom npm run build iz prototypes/s3-offline. U korijenu uključi LAB_OFFLINE_S3=1 pri izgradnji Labosa. Za zajedničku verziju s Uno/Nano prvo izvrši npm run prototype:avr:build i pri izgradnji postavi i LAB_OFFLINE_AVR=1. Posluži dist/ na adresi koja odgovara LAB_BASE_PATH (zadano /).

U glavnom uređivaču otvori projekt ESP32-S3 s jezikom Arduino C++, odaberi Prevedi i Spremi S3 paket. Nakon potvrde odaberi Prevedi u pregledniku, zatvori prozor pa odaberi Pokreni. Paket prevoditelja preuzima se na zahtjev. Prevoditelj spaja .ino datoteke počevši od main.ino. Učenik unaprijed deklarira funkcije koje poziva. Dodatne .c i .cpp datoteke prevode se zasebno uz C11 odnosno C++17. Mogu se uključiti .h i .hpp zaglavlja iz projekta i iz dopuštenih biblioteka. Školski i lokalni prevoditelj i dalje su dostupni u istom prozoru.

Rezultat pregledničkog alata ima format S3 verzije 3, s identitetom YoWASP Clang 21.1.4-3 i sažetkom izvora. Provjera starijih rezultata verzije 2 koristi izvorni ugovor za main.ino. Postojeći rezultati lokalnog alata Clang 19.1.7 koriste verziju 1. Integracijsku provjeru s ugašenim poslužiteljem i novim pokretanjem preglednika izvršava integration-test.py iz ove mape.

Pri izgradnji se provjeravaju SHA-256 sažeci jezgre i zaključanih biblioteka. U paket ulaze zaglavlja i unaprijed prevedeni objekti u arhivama za WASM. Odabir u projektu određuje putanje zaglavlja i arhive koje se povezuju. Datoteke primjera sadrže svoje izvorne deklaracije. Provjera library-test.ts prevodi projekte sa svih devet biblioteka, uključujući zasebne izvedbe U8g2 za OLED 128×64 i 128×32.

## Provjera na uskom zaslonu

Iz korijena repozitorija pokreni `python prototypes/s3-offline/mobile-test.py chromium` ili `python prototypes/s3-offline/mobile-test.py webkit` uz odgovarajući instalirani Playwright preglednik. Putanju do druge izvršne datoteke možeš zadati kroz CHROMIUM_PATH ili WEBKIT_PATH. Test koristi trajni profil i dodirni prikaz širine 390 px. Nakon spremanja paketa zatvara preglednik i gasi lokalni HTTP poslužitelj. Ponovno pokreće preglednik, prevodi projekt s pogreškom u pomoćnoj C datoteci, otvara označeni redak i stupac, ispravlja kôd i provjerava očitanje senzora iz ponovnog izvođenja.

### Nastavak preuzimanja

U prozoru Prevedi prikazuju se broj i veličina provjerenih, spremljenih datoteka.
Nakon prekida ponovno otvori istu adresu u istom profilu preglednika i odaberi
**Nastavi spremanje S3 paketa**. Nepotpuna datoteka preuzima se od početka.
Za provjeru pokreni `python prototypes/s3-offline/resume-test.py chromium` ili
zamijeni `chromium` s `webkit`. Test koristi Playwright i izgrađenu mapu dist.

Kod nadogradnje na istoj adresi korisnik nakon aktivacije izdanja ponovno odabire
**Spremi S3 paket**. Svaka prenesena lokalna kopija mora odgovarati veličini i
SHA-256 sažetku nove verzije. Ako ispravna kopija iz ranijih izdanja nije dostupna,
aplikacija preuzima i provjerava datoteku s poslužitelja. Za provjeru prijelaza
pokreni `python prototypes/s3-offline/upgrade-test.py chromium STARI_DIST S3_LED_Serial.json`
uz pripremljenu mapu dist i kompatibilan prethodni pilot s istim S3 datotekama.
S opcijom `--corrupt` test promijeni jedan bajt u staroj kopiji i provjerava
da se ponovno preuzela samo ta datoteka.
