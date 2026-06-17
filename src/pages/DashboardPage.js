// src/pages/DashboardPage.js
import { useAuth } from '../hooks/useAuth'
import { useClients } from '../hooks/useClients'
import { useSchedule } from '../hooks/useSchedule'
import { format, isToday, isTomorrow, startOfWeek, endOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Users, Calendar, TrendingUp, Clock, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SESSION_STATUS_COLORS, SESSION_STATUS_LABELS } from '../types'

export default function DashboardPage() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const { sessions } = useSchedule()
  const navigate = useNavigate()

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 })

  const upcomingSessions = sessions
    .filter(s => new Date(s.scheduled_at) >= now && s.status === 'planned')
    .slice(0, 5)

  const weekSessions = sessions.filter(s => {
    const d = new Date(s.scheduled_at)
    return d >= weekStart && d <= weekEnd
  })

  const activeClients = clients.filter(c => c.status === 'active')
  const todaySessions = sessions.filter(s => isToday(new Date(s.scheduled_at)) && s.status !== 'cancelled')
  const completedThisWeek = weekSessions.filter(s => s.status === 'completed').length

  function dateLabel(dateStr) {
    const d = new Date(dateStr)
    if (isToday(d)) return 'Сегодня'
    if (isTomorrow(d)) return 'Завтра'
    return format(d, 'dd MMM', { locale: ru })
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Добрый день, {profile?.full_name?.split(' ')[0]} 👋</h1>
          <p className="page-subtitle">{format(now, 'EEEE, d MMMM yyyy', { locale: ru })}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="stat-label">Активных клиентов</div>
          <div className="stat-value stat-accent">{activeClients.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>из {clients.length} всего</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Тренировок сегодня</div>
          <div className="stat-value">{todaySessions.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Проведено на неделе</div>
          <div className="stat-value">{completedThisWeek}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>из {weekSessions.length} запланировано</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Предстоящих</div>
          <div className="stat-value">{upcomingSessions.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Upcoming sessions */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Ближайшие тренировки</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/schedule')}>
              Все <ChevronRight size={14} />
            </button>
          </div>

          {upcomingSessions.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Calendar size={32} className="empty-icon" />
              <p>Нет запланированных тренировок</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {upcomingSessions.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                    {s.clients?.full_name?.slice(0, 1) || '?'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{s.clients?.full_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {s.workouts?.name || 'Тренировка'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--accent)' }}>
                      {dateLabel(s.scheduled_at)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {format(new Date(s.scheduled_at), 'HH:mm')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Client list */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Клиенты</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/clients')}>
              Все <ChevronRight size={14} />
            </button>
          </div>

          {activeClients.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}>
              <Users size={32} className="empty-icon" />
              <p>Добавьте первого клиента</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activeClients.slice(0, 5).map(c => {
                const clientSessions = sessions.filter(s => s.client_id === c.id && s.status === 'planned')
                const next = clientSessions.find(s => new Date(s.scheduled_at) >= now)
                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    onClick={() => navigate(`/clients/${c.id}`)}
                  >
                    <div className="avatar" style={{ width: 36, height: 36, fontSize: 14 }}>
                      {c.avatar_url ? <img src={c.avatar_url} alt="" /> : c.full_name?.slice(0, 1)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{c.full_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {next ? `Тренировка ${dateLabel(next.scheduled_at)}` : 'Нет записи'}
                      </div>
                    </div>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
