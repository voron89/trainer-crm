// src/pages/ClientRequestsPage.js
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useClients } from '../hooks/useClients'
import { Check, X, Clock, Copy, UserPlus, Mail, Trash2, Eye, EyeOff, Send } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { GOAL_LABELS } from '../types'

const STATUS_BADGE = {
  pending: 'badge-yellow',
  approved: 'badge-green',
  rejected: 'badge-gray',
}
const STATUS_LABELS = {
  pending: 'Ожидает',
  approved: 'Одобрена',
  rejected: 'Отклонена',
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function ClientRequestsPage() {
  const { profile } = useAuth()
  const { addClient } = useClients()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)
  const [inviteLink, setInviteLink] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)
  const [approvedInfo, setApprovedInfo] = useState(null)
  const [showCredentials, setShowCredentials] = useState({})
  const [sendingTelegram, setSendingTelegram] = useState(null)

  useEffect(() => {
    if (profile) {
      setInviteLink(`${window.location.origin}/register/${profile.id}`)
      fetchRequests()
    }
  }, [profile])

  async function fetchRequests() {
    setLoading(true)
    const { data } = await supabase
      .from('client_requests')
      .select('*')
      .eq('trainer_id', profile.id)
      .order('created_at', { ascending: false })
    setRequests(data || [])
    setLoading(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2000)
  }

  async function handleApprove(req) {
    setProcessing(req.id)
    const password = generatePassword()

    try {
      let userId = null

      // Создаём пользователя через Edge Function с Admin правами (сразу подтверждённый)
      const { data: { session } } = await supabase.auth.getSession()
      const createRes = await fetch(
        `${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            type: 'create_user',
            data: { email: req.email, password, full_name: req.full_name }
          }),
        }
      )
      const createData = await createRes.json()
      userId = createData?.user_id

      // Добавляем клиента
      await addClient({
        full_name: req.full_name,
        phone: req.phone || '',
        email: req.email,
        goal: req.goal || '',
        status: 'active',
        notes: req.message || '',
        profile_id: userId || null,
      })

      const loginUrl = `${window.location.origin}/login`
      const emailToUse = req.email || `${(req.phone || '').replace(/\D/g, '')}@voronovskiy-lab.com`

      // Сохраняем credentials в заявке
      await supabase.from('client_requests')
        .update({
          status: 'approved',
          login_url: loginUrl,
          login_email: emailToUse,
          login_password: password,
        })
        .eq('id', req.id)

      setRequests(prev => prev.map(r => r.id === req.id ? {
        ...r, status: 'approved',
        login_url: loginUrl, login_email: emailToUse, login_password: password
      } : r))

      setApprovedInfo({ name: req.full_name, email: emailToUse, password, loginUrl, telegram: req.telegram })

      // Отправляем уведомление клиенту в Telegram если есть chat_id
      try {
        // Ищем telegram_chat_id клиента по telegram username
        if (req.telegram) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('telegram_chat_id')
            .eq('full_name', req.full_name)
            .single()
          
          const chatId = clientData?.telegram_chat_id
          if (chatId) {
            const { data: { session: authSess } } = await supabase.auth.getSession()
            await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSess?.access_token}` },
              body: JSON.stringify({
                type: 'approved_client',
                data: { client_chat_id: chatId, client_name: req.full_name, login_url: loginUrl, login_email: emailToUse, login_password: password }
              })
            })
          }
        }
      } catch(e) { console.log('Telegram notify error:', e) }

    } catch (e) {
      console.error(e)
    }
    setProcessing(null)
  }

  async function handleReject(id) {
    await supabase.from('client_requests').update({ status: 'rejected' }).eq('id', id)
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r))
  }

  async function handleDelete(id) {
    if (!window.confirm('Удалить заявку?')) return
    await supabase.from('client_requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
  }

  async function sendViaTelegram(req) {
    if (!req.telegram) {
      alert('У клиента не указан Telegram')
      return
    }
    setSendingTelegram(req.id)
    try {
      const text = `🎉 Ваш доступ в личный кабинет тренера!\n\n🔗 Ссылка: ${req.login_url}\n📧 Логин: ${req.login_email}\n🔑 Пароль: ${req.login_password}\n\nРекомендуем сменить пароль после первого входа 💪`

      await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          type: 'send_message',
          data: { chat_id: req.telegram, text }
        }),
      })
      alert('✅ Данные отправлены в Telegram!')
    } catch (e) {
      alert('Ошибка отправки')
    }
    setSendingTelegram(null)
  }

  function copyCredentials(req) {
    const text = `Доступ в личный кабинет:\n🔗 ${req.login_url}\n📧 Логин: ${req.login_email}\n🔑 Пароль: ${req.login_password}`
    navigator.clipboard.writeText(text)
  }

  function toggleCredentials(id) {
    setShowCredentials(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Заявки клиентов</h1>
          <p className="page-subtitle">{requests.filter(r => r.status === 'pending').length} ожидают подтверждения</p>
        </div>
      </div>

      {/* Ссылка для регистрации */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <UserPlus size={18} color="var(--accent)" />
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Ссылка для регистрации клиентов</h2>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14 }}>
          Отправьте эту ссылку клиенту — он заполнит форму и заявка появится здесь
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--text-secondary)', wordBreak: 'break-all', minWidth: 200 }}>
            {inviteLink}
          </div>
          <button className="btn btn-primary" onClick={copyLink}>
            <Copy size={14} /> {copiedLink ? 'Скопировано!' : 'Скопировать'}
          </button>
        </div>
      </div>

      {/* Одобренный — показываем доступы */}
      {approvedInfo && (
        <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--success)' }}>✓ Клиент {approvedInfo.name} добавлен</h3>
            <button onClick={() => setApprovedInfo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={16} /></button>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 14, marginBottom: 14, fontFamily: 'monospace', fontSize: 13, lineHeight: 2 }}>
            <div>🔗 <strong>Ссылка:</strong> {approvedInfo.loginUrl}</div>
            <div>📧 <strong>Логин:</strong> {approvedInfo.email}</div>
            <div>🔑 <strong>Пароль:</strong> {approvedInfo.password}</div>
            {approvedInfo.telegram && <div>💬 <strong>Telegram:</strong> {approvedInfo.telegram}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary btn-sm" onClick={() => navigator.clipboard.writeText(`Доступ в личный кабинет:\n🔗 ${approvedInfo.loginUrl}\n📧 Логин: ${approvedInfo.email}\n🔑 Пароль: ${approvedInfo.password}`)}>
              <Copy size={13} /> Скопировать данные
            </button>
            <a href={`mailto:${approvedInfo.email}?subject=Доступ в личный кабинет&body=Добрый день, ${approvedInfo.name}!%0A%0AВаш доступ:%0A🔗 ${approvedInfo.loginUrl}%0A📧 Логин: ${approvedInfo.email}%0A🔑 Пароль: ${approvedInfo.password}`}
              className="btn btn-secondary btn-sm">
              <Mail size={13} /> Открыть в почте
            </a>
          </div>
        </div>
      )}

      {/* Список заявок */}
      {requests.length === 0 ? (
        <div className="empty-state"><Clock size={32} className="empty-icon" /><p>Заявок пока нет</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requests.map(req => (
            <div key={req.id} className="card">
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>{req.full_name?.slice(0, 1)}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{req.full_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{req.email}</div>
                    </div>
                    <span className={`badge ${STATUS_BADGE[req.status]}`}>{STATUS_LABELS[req.status]}</span>
                  </div>

                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {req.phone && <span>📱 {req.phone}</span>}
                    {req.telegram && <span>💬 {req.telegram}</span>}
                    {req.goal && <span>🎯 {GOAL_LABELS[req.goal] || req.goal}</span>}
                    <span>📅 {format(new Date(req.created_at), 'dd MMM yyyy', { locale: ru })}</span>
                  </div>

                  {req.message && (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8, marginBottom: 8 }}>
                      💬 {req.message}
                    </div>
                  )}

                  {/* Данные для входа у одобренных */}
                  {req.status === 'approved' && req.login_email && (
                    <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: '10px 14px', marginTop: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>Данные для входа</span>
                        <button onClick={() => toggleCredentials(req.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center', fontSize: 12 }}>
                          {showCredentials[req.id] ? <><EyeOff size={13} /> Скрыть</> : <><Eye size={13} /> Показать</>}
                        </button>
                      </div>
                      {showCredentials[req.id] && (
                        <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.8, color: 'var(--text-secondary)' }}>
                          <div>📧 {req.login_email}</div>
                          <div>🔑 {req.login_password}</div>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" style={{ fontSize: 12 }} onClick={() => copyCredentials(req)}>
                          <Copy size={12} /> Скопировать
                        </button>
                        {req.telegram && (
                          <button className="btn btn-primary btn-sm" style={{ fontSize: 12 }}
                            onClick={() => sendViaTelegram(req)}
                            disabled={sendingTelegram === req.id}>
                            <Send size={12} /> {sendingTelegram === req.id ? 'Отправка...' : 'Отправить в Telegram'}
                          </button>
                        )}
                        <a href={`mailto:${req.login_email}?subject=Доступ в личный кабинет&body=Добрый день!%0A%0AВаш доступ:%0A🔗 ${req.login_url}%0A📧 ${req.login_email}%0A🔑 ${req.login_password}`}
                          className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>
                          <Mail size={12} /> Email
                        </a>
                      </div>
                    </div>
                  )}
                </div>

                {/* Действия */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  {req.status === 'pending' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => handleApprove(req)} disabled={processing === req.id}>
                        <Check size={14} /> {processing === req.id ? 'Добавляем...' : 'Одобрить'}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleReject(req.id)}>
                        <X size={14} /> Отклонить
                      </button>
                    </>
                  )}
                  <button className="btn-icon" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => handleDelete(req.id)} title="Удалить заявку">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
