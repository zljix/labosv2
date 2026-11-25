import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {strFromU8,strToU8,unzipSync,zipSync} from 'fflate';
import {schoolFixture} from './school-http-fixture.mjs';

test('collection assignment, locked Word, incomplete hand-in, rework and exact teacher review', {timeout:180000},async t=>{
  const f=await schoolFixture(t), teacher=await f.make('collection.teacher','teacher'), student=await f.make('collection.student');
  async function ok(p,status=200){const result=await p;assert.equal(result.status,status,result.text);return result.json;}
  const group=(await ok(teacher.client.call('create-class',{name:'3. razred – proba',schoolYear:'2026/2027'}),201)).class;
  const csv='username;displayName\n'+student.user.username+';'+student.user.displayName;
  const preview=await ok(teacher.client.call('preview-students',{classId:group.id,csv}));
  await ok(teacher.client.call('import-students',{classId:group.id,csv,previewToken:preview.previewToken,linkExisting:true}));
  const outsider=await f.make('collection.other');
  for(const [key,target,folder,edition] of [['iot/V1.4','micropython','V1_4','MicroPython'],['us/V3.1','s3-cpp','V3_1','Arduino']]){
    const task=(await ok(teacher.client.call('publish-task',{taskKey:key,criteria:[{description:'Objašnjeni fizički dokazi',maxPoints:5}]}),201)).task;
    const a=(await ok(teacher.client.call('create-assignment',{classId:group.id,taskVersionId:task.id,target}),201)).assignment;
    const attempt=await ok(student.client.call('begin-attempt',{assignmentId:a.id}));
    assert.equal(attempt.assignment.task.taskKey,key);
    const original=readFileSync('public/zbirke/'+folder+'/LV_'+folder+'_'+edition+'_v14.docx');
    const parts=unzipSync(original);parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('</w:body>','<w:p><w:r><w:t>Moje opažanje na postaji.</w:t></w:r></w:p></w:body>'));
    const word=Buffer.from(zipSync(parts)),file={name:'Moja vježba.docx',base64:word.toString('base64')};
    const base={attemptId:attempt.attempt.id,expectedRevision:1,requestKey:randomUUID()};
    await ok(student.client.call('finish-attempt',{...base,word:{...file,base64:original.toString('base64')}}),422);
    const lacking=await ok(student.client.call('finish-attempt',{...base,needsEvidence:true}));
    assert.equal(lacking.submission.word,null);
    const rework=await ok(teacher.client.call('reopen-attempt',{attemptId:base.attemptId,submissionId:lacking.submission.id,reason:'Dopuni Word vlastitim dokazima.',requestKey:randomUUID()}));
    const updated=rework.snapshot.project;updated.files['opazanje.txt']='Opažanje iz drugog pokušaja.';
    const attemptId=rework.attempt.id;
    await ok(student.client.call('save-work',{attemptId,project:updated,expectedRevision:1,requestKey:randomUUID()}));
    const finish={attemptId,expectedRevision:2,requestKey:randomUUID(),word:file};
    const sealed=await ok(student.client.call('finish-attempt',finish));
    assert.equal(sealed.submission.word.sha256,createHash('sha256').update(word).digest('hex'));
    assert.equal((await ok(student.client.call('finish-attempt',finish))).submission.id,sealed.submission.id);
    await ok(student.client.call('save-work',{attemptId,project:updated,expectedRevision:2,requestKey:randomUUID()}),409);
    const reviewed=await ok(teacher.client.call('review-work',{attemptId,revision:2,action:'comment',reason:'Opažanje i dokazi pregledani.',expectedReviewId:0,requestKey:randomUUID()}));
    assert.equal(reviewed.reviews[0].reason,'Opažanje i dokazi pregledani.');
    const correction=await ok(teacher.client.call('review-work',{attemptId,revision:2,action:'correct',reason:'Četiri boda za dokumentirane dokaze.',points:4,expectedReviewId:reviewed.latestReviewId,requestKey:randomUUID()}));
    assert(correction.reviews.some(r=>r.points===4));
    assert((await ok(student.client.call('work-feedback&id='+attemptId+'&revision=2'))).reviews.some(r=>r.points===4));
    const dl='submission-word&id='+attemptId+'&revision=2';
    assert.deepEqual((await teacher.client.download(dl)).bytes,word);
    assert.deepEqual((await student.client.download(dl)).bytes,word);
    assert.equal((await teacher.client.download('submission-word&id='+base.attemptId+'&revision=1')).status,404);
    assert.equal((await outsider.client.download(dl)).status,403);
    const third=await ok(teacher.client.call('reopen-attempt',{attemptId,submissionId:sealed.submission.id,reason:'Dodaj drugo mjerenje.',requestKey:randomUUID()}));
    parts['word/document.xml']=strToU8(strFromU8(parts['word/document.xml']).replace('Moje opažanje na postaji.','Ponovljeno mjerenje na postaji.'));
    const amended=Buffer.from(zipSync(parts));
    await ok(student.client.call('finish-attempt',{attemptId:third.attempt.id,expectedRevision:1,requestKey:randomUUID(),word:{...file,base64:amended.toString('base64')}}));
    assert.deepEqual((await teacher.client.download('submission-word&id='+third.attempt.id+'&revision=1')).bytes,amended);
    assert.deepEqual((await teacher.client.download(dl)).bytes,word);
    const originalAttempt=await ok(teacher.client.call('attempt&id='+base.attemptId));
    assert.equal(originalAttempt.submission.word,null);
  }
});
