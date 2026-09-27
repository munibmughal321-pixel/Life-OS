import {existsSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT||(process.platform==='win32'?join(process.env.LOCALAPPDATA||'','Android','Sdk'):'');
const javaHome=process.env.LIFEOS_JAVA_HOME||process.env.JAVA_HOME;
const java=javaHome?join(javaHome,'bin',process.platform==='win32'?'java.exe':'java'):'java';
const javaResult=spawnSync(java,['-version'],{encoding:'utf8'});
const javaVersion=(javaResult.stderr||'')+(javaResult.stdout||'');
const javaMajor=Number(javaVersion.match(/version\s+"?(\d+)/)?.[1]);
const checks=[
 ['Node 22 or newer',Number(process.versions.node.split('.')[0])>=22],
 ['Android SDK',!!sdk&&existsSync(sdk)],
 ['Android platform 36',!!sdk&&existsSync(join(sdk,'platforms','android-36','android.jar'))],
 ['Android build tools 36',!!sdk&&existsSync(join(sdk,'build-tools','36.0.0',process.platform==='win32'?'aapt2.exe':'aapt2'))],
 ['Android platform tools',!!sdk&&existsSync(join(sdk,'platform-tools',process.platform==='win32'?'adb.exe':'adb'))],
 ['JDK 21 (supported project toolchain)',javaResult.status===0&&javaMajor===21],
 ['Android bridge project',existsSync('android/app/src/main/java/com/munib/lifeos/LifeOSDevicePlugin.java')],
 ['iOS bridge project',existsSync('ios/App/App/LifeOSDevicePlugin.swift')]
];
if(javaResult.status===0&&javaMajor!==21)console.log('Detected Java '+javaMajor+'; select JDK 21 in JAVA_HOME/Android Studio Gradle settings.');
for(const [label,ok]of checks)console.log((ok?'OK     ':'MISSING')+' '+label);
console.log(process.platform==='darwin'?'iOS: verify Xcode 26+, signing and a real iPhone.':'iOS: macOS/Xcode build and real iPhone testing required.');
if(checks.some(([,ok])=>!ok))process.exitCode=1;
