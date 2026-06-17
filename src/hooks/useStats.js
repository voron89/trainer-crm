// src/hooks/useStats.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { startOfWeek, startOfMonth, endOfWeek, endOfMonth, subWeeks, subMonths, format } from 'date-fns'

export function useStats(clientId) {
  const { profile } = useAuth()
  const [stats, setStats] = useState(null)
  const [weeklyVolume, setWeeklyVolume] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStats = useCallback(async () => {
    if (!profile || !clientId) return
    setLoading(true)

    // Fetch all completed sessions with logs
    const { data: sessions } = await supabase
      .from('schedule')
      .select(`
        id,
        scheduled_at,
        status,
        workout_logs (
          actual_weight,
          actual_reps,
          is_completed
        )
      `)
      .eq('client_id', clientId)
      .eq('trainer_id', profile.id)
      .order('scheduled_at', { ascending: true })

    if (!sessions) { setLoading(false); return }

    const completedSessions = sessions.filter(s => s.status === 'completed')

    // Calculate volume per session
    const sessionsWithVolume = completedSessions.map(s => {
      const volume = (s.workout_logs || [])
        .filter(l => l.is_completed)
        .reduce((sum, l) => sum + (l.actual_weight || 0) * (l.actual_reps || 0), 0)
      return { ...s, volume }
    })

    // Weekly volume for last 8 weeks
    const weeklyData = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 })
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 })
      const weekSessions = sessionsWithVolume.filter(s => {
        const d = new Date(s.scheduled_at)
        return d >= weekStart && d <= weekEnd
      })
      weeklyData.push({
        week: format(weekStart, 'dd.MM'),
        volume: weekSessions.reduce((sum, s) => sum + s.volume, 0),
        sessions: weekSessions.length,
      })
    }
    setWeeklyVolume(weeklyData)

    // Current month stats
    const monthStart = startOfMonth(new Date())
    const monthEnd = endOfMonth(new Date())
    const monthSessions = sessionsWithVolume.filter(s => {
      const d = new Date(s.scheduled_at)
      return d >= monthStart && d <= monthEnd
    })

    // Current week stats
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 })
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 })
    const weekSessions = sessionsWithVolume.filter(s => {
      const d = new Date(s.scheduled_at)
      return d >= weekStart && d <= weekEnd
    })

    // Total sessions counts
    const totalPlanned = sessions.filter(s => s.status !== 'cancelled').length
    const totalCompleted = completedSessions.length
    const completionRate = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0

    setStats({
      totalCompleted,
      completionRate,
      weeklySessionCount: weekSessions.length,
      monthlySessionCount: monthSessions.length,
      weeklyVolume: weekSessions.reduce((sum, s) => sum + s.volume, 0),
      monthlyVolume: monthSessions.reduce((sum, s) => sum + s.volume, 0),
      totalVolume: sessionsWithVolume.reduce((sum, s) => sum + s.volume, 0),
    })

    setLoading(false)
  }, [profile, clientId])

  useEffect(() => { fetchStats() }, [fetchStats])

  return { stats, weeklyVolume, loading }
}
