package com.munib.lifeos;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.google.android.gms.location.*;
import com.google.android.gms.tasks.*;
import java.util.*;
import org.json.*;

final class Geo {
 static SharedPreferences preferences(Context context){return context.getSharedPreferences("lifeos-places",Context.MODE_PRIVATE);}
 static boolean enabled(Context context){return preferences(context).getBoolean("enabled",false);}
 static JSONArray places(Context context)throws JSONException{return new JSONArray(preferences(context).getString("places","[]"));}
 static void validate(JSONArray places)throws JSONException{
  if(places==null||places.length()>10)throw new IllegalArgumentException();
  Set<String> ids=new HashSet<>();
  for(int i=0;i<places.length();i++){
   JSONObject p=places.getJSONObject(i);String id=p.getString("id"),name=p.getString("name"),activity=p.getString("activity");
   double latitude=p.getDouble("latitude"),longitude=p.getDouble("longitude"),radius=p.getDouble("radius");
   if(!id.matches("[a-zA-Z0-9-]{1,64}")||!ids.add(id)||name.trim().isEmpty()||name.length()>60||activity.trim().isEmpty()||activity.length()>40||
      !Double.isFinite(latitude)||Math.abs(latitude)>90||!Double.isFinite(longitude)||Math.abs(longitude)>180||!Double.isFinite(radius)||radius<100||radius>1000)throw new IllegalArgumentException();
  }
 }
 static PendingIntent pending(Context context){
  Intent intent=new Intent(context,ArrivalReceiver.class);
  int flags=PendingIntent.FLAG_UPDATE_CURRENT;
  if(Build.VERSION.SDK_INT>=31)flags|=PendingIntent.FLAG_MUTABLE;
  return PendingIntent.getBroadcast(context,4100,intent,flags);
 }
 static Task<Void> remove(Context context){return LocationServices.getGeofencingClient(context).removeGeofences(pending(context));}
 static Task<Void> register(Context context)throws JSONException{
  JSONArray places=places(context);validate(places);List<Geofence> fences=new ArrayList<>();
  for(int i=0;i<places.length();i++){
   JSONObject p=places.getJSONObject(i);
   fences.add(new Geofence.Builder().setRequestId(p.getString("id")).setCircularRegion(p.getDouble("latitude"),p.getDouble("longitude"),(float)p.getDouble("radius"))
    .setExpirationDuration(Geofence.NEVER_EXPIRE).setTransitionTypes(Geofence.GEOFENCE_TRANSITION_DWELL|Geofence.GEOFENCE_TRANSITION_EXIT)
    .setLoiteringDelay(120000).setNotificationResponsiveness(120000).build());
  }
  return remove(context).continueWithTask(task->{
   if(!task.isSuccessful())return Tasks.forException(task.getException());
   if(fences.isEmpty())return Tasks.forResult(null);
   var request=new GeofencingRequest.Builder().setInitialTrigger(0).addGeofences(fences).build();
   if(ContextCompat.checkSelfPermission(context,Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)
    return Tasks.forException(new SecurityException("Precise location permission is unavailable."));
   // Permission can change after the UI check, including during reboot registration.
   try{return LocationServices.getGeofencingClient(context).addGeofences(request,pending(context));}
   catch(SecurityException e){return Tasks.forException(e);}
  });
 }
}
