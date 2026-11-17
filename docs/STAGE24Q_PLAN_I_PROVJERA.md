# 24Q · Čitljivost sučelja i upute po varijanti

Polazište: 0.14.14-beta.1 / 24P, commit `41b382bfa43612def5a8722f3a649396b54b43fa`.
Pripremljena inačica: 0.14.15-beta.1 / 24Q, 17. studenoga 2026.
Status: implementacija za tehnički pregled. Vizualni prihvat i stvarni učenički pilot nisu potvrđeni.

## Provedeni redoslijed

1. Školski paneli koriste semantičke boje svijetle/tamne teme; sekundarni tekst u svijetloj temi potamnjen je. Lokalni status spremanja ostaje vidljiv na manjim zaslonima.
2. Istraživački pokus odvojen je od osnovnog rada. Gumb stvara novi lokalni projekt bez školskog povezivanja, uz sačuvani izvornik. Upute regulatora i OLED-a izričito čuvaju objavljene pragove/tekst/koordinate za bodovanje. Lokalni ZIP i školska zaključana predaja imaju različite završne upute.
3. Katalog komponenti je sklopiv i pretraživ; prvo navodi vrste iz trenutačnog sklopa. Shema je prije ulaznih kontrola, alati su dostupni pri pomicanju sadržaja na većim zaslonima. Primjeri su sklopivi; projektne i nastavničke radnje grupirane su u izbornike.
4. Svih 67 URS varijanti ima vlastiti cilj, promjenu, očekivanje i pitanja. Novi radovi nose `guideVersion: 2`. Raniji radovi bez oznake zadržavaju izvorna pitanja i značenje odgovora; postojeći kontrolni sažeci ostaju valjani. Uvedeni su predviđanje prije pokusa, dokaz oporavka, račun ADC/PWM-a u V3 i račun STEP impulsa.
5. Kartice podržavaju strelice/Home/End, roving tabindex i povezani panel. Komponente se pomiču koordinatama X/Y; strelice na shemi pomiču pogled. Dodirne mete ključnih alata povećane su. Brojač starosti školskog pregleda više ne šalje čitaču zaslona obavijest svake sekunde.

Uvjeti objavljenih rubrika i bodovni pragovi ostaju isti; izvršne funkcije bodovanja nisu uređivane. Školski katalog koristi nove upute za nove verzije zadataka; već objavljene inačice u bazi ostaju zamrznute. Promjena `guideVersion` mijenja kontrolni sažetak nastavničkog pregleda novog rada.

## Tehnička provjera

Automatizacija `.github/workflows/stage24q-usability.yml` prvo generira privatni školski katalog, zatim provjerava projekte, izvoz, sučelje, spremanje i zaključavanje. Pages testovi koriste build s `/labosv2/`, a offline testovi zaseban root build. Te preduvjete ne treba zamijeniti.

- Novi metodički testovi: pokrivenost svih 67 varijanti, očuvanje značenja i sažetka ranijeg rada, odbijanje nepoznate verzije uputa, izvoz odgovarajućih pitanja, odvojena istraživačka kopija i završne upute prema načinu rada.
- DOM testovi: sklopivost i pretraživanje kataloga, redoslijed sheme i ulaza, tipkovničke kartice, unos i odbijanje nevaljanih koordinata, pomicanje pogleda bez promjene projekta te zatvaranje izbornika i povrat fokusa.
- Regresije: URS projekti za 268 podržanih kombinacija, pet uvodnih vježbi, ZIP, električne veze, školski predlošci, sinkronizacija, zaključavanje, prikaz ranijih izvještaja, putanje i offline paket.

Uvoz i validacija 273 predloška nisu nova izvedbena provjera svih 273 provjeravača. Postojeći dokazi 24P ostaju odvojeni. DOM test nije dokaz izgleda stvarnog zaslona ni potpune WCAG sukladnosti.

Lokalno je potvrđeno 387 različitih automatiziranih testova u navedenim skupinama te TypeScript i produkcijske izgradnje i inventura školskog paketa. Prvotni nedostajući školski predlošci, pogrešno odabran base path offline testa i zastarjeli generirani registar riješeni su pripremom odgovarajućih ulaza; te su provjere zatim prošle. To nisu nalazi o radu s učenicima.

## Vizualni prihvat prije objave

Lokalni razvojni poslužitelj radi, ali nije dostupan pregledniku za vizualni pregled (`ERR_CONNECTION_REFUSED`). Zato sljedeće točke ostaju otvorene; nisu označene kao provedene:

| Uvjet | Što stvarno provjeriti | Prihvat |
|---|---|---|
| Stolno računalo, svijetla/tamna tema | V1, URS02, OLED32, RTC/SD i složeni sklop | Tekst čitljiv, shema odmah dostupna, nema odrezanih kontrola |
| 1366×768 i povećanje prikaza 200 % | Izbornici, upute, editor, potvrda predaje | Svaka ključna radnja dostupna bez preklapanja |
| Stvarni iPhone/Safari i Android | Uspravni/vodoravni prikaz, dodir i tipkovnica | Vidljiv status spremanja, upotrebljivi ulazi i dijalozi |
| Samo tipkovnica i čitač zaslona | Kartice, shema, koordinate, dijalozi, povrat fokusa | Logičan redoslijed, nema zamke fokusa ni ponavljanja brojača |
| Školski sustav | Izvorni pokušaj → kopija → povrat → službeni rezultat → zaključavanje | Kopija ne sprema u pokušaj; završna revizija odgovara sažetku |

## Učenički pilot

Prvo 3–5 učenika, zatim razred. Upotrijebiti postojeće obrasce `pilot.html` i školski pilot; ne popunjavati ih pretpostavljenim rezultatima. Učenicima najprije dati V1/V3, potom jednu odabranu URS varijantu. Zabilježiti vrijeme do pronalaska sklopa i pokretanja, broj traženih pojašnjenja, razumijevanje razlike lokalno/školsko, uspješnost stvaranja istraživačke kopije, potpunost predviđanja/opažanja/oporavka i uspješnost zaključavanja.

Nastavnik zasebno ocjenjuje razumijevanje i samostalnost. Funkcionalni bodovi pripremljenog programa nisu dokaz učeničkog učenja. Nakon pilota doraditi nejasne upute i raspored prema opaženim problemima.
