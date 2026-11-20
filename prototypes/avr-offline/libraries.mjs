import {AVR_LIBRARIES,selectedLibraries,libraryManifest} from '../../public/avr-contract.mjs';

// These are the exact, already locked Labos source packages. No downloads or
// automatic dependency resolution occur while compiling in the browser.
export const LIBRARIES=AVR_LIBRARIES;
export const BUILTINS=['Wire','SPI','EEPROM'];
export function normalizeLibraries(value=[]){
  if(!Array.isArray(value))throw Error('Neispravan popis biblioteka prototipa.');
  const selected=selectedLibraries({files:{'arduino-libraries.json':libraryManifest(value)}});
  for(const item of value){
    const expected=selected.find(x=>x.name===item.name);
    if(item.digest!==undefined&&item.digest!==expected?.digest)throw Error('Neodgovarajući sažetak biblioteke '+item.name+'.');
  }
  return selected;
}
export function libraryPaths(board,libraries){
  const names=[...BUILTINS,...libraries.map(x=>x.name)];
  return {
    includes:names.map(name=>'-I/sysroot/libraries/'+name+'/include'),
    archives:names.filter(name=>name!=='EEPROM').map(name=>'/sysroot/arduino/boards/'+board+'/lib'+name+'.a'),
  };
}
