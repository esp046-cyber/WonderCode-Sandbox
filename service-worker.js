const V='wcs-v2',ASSETS=['./','index.html','offline.html','style.css','app.js','js/db.js','js/validator.js','js/templates.js','js/tag-converter.js','manifest.webmanifest','icons/favicon.svg','icons/icon-192.svg','icons/icon-512.svg','js/editor.js','sw-register.js','404.html','privacy.html','terms.html'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;
  const tpl=e.request.url.includes('templates.js');
  e.respondWith(caches.match(e.request).then(hit=>{const net=fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r}).catch(()=>hit||caches.match('offline.html'));
    return tpl?(hit||net):(hit||net)}))});
