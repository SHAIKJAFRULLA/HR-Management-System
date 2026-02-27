import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import EmployeeForm from "../components/EmployeeForm";
import EmployeeList from "../components/EmployeeList";
import EmployeeDirectoryControls from "../components/EmployeeDirectoryControls";
import { useAuth } from "../auth/AuthContext.jsx";
import {
  createEmployee,
  deactivateEmployee,
  getEmployees,
  updateEmployee,
  upsertEmployeeBankAccount,
} from "../api/employeeApi";
import {
  addRoleCtcHistory,
  bootstrapOnboarding,
  getDocuments,
  saveExitWorkflow,
  uploadDocument,
  verifyDocument,
} from "../api/hrApi";
import "../styles/Employee.css";

const demoEmployees = [
  {
    id: "demo-1",
    emp_id: "EMP1001",
    name: "Aarav Mehta",
    designation: "Software Engineer",
    department: "Engineering",
    email: "aarav.mehta@example.com",
    contact_number: "9876543210",
    joining_date: "2024-01-15",
    is_active: true,
    is_demo: true,
  },
  {
    id: "demo-2",
    emp_id: "EMP1002",
    name: "Isha Verma",
    designation: "HR Executive",
    department: "Human Resources",
    email: "isha.verma@example.com",
    contact_number: "9876543220",
    joining_date: "2023-10-04",
    is_active: true,
    is_demo: true,
  },
  {
    id: "demo-3",
    emp_id: "EMP1003",
    name: "Rohan Nair",
    designation: "Finance Analyst",
    department: "Finance",
    email: "rohan.nair@example.com",
    contact_number: "9876543230",
    joining_date: "2022-07-18",
    end_date: "2025-02-14",
    is_active: false,
    is_demo: true,
  },
];

function normalizeEmployee(emp) {
  return {
    ...emp,
    emp_id: String(emp.emp_id || emp.empCode || ""),
    name: emp.name || "",
    designation: emp.designation || emp.role || "",
    department: emp.department || "",
    joining_date: emp.joining_date || emp.date_of_joining || "",
    email: emp.email || "",
    contact_number: emp.contact_number || emp.phone || "",
    compliance_status: emp.compliance_status || "unknown",
    is_active: typeof emp.is_active === "boolean" ? emp.is_active : !emp.end_date,
  };
}

function employeeKey(emp) {
  return String(emp?.id ?? emp?.emp_id ?? "");
}

function compareText(a, b) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

const TOAST_MS = 3000;
const PAGE_SIZE = 8;

