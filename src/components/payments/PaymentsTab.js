// src/components/payments/PaymentsTab.js
import { useState, useEffect } from 'react'
import { usePayments } from '../../hooks/usePayments'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { Plus, Trash2, CreditCard, Building2, TrendingUp, Save } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from 'date-fns'
import { PAYMENT_STATUS_LABELS, PACKAGE_SIZES } from '../../types'

const STATUS_BADGE = { paid: 'badge-green', pending: 'badge-yellow', overdue: 'badge-red' }
const PRICE_OPTIONS = [400, 500, 600]

// Для разового занятия фиксированная цена 600 грн
function getDefaultPrice(packageSize) {
  if (packageSize === 1) return 600
  return 500
}

export default function PaymentsTab({ clientId }) {
  const { profile } = useAuth()
  const { payments, balance, loading, addPayment, deletePayment } = usePayments(clientId)
  const [gymRent, setGymRent] = useState(null)
  const [gymLoading, setGymLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [savingRent, setSavingRent] = useState(false)
  const [rentPaid, setRentPaid] = useState(0)
  const [rentPrice, setRentPrice] = useState(100)
  const [form, setForm] = useState({
    amount: '',
    package_size: 8,
    price_per_session: 500,
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    status: 'paid',
    notes: ''
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Автосчёт суммы при изменении пакета или цены
  useEffect(() => {
    const defaultPrice = getDefaultPrice(form.package_size)
    setForm(f => ({
      ...f,
      price_per_session: f.package_size === 1 ? 600 : f.price_per_session,
      amount: f.package_size * (f.package_size === 1 ? 600 : f.price_per_session)
    }))
  }, [form.package_size])

  useEffect(() => { loadGymRent() }, [clientId])

  async function loadGymRent() {
    setGymLoading(true)
    const { data } = await supabase.from('gym_rent')
      .select('*').eq('client_id', clientId).single()
    if (data) {
      setGymRent(data)
      setRentPaid(data.sessions_paid)
      setRentPrice(data.price_per_session)
    }
    setGymLoading(false)
  }

  async function saveGymRent() {
    setSavingRent(true)
    if (gymRent) {
      await supabase.from('gym_rent')
        .update({ sessions_paid: rentPaid, price_per_session: rentPrice, updated_at: new Date().toISOString() })
        .eq('id', gymRent.id)
    } else {
      await supabase.from('gym_rent')
        .insert({ client_id: clientId, trainer_id: profile.id, sessions_paid: rentPaid, price_per_session: rentPrice })
    }
    await loadGymRent()
    setSavingRent(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    const { error } = await addPayment({ ...form, client_id: clientId, amount: parseFloat(form.amount) })
    if (!error) {
      setShowForm(false)
      setForm({ amount: '', package_size: 8, price_per_session: 500, payment_date: format(new Date(), 'yyyy-MM-dd'), status: 'paid', notes: '' })
    }
  }

  // ── Расчёты ────────────────────────────────────────────────────────────
  const now = new Date()
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(prevMonthStart)
  const yearStart = startOfYear(now)
  const yearEnd = endOfYear(now)

  function paymentsInRange(start, end) {
    return payments.filter(p => {
      const d = new Date(p.payment_date)
      return p.status === 'paid' && d >= start && d <= end
    })
  }

  const paidPayments = payments.filter(p => p.status === 'paid')

  // Общий доход от тренировок
  const totalRevenue = paidPayments.reduce((s, p) => s + Number(p.amount), 0)
  const thisMonthRevenue = paymentsInRange(thisMonthStart, thisMonthEnd).reduce((s, p) => s + Number(p.amount), 0)
  const prevMonthRevenue = paymentsInRange(prevMonthStart, prevMonthEnd).reduce((s, p) => s + Number(p.amount), 0)
  const yearRevenue = paymentsInRange(yearStart, yearEnd).reduce((s, p) => s + Number(p.amount), 0)

  // Аренда зала
  const totalSessions = balance.total_used || 0
  const rentPricePerSession = gymRent?.price_per_session || rentPrice
  const totalRentCost = totalSessions * rentPricePerSession         // сколько должен заплатить всего
  const totalRentPaid = (gymRent?.sessions_paid || 0) * rentPricePerSession  // сколько оплачено
  const rentDebt = totalRentCost - totalRentPaid                    // долг

  // Чистый доход = выручка - аренда оплаченная
  const netRevenue = totalRevenue - totalRentPaid
  const thisMonthNet = thisMonthRevenue - (Math.min(totalSessions, gymRent?.sessions_paid || 0) * rentPricePerSession)

  if (loading || gymLoading) return <div className="loading-spinner"><div className="spinner" /></div>

  return (
    <div>
      {/* ── БАЛАНС ТРЕНИРОВОК ─────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Куплено</div>
          <div className="stat-value">{balance.total_purchased}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Использовано</div>
          <div className="stat-value">{balance.total_used}</div>
        </div>
        <div className="stat-card" style={{ borderColor: balance.sessions_remaining > 2 ? 'var(--border)' : 'var(--danger)' }}>
          <div className="stat-label">Осталось</div>
          <div className="stat-value" style={{ color: balance.sessions_remaining > 2 ? 'var(--accent)' : 'var(--danger)' }}>
            {balance.sessions_remaining}
          </div>
        </div>
      </div>

      {balance.total_purchased > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>Использовано</span>
            <span>{balance.total_used} / {balance.total_purchased}</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${Math.min((balance.total_used / balance.total_purchased) * 100, 100)}%` }} />
          </div>
        </div>
      )}

      {/* ── АРЕНДА ЗАЛА ────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Building2 size={18} color="var(--accent)" />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Аренда зала</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-label">Тренировок проведено</div>
            <div className="stat-value">{totalSessions}</div>
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-label">Оплачено залу</div>
            <div className="stat-value" style={{ color: 'var(--success)' }}>{gymRent?.sessions_paid || 0} тр.</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{totalRentPaid.toLocaleString()} грн</div>
          </div>
          <div className="stat-card" style={{ padding: 14, borderColor: rentDebt > 0 ? 'var(--danger)' : 'var(--border)' }}>
            <div className="stat-label">Долг залу</div>
            <div className="stat-value" style={{ color: rentDebt > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {rentDebt > 0 ? `${rentDebt.toLocaleString()} грн` : '0 грн'}
            </div>
            {rentDebt > 0 && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 2 }}>{Math.round(rentDebt / rentPricePerSession)} тр.</div>}
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-label">Цена за тренировку</div>
            <div className="stat-value">{rentPricePerSession} грн</div>
          </div>
        </div>

        {/* Ручное обновление */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 14, display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 140 }}>
            <label className="form-label">Оплачено тренировок залу</label>
            <input className="form-input" type="number" min="0" value={rentPaid}
              onChange={e => setRentPaid(parseInt(e.target.value) || 0)} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1, minWidth: 120 }}>
            <label className="form-label">Цена/тренировка (грн)</label>
            <input className="form-input" type="number" min="0" value={rentPrice}
              onChange={e => setRentPrice(parseInt(e.target.value) || 0)} />
          </div>
          <button className="btn btn-primary btn-sm" onClick={saveGymRent} disabled={savingRent} style={{ marginBottom: 16 }}>
            <Save size={14} /> {savingRent ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* ── ФИНАНСОВАЯ СТАТИСТИКА ──────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <TrendingUp size={18} color="var(--success)" />
          <h3 style={{ fontSize: 15, fontWeight: 600 }}>Финансы</h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 20 }}>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-label">Этот месяц</div>
            <div className="stat-value" style={{ color: 'var(--accent)', fontSize: 20 }}>{thisMonthRevenue.toLocaleString()} грн</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>выручка</div>
          </div>
          <div className="stat-card" style={{ padding: 14 }}>
            <div className="stat-label">Прошлый месяц</div>
            <div className="stat-value" style={{ fontSize: 20 }}>{prevMonthRevenue.toLocaleString()} грн</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>выручка</div>
          </div>
          <div className="stat-card" style={{ padding: 14, borderColor: 'var(--success)' }}>
            <div className="stat-label">Аренда зала всего</div>
            <div className="stat-value" style={{ color: 'var(--danger)', fontSize: 20 }}>{totalRentCost.toLocaleString()} грн</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>расход</div>
          </div>
          <div className="stat-card" style={{ padding: 14, borderColor: 'var(--success)' }}>
            <div className="stat-label">Чистый доход (всего)</div>
            <div className="stat-value" style={{ color: 'var(--success)', fontSize: 20 }}>{netRevenue.toLocaleString()} грн</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>после аренды</div>
          </div>
        </div>

        {/* Итоговая таблица */}
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { label: 'Общая выручка от клиента', value: totalRevenue, color: 'var(--text-primary)' },
            { label: '— Аренда зала (оплачено)', value: -totalRentPaid, color: 'var(--danger)' },
            { label: 'Чистый доход', value: netRevenue, color: 'var(--success)', bold: true },
            { label: 'Долг по аренде', value: rentDebt, color: rentDebt > 0 ? 'var(--danger)' : 'var(--success)' },
            { label: 'Выручка за год', value: yearRevenue, color: 'var(--accent)' },
          ].map((row, i) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '11px 16px',
              borderBottom: i < 4 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{row.label}</span>
              <span style={{ fontSize: row.bold ? 16 : 14, fontWeight: row.bold ? 700 : 600, color: row.color }}>
                {row.value >= 0 ? '' : '−'}{Math.abs(row.value).toLocaleString()} грн
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── ДОБАВИТЬ ОПЛАТУ ────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>История оплат</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Добавить оплату
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Пакет</label>
                <select className="form-select" value={form.package_size}
                  onChange={e => set('package_size', parseInt(e.target.value))}>
                  {PACKAGE_SIZES.map(n => <option key={n} value={n}>{n === 1 ? '1 занятие (разовое)' : `${n} тренировок`}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Цена за тренировку</label>
                <select className="form-select" value={form.price_per_session}
                  onChange={e => set('price_per_session', parseInt(e.target.value))}>
                  {PRICE_OPTIONS.map(p => <option key={p} value={p}>{p} грн</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Сумма (авто)</label>
                <input className="form-input" type="number" value={form.amount}
                  onChange={e => set('amount', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Дата оплаты</label>
                <input className="form-input" type="date" value={form.payment_date}
                  onChange={e => set('payment_date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Статус</label>
                <select className="form-select" value={form.status}
                  onChange={e => set('status', e.target.value)}>
                  <option value="paid">Оплачено</option>
                  <option value="pending">Ожидает</option>
                  <option value="overdue">Просрочено</option>
                </select>
              </div>
            </div>
            {/* Превью суммы */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              {form.package_size} тр. × {form.price_per_session} грн = <strong style={{ color: 'var(--accent)' }}>{form.package_size * form.price_per_session} грн</strong>
              {' '}| Аренда зала: <strong style={{ color: 'var(--danger)' }}>{form.package_size * rentPricePerSession} грн</strong>
              {' '}| Чистый: <strong style={{ color: 'var(--success)' }}>{form.package_size * form.price_per_session - form.package_size * rentPricePerSession} грн</strong>
            </div>
            <div className="form-group">
              <label className="form-label">Заметка</label>
              <input className="form-input" value={form.notes}
                onChange={e => set('notes', e.target.value)} placeholder="Необязательно" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Отмена</button>
              <button type="submit" className="btn btn-primary btn-sm">Сохранить</button>
            </div>
          </form>
        </div>
      )}

      {/* ── ИСТОРИЯ ОПЛАТ ─────────────────────────────────────── */}
      {payments.length === 0 ? (
        <div className="empty-state">
          <CreditCard size={32} className="empty-icon" />
          <p>Нет записей об оплатах</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Пакет</th>
                  <th>Цена/тр.</th>
                  <th>Использовано</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments.map(p => (
                  <tr key={p.id}>
                    <td>{format(new Date(p.payment_date), 'dd.MM.yyyy')}</td>
                    <td>{p.package_size === 1 ? 'Разовое' : `${p.package_size} тр.`}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.price_per_session || '—'} грн</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 50 }}>
                          <div className="progress-fill" style={{ width: `${p.package_size > 0 ? (p.sessions_used / p.package_size) * 100 : 0}%` }} />
                        </div>
                        <span style={{ fontSize: 13 }}>{p.sessions_used}/{p.package_size}</span>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{Number(p.amount).toLocaleString()} грн</td>
                    <td><span className={`badge ${STATUS_BADGE[p.status]}`}>{PAYMENT_STATUS_LABELS[p.status]}</span></td>
                    <td>
                      <button className="btn-icon" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => window.confirm('Удалить запись?') && deletePayment(p.id)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
