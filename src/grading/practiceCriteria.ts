import type { ExerciseId } from '../lessons/collectionPlans';

// Each trial is replayed from its saved program and circuit. For live-input tasks
// the captured setting also identifies which experiment the student performed.
export interface PracticeCriteria {
  baseline: string;
  change: string;
  question: string;
  choices: [string, string, string];
  answer: number;
}
function criterion(
  baseline: string,
  change: string,
  question: string,
  choices: [string, string, string],
  answer: number
): PracticeCriteria {
  return { baseline, change, question, choices, answer };
}
export const practiceCriteria: Record<ExerciseId, PracticeCriteria> = {
  P0: criterion(
    'Ista početna poruka ponavlja se svake sekunde.',
    'Spremi vlastitu poruku s novim razmakom od 200 do 4000 ms, različitim od 1000 ms.',
    'Koliko poruka nakon prve stiže tijekom 6 s uz razmak 2000 ms?',
    ['2', '3', '6'],
    1
  ),
  'V1.1': criterion(
    'Model zatvara na 25 °C i otvara na 28 °C.',
    'Zabilježi izmijenjeni pokus na 26,5 °C. Provjera tom ulazu prilazi iz oba smjera.',
    'Kakav je cilj na 26,5 °C ako je prethodno bilo 28 °C?',
    ['Ostaje otvoren', 'Zatvara se', 'Ovisi samo o napajanju'],
    0
  ),
  'V1.2': criterion(
    'LED i ispis izmjenjuju oba stanja.',
    'Zabilježi pokus s prekinutim povratnim vodom LED-a dok se program izvodi. Potom obnovi vezu.',
    'Što pri prekinutom povratnom vodu i dalje možeš opažati?',
    ['Struju kroz LED', 'Svjetlo LED-a', 'Izmjenu poruka u konzoli'],
    2
  ),
  'V1.3': criterion(
    'Obje faze treptanja traju oko 500 ms.',
    'Zabilježi pokus nakon obnove spoja s obje faze od 1000 ms.',
    'Koliki je period ako svaka faza traje 1000 ms?',
    ['500 ms', '1000 ms', '2000 ms'],
    2
  ),
  'V1.4': criterion(
    'Najmanje pet svježih uzoraka stiže svakih 2000 ms.',
    'Zabilježi pet novih uzoraka s razmakom 3000 ms.',
    'Koji podatak razlikuje dva uzorka iste temperature?',
    ['Ista vrijednost temperature', 'Novi redni broj i vrijeme', 'Naziv senzora'],
    1
  ),
  'V1.5': criterion(
    'LED reagira na promjenu osvjetljenja s 30 na 500 lx.',
    'Za provjeru odaberi novi prag između očitanja pri 30 i 140 lx. LED svijetli na 30 lx i gasi se već na 140 lx.',
    'Kako odabrati prag iz dvaju udaljenih mjerenja?',
    ['Između tih očitanja', 'Iznad oba očitanja', 'Uvijek na nuli'],
    0
  ),
  'V1.6': criterion(
    'Servo izmjenjuje 30° i 90°, a LED radne omjere 15 % i 75 %.',
    'Za drugi položaj postavi 120°, a za njegovu svjetlinu 50 %. Zabilježi obje izmjene.',
    'Koja promjena izravno određuje kut virtualnog serva?',
    ['Svjetlina LED-a', 'Interval ispisa', 'Trajanje upravljačkog impulsa'],
    2
  ),
  'V1.7': criterion(
    'Početno korigirano očitanje jednako je sirovom.',
    'Zabilježi program s korekcijom +1 °C za očitanje 24 °C uz referencu 25 °C. Provjera mijenja ulaz.',
    'Kolika je korekcija ako je referenca 22 °C, a senzor očitava 23 °C?',
    ['+1 °C', '−1 °C', '0 °C'],
    1
  ),
  'V1.8': criterion(
    'Servo prati dvije zadane širine impulsa za 30° i 90°.',
    'Za završni pokus promijeni drugi kut na 150°.',
    'Koliki impuls u ovom modelu zadaje srednji položaj od 90°?',
    ['1000 µs', '2000 µs', '1500 µs'],
    2
  ),
  'V1.9': criterion(
    'Oba izlaza slijede valjanu temperaturu.',
    'Na senzoru odaberi Pokus pogreške → Odspojen DQ. Zabilježi pokus dok konzola javlja pogrešku, zatim vrati uredan prijenos.',
    'Što treba prikazati ako očitanje nije uspjelo?',
    ['Oznaku pogreške', 'Temperaturu 0 °C', 'Prethodni uzorak kao novi'],
    0
  ),
  'V1.10': criterion(
    'Senzori pokazuju jednaku temperaturu uz isti zadani ulaz.',
    'Zabilježi pokus kada se temperature senzora razlikuju za 1 °C. Provjera ponavlja usporedbu i obrće predznak.',
    'DS18B20 daje 24 °C, a DHT22 daje 25 °C. Koliko je prva vrijednost minus druga?',
    ['+1 °C', '−1 °C', '49 °C'],
    1
  ),
  'V2.1': criterion(
    'HTTP model potvrđuje prvu naredbu OPEN i otvara servo.',
    'Zamijeni prvu radnju s CLOSE. Potvrda i stvarni cilj trebaju se promijeniti.',
    'Što mora povezivati naredbu s njezinom potvrdom?',
    ['Ista temperatura', 'Isti broj retka u Wordu', 'Isti identifikator naredbe'],
    2
  ),
  'V2.2': criterion(
    'Dva uzastopna mrežna uzorka razmaknuta su 2000 ms.',
    'Zabilježi mrežne uzorke s razmakom 3000 ms prije vraćanja početnog intervala.',
    'Što neposredno mijenja učestalost slanja mjerenja?',
    ['INTERVAL_MS', 'Prag otvaranja', 'Broj prethodne naredbe'],
    0
  ),
  'V2.3': criterion(
    'HTTP zahtjev povezan je s potvrdom naredbe.',
    'Zabilježi pokus s protokolom MQTT i istim brojem naredbe.',
    'Kako se MQTT poruke usmjeravaju primateljima?',
    ['Prema broju uzorka', 'Prema temi', 'Prema izmjerenoj temperaturi'],
    1
  ),
  'V2.S': criterion(
    'Lokalni zapis razlikuje valjanu, ponovljenu, zastarjelu i nepoznatu naredbu.',
    'Za provjeru u drugoj poruci zadaj novi broj 2 i radnju CLOSE. Mora biti prihvaćena i zatvoriti servo.',
    'Što se događa s ciljem kod odbijene naredbe u ručnom načinu?',
    ['Uvijek se zatvara', 'Uvijek se otvara', 'Zadržava dotadašnji cilj'],
    2
  ),
  'V2.4': criterion(
    'Model tijekom rada prolazi kroz prekid i ponovnu dostavu.',
    'Dodaj još jedan uzastopni OFFLINE. Mjerenja se nastavljaju kroz oba koraka.',
    'Što tijekom prekida veze lokalni uređaj i dalje može raditi?',
    ['Mjeriti temperaturu', 'Primati nove udaljene naredbe', 'Potvrditi novu dostavu mreži'],
    0
  ),
  'V2.5': criterion(
    'Alarm se uključuje pri 31 °C i gasi pri 27 °C.',
    'Zabilježi 29 °C. Provjera ispituje alarm pri dolasku odozgo i odozdo.',
    'Nakon 31 °C slijedi 29 °C uz prag gašenja 28 °C. Što pokazuje alarm?',
    ['Isključen', 'Uključen', 'Pogrešku senzora'],
    1
  ),
  'V2.6': criterion(
    'Lokalno mjerenje, cilj i potvrda vidljivi su u istom ciklusu poruka.',
    'Zabilježi pokus uz temperaturu iznad 30 °C. Tijekom prekida provjeravaju se alarm i samostalni cilj.',
    'Što mora nastaviti raditi bez udaljenog nadzora?',
    ['Prijenos MQTT potvrda', 'Osvježavanje udaljene aplikacije', 'Lokalna regulacija i alarm'],
    2
  ),
  'V3.1': criterion(
    'Na valjanu temperaturu odgovaraju LED i servo na sklopu.',
    'Zabilježi simulaciju sklopljenog modela na 28 °C.',
    'Čemu služi zajednička masa izvora i pločice?',
    ['Daje zajedničku referencu signala', 'Određuje prag otvaranja', 'Zamjenjuje signalni vod serva'],
    0
  ),
  'V3.2': criterion(
    'Servo na zasebnom napajanju postiže početna dva položaja.',
    'Zabilježi drugi cilj od 150° prije vraćanja početne vrijednosti.',
    'Koji vod prenosi naredbu položaja?',
    ['V+', 'SIG', 'GND'],
    1
  ),
  'V3.3': criterion(
    'Valjano očitanje upravlja LED-om i servom.',
    'Za provjeru odaberi granu DQ. U izborniku senzora Pokus pogreške odaberi Odspojen DQ i zabilježi pokus prije popravka.',
    'Koje opažanje upućuje na prekid grane senzora?',
    ['Samo se zaslon zatamni', 'Servo izgubi napajanje', 'Nema valjanog novog očitanja'],
    2
  ),
  'V3.4': criterion(
    'Pri promjeni temperature rade obje izlazne grane.',
    'Zabilježi odspojeni signal serva uz ispravan senzor i LED, zatim obnovi spoj.',
    'Ako LED prati temperaturu, a servo nema impulse, koju granu prvo provjeriti?',
    ['Signal serva', 'Podatkovni vod senzora', 'Serijski monitor'],
    0
  ),
  'V3.5': criterion(
    'Regulator otvara na 27 °C i zatvara na 26 °C.',
    'Zabilježi pokus s popravljenom vezom i temperaturom 25 °C. Provjera izaziva prekid i oporavak na toj inačici.',
    'Koji je dokaz oporavka senzora?',
    ['Nestao je prethodni redak', 'Novo valjano očitanje i odgovarajući izlaz', 'Ponovljen stari uzorak'],
    1
  ),
  'V3.6': criterion(
    'Početni ciklus modela traje oko 2000 ms.',
    'Premjesti komponentu uz očuvanje veza i za provjeru zadaj interval 3000 ms.',
    'Što mijenja premještanje simbola uz iste vodiče?',
    ['Prag regulacije', 'Period mjerenja', 'Raspored na crtežu'],
    2
  ),
  'V3.7': criterion(
    'Model može zatvoriti i otvoriti prema temperaturi.',
    'Nakon demonstracije stanja zadržavanja zabilježi ulaz 26,5 °C.',
    'Koji slijed dokazuje zadržavanje otvorenog položaja?',
    ['25 → 28 → 26,5 °C', '25 → 25 → 25 °C', '28 → 25 → 25 °C'],
    0
  ),
  'V4.1': criterion(
    'Funkcija u biblioteci otvara na 27 °C.',
    'Za provjeru u biblioteci pomakni prag otvaranja na 28 °C. Zadrži prag zatvaranja 26 °C.',
    'Koji rezultat očekuješ između dvaju pragova?',
    ['Uvijek OPEN', 'Prethodno stanje', 'Uvijek CLOSE'],
    1
  ),
  'V4.2': criterion(
    'Program A koristi zajedničku odluku s početnim pragom.',
    'U biblioteci postavi prag 28 °C. Za drugi pokus odaberi PROGRAM B sa zadanim nizom. Provjera pokreće B i početni A s novom bibliotekom.',
    'Gdje treba održavati pravilo kojeg se koriste oba programa?',
    ['U trećoj kopiji glavnog programa', 'U svakoj petlji zasebno', 'U zajedničkoj biblioteci'],
    2
  ),
  'V4.3': criterion(
    'Program A očitava ulaz i obrađuje ga zajedničkom funkcijom.',
    'U biblioteci postavi prag 28 °C i zabilježi PROGRAM B sa zadanim nizom. Provjera pokreće B i početni A s novom bibliotekom.',
    'Što programu B daje ponovljivost?',
    ['Unaprijed zadani niz ulaza', 'Nova slučajna temperatura', 'Promjena napajanja'],
    0
  ),
  'V4.4': criterion(
    'TCP model uzorkuje i dok čeka odgovor.',
    'Dodaj drugi uzastopni korak WAIT. Oba trebaju imati novi uzorak, a zatim mora stići potvrda.',
    'Što pokazuje da čekanje odgovora nije zaustavilo mjerenje?',
    ['Jednak broj naredbe', 'Novi redni brojevi uzoraka tijekom čekanja', 'Isti zapis dvaput'],
    1
  ),
  'V4.5': criterion(
    'Otvaranje i alarm reagiraju na svoje pragove.',
    'Zabilježi 28 °C nakon niže temperature. Provjera ispituje različite kombinacije dvaju izlaza.',
    'Pri zagrijavanju od 25 na 28 °C, uz pragove 27 i 30 °C, koji je izlaz aktivan?',
    ['Samo alarm', 'Oba izlaza', 'Samo otvor'],
    2
  ),
  'V4.6': criterion(
    'Početni alarm reagira na prag od 30 °C.',
    'Za provjeru promijeni samo prag uključivanja alarma na 32 °C.',
    'Što pri pomaku samo praga alarma ostaje jednako?',
    [
      'Temperatura otvaranja',
      'Temperatura uključivanja alarma',
      'Broj aktivnih alarma pri svakoj temperaturi'
    ],
    0
  )
};
