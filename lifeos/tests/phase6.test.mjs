import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, cp, writeFile, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {validateDeployEnv} from '../scripts/check-deploy-env.mjs';
import {auditRelease} from '../scripts/check-release.mjs';

const valid = {
  VITE_SUPABASE_URL: 'https://nfuakxpnixexbuzgiyeg.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(32)
};
test('deploy configuration rejects missing, privileged, unexpected and wrong-project values without echoing them', () => {
  assert.doesNotThrow(() => validateDeployEnv(valid));
  for (const changes of [
    {VITE_SUPABASE_URL: ''}, {VITE_SUPABASE_URL: 'http://nfuakxpnixexbuzgiyeg.supabase.co'},
    {VITE_SUPABASE_URL: 'https://other-project.supabase.co'},
    {VITE_SUPABASE_URL: valid.VITE_SUPABASE_URL + '/auth'},
    {VITE_SUPABASE_PUBLISHABLE_KEY: 'YOUR_PUBLISHABLE_KEY'},
    {VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_do_not_echo_me'},
    {VITE_DATABASE_PASSWORD: 'do_not_echo_me'}
  ]) {
    assert.throws(() => validateDeployEnv({...valid, ...changes}), error => !error.message.includes('do_not_echo_me'));
  }
});
test('built release contains complete pages and only public artifacts', async () => {
  const result = await auditRelease('dist');
  assert.equal(result.pages, 9);
});
test('artifact guard catches private files, embedded secrets and broken assets', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'lifeos-release-'));
  const build = join(folder, 'dist');
  try {
    await cp('dist', build, {recursive: true});
    await writeFile(join(build, '.env'), 'PRIVATE=true');
    await assert.rejects(auditRelease(build), /Private\/source-only/);
    await rm(join(build, '.env'));
    await writeFile(join(build, 'assets', 'unexpected.js'), 'sb_secret_do_not_echo_me');
    await assert.rejects(auditRelease(build), error => /credential/.test(error.message) && !error.message.includes('do_not_echo_me'));
    await rm(join(build, 'assets', 'unexpected.js'));
    const index = join(build, 'index.html');
    await writeFile(index, (await readFile(index, 'utf8')) + '<img src="missing.png">');
    await assert.rejects(auditRelease(build), /Broken local reference/);
  } finally { await rm(folder, {recursive: true, force: true}); }
});
