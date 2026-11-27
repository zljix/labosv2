import type { LabId } from '../lessons/ursLab';

// For numerical results the learner chooses the algorithm and identifiers. The
// short serial record defines how the checker can read an otherwise free report.
export const labHints: Record<LabId, [string, string, string]> = {
  LV01: [
    'Provjera mjeri trajanje uključenja i isključenja D13.',
    'Provjera traži dva kratka bljeska i dulju stanku u više ciklusa.',
    'Provjeravaju se tri bljeska, stanka i uporaba konstante u for-petlji.'
  ],
  LV02: [
    'Prikaži ime i 4.f u dvama recima fontom početnog programa.',
    'Provjera očitava znak * u gornjoj desnoj četvrtini prikaza tijekom parnih i neparnih sekundi.',
    'Na dnu nacrtaj okvir širok najmanje 40 piksela. Provjera uspoređuje ispunu u nekoliko sekundi.'
  ],
  LV03: [
    'U zasebnom retku ispiši P1 pa razliku ili GRESKA. Primjer formata je P1 2.4.',
    'Pri svakom mjerenju ispiši UZ pa dvije temperature redom LM35 i DS18B20. Za nedostupan senzor upiši ERR. U retku P2 ispiši min i maks prvog, zatim drugog senzora.',
    'Ispiši UZ kao u P2. Nakon svakih deset očitanja u retku P3 ispiši prosjek i broj valjanih uzoraka svakog senzora redom. Za nedostupan prosjek upiši ERR.'
  ],
  LV04: [
    'U retku P1 ispiši razliku temperatura i razliku vlažnosti ili GRESKA kad par nije valjan. U izvještaju navedi jedinice.',
    'Za svaki ciklus u retku P2 ispiši dva zasebna ukupna broja pogrešaka redom za DHT11 i DHT22.',
    'Ispiši UZ pa T11, T22, RH11, RH22. Za pogrešku upiši ERR. Nakon deset ciklusa u retku P3 za svaku veličinu tim redom ispiši njezin prosjek i broj valjanih uzoraka.'
  ],
  LV05: [
    'U retku P1 ispiši broj valjanih temperatura, minimum, maksimum i raspon.',
    'U svakom ciklusu ispiši UZ pa pet temperatura i tri vlažnosti u redoslijedu iz zaglavlja, uz ERR za pogrešku. Nakon deset ciklusa u retku P2 za svaku veličinu ispiši prosjek i broj valjanih uzoraka.',
    'Zadrži retke UZ iz P2. Nakon deset ciklusa u retku P3 ispiši pet odstupanja temperaturnih prosjeka od zajedničkog prosjeka. Za nedostupno odstupanje upiši ERR.'
  ],
  LV06: [
    'Provjera postavlja potenciometar na početak, kraj i sredinu te mjeri impulse.',
    'Za provjeru zadrži raspon iz P1. Provjeravaju se prvi položaj, promjena za 1° i zatim promjena za više stupnjeva.',
    'Provjera mijenja zadani položaj tijekom kretanja i mjeri redoslijed i brzinu promjene impulsa.'
  ],
  LV07: [
    'Inicijale od dva ili tri slova ispiši u zasebnom retku na TFT-u. Odaberi dvije različite nove boje pokaznika.',
    'Na TFT-u prikaži broj promjena nakon oznake N= ili u zasebnom retku. Provjera uključuje držanje i otpuštanje tipke.',
    'Provjera čita relej, stanje i broj promjena na TFT-u prije i nakon automatskog isključenja.'
  ],
  LV08: [
    'Oznaku razine ispiši na serijsku konzolu ili na OLED.',
    'U retku P2 ispiši odstupanje tlaka u hPa od prve valjane vrijednosti.',
    'Na stranicu ekstrema upiši MIN i MAX te njihove vrijednosti u hPa. Provjera mijenja tlak dok se stranice izmjenjuju.'
  ],
  LV09: [
    'Za ponovljivu provjeru simulatora odaberi prag mraka 200 i prag svjetla 650 ADC jedinica. Na postaji obrazloži vlastite pragove.',
    'U retku P2 prikaži zadnjih pet očitanja ADC-a od najstarijeg do najnovijeg i njihov prosjek. Njime upravljaj relejem s pragovima iz P1.',
    'Provjera simulira dva kratka zatamnjenja odvojena svjetlom pa jedan neprekinuti mrak dulji od 2 s.'
  ],
  LV10: [
    'Na virtualnom daljinskom koristi adresu 0, ON 0x45 i OFF 0x46. Ispiši ON ili OFF nakon obrade.',
    'Nakon svake obrađene poruke u retku P2 ispiši kumulativni broj stvarnih promjena.',
    'Provjera ponavlja valjanu ON naredbu i mjeri vrijeme od posljednje ON naredbe.'
  ],
  LV11: [
    'Provjeravaju se pragovi 25 % i 75 % pri porastu i padu razine.',
    'U retku P2 ispiši broj stvarnih uključivanja pumpe. Provjera drži razinu niskom i ponavlja ciklus.',
    'Provjera očitava relej i poruku KVAR, uključujući novi zahtjev nakon isteka vremena.'
  ],
  LV12: [
    'Pri prijelazu ispiši SPREMNO, RAD ili GOTOVO. Provjera prati pet sekundi rada i broj ispisa.',
    'Provjera ponovno pritišće tipku usred ciklusa te očitava relej i 0000 na pokazniku.',
    'Provjera uspoređuje preostalo vrijeme prije pauze i nakon nastavka te stanje releja.'
  ],
  LV13: [
    'Provjera uz stalnu zadanu temperaturu mijenja temperaturu oko oba nova praga.',
    'U retku P2 pri novom valjanom mjerenju ispiši vrijeme tog očitanja u ms od početka i broj stvarnih uključenja grijanja.',
    'Provjera prekida podatkovnu vezu i vraća valjanu nisku temperaturu. U zaključanom stanju ispiši ZAKLJUCANO.'
  ],
  LV14: [
    'Provjera prvo zadaje nulu pa niz vrijednosti ADC-a te mjeri radni omjer na D5.',
    'Provjera mjeri porast PWM-a kroz vrijeme i aktivira STOP tijekom porasta.',
    'Provjera mjeri dva puna radna ciklusa i zatim aktivira STOP.'
  ],
  LV15: [
    'Provjera broji pravilne električne polukorake i završno gašenje izlaza.',
    'Provjera pokreće dva dovršena pomaka i uspoređuje broj i smjer polukoraka.',
    'U retku P3 pri prekidu ispiši broj poslanih polukoraka. Provjera uspoređuje brojilo s izlazima i ponovno pokreće pomak.'
  ],
  LV15B: [
    'Simulirani motor ima 200 punih koraka po okretaju. Provjera računa četvrtinu okretaja prema postavci motora i pogona.',
    'Provjera mjeri dva jednaka pomaka suprotnog smjera i traži čiste STEP impulse.',
    'U retku P3 pri prekidu ispiši broj poslanih impulsa. Provjera broji prihvaćene impulse i ponovno pokreće pomak.'
  ],
  LV16: [
    'Provjera čita Ready i izlaz Motor za sva četiri spoja dopuštenja te nakon starta.',
    'Provjera mjeri odgodu TON, prekida dopuštenje tijekom čekanja i ponovno zadaje Start.',
    'Provjera prekida zaštitu te iskušava reset s pritisnutim Startom, bez dopuštenja i na kraju s ispunjenim uvjetima.'
  ]
};
