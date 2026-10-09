/* 용마미식거리 서비스워커 — "앱으로 설치" 를 가능하게 하는 최소 구성.
   일정·사진이 자주 바뀌는 사이트라 페이지를 저장해 두지 않는다(항상 최신을 받아 온다).
   인터넷이 끊겼을 때만 저장해 둔 안내 화면(offline.html)을 보여 준다. */
const CACHE = "yongma-offline-v1";
const OFFLINE = ["/offline.html", "/assets/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  // 예전 버전 저장분 정리
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  // 페이지 이동만 가로챈다 — 실패(오프라인)하면 안내 화면. 그 밖의 요청은 브라우저가 평소대로 처리.
  if (e.request.mode !== "navigate") return;
  e.respondWith(fetch(e.request).catch(() => caches.match("/offline.html")));
});
