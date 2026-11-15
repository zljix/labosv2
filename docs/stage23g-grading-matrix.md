# Etapa 23G · registar podrške i proširenje prvih obitelji

**0.13.6-beta.1 · 15. studenoga 2026.** Polazište je objavljena 23F, `19898ca77ef7f6b5f7edd1c9e0a716fefaf808da`. Nastavlja se dogovoreni PHP/MySQL sustav i čuvaju objavljene inačice zadataka.

## Isporučeno

Registar obuhvaća svih 18 tema, 67 varijanti i 268 stvarnih kombinacija iz aktualnog URS kataloga. Svaka kombinacija ima kriterije pripreme, obitelj, cilj i jasan status službenog bodovanja. Registar nastaje iz istog kataloga i istih rubrika koje koristi poslužitelj; build i provjera odbacuju nepodudarnosti. V1–V5 vode se zasebno i njihove lokalne provjere ne proglašavaju se službenim bodovima.

`school-grading.html` prikazuje pregled s pretragom, filtrima i kriterijima. Cijeli registar dostupan je u CSV-u i JSON-u, bez učeničkih podataka. Školski katalog pri objavi prikazuje podršku za svaki cilj; kartica dodijeljene vježbe pokazuje je li automatska provjera uključena za baš tu dodjelu. Podržana rubrika ne uključuje se prešutno u ranije opisne zadatke.

| Rubrika | MicroPython S3 | Uno | Nano | S3 C++ |
| --- | --- | --- | --- | --- |
| Tipkalo → LED (23E) | podržano | podržano | podržano | nije podržano |
| Analogni prag → LED (23E) | podržano | podržano | podržano | nije podržano |
| BMP280 I2C (23E) | podržano | podržano | podržano | nije podržano |
| LED 250/750 ms (23G) | podržano | podržano | podržano | nije podržano |
| LM35 (23G) | podržano | podržano | podržano | nije podržano |
| BMP180 I2C (23G) | podržano | podržano | podržano | nije podržano |

Podržano je **18/268 kombinacija**, preostalih **250** jasno je označeno bez službenog bodovanja. To je proširenje prve obitelji, uz potpun registar preostalih obitelji: aktuatori, zasloni i dodir, RTC/SD te oba radio čvora. Njihovo automatsko bodovanje nije proglašeno dovršenim. Broj tema ili dostupnost simulatora ne služe kao dokaz bodovanja.

## Nove provjere

LED rubrika zasebno provjerava električni put (3), najmanje tri potpuna ponavljanja (5) i trajanja 250/750 ms (2). Promatra se stvarna struja LED-ice u virtualnom vremenu. Početni program 500/500 ms ostvaruje izmjenu stanja, ali nema točna trajanja (8/10). Mjerenje dopušta ±24 ms po cijelom intervalu i ne broji početno ugašeno stanje kao potpuni interval. Raspored i izlazni GPIO smiju se promijeniti uz odgovarajući kod.

LM35 provjerava napajanje 5 V, masu i ADC put, zatim novi ispis pri tri privatno odabrane temperature i povratku na prvi uzorak. Tolerancija ±0,6 °C pokriva kvantizaciju Uno/Nano ADC-a. Valjan ispis mora stizati unutar objavljenog intervala, uz 24 ms tolerancije izvršnog koraka/serijskog izlaza. Fiksni ispis, staro očitanje, presporo osvježavanje, napajanje 3,3 V i odspojen OUT ne ostvaruju sve kriterije.

BMP180 dijeli provjereni I2C izvršni put, ali zahtijeva baš BMP180 i novu dovršenu pretvorbu. Provjeravaju se tri promjene temperature i tlaka, stvarni prijenos i novi ispis u °C/Pa. Dopuštena odstupanja su ±0,3 °C i ±150 Pa. Provjera intervala ima 100 ms tolerancije uz deklariranih 2200 ms; fiksni tekst, stari podatak, odspojen SDA ili presporo osvježavanje ne prolaze cjelovitu rubriku. Ranija BMP280 rubrika zadržava svoje postojeće ponašanje.

Arduino izvor mora odgovarati pouzdanom kataloškom artefaktu ili se ponovno prevodi u izolaciji. Novi izvor bez prevoditelja ostaje `unsupported`, `points: null`. Za prilagođeni LED program od 10/10 potreban je prevoditelj. Učenikov artefakt, rezultat ili konzolni zapis iz preglednika nisu autoritet.

