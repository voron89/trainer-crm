// src/hooks/usePrograms.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function usePrograms(clientId) {
  const { profile } = useAuth()
  const [programs, setPrograms] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchPrograms = useCallback(async () => {
    if (!profile || !clientId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('training_programs')
      .select(`*, workouts(*, exercises(*, exercise_sets(*)))`)
      .eq('client_id', clientId)
      .eq('trainer_id', profile.id)
      .order('created_at', { ascending: false })
    if (!error) setPrograms(data || [])
    setLoading(false)
  }, [profile, clientId])

  useEffect(() => { fetchPrograms() }, [fetchPrograms])

  async function addProgram(data) {
    const { error } = await supabase.from('training_programs')
      .insert({ ...data, client_id: clientId, trainer_id: profile.id })
    if (!error) fetchPrograms()
    return { error }
  }

  async function deleteProgram(id) {
    const { error } = await supabase.from('training_programs').delete().eq('id', id)
    if (!error) fetchPrograms()
    return { error }
  }

  async function addWorkout(programId, data) {
    const { error } = await supabase.from('workouts').insert({ ...data, program_id: programId })
    if (!error) fetchPrograms()
    return { error }
  }

  async function deleteWorkout(id) {
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (!error) fetchPrograms()
    return { error }
  }

  async function updateWorkout(id, updates) {
    const { error } = await supabase.from('workouts').update(updates).eq('id', id)
    if (!error) fetchPrograms()
    return { error }
  }

  async function addExercise(workoutId, data) {
    const { error } = await supabase.from('exercises').insert({ ...data, workout_id: workoutId })
    if (!error) fetchPrograms()
    return { error }
  }

  async function updateExercise(id, updates) {
    const { error } = await supabase.from('exercises').update(updates).eq('id', id)
    if (!error) fetchPrograms()
    return { error }
  }

  async function deleteExercise(id) {
    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (!error) fetchPrograms()
    return { error }
  }

  async function addSet(exerciseId, setData) {
    const { error } = await supabase.from('exercise_sets')
      .insert({ ...setData, exercise_id: exerciseId, is_active: true })
    if (!error) fetchPrograms()
    return { error }
  }

  // Смена веса: старый деактивируется, новый создаётся
  async function updateSetWeight(oldSetId, exerciseId, newWeight, setType, setNumber, orderIndex) {
    await supabase.from('exercise_sets').update({ is_active: false }).eq('id', oldSetId)
    const { error } = await supabase.from('exercise_sets').insert({
      exercise_id: exerciseId,
      set_type: setType,
      planned_weight: newWeight,
      set_number: setNumber,
      order_index: orderIndex,
      is_active: true,
      actual_reps_log: [],
    })
    if (!error) fetchPrograms()
    return { error }
  }

  // Обновить фактические повторения (массив)
  async function updateSetReps(setId, repsArray) {
    const { error } = await supabase.from('exercise_sets')
      .update({ actual_reps_log: repsArray })
      .eq('id', setId)
    if (!error) fetchPrograms()
    return { error }
  }

  async function updateSetType(setId, newType) {
    const { error } = await supabase.from('exercise_sets')
      .update({ set_type: newType })
      .eq('id', setId)
    if (!error) fetchPrograms()
    return { error }
  }

  // Reorder exercises within a workout (optimistic UI + batch update)
  async function reorderExercises(workoutId, orderedExercises) {
    // Optimistic update
    setPrograms(prev => prev.map(prog => ({
      ...prog,
      workouts: (prog.workouts || []).map(w =>
        w.id === workoutId
          ? { ...w, exercises: orderedExercises.map((e, i) => ({ ...e, order_index: i })) }
          : w
      )
    })))
    // Persist to DB
    for (let i = 0; i < orderedExercises.length; i++) {
      await supabase.from('exercises').update({ order_index: i }).eq('id', orderedExercises[i].id)
    }
  }

  // Reorder workout days within a program (optimistic UI + batch update)
  async function reorderWorkouts(programId, orderedWorkouts) {
    setPrograms(prev => prev.map(prog =>
      prog.id === programId
        ? { ...prog, workouts: orderedWorkouts.map((w, i) => ({ ...w, order_index: i })) }
        : prog
    ))
    for (let i = 0; i < orderedWorkouts.length; i++) {
      await supabase.from('workouts').update({ order_index: i }).eq('id', orderedWorkouts[i].id)
    }
  }

  async function deleteSet(id) {
    const { error } = await supabase.from('exercise_sets').delete().eq('id', id)
    if (!error) fetchPrograms()
    return { error }
  }

  return {
    programs, loading,
    addProgram, deleteProgram,
    addWorkout, updateWorkout, deleteWorkout,
    addExercise, updateExercise, deleteExercise,
    addSet, updateSetWeight, updateSetReps, updateSetType, deleteSet,
    reorderExercises, reorderWorkouts,
    refetch: fetchPrograms,
  }
}
