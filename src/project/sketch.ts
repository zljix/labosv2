import {strToU8,zipSync} from 'fflate';
import {parseProject,type Project} from './model';
import {selectedLibraries,buildInput} from '../../public/arduino-contract.mjs';

/** Arduino IDE requires a primary .ino matching its containing folder. */
export function exportSketch(input:Project):Uint8Array {
  const project=parseProject(input);
  if(project.radio)throw Error('U prozoru Dva čvora izvezi izvor odabranog čvora, ili izvezi cijeli projekt ZIP.');
  if(project.language!=='arduino-cpp')throw Error('Arduino izvoz zahtijeva projekt Arduino C/C++.');
  buildInput(project);
  const folder='LabSketch',entries:Record<string,Uint8Array>={};
  for(const [path,source] of Object.entries(project.files)){
    if(!/\.(ino|c|cpp|h|hpp)$/.test(path))continue;
    // Arduino IDE builds sources in the sketch root or src/, not arbitrary folders.
    if(path.includes('/')&&(!path.startsWith('src/')||path.endsWith('.ino')))throw Error('Za Arduino IDE premjesti izvorne datoteke iz podmapa u src/ ili u korijen projekta: '+path);
    const target=path===project.entryFile?folder+'.ino':path;
    if(Object.keys(entries).some(name=>name.toLowerCase()===(folder+'/'+target).toLowerCase()))throw Error('Naziv datoteke sukobljava se s glavnim sketchom: '+target);
    entries[folder+'/'+target]=strToU8(source);
  }
  const libraries=selectedLibraries(project);
  entries[folder+'/README.txt']=strToU8(`Otvori LabSketch.ino u Arduino IDE-u.\nPločica: ${project.board.id}\nFQBN: ${project.target.fqbn}\nZaključane biblioteke: ${libraries.map((l:{name:string;version:string})=>l.name+'@'+l.version).join(', ')||'samo osnovni API'}.\nOvo je izvoz izvornog koda. WASM nije firmware za fizički ESP32. Zasebno prevedi za navedeni pravi cilj i provjeri module/pinout. Instaliraj točno odabrane biblioteke iz mape vendor/arduino u paketu prevoditelja. Paket uključuje Lab drivere i ograničene U8g2 inačice; nisu svi paketi u Library Manageru. Odaberi U8g2 ili U8g2_12832, ne oba istodobno.\nCijeli sklop i ostale datoteke čuvaju se zasebnim izvozom projekta u aplikaciji.\n`);
  return zipSync(entries,{level:6});
}
