package com.munib.lifeos;
import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import com.google.android.gms.location.*;
import org.json.*;

public class ArrivalReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  if(!Geo.enabled(context))return;
  try{
   GeofencingEvent event=GeofencingEvent.fromIntent(intent);
   if(event==null||event.hasError()||event.getTriggeringGeofences()==null)return;
   var preferences=Geo.preferences(context);
   for(Geofence fence:event.getTriggeringGeofences()){
    String id=fence.getRequestId(),key="inside-"+id;
    if(event.getGeofenceTransition()==Geofence.GEOFENCE_TRANSITION_EXIT){preferences.edit().remove(key).apply();continue;}
    if(event.getGeofenceTransition()!=Geofence.GEOFENCE_TRANSITION_DWELL||preferences.getBoolean(key,false))continue;
    boolean exists=false;JSONArray places=Geo.places(context);
    for(int i=0;i<places.length();i++)if(places.getJSONObject(i).getString("id").equals(id))exists=true;
    if(!exists)continue;
    NotificationManager manager=context.getSystemService(NotificationManager.class);
    if(!manager.areNotificationsEnabled())continue;
    if(Build.VERSION.SDK_INT>=26)manager.createNotificationChannel(new NotificationChannel("lifeos-arrivals","Arrival reminders",NotificationManager.IMPORTANCE_DEFAULT));
    Intent open=new Intent(context,MainActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse("com.munib.lifeos://place/"+id)).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP|Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent action=PendingIntent.getActivity(context,id.hashCode(),open,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder builder=Build.VERSION.SDK_INT>=26?new Notification.Builder(context,"lifeos-arrivals"):new Notification.Builder(context);
    manager.notify(id.hashCode(),builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle("LifeOS arrival reminder")
     .setContentText("Ready to start an activity? Open LifeOS to confirm.").setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true).setContentIntent(action).build());
    preferences.edit().putBoolean(key,true).apply();
   }
  }catch(Exception ignored){/* Permission may be revoked while the app is closed. Never log private places. */}
 }
}
