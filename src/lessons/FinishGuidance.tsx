import type {Project} from '../project/model';
import {readSchoolBinding} from '../platform/schoolSync';
import {finishAdvice} from './workflow';

export default function FinishGuidance({project}:{project:Project}) {
 return <div className="finish-guidance"><p>{finishAdvice(project)}</p>{readSchoolBinding(project)&&<a href="#school-work">Prijeđi na školsko spremanje i završetak ↑</a>}</div>;
}
