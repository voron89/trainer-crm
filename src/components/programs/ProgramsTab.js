// src/components/programs/ProgramsTab.js
import { useState } from 'react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePrograms } from '../../hooks/usePrograms'
import {
  Plus, ChevronDown, ChevronUp, Trash2, Dumbbell,
  Edit2, Check, X, Upload, Save, GripVertical
} from 'lucide-react'
import { DAY_LABELS } from '../../types'
import TextImport from './TextImport'

const SET_TYPE_LABELS = { warmup: 'Разминка', failure: 'Отказ', near_failure: 'Около отказа' }
const SET_TYPE_COLORS = { warmup: '#6b7280', failure: '#E84A1A', near_failure: '#f59e0b' }
const TYPE_ORDER = { warmup: 0, failure: 1, near_failure: 2 }

// ── Drag handle ───────────────────────────────────────────────────────────────
function DragHandle({ listeners, attributes }) {
  return (
    <span
      {...listeners}
      {...attributes}
      style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0, touchAction: 'none' }}
    >
      <GripVertical size={14} />
    </span>
  )
}

// ── Sortable Exercise ─────────────────────────────────────────────────────────
function SortableExercise({ exercise, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: exercise.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        position: 'relative',
      }}
    >
      {children({ dragListeners: listeners, dragAttributes: attributes })}
    </div>
  )
}

// ── Sortable Workout Day ──────────────────────────────────────────────────────
function SortableWorkout({ workout, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: workout.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {children({ dragListeners: listeners, dragAttributes: attributes })}
    </div>
  )
}

// ── SetBadge ──────────────────────────────────────────────────────────────────
function SetBadge({ type }) {
  return (
    <span style={{
      fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
      background: `${SET_TYPE_COLORS[type]}20`, color: SET_TYPE_COLORS[type],
      border: `1px solid ${SET_TYPE_COLORS[type]}40`, whiteSpace: 'nowrap',
    }}>{SET_TYPE_LABELS[type]}</span>
  )
}

