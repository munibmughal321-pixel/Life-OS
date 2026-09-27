export function callbackRoute(raw){
 try{
  const url=new URL(raw);
  if(url.protocol!=='com.munib.lifeos:'||url.hostname!=='auth'||url.username||url.password||url.port||url.hash)return null;
  if(!['/login.html','/reset-password.html'].includes(url.pathname))return null;
  const code=url.searchParams.get('code');
  if(!code||code.length>2048||url.searchParams.getAll('code').length!==1)return null;
  return url.pathname.slice(1)+'?code='+encodeURIComponent(code);
 }catch{return null;}
}
export function validatePlace(place){
 if(!place||typeof place!=='object'||!/^[a-zA-Z0-9-]{1,64}$/.test(place.id))throw Error('Invalid saved place.');
 if(typeof place.name!=='string'||!place.name.trim()||place.name.length>60)throw Error('Use a place name up to 60 characters.');
 if(typeof place.activity!=='string'||!place.activity.trim()||place.activity.length>40)throw Error('Choose an activity.');
 if(!Number.isFinite(place.latitude)||Math.abs(place.latitude)>90||!Number.isFinite(place.longitude)||Math.abs(place.longitude)>180)throw Error('Location unavailable.');
 if(!Number.isFinite(place.radius)||place.radius<100||place.radius>1000)throw Error('Choose a radius from 100 to 1000 metres.');
 return {id:place.id,name:place.name.trim(),activity:place.activity.trim(),latitude:place.latitude,longitude:place.longitude,radius:place.radius};
}
export function distanceMetres(a,b){
 const radians=x=>x*Math.PI/180,dlat=radians(b.latitude-a.latitude),dlon=radians(b.longitude-a.longitude);
 const h=Math.sin(dlat/2)**2+Math.cos(radians(a.latitude))*Math.cos(radians(b.latitude))*Math.sin(dlon/2)**2;
 return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
