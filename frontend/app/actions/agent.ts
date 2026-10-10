"use server"

import { getServerApiUrl, internalApiHeaders } from "@/lib/api-url"
import { auth } from "@/lib/auth"
import { query } from "@/lib/db"
import { headers } from "next/headers"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"

async function getUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

function todayString() {
  return new Date().toISOString().slice(0, 10)
}

export async function getAgentMessages() {
  const userId = await getUserId()
  const res = await query(
    `SELECT id, role, content, "photoId", "createdAt" FROM agent_message WHERE "userId" = $1 ORDER BY "createdAt" ASC`,
    [userId],
  )
  return res.rows as {
    id: string
    role: "user" | "assistant"
    content: string
    photoId: string | null
    createdAt: string
  }[]
}

export async function getDailyCount(): Promise<number> {
  const userId = await getUserId()
  const today = todayString()
  const res = await query(
    `SELECT count FROM agent_daily_count WHERE "userId" = $1 AND date = $2 LIMIT 1`,
    [userId, today],
  )
  return res.rows[0]?.count ?? 0
}

// Removed hardcoded SCRIPTED_REPLIES and scriptedReply

export async function sendAgentMessage(content: string, photoId?: string) {
  const userId = await getUserId()

  const profileRes = await query(
    `SELECT tier FROM profile WHERE "userId" = $1 LIMIT 1`,
    [userId],
  )
  const tier = profileRes.rows[0]?.tier ?? "free"
  const today = todayString()

  if (tier === "free") {
    const countRes = await query(
      `SELECT count FROM agent_daily_count WHERE "userId" = $1 AND date = $2 LIMIT 1`,
      [userId, today],
    )
    const count = countRes.rows[0]?.count ?? 0
    if (count >= 1) {
      throw new Error("DAILY_LIMIT_REACHED")
    }
  }

  const userMsgId = randomUUID()
  await query(
    `INSERT INTO agent_message (id, "userId", role, content, "photoId") VALUES ($1, $2, $3, $4, $5)`,
    [userMsgId, userId, "user", content, photoId ?? null],
  )

  const rawApiUrl = getServerApiUrl()
  const apiUrl = rawApiUrl.replace(/\/+$/, "")
  let replyContent = "I'm currently unable to process your request."
  
  try {
    // Fetch last 10 messages for context
    const previousMessages = await getAgentMessages()
    const history = previousMessages.slice(-10).map(m => ({
      role: m.role,
      content: m.content
    }))

    const res = await fetch(`${apiUrl}/agent-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...internalApiHeaders() },
      body: JSON.stringify({ 
        user_id: userId, 
        message: content,
        history: history
      }),
      cache: "no-store",
    })
    if (res.ok) {
      const data = await res.json()
      replyContent = data.reply || replyContent
    } else {
      console.error("[agent] Chat API returned", res.status)
    }
  } catch (err) {
    console.error("[agent] Chat API fetch failed:", err)
  }
  const assistantMsgId = randomUUID()
  await query(
    `INSERT INTO agent_message (id, "userId", role, content) VALUES ($1, $2, $3, $4)`,
    [assistantMsgId, userId, "assistant", replyContent],
  )

  if (tier === "free") {
    const existing = await query(
      `SELECT id FROM agent_daily_count WHERE "userId" = $1 AND date = $2 LIMIT 1`,
      [userId, today],
    )
    if (existing.rows.length > 0) {
      await query(
        `UPDATE agent_daily_count SET count = count + 1 WHERE "userId" = $1 AND date = $2`,
        [userId, today],
      )
    } else {
      await query(
        `INSERT INTO agent_daily_count (id, "userId", date, count) VALUES ($1, $2, $3, $4)`,
        [randomUUID(), userId, today, 1],
      )
    }
  }

  revalidatePath("/")
  return replyContent
}

export async function saveAnalysisResult(photoId: string, result: any) {
  const userId = await getUserId()
  const msgId = randomUUID()
  const content = JSON.stringify(result)
  
  await query(
    `INSERT INTO agent_message (id, "userId", role, content, "photoId") VALUES ($1, $2, $3, $4, $5)`,
    [msgId, userId, "assistant", content, photoId],
  )
  revalidatePath("/")
}
