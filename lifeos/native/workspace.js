// One revision-checked SQLite row contains the two logical stores. The native
// transaction atomically replaces collections AND recovery metadata, preserving
// the same all-or-nothing guarantees as the browser IndexedDB implementation.
export function nativeWorkspace(device,name){
 if(!/^lifeos-(local|places|account-[0-9a-f-]{36})$/.test(name))throw Error('Invalid workspace.');
 return {
  async read(){
   const row=await device.readWorkspace({name});
   if(!Number.isSafeInteger(row.revision)||row.revision<0)throw Error('Unreadable native revision.');
   const data=row.value===null?{version:1,collections:{},recovery:{}}:JSON.parse(row.value);
   if(data.version!==1||!data.collections||Array.isArray(data.collections)||typeof data.collections!=='object'||!data.recovery||Array.isArray(data.recovery)||typeof data.recovery!=='object')throw Error('Native data is unreadable. Do not clear app data.');
   return {revision:row.revision,data};
  },
  async commit(before,data){
   if(before.revision>=Number.MAX_SAFE_INTEGER)throw Error('Native revision limit reached.');
   await device.writeWorkspace({name,expected:before.revision,value:JSON.stringify(data)});
  }
 };
}
