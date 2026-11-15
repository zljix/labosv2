import {keyOf,partInfo,terminalMap,wirePoints,worldPoint,type Circuit,type Part,type Point,type Terminal,type Wire} from './model';

// Routing changes drawing geometry only. Electrical connections always use the
// original endpoint IDs, including when two paths cross on the screen.
const EPS=1e-5,LANE=12,CLEARANCE=12,PIN_CLEARANCE=6,TRACE_CLEARANCE=8,INF=Number.POSITIVE_INFINITY;
type Rect={left:number;right:number;top:number;bottom:number};
type Segment={a:Point;b:Point;wire:Wire};
type Port={terminal:Terminal;point:Point};
export interface WireCrossing {point:Point;first:string;second:string}
export interface WireLayout {paths:Map<string,Point[]>;crossings:WireCrossing[];overlaps:number;blocked:string[]}
// Sensor values and simulation frames do not change routing geometry.
export const routingGeometry=(c:Circuit)=>JSON.stringify([c.components.map(p=>[p.id,p.kind,p.x,p.y,p.rotation,p.properties.boardProfileId,p.properties.breadboardColumns]),c.wires.map(w=>[w.id,w.from,w.to,w.points])]);
const equal=(a:Point,b:Point)=>Math.abs(a.x-b.x)<EPS&&Math.abs(a.y-b.y)<EPS;
const distance=(a:Point,b:Point)=>Math.hypot(a.x-b.x,a.y-b.y);
const manhattan=(a:Point,b:Point)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const cross=(a:Point,b:Point)=>a.x*b.y-a.y*b.x;
const difference=(a:Point,b:Point)=>({x:a.x-b.x,y:a.y-b.y});
const segments=(points:Point[],wire:Wire):Segment[]=>points.slice(1).flatMap((b,i)=>equal(points[i],b)?[]:[{a:points[i],b,wire}]);

