import type {ExerciseId} from './CollectionMaterials';
const readings:Partial<Record<ExerciseId,[string,string,string]>>={
  'V2.2':['Isti uređaj i pokretanje. Uzorci 12, 13 i 14 nastali su u 10 000, 13 000 i 16 000 ms.','Koliki je razmak između dva nova uzorka?','Oba razmaka iznose 3000 ms. Za izračun uzimaš vremena nastanka uzorka na uređaju.'],
  'V2.3':['Uređaj u07 objavio je uzorak 12. Aplikacija prikazuje u08 i čeka podatke.','Što prvo provjeravaš na nadzornoj ploči?','Odaberi u07, zatim usporedi oznaku pokretanja i broj uzorka. U MQTT-u provjeri i temu na koju je aplikacija pretplaćena.'],
  'V2.S':['Uređaj u07 obradio je OPEN s brojem 7. Za sljedeću naredbu u zapisu nedostaje potvrda.','Što možeš zaključiti o drugoj naredbi?','Ishod je bez potvrde. Za zaključak da je naredba odbijena treba odgovor s istim brojem naredbe i razlogom odbijanja.'],
  'V2.4':['Prije pauze nadzora zapis pokazuje MANUAL i OPEN. Nakon više od šest sekundi uređaj bilježi novi uzorak i način AUTO.','Koji je dio uređaja radio tijekom pauze?','Nastavilo se lokalno mjerenje. Način AUTO pokazuje povratak automatskog upravljanja. Položaj serva provjeri na postaji.'],
  'V2.5':['Niz valjanih temperatura iz probnog modela glasi 30, 29 i 28 °C. Na 30 °C uključen je alarm.','Zašto za srednji uzorak trebaš i prethodno stanje?','Kod alarma s dva praga srednja vrijednost zadržava prethodno stanje. Prati redoslijed uzoraka te odvojeno zabilježi opažanje LED-a.'],
  'V2.6':['Uređaj u07 poslao je uzorak 12 i zatim prihvatio naredbu OPEN broj 8.','Koje oznake povezuju mjerenje, a koje povezuju naredbu?','Mjerenje poveži prema uređaju, pokretanju i broju uzorka. Za naredbu pronađi potvrdu broja 8 na istom uređaju.'],
  'V4.4':['Na satu uređaja u 10 000 ms počinje čekanje odgovora. U 11 600 ms dovršen je novi uzorak. U 13 000 ms uređaj prima odgovor.','Koji zapis pokazuje da program nastavlja mjeriti tijekom čekanja?','Novi uzorak u 11 600 ms nastao je nakon slanja i prije odgovora. Za ovu usporedbu sva tri vremena čitaj s uređaja.'],
  'V4.5':['Na nadzornoj ploči potvrđen je prijelaz otvora na OPEN. U zasebnom stupcu stoji prethodno stanje alarma.','Koja dva izlaza opažaš odvojeno na postaji?','LED cilja otvora i alarmni LED. Za svaki zabilježi vlastito opažanje uz odgovarajući uzorak i stanje programa.'],
  'V4.6':['Početni je cilj CLOSED. Prag otvaranja premješten je s 27 na 28 °C, a probni ulaz iznosi 27 °C.','Koji cilj očekuješ s novim pragom?','Cilj ostaje CLOSED. Za sljedeću provjeru upotrijebi 28 °C, zatim vrati izvorni prag i ponovi pokus.'],
};
export function OfflineReading({id}:{id:ExerciseId}) {
  const task=readings[id];
  return task && <details><summary>Priprema bez mreže · ogledni zapis</summary>
    <p>{task[0]}</p><p><strong>{task[1]}</strong></p><details><summary>Provjeri odgovor</summary><p>{task[2]}</p></details>
  </details>;
}
