# Etapa 23E · bodovanje triju pilot-vježbi

**0.13.4-beta.1 · 15. studenoga 2026.** Polazište: objavljena 23D, `b5719f0ad175f11990ad94af85371c0e0cc7cf93`. Nastavlja se postojeći PHP/MySQL smjer.

## Isporučeno

Nastavnik pri objavi nove inačice odabire jednu od triju verzioniranih automatskih rubrika. Upute, kriteriji i 10 mogućih bodova zamrzavaju se s inačicom zadatka. Stare opisne ili ručno planirane rubrike ne pretvaraju se automatski u službeno bodovanje.

| Katalog | Automatski pilot | Ciljevi |
| --- | --- | --- |
| URS01 · `gpio/button` | Pritisnuto tipkalo uključuje vanjsku LED-icu; otpušteno je gasi | MicroPython S3, Uno i classic Nano |
| URS01 · `gpio/adc` | Zasebna nadogradnja početnog ADC/PWM primjera: digitalni prag na polovici ADC raspona | MicroPython S3, Uno i classic Nano |
| URS03 · `weather/bmp280` | Novo I2C očitanje i ispis temperature i tlaka pri promjenama okoliša | MicroPython S3, Uno i classic Nano |

Analogni pilot ima **izričite nove upute**: početni PWM program nije referentno rješenje praga. Izvorni URS katalog i LV1/LV2 nisu preimenovani. Odabir ESP32-S3 C++ ostaje dostupan u simulatoru, ali nema službeno bodovanje u ovoj etapi.

Otvaranje i svako potvrđeno spremanje podržanog pokušaja stvaraju posao vezan uz nepromjenjivu snimku, hash objavljene rubrike, inačicu provjeravača i privatnu pobudu. Novije spremanje uklanja stare bodove iz prikaza aktualne revizije. Rezultat stare provjere ostaje uz staru snimku i ne može prepisati noviju.

Migracija 005 dodaje red poslova. Privatni PHP CLI dodjeljuje posao radniku uz vremenski ograničenu oznaku; javni API nema claim/complete funkcije. Dvostruki zahtjev ne stvara drugu aktivnu provjeru. Stari poslovi na čekanju označavaju se zamijenjenima. Istekla isporuka ne prima bodove. Tehnički neuspjeh moguće je ponoviti bez brisanja ranijeg izvještaja.

Provjeravač ne koristi klijentski broj bodova, konzolni zapis ni učitani Arduino artefakt. Izvodi izvor MicroPythona; za Arduino koristi novi izolirani prijevod ili instalirani pouzdani artefakt s točnim hashom ulaza. Izmijenjeni izvor bez lokalnog prevoditelja dobiva `unsupported`, bez pokretanja starog programa. Senzorska provjera traži dovršeni stvarni I2C prijenos i odgovarajući novi ispis; pobude dolaze iz privatnog sjemena posla.

Gostujući MicroPython nema JavaScript pristup Node procesu, stanju provjeravača ni ulaznim pobudama. Izvršavanje nema pristup konfiguraciji, bazi i školskoj mreži. Ograničeni su vrijeme, izlaz, Python/V8 heap i virtualni adresni prostor procesa na 2 GiB. To nije tvrdnja o cgroup ograničenju ukupne memorije cijelog školskog servisa.

Učenik u laboratoriju vidi **Moji bodovi**, reviziju, kriterije i opažanja po scenarijima. Lokalne izmjene jasno razlikuje od provjerene snimke. Nastavnički skupni pregled prikazuje bodove aktualne revizije, a detalj stare snimke njezin povijesni rezultat. Nepodržano, čekanje i tehnička pogreška imaju `points: null`, nikad izmišljenu nulu. Automatski bodovi ne pretvaraju se u školsku ocjenu.

## Provjere

| Lokalni skup | Rezultat |
| --- | --- |
| Projekti, sklopovi, vodovi, URS, katalog, sinkronizacija i raniji dokaz izvršavanja | 366/366 |
| Tri pilot-rubrike, alternativni/negativni radovi i šest novih izoliranih AVR prijevoda | 8/8 skupova |
| React rezultat i odvajanje null/0, lokalnih izmjena i revizija | 2/2 |
| ZIP inventar i zaštita privatnog API-ja od offline predmemorije | 2/2 |
| GitHub Pages podputanja i offline resursi | 8/8 |

Sirovi zapisi su u `stage23e-evidence/`. Broj skupova nije broj različitih učeničkih scenarija ili podržanih rubrika.


- Stvarno izolirano izvođenje: sva tri MicroPython pilota, alternativna rješenja, druge pobude, Uno/Nano katalogski programi i šest novih izoliranih AVR prijevoda.
- Negativni primjeri: konstantan izlaz, netočan prag, stari/fiksni senzor, odspojen SDA, lažni artefakt i rezultat, izmijenjena veza snimke, nepodržan cilj, sintaktička pogreška, beskonačna petlja i pokušaji pristupa JavaScript okruženju.
- React: null/0 razlika, osvježavanje, promjena revizije, lokalne izmjene, ponovna provjera, tekstualni prikaz uvezenog sadržaja i opoziv prijave.
- PHP/MySQL integracija u Actionsu provjerava ovlasti, zamrznute rubrike, jedinstven red, oznake isporuke, provjeru zbroja, kasne rezultate, ponavljanje i ponovnu migraciju. GitHub provjera mora proći prije spajanja izdanja.

Lokalni runtime je Node 24.22.1, Bubblewrap 0.12.0 i PHP 8.4.27. Lokalna sintaksa svih PHP datoteka prolazi. Ovdje MySQL ne može otvoriti svoj UNIX socket, pa se ne tvrdi lokalni prolaz PHP/MySQL integracije; izvodi se na zasebnom MySQL 8.4.7 u Actionsu. Rezultati lokalnog browsera, fizičke opreme, školskog HTTPS/LAN-a, 30 učenika i mobilnih uređaja nisu proglašeni provjerenima.

## Instalacija i nastavak

Nadogradnja s 23D: zamijeni paket, sačuvaj privatnu konfiguraciju i sesije, zatim pokreni postojeću naredbu `migrate`. Za bodovanje pokreni privatni radnik iz školskih uputa. Windows PHP/MySQL dio može koristiti zaseban Linux provjeravač, ali automatizirani prijenos na udaljeni servis nije dio ove isporuke.

Zaključavanje i završetak predaje ostaju etapa **23F**. Proširenje preostalih kombinacija, izvještaji, sigurnosne kopije i stvarni školski pilot slijede prema postojećem planu. Tri pilota ne znače službeno bodovanje svih 268 kombinacija simulatora.


### Objava i završna integracija

Izdanje se objavljuje u `zljix/labosv2`, `main` i GitHub Pages. Stvarni PHP/MySQL tijek provjerava školski Actions postupak nad zasebnom bazom prije spajanja. Stanje konkretne objave i zapisi dostupni su u povijesti repozitorija i Actionsu.

Snimka iz MySQL JSON stupca prije izvoza ponovno se kanonizira, a provjera rubrike uspoređuje polja neovisno o redoslijedu ključeva. Time promjene u načinu serijalizacije baze ne odbacuju valjan rad. Sadržaj i veza s nepromjenjivom snimkom i dalje se provjeravaju hashom.
