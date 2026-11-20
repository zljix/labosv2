# Labos 0.15.2-beta.1 · 25C — čitljiviji sklop i kôd

Polazište: `e38636ff5dcbac2aa33e9bdd532c2988b393c8f4`, nastavak plana grafičkog uređenja. Opseg: zljix/labos.

## Dorade

- Prelomi retke u editoru uključuje vizualno prelamanje kroz CodeMirror compartment. Kôd, brojevi izvornih redaka, revizija projekta i povijest uređivanja ne mijenjaju se tom radnjom. Postavka vrijedi tijekom rada u aplikaciji, bez promjene formata projekta.
- Dodavanje komponente zatvara katalog, odabire komponentu, prilagođava pogled i vraća fokus na sklop. Pretraga ima broj rezultata, objašnjenje praznog rezultata i gumb za čišćenje. Esc zatvara katalog i vraća fokus na njegov naslov.
- Datoteke imaju vlastiti gumb za sklapanje. Zatvaranje datoteka ili uputa vraća fokus na pripadni gumb, odnosno mobilni prikaz Sklop.
- Tamnije pomoćne oznake, brojevi redaka i kontrole konzole u svijetloj temi. Boje pogrešaka i aktivnih kontrola prate temu; popravljen tamni tekst na tamnoj pozadini pri prelasku preko primarnog gumba u tamnoj temi.
- Konzola koristi 14 px; kontrole i opisi sklopa 13 px. Svojstva više nemaju dodatno ograničenje visine unutar već pomičnog panela. Editor može koristiti nisko radno područje bez prisilnog minimuma od 300 px.
- Mobilne glavne radnje su kompaktnije; navigacija između područja ostaje pri vrhu tijekom pomicanja. Zaglavlje dijaloga sa zatvaranjem ostaje vidljivo pri pomicanju njegovog sadržaja.
- Ažurirane korisničke upute i oznake izdanja. Bodovanje i format učeničkih projekata ostaju isti.

## Provjere

- TypeScript i produkcijska izgradnja za `/labos/`.
- 57 provjera projekata, spojeva, usmjeravanja vodiča i školske sinkronizacije.
- 8 provjera radnog prostora i nastavnog tijeka, uključujući prošireni test dodavanja komponente, vidljivosti u viewBoxu, odabira, fokusa i zatvaranja tipkom Esc.
- 14 provjera Pages resursa i školskog pilota. Ukupno: 79 ciljanih automatiziranih provjera.
- Preglednik: MicroPython LED program pokrenut i zaustavljen, ispis provjeren; prelamanje zadržava jednak tekst programa; zatvaranje datoteka vraća fokus na mobilni Sklop; pregled svijetle i tamne teme.
- Okviri 390 × 844, 768 × 1024, 1024 × 768, 1280 × 720, 1366 × 768, 844 × 390 i 683 × 384 nemaju vodoravno prelijevanje dokumenta u pregledanom prikazu. Posljednji okvir provjerava prijelom pri raspoloživom prostoru usporedivom s 200 % uvećanjem; nije dokaz stvarnog browser zooma ili fizičkog dodira.
- Prethodna cjelovita školska provjera za 25B završila je uspješno: https://github.com/zljix/labos/actions/runs/44313317331 . Nije prikazana kao nova cjelovita provjera 25C.

## Otvoreno

Stvarni iOS/Android dodir, projektor, učenički pilot i cjeloviti audit pristupačnosti ostaju otvoreni. Beta oznaka ostaje; tehnički prolaz nije potvrda nastavne primjenjivosti u svim uvjetima.

## Javna objava

Korisnik je izričito odobrio objavu. Izvorni commit izdanja: `21a3511cd6638d18a3a1b22dc24250b178b82d56`. Stablo objavljenog izvora podudara se s lokalno provjerenim stablom (`e05ec226cb185593128547eb248c0c7cbe9e212e`).

[GitHub Pages izgradnja i objava](https://github.com/zljix/labos/actions/runs/44362368051) završile su uspješno. Javno posluženi `offline-package.json` potvrđuje verziju `0.15.2-beta.1` i paket `63813ed0e00f4247` na https://zljix.github.io/labos/ .

[Cjelovita školska regresijska provjera](https://github.com/zljix/labos/actions/runs/44362367948) pokrenuta je za isti commit; pri ovoj potvrdi objave još je u tijeku. Njezin rezultat nije uključen u potvrdu 79 ciljanih provjera ni u potvrdu Pages objave.

## Otvorena provjera offline nadogradnje

U pregledniku sa starim paketom `0.15.1-beta.1` / `9856dc508d8fff58`, nakon provjere nadogradnje prikazana je poruka: „Nova verzija nije pripremljena. Trenutačni paket ostaje dostupan.” Ponovljeni pokušaj nije otklonio pogrešku. Postojeći projekt i predmemorija nisu brisani. Uspješna objava na Pagesu zato nije potvrda uspješnog prijelaza postojećih offline instalacija.

Pokrenuta je provjera veličine i SHA-256 svih 205 javnih datoteka prema manifestu. Njezin rezultat nije dohvaćen jer je automatska provjera odobrenja daljnjeg čitanja rezultata bila blokirana limitom korištenja. Uzrok neuspješne instalacije ostaje nepotvrđen; nema dokaza da su sve javne datoteke dostupne s očekivanim sažetcima.

Sljedeće: dovršiti provjeru javnih resursa, utvrditi uzrok instalacijske pogreške i ponoviti prijelaz sa starog paketa uz očuvanje projekta. Provjeriti konačni rezultat školske CI provjere 44362367948. Ne brisati korisničke podatke radi zaobilaženja pogreške.
