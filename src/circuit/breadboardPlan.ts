import {NANO, S3} from '../boards/profiles';
import {boardOf, keyOf, localTerminals, partInfo, type Circuit, type Endpoint, type Kind, type Part, type Point} from './model';
import {buildNets} from './netlist';
import {RoutingQueue, simplifyPath} from './routing';

// Half a hole pitch is one routing cell. Only the listed sockets of a terminal
// may terminate a jumper. Moving a drawing never creates an electrical link.
export const ROWS = 'ABCDEFGHIJ';
export const ROW_Y = [20,22,24,26,28,34,36,38,40,42];
export const RAIL_Y = [12,14,48,50];
export const holeX = (firstX:number, column:number) => firstX+2*(column-1);
export type Socket = Point & {hole?:string};
export interface MountPin extends Endpoint {label:string; at:Socket; sockets:Socket[]}
export interface Mount {part:Part; pins:MountPin[]; left:number; right:number; top:number; bottom:number; scale?:number}
export interface Jumper {from:MountPin; to:MountPin; start:Socket; end:Socket; path:Point[]; crossings:Point[]; signal:string; color:string}
export interface BreadboardPlan {firstX:number; columns:30|60; width:number; minY:number; height:number; showBreadboard:boolean; mounts:Mount[]; jumpers:Jumper[]}
const inlinePins:Partial<Record<Kind,string[]>> = {
  // These are labelled teaching carriers; physical breakout orders vary.
  aht10:['VCC','GND','SDA','SCL'], bmp180:['VCC','GND','SDA','SCL'],
  bmp280:['VCC','GND','SDA','SCL'], am2320:['VCC','GND','SDA','SCL'],
  ssd1306:['VCC','GND','SDA','SCL'], ssd1306_32:['VCC','GND','SDA','SCL'],
  dht11:['VCC','DATA','NC','GND'], dht22:['VCC','DATA','NC','GND'],
  ds18b20:['GND','DQ','VDD'], lm35:['VCC','OUT','GND'],
  resistor:['1','2'], led:['A','K'], potentiometer:['1','2','3']
};
function hole(firstX:number, column:number, row:number):Socket {
  return {x:holeX(firstX,column), y:ROW_Y[row], hole:ROWS[row]+column};
}
function mountedPin(part:Part, pin:string, label:string, at:Socket, sockets:Socket[]):MountPin {
  return {component:part.id,pin,label,at,sockets};
}
function controller(part:Part, firstX:number, mountNano:boolean,margin:number):Mount {
  const profile=boardOf(part);
  if(profile.id===NANO&&mountNano){
    // Component side, USB left. The USB-end pins are D13 at D1 and D12 at H1.
    const pins=profile.pins.map(p=>{
      const col=(p.y-60)/20+1, upper=p.x>0;
      return mountedPin(part,p.id,p.label,hole(firstX,col,upper?3:7),
        (upper?[2,1,0]:[8,9]).map(row=>hole(firstX,col,row)));
    });
    return {part,pins,left:firstX-1,right:holeX(firstX,15)+1,top:ROW_Y[3],bottom:ROW_Y[7]};
  }
  return externalMount(part,margin,profile.id===S3?3:12,.1);
}
function componentOrder(c:Circuit, parts:Part[]) {
  const rest=new Set(parts), ordered:Part[]=[];
  const links=(p:Part,q:Part)=>c.wires.filter(w=>
    (w.from.component===p.id && w.to.component===q.id)||(w.from.component===q.id && w.to.component===p.id)).length;
  let last=c.components.find(p=>p.kind==='board')!;
  while(rest.size){
    const next=[...rest].sort((a,b)=>links(b,last)-links(a,last))[0];
    ordered.push(next);rest.delete(next);last=next;
  }
  return ordered;
}
function externalMount(part:Part,left:number,top:number,overrideScale?:number):Mount {
  const {width,height}=partInfo(part),scale=overrideScale??Math.min(25/width,19/height);
  const right=left+Math.ceil(width*scale),bottom=top+Math.ceil(height*scale);
  const pins=localTerminals(part).map(t=>{
    const edge=Math.min(t.x,width-t.x,t.y,height-t.y);
    let x=left+Math.round(t.x*scale),y=top+Math.round(t.y*scale);
    if(edge===t.x)x=left-1;
    else if(edge===width-t.x)x=right+1;
    else if(edge===t.y)y=top-1;
    else y=bottom+1;
    return mountedPin(part,t.pin,t.label,{x,y},[{x,y}]);
  });
  return {part,left,right,top,bottom,pins,scale};
}
function originalHoles(c:Circuit,bb:Part,firstX:number){
  const result=new Map<string,MountPin>();
  for(const w of c.wires)for(const e of [w.from,w.to]){
    if(e.component!==bb.id||result.has(keyOf(e)))continue;
    const match=/^(tp|tn|bp|bn|[a-j])(\d+)$/.exec(e.pin);
    if(!match)return;
    const col=Number(match[2]),name=match[1].toUpperCase(),rail=['TP','TN','BP','BN'].indexOf(name);
    const side=rail<0?name:['gornja +','gornja −','donja +','donja −'][rail];
    const at={x:holeX(firstX,col),y:rail<0?ROW_Y[ROWS.indexOf(name)]:RAIL_Y[rail],hole:rail<0?name+col:side+' '+col};
    result.set(keyOf(e),mountedPin(bb,e.pin,at.hole,at,[at]));
  }
  return result;
}
function mountsFor(c:Circuit, forceBoard:boolean) {
  const board=c.components.find(p=>p.kind==='board')!,profile=boardOf(board);
  const bbs=c.components.filter(p=>p.kind==='breadboard'),bb=bbs[0];
  const modules=c.components.filter(p=>p!==board&&p!==bb);
  if(bbs.length>1||(!modules.length&&!bb)||!c.wires.length||modules.length>12)return;
  const columns=bb?.properties.breadboardColumns??(bb?30:60);
  const mountNano=profile.id===NANO&&!bb;
  const boardPinsUsed=new Set(c.wires.flatMap(w=>[w.from,w.to]).filter(t=>t.component===board.id).map(t=>t.pin));
  const margin=5+boardPinsUsed.size;
  const firstX=mountNano?6:margin+Math.ceil(profile.width/10)+9;
  const original=bb?originalHoles(c,bb,firstX):new Map<string,MountPin>();
  if(!original)return;
  const usedUpper=new Set([...original.values()].filter(p=>/^[A-E]\d/.test(p.at.hole!)).map(p=>(p.at.x-firstX)/2+1));
  const mounts=[controller(board,firstX,mountNano,margin)];
  let col=mountNano?20:3, extX=mountNano?holeX(firstX,19):firstX+2;
  const hasBoard=!!bb||forceBoard||mountNano||modules.some(p=>inlinePins[p.kind]);
  for(const p of componentOrder(c,modules)){
    const order=inlinePins[p.kind], oled=p.kind==='ssd1306'||p.kind==='ssd1306_32';
    const spacing=p.kind==='resistor'?4:1,margin=oled?3:1;
    // Existing connected strips must never receive a newly placed component leg.
    const top=p.kind==='ssd1306_32'?11:oled?6:p.kind==='resistor'?16:9;
    let position=col+margin;
    if(order)while(position<=columns){
      const left=holeX(firstX,position-margin)-1,right=holeX(firstX,position+(order.length-1)*spacing+margin)+1;
      const coversSocket=[...original.values()].some(({at})=>at.y>=top-1&&at.y<=ROW_Y[0]+1&&at.x>=left&&at.x<=right);
      if(!coversSocket&&!order.some((_,i)=>usedUpper.has(position+spacing*i)))break;
      position++;
    }
    const last=position+spacing*((order?.length??1)-1);
    if(!order||last+margin>columns){
      const {width,height}=partInfo(p);
      const size=Math.ceil(height*Math.min(25/width,19/height));
      const m=externalMount(p,extX,hasBoard?1-size:18);
      mounts.push(m);extX=m.right+8;
      continue;
    }
    const labels=localTerminals(p);
    const pins=order.map((pin,i)=>{
      const n=position+spacing*i;
      return mountedPin(p,pin,labels.find(t=>t.pin===pin)!.label,hole(firstX,n,0),[1,2,3,4].map(r=>hole(firstX,n,r)));
    });
    mounts.push({part:p,pins,left:holeX(firstX,position-margin),right:holeX(firstX,last+margin),top,bottom:ROW_Y[0]});
    col=last+margin+3;
  }
  const minY=Math.min(0,...mounts.map(m=>m.top-(mountNano?6:Math.max(8,margin))));
  return {mounts,firstX,columns,original,showBreadboard:hasBoard,minY,
    width:Math.max(hasBoard?holeX(firstX,columns)+7:0,extX+2,...mounts.map(m=>m.right+12)),
    height:Math.max(hasBoard?57:0,...mounts.map(m=>m.bottom+Math.max(12,margin)))-minY};
}
function conductorGroups(c:Circuit,pins:Map<string,MountPin>) {
  const adjacent=new Map<string,Set<string>>();
  for(const w of c.wires){
    const a=keyOf(w.from),b=keyOf(w.to);
    if(!pins.has(a)||!pins.has(b))return;
    if(!adjacent.has(a))adjacent.set(a,new Set());
    if(!adjacent.has(b))adjacent.set(b,new Set());
    adjacent.get(a)!.add(b);adjacent.get(b)!.add(a);
  }
  const seen=new Set<string>(),groups:MountPin[][]=[];
  for(const first of adjacent.keys()){
    if(seen.has(first))continue;
    const nodes=[first];seen.add(first);
    for(let k=0;k<nodes.length;k++)for(const next of adjacent.get(nodes[k])!){
      if(!seen.has(next)){nodes.push(next);seen.add(next);}
    }
    groups.push(nodes.map(key=>pins.get(key)!));
  }
  return groups;
}
function netStyle(group:(Endpoint&{label:string})[],board:Part,parts:Part[]):[string,string] {
  const bp=boardOf(board).pins, names=group.map(p=>p.pin);
  const roles=group.filter(p=>p.component===board.id).map(t=>bp.find(b=>b.id===t.pin)!.role);
  if(new Set(roles.filter(x=>['ground','3v3','5v'].includes(x))).size>1)return ['Sukob napajanja','#ad2460'];
  if(roles.includes('ground'))return ['GND','#263342'];
  if(roles.includes('5v'))return ['5 V','#d72b32'];
  if(roles.includes('3v3'))return ['3,3 V','#cb6412'];
  const source=group.find(t=>t.pin==='+'&&parts.some(p=>p.id===t.component&&p.kind==='powerSupply'));
  if(source){const p=parts.find(p=>p.id===source.component)!;return [(p.properties.supplyVoltage??6).toLocaleString('hr-HR')+' V · '+p.label,'#b54b25'];}
  if(group.some(t=>t.pin==='-'&&parts.some(p=>p.id===t.component&&p.kind==='powerSupply')))return ['− izvora','#263342'];
  const buses:Record<string,string>={SDA:'#1873b8',SCL:'#8542b2',SCK:'#8542b2',MOSI:'#1873b8',MISO:'#007d80',CS:'#925b1c',DC:'#9d4782',RESET:'#4f6791',IRQ:'#737023'};
  for(const [name,color] of Object.entries(buses))if(names.includes(name))return [name,color];
  const signal=names.find(x=>['DATA','DQ','OUT','SIG'].includes(x))??group.find(t=>t.component===board.id)?.label??'Signal';
  return [signal,'#16804b'];
}
type Pair = {from:MountPin;to:MountPin;signal:string;color:string};
const distance=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
// A short spanning tree uses adjacent strips as taps. In particular, only
// one wire enters an external controller socket even on a shared I²C bus.
function makePairs(groups:MountPin[][],board:Part,firstX:number,columns:number,original:Map<string,MountPin>,c:Circuit) {
  const pairs:Pair[]=[];
  let junctionColumn=boardOf(board).id===NANO?18:2;
  let hasJunction=false;
  const usedLower=new Set([...original.values()].filter(p=>/^[F-J]\d/.test(p.at.hole!)).map(p=>(p.at.x-firstX)/2+1));
  // Mechanical contacts and rails colour a whole conductor. A pressed button
  // changes the simulation state, never the physical wiring instructions.
  const fixed=original.size?buildNets({...c,components:c.components.map(p=>p.kind==='button'?{...p,properties:{...p.properties,pressed:false}}:p)}):null;
  for(const group of groups){
    const members=fixed?.byTerminal.get(keyOf(group[0]))?.terminals;
    const [signal,color]=netStyle(members??group,board,c.components);
    // A five-hole strip can fan out three additional leads. Use one only when
    // the component sockets cannot themselves accommodate the required taps.
    let capacity=group.reduce((sum,p)=>sum+p.sockets.length,0);
    while(capacity<2*(group.length-1)){
      while(usedLower.has(junctionColumn))junctionColumn++;
      if(junctionColumn>columns)return;
      const sockets=[5,6,7,8,9].map(row=>hole(firstX,junctionColumn,row));
      group.push({component:'',pin:'F–J'+junctionColumn,label:'Razvod '+signal,at:sockets[2],sockets});
      junctionColumn+=2;capacity+=5;hasJunction=true;
    }
    const edges=group.flatMap((a,i)=>group.slice(i+1).map(b=>({a,b,d:distance(a.at,b.at)}))).sort((a,b)=>a.d-b.d);
    const set=new Map(group.map((p,i)=>[p,i])),degree=new Map<MountPin,number>();let count=0;
    for(const {a,b} of edges){
      const left=set.get(a)!,right=set.get(b)!;
      if(left===right||(degree.get(a)??0)>=a.sockets.length||(degree.get(b)??0)>=b.sockets.length)continue;
      const spare=group.filter(p=>set.get(p)===left||set.get(p)===right)
        .reduce((sum,p)=>sum+p.sockets.length-(degree.get(p)??0),0)-2;
      if(!spare&&count<group.length-2)continue;
      for(const p of group)if(set.get(p)===right)set.set(p,left);
      degree.set(a,(degree.get(a)??0)+1);degree.set(b,(degree.get(b)??0)+1);
      pairs.push({from:a,to:b,signal,color});count++;
    }
    if(count!==group.length-1)return;
  }
  return {pairs,hasJunction};
}
const horizontal=1,vertical=2,closed=3;
function routePairs(board:Omit<BreadboardPlan,'jumpers'>,pairs:Pair[]):{jumpers:Jumper[]}|{blocked:Pair} {
  const {firstX,width,minY,height,mounts}=board, cells=width*height;
  const id=(p:Point)=>(p.y-minY)*width+p.x, point=(n:number)=>({x:n%width,y:Math.floor(n/width)+minY});
  const obstacle=new Uint8Array(cells),used=new Uint8Array(cells);
  if(board.showBreadboard)for(let col=1;col<=board.columns;col++)for(const y of [...ROW_Y,...RAIL_Y])obstacle[id({x:holeX(firstX,col),y})]=1;
  for(const part of mounts)for(let y=part.top;y<=part.bottom;y++)for(let x=part.left;x<=part.right;x++)obstacle[id({x,y})]=1;
  const escapeOwner=new Map<number,MountPin>();
  for(const m of mounts)for(const pin of m.pins){
    obstacle[id(pin.at)]=1;
    if(pin.at.hole)continue;
    const {x,y}=pin.at,dx=x<=m.left?-1:x>=m.right?1:0,dy=dx?0:y<=m.top?-1:1;
    for(const step of [1,2])escapeOwner.set(id({x:x+dx*step,y:y+dy*step}),pin);
  }
  const jumpers:Jumper[]=[];
  for(const pair of pairs){
    const starts=pair.from.sockets.filter(p=>!used[id(p)]),ends=pair.to.sockets.filter(p=>!used[id(p)]);
    if(!starts.length||!ends.length)return {blocked:pair};
    const goals=new Set(ends.map(id)),queue=new RoutingQueue(),cost=new Int32Array(cells*3).fill(0x7fffffff),prev=new Int32Array(cells*3).fill(-1);
    const heuristic=(p:Point)=>Math.min(...ends.map(q=>distance(p,q)));
    for(const start of starts){const state=id(start)*3;cost[state]=0;queue.push(state,heuristic(start));}
    let finish=-1;
    while(queue.values.length){
      const {id:state,score}=queue.pop(),cell=Math.floor(state/3),dir=state%3,p=point(cell);
      if(score>cost[state]+heuristic(p))continue;
      if(goals.has(cell)){finish=state;break;}
      for(const [dx,dy,axis] of [[1,0,horizontal],[-1,0,horizontal],[0,1,vertical],[0,-1,vertical]]){
        const x=p.x+dx,y=p.y+dy;
        if(x<1||x>=width-1||y<minY+1||y>=minY+height-1)continue;
        const next=(y-minY)*width+x,trace=used[next];
        const owner=escapeOwner.get(next);
        if(owner&&owner!==pair.from&&owner!==pair.to)continue;
        if((obstacle[next]&&!goals.has(next))||trace===closed||trace===axis)continue;
        if(used[cell]&&axis!==dir)continue; // a crossover continues straight through
        const nextCost=cost[state]+1+(dir&&dir!==axis?5:0)+(trace?110:0),slot=next*3+axis;
        if(nextCost>=cost[slot])continue;
        cost[slot]=nextCost;prev[slot]=state;
        queue.push(slot,nextCost+heuristic({x,y}));
      }
    }
    if(finish<0)return {blocked:pair};
    const steps:number[]=[];
    for(let s=finish;s>=0;s=prev[s])steps.push(Math.floor(s/3));
    steps.reverse();
    const crossings:Point[]=[];
    for(let i=0;i<steps.length;i++){
      const cell=steps[i],p=point(cell);
      if(used[cell])crossings.push(p);
      const straight=i>0&&i<steps.length-1&&steps[i]-steps[i-1]===steps[i+1]-steps[i];
      const axis=straight?(Math.abs(steps[i]-steps[i-1])===1?horizontal:vertical):closed;
      used[cell]|=axis;
    }
    const start=starts.find(p=>id(p)===steps[0])!,end=ends.find(p=>id(p)===steps.at(-1))!;
    jumpers.push({...pair,start,end,path:simplifyPath(steps.map(point)),crossings});
  }
  return {jumpers};
}
export function breadboardPlan(c:Circuit,forceBoard=false):BreadboardPlan|null {
  const board=mountsFor(c,forceBoard);if(!board)return null;
  const pins=new Map(board.mounts.flatMap(m=>m.pins.map(p=>[keyOf(p),p] as const)));
  for(const [key,p] of board.original)pins.set(key,p);
  const groups=conductorGroups(c,pins);if(!groups)return null;
  const selected=makePairs(groups,board.mounts[0].part,board.firstX,board.columns,board.original,c);if(!selected)return null;
  if(selected.hasJunction&&!board.showBreadboard){
    // Make space for the distribution strips before assigning physical sockets.
    return breadboardPlan(c,true);
  }
  const {pairs}=selected;
  pairs.sort((a,b)=>distance(a.from.at,a.to.at)-distance(b.from.at,b.to.at));
  let best:Jumper[]|undefined, score=Infinity;
  const orders=[pairs,[...pairs].reverse()],tried=new Set<string>();
  for(let i=0;i<orders.length&&i<8;i++){
    const order=orders[i],signature=order.map(p=>pairs.indexOf(p)).join(',');
    if(tried.has(signature))continue;
    tried.add(signature);
    const result=routePairs(board,order);
    if('blocked' in result){
      orders.push([result.blocked,...order.filter(p=>p!==result.blocked)]);
      continue;
    }
    const {jumpers}=result;
    const quality=jumpers.reduce((total,j)=>total+j.crossings.length*10000+j.path.length*5+j.path.slice(1).reduce((n,p,i)=>n+distance(p,j.path[i]),0),0);
    if(quality<score){best=jumpers;score=quality;}
    const crossings=jumpers.reduce((n,j)=>n+j.crossings.length,0);
    if(!crossings)break;
    if(crossings>2&&i<4){
      const conflictOrder=jumpers.map((j,k)=>({pair:order[k],crossings:j.crossings.length})).sort((a,b)=>b.crossings-a.crossings);
      orders.push(conflictOrder.map(w=>w.pair));
    }
  }
  if(!best)return null;
  const {original,...drawing}=board;
  return {...drawing,jumpers:best};
}
