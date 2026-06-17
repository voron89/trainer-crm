// src/pages/ClientDetailPage.js
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { usePayments } from '../hooks/usePayments'
import { usePrograms } from '../hooks/usePrograms'
import { useStats } from '../hooks/useStats'
import { useSchedule } from '../hooks/useSchedule'
import { ArrowLeft, Edit, Trash2, Plus, Phone, MessageCircle, Target } from 'lucide-react'
import { GOAL_LABELS, STATUS_LABELS } from '../types'
import { format } from 'date-fns'
import ClientModal from '../components/clients/ClientModal'
import PaymentsTab from '../components/payments/PaymentsTab'
import ProgramsTab from '../components/programs/ProgramsTab'
import StatsTab from '../components/stats/StatsTab'
import ScheduleTab from '../components/schedule/ScheduleTab'

const TABS = [
  { id: 'programs', label: 'Программы' },
  { id: 'schedule', label: 'Расписание' },
  { id: 'payments', label: 'Оплаты' },
  { id: 'stats', label: 'Статистика' },
]

const STATUS_COLOR = { active: 'var(--success)', pause: 'var(--warning)', finished: 'var(--text-muted)' }

export default function ClientDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { clients, updateClient, deleteClient, loading } = useClients()
  const { balance } = usePayments(id)
  const [activeTab, setActiveTab] = useState('programs')
  const [showEdit, setShowEdit] = useState(false)

  const client = clients.find(c => c.id === id)

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>
  if (!client) return (
    <div className="page-container">
      <button className="btn btn-ghost" onClick={() => navigate('/clients')}><ArrowLeft size={16} /> Назад</button>
      <div className="empty-state" style={{ marginTop: 40 }}><p>Клиент не найден</p></div>
    </div>
  )

  async function handleUpdate(data) {
    const { error } = await updateClient(id, data)
    if (!error) setShowEdit(false)
    return { error }
  }

  async function handleDelete() {
    if (!window.confirm('Удалить клиента? Это действие нельзя отменить.')) return
    const { error } = await deleteClient(id)
    if (!error) navigate('/clients')
  }

  const initials = client.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="page-container">
      {/* Back */}
      <button className="btn btn-ghost" style={{ marginBottom: 20 }} onClick={() => navigate('/clients')}>
        <ArrowLeft size={16} /> К списку клиентов
      </button>

      {/* Header card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
          <div className="avatar avatar-lg" style={{ width: 80, height: 80, fontSize: 28 }}>
            {client.avatar_url ? <img src={client.avatar_url} alt="" /> : initials}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700 }}>{client.full_name}</h1>
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: 'var(--bg-input)', color: STATUS_COLOR[client.status] }}>
                ● {STATUS_LABELS[client.status]}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
              {client.goal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--accent)' }}>
                  <Target size={13} /> {GOAL_LABELS[client.goal]}
                </div>
              )}
              {client.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <Phone size={13} /> {client.phone}
                </div>
              )}
              {client.email && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                  <MessageCircle size={13} /> {client.email}
                </div>
              )}
            </div>
            {client.notes && (
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', maxWidth: 500 }}>
                {client.notes}
              </p>
            )}
          </div>

          {/* Balance badge */}
          <div style={{ background: 'var(--accent-muted)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', textAlign: 'center', minWidth: 120 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)' }}>{balance?.sessions_remaining ?? 0}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>тренировок осталось</div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-icon" onClick={() => setShowEdit(true)} title="Редактировать"><Edit size={15} /></button>
            <button className="btn-icon" onClick={handleDelete} title="Удалить" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'programs' && <ProgramsTab clientId={id} />}
      {activeTab === 'schedule' && <ScheduleTab clientId={id} />}
      {activeTab === 'payments' && <PaymentsTab clientId={id} />}
      {activeTab === 'stats' && <StatsTab clientId={id} />}

      {showEdit && <ClientModal client={client} onClose={() => setShowEdit(false)} onSave={handleUpdate} />}
    </div>
  )
}
