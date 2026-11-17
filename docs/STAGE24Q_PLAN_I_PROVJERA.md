# 24Q · Čitljivost sučelja i upute po varijanti

Polazište: 0.14.14-beta.1 / 24P, commit `41b382bfa43612def5a8722f3a649396b54b43fa`.
Objavljena web beta: 0.14.15-beta.1 / 24Q, 17. studenoga 2026.
Aktualno: potpuna školska regresija beta.1 uspješno je završena; završna dorada beta.2 i granice prihvata opisane su u [završnom pregledu](24Q_ZAVRSNI_PRIHVAT.md). Povijesni zapis prve objave: [Dokaz javne objave](stage24q-evidence/publication.json). Stolni Chromium pregled je proveden; prihvat na stvarnim mobitelima i učenički pilot nisu potvrđeni.

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

Lokalno je potvrđeno 393 različitih automatiziranih testova u navedenim skupinama te TypeScript i produkcijske izgradnje i inventura školskog paketa. Prvotni nedostajući školski predlošci, pogrešno odabran base path offline testa i zastarjeli generirani registar riješeni su pripremom odgovarajućih ulaza; te su provjere zatim prošle. To nisu nalazi o radu s učenicima.

## Vizualni prihvat i preostale provjere

Razvojni pregled uspješno je otvoren preko upravljanog pregleda. U Chromiumu na 1363×936 provjereni su obje teme, V1, URS02, OLED32 i RTC/SD, izbornik projekta, strelice za kartice, istraživačka kopija i sačuvani izvornik, pomicanje koordinatom te rad OLED-a i CSV zapisivača. Dokaz i ograničenja: `stage24q-evidence/browser-review.json`.

Otkriveno je da spremanje kartice uklanja zadnju simulacijsku snimku i onemogućuje naknadno spremanje RTC-a. Ispravljeno je očuvanjem zadnjeg okvira samo pri izričitom spremanju snimke; obična promjena sklopa i dalje ga poništava. DOM regresija provjerava oba redoslijeda spremanja, a stvarno preuzeti ZIP sadrži RTC stanje i SD blokove. Opis regulatora usklađen je s uvjetima ≥28/≤26 °C.

CI regresije 24E/24F sada provjeravaju trajnu pokrivenost parova zadatak/cilj uz očuvane povijesne profile; aktivni 24P profil tipkala više se ne smatra nedostatkom pokrivenosti. Zbirni dokaz 24I prepoznaje izričito označena ponavljanja i provjerava tri ponavljanja po profilu te pozitivne i negativne ishode 24 neovisna prijevoda.

Preostali prihvat ne smije se poistovjetiti s provedenim stolnim pregledom:

| Uvjet | Što stvarno provjeriti | Prihvat |
|---|---|---|
| Stolni Chromium 1363×936, obje teme | V1, URS02, OLED32, RTC/SD | Provedeno u opisanom opsegu; ostale veličine zaslona otvorene |
| 1366×768 i povećanje prikaza 200 % | Izbornici, upute, editor, potvrda predaje | Svaka ključna radnja dostupna bez preklapanja |
| Stvarni iPhone/Safari i Android | Uspravni/vodoravni prikaz, dodir i tipkovnica | Vidljiv status spremanja, upotrebljivi ulazi i dijalozi |
| Samo tipkovnica i čitač zaslona | Kartice, shema, koordinate, dijalozi, povrat fokusa | Logičan redoslijed, nema zamke fokusa ni ponavljanja brojača |
| Školski sustav | Izvorni pokušaj → kopija → povrat → službeni rezultat → zaključavanje | Kopija ne sprema u pokušaj; završna revizija odgovara sažetku |

## Učenički pilot

Prvo 3–5 učenika, zatim razred. Upotrijebiti postojeće obrasce `pilot.html` i školski pilot; ne popunjavati ih pretpostavljenim rezultatima. Učenicima najprije dati V1/V3, potom jednu odabranu URS varijantu. Zabilježiti vrijeme do pronalaska sklopa i pokretanja, broj traženih pojašnjenja, razumijevanje razlike lokalno/školsko, uspješnost stvaranja istraživačke kopije, potpunost predviđanja/opažanja/oporavka i uspješnost zaključavanja.

Nastavnik zasebno ocjenjuje razumijevanje i samostalnost. Funkcionalni bodovi pripremljenog programa nisu dokaz učeničkog učenja. Nakon pilota doraditi nejasne upute i raspored prema opaženim problemima.

## Javna objava 17. studenoga 2026.

GitHub Pages objava prošla je iz commita `0fc488a49ebe9e024bfe64d3b26c1ac8653af38d`. U javnom Chromiumu potvrđena je nadogradnja predmemorirane 24P verzije preko „Provjeri novu verziju” i „Spremi i otvori novu verziju”; postojeći V1 projekt je očuvan, prikazana je oznaka 0.14.15-beta.1 / 24Q i offline spremnost. MicroPython program pokrenut je i zaustavljen, a radni list i lokalne završne upute su dostupni. Snimka: `stage24q-evidence/labosv2-24q-published.jpg`.

Pri prvoj objavi potpuna školska regresija još je bila otvorena; taj povijesni status ostaje u `publication.json`. Naknadno je uspješno završena za isto stablo izvora. Aktualni dokaz je `stage24q-evidence/school-acceptance.json`, a pregled završne dorade i preostalih stvarnih provjera nalazi se u `24Q_ZAVRSNI_PRIHVAT.md`.
