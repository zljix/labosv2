import {createHash} from 'node:crypto';

// Keys are ASCII contract fields. Arrays keep their published order.
export function canonical(value:unknown):string {
  const sort=(v:any):any=>Array.isArray(v)?v.map(sort):v&&typeof v==='object'?
    Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])):v;
  return JSON.stringify(sort(value));
}
export const contractDigest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');

export function publishedRubric(profile:any) {
  return {format:'labosv2-rubric',version:1,authority:'server-verified',checkerVersion:profile.checkerVersion,
    profileId:profile.id,targets:profile.targets,instructions:profile.instructions,title:profile.title,
    criteria:profile.criteria,maxPoints:profile.criteria.reduce((n:number,c:any)=>n+c.maxPoints,0),
    ...(profile.contract?{taskKey:profile.taskKey,contract:profile.contract}:{})};
}

export function jobBinding(job:any) {
  return {jobId:job.jobId,attemptId:job.attemptId,revision:job.revision,target:job.target,
    rubricDigest:job.rubricDigest,contractHash:job.contractHash,
    seedHash:createHash('sha256').update(String(job.seed??'')).digest('hex')};
}

export function validContractJob(job:any,profile:any) {
  return job.version===2&&['jobId','attemptId','revision'].every(k=>Number.isSafeInteger(job[k])&&job[k]>0)
    &&job.taskKey===profile.taskKey
    &&canonical(job.rubric)===canonical(publishedRubric(profile))
    &&job.rubricDigest===contractDigest(job.rubric)&&job.contractHash===contractDigest(profile.contract);
}
