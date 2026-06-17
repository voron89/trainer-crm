// src/hooks/useClients.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useClients() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchClients = useCallback(async () => {
    if (!profile) return
    setLoading(true)
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('trainer_id', profile.id)
      .order('created_at', { ascending: false })

    if (error) setError(error.message)
    else setClients(data || [])
    setLoading(false)
  }, [profile])

  useEffect(() => { fetchClients() }, [fetchClients])

  async function addClient(clientData) {
    const { data, error } = await supabase
      .from('clients')
      .insert({ ...clientData, trainer_id: profile.id })
      .select()
      .single()
    if (!error) setClients(prev => [data, ...prev])
    return { data, error }
  }

  async function updateClient(id, updates) {
    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error) setClients(prev => prev.map(c => c.id === id ? data : c))
    return { data, error }
  }

  async function deleteClient(id) {
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (!error) setClients(prev => prev.filter(c => c.id !== id))
    return { error }
  }

  return { clients, loading, error, addClient, updateClient, deleteClient, refetch: fetchClients }
}
