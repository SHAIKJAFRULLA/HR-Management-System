import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getEmployees } from "../api/employeeApi";
import { getEmployeeBankAccount, upsertEmployeeBankAccount } from "../api/employeeApi";
import {
  addRoleCtcHistory,
  bootstrapOnboarding,
  createAlert,
  getAlerts,
  getComplianceDashboard,
  getComplianceReport,
  getCtcAnalytics,
  getDocuments,
  getExitWorkflows,
  getHeadcount,
  getJoinersLeavers,
  getOnboarding,
  getRoleCtcHistory,
  saveExitWorkflow,
  saveOnboarding,
  uploadDocument,
  verifyDocument,
} from "../api/hrApi";
import { useAuth } from "../auth/AuthContext.jsx";
import "../styles/HRModules.css";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
}

export default function HRModulesPage() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");

  const [headcount, setHeadcount] = useState({ total: 0, active: 0, exited: 0 });
  const [joinersLeavers, setJoinersLeavers] = useState([]);
  const [ctcAnalytics, setCtcAnalytics] = useState({ salary_bands: [], level_distribution: [] });
  const [complianceDashboard, setComplianceDashboard] = useState({ metrics: {}, gaps: [] });
  const [complianceReport, setComplianceReport] = useState([]);
  const [alerts, setAlerts] = useState({ alerts: [], dynamic_reminders: [] });

  const [documents, setDocuments] = useState([]);
  const [onboarding, setOnboarding] = useState({ items: [], summary: [] });
  const [roleHistory, setRoleHistory] = useState([]);
  const [exitWorkflow, setExitWorkflow] = useState([]);
  const [bank, setBank] = useState({
    account_number: "",
    bank_name: "",
    ifsc_code: "",
    branch_name: "",
  });

  const [docUpload, setDocUpload] = useState({ doc_type: "general", notes: "", file: null });
  const [docVerify, setDocVerify] = useState({ doc_id: "", status: "verified", notes: "" });
  const [alertForm, setAlertForm] = useState({
    emp_id: "",
    alert_type: "manual",
    message: "",
    severity: "medium",
    due_date: "",
  });
  const [roleForm, setRoleForm] = useState({
    role: "",
    level: "",
    ctc_amount: "",
    start_date: "",
    end_date: "",
    remarks: "",
  });
  const [exitForm, setExitForm] = useState({
    last_working_day: "",
    clearance_status: "pending",
    final_settlement_done: false,
    remarks: "",
  });
  const [onboardingForm, setOnboardingForm] = useState({
    item_name: "",
    is_completed: false,
    notes: "",
  });

  useEffect(() => {
    let mounted = true;
    async function loadBase() {
      setLoading(true);
      setError("");
      try {
        const [empRows, head, jl, ctc, compDash, compReport, alertRows] = await Promise.all([
          getEmployees({ token }),
          getHeadcount({ token }),
          getJoinersLeavers({}, { token }),
          getCtcAnalytics({ token }),
          getComplianceDashboard({ token }),
          getComplianceReport({}, { token }),
          getAlerts({ token }),
        ]);
        if (!mounted) return;
        const employeeRows = asArray(empRows);
        setEmployees(employeeRows);
        setSelectedEmpId((prev) => prev || String(employeeRows?.[0]?.emp_id || ""));
        setHeadcount(head || { total: 0, active: 0, exited: 0 });
        setJoinersLeavers(asArray(jl));
        setCtcAnalytics(ctc || { salary_bands: [], level_distribution: [] });
        setComplianceDashboard(compDash || { metrics: {}, gaps: [] });
        setComplianceReport(asArray(compReport));
        setAlerts(alertRows || { alerts: [], dynamic_reminders: [] });
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Failed to load HR data.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadBase();
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedEmpId) return;
    let mounted = true;
    async function loadByEmployee() {
      try {
        const [docs, onb, roleRows, exitRows, bankInfo] = await Promise.all([
          getDocuments(selectedEmpId, { token }),
          getOnboarding(selectedEmpId, { token }),
          getRoleCtcHistory(selectedEmpId, { token }),
          getExitWorkflows(selectedEmpId, { token }),
          getEmployeeBankAccount(selectedEmpId, { token }),
        ]);
        if (!mounted) return;
        setDocuments(asArray(docs));
        setOnboarding(onb || { items: [], summary: [] });
        setRoleHistory(asArray(roleRows));
        setExitWorkflow(asArray(exitRows));
        setBank({
          account_number: bankInfo?.account_number || "",
          bank_name: bankInfo?.bank_name || "",
          ifsc_code: bankInfo?.ifsc_code || "",
          branch_name: bankInfo?.branch_name || "",
        });
      } catch (err) {
        if (!mounted) return;
        setError(err.message || "Failed to load employee-specific HR data.");
      }
    }
    loadByEmployee();
    return () => {
      mounted = false;
    };
  }, [selectedEmpId, token]);

  const selectedEmpName = useMemo(() => {
    const row = employees.find((x) => String(x.emp_id) === String(selectedEmpId));
    return row?.name || selectedEmpId;
  }, [employees, selectedEmpId]);

  async function reloadEmployeeBlocks() {
    if (!selectedEmpId) return;
    const [docs, onb, roleRows, exitRows, bankInfo] = await Promise.all([
      getDocuments(selectedEmpId, { token }),
      getOnboarding(selectedEmpId, { token }),
      getRoleCtcHistory(selectedEmpId, { token }),
      getExitWorkflows(selectedEmpId, { token }),
      getEmployeeBankAccount(selectedEmpId, { token }),
    ]);
    setDocuments(asArray(docs));
    setOnboarding(onb || { items: [], summary: [] });
    setRoleHistory(asArray(roleRows));
    setExitWorkflow(asArray(exitRows));
    setBank({
      account_number: bankInfo?.account_number || "",
      bank_name: bankInfo?.bank_name || "",
      ifsc_code: bankInfo?.ifsc_code || "",
      branch_name: bankInfo?.branch_name || "",
    });
  }

  async function onSaveBank(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await upsertEmployeeBankAccount(selectedEmpId, bank, { token });
      setMessage("Bank account details saved.");
      await reloadEmployeeBlocks();
    } catch (err) {
      setError(err.message || "Unable to save bank account.");
    }
  }

  async function onUploadDocument(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!docUpload.file) {
      setError("Select a file before upload.");
      return;
    }
    try {
      const form = new FormData();
      form.append("emp_id", selectedEmpId);
      form.append("doc_type", docUpload.doc_type);
      form.append("notes", docUpload.notes);
      form.append("file", docUpload.file);
      await uploadDocument(form, { token });
      setMessage("Document uploaded.");
      setDocUpload({ doc_type: "general", notes: "", file: null });
      await reloadEmployeeBlocks();
    } catch (err) {
      setError(err.message || "Document upload failed.");
    }
  }

  async function onVerifyDocument(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await verifyDocument(docVerify.doc_id, { status: docVerify.status, notes: docVerify.notes }, { token });
      setMessage("Document verification updated.");
      setDocVerify({ doc_id: "", status: "verified", notes: "" });
      await reloadEmployeeBlocks();
    } catch (err) {
      setError(err.message || "Document verification failed.");
    }
  }

  async function onBootstrapOnboarding() {
    setError("");
    setMessage("");
    try {
      await bootstrapOnboarding({ emp_id: String(selectedEmpId) }, { token });
      setMessage("Default onboarding checklist created.");
      await reloadEmployeeBlocks();
    } catch (err) {
      setError(err.message || "Failed to bootstrap onboarding.");
    }
  }

  async function onCreateOnboardingItem(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await saveOnboarding(
        {
          emp_id: String(selectedEmpId),
          item_name: onboardingForm.item_name,
          is_completed: onboardingForm.is_completed,
          notes: onboardingForm.notes,
        },
        { token }
      );
      setMessage("Onboarding item added.");
      setOnboardingForm({ item_name: "", is_completed: false, notes: "" });
      await reloadEmployeeBlocks();
    } catch (err) {
      setError(err.message || "Failed to add onboarding item.");
    }
  }

  async function onAddRoleHistory(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await addRoleCtcHistory(
        {
          emp_id: String(selectedEmpId),
          role: roleForm.role,
          level: roleForm.level,
          ctc_amount: Number(roleForm.ctc_amount || 0),
          start_date: roleForm.start_date,
          end_date: roleForm.end_date || null,
          remarks: roleForm.remarks,
        },
        { token }
      );
      setMessage("Role/CTC history added.");
      setRoleForm({ role: "", level: "", ctc_amount: "", start_date: "", end_date: "", remarks: "" });
      await reloadEmployeeBlocks();
    } catch (err) {
      setError(err.message || "Failed to add role/CTC history.");
    }
  }

  async function onSaveExitWorkflow(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await saveExitWorkflow(
        {
          emp_id: String(selectedEmpId),
          last_working_day: exitForm.last_working_day,
          clearance_status: exitForm.clearance_status,
          final_settlement_done: exitForm.final_settlement_done,
          remarks: exitForm.remarks,
        },
        { token }
      );
      setMessage("Exit workflow saved.");
      setExitForm({ last_working_day: "", clearance_status: "pending", final_settlement_done: false, remarks: "" });
      await reloadEmployeeBlocks();
    } catch (err) {
      setError(err.message || "Failed to save exit workflow.");
    }
  }

  async function onCreateAlert(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await createAlert(
        {
          emp_id: Number(alertForm.emp_id || selectedEmpId),
          alert_type: alertForm.alert_type,
          message: alertForm.message,
          severity: alertForm.severity,
          due_date: alertForm.due_date || null,
        },
        { token }
      );
      setMessage("Alert created.");
      setAlertForm({ emp_id: "", alert_type: "manual", message: "", severity: "medium", due_date: "" });
      const alertRows = await getAlerts({ token });
      setAlerts(alertRows || { alerts: [], dynamic_reminders: [] });
    } catch (err) {
      setError(err.message || "Failed to create alert.");
    }
  }

  return (
    <section className="hr-shell">
      <div className="hr-top">
        <div>
          <h1>HR Modules</h1>
          <p>All requested modules are enabled here with live API integration.</p>
        </div>
        <div className="hr-top-actions">
          <select value={selectedEmpId} onChange={(e) => setSelectedEmpId(e.target.value)}>
            {employees.map((row) => (
              <option key={row.emp_id} value={row.emp_id}>
                {row.emp_id} - {row.name || "Employee"}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => navigate("/home/dashboard")}>
            Back
          </button>
        </div>
      </div>

      {error ? <div className="hr-alert hr-error">{error}</div> : null}
      {message ? <div className="hr-alert hr-success">{message}</div> : null}
      {loading ? <div className="hr-alert hr-info">Loading HR modules...</div> : null}

      <div className="hr-grid">
        <article className="hr-card">
          <h3>Headcount Report</h3>
          <div className="metric-grid">
            <div className="metric-card">
              <span>Total</span>
              <strong>{headcount.total || 0}</strong>
            </div>
            <div className="metric-card active">
              <span>Active</span>
              <strong>{headcount.active || 0}</strong>
            </div>
            <div className="metric-card exited">
              <span>Exited</span>
              <strong>{headcount.exited || 0}</strong>
            </div>
          </div>
        </article>

        <article className="hr-card">
          <h3>Joiners & Leavers</h3>
          <div className="list-compact">
            {asArray(joinersLeavers).slice(0, 6).map((row) => (
              <div className="list-item" key={row.month}>
                <em>{row.month}</em>
                <span>Joiners: {row.joiners}</span>
                <span>Leavers: {row.leavers}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="hr-card">
          <h3>CTC Distribution</h3>
          {asArray(ctcAnalytics.salary_bands).map((x) => (
            <div className="bar-row" key={x.band}>
              <label>{x.band}</label>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${Math.min(100, (x.count || 0) * 10)}%`, background: "#3377ff" }} />
              </div>
              <strong>{x.count}</strong>
            </div>
          ))}
          <h4>Level Distribution</h4>
          <div className="list-compact">
            {asArray(ctcAnalytics.level_distribution).slice(0, 8).map((x) => (
              <div className="list-item" key={x.level}>
                <em>{x.level}</em>
                <span />
                <strong>{x.count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="hr-card">
          <h3>Compliance Dashboard</h3>
          <div className="list-compact">
            <div className="list-item">
              <em>Total Employees</em>
              <span />
              <strong>{complianceDashboard.metrics?.total_employees || 0}</strong>
            </div>
            <div className="list-item">
              <em>Missing Documents</em>
              <span />
              <strong>{complianceDashboard.metrics?.missing_documents || 0}</strong>
            </div>
            <div className="list-item">
              <em>Pending Verifications</em>
              <span />
              <strong>{complianceDashboard.metrics?.pending_verifications || 0}</strong>
            </div>
          </div>
        </article>

        <article className="hr-card hr-wide">
          <h3>Compliance Status Report</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {complianceReport.slice(0, 30).map((row, idx) => (
                  <tr key={`${row.emp_id}-${idx}`}>
                    <td>{row.emp_id}</td>
                    <td>{row.employee_name}</td>
                    <td>{row.document_type}</td>
                    <td>
                      <span className={`badge ${row.status}`}>{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="hr-card hr-wide">
          <h3>Alerts & Reminder System</h3>
          <form className="toolbar" onSubmit={onCreateAlert}>
            <input
              type="number"
              placeholder={`Emp ID (default ${selectedEmpId || "-"})`}
              value={alertForm.emp_id}
              onChange={(e) => setAlertForm((v) => ({ ...v, emp_id: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Alert type"
              value={alertForm.alert_type}
              onChange={(e) => setAlertForm((v) => ({ ...v, alert_type: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Message"
              value={alertForm.message}
              onChange={(e) => setAlertForm((v) => ({ ...v, message: e.target.value }))}
              required
            />
            <select value={alertForm.severity} onChange={(e) => setAlertForm((v) => ({ ...v, severity: e.target.value }))}>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
            </select>
            <input
              type="date"
              value={alertForm.due_date}
              onChange={(e) => setAlertForm((v) => ({ ...v, due_date: e.target.value }))}
            />
            <button type="submit">Create Alert</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Emp</th>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {asArray(alerts.alerts).map((a) => (
                  <tr key={a.id}>
                    <td>{a.emp_id}</td>
                    <td>{a.alert_type}</td>
                    <td>{a.message}</td>
                    <td>{a.severity}</td>
                  </tr>
                ))}
                {asArray(alerts.dynamic_reminders).map((a, idx) => (
                  <tr key={`d-${idx}`}>
                    <td>{a.emp_id}</td>
                    <td>{a.alert_type}</td>
                    <td>{a.message}</td>
                    <td>{a.severity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="hr-card">
          <h3>Employee Bank Account</h3>
          <p>Employee: {selectedEmpName}</p>
          <form className="toolbar stacked" onSubmit={onSaveBank}>
            <input
              type="text"
              placeholder="Account number"
              value={bank.account_number}
              onChange={(e) => setBank((v) => ({ ...v, account_number: e.target.value }))}
              required
            />
            <input
              type="text"
              placeholder="Bank name"
              value={bank.bank_name}
              onChange={(e) => setBank((v) => ({ ...v, bank_name: e.target.value }))}
              required
            />
            <input
              type="text"
              placeholder="IFSC code"
              value={bank.ifsc_code}
              onChange={(e) => setBank((v) => ({ ...v, ifsc_code: e.target.value }))}
              required
            />
            <input
              type="text"
              placeholder="Branch name"
              value={bank.branch_name}
              onChange={(e) => setBank((v) => ({ ...v, branch_name: e.target.value }))}
              required
            />
            <button type="submit">Save Bank Account</button>
          </form>
        </article>

        <article className="hr-card">
          <h3>Document Upload & Verification</h3>
          <form className="toolbar stacked" onSubmit={onUploadDocument}>
            <input
              type="text"
              placeholder="Document type"
              value={docUpload.doc_type}
              onChange={(e) => setDocUpload((v) => ({ ...v, doc_type: e.target.value }))}
            />
            <input
              type="text"
              placeholder="Notes"
              value={docUpload.notes}
              onChange={(e) => setDocUpload((v) => ({ ...v, notes: e.target.value }))}
            />
            <input type="file" onChange={(e) => setDocUpload((v) => ({ ...v, file: e.target.files?.[0] || null }))} />
            <button type="submit">Upload Document</button>
          </form>
          <form className="toolbar stacked" onSubmit={onVerifyDocument}>
            <select value={docVerify.doc_id} onChange={(e) => setDocVerify((v) => ({ ...v, doc_id: e.target.value }))} required>
              <option value="">Select Document</option>
              {documents.map((d) => (
                <option key={d.id} value={d.id}>
                  #{d.id} - {d.doc_type} ({d.status})
                </option>
              ))}
            </select>
            <select value={docVerify.status} onChange={(e) => setDocVerify((v) => ({ ...v, status: e.target.value }))}>
              <option value="pending">pending</option>
              <option value="verified">verified</option>
              <option value="rejected">rejected</option>
            </select>
            <input
              type="text"
              placeholder="Verification notes"
              value={docVerify.notes}
              onChange={(e) => setDocVerify((v) => ({ ...v, notes: e.target.value }))}
            />
            <button type="submit">Update Verification</button>
          </form>
        </article>

        <article className="hr-card hr-wide">
          <h3>Role/Job Change Tracking</h3>
          <form className="toolbar" onSubmit={onAddRoleHistory}>
            <input type="text" placeholder="Role" value={roleForm.role} onChange={(e) => setRoleForm((v) => ({ ...v, role: e.target.value }))} required />
            <input type="text" placeholder="Level" value={roleForm.level} onChange={(e) => setRoleForm((v) => ({ ...v, level: e.target.value }))} required />
            <input
              type="number"
              placeholder="CTC amount"
              value={roleForm.ctc_amount}
              onChange={(e) => setRoleForm((v) => ({ ...v, ctc_amount: e.target.value }))}
              required
            />
            <input type="date" value={roleForm.start_date} onChange={(e) => setRoleForm((v) => ({ ...v, start_date: e.target.value }))} required />
            <input type="date" value={roleForm.end_date} onChange={(e) => setRoleForm((v) => ({ ...v, end_date: e.target.value }))} />
            <input type="text" placeholder="Remarks" value={roleForm.remarks} onChange={(e) => setRoleForm((v) => ({ ...v, remarks: e.target.value }))} />
            <button type="submit">Add Role Change</button>
          </form>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Level</th>
                  <th>CTC</th>
                  <th>Start</th>
                  <th>End</th>
                </tr>
              </thead>
              <tbody>
                {roleHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.role}</td>
                    <td>{row.level}</td>
                    <td>{row.ctc_amount}</td>
                    <td>{toDate(row.start_date)}</td>
                    <td>{toDate(row.end_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="hr-card">
          <h3>Exit Workflow Management</h3>
          <form className="toolbar stacked" onSubmit={onSaveExitWorkflow}>
            <input
              type="date"
              value={exitForm.last_working_day}
              onChange={(e) => setExitForm((v) => ({ ...v, last_working_day: e.target.value }))}
              required
            />
            <select value={exitForm.clearance_status} onChange={(e) => setExitForm((v) => ({ ...v, clearance_status: e.target.value }))}>
              <option value="pending">pending</option>
              <option value="in_progress">in_progress</option>
              <option value="completed">completed</option>
            </select>
            <label className="check-wrap">
              <input
                type="checkbox"
                checked={exitForm.final_settlement_done}
                onChange={(e) => setExitForm((v) => ({ ...v, final_settlement_done: e.target.checked }))}
              />
              Final settlement completed
            </label>
            <input
              type="text"
              placeholder="Remarks"
              value={exitForm.remarks}
              onChange={(e) => setExitForm((v) => ({ ...v, remarks: e.target.value }))}
            />
            <button type="submit">Save Exit Workflow</button>
          </form>
          <div className="list-compact">
            {exitWorkflow.map((x) => (
              <div className="list-item" key={`${x.emp_id}-${x.last_working_day}`}>
                <em>{x.clearance_status}</em>
                <span>{toDate(x.last_working_day)}</span>
                <strong>{x.final_settlement_done ? "Settlement Done" : "Pending"}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="hr-card">
          <h3>Onboarding</h3>
          <div className="toolbar">
            <button type="button" onClick={onBootstrapOnboarding}>
              Bootstrap Default Checklist
            </button>
          </div>
          <form className="toolbar stacked" onSubmit={onCreateOnboardingItem}>
            <input
              type="text"
              placeholder="Checklist item"
              value={onboardingForm.item_name}
              onChange={(e) => setOnboardingForm((v) => ({ ...v, item_name: e.target.value }))}
              required
            />
            <label className="check-wrap">
              <input
                type="checkbox"
                checked={onboardingForm.is_completed}
                onChange={(e) => setOnboardingForm((v) => ({ ...v, is_completed: e.target.checked }))}
              />
              Mark as completed
            </label>
            <input
              type="text"
              placeholder="Notes"
              value={onboardingForm.notes}
              onChange={(e) => setOnboardingForm((v) => ({ ...v, notes: e.target.value }))}
            />
            <button type="submit">Add Onboarding Item</button>
          </form>
          <div className="list-compact">
            {asArray(onboarding.items).slice(0, 8).map((row) => (
              <div className="list-item" key={row.id}>
                <em>{row.item_name}</em>
                <span>{row.is_completed ? "Completed" : "Pending"}</span>
                <strong>{toDate(row.completed_at)}</strong>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
