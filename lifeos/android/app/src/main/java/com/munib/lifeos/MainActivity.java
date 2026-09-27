package com.munib.lifeos;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
 @Override public void onCreate(Bundle savedInstanceState) {
  registerPlugin(LifeOSDevicePlugin.class);
  super.onCreate(savedInstanceState);
 }
}
