// src/pages/ClientsPage.js
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClients } from '../hooks/useClients'
import { Plus, Search, Filter, ChevronRight, Phone, MessageCircle } from 'lucide-react'
import { GOAL_LABELS, STATUS_LABELS } from '../types'
import ClientModal from '../components/clients/ClientModal'

const STATUS_BADGE = { active: 'badge-green', pause: 'badge-yellow', finished: 'badge-gray' }

export default function ClientsPage() {
  const { clients, loading, addClient } = useClients()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [showModal, setShowModal] = useState(false)

  const filtered = clients.filter(c => {
    const matchSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || c.status === filterStatus
    return matchSearch && matchStatus
  })

  async function handleAdd(data) {
    const { error } = await addClient(data)
    if (!error) setShowModal(false)
    return { error }
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Клиенты</h1>
          <p className="page-subtitle">{clients.length} клиентов</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Добавить клиента
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Поиск по имени или email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
        <select
          className="form-select"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: 160 }}
        >
          <option value="all">Все статусы</option>
          <option value="active">Активные</option>
          <option value="pause">Пауза</option>
          <option value="finished">Завершили</option>
        </select>
      </div>

      {/* Client cards */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>{search ? 'Клиент не найден' : 'Добавьте первого клиента'}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(client => (
            <div
              key={client.id}
              className="card card-hover"
              onClick={() => navigate(`/clients/${client.id}`)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div className="avatar avatar-lg">
                  {client.avatar_url
                    ? <img src={client.avatar_url} alt="" />
                    : client.full_name?.slice(0, 1)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.full_name}
                    </span>
                    <span className={`badge ${STATUS_BADGE[client.status] || 'badge-gray'}`}>
                      {STATUS_LABELS[client.status] || client.status}
                    </span>
                  </div>
                  {client.goal && (
                    <div style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 8 }}>
                      {GOAL_LABELS[client.goal]}
                    </div>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {client.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <Phone size={12} /> {client.phone}
                      </div>
                    )}
                    {client.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
                        <MessageCircle size={12} /> {client.email}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ClientModal onClose={() => setShowModal(false)} onSave={handleAdd} />
      )}
    </div>
  )
}
