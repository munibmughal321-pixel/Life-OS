import {readdir, readFile, lstat} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

export const releasePages = ['index.html', 'welcome.html', 'dashboard.html', 'login.html',
  'signup.html', 'verify-email.html', 'forgot-password.html', 'reset-password.html', 'account.html'];
const rootFiles = new Set([...releasePages, 'manifest.webmanifest', 'sw.js']);
const assetTypes = new Set(['.js', '.css', '.png', '.svg', '.webp', '.ico', '.woff', '.woff2', '.mp3', '.wav', '.webmanifest']);
const forbidden = /(^|\/)(misc|node_modules|tests|supabase|android|ios|backend|scripts|\.git)(\/|$)|(^|\/)\.[^/]+|(^|\/)(auth|data)\.json$|\.(map|pem|key|jks|keystore|p12|mobileprovision)$/i;
const secret = /sb_secret_[A-Za-z0-9_-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{20,}|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/;

export async function auditRelease(directory) {
  const root = resolve(directory), files = [];
  async function walk(folder, prefix = '') {
    for (const entry of await readdir(folder, {withFileTypes: true})) {
      const relative = prefix + entry.name;
      const full = resolve(folder, entry.name);
      if ((await lstat(full)).isSymbolicLink()) throw new Error('Symbolic link in release: ' + relative);
      if (forbidden.test(relative)) throw new Error('Private/source-only path in release: ' + relative);
      if (entry.isDirectory()) {
        if (!['assets', 'js', 'css'].includes(relative.split('/')[0])) throw new Error('Unexpected release directory: ' + relative);
        await walk(full, relative + '/');
      } else {
        if (!rootFiles.has(relative) &&
            !(/^(assets|js|css)\//.test(relative) && assetTypes.has(extname(relative)))) {
          throw new Error('Unexpected release file: ' + relative);
        }
        files.push(relative);
      }
    }
  }
  await walk(root);
  const available = new Set(files);
  for (const required of rootFiles) if (!available.has(required)) throw new Error('Missing release file: ' + required);
  for (const file of files) {
    if (!['.html', '.js', '.css', '.svg', '.webmanifest'].includes(extname(file))) continue;
    const content = await readFile(resolve(root, file), 'utf8');
    if (secret.test(content)) throw new Error('Possible credential in release file: ' + file);
    if (extname(file) !== '.html') continue;
    for (const match of content.matchAll(/(?:src|href)=["']([^"'<>]+)["']/g)) {
      const value = match[1];
      if (/^(?:[a-z]+:|\/\/|#)/i.test(value)) continue;
      const url = new URL(value, 'https://release.invalid/' + file);
      const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
      const local = resolve(root, relative);
      if (!local.startsWith(root + sep) || !available.has(relative)) {
        throw new Error('Broken local reference in ' + file + ': ' + relative);
      }
    }
  }
  const worker = await readFile(resolve(root, 'sw.js'), 'utf8');
  const match = worker.match(/const FILES=(\[[^;]+\]);/);
  if (!match) throw new Error('Offline shell file list missing.');
  const cached = JSON.parse(match[1]);
  if (new Set(cached).size !== cached.length ||
      cached.some(file => !available.has(file) || file === 'sw.js') ||
      files.filter(file => file !== 'sw.js').some(file => !cached.includes(file))) {
    throw new Error('Offline shell does not match the published artifact.');
  }
  return {files: files.length, pages: releasePages.length};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await auditRelease(fileURLToPath(new URL('../dist/', import.meta.url)));
    console.log('Release artifact checked: ' + result.files + ' files, ' + result.pages + ' pages; no archive, source-only paths or recognized secret patterns.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
