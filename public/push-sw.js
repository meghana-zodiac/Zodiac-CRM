self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? {};
  const title = payload.title || "Zodiac CRM reminder";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "You have a scheduled CRM activity.",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: payload.tag || "zodiac-crm-reminder",
      renotify: true,
      data: { href: payload.href || "/tasks" },
      actions: [{ action: "open", title: "Open CRM" }],
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = new URL(event.notification.data?.href || "/tasks", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        existing.navigate(href);
        return existing.focus();
      }
      return self.clients.openWindow(href);
    }),
  );
});
