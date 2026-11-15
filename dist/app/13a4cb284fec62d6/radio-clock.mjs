// MIT. One monotonic discrete-event clock per two-node experiment.
export class RadioClock {
  constructor(){this.now=0;this.serial=0;this.queue=[];this.stopped=false;}
  at(time,fn){if(!Number.isFinite(time)||time<this.now-1e-6)throw Error('Radio: događaj je u prošlosti.');const event={time:Math.max(this.now,time),order:this.serial++,fn};this.queue.push(event);this.queue.sort((a,b)=>a.time-b.time||a.order-b.order);return event;}
  after(us,fn){return this.at(this.now+Math.max(0,us),fn);}
  sleep(us){return new Promise(resolve=>this.after(us,resolve));}
  get next(){return this.queue[0]?.time??Infinity;}
  fire(){const event=this.queue.shift();if(!event)return;this.now=Math.max(this.now,event.time);event.fn();}
  stop(){this.stopped=true;this.queue=[];}
}
