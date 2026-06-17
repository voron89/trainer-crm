// src/hooks/usePayments.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function usePayments(clientId = null) {
  const { profile } = useAuth()
  const [payments, setPayments] = useState([])
  const [balance, setBalance] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    if (!profile) return
    setLoading(true)

    let query = supabase
      .from('payments')
      .select('*')
      .eq('trainer_id', profile.id)
      .order('payment_date', { ascending: false })

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (!error) setPayments(data || [])

    // Считаем баланс напрямую из schedule (факт проведённых тренировок)
    if (clientId) {
      const [{ data: paidPayments }, { data: completedSessions }] = await Promise.all([
        supabase.from('payments').select('package_size').eq('client_id', clientId).eq('status', 'paid'),
        supabase.from('schedule').select('id').eq('client_id', clientId).eq('status', 'completed'),
      ])

      const totalPurchased = (paidPayments || []).reduce((s, p) => s + (p.package_size || 0), 0)
      const totalUsed = (completedSessions || []).length
      const remaining = Math.max(0, totalPurchased - totalUsed)

      setBalance({
        total_purchased: totalPurchased,
        total_used: totalUsed,
        sessions_remaining: remaining,
      })
    }

    setLoading(false)
  }, [profile, clientId])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  async function addPayment(paymentData) {
    const { data, error } = await supabase
      .from('payments')
      .insert({ ...paymentData, trainer_id: profile.id })
      .select()
      .single()
    if (!error) {
      setPayments(prev => [data, ...prev])
      fetchPayments()
    }
    return { data, error }
  }

  async function updatePayment(id, updates) {
    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (!error) setPayments(prev => prev.map(p => p.id === id ? data : p))
    return { data, error }
  }

  async function deletePayment(id) {
    const { error } = await supabase.from('payments').delete().eq('id', id)
    if (!error) {
      setPayments(prev => prev.filter(p => p.id !== id))
      fetchPayments()
    }
    return { error }
  }

  // Fallback если clientId не передан
  const totalPurchased = payments.filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + (p.package_size || 0), 0)

  return {
    payments,
    balance: balance || { total_purchased: totalPurchased, total_used: 0, sessions_remaining: totalPurchased },
    loading,
    addPayment,
    updatePayment,
    deletePayment,
    refetch: fetchPayments,
  }
}
