import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.jsx";
import { getEmployeeProfile } from "../api/employeeApi";
import "../styles/EmployeeProfile.css";

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "Not available";
  return String(value);
}

const EmployeeProfilePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const data = await getEmployeeProfile(id, { token });
        if (mounted) setProfile(data);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to load profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadProfile();
    return () => {
      mounted = false;
    };
  }, [id, token]);

  const timeline = useMemo(() => profile?.ctc_timeline || [], [profile]);
  const tracker = useMemo(() => profile?.compliance_ids?.tracker || [], [profile]);

  return (
    <section className="profile-shell">
      <div className="profile-header">
        <div>
          <h1>Unified Employee Profile</h1>
          <p>Employee ID: {id}</p>
        </div>
        <button className="profile-back" onClick={() => navigate("/home")} type="button">
          Back to Directory
        </button>
      </div>

      {loading && <div className="profile-info">Loading profile...</div>}
      {error && <div className="profile-error">{error}</div>}

      {!loading && !error && profile && (
        <div className="profile-grid">
          <article className="profile-card">
            <h3>Personal Details</h3>
            <div className="profile-kv"><span>Name</span><strong>{displayValue(profile.personal_details?.name)}</strong></div>
            <div className="profile-kv"><span>Emp ID</span><strong>{displayValue(profile.personal_details?.emp_id)}</strong></div>
            <div className="profile-kv"><span>Designation</span><strong>{displayValue(profile.personal_details?.designation)}</strong></div>
            <div className="profile-kv"><span>Department</span><strong>{displayValue(profile.personal_details?.department)}</strong></div>
            <div className="profile-kv"><span>Joining Date</span><strong>{displayValue(profile.personal_details?.joining_date)}</strong></div>
            <div className="profile-kv"><span>Email</span><strong>{displayValue(profile.personal_details?.email)}</strong></div>
            <div className="profile-kv"><span>Contact</span><strong>{displayValue(profile.personal_details?.contact_number)}</strong></div>
          </article>

          <article className="profile-card">
            <h3>Bank Details</h3>
            <div className="profile-kv"><span>Account Number</span><strong>{displayValue(profile.bank_details?.account_number)}</strong></div>
            <div className="profile-kv"><span>Bank Name</span><strong>{displayValue(profile.bank_details?.bank_name)}</strong></div>
            <div className="profile-kv"><span>IFSC Code</span><strong>{displayValue(profile.bank_details?.ifsc_code)}</strong></div>
            <div className="profile-kv"><span>Branch</span><strong>{displayValue(profile.bank_details?.branch_name)}</strong></div>
          </article>

          <article className="profile-card">
            <h3>Compliance IDs</h3>
            <div className="profile-kv"><span>PF Number</span><strong>{displayValue(profile.compliance_ids?.pf_number)}</strong></div>
            <div className="profile-kv"><span>ESI Number</span><strong>{displayValue(profile.compliance_ids?.esi_number)}</strong></div>
            <div className="profile-kv"><span>PAN</span><strong>{displayValue(profile.compliance_ids?.pan)}</strong></div>
            <div className="profile-kv"><span>Aadhaar</span><strong>{displayValue(profile.compliance_ids?.aadhaar)}</strong></div>
            <div className="profile-subsection">
              <h4>Tracker</h4>
              {tracker.length === 0 && <p className="profile-muted">Not available</p>}
              {tracker.map((item, idx) => (
                <div key={`${item.type}-${idx}`} className="tracker-item">
                  <span>{displayValue(item.type)}</span>
                  <strong>{displayValue(item.status)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="profile-card profile-card-wide">
            <h3>CTC Timeline</h3>
            {timeline.length === 0 && <p className="profile-muted">Not available</p>}
            {timeline.length > 0 && (
              <div className="timeline">
                {timeline.map((entry, idx) => (
                  <div key={`${entry.effective_from}-${idx}`} className="timeline-item">
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <div className="timeline-top">
                        <strong>{displayValue(entry.external_title || entry.internal_title)}</strong>
                        <span>{displayValue(entry.ctc_amount)}</span>
                      </div>
                      <div className="timeline-meta">
                        {displayValue(entry.effective_from)} to {displayValue(entry.effective_to)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
};

export default EmployeeProfilePage;
