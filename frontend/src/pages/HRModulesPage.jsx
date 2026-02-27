import { useNavigate } from 'react-router-dom'

function HRModulesPage() {
  const navigate = useNavigate()

  return (
    <section style={{ padding: '1.5rem' }}>
      <h2 style={{ marginBottom: '0.5rem' }}>HR Modules</h2>
      <p style={{ marginBottom: '1rem', color: '#555' }}>
        HR-only module workspace is available here.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => navigate('/home/dashboard')}>
        Back to Dashboard
      </button>
    </section>
  )
}

export default HRModulesPage
