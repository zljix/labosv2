import {SUPPORT_CATALOG,componentSupport,statusName,type CatalogItem} from './support';
import {ursLessons,ursTargets,variantAvailable,type UrsTarget} from '../lessons/ursCatalog';

export const supportOpenTasks=[
 'Samostalni SN74LVC2T45 GPIO i automatski I2C Lab carrier imaju zasebne profile. Kaskada, SPI/vremenski adapteri kroz pretvornike i druge fizičke izvedbe ostaju izvan potvrđenog opsega.',
 'SFM-20B: točna fizička izvedba nije potvrđena. Generička aktivna i pasivna Lab zujalica dostupne su zasebno.',
 `Svih ${ursLessons.reduce((n,l)=>n+l.variants.length,0)} deklariranih URS varijanti ima početni program na sva četiri cilja. To ne potvrđuje proizvoljne biblioteke, fizičke module ili dodatne pločice.`,
 'ESP32 DevKitC V4 i CAM izvedba još nemaju zasebne potvrđene profile; matrica obuhvaća samo S3, Uno R3 i klasični Nano.',
 'Učenički pilot, ciljna školska oprema, fizički moduli i ciljni iOS/Safari/Android preglednici traže stvarnu provjeru.',
];
export function exerciseCoverage(item:CatalogItem,target:UrsTarget){return ursLessons.filter(l=>l.variants.some(v=>v.components.includes(item.id)&&variantAvailable(v,target))).map(l=>'URS'+String(l.number).padStart(2,'0'));}
export function supportEvidence(item:CatalogItem,target:UrsTarget):string {
 const t=ursTargets[target],status=componentSupport(item,t.board,t.language).status;
 if(status==='planned'||status==='unsupported')return 'Otvoreni zadatak; nema izvršne potvrde za ovaj par.';
 if(item.id==='i2cLevel')return 'verification/i2c-levels.test.ts + verification/i2c-levels-package.ts · DC LOW u oba smjera, odvojeni HIGH naponi, stvarni I2C programi četiri cilja, kvar i oporavak';
 if(item.id==='level')return 'verification/levels.test.ts + verification/levels-package.ts · dva smjera GPIO-a, oba kanala, napajanje i stvarni programi četiri cilja';
 if(item.id==='nrf')return 'verification/radio.test.ts · četiri cilja u oba smjera; paketni model';
 if(target==='s3-cpp'&&['bmp180','bmp280','am2320','ds18b20','tm1637','ili9341','xpt2046'].includes(item.id))return 'verification/s3-completion.test.ts + verification/s3-protocols-package.ts · pojedinačni primjeri, svježina/CRC, segmenti, RGB565 i kalibracija dodira; raniji integracijski dokazi ostaju zasebni';
 if(target==='s3-cpp'&&['ir','bmp280spi','st7735'].includes(item.id))return 'verification/s3-protocols.test.ts + verification/s3-protocols-package.ts · prevedeni GPIO/LEDC/SPI izvor, NEC impulsi, RGB565, živi okoliš i pogrešni spojevi';
 if(target==='s3-cpp'&&['ky040','relay','activeBuzzer','audio','dc','stepper'].includes(item.id))return 'verification/s3-controls.test.ts + verification/s3-controls-package.ts · prevedeni GPIO/LEDC izvor, kontakti, pogoni i pogrešni spojevi';
 if(target==='s3-cpp'&&['lm35','temt6000','ntc','ky023','flame','sound'].includes(item.id))return 'verification/s3-analog.test.ts + verification/s3-analog-package.ts · prevedeni izvor, živi ulazi i pogrešni spojevi';
 if(target==='s3-cpp')return item.id==='rtc'||item.id==='tm1637'?'verification/rtc.test.ts':item.id==='sd'?'verification/sd.test.ts':item.id==='max30102'?'verification/max30102.test.ts':item.stage==='18B'?'verification/s3-libraries.test.ts':'verification/s3.test.ts + verification/s3-libraries.test.ts';
 const test=item.id==='breadboard'?'circuit':item.id==='gpio'?(target==='micropython'?'simulation':'avr'):['aht10','ssd1306','servo'].includes(item.id)?(target==='micropython'?'peripherals':'avr-peripherals'):['bmp180','bmp280','am2320'].includes(item.id)?'environment':['oled32','lcd1602'].includes(item.id)?'displays':['lm35','temt6000','ntc','ky023','flame','sound'].includes(item.id)?'analog':['dht11','dht22'].includes(item.id)?'dht':item.id==='ds18b20'?'onewire':item.id==='ky040'?'encoders':item.id==='ir'?'ir':item.id==='tm1637'?'tm1637':['power','relay','activeBuzzer','audio','sg90','dc'].includes(item.id)?'actuators':item.id==='stepper'?'steppers':['st7735','bmp280spi'].includes(item.id)?'spi':item.id==='ili9341'?'ili9341':item.id==='xpt2046'?'touch':item.id==='rtc'?'rtc':item.id==='sd'?'sd':'max30102';
 return `verification/${test}.test.ts · razvojni funkcionalni opseg`;
}
export function supportRows(){return SUPPORT_CATALOG.flatMap(item=>(Object.keys(ursTargets) as UrsTarget[]).map(target=>{const t=ursTargets[target],support=componentSupport(item,t.board,t.language);return {component:item.id,title:item.title,target,status:support.status,statusLabel:statusName[support.status],driver:item.driver,scope:support.detail,exercises:exerciseCoverage(item,target),evidence:supportEvidence(item,target)};}));}
export function supportCSV(){const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';return '\ufeff'+[['Komponenta','Cilj','Status','Upravljački program','Opseg i granice','URS vježbe','Provjerljivi izvor'],...supportRows().map(r=>[r.title,ursTargets[r.target].label,r.statusLabel,r.driver,r.scope,r.exercises.join(', '),r.evidence])].map(row=>row.map(quote).join(';')).join('\r\n')+'\r\n';}
