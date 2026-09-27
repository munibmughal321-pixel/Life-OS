package com.munib.lifeos;
import android.content.*;
public class RestorePlacesReceiver extends BroadcastReceiver {
 @Override public void onReceive(Context context,Intent intent){
  if(intent==null||(!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())&&!Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())))return;
  if(!Geo.enabled(context))return;
  PendingResult result=goAsync();
  try{Geo.register(context).addOnCompleteListener(task->{if(!task.isSuccessful())Geo.preferences(context).edit().putBoolean("enabled",false).apply();result.finish();});}
  catch(Exception e){Geo.preferences(context).edit().putBoolean("enabled",false).apply();result.finish();}
 }
}
