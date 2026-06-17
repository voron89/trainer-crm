// src/pages/StatsPage.js
import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useClients } from '../hooks/useClients'
import { supabase } from '../lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { BarChart2 } from 'lucide-react'
import { GOAL_LABELS } from '../types'

const COLORS = ['#E84A1A', '#FF7A50', '#FFB085', '#FFF0E8', '#A0A0A0']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  )
}

export default function StatsPage() {
  const { profile } = useAuth()
  const { clients } = useClients()
  const [sessionData, setSessionData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('schedule')
      .select('status, scheduled_at, client_id')
      .eq('trainer_id', profile.id)
      .then(({ data }) => {
        setSessionData(data || [])
        setLoading(false)
      })
  }, [profile])

  const total = sessionData.length
  const completed = sessionData.filter(s => s.status === 'completed').length
  const missed = sessionData.filter(s => s.status === 'missed').length
  const cancelled = sessionData.filter(s => s.status === 'cancelled').length
  const planned = sessionData.filter(s => s.status === 'planned').length

  const statusData = [
    { name: 'Проведены', value: completed },
    { name: 'Запланированы', value: planned },
    { name: 'Пропущены', value: missed },
    { name: 'Отменены', value: cancelled },
  ].filter(d => d.value > 0)

  const goalData = Object.entries(
    clients.reduce((acc, c) => {
      const key = c.goal || 'unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})
  ).map(([k, v]) => ({ name: GOAL_LABELS[k] || 'Не задана', value: v }))

  const statusBarData = ['active', 'pause', 'finished'].map(s => ({
    name: s === 'active' ? 'Активные' : s === 'pause' ? 'Пауза' : 'Завершили',
    value: clients.filter(c => c.status === s).length,
  }))

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Статистика</h1>
          <p className="page-subtitle">Общая аналитика по всем клиентам</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="stat-label">Всего клиентов</div>
          <div className="stat-value stat-accent">{clients.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Всего сессий</div>
          <div className="stat-value">{total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Проведено</div>
          <div className="stat-value">{completed}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Посещаемость</div>
          <div className="stat-value">{total > 0 ? Math.round((completed / (completed + missed)) * 100) || 0 : 0}%</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Status pie */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Статус тренировок</h3>
          {total === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}><p>Нет данных</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={10} formatter={(v) => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Goals */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Цели клиентов</h3>
          {goalData.length === 0 ? (
            <div className="empty-state" style={{ padding: '30px 0' }}><p>Нет данных</p></div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={goalData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={120} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(232,74,26,0.05)' }} />
                <Bar dataKey="value" name="Клиентов" fill="var(--accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Client statuses */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Распределение клиентов по статусу</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={statusBarData} margin={{ left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 13, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(232,74,26,0.05)' }} />
              <Bar dataKey="value" name="Клиентов" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