## Kompatibilnost i instalacija

Rubrike 23E ostaju neizmijenjene s inačicom provjere `23E.1`; nove su vezane uz `23G.1`. Poslužitelj i radnik biraju inačicu po profilu, pa nadogradnja ne odbacuje ranije zamrznute zadatke i poslove. Novi rezultat ima hash stvarno instaliranih izvršnih datoteka. Ranije potvrđeni izvještaji i zaključane predaje ne prepisuju se.

Nema nove SQL migracije. Nadogradnja s 23F čuva privatnu konfiguraciju i sesije; zamjenjuje se programski paket i ponovno pokreće provjeravač. Postojeći `migrate` ostaje ponovljiv. Školski ZIP i dalje razdvaja javni `web/` od privatne aplikacije, kataloga i konfiguracije.

## Provjere i granice

Zapisi ove etape nalaze se u `stage23g-evidence/`.

| Lokalna provjera | Rezultat |
| --- | --- |
| Projekti, sklopovi, vodovi, URS, katalog, sinkronizacija i React tijek | 345/345 |
| Registar, CSV/JSON/katalog i stvarne komponente stranice | 3/3 |
| Nove rubrike: MicroPython, alternativni i pogrešni radovi, Uno/Nano katalog i inačice | 4/4; lokalni compiler skup preskočen |
| Ranije tri rubrike i zaštita izvršavanja | 7/7; lokalni compiler skup preskočen |
| GitHub Pages putanja i offline paket | 8/8 |
| Inventar školskog ZIP-a i privatni API izvan predmemorije | 2/2 |

Lokalni sustav nema PHP/MySQL, a izvorni Arduino CLI ne može preuzeti alatni lanac u ovom izvršnom okruženju. Te provjere izvodi zaseban školski Actions postupak; lokalni preskok nije prolaz.  Ciljane provjere pokrivaju cijeli registar, podudaranje CSV/JSON/kataloga, stvarne filtre i siguran tekstualni prikaz, izolirana točna i druga ispravna rješenja, pogrešne izvore, veze i intervale, hash i inačicu rubrike te Uno/Nano katalogske artefakte. Regresija pokriva projekte, sklopove, vodove, sve URS početne kombinacije, sinkronizaciju, prikaz bodova i završetak predaje.

Stvarni PHP/MySQL scenarij dodan je u postojeću integraciju: objavljuje novu LM35 rubriku, stavlja posao u red, izvršava ga, prihvaća rezultat i potvrđuje da stari zadatak zadržava staru inačicu. Školski Actions postupak provjerava i šest novih izoliranih Uno/Nano prijevoda. Ti postupci moraju proći prije spajanja izdanja. Lokalni pregled Chromea na Linuxu potvrđuje filtriranje i otvaranje kriterija; nije potvrda Safarija, iOS-a, fizičkih senzora ni rada razreda na školskom poslužitelju.

Širenje automatskih rubrika na ostale obitelji ostaje označeno u registru. Izvještaji s učeničkim postignućima, nastavničke korekcije, kopije/povrat i stvarni školski pilot ostaju 23H–23I iz dogovorenog plana.


## Potvrđena integracija i objava

[Školski Actions postupak 43741667624](https://github.com/zljix/labosv2/actions/runs/43741667624) završio je uspješno, sa svih 33 koraka. Prošli su PHP sintaksa, registar i korisnički prikaz, svih šest novih izoliranih Uno/Nano prijevoda te šest ranijih, stvarni PHP/MySQL računi, razredi, portal, red bodovanja s novom LM35 rubrikom, spremanje, zaključavanje, dorade i React tijek. U ovom postupku compiler provjere nisu bile preskočene. Lokalni preskoci u tablici iznad zadržani su kao točan povijesni zapis lokalnog okruženja.

Provjeren je izvor `c246dcc4d2a4313c2eec208c77cb8bdfb3436031`; spojeno izdanje `8c41955b1176ec2bfccd98e3f88f00e4c8217e41` ima istu Git snimku sadržaja `108d7f151acd1f1db4f3ade467ed5d9a54659c30`. Naknadno su dopunjeni samo ovo izvješće i zapis rezultata. Potvrda automatizirane integracije i dalje ne znači potvrdu stvarnog školskog pilota ili svih 268 automatskih rubrika.
