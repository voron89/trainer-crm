// src/App.js
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Sidebar from './components/layout/Sidebar'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import SchedulePage from './pages/SchedulePage'
import PaymentsPage from './pages/PaymentsPage'
import StatsPage from './pages/StatsPage'
import ClientRequestsPage from './pages/ClientRequestsPage'
import ClientRegisterPage from './pages/ClientRegisterPage'
import ClientPortalPage from './pages/ClientPortalPage'
import NotificationsPage from './pages/NotificationsPage'
import BulkCreatePage from './pages/BulkCreatePage'
import './styles/global.css'

function PrivateRoute({ children, allowRoles }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (allowRoles && profile && !allowRoles.includes(profile.role)) return <Navigate to="/" replace />
  return children
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>{children}</main>
    </div>
  )
}

function RootRedirect() {
  const { profile, loading } = useAuth()
  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>
  if (profile?.role === 'client') return <Navigate to="/my-workouts" replace />
  return <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<AuthPage />} />
          <Route path="/" element={<PrivateRoute><RootRedirect /></PrivateRoute>} />

          {/* Trainer routes */}
          <Route path="/dashboard" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><DashboardPage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/clients" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><ClientsPage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/clients/:id" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><ClientDetailPage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/schedule" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><SchedulePage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/payments" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><PaymentsPage /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/stats" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><StatsPage /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/notifications" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><NotificationsPage /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="/bulk-create" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><BulkCreatePage /></AppLayout>
            </PrivateRoute>
          } />

          {/* Public registration */}
          <Route path="/register/:trainerId" element={<ClientRegisterPage />} />
          <Route path="/register" element={<ClientRegisterPage />} />

          {/* Client requests */}
          <Route path="/requests" element={
            <PrivateRoute allowRoles={['trainer']}>
              <AppLayout><ClientRequestsPage /></AppLayout>
            </PrivateRoute>
          } />

          {/* Client routes */}
          <Route path="/my-workouts" element={
            <PrivateRoute allowRoles={['client']}>
              <AppLayout><ClientPortalPage tab="plan" /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/my-schedule" element={
            <PrivateRoute allowRoles={['client']}>
              <AppLayout><ClientPortalPage tab="schedule" /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/my-stats" element={
            <PrivateRoute allowRoles={['client']}>
              <AppLayout><ClientPortalPage tab="stats" /></AppLayout>
            </PrivateRoute>
          } />
          <Route path="/my-payments" element={
            <PrivateRoute allowRoles={['client']}>
              <AppLayout><ClientPortalPage tab="payments" /></AppLayout>
            </PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
