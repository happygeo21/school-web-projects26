'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore,FieldValue}=require('firebase-admin/firestore');
const {properties}=require('./notion-payload.cjs');
initializeApp();const db=getFirestore();const token=defineSecret('WEDDING_NOTION_TOKEN');
const dataSource='c5124da9-baac-4670-85ff-f355c192d5b7';
// Explicit export: the connector's session is never reused as a server credential.
exports.exportWeddingRecord=onCall({region:'asia-northeast3',secrets:[token],maxInstances:1,concurrency:1,timeoutSeconds:60,cors:['https://happygeo21.github.io']},async request=>{
  if(!request.auth||request.auth.token.email_verified!==true)throw new HttpsError('unauthenticated','Login required');
  const access=await db.doc('access/config').get();
  if(request.auth.token.firebase?.sign_in_provider!=='google.com'||!access.data()?.emails?.includes(request.auth.token.email))throw new HttpsError('permission-denied','Members only');
  const {id,revision}=request.data||{};
  if(typeof id!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(id)||!Number.isInteger(revision))throw new HttpsError('invalid-argument','Invalid record');
  const ref=db.doc(`records/${id}`),sync=db.doc(`notionSync/${id}`);
  const job=await db.runTransaction(async tx=>{
    const [r,s]=await Promise.all([tx.get(ref),tx.get(sync)]);
    if(!r.exists||r.data().revision!==revision)throw new HttpsError('failed-precondition','Record changed; reload first');
    const previous=s.exists?s.data():{};
    if(previous.state==='sending'||previous.state==='uncertain')throw new HttpsError('failed-precondition','Resolve previous export before retrying');
    if(previous.revision===revision&&previous.state==='done')return {done:true};
    tx.set(sync,{state:'sending',revision,updatedAt:FieldValue.serverTimestamp(),pageId:previous.pageId||null});
    return {record:r.data(),pageId:previous.pageId||null};
  });
  if(job.done)return {ok:true};
  try{
    const result=await fetch('https://api.notion.com/v1/pages'+(job.pageId?`/${job.pageId}`:''),{
      method:job.pageId?'PATCH':'POST',signal:AbortSignal.timeout(20000),
      headers:{Authorization:`Bearer ${token.value()}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},
      body:JSON.stringify({...(job.pageId?{}:{parent:{type:'data_source_id',data_source_id:dataSource}}),properties:properties(job.record)})
    });
    if(!result.ok){
      // Known client rejection is safe to retry; network/5xx outcomes require manual reconciliation.
      await sync.update({state:result.status<500?'rejected':'uncertain',httpStatus:result.status});
      throw new HttpsError('unavailable','Notion rejected the request');
    }
    const page=await result.json();
    if(!page.id)throw Error('Missing page identity');
    await sync.update({state:'done',pageId:page.id,revision,updatedAt:FieldValue.serverTimestamp()});
    return {ok:true};
  }catch(error){
    const current=await sync.get();
    if(current.data()?.state==='sending')await sync.update({state:'uncertain'});
    // No tokens, record contents, emails, or raw upstream errors in logs/results.
    throw new HttpsError('unavailable','Export not confirmed. Check Notion before retrying.');
  }
});
