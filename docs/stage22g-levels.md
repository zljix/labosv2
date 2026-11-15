# ESP32 MicroPython Lab — etapa 22G

**0.12.5-beta.1 · 14. studenoga 2026.** Nastavak izvora `64ff4e8feabcc9250be1dc9f1cabdf7fbec976e5` (0.12.4). Dodan je samostalan pretvornik razina i URS17. Postojećih URS01–16, školskih LV1/LV2 i pet početnih V vježbi nije potrebno prebrojavati.

## Samostalan profil

Katalog sada nudi **SN74LVC2T45** s osam imenovanih priključaka prema izvedbi DCT/DCU. Lab profil fiksira A stranu na 3,3 V, B na 5 V i zahtijeva zajedničku masu. Dva neovisna podatkovna kanala dijele DIR: HIGH odabire A → B, LOW B → A. To je aktivni push-pull pretvornik, a ne automatski otvoreni odvod za I2C.

Ulazni pragovi dolaze iz TI SCES516N: na 3,3 V LOW je do 0,8 V, HIGH od 2 V; na 5 V LOW je do 1,5 V, HIGH od 3,5 V. Međuprostor i plivajući ulaz ostaju neodređeni. DIR pripada A domeni. Neiskorišteni ulaz treba definirati, izlaz smije ostati nepovezan.

`public/level-shifter.mjs` određuje smjer, valjanost ulaza i odredišne razine. A i B ostaju zasebne električne mreže; njihovo spajanje žicom ne predstavlja pretvorbu. Zajednički DC solver rješava i stvarni strujni put LED-a. Numerička izlazna impedancija od 1 Ω služi Lab izračunu i nije izmjeren ili zajamčen TI parametar. Prikaz razlikuje zadani izlaz modela od napona mreže pod opterećenjem.

Bez valjanih napajanja ili zajedničke mase model ne pogoni izlaze. Za neodređeni ulaz prikazuje upozorenje i ne izmišlja podatak: takvo otpuštanje u modelu nije tvrdnja da fizički čip tada pouzdano daje Hi-Z. Kod napajanja na GND podržana je funkcionalna izolacija.

Sukob izlaza, prenapon prema GPIO-u i nestabilna povratna veza daju pogrešku izvođenja. Provjera sklopa odbija pogrešno napajanje profila, izravno premoštene A/B mreže, kaskadu i neposredni spoj na periferijske protokolne adaptere. LED kroz pretvornik i dalje treba serijski otpornik.

Opseg je **DC i uzorkovano GPIO ponašanje**. Nema modela nanosekundnog kašnjenja, strujnog limita, topline, zaštite fizičke opreme ili potvrđene najveće frekvencije. I2C, SPI, DHT, 1-Wire i drugi vremenski adapteri kroz ovu komponentu nisu time omogućeni. Postojeći složeni carrier profili ostaju zasebni.

## URS17 i nastavni slijed

**Vježbe → URS zbirka → Pretvornik razina 3,3 V i 5 V** uvodi napon logičke jedinice, zajednički DIR, aktivni izlaz i definirani ulaz prije pokusa.

| Varijanta | S3 MicroPython / S3 C++ | Uno / Nano Arduino C++ |
| --- | --- | --- |
| Tipkalo kroz drugu domenu | B 5 V → A 3,3 V → GPIO5; DIR=GND | A 3,3 V → B 5 V → D2; DIR=3V3 |
| LED kroz drugu domenu | GPIO4 → A 3,3 V → B 5 V → otpornik i LED | D9 → B 5 V → A 3,3 V → otpornik i LED |

Tipkalo ima vanjski pull-up od 10 kΩ u svojoj domeni. Prijamnikov unutarnji pull-up ne može ga zamijeniti. LED varijanta ima početni pull-down od 100 kΩ na ulazu pretvornika, da prije inicijalizacije GPIO-a postoji definiran LOW. Drugi ulaz pretvornika je na GND; drugi izlaz ostaje otvoren.

Primjeri koriste **točan postojeći izvor i postojeći prevedeni rezultat** programa Tipkalo odnosno Treptanje. Mijenja se stvarni sklop, a ne značenje izvornog programa. Nisu dodani lažni novi prijevodi ili skrivene programske naredbe za pretvornik. Promijenjeni C++ izvor zahtijeva novo prevođenje.

Pokusi traže usporedbu obaju napona, promjenu ulaza ili trajanja, uklanjanje VCCB vodiča i potvrdu oporavka. Kod otpuštenog pretvornika GPIO pull-up može zadržati HIGH: to samo po sebi nije dokaz prijenosa. Radni list, izvoz i ponovni uvoz slijede postojeća URS pravila.

Zbirka sada ima **17 tema, 65 varijanti po svakom od četiri cilja, ukupno 260 kombinacija**. Izbornik, vodič i CSV preuzimaju brojeve iz kataloga. Napomena ispod editora prati odabranu URS varijantu, pa za novi sklop ne prikazuje staru uputu o izravnom spajanju tipkala.

## Stvarne provjere

