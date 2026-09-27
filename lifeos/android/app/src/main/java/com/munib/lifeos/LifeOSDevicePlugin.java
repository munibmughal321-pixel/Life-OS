package com.munib.lifeos;

import android.Manifest;
import android.app.NotificationManager;
import android.content.*;
import android.database.Cursor;
import android.database.sqlite.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.security.keystore.*;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.*;
import com.getcapacitor.annotation.*;
import com.google.android.gms.location.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
import org.json.*;

@CapacitorPlugin(name="LifeOSDevice", permissions={
 @Permission(alias="location",strings={Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION}),
 @Permission(alias="background",strings={Manifest.permission.ACCESS_BACKGROUND_LOCATION}),
 @Permission(alias="notifications",strings={Manifest.permission.POST_NOTIFICATIONS})
})
public class LifeOSDevicePlugin extends Plugin {
 private SQLiteOpenHelper helper;
 @Override public void load(){
  helper=new SQLiteOpenHelper(getContext(),"lifeos.sqlite",null,1){
   public void onCreate(SQLiteDatabase db){db.execSQL("CREATE TABLE workspaces(name TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT NOT NULL)");}
   public void onUpgrade(SQLiteDatabase db,int oldVersion,int newVersion){throw new IllegalStateException("Unsupported storage migration");}
  };
 }
 private String workspace(PluginCall call){
  String name=call.getString("name","");
  if(!name.matches("lifeos-(local|places|account-[0-9a-f-]{36})"))throw new IllegalArgumentException("Invalid workspace");
  return name;
 }
 @PluginMethod public void readWorkspace(PluginCall call){
  try{
   SQLiteDatabase db=helper.getReadableDatabase();String name=workspace(call);
   db.beginTransaction();
   try{
    long revision=0;int length=0;
    try(Cursor c=db.rawQuery("SELECT revision,length(value) FROM workspaces WHERE name=?",new String[]{name})){
     if(c.moveToFirst()){revision=c.getLong(0);length=c.getInt(1);}
    }
    StringBuilder value=new StringBuilder();
    // Chunk reads avoid Android CursorWindow limits on larger private backups.
    for(int offset=1;offset<=length;offset+=262144){
     try(Cursor c=db.rawQuery("SELECT substr(value,?,262144) FROM workspaces WHERE name=?",new String[]{String.valueOf(offset),name})){if(c.moveToFirst())value.append(c.getString(0));}
    }
    JSObject result=new JSObject();result.put("revision",revision);result.put("value",revision==0?JSONObject.NULL:value.toString());
    db.setTransactionSuccessful();call.resolve(result);
   }finally{db.endTransaction();}
  }catch(Exception e){call.reject("Native storage could not be read. Existing data was preserved.");}
 }
 @PluginMethod public void writeWorkspace(PluginCall call){
  try{
   String name=workspace(call),value=call.getString("value");Object rawExpected=call.getData().opt("expected");
   Long expected=rawExpected instanceof Number?((Number)rawExpected).longValue():null;
   if(rawExpected instanceof Number && ((Number)rawExpected).doubleValue()!=expected.doubleValue())throw new IllegalArgumentException();
   if(value==null||value.length()>25000000||expected==null||expected<0||expected>=9007199254740991L)throw new IllegalArgumentException();
   new JSONObject(value);
   SQLiteDatabase db=helper.getWritableDatabase();db.beginTransaction();
   try{
    long revision=0;
    try(Cursor c=db.rawQuery("SELECT revision FROM workspaces WHERE name=?",new String[]{name})){if(c.moveToFirst())revision=c.getLong(0);}
    if(revision!=expected){call.reject("Native records changed. Reload or retry; existing data is safe.");return;}
    ContentValues values=new ContentValues();values.put("name",name);values.put("revision",expected+1);values.put("value",value);
    if(db.insertWithOnConflict("workspaces",null,values,SQLiteDatabase.CONFLICT_REPLACE)<0)throw new IOException("Save failed");
    db.setTransactionSuccessful();
   }finally{db.endTransaction();}
   call.resolve();
  }catch(Exception e){call.reject("Native save failed. Existing data was preserved.");}
 }
 private SharedPreferences secrets(){return getContext().getSharedPreferences("lifeos-secrets",Context.MODE_PRIVATE);}
 private String secretName(PluginCall call){
  String key=call.getString("key","");
  if(!key.startsWith("sb-")||key.length()>200)throw new IllegalArgumentException();
  return key;
 }
 private SecretKey secretKey() throws Exception {
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias("lifeos-auth")){
   KeyGenerator gen=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
   gen.init(new KeyGenParameterSpec.Builder("lifeos-auth",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());gen.generateKey();
  }
  return (SecretKey)ks.getKey("lifeos-auth",null);
 }
 @PluginMethod public void secretGet(PluginCall call){
  try{
   String value=secrets().getString(secretName(call),null);
   JSObject result=new JSObject();
   if(value==null)result.put("value",JSONObject.NULL);
   else{
    String[] pieces=value.split(":",2);Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");
    cipher.init(Cipher.DECRYPT_MODE,secretKey(),new GCMParameterSpec(128,Base64.decode(pieces[0],Base64.NO_WRAP)));
    result.put("value",new String(cipher.doFinal(Base64.decode(pieces[1],Base64.NO_WRAP)),StandardCharsets.UTF_8));
   }
   call.resolve(result);
  }catch(Exception e){call.reject("Secure account storage is unavailable. No fallback storage was used.");}
 }
 @PluginMethod public void secretSet(PluginCall call){
  try{
   String key=secretName(call),value=call.getString("value");
   if(value==null||value.length()>65536)throw new IllegalArgumentException();
   Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,secretKey());
   String encoded=Base64.encodeToString(cipher.getIV(),Base64.NO_WRAP)+":"+Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)),Base64.NO_WRAP);
   if(!secrets().edit().putString(key,encoded).commit())throw new IOException();call.resolve();
  }catch(Exception e){call.reject("Secure account storage could not be saved.");}
 }
 @PluginMethod public void secretRemove(PluginCall call){
  try{if(!secrets().edit().remove(secretName(call)).commit())throw new IOException();call.resolve();}
  catch(Exception e){call.reject("Secure account storage could not be cleared.");}
 }
 @PluginMethod public void exportFile(PluginCall call){
  try{
   String name=call.getString("name",""),value=call.getString("value");
   if(!name.matches("[a-zA-Z0-9_.-]{1,120}\\.json")||value==null||value.length()>25000000)throw new IllegalArgumentException();
   File directory=new File(getContext().getCacheDir(),"exports");directory.mkdirs();
   // Retain at most one temporary export; recipients receive a read-only URI grant.
   File[] previous=directory.listFiles();if(previous!=null)for(File file:previous)file.delete();
   File file=new File(directory,name);try(FileOutputStream out=new FileOutputStream(file)){out.write(value.getBytes(StandardCharsets.UTF_8));}
   Uri uri=FileProvider.getUriForFile(getContext(),getContext().getPackageName()+".fileprovider",file);
   Intent intent=new Intent(Intent.ACTION_SEND).setType("application/json").putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
   intent.setClipData(ClipData.newRawUri("LifeOS backup",uri));
   getActivity().startActivity(Intent.createChooser(intent,"Save LifeOS backup"));call.resolve();
  }catch(Exception e){call.reject("Could not open backup sharing. Try again.");}
 }
 @PluginMethod public void listPlaces(PluginCall call){
  try{JSObject result=new JSObject();result.put("places",Geo.places(getContext()));call.resolve(result);}
  catch(Exception e){call.reject("Saved places are unreadable.");}
 }
 @PluginMethod public void setPlaces(PluginCall call){
  try{
   JSONArray places=call.getArray("places");Geo.validate(places);
   if(!Geo.preferences(getContext()).edit().putString("places",places.toString()).commit())throw new IOException();
   if(Geo.enabled(getContext()))Geo.register(getContext()).addOnSuccessListener(v->call.resolve()).addOnFailureListener(e->{
    Geo.preferences(getContext()).edit().putBoolean("enabled",false).apply();call.reject("Places saved, but reminders could not be updated. Enable them again.");
   });else call.resolve();
  }catch(Exception e){call.reject("Could not save places.");}
 }
 @PluginMethod public void placeStatus(PluginCall call){JSObject result=new JSObject();result.put("enabled",Geo.enabled(getContext()));call.resolve(result);}
 @PluginMethod public void currentLocation(PluginCall call){
  if(getPermissionState("location")!=PermissionState.GRANTED){requestPermissionForAlias("location",call,"locationPermission");return;}
  var request=new CurrentLocationRequest.Builder().setPriority(Priority.PRIORITY_BALANCED_POWER_ACCURACY).setDurationMillis(15000).setMaxUpdateAgeMillis(60000).build();
  try{LocationServices.getFusedLocationProviderClient(getContext()).getCurrentLocation(request,null).addOnSuccessListener(location->{
   if(location==null){call.reject("Location unavailable. Check phone location settings and retry.");return;}
   JSObject result=new JSObject();result.put("latitude",location.getLatitude());result.put("longitude",location.getLongitude());call.resolve(result);
  }).addOnFailureListener(e->call.reject("Location unavailable. Manual tracking still works."));}
  catch(SecurityException e){call.reject("Location permission changed. Enable precise location and try again.");}
 }
 @PermissionCallback private void locationPermission(PluginCall call){
  if(getPermissionState("location")!=PermissionState.GRANTED){call.reject("Precise location permission was not granted. Manual tracking still works.");return;}
  if(call.getMethodName().equals("currentLocation"))currentLocation(call);else enablePlaces(call);
 }
 @PluginMethod public void enablePlaces(PluginCall call){
  try{
   if(Geo.places(getContext()).length()==0){call.reject("Save a place first.");return;}
   if(getPermissionState("location")!=PermissionState.GRANTED){requestPermissionForAlias("location",call,"locationPermission");return;}
   if(Build.VERSION.SDK_INT>=33&&getPermissionState("notifications")!=PermissionState.GRANTED){requestPermissionForAlias("notifications",call,"notificationPermission");return;}
   if(Build.VERSION.SDK_INT>=29&&getPermissionState("background")!=PermissionState.GRANTED){
    if(Build.VERSION.SDK_INT==29){requestPermissionForAlias("background",call,"backgroundPermission");return;}
    getActivity().startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getContext().getPackageName())));
    call.reject("In Android settings choose Location > Allow all the time, then return and enable reminders again.");return;
   }
   if(!getContext().getSystemService(NotificationManager.class).areNotificationsEnabled()){call.reject("Enable LifeOS notifications in Android settings first.");return;}
   Geo.register(getContext()).addOnSuccessListener(v->{Geo.preferences(getContext()).edit().putBoolean("enabled",true).apply();call.resolve();})
    .addOnFailureListener(e->call.reject("Arrival monitoring could not start. Check location services and Google Play services."));
  }catch(Exception e){call.reject("Arrival reminders unavailable. Manual tracking still works.");}
 }
 @PermissionCallback private void notificationPermission(PluginCall call){
  if(getPermissionState("notifications")!=PermissionState.GRANTED){call.reject("Notification permission was not granted.");return;}enablePlaces(call);
 }
 @PermissionCallback private void backgroundPermission(PluginCall call){
  if(getPermissionState("background")!=PermissionState.GRANTED){call.reject("Background location permission was not granted.");return;}enablePlaces(call);
 }
 @PluginMethod public void disablePlaces(PluginCall call){
  // Persist first: any already queued receiver must stop immediately.
  Geo.preferences(getContext()).edit().putBoolean("enabled",false).apply();
  Geo.remove(getContext()).addOnCompleteListener(task->call.resolve());
 }
}
