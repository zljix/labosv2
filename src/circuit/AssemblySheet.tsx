import {useId, useMemo, useState} from 'react';
import {boardOf, deviceAddress, localTerminals, moduleVoltage, type Circuit, type Point} from './model';
import {ROW_Y, ROWS, RAIL_Y, holeX, type BreadboardPlan, type Mount, type MountPin, type Socket} from './breadboardPlan';
import {routedPath} from './routing';
import PartBody from './PartBody';
import {PixelDisplay} from './PeripheralViews';
import type {SimulationFrame} from './compile';
import './assemblySheet.css';

const px=(p:Point)=>({x:p.x*10,y:p.y*10});
const ink='#1f3949',silver='#becbd0',pcb='#176b7a';
function Breadboard({firstX,columns,pattern}:{firstX:number;columns:number;pattern:string}){
  const x=firstX*10,last=holeX(firstX,columns)*10,mid=(x+last)/2;
  return <g aria-hidden="true">
    <defs><pattern id={pattern} width="20" height="20" patternUnits="userSpaceOnUse" x={x-10} y="10">
      <rect x="6" y="6" width="8" height="8" rx="1.5" fill="#aab3b3"/><rect x="7.6" y="7.6" width="4.8" height="4.8" rx=".8" fill="#596466"/>
    </pattern></defs>
    <rect x={x-34} y="95" width={last-x+68} height="432" rx="12" fill="#f3f3ef" stroke="#b6c1c3" strokeWidth="2"/>
    <rect x={x-14} y="295" width={last-x+28} height="29" rx="7" fill="#dde0da"/>
    {[...RAIL_Y,...ROW_Y].map(y=><rect key={y} x={x-8} y={y*10-8} width={last-x+16} height="16" fill={'url(#'+pattern+')'}/>)}
    {[104,154,464,514].map((y,i)=><g key={y} stroke={i%2?'#5c789a':'#bd484e'} fill="none" strokeWidth="2">
      <path d={`M${x-10} ${y} H${mid-9} M${mid+9} ${y} H${last+10}`}/>
      <text x={x-22} y={y+3} fill={i%2?'#476583':'#ac353e'} stroke="none" fontSize="14" textAnchor="middle">{i%2?'−':'+'}</text>
    </g>)}
    {[169,454].map(y=><g key={y} fill="#475c65" fontSize="10" textAnchor="middle">
      {Array.from({length:columns},(_,i)=><text key={i} x={x+i*20} y={y} fontWeight={i===0||(i+1)%5===0?700:400}>{i+1}</text>)}
    </g>)}
    {ROW_Y.map((y,i)=><g key={y} fill="#445a63" fontSize="12" fontWeight="650" textAnchor="middle">
      <text x={x-22} y={y*10+4}>{ROWS[i]}</text><text x={last+22} y={y*10+4}>{ROWS[i]}</text>
    </g>)}
  </g>;
}
function MountedNano({mount:m}:{mount:Mount}){
  const x=m.left*10,y=m.top*10,w=(m.right-m.left)*10,h=(m.bottom-m.top)*10,cx=x+w/2,cy=y+h/2;
  return <g>
    <rect x={x} y={y} width={w} height={h} rx="9" fill={pcb} stroke="#194854" strokeWidth="3"/>
    <rect x={x-11} y={cy-20} width="35" height="40" rx="4" fill={silver} stroke="#677c83" strokeWidth="2"/>
    <path d={`M${x-5} ${cy-12}v24m6-24v24`} stroke="#5d6b73" strokeWidth="3"/>
    <path d={`M${x+35} ${cy-18}h33l10-10h18m-60 42h43l8 8h14`} fill="none" stroke="#479491" strokeWidth="2"/>
    <g transform={`translate(${cx-22} ${cy}) rotate(45)`}>
      {[-1,1].map(side=><g key={side}>{[-14,-10,-6,-2,2,6,10,14].map(n=><path key={n} d={`M${n} ${side*18}v${side*5}M${side*18} ${n}h${side*5}`} stroke="#b7bdba" strokeWidth="2"/>)}</g>)}
      <rect x="-18" y="-18" width="36" height="36" rx="2" fill="#253440"/><circle cx="-12" cy="-12" r="2" fill="#809093"/>
    </g>
    <text x={cx+69} y={cy-1} fill="white" textAnchor="middle" fontSize="16" fontWeight="700">NANO</text>
    <text x={cx+69} y={cy+13} fill="#d3e6e8" textAnchor="middle" fontSize="8.5">ATmega328P</text>
    <text x={x+26} y={cy+4} fill="#e2ecec" fontSize="9">USB</text>
    {m.pins.map(p=>{const a=px(p.at);return <g key={p.pin}><title>{[m.part.label,p.pin,p.at.hole].join(' · ')}</title>
      <circle cx={a.x} cy={a.y} r="4.4" fill="#263c45" stroke="#d7c899" strokeWidth="2"/>
      <text x={a.x} y={a.y+(p.at.y===m.top?15:-10)} textAnchor="middle" fill="#f3f5ef" fontSize="8.5">{p.label}</text></g>;})}
  </g>;
}
function ModuleBody({mount:m,simulation}:{mount:Mount;simulation?:SimulationFrame}){
  const p=m.part,x=m.left*10,y=m.top*10,w=(m.right-m.left)*10,h=(m.bottom-m.top)*10,cx=x+w/2,cy=y+h/2;
  if(p.kind==='board'&&!m.scale)return <MountedNano mount={m}/>;
  if(m.scale){
    const pins=localTerminals(p),scale=m.scale*10;
    return <g><g transform={`translate(${x} ${y}) scale(${scale})`}><PartBody p={p} simulation={simulation} brightness={simulation?.leds[p.id]?.brightness}/></g>
      {m.pins.map((pin,i)=><g key={pin.pin}><line x1={x+pins[i].x*scale} y1={y+pins[i].y*scale} x2={pin.at.x*10} y2={pin.at.y*10} stroke="#76858a" strokeWidth="2"/>
        <circle cx={pin.at.x*10} cy={pin.at.y*10} r="3" fill="#596870"><title>{p.label+' · '+pin.label}</title></circle></g>)}</g>;
  }
  const oled=p.kind==='ssd1306'||p.kind==='ssd1306_32',dht=p.kind==='dht11'||p.kind==='dht22';
  const discrete=p.kind==='led'||p.kind==='resistor'||p.kind==='ds18b20'||p.kind==='lm35';
  const displayHeight=p.kind==='ssd1306'?64:32,displayScale=Math.min((w-18)/128,(h-50)/displayHeight);
  return <g>
    {m.pins.map(pin=><path key={pin.pin} d={`M${pin.at.x*10} ${m.bottom*10} v-25`} stroke="#86949a" strokeWidth="4"/>)}
    {oled?<><rect x={x} y={y} width={w} height={h-7} rx="6" fill="#284576"/><rect x={x+7} y={y+8} width={w-14} height={h-46} rx="3" fill="#101e29"/>
      <g transform={`translate(${cx-64*displayScale} ${y+10}) scale(${displayScale})`}><PixelDisplay height={p.kind==='ssd1306'?64:32} bytes={simulation?.displays[p.id]?.bytes} contrast={simulation?.displays[p.id]?.contrast}/></g>
    </>:dht?<><rect x={x+4} y={y} width={w-8} height={h-18} rx="5" fill={p.kind==='dht11'?'#529cc2':'#dadfd8'} stroke="#54737e" strokeWidth="2"/>
      {Array.from({length:5},(_,i)=><path key={i} d={`M${x+13} ${y+10+i*12}h${w-26}`} stroke="#3c5a65" strokeWidth="4" strokeDasharray="9 5"/>)}</>
    :p.kind==='resistor'?<><path d={`M${m.pins[0].at.x*10} ${m.bottom*10-8}v-14H${m.pins[1].at.x*10}v14`} fill="none" stroke="#929e9d" strokeWidth="3"/>
      <rect x={cx-25} y={cy-9} width="50" height="16" rx="6" fill="#d5bc8c" stroke="#967b50"/></>
    :p.kind==='led'?<><path d={`M${cx-17} ${m.bottom*10-24}v-24a17 17 0 0 1 34 0v24z`} fill={p.properties.color??'red'} opacity={simulation?0.35+0.65*(simulation.leds[p.id]?.brightness??0):0.85}/></>
    :p.kind==='potentiometer'?<><rect x={x+2} y={y+15} width={w-4} height={h-36} rx="5" fill="#365b70"/><circle cx={cx} cy={cy-3} r={Math.min(21,w/2-4)} fill="#c0c6c7" stroke="#4b5558" strokeWidth="3"/><path d={`M${cx} ${cy-4}v-14`} stroke="#4b5558" strokeWidth="3"/></>
    :discrete?<path d={`M${x+8} ${m.bottom*10-21}v-30q0-26 ${w/2-8}-26t${w/2-8} 26v30z`} fill="#35404a"/>
    :<><rect x={x} y={y} width={w} height={h-7} rx="6" fill="#317e84" stroke="#235c66" strokeWidth="2"/>
      <circle cx={x+10} cy={y+10} r="5" fill="#dae2df" stroke="#a5b5b6" strokeWidth="2"/>
      {p.kind==='bmp180'||p.kind==='bmp280'?<><rect x={cx-16} y={cy-22} width="32" height="25" rx={p.kind==='bmp180'?8:3} fill="#c7cfcd" stroke="#718187" strokeWidth="2"/>
        <circle cx={cx+5} cy={cy-10} r="2.5" fill="#445357"/><path d={`M${x+12} ${cy+9}h12m5 0h7`} stroke="#c9b990" strokeWidth="5"/></>
      :<><rect x={cx-16} y={cy-23} width="32" height="29" rx="3" fill={p.kind==='am2320'?'#e0e4d6':'#ced3cb'}/>
        <path d={`M${cx-10} ${cy-16}h20m-20 6h20m-20 6h20`} stroke="#82918c" strokeWidth="3"/></>}</>}
    {!dht&&!discrete&&p.kind!=='potentiometer'&&<text x={cx} y={m.bottom*10-29} textAnchor="middle" fill="#e4eeed" fontSize="10">
      {moduleVoltage(p).toLocaleString('hr-HR')} V · 0x{deviceAddress(p).toString(16).toUpperCase()}</text>}
    {m.pins.map(pin=><g key={pin.pin}><title>{[p.label,pin.label,pin.at.hole].join(' · ')}</title>
      <text x={pin.at.x*10} y={pin.at.y*10-11} fill={dht||discrete||p.kind==='potentiometer'?ink:'#fff'} textAnchor="middle" fontSize="8.5" fontWeight="650">{pin.pin}</text>
      <circle cx={pin.at.x*10} cy={pin.at.y*10} r="3.7" fill="#63747a" stroke="#d3c393" strokeWidth="1.5"/></g>)}
  </g>;
}
function captions(plan:BreadboardPlan,c:Circuit){
  type Box={left:number;top:number;right:number;bottom:number};
  const boxes:Box[]=plan.mounts.map(m=>({left:m.left*10,top:m.top*10,right:m.right*10,bottom:m.bottom*10}));
  for(const j of plan.jumpers)for(let i=1;i<j.path.length;i++){
    const a=px(j.path[i-1]),b=px(j.path[i]);
    boxes.push({left:Math.min(a.x,b.x)-4,right:Math.max(a.x,b.x)+4,top:Math.min(a.y,b.y)-4,bottom:Math.max(a.y,b.y)+4});
  }
  return plan.mounts.filter(m=>m.part.kind!=='board').map(m=>{
    const part=c.components.find(p=>p.id===m.part.id)!,name=part.kind==='resistor'?part.properties.resistance+' Ω':part.label;
    const max=Math.max(9,Math.floor((m.right-m.left+5)*10/7)),text=name.length>max?name.slice(0,max-1)+'…':name;
    const center=(m.left+m.right)*5,half=text.length*3.9;
    const positions=[10,24,38,52].flatMap(d=>[0,-14,14].map(dx=>({x:center+dx,y:m.top*10-d})));
    const box=(p:Point)=>({left:p.x-half,right:p.x+half,top:p.y-13,bottom:p.y+3});
    const position=positions.find(p=>{const a=box(p);return a.top>=plan.minY*10&&!boxes.some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top);})??positions[0];
    boxes.push(box(position));return {id:part.id,text,name,...position};
  });
}
const pinText=(p:MountPin,labels:Map<string,string>)=>
  p.component?(labels.get(p.component)+(p.sockets.length===1&&p.at.hole?'':' · '+p.label)+((p.pin.startsWith('J')||p.pin.startsWith('GND')||p.pin.startsWith('RST'))&&p.pin!==p.label?' ('+p.pin+')':'')):p.label;
