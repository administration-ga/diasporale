// Dupliqué de ANTSIA/apps/antsia_ga/src/lib/notification-worker.ts @ 8e2485a — adaptations : script de fond UNIQUE du site (MO-05) ; version et réserve de la seule page hors-ligne (installation, effacement des anciennes réserves, repli des navigations hors réseau, reconstitution après une purge) ; prise de main sans rechargement forcé ; script de retrait propre ; titre et préfixe d'étiquette DIASPORALE ; porte d'ouverture facultative (`openPath: null` tant que DS-14 et MO-06 ne l'ont pas posée : le clic ouvre alors `fallbackPath`, sans référence). Écouteurs `push` et `notificationclick` et charge utile fermée inchangés.

/** Les seules adresses du script proviennent de la table des routes de l'application. */
export interface ServiceWorkerConfiguration {
  /** Version : nom de la réserve, et octets du script changés à chaque montée. */
  readonly version: number
  /** Préfixe des réserves du script (`OFFLINE_CACHE_PREFIX`). */
  readonly cachePrefix: string
  /** La page hors-ligne, seule réserve. */
  readonly offlinePath: string
  readonly title: string
  readonly messages: { readonly fr: string; readonly en: string }
  readonly tagPrefix: string
  /** Porte d'ouverture d'une notification (DS-14, MO-06). Absente : le clic ouvre `fallbackPath`. */
  readonly openPath: string | null
  readonly fallbackPath: string
  readonly referenceParam: string
}

/**
 * Script autonome : aucun contenu privé, aucune adresse venue d'une charge utile, aucune action
 * de réponse automatique. Il ne met en réserve QUE la page hors-ligne ; les autres requêtes ne
 * sont pas interceptées, et une navigation n'est jamais mise en réserve.
 */
export function serviceWorkerScript(configuration: ServiceWorkerConfiguration): string {
  return `const config=${JSON.stringify(configuration)};
const CACHE=config.cachePrefix+config.version;
const offlineUrl=()=>new URL(config.offlinePath,self.registration.scope).href;
const reserveOffline=async()=>{
 const response=await fetch(new Request(offlineUrl(),{cache:'no-store',credentials:'same-origin',redirect:'error'}));
 if(!response.ok||response.type!=='basic')throw new Error('offline-page');
 const cache=await caches.open(CACHE);
 await cache.put(offlineUrl(),response);
};
const restoreOffline=async()=>{try{const cache=await caches.open(CACHE);if(!(await cache.match(offlineUrl())))await reserveOffline()}catch{}};
self.addEventListener('install',event=>{event.waitUntil(reserveOffline().then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith(config.cachePrefix)&&name!==CACHE).map(name=>caches.delete(name)));
 if(self.registration.navigationPreload)await self.registration.navigationPreload.enable();
 await self.clients.claim();
})())});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.mode!=='navigate'||request.method!=='GET')return;
 if(new URL(request.url).origin!==new URL(self.registration.scope).origin)return;
 event.respondWith((async()=>{
  try{
   const response=(await event.preloadResponse)||(await fetch(request));
   event.waitUntil(restoreOffline());
   return response;
  }catch{
   return (await caches.match(offlineUrl(),{cacheName:CACHE}))||Response.error();
  }
 })());
});
const referenceOf=value=>typeof value==='string'&&value.length>0&&value.length<=64&&!/[^a-zA-Z0-9_-]/.test(value)?value:null;
self.addEventListener('push',event=>{event.waitUntil((async()=>{
 let payload;try{payload=event.data?.json()}catch{return}
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return;
 if(Object.keys(payload).sort().join('|')!=='count|locale|networkId|reference|url|version')return;
 const reference=referenceOf(payload.reference);
 if(payload.version!==1||!reference||typeof payload.networkId!=='string'||typeof payload.url!=='string')return;
 if(!Number.isInteger(payload.count)||payload.count<1||payload.count>100||(payload.locale!=='fr'&&payload.locale!=='en'))return;
 await self.registration.showNotification(config.title,{body:config.messages[payload.locale],tag:config.tagPrefix+reference,data:{reference}});
})())});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil((async()=>{
 const reference=referenceOf(event.notification.data?.reference);
 const opening=reference&&config.openPath?config.openPath:null;
 const destination=new URL(opening??config.fallbackPath,self.registration.scope);
 if(destination.origin!==new URL(self.registration.scope).origin)return;
 if(opening)destination.searchParams.set(config.referenceParam,reference);
 const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of windows){
  try{
   if(new URL(client.url).origin!==destination.origin)continue;
   const moved=await client.navigate(destination.href);
   if(!moved)continue;
   await moved.focus();return;
  }catch{continue}
 }
 await self.clients.openWindow(destination.href);
})())});`
}

/**
 * Le script de retrait (`SERVICE_WORKER_RETIRED`) : il prend la main, efface les réserves du
 * préfixe et se désinscrit. Aucun écouteur de requête : les pages passent directement au réseau.
 */
export function retiredServiceWorkerScript(configuration: { readonly cachePrefix: string }): string {
  return `const config=${JSON.stringify({ cachePrefix: configuration.cachePrefix })};
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting())});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith(config.cachePrefix)).map(name=>caches.delete(name)));
 await self.registration.unregister();
})())});`
}