// ── SetRow ────────────────────────────────────────────────────────────────────
function SetRow({ set, onDelete, onUpdateWeight, onUpdateReps, onUpdateType, exerciseId }) {
  const [editing, setEditing] = useState(false)
  const [weight, setWeight] = useState(set.planned_weight || '')
  const [setType, setSetType] = useState(set.set_type)
  const [editingReps, setEditingReps] = useState(false)
  const [newRep, setNewRep] = useState('')
  const repsLog = set.actual_reps_log || []

  async function handleSave() {
    if (setType !== set.set_type) await onUpdateType(set.id, setType)
    if (parseFloat(weight) !== set.planned_weight) {
      await onUpdateWeight(set.id, exerciseId, parseFloat(weight) || null, setType, set.set_number, set.order_index)
    }
    setEditing(false)
  }

  async function handleAddRep() {
    if (!newRep) return
    await onUpdateReps(set.id, [...repsLog, parseInt(newRep)])
    setNewRep('')
  }

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      {editing ? (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {Object.entries(SET_TYPE_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => setSetType(k)} style={{
                padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                cursor: 'pointer', border: 'none', fontFamily: 'inherit',
                background: setType === k ? SET_TYPE_COLORS[k] : 'var(--bg-input)',
                color: setType === k ? 'white' : 'var(--text-muted)',
              }}>{v}</button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input style={{ width: 80, background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 4, padding: '4px 8px', color: 'white', fontSize: 13 }}
              type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="кг" autoFocus />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>кг</span>
            <button onClick={handleSave} className="btn btn-primary btn-sm" style={{ fontSize: 12 }}><Save size={13} /> Сохранить</button>
            <button onClick={() => { setEditing(false); setWeight(set.planned_weight || ''); setSetType(set.set_type) }}
              className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>Отмена</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <SetBadge type={set.set_type} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 20, flexShrink: 0 }}>#{set.set_number}</span>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 60 }}>{set.planned_weight ? `${set.planned_weight} кг` : '— кг'}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>×</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {repsLog.map((r, i) => (
              <span key={i} style={{ fontSize: 13, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-muted)', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {r}
                <button onClick={() => onUpdateReps(set.id, repsLog.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', display: 'flex', padding: 0, opacity: 0.6 }}><X size={10} /></button>
              </span>
            ))}
            {editingReps ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input style={{ width: 48, background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 4, padding: '2px 6px', color: 'white', fontSize: 13 }}
                  type="number" min="1" max="100" value={newRep} onChange={e => setNewRep(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRep() } }} autoFocus placeholder="повт" />
                <button onClick={handleAddRep} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', display: 'flex' }}><Check size={13} /></button>
                <button onClick={() => { setEditingReps(false); setNewRep('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><X size={13} /></button>
              </div>
            ) : (
              <button onClick={() => setEditingReps(true)} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', background: 'var(--bg-input)', border: '1px dashed var(--border)', color: 'var(--text-muted)', fontFamily: 'inherit' }}>+ повт</button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><Edit2 size={12} /></button>
            <button onClick={() => onDelete(set.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><Trash2 size={12} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AddSetForm ────────────────────────────────────────────────────────────────
function AddSetForm({ exerciseId, onAdd, onClose }) {
  const [type, setType] = useState('failure')
  const [rows, setRows] = useState([{ weight: '' }])
  async function handleSave() {
    for (let i = 0; i < rows.length; i++) {
      await onAdd(exerciseId, { set_type: type, planned_weight: parseFloat(rows[i].weight) || null, set_number: i + 1, order_index: i, actual_reps_log: [] })
    }
    onClose()
  }
  return (
    <div style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {Object.entries(SET_TYPE_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setType(k)} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none', fontFamily: 'inherit', background: type === k ? SET_TYPE_COLORS[k] : 'var(--bg-input)', color: type === k ? 'white' : 'var(--text-muted)' }}>{v}</button>
        ))}
      </div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 20 }}>#{i + 1}</span>
          <input style={{ width: 90, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 4, padding: '5px 8px', color: 'white', fontSize: 13 }}
            type="number" placeholder="кг" value={r.weight} onChange={e => setRows(s => s.map((rr, idx) => idx === i ? { weight: e.target.value } : rr))} />
          <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>кг</span>
          {rows.length > 1 && <button onClick={() => setRows(s => s.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><X size={13} /></button>}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setRows(s => [...s, { weight: '' }])} style={{ fontSize: 12, background: 'none', border: '1px dashed var(--border)', borderRadius: 4, padding: '4px 10px', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>+ Ещё подход</button>
        <button onClick={handleSave} className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>Сохранить</button>
        <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>Отмена</button>
      </div>
    </div>
  )
}

// ── ExerciseBlock with drag ───────────────────────────────────────────────────
function ExerciseBlock({ exercise, dragListeners, dragAttributes, onDelete, onUpdate, addSet, updateSetWeight, updateSetReps, updateSetType, deleteSet }) {
  const [addingSet, setAddingSet] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(exercise.name)
  const [comment, setComment] = useState(exercise.trainer_comment || '')

  const activeSets = (exercise.exercise_sets || [])
    .filter(s => s.is_active)
    .sort((a, b) => TYPE_ORDER[a.set_type] - TYPE_ORDER[b.set_type] || a.set_number - b.set_number)

  async function handleSaveName() {
    await onUpdate(exercise.id, { name, trainer_comment: comment })
    setEditingName(false)
  }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
          <DragHandle listeners={dragListeners} attributes={dragAttributes} />
          {editingName ? (
            <div style={{ flex: 1 }}>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 6, fontSize: 13 }} />
              <input className="form-input" value={comment} onChange={e => setComment(e.target.value)} style={{ fontSize: 12 }} placeholder="Комментарий тренера" />
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button onClick={handleSaveName} className="btn btn-primary btn-sm" style={{ fontSize: 12 }}>Сохранить</button>
                <button onClick={() => setEditingName(false)} className="btn btn-secondary btn-sm" style={{ fontSize: 12 }}>Отмена</button>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>• {exercise.name}</div>
              {exercise.trainer_comment && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>💬 {exercise.trainer_comment}</div>}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button onClick={() => setEditingName(!editingName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><Edit2 size={13} /></button>
          <button onClick={() => onDelete(exercise.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><Trash2 size={13} /></button>
        </div>
      </div>

      <div style={{ marginBottom: 8 }}>
        {activeSets.map(s => (
          <SetRow key={s.id} set={s} exerciseId={exercise.id}
            onDelete={deleteSet} onUpdateWeight={updateSetWeight}
            onUpdateReps={updateSetReps} onUpdateType={updateSetType} />
        ))}
      </div>

      {addingSet ? (
        <AddSetForm exerciseId={exercise.id} onAdd={addSet} onClose={() => setAddingSet(false)} />
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {Object.entries(SET_TYPE_LABELS).map(([k, v]) => (
            <button key={k} onClick={() => setAddingSet(true)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, cursor: 'pointer', background: 'var(--bg-input)', border: `1px solid ${SET_TYPE_COLORS[k]}40`, color: SET_TYPE_COLORS[k], fontFamily: 'inherit' }}>+ {v}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── EditWorkoutModal ──────────────────────────────────────────────────────────
function EditWorkoutModal({ workout, onClose, onSave }) {
  const [name, setName] = useState(workout.name)
  const [dayOfWeek, setDayOfWeek] = useState(workout.day_of_week || 1)
  const [saving, setSaving] = useState(false)
  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    await onSave(workout.id, { name, day_of_week: dayOfWeek })
    setSaving(false); onClose()
  }
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title">Редактировать тренировку</h2>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Название *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">День недели</label>
            <select className="form-select" value={dayOfWeek} onChange={e => setDayOfWeek(parseInt(e.target.value))}>
              {Object.entries(DAY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Отмена</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Сохранение...' : 'Сохранить'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── WorkoutBlock with DnD for exercises ──────────────────────────────────────
function WorkoutBlock({ workout, dragListeners, dragAttributes, expanded, onToggle, onDelete, onEdit, addExercise, updateExercise, deleteExercise, addSet, updateSetWeight, updateSetReps, updateSetType, deleteSet, reorderExercises }) {
  const [showExerciseForm, setShowExerciseForm] = useState(false)
  const [exForm, setExForm] = useState({ name: '', trainer_comment: '' })
  const [activeId, setActiveId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const exercises = [...(workout.exercises || [])].sort((a, b) => a.order_index - b.order_index)

  async function handleAddExercise(e) {
    e.preventDefault()
    await addExercise(workout.id, exForm)
    setShowExerciseForm(false)
    setExForm({ name: '', trainer_comment: '' })
  }

  function handleDragEnd(event) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIdx = exercises.findIndex(e => e.id === active.id)
    const newIdx = exercises.findIndex(e => e.id === over.id)
    reorderExercises(workout.id, arrayMove(exercises, oldIdx, newIdx))
  }

  const activeExercise = exercises.find(e => e.id === activeId)

  return (
    <div style={{ background: 'var(--bg-secondary)', borderRadius: 8, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <DragHandle listeners={dragListeners} attributes={dragAttributes} />
          <div style={{ cursor: 'pointer', flex: 1 }} onClick={onToggle}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>👉🏻 {workout.name}</span>
            <span style={{ fontSize: 12, color: 'var(--accent)', marginLeft: 8 }}>{DAY_LABELS[workout.day_of_week]}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>{exercises.length} упр.</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}><Edit2 size={13} /></button>
          <button onClick={onDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex' }}><Trash2 size={13} /></button>
          <span style={{ cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }} onClick={onToggle}>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        </div>
      </div>

      {expanded && (
        <div>
          <DndContext sensors={sensors} collisionDetection={closestCenter}
            onDragStart={e => setActiveId(e.active.id)}
            onDragEnd={handleDragEnd}>
            <SortableContext items={exercises.map(e => e.id)} strategy={verticalListSortingStrategy}>
              {exercises.map(ex => (
                <SortableExercise key={ex.id} exercise={ex}>
                  {({ dragListeners: dl, dragAttributes: da }) => (
                    <ExerciseBlock
                      exercise={ex}
                      dragListeners={dl}
                      dragAttributes={da}
                      onDelete={deleteExercise}
                      onUpdate={updateExercise}
                      addSet={addSet}
                      updateSetWeight={updateSetWeight}
                      updateSetReps={updateSetReps}
                      updateSetType={updateSetType}
                      deleteSet={deleteSet}
                    />
                  )}
                </SortableExercise>
              ))}
            </SortableContext>
            <DragOverlay>
              {activeExercise && (
                <div style={{ background: 'var(--bg-card)', border: '2px solid var(--accent)', borderRadius: 8, padding: 12, opacity: 0.95 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>• {activeExercise.name}</div>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {showExerciseForm ? (
            <form onSubmit={handleAddExercise} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8, background: 'var(--bg-card)', borderRadius: 8, padding: 12 }}>
              <input className="form-input" value={exForm.name} onChange={e => setExForm(f => ({ ...f, name: e.target.value }))} placeholder="Название упражнения" required />
              <input className="form-input" value={exForm.trainer_comment} onChange={e => setExForm(f => ({ ...f, trainer_comment: e.target.value }))} placeholder="Комментарий тренера (необязательно)" />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" className="btn btn-primary btn-sm">Добавить</button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowExerciseForm(false)}>Отмена</button>
              </div>
            </form>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: '100%', justifyContent: 'center', border: '1px dashed var(--border)' }} onClick={() => setShowExerciseForm(true)}>
              <Plus size={13} /> Добавить упражнение
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProgramsTab({ clientId }) {
  const {
    programs, loading,
    addProgram, deleteProgram,
    addWorkout, updateWorkout, deleteWorkout,
    addExercise, updateExercise, deleteExercise,
    addSet, updateSetWeight, updateSetReps, updateSetType, deleteSet,
    reorderExercises, reorderWorkouts,
    refetch,
  } = usePrograms(clientId)

  const [expandedProgram, setExpandedProgram] = useState(null)
  const [expandedWorkout, setExpandedWorkout] = useState(null)
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showWorkoutForm, setShowWorkoutForm] = useState(null)
  const [editingWorkout, setEditingWorkout] = useState(null)
  const [progForm, setProgForm] = useState({ name: '', start_date: '', end_date: '' })
  const [workoutForm, setWorkoutForm] = useState({ name: '', day_of_week: 1 })
  const [activeWorkoutId, setActiveWorkoutId] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>

  async function handleAddProgram(e) {
    e.preventDefault()
    const { error } = await addProgram(progForm)
    if (!error) { setShowProgramForm(false); setProgForm({ name: '', start_date: '', end_date: '' }) }
  }

  async function handleAddWorkout(e, programId) {
    e.preventDefault()
    await addWorkout(programId, workoutForm)
    setShowWorkoutForm(null)
    setWorkoutForm({ name: '', day_of_week: 1 })
  }

  function handleWorkoutDragEnd(programId, workouts) {
    return function(event) {
      const { active, over } = event
      setActiveWorkoutId(null)
      if (!over || active.id === over.id) return
      const oldIdx = workouts.findIndex(w => w.id === active.id)
      const newIdx = workouts.findIndex(w => w.id === over.id)
      reorderWorkouts(programId, arrayMove(workouts, oldIdx, newIdx))
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Тренировочные программы</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>
            <Upload size={14} /> Импорт текста
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowProgramForm(!showProgramForm)}>
            <Plus size={14} /> Новая программа
          </button>
        </div>
      </div>

      {showProgramForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <form onSubmit={handleAddProgram}>
            <div className="form-group">
              <label className="form-label">Название программы *</label>
              <input className="form-input" value={progForm.name} onChange={e => setProgForm(f => ({ ...f, name: e.target.value }))} placeholder="Программа на 8 недель" required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group"><label className="form-label">Начало</label><input className="form-input" type="date" value={progForm.start_date} onChange={e => setProgForm(f => ({ ...f, start_date: e.target.value }))} /></div>
              <div className="form-group"><label className="form-label">Конец</label><input className="form-input" type="date" value={progForm.end_date} onChange={e => setProgForm(f => ({ ...f, end_date: e.target.value }))} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowProgramForm(false)}>Отмена</button>
              <button type="submit" className="btn btn-primary btn-sm">Создать</button>
            </div>
          </form>
        </div>
      )}

      {programs.length === 0 ? (
        <div className="empty-state"><Dumbbell size={32} className="empty-icon" /><p>Создайте первую программу</p></div>
      ) : programs.map(prog => {
        const workouts = [...(prog.workouts || [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        return (
          <div key={prog.id} className="card" style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => setExpandedProgram(expandedProgram === prog.id ? null : prog.id)}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{prog.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{workouts.length} тренировочных дней{prog.start_date && ` · с ${prog.start_date}`}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn-icon" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                  onClick={e => { e.stopPropagation(); window.confirm('Удалить программу?') && deleteProgram(prog.id) }}><Trash2 size={13} /></button>
                {expandedProgram === prog.id ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </div>
            </div>

            {expandedProgram === prog.id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Тренировочные дни</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowWorkoutForm(showWorkoutForm === prog.id ? null : prog.id)}>
                    <Plus size={12} /> День
                  </button>
                </div>

                {showWorkoutForm === prog.id && (
                  <form onSubmit={e => handleAddWorkout(e, prog.id)} style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                    <input className="form-input" style={{ flex: 2, minWidth: 160 }} value={workoutForm.name} onChange={e => setWorkoutForm(f => ({ ...f, name: e.target.value }))} placeholder="День 1 — Понедельник" required />
                    <select className="form-select" style={{ flex: 1, minWidth: 80 }} value={workoutForm.day_of_week} onChange={e => setWorkoutForm(f => ({ ...f, day_of_week: parseInt(e.target.value) }))}>
                      {Object.entries(DAY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button type="submit" className="btn btn-primary btn-sm">OK</button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowWorkoutForm(null)}>✕</button>
                  </form>
                )}

                {/* DnD для тренировочных дней */}
                <DndContext sensors={sensors} collisionDetection={closestCenter}
                  onDragStart={e => setActiveWorkoutId(e.active.id)}
                  onDragEnd={handleWorkoutDragEnd(prog.id, workouts)}>
                  <SortableContext items={workouts.map(w => w.id)} strategy={verticalListSortingStrategy}>
                    {workouts.map(workout => (
                      <SortableWorkout key={workout.id} workout={workout}>
                        {({ dragListeners: dl, dragAttributes: da }) => (
                          <WorkoutBlock
                            workout={workout}
                            dragListeners={dl}
                            dragAttributes={da}
                            expanded={expandedWorkout === workout.id}
                            onToggle={() => setExpandedWorkout(expandedWorkout === workout.id ? null : workout.id)}
                            onDelete={() => deleteWorkout(workout.id)}
                            onEdit={() => setEditingWorkout(workout)}
                            addExercise={addExercise}
                            updateExercise={updateExercise}
                            deleteExercise={deleteExercise}
                            addSet={addSet}
                            updateSetWeight={updateSetWeight}
                            updateSetReps={updateSetReps}
                            updateSetType={updateSetType}
                            deleteSet={deleteSet}
                            reorderExercises={reorderExercises}
                          />
                        )}
                      </SortableWorkout>
                    ))}
                  </SortableContext>
                  <DragOverlay>
                    {activeWorkoutId && (() => {
                      const w = workouts.find(w => w.id === activeWorkoutId)
                      return w ? (
                        <div style={{ background: 'var(--bg-secondary)', border: '2px solid var(--accent)', borderRadius: 8, padding: '10px 14px', opacity: 0.95 }}>
                          <span style={{ fontWeight: 600 }}>👉🏻 {w.name}</span>
                        </div>
                      ) : null
                    })()}
                  </DragOverlay>
                </DndContext>
              </div>
            )}
          </div>
        )
      })}

      {showImport && <TextImport clientId={clientId} onClose={() => setShowImport(false)} onDone={() => { setShowImport(false); refetch() }} />}
      {editingWorkout && <EditWorkoutModal workout={editingWorkout} onClose={() => setEditingWorkout(null)} onSave={updateWorkout} />}
    </div>
  )
}
