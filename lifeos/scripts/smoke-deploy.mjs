import {releasePages} from './check-release.mjs';

// Static HTTP checks only: never create users or submit personal data.
try {
  const base = new URL(process.argv[2]);
  const local = process.argv.includes('--local');
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      (base.protocol !== 'https:' && !(local && base.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(base.hostname)))) {
    throw new Error('Provide an HTTPS site origin (or loopback HTTP with --local).');
  }
  const checks = [...releasePages, 'sw.js', 'manifest.webmanifest', 'assets/icons8-favicon-50.apng.png'];
  for (const path of checks) {
    const response = await fetch(new URL(path, base), {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    if (response.status !== 200) throw new Error(path + ': expected HTTP 200 without a redirect; received ' + response.status);
    const type = response.headers.get('content-type') || '';
    const expected = path.endsWith('.html') ? /text\/html/ : path.endsWith('.js') ? /javascript/ :
      path.endsWith('.png') ? /image\/png/ : /json|manifest/;
    if (!expected.test(type)) throw new Error(path + ': unexpected content type.');
    if (!local) {
      if (response.headers.get('x-content-type-options') !== 'nosniff' ||
          response.headers.get('x-frame-options') !== 'DENY' ||
          response.headers.get('referrer-policy') !== 'no-referrer') {
        throw new Error(path + ': expected deployment security headers are missing.');
      }
      if (path === 'sw.js' && !/no-store/.test(response.headers.get('cache-control') || '')) {
        throw new Error('Service worker must revalidate rather than use an old HTTP cache.');
      }
    }
    await response.arrayBuffer();
  }
  for (const path of ['misc/node-server-prototype/auth.json', '.env', 'supabase/config.toml', 'does-not-exist.html']) {
    const response = await fetch(new URL(path, base), {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    if (response.status !== 404) throw new Error(path + ': expected HTTP 404; check publish directory and catch-all rewrites.');
    await response.arrayBuffer();
  }
  console.log('Static smoke checks passed: 12 public routes and 4 missing/private paths.' +
    (local ? ' Local mode does not verify Netlify headers.' : ' Deployment headers verified.'));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
