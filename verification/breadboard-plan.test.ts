import test from 'node:test';
import assert from 'node:assert/strict';
import {NANO,UNO,S3} from '../src/boards/profiles';
import {demoCircuit, emptyCircuit, keyOf, makePart, type Circuit} from '../src/circuit/model';
import {buildNets} from '../src/circuit/netlist';
import {breadboardPlan, type BreadboardPlan, type MountPin, type Socket} from '../src/circuit/breadboardPlan';
import {displayCircuit} from '../src/circuit/displayExamples';
import {environmentCircuit,environmentExamples,type EnvironmentExample} from '../src/circuit/environmentExamples';
import {rtcCircuit} from '../src/circuit/rtcExamples';
import {sdCircuit} from '../src/circuit/sdExamples';
import {opticalCircuit} from '../src/circuit/max30102Examples';
import {peripheralCircuit} from '../src/circuit/peripheralExamples';

function verify(c:Circuit,p:BreadboardPlan) {
  const original=buildNets(c),internal=buildNets({...c,wires:[]}),parent=new Map<string,string>();
  function root(k:string):string {
    const next=parent.get(k);
    if(!next||next===k)return k;
    const r=root(next);parent.set(k,r);return r;
  }
  function join(a:string,b:string){parent.set(root(a),root(b));}
  // Independently reconstruct copper from the printed hole designations.
  function strip(name:string) {
    const match=/^(?:([A-J])|(gornja [−+]|donja [−+]) )(\d+)$/.exec(name);
    assert.ok(match,name);const [,row,rail,col]=match;
    assert.ok(Number(col)>=1&&Number(col)<=p.columns);
    return 'BB/'+(row?(row<='E'?'upper':'lower')+col:rail+(Number(col)<=p.columns/2?'Left':'Right'));
  }
  for(const net of internal.nets)for(const t of net.terminals)join(keyOf(t),keyOf(net.terminals[0]));
  const existing=c.components.find(x=>x.kind==='breadboard'),checked=new Set<string>();
  for(const t of internal.map.values())if(t.component!==existing?.id)checked.add(keyOf(t));
  for(const w of c.wires)for(const e of [w.from,w.to])if(e.component===existing?.id){
    const [,prefix,col]=/^([a-z]+)(\d+)$/.exec(e.pin)!;
    const name=({tp:'gornja + ',tn:'gornja − ',bp:'donja + ',bn:'donja − '} as Record<string,string>)[prefix]??prefix.toUpperCase();
    join(keyOf(e),strip(name+col));checked.add(keyOf(e));
  }
  const mounted=new Set<string>(),ends=new Set<string>(),edges=new Set<string>();
  for(const m of p.mounts)for(const pin of m.pins)if(pin.at.hole){
    assert.ok(!mounted.has(pin.at.hole));mounted.add(pin.at.hole);join(keyOf(pin),strip(pin.at.hole));
  }
  function end(pin:MountPin,socket:Socket){
    const coord=socket.x+','+socket.y;
    assert.ok(!ends.has(coord),'occupied socket '+coord);ends.add(coord);
    if(socket.hole){assert.ok(!mounted.has(socket.hole));return strip(socket.hole);}
    return keyOf(pin);
  }
  for(const j of p.jumpers){
    join(end(j.from,j.start),end(j.to,j.end));
    assert.deepEqual(j.path[0],{x:j.start.x,y:j.start.y});assert.deepEqual(j.path.at(-1),{x:j.end.x,y:j.end.y});
    for(let i=1;i<j.path.length;i++){
      const a=j.path[i-1],b=j.path[i],dx=Math.sign(b.x-a.x),dy=Math.sign(b.y-a.y);
      assert.ok((dx===0)!==(dy===0),'orthogonal path');
      for(let x=a.x,y=a.y;x!==b.x||y!==b.y;x+=dx,y+=dy){
        const segment=[x+','+y,(x+dx)+','+(y+dy)].sort().join('|');
        assert.ok(!edges.has(segment),'stacked jumpers at '+segment);edges.add(segment);
      }
    }
  }
  const physical=new Map<string,string>(),expected=new Map<string,string>();
  for(const k of checked){
    const net=original.byTerminal.get(k)!.id, copper=root(k);
    assert.equal(physical.get(copper)??net,net,'unexpected connection at '+k);
    assert.equal(expected.get(net)??copper,copper,'missing connection at '+k);
    physical.set(copper,net);expected.set(net,copper);
  }
}
test('Nano USB end, orientation, analog order, SDA/SCL and a crossing-free OLED',()=>{
  const c=displayCircuit('oled32',NANO),before=structuredClone(c),p=breadboardPlan(c)!;
  assert.ok(p);const holes=Object.fromEntries(p.mounts[0].pins.map(x=>[x.pin,x.at.hole]));
  assert.deepEqual([holes.D13,holes.D12,holes.A0,holes.A4,holes.A5,holes['5V'],holes.VIN],['D1','H1','D4','D8','D9','D12','D15']);
  assert.equal(p.columns,60);assert.equal(p.jumpers.length,4);assert.equal(p.jumpers.flatMap(j=>j.crossings).length,0);
  verify(c,p);assert.deepEqual(c,before);assert.deepEqual(breadboardPlan(c),p);
});
test('existing 30/60 column breadboards retain named sockets, rail breaks, source layout and manual bends',()=>{
  for(const columns of [30,60] as const){
    const c=demoCircuit(),bb=c.components.find(p=>p.kind==='breadboard')!;
    bb.properties.breadboardColumns=columns;bb.rotation=90;
    const bridge=c.wires.find(w=>w.from.pin==='tn15')!;
    bridge.from.pin='tn'+columns/2;bridge.to.pin='tn'+(columns/2+1);
    c.wires[0].points=[{x:123,y:201}];
    const before=structuredClone(c),p=breadboardPlan(c)!;
    assert.ok(p);assert.equal(p.columns,columns);verify(c,p);assert.deepEqual(c,before);
    for(const w of c.wires)for(const e of [w.from,w.to])if(e.component===bb.id)
      assert.ok(p.jumpers.some(j=>keyOf(j.from)===keyOf(e)||keyOf(j.to)===keyOf(e)),keyOf(e));
    c.components.find(p=>p.kind==='button')!.properties.pressed=true;
    const pressed=breadboardPlan(c)!;verify(c,pressed);assert.deepEqual(p.jumpers,pressed.jumpers);
  }
});
test('unpowered parts, conflicting rails and unavailable layouts never acquire an inferred power feed',()=>{
  const c=displayCircuit('oled32',S3);c.wires=c.wires.filter(w=>w.to.pin!=='VCC');
  let p=breadboardPlan(c)!;verify(c,p);assert.ok(!p.jumpers.some(j=>j.to.pin==='VCC'||j.from.pin==='VCC'));
  c.wires.push({id:'short',from:{component:'esp32',pin:'J1.1'},to:{component:'esp32',pin:'J1.22'},points:[],color:'#000000'});
  p=breadboardPlan(c)!;verify(c,p);assert.ok(p.jumpers.some(j=>j.signal==='Sukob napajanja'));
  assert.equal(breadboardPlan(emptyCircuit()),null);
  c.components.push(makePart('breadboard',100,80,'bb1'),makePart('breadboard',200,80,'bb2'));assert.equal(breadboardPlan(c),null);
});
for(const board of [S3,UNO,NANO] as const)test('mounted circuits preserve all device nets and avoid shared wire segments · '+board,()=>{
  const unique=new Map<string,Circuit>();
  for(const key of Object.keys(environmentExamples) as EnvironmentExample[]){
    const c=environmentCircuit(key,board),id=JSON.stringify([c.components.map(p=>p.kind),c.wires.map(w=>[w.from,w.to])]);
    if(!unique.has(id))unique.set(id,c);
  }
  const circuits=[...unique.values(),rtcCircuit('rtcClock',board),sdCircuit('sdLogger',board),opticalCircuit('opticalRaw',board)];
  if(board===S3)circuits.push(peripheralCircuit());
  for(const c of circuits){
    const p=breadboardPlan(c);
    assert.ok(p,c.components.map(p=>p.kind).join(' + '));verify(c,p);
  }
});
