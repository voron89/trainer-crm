// src/components/programs/TextImport.js
import { useState } from 'react'
import { X, Check, AlertCircle, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

// ─── ПАРСЕР ─────────────────────────────────────────────────────────────────

const DAY_MAP = {
  'понедельник': 1, 'пн': 1,
  'вторник': 2,    'вт': 2,
  'среда': 3,      'ср': 3,
  'четверг': 4,    'чт': 4,
  'пятница': 5,    'пт': 5,
  'суббота': 6,    'сб': 6,
  'воскресенье': 7,'вс': 7,
}

// "30х7,8" → [{weight:30,reps:7},{weight:30,reps:8}]
// "70х8,10" → [{weight:70,reps:8},{weight:70,reps:10}]
// "35/42/53 на 10/8/8" → [{weight:35,reps:10},{weight:42,reps:8},{weight:53,reps:8}]
// "10 на 8" → [{weight:10,reps:8}]
// "Свой вес х9" → [{weight:null,reps:9}]

function parseSets(str) {
  if (!str) return []
  str = str.trim()
  const sets = []

  // "35/42/53 на 10/8/8" или "10/15/20 на 10/8/6"
  const slashPattern = /(\d[\d/]*)\s+на\s+([\d/]+)/gi
  let m
  while ((m = slashPattern.exec(str)) !== null) {
    const weights = m[1].split('/').map(Number)
    const repsArr = m[2].split('/').map(Number)
    for (let i = 0; i < weights.length; i++) {
      sets.push({ weight: weights[i] || null, reps: repsArr[i] || null })
    }
    str = str.replace(m[0], '')
  }

  // "10 на 8" (одиночный вес на повторения)
  const singleNaPattern = /(\d+(?:\.\d+)?)\s+на\s+(\d+)/gi
  str = str.replace(singleNaPattern, (_, w, r) => {
    sets.push({ weight: parseFloat(w), reps: parseInt(r) })
    return ''
  })

  // "Свой вес х9" или "свой вес x9"
  const bodyweightPattern = /свой\s*вес\s*[хx×]\s*(\d+)/gi
  str = str.replace(bodyweightPattern, (_, r) => {
    sets.push({ weight: null, reps: parseInt(r) })
    return ''
  })

  // "30х7,8" или "25х 10" или "70х8,10"
  const xPattern = /(\d+(?:\.\d+)?)\s*[хxХX×]\s*([\d,\s]+)/g
  str = str.replace(xPattern, (_, w, repsStr) => {
    const reps = repsStr.split(',').map(r => parseInt(r.trim())).filter(r => !isNaN(r) && r > 0)
    reps.forEach(r => sets.push({ weight: parseFloat(w), reps: r }))
    return ''
  })

  return sets
}

function parseLine(line) {
  // Разминка блок
  const warmupMatch = line.match(/разминка\s+(.+?)(?=отказ|около\s*отказ|$)/i)
  // Отказ блок
  const failureMatch = line.match(/отказ\s+(.+?)(?=около\s*отказ|$)/i)
  // Около отказ блок
  const nearMatch = line.match(/около\s*отказ?\s+(.+?)$/i)
  // Без разминки — просто пропускаем

  const result = []

  if (warmupMatch) {
    const sets = parseSets(warmupMatch[1])
    sets.forEach((s, i) => result.push({ ...s, set_type: 'warmup', set_number: i + 1 }))
  }

  if (failureMatch) {
    const sets = parseSets(failureMatch[1])
    sets.forEach((s, i) => result.push({ ...s, set_type: 'failure', set_number: i + 1 }))
  }

  if (nearMatch) {
    const sets = parseSets(nearMatch[1])
    sets.forEach((s, i) => result.push({ ...s, set_type: 'near_failure', set_number: i + 1 }))
  }

  // Если ничего не найдено но есть числа — пробуем как отказные
  if (result.length === 0) {
    const sets = parseSets(line)
    sets.forEach((s, i) => result.push({ ...s, set_type: 'failure', set_number: i + 1 }))
  }

  return result
}

function parseProgram(text) {
  // Предобработка: разбиваем строку если в ней несколько блоков (день + упражнение)
  const rawLines = text.split('\n')
  const lines = []
  for (const raw of rawLines) {
    const line = raw.trim()
    if (!line) continue

    // Если строка содержит "День N" И упражнение после — разбиваем
    const dayAndEx = line.match(/^([^📌•*]*день\s*\d+[^📌•*\n]{0,30}?)(📌|[•*·])(.*)$/iu)
    if (dayAndEx) {
      lines.push(dayAndEx[1].trim())
      lines.push(dayAndEx[2] + dayAndEx[3])
    } else {
      lines.push(line)
    }
  }

  const workouts = []
  let currentWorkout = null
  let currentExercise = null
  let pendingSets = ''

  function flushExercise() {
    if (currentExercise && currentWorkout) {
      const sets = parseLine(pendingSets)
      currentWorkout.exercises.push({ ...currentExercise, sets })
    }
    pendingSets = ''
  }

  const DAY_NAMES = { 1: 'Понедельник', 2: 'Вторник', 3: 'Среда', 4: 'Четверг', 5: 'Пятница', 6: 'Суббота', 7: 'Воскресенье' }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Убираем ВСЕ эмодзи и спецсимволы для детекции дня
    const cleanLine = line
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}]/gu, '')
      .replace(/[📌👉•*·\-–]/g, '')
      .trim()

    // ── ДЕНЬ ────────────────────────────────────────────────
    const dayNumMatch = cleanLine.match(/^день\s*(\d+)/i)
    if (dayNumMatch) {
      flushExercise()
      currentExercise = null

      const dayNum = parseInt(dayNumMatch[1])
      const lower = cleanLine.toLowerCase()

      let dayOfWeek = dayNum
      for (const [name, num] of Object.entries(DAY_MAP)) {
        if (lower.includes(name)) { dayOfWeek = num; break }
      }

      const afterDay = cleanLine.replace(/^день\s*\d+\s*/i, '').trim()
      const dayLabel = afterDay
        ? afterDay.charAt(0).toUpperCase() + afterDay.slice(1).toLowerCase()
        : (DAY_NAMES[dayOfWeek] || `День ${dayNum}`)

      currentWorkout = {
        name: `День ${dayNum} — ${dayLabel}`,
        day_of_week: dayOfWeek,
        order_index: workouts.length,
        exercises: [],
      }
      workouts.push(currentWorkout)
      continue
    }

    // ── УПРАЖНЕНИЕ ──────────────────────────────────────────
    // Начинается с эмодзи-маркера или спецсимвола: 📌 • * · - –
    const isExerciseLine = /^[📌•*·\-–]|^\u{1F4CC}/u.test(line)
    if (isExerciseLine && currentWorkout) {
      flushExercise()

      // Убираем маркер и получаем чистое содержимое
      const rawContent = line.replace(/^[📌•*·\-–\s]+/u, '').trim()

      // Ищем двоеточие как разделитель названия и подходов
      const colonIdx = rawContent.indexOf(':')
      let name = rawContent
      let inlineSets = ''

      if (colonIdx !== -1) {
        name = rawContent.slice(0, colonIdx).trim()
        inlineSets = rawContent.slice(colonIdx + 1).trim()
      } else {
        // Проверяем есть ли в строке данные подходов после названия
        // Название — до первого вхождения "Разминка"/"Отказ"/"Без"/"х\d"
        const setsStart = rawContent.search(/разминка|отказ|без\s+разминки|\d+[хx×]/i)
        if (setsStart > 0) {
          name = rawContent.slice(0, setsStart).trim()
          inlineSets = rawContent.slice(setsStart).trim()
        }
      }

      // Убираем лишнее из названия
      name = name.replace(/без\s+разминки/gi, '').replace(/:$/, '').trim()

      currentExercise = { name, comment: '' }
      pendingSets = inlineSets
      continue
    }

    // ── ДАННЫЕ ПОДХОДОВ ─────────────────────────────────────
    // Строки с весами/повторениями добавляем к текущему упражнению
    // Пропускаем строки-комментарии (Линейный, Тяжелый и т.д.)
    if (currentExercise) {
      const hasSetData = /\d+[хx×]|разминка|отказ|без\s+разминки|свой\s+вес/i.test(line)
      if (hasSetData) {
        pendingSets += ' ' + line
      }
      // Иначе — это комментарий/заметка, пропускаем
    }
  }

  flushExercise()
  return workouts.filter(w => w.exercises.length > 0)
}

