// src/components/schedule/IcsImport.js
import { useState, useRef } from 'react'
import { Upload, X, Check, Calendar, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useClients } from '../../hooks/useClients'
import { useSchedule } from '../../hooks/useSchedule'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

// ─── ICS Parser ─────────────────────────────────────────────────────────────

function parseIcsDate(str) {
  if (!str) return null
  // Форматы: 20240612T100000Z  или  20240612T100000  или  20240612
  const clean = str.replace('Z', '').replace(/\r/g, '')
  if (clean.includes('T')) {
    const y = clean.slice(0, 4)
    const mo = clean.slice(4, 6)
    const d = clean.slice(6, 8)
    const h = clean.slice(9, 11)
    const mi = clean.slice(11, 13)
    const s = clean.slice(13, 15) || '00'
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`)
  } else {
    return new Date(`${clean.slice(0,4)}-${clean.slice(4,6)}-${clean.slice(6,8)}T10:00:00`)
  }
}

function parseIcs(text) {
  const events = []
  const lines = text.replace(/\r\n /g, '').replace(/\r\n\t/g, '').split(/\r?\n/)
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
    } else if (line === 'END:VEVENT' && current) {
      events.push(current)
      current = null
    } else if (current) {
      const colonIdx = line.indexOf(':')
      if (colonIdx === -1) continue
      const key = line.slice(0, colonIdx).split(';')[0].toUpperCase()
      const val = line.slice(colonIdx + 1)

      if (key === 'DTSTART') current.start = parseIcsDate(val)
      else if (key === 'DTEND') current.end = parseIcsDate(val)
      else if (key === 'SUMMARY') current.summary = val
      else if (key === 'DESCRIPTION') current.description = val
      else if (key === 'LOCATION') current.location = val
      else if (key === 'UID') current.uid = val
    }
  }

  return events.map(e => {
    const duration = e.start && e.end
      ? Math.round((e.end - e.start) / 60000)
      : 60
    return {
      uid: e.uid || Math.random().toString(),
      title: e.summary || 'Тренировка',
      start: e.start,
      duration: duration > 0 ? duration : 60,
      description: e.description || '',
      location: e.location || '',
    }
  }).filter(e => e.start)
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function IcsImport({ onClose }) {
  const { clients } = useClients()
  const { addSession } = useSchedule()

  const [step, setStep] = useState('upload') // upload | match | preview | done
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState({})      // uid → true/false
  const [clientMap, setClientMap] = useState({})    // uid → clientId
  const [importing, setImporting] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState(null)
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.ics')) {
      setError('Выберите файл с расширением .ics')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseIcs(ev.target.result)
        if (parsed.length === 0) {
          setError('В файле не найдено событий')
          return
        }
        setEvents(parsed)
        // По умолчанию выбрать все
        const sel = {}
        const cm = {}
        parsed.forEach(e => { sel[e.uid] = true; cm[e.uid] = '' })
        setSelected(sel)
        setClientMap(cm)
        setError('')
        setStep('match')
      } catch (err) {
        setError('Не удалось прочитать файл. Убедитесь что это валидный .ics файл.')
      }
    }
    reader.readAsText(file)
  }

  function toggleEvent(uid) {
    setSelected(s => ({ ...s, [uid]: !s[uid] }))
  }

  function setClient(uid, clientId) {
    setClientMap(c => ({ ...c, [uid]: clientId }))
  }

  function selectAll() {
    const sel = {}
    events.forEach(e => sel[e.uid] = true)
    setSelected(sel)
  }

  function deselectAll() {
    const sel = {}
    events.forEach(e => sel[e.uid] = false)
    setSelected(sel)
  }

  async function handleImport() {
    const toImport = events.filter(e => selected[e.uid] && clientMap[e.uid])
    if (toImport.length === 0) {
      setError('Выберите события и укажите клиента для каждого')
      return
    }
    setImporting(true)
    setError('')
    let count = 0
    for (const ev of toImport) {
      const scheduled_at = ev.start.toISOString()
      const { error } = await addSession({
        client_id: clientMap[ev.uid],
        scheduled_at,
        duration_minutes: ev.duration,
        trainer_comment: [ev.description, ev.location].filter(Boolean).join(' | ') || '',
        status: ev.start < new Date() ? 'completed' : 'planned',
      })
      if (!error) count++
    }
    setImportedCount(count)
    setStep('done')
    setImporting(false)
  }

  const selectedCount = Object.values(selected).filter(Boolean).length
  const withClient = events.filter(e => selected[e.uid] && clientMap[e.uid]).length

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div className="modal-header">
          <h2 className="modal-title">Импорт из Apple Calendar</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* ── ШАГ 1: ЗАГРУЗКА ─────────────────────────────── */}
        {step === 'upload' && (
          <div>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Экспортируй календарь из приложения Календарь на Mac:<br />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                Файл → Экспорт → Экспорт... → сохрани .ics файл
              </span>
            </p>

            <div
              style={{
                border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--accent)' }}
              onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              onDrop={e => {
                e.preventDefault()
                e.currentTarget.style.borderColor = 'var(--border)'
                const file = e.dataTransfer.files[0]
                if (file) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [file] } }) }
              }}
            >
              <Upload size={32} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Перетащи .ics файл сюда</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>или нажми чтобы выбрать</div>
            </div>
            <input ref={fileRef} type="file" accept=".ics" style={{ display: 'none' }} onChange={handleFile} />

            {error && (
              <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', display: 'flex', gap: 8 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            {/* Инструкция */}
            <div style={{ marginTop: 20, background: 'var(--bg-secondary)', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Как экспортировать:</div>
              {[
                'Открой приложение Календарь на Mac',
                'В меню выбери Файл → Экспорт → Экспорт...',
                'Сохрани файл в любое место',
                'Перетащи его сюда или нажми кнопку выше',
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                  <span style={{ color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ШАГ 2: МАТЧИНГ ──────────────────────────────── */}
        {step === 'match' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Найдено <strong style={{ color: 'var(--accent)' }}>{events.length}</strong> событий.
                Выбери нужные и назначь клиента.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-ghost btn-sm" onClick={selectAll}>Все</button>
                <button className="btn btn-ghost btn-sm" onClick={deselectAll}>Снять</button>
              </div>
            </div>

            <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {events.map(ev => (
                <div key={ev.uid} style={{
                  background: selected[ev.uid] ? 'var(--bg-card)' : 'var(--bg-secondary)',
                  border: `1px solid ${selected[ev.uid] ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 8, padding: 12,
                  opacity: selected[ev.uid] ? 1 : 0.5,
                  transition: 'all 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {/* Чекбокс */}
                    <div
                      onClick={() => toggleEvent(ev.uid)}
                      style={{
                        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                        background: selected[ev.uid] ? 'var(--accent)' : 'var(--bg-input)',
                        border: `2px solid ${selected[ev.uid] ? 'var(--accent)' : 'var(--border)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      {selected[ev.uid] && <Check size={11} color="white" strokeWidth={3} />}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{ev.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: selected[ev.uid] ? 8 : 0 }}>
                        {ev.start ? format(ev.start, 'dd MMM yyyy, HH:mm', { locale: ru }) : '—'}
                        {' · '}{ev.duration} мин
                        {ev.location && ` · 📍 ${ev.location}`}
                      </div>

                      {selected[ev.uid] && (
                        <select
                          className="form-select"
                          value={clientMap[ev.uid] || ''}
                          onChange={e => setClient(ev.uid, e.target.value)}
                          style={{ fontSize: 13 }}
                        >
                          <option value="">— Выбери клиента —</option>
                          {clients.map(c => (
                            <option key={c.id} value={c.id}>{c.full_name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Статус past/future */}
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 20, flexShrink: 0,
                      background: ev.start < new Date() ? 'rgba(107,114,128,0.15)' : 'rgba(232,74,26,0.15)',
                      color: ev.start < new Date() ? '#9ca3af' : 'var(--accent)',
                    }}>
                      {ev.start < new Date() ? 'Прошедшее' : 'Будущее'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 6, fontSize: 13, color: 'var(--danger)' }}>
                {error}
              </div>
            )}

            <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 13, color: 'var(--text-secondary)' }}>
              Выбрано: <strong>{selectedCount}</strong> · С клиентом: <strong style={{ color: withClient === selectedCount && selectedCount > 0 ? 'var(--success)' : 'var(--warning)' }}>{withClient}</strong>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep('upload')}>Назад</button>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={importing || withClient === 0}
              >
                {importing ? 'Импортируем...' : `Импортировать ${withClient > 0 ? withClient : ''}`}
              </button>
            </div>
          </div>
        )}

        {/* ── ШАГ 3: ГОТОВО ───────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)', border: '2px solid var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Check size={28} color="var(--success)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Готово!</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Успешно импортировано <strong style={{ color: 'var(--accent)' }}>{importedCount}</strong> тренировок
            </p>
            <button className="btn btn-primary" onClick={onClose}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  )
}
