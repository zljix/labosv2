// These schedules are private runtime inputs. Their seed comes from the
// server-bound job; neither project metadata nor student source selects it.
export function scenarioRandom(seed:string) {
  // Consume all 256 seed bits rather than a short public prefix.
  const words=seed.match(/.{8}/g)!.map(w=>parseInt(w,16));
  let state=0x811c9dc5;
  for(const word of words)state=Math.imul(state^word,0x01000193)>>>0;
  return (lo:number,hi:number)=>{
    state=(state+0x6d2b79f5)>>>0;
    let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);
    return lo+((n^(n>>>14))>>>0)%(hi-lo+1);
  };
}

export function buttonSchedule(seed:string,minimumMs:number,maximumMs:number) {
  const integer=scenarioRandom(seed),first=!!integer(0,1);
  // Both levels, long holds, repeated identical levels and several later
  // transitions are present in every schedule, irrespective of the seed.
  const levels=[first,!first,!first,first,first,!first,first,!first,first];
  let startMs=0;
  return levels.map((pressed,index)=>{
    const durationMs=integer(minimumMs,maximumMs)*(index===2||index===4?2:1);
    const value={pressed,startMs,durationMs};startMs+=durationMs;return value;
  });
}

export function regulatorTemperatures(seed:string,boundaries:number[]) {
  const integer=scenarioRandom(seed),low=integer(180,250)/10,high=integer(290,350)/10,mid=integer(263,277)/10;
  const warm=!!integer(0,1),first=warm?high:low,other=warm?low:high;
  const shuffled=[...boundaries];
  for(let i=shuffled.length-1;i>0;i--){const j=integer(0,i);[shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];}
  // Both hysteresis directions occur in the basic stages. Permuting all eight
  // boundary inputs changes their preceding state without extending the
  // already accepted 14-stage execution and isolation budget on AVR.
  return [first,mid,other,mid,other,first,...shuffled];
}
