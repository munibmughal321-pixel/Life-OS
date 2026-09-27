export const COLLECTIONS=Object.freeze(['profile','logs','prayers','quran','finance','loans','recurring','checkins','goals','skills','education','notes','journal','mission','courses','adhkar','jumuah','ramadan','trades']);
export function validateRecord(collection,key,payload){
 if(!COLLECTIONS.includes(collection))throw Error('Unknown collection.');
 if(typeof key!=='string'||key.length<1||key.length>100)throw Error('Invalid record key.');
 if(!payload||Array.isArray(payload)||typeof payload!=='object')throw Error('A record must be an object.');
 if(new TextEncoder().encode(JSON.stringify(payload)).length>65536)throw Error('Record exceeds 64 KB.');
}
export function repository(client,expectedOwner=null){
 async function owner(){const {data,error}=await client.auth.getUser();if(error||!data.user||(expectedOwner&&data.user.id!==expectedOwner))throw Error('Sign in to the original account to use its cloud data.');return data.user;}
 function result(response){if(response.error)throw response.error;return response.data;}
 return {
  collections:COLLECTIONS,
  async profile(){const user=await owner();return result(await client.from('profiles').select('*').eq('user_id',user.id).maybeSingle());},
  async saveProfile(values,revision=null){
   const user=await owner();
   const body={display_name:String(values.display_name||'').trim(),timezone:values.timezone,currency:values.currency};
   if(body.display_name.length>60||!/^[A-Z]{3}$/.test(body.currency))throw Error('Check your name and three-letter currency.');
   try{new Intl.DateTimeFormat('en',{timeZone:body.timezone});}catch{throw Error('Enter a valid timezone.');}
   const response=revision===null
    ?await client.from('profiles').insert({...body,user_id:user.id}).select().single()
    :await client.from('profiles').update(body).eq('user_id',user.id).eq('revision',revision).select().maybeSingle();
   const row=result(response);if(!row)throw Error('Profile changed elsewhere. Reload before saving.');return row;
  },
  async list(collection){
   if(!COLLECTIONS.includes(collection))throw Error('Unknown collection.');
   const user=await owner();return result(await client.from('records').select('*').eq('user_id',user.id).eq('collection',collection).order('record_key').limit(500));
  },
  async create(collection,key,payload){
   validateRecord(collection,key,payload);const user=await owner();
   return result(await client.from('records').insert({user_id:user.id,collection,record_key:key,payload}).select().single());
  },
  async update(collection,key,payload,revision,deleted=false){
   validateRecord(collection,key,payload);if(!Number.isSafeInteger(revision)||revision<1)throw Error('Invalid revision.');
   const user=await owner();
   const row=result(await client.from('records').update({payload,deleted_at:deleted?new Date().toISOString():null}).eq('user_id',user.id).eq('collection',collection).eq('record_key',key).eq('revision',revision).select().maybeSingle());
   if(!row)throw Error('Record changed elsewhere or is unavailable.');return row;
  },
  async export(){
   const user=await owner();const rows=[];
   for(let offset=0;;offset+=500){
    const batch=result(await client.from('records').select('*').eq('user_id',user.id).order('collection').order('record_key').range(offset,offset+499));
    rows.push(...batch);if(batch.length<500)break;
   }
   return {format:'lifeos-cloud-export',version:1,exported_at:new Date().toISOString(),profile:await this.profile(),records:rows};
  }
 };
}
