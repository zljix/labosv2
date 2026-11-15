import { S3, getBoard, type BoardId, type Language } from '../boards/profiles';
import {S3_FQBN} from '../../public/s3-contract.mjs';

export interface RuntimeProfile {id:'micropython-wasm'|'arduino-avr'|'arduino-s3-wasm';version:1}
export const projectTarget=(board:BoardId,language:Language)=>board===S3&&language==='arduino-cpp'?S3_FQBN:getBoard(board).fqbn??null;
export function runtimeProfile(board:BoardId,language:Language):RuntimeProfile {
  if(!getBoard(board).languages.includes(language))throw Error('Odabrana pločica ne podržava taj jezik.');
  return {id:board===S3?(language==='arduino-cpp'?'arduino-s3-wasm':'micropython-wasm'):'arduino-avr',version:1};
}
export function runtimeAvailability(board:BoardId,language:Language) {
  const profile=runtimeProfile(board,language);
  if(profile.id==='arduino-s3-wasm')return {available:true,message:'ESP32-S3 · funkcionalni C++ WASM profil. Potreban je prevedeni program; nije firmware za pločicu.',profile};
  return profile.id==='micropython-wasm'
    ? {available:true,message:'MicroPython · funkcionalni simulator',profile}
    : {available:true,message:'AVR simulator · potreban je valjan prevedeni program za aktualni izvor. Novo prevođenje koristi lokalni razvojni most.',profile};
}
