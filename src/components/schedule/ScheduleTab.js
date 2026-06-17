// src/components/schedule/ScheduleTab.js
import { useState } from 'react'
import { useSchedule } from '../../hooks/useSchedule'
import { Plus, Calendar, Check, Clock, Ban, Trash2, Edit2, X } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '../../types'

const STATUS_BADGE = {
  planned: 'badge-orange',
  completed: 'badge-green',
  cancelled: 'badge-gray',
  missed: 'badge-red',
}

function EditSessionModal({ session, onClose, onSave }) {
  const [date, setDate] = useState(format(new Date(session.scheduled_at), 'yyyy-MM-dd'))
  const [time, setTime] = useState(format(new Date(session.scheduled_at), 'HH:mm'))
  const [duration, setDuration] = useState(session.duration_minutes || 60)
  const [status, setStatus] = useState(session.status)
  const [comment, setComment] = useState(session.trainer_comment || '')
  const [saving, setSaving] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    // Собираем дату из локальных компонентов, чтобы сохранить именно то время,
    // которое ввёл тренер (без сдвига часового пояса)
    const [y, m, d] = date.split('-').map(Number)
    const [hh, mm] = time.split(':').map(Number)
    const localDate = new Date(y, m - 1, d, hh, mm, 0)
    await onSave(session.id, {
      scheduled_at: localDate.toISOString(),
      duration_minutes: duration,
      status,
      trainer_comment: comment,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2 className="modal-title">Редактировать тренировку</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Дата</label>
              <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Время</label>
              <input className="form-input" type="time" value={time} onChange={e => setTime(e.target.value)} required />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Длительность</label>
              <select className="form-select" value={duration} onChange={e => setDuration(parseInt(e.target.value))}>
                <option value={30}>30 мин</option>
                <option value={45}>45 мин</option>
                <option value={60}>60 мин</option>
                <option value={90}>90 мин</option>
                <option value={120}>120 мин</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Статус</label>
              <select className="form-select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="planned">Запланирована</option>
                <option value="completed">Проведена</option>
                <option value="missed">Пропущена</option>
                <option value="cancelled">Отменена</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Комментарий</label>
            <input className="form-input" value={comment} onChange={e => setComment(e.target.value)} placeholder="Заметки" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ScheduleTab({ clientId }) {
  const { sessions, loading, addSession, updateSession, deleteSession } = useSchedule(clientId)
  const [showForm, setShowForm] = useState(false)
  const [editingSession, setEditingSession] = useState(null)
  const [form, setForm] = useState({ date: '', time: '10:00', duration_minutes: 60, trainer_comment: '' })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleAdd(e) {
    e.preventDefault()
    const { error } = await addSession({
      client_id: clientId,
      scheduled_at: `${form.date}T${form.time}:00`,
      duration_minutes: form.duration_minutes,
      trainer_comment: form.trainer_comment,
      status: 'planned',
    })
    if (!error) {
      setShowForm(false)
      setForm({ date: '', time: '10:00', duration_minutes: 60, trainer_comment: '' })
    }
  }

  async function handleDelete(id) {
    if (window.confirm('Удалить тренировку?')) await deleteSession(id)
  }

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  const sortedSessions = [...sessions].reverse()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>История тренировок</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} /> Записать тренировку
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 20 }}>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Дата *</label>
                <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Время *</label>
                <input className="form-input" type="time" value={form.time} onChange={e => set('time', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Длительность</label>
                <select className="form-select" value={form.duration_minutes} onChange={e => set('duration_minutes', parseInt(e.target.value))}>
                  <option value={30}>30 мин</option>
                  <option value={45}>45 мин</option>
                  <option value={60}>60 мин</option>
                  <option value={90}>90 мин</option>
                  <option value={120}>120 мин</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Комментарий</label>
              <input className="form-input" value={form.trainer_comment} onChange={e => set('trainer_comment', e.target.value)} placeholder="Заметки к тренировке" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowForm(false)}>Отмена</button>
              <button type="submit" className="btn btn-primary btn-sm">Записать</button>
            </div>
          </form>
        </div>
      )}

      {sessions.length === 0 ? (
        <div className="empty-state">
          <Calendar size={32} className="empty-icon" />
          <p>Нет записей о тренировках</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sortedSessions.map(s => (
            <div key={s.id} className="card-sm" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{format(new Date(s.scheduled_at), 'd')}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {format(new Date(s.scheduled_at), 'MMM', { locale: ru })}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>Тренировка</span>
                  <span className={`badge ${STATUS_BADGE[s.status]}`}>{SESSION_STATUS_LABELS[s.status]}</span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>{format(new Date(s.scheduled_at), 'HH:mm')}</span>
                  <span>{s.duration_minutes} мин</span>
                  {s.trainer_comment && <span>· {s.trainer_comment}</span>}
                </div>
              </div>

              {/* Быстрые действия для запланированных */}
              {s.status === 'planned' && (
                <div style={{ display: 'flex', gap: 5 }}>
                  <button className="btn-icon" style={{ color: 'var(--success)', borderColor: 'var(--success)' }} title="Провести"
                    onClick={() => updateSession(s.id, { status: 'completed' })}>
                    <Check size={13} />
                  </button>
                  <button className="btn-icon" style={{ color: 'var(--warning)', borderColor: 'var(--warning)' }} title="Пропущена"
                    onClick={() => updateSession(s.id, { status: 'missed' })}>
                    <Clock size={13} />
                  </button>
                  <button className="btn-icon" style={{ color: 'var(--text-muted)' }} title="Отменить"
                    onClick={() => updateSession(s.id, { status: 'cancelled' })}>
                    <Ban size={13} />
                  </button>
                </div>
              )}

              {/* Редактировать и удалить — для всех */}
              <div style={{ display: 'flex', gap: 5 }}>
                <button className="btn-icon" style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }} title="Перенести дату/время"
                  onClick={() => setEditingSession(s)}>
                  <Calendar size={13} />
                </button>
                <button className="btn-icon" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} title="Удалить"
                  onClick={() => handleDelete(s.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onClose={() => setEditingSession(null)}
          onSave={updateSession}
        />
      )}
    </div>
  )
}
