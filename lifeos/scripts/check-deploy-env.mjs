import {loadEnv} from 'vite';
import {fileURLToPath, pathToFileURL} from 'node:url';

export function validateDeployEnv(env) {
  const allowed = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']);
  const errors = [];
  if (Object.keys(env).some(name => name.startsWith('VITE_') && !allowed.has(name))) {
    errors.push('Unexpected VITE_ variable: only the project URL and publishable key may be exposed.');
  }
  let url;
  try { url = new URL(env.VITE_SUPABASE_URL); } catch {}
  const expected = env.LIFEOS_SUPABASE_PROJECT_REF || 'nfuakxpnixexbuzgiyeg';
  if (!/^[a-z]{20}$/.test(expected) || !url || url.protocol !== 'https:' ||
      url.hostname !== expected + '.supabase.co' || url.port || url.username ||
      url.password || url.search || url.hash || url.pathname !== '/') {
    errors.push('Set VITE_SUPABASE_URL to the intended LifeOS HTTPS project URL. A different project requires LIFEOS_SUPABASE_PROJECT_REF.');
  }
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key) ||
      /YOUR_|placeholder|test_only/i.test(key)) {
    errors.push('Set a real VITE_SUPABASE_PUBLISHABLE_KEY. Secret/service-role keys and placeholders are forbidden.');
  }
  if (errors.length) throw new Error(errors.join('\n'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const root = fileURLToPath(new URL('../', import.meta.url));
    validateDeployEnv({...loadEnv('production', root, 'VITE_'), ...process.env});
    console.log('Deployment environment checked (values are not logged).');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
