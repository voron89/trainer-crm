// src/hooks/useSchedule.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useSchedule(clientId = null) {
  const { profile } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchSessions = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    let query = supabase
      .from('schedule')
      .select('*, clients(id, full_name, avatar_url)')
      .eq('trainer_id', profile.id)
      .order('scheduled_at', { ascending: true })

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (!error) setSessions(data || [])
    setLoading(false)
  }, [profile, clientId])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  async function addSession(sessionData) {
    const { data, error } = await supabase
      .from('schedule')
      .insert({ ...sessionData, trainer_id: profile.id })
      .select('*, clients(id, full_name, avatar_url)')
      .single()
    if (!error) setSessions(prev => [...prev, data].sort((a, b) =>
      new Date(a.scheduled_at) - new Date(b.scheduled_at)))
    return { data, error }
  }

  async function updateSession(id, updates) {
    const { data, error } = await supabase
      .from('schedule')
      .update(updates)
      .eq('id', id)
      .select('*, clients(id, full_name, avatar_url)')
      .single()
    if (!error) setSessions(prev => prev.map(s => s.id === id ? data : s))
    return { data, error }
  }

  async function deleteSession(id) {
    const { error } = await supabase.from('schedule').delete().eq('id', id)
    if (!error) setSessions(prev => prev.filter(s => s.id !== id))
    return { error }
  }

  return { sessions, loading, addSession, updateSession, deleteSession, refetch: fetchSessions }
}
