import {repository,validateRecord} from './repository.js';
export function syncRemote(client,userId){
 const repo=repository(client,userId);
 async function identity(){
  const {data,error}=await client.auth.getUser();
  if(error||data.user?.id!==userId)throw Error('Sync paused. Sign in to the same account to resume; local changes are safe.');
 }
 return {
  assertOwner:identity,
  async readAll(){
   await identity();const rows={};
   // Keyset pagination avoids offset shifts when another device inserts a record.
   for(const collection of repo.collections){
    let after='';
    for(;;){
     await identity();
     let query=client.from('records').select('*').eq('user_id',userId).eq('collection',collection).order('record_key').limit(500);
     if(after)query=query.gt('record_key',after);
     const {data,error}=await query;if(error)throw error;
     await identity();
     for(const row of data){
      if(row.user_id!==userId||row.collection!==collection||!Number.isSafeInteger(row.revision)||row.revision<1)throw Error('Invalid cloud ownership or revision.');
      validateRecord(collection,row.record_key,row.payload);rows[collection+'/'+row.record_key]=row;
     }
     if(data.length<500)break;after=data.at(-1).record_key;
    }
   }
   await identity();
   return rows;
  },
  async write({row,revision}){
   await identity();
   const result=await (revision===null?repo.create(row.collection,row.record_key,row.payload):repo.update(row.collection,row.record_key,row.payload,revision,!!row.deleted_at));
   await identity();
   return result;
  }
 };
}