export function partBounds(p:Part):Rect {
 const {width,height}=partInfo(p),corners=[{x:0,y:0},{x:width,y:0},{x:0,y:height},{x:width,y:height}].map(pt=>worldPoint(p,pt));
 return {left:Math.min(...corners.map(p=>p.x)),right:Math.max(...corners.map(p=>p.x)),top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))};
}
const inflate=(r:Rect,n:number):Rect=>({left:r.left-n,right:r.right+n,top:r.top-n,bottom:r.bottom+n});
function normal(t:Terminal,p:Part):Point {
 const r=partBounds(p);
 // Breadboard holes are accessible from above; its surface can carry jumpers.
 if(p.kind==='breadboard')return {x:0,y:t.y<(r.top+r.bottom)/2?-1:1};
 const edges=[{d:Math.abs(t.x-r.left),x:-1,y:0},{d:Math.abs(t.x-r.right),x:1,y:0},{d:Math.abs(t.y-r.top),x:0,y:-1},{d:Math.abs(t.y-r.bottom),x:0,y:1}];
 edges.sort((a,b)=>a.d-b.d);return {x:edges[0].x,y:edges[0].y};
}
export function simplifyPath(points:Point[]):Point[] {
 const out:Point[]=[];
 for(const p of points){if(out.length&&equal(out[out.length-1],p))continue;
  while(out.length>1){const a=out[out.length-2],b=out[out.length-1],ab=difference(b,a),bp=difference(p,b);if(Math.abs(cross(ab,bp))>EPS||ab.x*bp.x+ab.y*bp.y<0)break;out.pop();}
  out.push({x:p.x,y:p.y});
 }return out;
}
// Liang–Barsky against the open rectangle: following its boundary is allowed.
function hitsRect(a:Point,b:Point,r:Rect):boolean {
 let lo=0,hi=1;
 for(const [start,delta,min,max] of [[a.x,b.x-a.x,r.left+EPS,r.right-EPS],[a.y,b.y-a.y,r.top+EPS,r.bottom-EPS]]){
  if(Math.abs(delta)<EPS){if(start<=min||start>=max)return false;}
  else {const u=(min-start)/delta,v=(max-start)/delta;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return false;}
 }return hi>=0&&lo<=1;
}
function intersection(a:Point,b:Point,c:Point,d:Point):{point?:Point;overlap?:number} {
 const r=difference(b,a),s=difference(d,c),q=difference(c,a),den=cross(r,s);
 if(Math.abs(den)<EPS){
  if(Math.abs(cross(q,r))>EPS)return {};
  const length=distance(a,b);if(length<EPS)return {};
  const axis=Math.abs(r.x)>Math.abs(r.y)?'x':'y';
  const overlap=Math.min(Math.max(a[axis],b[axis]),Math.max(c[axis],d[axis]))-Math.max(Math.min(a[axis],b[axis]),Math.min(c[axis],d[axis]));
  return overlap>EPS?{overlap:overlap*length/Math.abs(r[axis])}:{};
 }
 const t=cross(q,s)/den,u=cross(q,r)/den;
 return t>=-EPS&&t<=1+EPS&&u>=-EPS&&u<=1+EPS?{point:{x:a.x+t*r.x,y:a.y+t*r.y}}:{};
}
function sharedPin(w:Wire,v:Wire,p:Point,map:Map<string,Terminal>):boolean {
 return [w.from,w.to].some(a=>[v.from,v.to].some(b=>keyOf(a)===keyOf(b)&&map.has(keyOf(a))&&equal(map.get(keyOf(a))!,p)));
}
// Cache obstacle slices: a BB60 has 840 holes, but only a few intersect a
// particular row or column of the visibility grid.
function obstacleChecker(rects:Rect[]) {
 const rows=new Map<number,Rect[]>(),columns=new Map<number,Rect[]>();
 return (a:Point,b:Point)=>{
  const horizontal=Math.abs(a.y-b.y)<EPS,vertical=Math.abs(a.x-b.x)<EPS;
  if(!horizontal&&!vertical)return rects.some(r=>hitsRect(a,b,r));
  const cache=horizontal?rows:columns,key=horizontal?a.y:a.x;
  let slice=cache.get(key);
  if(!slice){slice=rects.filter(r=>horizontal?key>r.top+EPS&&key<r.bottom-EPS:key>r.left+EPS&&key<r.right-EPS);cache.set(key,slice);}
  return slice.some(r=>hitsRect(a,b,r));
 };
}
function edgeCost(a:Point,b:Point,hitsObstacle:(a:Point,b:Point)=>boolean,used:Segment[],w:Wire,map:Map<string,Terminal>,strict:boolean,separate:boolean):number {
 if(hitsObstacle(a,b))return INF;
 let cost=distance(a,b);
 for(const s of used){
  const hit=intersection(a,b,s.a,s.b);
  if(hit.overlap)return INF;
  if(hit.point&&!sharedPin(w,s.wire,hit.point,map)){if(strict)return INF;cost+=2400;}
  // Keep parallel traces visibly apart, including paths just off the grid.
  if(Math.abs(a.y-b.y)<EPS&&Math.abs(s.a.y-s.b.y)<EPS){const gap=Math.abs(a.y-s.a.y);if(gap>EPS&&gap<LANE-EPS&&Math.min(Math.max(a.x,b.x),Math.max(s.a.x,s.b.x))-Math.max(Math.min(a.x,b.x),Math.min(s.a.x,s.b.x))>EPS){if(separate&&gap<TRACE_CLEARANCE-EPS)return INF;cost+=(LANE-gap)*120;}}
  if(Math.abs(a.x-b.x)<EPS&&Math.abs(s.a.x-s.b.x)<EPS){const gap=Math.abs(a.x-s.a.x);if(gap>EPS&&gap<LANE-EPS&&Math.min(Math.max(a.y,b.y),Math.max(s.a.y,s.b.y))-Math.max(Math.min(a.y,b.y),Math.min(s.a.y,s.b.y))>EPS){if(separate&&gap<TRACE_CLEARANCE-EPS)return INF;cost+=(LANE-gap)*120;}}
 }return cost;
}
class Heap {
 values:{id:number;score:number}[]=[];
 push(id:number,score:number){const a=this.values;let i=a.length;a.push({id,score});while(i){const p=(i-1)>>1;if(a[p].score<=score)break;a[i]=a[p];i=p;}a[i]={id,score};}
 pop(){const a=this.values,first=a[0],last=a.pop()!;if(a.length){let i=0;while(i*2+1<a.length){let child=i*2+1;if(child+1<a.length&&a[child+1].score<a[child].score)child++;if(a[child].score>=last.score)break;a[i]=a[child];i=child;}a[i]=last;}return first;}
}
function route(start:Point,end:Point,rects:Rect[],used:Segment[],wire:Wire,map:Map<string,Terminal>,ports:Point[],strict:boolean,channels:Point[]=[],separate=strict):Point[]|null {
 const hitsObstacle=obstacleChecker(rects);
 if(hitsObstacle(start,start)||hitsObstacle(end,end))return null;
 const xs=new Set<number>([start.x,end.x]),ys=new Set<number>([start.y,end.y]);
 const add=(p:Point)=>{xs.add(p.x);ys.add(p.y);};
 for(const p of ports){add(p);add({x:p.x-LANE,y:p.y-LANE});add({x:p.x+LANE,y:p.y+LANE});}
 for(const p of channels)add(p);
 for(const r of rects){add({x:r.left,y:r.top});add({x:r.right,y:r.bottom});}
 for(const s of used)for(const p of [s.a,s.b]){add({x:p.x-LANE,y:p.y-LANE});add({x:p.x+LANE,y:p.y+LANE});}
 const xv=[...xs].sort((a,b)=>a-b),yv=[...ys].sort((a,b)=>a-b);
 // Include an outer channel, even for circuits with no solid component body.
 xv.unshift(xv[0]-LANE*3);xv.push(xv[xv.length-1]+LANE*3);yv.unshift(yv[0]-LANE*3);yv.push(yv[yv.length-1]+LANE*3);
 const score=(points:Point[])=>{let cost=Math.max(0,points.length-2)*18;for(let i=1;i<points.length;i++)cost+=edgeCost(points[i-1],points[i],hitsObstacle,used,wire,map,strict,separate);return cost;};
 let best:Point[]|null=null,bestCost=INF;
 const consider=(points:Point[])=>{const p=simplifyPath(points),cost=score(p);if(cost<bestCost){best=p;bestCost=cost;}};
 for(const x of xv)consider([start,{x,y:start.y},{x,y:end.y},end]);
 for(const y of yv)consider([start,{x:start.x,y},{x:end.x,y},end]);
 // Most connections need at most two bends; avoid a graph search for those.
 if(best&&bestCost<manhattan(start,end)+500)return best;
 const width=xv.length,height=yv.length,count=width*height;
 const origin=yv.indexOf(start.y)*width+xv.indexOf(start.x),target=yv.indexOf(end.y)*width+xv.indexOf(end.x);
 const costs=new Float64Array(count*3).fill(INF),previous=new Int32Array(count*3).fill(-1),heap=new Heap(),cache=new Map<string,number>();
 costs[origin*3]=0;heap.push(origin*3,manhattan(start,end));
 let iterations=0,finish=-1;
 while(heap.values.length&&iterations++<45000){
  const {id,score:priority}=heap.pop(),node=Math.floor(id/3),dir=id%3,x=node%width,y=Math.floor(node/width),p={x:xv[x],y:yv[y]};
  if(priority>costs[id]+manhattan(p,end)+EPS)continue;
  if(node===target){finish=id;break;}
  for(const [nx,ny,nd]of [[x-1,y,1],[x+1,y,1],[x,y-1,2],[x,y+1,2]]){
   if(nx<0||ny<0||nx>=width||ny>=height)continue;
   const next=ny*width+nx,key=node<next?`${node}:${next}`:`${next}:${node}`;
   let edge=cache.get(key);if(edge===undefined){edge=edgeCost(p,{x:xv[nx],y:yv[ny]},hitsObstacle,used,wire,map,strict,separate);cache.set(key,edge);}
   const cost=costs[id]+edge+(dir&&dir!==nd?18:0),state=next*3+nd;
   if(cost>=costs[state])continue;costs[state]=cost;previous[state]=id;heap.push(state,cost+manhattan({x:xv[nx],y:yv[ny]},end));
  }
 }
 if(finish<0||costs[finish]>=bestCost)return best;
 const points:Point[]=[];for(let id=finish;id>=0;id=previous[id]){const n=Math.floor(id/3);points.push({x:xv[n%width],y:yv[Math.floor(n/width)]});}
 return simplifyPath(points.reverse());
}

