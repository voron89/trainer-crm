// src/types/index.js
// JSDoc type definitions for IDE autocomplete

/**
 * @typedef {'trainer' | 'client'} UserRole
 * @typedef {'weight_loss' | 'muscle_gain' | 'recomposition' | 'competition'} ClientGoal
 * @typedef {'active' | 'pause' | 'finished'} ClientStatus
 * @typedef {'planned' | 'completed' | 'cancelled' | 'missed'} SessionStatus
 * @typedef {'paid' | 'pending' | 'overdue'} PaymentStatus
 * @typedef {4 | 8 | 12 | 16} PackageSize
 */

export const GOAL_LABELS = {
  weight_loss: 'Похудение',
  muscle_gain: 'Набор массы',
  recomposition: 'Рекомпозиция',
  competition: 'Подготовка к соревнованиям',
}

export const STATUS_LABELS = {
  active: 'Активный',
  pause: 'Пауза',
  finished: 'Завершил',
}

export const SESSION_STATUS_LABELS = {
  planned: 'Запланирована',
  completed: 'Проведена',
  cancelled: 'Отменена',
  missed: 'Пропущена',
}

export const SESSION_STATUS_COLORS = {
  planned: '#E84A1A',
  completed: '#22c55e',
  cancelled: '#6b7280',
  missed: '#ef4444',
}

export const PAYMENT_STATUS_LABELS = {
  paid: 'Оплачено',
  pending: 'Ожидает',
  overdue: 'Просрочено',
}

export const PAYMENT_STATUS_COLORS = {
  paid: '#22c55e',
  pending: '#f59e0b',
  overdue: '#ef4444',
}

export const DAY_LABELS = {
  1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 7: 'Вс',
}

export const PACKAGE_SIZES = [1, 4, 8, 12, 16]
