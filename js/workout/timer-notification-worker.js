self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("notificationclick", event => {
    event.notification.close();
    event.waitUntil((async () => {
        const url = new URL("../../index.html", self.location.href).href;
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const client = clients.find(item => item.url === url || item.url === new URL("../../", self.location.href).href);
        if (client) await client.focus();
        else await self.clients.openWindow(url);
    })());
});