function routeAttempt(c:Circuit,map:Map<string,Terminal>,order?:string[],allowCrossings=false,preferFree=false):WireLayout {
 const paths=new Map<string,Point[]>(),blocked:string[]=[],parts=new Map(c.components.map(p=>[p.id,p])),groups=new Map<string,{wire:Wire;other:Terminal}[]>(),ports=new Map<string,Port>();
 const bodies=c.components.filter(p=>p.kind!=='breadboard').map(p=>inflate(partBounds(p),CLEARANCE));
 for(const w of c.wires)for(const [a,b]of [[w.from,w.to],[w.to,w.from]]){const t=map.get(keyOf(a)),other=map.get(keyOf(b));if(!t||!other)continue;const key=keyOf(a);groups.set(key,[...(groups.get(key)??[]),{wire:w,other}]);}
 for(const [key,group]of groups){const t=map.get(key)!,p=parts.get(t.component)!,n=normal(t,p),tangent={x:-n.y,y:n.x};
  group.sort((a,b)=>(a.other.x-t.x)*tangent.x+(a.other.y-t.y)*tangent.y-((b.other.x-t.x)*tangent.x+(b.other.y-t.y)*tangent.y)||a.wire.id.localeCompare(b.wire.id));
  group.forEach(({wire},i)=>{const offset=(i-(group.length-1)/2)*LANE,reach=CLEARANCE+LANE+Math.abs(offset)*.3;ports.set(`${wire.id}|${key}`,{terminal:t,point:p.kind==='breadboard'?{x:t.x,y:t.y}:{x:t.x+n.x*reach+tangent.x*offset,y:t.y+n.y*reach+tangent.y*offset}});});
 }
 const used:Segment[]=[];
 // Explicit user bends stay fixed and reserve their channels first.
 for(const w of c.wires.filter(w=>w.points.length)){const pts=wirePoints(w,map);paths.set(w.id,pts);used.push(...segments(pts,w));}
 const automatic=c.wires.filter(w=>!w.points.length).sort((a,b)=>{
  if(order)return order.indexOf(a.id)-order.indexOf(b.id);
  const length=(w:Wire)=>{const x=map.get(keyOf(w.from)),y=map.get(keyOf(w.to));return x&&y?manhattan(x,y):0;};return length(a)-length(b)||a.id.localeCompare(b.id);
 });
 const allPorts=[...ports.values()].map(p=>p.point),channels:Point[]=[];
 // Preserve fine escape channels beside closely spaced board headers.
 if(allowCrossings&&!preferFree)for(const key of groups.keys()){const t=map.get(key)!;channels.push({x:t.x-5,y:t.y-5},{x:t.x+5,y:t.y+5});}
 const leads=automatic.flatMap(w=>[w.from,w.to].flatMap(e=>{const p=ports.get(`${w.id}|${keyOf(e)}`);return p?segments([p.terminal,p.point],w):[];}));
 for(const w of automatic){
  const a=ports.get(`${w.id}|${keyOf(w.from)}`),b=ports.get(`${w.id}|${keyOf(w.to)}`);
  if(!a||!b){paths.set(w.id,[]);blocked.push(w.id);continue;}
  // Unused pins and holes must stay readable too, as in Fritzing Optimizer.
  const rects=[...bodies,...[...map.entries()].filter(([k,t])=>k!==keyOf(w.from)&&k!==keyOf(w.to)&&!bodies.some(r=>t.x-PIN_CLEARANCE>=r.left&&t.x+PIN_CLEARANCE<=r.right&&t.y-PIN_CLEARANCE>=r.top&&t.y+PIN_CLEARANCE<=r.bottom)).map(([,t])=>({left:t.x-PIN_CLEARANCE,right:t.x+PIN_CLEARANCE,top:t.y-PIN_CLEARANCE,bottom:t.y+PIN_CLEARANCE}))];
  const reserved=[...used,...leads.filter(s=>s.wire.id!==w.id)];
  const middle=(preferFree?route(a.point,b.point,rects,reserved,w,map,allPorts,true):null)??route(a.point,b.point,rects,reserved,w,map,allPorts,!allowCrossings,channels,!allowCrossings||preferFree);
  const pts=simplifyPath([a.terminal,...(middle??[a.point,b.point]),b.terminal]);
  if(!middle)blocked.push(w.id);
  paths.set(w.id,pts);if(middle)used.push(...segments(pts,w));
 }
 const crossings:WireCrossing[]=[];let overlaps=0;
 for(let i=0;i<c.wires.length;i++)for(let j=0;j<i;j++){
  const w=c.wires[i],v=c.wires[j];let overlap=false;const seen:Point[]=[];
  for(const a of segments(paths.get(w.id)??[],w))for(const b of segments(paths.get(v.id)??[],v)){
   const hit=intersection(a.a,a.b,b.a,b.b);if(hit.overlap)overlap=true;
   if(hit.point&&!sharedPin(w,v,hit.point,map)&&!seen.some(p=>equal(p,hit.point!))){seen.push(hit.point);crossings.push({point:hit.point,first:v.id,second:w.id});}
  }if(overlap)overlaps++;
 }
 return {paths,crossings,overlaps,blocked};
}

