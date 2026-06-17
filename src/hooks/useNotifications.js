// src/hooks/useNotifications.js
import { useCallback } from 'react'
import { supabase } from '../lib/supabase'

const EDGE_FUNCTION_URL = `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`

async function callNotify(type, data = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ type, data }),
    })
  } catch (e) {
    console.error('Notify error:', e)
  }
}

export function useNotifications() {
  // Уведомить о новой заявке
  const notifyNewRequest = useCallback((requestData) => {
    return callNotify('new_request', requestData)
  }, [])

  // Проверить предстоящие тренировки
  const checkUpcomingSessions = useCallback(() => {
    return callNotify('upcoming_sessions')
  }, [])

  // Проверить заканчивающиеся балансы
  const checkLowBalances = useCallback(() => {
    return callNotify('low_balance')
  }, [])

  // Напомнить клиенту о тренировке
  const remindClient = useCallback((clientChatId, clientName, time, duration) => {
    return callNotify('remind_client', {
      client_chat_id: clientChatId,
      client_name: clientName,
      time,
      duration,
    })
  }, [])

  // Напомнить клиенту об оплате
  const remindPayment = useCallback((clientChatId, clientName, remaining) => {
    return callNotify('remind_payment', {
      client_chat_id: clientChatId,
      client_name: clientName,
      remaining,
    })
  }, [])

  return {
    notifyNewRequest,
    checkUpcomingSessions,
    checkLowBalances,
    remindClient,
    remindPayment,
  }
}
