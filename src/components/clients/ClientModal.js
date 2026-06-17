// src/components/clients/ClientModal.js
import { useState } from 'react'
import { X } from 'lucide-react'
import { GOAL_LABELS } from '../../types'

export default function ClientModal({ client, onClose, onSave }) {
  const [form, setForm] = useState({
    full_name: client?.full_name || '',
    phone: client?.phone || '',
    email: client?.email || '',
    goal: client?.goal || '',
    status: client?.status || 'active',
    birth_date: client?.birth_date || null,
    notes: client?.notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.full_name.trim()) { setError('Введите имя клиента'); return }
    setLoading(true)
    const { error } = await onSave({ ...form, birth_date: form.birth_date || null })
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">{client ? 'Редактировать клиента' : 'Новый клиент'}</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Имя и фамилия *</label>
            <input className="form-input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="Иван Петров" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Телефон</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+380 99 000 00 00" />
            </div>
            <div className="form-group">
              <label className="form-label">Telegram</label>
              <input className="form-input" value={form.email} onChange={e => set('email', e.target.value)} placeholder="@username" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Цель</label>
              <select className="form-select" value={form.goal} onChange={e => set('goal', e.target.value)}>
                <option value="">Не выбрана</option>
                {Object.entries(GOAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-select" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="active">Активный</option>
                <option value="pause">Пауза</option>
                <option value="finished">Завершил</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Дата рождения</label>
            <input className="form-input" type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Заметки</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Травмы, особенности, цели..." />
          </div>

          {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</div>}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
