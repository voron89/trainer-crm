// src/hooks/usePageVisibility.js
// Предотвращает перезагрузку данных при сворачивании приложения
import { useEffect, useRef } from 'react'

export function usePageVisibility(onVisible) {
  const lastHidden = useRef(null)

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        lastHidden.current = Date.now()
      } else {
        // Обновляем данные только если приложение было скрыто больше 10 минут
        const hiddenFor = Date.now() - (lastHidden.current || Date.now())
        if (hiddenFor > 10 * 60 * 1000) {
          onVisible && onVisible()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [onVisible])
}
