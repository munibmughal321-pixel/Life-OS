import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {collections} from './fixtures.mjs';
import {encode,decode,reconcile,synchronize,equal} from '../backend/sync-engine.js';
const context=vm.createContext({Object,structuredClone,Date,Number,URL,PRAYER_NAMES:['Fajr','Dhuhr','Asr','Maghrib','Isha']});
vm.runInContext(fs.readFileSync('js/config.js','utf8'),context);
vm.runInContext(fs.readFileSync('js/data-schema.js','utf8')+';this.schema=DataSchema;',context);
vm.runInContext(fs.readFileSync('js/state.js','utf8')+';this.defaults=state;',context);
const defaults=structuredClone(context.defaults),validate=(k,v)=>context.schema.error(k,v);
const row=(payload,revision=1,deleted_at=null)=>({collection:'notes',record_key:'n',payload,revision,deleted_at});
test('all 19 tracker collections round-trip, with stable date and singleton identities',()=>{
 const mapped=encode(collections,defaults,validate);
 assert.deepEqual(decode(mapped,defaults,validate),collections);
 assert.equal(Object.keys(mapped).length,19);
 const duplicate=structuredClone(collections);duplicate.journal.push({...duplicate.journal[0]});
 assert.throws(()=>encode(duplicate,defaults,validate),/duplicate/);
 assert.throws(()=>decode({'notes/n':row({id:'wrong',title:'x',date:'2026-09-17'})},defaults,validate),/identity/);
 const invalid=structuredClone(collections);invalid.finance[0].amount=-1;
 assert.throws(()=>encode(invalid,defaults,validate));
});
test('independent changes, interrupted acknowledgements and tombstones reconcile safely',()=>{
 const old=row({id:'n',title:'old'}),edited=row({id:'n',title:'new'},2);
 assert.equal(reconcile({'notes/n':edited},{'notes/n':old},{'notes/n':old}).writes.length,1);
 assert.equal(reconcile({'notes/n':edited},{'notes/n':old},{'notes/n':edited}).writes.length,0,'retry after lost ack');
 const removed={...edited,deleted_at:'2026-09-17T00:00:00Z'};
 assert.deepEqual(reconcile({'notes/n':old},{'notes/n':old},{'notes/n':removed}).merged,{});
 assert.equal(reconcile({}, {'notes/n':old}, {'notes/n':old}).writes[0].row.deleted_at,true);
 const unknownDeletion=reconcile({'notes/n':old},{},{'notes/n':removed});
 assert.equal(unknownDeletion.conflicts.length,1,'an unacknowledged tombstone cannot be silently resurrected');
 assert.equal(unknownDeletion.writes.length,0);
 const keepCloud=reconcile({'notes/n':old},{},{'notes/n':removed},{'notes/n':{side:'cloud',signature:unknownDeletion.conflicts[0].signature}});
 assert.deepEqual(keepCloud.merged,{});assert.equal(keepCloud.writes.length,0);
});
test('conflicts keep both copies and stale user choices cannot overwrite a newer remote revision',()=>{
 const base={'notes/n':row({id:'n',title:'base'})},local={'notes/n':row({id:'n',title:'local'})},remote={'notes/n':row({id:'n',title:'remote'},2)};
 const plan=reconcile(local,base,remote),conflict=plan.conflicts[0];
 assert.equal(plan.writes.length,0);assert.equal(conflict.local.payload.title,'local');
 const choices={'notes/n':{side:'local',signature:conflict.signature}};
 assert.equal(reconcile(local,base,remote,choices).writes.length,1);
 assert.equal(reconcile(local,base,{'notes/n':row({id:'n',title:'newer'},3)},choices).conflicts.length,1);
 const deletion=reconcile({},base,remote);assert.equal(deletion.conflicts.length,1);
 const keepCloud=reconcile({},base,remote,{'notes/n':{side:'cloud',signature:deletion.conflicts[0].signature}});
 assert.equal(keepCloud.conflicts.length,0);assert.equal(keepCloud.writes.length,0);
 assert.equal(keepCloud.merged['notes/n'].payload.title,'remote');
});
test('crash after remote write retries without duplicate create; concurrent local changes survive',async()=>{
 let snapshot={collections:structuredClone(defaults),meta:{enabled:true,base:{},conflicts:[]}};
 snapshot.collections.notes=[{id:'n',title:'first',date:'2026-09-17'}];
 let cloud={},writes=0,failCommit=true;
 const remote={readAll:async()=>structuredClone(cloud),write:async({id,row,revision})=>{writes++;if(revision===null&&cloud[id])throw Error('duplicate');return cloud[id]={...row,revision:(revision||0)+1};}};
 const local={read:async()=>structuredClone(snapshot),commit:async(before,next,meta)=>{
  if(failCommit){failCommit=false;throw Error('interrupted acknowledgement');}
  if(!equal(before.collections,snapshot.collections))throw Error('changed locally');
  snapshot={collections:next||snapshot.collections,meta};
 }};
 await assert.rejects(synchronize({remote,local,defaults,validate}),/interrupted/);
 await synchronize({remote,local,defaults,validate});assert.equal(writes,1);
 snapshot.collections.notes[0].title='second';
 const commit=local.commit;local.commit=async(before,next,meta)=>{snapshot.collections.notes[0].title='third';return commit(before,next,meta);};
 await assert.rejects(synchronize({remote,local,defaults,validate}),/changed locally/);
 assert.equal(snapshot.collections.notes[0].title,'third');
 local.commit=commit;await synchronize({remote,local,defaults,validate});
 // A newer local change following an unacknowledged upload remains an explicit conflict.
 assert.equal(snapshot.meta.conflicts.length,1);
});
test('partial multi-record upload retries to convergence without duplicates or data loss',async()=>{
 let snapshot={collections:structuredClone(defaults),meta:{enabled:true,base:{},conflicts:[]}};
 snapshot.collections.notes=[
  {id:'first',title:'First local note',date:'2026-09-20'},
  {id:'second',title:'Second local note',date:'2026-09-21'}
 ];
 let cloud={},failSecondOnce=true;
 const attempts=[];
 const remote={
  readAll:async()=>structuredClone(cloud),
  write:async({id,row,revision})=>{
   attempts.push(id);
   if(id==='notes/second'&&failSecondOnce){failSecondOnce=false;throw Error('temporary cloud failure');}
   if(revision===null&&cloud[id])throw Error('duplicate create');
   return cloud[id]={...structuredClone(row),revision:(revision||0)+1};
  }
 };
 const local={
  read:async()=>structuredClone(snapshot),
  commit:async(_before,next,meta)=>{snapshot={collections:next||snapshot.collections,meta};}
 };
 await assert.rejects(synchronize({remote,local,defaults,validate}),/temporary cloud failure/);
 assert.deepEqual(Object.keys(cloud),['notes/first']);
 assert.deepEqual(snapshot.meta.base,{});
 const retry=await synchronize({remote,local,defaults,validate});
 assert.deepEqual(retry,{status:'synced',count:1});
 assert.deepEqual(attempts,['notes/first','notes/second','notes/second']);
 assert.deepEqual(snapshot.collections.notes.map(note=>note.id).sort(),['first','second']);
 assert.equal(Object.keys(snapshot.meta.base).length,2);
 assert.deepEqual(await synchronize({remote,local,defaults,validate}),{status:'synced',count:0});
 assert.deepEqual(attempts,['notes/first','notes/second','notes/second']);
});
test('invalid merged activity state is rejected before upload',async()=>{
 const a={id:'a',activity:'Study',startISO:'2026-09-17T00:00:00Z',endISO:null};
 const b={...a,id:'b'};
 let wrote=false;
 await assert.rejects(synchronize({
  defaults,validate,
  local:{read:async()=>({collections:{...structuredClone(defaults),logs:[a]},meta:{base:{}}}),commit:async()=>{}},
  remote:{readAll:async()=>({'logs/b':{collection:'logs',record_key:'b',payload:b,revision:1}}),write:async()=>{wrote=true;}}
 }),/more than one running/);
 assert.equal(wrote,false);
});

