import { Navigate, Route, Routes } from 'react-router-dom'
import { Expenses } from './pages/Expenses.jsx'
import { Home } from './pages/Home.jsx'
import { Prescriptions } from './pages/Prescriptions.jsx'
import { Records } from './pages/Records.jsx'
import { BunnyProfile } from './pages/BunnyProfile.jsx'
import { Settings } from './pages/Settings.jsx'
import { Symptoms } from './pages/Symptoms.jsx'
import { Timeline } from './pages/Timeline.jsx'
import { WeightLog } from './pages/WeightLog.jsx'
import { Onboarding } from './pages/Onboarding.jsx'
import { Login } from './pages/Login.jsx'
import { Signup } from './pages/Signup.jsx'
import { ProtectedLayout } from './layouts/ProtectedLayout.jsx'
import { LoadingScreen } from './components/ui/LoadingScreen.jsx'

function App() {
  return (
    <div className="min-h-dvh bg-cream text-text-dark">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {import.meta.env.DEV ? (
          <Route
            path="/__dev/loading"
            element={<LoadingScreen message="Loading your bunhouse…" />}
          />
        ) : null}

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/symptoms" element={<Symptoms />} />
          <Route path="/symptoms/new" element={<Symptoms defaultOpen />} />
          <Route path="/records" element={<Records />} />
          <Route path="/records/new" element={<Records defaultOpen />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/prescriptions/new" element={<Prescriptions defaultOpen />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/weight" element={<WeightLog />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/expenses/new" element={<Expenses defaultOpen />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/bunny/:bunnyId" element={<BunnyProfile />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default App