export function routeCircuit(c:Circuit,map=terminalMap(c)):WireLayout {
 // Reserve complete paths, then retry with the obstructed wires first. This
 // transfers the Optimizer's occupancy + order search without changing pins,
 // component placement, manually authored bends or the electrical graph.
 let best=routeAttempt(c,map);
 const quality=(l:WireLayout)=>[l.blocked.length,l.overlaps,l.crossings.length,[...l.paths.values()].reduce((sum,p)=>sum+Math.max(0,p.length-2)*18+p.slice(1).reduce((n,b,i)=>n+distance(p[i],b),0),0)];
 const better=(candidate:WireLayout)=>{const a=quality(candidate),b=quality(best);for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]<b[i];return false;};
 const ids=c.wires.filter(w=>!w.points.length).map(w=>w.id);
 if(best.blocked.length){
  const conflicts=new Map(ids.map(id=>[id,0]));
  for(const id of best.blocked)conflicts.set(id,1000);
  for(const hit of best.crossings)for(const id of [hit.first,hit.second])conflicts.set(id,(conflicts.get(id)??0)+1);
  const first=[...ids].sort((a,b)=>(conflicts.get(b)??0)-(conflicts.get(a)??0)||a.localeCompare(b));
  for(const order of [first,[...ids].reverse()]){const candidate=routeAttempt(c,map,order);if(better(candidate))best=candidate;if(!best.blocked.length)break;}
  if(best.blocked.length)for(const order of [undefined,[...ids].reverse(),first]){const candidate=routeAttempt(c,map,order,true);if(better(candidate))best=candidate;if(!best.blocked.length&&!best.crossings.length)break;}
  if(best.crossings.length&&ids.length<=12){const candidate=routeAttempt(c,map,[...ids].reverse(),true,true);if(better(candidate))best=candidate;}
 }
 return best;
}

