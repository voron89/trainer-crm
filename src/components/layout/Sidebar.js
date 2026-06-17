// src/components/layout/Sidebar.js
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Users, Calendar,
  CreditCard, BarChart2, LogOut, Dumbbell, Bell, MessageCircle, Send
} from 'lucide-react'

const trainerNav = [
  { to: '/dashboard', label: 'Главная', icon: LayoutDashboard },
  { to: '/clients', label: 'Клиенты', icon: Users },
  { to: '/schedule', label: 'Расписание', icon: Calendar },
  { to: '/payments', label: 'Оплаты', icon: CreditCard },
  { to: '/requests', label: 'Заявки', icon: Bell },
  { to: '/bulk-create', label: 'Доступы', icon: MessageCircle },
  { to: '/notifications', label: 'Бот', icon: Send },
  { to: '/stats', label: 'Статистика', icon: BarChart2 },
]

const clientNav = [
  { to: '/my-workouts', label: 'Тренировки', icon: Dumbbell },
  { to: '/my-schedule', label: 'Расписание', icon: Calendar },
  { to: '/my-stats', label: 'Прогресс', icon: BarChart2 },
  { to: '/my-payments', label: 'Оплаты', icon: CreditCard },
]

function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return width
}

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const width = useWindowWidth()
  const isMobile = width <= 768
  const navItems = profile?.role === 'trainer' ? trainerNav : clientNav

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  if (isMobile) {
    // ── BOTTOM NAV (мобиле) ────────────────────────────────
    return (
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border)',
        display: 'flex', flexDirection: 'row',
        zIndex: 200,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '8px 2px', textDecoration: 'none',
            color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            gap: 2, minWidth: 0,
          })}>
            <Icon size={20} />
            <span style={{ fontSize: 9, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', textAlign: 'center' }}>
              {label}
            </span>
          </NavLink>
        ))}
      </nav>
    )
  }

  // ── SIDEBAR (десктоп) ──────────────────────────────────
  return (
    <nav className="sidebar">
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Dumbbell size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>Trainer</div>
            <div style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600, letterSpacing: '0.05em' }}>CRM</div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: '12px 12px', overflowY: 'auto' }}>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 'var(--radius-sm)',
            marginBottom: 2, textDecoration: 'none', fontSize: 14,
            fontWeight: 500,
            color: isActive ? 'white' : 'var(--text-secondary)',
            background: isActive ? 'var(--accent)' : 'transparent',
            transition: 'all 0.15s',
          })}>
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </div>

      <div style={{ padding: '16px 12px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 4 }}>
          <div className="avatar" style={{ width: 32, height: 32, fontSize: 13 }}>{initials}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.full_name}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{profile?.role === 'trainer' ? 'Тренер' : 'Клиент'}</div>
          </div>
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'flex-start', fontSize: 13 }} onClick={handleSignOut}>
          <LogOut size={15} /> Выйти
        </button>
      </div>
    </nav>
  )
}
