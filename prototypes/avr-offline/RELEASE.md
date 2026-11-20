# Labos 0.16.0-beta.1 — eksperimentalni Arduino offline

Odredište: `zljix/labosv2`, https://zljix.github.io/labosv2/.
Prethodna javna verzija: `0.14.15-beta.2`, commit
`e5e65297ef23a5cd18497f956f1d3a702add7afe`.
Ovo izdanje prenosi ranije dorade Labosa i integrira offline AVR prevoditelj.

## Promjene

- Jednokratna priprema paketa prevoditelja (14,93 MiB), zatim novi Uno/Nano
  C/C++ izvori, prevođenje, simulacija i izvoz/uvoz bez mreže.
- Zastarjeli rezultat odbacuje se nakon izmjene izvora ili neuspjelog prevođenja.
- Glavno sučelje, biblioteke i kontrole dostupni su i u uskom rasporedu.
- Vidljivi izvori, licence i točan upstream recept uz pripremu prevoditelja.
- Vlastiti puni izvor, SDK i bibliotečki izvori dostupni su uz binarni paket;
  upstream alatima izvori se nude prema GPLv3 §6(d). Detalji: DISTRIBUTION.md.

## Objava i provjera

Pages workflow izgrađuje alat, provjerava zaključane izvore i ponovljivost,
izgrađuje aplikaciju s `LAB_OFFLINE_AVR=1` na `/labosv2/`, izvršava regresiju
te preglednički prihvat. Isti profil najprije otvara prethodnu javnu verziju,
sprema projekte, a zatim se nadograđuje kroz postojeći gumb za ažuriranje.
Predmemorija i projekti ne brišu se. Novi izvor, prevođenje, simulacija,
izvoz/uvoz i potpuni restart provjeravaju se u mrežno izoliranom procesu.
Objava web aplikacije dopuštena je tek nakon uspješnog build posla.
Stvarni rezultat te provjere vidi se u GitHub Actions zapisu konkretnog commita;
sama prisutnost workflowa nije tvrdnja da je provjera prošla.

Za razvojnu izgradnju:

```sh
npm ci
npm run prototype:avr:build
npm run prototype:avr:sources
LAB_OFFLINE_AVR=1 LAB_BASE_PATH=/labosv2/ npm run build:pages
node --test verification/pages.test.mjs prototypes/avr-offline/distribution.test.mjs
```

Izvori i obavijesti nisu dio automatskog offline preuzimanja. Potpuni izvor
moguće je preuzeti s `compiler-sources.html`. Vanjske poveznice zahtijevaju mrežu.
Pri svakoj sljedećoj objavi provjeriti dostupnost pripadajućih izvora; ako se
pristup izgubi, obnoviti ga ili povući binarne datoteke.

## Opseg javne bete

Potvrda u CI Chromiumu ne znači potvrdu svih preglednika i fizičkih uređaja.
Školski i5-6600 / 8 GB, Android i iPhone trebaju zaseban pilot iz PILOT.md.
Offline C++ za ESP32-S3, programiranje fizičke pločice, poddirektoriji, više
`.ino` datoteka i službeno bodovanje ne ulaze u ovo AVR izdanje.

Jedan `main.ino` i dodatne `.c/.cpp/.h/.hpp` datoteke stavljaju se u korijen
projekta; funkcije treba deklarirati prije uporabe. EEPROM se resetira na
0xFF pri pokretanju. Oba paketa, aplikacija i prevoditelj, moraju biti
spremljena prije prekida mreže.

Za povratak sačuvati prethodni commit/paket, vratiti njegovu web izgradnju
bez brisanja korisničkih podataka i ponovno provjeriti dostupnost. Ne koristiti
prisilni upis kojim bi se izbrisale kasnije promjene repozitorija.
