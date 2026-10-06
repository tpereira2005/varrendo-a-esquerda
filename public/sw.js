// Service worker das notificações (também no iPhone, com o site instalado no ecrã principal).
// O servidor envia um push vazio; aqui pede-se o aviso mais recente e mostra-se a notificação.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let notice = { id: 'varrendo', title: 'Varrendo a Esquerda', detail: 'Notificações ativas ✓ (ainda não há avisos novos).' };
      try {
        const r = await fetch('/api/push/ultimo', { cache: 'no-store' });
        const latest = r.ok ? await r.json() : null;
        if (latest?.title) notice = latest;
      } catch {}
      // O iOS exige que cada push mostre uma notificação.
      await self.registration.showNotification(notice.title, {
        body: notice.detail,
        icon: '/emoji/humor-10.png',
        badge: '/favicon.svg',
        tag: notice.id,
        renotify: true,
        data: { url: '/' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const w of windows) if ('focus' in w) return w.focus();
      return self.clients.openWindow('/');
    }),
  );
});
