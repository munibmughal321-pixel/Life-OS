import { defineConfig } from 'vite';

import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const pages=['index.html','welcome.html','dashboard.html','login.html','signup.html','verify-email.html','forgot-password.html','reset-password.html','account.html'];
const accountPages=['dashboard.html','login.html','signup.html','verify-email.html','forgot-password.html','reset-password.html','account.html'];
async function filesWithin(directory,prefix=''){
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=prefix+entry.name;
    if(entry.isDirectory())result.push(...await filesWithin(directory+'/'+entry.name,path+'/'));
    else result.push(path);
  }
  return result.sort();
}
export default defineConfig({
  base: './',
  build: { rollupOptions: { input: Object.fromEntries(pages.map(page=>[page.replace('.html',''),root+page])) } },
  plugins: [{
    name: 'preserve-classic-dashboard',
    async closeBundle() {
      // Existing dashboard scripts share globals; copying preserves their load order.
      await mkdir(`${root}dist`, { recursive: true });
      for (const path of ['js','css','assets','manifest.webmanifest']) {
        await cp(`${root}${path}`, `${root}dist/${path}`, { recursive: true });
      }
      for(const page of pages){
        const file=`${root}dist/${page}`;
        const html=await readFile(file,'utf8');
        await writeFile(file,html.replace('</head>','<meta name="lifeos-offline-build" content="1">\n</head>'));
      }
      const paths=(await filesWithin(`${root}dist`)).filter(path=>path!=='sw.js');
      const digest=createHash('sha256');
      for(const path of paths){digest.update(path);digest.update(await readFile(`${root}dist/${path}`));}
      const version=digest.digest('hex').slice(0,20);
      // Content-derived versions ensure unchanged builds do not invalidate offline caches.
      const worker=`const VERSION=${JSON.stringify(version)};
const FILES=${JSON.stringify(paths)};
const PREFIX='lifeos-shell-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE=PREFIX+VERSION;
const urls=FILES.map(path=>new URL(path,self.registration.scope).href);
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(urls)));});
// No skipWaiting: updates cannot replace a page containing an unfinished draft.
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
  for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);
  await self.clients.claim();
})());});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url),scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin)return;
  if(url.pathname===scope.pathname)url.pathname+='index.html';
  url.search='';url.hash='';
  if(!urls.includes(url.href))return; // Never cache auth/API calls or unrelated routes.
  event.respondWith(caches.open(CACHE).then(async cache=>(await cache.match(url.href)) || fetch(event.request)));
});
`;
      await writeFile(`${root}dist/sw.js`,worker);
    }
  }]
});