// A small bridge makes unavoidable crossings distinct from a connector joint.
export function routedPath(points:Point[],crossings:Point[]=[]):string {
 const path=simplifyPath(points);if(!path.length)return '';
 const lengths=[0];for(let i=1;i<path.length;i++)lengths.push(lengths[i-1]+distance(path[i-1],path[i]));
 const total=lengths.at(-1)!;
 const at=(t:number):Point=>{for(let i=1;i<path.length;i++)if(t<=lengths[i]+EPS){const a=path[i-1],b=path[i],f=(t-lengths[i-1])/(lengths[i]-lengths[i-1]);return {x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f};}return path.at(-1)!;};
 const hits:number[]=[];
 for(let i=1;i<path.length;i++)for(const p of crossings){const a=path[i-1],b=path[i],ab=difference(b,a),length=lengths[i]-lengths[i-1],offset=((p.x-a.x)*ab.x+(p.y-a.y)*ab.y)/length;
  if(Math.abs(cross(difference(p,a),ab))<EPS&&offset>=-EPS&&offset<=length+EPS){const t=lengths[i-1]+offset;if(t>EPS&&t<total-EPS&&!hits.some(h=>Math.abs(h-t)<EPS))hits.push(t);}
 }
 const events:{start:number;end:number;center:number;bridge:boolean}[]=[];
 for(const t of hits.sort((a,b)=>a-b)){
  const event={start:Math.max(0,t-6),end:Math.min(total,t+6),center:t,bridge:lengths.every(s=>Math.abs(s-t)>8)};
  const last=events.at(-1);if(last&&event.start<=last.end+2){last.end=Math.max(last.end,event.end);last.bridge=false;}else events.push(event);
 }
 let d=`M${path[0].x} ${path[0].y}`,cursor=0;
 const drawTo=(end:number)=>{for(let i=1;i<path.length;i++)if(lengths[i]>cursor+EPS&&lengths[i]<end-EPS)d+=` L${path[i].x} ${path[i].y}`;const p=at(end);d+=` L${p.x} ${p.y}`;cursor=end;};
 for(const event of events){drawTo(event.start);const end=at(event.end);
  if(event.bridge){const p=at(event.center),start=at(event.start),dx=(end.x-start.x)/12,dy=(end.y-start.y)/12;d+=` Q${p.x+dy*12} ${p.y-dx*12} ${end.x} ${end.y}`;}
  // At a bend or adjacent crossing an arc would imply a false T-junction.
  // A real gap remains clear in either paint order and for diagonal manual paths.
  else d+=` M${end.x} ${end.y}`;
  cursor=event.end;
 }
 if(cursor<total)drawTo(total);return d;
}

export function layoutBounds(c:Circuit,layout:WireLayout) {
 const corners=c.components.flatMap(p=>{const r=partBounds(p);return [{x:r.left,y:r.top},{x:r.right,y:r.bottom}];}),points=[...corners,...[...layout.paths.values()].flat()];
 const x=Math.min(0,...points.map(p=>p.x))-45,y=Math.min(0,...points.map(p=>p.y))-45;
 return {x,y,width:Math.max(1250,...points.map(p=>p.x))+60-x,height:Math.max(730,...points.map(p=>p.y))+70-y};
}
