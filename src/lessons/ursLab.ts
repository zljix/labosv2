import sheets from './ursLabSheets.json';
import {NANO, S3} from '../boards/profiles';
import {appAsset} from '../platform/assets';
import {newProject, type Project} from '../project/model';
import {AVR_BUILD_FILE, AVR_LIBRARY_FILE, libraryManifest, validateArtifact} from '../../public/avr-contract.mjs';
import {cppST7735} from '../circuit/spiDrivers';
import {cppTM1637} from '../circuit/tm1637Examples';
import {cppNEC} from '../circuit/irExamples';
import {ursLabCircuit} from './ursLabCircuit';

export {sheets as ursLabSheets};
export type LabId = keyof typeof sheets;
export const labIds = Object.keys(sheets) as LabId[];
export const labTitle = 'URS';
export const levelNames = ['Lakši', 'Srednji', 'Napredni'] as const;
export const plcFiles = ['deklaracije.txt', 'program.txt'];
export const labAsset = (path:string) => appAsset('zbirke/urs-lv/' + path);
export function labForProject(p: Project): LabId | undefined {
  try {
    const k = JSON.parse(p.files['zbirka.json']);
    if (k.track === 'urs-lv' && k.instructions === 'v7' && Object.hasOwn(sheets, k.exercise) &&
        (k.exercise === 'LV16' ? p.language === 'micropython' && p.board.id === S3 : p.language === 'arduino-cpp' && p.board.id === NANO)) return k.exercise;
  } catch { /* Ordinary projects have no worksheet. */ }
}

const libraries: Partial<Record<LabId,string[]>> = {
  LV02:['U8g2_12832'], LV03:['DallasTemperature','OneWire'], LV04:['DHT'],
  LV05:['DallasTemperature','OneWire','DHT','LabAHT10'], LV06:['Servo'],
  LV08:['LabI2CSensors','U8g2_12832'], LV13:['DallasTemperature','OneWire']
};
const versions:Record<string,string> = {U8g2_12832:'2.37.1', OneWire:'2.3.8', DallasTemperature:'4.0.6', DHT:'1.4.6', LabAHT10:'1.0.0', Servo:'1.2.2', LabI2CSensors:'1.0.0'};

// Keep the worksheet algorithms and official station downloads. The small project
// drivers implement the commands used by these exercises on the Labos buses.
const includes: Record<string,string> = {
  'UrsOled.h':'#include <Adafruit_GFX.h>\n#include <Adafruit_SSD1306.h>',
  'UrsTft.h':'#include <Adafruit_GFX.h>\n#include <Adafruit_ST7735.h>',
  'UrsTlak.h':'#include <Adafruit_BMP085.h>', 'UrsAht.h':'#include <AHTxx.h>',
  'UrsIr.h':'#include <IRremote.hpp>', 'UrsBrojilo.h':'#include <TM1637Display.h>'
};
export function stationCode(code:string) {
  for (const [file, original] of Object.entries(includes)) code = code.replace('#include "' + file + '"', original);
  return code;
}
async function getText(path:string) {
  const response = await fetch(labAsset(path));
  if (!response.ok) throw Error('Nije moguće učitati datoteku ' + path);
  return response.text();
}
export async function createUrsLab(id:LabId, compiled = true) {
  const sheet = sheets[id], plc = id === 'LV16';
  const source = await getText(plc ? 'podrska/plc.py' : id + '/' + sheet.files[0]);
  const p = newProject(source.replace(/\r\n/g, '\n'), id + ' · ' + sheet.title, plc ? S3 : NANO, plc ? 'micropython' : 'arduino-cpp');
  p.circuit = ursLabCircuit(id);
  p.files['zbirka.json'] = JSON.stringify({track:'urs-lv', exercise:id, instructions:'v7'});
  if (plc) {
    const [variables, body, interpreter] = await Promise.all([
      getText(id + '/' + sheet.files[0]), getText(id + '/' + sheet.files[1]), getText('podrska/plc_st.py')
    ]);
    p.files[plcFiles[0]] = variables;
    p.files[plcFiles[1]] = body;
    p.files['plc_st.py'] = interpreter;
    p.settings.activeFile = plcFiles[1];
    return p;
  }
  for (const [file, original] of Object.entries(includes)) {
    if (!p.files['main.ino'].includes(original)) continue;
    p.files['main.ino'] = p.files['main.ino'].replace(original, '#include "' + file + '"');
    p.files[file] = await getText('podrska/' + file);
  }
  if (id === 'LV07') p.files['LabST7735.h'] = cppST7735;
  if (id === 'LV10') p.files['LabNEC.h'] = cppNEC;
  if (id === 'LV12') p.files['LabTM1637.h'] = cppTM1637;
  const libs = libraries[id];
  if (libs) p.files[AVR_LIBRARY_FILE] = libraryManifest(libs.map(name => ({name,version:versions[name]})));
  if (compiled) {
    const artifact = JSON.parse(await getText(id + '/pocetni.avr.json'));
    await validateArtifact(p, artifact);
    p.files[AVR_BUILD_FILE] = JSON.stringify(artifact);
  }
  return p;
}
