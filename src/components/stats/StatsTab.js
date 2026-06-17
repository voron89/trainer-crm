// src/components/stats/StatsTab.js
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area, ReferenceLine
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, BarChart2, Dumbbell, Calendar, Activity
} from 'lucide-react'
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  subWeeks, subMonths, eachWeekOfInterval, eachMonthOfInterval,
  isWithinInterval, parseISO
} from 'date-fns'
import { ru } from 'date-fns/locale'

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcVolume(weight, repsArr) {
  if (!repsArr || repsArr.length === 0) return 0
  return weight * repsArr.reduce((a, b) => a + b, 0)
}

function trendColor(val) {
  if (val > 0) return 'var(--success)'
  if (val < 0) return 'var(--danger)'
  return 'var(--text-muted)'
}

function TrendBadge({ value, unit = 'кг', showPct = false }) {
  const color = trendColor(value)
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus
  const sign = value > 0 ? '+' : ''
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color }}>
      <Icon size={14} />
      {sign}{value}{unit}
    </span>
  )
}

function PctBadge({ pct }) {
  const color = trendColor(pct)
  const sign = pct > 0 ? '+' : ''
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
      background: `${color}20`, color,
    }}>
      {sign}{pct}%
    </span>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', minWidth: 140 }}>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => p.value != null && (
        <p key={i} style={{ fontSize: 13, fontWeight: 600, color: p.color, marginBottom: 2 }}>
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

const TABS = [
  { id: 'exercises', label: 'По упражнениям', icon: Dumbbell },
  { id: 'workouts', label: 'По тренировкам', icon: Calendar },
  { id: 'totals', label: 'Общий тоннаж', icon: Activity },
]