const EmployeePage = ({ globalSearch = "" }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [search, setSearch] = useState(globalSearch);
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [viewMode, setViewMode] = useState(() => localStorage.getItem("employee_view_mode") || "table");
  const [photoFilter, setPhotoFilter] = useState("all");
  const [selectedDepartments, setSelectedDepartments] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [compliance, setCompliance] = useState("all");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [exitTarget, setExitTarget] = useState(null);
  const [endDate, setEndDate] = useState("");
  const [editDocuments, setEditDocuments] = useState([]);
  const [photoMap, setPhotoMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("employee_photo_map") || "{}");
    } catch {
      return {};
    }
  });

  const isCreatePath = location.pathname.endsWith("/employees/new");
  const editMatch = location.pathname.match(/\/employees\/([^/]+)\/edit$/);
  const editId = editMatch?.[1] || null;
  const isEditPath = Boolean(editId);
  const isFormRoute = isCreatePath || isEditPath;

  const pushToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, TOAST_MS);
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getEmployees({ token });
      const list = Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : [];
      setEmployees(list.map(normalizeEmployee));
    } catch (err) {
      setError(err.message || "Failed to load employees");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  useEffect(() => {
    setSearch(globalSearch || "");
  }, [globalSearch]);

  useEffect(() => {
    localStorage.setItem("employee_view_mode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem("employee_photo_map", JSON.stringify(photoMap));
  }, [photoMap]);

  useEffect(() => {
    let mounted = true;
    async function loadEditDocs() {
      if (!editTarget?.emp_id) {
        setEditDocuments([]);
        return;
      }
      try {
        const docs = await getDocuments(editTarget.emp_id, { token });
        if (mounted) setEditDocuments(Array.isArray(docs) ? docs : []);
      } catch {
        if (mounted) setEditDocuments([]);
      }
    }
    loadEditDocs();
    return () => {
      mounted = false;
    };
  }, [editTarget, token]);

  const enrichedEmployees = useMemo(() => {
    const source = employees.length > 0 ? employees : demoEmployees;
    if (source.length >= 3) return source;
    return [...source, ...demoEmployees.slice(0, 3 - source.length)];
  }, [employees]);

  const departmentOptions = useMemo(() => {
    return [...new Set(enrichedEmployees.map((e) => e.department).filter(Boolean))].sort(compareText);
  }, [enrichedEmployees]);

  const roleOptions = useMemo(() => {
    return [...new Set(enrichedEmployees.map((e) => e.designation).filter(Boolean))].sort(compareText);
  }, [enrichedEmployees]);

  const editRouteTarget = useMemo(() => {
    if (!isEditPath) return null;
    return enrichedEmployees.find((emp) => String(emp.id) === editId) || null;
  }, [editId, enrichedEmployees, isEditPath]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    let items = [...enrichedEmployees];

    if (q) {
      items = items.filter((emp) => {
        return [emp.emp_id, emp.name, emp.department, emp.email, emp.contact_number]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(q));
      });
    }

    if (status !== "all") {
      const active = status === "active";
      items = items.filter((emp) => Boolean(emp.is_active) === active);
    }

    if (selectedDepartments.length > 0) {
      items = items.filter((emp) => selectedDepartments.includes(emp.department));
    }

    if (selectedRoles.length > 0) {
      items = items.filter((emp) => selectedRoles.includes(emp.designation));
    }

    if (compliance !== "all") {
      items = items.filter((emp) => String(emp.compliance_status || "unknown") === compliance);
    }

    if (photoFilter === "with_photo") {
      items = items.filter((emp) => Boolean(photoMap[emp.emp_id]));
    }
    if (photoFilter === "without_photo") {
      items = items.filter((emp) => !photoMap[emp.emp_id]);
    }

    items.sort((a, b) => {
      let result = 0;
      if (sortBy === "joining_date") {
        result = new Date(a.joining_date || "1900-01-01").getTime() - new Date(b.joining_date || "1900-01-01").getTime();
      } else {
        result = compareText(String(a.name || ""), String(b.name || ""));
      }
      return sortOrder === "asc" ? result : -result;
    });
    return items;
  }, [
    search,
    status,
    selectedDepartments,
    selectedRoles,
    compliance,
    photoFilter,
    photoMap,
    sortBy,
    sortOrder,
    enrichedEmployees,
  ]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, status, selectedDepartments, selectedRoles, compliance, photoFilter, sortBy, sortOrder]);

  const visibleEmployees = useMemo(() => filteredEmployees.slice(0, visibleCount), [filteredEmployees, visibleCount]);
  const hasMore = filteredEmployees.length > visibleCount;

  const metrics = useMemo(() => {
    const total = enrichedEmployees.length;
    const active = enrichedEmployees.filter((e) => e.is_active).length;
    const exited = total - active;
    const pendingCompliance = enrichedEmployees.filter((e) => String(e.compliance_status || "unknown") !== "compliant").length;
    return { total, active, exited, pendingCompliance };
  }, [enrichedEmployees]);

  function resetFilters() {
    setSearch("");
    setStatus("all");
    setSortBy("name");
    setSortOrder("asc");
    setPhotoFilter("all");
    setSelectedDepartments([]);
    setSelectedRoles([]);
    setCompliance("all");
  }

  async function applyExtraUpdates(empId, extras) {
    if (!empId || !extras) return;

    const tasks = [];

    if (extras.bankAccount) {
      tasks.push(upsertEmployeeBankAccount(empId, extras.bankAccount, { token }));
    }

    if (extras.bootstrapOnboarding) {
      tasks.push(bootstrapOnboarding({ emp_id: String(empId) }, { token }));
    }

    if (extras.roleChange?.role && extras.roleChange?.level && extras.roleChange?.start_date) {
      tasks.push(
        addRoleCtcHistory(
          {
            emp_id: String(empId),
            role: extras.roleChange.role,
            level: extras.roleChange.level,
            ctc_amount: Number(extras.roleChange.ctc_amount || 0),
            start_date: extras.roleChange.start_date,
            end_date: extras.roleChange.end_date || null,
            remarks: extras.roleChange.remarks || "",
          },
          { token }
        )
      );
    }

    if (extras.exitWorkflow?.last_working_day) {
      tasks.push(
        saveExitWorkflow(
          {
            emp_id: String(empId),
            last_working_day: extras.exitWorkflow.last_working_day,
            clearance_status: extras.exitWorkflow.clearance_status || "pending",
            final_settlement_done: Boolean(extras.exitWorkflow.final_settlement_done),
            remarks: extras.exitWorkflow.remarks || "",
          },
          { token }
        )
      );
    }

    await Promise.all(tasks);

    if (extras.uploadDocument?.file) {
      const form = new FormData();
      form.append("emp_id", String(empId));
      form.append("doc_type", extras.uploadDocument.doc_type || "general");
      form.append("notes", extras.uploadDocument.notes || "");
      form.append("file", extras.uploadDocument.file);
      await uploadDocument(form, { token });
    }

    if (extras.verifyDocument?.doc_id) {
      await verifyDocument(
        Number(extras.verifyDocument.doc_id),
        {
          status: extras.verifyDocument.status || "verified",
          notes: extras.verifyDocument.notes || "",
        },
        { token }
      );
    }
  }

  async function handleSubmit(data, mode = "create", target = null) {
    setError("");
    setBusy(true);
    try {
      const extras = data?.extras || {};
      const employeePayload = {
        emp_id: data.emp_id || "",
        name: data.name || "",
        designation: data.designation || "",
        department: data.department || "",
        contact_number: data.contact_number || "",
        email: data.email || "",
        joining_date: data.joining_date || "",
      };

      if (mode === "edit" && target) {
        const updated = normalizeEmployee(await updateEmployee(target.id, employeePayload, { token }));
        await applyExtraUpdates(updated.emp_id || target.emp_id, extras);
        setEmployees((prev) => prev.map((emp) => (employeeKey(emp) === employeeKey(target) ? updated : emp)));
        pushToast("success", "Employee updated successfully with additional details.");
      } else {
        const alreadyExists = enrichedEmployees.some(
          (emp) => String(emp.emp_id || "").trim().toLowerCase() === String(data.emp_id || "").trim().toLowerCase()
        );
        if (alreadyExists) throw new Error("Emp ID must be unique. Please use a different Emp ID.");
        const created = normalizeEmployee(await createEmployee(employeePayload, { token }));
        await applyExtraUpdates(created.emp_id || employeePayload.emp_id, extras);
        setEmployees((prev) => [created, ...prev.filter((emp) => employeeKey(emp) !== employeeKey(created))]);
        pushToast("success", "Employee created successfully with additional details.");
      }
      fetchEmployees();
      setShowCreateModal(false);
      setEditTarget(null);
      if (isFormRoute) navigate("/home/employees");
    } catch (err) {
      setError(err.message || "Failed to save employee");
      pushToast("error", err.message || "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeactivate() {
    if (!exitTarget?.id || !endDate) {
      setError("End date is required to exit an employee.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = normalizeEmployee(await deactivateEmployee(exitTarget.id, endDate, { token }));
      setEmployees((prev) => prev.map((emp) => (employeeKey(emp) === employeeKey(exitTarget) ? updated : emp)));
      pushToast("success", "Employee exited successfully.");
      setExitTarget(null);
      setEndDate("");
      fetchEmployees();
    } catch (err) {
      setError(err.message || "Failed to exit employee");
      pushToast("error", err.message || "Exit failed");
    } finally {
      setBusy(false);
    }
  }

  function handlePhotoUpload(employee, file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoMap((prev) => ({ ...prev, [employee.emp_id]: String(reader.result || "") }));
      pushToast("success", `Photo updated for ${employee.name}`);
    };
    reader.readAsDataURL(file);
  }

  function renderRouteForm() {
    const mode = isEditPath ? "edit" : "create";
    const selected = isEditPath ? editRouteTarget : null;

    return (
      <div className="form-card">
        <div className="form-card-title">{mode === "edit" ? "Edit Employee" : "Create Employee"}</div>
        {isEditPath && !selected ? (
          <p className="notice notice-error">Unable to find employee for editing.</p>
        ) : (
          <EmployeeForm
            key={selected?.id || "new"}
            onSubmit={(payload) => handleSubmit(payload, mode, selected)}
            selected={selected}
            mode={mode}
            documents={editDocuments}
            submitting={busy}
          />
        )}
        <div className="form-actions">
          <button className="btn-secondary" onClick={() => navigate("/home/employees")} disabled={busy}>
            Back to List
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="employee-shell">
      <div className="employee-card">
        <div className="employee-header">
          <div>
            <h2>Employee Management</h2>
            <p>Create, update, deactivate, and monitor lifecycle with premium controls.</p>
          </div>
          {!isFormRoute && (
            <div className="employee-header-actions">
              <button className="btn-secondary" onClick={fetchEmployees} disabled={loading}>
                Refresh
              </button>
              <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
                Add Employee
              </button>
            </div>
          )}
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        {!isFormRoute && (
          <div className="metrics-inline">
            <div><span>Total</span><strong>{metrics.total}</strong></div>
            <div><span>Active</span><strong>{metrics.active}</strong></div>
            <div><span>Exited</span><strong>{metrics.exited}</strong></div>
            <div><span>Pending Compliance</span><strong>{metrics.pendingCompliance}</strong></div>
          </div>
        )}

        {isFormRoute ? (
          renderRouteForm()
        ) : (
          <>
            <EmployeeDirectoryControls
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              sortOrder={sortOrder}
              onSortOrderChange={() => setSortOrder((v) => (v === "asc" ? "desc" : "asc"))}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              photoFilter={photoFilter}
              onPhotoFilterChange={setPhotoFilter}
              departmentOptions={departmentOptions}
              selectedDepartments={selectedDepartments}
              onDepartmentChange={setSelectedDepartments}
              roleOptions={roleOptions}
              selectedRoles={selectedRoles}
              onRoleChange={setSelectedRoles}
              compliance={compliance}
              onComplianceChange={setCompliance}
              onClearFilters={resetFilters}
            />

            <EmployeeList
              employees={visibleEmployees}
              onProfile={(employee) => navigate(`/employee/${employee.emp_id}/profile`)}
              onEdit={setEditTarget}
              onDeactivate={(employee) => {
                setExitTarget(employee);
                setEndDate("");
              }}
              viewMode={viewMode}
              photoMap={photoMap}
              onPhotoUpload={handlePhotoUpload}
              loading={loading}
            />

            {hasMore && (
              <div className="load-more-wrap">
                <button className="btn-secondary" type="button" onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}>
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Create employee modal">
          <div className="modal-card">
            <div className="modal-head">
              <h3>Create Employee</h3>
              <button className="icon-btn" type="button" onClick={() => setShowCreateModal(false)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <EmployeeForm onSubmit={(payload) => handleSubmit(payload, "create")} mode="create" submitting={busy} />
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit employee modal">
          <div className="modal-card">
            <div className="modal-head">
              <h3>Edit Employee</h3>
              <button className="icon-btn" type="button" onClick={() => setEditTarget(null)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <EmployeeForm
              onSubmit={(payload) => handleSubmit(payload, "edit", editTarget)}
              selected={editTarget}
              mode="edit"
              documents={editDocuments}
              submitting={busy}
            />
          </div>
        </div>
      )}

      {exitTarget && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Exit employee modal">
          <div className="modal-card small">
            <div className="modal-head">
              <h3>Exit Employee</h3>
              <button className="icon-btn" type="button" onClick={() => setExitTarget(null)}>
                <i className="bi bi-x-lg" />
              </button>
            </div>
            <p className="modal-copy">
              Confirm exit for <strong>{exitTarget.name}</strong> ({exitTarget.emp_id}).
            </p>
            <label className="form-field">
              <span>Last Working Day</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </label>
            <div className="modal-actions">
              <button className="btn-danger" onClick={confirmDeactivate} disabled={busy || !endDate}>
                Confirm Exit
              </button>
              <button className="btn-secondary" onClick={() => setExitTarget(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="toast-wrap" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item ${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </section>
  );
};

export default EmployeePage;