Završni skup ima **1.260/1.260 jedinstvenih testova s uspješnim posljednjim rezultatom**, bez preskakanja. Nova komponenta dodaje 28 testova, a osam novih URS putova ulazi u postojeću provjeru izvora, sklopa, artefakta i ZIP-a.

Početna široka regresija dala je 1.248 prolaza i 12 neuspjeha. Dva starija testa još su očekivala da je pretvornik planiran. Deset compiler pokusa nije pronašlo instalirani `wasm-ld-19` jer njegov direktorij nije bio u PATH-u. Očekivanja su usklađena, a alatni put ispravljen bez izmjene prevoditelja ili runtimea. Ponovljeno je svih pet zahvaćenih S3 testnih datoteka: **263/263** prolaza, bez preskakanja. Svi prvotni neuspjesi imaju odgovarajući uspješan ponovljeni rezultat. Ponovljeni testovi ne povećavaju broj 1.260. Izvorni zapisi ostaju u `stage22g-evidence/full-regression.tap` i `s3-regression-final.tap`; provjerena korelacija je `regression-summary.json`.

**8/8 pokusa završnih zapakiranih Workera** prolazi: oba URS17 programa na MicroPythonu, S3 C++, Unu i Nanu. Pokusi uvoze izvezeni ZIP, izvode stvarni program, prate tri stanja LED-a i oba napona te prisilno zaustavljaju Worker. Pokus je otkrio neodređen početni AVR ulaz prije `setup()`; početni pull-down i zasebna obrada upozorenja uklanjaju lažni prekid kao da je došlo do sukoba izvora. Početni dokaz je `initial-avr-startup.json`, završni `packaged-levels.json`.

Zasebne provjere offline mehanizma prolaze **8/8**. Ponovna provjera 69 točnih S3 izvoza potvrđuje podudaranje s izvornim compiler dokazima iz 22F; nije ponovno izvedeno svih 69 native prijevoda. Izvorni blink/button izvozi, svi S3/AVR/radio artefakti i MicroPython WASM ostaju bajtno jednaki prethodnom izdanju. `retained-artifacts.json` bilježi hashove ključnih zadržanih datoteka.

U razvojnom Chromeu/Linuxu stvarni S3 C++ pokus dao je **B1 5,00 V → A1 3,30 V** pri otpuštenom tipkalu; pritisak je dao **0,00 V → 0,00 V**, `S3 LED=1` i 88 % relativne svjetline LED-a. Nakon uklanjanja VCCB prikaz je označio neodređeno napajanje i otpuštene izlaze. Vraćanje vodiča preko Undo i novo pokretanje vratili su 5,00 V → 3,30 V. To su razvojna opažanja; nije provedeno fizičko mjerenje, učenički pilot ili prijavljeni produkcijski pregled. Zapis: `browser-review.json`.

## Lokalni paket

**ESP32_MicroPython_Lab_0.12.5_Lokalno.zip**, izgradnja **8d40aa853c244b5b**, ima **5.170.294 B** i SHA-256:

`acc0e7e539c33c447fd3d901608fc645a0553f3b6ff344ec6b9fc4f8512f59c2`

Raspakirani ZIP poslužen je stvarnim loopback HTTP-om. Svih **183 resursa / 15.238.600 B** ima očekivanu veličinu i SHA-256; oba WASM MIME odgovora prolaze. Uključeni su novi model, 17. tema i ažurirane upute. To nije hladni offline preglednički pokus. Podloga: `local-package.json`.

Potrebno je raspakirati paket u zasebnu mapu i imati Node.js 22+. Windows: `Pokreni.cmd`; Linux/macOS: `node start-local.mjs`. Otvori `http://127.0.0.1:4173/` i ostavi terminal otvoren. Za promijenjeni C++ izvor koristi lokalni prevoditelj; za lokalnu aplikaciju njegov `LAB_ARDUINO_SITE` postavi na tu adresu.

## Nastavak i granice

Samostalan GPIO pretvornik zatvoren je točno određenim profilom. Automatski I2C pretvornik traži vlastiti model. Točna SFM-20B izvedba, zasebni DevKitC V4 i CAM profili ostaju otvoreni; bez potvrđene izvedbe ne preuzima se raspored izvoda ili električni profil. Fizička oprema, školsko računalo, Windows/macOS, ciljni Safari/iOS/Android, hladno offline otvaranje i samostalan učenički rad još traže vlastita opažanja.

Izdanje ostaje **nastavna beta**. Nije proglašena puna stabilna URS v1.0.

## Primarna podloga

[Texas Instruments SN74LVC2T45, SCES516N](https://www.ti.com/lit/ds/symlink/sn74lvc2t45.pdf), odjeljci 4, 5.3 i 7.4; provjereno 14. studenoga 2026. Izvedba pakiranja, pragovi i smjer temelje se na toj podlozi. Fiksne domene, numerički izlaz, dijagnostika i granice funkcionalnog Lab modela opisane iznad projektne su odluke; ne predstavljaju fizičku validaciju čipa ili korisnikova modula.
