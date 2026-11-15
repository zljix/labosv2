import {readFileSync} from 'node:fs';
import {createUrsProject,type UrsTarget} from '../src/lessons/ursCatalog';
import type {Project} from '../src/project/model';
import registry from '../school/grader/profiles.json';
import {digest} from '../school/grader/official';
import {contractDigest,publishedRubric} from '../school/grader/contract';
export const profiles=registry.profiles.filter(p=>p.id.startsWith('24B-'));
export async function starter(taskKey:string,target:UrsTarget='micropython'){
  const prior=globalThis.fetch;globalThis.fetch=async(p:any)=>new Response(readFileSync('public/'+String(p).replace(/^\/app\/[^/]+\//,'')));
  try{const [lesson,variant]=taskKey.split('/');return await createUrsProject(lesson,variant,target);}finally{globalThis.fetch=prior;}
}
export function jobFor(project:Project,profile:any,seed='5'.repeat(64)){
  const projectJson=JSON.stringify(project),rubric=publishedRubric(profile);
  return {format:'labosv2-grading-job',version:2,jobId:7,attemptId:3,revision:2,taskKey:profile.taskKey,
    checkerVersion:profile.checkerVersion,profileId:profile.id,
    target:project.language==='micropython'?'micropython':project.board.id.includes('esp32-s3')?'s3-cpp':project.board.id.includes('nano')?'nano':'uno',
    rubric,rubricDigest:contractDigest(rubric),contractHash:contractDigest(profile.contract),
    seed,projectJson,snapshotHash:digest(projectJson),rubricHash:'2'.repeat(64)};
}
export function solution(p:Project,profile:any,alternate=false){
  const py=p.language==='micropython',s3=p.board.id.includes('esp32-s3'),pin=s3?4:9,adc=s3?'1':'A0';
  const file=py?'main.py':'main.ino';
  if(profile.kind==='blink')p.files[file]=py?
    'from machine import Pin\nfrom time import sleep_ms\nled=Pin(4,Pin.OUT)\nwhile True:\n led.value(1)\n sleep_ms(250)\n led.value(0)\n sleep_ms(750)\n':
    `void setup(){pinMode(${pin},OUTPUT);}void loop(){digitalWrite(${pin},HIGH);delay(250);digitalWrite(${pin},LOW);delay(750);}\n`;
  if(profile.kind==='analog')p.files[file]=py?
    'from machine import Pin,ADC\nfrom time import sleep_ms\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nled=Pin(4,Pin.OUT)\nwhile True:\n led.value(a.read()>=2048)\n sleep_ms(20)\n':
    `void setup(){pinMode(${pin},OUTPUT);${s3?'analogReadResolution(12);analogSetPinAttenuation(1,ADC_11db);':''}}void loop(){digitalWrite(${pin},analogRead(${adc})>=${s3?2048:512});delay(20);}\n`;
  if(alternate){
    if(profile.kind==='button')p.files[file]=py?'from machine import Pin\nimport time\nbutton=Pin(5,Pin.IN,Pin.PULL_UP)\nled=Pin(4,Pin.OUT)\nwhile True:\n if button.value()==0:\n  led.on()\n else:\n  led.off()\n time.sleep_ms(15)\n':
      `void setup(){pinMode(${s3?5:2},INPUT_PULLUP);pinMode(${pin},OUTPUT);}void loop(){if(digitalRead(${s3?5:2})==LOW)digitalWrite(${pin},HIGH);else digitalWrite(${pin},LOW);delay(15);}\n`;
    else if(profile.kind==='analog')p.files[file]=p.files[file].replace('a.read()>=2048','a.read_u16()>=32768').replace('delay(20)','delay(15)').replace('sleep_ms(20)','sleep_ms(15)');
    else if(profile.kind==='blink')p.files[file]=p.files[file].replace('led.value(1)','led.on()').replace('led.value(0)','led.off()').replace('delay(250)','delay(125);delay(125)').replace('sleep_ms(250)','sleep_ms(125)\n sleep_ms(125)');
    else if(profile.kind==='lm35')p.files[file]=py?'from machine import Pin,ADC\nfrom time import sleep_ms\na=ADC(Pin(1),atten=ADC.ATTN_11DB)\nwhile True:\n print("T=%.2f"%(a.read()*310/4095))\n sleep_ms(200)\n':
      `void setup(){Serial.begin(9600);${s3?'analogReadResolution(12);analogSetPinAttenuation(1,ADC_11db);':''}}void loop(){float t=analogRead(${adc})*${s3?'310.0f/4095':'500.0f/1023'};Serial.print("T=");Serial.println(t,2);delay(200);}\n`;
    else p.files[file]=p.files[file].replaceAll('temperatura','izmjereno').replaceAll('vrijednost','tlak').replaceAll('2100','2000');
    if(p.circuit.kind==='editable')for(const part of p.circuit.components){part.x+=30;part.y+=20;}
  }
  return p;
}
export const compilerOptions=()=>({root:process.cwd(),compile:true,cli:process.env.LAB_ARDUINO_CLI,data:process.env.LAB_ARDUINO_DATA,
  s3Toolchain:process.env.LAB_S3_TOOLCHAIN,clang:process.env.LAB_WASM_CXX,opt:process.env.LAB_WASM_OPT});