export default function StatsTab({ clientId }) {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('exercises')
  const [selectedExercise, setSelectedExercise] = useState(null)
  const [allSets, setAllSets] = useState([])        // все подходы с actual_reps_log
  const [sessions, setSessions] = useState([])      // все сессии расписания
  const [workoutNames, setWorkoutNames] = useState({}) // exerciseId → workoutName

  useEffect(() => { if (profile && clientId) loadData() }, [profile, clientId])

  async function loadData() {
    setLoading(true)

    // 1. Сессии расписания
    const { data: sessData } = await supabase
      .from('schedule')
      .select('id, scheduled_at, status')
      .eq('client_id', clientId)
      .eq('trainer_id', profile.id)
      .order('scheduled_at')
    setSessions(sessData || [])

    // 2. Все программы с подходами
    const { data: programs } = await supabase
      .from('training_programs')
      .select(`workouts(name, exercises(id, name, exercise_sets(*)))`)
      .eq('client_id', clientId)
      .eq('trainer_id', profile.id)

    const sets = []
    const names = {}

    programs?.forEach(prog => {
      prog.workouts?.forEach(w => {
        w.exercises?.forEach(ex => {
          names[ex.id] = { exercise: ex.name, workout: w.name }
          ex.exercise_sets?.forEach(s => {
            if (s.planned_weight && s.actual_reps_log?.length > 0) {
              sets.push({
                exerciseId: ex.id,
                exerciseName: ex.name,
                workoutName: w.name,
                weight: s.planned_weight,
                reps: s.actual_reps_log,
                setType: s.set_type,
                isActive: s.is_active,
                date: s.created_at,
                totalReps: s.actual_reps_log.reduce((a, b) => a + b, 0),
                volume: calcVolume(s.planned_weight, s.actual_reps_log),
              })
            }
          })
        })
      })
    })

    setAllSets(sets)
    setWorkoutNames(names)

    // Выбрать первое упражнение по умолчанию
    const exNames = [...new Set(sets.map(s => s.exerciseName))]
    if (exNames.length > 0 && !selectedExercise) setSelectedExercise(exNames[0])

    setLoading(false)
  }

  // ── Вычисления ──────────────────────────────────────────────────────────

  const now = new Date()

  // Недели для графика (последние 8)
  const weeks = useMemo(() => {
    const result = []
    for (let i = 7; i >= 0; i--) {
      const start = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 })
      const end = endOfWeek(start, { weekStartsOn: 1 })
      result.push({ start, end, label: format(start, 'dd.MM', { locale: ru }) })
    }
    return result
  }, [])

  // Месяцы для графика (последние 6)
  const months = useMemo(() => {
    const result = []
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(now, i))
      const end = endOfMonth(start)
      result.push({ start, end, label: format(start, 'MMM yy', { locale: ru }) })
    }
    return result
  }, [])

  function setsInRange(start, end) {
    return allSets.filter(s => {
      const d = parseISO(s.date)
      return d >= start && d <= end
    })
  }

  function volumeInRange(start, end, filterEx = null) {
    return setsInRange(start, end)
      .filter(s => !filterEx || s.exerciseName === filterEx)
      .reduce((sum, s) => sum + s.volume, 0)
  }

  function repsInRange(start, end, filterEx = null) {
    return setsInRange(start, end)
      .filter(s => !filterEx || s.exerciseName === filterEx)
      .reduce((sum, s) => sum + s.totalReps, 0)
  }

  function pctChange(prev, curr) {
    if (!prev || prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  // Текущая и прошлая неделя
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 })
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 })
  const prevWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 })
  const prevWeekEnd = endOfWeek(prevWeekStart, { weekStartsOn: 1 })

  // Текущий и прошлый месяц
  const thisMonthStart = startOfMonth(now)
  const thisMonthEnd = endOfMonth(now)
  const prevMonthStart = startOfMonth(subMonths(now, 1))
  const prevMonthEnd = endOfMonth(prevMonthStart)

  // Уникальные упражнения
  const exerciseNames = [...new Set(allSets.map(s => s.exerciseName))]

  // Данные по выбранному упражнению
  const exWeeklyData = useMemo(() => weeks.map(w => ({
    label: w.label,
    volume: Math.round(volumeInRange(w.start, w.end, selectedExercise)),
    reps: repsInRange(w.start, w.end, selectedExercise),
    weight: (() => {
      const s = setsInRange(w.start, w.end).filter(s => s.exerciseName === selectedExercise)
      return s.length > 0 ? Math.max(...s.map(s => s.weight)) : null
    })(),
  })), [selectedExercise, weeks, allSets])

  // Данные по тренировочным дням
  const workoutNames2 = [...new Set(allSets.map(s => s.workoutName))]
  const workoutWeeklyData = useMemo(() => weeks.map(w => {
    const entry = { label: w.label }
    workoutNames2.forEach(wn => {
      entry[wn] = Math.round(volumeInRange(w.start, w.end) / 1000 * 10) / 10 // тонны
    })
    return entry
  }), [weeks, allSets])

  // Общий тоннаж по неделям
  const totalWeeklyData = useMemo(() => weeks.map(w => ({
    label: w.label,
    volume: Math.round(volumeInRange(w.start, w.end)),
    reps: repsInRange(w.start, w.end),
  })), [weeks, allSets])

  // Общий тоннаж по месяцам
  const totalMonthlyData = useMemo(() => months.map(m => ({
    label: m.label,
    volume: Math.round(volumeInRange(m.start, m.end)),
    reps: repsInRange(m.start, m.end),
  })), [months, allSets])

  // Карточки прогресса по упражнениям
  const exerciseCards = useMemo(() => exerciseNames.map(name => {
    const thisW = volumeInRange(thisWeekStart, thisWeekEnd, name)
    const prevW = volumeInRange(prevWeekStart, prevWeekEnd, name)
    const thisM = volumeInRange(thisMonthStart, thisMonthEnd, name)
    const prevM = volumeInRange(prevMonthStart, prevMonthEnd, name)

    const allEx = allSets.filter(s => s.exerciseName === name)
    const maxWeight = allEx.length > 0 ? Math.max(...allEx.map(s => s.weight)) : 0
    const activeWeight = allEx.filter(s => s.isActive && (s.setType === 'failure' || s.setType === 'near_failure'))
    const currWeight = activeWeight.length > 0 ? Math.max(...activeWeight.map(s => s.weight)) : maxWeight

    const weightHistory = allEx
      .filter(s => s.setType !== 'warmup')
      .sort((a, b) => new Date(a.date) - new Date(b.date))
    const prevWeight = weightHistory.length >= 2 ? weightHistory[weightHistory.length - 2].weight : currWeight
    const weightDiff = currWeight - prevWeight

    return {
      name,
      workoutName: allSets.find(s => s.exerciseName === name)?.workoutName || '',
      currWeight,
      weightDiff,
      weekVolume: { curr: thisW, prev: prevW, pct: pctChange(prevW, thisW) },
      monthVolume: { curr: thisM, prev: prevM, pct: pctChange(prevM, thisM) },
      totalReps: allEx.reduce((s, e) => s + e.totalReps, 0),
    }
  }), [exerciseNames, allSets])

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  const noData = allSets.length === 0

  // Итоги
  const totalThisWeek = volumeInRange(thisWeekStart, thisWeekEnd)
  const totalPrevWeek = volumeInRange(prevWeekStart, prevWeekEnd)
  const totalThisMonth = volumeInRange(thisMonthStart, thisMonthEnd)
  const totalPrevMonth = volumeInRange(prevMonthStart, prevMonthEnd)
  const weekPct = pctChange(totalPrevWeek, totalThisWeek)
  const monthPct = pctChange(totalPrevMonth, totalThisMonth)

  return (
    <div>
      {/* Итоговые карточки */}
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="stat-label">Тоннаж эта неделя</div>
          <div className="stat-value stat-accent">{(totalThisWeek / 1000).toFixed(1)}т</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PctBadge pct={weekPct} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs прошлая</span>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '3px solid #22c55e' }}>
          <div className="stat-label">Тоннаж этот месяц</div>
          <div className="stat-value" style={{ color: '#22c55e' }}>{(totalThisMonth / 1000).toFixed(1)}т</div>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PctBadge pct={monthPct} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs прошлый</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Упражнений</div>
          <div className="stat-value">{exerciseNames.length}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>с данными</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Всего повторений</div>
          <div className="stat-value">{allSets.reduce((s, e) => s + e.totalReps, 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map(({ id, label }) => (
          <button key={id} className={`tab-btn ${activeTab === id ? 'active' : ''}`} onClick={() => setActiveTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {noData ? (
        <div className="empty-state">
          <BarChart2 size={36} className="empty-icon" />
          <p>Статистика появится после добавления подходов и записи повторений в тренировочном плане</p>
        </div>
      ) : (
        <>
          {/* ── ПО УПРАЖНЕНИЯМ ─────────────────────────────────────── */}
          {activeTab === 'exercises' && (
            <div>
              {/* Выбор упражнения */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                {exerciseNames.map(name => (
                  <button key={name} onClick={() => setSelectedExercise(name)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                    cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                    background: selectedExercise === name ? 'var(--accent)' : 'var(--bg-input)',
                    color: selectedExercise === name ? 'white' : 'var(--text-secondary)',
                  }}>
                    {name}
                  </button>
                ))}
              </div>

              {selectedExercise && (() => {
                const card = exerciseCards.find(e => e.name === selectedExercise)
                if (!card) return null
                return (
                  <div>
                    {/* Карточки прогресса */}
                    <div className="stat-grid" style={{ marginBottom: 20 }}>
                      <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
                        <div className="stat-label">Рабочий вес</div>
                        <div className="stat-value stat-accent">{card.currWeight} кг</div>
                        <div style={{ marginTop: 6 }}>
                          <TrendBadge value={card.weightDiff} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>от предыдущего</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Объём эта неделя</div>
                        <div className="stat-value">{card.weekVolume.curr.toLocaleString()}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <PctBadge pct={card.weekVolume.pct} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs прошлая</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Объём этот месяц</div>
                        <div className="stat-value">{card.monthVolume.curr.toLocaleString()}</div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <PctBadge pct={card.monthVolume.pct} />
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>vs прошлый</span>
                        </div>
                      </div>
                      <div className="stat-card">
                        <div className="stat-label">Всего повторений</div>
                        <div className="stat-value">{card.totalReps.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Граф рабочего веса */}
                    <div className="card" style={{ marginBottom: 16 }}>
                      <div style={{ marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Динамика рабочего веса</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selectedExercise}</p>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={exWeeklyData} margin={{ left: -20, right: 8 }}>
                          <defs>
                            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} unit=" кг" />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="weight" name="Вес (кг)"
                            stroke="var(--accent)" strokeWidth={2.5}
                            fill="url(#weightGrad)" dot={{ fill: 'var(--accent)', r: 4 }} activeDot={{ r: 6 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Граф тоннажа и повторений */}
                    <div className="card">
                      <div style={{ marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>Объём и повторения по неделям</h3>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selectedExercise}</p>
                      </div>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={exWeeklyData} margin={{ left: -20, right: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="vol" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                          <YAxis yAxisId="reps" orientation="right" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend formatter={v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span>} />
                          <Bar yAxisId="vol" dataKey="volume" name="Объём (кг)" fill="var(--accent)" radius={[4,4,0,0]} opacity={0.9} />
                          <Bar yAxisId="reps" dataKey="reps" name="Повторений" fill="#22c55e" radius={[4,4,0,0]} opacity={0.7} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── ПО ТРЕНИРОВОЧНЫМ ДНЯМ ──────────────────────────────── */}
          {activeTab === 'workouts' && (
            <div>
              {/* Карточки по дням */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14, marginBottom: 24 }}>
                {workoutNames2.map(wn => {
                  const wnSets = allSets.filter(s => s.workoutName === wn)
                  const thisW = wnSets.filter(s => new Date(s.date) >= thisWeekStart && new Date(s.date) <= thisWeekEnd).reduce((a, s) => a + s.volume, 0)
                  const prevW = wnSets.filter(s => new Date(s.date) >= prevWeekStart && new Date(s.date) <= prevWeekEnd).reduce((a, s) => a + s.volume, 0)
                  const pct = pctChange(prevW, thisW)
                  const exCount = [...new Set(wnSets.map(s => s.exerciseName))].length
                  return (
                    <div key={wn} className="stat-card">
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--accent)' }}>👉🏻 {wn}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{exCount} упражнений</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Объём эта неделя</div>
                          <div style={{ fontSize: 20, fontWeight: 700 }}>{thisW.toLocaleString()} кг</div>
                        </div>
                        <PctBadge pct={pct} />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Таблица упражнений по тренировочным дням */}
              {exerciseCards.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600 }}>Прогресс по упражнениям</h3>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Упражнение</th>
                          <th>День</th>
                          <th>Вес</th>
                          <th>↕ Изменение</th>
                          <th>Неделя</th>
                          <th>Месяц</th>
                        </tr>
                      </thead>
                      <tbody>
                        {exerciseCards.map(ex => (
                          <tr key={ex.name} style={{ cursor: 'pointer' }} onClick={() => { setSelectedExercise(ex.name); setActiveTab('exercises') }}>
                            <td style={{ fontWeight: 500 }}>{ex.name}</td>
                            <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ex.workoutName}</td>
                            <td style={{ fontWeight: 700, color: 'var(--accent)' }}>{ex.currWeight} кг</td>
                            <td><TrendBadge value={ex.weightDiff} /></td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 13 }}>{ex.weekVolume.curr.toLocaleString()} кг</span>
                                <PctBadge pct={ex.weekVolume.pct} />
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 13 }}>{ex.monthVolume.curr.toLocaleString()} кг</span>
                                <PctBadge pct={ex.monthVolume.pct} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ОБЩИЙ ТОННАЖ ───────────────────────────────────────── */}
          {activeTab === 'totals' && (
            <div>
              {/* Карточки */}
              <div className="stat-grid" style={{ marginBottom: 24 }}>
                <div className="stat-card" style={{ borderLeft: '3px solid var(--accent)' }}>
                  <div className="stat-label">Эта неделя</div>
                  <div className="stat-value stat-accent">{(totalThisWeek / 1000).toFixed(2)}т</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <PctBadge pct={weekPct} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalPrevWeek > 0 ? `было ${(totalPrevWeek/1000).toFixed(2)}т` : 'нет данных'}</span>
                  </div>
                </div>
                <div className="stat-card" style={{ borderLeft: '3px solid #22c55e' }}>
                  <div className="stat-label">Этот месяц</div>
                  <div className="stat-value" style={{ color: '#22c55e' }}>{(totalThisMonth / 1000).toFixed(2)}т</div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <PctBadge pct={monthPct} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{totalPrevMonth > 0 ? `было ${(totalPrevMonth/1000).toFixed(2)}т` : 'нет данных'}</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Прирост за месяц</div>
                  <div className="stat-value" style={{ color: trendColor(totalThisMonth - totalPrevMonth) }}>
                    {totalThisMonth - totalPrevMonth > 0 ? '+' : ''}{((totalThisMonth - totalPrevMonth)/1000).toFixed(2)}т
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Всего повторений</div>
                  <div className="stat-value">{allSets.reduce((s, e) => s + e.totalReps, 0).toLocaleString()}</div>
                </div>
              </div>

              {/* Недельный тоннаж */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>Тоннаж по неделям</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Общий объём нагрузки (кг × повторения)</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={totalWeeklyData} margin={{ left: -20, right: 8 }}>
                    <defs>
                      <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="volume" name="Объём (кг)"
                      stroke="var(--accent)" strokeWidth={2.5} fill="url(#totalGrad)"
                      dot={{ fill: 'var(--accent)', r: 4 }} activeDot={{ r: 6 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Месячный тоннаж */}
              <div className="card" style={{ marginBottom: 16 }}>
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>Тоннаж по месяцам</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Прогресс / регресс нагрузки</p>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={totalMonthlyData} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="volume" name="Объём (кг)" fill="var(--accent)" radius={[4,4,0,0]}>
                      {totalMonthlyData.map((entry, i) => (
                        <rect key={i} fill={i === totalMonthlyData.length - 1 ? 'var(--accent)' : '#E84A1A80'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Повторения по неделям */}
              <div className="card">
                <div style={{ marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600 }}>Количество повторений по неделям</h3>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={totalWeeklyData} margin={{ left: -20, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="reps" name="Повторений" fill="#22c55e" radius={[4,4,0,0]} opacity={0.85} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
