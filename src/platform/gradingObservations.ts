import registry from '../../school/grader/profiles.json';

export interface ObservationView {title:string;status:'passed'|'failed'|'recorded';details:string[]}
type Row=Record<string,any>;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const number=(v:number)=>String(Math.round(v*1000)/1000);
const quantity=(v:unknown,label:string,unit:string)=>finite(v)?`${label}: ${number(v)}${unit?' '+unit:''}`:null;
const environment=(v:Row|undefined):string[]=>v?[
  quantity(v.temperature,'Temperatura','°C'),quantity(v.humidity,'Relativna vlaga','% RH'),quantity(v.pressure,'Tlak','Pa'),quantity(v.angle,'Kut','°'),
].filter((v):v is string=>v!==null):[];
const flag=(v:unknown,label:string)=>typeof v==='boolean'?`${label}: ${v?'potvrđeno':'nije potvrđeno'}`:null;

// A profile ID identifies an immutable published schema. In particular the old
// 23E/24B threshold position is a fraction; 24C/24O ADC positions are percent.
// Unknown IDs are kept neutral rather than inferring units from magnitudes.
export function gradingObservations(report:Row,profileId?:string):ObservationView[] {
  const schema=registry.profiles.find(p=>p.id===(report.profileId??profileId));
  if(!Array.isArray(report.samples))return [];
  return report.samples.map((raw:unknown,i:number)=>{
    const s:Row=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const view:ObservationView={title:`Pokus ${Number.isInteger(s.index)?s.index:i+1}`,status:'recorded',details:[]};
    if(!schema){view.details.push('Za ovaj stariji ili nepoznati format nema prilagođenog prikaza opažanja. Dostupni kriteriji i izvorni izvještaj ostaju sačuvani.');return view;}
    if(typeof s.passed==='boolean')view.status=s.passed?'passed':'failed';
    const add=(...items:(string|null)[])=>view.details.push(...items.filter((v):v is string=>v!==null));
    const v=schema.taskKey.split('/')[1],kind=schema.kind;
    if(Array.isArray(s.edges)){
      add(`Zapisano bridova LED-ice: ${s.edges.length}.`);
      const spans=s.edges.slice(1).map((e:Row,j:number)=>({on:s.edges[j].on,durationMs:e.timeMs-s.edges[j].timeMs}));
      add(...spans.filter((x:Row)=>typeof x.on==='boolean'&&finite(x.durationMs)).map((x:Row)=>`${x.on?'Uključeno':'Isključeno'}: ${number(x.durationMs)} ms`));
      add(flag(s.repeated,'Ponavljanje'),flag(s.timing,'Trajanje prema rubrici'));
    }
    if(typeof s.pressed==='boolean')add(`Tipkalo: ${s.pressed?'pritisnuto':'otpušteno'}`);
    if(finite(s.position)&&['analog','adc-pwm','introductory'].includes(kind))add(quantity(s.position*(kind==='analog'?100:1),'Položaj potenciometra','%'));
    if(finite(s.observedDuty))add(quantity(s.observedDuty*100,'Opaženi radni omjer PWM-a','%'));
    if(finite(s.expected?.duty))add(quantity(s.expected.duty*100,'Očekivani radni omjer PWM-a','%'));
    add(...environment(s),...environment(s.expected).map(t=>'Očekivano · '+t));
    add(quantity(s.currentMa,'Struja LED-ice','mA'),quantity(s.durationMs,'Trajanje pobude','ms'),quantity(s.startMs,'Početak pobude','ms'));
    for(const [key,label] of [['validPath','Električni put'],['timely','Pravodoban odaziv'],['sensorOK','Nova senzorska očitanja'],['screenOK','Prikaz na OLED-u'],['angleOK','Kut serva'],['basic','Osnovni uvjet'],['advanced','Dodatni uvjet'],['repeated','Ponavljanje']] as const)add(flag(s[key],label));
    if(kind==='environment-system'||kind==='protocol-sensor'){
      for(const sensor of (s.sensors??s.devices??[]) as Row[]){
        add(...environment(sensor.expected).map(t=>`${sensor.kind??sensor.component??'Senzor'} · očekivano · ${t}`));
        const reading=sensor.readings?.at(-1);add(...environment(reading).map(t=>'Opaženo · '+t));
        add(flag(sensor.passed,'Senzorski uvjet'),quantity(sensor.completeReads,'Dovršena očitanja',''),quantity(sensor.firstDelayMs,'Prvo očitanje nakon','ms'));
      }
      add(quantity(s.expectedAngle,'Očekivani kut','°'),quantity(s.angleRange?.minimum,'Najmanji opaženi kut','°'),quantity(s.angleRange?.maximum,'Najveći opaženi kut','°'));
    }
    if(kind==='introductory'&&['aht-oled','regulator'].includes(v)){
      add(...environment(s.readings?.at(-1)).map(t=>'Opaženo · '+t),quantity(s.angleSamples?.at(-1)?.angle,'Opaženi kut','°'));
    }
    if(kind==='analog-input'){
      // Named ADC registers have no physical unit unless the published task
      // defines one. T/NTC/LM35, lux and voltage use explicit task mappings.
      const units:Record<string,string>={T:'°C',LM35:'°C',NTC:'°C',LUX:'lx',V:'V'};
      for(const field of ['expected','observed'])for(const [key,value]of Object.entries(s[field]??{}))add(quantity(value,`${field==='expected'?'Očekivano':'Opaženo'} ${key}`,units[key]??''));
    }
    if(kind==='event-input'){
      add(quantity(s.count,'Očekivani broj koraka',''),quantity(s.physicalPosition,'Fizički položaj enkodera',''),quantity(s.command,'NEC naredba',''),quantity(s.address,'NEC adresa',''));
      if(Array.isArray(s.reported))add('Programski položaji: '+s.reported.filter(finite).join(', '));
    }
    if(kind==='touch-system'){
      if(typeof s.input?.down==='boolean')add(`Dodir: ${s.input.down?'pritisnut':'otpušten'}`);
      add(quantity(s.input?.x,'Dodir X','px'),quantity(s.input?.y,'Dodir Y','px'),flag(s.screenStable,'Stabilan prikaz'));
    }
    if(kind==='actuator-output'||kind==='stepper-output')add(quantity(s.motorSupplyV,'Napajanje motora','V'),quantity(s.cycleMs,'Period ciklusa','ms'),quantity(s.accepted,'Prihvaćeni koraci',''),quantity(s.ignored,'Zanemareni koraci',''));
    if(kind==='display-output')add(quantity(s.printedSamples,'Ispisani uzorci',''),quantity(s.readings?.length,'Nova očitanja',''));
    if(kind==='storage-system')for(const [key,label] of [['rtcReads','RTC očitanja'],['sdReads','SD čitanja'],['sdWrites','SD zapisi'],['csvRows','CSV redci'],['validRows','Valjani redci']] as const)add(quantity(s[key],label,''));
    if(kind==='optical-system')add(quantity(s.completeSamples,'Dovršeni uzorci',''),quantity(s.dropped,'Odbačeni uzorci',''));
    if(kind==='radio-pair'){
      if(typeof s.scenario==='string')add('Radio scenarij: '+s.scenario);
      for(const [key,label]of [['retries','Ponavljanja slanja'],['acknowledged','Potvrde ACK'],['failed','Neuspjela slanja'],['completeReads','Potpuna čitanja']] as const)add(quantity(s[key],label,''));
    }
    if(kind==='level-translator')add(quantity(s.observedUntilMs,'Promatrano do','ms'),quantity(s.observed,'Broj opažanja',''),flag(s.translatorConnected,'Prilagodnik razina'));
    if(view.details.length===0)view.details.push('Detalji ovog pokusa dostupni su u izvornom izvještaju. Ishod bodovanja prikazan je uz kriterije.');
    return view;
  });
}
