// Densify Service Worker — Web Push Notification handler
// Receives push events from the server and shows native OS notifications.

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: "Densify", body: event.data.text() }
  }

  const { title = "Densify", body = "", icon = "/icon.svg", tag, url = "/" } = payload

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      tag: tag ?? "densify-default",
      badge: "/icon.svg",
      data: { url },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const existing = clients.find((c) => c.url === url && "focus" in c)
        if (existing) return existing.focus()
        return self.clients.openWindow(url)
      }),
  )
})
