import {exampleCircuit} from '../circuit/examples';
import {getBoard,S3} from '../boards/profiles';
import {collectionAsset} from './CollectionMaterials';
import titles from './iotUsTitles.json';

export const extraProjects = ['V1.2','V1.3','V4.3'] as const;
export type ExtraProject = typeof extraProjects[number];
export const libraryPrograms = {
  provjera: 'Provjera biblioteke iz V4.2',
  program_a: 'A · Odluka iz temperature',
  program_b: 'B · Vremenski raspored',
} as const;
export type LibraryProgram = keyof typeof libraryPrograms;

export function ledCircuit() {
  const circuit=exampleCircuit('blink');
  const resistor=circuit.components.find(p=>p.kind==='resistor')!;
  resistor.properties.resistance=1000;
  resistor.label='1 kΩ';
  const wire=circuit.wires.find(w=>w.to.component===resistor.id)!;
  wire.from.pin=getBoard(S3).pins.find(pin=>pin.gpio===21)!.id;
  return circuit;
}

async function source(path:string) {
  const response=await fetch(collectionAsset(path));
  if(!response.ok)throw Error('Ne mogu učitati '+path);
  return response.text();
}

export async function libraryFiles() {
  const paths:Record<string,string>={
    'program_a.py':'V4_3/MicroPython/01_Automatski.py',
    'program_b.py':'V4_3/MicroPython/02_Raspored.py',
    'provjera.py':'V4_2/MicroPython/00_Provjera.py',
    'vent_model_ucenik.py':'V4_2/MicroPython/vent_model_ucenik.py',
    'lab_podrska.py':'V4_3/lab_podrska_sim.py',
  };
  return Object.fromEntries(await Promise.all(Object.entries(paths).map(async([name,path])=>[name,await source(path)])));
}

export function CollectionProgram({id,edit,catalog,choose,run,entry}:{id:ExtraProject;edit:(file:string)=>void;catalog:()=>void;choose:(program:LibraryProgram)=>void;run:()=>void;entry:string}) {
  return <article className="lesson-content"><div className="lesson-title"><h2>{id} · {titles[id]}</h2><button onClick={catalog}>Moja zbirka</button></div>
    {id==='V4.3'?<>
      <p>Radiš s jednom kopijom biblioteke za V4.2 i V4.3. Dopuni funkcije S1–S3 u vent_model_ucenik.py prema uputama iz V4.2, upiši autora i pokreni provjeru. Početni predložak prijavljuje da je nedovršen.</p>
      <button onClick={()=>edit('vent_model_ucenik.py')}>Uredi svoju biblioteku</button>
      <label>Program za pokretanje <select value={Object.keys(libraryPrograms).find(name=>entry.trim()==='import '+name)??''} onChange={e=>choose(e.target.value as LibraryProgram)}>
        <option disabled value="">Prilagođeni main.py</option>{Object.entries(libraryPrograms).map(([name,title])=><option key={name} value={name}>{title}</option>)}</select></label>
      <p>Pokreni A, zabilježi inačicu biblioteke i cilj nakon novog uzorka. Zatim pokreni B i prati naredbe nakon 3 i 7 sekundi. Promijeni inačicu biblioteke na jednome mjestu pa usporedi ispise obaju programa.</p>
      <div className="lesson-inline-actions"><button onClick={()=>edit('program_a.py')}>Uredi A</button><button onClick={()=>edit('program_b.py')}>Uredi B</button></div>
    </>:<>
      <p>U simulaciji GPIO21 upravlja LED-om kroz otpornik od 1 kΩ. Otvori main.py i predvidi što ćeš vidjeti u načinu BLINK. Pokreni program i promatraj LED na sklopu.</p>
      <p>{id==='V1.2'?'Isprobaj ON, OFF i BLINK. Napon s multimetra i fotografiju spoja upiši u Word na školskoj postaji.':'Promijeni BLINK_PERIOD_MS i usporedi trajanje cijelog ciklusa. Kontinuitet kontakata ispituješ multimetrom na nenapajanoj školskoj ploči.'}</p>
      <button onClick={()=>edit('main.py')}>Otvori main.py</button>
    </>}
    <button className="primary" onClick={run}>Pokreni odabrani program</button>
  </article>;
}
