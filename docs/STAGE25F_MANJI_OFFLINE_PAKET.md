# Labos 0.15.5-beta.1 · 25F — manji offline paket

Polazište: 0aebff8464fd5e7d6581cb5f1ca25f2a8dac3ac6. Opseg: zljix/labos; labosv2 nije mijenjan.

## Dorada

Offline manifest povezuje 77 kopija datoteka pod adresom izdanja s njihovim bajtno identičnim izvornikom. Jednakost duljine i SHA-256 provjerava se pri izgradnji. Svaki jedinstveni sadržaj i dalje se provjerava prije spremanja; nepotpun paket ne postaje spreman.

Time se sadržaj za preuzimanje i pohranu smanjuje s 16.831.751 na 10.808.155 bajtova: 6.023.596 bajtova (35,8 %) manje. To je zbroj sadržaja, bez interne režije preglednika i male mape putanja. Datoteke na web poslužitelju ostaju dostupne na svim dosadašnjim putanjama.

Odgovori za povezane putanje zadržavaju traženu adresu izdanja kao osnovu relativnih uvoza. Svaka zadržana verzija ima vlastitu mapu u svojoj predmemoriji; stara kartica ne dobiva interpreter nove verzije. Status spremnosti provjerava stvarno spremljene datoteke, a napredak preuzimanja broji jedinstvene datoteke. Projekti, školski podaci i postojeće zaštite čišćenja nisu mijenjani.

## Provjere

Prošle su produkcijske izgradnje za korijen i /labos/ uz TypeScript provjeru. Prošle su provjere offline paketa (8, uključujući stvarni MicroPython), Pages (12), zaštite prostora (11), offline sučelja (1), školske sinkronizacije (15) i projekata/spojeva (29): ukupno 76 provjera.

Nove regresije provjeravaju broj mrežnih zahtjeva i spremljenih zapisa, SHA-256 svih povezanih odgovora, izgubljenu datoteku, veličinu statusa te dohvat stare verzije preko njezine mape. Postojeći test ponovnog preuzimanja ažuriran je za jednu kopiju WASM-a. Školska sinkronizacija zahtijeva prethodnu izgradnju testnog kataloga; nakon nje testovi prolaze.

## Granice

Manji paket smanjuje potreban prostor, ali ne jamči dostupnu kvotu u svakom pregledniku. Stvarni iOS/Android uređaji i učenički pilot ostaju otvoreni. Rezultat javne objave i školske CI regresije bilježi se nakon objave.
