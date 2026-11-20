# Provjera potpunog rada bez mreže

Ovaj postupak koristi zasebni GitHub Actions testni host. Ne mijenja mrežne
postavke upravljanog preglednika ni računala korisnika. Ne objavljuje aplikaciju.

1. Izgradi se postojeći prototip i provjere jezgre, radni proces i paket.
2. Chromium u vlastiti profil spremi aplikaciju, prevoditelj, izvor i kontrolne
   nepovezane zapise. Prevede se početni program. Preglednik i HTTP poslužitelj
   potpuno se zatvaraju.
3. Novi proces pokrene se kroz Linux `unshare --net`, zatim se vrati običnom
   korisniku runnera. U tom mrežnom prostoru postoji samo isključeni `lo`.
   Test odbija aktivno mrežno sučelje, aktivni loopback i isti namespace kao
   tijekom pripreme. Ne oslanja se samo na `navigator.onLine` ili HTTP pogrešku.
4. Chromium se ponovno pokreće s istim profilom. Stranicu mora poslužiti
   pohranjeni service worker. Potpuno novi izvori nastaju tek u izolaciji.
5. Za Uno/Nano prevode se i izvršavaju Blink, promijenjeni zasebni C++ i C.
   Provjeravaju se pogreška izvora, prekid, drugi puni restart preglednika,
   novo prevođenje nakon restarta te očuvanje nepovezanih podataka.

Profil se između faza ne briše. Sam GitHub job počinje na svježem testnom
hostu; to nije dokaz nadogradnje iz svake prijašnje inačice aplikacije.
Postojeća provjera nadogradnje iz prototipa 01 ostaje u `EVIDENCE-02.md`.

Rezultati su u Actions artefaktu `AVR-offline-proof-<commit>`:
`prepare.json`, `isolated.json` i slike prikaza. Uspjeh se priznaje samo
ako oba JSON izvještaja imaju `success: true` za isti paket i posao završi
uspješno. Dodana skripta ili pokrenut posao sami po sebi nisu dokaz prolaza.

Mjerenje memorije uzorkuje RSS potomaka Node testnog procesa svakih 200 ms.
Zbroj RSS-a može višestruko brojiti dijeljene stranice; nije točno mjerenje
jedinstvene fizičke memorije niti samo Worker memorije. Rezultat je mjerenje
CI hosta, ne školskog računala ili fizičkog mobitela. Mobilni prikaz je samo
provjera širine 390 px.

Prva uspješna provedba i sačuvani JSON dokazi: [EVIDENCE-03.md](EVIDENCE-03.md).

## Pokretanje na zasebnom Linux testnom računalu

```sh
npm ci
npm ci --prefix prototypes/avr-offline/ci
prototypes/avr-offline/ci/node_modules/.bin/playwright install --with-deps chromium
npm run prototype:avr:build
node prototypes/avr-offline/isolated-browser-test.mjs prepare
test_runner_user="$(id -un)"
test_node_path="$(command -v node)"
sudo unshare --net -- runuser -u "$test_runner_user" -- "$test_node_path" prototypes/avr-offline/isolated-browser-test.mjs isolated
```

Naredba izolira samo novi testni proces i njegove potomke. Chromium za ovaj
namjenski CI profil koristi `--no-sandbox`; time se ne potvrđuje rad njegova
vlastitog sandboxa. Mrežna izolacija ostvaruje se zasebnim OS namespaceom.
Za prevođenje učenikova programa u pripremljenoj aplikaciji nisu potrebni
Node, Playwright, sudo ni ova razvojna provjera.
