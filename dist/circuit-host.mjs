import {createDS1302} from './rtc-ds1302.mjs';
import {createSPIHost} from './spi-devices.mjs';
import {evaluateLevelShifters} from './level-shifter.mjs';
import {evaluateI2CLevelShifters} from './i2c-level-shifter.mjs';
// MIT. Functional DC network and ideal duty-averaged LED model, not SPICE.
// The Worker receives one immutable topology compiled from the project.
import {createSteppers} from './stepper.mjs';
import {createActuators} from './actuators.mjs';
import {createTM1637} from './tm1637.mjs';
import {createInfrared} from './infrared.mjs';
import {createOneWireBus} from './onewire-bus.mjs';
import {createQuadratureInputs} from './quadrature-inputs.mjs';
import {createDHTBus} from './dht-bus.mjs';
import {createAnalogInputs} from './analog-inputs.mjs';
import {createI2CHost} from './i2c-host.mjs';
export function createCircuitHost(send, config) {
  const c = structuredClone(config.circuit);
  const pins = new Map(), adcPins = new Set(),busLow=new Map(),pulses=new Map();
  const gpioNet = new Map(c.gpios.map(g => [g.pin, g.net]));
  const analog=createAnalogInputs(c.analogInputs);
  const adcFaults=new Map();
  const started = performance.now();
  const logicVoltage=config.logicVoltage??3.3,baseNow=config.nowMs??(()=>performance.now()-started);
  let offsetUs=0,frozenUs=null,clockDepth=0;
  // Cycle-based backends provide exact microseconds, avoiding a ms round-trip
  // that can place a scheduled edge infinitesimally before its own timestamp.
  // IR MicroPython uses a software clock: declared sleeps advance time, while
  // unrelated browser/Asyncify pauses do not erase a waveform between calls.
  // Explicit clocks (including AVR cycles) and projects without IR are unchanged.
  const irClock=!config.nowUs&&!config.nowMs&&!!c.irReceivers?.length;
  let irBaseUs=0,irSleep=null;
  function irNowUs(){
    if(!irSleep)return irBaseUs;
    const elapsed=Math.min(irSleep.us,Math.max(0,(performance.now()-irSleep.wall)*1000));
    if(elapsed>=irSleep.us){irBaseUs+=irSleep.us;irSleep=null;return irBaseUs;}
    return irBaseUs+elapsed;
  }
  const baseNowUs=config.nowUs??(irClock?irNowUs:()=>baseNow()*1000);
  const clockUs=()=>frozenUs??(baseNowUs()+offsetUs),now=()=>clockUs()/1000;
  function timingBegin(){const token=clockDepth;if(!clockDepth)frozenUs=clockUs();clockDepth++;return token;}
  function timingEnd(token){if(!Number.isInteger(token)||token<0||token>=clockDepth)throw Error('Nevaljano stanje virtualnog sata');clockDepth=token;if(!clockDepth){offsetUs=Math.max(offsetUs,frozenUs-baseNowUs());frozenUs=null;}dirty=true;}
  function advanceUs(us){if(config.advanceUs){config.advanceUs(us);dirty=true;return;}if(frozenUs!==null)frozenUs+=us;else offsetUs+=us;dirty=true;}
  let pending, blinkPending, lastPublish = -Infinity, faults = [], levelWarnings = [], cached, dirty = true;
  const encoders=createQuadratureInputs({c,clockUs});
  let infrared,tm,actuators,steppers,spi,rtc;
  const observeEncoders=()=>{if(encoders.observe())dirty=true;if(infrared?.observe())dirty=true;if(tm?.observe())dirty=true;if(rtc?.observe())dirty=true;};
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const timeMs=()=>Math.round(now());
  const rootData = () => {
    const parents = c.nets.map((_, i) => i);
    const root = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    for (const b of c.buttons) if (b.pressed) parents[root(b.b)] = root(b.a);
    for(const [a,b]of actuators?.contacts()??[])parents[root(b)]=root(a);
    return {root, roots:c.nets.map((_, i) => root(i))};
  };
  function diagnose() {
    observeEncoders();
    const {root} = rootData(), sources = new Map(), next = [], warnings = [];
    const add = (net, signature) => {
      const r = root(net);
      if (!sources.has(r)) sources.set(r, new Set());
      sources.get(r).add(signature);
    };
    for (const rail of c.rails) add(rail.net, String(rail.volts));
    for(const pin of busLow.values())add(gpioNet.get(pin),'0');
    for (const [id, p] of pins) if (p.mode === 'OUT' || p.mode === 'PWM') {
      add(gpioNet.get(id), p.mode === 'PWM' && p.duty > 0 && p.duty < 65535 ? `PWM:${id}:${p.freq}:${p.duty}` : String(p.mode === 'PWM' ? (p.duty ? logicVoltage : 0) : p.value * logicVoltage));
    }
    if(c.levelShifters?.length){
      const translated=solve();
      for(const d of translated.translatorDrives){
        add(d.net,String(d.volts));
        if(d.volts>logicVoltage+.3&&c.gpios.some(g=>root(g.net)===root(d.net)))next.push({code:'level-shifter-gpio-overvoltage',severity:'error',message:'Pretvornik pogoni GPIO previsokim naponom. Provjeri stranu A/B i smjer DIR.',terminals:c.nets[d.net].terminals,wires:c.nets[d.net].wires});
      }
      for(const d of c.levelShifters){const s=translated.levelShifters[d.id];if(s.powered&&(s.direction===null||s.channels.some(ch=>ch.level===null)))warnings.push({code:'level-shifter-input',severity:'warning',message:'SN74LVC2T45: DIR i oba ulaza trebaju valjanu logičku razinu. Neiskorišteni ulaz spoji na GND; neodređeni ulaz nije fizički trostatični izlaz.',terminals:[...c.nets[d.dir].terminals,...d.a.flatMap(n=>c.nets[n].terminals),...d.b.flatMap(n=>c.nets[n].terminals)],wires:[]});}
      if(translated.translatorUnstable)next.push({code:'level-shifter-feedback',severity:'error',message:'Povratna veza pretvornika nema određeno stabilno GPIO stanje. Odvoji ulaznu i izlaznu mrežu.',terminals:[],wires:[]});
    }
    if(c.i2cLevelShifters?.length){
      const translated=solve();
      for(const d of translated.i2cBridges){
        const signatures=new Set([...(sources.get(root(d.low))??[]),...(sources.get(root(d.high))??[])]);
        if(signatures.has('0')&&[...signatures].some(v=>v!=='0'))next.push({code:'i2c-shifter-output-conflict',severity:'error',message:'I2C pretvornik: jedan izvor povlači LOW, drugi aktivno pogoni HIGH. Koristi otvoreni odvod ili ulaz.',terminals:[...c.nets[d.low].terminals,...c.nets[d.high].terminals],wires:[]});
      }
      for(const d of c.i2cLevelShifters)for(const n of [...d.low,...d.high])if(translated.volts[n]>logicVoltage+.3&&c.gpios.some(g=>root(g.net)===root(n)))next.push({code:'i2c-shifter-gpio-overvoltage',severity:'error',message:'I2C linija prekoračuje naponsku domenu GPIO-a. Provjeri stranu i pull-up napajanje.',terminals:c.nets[n].terminals,wires:c.nets[n].wires});
      if(translated.translatorUnstable)next.push({code:'i2c-shifter-feedback',severity:'error',message:'I2C pretvornik nema stabilno DC stanje. Provjeri napajanja i odvojene SDA/SCL mreže.',terminals:[],wires:[]});
    }
    for (const [r, signatures] of sources) if (signatures.size > 1) {
      const nets = c.nets.filter((_, i) => root(i) === r);
      next.push({code:'output-conflict', severity:'error', message:'Sukob aktivnih izlaza ili napajanja na istoj mreži. Zaustavi program i provjeri GPIO te kontakte tipkala.', terminals:nets.flatMap(n => n.terminals), wires:nets.flatMap(n => n.wires)});
    }
    for(const net of timed?.conflicts()??[])next.push({code:'dht-output-conflict',severity:'error',message:'DHT povlači DATA na LOW, a GPIO ga aktivno pogoni na HIGH. Otpusti pin kao ulaz.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    for(const net of oneWire?.conflicts()??[])next.push({code:'onewire-output-conflict',severity:'error',message:'DS18B20 povlači DQ na LOW, a GPIO ga aktivno pogoni na HIGH. Koristi otvoreni odvod ili otpusti pin kao ulaz.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    for(const net of encoders.conflicts(pins,gpioNet,root))next.push({code:'encoder-output-conflict',severity:'error',message:'KY-040 zatvara kontakt prema GND, a signal je aktivno na HIGH. Postavi CLK, DT i SW kao ulaze.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    for(const net of infrared?.conflicts()??[])next.push({code:'ir-output-conflict',severity:'error',message:'IR prijamnik povlači OUT na LOW, a GPIO je aktivno HIGH. Postavi GPIO kao ulaz.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    for(const net of tm?.conflicts()??[])next.push({code:'tm1637-output-conflict',severity:'error',message:'TM1637 potvrđuje ACK na LOW; otpusti DIO kao ulaz ili otvoreni odvod.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    if(c.bridges?.length)for(const net of actuators?.conflicts(solve().volts,pins,gpioNet,root)??[])next.push({code:'bridge-output-conflict',severity:'error',message:'Izlaz L298N spojen je preko kontakta ili vodiča na drugi aktivni izvor. Provjeri pogonski krug.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    for(const net of steppers?.conflicts()??[])next.push({code:'stepper-output-conflict',severity:'error',message:'A4988: aktivni izlaz spojen je preko kontakta na izvor ili drugi izlaz. Provjeri zavojnice i pogonski krug.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    for(const net of spi?.conflicts()??[])next.push({code:"touch-irq-conflict",severity:"error",message:"XPT2046: PENIRQ je otvoreni odvod LOW, GPIO postavi kao ulaz.",terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    for(const net of rtc?.conflicts()??[])next.push({code:'rtc-output-conflict',severity:'error',message:'DS1302 pogoni I/O; otpusti GPIO kao ulaz prije prvog padajućeg brida čitanja.',terminals:c.nets[net].terminals,wires:c.nets[net].wires});
    faults = next; levelWarnings=warnings;
    return faults.length ? -2 : 0;
  }
  // Gaussian elimination on anchored resistive islands; floating islands remain null.
  function solve(phase,ignorePins=[],skipTimed=false,skipIR=false,skipTM=false,skipRTC=false) {
    const {root, roots} = rootData(), fixed = new Map(), edges = [];
    for (const rail of c.rails) fixed.set(root(rail.net), rail.volts);
    for (const [id, p] of pins) {
      if(ignorePins.includes(id))continue;
      const n = root(gpioNet.get(id));
      if (p.mode === 'OUT') fixed.set(n, p.value * logicVoltage);
      if (p.mode === 'PWM') {
        const at = phase === undefined ? ((performance.now()-p.epoch) * p.freq / 1000) % 1 : phase;
        fixed.set(n, p.duty === 65535 || at < p.duty / 65535 ? logicVoltage : 0);
      }
    }
    for(const pin of busLow.values())if(!ignorePins.includes(pin))fixed.set(root(gpioNet.get(pin)),0);
    const ground = c.nets.length, supply = ground + 1;
    fixed.set(ground, 0); fixed.set(supply, logicVoltage);
    const edge = (a,b,r,offset=0) => { if (a !== b) edges.push({a,b,g:1/Math.max(.001,r),offset}); };
    if(!skipTimed){if(timed)timed.edges(root,edge);if(oneWire)oneWire.edges(root,edge);}
    if(!skipTM)tm?.edges(root,edge);if(!skipRTC)rtc?.edges(root,edge);
    for(const d of c.tmDisplays??[]){edge(root(d.clkNet),root(d.lv),10000);edge(root(d.dioNet),root(d.lv),10000);}
    actuators?.passiveEdges(root,edge);
    steppers?.passiveEdges(root,edge);
    spi?.edges(root,edge);
    encoders.edges(root,edge);if(!skipIR)infrared?.edges(root,edge);
    for (const r of c.resistors) edge(root(r.a), root(r.b), r.ohms);
    for (const d of c.i2cDevices??[]) if(d.pullups){edge(root(d.sda),root(d.lv??d.vcc),4700);edge(root(d.scl),root(d.lv??d.vcc),4700);}
    for (const d of c.i2cLevelShifters??[]) if(d.pullups){for(const n of d.low)edge(root(n),root(d.lv),10000);for(const n of d.high)edge(root(n),root(d.hv),10000);}
    for (const p of c.pots) {
      edge(root(p.a), root(p.w), p.ohms * (1-p.position/100));
      edge(root(p.w), root(p.b), p.ohms * p.position/100);
    }
    for (const [id,p] of pins) if (p.mode === 'IN' && p.pull && !ignorePins.includes(id)) edge(root(gpioNet.get(id)),p.pull === 1 ? supply : ground,45000);
    function linear(extra) {
      const all = [...edges,...extra], neighbours = new Map(), anchored = new Set(fixed.keys()), todo = [...anchored];
      for (const e of all) {
        if (!neighbours.has(e.a)) neighbours.set(e.a,[]);
        if (!neighbours.has(e.b)) neighbours.set(e.b,[]);
        neighbours.get(e.a).push(e.b); neighbours.get(e.b).push(e.a);
      }
      while (todo.length) for (const n of neighbours.get(todo.pop()) ?? []) if (!anchored.has(n)) { anchored.add(n); todo.push(n); }
      const unknown = [...anchored].filter(n => !fixed.has(n)), idx = new Map(unknown.map((n,i) => [n,i]));
      const A = unknown.map(() => new Float64Array(unknown.length+1)), N = unknown.length;
      for (const e of all) for (const [a,b,offset] of [[e.a,e.b,e.offset],[e.b,e.a,-e.offset]]) {
        const i=idx.get(a); if (i === undefined) continue;
        A[i][i] += e.g; A[i][N] += e.g * offset;
        if (fixed.has(b)) A[i][N] += e.g * fixed.get(b);
        else if (idx.has(b)) A[i][idx.get(b)] -= e.g;
      }
      for (let k=0;k<N;k++) {
        let pivot=k; for (let i=k+1;i<N;i++) if (Math.abs(A[i][k])>Math.abs(A[pivot][k])) pivot=i;
        [A[k],A[pivot]]=[A[pivot],A[k]];
        if (Math.abs(A[k][k])<1e-14) return fixed;
        for (let i=k+1;i<N;i++) {
          const f=A[i][k]/A[k][k]; if (!f) continue;
          for (let j=k+1;j<=N;j++) A[i][j]-=f*A[k][j];
          A[i][k]=0;
        }
      }
      const values=new Map(fixed);
      for (let i=N-1;i>=0;i--) { let v=A[i][N]; for(let j=i+1;j<N;j++) v-=A[i][j]*values.get(unknown[j]); values.set(unknown[i],v/A[i][i]); }
      return values;
    }
    if(c.analogInputs?.length){
      const initial=linear([]),base=roots.map(r=>initial.has(r)?initial.get(r):null);
      analog.edges(base,root,edge);
    }
    if(actuators){const base=linear([]);actuators.driveEdges(roots.map(r=>base.has(r)?base.get(r):null),root,edge);}
    let active = new Set(c.leds.map(l=>l.id));
    const diodeEdges=()=>c.leds.filter(l=>active.has(l.id)).map(l=>({a:root(l.a),b:root(l.k),g:.1,offset:l.vf}));
    const levelState=values=>evaluateLevelShifters(c.levelShifters,roots.map(r=>values.has(r)?values.get(r):null),net=>(c.referenceGrounds??[]).some(g=>root(g)===root(net)));
    const i2cLevelState=values=>evaluateI2CLevelShifters(c.i2cLevelShifters,roots.map(r=>values.has(r)?values.get(r):null),net=>(c.referenceGrounds??[]).some(g=>root(g)===root(net)),(net,v)=>c.rails.some(r=>r.volts===v&&root(r.net)===root(net)));
    let translated={states:{},drives:[]},translationEdges=[],translationKey='',translatorUnstable=false;
    let i2cTranslated={states:{},bridges:[]},i2cTranslationKey='',i2cTranslationEdges=[];
    let values = linear(diodeEdges());
    const passes=c.levelShifters?.length||c.i2cLevelShifters?.length?24:12;
    for (let pass=0;pass<passes;pass++) {
      const next=new Set();
      for (const l of c.leds) {
        const va=values.get(root(l.a)), vk=values.get(root(l.k));
        if (va !== undefined && vk !== undefined && va-vk > l.vf + 1e-8) next.add(l.id);
      }
      const nextTranslation=c.levelShifters?.length?levelState(values):translated,nextKey=c.levelShifters?.length?JSON.stringify(nextTranslation.drives):translationKey;
      const sameTranslation=nextKey===translationKey||!c.levelShifters?.length;
      translated=nextTranslation;
      const nextI2C=c.i2cLevelShifters?.length?i2cLevelState(values):i2cTranslated,nextI2CKey=JSON.stringify(nextI2C.bridges);
      const sameI2C=nextI2CKey===i2cTranslationKey||!c.i2cLevelShifters?.length;i2cTranslated=nextI2C;
      if (next.size===active.size && [...next].every(id => active.has(id))&&sameTranslation&&sameI2C) break;
      active=next;
      translationKey=nextKey;
      // 1 ohm is a numerical Lab output impedance, not a measured TI parameter.
      translationEdges=translated.drives.map(d=>({a:root(d.net),b:root(d.gnd),g:1,offset:d.volts-(values.get(root(d.gnd))??0)}));
      // 0.1 ohm is an ideal closed-switch numerical choice, not a MOSFET Rds(on).
      i2cTranslationKey=nextI2CKey;i2cTranslationEdges=i2cTranslated.bridges.map(d=>({a:root(d.low),b:root(d.high),g:10,offset:0}));
      values=linear([...diodeEdges(),...translationEdges,...i2cTranslationEdges]);
      if(pass===passes-1&&(c.levelShifters?.length||c.i2cLevelShifters?.length)){translatorUnstable=true;translated={states:translated.states,drives:[]};i2cTranslated={states:i2cTranslated.states,bridges:[]};values=linear(diodeEdges());}
    }
    const volts = roots.map(r => values.has(r) ? clamp(values.get(r),-100,100) : null);
    const currents=Object.fromEntries(c.leds.map(l => [l.id,active.has(l.id) ? Math.max(0,((volts[l.a]??0)-(volts[l.k]??0)-l.vf)*100) : 0]));
    return {volts,currents,levelShifters:translated.states,translatorDrives:translated.drives,translatorUnstable,i2cLevelShifters:i2cLevelState(values).states,i2cBridges:i2cTranslated.bridges};
  }
  function currentSolution() {
    observeEncoders();
    if (dirty || [...pins.values()].some(p=>p.mode==='PWM')) { cached=solve(); dirty=false; }
    for(let n=0;n<4&&actuators?.updateContacts(cached.volts);n++){cached=solve();}
    return cached;
  }
  function status() { return diagnose(); }
  const timedPins=c.gpios.filter(g=>[...(c.timedSensors??[]),...(c.oneWireDevices??[])].some(d=>rootData().root(d.data)===rootData().root(g.net))).map(g=>g.pin);
  let timed,oneWire;
  // In a passive DS18B20-only network the idle electrical solution depends on
  // supply GPIOs, not time or DQ pulses (those pins are explicitly ignored).
  // Reuse it only for that topology; mixed circuits keep the general solver.
  const passiveOneWire=!!c.oneWireDevices?.length&&Object.entries(c).every(([key,value])=>
    !Array.isArray(value)||!value.length||['nets','gpios','rails','referenceGrounds','resistors','oneWireDevices'].includes(key));
  let oneWireIdleKey,oneWireIdleValue;
  const oneWireIdleSolution=()=>{
    if(!passiveOneWire)return solve(undefined,timedPins,true);
    const key=JSON.stringify([...pins].filter(([id])=>!timedPins.includes(id)));
    if(key!==oneWireIdleKey){oneWireIdleValue=solve(undefined,timedPins,true);oneWireIdleKey=key;}
    return oneWireIdleValue;
  };
  infrared=createInfrared({c,pins,gpioNet,rootData,idleSolution:()=>solve(undefined,[],false,true),clockUs});
  timed=createDHTBus({c,pins,gpioNet,rootData,idleSolution:()=>solve(undefined,timedPins,true),clockUs,logicVoltage});
  oneWire=createOneWireBus({c,pins,gpioNet,rootData,idleSolution:oneWireIdleSolution,clockUs,logicVoltage});
  tm=createTM1637({c,pins,gpioNet,rootData,idleSolution:()=>solve(undefined,[],false,false,true),clockUs});
  rtc=createDS1302({c,pins,gpioNet,rootData,idleSolution:()=>solve(undefined,[],false,false,false,true),clockUs});
  const observeTimed=()=>{timed.observe();oneWire.observe();if(tm.observe())dirty=true;if(rtc.observe())dirty=true;};
  const nextEdge=()=>Math.min(timed.nextEdgeUs(),oneWire.nextEdgeUs(),encoders.nextEdgeUs(),infrared.nextEdgeUs());
  const i2c=createI2CHost({c,gpioNet,pins,rootData,solution:currentSolution,idleSolution:ignore=>solve(undefined,ignore),queue,timeMs:now,electricalStatus:status,logicVoltage});
  spi=createSPIHost({c,gpioNet,pins,rootData,solution:currentSolution,clockUs,advanceUs,radioMedium:config.radioMedium,radioNode:config.radioNode});
  function waveform(net){
    const {root}=rootData(),sources=[...pins].filter(([pin,p])=>root(gpioNet.get(pin))===root(net)&&['OUT','PWM'].includes(p.mode));
    if(sources.length!==1)return null;const [pin,p]=sources[0],pulse=pulses.get(pin);
    if(p.mode==='PWM')return {freq:p.freq,duty:p.duty/65535};
    if(pulse&&now()-pulse.at<=Math.max(2,Math.min(60,pulse.periodUs*.003)))return {freq:1000000/pulse.periodUs,duty:pulse.pulseUs/pulse.periodUs};
    return null;
  }
  steppers=createSteppers({c,clockUs,rootData,pins,gpioNet});
  actuators=[...(c.relays??[]),...(c.buzzers??[]),...(c.bridges??[]),...(c.motors??[])].length?createActuators({c,clockUs,waveform,rootData}):undefined;
  function servoState(s,v){
    const powered=(!s.requiresCommonGround||(c.referenceGrounds??[]).some(g=>rootData().root(g)===rootData().root(s.gnd)))&&v[s.vcc]!==null&&v[s.gnd]!==null&&Math.abs(v[s.gnd])<.05&&v[s.vcc]-v[s.gnd]>=4.5&&v[s.vcc]-v[s.gnd]<=5.5;
    const {root}=rootData(),sources=[...pins].filter(([pin,p])=>root(gpioNet.get(pin))===root(s.signal)&&['OUT','PWM'].includes(p.mode));
    const source=sources.length===1?sources[0]:undefined,p=source?.[1],pulse=source?pulses.get(source[0]):undefined;
    const recent=pulse&&now()-pulse.at<=Math.max(60,pulse.periodUs*.003);
    const freq=p?.mode==='PWM'?p.freq:recent?1000000/pulse.periodUs:null;
    const pulseUs=p?.mode==='PWM'?p.duty*1000000/(65535*p.freq):recent?pulse.pulseUs:null;
    const valid=powered&&!faults.length&&freq&&Math.abs(freq-50)<1&&pulseUs>=(s.minUs??500)-10&&pulseUs<=(s.maxUs??2500)+10;
    return {powered,angle:valid?+clamp((pulseUs-(s.minUs??500))*180/((s.maxUs??2500)-(s.minUs??500)),0,180).toFixed(2):null,pulseUs,freq,
      reason:!powered?'Provjeri 5 V i zajedničku masu':faults.length?'Sukob izvora':!freq?'Nema valjanog niza impulsa':Math.abs(freq-50)>=1?'Model zahtijeva približno 50 Hz':!valid?`Impuls treba biti ${s.minUs??500}–${s.maxUs??2500} µs`:'Zadani položaj (idealizirano)'};
  }
  function publish() {
    if(blinkPending)clearTimeout(blinkPending);blinkPending=undefined;
    if (pending) clearTimeout(pending); pending=undefined; lastPublish=performance.now();
    diagnose();
    const instant=currentSolution();
    const boundaries=[...new Set([0,1,...[...pins.values()].filter(p=>p.mode==='PWM').map(p=>p.duty/65535)])].sort((a,b)=>a-b);
    const currents=Object.fromEntries(c.leds.map(l=>[l.id,0]));
    const volts=Object.fromEntries(c.nets.map(n=>[n.id,null]));
    const sums=c.nets.map(()=>0), floating=new Set();
    const motorAverages=Object.fromEntries((c.motors??[]).map(d=>[d.id,0])),motorKnown=new Set(),motorPeaks={};
    for(let i=1;i<boundaries.length;i++) {
      const weight=boundaries[i]-boundaries[i-1], r=boundaries.length===2 ? instant : solve((boundaries[i]+boundaries[i-1])/2);
      for (const l of c.leds) currents[l.id]+=r.currents[l.id]*weight;
      for(const d of c.motors??[])if(r.volts[d.a]!==null&&r.volts[d.b]!==null){const u=r.volts[d.a]-r.volts[d.b];motorAverages[d.id]+=u*weight;motorKnown.add(d.id);motorPeaks[d.id]=Math.max(motorPeaks[d.id]??0,Math.abs(u));}
      r.volts.forEach((v,j)=>{if(v===null)floating.add(j);else sums[j]+=v*weight;});
    }
    c.nets.forEach((n,i)=>{volts[n.id]=faults.length||floating.has(i)?null:+sums[i].toFixed(5);});
    const averaged=c.nets.map((_,i)=>floating.has(i)?null:sums[i]);
    const stepperState=steppers.snapshot(instant.volts);
    const actuatorState=actuators?.snapshot(instant.volts,averaged,[...pins.values()].some(p=>p.mode==='PWM'),Object.fromEntries((c.motors??[]).map(d=>[d.id,motorKnown.has(d.id)?motorAverages[d.id]:null])),motorPeaks)??{actuators:undefined,diagnostics:[]};
    const digital=Object.fromEntries([...pins].filter(([,p])=>p.mode==='OUT').map(([id,p])=>[id,p.value]));
    const peripherals=i2c.snapshot(instant.volts),peripheralDiagnostics=peripherals.diagnostics;delete peripherals.diagnostics;
    const spiState=spi.snapshot(instant.volts);
    Object.assign(peripherals.sensors,spiState.sensors);
    peripherals.measurements=[...peripherals.measurements,...spiState.measurements].sort((a,b)=>a.timeMs-b.timeMs).slice(-200);
    const timedState=timed.snapshot(),oneWireState=oneWire.snapshot();
    const analogState=analog.snapshot(instant.volts,c,pins,gpioNet,rootData().root);
    const irState=infrared.snapshot(),tmState=tm.snapshot(),rtcState=rtc.snapshot();
    const encoderState=encoders.snapshot(instant.volts,pins,gpioNet,rootData().root);
    send({type:'pins',pins:digital});
    send({type:'simulation',clockProfile:config.nowUs?'external-us':irClock?'ir-software-us':'wall-us',timeMs:Math.round(now()),nets:volts,
      levelShifters:instant.levelShifters,
      i2cLevelShifters:instant.i2cLevelShifters,
      leds:Object.fromEntries(c.leds.map(l=>[l.id,{brightness:faults.length?0:clamp(currents[l.id]/5,0,1),currentMa:faults.length?0:+currents[l.id].toFixed(4)}])),
      gpios:Object.fromEntries([...pins].map(([id,p])=>{const v=instant.volts[gpioNet.get(id)];return [id,{mode:adcPins.has(id)?'ADC':p.mode,volts:faults.length?null:v,level:faults.length||v===null?null:v<logicVoltage*.25?0:v>logicVoltage*.75?1:null,...(p.mode==='PWM'?{freq:p.freq,duty:p.duty}: {})}];})),
      ...peripherals,radios:spiState.radios,sdCards:spiState.sdCards,rtcDevices:rtcState.rtcDevices,touches:spiState.touches,touchReadings:spiState.touchReadings,tfts:spiState.tfts,spiTrace:spiState.trace,spiBytes:spiState.count,steppers:stepperState.steppers,actuators:actuatorState.actuators,tmDisplays:tmState.tmDisplays,infrared:irState.infrared,encoders:encoderState.encoders,oneWireDevices:oneWireState.oneWireDevices,timedSensors:timedState.timedSensors,analogInputs:analogState.analogInputs,servos:Object.fromEntries((c.servos??[]).map(s=>[s.id,servoState(s,instant.volts)])),
      diagnostics:[...faults,...levelWarnings,...rtcState.diagnostics,...spiState.diagnostics,...stepperState.diagnostics,...actuatorState.diagnostics,...tmState.diagnostics,...irState.diagnostics,...peripheralDiagnostics,...timedState.diagnostics,...oneWireState.diagnostics,...analogState.diagnostics,...encoderState.diagnostics,...adcFaults.values()]});
    if(!config.manualPublish&&Object.values(peripherals.displays).some(d=>d.kind==='lcd'&&d.powered&&d.on&&d.blink))blinkPending=setTimeout(publish,Math.max(10,500-now()%500));
    // Mechanical motion must remain visible even if the program sleeps and
    // does not read GPIOs. AVR owns cycle scheduling and manual frame delivery.
    if(!config.manualPublish&&[...Object.values(encoderState.encoders),...Object.values(irState.infrared)].some(d=>d.busy))pending=setTimeout(publish,33);
  }
  function queue() {
    dirty=true;
    if(actuators)actuators.observe(currentSolution().volts);
    if(c.stepperDrivers?.length)steppers.observe(currentSolution().volts);
    // Observe supply changes when they occur, not at the next throttled frame.
    if(c.i2cDevices?.length)i2c.syncPower(currentSolution().volts);
    if(c.spiDevices?.length)spi.observe(currentSolution().volts);
    if (!config.manualPublish && !pending) pending=setTimeout(publish,Math.max(0,33-(performance.now()-lastPublish)));
  }
  function readValue(id,pull=0){
      if(!gpioNet.has(id))return -2;
      let p=pins.get(id);
      if(!p){p={mode:'IN',pull,value:0};pins.set(id,p);queue();}
      if(p.mode==='IN'&&p.pull!==pull){p.pull=pull;queue();}
      if(status()<0)return -2;
      const v=currentSolution().volts[gpioNet.get(id)];
      return v===null?-1:v>logicVoltage+.3||v<-.3?-2:v<=logicVoltage*.25?0:v>=logicVoltage*.75?1:-3;
  }
  observeTimed();
  return {
    timingBegin,timingEnd,ticksUs(){const t=clockUs();if(clockDepth||irClock)advanceUs(1);return t;},
    delayUs(us){if(frozenUs!==null||irClock||us<1000){advanceUs(us);return true;}return false;},
    waitMs(ms){
      if(frozenUs!==null)advanceUs(ms*1000);
      else if(irClock){const at=irNowUs();irBaseUs=at;irSleep={us:ms*1000,wall:performance.now()};dirty=true;}
    },
    timePulseUs(id,level,timeout){
      const token=timingBegin();
      try{
        let v=readValue(id,pins.get(id)?.pull??0),waiting=v!==level,start=clockUs(),pulseStart=waiting?null:start;
        if(v<0)return -3;
        for(let n=0;n<65536;n++){
          const next=nextEdge(),deadline=(pulseStart??start)+timeout;
          if(next>deadline||!Number.isFinite(next)){advanceUs(deadline-clockUs());return waiting?-2:-1;}
          advanceUs(next-clockUs());v=readValue(id,pins.get(id)?.pull??0);if(v<0)return -3;
          if(waiting&&v===level){waiting=false;pulseStart=clockUs();}
          else if(!waiting&&v!==level)return Math.round(clockUs()-pulseStart);
        }return -1;
      }finally{timingEnd(token);queue();}
    },
    nextTimedEdgeUs:nextEdge,
    timedStep(){dirty=true;},
    busDrive(id,pin,low){
      // Releasing an already released slave output changes no electrical state.
      // In mixed hardware/software I2C this also avoids solving the full network
      // again for every unrelated GPIO edge while the hardware bus is enabled.
      if(low?busLow.get(id)===pin:!busLow.has(id))return;
      if(low)busLow.set(id,pin);else busLow.delete(id);dirty=true;
    },
    capturePulse(pin,pulseUs,periodUs){pulses.set(pin,{pulseUs,periodUs,at:now()});},
    mode(id, output, pull=0, value=-1) {
      if(!gpioNet.has(id))return -2;
      const old=pins.get(id),next={mode:output?'OUT':'IN',pull,value:value < 0 ? old?.value??0 : value ? 1 : 0};
      if(old&&old.mode===next.mode&&old.pull===next.pull&&old.value===next.value)return 0;
      pins.set(id,next);adcPins.delete(id);dirty=true;observeTimed();queue();return status();
    },
    write(id,value) { const p=pins.get(id);if(!p||p.mode!=='OUT')return -2;if(p.value!==value){p.value=value;dirty=true;observeTimed();queue();}return status(); },
    read(id,pull=0) {const v=readValue(id,pull);if(clockDepth||irClock)advanceUs(1);return v;},
    // Cycle backends sample external GPIOs at one instant. Their port modes
    // are already synchronized; diagnose and solve that electrical state once.
    readMany(requests) {
      for(const [id,pull]of requests){
        if(!gpioNet.has(id))continue;
        const p=pins.get(id);
        if(!p){pins.set(id,{mode:'IN',pull,value:0});queue();}
        else if(p.mode==='IN'&&p.pull!==pull){p.pull=pull;queue();}
      }
      const healthy=status()>=0,volts=healthy?currentSolution().volts:[];
      return requests.map(([id])=>{
        if(!gpioNet.has(id)||!healthy)return -2;
        const v=volts[gpioNet.get(id)];
        return v===null?-1:v>logicVoltage+.3||v<-.3?-2:v<=logicVoltage*.25?0:v>=logicVoltage*.75?1:-3;
      });
    },
    adc(id,observe=true) {
      if(!gpioNet.has(id)||(config.adcPins?!config.adcPins.includes(id):id<1||id>20))return -1;
      if(observe)adcPins.add(id);
      if(status()<0)return -2;
      const v=currentSolution().volts[gpioNet.get(id)];if(observe){
        const net=c.nets[gpioNet.get(id)],bad=v===null?'ADC: nepobuđen ulaz. Broj 0 na AVR-u nije valjano mjerenje.':v>logicVoltage+.3||v<-.3?'ADC: previsok ili negativan ulazni napon.':null;
        if(bad)adcFaults.set(id,{code:v===null?'adc-floating':'adc-voltage',severity:'warning',message:bad,terminals:net.terminals,wires:net.wires});else adcFaults.delete(id);
        queue();
      }
      return v===null?-1:v>logicVoltage+.3||v<-.3?-2:Math.round(Math.max(0,v)*1000000);
    },
    pwm(id,freq,duty) {
      if(!gpioNet.has(id)||freq<0||freq>40000000||duty<0||duty>65535)return -2;
      if(freq&&[...pins].filter(([n,p])=>n!==id&&p.mode==='PWM').length>=8)return -3;
      const old=pins.get(id);adcPins.delete(id);
      pins.set(id,freq?{mode:'PWM',freq,duty,epoch:old?.epoch??performance.now(),value:0,pull:0}:{mode:'IN',pull:0,value:0});
      queue();return status();
    },
    input(data) {
      rtc.input(data);spi.input(data);infrared.input(data);encoders.input(data);analog.input(data);i2c.input(data);timed.input(data);oneWire.input(data);queue();
      const target=c.buttons.find(p=>p.id===data.component)??c.pots.find(p=>p.id===data.component);
      if(!target)return;
      if('pressed' in data&&'pressed' in target)target.pressed=!!data.pressed;
      if('position' in data&&'position' in target&&Number.isFinite(data.position))target.position=clamp(data.position,0,100);
      queue();
      if(status()<0){publish();send({type:'error',message:faults[0].message});}
    },
    spiConfig:spi.config,
    spiExchange(id,bytes){const out=spi.exchange(id,bytes);queue();return out;},
    spiTransfer:spi.transfer,
    i2cConfig:i2c.config,i2cProbe:i2c.probe,i2cTx:i2c.tx,i2cRx:i2c.rx,
    i2cStreamBegin:i2c.streamBegin,i2cStreamWrite:i2c.streamWrite,i2cStreamRead:i2c.streamRead,i2cStreamStop:i2c.streamStop,
    i2cPresent(){return false;},i2cWrite(){},i2cByte(){return 0;},
    frame(bytes){send({type:'frame',bytes:Array.from(bytes)});},
    sample:currentSolution,electricalStatus:status,
    dispose(){if(pending)clearTimeout(pending);if(blinkPending)clearTimeout(blinkPending);pending=blinkPending=undefined;},
    flush:publish,
  };
}
