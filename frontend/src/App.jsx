import { Navigate, Route, Routes } from 'react-router-dom'
import AuthPage from './pages/auth.jsx'
import HomePage from './pages/home.jsx'
import EmployeeProfilePage from './pages/EmployeeProfilePage.jsx'
import HRModulesPage from './pages/HRModulesPage.jsx'
import HrAccessGate from './components/HrAccessGate.jsx'
import RequireAuth from './auth/RequireAuth.jsx'
import RequireRole from './auth/RequireRole.jsx'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/auth" replace />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route
        path="/home/*"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/employee/:id/profile"
        element={
          <RequireAuth>
            <EmployeeProfilePage />
          </RequireAuth>
        }
      />
      <Route
        path="/home/hr-modules"
        element={
          <RequireAuth>
            <RequireRole role="hr">
              <HrAccessGate>
                <HRModulesPage />
              </HrAccessGate>
            </RequireRole>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  )
}

export default App
