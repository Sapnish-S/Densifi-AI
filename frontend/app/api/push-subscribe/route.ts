import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { saveNotificationPrefs } from "@/app/actions/notifications"

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { endpoint, keys } = body as {
    endpoint: string
    keys: { p256dh: string; auth: string }
  }

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription object" }, { status: 400 })
  }

  await saveNotificationPrefs({
    pushEnabled: true,
    pushEndpoint: endpoint,
    pushP256dh: keys.p256dh,
    pushAuth: keys.auth,
  })

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await saveNotificationPrefs({
    pushEnabled: false,
    pushEndpoint: null,
    pushP256dh: null,
    pushAuth: null,
  })

  return NextResponse.json({ success: true })
}
