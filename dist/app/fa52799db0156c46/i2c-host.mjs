// MIT. I2C transactions are routed by compiled nets, never by display position.
import {AHT10,SSD1306,PeripheralError} from './peripherals.mjs';
import {BMP180,BMP280,AM2320} from './environment-sensors.mjs';
import {MAX30102,OPTICAL_RANGES} from './max30102.mjs';
import {LCD1602} from './lcd1602.mjs';
import {i2cLevelRoute} from './i2c-level-shifter.mjs';
const oled=d=>['ssd1306','ssd1306_32'].includes(d.kind);
const sensorKinds=['aht10','bmp180','bmp280','am2320'];
export function createI2CHost({c,gpioNet,pins,rootData,solution,queue,timeMs,electricalStatus,logicVoltage=3.3,idleSolution=solution}) {
  const makeModel=d=>oled(d)?new SSD1306(d.kind==='ssd1306_32'?32:64):d.kind==='lcd1602'?new LCD1602(d,timeMs):new ({aht10:AHT10,bmp180:BMP180,bmp280:BMP280,am2320:AM2320,max30102:MAX30102}[d.kind])(d,timeMs);
  const devices=c.i2cDevices??[], buses=new Map(), streams=new Map(), models=new Map(devices.map(d=>[d.id,makeModel(d)]));
  const trace=[],measurements=[],recorded=new Map(),powerState=new Map(); let diagnostics=[];
  const powered=(d,v)=>{
    const {root}=rootData(),voltage=d.moduleVoltage??3.3;
    // Pull-ups can otherwise phantom-power an open VCC in this unloaded DC model.
    // A rail or an explicitly driven output can supply this ideal low-current
    // model; an input pull-up cannot. Preserve program-controlled sensor power.
    const supplied=c.rails.some(r=>r.volts===voltage&&root(r.net)===root(d.vcc))||
      [...pins].some(([pin,p])=>p.mode==='OUT'&&p.value===1&&logicVoltage===voltage&&root(gpioNet.get(pin))===root(d.vcc));
    const lv=d.lv===undefined||c.rails.some(r=>r.volts===(d.logicVoltage??voltage)&&root(r.net)===root(d.lv));
    return lv&&supplied&&c.rails.some(r=>r.volts===0&&root(r.net)===root(d.gnd))&&
      v[d.gnd]!==null&&v[d.vcc]!==null&&Math.abs(v[d.gnd])<.05&&v[d.vcc]-v[d.gnd]>=(voltage===5?4.5:2.7)&&v[d.vcc]-v[d.gnd]<=(voltage===5?5.5:3.6);
  };
  function syncPower(v){
    for(const d of devices){const on=powered(d,v),previous=powerState.get(d.id);powerState.set(d.id,on);
      if(previous!==on){if(oled(d))models.set(d.id,makeModel(d));else models.get(d.id).reset();}
    }
  }
  const diagnose=(message,selected=devices,code='i2c-transfer')=>{
    const indices=new Set(selected.flatMap(d=>[d.sda,d.scl,d.vcc,d.gnd]));
    diagnostics=[{code,severity:'error',message,terminals:[...indices].flatMap(i=>c.nets[i].terminals),wires:[...indices].flatMap(i=>c.nets[i].wires)}];queue();
  };
  function resolve(id,address,report=false,stream=false) {
    const bus=buses.get(id),{root}=rootData(),v=solution().volts;
    syncPower(v);
    let message='',selected=[];
    if(!bus)message='I2C sabirnica je isključena.';
    else {
      const sda=root(gpioNet.get(bus.sda)),scl=root(gpioNet.get(bus.scl));
      const routes=new Map(devices.map(d=>[d.id,i2cLevelRoute(c.i2cLevelShifters,[sda,scl],[d.sda,d.scl],root)]));
      selected=devices.filter(d=>routes.get(d.id));
      const translated=[...new Set(selected.map(d=>routes.get(d.id)?.id).filter(Boolean))].map(id=>c.i2cLevelShifters.find(d=>d.id===id));
      const signalNets=[...new Set([sda,scl,...translated.flatMap(d=>[...d.low,...d.high].map(root))])];
      const idle=stream?idleSolution([bus.sda,bus.scl]):solution();
      if(bus.freq<1||bus.freq>400000)message='I2C: podržan takt je najviše 400 kHz.';
      else if(electricalStatus()<0)message='I2C: sukob izvora na sklopu.';
      else if(sda===scl)message='I2C: SDA i SCL spojeni su na istu mrežu.';
      else if([...pins].some(([pin,p])=>['OUT','PWM'].includes(p.mode)&&signalNets.includes(root(gpioNet.get(pin)))&&(!stream||p.mode==='PWM'||p.value)))message='I2C: aktivni GPIO izlaz drži liniju sabirnice; koristi open-drain (LOW ili ulaz).';
      else if(signalNets.some(n=>c.rails.some(r=>root(r.net)===n)))message='I2C: podatkovna ili taktna linija izravno je spojena na napajanje/masu.';
      else if(selected.length>1&&selected.some(d=>d.kind==='aht10'))message='AHT10 zahtijeva zasebnu I2C sabirnicu.';
      else if(selected.some(d=>{const r=routes.get(d.id),v=d.logicVoltage??d.moduleVoltage??3.3;return r.direct?v!==logicVoltage:r.fromVoltage!==logicVoltage||r.toVoltage!==v;}))message='I2C: naponske domene pločice, strane pretvornika i modula se razlikuju. Provjeri LV/HV i profil modula.';
      else if(translated.some(d=>!idle.i2cLevelShifters?.[d.id]?.powered))message='I2C pretvornik: potrebni su LV=3,3 V, HV=5 V i zajednička masa.';
      else if(translated.some(d=>!idle.i2cLevelShifters[d.id].channels.every(ch=>ch.idle)))message='I2C pretvornik: obje strane SDA/SCL trebaju valjan pull-up u svojoj domeni; provjeri kratki spoj ili otpuštanje linije.';
      else if([gpioNet.get(bus.sda),gpioNet.get(bus.scl)].some(n=>{const level=idle.volts[n];return level===null||level<logicVoltage*.75||level>logicVoltage+.3;}))message=`I2C: SDA/SCL trebaju valjan pull-up prema ${logicVoltage} V; provjeri napajanje i kratke spojeve.`;
      else {
        const matching=selected.filter(d=>d.address===address&&powered(d,v));
        if(matching.length===1)return matching[0];
        if(matching.length>1)message='I2C: više uređaja odgovara na istoj adresi.';
        else message=`I2C${id}: nema ACK na 0x${address.toString(16).padStart(2,'0')}. Provjeri adresu, SDA/SCL i napajanje uređaja.`;
      }
    }
    if(report)diagnose(message,selected.length?selected:devices);
    return null;
  }
  function log(bus,address,operation,bytes,result,length=bytes.length) {
    trace.push({timeMs:timeMs(),bus,address,operation,length,bytes:Array.from(bytes).slice(0,16),result});
    if(trace.length>100)trace.shift();queue();
  }
  function record(d,bytes,dataRead=false) {
    const model=models.get(d.id);
    const complete=d.kind==='aht10'?bytes.length===6&&!(bytes[0]&128):d.kind==='am2320'?bytes.length===(bytes[1]??0)+4:dataRead&&!!model.readMeta?.valid;
    const sample=model.readMeta?.sample??model.sample;
    if(sensorKinds.includes(d.kind)&&complete&&sample&&recorded.get(d.id)!==sample){
      recorded.set(d.id,sample);measurements.push({timeMs:timeMs(),component:d.id,temperature:model.readMeta?.temperature??model.measuredTemperature,humidity:model.measuredHumidity??null,pressure:model.readMeta?.pressure??model.measuredPressure??null,sample});if(measurements.length>200)measurements.shift();
    }
  }
  function acknowledge(d,write,freq){return models.get(d.id).onAddress?.(write,freq)??true;}
  function end(d,write,success=true,stop=true){models.get(d.id).end?.(write,success,stop);}
  function streamError(s,e){s.failed=true;diagnose(e.message,[s.d],'i2c-model');return false;}
  function streamStop(id,stop=true){
    const s=streams.get(id);if(!s)return;
    if(s.d&&!s.failed&&s.write&&s.d.kind==='aht10'&&s.bytes.length&&!s.applied)streamError(s,new PeripheralError('AHT10: nepotpuna naredba.'));
    if(s.d&&s.d.kind==='aht10'&&!s.failed&&!s.write&&![0,1,6].includes(s.length))streamError(s,new PeripheralError('AHT10: podržano je 1 ili 6 pročitanih bajtova.'));
    if(s.d&&!s.failed&&s.write&&oled(s.d)&&s.needsData)streamError(s,new PeripheralError('SSD1306: kontrolni bajt nema podatak.'));
    if(s.d)try{if(!s.write&&!s.failed)record(s.d,s.bytes,s.dataRead&&s.length>=(s.d.kind==='bmp180'?3:6));end(s.d,s.write,!s.failed,stop);}catch(e){if(!(e instanceof PeripheralError))throw e;streamError(s,e);}
    log(id,s.address,s.write?'W':'R',s.bytes,s.failed?'NACK / nepodržan prijenos':stop?'ACK':'ACK / repeated-start',s.length);streams.delete(id);
  }
  return {
    syncPower,
    // AVR byte streams and software-I2C GPIO edges share these exact models.
    streamBegin(id,sda,scl,address,write,freq=100000){
      streamStop(id);buses.set(id,{sda,scl,freq});
      const d=resolve(id,address,true,true),s={d,address,write,bytes:[],length:0,failed:!d,applied:false,control:undefined,needsData:false};streams.set(id,s);
      if(!d)return false;
      if(!write&&oled(d)){diagnose('SSD1306 I2C profil podržava samo upis.',[d],'i2c-model');s.failed=true;return false;}
      try {if(!acknowledge(d,write,freq)){s.failed=true;return false;}}catch(e){if(!(e instanceof PeripheralError))throw e;return streamError(s,e);}
      diagnostics=[];return true;
    },
    streamWrite(id,byte){
      const s=streams.get(id);if(!s||s.failed||!s.write)return false;
      if(++s.length>4096)return streamError(s,new PeripheralError('I2C: prijenos prelazi 4096 bajtova.'));
      if(s.bytes.length<16)s.bytes.push(byte);
      try {
        const model=models.get(s.d.id);
        if(s.d.kind==='aht10'){
          if(s.applied)throw new PeripheralError('AHT10: višak bajtova naredbe.');
          const command=s.bytes[0];
          if(![0xBA,0x71,0xE1,0xAC].includes(command))throw new PeripheralError('AHT10: nepodržana naredba.');
          if(s.length===([0xBA,0x71].includes(command)?1:3)){model.write(Uint8Array.from(s.bytes));s.applied=true;}
        }else if(!oled(s.d)){model.writeByte(byte);
        }else if(s.control===undefined){
          if(byte&63)throw new PeripheralError('SSD1306: nevaljan kontrolni bajt I2C.');s.control=byte;s.needsData=true;
        }else {model.write(Uint8Array.of(s.control&64,byte));s.needsData=false;if(s.control&128)s.control=undefined;}
        return true;
      }catch(e){if(!(e instanceof PeripheralError))throw e;return streamError(s,e);}
    },
    streamRead(id){
      const s=streams.get(id);if(!s||s.failed||s.write)return 255;
      try {
        const model=models.get(s.d.id);
        if(s.d.kind!=='aht10'){
          if(s.length>=4096)throw new PeripheralError('I2C: predugo čitanje.');
          if(s.length===0)s.dataRead=(s.d.kind==='bmp180'&&model.pointer===0xf6)||(s.d.kind==='bmp280'&&model.pointer===0xf7);
          const byte=model.readByte();s.length++;if(s.bytes.length<16)s.bytes.push(byte);return byte;
        }
        if(!s.readBytes)s.readBytes=model.read(6);
        if(s.length>=6)throw new PeripheralError('AHT10 nema sedmi CRC bajt.');
        const byte=s.readBytes[s.length++];s.bytes.push(byte);if(s.length===6)record(s.d,s.bytes);return byte;
      }catch(e){if(!(e instanceof PeripheralError))throw e;streamError(s,e);return 255;}
    },
    streamStop,
    config(id,sda,scl,freq) {
      if(!freq){const old=buses.get(id);buses.delete(id);if(old)for(const pin of [old.sda,old.scl])if(pins.get(pin)?.mode==='I2C')pins.set(pin,{mode:'IN',pull:0,value:0});queue();return 0;}
      if(!gpioNet.has(sda)||!gpioNet.has(scl)||sda===scl||![0,1].includes(id)||!Number.isInteger(freq)||freq<1||freq>400000)return -22;
      for(const [other,bus] of buses)if(other!==id&&[bus.sda,bus.scl].some(p=>p===sda||p===scl))return -16;
      const old=buses.get(id);if(old)for(const pin of [old.sda,old.scl])if(pins.get(pin)?.mode==='I2C')pins.set(pin,{mode:'IN',pull:0,value:0});
      buses.set(id,{sda,scl,freq});for(const pin of [sda,scl])pins.set(pin,{mode:'I2C',pull:0,value:0});diagnostics=[];queue();return 0;
    },
    probe(id,addr) {const d=resolve(id,addr);if(!d)return false;try{return acknowledge(d,true,buses.get(id).freq);}catch(e){if(!(e instanceof PeripheralError))throw e;return false;}},
    tx(id,address,bytes,stop) {
      const d=resolve(id,address,true);if(!d){log(id,address,'W',bytes,'NACK');return -19;}
      try {const model=models.get(d.id);if(!(model.onAddress?.(true,buses.get(id).freq)??true)){log(id,address,'W',bytes,'NACK / buđenje');return -19;}model.write(bytes);if(stop)end(d,true);diagnostics=[];log(id,address,'W',bytes,stop?'ACK':'ACK / bez STOP');return bytes.length;}
      catch(e){if(!(e instanceof PeripheralError))throw e;diagnose(e.message,[d],'i2c-model');log(id,address,'W',bytes,e.message);return e.code;}
    },
    rx(id,address,length,stop) {
      const d=resolve(id,address,true);if(!d){log(id,address,'R',[],'NACK',length);return -19;}
      try {
        const model=models.get(d.id);if(!(model.onAddress?.(false,buses.get(id).freq)??true)){log(id,address,'R',[],'NACK / zauzet',length);return -19;}
        const pointer=model.pointer,bytes=model.read(length);diagnostics=[];log(id,address,'R',bytes,stop?'ACK':'ACK / bez STOP');
        record(d,bytes,(d.kind==='bmp180'&&pointer===0xf6&&length>=3)||(d.kind==='bmp280'&&pointer===0xf7&&length>=6));if(stop)end(d,false);
        return bytes;
      }catch(e){if(!(e instanceof PeripheralError))throw e;diagnose(e.message,[d],'i2c-model');log(id,address,'R',[],e.message,length);return e.code;}
    },
    input(data) {
      const d=devices.find(d=>d.id===data.component&&(sensorKinds.includes(d.kind)||d.kind==='max30102'));if(!d)return;
      models.get(d.id).update?.();
      if(d.kind==='max30102'){for(const [key,[min,max]]of Object.entries(OPTICAL_RANGES))if(Number.isFinite(data[key]))d[key]=Math.max(min,Math.min(max,data[key]));if(typeof data.opticalContact==='boolean')d.opticalContact=data.opticalContact;return;}
      if(Number.isFinite(data.temperature))d.temperature=Math.max(-40,Math.min(d.kind==='am2320'?80:85,data.temperature));
      if(Number.isFinite(data.pressure))d.pressure=Math.max(30000,Math.min(110000,data.pressure));
      if(Number.isFinite(data.humidity))d.humidity=Math.max(0,Math.min(100,data.humidity));
    },
    snapshot(v) {
      syncPower(v);
      return {optical:Object.fromEntries(devices.filter(d=>d.kind==='max30102').map(d=>[d.id,models.get(d.id).snapshot(powered(d,v))])),sensors:Object.fromEntries(devices.filter(d=>sensorKinds.includes(d.kind)).map(d=>[d.id,models.get(d.id).snapshot(powered(d,v))])),
        displays:Object.fromEntries(devices.filter(d=>oled(d)||d.kind==='lcd1602').map(d=>[d.id,models.get(d.id).snapshot(powered(d,v))])),
        measurements:measurements.slice(),i2cTrace:trace.slice(),diagnostics};
    },
  };
}
