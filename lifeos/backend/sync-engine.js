// Pure record mapping and three-way reconciliation; no network or credentials.
export const LISTS=['logs','quran','finance','loans','recurring','checkins','goals','skills','education','notes','journal','courses','trades'];
export const MAPS=['prayers','adhkar','jumuah'];
export const SINGLES=['profile','mission','ramadan'];
export const KEYS=[...LISTS,...MAPS,...SINGLES];
export function canonical(v){
 if(v===undefined)return 'undefined';
 if(v===null||typeof v!=='object')return JSON.stringify(v);
 if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
 return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
}
export const equal=(a,b)=>canonical(a)===canonical(b);
export function encode(collections,defaults,validate){
 const rows={};
 for(const collection of KEYS){
  const error=validate(collection,collections[collection]);if(error)throw Error(error);
  const put=(key,payload)=>{
   if(typeof key!=='string'||!key.length||key.length>100)throw Error(collection+': missing stable identity.');
   const id=collection+'/'+key;
   if(Object.hasOwn(rows,id))throw Error(collection+': duplicate identity. Resolve duplicate dates before syncing.');
   if(new TextEncoder().encode(JSON.stringify(payload)).length>65536)throw Error(collection+': record exceeds cloud size limit.');
   rows[id]={collection,record_key:key,payload};
  };
  const value=collections[collection];
  if(LISTS.includes(collection))for(const item of value)put(item.id||item.date,item);
  else if(MAPS.includes(collection))for(const [key,item] of Object.entries(value))put(key,collection==='jumuah'?{value:item}:item);
  else if(!equal(value,defaults[collection]))put('settings',value);
 }
 return rows;
}
export function decode(rows,defaults,validate){
 const collections=structuredClone(defaults);
 for(const c of LISTS)collections[c]=[];
 for(const c of MAPS)collections[c]={};
 for(const row of Object.values(rows)){
  if(!KEYS.includes(row.collection)||typeof row.record_key!=='string')throw Error('Unsupported cloud record.');
  const c=row.collection,p=structuredClone(row.payload);
  if(LISTS.includes(c)){
   if((p.id||p.date)!==row.record_key)throw Error(c+': cloud identity mismatch.');
   collections[c].push(p);
  }else if(MAPS.includes(c)){
   if(!/^\d{4}-\d{2}-\d{2}$/.test(row.record_key))throw Error('Invalid daily key.');
   collections[c][row.record_key]=c==='jumuah'?p.value:p;
  }else{
   if(row.record_key!=='settings')throw Error('Invalid settings identity.');
   collections[c]=p;
  }
 }
 for(const key of KEYS){const error=validate(key,collections[key]);if(error)throw Error('Cloud merge rejected: '+error);}
 return collections;
}
const recordState=row=>!row?{kind:'missing'}:row.deleted_at?{kind:'deleted'}:{kind:'value',payload:row.payload};
const sameState=(a,b)=>equal(recordState(a),recordState(b));
const bothDeleted=(local,remote)=>!local&&(remote?.deleted_at||!remote);
export function reconcile(local,base,remote,choices={}){
 const merged={},writes=[],conflicts=[];
 for(const id of new Set([...Object.keys(local),...Object.keys(base),...Object.keys(remote)])){
  const l=local[id],b=base[id],r=remote[id];let pick,conflict=false;
  // Local absence and a cloud tombstone both mean deleted when both sides agree.
  // Otherwise missing, deleted, and active remain distinct so an old local copy
  // cannot silently resurrect a tombstone it has never acknowledged.
  if(bothDeleted(l,r))pick=r;
  else if(sameState(l,r))pick=r??l;
  else if(sameState(l,b))pick=r;
  else if(sameState(r,b))pick=l;
  else{
   const signature=canonical([recordState(l),recordState(r),r?.revision??null]),choice=choices[id];
   if(choice?.signature===signature&&['local','cloud'].includes(choice.side))pick=choice.side==='local'?l:r;
   else{conflicts.push({id,local:l??null,cloud:r??null,signature});pick=l;conflict=true;}
  }
  if(pick&&!pick.deleted_at)merged[id]=pick;
  if(!conflict&&!sameState(pick,r))writes.push({id,row:pick&&!pick.deleted_at?pick:{...(r||b),deleted_at:true},revision:r?.revision??null});
 }
 return {merged,writes,conflicts};
}
export async function synchronize({remote,local,defaults,validate,choices={}}){
 const snapshot=await local.read(),encoded=encode(snapshot.collections,defaults,validate),cloud=await remote.readAll();
 const plan=reconcile(encoded,snapshot.meta.base||{},cloud,choices);
 if(plan.conflicts.length){
  await local.commit(snapshot,null,{...snapshot.meta,conflicts:plan.conflicts});
  return {status:'conflict',count:plan.conflicts.length};
 }
 const collections=decode(plan.merged,defaults,validate),confirmed={...cloud};
 // Validate full collections before uploading (including the single-running-timer rule).
 for(const write of plan.writes)confirmed[write.id]=await remote.write(write);
 await remote.assertOwner?.();
 // Compare-and-swap local revisions prevents overwriting edits made during network requests.
 await local.commit(snapshot,collections,{...snapshot.meta,base:confirmed,conflicts:[],lastSync:new Date().toISOString()});
 return {status:'synced',count:plan.writes.length};
}
