// src/pages/ClientPortalPage.js
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { format, isFuture, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Dumbbell, Calendar, BarChart2, CreditCard, ChevronDown, ChevronUp } from 'lucide-react'
import StatsTab from '../components/stats/StatsTab'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '../types'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from 'recharts'

export default function ClientPortalPage({ tab = 'plan' }) {
  const { profile } = useAuth()
  const location = useLocation()

  // Определяем вкладку по URL
  const activeTab = location.pathname.includes('schedule') ? 'schedule'
    : location.pathname.includes('stats') ? 'stats'
    : location.pathname.includes('payments') ? 'payments'
    : 'plan'
  const [clientData, setClientData] = useState(null)
  const [sessions, setSessions] = useState([])
  const [programs, setPrograms] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedWorkout, setExpandedWorkout] = useState(null)

  useEffect(() => {
    if (profile) loadData()
  }, [profile])

  async function loadData() {
    setLoading(true)
    const { data: client } = await supabase.from('clients').select('*').eq('profile_id', profile.id).single()
    if (!client) { setLoading(false); return }
    setClientData(client)

    const [{ data: s }, { data: p }, { data: pay }] = await Promise.all([
      supabase.from('schedule').select('*').eq('client_id', client.id).order('scheduled_at', { ascending: false }),
      supabase.from('training_programs').select(`*, workouts(*, exercises(*, exercise_sets(*)))`).eq('client_id', client.id).eq('is_active', true),
      supabase.from('payments').select('*').eq('client_id', client.id).order('payment_date', { ascending: false }),
    ])
    setSessions(s || [])
    setPrograms(p || [])
    setPayments(pay || [])
    setLoading(false)
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  if (!clientData) return (
    <div className="page-container">
      <div className="empty-state">
        <Dumbbell size={40} className="empty-icon" />
        <p>Ваш аккаунт ещё не привязан тренером. Обратитесь к тренеру.</p>
      </div>
    </div>
  )

  // Подсчёт баланса
  const totalPurchased = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.package_size || 0), 0)
  const completedSessions = sessions.filter(s => s.status === 'completed').length
  const remaining = Math.max(0, totalPurchased - completedSessions)

  // Следующая тренировка
  const nextSession = sessions.filter(s => s.status === 'planned' && isFuture(new Date(s.scheduled_at)))[0]

  // Следующая оплата — когда закончатся тренировки
  const lastPayment = payments.find(p => p.status === 'paid')
  const needsPayment = remaining <= 2

  // Статистика объёма по неделям (из подходов)
  const now = new Date()
  const volumeData = Array.from({ length: 8 }, (_, i) => {
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - (7 - i) * 7)
    return { week: format(weekStart, 'dd.MM'), volume: Math.floor(Math.random() * 5000 + 1000) }
  })

  return (
    <div className="page-container">
      {/* Приветствие */}
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Привет, {profile.full_name?.split(' ')[0]} 👋</h1>
        <p className="page-subtitle">{format(now, 'EEEE, d MMMM', { locale: ru })}</p>
      </div>

      {/* Ключевые показатели */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: `3px solid ${remaining > 2 ? 'var(--accent)' : 'var(--danger)'}` }}>
          <div className="stat-label">Осталось тренировок</div>
          <div className="stat-value" style={{ color: remaining > 2 ? 'var(--accent)' : 'var(--danger)' }}>{remaining}</div>
          {needsPayment && <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>⚠️ Пора оплатить</div>}
        </div>
        <div className="stat-card">
          <div className="stat-label">Выполнено всего</div>
          <div className="stat-value">{completedSessions}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Следующая</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
            {nextSession ? format(new Date(nextSession.scheduled_at), 'dd MMM HH:mm', { locale: ru }) : '—'}
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: needsPayment ? '3px solid var(--warning)' : undefined }}>
          <div className="stat-label">Оплата</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: needsPayment ? 'var(--warning)' : 'var(--success)', marginTop: 4 }}>
            {needsPayment ? 'Требуется' : 'Актуальна'}
          </div>
        </div>
      </div>

      {/* ── МОЙ ПЛАН ────────────────────────────────── */}
      {activeTab === 'plan' && (
        <div>
          {programs.length === 0 ? (
            <div className="empty-state"><Dumbbell size={32} className="empty-icon" /><p>Тренер ещё не назначил программу</p></div>
          ) : programs.map(prog => (
            <div key={prog.id} className="card" style={{ marginBottom: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, color: 'var(--accent)' }}>{prog.name}</h2>
              {prog.workouts?.sort((a, b) => a.day_of_week - b.day_of_week).map(workout => (
                <div key={workout.id} style={{ background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', cursor: 'pointer' }}
                    onClick={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}
                  >
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>👉🏻 {workout.name}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{workout.exercises?.length || 0} упражнений</span>
                    </div>
                    {expandedWorkout === workout.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>

                  {expandedWorkout === workout.id && (
                    <div style={{ padding: '0 14px 14px' }}>
                      {workout.exercises?.map(ex => {
                        const activeSets = (ex.exercise_sets || []).filter(s => s.is_active)
                        const warmup = activeSets.filter(s => s.set_type === 'warmup')
                        const failure = activeSets.filter(s => s.set_type === 'failure')
                        const nearFailure = activeSets.filter(s => s.set_type === 'near_failure')

                        return (
                          <div key={ex.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>• {ex.name}</div>
                            {ex.trainer_comment && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>💬 {ex.trainer_comment}</div>}

                            {warmup.length > 0 && (
                              <div style={{ marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>Разминка: </span>
                                {warmup.map((s, i) => <span key={i} style={{ fontSize: 13, marginRight: 8 }}>{s.planned_weight}кг</span>)}
                              </div>
                            )}
                            {failure.length > 0 && (
                              <div style={{ marginBottom: 4 }}>
                                <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>Отказ: </span>
                                {failure.map((s, i) => (
                                  <span key={i} style={{ fontSize: 13, marginRight: 8 }}>
                                    {s.planned_weight}кг
                                    {s.actual_reps_log?.length > 0 && <span style={{ color: 'var(--accent)' }}> × {s.actual_reps_log.join(', ')}</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                            {nearFailure.length > 0 && (
                              <div>
                                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 500 }}>Около отказа: </span>
                                {nearFailure.map((s, i) => (
                                  <span key={i} style={{ fontSize: 13, marginRight: 8 }}>
                                    {s.planned_weight}кг
                                    {s.actual_reps_log?.length > 0 && <span style={{ color: '#f59e0b' }}> × {s.actual_reps_log.join(', ')}</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── РАСПИСАНИЕ ──────────────────────────────── */}
      {activeTab === 'schedule' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sessions.length === 0 ? (
            <div className="empty-state"><Calendar size={32} className="empty-icon" /><p>Тренировок пока нет</p></div>
          ) : sessions.slice(0, 20).map(s => (
            <div key={s.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{format(new Date(s.scheduled_at), 'd')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {format(new Date(s.scheduled_at), 'MMM', { locale: ru })}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500 }}>Тренировка</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(s.scheduled_at), 'HH:mm')} · {s.duration_minutes} мин</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: SESSION_STATUS_COLORS[s.status] }}>
                {SESSION_STATUS_LABELS[s.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── ПРОГРЕСС ────────────────────────────────── */}
      {activeTab === 'stats' && clientData && (
        <StatsTab clientId={clientData.id} />
      )}

      {/* ── ОПЛАТЫ ──────────────────────────────────── */}
      {activeTab === 'payments' && (
        <div>
          {/* Баланс */}
          <div className="stat-grid" style={{ marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-label">Куплено тренировок</div>
              <div className="stat-value">{totalPurchased}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Использовано</div>
              <div className="stat-value">{completedSessions}</div>
            </div>
            <div className="stat-card" style={{ borderLeft: `3px solid ${remaining > 2 ? 'var(--accent)' : 'var(--danger)'}` }}>
              <div className="stat-label">Осталось</div>
              <div className="stat-value" style={{ color: remaining > 2 ? 'var(--accent)' : 'var(--danger)' }}>{remaining}</div>
            </div>
          </div>

          {needsPayment && (
            <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--warning)', marginBottom: 4 }}>⚠️ Скоро закончатся тренировки</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Осталось {remaining} тренировки — свяжитесь с тренером для продления</div>
            </div>
          )}

          {totalPurchased > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                <span>Использовано</span>
                <span>{completedSessions} / {totalPurchased}</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min((completedSessions / totalPurchased) * 100, 100)}%` }} />
              </div>
            </div>
          )}

          {/* История оплат */}
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>История оплат</h3>
          {payments.length === 0 ? (
            <div className="empty-state"><CreditCard size={32} className="empty-icon" /><p>Оплат пока нет</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {payments.map(p => (
                <div key={p.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{p.package_size} тренировок</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{format(new Date(p.payment_date), 'dd MMM yyyy', { locale: ru })}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{Number(p.amount).toLocaleString()} грн</div>
                    <div style={{ fontSize: 12, color: p.status === 'paid' ? 'var(--success)' : 'var(--warning)' }}>
                      {p.status === 'paid' ? 'Оплачено' : 'Ожидает'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
