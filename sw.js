/* Guarda la app en el celular para que abra sin internet.
   Con internet, trae siempre la versión más nueva y la vuelve a guardar. */
const CACHE = "caja-v2";
const ARCHIVOS = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function conTiempo(promesa, ms) {
  return new Promise((ok, mal) => { const t = setTimeout(() => mal(new Error("tiempo")), ms); promesa.then((r) => { clearTimeout(t); ok(r); }, (e) => { clearTimeout(t); mal(e); }); });
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // La app: primero internet (versión nueva), si no hay o tarda, la guardada.
  if (req.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith("/index.html"))) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await conTiempo(fetch(req, { cache: "no-store" }), 4000);
        if (res && res.ok) { cache.put("./index.html", res.clone()); cache.put("./", res.clone()); }
        return res;
      } catch {
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      }
    })());
    return;
  }

  // Íconos y archivos propios: lo guardado, y se actualiza en segundo plano.
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(req);
      const red = fetch(req).then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
      return guardado || (await red) || Response.error();
    })());
    return;
  }

  // Letras de Google: se guardan la primera vez para usarlas sin internet.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(req);
      if (guardado) return guardado;
      try { const res = await fetch(req); if (res && (res.ok || res.type === "opaque")) cache.put(req, res.clone()); return res; }
      catch { return Response.error(); }
    })());
  }
});
