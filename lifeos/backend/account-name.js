// Identity labels are cached per account; tracker data remains independent.
const key=id=>'lifeos-account-name-'+id;
export function savedName(id){try{return localStorage.getItem(key(id))||'';}catch{return '';}}
export function rememberName(id,name){if(!id)return;try{localStorage.setItem(key(id),String(name||'').trim());}catch{}}
