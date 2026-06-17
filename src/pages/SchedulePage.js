// src/pages/SchedulePage.js
import { useState, useRef } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { useSchedule } from '../hooks/useSchedule'
import { useClients } from '../hooks/useClients'
import { format } from 'date-fns'
import { Plus, X, Check, Clock, Ban, Upload } from 'lucide-react'
import { SESSION_STATUS_LABELS, SESSION_STATUS_COLORS } from '../types'
import IcsImport from '../components/schedule/IcsImport'
import { supabase } from '../lib/supabase'

export default function SchedulePage() {
  const { sessions, loading, addSession, updateSession } = useSchedule()
  const { clients } = useClients()
  const calRef = useRef(null)
  const [selectedSession, setSelectedSession] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [filterClientId, setFilterClientId] = useState('all')
  const [form, setForm] = useState({ client_id: '', date: '', time: '10:00', duration_minutes: 60, trainer_comment: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const filteredSessions = filterClientId === 'all'
    ? sessions
    : sessions.filter(s => s.client_id === filterClientId)

  const events = filteredSessions.map(s => ({
    id: s.id,
    title: s.clients?.full_name || 'Тренировка',
    start: s.scheduled_at,
    end: new Date(new Date(s.scheduled_at).getTime() + s.duration_minutes * 60000).toISOString(),
    backgroundColor: SESSION_STATUS_COLORS[s.status] || SESSION_STATUS_COLORS.planned,
    borderColor: SESSION_STATUS_COLORS[s.status] || SESSION_STATUS_COLORS.planned,
    extendedProps: { session: s },
  }))

  function handleDateClick(info) {
    const dateOnly = info.dateStr.substring(0, 10)
    setForm(f => ({ ...f, date: dateOnly }))
    setShowAddModal(true)
  }

  // Перенос тренировки drag&drop
  async function handleEventDrop(info) {
    const session = info.event.extendedProps.session
    const newStart = info.event.start
    const { error } = await updateSession(session.id, {
      scheduled_at: newStart.toISOString(),
    })
    if (error) {
      info.revert()
      return
    }

    // Уведомляем клиента о переносе если у него есть Telegram
    try {
      const client = clients.find(c => c.id === session.client_id)
      if (client?.telegram_chat_id) {
        const newTime = newStart.toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
        const { data: { session: authSess } } = await supabase.auth.getSession()
        await fetch(`${process.env.REACT_APP_SUPABASE_URL}/functions/v1/smooth-action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authSess?.access_token}` },
          body: JSON.stringify({
            type: 'send_message',
            data: { chat_id: client.telegram_chat_id, text: `🔄 <b>Тренування перенесено</b>\n\nНове час: <b>${newTime}</b>` }
          })
        })
      }
    } catch(e) { console.log('notify error', e) }
  }

  // Изменение длительности через resize
  async function handleEventResize(info) {
    const session = info.event.extendedProps.session
    const start = info.event.start
    const end = info.event.end
    const durationMinutes = Math.round((end - start) / 60000)
    const { error } = await updateSession(session.id, {
      duration_minutes: durationMinutes,
    })
    if (error) {
      info.revert()
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!form.client_id) { setError('Выберите клиента'); return }
    if (!form.date) { setError('Укажите дату'); return }
    // Собираем дату из локальных компонентов, чтобы сохранить введённое время без сдвига зоны
    const [y, m, d] = form.date.split('-').map(Number)
    const [hh, mm] = form.time.split(':').map(Number)
    const scheduled_at = new Date(y, m - 1, d, hh, mm, 0).toISOString()
    setSaving(true)
    const { error } = await addSession({
      client_id: form.client_id, scheduled_at,
      duration_minutes: form.duration_minutes,
      trainer_comment: form.trainer_comment, status: 'planned',
    })
    setSaving(false)
    if (error) { setError(error.message) }
    else {
      setShowAddModal(false)
      setForm({ client_id: '', date: '', time: '10:00', duration_minutes: 60, trainer_comment: '' })
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Расписание</h1>
          <p className="page-subtitle">Кликните на дату для добавления тренировки</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-select" value={filterClientId}
            onChange={e => setFilterClientId(e.target.value)} style={{ width: 180 }}>
            <option value="all">Все клиенты</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            <Upload size={15} /> Импорт .ics
          </button>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Добавить
          </button>
        </div>
      </div>

      <div className="card schedule-card" style={{ padding: 16 }}>
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
          buttonText={{ today: 'Сегодня', month: 'Месяц', week: 'Неделя', day: 'День' }}
          locale="ru" firstDay={1}
          slotMinTime="06:00:00" slotMaxTime="22:00:00"
          height="auto" events={events}
          dateClick={handleDateClick}
          eventClick={info => setSelectedSession(info.event.extendedProps.session)}
          eventDisplay="block" nowIndicator
          editable={true}
          eventDurationEditable={true}
          eventStartEditable={true}
          eventDrop={handleEventDrop}
          eventResize={handleEventResize}
        />
      </div>

      {/* Add modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Новая тренировка</h2>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="form-group">
                <label className="form-label">Клиент *</label>
                <select className="form-select" value={form.client_id} onChange={e => set('client_id', e.target.value)} required>
                  <option value="">Выберите клиента</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Дата *</label>
                  <input className="form-input" type="date" value={form.date} onChange={e => set('date', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Время *</label>
                  <input className="form-input" type="time" value={form.time} onChange={e => set('time', e.target.value)} required />
                </div>
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
              <div className="form-group">
                <label className="form-label">Комментарий</label>
                <input className="form-input" value={form.trainer_comment} onChange={e => set('trainer_comment', e.target.value)} placeholder="Заметки" />
              </div>
              {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>{error}</div>}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Отмена</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Сохранение...' : 'Добавить'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session detail */}
      {selectedSession && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedSession(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{selectedSession.clients?.full_name}</h2>
              <button className="btn-icon" onClick={() => setSelectedSession(null)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Дата</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{format(new Date(selectedSession.scheduled_at), 'dd.MM.yyyy HH:mm')}</div>
                </div>
                <div style={{ background: 'var(--bg-input)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Длительность</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{selectedSession.duration_minutes} мин</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Статус:</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: SESSION_STATUS_COLORS[selectedSession.status] }}>
                  {SESSION_STATUS_LABELS[selectedSession.status]}
                </span>
              </div>
              {selectedSession.trainer_comment && (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', background: 'var(--bg-input)', padding: '10px 12px', borderRadius: 'var(--radius-sm)' }}>
                  {selectedSession.trainer_comment}
                </p>
              )}
              {selectedSession.status === 'planned' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => { updateSession(selectedSession.id, { status: 'completed' }); setSelectedSession(null) }}>
                    <Check size={14} /> Провести
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { updateSession(selectedSession.id, { status: 'missed' }); setSelectedSession(null) }}>
                    <Clock size={14} /> Пропущена
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => { updateSession(selectedSession.id, { status: 'cancelled' }); setSelectedSession(null) }}>
                    <Ban size={14} /> Отменить
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ICS Import */}
      {showImport && <IcsImport onClose={() => setShowImport(false)} />}
    </div>
  )
}
