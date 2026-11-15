import {keyOf,terminalMap,ANALOG_KINDS,DHT_KINDS,I2C_KINDS,deviceAddress,moduleVoltage,signalVoltage,circuitBoard,boardOf,type Circuit,type Endpoint,type Terminal} from "./model";
import {i2cLevelRoute} from '../../public/i2c-level-shifter.mjs';
export interface Net{id:string;terminals:Terminal[];wires:string[]}
export interface Diagnostic{code:string;severity:"error"|"warning"|"info";message:string;terminals:string[];components:string[];wires:string[]}
export function buildNets(c:Circuit){
 const map=terminalMap(c),parent=new Map([...map.keys()].map(k=>[k,k]));
 const root=(k:string):string=>{let r=k;while(parent.get(r)!==r)r=parent.get(r)!;while(k!==r){const n=parent.get(k)!;parent.set(k,r);k=n;}return r;};
 const join=(a:string,b:string)=>{if(parent.has(a)&&parent.has(b))parent.set(root(b),root(a));};
 for(const p of c.components){const link=(a:string,b:string)=>join(`${p.id}:${a}`,`${p.id}:${b}`);
  if(p.kind==="board")for(const group of boardOf(p).links)for(const pin of group.slice(1))link(group[0],pin);
  if(p.kind==="breadboard")for(let n=1;n<=(p.properties.breadboardColumns??30);n++){for(const r of "bcde")link(`a${n}`,`${r}${n}`);for(const r of "ghij")link(`f${n}`,`${r}${n}`);for(const rail of ["tp","tn","bp","bn"])if(n!==1&&n!==(p.properties.breadboardColumns??30)/2+1)link(`${rail}${n-1}`,`${rail}${n}`);}
  if(p.kind==="a4988")link("GND","PGND");
  if(p.kind==="button"){link("A1","A2");link("B1","B2");if(p.properties.pressed)link("A1","B1");}
 }
 for(const w of c.wires)join(keyOf(w.from),keyOf(w.to));const grouped=new Map<string,Terminal[]>();
 for(const[k,t]of map){const r=root(k);if(!grouped.has(r))grouped.set(r,[]);grouped.get(r)!.push(t);}
 const nets:Net[]=[...grouped.values()].map(ts=>({id:ts.map(keyOf).sort()[0],terminals:ts,wires:[]})).sort((a,b)=>a.id.localeCompare(b.id));
 const byTerminal=new Map<string,Net>();for(const n of nets)for(const t of n.terminals)byTerminal.set(keyOf(t),n);for(const w of c.wires)byTerminal.get(keyOf(w.from))?.wires.push(w.id);
 return{nets,byTerminal,map,connected:(a:Endpoint,b:Endpoint)=>byTerminal.get(keyOf(a))===byTerminal.get(keyOf(b))&&map.has(keyOf(a))&&map.has(keyOf(b))};
}
export interface Driver{endpoint:Endpoint;level:0|1}
export function checkCircuit(c:Circuit,drivers:Driver[]=[]){
 const graph=buildNets(c),diagnostics:Diagnostic[]=[],profile=circuitBoard(c);
 const voltage=(t:Terminal)=>t.role==='ground'?0:t.role==='3v3'?3.3:t.role==='5v'?5:c.components.find(p=>p.id===t.component)?.kind==='powerSupply'&&t.pin==='+'?c.components.find(p=>p.id===t.component)!.properties.supplyVoltage??null:null;
 const hasVoltage=(n:Net,v:number)=>n.terminals.some(t=>voltage(t)===v);
 const push=(code:string,severity:Diagnostic["severity"],message:string,ts:Terminal[]=[],components:string[]=[],wires:string[]=[])=>diagnostics.push({code,severity,message,terminals:ts.map(keyOf),components:[...new Set([...components,...ts.map(t=>t.component)])],wires});
 for(const net of graph.nets){
  const rails=[...new Set(net.terminals.filter(t=>["ground","3v3","5v"].includes(t.role)).map(t=>t.role))],gpios=net.terminals.filter(t=>t.role==="gpio");
  const potentials=[...new Set(net.terminals.map(voltage).filter(v=>v!==null))];
  if(potentials.length>1&&rails.length<=1)push("external-power-short","error","Različiti izvori DC napajanja povezani su na istu mrežu.",net.terminals,[],net.wires);
  if(potentials.some(v=>v!>profile.logicVoltage+.3)&&net.terminals.some(t=>t.gpio!==undefined))push("external-gpio-overvoltage","error","Pogonsko napajanje prekoračuje dopušten napon GPIO-a.",net.terminals,[],net.wires);
  if(rails.length>1)push("power-short","error","Kratki spoj: ista mreža povezuje različite potencijale napajanja ("+rails.map(r=>r==="ground"?"GND":r==="3v3"?"3,3 V":"5 V").join(" / ")+").",net.terminals,[],net.wires);
  if(profile.logicVoltage<5&&rails.includes("5v")&&gpios.length)push("gpio-overvoltage","error","GPIO je izravno spojen na 5 V. Profil koristi logiku od 3,3 V.",gpios,[],net.wires);
  for(const t of net.terminals.filter(t=>t.role==="reserved"))if(net.wires.length)push("reserved-pin","error",`${t.label}: ${profile.pins.find(p=>p.id===t.pin)?.note??"Rezerviran priključak; odaberi slobodan pin."}`,[t],[],net.wires);
  if(new Set(gpios.map(t=>t.gpio)).size>1)push("gpio-shared","warning","Više GPIO priključaka dijeli istu mrežu. Sukob ovisi o programu i provjerava se tijekom izvođenja.",gpios,[],net.wires);
  const analogOnly=net.terminals.filter(t=>t.role==="analog");
  if(analogOnly.length&&drivers.some(d=>analogOnly.some(t=>keyOf(t)===keyOf(d.endpoint))))push("analog-only","error","Nano A6/A7 ne mogu biti digitalni izlazi; dopušten je samo analogni ulaz.",analogOnly,[],net.wires);
  const levels=drivers.filter(d=>graph.byTerminal.get(keyOf(d.endpoint))===net).map(d=>d.level);if(rails.includes("ground"))levels.push(0);if(rails.includes("3v3")||rails.includes("5v"))levels.push(1);
  if(levels.includes(0)&&levels.includes(1)&&rails.length<=1)push("output-conflict","error","Sukob aktivnih izlaza: ista mreža istodobno je pobuđena niskom i visokom razinom.",net.terminals,[],net.wires);
 }
 const hasExternal=(id:string,pin:string)=>!!graph.byTerminal.get(`${id}:${pin}`)?.wires.length;
 // Resistive reachability is a warning only; resistors never merge electrical nets.
 const edges=new Map<string,string[]>(),netById=new Map(graph.nets.map(n=>[n.id,n]));
 for(const p of c.components.filter(p=>p.kind==="resistor")){const a=graph.byTerminal.get(`${p.id}:1`)!.id,b=graph.byTerminal.get(`${p.id}:2`)!.id;edges.set(a,[...(edges.get(a)??[]),b]);edges.set(b,[...(edges.get(b)??[]),a]);}
 for(const p of c.components.filter(p=>p.kind==='relay'))for(const pin of ['NO','NC']){const a=graph.byTerminal.get(`${p.id}:COM`)!.id,b=graph.byTerminal.get(`${p.id}:${pin}`)!.id;edges.set(a,[...(edges.get(a)??[]),b]);edges.set(b,[...(edges.get(b)??[]),a]);}
 const translatorPort=(t:Terminal)=>c.components.find(p=>p.id===t.component)?.kind==='levelShifter'&&/^[AB][12]$/.test(t.pin);
 function reachesReference(start:Net){const queue=[start.id],seen=new Set<string>();while(queue.length){const id=queue.pop()!;if(seen.has(id))continue;seen.add(id);if(netById.get(id)!.terminals.some(t=>voltage(t)!==null||["gpio","analog"].includes(t.role)||translatorPort(t)))return true;queue.push(...(edges.get(id)??[]));}return false;}
 for(const p of c.components){
  if(p.kind==="board"||p.kind==="breadboard")continue;const ts=[...graph.map.values()].filter(t=>t.component===p.id),missing=ts.filter(t=>!(p.kind==="levelShifter"?["A1","A2","B1","B2"]:p.kind==="a4988"?["MS1","MS2","MS3","PGND"]:p.kind==="relay"?["NO","NC"]:p.kind==="l298n"?["OUT1","OUT2","OUT3","OUT4",...(p.properties.jumperA?["ENA"]:[]),...(p.properties.jumperB?["ENB"]:[])]:["NC"]).includes(t.pin)&&!hasExternal(p.id,t.pin));
  const needed=p.kind==="button"?[...(hasExternal(p.id,"A1")?[]:["A"]),...(hasExternal(p.id,"B1")?[]:["B"])]:missing.map(t=>t.label);
  if(needed.length)push("unconnected","warning",`${p.label}: nepriključeni izvodi ${needed.join(", ")}.`,missing,[p.id]);
  if(p.kind==='i2cLevelShifter'){
   const net=(pin:string)=>graph.byTerminal.get(`${p.id}:${pin}`)!;
   for(const [pin,v]of [['LV',3.3],['HV',5]]as const){const n=net(pin);if(n.terminals.some(t=>voltage(t)!==null&&Math.abs(voltage(t)!-v)>.2))push('i2c-shifter-supply','error',`${p.label}: ${pin} traži ${v} V.`,n.terminals,[p.id]);else if(!hasVoltage(n,v))push('i2c-shifter-supply','warning',`${p.label}: spoji ${pin} na ${v} V; bez obaju napajanja nema prijenosa u modelu.`,n.terminals,[p.id]);}
   if(!net('GND').terminals.some(t=>t.role==='ground'&&c.components.find(q=>q.id===t.component)?.kind==='board'))push('i2c-shifter-ground','warning',`${p.label}: potrebna je zajednička masa s pločicom.`,ts,[p.id]);
   const signals=['SDA_L','SCL_L','SDA_H','SCL_H'];
   if(new Set(signals.map(net)).size!==4)push('i2c-shifter-bypass','error',`${p.label}: četiri signalne mreže trebaju ostati odvojene; ne premošćuj domene ni SDA/SCL.`,ts,[p.id]);
   for(const pin of signals){const n=net(pin),v=pin.endsWith('_L')?3.3:5;
    if(n.terminals.some(t=>t.role==='analog'))push('i2c-shifter-digital','error','I2C pretvornik treba digitalne priključke; Nano A6/A7 su samo analogni ulazi.',n.terminals,[p.id]);
    if(n.terminals.some(t=>voltage(t)!==null))push('i2c-shifter-signal-rail','error',`${p.label}: ${pin} ne spajaj izravno na napajanje ili masu; koristi pull-up otpornik.`,n.terminals,[p.id]);
    if(n.terminals.some(t=>t.gpio!==undefined&&profile.logicVoltage!==v))push('i2c-shifter-domain','error',`${p.label}: ${pin} pripada ${v} V; GPIO pločice koristi ${profile.logicVoltage} V.`,n.terminals,[p.id]);
    for(const t of n.terminals){const q=c.components.find(q=>q.id===t.component)!;if(q.id===p.id)continue;
     if(q.kind==='i2cLevelShifter'||q.kind==='levelShifter')push('i2c-shifter-chain','error','Kaskada pretvornika nije podržana u ovom Lab profilu.',n.terminals,[p.id,q.id]);
     else if(I2C_KINDS.includes(q.kind)&&(t.pin==='SDA'||t.pin==='SCL')){if(signalVoltage(q)!==v)push('i2c-shifter-device-domain','error',`${q.label}: profil signala ne odgovara ${v} V strani pretvornika.`,n.terminals,[p.id,q.id]);if(t.pin!==pin.slice(0,3))push('i2c-shifter-crossed','error',`${q.label}: SDA i SCL su zamijenjeni na pretvorniku.`,n.terminals,[p.id,q.id]);}
     else if(!['board','breadboard','resistor','button'].includes(q.kind))push('i2c-shifter-protocol','error','I2C Lab pretvornik podržava otvoreni odvod i I2C. SPI, 1-Wire, DHT i ostali adapteri kroz njega nisu podržani.',n.terminals,[p.id,q.id]);
    }
   }
  }
  if(p.kind==='levelShifter'){
   const net=(pin:string)=>graph.byTerminal.get(`${p.id}:${pin}`)!;
   for(const [pin,v]of [['VCCA',3.3],['VCCB',5]]as const){const n=net(pin),sources=n.terminals.map(voltage).filter(x=>x!==null);if(sources.some(x=>x!==0&&Math.abs(x!-v)>.2))push('level-shifter-supply','error',`${p.label}: ovaj profil zahtijeva ${pin}=${v} V.`,n.terminals,[p.id]);else if(!hasVoltage(n,v))push('level-shifter-supply','warning',`${p.label}: ${pin} nije napajan s ${v} V; bez napajanja izlazi modela su otpušteni.`,n.terminals,[p.id]);}
   if(!net('GND').terminals.some(t=>t.role==='ground'&&c.components.find(q=>q.id===t.component)?.kind==='board'))push('level-shifter-ground','warning',`${p.label}: GND mora imati zajedničku masu s pločicom.`,ts,[p.id]);
   if(['A1','A2'].some(a=>['B1','B2'].some(b=>net(a)===net(b))))push('level-shifter-bypass','error',`${p.label}: A i B strane trebaju ostati odvojene električne mreže.`,ts,[p.id]);
   for(const pin of ['A1','A2','B1','B2','DIR'])for(const t of net(pin).terminals){const q=c.components.find(q=>q.id===t.component)!;if(q.id===p.id)continue;if(q.kind==='levelShifter')push('level-shifter-chain','error','Ovaj GPIO profil ne podržava kaskadu pretvornika.',net(pin).terminals,[p.id,q.id]);else if(!['board','breadboard','resistor','led','button','potentiometer','powerSupply'].includes(q.kind))push('level-shifter-protocol','error','SN74LVC2T45 Lab podržava GPIO pokuse. I2C, SPI i vremenski periferijski adapteri kroz ovaj profil još nisu podržani.',net(pin).terminals,[p.id,q.id]);}
  }
  if((p.kind==="resistor"||p.kind==="led")&&graph.connected(ts[0],ts[1]))push("bypassed","warning",`${p.label}: oba izvoda su na istoj mreži; komponenta je premoštena.`,ts,[p.id]);
  if(p.kind==="led"&&!missing.length){const a=graph.byTerminal.get(`${p.id}:A`)!,k=graph.byTerminal.get(`${p.id}:K`)!;
   if(a.terminals.some(t=>t.role==="ground")&&k.terminals.some(t=>["3v3","5v","gpio"].includes(t.role)))push("led-polarity","warning",`${p.label}: provjeri polaritet. Anoda je na GND, a katoda prema napajanju/GPIO-u.`,ts,[p.id]);
   if(!reachesReference(a)||!reachesReference(k))push("led-open-path","warning",`${p.label}: jedan izvod trenutačno nema putanju do GPIO-a ili napajanja kroz vodiče i otpornike. Provjeri otvoreno tipkalo ili prekinutu lištu breadboarda.`,ts,[p.id]);
   const powered=(n:Net)=>n.terminals.some(t=>(voltage(t)??0)>0||t.role==="gpio"||translatorPort(t)),ground=(n:Net)=>n.terminals.some(t=>t.role==="ground");if((powered(a)&&ground(k))||(powered(k)&&ground(a)))push("led-no-resistor","error",`${p.label}: izravna veza između aktivnog izvora i GND kroz LED, bez serijskog otpornika.`,ts,[p.id]);
  }
  if(p.kind==="potentiometer"){const ends=[graph.byTerminal.get(`${p.id}:1`)!,graph.byTerminal.get(`${p.id}:3`)!];if(!ends.some(n=>n.terminals.some(t=>t.role===(profile.logicVoltage===5?"5v":"3v3")))||!ends.some(n=>n.terminals.some(t=>t.role==="ground")))push("pot-supply","warning",`${p.label}: za ADC primjer krajeve 1 i 3 spoji na ${profile.logicVoltage.toLocaleString("hr-HR")} V i GND.`,ts,[p.id]);}
  if(p.kind==="relay"||p.kind==="activeBuzzer"||p.kind==="passiveBuzzer"||p.kind==="l298n"||p.kind==="sg90"){
   const net=(pin:string)=>graph.byTerminal.get(`${p.id}:${pin}`)!;
   const power=net(p.kind==="sg90"?"V+":p.kind==="l298n"?"VSS":"VCC");
   if(!hasVoltage(power,5))push("actuator-supply","warning",`${p.label}: potreban je 5 V izvor upravljačke strane.`,power.terminals,[p.id]);
   if(!hasVoltage(net("GND"),0))push("actuator-ground","warning",`${p.label}: spoji zajedničku masu s pločicom.`,ts,[p.id]);
   const signals=p.kind==="relay"?["IN"]:p.kind==="l298n"?["IN1","IN2","IN3","IN4",...(p.properties.jumperA?[]:["ENA"]),...(p.properties.jumperB?[]:["ENB"])]:["SIG"];
   for(const pin of signals)if(!net(pin).terminals.some(t=>t.capabilities?.includes("output")))push("actuator-digital-pin","warning",`${p.label}: ${pin} treba digitalni izlaz. Nano A6/A7 nisu digitalni pinovi.`,net(pin).terminals,[p.id]);
   if(p.kind==="relay"){
    const lv=p.properties.logicVoltage!;if(!hasVoltage(net("LV"),lv))push("relay-lv","warning",`${p.label}: LV treba ${lv} V.`,ts,[p.id]);
    if(lv>profile.logicVoltage&&net("IN").terminals.some(t=>t.gpio!==undefined))push("relay-voltage-domain","error","Odaberi 3,3 V LV profil za ESP32 IN.",ts,[p.id]);
    if(net("LV").terminals.some(t=>(voltage(t)??0)>lv+.2))push("relay-lv-overvoltage","error","LV releja spojen je na previsoko napajanje.",ts,[p.id]);
   }
   if(p.kind==="l298n"){
    if(!net("VS").terminals.some(t=>{const v=voltage(t);return v!==null&&v>=5&&v<=12;}))push("bridge-supply","warning","L298N: VS traži zasebni 5–12 V izvor; VSS je ulaz 5 V, 5V-EN regulator je uklonjen u ovom profilu.",ts,[p.id]);
    for(const [pin,on]of [["ENA",p.properties.jumperA],["ENB",p.properties.jumperB]]as const)if(on&&net(pin).terminals.some(t=>t.gpio!==undefined))push("bridge-enable-jumper","error",`${pin}: ukloni jumper prije spajanja GPIO/PWM izlaza. Jumper izravno spaja EN na VSS.`,net(pin).terminals,[p.id]);
    for(const pin of ["OUT1","OUT2","OUT3","OUT4"]){const n=net(pin);if(n.terminals.some(t=>t.gpio!==undefined||voltage(t)!==null||t.component!==p.id&&t.pin.startsWith("OUT")&&c.components.find(p=>p.id===t.component)?.kind==="l298n"))push("bridge-output-source","error","L298N izlaz ne spajaj na GPIO ili izvor napajanja.",n.terminals,[p.id]);}
    if(["OUT1","OUT2","OUT3","OUT4"].some(pin=>net(pin).terminals.filter(t=>t.pin.startsWith("OUT")&&c.components.find(p=>p.id===t.component)?.kind==="l298n").length>1))push("bridge-output-short","error","Kratki spoj ili nedopuštena paralelna veza izlaza H-mostova.",ts,[p.id]);
   }
  }
  if(p.kind==="a4988"){
   const net=(pin:string)=>graph.byTerminal.get(`${p.id}:${pin}`)!;
   if(!net("VDD").terminals.some(t=>{const v=voltage(t);return v!==null&&v>=3&&v<=5.5;}))push("stepper-vdd","warning","A4988: VDD treba 3–5,5 V.",ts,[p.id]);
   if(!net("VMOT").terminals.some(t=>{const v=voltage(t);return v!==null&&v>=8&&v<=35;}))push("stepper-vmot","warning","A4988: VMOT treba zaseban izvor 8–35 V; Lab izvor podržava do 12 V.",ts,[p.id]);
   if(!net("GND").terminals.some(t=>t.component===c.components.find(p=>p.kind==="board")!.id&&t.role==="ground"))push("stepper-ground","warning","A4988: masa izvora i pločice mora biti zajednička.",ts,[p.id]);
   for(const pin of ["STEP","DIR","ENABLE","RESET","SLEEP","MS1","MS2","MS3"]){const n=net(pin);if(n.terminals.some(t=>t.role==="analog"))push("stepper-digital-pin","error","A4988 ulazi zahtijevaju digitalne pinove; Nano A6/A7 nisu dopušteni.",n.terminals,[p.id]);}
   const lv=net("VDD").terminals.map(voltage).find(v=>v!==null&&v>0);
   if(lv&&profile.logicVoltage<.7*lv&&["STEP","DIR","ENABLE","RESET","SLEEP","MS1","MS2","MS3"].some(pin=>net(pin).terminals.some(t=>t.gpio!==undefined)))push("stepper-logic-level","error","A4988: HIGH mora biti barem 0,7 × VDD. Za ESP32 koristi VDD=3,3 V.",ts,[p.id]);
   for(const pin of ["1A","1B","2A","2B"]){const n=net(pin);if(n.terminals.some(t=>t.gpio!==undefined||voltage(t)!==null||t.component!==p.id&&c.components.find(q=>q.id===t.component)?.kind==="a4988"))push("stepper-output-source","error","A4988 izlaze spoji samo na odvojene zavojnice; ne na GPIO, napajanje ili drugi upravljački sklop.",n.terminals,[p.id]);}
   if(new Set(["1A","1B","2A","2B"].map(net)).size!==4)push("stepper-output-short","error","A4988: četiri izlaza moraju ostati odvojene mreže.",ts,[p.id]);
  }
  if(p.kind==="stepperMotor"){
   const ns=["A+","A-","B+","B-"].map(pin=>graph.byTerminal.get(`${p.id}:${pin}`)!);
   if(ns.some(n=>n.terminals.some(t=>t.gpio!==undefined||voltage(t)!==null)))push("stepper-motor-source","error","Koračni motor treba A4988; zavojnice ne spajaj izravno na GPIO ili napajanje.",ts,[p.id]);
   const ds=c.components.filter(q=>q.kind==="a4988"&&[0,1].every(i=>{const pair=ns.slice(i*2,i*2+2);return ["1","2"].some(n=>pair.includes(graph.byTerminal.get(`${q.id}:${n}A`)!)&&pair.includes(graph.byTerminal.get(`${q.id}:${n}B`)!));}));
   if(!missing.length&&(new Set(ns).size!==4||ds.length!==1))push("stepper-coil-pairs","error","Koračni motor: svaka zavojnica mora spojiti jedan par 1A/1B ili 2A/2B istog A4988; ne križaj parove.",ts,[p.id]);
  }
  if(p.kind==="motor130")for(const pin of ["M+","M-"]){const n=graph.byTerminal.get(`${p.id}:${pin}`)!;if(n.terminals.some(t=>t.gpio!==undefined))push("motor-gpio","error","DC motor treba pogonski sklop i zasebno napajanje; izravni GPIO spoj nije dopušten.",n.terminals,[p.id]);}
  if(p.kind==='nrf24'||p.kind==='microSD'||(p.kind==='st7735'||p.kind==='ili9341')||p.kind==='bmp280_spi'||p.kind==='xpt2046'){
   const net=(pin:string)=>graph.byTerminal.get(`${p.id}:${pin}`)!;
   const signals=(p.kind==='st7735'||p.kind==='ili9341')?['SCK','MOSI','CS','DC','RESET']:['SCK','MOSI','CS','MISO',...(p.kind==='xpt2046'?['IRQ']:p.kind==='nrf24'?['CE']:[])];
   if(!net('VCC').terminals.some(t=>t.role===(p.properties.moduleVoltage===5?'5v':'3v3')))push('spi-supply','warning',`${p.label}: VCC treba ${p.properties.moduleVoltage} V prema odabranom carrier profilu.`,ts,[p.id]);
   if(p.properties.moduleVoltage===3.3&&net('VCC').terminals.some(t=>t.role==='5v'))push('spi-overvoltage','error',`${p.label}: 3,3 V VCC ne spajaj na 5 V.`,ts,[p.id]);
   if(!net('GND').terminals.some(t=>t.role==='ground'))push('spi-ground','warning',`${p.label}: spoji zajedničku masu.`,ts,[p.id]);
   for(const pin of signals){const n=net(pin);if(p.properties.logicVoltage===3.3&&n.terminals.some(t=>t.role==='5v'))push('spi-signal-overvoltage','error',`${p.label}: ${pin} 3,3 V profila ne spajaj na 5 V.`,n.terminals,[p.id]);if(n.terminals.some(t=>t.role==='analog'))push('spi-digital','error',`${p.label}: ${pin} treba digitalni GPIO; Nano A6/A7 nisu valjani.`,n.terminals,[p.id]);if(n.terminals.some(t=>t.gpio!==undefined)&&profile.logicVoltage!==p.properties.logicVoltage)push('spi-logic','error',`${p.label}: odaberi SPI carrier profil ${profile.logicVoltage} V s odgovarajućom prilagodbom razina.`,n.terminals,[p.id]);}
   if(new Set(signals.map(k=>net(k))).size!==signals.length)push('spi-signal-short','error',`${p.label}: SPI upravljački signali trebaju odvojene mreže.`,ts,[p.id]);
   if((p.kind==='st7735'||p.kind==='ili9341')){if(net('BL').terminals.some(t=>t.role==='5v'||t.gpio!==undefined&&profile.logicVoltage===5))push('tft-bl-overvoltage','error',`${p.label}: BL je isključivo 3,3 V, uključujući 5 V carrier.`,net('BL').terminals,[p.id]);if(!net('BL').terminals.some(t=>t.role==='3v3'||t.gpio!==undefined))push('tft-bl','warning','Spoji BL na 3V3 za vidljivo pozadinsko osvjetljenje.',ts,[p.id]);}
  }
  if(p.kind==="tm1637"){
   const power=graph.byTerminal.get(`${p.id}:VCC`)!,gnd=graph.byTerminal.get(`${p.id}:GND`)!,lv=graph.byTerminal.get(`${p.id}:LV`)!,clk=graph.byTerminal.get(`${p.id}:CLK`)!,dio=graph.byTerminal.get(`${p.id}:DIO`)!;
   if(!power.terminals.some(t=>t.role==="5v"))push("tm1637-supply","warning",`${p.label}: VCC spoji na 5 V; za ESP32 LV spoji na 3V3.`,ts,[p.id]);
   if(!gnd.terminals.some(t=>t.role==="ground"))push("tm1637-ground","warning",`${p.label}: spoji zajedničku masu.`,ts,[p.id]);
   if(!lv.terminals.some(t=>t.role===(signalVoltage(p)===5?"5v":"3v3")))push("tm1637-lv","warning",`${p.label}: LV treba ${signalVoltage(p)} V; napaja pull-up stranu pločice.`,lv.terminals,[p.id]);
   if(signalVoltage(p)===3.3&&lv.terminals.some(t=>t.role==="5v"))push("tm1637-lv-overvoltage","error",`${p.label}: LV profila 3,3 V spojen je na 5 V.`,lv.terminals,[p.id]);
   for(const [i,net]of [clk,dio].entries()){
    if(!net.terminals.some(t=>t.capabilities?.includes("output")&&t.capabilities?.includes("input")))push("tm1637-digital-pin","warning",`${p.label}: ${i?"DIO":"CLK"} treba digitalni GPIO; Nano A6/A7 nisu valjani.`,net.terminals,[p.id],net.wires);
    if(signalVoltage(p)>profile.logicVoltage&&net.terminals.some(t=>t.gpio!==undefined))push("tm1637-voltage-domain","error",`${p.label}: CLK/DIO pull-up na 5 V nije dopušten na ESP32; odaberi LV=3,3 V profil s prilagodnikom.`,net.terminals,[p.id],net.wires);
    if(net.terminals.some(t=>t.component!==p.id&&t.pin==="SDA"&&I2C_KINDS.includes(c.components.find(p=>p.id===t.component)!.kind)))push("tm1637-i2c-shared","warning","TM1637 nije I2C uređaj; odaberi zasebne CLK/DIO mreže.",net.terminals,[p.id]);
   }
   if(clk===dio)push("tm1637-shared-signals","error",`${p.label}: CLK i DIO trebaju zasebne mreže.`,ts,[p.id]);
   if(c.components.some(q=>q.id!==p.id&&q.kind==="tm1637"&&graph.byTerminal.get(`${q.id}:CLK`)===clk&&graph.byTerminal.get(`${q.id}:DIO`)===dio))push("tm1637-shared-bus","warning","TM1637 nema adresu: moduli na istim CLK/DIO primaju iste podatke.",ts,[p.id]);
  }
  if(p.kind==="irReceiver"||p.kind==="irTransmitter"){
   const power=graph.byTerminal.get(`${p.id}:VCC`)!,gnd=graph.byTerminal.get(`${p.id}:GND`)!,signal=graph.byTerminal.get(`${p.id}:${p.kind==="irReceiver"?"OUT":"SIG"}`)!;
   if(moduleVoltage(p)===3.3&&power.terminals.some(t=>t.role==="5v"))push("ir-overvoltage","error",`${p.label}: VCC profila 3,3 V spojen je na 5 V.`,ts,[p.id]);
   if(!power.terminals.some(t=>t.role===(moduleVoltage(p)===5?"5v":"3v3")))push("ir-supply","warning",`${p.label}: VCC treba ${moduleVoltage(p)} V.`,ts,[p.id]);
   if(!gnd.terminals.some(t=>t.role==="ground"))push("ir-ground","warning",`${p.label}: spoji zajedničku masu.`,ts,[p.id]);
   if(!signal.terminals.some(t=>t.capabilities?.includes(p.kind==="irReceiver"?"input":"output")))push("ir-digital-pin","warning",`${p.label}: odaberi digitalni ${p.kind==="irReceiver"?"ulaz":"izlaz"}; Nano A6/A7 nisu digitalni pinovi.`,signal.terminals,[p.id],signal.wires);
   if(p.kind==="irReceiver"&&moduleVoltage(p)>profile.logicVoltage&&signal.terminals.some(t=>t.gpio!==undefined))push("ir-voltage-domain","error",`${p.label}: OUT ima pull-up na 5 V; to nije dopušteno na ESP32. Koristi 3,3 V profil.`,signal.terminals,[p.id],signal.wires);
   if(p.kind==="irReceiver"&&signal.terminals.some(t=>t.pin==="OUT"&&t.component!==p.id&&c.components.find(p=>p.id===t.component)?.kind==="irReceiver"))push("ir-shared-output","warning","Više IR prijamnika dijeli OUT; gubi se neovisno očitavanje.",signal.terminals,[p.id],signal.wires);
  }
  if(p.kind==="ky040"){
   const power=graph.byTerminal.get(`${p.id}:VCC`)!,gnd=graph.byTerminal.get(`${p.id}:GND`)!,signals=["CLK","DT","SW"].map(pin=>graph.byTerminal.get(`${p.id}:${pin}`)!);
   if(power.terminals.some(t=>t.role==="5v")&&moduleVoltage(p)===3.3)push("encoder-overvoltage","error",`${p.label}: VCC profila 3,3 V spojen je na 5 V.`,ts,[p.id]);
   if(!power.terminals.some(t=>t.role===(moduleVoltage(p)===5?"5v":"3v3")))push("encoder-supply","warning",`${p.label}: VCC (+) spoji na ${moduleVoltage(p)} V; to napaja pull-up otpornike CLK/DT.`,ts,[p.id]);
   if(!gnd.terminals.some(t=>t.role==="ground"))push("encoder-ground","warning",`${p.label}: spoji zajedničku masu.`,ts,[p.id]);
   for(const [i,net]of signals.entries()){
    if(!net.terminals.some(t=>t.capabilities?.includes("input")))push("encoder-digital-pin","warning",`${p.label}: ${["CLK","DT","SW"][i]} treba digitalni ulaz. Nano A6/A7 nisu digitalni ulazi.`,net.terminals,[p.id],net.wires);
    if(i<2&&moduleVoltage(p)>profile.logicVoltage&&net.terminals.some(t=>t.gpio!==undefined))push("encoder-voltage-domain","error",`${p.label}: pull-up CLK/DT na 5 V nije dopušten na ESP32. Odaberi 3,3 V profil i napajanje.`,net.terminals,[p.id],net.wires);
   }
   if(new Set(signals).size<3)push("encoder-signals-shared","error",`${p.label}: CLK, DT i SW trebaju tri zasebne mreže; spajanje signala gubi kvadraturni slijed.`,ts,[p.id]);
  }
  if(p.kind==="ds1302"){
   const net=(pin:string)=>graph.byTerminal.get(`${p.id}:${pin}`)!;
   if(!hasVoltage(net("VCC"),moduleVoltage(p)))push("rtc-supply","warning",`${p.label}: VCC treba ${moduleVoltage(p)} V odabranog profila.`,ts,[p.id]);
   if(!hasVoltage(net("GND"),0))push("rtc-ground","warning",`${p.label}: spoji zajedničku masu.`,ts,[p.id]);
   const signals=["CE","IO","SCLK"].map(net);
   if(new Set(signals).size!==3)push("rtc-shared-signals","error","DS1302: CE, I/O i SCLK trebaju zasebne digitalne mreže.",ts,[p.id]);
   for(const n of signals){if(n.terminals.some(t=>t.role==="analog"))push("rtc-digital-pin","error","DS1302: Nano A6/A7 nisu digitalni pinovi.",n.terminals,[p.id]);}
   if(moduleVoltage(p)!==profile.logicVoltage&&signals.some(n=>n.terminals.some(t=>t.gpio!==undefined)))push("rtc-voltage-domain","error","DS1302: odaberi napajanje profila koje odgovara logici pločice; 5 V I/O nije dopušten na ESP32.",ts,[p.id]);
   if(moduleVoltage(p)===3.3&&hasVoltage(net("VCC"),5))push("rtc-overvoltage","error","DS1302: VCC odabranog profila 3,3 V spojen je na 5 V.",ts,[p.id]);
  }
  if(p.kind==="ds18b20"){
   const power=graph.byTerminal.get(`${p.id}:VDD`)!,gnd=graph.byTerminal.get(`${p.id}:GND`)!,data=graph.byTerminal.get(`${p.id}:DQ`)!;
   if(!power.terminals.some(t=>t.role===(moduleVoltage(p)===5?"5v":"3v3")))push("onewire-supply","warning",`${p.label}: VDD spoji na ${moduleVoltage(p)} V; parazitsko napajanje nije podržano.`,ts,[p.id]);
   if(!gnd.terminals.some(t=>t.role==="ground"))push("onewire-ground","warning",`${p.label}: nedostaje zajednička masa.`,ts,[p.id]);
   const digital=data.terminals.filter(t=>t.capabilities?.includes("input")&&t.capabilities?.includes("output"));
   if(!digital.length)push("onewire-pin","warning",`${p.label}: DQ zahtijeva dvosmjerni digitalni GPIO; Nano A6/A7 nisu valjani.`,data.terminals,[p.id],data.wires);
   const pulls=c.components.filter(r=>r.kind==="resistor"&&r.properties.resistance!>=1000&&r.properties.resistance!<=10000&&["1","2"].some((pin,i)=>graph.byTerminal.get(`${r.id}:${pin}`)===data&&graph.byTerminal.get(`${r.id}:${i?"1":"2"}`)===power));
   if(!pulls.length)push("onewire-pullup","warning",`${p.label}: dodaj jedan vanjski 4,7 kΩ (profil 1–10 kΩ) DQ–VDD; unutarnji pull-up ne zamjenjuje vanjski.`,data.terminals,[p.id],data.wires);
   const pull5=c.components.some(r=>r.kind==="resistor"&&["1","2"].some((pin,i)=>graph.byTerminal.get(`${r.id}:${pin}`)===data&&graph.byTerminal.get(`${r.id}:${i?"1":"2"}`)!.terminals.some(t=>t.role==="5v")));
   if(profile.logicVoltage<5&&pull5&&digital.length)push("onewire-voltage-domain","error",`${p.label}: DQ pull-up na 5 V nije dopušten na ESP32 GPIO-u. Koristi 3,3 V.`,data.terminals,[p.id],data.wires);
   const shared=c.components.filter(v=>v.kind==="ds18b20"&&graph.byTerminal.get(`${v.id}:DQ`)===data);
   if(shared.some(v=>v.id!==p.id&&v.properties.rom===p.properties.rom))push("onewire-rom-collision","error","DS18B20 na istoj sabirnici mora imati jedinstven ROM. Dvostruki identitet ne može se zasebno adresirati.",data.terminals,shared.map(v=>v.id),data.wires);
   if(data.terminals.some(t=>t.pin==="DATA"&&DHT_KINDS.includes(c.components.find(v=>v.id===t.component)!.kind)))push("onewire-dht-shared","error","DHT i Dallas 1-Wire koriste različite protokole; odaberi zasebne GPIO mreže.",data.terminals,[p.id],data.wires);
  }
  if(DHT_KINDS.includes(p.kind)){
   const power=graph.byTerminal.get(`${p.id}:VCC`)!,gnd=graph.byTerminal.get(`${p.id}:GND`)!,data=graph.byTerminal.get(`${p.id}:DATA`)!;
   if(!power.terminals.some(t=>t.role===(moduleVoltage(p)===5?"5v":"3v3")))push("dht-supply","warning",`${p.label}: VCC spoji na ${moduleVoltage(p)} V odabranog profila.`,ts,[p.id]);
   if(!gnd.terminals.some(t=>t.role==="ground"))push("dht-ground","warning",`${p.label}: nedostaje zajednička masa.`,ts,[p.id]);
   if(data.terminals.some(t=>t.role==="reserved"||t.capabilities&&!t.capabilities.includes("input")||t.capabilities&&!t.capabilities.includes("output")))push("dht-pin","warning",`${p.label}: DATA zahtijeva dvosmjerni digitalni GPIO (Nano A6/A7 nisu valjani).`,data.terminals,[p.id],data.wires);
   if(power.terminals.some(t=>t.role==="5v")&&profile.logicVoltage<5&&data.terminals.some(t=>t.gpio!==undefined))push("dht-voltage-domain","error",`${p.label}: pull-up na 5 V nije dopušten na ESP32 GPIO-u. Napajaj ovaj DHT profil i pull-up s 3,3 V.`,data.terminals,[p.id],data.wires);
   const pull=c.components.some(r=>r.kind==="resistor"&&r.properties.resistance!>=1000&&r.properties.resistance!<=10000&&["1","2"].some((pin,i)=>graph.byTerminal.get(`${r.id}:${pin}`)===data&&graph.byTerminal.get(`${r.id}:${i?"1":"2"}`)===power));
   if(!pull)push("dht-pullup","warning",`${p.label}: dodaj vanjski pull-up 1–10 kΩ (primjer 4,7 kΩ) između DATA i VCC. Slabi unutarnji pull-up nije dovoljan za ovaj profil.`,data.terminals,[p.id],data.wires);
   const nc=graph.byTerminal.get(`${p.id}:NC`)!;if(nc.wires.length)push("dht-nc","warning",`${p.label}: NC nije spojen unutar senzora; ostavi ga slobodnim.`,nc.terminals,[p.id],nc.wires);
   if(data.terminals.filter(t=>DHT_KINDS.includes(c.components.find(v=>v.id===t.component)!.kind)&&t.pin==="DATA").length>1)push("dht-collision","warning","DHT nema ROM adresiranje: svakom senzoru daj zaseban DATA GPIO.",data.terminals,[p.id],data.wires);
  }
  if(ANALOG_KINDS.includes(p.kind)){
   const power=graph.byTerminal.get(`${p.id}:VCC`)!,gnd=graph.byTerminal.get(`${p.id}:GND`)!;
   const expected=p.kind==="lm35"?5:moduleVoltage(p),powerRole=expected===5?"5v":"3v3";
   if(expected<5&&power.terminals.some(t=>t.role==="5v"))push("input-overvoltage","error",`${p.label}: VCC profila 3,3 V spojen je na 5 V. Promijeni napajanje ili izričito odaberi drugi profil.`,ts,[p.id]);
   if(!power.terminals.some(t=>t.role===powerRole))push("input-supply","warning",`${p.label}: VCC treba ${expected} V u ovom profilu. LM35 zahtijeva barem 4 V; provjeri odabrani profil.`,ts,[p.id]);
   if(!gnd.terminals.some(t=>t.role==="ground"))push("input-ground","warning",`${p.label}: nedostaje zajednička masa.`,ts,[p.id]);
   const outputs=ts.filter(t=>!["VCC","GND"].includes(t.pin));
   for(const t of outputs){const n=graph.byTerminal.get(keyOf(t))!;const inputPins=n.terminals.filter(v=>v.role==="gpio"||v.role==="analog");
    if(t.pin!=="SW"&&p.kind!=="sound"&&t.pin!=="DO"&&inputPins.some(v=>!v.capabilities?.includes("adc")))push("input-not-adc","warning",`${p.label}: ${t.pin} zahtijeva ADC priključak; digitalni ulaz ne mjeri napon.`,n.terminals,[p.id],n.wires);
    if(expected>profile.logicVoltage&&p.kind!=="lm35"&&t.pin!=="SW"&&inputPins.length)push("input-voltage-domain","error",`${p.label}: izlaz profila od ${expected} V može prekoračiti ${profile.logicVoltage} V pločice. Odaberi 3,3 V profil i napajanje ili prilagodnik.`,n.terminals,[p.id],n.wires);
   }
  }
  if((I2C_KINDS.includes(p.kind)||p.kind==="servo")){
   const supply=graph.byTerminal.get(`${p.id}:${p.kind==="servo"?"V+":"VCC"}`)!,ground=graph.byTerminal.get(`${p.id}:GND`)!;
   if(!ground.terminals.some(t=>t.role==="ground"))push("device-ground","warning",`${p.label}: nedostaje zajednička masa s pločicom.`,ts,[p.id]);
   if(p.kind!=="servo"&&moduleVoltage(p)<5&&supply.terminals.some(t=>t.role==="5v"))push("device-overvoltage","error",`${p.label}: odabrani model modula koristi 3,3 V; VCC je spojen na 5 V.`,ts,[p.id]);
   if(!supply.terminals.some(t=>t.role===(p.kind==="servo"||moduleVoltage(p)===5?"5v":"3v3")))push("device-supply","warning",`${p.label}: provjeri ${p.kind==="servo"?"5 V na V+":moduleVoltage(p)===5?"5 V na VCC":"3,3 V na VCC"}. Bez valjanog napajanja uređaj ne radi.`,ts,[p.id]);
  }
 }
 for(const p of c.components.filter(p=>p.kind==="lcd1602")){
  const lv=graph.byTerminal.get(`${p.id}:LV`)!;
  if(!lv.terminals.some(t=>t.role===(signalVoltage(p)===5?"5v":"3v3")))push("lcd-lv-supply","warning",`${p.label}: LV spoji na ${signalVoltage(p)} V; to je napajanje pull-up otpornika strane pločice.`,lv.terminals,[p.id],lv.wires);
  if(signalVoltage(p)===3.3&&lv.terminals.some(t=>t.role==="5v"))push("lcd-lv-overvoltage","error",`${p.label}: LV profila 3,3 V spojen je na 5 V.`,lv.terminals,[p.id],lv.wires);
 }
 for(const p of c.components.filter(p=>I2C_KINDS.includes(p.kind)))for(const pin of ["SDA","SCL"]){
  const net=graph.byTerminal.get(`${p.id}:${pin}`)!;
  if(profile.logicVoltage!==signalVoltage(p)&&net.terminals.some(t=>t.role==="gpio"))push("logic-domain","warning",`${p.label}: naponski profili modula i pločice razlikuju se. Potreban je provjeren pretvornik logičkih razina ili zaseban profil kompatibilnog modula.`,net.terminals,[p.id],net.wires);
  if(signalVoltage(p)===3.3&&net.terminals.some(t=>t.role==="5v"))push("signal-overvoltage","error",`${p.label}: ${pin} modula od 3,3 V spojen je izravno na 5 V.`,net.terminals,[p.id],net.wires);
 }
 const devices=c.components.filter(p=>I2C_KINDS.includes(p.kind));
 const shifters=c.components.filter(p=>p.kind==='i2cLevelShifter').map(p=>({id:p.id,low:['SDA_L','SCL_L'].map(pin=>graph.byTerminal.get(`${p.id}:${pin}`)!.id),high:['SDA_H','SCL_H'].map(pin=>graph.byTerminal.get(`${p.id}:${pin}`)!.id)}));
 for(let i=0;i<devices.length;i++)for(let j=i+1;j<devices.length;j++){
  const a=devices[i],b=devices[j];
  if(!hasExternal(a.id,"SDA")||!hasExternal(a.id,"SCL")||!hasExternal(b.id,"SDA")||!hasExternal(b.id,"SCL"))continue;
  const pair=(id:string)=>['SDA','SCL'].map(pin=>graph.byTerminal.get(`${id}:${pin}`)!.id);
  const shared=!!i2cLevelRoute(shifters,pair(a.id),pair(b.id));
  if(shared&&(a.kind==="aht10"||b.kind==="aht10"))push("aht10-exclusive-bus","error","AHT10 u ovom profilu zahtijeva zasebnu I2C sabirnicu. Za OLED odaberi zasebnu sabirnicu; na Uno/Nano potreban je software I2C, primjerice OLED na D6/D7.",[],[a.id,b.id]);
  else if(shared&&deviceAddress(a)===deviceAddress(b))push("i2c-address-collision","error","Dva uređaja dijele I2C adresu na istoj sabirnici. Odaberi podržanu drugu adresu ili zasebnu sabirnicu i prilagodi kôd.",[],[a.id,b.id]);
 }
 if(!c.wires.length)push("empty","info","Dodaj komponente i poveži njihove priključke. Klikni prvi pa drugi priključak ili koristi popis veze.");return{...graph,diagnostics};
}
