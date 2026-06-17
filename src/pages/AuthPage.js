// src/pages/AuthPage.js
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { Dumbbell, Eye, EyeOff } from 'lucide-react'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'trainer' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'login') {
      const { error } = await signIn(form.email, form.password)
      if (error) setError(error.message)
      else navigate('/dashboard')
    } else {
      if (!form.fullName.trim()) { setError('Введите имя'); setLoading(false); return }
      const { error } = await signUp(form.email, form.password, form.fullName, form.role)
      if (error) setError(error.message)
      else setError('Проверьте email для подтверждения аккаунта')
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, background: 'var(--accent)',
            borderRadius: 14, display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 16px',
          }}>
            <Dumbbell size={28} color="white" />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Trainer CRM</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {mode === 'login' ? 'Войдите в свой аккаунт' : 'Создайте аккаунт'}
          </p>
        </div>

        {/* Card */}
        <div className="card">
          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Имя и фамилия</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Иван Петров"
                  value={form.fullName}
                  onChange={e => set('fullName', e.target.value)}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                className="form-input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Пароль</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Минимум 6 символов"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex',
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Роль</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={e => set('role', e.target.value)}
                >
                  <option value="trainer">Тренер</option>
                  <option value="client">Клиент</option>
                </select>
              </div>
            )}

            {error && (
              <div style={{
                background: error.includes('Проверьте') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                border: `1px solid ${error.includes('Проверьте') ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                color: error.includes('Проверьте') ? 'var(--success)' : 'var(--danger)',
                padding: '12px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: 13, marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary" type="submit" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Загрузка...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
            {mode === 'login' ? (
              <>Нет аккаунта?{' '}
                <button className="btn-ghost" style={{ padding: 0, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  onClick={() => setMode('register')}>
                  Создать
                </button>
              </>
            ) : (
              <>Уже есть аккаунт?{' '}
                <button className="btn-ghost" style={{ padding: 0, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14 }}
                  onClick={() => setMode('login')}>
                  Войти
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
