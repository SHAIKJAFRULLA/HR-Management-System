import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { getEmployees } from "../api/employeeApi";

function formatDate(value) {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

const HomeDashboard = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await getEmployees({ token });
        const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
        if (mounted) setEmployees(list);
      } catch {
        if (mounted) setEmployees([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [token]);

  const stats = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => Boolean(e.is_active ?? !e.end_date)).length;
    const exited = total - active;
    const onboardingIncomplete = employees.filter((e) => !e.email || !e.contact_number).length;
    return { total, active, exited, onboardingIncomplete };
  }, [employees]);

  const latest = useMemo(() => {
    return [...employees]
      .sort((a, b) => new Date(b.joining_date || 0).getTime() - new Date(a.joining_date || 0).getTime())
      .slice(0, 5);
  }, [employees]);

  return (
    <div className="dash-grid">
      <article className="dash-card dash-card-wide">
        <div className="dash-header-row">
          <div>
            <h2>Executive Dashboard</h2>
            <p>Live workforce snapshot with modern operational controls.</p>
          </div>
          <div className="dash-quick-actions">
            <button className="btn-primary" type="button" onClick={() => navigate("/home/employees/new")}>
              Add Employee
            </button>
            <button className="btn-secondary" type="button" onClick={() => navigate("/home/employees")}>
              Open Directory
            </button>
          </div>
        </div>
        <div className="dash-metric-grid">
          <div className="dash-metric">
            <span>Total Employees</span>
            <strong>{stats.total}</strong>
          </div>
          <div className="dash-metric success">
            <span>Active</span>
            <strong>{stats.active}</strong>
          </div>
          <div className="dash-metric muted">
            <span>Exited</span>
            <strong>{stats.exited}</strong>
          </div>
          <div className="dash-metric warning">
            <span>Onboarding Incomplete</span>
            <strong>{stats.onboardingIncomplete}</strong>
          </div>
        </div>
      </article>

      <article className="dash-card">
        <h3>Recent Joiners</h3>
        {loading ? (
          <div className="dash-skeleton-list">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="dash-list">
            {latest.length === 0 && <p className="dash-empty">No employee records available.</p>}
            {latest.map((emp) => (
              <div key={emp.id || emp.emp_id} className="dash-list-item">
                <div>
                  <strong>{emp.name || "Unknown"}</strong>
                  <span>{emp.emp_id || "--"}</span>
                </div>
                <em>{formatDate(emp.joining_date)}</em>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="dash-card">
        <h3>Distribution</h3>
        <div className="dash-progress">
          <div>
            <label>Active Ratio</label>
            <div className="dash-track">
              <span
                style={{
                  width: `${stats.total ? Math.round((stats.active / stats.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
          <div>
            <label>Exited Ratio</label>
            <div className="dash-track muted">
              <span
                style={{
                  width: `${stats.total ? Math.round((stats.exited / stats.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      </article>
    </div>
  );
};

export default HomeDashboard;
