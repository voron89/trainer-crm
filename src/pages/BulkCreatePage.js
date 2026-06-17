// src/pages/BulkCreatePage.js
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { Check, X, Copy, Send, RefreshCw } from 'lucide-react'

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function BulkCreatePage() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showPass, setShowPass] = useState({})
  const [sending, setSending] = useState({})

  useEffect(() => {
    if (profile) loadClients()
  }, [profile])

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('id, full_name, email, phone, login_email, login_password, telegram_chat_id')
      .eq('trainer_id', profile.id)
      .order('full_name')
    setClients(data || [])
    setLoading(false)
  }

  async function createOne(client) {
    const password = generatePassword()
    // Генерируем email если нет
    const emailRaw = client.email?.trim() || ''
    const isTelegram = emailRaw.startsWith('@')
    const phone = (client.phone || '').replace(/\D/g, '')
    
    // Генерируем email: из телефона, или из ID если нет телефона
    // НИКОГДА не используем @telegram как email
    let emailToUse
    if (!isTelegram && emailRaw && emailRaw.includes('@') && emailRaw.includes('.')) {
      emailToUse = emailRaw // настоящий email
    } else if (phone && phone.length >= 9) {
      emailToUse = `${phone}@voronovskiy-lab.com` // из телефона
    } else {
      emailToUse = `client_${client.id.slice(0,8)}@voronovskiy-lab.com` // из ID
    }
    
    const telegramUsername = isTelegram ? emailRaw : null

    setResults(prev => ({ ...prev, [client.id]: { status: 'creating', email: emailToUse, password } }))

    try {
      // Создаём через Edge Function
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          type: 'create_user',
          data: { email: emailToUse, password, full_name: client.full_name }
        }),
      })
      const data = await res.json()

      if (data.ok && data.user_id) {
        // Обновляем клиента
        await supabase.from('clients').update({
          profile_id: data.user_id,
          login_email: emailToUse,
          login_password: password,
        }).eq('id', client.id)

        setResults(prev => ({ ...prev, [client.id]: { status: 'done', email: emailToUse, password } }))
        setClients(prev => prev.map(c => c.id === client.id
          ? { ...c, profile_id: data.user_id, login_email: emailToUse, login_password: password }
          : c))
      } else {
        setResults(prev => ({ ...prev, [client.id]: { status: 'error', error: data.error || 'Ошибка', email: emailToUse, password } }))
      }
    } catch (e) {
      setResults(prev => ({ ...prev, [client.id]: { status: 'error', error: e.message, email: emailToUse, password } }))
    }
  }

  async function createAll() {
    setCreating(true)
    const noAccount = clients.filter(c => !c.login_email)
    for (const client of noAccount) {
      await createOne(client)
      await new Promise(r => setTimeout(r, 300)) // небольшая пауза
    }
    setCreating(false)
  }

  function copyCredentials(client) {
    const r = results[client.id] || client
    const email = r.email || client.login_email
    const password = r.password || client.login_password
    navigator.clipboard.writeText(
      `Добрий день, ${client.full_name}!\n\nВаш доступ в особистий кабінет:\n🔗 https://voronovskiy-lab-crm.vercel.app/login\n📧 Логін: ${email}\n🔑 Пароль: ${password}\n\nРекомендую змінити пароль після першого входу 💪`
    )
  }

  async function sendTelegram(client) {
    const telegram = client.email?.trim().startsWith('@') ? client.email.trim() : null
    if (!telegram) { alert('Немає Telegram у клієнта'); return }

    const r = results[client.id] || client
    const email = r.email || client.login_email
    const password = r.password || client.login_password

    setSending(prev => ({ ...prev, [client.id]: true }))
    try {
      const text = `Добрий день, ${client.full_name}! 👋\n\nВаш доступ в особистий кабінет тренера:\n🔗 https://voronovskiy-lab-crm.vercel.app/login\n📧 Логін: ${email}\n🔑 Пароль: ${password}\n\nРекомендую змінити пароль після першого входу 💪`

      const { data: { session } } = await supabase.auth.getSession()
      await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ type: 'send_message', data: { chat_id: telegram, text } }),
      })
      alert(`✅ Надіслано в Telegram ${telegram}`)
    } catch(e) {
      alert('Помилка відправки')
    }
    setSending(prev => ({ ...prev, [client.id]: false }))
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  const withoutAccount = clients.filter(c => !c.login_email)
  const withAccount = clients.filter(c => c.login_email)

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Доступы клиентов</h1>
          <p className="page-subtitle">Создание и управление доступами в личный кабинет</p>
        </div>
        {withoutAccount.length > 0 && (
          <button className="btn btn-primary" onClick={createAll} disabled={creating}>
            <RefreshCw size={15} />
            {creating ? 'Создаём...' : `Создать всем (${withoutAccount.length})`}
          </button>
        )}
      </div>

      {/* Без аккаунта */}
      {withoutAccount.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--warning)' }}>
            ⚠️ Без доступа — {withoutAccount.length} клиентов
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {withoutAccount.map(client => {
              const r = results[client.id]
              return (
                <div key={client.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
                    {client.full_name?.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{client.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {client.email || client.phone || 'нет контактов'}
                    </div>
                    {r?.status === 'done' && (
                      <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 2 }}>
                        ✓ {r.email} / {r.password}
                      </div>
                    )}
                    {r?.status === 'error' && (
                      <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 2 }}>✗ {r.error}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r?.status === 'done' && (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => copyCredentials(client)}>
                          <Copy size={13} /> Копировать
                        </button>
                        {client.telegram_chat_id && (
                          <button className="btn btn-primary btn-sm" onClick={() => sendTelegram(client)} disabled={sending[client.id]}>
                            <Send size={13} /> Telegram
                          </button>
                        )}
                      </>
                    )}
                    {r?.status === 'creating' && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Создаём...</span>}
                    {!r && (
                      <button className="btn btn-secondary btn-sm" onClick={() => createOne(client)}>
                        Создать
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* С аккаунтом */}
      {withAccount.length > 0 && (
        <div className="card">
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--success)' }}>
            ✓ С доступом — {withAccount.length} клиентов
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {withAccount.map(client => (
              <div key={client.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div className="avatar" style={{ width: 36, height: 36, fontSize: 14, flexShrink: 0 }}>
                  {client.full_name?.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{client.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    📧 {client.login_email}
                  </div>
                  {showPass[client.id] && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      🔑 {client.login_password}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button className="btn-icon" onClick={() => setShowPass(p => ({ ...p, [client.id]: !p[client.id] }))}>
                    {showPass[client.id] ? <X size={13} /> : '👁'}
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => copyCredentials(client)}>
                    <Copy size={13} />
                  </button>
                  {client.telegram_chat_id && (
                    <button className="btn btn-primary btn-sm" onClick={() => sendTelegram(client)} disabled={sending[client.id]}>
                      <Send size={13} /> {sending[client.id] ? '...' : 'TG'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
