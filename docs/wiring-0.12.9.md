# Dorada prikaza vodiča · 0.12.9-beta.1

## Polazište

Pregledan je stvarni izvor Fritzing Optimizera 0.3.0, commit `5e594ba2b94468fa1da976ec24ed06842cbd0fde`: `lib/optimizer/router.mjs` (`astar`, zauzete ćelije, prepreke i slobodne rupice) i `lib/optimizer/custom.mjs` (`wireRoutes`, različiti redoslijedi, ponavljanje neuspjele mreže). Laboratorij već ima A* i zajednički prikaz svih vodiča; razlika je u pravilima prolaska kroz postojeće putanje.

## Promjene

- Prvo se pokušava raspored koji zauzete dionice tretira kao prepreke, uz razmak paralelnih vodova. Neuspjeli vodiči dobivaju prednost u sljedećem pokušaju; provjerava se i obrnuti redoslijed. Uspoređuju se neuspjele putanje, preklapanja, križanja pa duljina i broj zavoja, tim redom.
- Zaštita obuhvaća sve rupice breadboarda, uključujući nepovezane. Pravilo prati zakretanje pločice. Presjeci prepreka po redovima i stupcima spremaju se tijekom pretraživanja radi smanjenja troška BB60.
- Kada ograničeno pretraživanje ne pronađe cjelovit raspored bez križanja, pokušavaju se putanje s označenim križanjima. Kollinearno preklapanje automatskih putanja i dalje je zabranjeno. To ne znači da je raspored bez križanja matematički nemoguć.
- Mostić se crta na ravnoj dionici. Uz zavoj i međusobno bliska križanja crta se prekida: prethodna inačica na takvom mjestu nije nacrtala mostić pa je presjek mogao izgledati kao spoj.
- Odabirom vodiča ističu se oba njegova stvarna priključka i prigušuju ostali vodiči. Tooltip navodi oba kraja. Nepronađena automatska putanja prikazuje se isprekidano i uz obavijest.

## Očuvani podaci i granice

Raspoređivanje mijenja samo prikaz. Ne mijenja pinove, električne mreže, položaje komponenti ni spremljene ručne zavoje. „Uredi vodove” izričito uklanja ručne zavoje i pokreće automatski raspored; radnja ima Poništi. Križanje ili prekid nacrtane crte ne mijenja povezanost simulatora. Senzorske vrijednosti i boje ne pokreću ponovno računanje geometrije.

Za razliku od Fritzing Optimizera, ovdje se ne biraju zamjenske električki povezane rupice niti se preslaguju moduli: postojeći sklop i zadani pinovi moraju ostati isti. Zato složene sheme mogu imati označena križanja. Pretraživanje je heurističko i ograničeno, bez jamstva optimalnog rasporeda ili fizičke izvedivosti vodiča.

## Provjera

`npm run test:routing`: očuvanje krajeva, izvornog sklopa i netlista; ručne putanje; premještanje/zakretanje i obuhvat pogleda; provjera različitih tvorničkih geometrija na sve tri pločice; zauzeti priključak; demo bez križanja; slobodne rupice običnog i zakrenutog BB60; mostići, prekidi na zavojima/bliskim križanjima, ponovljene točke i valjan SVG; stabilnost ključa geometrije.

`npm test`: serijalizacija projekta, ZIP/JSON, povijest, priključci, breadboard i električke mreže. Dodatno se provjeravaju TypeScript, produkcijska izgradnja, offline resursi i Pages na `/labos/`. Vizualna provjera koristi postojeće nastavne primjere u Chromeu/Linuxu; to nije pokus na fizičkoj elektronici ili stvarnom mobitelu.

Završni rezultat: **55/55 ciljanih testova** (13 raspoređivanje, 26 projekti/spojevi, 8 Pages, 8 offline), bez preskakanja; obje produkcijske izgradnje i TypeScript prolaze. Prikaz odabranog SDA voda u primjeru BMP280 → LCD1602 potvrđuje prigušenje osam ostalih vodova i isticanje točno dva priključka.