// ─── PREVIEW COMPONENT ───────────────────────────────────────────────────────

const SET_TYPE_LABELS = { warmup: 'Разминка', failure: 'Отказ', near_failure: 'Около отказа' }
const SET_TYPE_COLORS = { warmup: '#6b7280', failure: '#E84A1A', near_failure: '#f59e0b' }

function SetBadge({ type }) {
  return (
    <span style={{
      fontSize: 11, padding: '1px 7px', borderRadius: 20, fontWeight: 500,
      background: `${SET_TYPE_COLORS[type]}20`, color: SET_TYPE_COLORS[type],
      border: `1px solid ${SET_TYPE_COLORS[type]}40`,
    }}>{SET_TYPE_LABELS[type]}</span>
  )
}

function WorkoutPreview({ workout, index }) {
  const [open, setOpen] = useState(index === 0)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-secondary)', cursor: 'pointer' }}
        onClick={() => setOpen(o => !o)}>
        <div>
          <span style={{ fontWeight: 600, fontSize: 14 }}>👉🏻 {workout.name}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>{workout.exercises.length} упражнений</span>
        </div>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </div>
      {open && (
        <div style={{ padding: '10px 14px' }}>
          {workout.exercises.map((ex, ei) => (
            <div key={ei} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: ei < workout.exercises.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>• {ex.name}</div>
              {ex.sets.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>— подходы не распознаны</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ex.sets.map((s, si) => (
                    <span key={si} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <SetBadge type={s.set_type} />
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{s.weight ? `${s.weight} кг` : 'Свой вес'}</span>
                      {s.reps && <span style={{ color: 'var(--text-secondary)' }}>× {s.reps}</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────

export default function TextImport({ clientId, programId, onClose, onDone }) {
  const { profile } = useAuth()
  const [step, setStep] = useState('input')   // input | preview | importing | done
  const [text, setText] = useState('')
  const [parsed, setParsed] = useState([])
  const [programName, setProgramName] = useState('Импортированная программа')
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0, label: '' })

  function handleParse() {
    if (!text.trim()) { setError('Вставьте текст программы'); return }
    try {
      const workouts = parseProgram(text)
      if (workouts.length === 0) {
        setError('Не удалось распознать тренировочные дни. Убедитесь что текст содержит строки "День 1 Понедельник"')
        return
      }
      setParsed(workouts)
      setError('')
      setStep('preview')
    } catch (e) {
      setError('Ошибка парсинга: ' + e.message)
    }
  }

  async function handleImport() {
    setStep('importing')
    try {
      let pid = programId

      // Если нет существующей программы — создаём новую
      if (!pid) {
        const { data: prog, error: progErr } = await supabase
          .from('training_programs')
          .insert({ name: programName, client_id: clientId, trainer_id: profile.id, is_active: true })
          .select().single()
        if (progErr) throw progErr
        pid = prog.id
      }

      const total = parsed.reduce((s, w) => s + w.exercises.reduce((es, ex) => es + ex.sets.length, 0), 0)
      let done = 0

      for (const workout of parsed) {
        setProgress({ current: done, total, label: `Создаём "${workout.name}"...` })

        const { data: w, error: wErr } = await supabase
          .from('workouts')
          .insert({ name: workout.name, day_of_week: workout.day_of_week, order_index: workout.order_index, program_id: pid })
          .select().single()
        if (wErr) throw wErr

        for (let ei = 0; ei < workout.exercises.length; ei++) {
          const ex = workout.exercises[ei]
          setProgress({ current: done, total, label: `${workout.name} → ${ex.name}` })

          const { data: e, error: eErr } = await supabase
            .from('exercises')
            .insert({ name: ex.name, workout_id: w.id, order_index: ei, trainer_comment: ex.comment || '' })
            .select().single()
          if (eErr) throw eErr

          // Группируем подходы по типу и нумеруем внутри группы
          const countByType = {}
          for (let si = 0; si < ex.sets.length; si++) {
            const s = ex.sets[si]
            countByType[s.set_type] = (countByType[s.set_type] || 0) + 1
            await supabase.from('exercise_sets').insert({
              exercise_id: e.id,
              set_type: s.set_type,
              planned_weight: s.weight,
              planned_reps: s.reps,
              set_number: countByType[s.set_type],
              order_index: si,
              is_active: true,
              actual_reps_log: [],
            })
            done++
            setProgress({ current: done, total, label: `${workout.name} → ${ex.name}` })
          }
        }
      }

      setStep('done')
      if (onDone) onDone()
    } catch (e) {
      setError('Ошибка при импорте: ' + e.message)
      setStep('preview')
    }
  }

  const totalExercises = parsed.reduce((s, w) => s + w.exercises.length, 0)
  const totalSets = parsed.reduce((s, w) => s + w.exercises.reduce((es, ex) => es + ex.sets.length, 0), 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 className="modal-title">Импорт тренировочного плана</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* ── ШАГ 1: ВВОД ТЕКСТА ───────────────────────────── */}
        {step === 'input' && (
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Вставь план тренировок в текстовом формате. Поддерживается формат:<br />
              <span style={{ color: 'var(--text-muted)' }}>
                👉🏻День 1 Понедельник → • Упражнение → Разминка 10/15 на 10/8 Отказ 30х7,8 Около отказ 25х10
              </span>
            </p>

            <div className="form-group">
              <label className="form-label">Название программы</label>
              <input className="form-input" value={programName} onChange={e => setProgramName(e.target.value)} placeholder="Программа на набор массы" />
            </div>

            <div className="form-group">
              <label className="form-label">Текст программы *</label>
              <textarea
                className="form-textarea"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`👉🏻День 1 понедельник\n\n• Присед в Гаке глубокий\nРазминка 10/15/20 на 10/8/6 раз Отказ 30х7,8 25х10\n\n• Мост штанга:\nРазминка 35/42/53 на 10/8/8 раз Отказ 70х8,10 65х10,10 Около отказ 60х10,11`}
                style={{ minHeight: 280, fontFamily: 'monospace', fontSize: 13 }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', display: 'flex', gap: 8, marginBottom: 12 }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
              </div>
            )}

            {/* Подсказка форматирования */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Поддерживаемые форматы:</div>
              {[
                ['Разминка с прогрессией', 'Разминка 10/15/20 на 10/8/6 раз'],
                ['Одиночная разминка', 'Разминка 20 на 8 раз'],
                ['Отказные подходы', 'Отказ 30х7,8 25х10'],
                ['Около отказа', 'Около отказ 60х10,11'],
                ['Без разминки', 'Без разминки Отказ 45х15 40х15'],
                ['Свой вес', 'Свой вес х9'],
              ].map(([label, ex], i) => (
                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, marginBottom: 3 }}>
                  <span style={{ color: 'var(--accent)', minWidth: 160 }}>{label}:</span>
                  <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>{ex}</span>
                </div>
              ))}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>Отмена</button>
              <button className="btn btn-primary" onClick={handleParse}>
                <FileText size={15} /> Распознать
              </button>
            </div>
          </div>
        )}

        {/* ── ШАГ 2: ПРЕВЬЮ ────────────────────────────────── */}
        {step === 'preview' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)' }}>{parsed.length}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>тренировочных дней</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{totalExercises}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>упражнений</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: '10px 16px', flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{totalSets}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>подходов</div>
              </div>
            </div>

            <div style={{ maxHeight: 440, overflowY: 'auto', marginBottom: 12 }}>
              {parsed.map((w, i) => <WorkoutPreview key={i} workout={w} index={i} />)}
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setStep('input')}>Назад</button>
              <button className="btn btn-primary" onClick={handleImport}>
                <Check size={15} /> Импортировать в план
              </button>
            </div>
          </div>
        )}

        {/* ── ШАГ 3: ИМПОРТ ────────────────────────────────── */}
        {step === 'importing' && (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 20px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Импортируем...</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>{progress.label}</div>
            {progress.total > 0 && (
              <div style={{ maxWidth: 300, margin: '0 auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Прогресс</span>
                  <span>{progress.current} / {progress.total}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(progress.current / progress.total) * 100}%`, transition: 'width 0.2s' }} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ШАГ 4: ГОТОВО ────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(34,197,94,0.15)', border: '2px solid var(--success)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <Check size={28} color="var(--success)" />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Готово!</h3>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Импортировано: <strong style={{ color: 'var(--accent)' }}>{parsed.length}</strong> дней,{' '}
              <strong>{totalExercises}</strong> упражнений,{' '}
              <strong style={{ color: 'var(--success)' }}>{totalSets}</strong> подходов
            </p>
            <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={onClose}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  )
}
