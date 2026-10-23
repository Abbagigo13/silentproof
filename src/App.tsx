import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { Layout } from './components/Layout'
import { BountyList } from './components/BountyList'
import { SubmitReport } from './components/SubmitReport'
import { OrgDashboard } from './components/OrgDashboard'
import type { AppMode } from './types'

function AppRoutes() {
  const [mode, setMode] = useState<AppMode>('submitter')

  return (
    <Layout mode={mode} onModeChange={setMode}>
      <Routes>
        <Route path="/" element={<BountyList />} />
        <Route path="/submit/:bountyId" element={<SubmitReport />} />
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
