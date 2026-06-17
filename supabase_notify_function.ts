import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const TELEGRAM_TOKEN = "8966261389:AAESoUB9diiMADztvEZtrM14jbdWqRX3tRg"
const TRAINER_CHAT_ID = "366687870"
const BOT_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

async function sendTelegram(chatId: string, text: string) {
  await fetch(`${BOT_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  })
}

serve(async (req) => {
  // Обязательно для CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { type, data } = await req.json()

    if (type === "new_request") {
      await sendTelegram(TRAINER_CHAT_ID,
        `🆕 <b>Новая заявка!</b>\n\n` +
        `👤 <b>${data.full_name}</b>\n` +
        `📧 ${data.email}\n` +
        `📱 ${data.phone || "не указан"}\n` +
        `🎯 ${data.goal || "не указана"}\n` +
        `💬 ${data.message || ""}\n\n` +
        `👉 Открой CRM для подтверждения`
      )
    }

    if (type === "upcoming_sessions") {
      const now = new Date()
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      const { data: sessions } = await supabase.from("schedule")
        .select("*, clients(full_name)").eq("status", "planned")
        .gte("scheduled_at", now.toISOString()).lte("scheduled_at", in24h.toISOString())
      if (sessions?.length) {
        let msg = `📅 <b>Тренировки на завтра:</b>\n\n`
        for (const s of sessions) {
          const time = new Date(s.scheduled_at).toLocaleString("ru-UA", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })
          msg += `• ${s.clients?.full_name} — <b>${time}</b> (${s.duration_minutes} мин)\n`
        }
        await sendTelegram(TRAINER_CHAT_ID, msg)
      } else {
        await sendTelegram(TRAINER_CHAT_ID, `📅 Тренировок на ближайшие 24 часа нет`)
      }
    }

    if (type === "low_balance") {
      const { data: balances } = await supabase.from("client_session_balance")
        .select("*").lte("sessions_remaining", 2).gte("sessions_remaining", 0)
      if (balances?.length) {
        let msg = `⚠️ <b>Заканчиваются тренировки:</b>\n\n`
        for (const b of balances) msg += `• ${b.full_name} — осталось <b>${b.sessions_remaining}</b> тр.\n`
        await sendTelegram(TRAINER_CHAT_ID, msg + `\n👉 Свяжись с клиентами`)
      } else {
        await sendTelegram(TRAINER_CHAT_ID, `✅ У всех клиентов достаточно тренировок`)
      }
    }

    if (type === "remind_client" && data?.client_chat_id) {
      await sendTelegram(data.client_chat_id,
        `💪 <b>Напоминание о тренировке!</b>\n\nПривет, ${data.client_name}!\nЗавтра тренировка в <b>${data.time}</b> (${data.duration} мин)\n\nНе забудь воду! 🌙`)
    }

    if (type === "remind_payment" && data?.client_chat_id) {
      await sendTelegram(data.client_chat_id,
        `💳 <b>Напоминание об оплате</b>\n\nПривет, ${data.client_name}!\nОсталось <b>${data.remaining}</b> тренировок.\nСвяжись с тренером для продления 💪`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
