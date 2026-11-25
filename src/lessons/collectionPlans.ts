import titles from './iotUsTitles.json';

export type ExerciseId = keyof typeof titles;
type Rig = 'console'|'blink'|'light'|'pwm'|'servo'|'temperature'|'calibration'|'compare'|'model'|'alarm'|'network'|'library';
export interface Practice {rig:Rig; task:string; change:string; question:string}
const task=(rig:Rig,task:string,change:string,question:string):Practice=>({rig,task,change,question});

export const practices:Record<ExerciseId,Practice>={
 P0:task('console','Pokreni program i pronađi dvije jednake poruke.','U programu izmijeni poruku i trajanje čekanja. Pokreni ponovno.','Kako iz ispisa prepoznaješ svoju inačicu programa?'),
 'V1.1':task('model','Postavi temperaturu na 25 °C, zatim 28 °C. Prati što se dogodi nakon novog očitanja.','Postavi 26,5 °C najprije nakon toplijeg, zatim nakon hladnijeg uzorka.','Kako temperatura, odluka i signal serva ovise o prethodnom stanju?'),
 'V1.2':task('blink','Prati strujni put od izlaza kroz otpornik i LED do mase. Pokreni treptanje.','Zaustavi rad, odspoji povratni vodič LED-a, pokreni, zatim obnovi spoj.','Zašto ispis programa i svjetlo LED-a mogu pokazivati različite stvari?'),
 'V1.3':task('blink','Usporedi trajanje uključenog i isključenog stanja diode.','Udvostruči čekanje. Na pločici premjesti kraj vodiča na nepovezani red i zatim ga vrati.','Koja je promjena utjecala na period, a koja na zatvaranje strujnog kruga?'),
 'V1.4':task('temperature','Prikupi pet uzoraka s oznakom vremena.','Promijeni INTERVAL_MS s 2000 na 3000 i usporedi razmake dvaju novih uzoraka.','Kako razlikuješ novi uzorak od ponovljenog prikaza iste vrijednosti?'),
 'V1.5':task('light','U živim ulazima promijeni osvjetljenje virtualnog senzora TEMT6000. Prati ADC i LED.','Odaberi prag između dvaju izmjerenih očitanja i ponovi pokus. Na postaji isti postupak ponovi s LDR djeliteljem iz Worda.','Između kojih očitanja tvoj prag pouzdano razlikuje svjetlo i tamu?'),
 'V1.6':task('pwm','Prati izmjenu dvaju radnih omjera LED-a i dvaju položaja virtualnog serva.','Promijeni samo DRUGI_KUT, zatim samo DRUGA_SVJETLINA. Usporedi oba izlaza.','Koja postavka određuje trajanje impulsa serva, a koja svjetlinu LED-a?'),
 'V1.7':task('calibration','Zadaj vrijednost reference 25 °C i postavi simulirani senzor na 24 °C.','Izračunaj korekciju, upiši je u program, zatim provjeri na još dva para s istim odmakom.','Kako iz reference i očitanja određuješ predznak korekcije?'),
 'V1.8':task('servo','Iz ispisa očitaj kut i trajanje upravljačkog impulsa. Usporedi ih s prikazom serva.','Isprobaj 30°, 90° i 150°. Zabilježi impuls za svaku postavku.','Kako promjena trajanja impulsa utječe na virtualni položaj?'),
 'V1.9':task('model','Podigni temperaturu s 25 na 28 °C. Prati otvaranje i signalnu LED.','Zaustavi program, odspoji DQ i ponovno pokreni. Obnovi vezu i usporedi ispis.','Kako razlikuješ kvar očitanja od ispravno izmjerene niske temperature?'),
 'V1.10':task('compare','Postavi DS18B20 i DHT22 na isti ulaz te zabilježi par njihovih očitanja.','Jednom senzoru promijeni temperaturu za 1 °C. Ponovi za tri različite vrijednosti.','Kolika je razlika po paru i što ti govori o usporedbi dvaju senzora?'),
 'V2.1':task('network','U lokalnom modelu HTTP-a prati broj uzorka, zahtjev te odgovor na OPEN.','U nizu poruka zamijeni OPEN s CLOSE. Usporedi potvrdu i položaj serva.','Koji broj povezuje poslanu naredbu s njezinom potvrdom?'),
 'V2.2':task('network','Očitaj vrijeme dvaju uzastopnih uzoraka.','Promijeni INTERVAL_MS s 2000 na 3000 pa ga vrati. Promijeni i temperaturu u načinu AUTO.','Što određuje učestalost prikaza, a što odluku o otvaranju?'),
 'V2.3':task('network','Usporedi iste naredbe u lokalnom modelu HTTP-a i MQTT-a.','Promijeni PROTOKOL na HTTP ili MQTT. U drugom pokretanju usporedi oznake zahtjeva, teme i potvrde.','Kako aplikacija povezuje potvrdu s naredbom u oba slučaja?'),
 'V2.S':task('network','U zapisu pronađi prihvaćenu, ponovljenu, zastarjelu i nepoznatu naredbu.','Promijeni identifikator ili radnju u jednoj poruci i ponovi. Koristi samo ogledne podatke.','Koja od odbijenih naredbi mijenja položaj i zašto?'),
 'V2.4':task('network','Prati OPEN, ponovljeni broj, prekid veze i nastavak.','Produlji prekid dodavanjem još jednog koraka OFFLINE i promijeni temperaturu.','Što se tijekom prekida i dalje mjeri, a što izostaje?'),
 'V2.5':task('alarm','Postavi 27, 31, 29 i 27 °C tim redom. Prati dvije LED-ice.','Na 29 °C dođi jednom odozdo i jednom odozgo. Usporedi pamćenje alarma.','Zašto isti ulaz može dati dva različita stanja alarma?'),
 'V2.6':task('network','Prati temperaturu, cilj serva, alarm i potvrde u jednom zapisu.','Za vrijeme prekida podigni temperaturu iznad 30 °C, zatim vrati vezu i AUTO.','Koji dio sustava može nastaviti rad i kad udaljeni nadzor kasni?'),
 'V3.1':task('model','U sklopu pronađi DQ na GPIO4, LED cilja na GPIO21 i signal serva na GPIO14.','Prati vod signala i povratni vod. Pokreni pokus na 25 i 28 °C.','Koje tri veze nose podatke ili upravljački signal i koja je uloga zajedničke mase?'),
 'V3.2':task('servo','Pronađi zasebni virtualni izvor serva, zajedničku masu i signal.','Promijeni drugi ciljni kut, usporedi položaj i vrati početnu vrijednost.','Koji vod prenosi energiju, a koji zadani položaj?'),
 'V3.3':task('model','Prije pokretanja izradi tablicu veza za DS18B20, LED i servo.','Za jednu granu predvidi posljedicu prekida signala, provjeri i obnovi vezu.','Koji pokus dokazuje da su ulaz i izlaz povezani prema planu?'),
 'V3.4':task('model','Provjeri redom očitanje senzora, signalnu LED i položaj serva.','Isključi signal serva uz zaustavljenu simulaciju. Provjeri ostale grane prije vraćanja.','Kako si suzio uzrok kvara na samo jednu granu?'),
 'V3.5':task('model','Ispitaj redom 25, 27, 26,5, 26 i 25 °C. Zadrži svaku vrijednost do novog uzorka.','Prekini podatkovnu vezu senzora, potvrdi pogrešku, zatim popravi vezu.','Na kojim se granicama mijenja cilj i kako prepoznaješ oporavak?'),
 'V3.6':task('model','Sačuvaj početni ispis. U uređivaču premjesti komponentu uz očuvanje spojeva.','Provjeri isti ulaz prije i nakon premještanja, zatim promijeni INTERVAL_MS.','Koja dorada mijenja izgled, a koja mjerljivi vremenski razmak?'),
 'V3.7':task('model','Pripremi demonstraciju zatvaranja, otvaranja i zadržavanja položaja.','Napiši uputu za kolegu i ponovi jedan slučaj samo prema toj uputi.','Koju najmanju skupinu ulaza treba zadati za sva tri opažanja?'),
 'V4.1':task('library','Pronađi funkciju odluke i oba njezina praga. Pokreni program A.','Izmijeni prag otvaranja u biblioteci. Ispitaj vrijednosti neposredno ispod i iznad njega.','Kada funkcija treba vratiti prethodno stanje?'),
 'V4.2':task('library','Otvori datoteku biblioteke. Pronađi funkciju koja iz temperature i prethodnog položaja računa novi cilj.','U biblioteci promijeni prag. Pokreni A i B te provjeri služe li se istom odlukom.','Koji rezultat potvrđuje da je glavni program učitao izmjenu iz zasebne datoteke?'),
 'V4.3':task('library','Program A učitava senzor, a program B izvodi pripremljen niz. Oba pozivaju istu biblioteku.','Promijeni prag samo u biblioteci pa pokreni oba programa na istoj temperaturi.','Koju izmjenu možeš dokazati u oba programa bez prepisivanja funkcije?'),
 'V4.4':task('network','Prati brojeve novih mjerenja u koracima bez odgovora.','Dodaj korak WAIT prije sljedeće poruke. Provjeri potvrdu nakon ponovnog javljanja.','Koji ispis pokazuje da čekanje odgovora ne zaustavlja uzorkovanje?'),
 'V4.5':task('alarm','Prati dvije zasebne odluke, otvor pri 27 °C i alarm pri 30 °C.','Ispitaj 25, 28, 31 i 29 °C pa smanji temperaturu na 27 °C.','Za koje je očitanje otvor aktivan dok je alarm isključen?'),
 'V4.6':task('alarm','Prikaži početno stanje, otvaranje, uključivanje alarma i njegov oporavak.','Pomakni samo prag alarma. Izvedi isti niz temperatura prije i nakon izmjene.','Kako pokazuješ da promjena alarma nije promijenila prag otvaranja?')
};
