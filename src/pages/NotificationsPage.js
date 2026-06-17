// src/pages/NotificationsPage.js
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useNotifications } from '../hooks/useNotifications'
import { supabase } from '../lib/supabase'
import { Bell, Send, Check, AlertCircle, MessageCircle, Users, CreditCard, Calendar } from 'lucide-react'

export default function NotificationsPage() {
  const { profile } = useAuth()
  const { checkUpcomingSessions, checkLowBalances } = useNotifications()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(null)
  const [clientTelegramIds, setClientTelegramIds] = useState({})
  const [savingIds, setSavingIds] = useState({})

  useEffect(() => {
    if (profile) loadClients()
  }, [profile])

  async function loadClients() {
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, telegram_chat_id, status')
      .eq('trainer_id', profile.id)
      .eq('status', 'active')
      .order('full_name')
    setClients(data || [])
    const ids = {}
    data?.forEach(c => { ids[c.id] = c.telegram_chat_id || '' })
    setClientTelegramIds(ids)
  }

  async function saveTelegramId(clientId) {
    setSavingIds(prev => ({ ...prev, [clientId]: true }))
    await supabase.from('clients')
      .update({ telegram_chat_id: clientTelegramIds[clientId] || null })
      .eq('id', clientId)
    setSavingIds(prev => ({ ...prev, [clientId]: false }))
    setSent(`Сохранено!`)
    setTimeout(() => setSent(null), 2000)
  }

  async function handleCheckSessions() {
    setLoading(true)
    await checkUpcomingSessions()
    setSent('✅ Уведомления о тренировках отправлены!')
    setLoading(false)
    setTimeout(() => setSent(null), 3000)
  }

  async function handleCheckBalances() {
    setLoading(true)
    await checkLowBalances()
    setSent('✅ Уведомления о балансах отправлены!')
    setLoading(false)
    setTimeout(() => setSent(null), 3000)
  }

  async function handleRemindAll() {
    setLoading(true)
    const { data: sessions } = await supabase
      .from('schedule')
      .select('*, clients(id, full_name, telegram_chat_id)')
      .eq('trainer_id', profile.id)
      .eq('status', 'planned')
      .gte('scheduled_at', new Date().toISOString())
      .lte('scheduled_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString())

    let count = 0
    for (const s of (sessions || [])) {
      if (s.clients?.telegram_chat_id) {
        const time = new Date(s.scheduled_at).toLocaleTimeString('ru-UA', { hour: '2-digit', minute: '2-digit' })
        const { data: { session: authSession } } = await supabase.auth.getSession()
        await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession?.access_token}` },
          body: JSON.stringify({
            type: 'remind_client',
            data: { client_chat_id: s.clients.telegram_chat_id, client_name: s.clients.full_name, time, duration: s.duration_minutes }
          })
        })
        count++
      }
    }
    setSent(`✅ Напоминания отправлены ${count} клиентам!`)
    setLoading(false)
    setTimeout(() => setSent(null), 3000)
  }

  async function handleRemindPayments() {
    setLoading(true)
    const { data: balances } = await supabase
      .from('client_session_balance')
      .select('*, clients(telegram_chat_id)')
      .lte('sessions_remaining', 2)
      .gte('sessions_remaining', 0)

    let count = 0
    for (const b of (balances || [])) {
      if (b.clients?.telegram_chat_id) {
        const { data: { session: authSession } } = await supabase.auth.getSession()
        await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSession?.access_token}` },
          body: JSON.stringify({
            type: 'remind_payment',
            data: { client_chat_id: b.clients.telegram_chat_id, client_name: b.full_name, remaining: b.sessions_remaining }
          })
        })
        count++
      }
    }
    setSent(`✅ Напоминания об оплате отправлены ${count} клиентам!`)
    setLoading(false)
    setTimeout(() => setSent(null), 3000)
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Уведомления</h1>
          <p className="page-subtitle">Telegram бот для тренера и клиентов</p>
        </div>
      </div>

      {sent && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 14, color: 'var(--success)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Check size={16} /> {sent}
        </div>
      )}

      {/* Инструкция */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <MessageCircle size={18} color="var(--accent)" />
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Подключение бота</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { num: 1, text: 'Открой Telegram и найди бота @VoronovskiyLabBot' },
            { num: 2, text: 'Нажми /start — бот активирован' },
            { num: 3, text: 'Для клиентов: они тоже должны написать /start боту' },
            { num: 4, text: 'Узнай Telegram ID клиента через @userinfobot и введи ниже' },
          ].map(({ num, text }) => (
            <div key={num} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{num}.</span>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Кнопки отправки уведомлений тренеру */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Bell size={18} color="var(--accent)" />
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Отправить уведомления тренеру</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleCheckSessions} disabled={loading} style={{ justifyContent: 'flex-start', gap: 12 }}>
            <Calendar size={16} color="var(--accent)" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Предстоящие тренировки</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Показывает тренировки на ближайшие 24 часа</div>
            </div>
          </button>
          <button className="btn btn-secondary" onClick={handleCheckBalances} disabled={loading} style={{ justifyContent: 'flex-start', gap: 12 }}>
            <CreditCard size={16} color="var(--warning)" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Заканчивающиеся балансы</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Клиенты у которых осталось ≤2 тренировок</div>
            </div>
          </button>
        </div>
      </div>

      {/* Кнопки рассылки клиентам */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Users size={18} color="var(--success)" />
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Рассылка клиентам</h2>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleRemindAll} disabled={loading} style={{ justifyContent: 'flex-start', gap: 12 }}>
            <Calendar size={16} color="var(--success)" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Напомнить о завтрашней тренировке</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Отправит напоминание всем у кого тренировка завтра</div>
            </div>
          </button>
          <button className="btn btn-secondary" onClick={handleRemindPayments} disabled={loading} style={{ justifyContent: 'flex-start', gap: 12 }}>
            <CreditCard size={16} color="var(--danger)" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 500 }}>Напомнить об оплате</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Клиентам у которых заканчиваются тренировки</div>
            </div>
          </button>
        </div>
      </div>

      {/* Telegram ID клиентов */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <MessageCircle size={18} color="var(--accent)" />
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Telegram ID клиентов</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Попроси клиента написать боту <b>@userinfobot</b> — он пришлёт свой ID. Введи его здесь.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map(client => (
            <div key={client.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="avatar" style={{ width: 32, height: 32, fontSize: 13, flexShrink: 0 }}>
                {client.full_name?.slice(0, 1)}
              </div>
              <span style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 80 }}>{client.full_name}</span>
              <input
                className="form-input"
                style={{ flex: 2, fontSize: 13 }}
                placeholder="Telegram ID (числа)"
                value={clientTelegramIds[client.id] || ''}
                onChange={e => setClientTelegramIds(prev => ({ ...prev, [client.id]: e.target.value }))}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={() => saveTelegramId(client.id)}
                disabled={savingIds[client.id]}
                style={{ flexShrink: 0 }}
              >
                {savingIds[client.id] ? '...' : <Check size={14} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
