let cacheName = 'bks-assets';
let assets = [
  '',
  'manifest.json',
  'index.html',
  'css/style.css',
  'js/app.js',
  'js/jquery-3.5.1.slim.min.js',
  'js/qrcode.min.js',
  'js/jsqrcode/grid.js',
  'js/jsqrcode/version.js',
  'js/jsqrcode/detector.js',
  'js/jsqrcode/formatinf.js',
  'js/jsqrcode/errorlevel.js',
  'js/jsqrcode/bitmat.js',
  'js/jsqrcode/datablock.js',
  'js/jsqrcode/bmparser.js',
  'js/jsqrcode/datamask.js',
  'js/jsqrcode/rsdecoder.js',
  'js/jsqrcode/gf256poly.js',
  'js/jsqrcode/gf256.js',
  'js/jsqrcode/decoder.js',
  'js/jsqrcode/qrcode.js',
  'js/jsqrcode/findpat.js',
  'js/jsqrcode/alignpat.js',
  'js/jsqrcode/databr.js',
  'icons/handshake_192.png',
  'icons/handshake_512.png',
  'android-chrome-192x192.png',
  'android-chrome-512x512.png',
  'apple-touch-icon.png',
  'browserconfig.xml',
  'favicon-16x16.png',
  'favicon-32x32.png',
  'favicon.ico',
  'mstile-150x150.png',
  'safari-pinned-tab.svg',
  'site.webmanifest'
];

let assetUrls = assets.map((asset) => {
  if(asset === '') {
    let pathname = self.location.pathname;
    return pathname.slice(0, pathname.length - 17);
  } else {
    let url = new URL(asset, self.location)
    return url.toString();
  }
});

self.addEventListener('install', installEvent => {
  self.skipWaiting();
  let hasCacheStorage = false;

  installEvent.waitUntil(
    caches.open(cacheName).then(cache => {
      cache.addAll(assetUrls);
    })
  );
});

self.addEventListener('fetch', fetchEvent => {
  fetchEvent.respondWith(
    caches.open(cacheName).then((cache) => {
      fetchData = fetch(fetchEvent.request).then((response) => {
        cache.put(fetchEvent.request, response.clone())
        return response;
      })
      return caches.match(fetchEvent.request).then(res => {
        return res || fetchData;
      })
    })
  )
});