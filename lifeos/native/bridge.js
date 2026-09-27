import {Capacitor,registerPlugin} from '@capacitor/core';
export const isNative=()=>Capacitor.isNativePlatform();
export const Device=registerPlugin('LifeOSDevice');
// Native account secrets never fall back to WebView localStorage.
export const nativeAuthStorage={
 async getItem(key){return (await Device.secretGet({key})).value??null;},
 async setItem(key,value){await Device.secretSet({key,value});},
 async removeItem(key){await Device.secretRemove({key});}
};
export function accountRedirect(page){
 if(!['login.html','reset-password.html'].includes(page))throw Error('Unsupported account callback.');
 return isNative()?'com.munib.lifeos://auth/'+page:new URL(page,location.href).href;
}

export async function exportJSON(data,name){
 if(isNative()){await Device.exportFile({name,value:JSON.stringify(data,null,2)});return;}
 const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
 const link=document.createElement('a');link.href=url;link.download=name;link.click();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
