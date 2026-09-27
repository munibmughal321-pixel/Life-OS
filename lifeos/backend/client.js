import {isNative,nativeAuthStorage} from '../native/bridge.js';
import {createClient} from '@supabase/supabase-js';
export function makeClient(url,key){
 if(!url || !key?.startsWith('sb_publishable_')) throw Error('Account configuration is missing. Set the Supabase URL and publishable key, then restart the development server.');
 const parsed=new URL(url);
 if(parsed.protocol!=='https:')throw Error('Supabase must use HTTPS.');
 return createClient(url,key,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,...(isNative()?{storage:nativeAuthStorage}:{})}});
}
let instance;
export function getClient(){
 return instance ||= makeClient(import.meta.env.VITE_SUPABASE_URL,import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
}
