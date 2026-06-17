// src/pages/PaymentsPage.js
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns'
import { CreditCard, ChevronRight, AlertCircle, TrendingUp, Building2 } from 'lucide-react'
import { PAYMENT_STATUS_LABELS } from '../types'

const STATUS_BADGE = { paid: 'badge-green', pending: 'badge-yellow', overdue: 'badge-red' }

export default function PaymentsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [payments, setPayments] = useState([])
  const [balances, setBalances] = useState([])
  const [gymRents, setGymRents] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    Promise.all([
      supabase.from('payments').select('*, clients(id, full_name)')
        .eq('trainer_id', profile.id).order('payment_date', { ascending: false }),
      supabase.from('client_session_balance').select('*'),
      supabase.from('gym_rent').select('*, clients(full_name)').eq('trainer_id', profile.id),
    ]).then(([{ data: p }, { data: b }, { data: g }]) => {
      setPayments(p || [])
      setBalances(b || [])
      setGymRents(g || [])
      setLoading(false)
    })
  }, [profile])

  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(prevMonthStart)
  const yearStart = startOfYear(now)
  const yearEnd = endOfYear(now)

  function paidInRange(start, end) {
    return payments.filter(p => {
      const d = new Date(p.payment_date)
      return p.status === 'paid' && d >= start && d <= end
    }).reduce((s, p) => s + Number(p.amount), 0)
  }

  const totalRevenue = payments.filter(p => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const thisMonthRevenue = paidInRange(thisMonthStart, thisMonthEnd)
  const prevMonthRevenue = paidInRange(prevMonthStart, prevMonthEnd)
  const yearRevenue = paidInRange(yearStart, yearEnd)

  // Аренда зала — суммарно оплачено
  const totalRentPaid = gymRents.reduce((s, g) => s + (g.sessions_paid * g.price_per_session), 0)

  // Чистый доход
  const netRevenue = totalRevenue - totalRentPaid
  const thisMonthNet = thisMonthRevenue // упрощённо — точный расчёт в карточке клиента

  const lowBalance = balances.filter(b => b.sessions_remaining <= 2 && b.sessions_remaining >= 0)

  function pct(prev, curr) {
    if (!prev) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }
  const monthPct = pct(prevMonthRevenue, thisMonthRevenue)

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Оплаты</h1>
          <p className="page-subtitle">Финансовый обзор</p>
        </div>
      </div>

      {/* ── ЧИСТЫЙ ДОХОД ──────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="stat-label">Этот месяц</div>
          <div className="stat-value stat-accent">{thisMonthRevenue.toLocaleString()} грн</div>
          <div style={{ fontSize: 12, color: monthPct >= 0 ? 'var(--success)' : 'var(--danger)', marginTop: 4 }}>
            {monthPct >= 0 ? '+' : ''}{monthPct}% к прошлому
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Прошлый месяц</div>
          <div className="stat-value">{prevMonthRevenue.toLocaleString()} грн</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">За год</div>
          <div className="stat-value">{yearRevenue.toLocaleString()} грн</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="stat-label">Аренда зала (оплачено)</div>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{totalRentPaid.toLocaleString()} грн</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div className="stat-label">Чистый доход</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{netRevenue.toLocaleString()} грн</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>после аренды</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Платежей всего</div>
          <div className="stat-value">{payments.length}</div>
        </div>
      </div>

      {/* ── ИТОГОВАЯ ТАБЛИЦА ──────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <TrendingUp size={18} color="var(--success)" />
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Итог</h2>
        </div>
        {[
          { label: 'Общая выручка', value: totalRevenue, color: 'var(--text-primary)' },
          { label: 'Аренда зала (оплачено)', value: -totalRentPaid, color: 'var(--danger)' },
          { label: 'Чистый доход', value: netRevenue, color: 'var(--success)', bold: true },
          { label: 'Выручка этот месяц', value: thisMonthRevenue, color: 'var(--accent)' },
          { label: 'Выручка прошлый месяц', value: prevMonthRevenue, color: 'var(--text-secondary)' },
          { label: 'Выручка за год', value: yearRevenue, color: 'var(--text-primary)' },
        ].map((row, i, arr) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '12px 0',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{row.label}</span>
            <span style={{ fontSize: row.bold ? 18 : 15, fontWeight: row.bold ? 700 : 600, color: row.color }}>
              {row.value < 0 ? '−' : ''}{Math.abs(row.value).toLocaleString()} грн
            </span>
          </div>
        ))}
      </div>

      {/* ── АРЕНДА ПО КЛИЕНТАМ ────────────────────────────── */}
      {gymRents.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <Building2 size={18} color="var(--accent)" />
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Аренда зала по клиентам</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Оплачено тр.</th>
                  <th>Цена/тр.</th>
                  <th>Оплачено грн</th>
                </tr>
              </thead>
              <tbody>
                {gymRents.map(g => (
                  <tr key={g.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clients/${g.client_id}`)}>
                    <td style={{ fontWeight: 500 }}>{g.clients?.full_name}</td>
                    <td>{g.sessions_paid}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{g.price_per_session} грн</td>
                    <td style={{ fontWeight: 600, color: 'var(--danger)' }}>
                      {(g.sessions_paid * g.price_per_session).toLocaleString()} грн
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ПРЕДУПРЕЖДЕНИЕ ────────────────────────────────── */}
      {lowBalance.length > 0 && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 10 }}>
          <AlertCircle size={16} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--warning)', marginBottom: 4 }}>Заканчиваются тренировки</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {lowBalance.map(b => (
                <span key={b.client_id} style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => navigate(`/clients/${b.client_id}`)}>
                  {b.full_name} ({b.sessions_remaining})
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ИСТОРИЯ ПЛАТЕЖЕЙ ──────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Все платежи</h2>
        </div>
        {payments.length === 0 ? (
          <div className="empty-state">
            <CreditCard size={32} className="empty-icon" />
            <p>Платежи пока не добавлены</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Клиент</th>
                  <th>Дата</th>
                  <th>Пакет</th>
                  <th>Цена/тр.</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/clients/${p.client_id}`)}>
                    <td style={{ fontWeight: 500 }}>{p.clients?.full_name}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{format(new Date(p.payment_date), 'dd.MM.yyyy')}</td>
                    <td>{p.package_size} тр.</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.price_per_session || '—'} грн</td>
                    <td style={{ fontWeight: 600 }}>{Number(p.amount).toLocaleString()} грн</td>
                    <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{PAYMENT_STATUS_LABELS[p.status]}</span></td>
                    <td><ChevronRight size={14} color="var(--text-muted)" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
