// src/pages/ClientRegisterPage.js
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Dumbbell, Check } from 'lucide-react'

const GOAL_LABELS = {
  weight_loss: 'Похудение',
  muscle_gain: 'Набор массы',
  recomposition: 'Рекомпозиция',
  competition: 'Подготовка к соревнованиям',
}

// Украинские операторы: 039, 050, 063, 066, 067, 068, 073, 091-099
function formatPhone(value) {
  // Убираем всё кроме цифр
  let digits = value.replace(/\D/g, '')
  
  // Убираем 38 в начале если есть
  if (digits.startsWith('38')) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  
  // Ограничиваем 9 цифрами (после +38 0XX)
  digits = digits.slice(0, 10)
  
  return digits
}

function isValidPhone(phone) {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 9
}

function formatTelegram(value) {
  let v = value.trim()
  if (v && !v.startsWith('@')) v = '@' + v
  // Убираем пробелы
  v = v.replace(/\s/g, '')
  return v
}

export default function ClientRegisterPage() {
  const { trainerId } = useParams()
  const [step, setStep] = useState('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    telegram: '',
    goal: '',
    message: '',
  })
  const [phoneError, setPhoneError] = useState('')

  function handlePhoneChange(e) {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
    setForm(f => ({ ...f, phone: digits }))
    if (digits && digits.length < 9) {
      setPhoneError('Введіть повний номер телефону')
    } else {
      setPhoneError('')
    }
  }

  function handleTelegramChange(e) {
    setForm(f => ({ ...f, telegram: formatTelegram(e.target.value) }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.phone && form.phone.length < 9) {
      setError('Введіть повний номер телефону')
      return
    }

    setLoading(true)

    // Если email не указан — генерируем из телефона
    const emailToUse = form.email || `${form.phone.replace(/\D/g, '')}@voronovskiy-lab.com`

    const { error } = await supabase.from('client_requests').insert({
      full_name: form.full_name,
      email: emailToUse,
      phone: form.phone ? `+38${form.phone}` : null,
      telegram: form.telegram || null,
      goal: form.goal || null,
      message: form.message || null,
      trainer_id: trainerId || null,
      status: 'pending',
    })

    if (error) {
      setError('Ошибка отправки. Попробуйте ещё раз.')
    } else {
      // Уведомление тренеру
      fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.REACT_APP_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ type: 'new_request', data: form }),
      }).catch(() => {})
      setStep('success')
    }
    setLoading(false)
  }

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', border: '2px solid var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Check size={32} color="var(--success)" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Заявка отправлена!</h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Тренер рассмотрит вашу заявку и свяжется с вами
            {form.telegram && <> в Telegram <strong>{form.telegram}</strong></>}
            {form.email && !form.telegram && <> на почту <strong>{form.email}</strong></>}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>Обычно это занимает несколько часов</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: 'var(--accent)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Dumbbell size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Записаться к тренеру</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Заполните форму — тренер свяжется с вами</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            {/* Имя */}
            <div className="form-group">
              <label className="form-label">Имя и фамилия *</label>
              <input className="form-input" value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="Иван Петров" required />
            </div>

            {/* Телефон с маской */}
            <div className="form-group">
              <label className="form-label">Номер телефона *</label>
              <div style={{ display: 'flex', gap: 0 }}>
                <div style={{
                  background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRight: 'none', borderRadius: '8px 0 0 8px',
                  padding: '10px 14px', fontSize: 16, color: 'var(--text-secondary)',
                  whiteSpace: 'nowrap', display: 'flex', alignItems: 'center',
                }}>+38</div>
                <input
                  className="form-input"
                  value={form.phone}
                  onChange={handlePhoneChange}
                  placeholder="0XX XXX XX XX"
                  type="tel"
                  required
                  maxLength={13}
                  style={{
                    borderRadius: '0 8px 8px 0',
                    borderColor: phoneError ? 'var(--danger)' : undefined,
                  }}
                />
              </div>
              {phoneError && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 4 }}>{phoneError}</div>}
            </div>

            {/* Telegram */}
            <div className="form-group">
              <label className="form-label">Ваш Telegram *</label>
              <input
                className="form-input"
                value={form.telegram}
                onChange={handleTelegramChange}
                placeholder="@username"
              />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Через Telegram тренер пришлёт доступ в личный кабинет
              </div>
            </div>

            {/* Email — необязательный */}
            <div className="form-group">
              <label className="form-label">Email <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(необязательно)</span></label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="your@gmail.com"
              />
            </div>

            {/* Цель */}
            <div className="form-group">
              <label className="form-label">Цель тренировок</label>
              <select className="form-select" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}>
                <option value="">Не выбрана</option>
                {Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Сообщение */}
            <div className="form-group">
              <label className="form-label">Сообщение тренеру <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(необязательно)</span></label>
              <textarea className="form-textarea" value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Расскажите о себе, своих целях, травмах..." />
            </div>

            {error && (
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="submit"
              style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Отправляем...' : 'Отправить заявку'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
