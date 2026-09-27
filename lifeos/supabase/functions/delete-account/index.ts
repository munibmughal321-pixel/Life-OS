import {createClient} from 'npm:@supabase/supabase-js@2.116.0';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
Deno.serve(async req=>{
 const respond=(status:number,message:string)=>new Response(JSON.stringify({message}),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return respond(405,'Method not allowed');
 const token=req.headers.get('Authorization')?.replace(/^Bearer /i,'');
 if(!token)return respond(401,'Sign in required');
 const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await admin.auth.getUser(token);
 if(error||!data.user)return respond(401,'Invalid session');
 try{if((await req.json()).confirmation!=='DELETE')return respond(400,'Confirmation required');}catch{return respond(400,'Invalid request');}
 // The authenticated user's ID is the only deletion target; never accept an ID from the body.
 const removed=await admin.auth.admin.deleteUser(data.user.id);
 if(removed.error)return respond(500,'Deletion failed');
 return respond(200,'Account deleted');
});
