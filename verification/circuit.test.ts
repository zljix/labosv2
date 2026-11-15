import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import {buildNets,checkCircuit} from "../src/circuit/netlist";
import {demoCircuit,emptyCircuit,keyOf,makePart,parseCircuit,terminalMap,terminals,wirePoints,type Circuit,type Endpoint,type Kind,type Point} from "../src/circuit/model";
import {newProject,parseProject,clone,editProject} from "../src/project/model";
import {exportZip,importProject} from "../src/project/archive";
import {ProjectStore} from "../src/project/storage";
const ep=(component:string,pin:string):Endpoint=>({component,pin});
function fixture(...parts:Kind[]){const c=emptyCircuit();for(const[i,k]of parts.entries())c.components.push(makePart(k,350+i*250,150,`${k}${i}`));return c;}
function wire(c:Circuit,a:Endpoint,b:Endpoint,points:Point[]=[]){c.wires.push({id:crypto.randomUUID(),from:ep(a.component,a.pin),to:ep(b.component,b.pin),color:"#3867d6",points});}
const codes=(c:Circuit)=>checkCircuit(c).diagnostics.map(d=>d.code);
test("44 physical headers, duplicate power pins and reserved PSRAM pins",()=>{
 const c=emptyCircuit(),map=terminalMap(c),g=buildNets(c);assert.equal(map.size,44);assert.equal(map.get("esp32:J1.4")?.gpio,4);assert.equal(map.get("esp32:J3.10")?.gpio,38);for(const pin of["J3.11","J3.12","J3.13"])assert.equal(map.get(`esp32:${pin}`)?.role,"reserved");assert.ok(g.connected(ep("esp32","J1.1"),ep("esp32","J1.2")));assert.ok(g.connected(ep("esp32","J1.22"),ep("esp32","J3.22")));assert.ok(!g.connected(ep("esp32","J1.1"),ep("esp32","J1.21")));
});
test("breadboard groups, channel, columns, rails and split at 15/16",()=>{
 const c=fixture("breadboard"),b=(pin:string)=>ep("breadboard0",pin),g=buildNets(c);assert.ok(g.connected(b("a1"),b("e1")));assert.ok(g.connected(b("f30"),b("j30")));assert.ok(!g.connected(b("a1"),b("a2")));assert.ok(!g.connected(b("e1"),b("f1")));assert.ok(g.connected(b("tp1"),b("tp15")));assert.ok(g.connected(b("tp16"),b("tp30")));assert.ok(!g.connected(b("tp15"),b("tp16")));assert.ok(!g.connected(b("tp1"),b("tn1")));assert.ok(!g.connected(b("tp1"),b("bp1")));wire(c,b("tp15"),b("tp16"));assert.ok(buildNets(c).connected(b("tp1"),b("tp30")));
});
test("wire deletion changes connectivity without a cached netlist",()=>{
 const c=fixture("breadboard"),a=ep("esp32","J1.4"),b=ep("breadboard0","c2");wire(c,a,ep("breadboard0","a2"));assert.ok(buildNets(c).connected(a,b));c.wires=[];assert.ok(!buildNets(c).connected(a,b));
});
test("crossing and overlapping paths never create electrical joints",()=>{
 const c=fixture("led");wire(c,ep("esp32","J1.4"),ep("led0","A"),[{x:500,y:300},{x:500,y:500}]);wire(c,ep("esp32","J1.5"),ep("led0","K"),[{x:300,y:400},{x:700,y:400}]);assert.ok(!buildNets(c).connected(ep("led0","A"),ep("led0","K")));c.wires[1].points=c.wires[0].points;assert.ok(!buildNets(c).connected(ep("led0","A"),ep("led0","K")));
});
test("power short through breadboard is detected and clears after disconnection",()=>{
 const c=fixture("breadboard");wire(c,ep("esp32","J1.1"),ep("breadboard0","a6"));wire(c,ep("esp32","J1.22"),ep("breadboard0","e6"));assert.ok(codes(c).includes("power-short"));c.wires.pop();assert.ok(!codes(c).includes("power-short"));wire(c,ep("esp32","J1.1"),ep("esp32","J1.21"));assert.ok(codes(c).includes("power-short"));
});
test("button permanently joins each side and bridges both sides only while pressed",()=>{
 const c=fixture("button"),a=ep("button0","A1"),b=ep("button0","B2");assert.ok(buildNets(c).connected(a,ep("button0","A2")));assert.ok(!buildNets(c).connected(a,b));c.components[1].properties.pressed=true;assert.ok(buildNets(c).connected(a,b));wire(c,ep("esp32","J1.1"),a);wire(c,ep("esp32","J1.22"),b);assert.ok(codes(c).includes("power-short"));c.components[1].properties.pressed=false;assert.ok(!codes(c).includes("power-short"));
});
test("resistor, LED and potentiometer terminals remain separate nets",()=>{
 const c=fixture("resistor","led","potentiometer"),g=buildNets(c);for(const p of c.components.slice(1)){const ts=terminals(p);for(let i=1;i<ts.length;i++)assert.ok(!g.connected(ts[0],ts[i]));}
});
test("overvoltage, reserved pins, shared GPIO and contradictory known drivers",()=>{
 const c=fixture("resistor");wire(c,ep("esp32","J1.21"),ep("esp32","J1.4"));assert.ok(codes(c).includes("gpio-overvoltage"));c.wires=[];wire(c,ep("esp32","J3.11"),ep("resistor0","1"));assert.ok(codes(c).includes("reserved-pin"));c.wires=[];wire(c,ep("esp32","J1.4"),ep("esp32","J1.5"));assert.ok(codes(c).includes("gpio-shared"));assert.ok(!codes(c).includes("output-conflict"));assert.ok(checkCircuit(c,[{endpoint:ep("esp32","J1.4"),level:1},{endpoint:ep("esp32","J1.5"),level:0}]).diagnostics.some(d=>d.code==="output-conflict"));
});
test("LED requires series resistor; bypassed resistor is detected",()=>{
 const c=fixture("led","resistor");wire(c,ep("esp32","J1.4"),ep("led0","A"));wire(c,ep("esp32","J1.22"),ep("led0","K"));assert.ok(codes(c).includes("led-no-resistor"));c.wires.shift();wire(c,ep("esp32","J1.4"),ep("resistor1","1"));wire(c,ep("resistor1","2"),ep("led0","A"));assert.ok(!codes(c).includes("led-no-resistor"));wire(c,ep("resistor1","1"),ep("resistor1","2"));assert.ok(codes(c).includes("bypassed"));assert.ok(codes(c).includes("led-no-resistor"));
});
test("reference lesson passes; removing rail bridge exposes open path",()=>{
 const c=demoCircuit();assert.deepEqual(parseCircuit(c),c);assert.deepEqual(checkCircuit(c).diagnostics,[]);c.wires=c.wires.filter(w=>!(w.from.pin==="tn15"&&w.to.pin==="tn16"));assert.ok(!buildNets(c).connected(ep("led1","K"),ep("esp32","J1.22")));assert.ok(codes(c).includes("led-open-path"));
});
test("rotation and movement preserve identity, connectivity and attached wire endpoint",()=>{
 const c=demoCircuit(),before=[...buildNets(c).byTerminal].map(([k,n])=>[k,n.id]),old=terminalMap(c).get("esp32:J1.4")!;c.components[0].rotation=90;c.components[0].x+=100;c.components[0].y+=100;assert.deepEqual([...buildNets(c).byTerminal].map(([k,n])=>[k,n.id]),before);assert.notDeepEqual(terminalMap(c).get("esp32:J1.4"),old);assert.equal(wirePoints(c.wires[0],terminalMap(c))[0].x,terminalMap(c).get(keyOf(c.wires[0].from))!.x);
});
test("malformed endpoints, IDs, component kinds, properties and coordinates reject",()=>{
 const c=demoCircuit(),bad=(edit:(c:any)=>void)=>{const n=clone(c);edit(n);assert.throws(()=>parseCircuit(n));};bad(n=>n.wires[0].to.pin="missing");bad(n=>n.components[1].id=n.components[0].id);bad(n=>n.components[1].kind="script");bad(n=>n.components[0].x=Infinity);bad(n=>n.components[0].rotation=3);bad(n=>n.wires.push({...n.wires[0],id:"new"}));bad(n=>n.components[2].properties={resistance:Infinity});bad(n=>n.wires[0].color="url(javascript:bad)");bad(n=>n.wires[0].points=Array(25).fill({x:0,y:0}));bad(n=>n.components=n.components.filter((p:any)=>p.kind!=="board"));const n=clone(c)as any;n.components[0].properties.javascript="bad";assert.deepEqual((parseCircuit(n)as Circuit).components[0].properties,{});
});
test("schema 1 fixture migrates without loss; future versions reject",()=>{
 const p=newProject(),old={...p,schemaVersion:1,circuit:{kind:"stage0-fixture",components:[],wires:[]}},m=parseProject(old);assert.equal(m.schemaVersion,3);assert.deepEqual(m.files,p.files);assert.deepEqual(m.settings,p.settings);assert.equal(m.circuit.kind,"stage0-fixture");assert.throws(()=>parseProject({...p,schemaVersion:4}));assert.throws(()=>parseProject({...p,schemaVersion:1}));
});
test("ZIP and JSON preserve complete circuit; rejected input cannot mutate current project",()=>{
 const p=newProject();p.circuit=demoCircuit();assert.deepEqual(importProject(exportZip(p),"lesson.zip"),p);assert.deepEqual(importProject(new TextEncoder().encode(JSON.stringify(p)),"lesson.json"),p);const before=clone(p),n=clone(p)as any;n.circuit.wires[0].to.pin="invalid";assert.throws(()=>importProject(new TextEncoder().encode(JSON.stringify(n)),"bad.json"));assert.deepEqual(p,before);
});
test("autosave, reopening and immutable history preserve complete circuit",async()=>{
 const name=`circuit-${crypto.randomUUID()}`,a=await ProjectStore.open(name),p=newProject();p.circuit=demoCircuit();const first=await a.save(p,0,"Sastavljanje");a.close();const b=await ProjectStore.open(name);assert.deepEqual((await b.get(p.id))?.document.circuit,p.circuit);const n=editProject(p,n=>{if(n.circuit.kind==="editable")n.circuit.wires.pop();}),changed=await b.save(n,first.storageRevision,"Uklonjen vodič");assert.deepEqual(changed.history[0].project.circuit,p.circuit);assert.notDeepEqual(changed.document.circuit,p.circuit);b.close();
});
test("200 routed wires and maximum bend count round-trip beyond old manifest cap",()=>{
 const p=newProject(),c=demoCircuit();for(let i=0;i<30;i++)c.components.push(makePart("resistor",i*20,800,`extra${i}`));const ts=[...terminalMap(c).values()];let i=0,j=1;while(c.wires.length<200){const a=ts[i],b=ts[j++];if(j>=ts.length){i++;j=i+1;}if(!c.wires.some(w=>(keyOf(w.from)===keyOf(a)&&keyOf(w.to)===keyOf(b))||(keyOf(w.to)===keyOf(a)&&keyOf(w.from)===keyOf(b))))wire(c,a,b,Array.from({length:24},(_,k)=>({x:k*13.125,y:k*14.625})));}p.circuit=c;assert.deepEqual(importProject(exportZip(p),"large.zip"),p);
});
