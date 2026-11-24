import {breadboardPlan} from './breadboardPlan';
import type {Circuit} from './model';

self.onmessage=(event:MessageEvent<Circuit>)=>self.postMessage(breadboardPlan(event.data));