const socketText=(s:Socket)=>s.hole??'';
export function AssemblySheet({plan,circuit,simulation}:{plan:BreadboardPlan;circuit:Circuit;simulation?:SimulationFrame}){
  const pattern=useId(),[zoom,setZoom]=useState(1),[whole,setWhole]=useState(false),[selected,setSelected]=useState<number|null>(null),[signal,setSignal]=useState<string|null>(null);
  const labelKey=JSON.stringify(circuit.components.map(p=>[p.label,p.properties.resistance]));
  const printedLabels=useMemo(()=>captions(plan,circuit),[plan,labelKey]);
  const labels=new Map(circuit.components.map(p=>[p.id,p.label]));
  const data=plan.jumpers.map(j=>({...j,fromText:pinText(j.from,labels),toText:pinText(j.to,labels)}));
  const activeX=Math.max(...plan.mounts.map(m=>m.right),...plan.jumpers.flatMap(j=>j.path.map(p=>p.x)))+5;
  const width=(whole?plan.width:Math.min(plan.width,Math.max(activeX,40)))*10;
  const legend=[...new Map(plan.jumpers.map(j=>[j.signal,j.color])).entries()];
  const select=(i:number)=>{setSignal(null);setSelected(selected===i?null:i);};
  return <figure className="assembly-sheet">
    <div className="sheet-heading"><strong>{plan.showBreadboard?'Montažna pločica A–J · 1–'+plan.columns:'Izravni spojevi'}</strong><div>
      {plan.showBreadboard&&<button aria-pressed={whole} onClick={()=>{setWhole(!whole);setZoom(1);}}>{whole?'Prikaži sklop':'Cijela pločica'}</button>}
      <button aria-label="Umanji montažnu shemu" disabled={zoom<=1} onClick={()=>setZoom(Math.max(1,zoom-.5))}>−</button>
      <button aria-label="Povećaj montažnu shemu" disabled={zoom>=4} onClick={()=>setZoom(Math.min(4,zoom+.5))}>+</button>
    </div></div>
    <div className="sheet-scroll" tabIndex={0} aria-label="Montažna shema, pomicanje uvećanog prikaza">
      <svg viewBox={`0 ${plan.minY*10} ${width} ${plan.height*10}`} style={{width:`${zoom*100}%`}} role="img" aria-label={'Montažna shema spojeva · '+boardOf(plan.mounts[0].part).short}>
        {plan.showBreadboard&&<Breadboard firstX={plan.firstX} columns={plan.columns} pattern={pattern}/>}
        {plan.mounts.map(m=><ModuleBody key={m.part.id} mount={{...m,part:circuit.components.find(p=>p.id===m.part.id)!}} simulation={simulation}/>)}
        {data.map((j,i)=>{
          const d=routedPath(j.path.map(px),j.crossings.map(px)),name=j.fromText+' → '+j.toText+' · '+j.signal;
          return <g key={i} className="assembly-wire" opacity={(selected!==null&&selected!==i)||(signal!==null&&signal!==j.signal)?.16:1} onClick={()=>select(i)}><title>{name}</title>
            <path d={d} stroke="transparent" strokeWidth="15" fill="none"/>
            <path d={d} stroke="#fff" strokeWidth="7" fill="none" strokeLinejoin="round" pointerEvents="none"/>
            <path d={d} stroke={j.color} strokeWidth={selected===i?5.5:4} fill="none" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none"/>
            {[j.start,j.end].map((s,k)=><circle key={k} cx={s.x*10} cy={s.y*10} r="5.3" fill={j.color} stroke="#fff" strokeWidth="1.6"/>)}</g>;
        })}
        {printedLabels.map(p=><text key={p.id} x={p.x} y={p.y} textAnchor="middle" className="mount-caption"><title>{p.name}</title>{p.text}</text>)}
      </svg>
    </div>
    <figcaption>
      <div className="sheet-key">{legend.map(([name,color])=><button key={name} aria-pressed={signal===name} aria-label={"Istakni vodove "+name} onClick={()=>{setSelected(null);setSignal(signal===name?null:name);}}><i style={{background:color}}/>{name}</button>)}</div>
      <p>Puna točka označuje kraj vodiča. Mostić ili prekid crte označuje križanje bez spoja.{plan.showBreadboard&&' U svakom stupcu povezane su rupice A–E i zasebno F–J.'}</p>
    </figcaption>
    <details className="sheet-connections"><summary>Tablica spajanja · {plan.jumpers.length} vodiča</summary>
      {plan.showBreadboard&&<p>Uz priključak je navedena rupica za žicu. Izvodi umetnutih komponenti navedeni su ispod tablice. Redoslijed izvoda fizičkog modula provjeri prema njegovim oznakama.</p>}
      <table><thead><tr><th>Vod</th><th>Od priključka</th><th>Do priključka</th></tr></thead>
        <tbody>{data.map((j,i)=><tr key={i} className={selected===i?'chosen':''}><td><button onClick={()=>select(i)} aria-pressed={selected===i} aria-label={'Istakni vodič '+(i+1)+' · '+j.signal}><i style={{background:j.color}}/>{j.signal}</button></td>
          <td>{j.fromText} <b>{socketText(j.start)}</b></td><td>{j.toText} <b>{socketText(j.end)}</b></td></tr>)}</tbody></table>
      {plan.showBreadboard&&<dl>{plan.mounts.filter(m=>m.pins[0]?.at.hole).map(m=><div key={m.part.id}><dt>{labels.get(m.part.id)}</dt><dd>{m.part.kind==='board'?'D1–D15 i H1–H15 · USB prema stupcu 1':m.pins.map(p=>p.pin+' '+p.at.hole).join(' · ')}</dd></div>)}</dl>}
    </details>
  </figure>;
}