import {syncRemote} from '../backend/sync-remote.js';
test('remote pagination reads past 500 rows and refuses a changed account during the final response',async()=>{
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 let identity=owner,switchAtPage=0,pageCount=0;
 const records=Array.from({length:1002},(_,i)=>({user_id:owner,collection:'notes',record_key:'n'+String(i).padStart(4,'0'),payload:{id:'n'+String(i).padStart(4,'0'),title:'Fixture',date:'2026-09-20'},revision:1}));
 const client={auth:{getUser:async()=>({data:{user:{id:identity}},error:null})},from(){
  const filters={};let after='',limit=500;
  const query={
   select(){return query;},eq(k,v){filters[k]=v;return query;},order(){return query;},
   limit(n){limit=n;return query;},gt(k,v){after=v;return query;},
   then(resolve){const data=records.filter(r=>Object.entries(filters).every(([k,v])=>r[k]===v)&&r.record_key>after).slice(0,limit);
    if(filters.collection==='notes'){pageCount++;if(pageCount===switchAtPage)identity=other;}
    return Promise.resolve({data,error:null}).then(resolve);
   }
  };return query;
 }};
 const remote=syncRemote(client,owner);
 assert.equal(Object.keys(await remote.readAll()).length,1002);assert.equal(pageCount,3);
 identity=owner;pageCount=0;switchAtPage=3;await assert.rejects(remote.readAll(),/same account/);
});
test('remote writes refuse an account change during the final response',async()=>{
 const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
 let identity=owner;
 const client={
  auth:{getUser:async()=>({data:{user:{id:identity}},error:null})},
  from(){return {insert(body){return {select(){return {single:async()=>{identity=other;return {data:{...body,revision:1,deleted_at:null},error:null};}};}};}};}
 };
 await assert.rejects(syncRemote(client,owner).write({id:'notes/n',row:{collection:'notes',record_key:'n',payload:{id:'n',title:'x'}},revision:null}),/same account/);
});
