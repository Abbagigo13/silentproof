import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/Layout'
import { BountyList } from './components/BountyList'
import { SubmitReport } from './components/SubmitReport'
import { OrgDashboard } from './components/OrgDashboard'
import { Docs } from './components/Docs'
import type { AppMode } from './types'

function AppRoutes() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // The mode follows the page, and the pill navigates, so both always agree.
  const mode: AppMode = pathname.startsWith('/org') ? 'org' : 'submitter'
  const setMode = (next: AppMode) => { void navigate(next === 'org' ? '/org' : '/') }

  return (
    <Layout mode={mode} onModeChange={setMode}>
      <Routes>
        <Route path="/" element={<BountyList />} />
        <Route path="/submit/:bountyId" element={<SubmitReport />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/org" element={<OrgDashboard />} />
        <Route path="/org/bounties" element={<OrgDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ThemeProvider>
  )
}
