import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { useAuth } from './lib/auth'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Portfolio } from './pages/Portfolio'
import { Accounts } from './pages/Accounts'
import { Budgets } from './pages/Budgets'
import { Alerts } from './pages/Alerts'
import { Export } from './pages/Export'
import { More } from './pages/More'
import { Settings } from './pages/Settings'

export default function App() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/konten" element={<Accounts />} />
        <Route path="/budgets" element={<Budgets />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/export" element={<Export />} />
        <Route path="/mehr" element={<More />} />
        <Route path="/einstellungen" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  )
}
