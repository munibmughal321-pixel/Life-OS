import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Keep the selected Android JDK local to this build, leaving other projects alone.
const env = {...process.env};
if (env.LIFEOS_JAVA_HOME) env.JAVA_HOME = env.LIFEOS_JAVA_HOME;
const windows = process.platform === 'win32';
const result = spawnSync(windows ? 'cmd.exe' : './gradlew',
  windows ? ['/d', '/s', '/c', 'gradlew.bat :app:assembleDebug --console=plain'] : [':app:assembleDebug', '--console=plain'],
  {cwd: fileURLToPath(new URL('../android/', import.meta.url)), env, stdio: 'inherit'});
if (result.error) console.error(`Android build could not start: ${result.error.message}`);
process.exitCode = result.status ?? 1;
