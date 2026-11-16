// MIT. Explicit teaching profiles; DC transfer functions, not SPICE or calibrated instruments.
export function createAnalogInputs(devices=[]) {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), states=new Map();
  const resistance=d=>d.r25*Math.exp(d.beta*(1/(d.temperature+273.15)-1/298.15));
  function powered(d,volts) {
    const v=volts[d.vcc],g=volts[d.gnd],s=d.moduleVoltage??3.3;
    return v!=null&&g!=null&&Math.abs(g)<.05&&Math.abs((v-g)-s)<.15&&(d.kind!=='lm35'||v-g>=4);
  }
  function active(d,isPowered) {
    if(!isPowered){states.delete(d.id);return false;}
    let a=states.get(d.id)??false;
    if(d.stimulus>=d.threshold+2)a=true;
    if(d.stimulus<=d.threshold-2)a=false;
    states.set(d.id,a);return a;
  }
  return {
    edges(volts,root,edge) {
      for(const d of devices){
        const ok=powered(d,volts),o=d.outputs,g=root(d.gnd),v=root(d.vcc);
        if(d.kind==='ntc'){
          edge(v,root(o.AO),d.fixedResistance);edge(root(o.AO),g,resistance(d));
        }else if(d.kind==='ky023'){
          for(const [pin,position]of [['VRX',d.axisX],['VRY',d.axisY]]){
            edge(v,root(o[pin]),10000*(1-position/100));edge(root(o[pin]),g,10000*position/100);
          }
          if(d.pressed)edge(root(o.SW),g,.001);
        }else if(d.kind==='temt6000'){
          // Nominal photocurrent 10 uA at 20 lx; 10k load, finite headroom 0.1 V.
          // Thevenin equivalent includes the documented load, including external loading.
          if(ok)edge(root(o.AO),g,10000,clamp(d.illuminance*.005,0,Math.max(0,volts[d.vcc]-volts[d.gnd]-.1)));
          else edge(root(o.AO),g,10000);
        }else if(d.kind==='lm35'){
          if(ok)edge(root(o.OUT),g,.1,d.temperature*.01);
        }else if(d.kind==='flame'||d.kind==='sound'){
          const a=active(d,ok);
          if(ok){edge(root(o.DO),v,10000);if(a)edge(root(o.DO),g,10);if(d.kind==='flame')edge(root(o.AO),g,1000,(volts[d.vcc]-volts[d.gnd])*(1-d.stimulus/100));}
        }
      }
    },
    input(data){
      const d=devices.find(d=>d.id===data.component);if(!d)return;
      const keys=d.kind==='lm35'?{temperature:[2,150]}:d.kind==='ntc'?{temperature:[-20,100]}:d.kind==='temt6000'?{illuminance:[0,2000]}:d.kind==='ky023'?{axisX:[0,100],axisY:[0,100]}:{stimulus:[0,100]};
      for(const [key,[min,max]]of Object.entries(keys))if(Number.isFinite(data[key]))d[key]=clamp(data[key],min,max);
      if(d.kind==='ky023'&&typeof data.pressed==='boolean')d.pressed=data.pressed;
    },
    snapshot(volts,c,pins,gpioNet,root){
      const diagnostics=[];
      const result=Object.fromEntries(devices.map(d=>{
        const ok=powered(d,volts),a=['flame','sound'].includes(d.kind)?active(d,ok):undefined;
        const report=(code,message,nets)=>diagnostics.push({code,severity:'warning',message,terminals:nets.flatMap(n=>c.nets[n].terminals),wires:nets.flatMap(n=>c.nets[n].wires)});
        if(!ok)report('input-unpowered',`${d.id}: provjeri VCC (${d.moduleVoltage} V) i zajedničku masu; očitanje nije valjano.`,[d.vcc,d.gnd]);
        for(const [pin,net]of Object.entries(d.outputs)){
          if(!c.nets[net].wires.length)report('input-signal-open',`${d.id}: izlaz ${pin} nije spojen na pločicu.`,[net]);
          if([...pins].some(([id,p])=>['OUT','PWM'].includes(p.mode)&&root(gpioNet.get(id))===root(net)))report('input-driven',`${d.id}: ${pin} je spojen na aktivni GPIO izlaz; program treba ulazni način.`,[net]);
        }
        return [d.id,{powered:ok,active:a,volts:Object.fromEntries(Object.entries(d.outputs).map(([pin,n])=>[pin,volts[n]])),...(d.kind==='ntc'?{resistance:resistance(d)}:{})}];
      }));
      return {analogInputs:result,diagnostics};
    }
  };
}
