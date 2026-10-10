// Runs inside the Playwright container on the compose network and forwards the
// ports a real user's browser would hit on localhost, so the app's build-time
// URLs (NEXT_PUBLIC_API_URL=http://localhost:8000, S3 at localhost:9000) and
// Better Auth's origin (http://localhost:3000) behave exactly as on a laptop.
import net from "node:net"

const routes = [
  [3000, "web", 3000],
  [8000, "api", 8000],
  [9000, "s3", 8333],
]

for (const [port, host, targetPort] of routes) {
  net
    .createServer((client) => {
      const upstream = net.connect(targetPort, host)
      client.pipe(upstream).pipe(client)
      const close = () => { client.destroy(); upstream.destroy() }
      client.on("error", close)
      upstream.on("error", close)
    })
    .listen(port, "127.0.0.1", () => console.log(`forward localhost:${port} -> ${host}:${targetPort}`))
}
