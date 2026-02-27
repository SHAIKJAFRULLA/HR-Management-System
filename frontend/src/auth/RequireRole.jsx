import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

function RequireRole({ role, children }) {
  const { profileType, status } = useAuth()
  if (status !== 'ready') return null
  if (profileType !== role) return <Navigate to="/home" replace />
  return children
}

export default RequireRole
